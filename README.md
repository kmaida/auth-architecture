# FusionAuth Backend-for-Frontend Auth Architecture

## Prerequisites

- [Docker](https://docker.com) (we'll be using `docker compose`) or a Docker Desktop alternative (like [Podman](https://podman.io/) for PC or [Orbstack](https://orbstack.dev/) for Mac)
- [NodeJS](https://nodejs.org) with npm

## Installation

First clone this repo.

### FusionAuth

1. Clone the repo
2. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
3. From the cloned `auth-architecture` root folder, run: `docker compose up -d`
4. FusionAuth will be installed in a Docker container and will use the included `kickstart.json` to set the appropriate FusionAuth configuration for use with this repo
5. Verify that FusionAuth is installed and configured properly by navigating to `http://localhost:9011/admin`
6. If you get a login screen, the kickstart was successful
7. Log in with the admin credentials: `admin@example.com` / `password`
8. In the FusionAuth dashboard, go to Applications and make sure there are two apps: "Auth Architecture" and "FusionAuth"

### Backend-for-Frontend (BFF)

#### Backend

1. In your filesystem, open a console in the `bff/backend` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the server and API at `http://localhost:4001`

This is an API; it does not have a browser component.

#### Frontend

1. In your filesystem, open a console in the `bff/frontend` folder
2. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
3. Run `npm install`
4. Run `npm run dev` to run the development environment using Vite, accessible in the browser at `http://localhost:5173`

The only part of this architecture that is accessible in the browser is the frontend. You should be able to log into the frontend app with the admin credentials provided in the FusionAuth installation section.