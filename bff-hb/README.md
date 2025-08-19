# Backend-for-Frontend with FusionAuth Hosted Backend: Auth Architecture

This is a demo of an architecture with a hosted auth Backend-for-Frontend and a Single-Page App. This is a serverless architecture; there is no need to build your own backend app. The frontend directly interacts with the authorization server ([FusionAuth](https://fusionauth.io/ "https://fusionauth.io/")) with the convenience and development ease of [BBOC](https://github.com/kmaida/auth-architecture/tree/main/bboc) and the security of [BFF](https://github.com/kmaida/auth-architecture/tree/main/bff).

## Architecture Overview

-   **Frontend:** [React](https://react.dev/ "https://react.dev") app with Authorization Code flow with PKCE authentication and session management using [FusionAuth](https://fusionauth.io/ "https://fusionauth.io/") and the [Angular SDK](https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-angular "https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-angular") (which uses the [FusionAuth Hosted Backend](https://fusionauth.io/docs/apis/hosted-backend "https://fusionauth.io/docs/apis/hosted-backend"))
-   **Authorization server:** Self-hosted [FusionAuth](https://fusionauth.io/ "https://fusionauth.io/") running in a Docker container
-   **Proxied resource server:** an external API that requires authorization, called from the frontend using a proxy to support cookies (all three architectures use this same resource server)

## Features

-   Serverless architecture with no backend
-   Frontend user authentication with FusionAuth using OAuth 2.0 Authorization Code flow with PKCE (via [FusionAuth Hosted Backend](https://fusionauth.io/docs/apis/hosted-backend "https://fusionauth.io/docs/apis/hosted-backend"))
-   Short-lived access tokens, refresh token rotation, and proactive session renewal via the [FusionAuth Angular SDK](https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-angular "https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-angular")
-   Frontend calls the proxied resource server with cookies

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

## How BFF-HB Authentication Works

Here are the steps for authentication in this BFF-HB example. Most of the authentication lifecycle is handled by the [FusionAuth React SDK](https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-react "https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-react") and [Hosted Backend](https://fusionauth.io/docs/apis/hosted-backend "https://fusionauth.io/docs/apis/hosted-backend").

1.  User navigates to the frontend app

2.  SDK checks if the user is logged in and if so, restores the user's authenticated state (this does not require any additional code)

3.  If not authenticated, user clicks the Log In button

4.  SDK redirects the user to the authorization server's `/oauth2/authorize` endpoint with appropriate configuration

5.  User authenticates and SDK manages the PKCE code flow exchange behind the scenes

6.  Authorization server sets `httpOnly` cookies for the access token, refresh token (requires `offline_access` scope), ID token (requires `openid` scope), and access token expiration

7.  If configured with `shouldAutoRefresh: true`, SDK manages proactive session renewal and refreshes the access token before it expires

8.  When the user clicks the Log Out button, the SDK redirects to the authorization server's `/oauth2/logout` endpoint with appropriate configuration

9.  Authorization server logs the user out and redirects to the frontend home page

10. SDK deletes cookies and user is logged out

## How BBOC External Resource Server Authorization Works

Cookies only work on the same domain. Therefore, cross-domain requests are proxied to the API. The app makes a request to the API proxy with `include: 'credentials'` to attach cookies. The app should protect routes that require authentication before permitting navigation to the page that will call the secure API. Checks like this improve the user experience.

1.  Authenticated user navigates to a protected app route that calls a secure, external API proxy

2.  App makes a request to the resource API for protected data with `include: 'credentials'` to attach the access token cookie (`app.at`) as authorization (for example, to the `http://localhost:4200/api/recipe` proxy endpoint)

3.  Resource server verifies the access token in the `app.at` cookie and returns data to the app if the token is valid

4.  If the user isn't logged in or there's a problem with the access token, the resource server returns a `401: Unauthorized` error, which is displayed in the app

## Other Auth Architectures

FusionAuth provides a hosted backend for browser-based apps that serves as an authentication Backend-for-Frontend. This is an easy-to-implement serverless architecture. The three recommended authentication and authorization architecture choices for browser-based apps are [Backend-for-Frontend](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff"), [Token-Mediating Backend](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend"), and [OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie"). Each architecture has different trade-offs and benefits. Demos of all three architectures are included in this repo.