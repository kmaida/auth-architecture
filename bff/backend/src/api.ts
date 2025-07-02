import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import cookieParser from 'cookie-parser';
import pkceChallenge from 'pkce-challenge';
import { GetPublicKeyOrSecret, JwtPayload, verify } from 'jsonwebtoken';
import jwksClient, { RsaSigningKey } from 'jwks-rsa';
import cors from 'cors';

// Extend Express Request interface to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Import environment variables
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 4001;

/*---------------------------------
        Authentication API
---------------------------------*/

// Validate and extract required environment variables
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'FUSION_AUTH_URL', 'FRONTEND_URL', 'BACKEND_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const clientId = process.env.CLIENT_ID!;
const clientSecret = process.env.CLIENT_SECRET!;
const fusionAuthURL = process.env.FUSION_AUTH_URL!;
const frontendURL = process.env.FRONTEND_URL!;
const backendURL = process.env.BACKEND_URL!;

/*----------- Helpers, middleware, setup ------------*/

// Decode form URL encoded data
app.use(express.urlencoded({ extended: true }));

// Initialize FusionAuth client
const client = new FusionAuthClient('noapikeyneeded', fusionAuthURL);

// Cookie setup
app.use(cookieParser());
const userSession = 'us';
const userToken = 'at';
const refreshToken = 'rt'; 
const userInfo = 'ui'; // User info is not httpOnly (should be accessible to frontend)

// Add CORS middleware to allow connections from frontend
app.use(cors({
  origin: frontendURL,
  credentials: true
}));

// Get public key from FusionAuth's JSON Web Key Set to verify JWT signatures
const jwks = jwksClient({
  jwksUri: `${fusionAuthURL}/.well-known/jwks.json`
});

// Get the public key from FusionAuth's JWKS endpoint
// This is used to verify the JWT signature
const getKey: GetPublicKeyOrSecret = (header, callback) => {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err, undefined);
    const signingKey = (key as RsaSigningKey)?.getPublicKey() || (key as RsaSigningKey)?.rsaPublicKey;
    callback(null, signingKey);
  });
};

// Helper to promisify JWT verification
// Params: access token and FusionAuth public key
function verifyJwtAsync(token: string, getKey: any): Promise<string | JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    verify(token, getKey, undefined, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

// Helper to request new tokens using the refresh token
// Async to ensure proper execution sequence
const refreshTokens = async (refreshTokenValue: string) => {
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

// Helper to parse user info from cookie
const parseUserInfoCookie = (userInfoCookie: string): any => {
  try {
    // Cookie is prefixed with 'j:' to indicate it's a JSON object
    return JSON.parse(decodeURIComponent(userInfoCookie).replace(/^j:/, ''));
  } catch (e) {
    return null;
  }
};

// Helper to fetch user info from FusionAuth and set cookie
const fetchAndSetUserInfo = async (userTokenCookie: string, res: express.Response): Promise<any> => {
  try {
    const userResponse = (await client.retrieveUserUsingJWT(userTokenCookie)).response;
    if (userResponse?.user) {
      res.cookie(userInfo, 'j:' + JSON.stringify(userResponse.user), { sameSite: 'lax', path: '/' });
      return userResponse.user;
    }
  } catch (e) {
    // Silent fail - user will be null
  }
  return null;
};

// Helper to generate state value for OAuth
const generateStateValue = () => {
  return Array(6).fill(0).map(() => Math.random().toString(36).substring(2, 15)).join('');
};

// Helper to set cookies after token refresh
const setCookiesAfterRefresh = (res: express.Response, tokens: any, user: any) => {
  res.cookie(userToken, tokens.access_token, { httpOnly: true, sameSite: 'lax', path: '/' });
  if (tokens.refresh_token) {
    res.cookie(refreshToken, tokens.refresh_token, { httpOnly: true, sameSite: 'lax', path: '/' });
  }
  res.cookie(userInfo, 'j:' + JSON.stringify(user), { sameSite: 'lax', path: '/' });
};

// Helper to handle refresh token flow
const handleRefreshToken = async (refreshTokenCookie: string, res: express.Response) => {
  const newTokens = await refreshTokens(refreshTokenCookie);
  
  if (!newTokens?.access_token) {
    console.log('Could not get new tokens from FusionAuth using refresh token; user is not authenticated');
    return false;
  }
  try {
    const userResponse = (await client.retrieveUserUsingJWT(newTokens.access_token)).response;
    
    if (userResponse?.user) {
      setCookiesAfterRefresh(res, newTokens, userResponse.user);
      const decodedFromJwt = await verifyJwtAsync(newTokens.access_token, getKey);
      console.log('Tokens and user info refreshed successfully');
      return { decoded: decodedFromJwt, user: userResponse.user };
    }
  } catch (err) {
    console.error('Failed to retrieve user info after refresh:', err);
  }
  return false;
};

// Middleware to verify tokens
// For checksession and on protected API requests
// If JWT invalid or expired, check for refresh token 
// Refresh to get new tokens from FusionAuth if necessary
const verifyJWT = async (
  userTokenCookie: string,
  refreshTokenCookie?: string,
  res?: express.Response
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
    return await handleRefreshToken(refreshTokenCookie, res);
  }
  
  // No valid tokens found
  return false;
};

/*----------- GET /auth/checksession ------------*/

// Endpoint to check the user's session, refresh tokens if possible, and set up PKCE if needed
app.get('/auth/checksession', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  const refreshTokenCookie = req.cookies[refreshToken];

  // Check if user is authenticated by verifying JWT and refreshing tokens if necessary
  const verifyResult = await verifyJWT(userTokenCookie, refreshTokenCookie, res);

  if (verifyResult && verifyResult.decoded) {
    // User is authenticated - get user info
    let user = verifyResult.user;
    
    if (!user) {
      // Try userInfo cookie first
      const userInfoCookie = req.cookies[userInfo];
      user = userInfoCookie ? parseUserInfoCookie(userInfoCookie) : null;
      
      // If still no user and we have a token, fetch from FusionAuth
      if (!user && userTokenCookie) {
        user = await fetchAndSetUserInfo(userTokenCookie, res);
      }
    }

    res.status(200).json({ loggedIn: true, user });
  } else {
    // User is not authenticated - prepare for login
    const stateValue = generateStateValue();
    const pkcePair = pkceChallenge();
    
    res.cookie(userSession, { 
      stateValue, 
      verifier: pkcePair.code_verifier, 
      challenge: pkcePair.code_challenge 
    }, { httpOnly: true });

    res.status(200).json({ loggedIn: false });
  }
});

/*----------- GET /auth/login ------------*/

// Endpoint the frontend calls to initiate the login flow

app.get('/auth/login', (req, res, next) => {
  const userSessionCookie = req.cookies[userSession];

  // Something went wrong
  if (!userSessionCookie?.stateValue || !userSessionCookie?.challenge) {
    // Redirect user to frontend homepage
    res.redirect(302, `${process.env.FRONTEND_URL}`);
    return;
  }

  const oauth2Url = `${fusionAuthURL}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${backendURL}/auth/callback&state=${userSessionCookie?.stateValue}&code_challenge=${userSessionCookie?.challenge}&code_challenge_method=S256&scope=offline_access`;

  res.redirect(302, oauth2Url);
});

/*----------- GET /auth/callback ------------*/

// Callback route that FusionAuth redirects to after user authentication
// Must be registered in FusionAuth as a valid redirect URL
// /auth/callback will never be called by the frontend, it's only for FusionAuth

app.get('/auth/callback', async (req, res, next) => {
  // Capture query params
  const stateFromFusionAuth = `${req.query?.state}`;
  const authCode = `${req.query?.code}`;

  // Validate state in cookie matches FusionAuth's returned state
  // This prevents CSRF attacks
  const userSessionCookie = req.cookies[userSession];
  if (stateFromFusionAuth !== userSessionCookie?.stateValue) {
    console.log("Error: state mismatch");
    console.log("Received: " + stateFromFusionAuth + ", but expected: " + userSessionCookie?.stateValue);
    // Redirect user to frontend homepage
    res.redirect(302, `${process.env.FRONTEND_URL}`);
    return;
  }
  try {
    // Exchange authorization code and code verifier for tokens (access_token, refresh_token, expires_in)
    const tokenResponse = (await client.exchangeOAuthCodeForAccessTokenUsingPKCE(authCode,
      clientId,
      clientSecret,
      `${backendURL}/auth/callback`,
      userSessionCookie.verifier)).response;

    if (!tokenResponse.access_token) {
      console.error('Failed to get access token');
      return;
    }
    // Set userToken cookie with value of the access token string
    res.cookie(userToken, tokenResponse.access_token, { httpOnly: true, sameSite: 'lax', path: '/' });
    // Set refreshToken cookie for refresh token
    res.cookie(refreshToken, tokenResponse.refresh_token, { httpOnly: true, sameSite: 'lax', path: '/' });

    // Retrieve user info from FusionAuth (authorized by the access token)
    const userResponse = (await client.retrieveUserUsingJWT(tokenResponse.access_token)).response;
    if (!userResponse?.user) {
      console.error('Failed to get user');
      // Redirect user to frontend homepage
      res.redirect(302, `${process.env.FRONTEND_URL}`);
    }
    // Set user details cookie (not Http-Only, so it can be accessed by the frontend)
    res.cookie(userInfo, 'j:' + JSON.stringify(userResponse.user), { sameSite: 'lax', path: '/' });

    // Redirect user to frontend homepage
    res.redirect(302, `${process.env.FRONTEND_URL}`);
  } catch (err: any) {
    console.error(err);
    res.status(err?.statusCode || 500).json(JSON.stringify({ error: err }));
  }
});

/*----------- GET /auth/logout ------------*/

// Initiate user logout
// Redirects the user to FusionAuth's OAuth2 logout endpoint

app.get('/auth/logout', (req, res, next) => {
  res.redirect(302, `${fusionAuthURL}/oauth2/logout?client_id=${clientId}`);
});

/*----------- GET /auth/logout/callback ------------*/

// Callback after FusionAuth logout
// Clean up cookies and redirect to frontend homepage
// FusionAuth will redirect to this endpoint after logging out
// This (full) URL must be registered in FusionAuth as a valid logout redirect URL

app.get('/auth/logout/callback', (req, res, next) => {
  res.clearCookie(userSession);
  res.clearCookie(userToken);
  res.clearCookie(userInfo);
  res.clearCookie(refreshToken);
  // Redirect user to frontend homepage
  res.redirect(302, `${process.env.FRONTEND_URL}`);
});

/*---------------------------------
        Protected API
---------------------------------*/

// Middleware to secure API endpoints
// This middleware checks if the user is authenticated by verifying the JWT in the userToken cookie
// If the JWT is invalid or expired, it attempts to refresh the token using the refreshToken
// If the user is authenticated, it allows the request to proceed to the next middleware or route
const secure = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userTokenCookie = req.cookies[userToken];
  const refreshTokenCookie = req.cookies[refreshToken];

  if (!await verifyJWT(userTokenCookie, refreshTokenCookie, res)) {
    // If the user is not authenticated, return a 401 Unauthorized response
    res.status(401).json({ 
      status: 401,
      message: 'Unauthorized'
    });
  } else {
    // If the user is authenticated, proceed to the next middleware or route handler
    next();
  }
}

/*----------- GET /api/protected-data ------------*/

// Sample API endpoint that returns protected data (replace this with your actual API logic)
// This endpoint is protected and requires the user to be authenticated
app.get('/api/protected-data', secure, async (req, res) => {
  // Data that should be returned to authenticated users
  // Replace with your actual protected data
  const protectedData = {
    message: 'This is protected data that only authenticated users can access.'
  };
  res.status(200).json(protectedData);
});

/*---------------------------------
        Express Conclusion
---------------------------------*/

// Redirect all other un-named routes to the frontend homepage
app.all('*', async (req, res) => {
  res.redirect(302, `${process.env.FRONTEND_URL}`);
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server started at ${backendURL}`);
});
