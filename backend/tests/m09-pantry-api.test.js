import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

import {
  test,
} from 'node:test'

import {
  pantryHistoryQuerySchema,
  pantryItemPatchSchema,
  pantryListQuerySchema,
  pantryPreferencesPatchSchema,
} from '../src/modules/pantry/pantry.api.validation.js'

const projectRoot =
  new URL(
    '..',
    import.meta.url,
  )

async function readProjectFile(
  path,
) {
  return readFile(
    new URL(
      path,
      projectRoot,
    ),
    'utf8',
  )
}

/*
|--------------------------------------------------------------------------
| Browse Validation
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry browse uses bounded deterministic pagination',

  () => {
    const result =
      pantryListQuerySchema.parse(
        {},
      )

    assert.equal(
      result.page,
      1,
    )

    assert.equal(
      result.limit,
      50,
    )

    assert.throws(
      () =>
        pantryListQuerySchema.parse({
          limit:
            101,
        }),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Item Patch
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry item patch requires explicit quantity for manual correction',

  () => {
    assert.throws(
      () =>
        pantryItemPatchSchema.parse({
          sourceType:
            'manual_quantity_correction',
        }),
    )
  },
)

test(
  'M09 Pantry item patch accepts deterministic exact quantity correction',

  () => {
    const result =
      pantryItemPatchSchema.parse({
        sourceType:
          'manual_quantity_correction',

        quantity: {
          mode:
            'exact',

          value:
            250,

          unit:
            'g',
        },
      })

    assert.equal(
      result.sourceType,
      'manual_quantity_correction',
    )

    assert.equal(
      result.quantity.mode,
      'exact',
    )

    assert.equal(
      result.quantity.value,
      250,
    )

    assert.equal(
      result.quantity.unit,
      'g',
    )
  },
)

test(
  'M09 do-not-track patch cannot smuggle quantity',

  () => {
    assert.throws(
      () =>
        pantryItemPatchSchema.parse({
          sourceType:
            'do_not_track',

          quantity: {
            mode:
              'exact',

            value:
              10,

            unit:
              'g',
          },
        }),
    )
  },
)

test(
  'M09 storage update requires explicit storage zone',

  () => {
    assert.throws(
      () =>
        pantryItemPatchSchema.parse({
          sourceType:
            'storage_update',
        }),
    )
  },
)

/*
|--------------------------------------------------------------------------
| History
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry history pagination is bounded',

  () => {
    assert.deepEqual(
      pantryHistoryQuerySchema.parse(
        {},
      ),
      {
        page:
          1,

        limit:
          50,
      },
    )

    assert.throws(
      () =>
        pantryHistoryQuerySchema.parse({
          limit:
            1000,
        }),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Preferences
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry preferences expose only Pantry-owned controls',

  () => {
    const result =
      pantryPreferencesPatchSchema.safeParse({
        pantryTrackingEnabled:
          false,

        householdId:
          '64b000000000000000000001',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M09 Pantry preferences require at least one actual change',

  () => {
    assert.equal(
      pantryPreferencesPatchSchema.safeParse(
        {},
      ).success,
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Router Security
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry router requires session active account and Customer capability',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.routes.js',
      )

    assert.match(
      source,
      /authenticateSession/,
    )

    assert.match(
      source,
      /loadCurrentUser/,
    )

    assert.match(
      source,
      /requireActiveAccount/,
    )

    assert.match(
      source,
      /requireCustomerAccess/,
    )

    assert.doesNotMatch(
      source,
      /requireHostAccess/,
    )

    assert.doesNotMatch(
      source,
      /requireSuperAdminAccess/,
    )

    assert.doesNotMatch(
      source,
      /requireMfaAssurance/,
    )
  },
)

test(
  'M09 Pantry mutations are CSRF protected',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.routes.js',
      )

    assert.match(
      source,
      /router\.post\(\s*'\/observations',\s*requireCsrfToken/s,
    )

    assert.match(
      source,
      /router\.patch\(\s*'\/items\/:id',\s*requireCsrfToken/s,
    )

    assert.match(
      source,
      /router\.patch\(\s*'\/preferences',\s*requireCsrfToken/s,
    )
  },
)

test(
  'M09 Pantry API exposes documented browse observation and correction surfaces',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.routes.js',
      )

    assert.match(
      source,
      /router\.get\(\s*'\/'/s,
    )

    assert.match(
      source,
      /'\/observations'/,
    )

    assert.match(
      source,
      /'\/items\/:id'/,
    )

    assert.match(
      source,
      /'\/items\/:id\/history'/,
    )

    assert.match(
      source,
      /'\/preferences'/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Household Ownership
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry service derives Household from authenticated membership',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.service.js',
      )

    assert.match(
      source,
      /HouseholdMembership/,
    )

    assert.match(
      source,
      /status:\s*'active'/,
    )

    assert.match(
      source,
      /HOUSEHOLD_MEMBERSHIP_REQUIRED/,
    )

    assert.match(
      source,
      /PANTRY_HOUSEHOLD_SELECTION_REQUIRED/,
    )

    assert.doesNotMatch(
      source,
      /superAdminEnabled/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Append-only History
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry item correction is implemented as observation not arbitrary state PATCH',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.service.js',
      )

    assert.match(
      source,
      /createPantryObservationForHousehold/,
    )

    assert.match(
      source,
      /updatePantryItemFromCustomer/,
    )

    assert.match(
      source,
      /PantryObservation\.create/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Compile Router
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry API route module compiles',

  async () => {
    const module =
      await import(
        '../src/modules/pantry/pantry.routes.js'
      )

    assert.ok(
      module.default,
    )
  },
)