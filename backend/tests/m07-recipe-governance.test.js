import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  evaluateRecipePublishReadiness,
  isRecipeVersionSubmittable,
  nextRecipeStatusAfterReviewDecision,
  resolveRecipeReviewDecisionState,
} from '../src/modules/recipes/recipe.governance.service.js'

import {
  changeDishLifecycleSchema,
  changeRecipeVersionLifecycleSchema,
  publishRecipeVersionSchema,
  reviewRecipeVersionSchema,
  submitRecipeForReviewSchema,
} from '../src/modules/recipes/recipe.governance.validation.js'

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

test(
  'M07 submit-for-review requires explicit governance reason',
  () => {
    assert.equal(
      submitRecipeForReviewSchema.safeParse({
        reason:
          'Ready for editorial review.',
      }).success,
      true,
    )

    assert.equal(
      submitRecipeForReviewSchema.safeParse({
        reason:
          '',
      }).success,
      false,
    )
  },
)

test(
  'M07 review accepts editorial QA and safety review types',
  () => {
    for (
      const reviewType of [
        'editorial',
        'qa',
        'safety',
      ]
    ) {
      assert.equal(
        reviewRecipeVersionSchema.safeParse({
          reviewType,

          decision:
            'approved',

          reason:
            'Reviewed.',
        }).success,
        true,
      )
    }
  },
)

test(
  'M07 review API cannot inject submitted lifecycle decision',
  () => {
    assert.equal(
      reviewRecipeVersionSchema.safeParse({
        reviewType:
          'editorial',

        decision:
          'submitted',

        reason:
          'Invalid client decision.',
      }).success,
      false,
    )
  },
)

test(
  'M07 publish accepts controlled effective date and reason',
  () => {
    const result =
      publishRecipeVersionSchema.safeParse({
        reason:
          'QA and editorial review completed.',

        effectiveFrom:
          '2026-08-24T12:00:00.000Z',
      })

    assert.equal(
      result.success,
      true,
    )

    assert.ok(
      result.data.effectiveFrom instanceof
        Date,
    )
  },
)

test(
  'M07 Recipe Version lifecycle has no destructive restore shortcut',
  () => {
    assert.equal(
      changeRecipeVersionLifecycleSchema.safeParse({
        action:
          'disable',

        reason:
          'Immediate quality hold.',
      }).success,
      true,
    )

    assert.equal(
      changeRecipeVersionLifecycleSchema.safeParse({
        action:
          'restore',

        reason:
          'Unsafe shortcut.',
      }).success,
      false,
    )
  },
)

test(
  'M07 Dish lifecycle supports controlled disable restore and retirement',
  () => {
    for (
      const action of [
        'disable',
        'restore',
        'retire',
      ]
    ) {
      assert.equal(
        changeDishLifecycleSchema.safeParse({
          action,

          reason:
            'Controlled administrative action.',
        }).success,
        true,
      )
    }
  },
)

test(
  'M07 only draft Recipe Version may be submitted for review',
  () => {
    assert.equal(
      isRecipeVersionSubmittable(
        'draft',
      ),
      true,
    )

    assert.equal(
      isRecipeVersionSubmittable(
        'published',
      ),
      false,
    )
  },
)

test(
  'M07 approved review keeps Recipe in review',
  () => {
    assert.equal(
      nextRecipeStatusAfterReviewDecision(
        'approved',
      ),
      'in_review',
    )
  },
)

test(
  'M07 requested changes return Recipe to editable draft',
  () => {
    assert.equal(
      nextRecipeStatusAfterReviewDecision(
        'changes_requested',
      ),
      'draft',
    )
  },
)

test(
  'M07 rejected review returns Recipe to draft for governed next revision',
  () => {
    assert.equal(
      nextRecipeStatusAfterReviewDecision(
        'rejected',
      ),
      'draft',
    )
  },
)

test(
  'M07 publication requires both editorial and QA approval',
  () => {
    const submittedAt =
      new Date(
        '2026-08-24T10:00:00.000Z',
      )

    const result =
      evaluateRecipePublishReadiness({
        recipeVersion: {
          status:
            'in_review',

          submittedAt,

          submittedByUserId:
            'maker-1',

          unsafeIncomplete:
            false,
        },

        ingredientCount:
          2,

        stepCount:
          3,

        reviews: [
          {
            reviewType:
              'editorial',

            decision:
              'approved',

            createdAt:
              new Date(
                '2026-08-24T10:05:00.000Z',
              ),
          },

          {
            reviewType:
              'qa',

            decision:
              'approved',

            createdAt:
              new Date(
                '2026-08-24T10:10:00.000Z',
              ),
          },
        ],
      })

    assert.equal(
      result.ready,
      true,
    )
  },
)

test(
  'M07 unsafe incomplete Recipe cannot publish',
  () => {
    const result =
      evaluateRecipePublishReadiness({
        recipeVersion: {
          status:
            'in_review',

          submittedAt:
            new Date(),

          submittedByUserId:
            'maker-1',

          unsafeIncomplete:
            true,
        },

        ingredientCount:
          1,

        stepCount:
          1,

        reviews: [
          {
            reviewType:
              'editorial',

            decision:
              'approved',

            createdAt:
              new Date(),
          },

          {
            reviewType:
              'qa',

            decision:
              'approved',

            createdAt:
              new Date(),
          },
        ],
      })

    assert.equal(
      result.ready,
      false,
    )

    assert.ok(
      result.issues.includes(
        'RECIPE_UNSAFE_INCOMPLETE',
      ),
    )
  },
)

test(
  'M07 approvals from an older submission cycle do not authorize new publication',
  () => {
    const state =
      resolveRecipeReviewDecisionState({
        submittedAt:
          new Date(
            '2026-08-24T12:00:00.000Z',
          ),

        reviews: [
          {
            reviewType:
              'editorial',

            decision:
              'approved',

            createdAt:
              new Date(
                '2026-08-24T11:00:00.000Z',
              ),
          },

          {
            reviewType:
              'qa',

            decision:
              'approved',

            createdAt:
              new Date(
                '2026-08-24T11:10:00.000Z',
              ),
          },
        ],
      })

    assert.equal(
      state.editorial,
      null,
    )

    assert.equal(
      state.qa,
      null,
    )
  },
)

test(
  'M07 blocking safety review prevents publication',
  () => {
    const submittedAt =
      new Date(
        '2026-08-24T12:00:00.000Z',
      )

    const readiness =
      evaluateRecipePublishReadiness({
        recipeVersion: {
          status:
            'in_review',

          submittedAt,

          submittedByUserId:
            'maker-1',

          unsafeIncomplete:
            false,
        },

        ingredientCount:
          1,

        stepCount:
          1,

        reviews: [
          {
            reviewType:
              'editorial',

            decision:
              'approved',

            createdAt:
              new Date(
                '2026-08-24T12:05:00.000Z',
              ),
          },

          {
            reviewType:
              'qa',

            decision:
              'approved',

            createdAt:
              new Date(
                '2026-08-24T12:10:00.000Z',
              ),
          },

          {
            reviewType:
              'safety',

            decision:
              'changes_requested',

            createdAt:
              new Date(
                '2026-08-24T12:15:00.000Z',
              ),
          },
        ],
      })

    assert.equal(
      readiness.ready,
      false,
    )

    assert.ok(
      readiness.issues.includes(
        'RECIPE_SAFETY_REVIEW_BLOCKING',
      ),
    )
  },
)

test(
  'M07 publish service enforces maker checker and retires old version without deleting history',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.governance.service.js',
      )

    assert.match(
      source,
      /assertDistinctMakerCheckerActors/,
    )

    assert.match(
      source,
      /submittedByUserId/,
    )

    assert.match(
      source,
      /status:\s*'retired'/,
    )

    assert.doesNotMatch(
      source,
      /RecipeVersion\.deleteOne/,
    )

    assert.doesNotMatch(
      source,
      /RecipeVersion\.deleteMany/,
    )
  },
)

test(
  'M07 governance uses existing Recipe permissions audit and no new application role',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.governance.service.js',
      )

    assert.match(
      source,
      /recordAdminAuditEvent/,
    )

    assert.match(
      source,
      /recipe\.mutate/,
    )

    assert.match(
      source,
      /recipe\.publish/,
    )

    assert.match(
      source,
      /recipe\.governance/,
    )

    assert.doesNotMatch(
      source,
      /brandEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /sellerEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /b2bEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /activeMode\s*=/,
    )
  },
)