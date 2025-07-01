import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import cookieParser from 'cookie-parser';
import pkceChallenge from 'pkce-challenge';
import { GetPublicKeyOrSecret, JwtPayload, verify } from 'jsonwebtoken';
import jwksClient, { RsaSigningKey } from 'jwks-rsa';
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
if (!process.env.BACKEND_URL) {
  console.error('Missing BACKEND_URL from .env');
  process.exit();
}
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const fusionAuthURL = process.env.FUSION_AUTH_URL;
const frontendURL = process.env.FRONTEND_URL;
const backendURL = process.env.BACKEND_URL;

/*----------- Helpers, middleware, setup ------------*/

// Decode form URL encoded data
app.use(express.urlencoded({ extended: true }));

// Cookie setup
app.use(cookieParser());
const userSession = 'userSession';
const userToken = 'userToken';
const refreshToken = 'refreshToken';
const userInfo = 'userInfo'; // User info is not httpOnly (should be accessible to frontend)

// Initialize FusionAuth client
const client = new FusionAuthClient('noapikeyneeded', fusionAuthURL);

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

// Middleware to verify tokens
// For checksession and on protected API requests
// If JWT invalid or expired, check for refresh token 
// Refresh to get new tokens from FusionAuth if necessary
const verifyJWT = async (
  userTokenCookie: string,
  refreshTokenCookie?: string,
  res?: express.Response
): Promise<{ decoded: string | JwtPayload | undefined, user?: any } | false> => {
  if (userTokenCookie) {
    try {
      // Verify and decode JWT from userToken cookie; return decoded token
      // Decoded token only for use in backend
      const decodedFromJwt = await verifyJwtAsync(userTokenCookie, await getKey);
      return { decoded: decodedFromJwt };
    } catch (err) {
      console.log('Invalid or missing access token: initializing refresh token grant');
      // Fall through to refresh logic
    }
  }
  if (refreshTokenCookie && res) {
    // Fetch new tokens with FusionAuth SDK's exchangeRefreshTokenForAccessToken (see refreshTokens helper above)
    const newTokens = await refreshTokens(refreshTokenCookie);

    if (newTokens && newTokens.access_token) {
      // Set userToken cookie with new access_token (httpOnly)
      res.cookie(userToken, newTokens.access_token, { httpOnly: true, sameSite: 'lax', path: '/' });
      
      if (newTokens.refresh_token) {
        // Set refreshToken cookie with new refresh_token (httpOnly)
        res.cookie(refreshToken, newTokens.refresh_token, { httpOnly: true, sameSite: 'lax', path: '/' });
      }

      try {
        // Get user info by sending access token to FusionAuth's /api/user endpoint
        const userResponse = (await client.retrieveUserUsingJWT(newTokens.access_token)).response;

        if (userResponse?.user) {
          // Set userInfo cookie
          res.cookie(userInfo, 'j:' + JSON.stringify(userResponse.user), { sameSite: 'lax', path: '/' });
          
          // Decode new access token to return it
          const decodedFromJwt = await verifyJwtAsync(newTokens.access_token, await getKey);
          console.log('Tokens and user info refreshed successfully');
          return { decoded: decodedFromJwt, user: userResponse.user };
        }
      } catch (err) {
        console.error('Failed to retrieve user info after refresh:', err);
      }
    } else {
      console.log('Could not get new tokens from FusionAuth using refresh token; user is not authenticated');
    }
  }
  // If we reach here, the user is not logged in
  return false;
};

/*----------- GET /auth/checksession ------------*/

// Endpoint to check the user's session, refresh tokens if possible, and set up PKCE if needed
app.get('/auth/checksession', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  const refreshTokenCookie = req.cookies[refreshToken];

  // Check if user is authenticated by verifying JWT and refreshing tokens if necessary
  const verifyResult = await verifyJWT(userTokenCookie, refreshTokenCookie, res);

  // Token verified and decoded
  if (verifyResult && verifyResult.decoded) {
    let user = verifyResult.user;
    // If no user from token verification, try userInfo cookie
    if (!user) {
      const userInfoCookie = req.cookies[userInfo];
      if (userInfoCookie) {
        try {
          // If userInfo in cookie, parse it
          // (Cookie is prefixed with 'j:' to indicate it's a JSON object)
          user = JSON.parse(decodeURIComponent(userInfoCookie).replace(/^j:/, ''));
        } catch (e) {
          user = null;
        }
      }
      // If no user in token or cookie, but there IS an access token, fetch user info from FusionAuth
      if (!user && userTokenCookie) {
        try {
          const userResponse = (await client.retrieveUserUsingJWT(userTokenCookie)).response;
          if (userResponse?.user) {
            user = userResponse.user;
            res.cookie(userInfo, 'j:' + JSON.stringify(user), { sameSite: 'lax', path: '/' });
          }
        } catch (e) {
          user = null;
        }
      }
    }
    // Session checked, user is logged in; return loggedIn status and user info
    res.status(200).json({ loggedIn: true, user });
  } else {
    // JWT verification failed or user is not authenticated
    // Generate a random state value and PKCE challenge pair in preparation for login
    const stateValue = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    // Generate code_verifier and code_challenge for PKCE and store in cookie
    const pkcePair = await pkceChallenge();
    res.cookie(userSession, { stateValue, verifier: pkcePair.code_verifier, challenge: pkcePair.code_challenge }, { httpOnly: true });

    // Return user unauthenticated status
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
    console.log("Error: state must match to protect against CSRF attacks.");
    console.log("Received: " + stateFromFusionAuth + ", but expected: " + userSessionCookie?.stateValue);
    // Redirect user to frontend homepage
    res.redirect(302, `${process.env.FRONTEND_URL}`);
    return;
  }
  try {
    // Exchange authorization code and code verifier for tokens (includes access_token, refresh_token, expires_in)
    const tokenResponse = (await client.exchangeOAuthCodeForAccessTokenUsingPKCE(authCode,
      clientId,
      clientSecret,
      `${backendURL}/auth/callback`,
      userSessionCookie.verifier)).response;

    if (!tokenResponse.access_token) {
      console.error('Failed to get access token');
      return;
    }
    // Set cookie for the user session with value of the access token string
    res.cookie(userToken, tokenResponse.access_token, { httpOnly: true, sameSite: 'lax', path: '/' });
    // Set cookie for refresh token
    res.cookie(refreshToken, tokenResponse.refresh_token, { httpOnly: true, sameSite: 'lax', path: '/' });

    // Retrieve user info (authorized by the access token)
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
  res.clearCookie(userInfo);
  res.clearCookie(refreshToken);
  // Redirect user to frontend homepage
  res.redirect(302, `${process.env.FRONTEND_URL}`);
});

/*---------------------------------
        Protected API
---------------------------------*/

// Sample API endpoint that returns protected data (replace this with your actual API logic)
// This endpoint is protected and requires the user to be authenticated

app.get('/api/protected-data', async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  const refreshTokenCookie = req.cookies[refreshToken];

  if (!await verifyJWT(userTokenCookie, refreshTokenCookie, res)) {
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
        Express Conclusion
---------------------------------*/

// Redirect all other un-named routes to the frontend homepage
app.all('*', async (req, res) => {
  res.redirect(302, `${process.env.FRONTEND_URL}`);
});

// Start the Express server
app.listen(port, () => {
  console.log(`server started at ${backendURL}`);
});
