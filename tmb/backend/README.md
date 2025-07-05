# Token-Mediating Backend: Backend

1. In your filesystem, open a console in the `auth-architecture/tmb/backend` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the server and APIs at `http://localhost:4001`

This is a set of APIs; it does not have a browser component.

## In-memory session storage

This demo uses in-memory cache ([cache-manager](https://www.npmjs.com/package/cache-manager)) to store user sessions. That means restarting the Node server will cause a user's server-side session to be cleared. Since you will likely be restarting the server often during development, you may find authentication state appears to get un-synced between the backend and frontend. Keep this in mind when debugging, because it can throw you off if you think it's being caused by a coding error (it's not).

In-memory cache was used in the demo for simplicity. However, [cache-manager](https://www.npmjs.com/package/cache-manager) is a package of [Cacheable](https://github.com/jaredwray/cacheable), and is compatible with any [Keyv](https://keyv.org/) storage adapter. That means you do not need to redo session storage from scratch if/when you need to use a database.

## Cookie security

In the default development environment (`.env`: `ENVIRONMENT="dev"`), cookies are set without the `secure` attribute, and have generic names. This is because the development environment runs on `localhost`. In a production environment (`.env`: `ENVIRONMENT="prod"`) cookie settings are more strict.

On production, sensitive cookie names are [prefixed with `__host-`](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-20#section-4.1.3.2) to indicate they are:

- `secure: true` Cookie will only be sent over secure channel (`https`)
- `httpOnly: true` Cookie cannot be accessed by client-side JavaScript
- `sameSite: "strict"` Cookie will only be sent on the same site that created it
- `path: "/"` Cookie can be used anywhere on this site
- No `domain` Cookie's domain is the domain of the request (will block subdomains)

The cookie best practices for TMB auth architecture are the same as [cookie best practices for Backend-for-Frontend](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#pattern-bff-cookie-security). To learn more about cookies, see the [Cookies: HTTP State Management Mechanism](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-20) specification draft.

These settings mean that if you try to run `prod` on `localhost`, the cookies will not work. If you run `dev` in production, the cookies will not be as secure as they should be, and will not adhere to BFF auth security best practices.