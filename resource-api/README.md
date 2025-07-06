# External Resource API

This folder contains a resource API that should be called by all of the architecture demos (BFF, TMB, and BBOC). It represents an external resource server that does not share an origin with FusionAuth or with any of the application architectures.

The API only has one endpoint (`/api/recipe`) which is secured with `Authorization` header access tokens. It returns a randomly-generated recipe in a JSON response.

## Installation

1. In your filesystem, open a console in the `auth-architecture/resource-api` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the resource server at `http://localhost:5001`

This is a resource API; it does not have a browser component.