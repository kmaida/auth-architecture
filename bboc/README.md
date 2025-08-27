# Browser-based OAuth 2.0 Client: Auth Architecture

This is a demo of the Browser-based OAuth 2.0 Client architecture pattern, specifically as described in the [OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie") specification draft. This is a serverless architecture; there is no backend and the frontend directly interacts with the authorization server ([FusionAuth](https://fusionauth.io/ "https://fusionauth.io/")). Access tokens are requested by the frontend so the frontend can call the resource server. Access tokens are stored in local app memory and have a short expiry. [Browser-based OAuth 2.0 Client is the least secure](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#section-6.3.3 "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#section-6.3.3") of the three architecture patterns for browser-based apps, and it is even more important to follow [best current practices for OAuth security](https://maida.kim/oauth2-best-practices-for-developers/ "https://maida.kim/oauth2-best-practices-for-developers/").

> [!CAUTION]
> **This architecture is insecure!** You _should not_ use Browser-based OAuth 2.0 Client for any applications that require data protection. **Only use BBOC if your app uses auth for convenience and not for security.** (Examples: usernames to show on a gaming leaderboard, link-sharing apps, an app to create meal plans using a public recipe API, etc.) 
>
> In addition, users will be logged out if they reload the app. This is because the refresh token is stored in app memory, since there is **no way to persist a refresh token securely in the frontend**. To learn more about the security concerns, [check out this video featuring security expert Dr. Philippe De Ryck](https://www.youtube.com/watch?v=2nVYLruX76M).
>
> If you are looking for the ease-of-use of BBOC development with the security of BFF, please refer to the [BFF-HB demo](https://github.com/kmaida/auth-architecture/tree/main/bff-hb) in this repo.

## Architecture Overview

-   **Frontend:** [React](https://react.dev/ "https://react.dev") app with authentication and session management using [FusionAuth OAuth 2.0 endpoints](https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints "https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints") and [TypeScript SDK](https://github.com/FusionAuth/fusionauth-typescript-client "https://github.com/FusionAuth/fusionauth-typescript-client") (this app does not use the FusionAuth React/Angular SDKs because those SDKs use the FusionAuth hosted backend, which is the more secure BFF architecture pattern)
-   **Authorization server:** Self-hosted [FusionAuth](https://fusionauth.io/ "https://fusionauth.io/") running in a Docker container
-   **Resource server:** a cross-origin API that requires authorization, directly called by the frontend app (all three architectures use this same resource server)

## Features

-   Serverless architecture with no backend
-   Frontend user authentication with FusionAuth using OAuth 2.0 Authorization Code flow with PKCE
-   Session persistence with refresh token grant (with short-lived access tokens, refresh token rotation, and proactive session renewal)
-   Frontend calls the resource server with access tokens

## Setup & Installation

### Prerequisites

- [Docker](https://docker.com) (we'll be using `docker compose`) or a Docker Desktop alternative (like [Podman](https://podman.io/) for PC or [Orbstack](https://orbstack.dev/) for Mac)
- [NodeJS](https://nodejs.org) with npm
- FusionAuth instance set up via instructions in the [repo root README](https://github.com/kmaida/auth-architecture/blob/main/README.md#fusionauth) and running at `http://localhost:9011` (login: http://localhost:9011/admin)
- [Resource API server](https://github.com/kmaida/auth-architecture/tree/main/resource-api) running at `http://resource-api.local:5001` (recommended to simulate CORS) or `http://localhost:5001`

### Frontend

1. In your filesystem, open a console in the `auth-architecture/bboc/frontend` folder
2. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
3. Run `npm install`
4. Run `npm run dev` to run the development environment using [Vite](https://vite.dev), accessible in the browser at `http://localhost:5173`

If you have FusionAuth running, you should be able to log into the frontend app with the admin credentials provided in the FusionAuth installation section.

### Concurrent architectures

You will not be able to run multiple architecture demos at the same time because they share ports. If you'd like to run multiple apps at the same time, you must change the ports.

All apps share the same FusionAuth instance, so there is no need to run multiple FusionAuth containers.

## How BBOC Authentication Works

Here are all the steps for authentication in this BBOC example in explicit detail. With this explanation, you should be able to trace the entire authentication lifecycle.

1.  User navigates to the frontend app (since tokens are stored in app memory only, there will never be an access token or refresh token present on a fresh load of the app) and clicks the login button

2.  App calls a `checkSession` function to determine user's authentication state and verify presence or absence of a refresh token in session storage

3.  App prepares for [OAuth 2.0 Authorization Code flow](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1 "https://datatracker.ietf.org/doc/html/rfc6749#section-4.1") with [PKCE](https://datatracker.ietf.org/doc/html/rfc7636 "https://datatracker.ietf.org/doc/html/rfc7636"), generating a `state`, a `code_verifier`, and a hash of the code verifier called a `code_challenge`, which is created with a hashing function called a `code_challenge_method`

4.  App temporarily stores the `state`, `code_verifier`, and `code_challenge` in session storage so it will persist through the redirect to the authorization server and back

5.  App sends an authorization request to the authorization server's ([FusionAuth](https://fusionauth.io/ "https://fusionauth.io/")'s) `/oauth2/authorize` endpoint with the necessary configuration (e.g., `client_id`, `state`, etc.) and the `code_challenge`

6.  Authorization server validates the authorization request, authenticates the user, and redirects to the `/login/callback` page with a code and the same `state` it received with the authorization request

7. App verifies the state the authorization server returned is the same `state` set in PKCE session storage and sent with the authorization request (steps 4 and 5)

8. App sends a token request to the authorization server with the `code` and `code_verifier`

9. Authorization server validates the token request, verifies the `code` is the same `code` it sent in step 9, and uses the `code_challenge_method` to hash the `code_verifier` and recreate a copy of the `code_challenge`

10. Authorization server compares its new `code_challenge` to the app's `code_challenge` (steps 4 and 5) and verifies they are identical

11. Authorization server sends an access token and refresh token to the app

12. App deletes the PKCE session storage, stores the access token and refresh token in app memory, and fetches `userInfo` from the authorization server using the access token

13. App sets a timer to refresh the access token using the refresh token before it expires to provide a seamless user experience since the access token expiration must be short (typically 5-15 minutes) in order to minimize the risk of token theft

14. When the user clicks the Log Out button, the app redirects to the authorization server's `/oauth2/logout` endpoint with appropriate configuration

15. Authorization server logs the user out and redirects to the `/logout/callback` page

16. App deletes all `sessionStorage` and redirects the unauthenticated user to the homepage

## How BBOC External Resource Server Authorization Works

When a user requests data from an external resource server, the app makes a request to the resource server with an `Authorization: Bearer` header. The app should protect routes that require authentication before permitting navigation to the page that will call the secure API. Checks like this improve the user experience.

1.  Authenticated user navigates to a protected app route that calls a secure, external API

2.  App makes a request to the resource API for protected data with `Authorization: Bearer 'accessToken'` as authorization (for example, to the `http://resource-api.local:5001/api/recipe` endpoint)

3.  Resource server verifies the access token in the `Authorization` header and returns data to the app if the token is valid

4.  If the user isn't logged in or there's a problem with the access token, the resource server returns a `401: Unauthorized` error, which is displayed in the app

## Other Auth Architectures

Browser-based OAuth 2.0 client is one of three recommended authentication and authorization architecture choices for browser-based apps. The other two architectures are [Backend-for-Frontend](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff") and [Token-Mediating Backend](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend"). Each architecture has different trade-offs and benefits. Demos of all three architectures are included in this repo.