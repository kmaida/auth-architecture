import { useEffect, useState } from 'react';

function ProtectedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:4001/api/protected-data', {
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
      <h2>Protected Page</h2>
      {error && <div style={{color: 'red'}}>Error: {error.message}</div>}
      {data ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}

export default ProtectedPage;