import express from 'express';
import { verify, GetPublicKeyOrSecret, JwtPayload } from 'jsonwebtoken';
import FusionAuthClient from "@fusionauth/typescript-client";
import jwksClient, { RsaSigningKey } from 'jwks-rsa';
import { COOKIE_NAMES, createUserSession, fetchUserSession, setSessionCookie, sessionCache } from './session';

// Promisify JWT verification
export function verifyJwtAsync(token: string, getKey: GetPublicKeyOrSecret): Promise<string | JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    verify(token, getKey, undefined, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

// Request new tokens from FusionAuth using the refresh token (needs clientId and clientSecret)
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

// Generate state value for CSRF protection
export const generateStateValue = () => {
  return Array(6).fill(0).map(() => Math.random().toString(36).substring(2, 15)).join('');
};

// Handle refresh token grant
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
      // setNewCookies(res, newTokens, userResponse.user);
      
      // Get existing user session
      const userSession = await fetchUserSession(sid);
      if (userSession) {
        // Update user session with new tokens
        userSession.at = newTokens.access_token;
        userSession.rt = newTokens.refresh_token;
        userSession.u = userResponse.user; // Update user info in session
        userSession.last = new Date();
        // Update session cache with new user session
        if (typeof userSession.sid === 'string') {
          await sessionCache.set(userSession.sid, userSession);
        } else {
          console.error('Session ID is missing or invalid, cannot update session cache.');
        }
      }
      const decodedFromJwt = await verifyJwtAsync(newTokens.access_token, getKey);
      console.log('Tokens and user info refreshed successfully');
      return { decoded: decodedFromJwt, user: userResponse.user };
    }
  } catch (err) {
    console.error('Failed to retrieve user info after refresh:', err);
  }
  
  return false;
};

// JWKS client for getting public keys from FusionAuth
export const createJwksClient = (fusionAuthURL: string) => {
  return jwksClient({
    jwksUri: `${fusionAuthURL}/.well-known/jwks.json`
  });
};

// Get the public key from FusionAuth
// Verify the JWT signature
export const createGetKey = (jwks: jwksClient.JwksClient): GetPublicKeyOrSecret => {
  return (header, callback) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err, undefined);
      const signingKey = (key as RsaSigningKey)?.getPublicKey() || (key as RsaSigningKey)?.rsaPublicKey;
      callback(null, signingKey);
    });
  };
};

// Verify tokens
// For checksession & middleware for protected API requests
// If JWT invalid or expired, check for refresh token 
// Initiate refresh grant to get new tokens from FusionAuth if necessary
export const verifyJWT = async (
  sid: string | undefined,
  accessToken: string | undefined,
  refreshToken: string | undefined,
  res: express.Response | undefined,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret
): Promise<{ decoded: string | JwtPayload | undefined, user?: any } | false> => {
  // Try to verify existing access token first
  if (accessToken) {
    try {
      const decodedFromJwt = await verifyJwtAsync(accessToken, getKey);
      return { decoded: decodedFromJwt };
    } catch (err) {
      console.log('Invalid or missing access token: initializing refresh token grant');
      // Fall through to refresh logic
    }
  }
  
  // If access token invalid/missing, try refresh token
  if (refreshToken && res) {
    return await handleRefreshGrant(
      sid as string,
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

/*---------------------------------
        Middleware factory
---------------------------------*/

// Factory to create auth middleware ('secure') to secure API endpoints
// Checks if the user is authenticated by verifying JWT in userToken cookie
// If JWT is invalid or expired, attempt to refresh access token using refresh token
// If user is authenticated: proceed
export const createSecureMiddleware = (
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret
) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Get user session ID from cookie
    const sid = req.cookies[COOKIE_NAMES.USER_SESSION];
    if (!sid) {
      // If no user session ID cookie, return 401 Unauthorized
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - No user session found'
      });
    }
    // Fetch user session from cache using session ID
    const userSession = await fetchUserSession(sid);
    if (!userSession) {
      // If no user session found in cache, return 401 Unauthorized
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - User session not found'
      });
    }
    // Extract access and refresh tokens from user session
    const accessToken = userSession.at || undefined;
    const refreshToken = userSession.rt || undefined;

    if (!accessToken && !refreshToken) {
      // If no access token and no refresh token in user session, return 401 Unauthorized
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - No tokens found in user session'
      });
    }

    const verifyResult = await verifyJWT(
      sid,
      accessToken,
      refreshToken,
      res,
      client,
      clientId,
      clientSecret,
      getKey
    );

    if (!verifyResult) {
      // If user not authenticated, return 401 Unauthorized
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - Invalid or expired access token'
      });
    }
    // Set session cookie with user session ID
    setSessionCookie(res, sid);
    // Update user session access token and last access time

    // If user is authenticated, proceed 
    next();
  };
};
