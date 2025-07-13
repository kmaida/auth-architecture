function HomePage() {
  return (
    <>
      <h1 className="hero-title">Serverless with FusionAuth BFF</h1>
      <p className="hero-subtitle">Hosted Backend Auth Architecture Demo</p>
      <p>This is a demo of an architecture with an <strong>auth Backend-for-Frontend and a Single-Page App</strong>. This is a serverless architecture; there is no backend and the frontend directly interacts with the authorization server (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>).</p>

    <h2>Architecture Overview</h2>
    <ul>
      <li>
          <strong>Frontend:</strong> <a href="https://react.dev" target="_blank">React</a> app (<a href="https://vite.dev" target="_blank">Vite</a>) with Authorization Code flow with PKCE authentication and session management using <a href="https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints" target="_blank">FusionAuth</a> and the <a href="https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-react" target="_blank">React SDK</a> (which uses the <a href="https://fusionauth.io/docs/apis/hosted-backend" target="_blank">FusionAuth Hosted Backend</a>)
      </li>
      <li>
        <strong>Authorization server:</strong> Self-hosted <a href="https://fusionauth.io" target="_blank">FusionAuth</a> running in a Docker container
      </li>
      <li>
        <strong>Proxied resource server:</strong> an external API that requires authorization, called from the frontend using a proxy to support cookies (all three architectures use this same resource server)
      </li>
    </ul>

    <h2>Features</h2>
    <ul>
      <li>
        Severless architecture with no backend
      </li>
      <li>
          Frontend user authentication with FusionAuth using OAuth 2.0 Authorization Code flow with PKCE (via <a href="https://fusionauth.io/docs/apis/hosted-backend" target="_blank">FusionAuth Hosted Backend</a>)
      </li>
      <li>
          Short-lived access tokens, refresh token rotation, and proactive session renewal via the <a href="https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-react" target="_blank">FusionAuth React SDK</a>
      </li>
      <li>
        Frontend calls the proxied resource server with cookies
      </li>
    </ul>

    <h2>How BFF-HB Authentication Works</h2>
    <p>Here are the steps for authentication in this BFF-HB example. Most of the authentication lifecycle is handled by the <a href="https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-react" target="_blank">FusionAuth React SDK</a> and <a href="https://fusionauth.io/docs/apis/hosted-backend" target="_blank">Hosted Backend</a>.</p>
    <ol>
      <li>
        User navigates to the frontend app
      </li>
      <li>
        SDK checks if the user is logged in and if so, restores the user's authenticated state (this does not require any additional code)
      </li>
      <li>
        If not authenticated, user clicks the <code>Log In</code> button
      </li>
      <li>
        SDK redirects the user to the authorization server's <code>/oauth2/authorize</code> endpoint with appropriate configuration
      </li>
      <li>
        User authenticates and SDK manages the PKCE code flow exchange behind the scenes
      </li>
      <li>
        Authorization server sets <code>httpOnly</code> cookies for the access token, refresh token (requires <code>offline_access</code> scope), ID token (requires <code>openid</code> scope), and access token expiration
      </li>
      <li>
          If configured with <code>shouldAutoRefresh: true</code>, SDK manages proactive session renewal and refreshes the access token before it expires
      </li>
      <li>
        When the user clicks the <code>Log Out</code> button, the SDK redirects to the authorization server's <code>/oauth2/logout</code> endpoint with appropriate configuration
      </li>
      <li>
        Authorization server logs the user out and redirects to the frontend home page
      </li>
      <li>
        SDK deletes cookies and user is unauthenticated
      </li>
    </ol>

    <h2>How BBOC External Resource Server Authorization Works</h2>
    <p>Cookies only work on the same domain. Therefore, cross-domain requests are proxied to the API. The app makes a request to the API proxy with <code>include: 'credentials'</code> to attach cookies. The app should protect routes that require authentication before permitting navigation to the page that will call the secure API. Checks like this improve the user experience.</p>
    <ol>
      <li>
        Authenticated user navigates to a protected app route that calls a secure, external API proxy
      </li>
      <li>
          App makes a request to the resource API for protected data with <code>include: 'credentials'</code> to attach the access token cookie (<code>app.at</code>) as authorization (for example, to the <code>http://localhost:5173/api/recipe</code> proxy endpoint)
      </li>
      <li>
        Resource server verifies the access token in the <code>app.at</code> cookie and returns data to the app if the token is valid
      </li>
      <li>
        If the user isn't logged in or there's a problem with the access token, the resource server returns a <code>401: Unauthorized</code> error, which is displayed in the app
      </li>
    </ol>

    <h2>Other Auth Architectures</h2>
      <p>FusionAuth provides a hosted backend for browser-based apps that serves as an authentication Backend-for-Frontend. This is an easy-to-implement serverless architecture. The three recommended authentication and authorization architecture choices for browser-based apps are <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff" target="_blank">Backend-for-Frontend</a>, <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend" target="_blank">Token-Mediating Backend</a>, and <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie" target="_blank">OAuth 2.0 for Browser-Based Applications</a>. Each architecture has different trade-offs and benefits. Demos of all three architectures are included in this repo.</p>
    </>
  );
}
export default HomePage;