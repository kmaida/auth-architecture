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
    <p>See the <a href="https://github.com/kmaida/auth-architecture/blob/main/bff/README.md#How-BFF-Works" target="_blank">GitHub README</a> for a detailed explanation of this BFF pattern implementation.</p>
    </>
  );
}
export default HomePage;