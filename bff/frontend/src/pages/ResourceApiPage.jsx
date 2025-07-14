import { useEffect, useState } from 'react';

function ResourceApiPage() {
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchRecipe();
  }, []);

  const fetchRecipe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/resource/api/recipe`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch resource API data');
      const result = await res.json();
      setRecipe(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Call an External API</h1>
      <p>This page makes a secured <code>GET</code> request to the backend to proxy a call to a cross-domain external API. The user must be logged in and have a valid session in an <code>httpOnly</code> cookie to call the appropriate backend endpoint. The backend uses the session to look up the access token, add <code>Authorization: Bearer 'accessToken'</code>, and send the request to the external resource API. The returned data is a randomized, made-up recipe (though you're welcome to try to cook it).</p>

      <button
        onClick={fetchRecipe}
        disabled={loading}
        className={"btn btn-primary"}
      >
        {loading ? 'Fetching Recipe...' : 'Get New Recipe'}
      </button>

      {!error && (
        recipe ? (
          <div className="recipe">
            <h2>{recipe.name}</h2>
            <div className="recipe-lists">
              <ul className="details">
                <li><strong>Cuisine:</strong> {recipe.cuisine}</li>
                <li><strong>Difficulty:</strong> {recipe.difficulty}</li>
                <li><strong>Cooking Time:</strong> {recipe.cookingTime}</li>
                <li><strong>Servings:</strong> {recipe.servings}</li>
              </ul>
              <ul className="ingredients">
                <li>{recipe.ingredients.protein}</li>
                {recipe.ingredients.vegetables.map(veg => <li key={veg}>{veg}</li>)}
                <li>{recipe.ingredients.grain}</li>
                <li>{recipe.ingredients.sauce}</li>
                <li>{recipe.ingredients.garnish}</li>
              </ul>
            </div>
            <ol className="instructions">
              {recipe.instructions.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <p className="tips"><em>{recipe.tips}</em></p>
          </div>
        ) : (
          !loading && <p>Unable to fetch recipe (see output below)</p>
        )
      )}

      <h2>Raw Recipe Response</h2>

      {error && <pre className="error">Error: {error.message}</pre>}
      {!error && (
        recipe ? (
          <pre className="json">{JSON.stringify(recipe, null, 2)}</pre>
        ) : (
          !loading && <pre>Click the button to fetch a recipe...</pre>
        )
      )}
    </div>
  );
}

export default ResourceApiPage;