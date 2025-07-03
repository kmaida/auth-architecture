function HomePage() {
  return (
    <>
    <h1 className="hero-title">Token-Mediating Backend</h1>
    <p className="hero-subtitle">Secure Token-Mediating Backend Auth Architecture Demo</p>
    <p>This is a demo of the <strong>Token-Mediating Backend (TMB)</strong> architecture pattern, specifically as described in the <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff" target="_blank">OAuth 2.0 for Browser-Based Applications</a> specification draft. The backend is a confidential client that handles (proxies) authentication requests with the authorization server (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>). It then delivers access tokens to the frontend so the frontend can interact with the resource server. No tokens are exposed to the frontend, preventing JavaScript token theft attacks by using <code>httpOnly</code> session cookies. The frontend never interacts directly with the authorization server. <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-mitigated-attack-scenarios" target="_blank">Token-Mediating Backend is the most secure</a> of the three architecture patterns for browser-based apps.</p>

    <h2>Architecture Overview</h2>
    <ul>
      <li>
        <strong>Frontend:</strong> <a href="https://react.dev" target="_blank">React</a> app (<a href="https://vite.dev" target="_blank">Vite</a>)
      </li>
      <li>
        <strong>Backend:</strong> <a href="https://nodejs.org" target="_blank">Node.js</a> <a href="https://expressjs.com" target="_blank">Express</a> API and server
      </li>
      <li>
        <strong>Authorization server:</strong> Self-hosted <a href="https://fusionauth.io" target="_blank">FusionAuth</a>
      </li>
      <li>
        <strong>Authentication:</strong> <code>/auth</code> API on backend using <a href="https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints" target="_blank">FusionAuth OAuth 2.0 endpoints</a> and <a href="https://github.com/FusionAuth/fusionauth-typescript-client" target="_blank">TypeScript SDK</a>
      </li>
      <li>
        <strong>Authorization:</strong> <code>/api</code> API on the backend is secured by the confidential client
      </li>
    </ul>

    <h2>Features</h2>
    <ul>
      <li>
        User authentication with FusionAuth using OAuth 2.0 Authorization Code flow with PKCE
      </li>
      <li>
        API authorization with FusionAuth through access token verification
      </li>
      <li>
        Authentication API on the backend
      </li>
      <li>
        Session persistence with refresh token grant
      </li>
      <li>
        No tokens exposed to the frontend
      </li> 
    </ul>

    <h2>How BFF Authentication Works</h2>
    <p>Here are all the steps for authentication in this BFF example in explicit detail. With this explanation, you should be able to trace the entire authentication lifecycle through both the backend (where the important stuff takes place) and the frontend (where the user interacts).</p>
    <ol>
      <li>
        User navigates to the frontend app
      </li>
      <li>
        Frontend calls the backend <code>/auth/checksession</code> endpoint with <code>credentials: include</code> to attach cookies, if they exist
      </li>
      <li>
        Backend checks the user's provided credentials (access token cookie and refresh token cookie), and if present, <a href="https://www.youtube.com/shorts/zRY-ElxVa_U" target="_blank">verifies the JSON Web Token access token</a> (these cookies are <code>httpOnly</code>, only the backend can use the contents of the cookie)
      </li>
      <li>
        If verification shows that the access token is expired, the backend checks for a refresh token and initiates a <a href="https://datatracker.ietf.org/doc/html/rfc6749#section-1.5" target="_blank">refresh grant</a> to get new tokens, if possible
      </li>
      <li>
        If the user session and access token are valid and not expired, the user's authenticated state is maintained and they are logged into the frontend app
      </li>
      <li>
        If there are no cookies, the user's session is invalid, and/or there is no refresh token, the backend prepares for an authorization request using <a href="https://datatracker.ietf.org/doc/html/rfc6749#section-4.1" target="_blank">OAuth 2.0 Authorization Code flow</a> with <a href="https://datatracker.ietf.org/doc/html/rfc7636" target="_blank">PKCE</a> by generating a <code>state</code> and...
      </li>
      <li>
        ...a <code>code_verifier</code> and a hash of the code verifier called a <code>code_challenge</code>, which is created by hashing the verifier with a function called a <code>code_challenge_method</code>
      </li>
      <li>
        Backend sets an <code>httpOnly</code> user session cookie with the <code>state</code>, <code>code_verifier</code>, and <code>code_challenge</code>
      </li>
      <li>
        Backend returns a response informing the frontend that the user is not authenticated
      </li>
      <li>
        User clicks the <code>Log In</code> button
      </li>
      <li>
        Frontend sends a request to the backend <code>/auth/login</code> endpoint with appropriate configuration
      </li>
      <li>
        Backend composes an authorization request with the necessary configuration (e.g., <code>client_id</code>, <code>client_secret</code>, <code>state</code>, etc.) and the <code>code_challenge</code>, and sends the request to the authorization server's (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>'s) <code>/oauth2/authorize</code> endpoint
      </li>
      <li>
        Authorization server validates the authorization request, authenticates the user, and redirects to the backend <code>/auth/callback</code> endpoint with a <code>code</code> and the same <code>state</code> it received with the authorization request
      </li>
      <li>
        Backend verifies the <code>state</code> the authorization server returned is the same <code>state</code> the backend sent with the authorization request (steps 6 and 12)
      </li>
      <li>
        Backend sends a token request to the authorization server with the <code>code</code> and <code>code_verifier</code>
      </li>
      <li>
        Authorization server validates the token request, verifies the <code>code</code> is the same <code>code</code> it sent in step 13, and uses the <code>code_challenge_method</code> to hash the <code>code_verifier</code> and recreate a copy of the <code>code_challenge</code>
      </li>
      <li>
        Authorization server compares its new <code>code_challenge</code> to the backend's <code>code_challenge</code> (steps 7 and 12) and verifies they are identical
      </li>
      <li>
        Authorization server sends an access token and refresh token to the backend
      </li>
      <li>
        Backend sets <code>httpOnly</code> cookies for the user's tokens 
      </li>
      <li>
        Backend uses the new access token to authorize a request for <code>userInfo</code> from the authorization server
      </li>
      <li>
        Backend sets the received <code>userInfo</code> in a cookie that is transparent to the frontend (not <code>httpOnly</code>)
      </li>
      <li>
        Backend then redirects the user to the frontend where they are now authenticated
      </li>
      <li>
        Frontend reads the data from the <code>userInfo</code> cookie and uses the information to set user-specific variables, etc.
      </li>
      <li>
        When the user clicks the <code>Log Out</code> button, the frontend sends a request to the backend <code>/auth/logout</code> endpoint
      </li>
      <li>
        Backend sends a request to the authorization server's <code>/oauth2/logout</code> endpoint with appropriate configuration
      </li>
      <li>
        Authorization server logs the user out and redirects to the backend <code>/auth/logout/callaback</code> endpoint
      </li>
      <li>
        Backend clears the cookies and redirects the unauthenticated user to the frontend homepage
      </li>
    </ol>

    <h2>How BFF Authorization Works</h2>
    <p>Fortunately, authorizing access to an API (resource server) is much much simpler and shorter once the authentication piece has taken place. Once the user is logged in, the access token cookie is already present in the browser.</p>
    <ol>
      <li>
        User navigates to a frontend page that calls protected resources
      </li>
      <li>
        Frontend makes a request to the backend API for protected resources with <code>credentials: include</code> to attach cookies (for example, to the <code>/api/protected-data</code> endpoint)
      </li>
      <li>
        Backend uses middleware to verify the JWT access token in the user's token cookie
      </li>
      <li>
        If the user isn't logged in or there's a problem with the access token, the backend checks for a refresh token and executes a refresh grant if possible; otherise, it returns a <code>401: Unauthorized</code> status
      </li>
      <li>
        If the access token is successfully verified (or the user is successfully reauthenticated through the refresh grant), protected data is returned to the frontend
      </li>
    </ol>

    <h2>Other Auth Architectures</h2>
    <p>Backend-for-Frontend is one of three recommended authentication and authorization architecture choices for browser-based apps. The other two architectures are <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend" target="_blank">Token-Mediating Backend</a> and <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie" target="_blank">Browser-based OAuth 2.0 client</a>. Each architecture has different trade-offs and benefits. Demos of both of these architectures are in progress and will be linked once they are available.</p>
    </>
  );
}
export default HomePage;