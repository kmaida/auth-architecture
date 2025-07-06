# Infinite Loop Fix for Token Refresh

## Problem Description

After implementing the initial race condition fix, an infinite loop was occurring with rapid 401 responses and token refresh attempts. This was causing:
- Overwhelming number of requests to the backend
- Browser console flooding with 401 errors
- Application becoming unresponsive

## Root Causes Identified

### 1. Backend Middleware Issue
The original fix attempted to refresh tokens in the `createSecureMiddleware`, but this created a problem:
- Backend would refresh the token and allow the API call to proceed
- Frontend still had the old expired token cached
- Next API call would use the same expired token, causing another 401
- This created an endless cycle

### 2. Frontend Token Refresh Race Conditions
Multiple issues in the frontend:
- No protection against concurrent token refresh attempts
- Frontend could retry with the same expired token
- No validation that a "fresh" token was actually different from the current token

### 3. Backend Token Endpoint Issues
The `/login/callback` endpoint was not ensuring fresh tokens:
- It returned whatever token was in the session without validation
- If called during a refresh operation, it could return stale tokens

## Solutions Implemented

### 1. Backend Middleware Simplification
**File: `tmb/backend/src/utils/auth-utils.ts`**

- Removed token refresh logic from the middleware
- Instead of refreshing, return status 403 with `TOKEN_REFRESH_REQUIRED` code when:
  - Token is expired/invalid AND
  - Valid session with refresh token exists
- This tells the frontend to refresh and retry, rather than the backend attempting refresh

### 2. Frontend Token Validation
**File: `tmb/frontend/src/utils/api.js`**

Enhanced the retry logic with multiple safeguards:
- Compare current token with "fresh" token to ensure they're different
- Handle both 401 and 403 responses appropriately
- Add small delays to prevent rapid-fire requests
- Better error messages and logging for debugging

### 3. Backend Token Endpoint Enhancement
**File: `tmb/backend/src/auth.ts`**

Modified `/login/callback` to ensure fresh tokens:
- Uses `verifyJWT` to validate and refresh tokens before returning
- Always returns the most up-to-date token from the session
- Proper error handling for invalid sessions

### 4. Frontend Concurrency Protection
**File: `tmb/frontend/src/services/AuthContext.jsx`**

Added protection against concurrent refresh attempts:
- `isRefreshing` flag to prevent multiple simultaneous refreshes
- Waiting mechanism for ongoing refreshes
- Better error handling and state management

## Key Improvements

### Prevention of Infinite Loops
1. **Token Comparison**: Frontend checks if "fresh" token differs from current token
2. **Single Retry**: Maximum one retry attempt per request
3. **Concurrency Control**: Only one token refresh at a time
4. **Proper Status Codes**: 403 indicates refresh needed, 401 indicates auth failure

### Better Error Handling
1. **Specific Error Codes**: Backend returns actionable error information
2. **Logging**: Comprehensive logging for debugging
3. **Graceful Fallbacks**: Clear error messages when refresh fails

### Performance Improvements
1. **Reduced Requests**: No more rapid-fire token refresh attempts
2. **Delays**: Small delays prevent overwhelming the backend
3. **Caching**: Prevent duplicate refresh attempts

## Testing the Fix

To verify the fix is working:

1. **Check Browser Console**: Should see controlled token refresh attempts, not rapid 401s
2. **Network Tab**: Should see reasonable request patterns, not request storms
3. **Application Behavior**: Protected pages should load smoothly after token refresh
4. **Logging**: Look for specific log messages:
   - "Backend indicates token refresh required, attempting refresh..."
   - "Got fresh token, retrying request..."
   - "Fresh token is the same as current token, not retrying to avoid infinite loop"

## Architecture Notes

This solution maintains the TMB pattern principles:
- Frontend gets and manages tokens
- Backend validates tokens and provides refresh capabilities
- Session-based security with httpOnly cookies
- Clear separation of concerns between frontend and backend token handling

The key insight is that token refresh should be initiated by the frontend, not attempted automatically by the backend middleware. The backend's role is to validate tokens and provide refresh services, while the frontend orchestrates the refresh process.
