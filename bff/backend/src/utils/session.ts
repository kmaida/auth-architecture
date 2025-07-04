import express from 'express';
import FusionAuthClient from "@fusionauth/typescript-client";
import crypto from 'crypto';
import { createCache } from 'cache-manager';

// TYPE: user session data
export type UserSession = {
  sid: string | null; // Session ID, also used as cache key
  at: string | null;
  rt: string | null;
  u: any;
  last: Date | null;
};

// Create user session ID
const createUserSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create cache for user sessions
export const sessionCache = createCache({
  ttl: 43200 * 1000 // @TODO: this should be configured in .env vars and match FusionAuth's settings
});

// Cookie name constants
// https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#pattern-bff-cookie-security
// TODO: Update cookie names in production to use __host- prefix for security (doesn't work in dev mode due to localhost)
export const COOKIE_NAMES = {
  PKCE_SESSION: 'p',
  USER_SESSION: 's',  // Session ID cookie, used to identify the user session
  USER_INFO: 'u'  // User info cookie, contains user data in JSON format
} as const;

// Cookie-setting options based on environment
export const COOKIE_OPTIONS = {
  httpOnly: { 
    httpOnly: true, 
    sameSite: 'lax' as const, 
    path: '/', 
    secure: process.env.NODE_ENV === 'production' 
  },
  public: { 
    sameSite: 'lax' as const, 
    path: '/', 
    secure: process.env.NODE_ENV === 'production' 
  }
};

// Parse cookie and return JSON object
export const parseJsonCookie = (cookie: string): any => {
  try {
    // Cookie is prefixed with 'j:' to indicate it's a JSON object
    return JSON.parse(decodeURIComponent(cookie).replace(/^j:/, ''));
  } catch (e) {
    return null;
  }
};

// Get user session ID from cookie
export const getUserSessionIdFromCookie = (req: express.Request): string | null => {
  const userSessionCookie = req.cookies[COOKIE_NAMES.USER_SESSION];
  if (userSessionCookie) {
    try {
      // Decode and return the user session ID
      return decodeURIComponent(userSessionCookie);
    } catch (e) {
      console.error('Error decoding user session cookie:', e);
      return null;
    }
  }
  // No user session cookie found
  return null;
};

export const fetchUserSession = async (sessionId: string): Promise<UserSession | null> => {
  // Look for the cached session
  try {
    const cachedUser: UserSession | undefined = await sessionCache.get(sessionId);
    if (!!cachedUser) {
      // User session exists in cache
      console.log('User session found in cache:', cachedUser);
      // Update last accessed time
      cachedUser.last = new Date();
      // Save updated session data back to cache
      await sessionCache.set(sessionId, cachedUser);
      // Return cached user session data
      return cachedUser;
    }
  } catch (error) {
    console.error('Error fetching user session from cache:', error);
  }
  // Return null if no session is found or an error occurs
  return null;
};

export const createUserSession = async (): Promise<UserSession> => {
  // Create a new user session with a unique ID
  // This won't have access or refresh tokens yet
  const newSessionId = createUserSessionId();
  const userSession = {
    sid: newSessionId,  // This is also the key in the cache; this is not a FusionAuth user ID
    at: null,
    rt: null,
    u: null,
    last: new Date()
  };
  // Store in session cache
  await sessionCache.set(newSessionId, userSession);
  // Return session data (new session needs access token and refresh token to be set later)
  return userSession;
};

// Get (or create) user session data from session cache
// @deprecated: this is managing too many responsibilities
// Fetching the session is now separated from creating a new session
// export const fetchOrCreateUserSession = async (sessionId?: string): Promise<UserSession> => {
//   let userSession: UserSession;

//   // If a sessionId was provided, look for the cached session
//   if (sessionId) {
//     const cachedUser: UserSession | undefined = await sessionCache.get(sessionId);
//     if (!!cachedUser) {
//       // User session exists in cache
//       console.log('User session found in cache:', cachedUser);
//       // Update last accessed time
//       cachedUser.last = new Date();
//       // Save updated session data back to cache
//       await sessionCache.set(sessionId, cachedUser);
//       // Return cached user session data
//       userSession = cachedUser;
//       return userSession;
//     }
//   }
//   // If no sessionId provided or no user session exists, create a new user session
//   const newSessionId = createUserSessionId();
//   userSession = {
//     sid: newSessionId,  // This is also the key in the cache; this is not a FusionAuth user ID
//     at: null,
//     rt: null,
//     u: null,
//     last: new Date()
//   };
//   // Store in session cache
//   await sessionCache.set(newSessionId, userSession);
//   // Return session data (new session needs access token and refresh token to be set later)
//   return userSession;
//   // @TODO: set session cookie in response: need the response object to be passed in
//   // res.cookie(COOKIE_NAMES.USER_SESSION, newUserId, COOKIE_OPTIONS.httpOnly);
// };

// Set tokens in user session
export const setUserSessionTokens = async (
  sessionId: string, 
  accessToken: string | null, 
  refreshToken: string | null
): Promise<UserSession> => {
  // Fetch existing user session from cache
  const userSession = await fetchUserSession(sessionId);
  if (!userSession) {
    throw new Error(`User session not found for sessionId: ${sessionId}`);
  }
  // Update access and refresh tokens
  userSession.at = accessToken;
  userSession.rt = refreshToken;
  // Save updated session back to cache
  await sessionCache.set(sessionId, userSession);
  return userSession;
};

// Fetch user info from FusionAuth, update in session storage
export const fetchAndSetUserInfo = async (
  sessionId: string,
  accessToken: string, 
  res: express.Response,
  client: FusionAuthClient
): Promise<any> => {
  try {
    const userResponse = (await client.retrieveUserUsingJWT(accessToken)).response;
    if (userResponse?.user) {
      // Set public cookie with user info
      res.cookie(COOKIE_NAMES.USER_INFO, 'j:' + JSON.stringify(userResponse.user), COOKIE_OPTIONS.public);
      // Store user info in session cache
      const cachedUser: UserSession | undefined = await sessionCache.get(sessionId);
      if (cachedUser) {
        cachedUser.u = userResponse.user;
        await sessionCache.set(sessionId, cachedUser);
      }
      // Return user info
      return userResponse.user;
    }
  } catch (e) {
    // Logic falls through - user will be null
    console.error('Error fetching user info:', e);
  }
  return null;
};

// Set session cookie after updating user session
// This is used after user session is created or updated with access/refresh tokens
// It sets the session ID cookie in the response
export const setSessionCookie = (res: express.Response, sessionId: string) => {
  res.cookie(COOKIE_NAMES.USER_SESSION, sessionId, COOKIE_OPTIONS.httpOnly);
};
