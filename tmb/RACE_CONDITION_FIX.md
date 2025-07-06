# Race Condition Fix for TMB Authentication

## Problem Description

In the Token-Mediating Backend (TMB) pattern, there was a race condition where the frontend would sometimes call protected API routes with an expired access token before the refresh grant had finished updating the tokens. This resulted in API calls failing with 401 Unauthorized errors.

## Root Cause

1. The frontend caches access tokens locally and uses them in Authorization headers
2. When tokens expire, the frontend initiates a refresh via `/auth/checksession`
3. However, the frontend might make API calls with the old cached token before the refresh completes
4. The original `createSecureMiddleware` only validated tokens and immediately returned 401 for expired tokens without attempting to refresh

## Solution Implemented

### Backend Changes

**File: `tmb/backend/src/utils/auth-utils.ts`**

Modified the `createSecureMiddleware` to:
1. First attempt to validate the JWT token from the Authorization header
2. If the token is invalid/expired, check for a valid session cookie
3. If a session exists with a refresh token, attempt to refresh the access token
4. If refresh succeeds, allow the API call to proceed
5. Only return 401 if no session exists or refresh fails

Key improvements:
- Added session-based token refresh capability to the secure middleware
- Imported `getUserSessionIdFromCookie` from session utilities
- Added proper error handling and logging for refresh attempts

### Frontend Changes

**File: `tmb/frontend/src/services/AuthContext.jsx`**

Improved the AuthContext to:
1. Extract token fetching into a separate `getAccessToken` function
2. Always fetch fresh tokens after session checks
3. Provide the `getAccessToken` function to components for manual refresh

**File: `tmb/frontend/src/pages/ProtectedPage.jsx`**

Updated to use a more robust API calling pattern:
1. Uses a reusable authenticated request utility
2. Automatically retries failed requests with fresh tokens
3. Better error handling and user feedback

**File: `tmb/frontend/src/utils/api.js`** (New)

Created a utility module with:
1. `makeAuthenticatedRequest` - Handles automatic token refresh on 401 errors
2. `createAuthOptions` - Helper for creating properly formatted request options
3. Reusable across all components that need to make authenticated API calls

## Benefits

1. **Eliminates Race Conditions**: API calls can now handle expired tokens gracefully
2. **Better User Experience**: Fewer failed requests and smoother authentication flow
3. **Automatic Recovery**: Both frontend and backend can handle token refresh automatically
4. **Reusable Pattern**: The utility functions can be used for all authenticated API calls

## Usage

For new protected API endpoints, simply use the existing `secure` middleware - it now handles token refresh automatically.

For frontend API calls, use the new utility functions:

```javascript
import { makeAuthenticatedRequest, createAuthOptions } from '../utils/api';
import { useAuth } from '../services/AuthContext';

const { aToken, getAccessToken } = useAuth();

// Make an authenticated request
const options = createAuthOptions(aToken.at);
const data = await makeAuthenticatedRequest(url, options, getAccessToken);
```

## Testing

To test the fix:
1. Log in to the application
2. Wait for the access token to expire (or artificially expire it)
3. Navigate to a protected page that makes API calls
4. Verify that the API calls succeed after automatic token refresh
5. Check browser console for refresh attempt logs
