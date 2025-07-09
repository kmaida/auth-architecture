import { createContext, useContext, useState, useCallback } from 'react';
import { FusionAuthClient } from '@fusionauth/typescript-client';

import { 
  setupPKCE,
  clearAuthStorage 
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
  const [preLoginPath, setPreLoginPath] = useState('/');
  const [userToken, setUserToken] = useState(null);

  //----------------------------------- Check session

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Don't check session or attempt refresh on auth callback pages
      if (window.location.pathname === '/logout/callback' || window.location.pathname === '/login/callback') {
        setIsLoading(false);
        return;
      }
      
      const storedRefreshToken = localStorage.getItem('refresh_token');

      // If no access token in memory but there is a refresh token in storage, try to refresh
      if (!userToken && storedRefreshToken) {
        console.log('Refresh token found, attempting refresh...');
        try {
          await refreshAccessToken(storedRefreshToken);
        } catch (error) {
          console.error('Failed to refresh token:', error);
          clearSession();
          return;
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [userToken]);

  //----------------------------------- Log in

  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Generate PKCE pair and state value
      await setupPKCE();
      
      window.location.href=`${fusionAuthUrl}/oauth2/authorize?` +
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
  
  //----------------------------------- Exchange code for token (called from LoginCallbackPage)

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
        null, // clientSecret (null for public clients)
        frontendUrl + '/login/callback',
        codeVerifier
      );

      console.log('Token exchange response:', tokenRes);

      if (tokenRes.wasSuccessful()) {
        const accessToken = tokenRes.response.access_token;
        const refreshToken = tokenRes.response.refresh_token;
        const idToken = tokenRes.response.id_token;
        
        setUserToken(accessToken);
        setLoggedIn(true);
        localStorage.setItem('refresh_token', refreshToken);
        sessionStorage.setItem('id_token', idToken);
        
        // Get user info from oauth2/userinfo endpoint
        const userInfo = await getUserInfo(accessToken);
        setUserInfo(userInfo);
    
        return true;
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
      clearSession();
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  //----------------------------------- Get user info

  const getUserInfo = useCallback(async (accessToken) => {
    try {
      setIsLoading(true);
      // If accessToken is provided, use it; otherwise, use the stored userToken
      const token = accessToken || userToken;

      if (!token) {
        throw new Error('No access token available, unable to authorize user info request');
      }

      const resUserInfo = await fetch(`${fusionAuthUrl}/oauth2/userinfo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!resUserInfo.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await resUserInfo.json();
      console.log('User info fetched successfully:', userInfo);
      return userInfo;
    } catch (error) {
      console.error('Error fetching user info:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  //----------------------------------- Refresh access token

  const refreshAccessToken = async (refreshToken) => {
    try {
      if (!refreshToken) {
        throw new Error('No refresh token found');
      }
      
      const resRefresh = await client.exchangeRefreshTokenForAccessToken(
        refreshToken,
        clientId,
        null, // clientSecret (null for public clients)
        null  // scope (use same as original authorization request)
      );
      
      if (resRefresh.wasSuccessful()) {
        const newAccessToken = resRefresh.response.access_token;
        const newRefreshToken = resRefresh.response.refresh_token; // Refresh token rotation
        const newIdToken = resRefresh.response.id_token;

        // NOTE: for additional security, you could store the userId separately from the refresh token
        // and compare the stored userId with the one in the resRefresh.response.userId to further ensure
        // that the refresh token is valid for the current user session
        
        setUserToken(newAccessToken);
        sessionStorage.setItem('id_token', newIdToken);

        // Must update stored refresh token (refresh token rotation)
        // Refresh tokens are one-time-use and rotated every time a new access token is issued
        localStorage.setItem('refresh_token', newRefreshToken);

        console.log('Tokens refreshed successfully:', resRefresh.response);
        
        const userInfo = await getUserInfo(newAccessToken);
        setUserInfo(userInfo);

        setLoggedIn(true);
        
        return { newAccessToken, newRefreshToken, newIdToken };
      } else {
        throw new Error('Failed to refresh access token');
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      clearSession();
    }
  };

  //----------------------------------- Log out

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      window.location.href=`${fusionAuthUrl}/oauth2/logout?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(`${frontendUrl}/logout/callback`)}`;
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  //----------------------------------- Clear session

  const clearSession = () => {
    // Clear browser storage (session storage and local storage)
    clearAuthStorage();
    // Clear access token in app memory
    setUserToken(null);
    // Clear user info and login state
    setUserInfo(null);
    setLoggedIn(false);
    // Reset loading state
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ 
      loggedIn, 
      setLoggedIn, 
      checkSession, 
      userInfo,
      setUserInfo,
      isLoading, 
      userToken, 
      preLoginPath, 
      setPreLoginPath,
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