import { useEffect, useState } from 'react';
import { useAuth } from '../services/AuthContext';

function ResourceApiPage() {
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { aToken } = useAuth();
  const resourceApiUrl = import.meta.env.VITE_RESOURCE_API_URL;

  const fetchRecipe = async () => {
    if (!aToken) {
      setError(new Error('No access token available'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${resourceApiUrl}/api/recipe`, {
        headers: {
          'Authorization': `Bearer ${aToken.at}`,
          'Content-Type': 'application/json'
        }
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

  useEffect(() => {
    if (aToken) {
      fetchRecipe();
    }
  }, [resourceApiUrl, aToken]);

  return (
    <div>
      <h1>Call an External API</h1>
      <p>This page makes a <code>GET</code> request with to a cross-origin external API at <code>{resourceApiUrl}/api/recipe</code>. The resource server requires authorization, which the request delivers with <code>Authorization: Bearer 'accessToken'</code>. The returned data is a randomized, made-up recipe (though you're welcome to try to cook it).</p>

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
                <li>{recipe.ingredients.vegetables.join(', ')}</li>
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
          !loading
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