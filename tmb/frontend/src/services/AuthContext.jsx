import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext();
const apiUrl = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preLoginPath, setPreLoginPath] = useState('/');
  const [aToken, setAToken] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  // Get access token from backend with concurrency protection
  const getAccessToken = useCallback(async () => {
    // Prevent concurrent refresh attempts
    if (isRefreshing) {
      console.log('Token refresh already in progress, waiting...');
      // Wait for current refresh to complete
      while (isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return aToken;
    }

    try {
      setIsRefreshing(true);
      const response = await fetch(`${apiUrl}/login/callback`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }
      
      const at = await response.json(); // { at: 'accessToken' }
      setAToken(at);
      return at;
    } catch (error) {
      console.error('Error getting access token:', error);
      setAToken(null);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]); // Removed aToken from dependencies to prevent infinite loops

  // Check if user is logged in by sending cookie to auth API
  const checkSession = useCallback(async () => {
    // Prevent concurrent session checks
    if (isCheckingSession) {
      console.log('Session check already in progress, skipping...');
      return;
    }

    try {
      setIsCheckingSession(true);
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/auth/checksession`, {
        credentials: 'include',
      });
      const data = await response.json(); // data: { loggedIn: boolean, user: object|null, tokenRefreshNeeded?: boolean }
      setLoggedIn(data.loggedIn);

      if (data.loggedIn) {
        if (data.user) {
          setUserInfo(data.user); // Always trust the backend response
        }
        
        // Get fresh access token after session check (especially if refresh is needed)
        const freshToken = await getAccessToken();
        
        // If we got a fresh token but still no user info, try to get user info again
        if (!data.user && freshToken?.at) {
          // This might happen if the token was refreshed and we need to fetch user info
          // We could make another checksession call, but let's avoid potential loops
          console.log('Token refreshed but no user info received');
        }
        
        // NOTE: Could add fallback logic to check cookies if needed, but backend should always provide user info
      } else {
        // User is not logged in, no user info
        setUserInfo(null);
        setAToken(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
      setAToken(null);
    } finally {
      setIsLoading(false);
      setIsCheckingSession(false);
    }
  }, [getAccessToken, isCheckingSession]);


  return (
    <AuthContext.Provider value={{ 
      loggedIn, 
      setLoggedIn, 
      checkSession, 
      userInfo, 
      isLoading, 
      aToken, 
      getAccessToken,
      preLoginPath, 
      setPreLoginPath 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}