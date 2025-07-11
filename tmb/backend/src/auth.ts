import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import pkceChallenge from 'pkce-challenge';

// Import utility functions
import { 
  COOKIE_NAMES, 
  COOKIE_OPTIONS,
  parseJsonCookie, 
  sessionCache,
  getUserSessionIdFromCookie,
  fetchUserSession,
  createUserSession,
  setSessionCookie,
  fetchAndSetUserInfo
} from './utils/session';
import { 
  generateStateValue, 
  createJwksClient,
  createGetKey,
  verifyJWT,
  scheduleTokenRefresh,
  clearRefreshTimer,
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
  const secure = createSecureMiddleware(client, clientId, clientSecret, getKey);

  /*----------- GET /auth/checksession ------------*/

  // Endpoint to check the user's session, refresh tokens if possible, and set up PKCE if needed
  app.get('/auth/checksession', async (req, res) => {
    const sid = getUserSessionIdFromCookie(req);
    let userSession;
    let accessToken;
    let refreshToken;

    if (sid) userSession = await fetchUserSession(sid);

    if (userSession) {
      accessToken = userSession.at || undefined;
      refreshToken = userSession.rt || undefined;
    }

    // Check if user is authenticated by verifying JWT and refreshing tokens if necessary
    const verifyResult = await verifyJWT(
      sid, 
      accessToken,
      refreshToken, 
      res,
      client,
      clientId,
      clientSecret,
      getKey
    );

    if (verifyResult && verifyResult.decoded) {
      // Set proactive refresh timer if access token is close to expiry
      // Default to 59 minutes if no expiry in token
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const expiresAt = verifyResult.decoded.exp || (nowInSeconds + 3540); // 59 minutes from now
      // Pass through parameters for handling refresh tokens
      scheduleTokenRefresh(
        expiresAt * 1000, // Convert to milliseconds
        sid as string,
        refreshToken || '',
        res,
        client,
        clientId,
        clientSecret,
        getKey
      );

      // User is authenticated - get user info
      let user = verifyResult.user;
      let at;
      
      if (!user) {
        // Try userInfo cookie first
        const userInfoCookie = req.cookies[COOKIE_NAMES.USER_INFO];
        user = userInfoCookie ? parseJsonCookie(userInfoCookie) : null;
        
        // If still no user and we have a session cookie, fetch user info from FusionAuth
        if (!user && sid) {
          // Get UPDATED session data from cache (important: fetch again after potential token refresh)
          const updatedSessionData = await fetchUserSession(sid);
          if (updatedSessionData && updatedSessionData.sid && updatedSessionData.at) {
            user = await fetchAndSetUserInfo(updatedSessionData.sid, updatedSessionData.at, res);
            at = updatedSessionData.at; // Update access token if it was refreshed
          }
        }
      }
      res.status(200).json({ loggedIn: true, at: at, user });
    } else {
      // Create and store state, code verifier, and code challenge for authorization request with PKCE
      const stateValue = generateStateValue();
      const pkcePair = pkceChallenge();
      
      res.cookie(COOKIE_NAMES.PKCE_SESSION, { 
        stateValue, 
        verifier: pkcePair.code_verifier, 
        challenge: pkcePair.code_challenge 
      }, COOKIE_OPTIONS.httpOnly);

      res.status(200).json({ loggedIn: false });
    }
  });

  /*----------- GET /auth/login ------------*/

  // Endpoint the frontend calls to initiate the login flow
  app.get('/auth/login', (req, res, next) => {
    const pkceCookie = req.cookies[COOKIE_NAMES.PKCE_SESSION];

    // Something went wrong
    if (!pkceCookie?.stateValue || !pkceCookie?.challenge) {
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
    const oauth2Url = `${fusionAuthURL}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${backendURL}/auth/callback&state=${pkceCookie?.stateValue}&code_challenge=${pkceCookie?.challenge}&code_challenge_method=S256&scope=offline_access%20openid%20profile%20email`;

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
    const pkceCookie = req.cookies[COOKIE_NAMES.PKCE_SESSION];
    if (stateFromFusionAuth !== pkceCookie?.stateValue) {
      console.error("State mismatch error - potential CSRF attack");
      console.error(`Received: ${stateFromFusionAuth}, but expected: ${pkceCookie?.stateValue}`);
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
        pkceCookie.verifier
      )).response;

      const accessToken = tokenResponse.access_token;
      const refreshToken = tokenResponse.refresh_token;
      let userInfo;

      if (!accessToken) {
        console.error('Failed to get access token from FusionAuth');
        res.redirect(302, frontendURL);
        return;
      }

      // Retrieve user info from FusionAuth (authorized by the access token)
      const userResponse = (await client.retrieveUserUsingJWT(accessToken)).response;
      if (!userResponse?.user) {
        userInfo = null;
        console.error('Failed to retrieve user information from FusionAuth');
      } else {
        userInfo = userResponse.user;
      }

      // Create session, set tokens, and set user info in session cache
      const newSessionData = await createUserSession(accessToken, refreshToken, userInfo);
      setSessionCookie(req, res, newSessionData.sid as string);
      
      // Note: we don't need to schedule a proactive refresh here because the frontend
      // will call /auth/checksession after the redirect
      
      // Delete PKCE session cookie
      res.clearCookie(COOKIE_NAMES.PKCE_SESSION);
      // Redirect user to frontend callback URL
      res.redirect(302, `${frontendURL}/login/callback`);
    } catch (err: any) {
      console.error('Error during OAuth callback:', err);
      res.redirect(302, frontendURL);
    }
  });

  /*----------- GET /login/callback ------------*/

  // Callback API endpoint the frontend calls after user login
  // This is not used by the backend, sends the access token to the frontend
  app.get('/login/callback', async (req, res, next) => {
    const sid = getUserSessionIdFromCookie(req);
    if (sid) {
      fetchUserSession(sid).then((userSession) => {
        const accessToken = userSession && userSession.at ? { at: userSession.at } : null;
        res.json(accessToken);
      });
    }
    else {
      res.status(401).json({ error: 'User session not found' });
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
  // Clean up session, cookies, and redirect to frontend homepage
  // FusionAuth will redirect to this endpoint after logging out
  // This (full) URL must be registered in FusionAuth as a valid logout redirect URL
  // Will never be used by the frontend: should only be called by FusionAuth
  app.get('/auth/logout/callback', (req, res, next) => {
    // Clear user session from cache
    const userSessionId = getUserSessionIdFromCookie(req);
    if (userSessionId) {
      sessionCache.del(userSessionId).catch((err: Error) => {
        console.error('Error clearing user session from cache:', err);
      });
    }
    // Clear cookies
    res.clearCookie(COOKIE_NAMES.PKCE_SESSION); // This should already be cleared in the login callback, but just in case
    res.clearCookie(COOKIE_NAMES.USER_SESSION);
    res.clearCookie(COOKIE_NAMES.USER_INFO);

    // Clear any active refresh timers
    clearRefreshTimer();
    
    // Redirect user to frontend homepage
    res.redirect(302, frontendURL);
  });

  /*----------- GET /auth/userinfo ------------*/

  // Endpoint the frontend calls to fetch the latest user info from FusionAuth
  // Protected and requires the user to be authenticated
  app.get('/auth/userinfo', secure, async (req, res, next) => {
    let freshUserInfo;

    try {
      const sid = getUserSessionIdFromCookie(req);
      const userSession = sid ? await fetchUserSession(sid) : null;

      if (sid && userSession && userSession.at) {
        // Fetch and set user info from FusionAuth
        freshUserInfo = await fetchAndSetUserInfo(sid, userSession.at, res);
      }
    } catch (err: any) {
      console.error('Error fetching user info:', err);
    }
    res.json({ userInfo: freshUserInfo || null });
  });

  return secure; // Return the secure middleware to be used by protected routes
}
