/**
 * Utility function for making authenticated API requests with automatic token refresh
 * This helps prevent race conditions where the frontend tries to use an expired token
 */

const apiUrl = import.meta.env.VITE_API_URL;

/**
 * Make an authenticated API request with automatic retry on 401 errors
 * @param {string} url - The API endpoint URL
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @param {function} getAccessToken - Function to get fresh access token
 * @param {boolean} retryOnFailure - Whether to retry on 401 errors (default: true)
 * @returns {Promise} - Promise that resolves to the response data
 */
export const makeAuthenticatedRequest = async (url, options = {}, getAccessToken, retryOnFailure = true) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      // Check for token refresh required (403) or general auth failure (401)
      if ((response.status === 401 || response.status === 403) && retryOnFailure && getAccessToken) {
        const errorData = await response.json().catch(() => ({}));
        
        // Only attempt refresh if backend indicates it's possible
        if (response.status === 403 && errorData.code === 'TOKEN_REFRESH_REQUIRED') {
          console.log('Backend indicates token refresh required, attempting refresh...');
        } else if (response.status === 401) {
          console.log('Received 401, attempting to refresh token and retry...');
        } else {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const freshToken = await getAccessToken();
        
        if (freshToken?.at) {
          // Get the current token from the request headers to compare
          const currentToken = options.headers?.['Authorization']?.replace('Bearer ', '');
          
          // Only retry if we actually got a different token
          if (freshToken.at !== currentToken) {
            console.log('Got fresh token, retrying request...');
            
            // Small delay to prevent rapid-fire requests
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update Authorization header with fresh token
            const updatedOptions = {
              ...options,
              headers: {
                ...options.headers,
                'Authorization': `Bearer ${freshToken.at}`
              }
            };
            
            // Retry with fresh token (but don't retry again to avoid infinite loop)
            return await makeAuthenticatedRequest(url, updatedOptions, getAccessToken, false);
          } else {
            console.log('Fresh token is the same as current token, not retrying to avoid infinite loop');
            throw new Error(`Authentication failed: Unable to refresh token`);
          }
        } else {
          console.log('No fresh token received, cannot retry');
          throw new Error(`Authentication failed: Unable to get fresh token`);
        }
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Error making authenticated request:', err);
    throw err;
  }
};

/**
 * Helper function to create standard authenticated request options
 * @param {string} token - Access token
 * @param {object} additionalOptions - Additional fetch options
 * @returns {object} - Fetch options with Authorization header
 */
export const createAuthOptions = (token, additionalOptions = {}) => {
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...additionalOptions.headers
    },
    ...additionalOptions
  };
};
