import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import cookieParser from 'cookie-parser';
import pkceChallenge from 'pkce-challenge';
import { GetPublicKeyOrSecret, JwtPayload, verify } from 'jsonwebtoken';
import jwksClient, { RsaSigningKey } from 'jwks-rsa';
import * as path from 'path';

// Add environment variables
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 4001;

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
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const fusionAuthURL = process.env.FUSION_AUTH_URL;

// Validate the token signature, make sure it wasn't expired
const validateUser = async (userTokenCookie: { access_token: string }) => {
  // Make sure the user is authenticated.
  if (!userTokenCookie || !userTokenCookie?.access_token) {
    return false;
  }
  try {
    let decodedFromJwt: string | JwtPayload | undefined;
    await verify(userTokenCookie.access_token, await getKey, undefined, (err, decoded) => {
      decodedFromJwt = decoded;
    });
    return decodedFromJwt;
  } catch (err) {
    console.error(err);
    return false;
  }
}

const getKey: GetPublicKeyOrSecret = async (header, callback) => {
  const jwks = jwksClient({
    jwksUri: `${fusionAuthURL}/.well-known/jwks.json`
  });
  const key = await jwks.getSigningKey(header.kid) as RsaSigningKey;
  var signingKey = key?.getPublicKey() || key?.rsaPublicKey;
  callback(null, signingKey);
}

//Cookies
const userSession = 'userSession';
const userToken = 'userToken';
const userDetails = 'userDetails'; //Non Http-Only with user info (not trusted)

const client = new FusionAuthClient('noapikeyneeded', fusionAuthURL);

app.use(cookieParser());
/** Decode Form URL Encoded data */
app.use(express.urlencoded({ extended: true }));

// Static Files
app.use('/static', express.static(path.join(__dirname, '../static/')));

// Homepage
app.get("/", async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  if (await validateUser(userTokenCookie)) {
    res.redirect(302, '/account');
  } else {
    const stateValue = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const pkcePair = await pkceChallenge();
    res.cookie(userSession, { stateValue, verifier: pkcePair.code_verifier, challenge: pkcePair.code_challenge }, { httpOnly: true });

    res.sendFile(path.join(__dirname, '../templates/home.html'));
  }
});

// Login
app.get('/auth/login', (req, res, next) => {
  const userSessionCookie = req.cookies[userSession];

  // Cookie was cleared, just send back (hacky way)
  if (!userSessionCookie?.stateValue || !userSessionCookie?.challenge) {
    res.redirect(302, '/');
  }

  res.redirect(302, `${fusionAuthURL}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost:${port}/auth/callback&state=${userSessionCookie?.stateValue}&code_challenge=${userSessionCookie?.challenge}&code_challenge_method=S256`)
});

// Redirect after logging in
app.get('/auth/callback', async (req, res, next) => {
  // Capture query params
  const stateFromFusionAuth = `${req.query?.state}`;
  const authCode = `${req.query?.code}`;

  // Validate cookie state matches FusionAuth's returned state
  const userSessionCookie = req.cookies[userSession];
  if (stateFromFusionAuth !== userSessionCookie?.stateValue) {
    console.log("State doesn't match. uh-oh.");
    console.log("Saw: " + stateFromFusionAuth + ", but expected: " + userSessionCookie?.stateValue);
    res.redirect(302, '/');
    return;
  }

  try {
    // Exchange Auth Code and Verifier for Access Token
    const accessToken = (await client.exchangeOAuthCodeForAccessTokenUsingPKCE(authCode,
      clientId,
      clientSecret,
      `http://localhost:${port}/auth/callback`,
      userSessionCookie.verifier)).response;

    if (!accessToken.access_token) {
      console.error('Failed to get Access Token')
      return;
    }
    res.cookie(userToken, accessToken, { httpOnly: true })

    // Exchange Access Token for User
    const userResponse = (await client.retrieveUserUsingJWT(accessToken.access_token)).response;
    if (!userResponse?.user) {
      console.error('Failed to get User from access token, redirecting home.');
      res.redirect(302, '/');
    }
    res.cookie(userDetails, userResponse.user);

    res.redirect(302, '/account');
  } catch (err: any) {
    console.error(err);
    res.status(err?.statusCode || 500).json(JSON.stringify({
      error: err
    }))
  }
});

// Account
app.get("/account", async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  if (!await validateUser(userTokenCookie)) {
    res.redirect(302, '/');
  } else {
    res.sendFile(path.join(__dirname, '../templates/account.html'));
  }
});

// Protected navigation route
app.get("/make-change", async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  if (!await validateUser(userTokenCookie)) {
    res.redirect(302, '/');
  } else {
    res.sendFile(path.join(__dirname, '../templates/make-change.html'));
  }
});

// Protected API POST request to make change
app.post("/make-change", async (req, res) => {
  const userTokenCookie = req.cookies[userToken];
  if (!await validateUser(userTokenCookie)) {
    res.status(403).json(JSON.stringify({
      error: 'Unauthorized'
    }))
    return;
  }

  let error;
  let message;

  var coins = {
    quarters: 0.25,
    dimes: 0.1,
    nickels: 0.05,
    pennies: 0.01,
  };

  try {
    message = 'We can make change for';
    let remainingAmount = +req.body.amount;
    for (const [name, nominal] of Object.entries(coins)) {
      let count = Math.floor(remainingAmount / nominal);
      remainingAmount =
        Math.round((remainingAmount - count * nominal) * 100) / 100;

      message = `${message} ${count} ${name}`;
    }
    `${message}!`;
  } catch (ex: any) {
    error = `There was a problem converting the amount submitted. ${ex.message}`;
  }
  res.json(JSON.stringify({
    error,
    message
  }))

});

// Logout
app.get('/auth/logout', (req, res, next) => {
  res.redirect(302, `${fusionAuthURL}/oauth2/logout?client_id=${clientId}`);
});

// Route to clean up cookies and redirect to home
app.get('/auth/logout/callback', (req, res, next) => {
  console.log('Logging out...')
  res.clearCookie(userSession);
  res.clearCookie(userToken);
  res.clearCookie(userDetails);

  res.redirect(302, '/')
});

// Start the Express server
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
