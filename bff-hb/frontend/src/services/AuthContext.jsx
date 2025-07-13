import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useFusionAuth } from "@fusionauth/react-sdk";

const AuthContext = createContext();
const clientId = import.meta.env.VITE_CLIENT_ID;


export function AuthProvider({ children }) {
  const { isLoggedIn, userInfo, startLogin, startLogout } = useFusionAuth();
  const refreshTimerRef = useRef(null);

  /**
   * Check session and refresh tokens if necessary
   */
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      // Skip session check on callback pages
      const path = window.location.pathname;
      if (path === '/logout/callback' || path === '/login/callback') {
        setIsLoading(false);
        return;
      }
      // Check if user is already logged in and if not, try to refresh the session
      const storedRefreshToken = sessionStorage.getItem('refresh_token');
      if (!userToken && storedRefreshToken) {
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
      clearSession();
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
    // Refresh 1 minute before expiry, but never less than 0
    const refreshIn = Math.max(expiresAt - now - 60000, 0);
    refreshTimerRef.current = setTimeout(async () => {
      const refreshToken = sessionStorage.getItem('refresh_token');
      if (refreshToken) {
        await refreshAccessToken(refreshToken);
      }
    }, refreshIn);
  };

  /**
   * Handle tokens and user info after successful login/refresh
   * @param {object} tokenRes - The token response object
   */
  const tokensSuccess = async (tokenRes) => {
    console.log('Tokens successfully refreshed:', tokenRes);
  };

  /**
   * Clear all session and token state
   */
  const clearSession = () => {
    clearRefreshTimer();
    clearAuthStorage();
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      checkSession,
      clearSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}