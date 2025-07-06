import express from 'express';

/*---------------------------------
          Resource API
---------------------------------*/

export function resourceApi(app: express.Application, verifyJWT: express.RequestHandler) {
  // Recipe component arrays
  const proteins = [
    'chicken breast', 'salmon', 'tofu', 'ground beef', 'shrimp', 'pork tenderloin',
    'black beans', 'lentils', 'turkey', 'eggs', 'chickpeas', 'quinoa', 'tempeh'
  ];

  const vegetables = [
    'broccoli', 'carrots', 'bell peppers', 'zucchini', 'spinach', 'mushrooms',
    'onions', 'tomatoes', 'sweet potatoes', 'Brussels sprouts', 'asparagus',
    'cauliflower', 'eggplant', 'kale', 'corn', 'peas'
  ];

  const grains = [
    'rice', 'pasta', 'quinoa', 'couscous', 'barley', 'farro', 'bulgur',
    'polenta', 'orzo', 'wild rice', 'buckwheat', 'millet'
  ];

  const cookingMethods = [
    'roasted', 'grilled', 'stir-fried', 'braised', 'sautéed', 'steamed',
    'baked', 'pan-seared', 'slow-cooked', 'caramelized', 'blackened'
  ];

  const sauces = [
    'teriyaki glaze', 'lemon herb sauce', 'spicy peanut sauce', 'garlic aioli',
    'balsamic reduction', 'curry coconut sauce', 'chimichurri', 'tahini dressing',
    'honey mustard', 'sriracha mayo', 'pesto', 'tzatziki', 'miso glaze'
  ];

  const garnishes = [
    'toasted sesame seeds', 'fresh herbs', 'crushed nuts', 'crispy onions',
    'pomegranate seeds', 'microgreens', 'lime wedges', 'pickled vegetables',
    'crumbled cheese', 'toasted coconut flakes', 'everything bagel seasoning'
  ];

  const cuisineStyles = [
    'Mediterranean', 'Asian-inspired', 'Mexican-style', 'Middle Eastern',
    'Italian', 'Thai-inspired', 'Indian-spiced', 'Moroccan', 'Caribbean',
    'Scandinavian', 'Korean-style', 'Greek'
  ];

  const cookingTips = [
    'Let it rest for 5 minutes before serving',
    'Season generously with salt and pepper',
    'Cook until just tender for best texture',
    'Taste and adjust seasoning as needed',
    'Serve immediately while hot',
    'Garnish just before serving',
    'Drizzle with good olive oil to finish'
  ];

  // Helper function to get random element from array
  function getRandomElement(array: string[]) {
    return array[Math.floor(Math.random() * array.length)];
  }

  // Helper function to get multiple random elements
  function getRandomElements(array: string[], count: number) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Generate cooking time
  function getRandomCookingTime() {
    const times = ['15-20', '20-25', '25-30', '30-35', '35-40', '40-45'];
    return getRandomElement(times);
  }

  // Generate difficulty level
  function getRandomDifficulty() {
    const difficulties = ['Easy', 'Medium', 'Medium-Hard'];
    const weights = [0.5, 0.3, 0.2]; // Favor easier recipes
    const random = Math.random();
    let weightSum = 0;
    
    for (let i = 0; i < difficulties.length; i++) {
      weightSum += weights[i];
      if (random <= weightSum) {
        return difficulties[i];
      }
    }
    return 'Easy';
  }

  // API endpoint
  app.get('/api/recipe', verifyJWT, (req, res) => {
    const recipe = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      name: '',
      cuisine: getRandomElement(cuisineStyles),
      difficulty: getRandomDifficulty(),
      cookingTime: getRandomCookingTime() + ' minutes',
      servings: Math.floor(Math.random() * 4) + 2, // 2-5 servings
      ingredients: {
        protein: getRandomElement(proteins),
        vegetables: getRandomElements(vegetables, 2 + Math.floor(Math.random() * 2)), // 2-3 veggies
        grain: getRandomElement(grains),
        sauce: getRandomElement(sauces),
        garnish: getRandomElement(garnishes)
      },
      instructions: [] as string[],
      tips: getRandomElement(cookingTips)
    };

    // Generate recipe name
    const cookingMethod = getRandomElement(cookingMethods);
    recipe.name = `${recipe.cuisine} ${cookingMethod} ${recipe.ingredients.protein} with ${recipe.ingredients.vegetables[0]} and ${recipe.ingredients.grain}`;

    // Generate instructions
    recipe.instructions = [
      `Prepare the ${recipe.ingredients.protein} by cutting into appropriate pieces.`,
      `Heat oil in a large pan and cook the ${recipe.ingredients.protein} until ${cookingMethod}.`,
      `Add ${recipe.ingredients.vegetables.join(' and ')} to the pan and cook until tender.`,
      `Prepare ${recipe.ingredients.grain} according to package directions.`,
      `Toss everything with ${recipe.ingredients.sauce}.`,
      `Serve over ${recipe.ingredients.grain} and top with ${recipe.ingredients.garnish}.`
    ];

    res.json({
      success: true,
      recipe: recipe
    });
  });
}
