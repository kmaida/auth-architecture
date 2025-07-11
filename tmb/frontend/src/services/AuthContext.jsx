import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext();
const apiUrl = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is logged in by sending cookie to auth API
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/auth/checksession`, {
        credentials: 'include',
      });
      const data = await response.json(); // data: { loggedIn: boolean, user: object|null }
      setLoggedIn(data.loggedIn);

      if (data.loggedIn) {
        if (data.user) {
          setUserInfo(data.user); // Always trust the backend response
        }
        // NOTE: Could add fallback logic to check cookies if needed, but backend should always provide user info
      } else {
        // User is not logged in, no user info
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  // Get access token from backend (backend handles all session management)
  const getAccessToken = useCallback(async () => {
    try {
      // Fetch the latest access token from the backend
      const atRes = await fetch(`${apiUrl}/auth/token`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (!atRes.ok) throw new Error('Unable to get access token');
      const atJson = await atRes.json();
      const accessToken = atJson?.at;
      if (!accessToken) throw new Error('No access token available');
      return accessToken;
    } catch (error) {
      console.error('Error fetching access token:', error);
      return null;
    }
  }, [apiUrl]);

  return (
    <AuthContext.Provider value={{ 
      loggedIn, 
      setLoggedIn, 
      checkSession, 
      userInfo, 
      setUserInfo,
      isLoading, 
      getAccessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}