import { useEffect, useState } from 'react';

function ProtectedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL;

  const fetchData = async () => {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/protected-data`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch protected data');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <h1>Local API Data</h1>
      <p>This page makes a secured <code>GET</code> request to a local API to fetch and display a simple message. The API would be on the same domain as the frontend. The user must be logged in and have a valid access token in an <code>app.at</code> cookie (set automatically by FusionAuth) in order to retrieve protected API data. The returned data is a simple JSON object with a <code>message</code> property, but you can return your own secure data instead in <code>/backend/src/api.ts</code>.</p>
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