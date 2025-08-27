# Token-Mediating-Backend Auth Architecture

This is a demo of the Token-Mediating Backend (TMB) architecture pattern, specifically as described in the [OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend") specification draft. The backend is a confidential client that handles (proxies) authentication requests with the authorization server ([FusionAuth](https://fusionauth.io/ "https://fusionauth.io/")). It then delivers access tokens to the frontend in a JSON object so the frontend can directly call the resource server. The frontend never interacts directly with the authorization server. It should store tokens in local app memory, not in localStorage. [Token-Mediating Backend is the second most secure](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#section-6.2.4.2 "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#section-6.2.4.2") of the three architecture patterns for browser-based apps.

> [!IMPORTANT]  
> There aren't many situations where you should use TMB instead of [BFF](https://github.com/kmaida/auth-architecture/tree/main/bff) or [BFF-HB](https://github.com/kmaida/auth-architecture/tree/main/bff). BFF is more secure and requires a similar amount of work to implement, _unless_ your auth platform defaults to TMB (many do), your system requirements prevent proxying APIs, or you don't need to make many/any calls to secure external APIs.

## Architecture Overview

-   **Frontend:** [React](https://react.dev/ "https://react.dev") app with [Vite](https://vite.dev)
-   **Backend:** [Node.js](https://nodejs.org/ "https://nodejs.org/") [Express](https://expressjs.com/ "https://expressjs.com/") API and server
-   **Authorization server:** Self-hosted [FusionAuth](https://fusionauth.io/ "https://fusionauth.io/") running in a Docker container
-   **Authentication:** `/auth` API on backend using [FusionAuth OAuth 2.0 endpoints](https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints "https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints") and [TypeScript SDK](https://github.com/FusionAuth/fusionauth-typescript-client "https://github.com/FusionAuth/fusionauth-typescript-client")
-   **Authorization:** `/api` local API on the backend verifies the access token in the user's stored session before allowing access to protected resources
-   **Resource server:** a cross-origin API that requires authorization, directly called by the frontend app (all three architectures use this same resource server)

## Features

-   User authentication with FusionAuth using OAuth 2.0 Authorization Code flow with PKCE
-   Local API on the backend with FusionAuth authorization through access token verification
-   Authentication API on the backend
-   Session persistence with refresh token grant on the backend and proactive session renewal
-   Frontend can call the resource server directly with access tokens

## Setup & Installation

### Prerequisites

- [Docker](https://docker.com) (we'll be using `docker compose`) or a Docker Desktop alternative (like [Podman](https://podman.io/) for PC or [Orbstack](https://orbstack.dev/) for Mac)
- [NodeJS](https://nodejs.org) with npm
- FusionAuth instance set up via instructions in the [repo root README](https://github.com/kmaida/auth-architecture/blob/main/README.md#fusionauth) and running at `http://localhost:9011` (login: http://localhost:9011/admin)
- [Resource API server](https://github.com/kmaida/auth-architecture/tree/main/resource-api) running at `http://resource-api.local:5001` (recommended to simulate CORS) or `http://localhost:5001`

### Backend

1. In your filesystem, open a console in the `auth-architecture/tmb/backend` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the server and APIs at `http://localhost:4001`

This is a set of APIs; it does not have a browser component.

### Frontend

1. In your filesystem, open a console in the `auth-architecture/tmb/frontend` folder
2. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
3. Run `npm install`
4. Run `npm run dev` to run the development environment using [Vite](https://vite.dev), accessible in the browser at `http://localhost:5173`

If you have the backend and FusionAuth both running, you should be able to log into the frontend app with the admin credentials provided in the FusionAuth installation section.

### Concurrent architectures

You will not be able to run multiple architecture demos at the same time because they share ports. If you'd like to run multiple apps at the same time, you must change the ports.

All apps share the same FusionAuth instance, so there is no need to run multiple FusionAuth containers.

## How TMB Authentication Works

Here are all the steps for authentication in this TMB example in explicit detail. With this explanation, you should be able to trace the entire authentication lifecycle through both the backend and the frontend.

1.  User navigates to the frontend app

2.  Frontend calls the backend `/auth/checksession` endpoint with `credentials: include` to attach the session cookie, if it exists

3.  If present, backend uses the session ID cookie to look up user's session, which stores secure credentials (access token and refresh token), then [verifies the JSON Web Token access token](https://www.youtube.com/shorts/zRY-ElxVa_U "https://www.youtube.com/shorts/zRY-ElxVa_U") (the session cookie is `httpOnly`, only the backend can use the contents of the cookie)

4.  If verification shows that the access token is expired, the backend checks for a refresh token and initiates a [refresh grant](https://datatracker.ietf.org/doc/html/rfc6749#section-1.5 "https://datatracker.ietf.org/doc/html/rfc6749#section-1.5") to get new tokens, if possible

5.  If there is no session cookie, the user's session is invalid, and/or if there is no refresh token, the backend prepares for an authorization request using [OAuth 2.0 Authorization Code flow](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1 "https://datatracker.ietf.org/doc/html/rfc6749#section-4.1") with [PKCE](https://datatracker.ietf.org/doc/html/rfc7636 "https://datatracker.ietf.org/doc/html/rfc7636") by generating a `state` and...

6.  ...a `code_verifier` and a hash of the code verifier called a `code_challenge`, which is created by hashing the verifier with a function called a `code_challenge_method` *(PKCE info is set now because creating it on login causes a race condition when setting the cookie)*

7.  Backend sets an `httpOnly` PKCE cookie with the `state`, `code_verifier`, and `code_challenge` *(a user cookie is used because the user's PKCE information must be persisted through the OAuth handshake, but the user session is not created until a successful login)*

8.  Backend returns a response informing the frontend that the user is not authenticated

9.  User clicks the Log In button

10. Frontend redirects to the backend `/auth/login` endpoint

11. Backend generates an authorization request with the necessary configuration (e.g., `client_id`, `client_secret`, `state`, etc.) and the `code_challenge`, and sends the request to the authorization server's ([FusionAuth](https://fusionauth.io/ "https://fusionauth.io/")'s) `/oauth2/authorize` endpoint

12. Authorization server validates the authorization request, authenticates the user, and redirects to the backend `/auth/callback` endpoint with a code and the same `state` it received with the authorization request

13. Backend verifies the state the authorization server returned is the same `state` the backend set in the PKCE cookie and sent with the authorization request (steps 6 and 12)

14. Backend sends a token request to the authorization server with the `code` and `code_verifier`

15. Authorization server validates the token request, verifies the `code` is the same `code` it sent in step 13, and uses the `code_challenge_method` to hash the `code_verifier` and recreate a copy of the `code_challenge`

16. Authorization server compares its new `code_challenge` to the backend's `code_challenge` (steps 7 and 12) and verifies they are identical

17. Authorization server sends an access token and refresh token to the backend

18. Backend deletes the PKCE cookie, generates a session ID, and stores the user's tokens and userInfo in a backend session (in-memory in this example, but I recommend Redis for production).

19. Backend sets an `httpOnly` cookie for the user's session ID (this only contains the session ID, not tokens)

20. Backend `/auth/token` is now available for the frontend to call when it needs the access token (e.g., to authorize API calls)

21. Frontend runs `checkSession`, confirms authentication state, fetches `userInfo`, and uses the information to set user-specific variables, etc.

22. When the user clicks the Log Out button, the frontend redirects to the backend `/auth/logout` endpoint

23. Backend redirects to the authorization server's `/oauth2/logout` endpoint with appropriate configuration

24. Authorization server logs the user out and redirects to the backend `/auth/logout/callback` endpoint

25. Backend deletes the server-side user session, clears all cookies, and redirects the unauthenticated user to the frontend homepage

## How TMB API Authorization Works

When a user requests access to secure data (either from a local backend API or external resource server), the frontend requests the user's access token from the backend in order to authorize access to the API (resource server). The frontend should protect routes that require authentication by checking the session before permitting navigation to the page that will call the secure API. Frontend checks like this improve the user experience.

1.  Authenticated user navigates to a protected frontend route that calls a secure API

2.  Frontend calls the backend `/auth/token` endpoint with the user's session cookie to get the access token

3.  Frontend makes a request to the resource API for protected data with `Authorization: Bearer 'accessToken'` as authorization (for example, to the `http://resource-api.local:5001/api/recipe` endpoint)

4.  API middleware verifies the access token in the Authorization header and returns data to the frontend if the token is valid

5.  If the user isn't logged in or there's a problem with the access token, the resource server returns a `401: Unauthorized` error, which is displayed in the frontend

## Other Auth Architectures

Token-Mediating Backend is one of three recommended authentication and authorization architecture choices for browser-based apps. The other two architectures are [Backend-for-Frontend](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff") and [Browser-based OAuth 2.0 client](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie"). Each architecture has different trade-offs and benefits. Demos of all three architectures are included in this repo.