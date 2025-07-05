import express from 'express';
import FusionAuthClient from "@fusionauth/typescript-client";
import crypto from 'crypto';
import { createCache } from 'cache-manager';

// Configuration constants
const SESSION_TTL_SECONDS = 43200; // 12 hours
const SESSION_ID_BYTES = 32;

// TYPE: user session data
export interface UserSession {
  sid: string; // Session ID, also used as cache key
  at: string | null;
  rt: string | null;
  u: any; // Consider creating a proper User interface
  last: Date;
}

// Create user session ID
const createUserSessionId = () => {
  return crypto.randomBytes(SESSION_ID_BYTES).toString('hex');
};

// Create cache for user sessions
export const sessionCache = createCache({
  ttl: SESSION_TTL_SECONDS * 1000 // Convert to milliseconds
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
  // Validate session ID format
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length === 0) {
    console.warn('Invalid session ID provided to fetchUserSession');
    return null;
  }

  // Look for the cached session
  try {
    const cachedUser: UserSession | undefined = await sessionCache.get(sessionId);
    if (cachedUser) {
      // User session exists in cache
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

export const createUserSession = async ( 
  at: string, 
  rt: string | undefined, 
  u?: any
): Promise<UserSession> => {
  // Create a new user session with a unique ID
  // This won't have access or refresh tokens yet
  const userSession: UserSession = {
    sid: createUserSessionId(),  // This is also the key in the cache; this is not a FusionAuth user ID
    at: at,
    rt: rt || null,
    u: u || null,
    last: new Date()
  };
  // Store in session cache
  await sessionCache.set(userSession.sid, userSession);
  return userSession;
};

export const updateOrCreateUserSession = async (
  at: string, 
  rt: string,
  sid?: string | '',
  u?: any,
  last?: Date
): Promise<UserSession|undefined> => {
  try {
    // If session ID is provided, try to fetch existing session
    if (sid) {
      const existingSession = await fetchUserSession(sid);
      if (existingSession) {
        // Update existing session with new access/refresh tokens and user info
        existingSession.at = at;
        existingSession.rt = rt;
        existingSession.u = u || existingSession.u; // Keep existing user info if not provided
        existingSession.last = last || new Date();
        // Save updated session back to cache
        await sessionCache.set(sid, existingSession);
        return existingSession;
      } else {
        // If no session found, create a new one
        return await createUserSession(at, rt, u);
      }
    } else {
      // If no session ID provided, create a new one
      return await createUserSession(at, rt, u);
    }
  } catch (error) {
    console.error('Error updating or creating user session:', error);
    // Return undefined to indicate failure
    return undefined;
  }
}

// Set session cookie after updating user session
// This is used after user session is created or updated with access/refresh tokens
// It sets the session ID cookie in the response
// If the session ID is already set in the cookie, it does not update it
export const setSessionCookie = (req: express.Request, res: express.Response, sessionId: string) => {
  if (req.cookies[COOKIE_NAMES.USER_SESSION] === sessionId) {
    // If the session ID is already set in the cookie, no need to update
    return;
  }
  // Set the session cookie with the user session ID
  res.cookie(COOKIE_NAMES.USER_SESSION, sessionId, COOKIE_OPTIONS.httpOnly);
};

// Update tokens in an existing user session (after refresh; login will always create a new session)
export const refreshSessionTokens = async (
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
