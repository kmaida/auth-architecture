# Auth Architecture

## Prerequisites

- [Docker](https://docker.com) (we'll be using `docker compose`) or a Docker Desktop alternative (like [Podman](https://podman.io/) for PC or [Orbstack](https://orbstack.dev/) for Mac)
- [Node.js](https://nodejs.org) 

## Installation

Clone this repo.

### FusionAuth

1. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
2. From the cloned `auth-architecture` root folder, run: `docker compose up -d`
3. FusionAuth will be installed in a Docker container and will use the included `kickstart.json` to set the appropriate FusionAuth configuration for use with this repo
4. Verify that FusionAuth is installed and configured properly by navigating to `http://localhost:9011/admin`
5. If you get a login screen, the kickstart was successful
6. Log in with the admin credentials: `admin@example.com` / `password`
7. In the FusionAuth dashboard, go to Applications and make sure there are two apps: "Auth Architecture" and "FusionAuth"

### Architecture

Use the READMEs in each architecture folder for instructions on setting up each architecture.

#### Concurrent architectures

You will not be able to run multiple architecture demos at the same time because they share ports. If you'd like to run multiple apps at the same time, you must change the ports.

All apps share the same FusionAuth instance, so there is no need to run multiple FusionAuth containers.