import { useEffect, useState } from 'react';

function ResourceApiPage() {
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchRecipe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipe`, {
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

  useEffect(() => {
    fetchRecipe();
  }, []);

  return (
    <div>
      <h1>Call a Proxied External API</h1>
      <p>This page makes a <code>GET</code> request to an external API that has been proxied to <code>/api</code>. A request is made on page load and each time the <code>Get New Recipe</code> button is clicked. The resource server requires authorization, which the request delivers with the <code>app.at</code> cookie set by FusionAuth's hosted backend. The returned data is a randomized, made-up recipe (though you're welcome to try to cook it).</p>

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