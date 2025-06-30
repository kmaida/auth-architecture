import { useEffect, useState } from 'react';

function ProtectedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetch(`${apiUrl}/api/protected-data`, {
      credentials: 'include', // send cookies
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch protected data');
        return res.json();
      })
      .then(setData)
      .catch(setError);
  }, []);

  return (
    <div>
      <h1>Protected Page</h1>
      <p>This page makes a secured <code>GET</code> request to the backend API to fetch and display a simple message. The user must be logged in and have a valid access token in an <code>HttpOnly</code> cookie in order to retrieve protected API data. The returned data is a simple JSON object with a <code>message</code> property, but you can return your own secure data instead in <code>/backend/src/api.ts</code>.</p>
      {error && <div style={{color: 'red'}}>Error: {error.message}</div>}
      {data ? (
        <pre>{JSON.stringify(data.message, null, 2)}</pre>
      ) : (
        <div>Fetching protected data...</div>
      )}
    </div>
  );
}

export default ProtectedPage;