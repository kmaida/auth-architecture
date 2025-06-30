function HomePage() {
  return (
    <>
    <h1>Backend-for-Frontend Auth</h1>
    <p>This is a demo of the <strong>Backend-for-Frontend (BFF)</strong> architecture pattern, specifically as described in the <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff" target="_blank">OAuth 2.0 for Browser-Based Applications</a> specification draft. The backend is a confidential client that handles all of the authentication and authorization interactions with the authorization server. No tokens are exposed to the frontend, preventing JavaScript token theft attacks through the use of <code>HttpOnly</code> session cookies.</p>

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
        <strong>Authentication:</strong> <code>/auth</code> API on backend using <a href="https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints" target="_blank">FusionAuth OAuth 2.0 endpoints</a>
      </li>
      <li>
        <strong>Authorization:</strong> <code>/api</code> API on the backend is secured by the confidential client
      </li>
    </ul>

    <h2>How it Works</h2>
    <ol>
      <li>
        User navigates to the frontend app
      </li>
      <li>
        Frontend calls the backend <code>/auth/checksession</code> endpoint with <code>credentials: include</code> to attach cookies, if they exist
      </li>
      <li>
        Backend checks the user's provided credentials (access token cookie and session cookie), and if present, verifies the JSON Web Token access token (because cookies are <code>HttpOnly</code>, only the backend can use the contents of the cookie)
      </li>
      <li>
        If the user session and access token are valid and not expired, the user's authenticated state is maintained and they are logged into the frontend app
      </li>
      <li>
        If there are no cookies or the user's session has expired, the backend prepares for an authorization request using <a href="https://datatracker.ietf.org/doc/html/rfc6749#section-4.1" target="_blank">OAuth 2.0 Authorization Code flow</a> with <a href="https://datatracker.ietf.org/doc/html/rfc7636" target="_blank">PKCE</a> by generating a <code>state</code> and...
      </li>
      <li>
        ...a <code>code_verifier</code> and a hash of the code verifier called a <code>code_challenge</code>, which is created by hashing the verifier with a function called a <code>code_challenge_method</code>
      </li>
      <li>
        Backend returns a response informing the frontend that the user is not authenticated
      </li>
      <li>
        User clicks the <code>Log In</code> button
      </li>
      <li>
        Frontend sends a request to the backend <code>/auth/login</code> endpoint
      </li>
      <li>
        Backend composes an authorization request with the necessary configuration (e.g., <code>client_id</code>, <code>client_secret</code>, <code>state</code>, etc.) and the <code>code_challenge</code>, and sends the request to FusionAuth's <code>oauth2/authorize</code> endpoint
      </li>
      <li>
        FusionAuth validates the authorization request, authenticates the user, and redirects to the backend <code>/auth/callback</code> endpoint with a <code>code</code> and the same <code>state</code> it received with the authorization request
      </li>
      <li>
        Backend verifies the <code>state</code> FusionAuth returned is the same <code>state</code> the backend sent with the authorization request (steps 4 and 9)
      </li>
      <li>
        Backend sends a token request to FusionAuth with the <code>code</code> and <code>code_verifier</code>
      </li>
      <li>
        FusionAuth validates the token request, verifies the <code>code</code> is the same <code>code</code> it sent in step 10, and uses the <code>code_challenge_method</code> to hash the <code>code_verifier</code> and recreate a copy of the <code>code_challenge</code>
      </li>
      <li>
        Authorization server compares its new <code>code_challenge</code> to the backend's <code>code_challenge</code> (steps 5 and 9) and verifies they are identical
      </li>
      <li>
        Authorization server sends an access token to the backend
      </li>
      <li>
        Backend sets <code>HttpOnly</code> cookies for the user's session and access token 
      </li>
      <li>
        Backend uses the access token to authorize a request for <code>userInfo</code> from the authorization server
      </li>
      <li>
        Backend sets the received <code>userInfo</code> in a cookie that is transparent to the frontend (not <code>HttpOnly</code>)
      </li>
      <li>
        Backend then redirects the user to the frontend where they are now authenticated
      </li>
      <li>
        Frontend reads the information from the transparent <code>userInfo</code> cookie and uses the information to set user-specific variables, etc.
      </li>
      
    </ol>
    </>
  );
}
export default HomePage;