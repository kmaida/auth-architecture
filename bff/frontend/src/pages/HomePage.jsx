function HomePage() {
  return (
    <>
    <h1 className="hero-title">Backend-for-Frontend</h1>
    <p className="hero-subtitle">Secure Backend-for-Frontend Auth Architecture Demo</p>
    <p>This is a demo of the <strong>Backend-for-Frontend (BFF)</strong> architecture pattern, specifically as described in the <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff" target="_blank">OAuth 2.0 for Browser-Based Applications</a> specification draft. The backend is a confidential client that handles (proxies) all of the authentication and authorization interactions with the authorization server (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>) and resource server. No tokens are exposed to the frontend, preventing JavaScript token theft attacks by using <code>httpOnly</code> session cookies. The frontend never interacts directly with the authorization server. <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-mitigated-attack-scenarios" target="_blank">Backend-for-Frontend is the most secure</a> of the three architecture patterns for browser-based apps.</p>

    <h2>Architecture Overview</h2>
    <ul>
      <li>
        <strong>Frontend:</strong> <a href="https://react.dev" target="_blank">React</a> app (<a href="https://vite.dev" target="_blank">Vite</a>)
      </li>
      <li>
        <strong>Backend:</strong> <a href="https://nodejs.org" target="_blank">Node.js</a> <a href="https://expressjs.com" target="_blank">Express</a> API and server
      </li>
      <li>
        <strong>Authorization server:</strong> Self-hosted <a href="https://fusionauth.io" target="_blank">FusionAuth</a> running in a Docker container
      </li>
      <li>
          <strong>Authentication:</strong> <code>/auth</code> API on backend using <a href="https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints" target="_blank">FusionAuth OAuth 2.0 endpoints</a>, <a href="https://github.com/FusionAuth/fusionauth-typescript-client" target="_blank">TypeScript SDK</a>, and in-memory cache management for session storage (recommend Redis for production)
      </li>
      <li>
        <strong>Authorization:</strong> <code>/api</code> local API on the backend verifies the access token in the user's stored session before allowing access to protected resources
      </li>
      <li>
        <strong>Resource server:</strong> a cross-origin API that requires authorization, directly called by the frontend app (all three architectures use this same resource server)
      </li>
    </ul>

    <h2>Features</h2>
    <ul>
      <li>
        User authentication with FusionAuth using OAuth 2.0 Authorization Code flow with PKCE
      </li>
      <li>
        Local API on the backend with FusionAuth authorization through access token verification
      </li>
      <li>
        Authentication API on the backend
      </li>
      <li>
        Session management with <code>httpOnly</code> session ID cookies and lookup using server-side session storage cache
      </li>
      <li>
        Session persistence with refresh token grant on the backend and proactive session renewal
      </li>
      <li>
        No tokens are ever exposed to the frontend
      </li> 
    </ul>

    <h2>How BFF Authentication Works</h2>
    <p>Here are all the steps for authentication in this BFF example in explicit detail. With this explanation, you should be able to trace the entire authentication lifecycle through both the backend (where the important stuff takes place) and the frontend (where the user interacts).</p>
    <ol>
      <li>
        User navigates to the frontend app
      </li>
      <li>
        Frontend calls the backend <code>/auth/checksession</code> endpoint with <code>credentials: include</code> to attach the session cookie, if it exists
      </li>
      <li>
        If present, backend uses the session ID cookie to look up user's session, which stores secure credentials (access token and refresh token), then <a href="https://www.youtube.com/shorts/zRY-ElxVa_U" target="_blank">verifies the JSON Web Token access token</a> (the session cookie is <code>httpOnly</code>, only the backend can use the contents of the cookie)
      </li>
      <li>
        If verification shows that the access token is expired, the backend checks for a refresh token and initiates a <a href="https://datatracker.ietf.org/doc/html/rfc6749#section-1.5" target="_blank">refresh grant</a> to get new tokens, if possible
      </li>
      <li>
        If the FusionAuth user session and access token are valid and not expired, the user's authenticated state is restored and they are logged into the frontend app
      </li>
      <li>
        If there is no session cookie, the user's session is invalid, and/or if there is no refresh token, the backend prepares for an authorization request using <a href="https://datatracker.ietf.org/doc/html/rfc6749#section-4.1" target="_blank">OAuth 2.0 Authorization Code flow</a> with <a href="https://datatracker.ietf.org/doc/html/rfc7636" target="_blank">PKCE</a> by generating a <code>state</code> and...
      </li>
      <li>
        ...a <code>code_verifier</code> and a hash of the code verifier called a <code>code_challenge</code>, which is created by hashing the verifier with a function called a <code>code_challenge_method</code>
      </li>
      <li>
        Backend sets an <code>httpOnly</code> PKCE cookie with the <code>state</code>, <code>code_verifier</code>, and <code>code_challenge</code> to tie this login attempt to this user (a backend user session is not created until after successful login)
      </li>
      <li>
        Backend returns a response informing the frontend that the user is not authenticated
      </li>
      <li>
        User clicks the <code>Log In</code> button
      </li>
      <li>
        Frontend redirects to the backend <code>/auth/login</code> endpoint
      </li>
      <li>
        Backend generates an authorization request with the necessary configuration (e.g., <code>client_id</code>, <code>client_secret</code>, <code>state</code>, etc.) and the <code>code_challenge</code>, and sends the request to the authorization server's (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>'s) <code>/oauth2/authorize</code> endpoint
      </li>
      <li>
        Authorization server validates the authorization request, authenticates the user, and redirects to the backend <code>/auth/callback</code> endpoint with a <code>code</code> and the same <code>state</code> it received with the authorization request
      </li>
      <li>
        Backend verifies the <code>state</code> the authorization server returned is the same <code>state</code> the backend set in the PKCE cookie and sent with the authorization request (steps 6 and 12)
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
        Backend deletes the PKCE cookie, generates a session ID, and stores the user's tokens and <code>userInfo</code> in a backend session (in-memory in this example, but I recommend Redis for production).
      </li>
      <li>
        Backend sets an <code>httpOnly</code> cookie for the user's session ID (this only contains the session ID, never tokens)
      </li>
      <li>
        Backend <code>/auth/callback</code> redirects to the frontend
      </li>
      <li>
        Frontend runs <code>checkSession</code>, confirms authentication state, fetches <code>userInfo</code>, and uses the information to set user-specific variables, etc.
      </li>
      <li>
        When the user clicks the <code>Log Out</code> button, the frontend redirects to the backend <code>/auth/logout</code> endpoint
      </li>
      <li>
        Backend redirects to the authorization server's <code>/oauth2/logout</code> endpoint with appropriate configuration
      </li>
      <li>
        Authorization server logs the user out and redirects to the backend <code>/auth/logout/callback</code> endpoint
      </li>
      <li>
        Backend deletes the server-side user session, clears all cookies, and redirects the unauthenticated user to the frontend homepage
      </li>
    </ol>

    <h2>How BFF Local API Authorization Works</h2>
    <p>When a user requests access to secure data, the backend authorizes access to an API (resource server). The frontend should protect routes that require authentication by checking the session before permitting navigation to the page that will call the secure API. Frontend checks like this improve the user experience.</p>
    <ol>
      <li>
        Authenticated user navigates to a protected frontend route that calls a secure, local API
      </li>
      <li>
        Frontend makes a request to the backend API for protected resources with <code>credentials: include</code> to attach the session cookie (for example, to the <code>/api/protected-data</code> endpoint)
      </li>
      <li>
        Backend uses middleware to use the provided session cookie (containing the session ID) to look up the user's server-side session, retrieve their JWT access token, and verify it
      </li>
      <li>
        If the user isn't logged in or there's a problem with the session ID or access token, the backend checks for a refresh token and executes a refresh grant if possible; otherwise, it returns a <code>401: Unauthorized</code> status
      </li>
      <li>
        If the access token is successfully verified (or the user is successfully reauthenticated through the refresh grant), protected data is returned to the frontend
      </li>
    </ol>

    <h2>How BFF External Resource Server Authorization Works</h2>
    <p>When a user requests data from an external resource server, the backend proxies the request, adding an <code>Authorization: Bearer</code> header before sending the request to an API (resource server). The frontend should protect routes that require authentication by checking the session before permitting navigation to the page that will call the secure API. Frontend checks like this improve the user experience.</p>
    <ol>
      <li>
        Authenticated user navigates to a protected frontend route that calls a secure API
      </li>
      <li>
        Frontend makes a request to the backend API for protected resources with <code>credentials: include</code> to attach the session cookie
      </li>
      <li>
        Backend uses middleware to attach the access token to a request to the resource server, which is a cross-origin API that requires authorization
      </li>
      <li>
        Resource server verifies the access token in the <code>Authorization</code> header and returns data to the frontend if the token is valid
      </li>
      <li>
        If the user isn't logged in or there's a problem with the access token, the resource server returns a <code>401: Unauthorized</code> error, which is displayed in the frontend
      </li>
    </ol>

    <h2>Other Auth Architectures</h2>
    <p>Backend-for-Frontend is one of three recommended authentication and authorization architecture choices for browser-based apps. The other two architectures are <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend" target="_blank">Token-Mediating Backend</a> and <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-browser-based-oauth-20-clie" target="_blank">Browser-based OAuth 2.0 client</a>. Each architecture has different trade-offs and benefits. Demos of all three architectures are included in this repo.</p>
    </>
  );
}
export default HomePage;