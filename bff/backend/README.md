# Backend-for-Frontend - Backend

1. In your filesystem, open a console in the `auth-architecture/bff/backend` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the server and APIs at `http://localhost:4001`

This is a set of APIs; it does not have a browser component.

## In-memory session storage

This demo uses in-memory cache ([cache-manager](https://www.npmjs.com/package/cache-manager)) to store user sessions. That means restarting the Node server will cause a user's server-side session to be cleared. Since you will likely be restarting the server often during development, you may find authentication state appears to get un-synced between the backend and frontend. Keep this in mind when debugging, because it can throw you off if you think it's being caused by a coding error (it's not).

In-memory cache was used in the demo for simplicity. However, [cache-manager](https://www.npmjs.com/package/cache-manager) is a package of [Cacheable](https://github.com/jaredwray/cacheable), and is compatible with any [Keyv](https://keyv.org/) storage adapter. That means you do not need to start over from scratch if/when you need to use a database for session storage.