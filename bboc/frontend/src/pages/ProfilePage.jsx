import { useEffect, useState, useRef, use } from 'react';
import { useAuth } from '../services/AuthContext';

function ProfilePage() {
  const [error, setError] = useState(null);
  const { userInfo } = useAuth();

  useEffect(() => {
    if (!userInfo) {
      setError(new Error('User info not available. Please log in.'));
      return;
    }
  }, [userInfo]);

  return (
    <div>
      <h1>User Profile</h1>
      <p>This page displays the user's info in a JSON object.</p>
      {error && <pre className="error">Error: {error.message}</pre>}
      {!error && (
        userInfo ? (
          <pre className="json">{JSON.stringify(userInfo, null, 2)}</pre>
        ) : (
          <pre>Fetching user info...</pre>
        )
      )}
    </div>
  );
}

export default ProfilePage;