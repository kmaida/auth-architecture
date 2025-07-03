import express from 'express';
import { verify, GetPublicKeyOrSecret, JwtPayload } from 'jsonwebtoken';
import FusionAuthClient from "@fusionauth/typescript-client";
import jwksClient, { RsaSigningKey } from 'jwks-rsa';
import { COOKIE_NAMES } from './cookie-utils';

// Promisify JWT verification
export function verifyJwtAsync(token: string, getKey: GetPublicKeyOrSecret): Promise<string | JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    verify(token, getKey, undefined, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

// Request new tokens from FusionAuth using the refresh token
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
      'offline_access', // Scope to request a new refresh token
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

// Handle refresh token flow
export const handleRefreshGrant = async (
  refreshTokenCookie: string,
  res: express.Response,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret,
  setNewCookies: (res: express.Response, tokens: any, user: any) => void
) => {
  const newTokens = await refreshTokens(refreshTokenCookie, client, clientId, clientSecret);
  
  if (!newTokens?.access_token) {
    console.log('Could not get new tokens from FusionAuth using refresh token; user is not authenticated');
    return false;
  }
  
  try {
    const userResponse = (await client.retrieveUserUsingJWT(newTokens.access_token)).response;
    
    if (userResponse?.user) {
      setNewCookies(res, newTokens, userResponse.user);
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
// Refresh to get new tokens from FusionAuth if necessary
export const verifyJWT = async (
  userTokenCookie: string,
  refreshTokenCookie: string | undefined,
  res: express.Response | undefined,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  getKey: GetPublicKeyOrSecret,
  setNewCookies: (res: express.Response, tokens: any, user: any) => void
): Promise<{ decoded: string | JwtPayload | undefined, user?: any } | false> => {
  // Try to verify existing access token first
  if (userTokenCookie) {
    try {
      const decodedFromJwt = await verifyJwtAsync(userTokenCookie, getKey);
      return { decoded: decodedFromJwt };
    } catch (err) {
      console.log('Invalid or missing access token: initializing refresh token grant');
      // Fall through to refresh logic
    }
  }
  
  // If access token invalid/missing, try refresh token
  if (refreshTokenCookie && res) {
    return await handleRefreshGrant(
      refreshTokenCookie, 
      res, 
      client, 
      clientId, 
      clientSecret, 
      getKey, 
      setNewCookies
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
  getKey: GetPublicKeyOrSecret,
  setNewCookies: (res: express.Response, tokens: any, user: any) => void
) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userTokenCookie = req.cookies[COOKIE_NAMES.USER_TOKEN];
    const refreshTokenCookie = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];

    const verifyResult = await verifyJWT(
      userTokenCookie, 
      refreshTokenCookie, 
      res,
      client,
      clientId,
      clientSecret,
      getKey,
      setNewCookies
    );
    
    if (!verifyResult) {
      // If user not authenticated, return 401 Unauthorized
      return res.status(401).json({ 
        status: 401,
        message: 'Unauthorized'
      });
    }
    
    // If user is authenticated, proceed 
    next();
  };
};
