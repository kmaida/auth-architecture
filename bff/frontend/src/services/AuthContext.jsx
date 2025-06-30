import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const getCookie = (cookieName) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${cookieName}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(false);

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:4001/auth/pkce', {
        credentials: 'include',
      });
      const data = await response.json();
      setLoggedIn(data.loggedIn);
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
    }
  };

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