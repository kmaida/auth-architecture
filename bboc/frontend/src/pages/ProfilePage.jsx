import { useEffect, useState } from 'react';
import { useAuth } from '../services/AuthContext';

function ProfilePage() {
  const [error, setError] = useState(null);
  const { getUserInfo, userToken, userInfo } = useAuth(); // Use global userInfo

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        await getUserInfo();
      } catch (error) {
        setError(error);
      }
    }
    
    if (userToken && !userInfo) { // Only fetch if we have a token but no user info
      fetchUserInfo();
    }
  }, [userToken, userInfo, getUserInfo]);

  return (
    <div>
      <h1>User Profile</h1>
      <p>This page makes a secured <code>GET</code> request to the backend auth API to fetch updated profile info. The user must be logged in and have a valid access token in an <code>httpOnly</code> cookie in order to retrieve their user info. The returned data is a JSON object.</p>
      {error && <pre style={{color: 'red'}}>Error: {error.message}</pre>}
      {!error && (
        userInfo ? (
          <pre style={{ textAlign: 'left' }}>{JSON.stringify(userInfo, null, 2)}</pre>
        ) : (
          <pre>Fetching user info...</pre>
        )
      )}
    </div>
  );
}

export default ProfilePage;