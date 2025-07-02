import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import cookieParser from 'cookie-parser';
import pkceChallenge from 'pkce-challenge';
import cors from 'cors';

// Import utility functions
import { validateEnvironmentVariables } from './utils/config';
import { 
  COOKIE_NAMES, 
  parseUserInfoCookie, 
  fetchAndSetUserInfo, 
  setCookiesAfterRefresh 
} from './utils/cookie-utils';
import { 
  generateStateValue, 
  createJwksClient,
  createGetKey,
  verifyJWT,
  createSecureMiddleware
} from './utils/auth-utils';

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

// Set up app
const app = express();
const port = process.env.PORT || 4001;

// Decode form URL encoded data
app.use(express.urlencoded({ extended: true }));

/*---------------------------------
        Authentication API
---------------------------------*/

// Validate and extract required environment variables
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'FUSION_AUTH_URL', 'FRONTEND_URL', 'BACKEND_URL'];
const config = validateEnvironmentVariables(requiredEnvVars);
const { CLIENT_ID: clientId, CLIENT_SECRET: clientSecret, FUSION_AUTH_URL: fusionAuthURL, FRONTEND_URL: frontendURL, BACKEND_URL: backendURL } = config;

// Initialize FusionAuth client
const client = new FusionAuthClient('noapikeyneeded', fusionAuthURL);

/*----------- Helpers, middleware, setup ------------*/

// Cookie setup
app.use(cookieParser());

// Add CORS middleware to allow connections from frontend
app.use(cors({
  origin: frontendURL,
  credentials: true
}));

// Get public key from FusionAuth's JSON Web Key Set to verify JWT signatures
const jwks = createJwksClient(fusionAuthURL);
const getKey = createGetKey(jwks);
const secure = createSecureMiddleware(client, clientId, clientSecret, getKey, setCookiesAfterRefresh);

/*----------- GET /auth/checksession ------------*/

// Endpoint to check the user's session, refresh tokens if possible, and set up PKCE if needed
app.get('/auth/checksession', async (req, res) => {
  const userTokenCookie = req.cookies[COOKIE_NAMES.USER_TOKEN];
  const refreshTokenCookie = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];

  // Check if user is authenticated by verifying JWT and refreshing tokens if necessary
  const verifyResult = await verifyJWT(
    userTokenCookie, 
    refreshTokenCookie, 
    res,
    client,
    clientId,
    clientSecret,
    getKey,
    setCookiesAfterRefresh
  );

  if (verifyResult && verifyResult.decoded) {
    // User is authenticated - get user info
    let user = verifyResult.user;
    
    if (!user) {
      // Try userInfo cookie first
      const userInfoCookie = req.cookies[COOKIE_NAMES.USER_INFO];
      user = userInfoCookie ? parseUserInfoCookie(userInfoCookie) : null;
      
      // If still no user and we have a token, fetch from FusionAuth
      if (!user && userTokenCookie) {
        user = await fetchAndSetUserInfo(userTokenCookie, res, client);
      }
    }

    res.status(200).json({ loggedIn: true, user });
  } else {
    // User is not authenticated - prepare for login
    const stateValue = generateStateValue();
    const pkcePair = pkceChallenge();
    
    res.cookie(COOKIE_NAMES.USER_SESSION, { 
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
  const userSessionCookie = req.cookies[COOKIE_NAMES.USER_SESSION];

  // Something went wrong
  if (!userSessionCookie?.stateValue || !userSessionCookie?.challenge) {
    // Redirect user to frontend homepage
    res.redirect(302, frontendURL);
    return;
  }

  const oauth2Url = `${fusionAuthURL}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${backendURL}/auth/callback&state=${userSessionCookie?.stateValue}&code_challenge=${userSessionCookie?.challenge}&code_challenge_method=S256&scope=offline_access`;

  res.redirect(302, oauth2Url);
});

/*----------- GET /auth/callback ------------*/

// Callback route that FusionAuth redirects to after user authentication
// Must be registered in FusionAuth as a valid redirect URL
// Will never be called by the frontend: only for FusionAuth
app.get('/auth/callback', async (req, res, next) => {
  // Capture query params
  const stateFromFusionAuth = `${req.query?.state}`;
  const authCode = `${req.query?.code}`;

  // Validate state in cookie matches FusionAuth's returned state
  // This prevents CSRF attacks
  const userSessionCookie = req.cookies[COOKIE_NAMES.USER_SESSION];
  if (stateFromFusionAuth !== userSessionCookie?.stateValue) {
    console.error("State mismatch error - potential CSRF attack");
    console.error(`Received: ${stateFromFusionAuth}, but expected: ${userSessionCookie?.stateValue}`);
    res.redirect(302, frontendURL);
    return;
  }

  try {
    // Exchange authorization code and code verifier for tokens
    const tokenResponse = (await client.exchangeOAuthCodeForAccessTokenUsingPKCE(
      authCode,
      clientId,
      clientSecret,
      `${backendURL}/auth/callback`,
      userSessionCookie.verifier
    )).response;

    if (!tokenResponse.access_token) {
      console.error('Failed to get access token from FusionAuth');
      res.redirect(302, frontendURL);
      return;
    }

    // Retrieve user info from FusionAuth (authorized by the access token)
    const userResponse = (await client.retrieveUserUsingJWT(tokenResponse.access_token)).response;
    if (!userResponse?.user) {
      console.error('Failed to retrieve user information from FusionAuth');
      res.redirect(302, frontendURL);
      return;
    }

    // Use helper function to set all cookies at once
    setCookiesAfterRefresh(res, tokenResponse, userResponse.user);

    // Redirect user to frontend homepage
    res.redirect(302, frontendURL);
  } catch (err: any) {
    console.error('Error during OAuth callback:', err);
    res.redirect(302, frontendURL);
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
  res.clearCookie(COOKIE_NAMES.USER_SESSION);
  res.clearCookie(COOKIE_NAMES.USER_TOKEN);
  res.clearCookie(COOKIE_NAMES.USER_INFO);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN);
  // Redirect user to frontend homepage
  res.redirect(302, frontendURL);
});

/*----------- GET /auth/userinfo ------------*/

// Endpoint the frontend calls to fetch user info
// Use of this is optional, as the user info is also set in the userInfo cookie
// This endpoint is protected and requires the user to be authenticated
app.get('/auth/userinfo', secure, async (req, res, next) => {
  const userInfoCookie = req.cookies[COOKIE_NAMES.USER_INFO];
  let nUserInfo;
  
  if (userInfoCookie) {
    // If there's a userInfo cookie, parse it
    nUserInfo = parseUserInfoCookie(userInfoCookie);
  } else {
    // If the user is logged in but there is no userInfo cookie for some
    // reason (like the user deleted it), fetch user info from FusionAuth
    const userTokenCookie = req.cookies[COOKIE_NAMES.USER_TOKEN];
    nUserInfo = await fetchAndSetUserInfo(userTokenCookie, res, client);
  }
  res.json({ userInfo: nUserInfo || null });
});

/*---------------------------------
        Protected API
---------------------------------*/

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
  res.redirect(302, frontendURL);
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server started at ${backendURL}`);
});
