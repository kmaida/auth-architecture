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
    <p>See the <a href="https://github.com/kmaida/auth-architecture/blob/main/bboc/README.md#how-bboc-authentication-works" target="_blank">GitHub README</a> for a detailed explanation of this BBOC pattern implementation.</p>
    </>
  );
}
export default HomePage;