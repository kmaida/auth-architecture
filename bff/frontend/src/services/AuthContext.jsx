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