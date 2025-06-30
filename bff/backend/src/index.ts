import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import cookieParser from 'cookie-parser';
import pkceChallenge from 'pkce-challenge';
import { GetPublicKeyOrSecret, JwtPayload, verify } from 'jsonwebtoken';
import jwksClient, { RsaSigningKey } from 'jwks-rsa';
import * as path from 'path';
import cors from 'cors';

// Import environment variables
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 4001;

/*---------------------------------
        Authentication API
---------------------------------*/

// Validate auth environment variables
if (!process.env.CLIENT_ID) {
  console.error('Missing CLIENT_ID from .env');
  process.exit();
}
if (!process.env.CLIENT_SECRET) {
  console.error('Missing CLIENT_SECRET from .env');
  process.exit();
}
if (!process.env.FUSION_AUTH_URL) {
  console.error('Missing FUSION_AUTH_URL from .env');
  process.exit();
}
if (!process.env.FRONTEND_URL) {
  console.error('Missing FRONTEND_URL from .env');
  process.exit();
}
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const fusionAuthURL = process.env.FUSION_AUTH_URL;
const frontendURL = process.env.FRONTEND_URL;

/*----------- Helpers, middleware, setup ------------*/

// Add CORS middleware to allow connections from frontend
app.use(cors({
  origin: frontendURL,
  credentials: true
}));

// Get the public key from FusionAuth's JWKS endpoint
// This is used to verify the JWT signature
const getKey: GetPublicKeyOrSecret = async (header, callback) => {
  const jwks = jwksClient({
    jwksUri: `${fusionAuthURL}/.well-known/jwks.json`
  });
  const key = await jwks.getSigningKey(header.kid) as RsaSigningKey;
  var signingKey = key?.getPublicKey() || key?.rsaPublicKey;
  callback(null, signingKey);
}

// Access token verification middleware
// Check user's cookie, verify JWT access token signature, and decode the token
// Decoded access token is only available in the backend; it is never sent to the client
const verifyJWT = async (userTokenCookie: { access_token: string }) => {
  // Check if the cookie exists and contains an access token (if not, user is not logged in)
  if (!userTokenCookie || !userTokenCookie?.access_token) {
    return false;
  }
  try {
    let decodedFromJwt: string | JwtPayload | undefined;
    // The await here is important to ensure the key is fetched before verifying the JWT
    // Even though VS Code says this is unused, it's wrong, so don't remove it
    await verify(userTokenCookie.access_token, await getKey, undefined, (err, decoded) => {
      decodedFromJwt = decoded;
    });
    return decodedFromJwt;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// Set cookies
const userSession = 'userSession';
const userToken = 'userToken';
const userDetails = 'userDetails'; // User info is not Http-Only
// Initialize FusionAuth client
const client = new FusionAuthClient('noapikeyneeded', fusionAuthURL);

app.use(cookieParser());
// Decode form URL encoded data
app.use(express.urlencoded({ extended: true }));

// TODO: remove this when the frontend is ready
app.use('/bff/static', express.static(path.join(__dirname, '../static/')));

/*----------- GET /auth/pkce ------------*/

// Endpoint to set up PKCE (checkSession on the front end)
app.get('/auth/pkce', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];

  if (await verifyJWT(userTokenCookie)) {
    // Logged in user
    // UNCOMMENT TO TEST IN BACKEND APP
    // res.redirect(302, '/account');
    res.status(200).json({ loggedIn: true });
  } else {
    // Generate a random state value and PKCE challenge
    // This is used to prevent CSRF attacks and to verify the authenticity of the request
    const stateValue = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const pkcePair = await pkceChallenge();
    res.cookie(userSession, { stateValue, verifier: pkcePair.code_verifier, challenge: pkcePair.code_challenge }, { httpOnly: true });

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
  }

  // TODO: make this production ready by removing the hardcoded localhost and port
  const oauth2Url = `${fusionAuthURL}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost:${port}/auth/callback&state=${userSessionCookie?.stateValue}&code_challenge=${userSessionCookie?.challenge}&code_challenge_method=S256`;

  res.redirect(302, oauth2Url);
});

/*----------- GET /auth/callback ------------*/

// Callback URL that FusionAuth redirects to after user authentication
// Must be registered in FusionAuth as a valid redirect URL
// This URL will never be called by the frontend, it's only for FusionAuth

app.get('/auth/callback', async (req, res, next) => {
  // Capture query params
  const stateFromFusionAuth = `${req.query?.state}`;
  const authCode = `${req.query?.code}`;

  // Validate cookie state matches FusionAuth's returned state
  // This prevents CSRF attacks
  const userSessionCookie = req.cookies[userSession];
  if (stateFromFusionAuth !== userSessionCookie?.stateValue) {
    console.log("State doesn't match. uh-oh.");
    console.log("Saw: " + stateFromFusionAuth + ", but expected: " + userSessionCookie?.stateValue);
    // Redirect user to frontend homepage
    res.redirect(302, `${process.env.FRONTEND_URL}`);
    return;
  }
  try {
    // Exchange authorization code and code verifier for an access token
    const accessToken = (await client.exchangeOAuthCodeForAccessTokenUsingPKCE(authCode,
      clientId,
      clientSecret,
      `http://localhost:${port}/auth/callback`, // TODO: for production, this should not be hardcoded as localhost:port
      userSessionCookie.verifier)).response;

    if (!accessToken.access_token) {
      console.error('Failed to get access token');
      return;
    }
    // Set cookies for the user session and access token
    res.cookie(userToken, accessToken, { httpOnly: true })

    // Retrieve user info (authorized by the access token)
    const userResponse = (await client.retrieveUserUsingJWT(accessToken.access_token)).response;
    if (!userResponse?.user) {
      console.error('Failed to get user');
      // Redirect user to frontend homepage
      res.redirect(302, `${process.env.FRONTEND_URL}`);
    }
    // Set user details cookie (not Http-Only, so it can be accessed by the frontend)
    res.cookie(userDetails, userResponse.user);
    // Redirect user to frontend homepage
    res.redirect(302, `${process.env.FRONTEND_URL}`);
  } catch (err: any) {
    console.error(err);
    res.status(err?.statusCode || 500).json(JSON.stringify({
      error: err
    }))
  }
});

/*----------- GET /auth/logout ------------*/

// Initiate user logout
// Redirects the user to FusionAuth's OAuth2 logout endpoint

app.get('/auth/logout', (req, res, next) => {
  res.redirect(302, `${fusionAuthURL}/oauth2/logout?client_id=${clientId}`);
});

/*----------- GET /auth/logout/callback ------------*/

// Clean up cookies and redirect to frontend homepage
// FusionAuth will redirect to this endpoint after logging out
// This (full) URL must be registered in FusionAuth as a valid logout redirect URL

app.get('/auth/logout/callback', (req, res, next) => {
  console.log('Logging out...')
  res.clearCookie(userSession);
  res.clearCookie(userToken);
  res.clearCookie(userDetails);
  // Redirect user to frontend homepage
  res.redirect(302, `${process.env.FRONTEND_URL}`);
});

/*---------------------------------
          Static Routes
---------------------------------*/

// TODO: when the frontend is ready, these should be some kind of API routes that return JSON responses, not HTML files

// TODO: DELETE - this should be deleted, it's just for visual testing purposes when there isn't a frontend yet
app.get('/', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];

  if (await verifyJWT(userTokenCookie)) {
    // Logged in user
    // TODO: return success instead of redirecting, or redirect to a frontend route
    res.redirect(302, '/account');
  } else {
    // Generate a random state value and PKCE challenge
    // This is used to prevent CSRF attacks and to verify the authenticity of the request
    const stateValue = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const pkcePair = await pkceChallenge();
    res.cookie(userSession, { stateValue, verifier: pkcePair.code_verifier, challenge: pkcePair.code_challenge }, { httpOnly: true });

    // TODO: This currently loads the homepage but no rendering will be necessary when calling from the frontend
    console.log(__dirname);
    res.sendFile(path.join(__dirname, '../templates/home.html'));
  }
});

// Account
// TODO: DELETE
app.get('/account', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  if (!await verifyJWT(userTokenCookie)) {
    res.redirect(302, '/');
  } else {
    res.sendFile(path.join(__dirname, '../templates/account.html'));
  }
});

// Protected navigation route
// TODO: DELETE
app.get('/make-change', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  if (!await verifyJWT(userTokenCookie)) {
    res.redirect(302, '/');
  } else {
    res.sendFile(path.join(__dirname, '../templates/make-change.html'));
  }
});

/*----------- GET /api/protected-data ------------*/

// Sample API endpoint that returns protected data (replace this with your actual API logic)
// This endpoint is protected and requires the user to be authenticated

app.get('/api/protected-data', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];

  if (!await verifyJWT(userTokenCookie)) {
    // If the user is not authenticated, return a 401 Unauthorized response
    res.status(401).json({ 
      status: 401,
      message: 'Unauthorized'
    });
  } else {
    // Data that should be returned to authenticated users
    // Replace with your actual protected data
    const protectedData = {
      message: 'This is protected data that only authenticated users can access.'
    };
    // If the user is authenticated, return protected data
    res.status(200).json(protectedData);
  }
});

/*---------------------------------
         Express Server
---------------------------------*/

// Start the Express server
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
