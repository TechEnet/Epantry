const GENERIC_SEARCH_TERMS =
  new Set([
    'a',
    'an',
    'and',
    'aur',
    'for',
    'from',
    'in',
    'ka',
    'ke',
    'ki',
    'liye',
    'log',
    'logo',
    'logon',
    'make',
    'me',
    'mein',
    'my',
    'of',
    'or',
    'please',
    'the',
    'to',
    'with',
    'using',
    'use',
    'want',
    'mujhe',
    'chahiye',
    'se',
  ])

const COURSE_ALIASES =
  Object.freeze([
    [
      'breakfast',
      'breakfast',
    ],

    [
      'brunch',
      'brunch',
    ],

    [
      'lunch',
      'lunch',
    ],

    [
      'dinner',
      'dinner',
    ],

    [
      'snack',
      'snack',
    ],

    [
      'snacks',
      'snack',
    ],

    [
      'dessert',
      'dessert',
    ],
  ])

const CUISINE_ALIASES =
  Object.freeze([
    [
      'south indian',
      'south indian',
    ],

    [
      'north indian',
      'north indian',
    ],

    [
      'indian',
      'indian',
    ],

    [
      'italian',
      'italian',
    ],

    [
      'chinese',
      'chinese',
    ],

    [
      'mexican',
      'mexican',
    ],

    [
      'thai',
      'thai',
    ],

    [
      'continental',
      'continental',
    ],
  ])

const DIETARY_ALIASES =
  Object.freeze([
    [
      /\b(?:vegetarian|veg)\b/i,
      'vegetarian',
    ],

    [
      /\bvegan\b/i,
      'vegan',
    ],

    [
      /\beggetarian\b/i,
      'eggetarian',
    ],
  ])

const ALLERGEN_ALIASES =
  Object.freeze([
    [
      'peanut',
      'peanut',
    ],

    [
      'peanuts',
      'peanut',
    ],

    [
      'nut',
      'nuts',
    ],

    [
      'nuts',
      'nuts',
    ],

    [
      'milk',
      'milk',
    ],

    [
      'dairy',
      'milk',
    ],

    [
      'egg',
      'egg',
    ],

    [
      'eggs',
      'egg',
    ],

    [
      'soy',
      'soy',
    ],

    [
      'soya',
      'soy',
    ],

    [
      'gluten',
      'gluten',
    ],

    [
      'wheat',
      'wheat',
    ],
  ])

const EXPLANATION_TEXT =
  Object.freeze({
    EXACT_TEXT_MATCH:
      'The published name closely matches your search words.',

    RECIPE_INGREDIENT_MATCH:
      'The recipe uses one or more canonical ingredients resolved from your query.',

    PANTRY_HIGH_COVERAGE:
      'Confirmed Pantry ingredients cover a meaningful part of this recipe.',

    TIME_WITHIN_LIMIT:
      'The published preparation and cooking time fits your stated time limit.',

    COURSE_MATCH:
      'The published recipe course matches your requested meal type.',

    CUISINE_MATCH:
      'The published cuisine matches your requested cuisine.',

    DIETARY_CONSTRAINT_VERIFIED:
      'Governed Food Intelligence verifies the requested dietary rule for this result.',

    ALLERGEN_CONSTRAINT_VERIFIED:
      'Governed Food Intelligence verifies the required allergen-free rule used for this result.',

    PRODUCT_TEXT_MATCH:
      'Published Product truth matches the requested search terms.',

    BRAND_TEXT_MATCH:
      'The active Brand name matches the requested search terms.',

    INGREDIENT_IDENTITY_MATCH:
      'A canonical Ingredient name or governed alias matches the query.',

    SERVINGS_SCALABLE:
      'The published Recipe can be deterministically scaled for the requested servings.',
  })

export function normalizeSearchText(
  value,
) {
  return String(
    value ||
      '',
  )
    .normalize(
      'NFKC',
    )
    .replace(
      /[“”]/g,
      '"',
    )
    .replace(
      /[‘’]/g,
      "'",
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
}

export function redactSearchTextForPersistence(
  value,
) {
  return normalizeSearchText(
    value,
  )
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      '[redacted-email]',
    )
    .replace(
      /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g,
      '[redacted-phone]',
    )
    .slice(
      0,
      500,
    )
}

function parseBoundedInteger(
  value,
  min,
  max,
) {
  const numeric =
    Number(
      value,
    )

  if (
    !Number.isInteger(
      numeric,
    ) ||
    numeric <
      min ||
    numeric >
      max
  ) {
    return null
  }

  return numeric
}

function firstRegexInteger(
  text,
  expressions,
  min,
  max,
) {
  for (
    const expression
    of expressions
  ) {
    const match =
      text.match(
        expression,
      )

    if (
      !match?.[1]
    ) {
      continue
    }

    const value =
      parseBoundedInteger(
        match[1],
        min,
        max,
      )

    if (
      value !==
      null
    ) {
      return value
    }
  }

  return null
}

function detectCourse(
  lower,
) {
  for (
    const [
      phrase,
      value,
    ]
    of COURSE_ALIASES
  ) {
    if (
      lower.includes(
        phrase,
      )
    ) {
      return value
    }
  }

  return null
}

function detectCuisine(
  lower,
) {
  for (
    const [
      phrase,
      value,
    ]
    of CUISINE_ALIASES
  ) {
    if (
      lower.includes(
        phrase,
      )
    ) {
      return value
    }
  }

  return null
}

function detectDietaryKeys(
  text,
) {
  return [
    ...new Set(
      DIETARY_ALIASES
        .filter(
          ([
            expression,
          ]) =>
            expression.test(
              text,
            ),
        )
        .map(
          ([
            ,
            key,
          ]) =>
            key,
        ),
    ),
  ]
}

function detectExcludedAllergens(
  lower,
) {
  const values = []

  for (
    const [
      phrase,
      key,
    ]
    of ALLERGEN_ALIASES
  ) {
    const escaped =
      phrase.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      )

    const patterns = [
      new RegExp(
        `\\bno\\s+${escaped}\\b`,
        'i',
      ),

      new RegExp(
        `\\bwithout\\s+${escaped}\\b`,
        'i',
      ),

      new RegExp(
        `\\b${escaped}[\\s-]*free\\b`,
        'i',
      ),
    ]

    if (
      patterns.some(
        (
          expression,
        ) =>
          expression.test(
            lower,
          ),
      )
    ) {
      values.push(
        key,
      )
    }
  }

  return [
    ...new Set(
      values,
    ),
  ]
}

function detectPreferenceSignals(
  lower,
) {
  const signals = []

  if (
    /\b(?:cheaper|cheap|budget)\b/.test(
      lower,
    )
  ) {
    signals.push(
      'prefer_lower_cost',
    )
  }

  if (
    /\b(?:quick|quicker|fast|faster)\b/.test(
      lower,
    )
  ) {
    signals.push(
      'prefer_quicker',
    )
  }

  if (
    /\b(?:less spicy|mild|milder)\b/.test(
      lower,
    )
  ) {
    signals.push(
      'prefer_less_spicy',
    )
  }

  if (
    /\b(?:premium|more premium)\b/.test(
      lower,
    )
  ) {
    signals.push(
      'prefer_premium',
    )
  }

  if (
    /\b(?:fewer new ingredients|less new ingredients)\b/.test(
      lower,
    )
  ) {
    signals.push(
      'prefer_fewer_new_ingredients',
    )
  }

  return [
    ...new Set(
      signals,
    ),
  ]
}

function deriveContentTerms({
  lower,
  course,
  cuisine,
}) {
  let working =
    ` ${lower} `

  const removablePhrases = [
    course,
    cuisine,
    'one retailer only',
    'one retailer',
    'use what i already have',
    'use what i have',
    'use my pantry',
    'my pantry',
    'less spicy',
    'more premium',
    'fewer new ingredients',
    'less new ingredients',
  ].filter(
    Boolean,
  )

  for (
    const phrase
    of removablePhrases
  ) {
    working =
      working.replaceAll(
        ` ${phrase} `,
        ' ',
      )
  }

  working =
    working
      .replace(
        /\b\d{1,4}\s*(?:min|mins|minute|minutes|hours?|hrs?)\b/g,
        ' ',
      )
      .replace(
        /\b(?:under|below|max|within|upto|up to|less than)\s*(?:₹|rs\.?|inr)?\s*\d{1,7}\b/g,
        ' ',
      )
      .replace(
        /\b\d{1,3}\s*(?:people|persons|servings?|log|logo|logon)\b/g,
        ' ',
      )
      .replace(
        /\b(?:vegetarian|veg|vegan|eggetarian)\b/g,
        ' ',
      )
      .replace(
        /\b(?:no|without)\s+[a-z-]+\b/g,
        ' ',
      )
      .replace(
        /\b[a-z-]+[\s-]*free\b/g,
        ' ',
      )
      .replace(
        /[^a-z0-9\s-]/g,
        ' ',
      )

  const tokens =
    working
      .split(
        /\s+/,
      )
      .map(
        (
          token,
        ) =>
          token.trim(),
      )
      .filter(
        (
          token,
        ) =>
          token.length >=
            2 &&
          !GENERIC_SEARCH_TERMS.has(
            token,
          ) &&
          !/^\d+$/.test(
            token,
          ),
      )

  return [
    ...new Set(
      tokens,
    ),
  ].slice(
    0,
    12,
  )
}

export function parseDeterministicSearchIntent(
  rawQuery,
  {
    requestedMode =
      'all',
  } = {},
) {
  const query =
    normalizeSearchText(
      rawQuery,
    )

  const lower =
    query.toLowerCase()

  const maxTimeMinutes =
    firstRegexInteger(
      lower,
      [
        /\b(\d{1,4})\s*(?:min|mins|minute|minutes)\b/,

        /\b(\d{1,2})\s*(?:hour|hours|hr|hrs)\b/,
      ],
      1,
      1440,
    )

  let normalizedMaxTimeMinutes =
    maxTimeMinutes

  const hourMatch =
    lower.match(
      /\b(\d{1,2})\s*(?:hour|hours|hr|hrs)\b/,
    )

  if (
    hourMatch?.[1]
  ) {
    const hours =
      parseBoundedInteger(
        hourMatch[1],
        1,
        24,
      )

    if (
      hours !==
      null
    ) {
      normalizedMaxTimeMinutes =
        hours *
        60
    }
  }

  const servings =
    firstRegexInteger(
      lower,
      [
        /\b(\d{1,3})\s*(?:people|persons|servings?|log|logo|logon)(?:\s+ke\s+liye)?\b/,

        /\b(?:serve|serves|serving|servings|for)\s+(\d{1,3})\b/,
      ],
      1,
      100,
    )

  const budgetMajor =
    firstRegexInteger(
      lower,
      [
        /\b(?:under|below|max|within|upto|up to|less than)\s*(?:₹|rs\.?|inr)?\s*(\d{1,7})\b/,

        /(?:₹|rs\.?|inr)\s*(\d{1,7})\b/,
      ],
      1,
      10_000_000,
    )

  const course =
    detectCourse(
      lower,
    )

  const cuisine =
    detectCuisine(
      lower,
    )

  const dietaryKeys =
    detectDietaryKeys(
      lower,
    )

  const excludedAllergens =
    detectExcludedAllergens(
      lower,
    )

  const usePantry =
    /\b(?:use my pantry|my pantry|use what i have|use what i already have|what i already have|mere pantry)\b/i.test(
      lower,
    )

  const commerceObjective =
    /\bone retailer(?: only)?\b/i.test(
      lower,
    )
      ? 'one_retailer'
      : null

  const preferenceSignals =
    detectPreferenceSignals(
      lower,
    )

  const contentTerms =
    deriveContentTerms({
      lower,
      course,
      cuisine,
    })

  return {
    query,

    normalizedQuery:
      redactSearchTextForPersistence(
        query,
      ),

    mode:
      requestedMode,

    contentTerms,

    constraints: {
      maxTimeMinutes:
        normalizedMaxTimeMinutes,

      servings,

      budgetMinor:
        budgetMajor ===
        null
          ? null
          : budgetMajor *
            100,

      currency:
        'INR',

      course,

      cuisine,

      dietaryKeys,

      excludedAllergens,

      usePantry,

      commerceObjective,

      preferenceSignals,
    },
  }
}

function mergeUnique(
  left,
  right,
) {
  return [
    ...new Set([
      ...(left || []),
      ...(right || []),
    ]),
  ]
}

export function mergeSearchIntent({
  baseIntent,
  refinementIntent,
}) {
  const base =
    baseIntent ||
    {}

  const refinement =
    refinementIntent ||
    {}

  const baseConstraints =
    base.constraints ||
    {}

  const refinementConstraints =
    refinement.constraints ||
    {}

  const refinementHasContent =
    Array.isArray(
      refinement.contentTerms,
    ) &&
    refinement.contentTerms.length >
      0

  return {
    query:
      refinement.query ||
      base.query ||
      '',

    normalizedQuery:
      refinement.normalizedQuery ||
      base.normalizedQuery ||
      '',

    mode:
      refinement.mode &&
      refinement.mode !==
        'all'
        ? refinement.mode
        : base.mode ||
          'all',

    contentTerms:
      refinementHasContent
        ? mergeUnique(
            base.contentTerms,
            refinement.contentTerms,
          )
        : base.contentTerms ||
          [],

    constraints: {
      maxTimeMinutes:
        refinementConstraints.maxTimeMinutes ??
        baseConstraints.maxTimeMinutes ??
        null,

      servings:
        refinementConstraints.servings ??
        baseConstraints.servings ??
        null,

      budgetMinor:
        refinementConstraints.budgetMinor ??
        baseConstraints.budgetMinor ??
        null,

      currency:
        'INR',

      course:
        refinementConstraints.course ??
        baseConstraints.course ??
        null,

      cuisine:
        refinementConstraints.cuisine ??
        baseConstraints.cuisine ??
        null,

      dietaryKeys:
        mergeUnique(
          baseConstraints.dietaryKeys,
          refinementConstraints.dietaryKeys,
        ),

      excludedAllergens:
        mergeUnique(
          baseConstraints.excludedAllergens,
          refinementConstraints.excludedAllergens,
        ),

      usePantry:
        Boolean(
          refinementConstraints.usePantry ||
          baseConstraints.usePantry,
        ),

      commerceObjective:
        refinementConstraints.commerceObjective ??
        baseConstraints.commerceObjective ??
        null,

      preferenceSignals:
        mergeUnique(
          baseConstraints.preferenceSignals,
          refinementConstraints.preferenceSignals,
        ),
    },
  }
}

function normalizeComparable(
  value,
) {
  return normalizeSearchText(
    value,
  ).toLowerCase()
}

export function scoreTextMatch({
  displayName,
  terms,
}) {
  const text =
    normalizeComparable(
      displayName,
    )

  if (
    !text ||
    !Array.isArray(
      terms,
    ) ||
    terms.length ===
      0
  ) {
    return {
      score:
        0,

      matchedTerms:
        [],
    }
  }

  const matchedTerms =
    terms.filter(
      (
        term,
      ) =>
        text.includes(
          normalizeComparable(
            term,
          ),
        ),
    )

  if (
    matchedTerms.length ===
    0
  ) {
    return {
      score:
        0,

      matchedTerms:
        [],
    }
  }

  const exact =
    terms.some(
      (
        term,
      ) =>
        text ===
        normalizeComparable(
          term,
        ),
    )

  return {
    score:
      (exact
        ? 50
        : 25) +
      matchedTerms.length *
        5,

    matchedTerms,
  }
}

export function getRecipeTotalTimeMinutes(
  recipe,
) {
  const preparation =
    Number(
      recipe?.preparationTimeMinutes ||
        0,
    )

  const cooking =
    Number(
      recipe?.cookingTimeMinutes ||
        0,
    )

  if (
    !Number.isFinite(
      preparation,
    ) ||
    !Number.isFinite(
      cooking,
    )
  ) {
    return null
  }

  return Math.max(
    0,
    preparation,
  ) +
    Math.max(
      0,
      cooking,
    )
}

export function scoreRecipeSearchCandidate({
  item,
  intent,
  pantryCoverageRatio =
    null,
}) {
  let score =
    100

  const reasonCodes = []

  const textMatch =
    scoreTextMatch({
      displayName:
        `${item?.dish?.name || ''} ${item?.recipe?.title || ''}`,

      terms:
        intent.contentTerms,
    })

  if (
    textMatch.score >
    0
  ) {
    score +=
      textMatch.score

    reasonCodes.push(
      'EXACT_TEXT_MATCH',
    )
  }

  const ingredientCoverage =
    Number(
      item?.matching?.coverageRatio,
    )

  if (
    Number.isFinite(
      ingredientCoverage,
    ) &&
    ingredientCoverage >
      0
  ) {
    score +=
      Math.round(
        ingredientCoverage *
          50,
      )

    reasonCodes.push(
      'RECIPE_INGREDIENT_MATCH',
    )
  }

  if (
    Number.isFinite(
      Number(
        pantryCoverageRatio,
      ),
    ) &&
    Number(
      pantryCoverageRatio,
    ) >=
      0.5
  ) {
    score +=
      Math.round(
        Number(
          pantryCoverageRatio,
        ) *
          30,
      )

    reasonCodes.push(
      'PANTRY_HIGH_COVERAGE',
    )
  }

  const totalTime =
    getRecipeTotalTimeMinutes(
      item?.recipe,
    )

  if (
    intent.constraints.maxTimeMinutes &&
    totalTime !==
      null &&
    totalTime <=
      intent.constraints.maxTimeMinutes
  ) {
    score +=
      20

    reasonCodes.push(
      'TIME_WITHIN_LIMIT',
    )
  }

  if (
    intent.constraints.course &&
    normalizeComparable(
      item?.dish?.course,
    ) ===
      normalizeComparable(
        intent.constraints.course,
      )
  ) {
    score +=
      15

    reasonCodes.push(
      'COURSE_MATCH',
    )
  }

  if (
    intent.constraints.cuisine &&
    normalizeComparable(
      item?.dish?.cuisine,
    ).includes(
      normalizeComparable(
        intent.constraints.cuisine,
      ),
    )
  ) {
    score +=
      15

    reasonCodes.push(
      'CUISINE_MATCH',
    )
  }

  if (
    intent.constraints.servings
  ) {
    reasonCodes.push(
      'SERVINGS_SCALABLE',
    )
  }

  return {
    score,
    reasonCodes,
  }
}

export function scoreSimpleSearchCandidate({
  candidateType,
  displayName,
  terms,
}) {
  const textMatch =
    scoreTextMatch({
      displayName,
      terms,
    })

  const baseByType = {
    product:
      80,

    ingredient:
      70,

    brand:
      60,
  }

  const reasonByType = {
    product:
      'PRODUCT_TEXT_MATCH',

    ingredient:
      'INGREDIENT_IDENTITY_MATCH',

    brand:
      'BRAND_TEXT_MATCH',
  }

  return {
    score:
      (baseByType[
        candidateType
      ] ||
        50) +
      textMatch.score,

    reasonCodes:
      textMatch.score >
      0
        ? [
            reasonByType[
              candidateType
            ],
          ]
        : [],
  }
}

export function sortSearchCandidates(
  candidates,
) {
  const typePriority = {
    recipe:
      0,

    product:
      1,

    ingredient:
      2,

    brand:
      3,
  }

  return [
    ...(candidates || []),
  ].sort(
    (
      left,
      right,
    ) =>
      right.score -
        left.score ||
      (typePriority[
        left.type
      ] ??
        99) -
        (typePriority[
          right.type
        ] ??
          99) ||
      String(
        left.displayName ||
          '',
      ).localeCompare(
        String(
          right.displayName ||
            '',
        ),
      ) ||
      String(
        left.id ||
          '',
      ).localeCompare(
        String(
          right.id ||
            '',
        ),
      ),
  )
}

export function explainReasonCodes(
  reasonCodes,
) {
  return [
    ...new Set(
      reasonCodes ||
        [],
    ),
  ].map(
    (
      code,
    ) => ({
      code,

      text:
        EXPLANATION_TEXT[
          code
        ] ||
        'This result was selected by a deterministic EPANTRY search rule.',
    }),
  )
}