function HomePage() {
  return (
    <>
    <h1 className="hero-title">Browser-based OAuth 2.0 Client</h1>
    <p className="hero-subtitle">Serverless Frontend Auth Architecture Demo</p>
      <p>This is a demo of the <strong>Browser-based OAuth 2.0 Client</strong> architecture pattern, specifically as described in the <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie" target="_blank">OAuth 2.0 for Browser-Based Applications</a> specification draft. This is a serverless architecture; there is no backend and the frontend directly interacts with the authorization server (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>). Access tokens are requested by the frontend so the frontend can call the resource server. Access tokens are stored in local app memory and have a short expiry. <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#section-6.3.3" target="_blank">Browser-based OAuth 2.0 Client is the least secure</a> of the three architecture patterns for browser-based apps, and it is even more important to follow <a href="https://maida.kim/oauth2-best-practices-for-developers/" target="_blank">best current practices for OAuth security</a>.</p>

    <h2>Architecture Overview</h2>
    <ul>
      <li>
        <strong>Frontend:</strong> <a href="https://react.dev" target="_blank">React</a> app (<a href="https://vite.dev" target="_blank">Vite</a>) with authentication and session management using <a href="https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints" target="_blank">FusionAuth OAuth 2.0 endpoints</a> and <a href="https://github.com/FusionAuth/fusionauth-typescript-client" target="_blank">TypeScript SDK</a> (this app does not use the FusionAuth React SDK because that SDK uses the FusionAuth hosted backend, which is the more secure BFF architecture pattern)
      </li>
      <li>
        <strong>Authorization server:</strong> Self-hosted <a href="https://fusionauth.io" target="_blank">FusionAuth</a> running in a Docker container
      </li>
      <li>
        <strong>Resource server:</strong> a cross-origin API that requires authorization, directly called by the frontend app (all three architectures use this same resource server)
      </li>
    </ul>

    <h2>Features</h2>
    <ul>
      <li>
        Serverless architecture with no backend
      </li>
      <li>
        Frontend user authentication with FusionAuth using OAuth 2.0 Authorization Code flow with PKCE
      </li>
      <li>
        Session persistence with refresh token grant (with short-lived access tokens, refresh token rotation, and proactive session renewal)
      </li>
      <li>
        Frontend calls the resource server with access tokens
      </li>
    </ul>

    <h2>How BBOC Authentication Works</h2>
    <p>Here are all the steps for authentication in this BBOC example in explicit detail. With this explanation, you should be able to trace the entire authentication lifecycle.</p>
    <ol>
      <li>
        User navigates to the frontend app (since the access token is stored in app memory only, there will never be an access token present on a fresh load of the app)
      </li>
      <li>
        App calls a <code>checkSession</code> function to determine user's authentication state and verify presence or absence of a refresh token in session storage
      </li>
      <li>
        If a refresh token is present, a <a href="https://datatracker.ietf.org/doc/html/rfc6749#section-1.5" target="_blank">refresh grant</a> is initiated to use the refresh token to get a new access token, new refresh token, and fetch user information
      </li>
      <li>
        If the refresh grant succeeds, the user's authenticated state is restored and they are logged into the app
      </li>
      <li>
        If not authenticated through refresh automatically, user clicks the <code>Log In</code> button
      </li>
      <li>
        App prepares for <a href="https://datatracker.ietf.org/doc/html/rfc6749#section-4.1" target="_blank">OAuth 2.0 Authorization Code flow</a> with <a href="https://datatracker.ietf.org/doc/html/rfc7636" target="_blank">PKCE</a>, generating a <code>state</code>, a <code>code_verifier</code>, and a hash of the code verifier called a <code>code_challenge</code>, which is created with a hashing function called a <code>code_challenge_method</code>
      </li>
      <li>
        App temporarily stores the <code>state</code>, <code>code_verifier</code>, and <code>code_challenge</code> in session storage so it will persist through the redirect to the authorization server and back
      </li>
      <li>
        App sends an authorization request to the authorization server's (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>'s) <code>/oauth2/authorize</code> endpoint with the necessary configuration (e.g., <code>client_id</code>, <code>state</code>, etc.) and the <code>code_challenge</code> 
      </li>
      <li>
        Authorization server validates the authorization request, authenticates the user, and redirects to the <code>/login/callback</code> page with a <code>code</code> and the same <code>state</code> it received with the authorization request
      </li>
      <li>
        App verifies the <code>state</code> the authorization server returned is the same <code>state</code> set in PKCE session storage and sent with the authorization request (steps 6 and 8)
      </li>
      <li>
        App sends a token request to the authorization server with the <code>code</code> and <code>code_verifier</code>
      </li>
      <li>
        Authorization server validates the token request, verifies the <code>code</code> is the same <code>code</code> it sent in step 9, and uses the <code>code_challenge_method</code> to hash the <code>code_verifier</code> and recreate a copy of the <code>code_challenge</code>
      </li>
      <li>
        Authorization server compares its new <code>code_challenge</code> to the app's <code>code_challenge</code> (steps 6 and 8) and verifies they are identical
      </li>
      <li>
        Authorization server sends an access token and refresh token to the app
      </li>
      <li>
        App deletes the PKCE session storage, stores the access token in app memory, sets the refresh token in localStorage, and fetches <code>userInfo</code> from the authorization server using the access token
      </li>
      <li>
        App sets a timer to refresh the access token using the refresh token before it expires to provide a seamless user experience since the access token expiration must be short (typically 5-15 minutes) in order to minimize the risk of token theft
      </li>
      <li>
        When the user clicks the <code>Log Out</code> button, the app redirects redirects to the authorization server's <code>/oauth2/logout</code> endpoint with appropriate configuration
      </li>
      <li>
        Authorization server logs the user out and redirects to the <code>/logout/callback</code> page
      </li>
      <li>
        App deletes all session and local storage and redirects the unauthenticated user to the homepage
      </li>
    </ol>

    <h2>How BBOC External Resource Server Authorization Works</h2>
    <p>When a user requests data from an external resource server, the app makes a request to the resource server with an <code>Authorization: Bearer</code> header. The app should protect routes that require authentication before permitting navigation to the page that will call the secure API. Checks like this improve the user experience.</p>
    <ol>
      <li>
        Authenticated user navigates to a protected app route that calls a secure, external API
      </li>
      <li>
        App makes a request to the resource API for protected data with <code>Authorization: Bearer 'accessToken'</code> as authorization (for example, to the <code>http://resource-api.local:5001/api/recipe</code> endpoint)
      </li>
      <li>
        Resource server verifies the access token in the <code>Authorization</code> header and returns data to the app if the token is valid
      </li>
      <li>
        If the user isn't logged in or there's a problem with the access token, the resource server returns a <code>401: Unauthorized</code> error, which is displayed in the app
      </li>
    </ol>

    <h2>Other Auth Architectures</h2>
    <p>Browser-based OAuth 2.0 client is one of three recommended authentication and authorization architecture choices for browser-based apps. The other two architectures are <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff" target="_blank">Backend-for-Frontend</a> and <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend" target="_blank">Token-Mediating Backend</a>. Each architecture has different trade-offs and benefits. Demos of all three architectures are included in this repo.</p>
    </>
  );
}
export default HomePage;