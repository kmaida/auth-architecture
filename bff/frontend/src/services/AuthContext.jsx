import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();
const apiUrl = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(false);

  // Check if user is logged in by sending cookie to auth API
  // If not logged in, API sets up PKCE 
  const checkSession = async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/pkce`, {
        credentials: 'include',
      });
      const data = await response.json();
      setLoggedIn(data.loggedIn);
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
    }
  };

  // If logged in, get userInfo from the userDetails cookie
  useEffect(() => {
    if (loggedIn) {
      const cookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('userDetails='));
      if (cookie) {
        const user = JSON.parse(
          decodeURIComponent(cookie.split('=')[1]).replace('j:', '')
        );
        setUserInfo(user);
      }
    } else {
      setUserInfo(null);
    }
  }, [loggedIn]);

  return (
    <AuthContext.Provider value={{ loggedIn, setLoggedIn, checkSession, userInfo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}