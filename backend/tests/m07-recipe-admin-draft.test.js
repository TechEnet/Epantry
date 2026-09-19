import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  assertRecipeVersionEditable,
  isEditableRecipeVersionStatus,
  serializeRecipeVersion,
} from '../src/modules/recipes/recipe.admin.service.js'

import {
  createAdminRecipeSchema,
  createNextRecipeVersionSchema,
  updateAdminRecipeDraftSchema,
} from '../src/modules/recipes/recipe.admin.validation.js'

function readSource(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../src/${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  )
}

function validRecipeInput() {
  return {
    name:
      'Paneer Tikka',

    description:
      'Curated launch recipe.',

    cuisine:
      'Indian',

    course:
      'Starter',

    tags: [
      'paneer',
      'grill',
    ],

    language:
      'en',

    title:
      'Paneer Tikka',

    recipeDescription:
      'A deterministic recipe draft.',

    baseServings:
      4,

    scalingMethod:
      'linear',

    preparationTimeMinutes:
      20,

    cookingTimeMinutes:
      20,

    difficulty:
      'medium',

    source: {
      type:
        'internal',

      name:
        'EPANTRY Editorial',
    },

    ingredients: [
      {
        lineNumber:
          1,

        canonicalIngredientId:
          '64e000000000000000000001',

        quantity:
          400,

        unit:
          'g',

        role:
          'main',
      },

      {
        lineNumber:
          2,

        canonicalIngredientId:
          '64e000000000000000000002',

        quantity:
          100,

        unit:
          'g',

        role:
          'sauce',
      },
    ],

    steps: [
      {
        stepNumber:
          1,

        instruction:
          'Mix the marinade.',
      },

      {
        stepNumber:
          2,

        instruction:
          'Cook until done.',

        timerSeconds:
          900,
      },
    ],

    substitutions:
      [],
  }
}

test(
  'M07 Admin accepts valid Recipe v1 draft input',
  () => {
    const result =
      createAdminRecipeSchema.safeParse(
        validRecipeInput(),
      )

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M07 Admin Recipe requires at least one canonical Ingredient row',
  () => {
    const input =
      validRecipeInput()

    input.ingredients =
      []

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 Admin Recipe requires at least one method step',
  () => {
    const input =
      validRecipeInput()

    input.steps =
      []

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 Admin Recipe rejects duplicate ingredient line numbers',
  () => {
    const input =
      validRecipeInput()

    input.ingredients[1].lineNumber =
      1

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 Admin Recipe rejects duplicate method step numbers',
  () => {
    const input =
      validRecipeInput()

    input.steps[1].stepNumber =
      1

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 substitution must point to an existing ingredient line',
  () => {
    const input =
      validRecipeInput()

    input.substitutions = [
      {
        sourceIngredientLineNumber:
          99,

        substituteCanonicalIngredientId:
          '64e000000000000000000003',
      },
    ]

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 unsafe incomplete Recipe requires explicit explanation',
  () => {
    const input =
      validRecipeInput()

    input.unsafeIncomplete =
      true

    input.unsafeIncompleteReason =
      ''

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 Admin Recipe input rejects commercial price state',
  () => {
    const input = {
      ...validRecipeInput(),

      price:
        19900,
    }

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 Admin Recipe input rejects inventory state',
  () => {
    const input = {
      ...validRecipeInput(),

      stock:
        20,
    }

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 Brand source is attribution and requires canonical Brand identity',
  () => {
    const input =
      validRecipeInput()

    input.source = {
      type:
        'brand',

      name:
        'Example Brand',
    }

    assert.equal(
      createAdminRecipeSchema.safeParse(
        input,
      ).success,
      false,
    )
  },
)

test(
  'M07 draft content schema accepts deterministic ingredient and method replacement',
  () => {
    const input =
      validRecipeInput()

    const {
      name,
      description,
      cuisine,
      course,
      tags,
      language,
      heroImageUrl,
      ...draft
    } =
      input

    assert.equal(
      updateAdminRecipeDraftSchema.safeParse(
        draft,
      ).success,
      true,
    )
  },
)

test(
  'M07 next Recipe Version requires explicit change reason',
  () => {
    assert.equal(
      createNextRecipeVersionSchema.safeParse({
        changeReason:
          '',
      }).success,
      false,
    )

    assert.equal(
      createNextRecipeVersionSchema.safeParse({
        changeReason:
          'Adjusted preparation method.',
      }).success,
      true,
    )
  },
)

test(
  'M07 only draft Recipe Version is editable',
  () => {
    assert.equal(
      isEditableRecipeVersionStatus(
        'draft',
      ),
      true,
    )

    for (
      const status of [
        'in_review',
        'published',
        'retired',
        'disabled',
      ]
    ) {
      assert.equal(
        isEditableRecipeVersionStatus(
          status,
        ),
        false,
      )
    }
  },
)

test(
  'M07 published Recipe Version fails destructive draft editing',
  () => {
    assert.throws(
      () =>
        assertRecipeVersionEditable({
          status:
            'published',
        }),
      (
        error,
      ) =>
        error?.statusCode ===
          409 ||
        error?.status ===
          409 ||
        error?.message ===
          'Only draft Recipe Versions may be edited.',
    )
  },
)

test(
  'M07 Recipe serializer keeps requirement data independent from retail Pack state',
  () => {
    const result =
      serializeRecipeVersion({
        _id:
          'version-1',

        dishId:
          'dish-1',

        versionNumber:
          1,

        title:
          'Test Recipe',

        baseServings:
          2,

        scalingMethod:
          'linear',

        difficulty:
          'easy',

        sourceType:
          'internal',

        status:
          'draft',

        price:
          123,

        stock:
          99,
      })

    assert.equal(
      Object.hasOwn(
        result,
        'price',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'stock',
      ),
      false,
    )
  },
)

test(
  'M07 Admin service uses canonical Ingredient validation atomic recipe writes and no application role mutation',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.service.js',
      )

    assert.match(
      source,
      /CanonicalIngredient/,
    )

    assert.match(
      source,
      /withTransaction/,
    )

    assert.match(
      source,
      /nextRecipeVersionNumber/,
    )

    assert.doesNotMatch(
      source,
      /superAdminEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /hostEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /activeMode\s*=/,
    )
  },
)