import { useEffect, useState } from 'react';

function ProtectedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetch(`${apiUrl}/api/protected-data`, {
      credentials: 'include' // send session ID cookie
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
      <h1>Protected API Data</h1>
      <p>This page makes a secured <code>GET</code> request to the backend API to fetch and display a simple message. The user must be logged in and have a valid session in an <code>httpOnly</code> cookie in order for the backend to look up the access token andretrieve protected API data. The returned data is a simple JSON object with a <code>message</code> property, but you can return your own secure data instead in <code>/backend/src/api.ts</code>.</p>
      {error && <pre className="error">Error: {error.message}</pre>}
      {!error && (
        data ? (
          <pre className="json">{JSON.stringify(data.message, null, 2)}</pre>
        ) : (
          <pre>Fetching protected data...</pre>
        )
      )}
    </div>
  );
}

export default ProtectedPage;