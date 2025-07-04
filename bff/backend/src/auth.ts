import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import pkceChallenge from 'pkce-challenge';

// Import utility functions
import { 
  COOKIE_NAMES, 
  parseJsonCookie, 
  sessionCache,
  getUserSessionIdFromCookie,
  fetchOrCreateUserSession,
  setUserSessionTokens,
  fetchAndSetUserInfo
} from './utils/session';
import { 
  generateStateValue, 
  createJwksClient,
  createGetKey,
  verifyJWT,
  createSecureMiddleware
} from './utils/auth-utils';

export function setupAuthRoutes(
  app: express.Application,
  client: FusionAuthClient,
  clientId: string,
  clientSecret: string,
  fusionAuthURL: string,
  frontendURL: string,
  backendURL: string
) {
  // Get public key from FusionAuth's JSON Web Key Set to verify JWT signatures
  const jwks = createJwksClient(fusionAuthURL);
  const getKey = createGetKey(jwks);
  const secure = createSecureMiddleware(client, clientId, clientSecret, getKey, setNewCookies);

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
      setNewCookies
    );

    if (verifyResult && verifyResult.decoded) {
      // User is authenticated - get user info
      let user = verifyResult.user;
      
      if (!user) {
        // Try userInfo cookie first
        const userInfoCookie = req.cookies[COOKIE_NAMES.USER_INFO];
        user = userInfoCookie ? parseJsonCookie(userInfoCookie) : null;
        
        // If still no user and we have a token, fetch from FusionAuth
        if (!user && userTokenCookie) {
          user = await fetchAndSetUserInfo(userTokenCookie, res, client);
        }
      }

      res.status(200).json({ loggedIn: true, user });
    } else {
      // Create and store state, code verifier, and code challenge for authorization request with PKCE
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

    // Authorization request to FusionAuth: /oauth2/authorize
    //   client_id: FusionAuth application ID
    //   response_type: 'code' authorization code flow
    //   redirect_uri: redirect to the /auth/callback endpoint after authentication
    //   state: CSRF protection value, must match the one stored in the cookie
    //   code_challenge: PKCE challenge value
    //   code_challenge_method: 'S256' for SHA-256 hashing
    //   scope: 'offline_access' to get refresh token
    //   scope: 'openid profile email' to get user info
    const oauth2Url = `${fusionAuthURL}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${backendURL}/auth/callback&state=${userSessionCookie?.stateValue}&code_challenge=${userSessionCookie?.challenge}&code_challenge_method=S256&scope=offline_access%20openid%20profile%20email`;

    res.redirect(302, oauth2Url);
  });

  /*----------- GET /auth/callback ------------*/

  // Callback route that FusionAuth redirects to after user authentication
  // Must be registered in FusionAuth as a valid redirect URL
  // Will never be used by the frontend: should only be called by FusionAuth
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
      setNewCookies(res, tokenResponse, userResponse.user);

      // Redirect user to frontend homepage
      res.redirect(302, frontendURL);
    } catch (err: any) {
      console.error('Error during OAuth callback:', err);
      res.redirect(302, frontendURL);
    }
  });

  /*----------- GET /auth/logout ------------*/

  // Initiate user logout
  // Redirects the user to FusionAuth's /oauth2/logout endpoint
  app.get('/auth/logout', (req, res, next) => {
    res.redirect(302, `${fusionAuthURL}/oauth2/logout?client_id=${clientId}`);
  });

  /*----------- GET /auth/logout/callback ------------*/

  // Callback after FusionAuth logout
  // Clean up cookies and redirect to frontend homepage
  // FusionAuth will redirect to this endpoint after logging out
  // This (full) URL must be registered in FusionAuth as a valid logout redirect URL
  // Will never be used by the frontend: should only be called by FusionAuth
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
  // User info is also set in the userInfo cookie on successful login
  // Can be called with '?refresh=true' to get the most up-to-date user info from FusionAuth
  //   (This is useful if the user's information has changed in FusionAuth but not in the frontend)
  // Protected and requires the user to be authenticated
  app.get('/auth/userinfo', secure, async (req, res, next) => {
    const userInfoCookie = req.cookies[COOKIE_NAMES.USER_INFO];
    const forceRefresh = req.query.refresh === 'true';
    let nUserInfo;
    
    if (userInfoCookie && !forceRefresh) {
      // If there's a userInfo cookie and no force refresh, parse it
      nUserInfo = parseJsonCookie(userInfoCookie);
    } else {
      // If the user is logged in but there is no userInfo cookie for some
      // reason (like the user deleted it), or force refresh is requested,
      // fetch user info from FusionAuth and update cookie
      const userTokenCookie = req.cookies[COOKIE_NAMES.USER_TOKEN];
      nUserInfo = await fetchAndSetUserInfo(userTokenCookie, res, client);
    }
    res.json({ userInfo: nUserInfo || null });
  });

  return secure; // Return the secure middleware to be used by protected routes
}
