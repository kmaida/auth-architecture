/**
 * Generate a random state value for OAuth
 */
export const generateStateValue = () => {
  return Array(6).fill(0).map(() => Math.random().toString(36).substring(2, 15)).join('');
};

/**
 * Decode JWT token payload
 */
export const decodeToken = (token) => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Check if a token is valid and not expired
 */
export const isTokenValid = (token) => {
  if (!token) return false;
  
  try {
    const payload = decodeToken(token);
    if (!payload) return false;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
};

/**
 * Extract user info from ID token payload
 */
export const extractUserInfoFromIdToken = (idToken) => {
  const payload = decodeToken(idToken);
  if (!payload) return null;
  
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    given_name: payload.given_name,
    family_name: payload.family_name,
    preferred_username: payload.preferred_username
  };
};

/**
 * Clear all authentication-related storage
 */
export const clearAuthStorage = () => {
  // Clear session storage
  sessionStorage.removeItem('state');
  sessionStorage.removeItem('code_verifier');
  sessionStorage.removeItem('code_challenge');
  // Clear local storage
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('id_token');
};