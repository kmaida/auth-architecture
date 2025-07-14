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
    } catch (error) {
      console.error('Logout failed:', error);
    }
    navigate('/', { replace: true });
  };
}
export default LogoutCallbackPage;