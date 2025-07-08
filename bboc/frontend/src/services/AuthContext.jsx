import { createContext, useContext, useState, useCallback } from 'react';
import { FusionAuthClient } from '@fusionauth/typescript-client';

const AuthContext = createContext();
const clientId = import.meta.env.VITE_CLIENT_ID;
const frontendUrl= import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
const apiUrl = import.meta.env.VITE_API_URL;
const fusionAuthUrl = import.meta.env.VITE_AUTHZ_SERVER_URL;
const client = new FusionAuthClient(null, fusionAuthUrl);

const setupPKCE = () => {
  // This function should implement PKCE setup if needed
  const codeVerifier = 'dummyCodeVerifier';
  const codeChallenge = 'dummyCodeChallenge';
  return { codeVerifier, codeChallenge };
};

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preLoginPath, setPreLoginPath] = useState('/');
  const [aToken, setAToken] = useState(null);

  // Check if user is logged in by sending the access token to FusionAuth (if it exists)
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!aToken) {
        setLoggedIn(false);
        setUserInfo(null);
        setIsLoading(false);
        console.log('No access token found, user is not logged in.');
        return;
      }

      // Validate access token with FusionAuth
      const resValidate = await client.validateJWT(aToken);

      console.log('Token validation response:', resValidate);

      if (resValidate.wasSuccessful()) {
        setLoggedIn(true);
        // Get user info from FusionAuth
        const resUser = await client.retrieveUser(resValidate.successResponse.token);
        if (resUser.wasSuccessful()) {
          setUserInfo(resUser.successResponse.user);
        } else {
          setUserInfo(null);
        }
      } else {
        console.log('Invalid access token, user is not logged in.');
        // @TODO: Check for refresh token by userId
        setLoggedIn(false);
        // setUserInfo(null);
        // Remove invalid token
        setAToken(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initiate login process
  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      // @TODO: oauth2/authorize request to FusionAuth
      const resAuthorize = await client.startOAuth2AuthorizationCodeFlow({
        clientId: clientId,
        redirectUri: `${frontendUrl}/auth/callback`,
        scope: 'openid profile email',
      });
      
    } catch (error) {
      console.error('Error checking session:', error);
      setLoggedIn(false);
      setUserInfo(null);
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
      aToken, 
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