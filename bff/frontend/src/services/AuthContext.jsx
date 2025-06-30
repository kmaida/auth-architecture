import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:4001/auth/pkce', {
        credentials: 'include',
      });
      const data = await response.json();
      console.log(data);
      setLoggedIn(data.loggedIn);
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
    }
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