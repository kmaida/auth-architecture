import { useAuth } from '../services/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginCallbackPage() {
  // This page is used to handle the login callback from the backend.
  const { getAT } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await getAT();
      } catch (error) {
        console.error('Authentication failed:', error);
      }
      // Redirect to homepage
      navigate('/');
    };

    handleCallback();
  }, [getAT, navigate]);

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