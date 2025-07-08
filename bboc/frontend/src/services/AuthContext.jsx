import { createContext, useContext, useState, useCallback } from 'react';
import { FusionAuthClient } from '@fusionauth/typescript-client';
import pkceChallenge from 'pkce-challenge';

const AuthContext = createContext();
const clientId = import.meta.env.VITE_CLIENT_ID;
const frontendUrl= import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
const apiUrl = import.meta.env.VITE_API_URL;
const fusionAuthUrl = import.meta.env.VITE_AUTHZ_SERVER_URL;
const client = new FusionAuthClient(null, fusionAuthUrl);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preLoginPath, setPreLoginPath] = useState('/');
  const [userToken, setUserToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [idToken, setIdToken] = useState(null); // Add this

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

  const refreshAccessToken = async (refreshToken) => {
    try {
      if (!refreshToken) {
        throw new Error('No refresh token found');
      }
      
      const resRefresh = await client.exchangeRefreshTokenForAccessToken(
        refreshToken,
        clientId,
        null, // clientSecret (null for public clients)
        null  // scope
      );
      
      if (resRefresh.wasSuccessful()) {
        const newAccessToken = resRefresh.response.access_token;
        const newRefreshToken = resRefresh.response.refresh_token; // Handle rotation
        
        setUserToken(newAccessToken);
        
        // Update refresh token if rotation is enabled
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
          localStorage.setItem('refresh_token', newRefreshToken);
        }
        
        return newAccessToken;
      } else {
        throw new Error('Failed to refresh access token');
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      clearSession();
      throw error;
    }
  };

  const clearSession = () => {
    // Clear session storage
    sessionStorage.removeItem('state');
    sessionStorage.removeItem('code_verifier');
    sessionStorage.removeItem('code_challenge');
    // Clear local storage
    localStorage.removeItem('refresh_token');
    // Clear tokens
    setUserToken(null);
    setRefreshToken(null);
    setIdToken(null); // Add this
    // Reset user info and login state
    setUserInfo(null);
    setLoggedIn(false);
  };

  const isTokenValid = (token) => {
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token is expired
      return payload.exp > currentTime;
    } catch (error) {
      console.error('Error parsing token:', error);
      return false;
    }
  };

  //----------------------------------- Check session

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedRefreshToken = localStorage.getItem('refresh_token');

      // If no access token but we have a refresh token, try to refresh
      if (!userToken && storedRefreshToken) {
        console.log('Refresh token found, attempting refresh...');
        try {
          await refreshAccessToken(storedRefreshToken);
          return;
        } catch (error) {
          console.error('Failed to refresh token:', error);
          clearSession();
          return;
        }
      }

      // Check if we have a valid token
      if (!userToken || !isTokenValid(userToken)) {
        console.log('No valid access token available');
        
        if (storedRefreshToken) {
          try {
            await refreshAccessToken(storedRefreshToken);
            return;
          } catch (error) {
            clearSession();
            return;
          }
        }
        
        setLoggedIn(false);
        setUserInfo(null);
        return;
      }

      // Token is valid, extract user info from ID token if available
      if (idToken) {
        try {
          const payload = JSON.parse(atob(idToken.split('.')[1]));
          console.log('User info from ID token:', payload);
          
          setLoggedIn(true);
          setUserInfo({
            response: {
              sub: payload.sub,
              email: payload.email,
              name: payload.name,
              given_name: payload.given_name,
              family_name: payload.family_name,
              preferred_username: payload.preferred_username,
            }
          });
        } catch (parseError) {
          console.error('Error parsing ID token:', parseError);
          setLoggedIn(false);
          setUserInfo(null);
        }
      } else {
        // Fallback: extract basic info from access token
        try {
          const payload = JSON.parse(atob(userToken.split('.')[1]));
          setLoggedIn(true);
          setUserInfo({
            response: {
              sub: payload.sub,
              email: payload.email,
            }
          });
        } catch (parseError) {
          console.error('Error parsing access token:', parseError);
          setLoggedIn(false);
          setUserInfo(null);
        }
      }

    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [userToken, idToken]);

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
      console.error('Error during login:', error);
      setLoggedIn(false);
      setUserInfo(null);
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
        null,
        frontendUrl + '/login/callback',
        codeVerifier
      );

      console.log('Token exchange response:', tokenRes);

      if (tokenRes.wasSuccessful()) {
        const accessToken = tokenRes.response.access_token;
        const refreshToken = tokenRes.response.refresh_token;
        const idToken = tokenRes.response.id_token;
        
        setUserToken(accessToken);
        setRefreshToken(refreshToken);
        setLoggedIn(true);
        localStorage.setItem('refresh_token', refreshToken);
        
        // Extract user info from ID token
        if (idToken) {
          try {
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            console.log('User info from ID token:', payload);
            
            setUserInfo({
              sub: payload.sub,
              email: payload.email,
              name: payload.name,
              given_name: payload.given_name,
              family_name: payload.family_name,
              preferred_username: payload.preferred_username
            });
          } catch (parseError) {
            console.error('Error parsing ID token:', parseError);
          }
        }
        
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
      setLoggedIn(false);
      setUserInfo(null);
      setUserToken(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  //----------------------------------- Log out

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