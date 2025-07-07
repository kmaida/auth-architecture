import { useEffect, useState } from 'react';
import { useAuth } from '../services/AuthContext';

function ProfilePage() {
  const [userinfo, setUserinfo] = useState(null);
  const [error, setError] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL;
  const { checkSession, aToken } = useAuth();

  useEffect(() => {
    fetch(`${apiUrl}/auth/userinfo`, {
      headers: {
        'Authorization': `Bearer ${aToken.at}`, // Headers authorize API access
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Session cookie needed to look up user info
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch user info');
        return res.json();
      })
      .then(setUserinfo)
      .catch(setError);
  }, []);

  return (
    <div>
      <h1>User Profile</h1>
      <p>This page makes a secured <code>GET</code> request to the backend auth API to fetch updated profile info. The user must be logged in and have a valid access token in an <code>httpOnly</code> cookie in order to retrieve their user info. The returned data is a JSON object.</p>
      {error && <pre style={{color: 'red'}}>Error: {error.message}</pre>}
      {!error && (
        userinfo ? (
          <pre style={{ textAlign: 'left' }}>{JSON.stringify(userinfo, null, 2)}</pre>
        ) : (
          <pre>Fetching user info...</pre>
        )
      )}
    </div>
  );
}

export default ProfilePage;