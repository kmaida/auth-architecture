import { useAuth } from '../services/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LogoutCallbackPage() {
  const { clearSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    handleCallback();
  }, [navigate, clearSession]);

  const handleCallback = async () => {
    try {
      await clearSession();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // Redirect to homepage
      navigate('/');
    }
  };

  return (
    <>
    <h1 className="hero-title">BFF with FusionAuth Hosted Backend</h1>
    <p className="hero-subtitle">Secure Backend-for-Frontend with FusionAuth Hosted Backend Auth Architecture Demo</p>
    <p className="hero-subtitle">Logging out...</p>
    </>
  );
}
export default LogoutCallbackPage;