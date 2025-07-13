import { Navigate } from 'react-router-dom';
import { useFusionAuth } from '@fusionauth/react-sdk';

function ProtectedRoute({ children }) {
  const { isLoggedIn, isLoading } = useFusionAuth();

  // Show loading while checking session
  if (isLoading) {
    return (
      <div className="container-content">
        <h2>Loading...</h2>
        <p>Verifying access...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default ProtectedRoute;