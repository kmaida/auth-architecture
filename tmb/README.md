# Token-Mediating-Backend Auth Architecture

## Prerequisites

- [Docker](https://docker.com) (we'll be using `docker compose`) or a Docker Desktop alternative (like [Podman](https://podman.io/) for PC or [Orbstack](https://orbstack.dev/) for Mac)
- [NodeJS](https://nodejs.org) with npm
- FusionAuth instance set up via instructions in the [repo root README](https://github.com/kmaida/auth-architecture/blob/main/README.md#fusionauth) and running at `http://localhost:9011` (login: http://localhost:9011/admin)
- [Resource API server](https://github.com/kmaida/auth-architecture/tree/main/resource-api) running at `http://resource-api.local:5001` (recommended to simulate CORS) or `http://localhost:5001`

## Backend

1. In your filesystem, open a console in the `auth-architecture/tmb/backend` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the server and APIs at `http://localhost:4001`

This is a set of APIs; it does not have a browser component.

## Frontend

1. In your filesystem, open a console in the `auth-architecture/tmb/frontend` folder
2. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
3. Run `npm install`
4. Run `npm run dev` to run the development environment using [Vite](https://vite.dev), accessible in the browser at `http://localhost:5173`

If you have the backend and FusionAuth both running, you should be able to log into the frontend app with the admin credentials provided in the FusionAuth installation section.

## Concurrent architectures

You will not be able to run multiple architecture demos at the same time because they share ports. If you'd like to run multiple apps at the same time, you must change the ports.

All apps share the same FusionAuth instance, so there is no need to run multiple FusionAuth containers.