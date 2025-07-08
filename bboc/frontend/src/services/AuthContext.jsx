import { createContext, useContext, useState, useCallback } from 'react';
import { FusionAuthClient } from '@fusionauth/typescript-client';
import pkceChallenge from 'pkce-challenge';

const AuthContext = createContext();
const clientId = import.meta.env.VITE_CLIENT_ID;
const frontendUrl= import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
const apiUrl = import.meta.env.VITE_API_URL;
const fusionAuthUrl = import.meta.env.VITE_AUTHZ_SERVER_URL;
const client = new FusionAuthClient(null, fusionAuthUrl);

const generateStateValue = () => {
  return Array(6).fill(0).map(() => Math.random().toString(36).substring(2, 15)).join('');
};

const setupPKCE = async () => {
  const stateValue = generateStateValue();
  const pkcePair = await pkceChallenge();
  const codeVerifier = pkcePair.code_verifier;
  const codeChallenge = pkcePair.code_challenge;

  // Store the state and PKCE values in session storage
  sessionStorage.setItem('state', stateValue);
  sessionStorage.setItem('code_verifier', codeVerifier);
  sessionStorage.setItem('code_challenge', codeChallenge);
  return { codeVerifier, codeChallenge };
};

const getRefreshToken = async (userId) => {
  try {
    const response = await client.retrieveRefreshTokens(userId);
    if (response.wasSuccessful()) {
      const refreshToken = response.successResponse.refreshToken;
      console.log('Refresh token retrieved:', refreshToken);
      return refreshToken;
    } else {
      console.error('Failed to retrieve refresh token:', response);
      throw new Error('Failed to retrieve refresh token');
    }
  } catch (error) {
    console.error('Error retrieving refresh token:', error);
    throw error;
  }
};

const refreshAccessToken = async () => {
  try {
    const uid = localStorage.getItem('uid');
    const refreshToken = await getRefreshToken(uid);
    if (!refreshToken) {
      console.error('No refresh token found for user');
      throw new Error('No refresh token found');
    }
    const resRefresh = await client.refreshJWT(refreshToken);
    if (resRefresh.wasSuccessful()) {
      const newAccessToken = resRefresh.response.access_token;
      console.log('New access token:', newAccessToken);
      setUserToken(newAccessToken);
      localStorage.setItem('uid', resRefresh.response.userId);
      return newAccessToken;
    } else {
      console.error('Failed to refresh access token:', resRefresh);
      throw new Error('Failed to refresh access token');
    }
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
};

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preLoginPath, setPreLoginPath] = useState('/');
  const [userToken, setUserToken] = useState(null);

  // Check if user is logged in by sending the access token to FusionAuth (if it exists)
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!userToken) {
        setLoggedIn(false);
        setUserInfo(null);
        setIsLoading(false);
        console.log('No access token found, user is not logged in.');
        return;
      }

      // Validate access token with FusionAuth
      const resValidate = await client.validateJWT(userToken);

      console.log('Token validation response:', resValidate);

      if (resValidate.wasSuccessful()) {
        setLoggedIn(true);
        // Get user info from FusionAuth
        const resUser = await client.retrieveUser(resValidate.response.access_token);
        if (resUser.wasSuccessful()) {
          setUserInfo(resUser.response.user);
          console.log('User info retrieved:', resUser.response.user);
        } else {
          setUserInfo(null);
        }
      } else {
        console.log('Invalid access token, user is not logged in.');
        // @TODO: Check for refresh token by userId
        setLoggedIn(false);
        // setUserInfo(null);
        // Remove invalid token
        setIsLoading(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initiate login process
  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Generate PKCE pair and state value
      await setupPKCE();
      
      window.location.href=`${fusionAuthUrl}/oauth2/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(`${frontendUrl}/login/callback`)}` +
        `&scope=${encodeURIComponent('openid profile email')}` +
        `&state=${encodeURIComponent(sessionStorage.getItem('state'))}` +
        `&code_challenge=${encodeURIComponent(sessionStorage.getItem('code_challenge'))}` +
        `&code_challenge_method=S256`;
    } catch (error) {
      console.error('Error during login:', error);
      setLoggedIn(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exchangeCodeForToken = useCallback(async (code, authzState) => {
    try {
      setIsLoading(true);
      const state = sessionStorage.getItem('state');
      const codeVerifier = sessionStorage.getItem('code_verifier');
      
      console.log('Token exchange parameters:', {
        code,
        authzState,
        storedState: state,
        codeVerifier: codeVerifier ? 'present' : 'missing'
      });
      
      if (authzState !== state) {
        console.error('State mismatch during token exchange:', { authzState, state });
        throw new Error('State mismatch during token exchange');
      }
      
      if (!codeVerifier) {
        console.error('Code verifier is missing from session storage');
        throw new Error('Code verifier is missing');
      }
      
      const tokenRes = await client.exchangeOAuthCodeForAccessTokenUsingPKCE(
        code,
        clientId,
        null,
        frontendUrl + '/login/callback',
        codeVerifier
      );

      console.log('Token exchange response:', tokenRes);

      if (tokenRes.wasSuccessful()) {
        const accessToken = tokenRes.response.access_token;
        setUserToken(accessToken);
        console.log('Access token received and set:', accessToken);
        setLoggedIn(true);
        // setUserInfo(tokenRes.response.userId); @TODO: retrieve full user info (only the userId is returned)
        localStorage.setItem('uid', tokenRes.response.userId);
        console.log('User ID:', tokenRes.response.userId);

        return true; // Indicate success
      } else {
        console.error('Failed to exchange code for token:', {
          status: tokenRes.statusCode,
          errorResponse: tokenRes.errorResponse,
          exception: tokenRes.exception
        });
        throw new Error(`Token exchange failed: ${tokenRes.statusCode}`);
      }
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      setLoggedIn(false);
      setUserInfo(null);
      setUserToken(null);
      throw error; // Re-throw so the caller can handle it
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      // Clear user token and info
      setUserToken(null);
      setLoggedIn(false);
      setUserInfo(null);
      // Clear storage
      sessionStorage.removeItem('state');
      sessionStorage.removeItem('code_verifier');
      sessionStorage.removeItem('code_challenge');
      localStorage.removeItem('uid');
      // Log out from FusionAuth and clear all refresh tokens
      await client.logout(true);
      console.log('User logged out successfully');
      // Redirect to home page or login page
      navigate('/');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      loggedIn, 
      setLoggedIn, 
      checkSession, 
      userInfo, 
      isLoading, 
      userToken, 
      preLoginPath, 
      setPreLoginPath,
      login,
      exchangeCodeForToken,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}