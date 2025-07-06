import { useEffect, useState } from 'react';

function ResourceApiPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL;

  const fetchRecipe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/resource/api/recipe`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch resource API data');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipe();
  }, [apiUrl]);

  return (
    <div>
      <h1>Call an External API</h1>
      <p>This page makes a secured <code>GET</code> request to the backend to proxy a call to a cross-domain external API. The user must be logged in and have a valid session in an <code>httpOnly</code> cookie to proxy the frontend request through the backend, which uses the session to look up the access token and forward the request to the external resource API. The returned data is a randomized, made-up recipe (though you're welcome to try to cook it).</p>

      <button
        onClick={fetchRecipe}
        disabled={loading}
        className={"btn btn-primary"}
      >
        {loading ? 'Fetching Recipe...' : 'Get New Recipe'}
      </button>

      {error && <pre className="error">Error: {error.message}</pre>}
      {!error && (
        data ? (
          <pre className="json">{JSON.stringify(data, null, 2)}</pre>
        ) : (
          !loading && <pre>Click the button to fetch a recipe...</pre>
        )
      )}
    </div>
  );
}

export default ResourceApiPage;