import express from 'express';
import { verify, GetPublicKeyOrSecret, JwtPayload } from 'jsonwebtoken';
import FusionAuthClient from "@fusionauth/typescript-client";
import jwksClient, { RsaSigningKey } from 'jwks-rsa';
import { fetchUserSession, sessionCache } from './session';

/** Promisify JWT verification 
  * @param token JWT token to verify
  * @param getKey Function to get the public key or secret for verification
  * @returns Promise resolving to the decoded JWT payload or undefined if verification fails
  */
export function verifyJwtAsync(token: string, getKey: GetPublicKeyOrSecret): Promise<JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    verify(token, getKey, undefined, (err, decoded) => {
      if (err) return reject(err);
      if (typeof decoded === 'string') {
        // Try to parse as JSON, otherwise wrap as object
        try {
          const parsed = JSON.parse(decoded);
          resolve(parsed as JwtPayload);
        } catch {
          resolve({ decoded } as JwtPayload);
        }
      } else {
        resolve(decoded as JwtPayload);
      }
    });
  });
}

/** Request new tokens from FusionAuth
  * @param refreshTokenValue The refresh token to use
  * @param client The FusionAuth client instance
  * @param clientId The client ID for the FusionAuth application
  * @param clientSecret The client secret for the FusionAuth application
  * @returns The new tokens or null if the request failed
  */
export const refreshTokens = async (
  refreshTokenValue: string,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string
) => {
  try {
    const response = await client.exchangeRefreshTokenForAccessToken(
      refreshTokenValue,
      clientId,
      clientSecret,
      'offline_access openid profile email', // Scopes for refresh token and user info
      ''
    );
    return response.response;
  } catch (err) {
    console.error('Failed to refresh tokens:', err);
    return null;
  }
};

/** Generate state value for CSRF protection
  * @returns A random string
  */
export const generateStateValue = () => {
  return Array(6).fill(0).map(() => Math.random().toString(36).substring(2, 15)).join('');
};

/** Handle refresh token grant
  * Calls FusionAuth to exchange the refresh token for new access and refresh tokens
  * Updates the user session with the new tokens and user info
  * Schedules a new token refresh before the access token expires
  * @param sid User's session ID
  * @param refreshToken User's refresh token to use
  * @param res The Express response object
  * @param client The FusionAuth client instance
  * @param clientId The client ID for the FusionAuth application
  * @param clientSecret The client secret for the FusionAuth application
  * @param getKey Function to get the public key or secret for verification
  * @returns The new tokens or false if the request failed
  */
export const handleRefreshGrant = async (
  sid: string,
  refreshToken: string,
  res: express.Response,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret
) => {
  const newTokens = await refreshTokens(refreshToken, client, clientId, clientSecret);
  
  if (!newTokens?.access_token) {
    console.log('Could not get new access token from FusionAuth using refresh token; user is not authenticated');
    return false;
  }
  
  try {
    const userResponse = (await client.retrieveUserUsingJWT(newTokens.access_token)).response;
    
    if (userResponse?.user) {
      // Get existing user session
      const userSession = await fetchUserSession(sid);
      if (userSession) {
        // Update user session with new tokens
        userSession.at = newTokens.access_token;
        userSession.rt = newTokens.refresh_token ?? null;
        userSession.u = userResponse.user; // Update user info in session
        userSession.last = Date.now();
        // Update session cache with new user session
        if (typeof userSession.sid === 'string') {
          await sessionCache.set(userSession.sid, userSession);
        } else {
          console.error('Session ID is missing or invalid, cannot update session cache.');
        }
      }
      const decodedFromJwt = await verifyJwtAsync(newTokens.access_token, getKey);
      console.log('Tokens and user info refreshed successfully');

      const expiresAt = Math.floor(Date.now()) + (newTokens.expires_in || 3590) * 1000;
      // Pass through parameters for handling refresh tokens
      scheduleTokenRefresh(
        expiresAt,
        sid as string,
        refreshToken || '',
        res,
        client,
        clientId,
        clientSecret,
        getKey
      );

      return { decoded: decodedFromJwt, user: userResponse.user };
    }
  } catch (err) {
    console.error('Failed to retrieve user info after refresh:', err);
  }
  
  return false;
};

/**
 * Create a function to get the public key or secret for JWT verification
 * @param jwks The JWKS client instance
 * @returns A function that retrieves the signing key for a given JWT header
 */
export const createJwksClient = (fusionAuthURL: string) => {
  return jwksClient({
    jwksUri: `${fusionAuthURL}/.well-known/jwks.json`
  });
};

/**
 * Create a function to get the public key or secret for JWT verification
 * @param jwks The JWKS client instance
 * @returns A function that retrieves the signing key for a given JWT header
 */
export const createGetKey = (jwks: jwksClient.JwksClient): GetPublicKeyOrSecret => {
  return (header, callback) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err, undefined);
      const signingKey = (key as RsaSigningKey)?.getPublicKey() || (key as RsaSigningKey)?.rsaPublicKey;
      callback(null, signingKey);
    });
  };
};

/** Verify tokens
 * For checksession & middleware for protected API requests
 * If JWT invalid or expired, check for refresh token
 * Initiate refresh grant to get new tokens from FusionAuth if necessary
 * @param sid The session ID
 * @param accessToken The access token to verify
 * @param refreshToken The refresh token to use if access token is invalid
 * @param res The Express response object
 * @param client The FusionAuth client instance
 * @param clientId The client ID for the FusionAuth application
 * @param clientSecret The client secret for the FusionAuth application
 * @param getKey Function to get the public key or secret for verification
 * @returns The decoded JWT payload and user info if verification is successful, false otherwise
 */
export const verifyJWT = async (
  sid: string | undefined | null,
  accessToken: string | undefined | null,
  refreshToken: string | undefined | null,
  res: express.Response | undefined,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret
): Promise<{ decoded: JwtPayload | undefined, user?: any } | false> => {
  // Validate inputs
  if (!isValidSessionId(sid)) {
    console.log('Invalid session ID provided to verifyJWT');
    return false;
  }

  // Try to verify existing access token first
  if (isValidJWT(accessToken)) {
    try {
      const decodedFromJwt = await verifyJwtAsync(accessToken, getKey);
      return { decoded: decodedFromJwt };
    } catch (err) {
      console.log('Invalid or missing access token: initializing refresh token grant');
      // Fall through to refresh logic
    }
  }
  
  // If access token invalid/missing, try refresh token
  if (refreshToken && res && sid) {
    return await handleRefreshGrant(
      sid,
      refreshToken, 
      res, 
      client, 
      clientId, 
      clientSecret, 
      getKey
    );
  }

  // No valid tokens found
  return false;
};

/**
  * Clear any existing session stay-alive (refresh) timer
  */
export const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};

/**
  * Set a timer to refresh the access token before it expires
  * @param {number} expiresAt - The timestamp when the access token expires
  * @param {string} refreshToken - The refresh token to use for refreshing the access token
  * @param {FusionAuthClient} client - The FusionAuth client instance to use for refreshing tokens
  * @param {string} clientId - The client ID for the FusionAuth application
  * @param {string} clientSecret - The client secret for the FusionAuth application
  * This is important for a good user experience because the access token
  * expiry time should be very short in OAuth2 flows, especially for
  * browser-based apps
  */
export const scheduleTokenRefresh = (
  expiresAt: number,
  sid: string,
  refreshToken: string,
  res: express.Response,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret
): void => {
  clearRefreshTimer();
  const now = Date.now();
  // Refresh 1 minute before expiry, but never less than 0
  const refreshIn = Math.max(expiresAt - now - 60000, 0);
  console.log(`Scheduling token refresh in ${Math.floor(refreshIn / 1000 / 60)} minutes for session ${sid}`);
  refreshTimer = setTimeout(async () => {
    await handleRefreshGrant(
      sid,
      refreshToken,
      res,
      client,
      clientId,
      clientSecret,
      getKey
    );
  }, refreshIn);
};

/*---------------------------------
        Middleware factory
---------------------------------*/

/** Create a function to get the public key or secret for JWT verification
 * Factory to create auth middleware ('secure') to secure API endpoints
 * Checks if the user is authenticated by verifying JWT in userToken cookie
 * If JWT is invalid or expired, attempt to refresh access token using refresh token
 * If user is authenticated: proceed
 * @param client The FusionAuth client instance
 * @param clientId The client ID for the FusionAuth application
 * @param clientSecret The client secret for the FusionAuth application
 * @param getKey Function to get the public key or secret for verification
 * @returns A function that retrieves the signing key for a given JWT header
 */
export const createSecureMiddleware = (
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret
) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Get access token from Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - No valid Authorization header found'
      });
    }
    
    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!isValidJWT(accessToken)) {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - Invalid access token format'
      });
    }

    // Verify the access token
    try {
      await verifyJwtAsync(accessToken, getKey);
      // If verification successful, proceed to next middleware
      next();
    } catch (err) {
      console.log('Invalid or expired access token:', err);
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - Invalid or expired access token'
      });
    }
  };
};

/*---------------------------------
      Validation & helpers
---------------------------------*/

/** Check if the session ID is valid
 * @param sessionId The session ID to validate
 * @returns True if the session ID is a non-empty string of X*2 hexadecimal characters, false otherwise
 */
export const isValidSessionId = (sessionId: string | undefined | null): sessionId is string => {
  const bytes = process.env.SESSION_ID_BYTES ? parseInt(process.env.SESSION_ID_BYTES, 10) : 64; // Default to 64 bytes if not set
  return typeof sessionId === 'string' && sessionId.length > 0 && new RegExp(`^[a-f0-9]{${bytes * 2}}$`).test(sessionId);
};

/** Check if the JWT token is valid
 * @param token The JWT token to validate
 * @returns True if the token is a non-empty string with 3 parts separated by dots, false otherwise
 */
export const isValidJWT = (token: string | undefined | null): token is string => {
  return typeof token === 'string' && token.length > 0 && token.split('.').length === 3;
};

let refreshTimer: NodeJS.Timeout | null = null;
