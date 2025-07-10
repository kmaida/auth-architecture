import express from 'express';
import { User } from "@fusionauth/typescript-client";
import crypto from 'crypto';
import { createCache } from 'cache-manager';
import * as dotenv from "dotenv";

dotenv.config();

// Configuration constants
const REFRESH_TTL = parseInt(process.env.REFRESH_TTL || '43200', 10); // Default to 12 hours if not set
const SESSION_ID_BYTES = 32;

// TYPE: user session data
export interface UserSession {
  sid: string; // Session ID, also used as cache key
  at: string | null;
  rt: string | null;
  u: User | null;
  last: number; // Timestamp
}

/** Create user session ID */
const createUserSessionId = () => {
  return crypto.randomBytes(SESSION_ID_BYTES).toString('hex');
};

/** Create cache for user sessions
 * Time To Live (TTL) should match FusionAuth's refresh token TTL
 */
export const sessionCache = createCache({
  ttl: REFRESH_TTL * 1000 // Convert to milliseconds
});

// https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#pattern-bff-cookie-security

// Use __host- prefix in production for security
const COOKIE_PREFIX = process.env.ENVIRONMENT === 'prod' ? '__host-' : ''; 
// Cookie name constants
export const COOKIE_NAMES = {
  PKCE_SESSION: `${COOKIE_PREFIX}p`,
  USER_SESSION: `${COOKIE_PREFIX}s`,  // Session ID cookie, used to look up user session in cache
  USER_INFO: 'u'  // User info cookie, contains user data in JSON format (public)
} as const;

// Cookie-setting options based on environment
// Production cookies must be only set over HTTPS (secure), with httpOnly & SameSite
export const COOKIE_OPTIONS = {
  httpOnly: { 
    httpOnly: true, 
    sameSite: 'strict' as const, 
    path: '/', 
    secure: process.env.ENVIRONMENT === 'prod' 
  },
  public: { 
    sameSite: 'strict' as const, 
    path: '/', 
    secure: process.env.ENVIRONMENT === 'prod' 
  }
};

/** Parse cookie and return JSON object
 * @param cookie The cookie string to parse
 * @returns The parsed User object or null if parsing fails
 */
export const parseJsonCookie = (cookie: string): User | null => {
  try {
    // Cookie is prefixed with 'j:' to indicate it's a JSON object
    return JSON.parse(decodeURIComponent(cookie).replace(/^j:/, ''));
  } catch (e) {
    return null;
  }
};

/** Get user session ID from cookie
 * @param req Express request object
 * @returns The user session ID or null if not found
 */
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

/**
 * Fetch user session from cache
 * @param sessionId The session ID to fetch from the cache
 * @returns The user session or null if not found
 */
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
      cachedUser.last = Date.now();
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

/** Create a new user session
 * @param at The access token
 * @param rt The refresh token
 * @param u The user object
 * @returns The created user session
 */
export const createUserSession = async ( 
  at: string, 
  rt: string | undefined,
  u?: User | null
): Promise<UserSession> => {
  // Create a new user session with a unique ID
  // This won't have access or refresh tokens yet
  const userSession: UserSession = {
    sid: createUserSessionId(),  // This is also the key in the cache; this is not a FusionAuth user ID
    at: at,
    rt: rt || null,
    u: u || null,
    last: Date.now()
  };
  // Store in session cache
  await sessionCache.set(userSession.sid, userSession);
  return userSession;
};

/** Update existing user session or create a new session
 * if none exists
 * @param at The access token
 * @param rt The refresh token
 * @param sid The session ID (if exists)
 * @param u The user object (if exists)
 * @param last The last accessed timestamp (if exists)
 * @returns The updated or created user session
 */
export const updateOrCreateUserSession = async (
  at: string, 
  rt: string,
  sid?: string,
  u?: User | null,
  last?: number
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
        existingSession.last = last || Date.now();
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

/** Set session cookie after updating user session
  * This is used after user session is created or updated with access/refresh tokens
  * It sets the session ID cookie in the response
  * If the session ID is already set in the cookie, it does not update it
  * @param req Express request object
  * @param res Express response object
  * @param sessionId The session ID to set in the cookie
  * @returns void
 */
export const setSessionCookie = (req: express.Request, res: express.Response, sessionId: string) => {
  if (req.cookies[COOKIE_NAMES.USER_SESSION] === sessionId) {
    // If the session ID is already set in the cookie, no need to update
    return;
  }
  // Set the session cookie with the user session ID
  res.cookie(COOKIE_NAMES.USER_SESSION, sessionId, COOKIE_OPTIONS.httpOnly);
};

/** Update tokens in an existing user session (after refresh;
 * login will always create a new session)
 * @param sessionId The session ID to update
 * @param accessToken The new access token
 * @param refreshToken The new refresh token
 * @returns The updated user session
 */
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

/** Get userInfo from FusionAuth oauth2/userinfo endpoint authorized by access token
  * @param accessToken The access token to authorize the request
  * @returns The user info object or null if not found
  */
export const getUserInfo = async (accessToken: string) => {
  try {
    const userResponse = await fetch(`${process.env.FUSIONAUTH_URL}/oauth2/userinfo`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.statusText}`);
      }
      return response.json();
    });

    if (userResponse) {
      return userResponse;
    }
  } catch (e) {
    // Logic falls through - user will be null
    console.error('Error fetching user info:', e);
  }
  return null;
}

/** Fetch user info from FusionAuth, update in session storage
 * @param sessionId The session ID to update
 * @param accessToken The access token to authorize the request
 * @param res The Express response object
 */
export const fetchAndSetUserInfo = async (
  sessionId: string,
  accessToken: string, 
  res: express.Response
) => {
  try {
    const userResponse = await getUserInfo(accessToken);

    if (userResponse) {
      // Set public cookie with user info
      res.cookie(COOKIE_NAMES.USER_INFO, 'j:' + JSON.stringify(userResponse), COOKIE_OPTIONS.public);
      // Store user info in session cache
      const cachedUser: UserSession | undefined = await sessionCache.get(sessionId);
      if (cachedUser) {
        cachedUser.u = userResponse;
        await sessionCache.set(sessionId, cachedUser);
      }
      // Return user info
      return userResponse;
    }
  } catch (e) {
    // Logic falls through - user will be null
    console.error('Error fetching user info:', e);
  }
  return null;
};
