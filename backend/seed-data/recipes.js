const DIETARY_TYPES = Object.freeze({
  VEGETARIAN: 'vegetarian',
  EGGITARIAN: 'eggitarian',
  NON_VEGETARIAN: 'non-vegetarian',
  VEGAN: 'vegan',
})

const recipes = [
  {
    id: 'recipe_001',
    name: 'Veg Cheese Sandwich',
    slug: 'veg-cheese-sandwich',
    image: '/recipes/veg-sandwich.png',
    description:
      'A crisp, quick sandwich layered with butter, cheese, and fresh vegetables.',
    cuisine: 'Indian',
    dietaryType: DIETARY_TYPES.VEGETARIAN,
    servings: 2,
    preparationTime: 10,
    cookingTime: 5,

    ingredients: [
      {
        productId: 'prod_001',
        quantity: 20,
        unit: 'g',
      },
      {
        productId: 'prod_002',
        quantity: 4,
        unit: 'slices',
      },
      {
        name: 'Bread slices',
        quantity: 4,
        unit: 'slices',
      },
      {
        name: 'Tomato',
        quantity: 1,
        unit: 'medium',
      },
      {
        name: 'Cucumber',
        quantity: 0.5,
        unit: 'medium',
      },
    ],

    instructions: [
      'Spread butter on each bread slice.',
      'Layer cucumber, tomato, and cheese on two slices.',
      'Close the sandwiches and toast until crisp and lightly golden.',
      'Slice and serve warm.',
    ],

    tags: ['sandwich', 'quick', 'breakfast', 'snack'],
  },

  {
    id: 'recipe_002',
    name: 'Simple Dal Tadka',
    slug: 'simple-dal-tadka',
    image: '/recipes/dal-tadka.jpg',
    description:
      'A warm, comforting toor dal finished with a fragrant spice tempering.',
    cuisine: 'Indian',
    dietaryType: DIETARY_TYPES.VEGETARIAN,
    servings: 4,
    preparationTime: 10,
    cookingTime: 30,

    ingredients: [
      {
        productId: 'prod_005',
        quantity: 200,
        unit: 'g',
      },
      {
        productId: 'prod_006',
        quantity: 0.5,
        unit: 'tsp',
      },
      {
        productId: 'prod_008',
        quantity: 1,
        unit: 'tbsp',
      },
      {
        productId: 'prod_011',
        quantity: 1,
        unit: 'tsp',
      },
      {
        name: 'Tomato',
        quantity: 1,
        unit: 'medium',
      },
      {
        name: 'Cumin seeds',
        quantity: 1,
        unit: 'tsp',
      },
    ],

    instructions: [
      'Rinse the toor dal and pressure cook with turmeric until soft.',
      'Whisk the cooked dal and add salt and water to your preferred consistency.',
      'Heat oil, crackle cumin, then add chopped tomato and cook briefly.',
      'Pour the tempering over the dal and simmer for five minutes.',
    ],

    tags: ['dal', 'comfort food', 'lunch', 'protein'],
  },

  {
    id: 'recipe_003',
    name: 'Paneer Rice Bowl',
    slug: 'paneer-rice-bowl',
    image: '/recipes/paneer-rice.webp',
    description:
      'A satisfying rice bowl with seared paneer, spices, and cooling curd.',
    cuisine: 'Indian',
    dietaryType: DIETARY_TYPES.VEGETARIAN,
    servings: 2,
    preparationTime: 12,
    cookingTime: 20,

    ingredients: [
      {
        productId: 'prod_003',
        quantity: 200,
        unit: 'g',
      },
      {
        productId: 'prod_009',
        quantity: 160,
        unit: 'g',
      },
      {
        productId: 'prod_012',
        quantity: 100,
        unit: 'g',
      },
      {
        productId: 'prod_006',
        quantity: 0.25,
        unit: 'tsp',
      },
      {
        productId: 'prod_008',
        quantity: 1,
        unit: 'tbsp',
      },
    ],

    instructions: [
      'Cook the basmati rice until fluffy.',
      'Cube paneer and toss with turmeric and salt.',
      'Sear paneer in a hot pan with oil until lightly golden.',
      'Serve paneer over rice with curd on the side.',
    ],

    tags: ['paneer', 'rice bowl', 'lunch', 'high protein'],
  },

  {
    id: 'recipe_004',
    name: 'Masala Egg Rice',
    slug: 'masala-egg-rice',
    image: '/recipes/egg-rice.jpg',
    description:
      'Fast spiced rice tossed with eggs for a filling weeknight meal.',
    cuisine: 'Indian',
    dietaryType: DIETARY_TYPES.EGGITARIAN,
    servings: 2,
    preparationTime: 8,
    cookingTime: 18,

    ingredients: [
      {
        productId: 'prod_009',
        quantity: 160,
        unit: 'g',
      },
      {
        productId: 'prod_008',
        quantity: 1,
        unit: 'tbsp',
      },
      {
        productId: 'prod_007',
        quantity: 0.5,
        unit: 'tsp',
      },
      {
        name: 'Eggs',
        quantity: 3,
        unit: 'whole',
      },
      {
        name: 'Onion',
        quantity: 1,
        unit: 'small',
      },
    ],

    instructions: [
      'Cook rice and cool it slightly.',
      'Saute onion in oil, add chilli powder, and stir.',
      'Add beaten eggs and scramble softly.',
      'Fold in rice, season, and cook until heated through.',
    ],

    tags: ['egg', 'rice', 'quick dinner', 'spicy'],
  },

  {
    id: 'recipe_005',
    name: 'Vegan Turmeric Rice',
    slug: 'vegan-turmeric-rice',
    image: '/recipes/turmeric-rice.jpg',
    description:
      'A bright one-pot rice dish with turmeric and pantry spices.',
    cuisine: 'Indian',
    dietaryType: DIETARY_TYPES.VEGAN,
    servings: 3,
    preparationTime: 8,
    cookingTime: 22,

    ingredients: [
      {
        productId: 'prod_009',
        quantity: 240,
        unit: 'g',
      },
      {
        productId: 'prod_006',
        quantity: 1,
        unit: 'tsp',
      },
      {
        productId: 'prod_008',
        quantity: 1,
        unit: 'tbsp',
      },
      {
        productId: 'prod_011',
        quantity: 1,
        unit: 'tsp',
      },
      {
        name: 'Green peas',
        quantity: 80,
        unit: 'g',
      },
    ],

    instructions: [
      'Rinse rice until the water runs mostly clear.',
      'Warm oil and bloom turmeric for a few seconds.',
      'Add rice, peas, salt, and water.',
      'Cover and cook until the rice is tender and fluffy.',
    ],

    tags: ['vegan', 'rice', 'one pot', 'easy'],
  },

  {
    id: 'recipe_006',
    name: 'Chicken Curd Bowl',
    slug: 'chicken-curd-bowl',
    image: '/recipes/chicken-bowl.jpg',
    description:
      'A simple spiced chicken bowl balanced with rice and cooling curd.',
    cuisine: 'Indian',
    dietaryType: DIETARY_TYPES.NON_VEGETARIAN,
    servings: 2,
    preparationTime: 15,
    cookingTime: 25,

    ingredients: [
      {
        productId: 'prod_009',
        quantity: 160,
        unit: 'g',
      },
      {
        productId: 'prod_012',
        quantity: 120,
        unit: 'g',
      },
      {
        productId: 'prod_006',
        quantity: 0.5,
        unit: 'tsp',
      },
      {
        productId: 'prod_008',
        quantity: 1,
        unit: 'tbsp',
      },
      {
        name: 'Boneless chicken',
        quantity: 250,
        unit: 'g',
      },
    ],

    instructions: [
      'Cook rice and keep warm.',
      'Season chicken with turmeric and salt.',
      'Cook chicken in oil until browned and fully cooked.',
      'Serve over rice with curd alongside.',
    ],

    tags: ['chicken', 'rice bowl', 'dinner', 'protein'],
  },
]

export default recipes