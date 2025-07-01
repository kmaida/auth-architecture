import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();
const apiUrl = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Check if user is logged in by sending cookie to auth API
const checkSession = async () => {
  try {
    const response = await fetch(`${apiUrl}/auth/checksession`, {
      credentials: 'include',
    });
    const data = await response.json();
    setLoggedIn(data.loggedIn);

    if (data.loggedIn) {
      if (data.user) {
        setUserInfo(data.user); // Always trust the backend response
      } else {
        // fallback to cookie ONLY if user not in response (should rarely happen)
        const cookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('userInfo='));
        if (cookie) {
          const user = JSON.parse(
            decodeURIComponent(cookie.split('=')[1]).replace('j:', '')
          );
          setUserInfo(user);
        } else {
          setUserInfo(null);
        }
      }
    } else {
      setUserInfo(null);
    }
  } catch (error) {
    console.error('Error checking session:', error);
    setLoggedIn(false);
    setUserInfo(null);
  }
};

  return (
    <AuthContext.Provider value={{ loggedIn, setLoggedIn, checkSession, userInfo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}