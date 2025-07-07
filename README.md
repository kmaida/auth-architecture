# Auth Architecture

This repo contains a set of apps demonstrating different auth architectures and a <a href="https://fusionauth.io">FusionAuth</a> Docker container with configuration (called a `kickstart`).

- Backend-for-Frontend (BFF) [spec](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff)
- Token-Mediating Backend (TMB) [spec](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend)
- Browser-based OAuth 2.0 client (BBOC) [spec](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie)
- Resource API

## Prerequisites

- [Docker](https://docker.com) (for use of `docker compose`) or a Docker Desktop alternative (like [Podman](https://podman.io/) for PC or [Orbstack](https://orbstack.dev/) for Mac)
- [Node.js](https://nodejs.org)

## Installation

1. Clone this repo
2. Remove the `.sample` suffix from `.env.sample` (and make the changes mentioned in the file)
3. From the cloned `auth-architecture` root folder, run: `docker compose up -d`
4. FusionAuth will be installed in a Docker container and will use the included `kickstart.json` to set the appropriate FusionAuth configuration for use with this repo
5. Verify that FusionAuth is installed and configured properly by navigating to `http://localhost:9011/admin`
6. If you get a login screen at `http://localhost:9011/admin`, the kickstart was successful
7. Log in with the admin credentials: `admin@example.com` / `password`
8. In the FusionAuth dashboard, go to Applications and make sure there are three apps: `Auth Architecture (BFF & TMB)`, `Auth Architecture (BBOC)`, and `FusionAuth`

## Architecture

Use the READMEs in each architecture folder (`/bff`, `/tmb`, `/bboc`) for instructions on setting up that architecture. All demos use one FusionAuth instance. 

### Concurrent architectures

You will not be able to run multiple architecture demos at the same time because they share ports. If you'd like to run multiple apps at the same time, you must change the ports.

All apps share the same FusionAuth instance, so there is no need to run multiple FusionAuth containers.

## Resource API

Use the README in the `/resource-api` folder for setup instructions.