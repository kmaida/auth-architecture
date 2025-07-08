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

const refreshAccessToken = async (refreshToken) => {
  try {
    const response = await client.refreshJWT(refreshToken);
    if (response.wasSuccessful()) {
      const newAccessToken = response.successResponse.token;
      console.log('New access token:', newAccessToken);
      return newAccessToken;
    } else {
      console.error('Failed to refresh access token:', response);
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
  const [aToken, setAToken] = useState(null);

  // Check if user is logged in by sending the access token to FusionAuth (if it exists)
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!aToken) {
        setLoggedIn(false);
        setUserInfo(null);
        setIsLoading(false);
        console.log('No access token found, user is not logged in.');
        // @TODO: Check for refresh token by userId
        // This is just here for testing authz req
        setupPKCE();
        return;
      }

      // Validate access token with FusionAuth
      const resValidate = await client.validateJWT(aToken);

      console.log('Token validation response:', resValidate);

      if (resValidate.wasSuccessful()) {
        setLoggedIn(true);
        // Get user info from FusionAuth
        const resUser = await client.retrieveUser(resValidate.successResponse.token);
        if (resUser.wasSuccessful()) {
          setUserInfo(resUser.successResponse.user);
          console.log('User info retrieved:', resUser.successResponse.user);
        } else {
          setUserInfo(null);
        }
      } else {
        console.log('Invalid access token, user is not logged in.');
        // @TODO: Check for refresh token by userId
        setLoggedIn(false);
        // setUserInfo(null);
        // Remove invalid token
        setAToken(null);
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
      window.location.href=`${fusionAuthUrl}/oauth2/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(`${frontendUrl}/login/callback`)}` +
        `&scope=${encodeURIComponent('openid profile email')}` +
        `&state=${encodeURIComponent(sessionStorage.getItem('state'))}` +
        `&code_challenge=${encodeURIComponent(sessionStorage.getItem('code_challenge'))}` +
        `&code_challenge_method=S256`;
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
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
      aToken, 
      preLoginPath, 
      setPreLoginPath,
      login
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}