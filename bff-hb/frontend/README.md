# Backend-for-Frontend - FusionAuth Hosted Backend: Frontend

1. In your filesystem, open a console in the `auth-architecture/bff-hb/frontend` folder
2. Remove the `.sample` suffix from `.env.sample` (no changes are needed to this sample file)
3. Run `npm install`
4. Run `npm run dev` to run the development environment using [Vite](https://vite.dev), accessible in the browser at `http://localhost:5173`

If you have the FusionAuth container running, you should be able to log into the frontend app with the admin credentials provided in the FusionAuth installation section.

This demo uses [Vite to set up a proxy](https://github.com/kmaida/auth-architecture/blob/main/bff-hb/frontend/vite.config.js#L9) for requests to the external `resource-api` in order to use cookies (requires same origin) to access the API.
