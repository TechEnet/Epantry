import assert from 'node:assert/strict'

import test from 'node:test'

import {
  buildPantryIdentityKey,
  buildPantryObservationProjection,
  calculateDecayedPantryConfidence,
  deriveObservationEvidenceStrength,
  derivePantryStateFromObservation,
  projectPantryItemAtTime,
  projectPantryItemFromObservation,
  sanitizeQuantityForPantryState,
  shouldApplyPantryObservation,
} from '../src/modules/pantry/pantry.state.js'

const PACK_ID =
  '64b000000000000000000001'

const INGREDIENT_ID =
  '64b000000000000000000002'

test(
  'M09 Pantry identity key is deterministic for canonical identity',
  () => {
    assert.equal(
      buildPantryIdentityKey({
        canonicalPackId:
          PACK_ID,

        canonicalIngredientId:
          INGREDIENT_ID,
      }),
      `pack:${PACK_ID}|ingredient:${INGREDIENT_ID}`,
    )
  },
)

test(
  'M09 I have this becomes confirmed available',
  () => {
    assert.equal(
      derivePantryStateFromObservation({
        sourceType:
          'manual_have',
      }),
      'confirmed_available',
    )
  },
)

test(
  'M09 inference remains inferred available',
  () => {
    assert.equal(
      derivePantryStateFromObservation({
        sourceType:
          'inference',
      }),
      'inferred_available',
    )
  },
)

test(
  'M09 explicit quantity correction is stronger than inference',
  () => {
    assert.ok(
      deriveObservationEvidenceStrength(
        'manual_quantity_correction',
      ) >
        deriveObservationEvidenceStrength(
          'inference',
        ),
    )
  },
)

test(
  'M09 reliable purchase evidence is stronger than inference',
  () => {
    assert.ok(
      deriveObservationEvidenceStrength(
        'marketplace_purchase',
      ) >
        deriveObservationEvidenceStrength(
          'inference',
        ),
    )
  },
)

test(
  'M09 confidence decay is deterministic',
  () => {
    const result =
      calculateDecayedPantryConfidence({
        baseConfidence:
          1,

        observedAt:
          '2026-08-01T00:00:00.000Z',

        now:
          '2026-08-11T00:00:00.000Z',

        halfLifeDays:
          10,
      })

    assert.equal(
      result,
      0.5,
    )
  },
)

test(
  'M09 inferred Pantry quantity is never exposed as exact current inventory',
  () => {
    const quantity =
      sanitizeQuantityForPantryState(
        {
          mode:
            'exact',

          value:
            500,

          unit:
            'g',
        },
        'inferred_available',
      )

    assert.equal(
      quantity.mode,
      'unknown',
    )

    assert.equal(
      quantity.value,
      null,
    )
  },
)

test(
  'M09 confirmed Pantry quantity may retain explicit exact value',
  () => {
    const quantity =
      sanitizeQuantityForPantryState(
        {
          mode:
            'exact',

          value:
            500,

          unit:
            'g',
        },
        'confirmed_available',
      )

    assert.equal(
      quantity.mode,
      'exact',
    )

    assert.equal(
      quantity.value,
      500,
    )
  },
)

test(
  'M09 inferred quantity range may remain an honest range',
  () => {
    const quantity =
      sanitizeQuantityForPantryState(
        {
          mode:
            'range',

          min:
            100,

          max:
            200,

          unit:
            'g',
        },
        'inferred_available',
      )

    assert.equal(
      quantity.mode,
      'range',
    )

    assert.equal(
      quantity.min,
      100,
    )

    assert.equal(
      quantity.max,
      200,
    )
  },
)

test(
  'M09 finished Pantry item projects as out',
  () => {
    const observation =
      buildPantryObservationProjection({
        input: {
          sourceType:
            'finished',

          quantity: {
            mode:
              'exact',

            value:
              0,

            unit:
              'g',
          },
        },

        observedAt:
          '2026-08-20T00:00:00.000Z',
      })

    assert.equal(
      observation.stateSignal,
      'out',
    )

    assert.equal(
      observation.quantitySignal.value,
      0,
    )
  },
)

test(
  'M09 bought elsewhere remains distinct Pantry state',
  () => {
    const observation =
      buildPantryObservationProjection({
        input: {
          sourceType:
            'bought_elsewhere',

          quantity: {
            mode:
              'exact',

            value:
              1,

            unit:
              'piece',
          },
        },
      })

    assert.equal(
      observation.stateSignal,
      'replenished_elsewhere',
    )
  },
)

test(
  'M09 do not track removes current quantity projection',
  () => {
    const observation =
      buildPantryObservationProjection({
        currentItem: {
          state:
            'confirmed_available',

          quantityEstimate: {
            mode:
              'exact',

            value:
              2,

            unit:
              'piece',
          },
        },

        input: {
          sourceType:
            'do_not_track',
        },
      })

    const projected =
      projectPantryItemFromObservation({
        currentItem:
          null,

        observation,
      })

    assert.equal(
      projected.item.state,
      'do_not_track',
    )

    assert.equal(
      projected.item
        .quantityEstimate
        .mode,
      'unknown',
    )
  },
)

test(
  'M09 stale observation stays in history but cannot rewrite newer Pantry projection',
  () => {
    const result =
      shouldApplyPantryObservation({
        currentItem: {
          lastObservationAt:
            new Date(
              '2026-08-20T12:00:00.000Z',
            ),

          evidenceStrength:
            80,
        },

        observation: {
          observedAt:
            new Date(
              '2026-08-19T12:00:00.000Z',
            ),

          evidenceStrength:
            100,
        },
      })

    assert.equal(
      result.apply,
      false,
    )

    assert.equal(
      result.reason,
      'stale_observation_preserved_in_history',
    )
  },
)

test(
  'M09 stronger evidence wins when observations have same timestamp',
  () => {
    const result =
      shouldApplyPantryObservation({
        currentItem: {
          lastObservationAt:
            new Date(
              '2026-08-20T12:00:00.000Z',
            ),

          evidenceStrength:
            40,
        },

        observation: {
          observedAt:
            new Date(
              '2026-08-20T12:00:00.000Z',
            ),

          evidenceStrength:
            100,
        },
      })

    assert.equal(
      result.apply,
      true,
    )

    assert.equal(
      result.reason,
      'same_time_stronger_or_equal_evidence',
    )
  },
)

test(
  'M09 weaker same-time inference cannot replace explicit correction',
  () => {
    const result =
      shouldApplyPantryObservation({
        currentItem: {
          lastObservationAt:
            new Date(
              '2026-08-20T12:00:00.000Z',
            ),

          evidenceStrength:
            100,
        },

        observation: {
          observedAt:
            new Date(
              '2026-08-20T12:00:00.000Z',
            ),

          evidenceStrength:
            40,
        },
      })

    assert.equal(
      result.apply,
      false,
    )
  },
)

test(
  'M09 opened observation preserves current availability state',
  () => {
    const observation =
      buildPantryObservationProjection({
        currentItem: {
          state:
            'confirmed_available',

          quantityEstimate: {
            mode:
              'exact',

            value:
              500,

            unit:
              'ml',
          },
        },

        input: {
          sourceType:
            'opened',

          openedAt:
            '2026-08-20T12:00:00.000Z',
        },

        observedAt:
          '2026-08-20T12:00:00.000Z',
      })

    assert.equal(
      observation.stateSignal,
      'confirmed_available',
    )
  },
)

test(
  'M09 storage update does not invent new availability state',
  () => {
    assert.equal(
      derivePantryStateFromObservation({
        sourceType:
          'storage_update',

        currentState:
          'running_low',
      }),
      'running_low',
    )
  },
)

test(
  'M09 decayed confirmed state becomes uncertain instead of exact stock truth',
  () => {
    const projected =
      projectPantryItemAtTime(
        {
          state:
            'confirmed_available',

          confidence:
            0.98,

          lastSourceType:
            'manual_have',

          lastObservationAt:
            new Date(
              '2026-01-01T00:00:00.000Z',
            ),

          quantityEstimate: {
            mode:
              'exact',

            value:
              500,

            unit:
              'g',
          },
        },

        new Date(
          '2026-08-01T00:00:00.000Z',
        ),
      )

    assert.equal(
      projected.state,
      'uncertain',
    )

    assert.equal(
      projected
        .quantityEstimate
        .mode,
      'unknown',
    )
  },
)

test(
  'M09 do not track does not decay into inferred availability',
  () => {
    const projected =
      projectPantryItemAtTime(
        {
          state:
            'do_not_track',

          confidence:
            1,

          lastSourceType:
            'do_not_track',

          lastObservationAt:
            new Date(
              '2020-01-01T00:00:00.000Z',
            ),

          quantityEstimate: {
            mode:
              'unknown',
          },
        },

        new Date(
          '2026-08-20T00:00:00.000Z',
        ),
      )

    assert.equal(
      projected.state,
      'do_not_track',
    )
  },
)