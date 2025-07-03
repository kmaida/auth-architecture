# Token-Mediating-Backend Auth Architecture

## Prerequisites

- [Docker](https://docker.com) (we'll be using `docker compose`) or a Docker Desktop alternative (like [Podman](https://podman.io/) for PC or [Orbstack](https://orbstack.dev/) for Mac)
- [NodeJS](https://nodejs.org) with npm
- FusionAuth instance set up via instructions in the [root README](https://github.com/kmaida/auth-architecture/blob/main/README.md#fusionauth)

## Backend

1. In your filesystem, open a console in the `tmb/backend` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the server and API at `http://localhost:4001`

This is an API; it does not have a browser component.

## Frontend

1. In your filesystem, open a console in the `tmb/frontend` folder
2. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
3. Run `npm install`
4. Run `npm run dev` to run the development environment using Vite, accessible in the browser at `http://localhost:5173`

The only part of this architecture that is accessible in the browser is the frontend. You should be able to log into the frontend app with the admin credentials provided in the FusionAuth installation section.