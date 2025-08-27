import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { FusionAuthClient } from '@fusionauth/typescript-client';

import { 
  setupPKCE,
  clearAuthzVals
} from '../utils/authUtils.js';

const AuthContext = createContext();
const clientId = import.meta.env.VITE_CLIENT_ID;
const frontendUrl= import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
const fusionAuthUrl = import.meta.env.VITE_AUTHZ_SERVER_URL;
const client = new FusionAuthClient(null, fusionAuthUrl);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const refreshTokenRef = useRef(null);
  const refreshTimerRef = useRef(null);

  /**
   * Initiate login process using PKCE
   */
  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      await setupPKCE();
      window.location.href = `${fusionAuthUrl}/oauth2/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(`${frontendUrl}/login/callback`)}` +
        `&scope=${encodeURIComponent('offline_access openid profile email')}` +
        `&state=${encodeURIComponent(sessionStorage.getItem('state'))}` +
        `&code_challenge=${encodeURIComponent(sessionStorage.getItem('code_challenge'))}` +
        `&code_challenge_method=S256`;
    } catch (error) {
      console.error('Error logging in:', error);
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Exchange authorization code for tokens
    * @param {string} code - The authorization code received from the callback
    * @param {string} authzState - The state value to verify against session storage
    * @throws {Error} - If state or code verifier is missing, or token exchange fails
   */
  const exchangeCodeForToken = useCallback(async (code, authzState) => {
    setIsLoading(true);
    try {
      const state = sessionStorage.getItem('state');
      const codeVerifier = sessionStorage.getItem('code_verifier');
      if (authzState !== state) throw new Error('State mismatch during token exchange');
      if (!codeVerifier) throw new Error('Code verifier is missing');

      const tokenRes = await client.exchangeOAuthCodeForAccessTokenUsingPKCE(
        code,
        clientId,
        null, // No client secret for public clients
        `${frontendUrl}/login/callback`,
        codeVerifier
      );
      if (tokenRes.wasSuccessful()) {
        await tokensSuccess(tokenRes);
      } else {
        throw new Error(`Token exchange failed: ${tokenRes.statusCode}`);
      }
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      clearSession();
      throw error;
    }
  }, []);

  /**
   * Fetch user info from FusionAuth
    * @param {string} accessToken - Access token to use for fetching user info
    * @returns {Promise<object|null>}
    * @throws {Error} - If access token is not available or user info fetch fails
   */
  const getUserInfo = useCallback(async (accessToken) => {
    setIsLoading(true);
    try {
      const token = accessToken || userToken;
      if (!token) throw new Error('No access token available');
      const resUserInfo = await fetch(`${fusionAuthUrl}/oauth2/userinfo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!resUserInfo) throw new Error('Failed to fetch user info');
      return await resUserInfo.json();
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userToken]);

  /**
   * Refresh access token using refresh token
    * @param {string} refreshToken - The refresh token to use for refreshing the access token
    * @throws {Error} - If refresh token is not available or refresh fails
   */
  const refreshAccessToken = async (refreshToken) => {
    try {
      if (!refreshToken) throw new Error('No refresh token found');
      const resRefresh = await client.exchangeRefreshTokenForAccessToken(
        refreshToken,
        clientId,
        null,
        null
      );
      if (resRefresh.wasSuccessful()) {
        await tokensSuccess(resRefresh);
      } else {
        throw new Error('Failed to refresh access token');
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      clearSession();
    }
  };

  /**
   * Log out and redirect to FusionAuth OAuth2 logout endpoint
   * @throws {Error} - If logout fails
   */
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      window.location.href = `${fusionAuthUrl}/oauth2/logout?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(`${frontendUrl}/logout/callback`)}`;
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear any existing session stay-alive (refresh) timer
   */
  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  /**
   * Set a timer to refresh the access token before it expires
    * @param {number} expiresAt - The timestamp when the access token expires in ms
    * This is important for a good user experience because the access token
    * expiry time should be very short in OAuth2 flows, especially for
    * browser-based apps
   */
  const scheduleTokenRefresh = (expiresAt) => {
    clearRefreshTimer();
    const now = Date.now();
    const refreshIn = Math.max(expiresAt - now - 60000, 0);
    refreshTimerRef.current = setTimeout(async () => {
      if (refreshTokenRef.current) {
        await refreshAccessToken(refreshTokenRef.current);
      }
    }, refreshIn);
  };

  /**
   * Handle tokens and user info after successful login/refresh
   * @param {object} tokenRes - The token response object
   */
  const tokensSuccess = async (tokenRes) => {
    const { access_token, refresh_token, id_token } = tokenRes.response;
    setUserToken(access_token);
    refreshTokenRef.current = refresh_token;
    // Calculate the timestamp when the access token expires based on its expiry length
    const expiresAt = Date.now() + (tokenRes.response.expires_in * 1000);

    // Schedule automatic access token refresh for best user experience
    scheduleTokenRefresh(expiresAt);

    const userInfo = await getUserInfo(access_token);
    setUserInfo(userInfo);
    setLoggedIn(true);

    // Clear PKCE and state values from session storage
    clearAuthzVals();

    // Log successful authentication
    console.log('Authentication successful:', {
      userInfo,
      accessToken: access_token,
      idToken: id_token,
      refreshToken: refresh_token,
      tokenExpiresAt: new Date(expiresAt).toISOString()
    });
  };

  /**
   * Clear all session and token state
   */
  const clearSession = () => {
    clearRefreshTimer();
    setUserToken(null);
    setUserInfo(null);
    setLoggedIn(false);
    setIsLoading(false);
  };

  useEffect(() => {
    return () => {
      clearRefreshTimer();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      loggedIn,
      setLoggedIn,
      userInfo,
      setUserInfo,
      isLoading,
      userToken,
      login,
      exchangeCodeForToken,
      getUserInfo,
      logout,
      clearSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}