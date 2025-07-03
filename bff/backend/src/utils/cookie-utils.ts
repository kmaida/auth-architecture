import express from 'express';
import FusionAuthClient from "@fusionauth/typescript-client";

// Cookie name constants
export const COOKIE_NAMES = {
  USER_SESSION: 's',
  USER_TOKEN: 'at',
  REFRESH_TOKEN: 'rt',
  USER_INFO: 'u'
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

// Fetch user info from FusionAuth and set cookie
export const fetchAndSetUserInfo = async (
  userTokenCookie: string, 
  res: express.Response,
  client: FusionAuthClient
): Promise<any> => {
  try {
    const userResponse = (await client.retrieveUserUsingJWT(userTokenCookie)).response;
    if (userResponse?.user) {
      res.cookie(COOKIE_NAMES.USER_INFO, 'j:' + JSON.stringify(userResponse.user), COOKIE_OPTIONS.public);
      return userResponse.user;
    }
  } catch (e) {
    // Logic falls through - user will be null
    console.error('Error fetching user info:', e);
  }
  return null;
};

// Set cookies after token acquisition/refresh
export const setNewCookies = (res: express.Response, tokens: any, user: any) => {
  res.cookie(COOKIE_NAMES.USER_TOKEN, tokens.access_token, COOKIE_OPTIONS.httpOnly);
  if (tokens.refresh_token) {
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refresh_token, COOKIE_OPTIONS.httpOnly);
  }
  res.cookie(COOKIE_NAMES.USER_INFO, 'j:' + JSON.stringify(user), COOKIE_OPTIONS.public);
};
