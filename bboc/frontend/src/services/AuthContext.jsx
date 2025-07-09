import { createContext, useContext, useState, useCallback, use } from 'react';
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
  const [idToken, setIdToken] = useState(null);

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
        const newIdToken = resRefresh.response.id_token;
        
        setUserToken(newAccessToken);
        setIdToken(newIdToken);

        // Must update refresh token because rotation is enabled
        // Refresh tokens are one-time-use and rotated every time an access token is refreshed
        setRefreshToken(newRefreshToken);
        localStorage.setItem('refresh_token', newRefreshToken);

        console.log('Tokens refreshed successfully:', resRefresh.response);
        localStorage.setItem('id_token', newIdToken);
        setUserInfoFromIdToken(newIdToken);

        setLoggedIn(true);
        
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

  const decodeIdToken = (idToken) => {
    if (!idToken) return null;
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Error decoding ID token:', error);
      return null;
    }
  };

  const setUserInfoFromIdToken = (idToken) => {
    const payload = decodeIdToken(idToken);
    if (payload) {
      setUserInfo({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        given_name: payload.given_name,
        family_name: payload.family_name,
        preferred_username: payload.preferred_username
      });
    } else {
      console.warn('No valid ID token found, user info not set');
      setUserInfo(null);
    }
  };

  const clearSession = () => {
    // Clear session storage
    sessionStorage.removeItem('state');
    sessionStorage.removeItem('code_verifier');
    sessionStorage.removeItem('code_challenge');
    // Clear local storage
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('id_token');
    // Clear tokens
    setUserToken(null);
    setRefreshToken(null);
    setIdToken(null);
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
      
      // Don't attempt refresh on logout callback page
      if (window.location.pathname === '/logout/callback') {
        setIsLoading(false);
        return;
      }
      
      const storedRefreshToken = localStorage.getItem('refresh_token');
      const storedIdToken = localStorage.getItem('id_token');

      // If no access token in memory but there is user info and a refresh token in storage, try to refresh
      if (!userToken && storedIdToken && storedRefreshToken) {
        console.log('Refresh token found, attempting refresh...');
        try {
          await refreshAccessToken(storedRefreshToken);
          setUserInfoFromIdToken(storedIdToken);
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
        localStorage.setItem('id_token', idToken);
        
        // Extract user info from ID token
        if (idToken) {
          try {
            localStorage.setItem('id_token', idToken); // Ensure ID token is stored
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
      window.location.href=`${fusionAuthUrl}/oauth2/logout?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(`${frontendUrl}/logout/callback`)}`;
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