import pkceChallenge from 'pkce-challenge';

/**
 * Generate a random state value for OAuth
  * @returns {string} - A random string to be used as state
 */
export const generateStateValue = () => {
  return Array(6).fill(0).map(() => Math.random().toString(36).substring(2, 15)).join('');
};

/**
 * Set up PKCE challenge and state
  * @returns {Promise<{codeVerifier: string, codeChallenge: string}>} - An object containing the code verifier and code challenge
    * @throws {Error} - If PKCE challenge generation fails
    * 
    * This function generates a random state value and a PKCE challenge pair (code verifier and code challenge).
    * It stores these values in session storage for later use in the OAuth flow.
 */
export const setupPKCE = async () => {
  const stateValue = generateStateValue();
  const pkcePair = await pkceChallenge();
  const codeVerifier = pkcePair.code_verifier;
  const codeChallenge = pkcePair.code_challenge;

  // Store the state and PKCE values in session storage
  sessionStorage.setItem('state', stateValue);
  sessionStorage.setItem('code_verifier', codeVerifier);
  sessionStorage.setItem('code_challenge', codeChallenge);
  return { codeVerifier, codeChallenge };
};

/**
 * Decode JWT token payload
 * @param {string} token - The JWT token to decode
 * @returns {object|null} - The decoded payload or null if invalid
 */
export const decodeToken = (token) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Check if a token is valid and not expired 
  * @param {string} token - The JWT token to validate
  * @returns {boolean} - True if valid, false otherwise
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
 * Clear all authentication-related browser storage
 */
export const clearAuthStorage = () => {
  // Clear session storage
  sessionStorage.removeItem('state');
  sessionStorage.removeItem('code_verifier');
  sessionStorage.removeItem('code_challenge');
  sessionStorage.removeItem('id_token');
  sessionStorage.removeItem('access_token_expires_at');
  // Clear local storage
  localStorage.removeItem('refresh_token');
};