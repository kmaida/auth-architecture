function HomePage() {
  return (
    <>
      <h1 className="hero-title">Serverless with FusionAuth BFF</h1>
      <p className="hero-subtitle">Hosted Backend Auth Architecture Demo</p>
      <p>This is a demo of an architecture with an <strong>auth Backend-for-Frontend and a Single-Page App</strong>. This is a serverless architecture; there is no backend and the frontend directly interacts with the authorization server (<a href="https://fusionauth.io" target="_blank">FusionAuth</a>).</p>

    <h2>Architecture Overview</h2>
    <ul>
      <li>
          <strong>Frontend:</strong> <a href="https://react.dev" target="_blank">React</a> app (<a href="https://vite.dev" target="_blank">Vite</a>) with Authorization Code flow with PKCE authentication and session management using <a href="https://fusionauth.io" target="_blank">FusionAuth</a> and the <a href="https://github.com/FusionAuth/fusionauth-javascript-sdk/tree/main/packages/sdk-react" target="_blank">React SDK</a> (which uses the <a href="https://fusionauth.io/docs/apis/hosted-backend" target="_blank">FusionAuth Hosted Backend</a>)
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
        Serverless architecture with no backend
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
    <p>See the <a href="https://github.com/kmaida/auth-architecture/blob/main/bff-hb/README.md#how-bff-hb-authentication-works" target="_blank">GitHub README</a> for a detailed explanation of this BFF-HB pattern implementation.</p>
    </>
  );
}
export default HomePage;