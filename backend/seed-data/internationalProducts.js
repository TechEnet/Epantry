const internationalProducts = [
  {
    id: 'prod_int_001',

    name:
      'Barilla Spaghetti No. 5',

    slug:
      'barilla-spaghetti-no-5',

    brandId:
      'brand_int_001',

    category:
      'grocery',

    subCategory:
      'pasta',

    image: null,

    description:
      'Classic Italian durum wheat spaghetti for pasta dishes and sauces.',

    quantity: 500,

    unit: 'g',

    price: 249,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'Italy',

    marketType:
      'international',

    isImported: true,

    isFeatured: true,

    tags: [
      'barilla',
      'italian',
      'pasta',
      'spaghetti',
      'imported',
    ],
  },

  {
    id: 'prod_int_002',

    name:
      'Barilla Pesto Genovese',

    slug:
      'barilla-pesto-genovese',

    brandId:
      'brand_int_001',

    category:
      'grocery',

    subCategory:
      'sauces',

    image: null,

    description:
      'Italian basil pesto for pasta, sandwiches, and quick meals.',

    quantity: 190,

    unit: 'g',

    price: 449,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'Italy',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'barilla',
      'italian',
      'pesto',
      'basil',
      'imported',
    ],
  },

  {
    id: 'prod_int_003',

    name:
      'Heinz Tomato Ketchup',

    slug:
      'heinz-tomato-ketchup',

    brandId:
      'brand_int_002',

    category:
      'grocery',

    subCategory:
      'condiments',

    image: null,

    description:
      'Classic tomato ketchup for fries, sandwiches, burgers, and snacks.',

    quantity: 570,

    unit: 'g',

    price: 329,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'United States',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'heinz',
      'ketchup',
      'tomato',
      'condiment',
      'international',
    ],
  },

  {
    id: 'prod_int_004',

    name:
      'Heinz Baked Beans',

    slug:
      'heinz-baked-beans',

    brandId:
      'brand_int_002',

    category:
      'grocery',

    subCategory:
      'canned-food',

    image: null,

    description:
      'Ready-to-heat baked beans in tomato sauce for breakfast and quick meals.',

    quantity: 415,

    unit: 'g',

    price: 299,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'United Kingdom',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'heinz',
      'beans',
      'canned',
      'breakfast',
      'imported',
    ],
  },

  {
    id: 'prod_int_005',

    name:
      'Kikkoman Naturally Brewed Soy Sauce',

    slug:
      'kikkoman-naturally-brewed-soy-sauce',

    brandId:
      'brand_int_003',

    category:
      'grocery',

    subCategory:
      'sauces',

    image: null,

    description:
      'Japanese-style naturally brewed soy sauce for stir-fries, marinades, and dipping.',

    quantity: 150,

    unit: 'ml',

    price: 285,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'Japan',

    marketType:
      'international',

    isImported: true,

    isFeatured: true,

    tags: [
      'kikkoman',
      'japanese',
      'soy sauce',
      'seasoning',
      'imported',
    ],
  },

  {
    id: 'prod_int_006',

    name:
      'Twinings English Breakfast Tea',

    slug:
      'twinings-english-breakfast-tea',

    brandId:
      'brand_int_004',

    category:
      'grocery',

    subCategory:
      'tea',

    image: null,

    description:
      'A full-bodied British-style black tea blend for a classic breakfast cup.',

    quantity: 25,

    unit: 'tea bags',

    price: 399,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'United Kingdom',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'twinings',
      'tea',
      'black tea',
      'british',
      'imported',
    ],
  },

  {
    id: 'prod_int_007',

    name:
      'Lindt Excellence 70% Cocoa Dark Chocolate',

    slug:
      'lindt-excellence-70-dark-chocolate',

    brandId:
      'brand_int_005',

    category:
      'grocery',

    subCategory:
      'chocolate',

    image: null,

    description:
      'Swiss dark chocolate with a rich cocoa profile and smooth finish.',

    quantity: 100,

    unit: 'g',

    price: 475,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'Switzerland',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'lindt',
      'swiss',
      'dark chocolate',
      'cocoa',
      'imported',
    ],
  },

  {
    id: 'prod_int_008',

    name:
      'Tabasco Original Red Pepper Sauce',

    slug:
      'tabasco-original-red-pepper-sauce',

    brandId:
      'brand_int_006',

    category:
      'grocery',

    subCategory:
      'hot-sauce',

    image: null,

    description:
      'American red pepper sauce for eggs, pizzas, sandwiches, and marinades.',

    quantity: 60,

    unit: 'ml',

    price: 299,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'United States',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'tabasco',
      'hot sauce',
      'pepper',
      'american',
      'imported',
    ],
  },

  {
    id: 'prod_int_009',

    name:
      'Pringles Original',

    slug:
      'pringles-original',

    brandId:
      'brand_int_007',

    category:
      'grocery',

    subCategory:
      'snacks',

    image: null,

    description:
      'Original salted potato crisps in the signature stacked format.',

    quantity: 107,

    unit: 'g',

    price: 249,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'United States',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'pringles',
      'crisps',
      'snacks',
      'international',
    ],
  },

  {
    id: 'prod_int_010',

    name:
      "Kellogg's Corn Flakes",

    slug:
      'kelloggs-corn-flakes',

    brandId:
      'brand_int_008',

    category:
      'grocery',

    subCategory:
      'breakfast-cereal',

    image: null,

    description:
      'Classic toasted corn flakes for breakfast with milk and fruit.',

    quantity: 475,

    unit: 'g',

    price: 285,

    currency: 'INR',

    availability: true,

    countryOfOrigin:
      'United States',

    marketType:
      'international',

    isImported: true,

    isFeatured: false,

    tags: [
      'kelloggs',
      'corn flakes',
      'cereal',
      'breakfast',
      'international',
    ],
  },
]

export default internationalProducts