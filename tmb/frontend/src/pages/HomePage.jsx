function HomePage() {
  return (
    <>
    <h1 className="hero-title">Token-Mediating Backend</h1>
    <p className="hero-subtitle">Secure Token-Mediating Backend Auth Architecture Demo</p>
    <p>This is a demo of the <strong>Token-Mediating Backend (TMB)</strong> architecture pattern, specifically as described in the <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-token-mediating-backend" target="_blank">OAuth 2.0 for Browser-Based Applications</a> specification draft. The backend is a confidential client that handles (proxies) authentication requests with the authorization server (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>). It then delivers access tokens to the frontend in a JSON object so the frontend can directly call the resource server. The frontend never interacts directly with the authorization server. It should store tokens in local app memory, <em>not</em> in localStorage. <a href="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#section-6.2.4.2" target="_blank">Token-Mediating Backend is the second most secure</a> of the three architecture patterns for browser-based apps.</p>

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
        <strong>Authentication:</strong> <code>/auth</code> API on backend using <a href="https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints" target="_blank">FusionAuth OAuth 2.0 endpoints</a> and <a href="https://github.com/FusionAuth/fusionauth-typescript-client" target="_blank">TypeScript SDK</a>
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
        Session persistence with refresh token grant on the backend and proactive session renewal
      </li>
      <li>
        Frontend can call the resource server directly with access tokens
      </li>
    </ul>

    <h2>How TMB Authentication Works</h2>
    <p>See the <a href="https://github.com/kmaida/auth-architecture/blob/main/tmb/README.md#how-tmb-authentication-works" target="_blank">GitHub README</a> for a detailed explanation of this TMB pattern implementation.</p>
    </>
  );
}
export default HomePage;