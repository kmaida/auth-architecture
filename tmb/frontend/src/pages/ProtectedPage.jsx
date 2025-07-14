import { useEffect, useState } from 'react';
import { useAuth } from '../services/AuthContext';

function ProtectedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL;
  const { getAccessToken } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError(new Error('No access token available'));
        return;
      }
      const res = await fetch(`${apiUrl}/api/protected-data`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch protected data');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div>
      <h1>Protected API Data</h1>
      <p>This page makes a secured <code>GET</code> request to the local backend API to fetch and display a simple message. The backend API is on the same backend server as the auth API. The user must be logged in and have a valid access token in an <code>Authorization: Bearer</code> header in order to retrieve protected API data. The returned data is a simple JSON object with a <code>message</code> property, but you can return your own secure data instead in <code>/backend/src/api.ts</code>.</p>
      {error && <pre style={{color: 'red'}}>Error: {error.message}</pre>}
      {!error && (
        data ? (
          <pre>{JSON.stringify(data.message, null, 2)}</pre>
        ) : (
          <pre>Fetching protected data...</pre>
        )
      )}
    </div>
  );
}

export default ProtectedPage;