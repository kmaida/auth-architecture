import { useAuth } from '../services/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginCallbackPage() {
  const { exchangeCodeForToken, userToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!userToken && code && state) {
        await exchangeCodeForToken(code, state);
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    }
    navigate('/', { replace: true });
  };
}
export default LoginCallbackPage;