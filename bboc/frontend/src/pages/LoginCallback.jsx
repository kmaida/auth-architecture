import { useAuth } from '../services/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginCallbackPage() {
  const { exchangeCodeForToken, preLoginPath, userToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (!userToken && code && state) {
          const result = await exchangeCodeForToken(code, state);
          sessionStorage.removeItem('state');
          sessionStorage.removeItem('code_verifier');
          sessionStorage.removeItem('code_challenge');
          console.log('Authentication result:', result);
        }
        // Redirect to the page user was on before login, or homepage if none
        navigate(preLoginPath || '/');
      } catch (error) {
        console.error('Authentication failed:', error);
        // Redirect to homepage
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate, preLoginPath, exchangeCodeForToken]);

  return (
    <>
    <h1 className="hero-title">Token-Mediating Backend</h1>
    <p className="hero-subtitle">Secure Token-Mediating Backend Auth Architecture Demo</p>
    <p className="hero-subtitle">This page is used to handle the login callback from the backend.</p>
    <p className="hero-subtitle">Authenticating...</p>
    </>
  );
}
export default LoginCallbackPage;