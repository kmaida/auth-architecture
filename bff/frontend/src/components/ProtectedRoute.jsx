import { Navigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

function ProtectedRoute({ children }) {
  const { loggedIn, isLoading } = useAuth();

  // Show loading while checking session
  if (isLoading) {
    return (
      <div className="container-content">
        <h2>Loading...</h2>
        <p>Verifying access...</p>
      </div>
    );
  }

  if (!loggedIn) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default ProtectedRoute;