import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

const getCookie = (cookieName) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${cookieName}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  // const [userInfo, setUserInfo] = useState(false);

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:4001/auth/pkce', {
        credentials: 'include',
      });
      const data = await response.json();
      console.log(data);
      setLoggedIn(data.loggedIn);
      // getUserInfo();
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
    }
  };

  const getUserInfo = () => {
    let cookieUserInfo = getCookie('userInfo');
    setUserInfo(cookieUserInfo);
    console.log(cookieUserInfo);
  };

  return (
    <AuthContext.Provider value={{ loggedIn, setLoggedIn, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}