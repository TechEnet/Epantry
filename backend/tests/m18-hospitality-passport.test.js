import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename =
  fileURLToPath(
    import.meta.url,
  )

const __dirname =
  path.dirname(
    __filename,
  )

const projectRoot =
  path.resolve(
    __dirname,
    '..',
    '..',
  )

function readBackend(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      'backend',
      relativePath,
    ),
    'utf8',
  )
}

function readFrontend(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      'frontend',
      relativePath,
    ),
    'utf8',
  )
}

test(
  'M18 Batch 2 registers immutable Dish Passport Grey Book and Change Case collections',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.models.js',
      )

    for (const collection of [
      'dishPassportSnapshots',
      'greyBookSnapshots',
      'hospitalityChangeCases',
    ]) {
      assert.match(
        source,
        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    assert.match(
      source,
      /Dish Passport snapshot content is immutable/,
    )

    assert.match(
      source,
      /Grey Book history is immutable/,
    )
  },
)

test(
  'M18 Dish Passport generation pins M18 M07 M08 and optional ProductVersion lineage',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    for (const token of [
      'HospitalityProductionRecipeVersion',
      'RecipeVersion',
      'FoodCalculation',
      'ProductVersion',
      'sourceVersions',
      'ruleProfileVersions',
    ]) {
      assert.equal(
        source.includes(token),
        true,
        `${token} must remain part of Passport lineage.`,
      )
    }
  },
)

test(
  'M18 blocks using a different Production Recipe formulation with an M08 calculation from another recipe shape',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      source,
      /RecipeIngredient\.find/,
    )

    assert.match(
      source,
      /sourcePerServing/,
    )

    assert.match(
      source,
      /productionPerServing/,
    )

    assert.match(
      source,
      /HOSPITALITY_PASSPORT_SOURCE_RECIPE_MISMATCH_RECALCULATION_REQUIRED/,
    )
  },
)

test(
  'M18 public Passport fails closed on unknown safety evidence',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      source,
      /unknown_review_required/,
    )

    assert.match(
      source,
      /HOSPITALITY_PASSPORT_PUBLICATION_VERIFICATION_REQUIRED/,
    )

    assert.match(
      source,
      /verificationState:\s*['"]verified['"]/,
    )

    assert.match(
      source,
      /unknownAllergenEvidenceFailsClosed:\s*true/,
    )
  },
)

test(
  'M18 Dish Passport approval uses maker checker and governance evidence',
  () => {
    const models =
      readBackend(
        'src/modules/hospitality/hospitality.passport.models.js',
      )

    const service =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      service,
      /HOSPITALITY_PASSPORT_MAKER_CHECKER_REQUIRED/,
    )

    assert.match(
      service,
      /snapshot\.generatedByUserId/,
    )

    assert.match(
      models,
      /governanceEvents/,
    )

    assert.match(
      models,
      /evidenceSchema/,
    )
  },
)

test(
  'M18 Grey Book pins published Passport snapshot IDs and supports bounded JSON CSV export',
  () => {
    const models =
      readBackend(
        'src/modules/hospitality/hospitality.passport.models.js',
      )

    const routes =
      readBackend(
        'src/modules/hospitality/hospitality.passport.routes.js',
      )

    const service =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      models,
      /passportSnapshotIds/,
    )

    assert.match(
      service,
      /containsOnlyPublishedVerifiedPassports/,
    )

    assert.match(
      routes,
      /['"]\/grey-books\/:id\/export['"]/,
    )

    assert.match(
      routes,
      /text\/csv/,
    )
  },
)

test(
  'M18 Change Case traverses production recipes menus outlets passports and Grey Books',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    for (const token of [
      'impactedProductionRecipes',
      'HospitalityMenuItem',
      'HospitalityMenu',
      'baselinePassportSnapshotIds',
      'baselineGreyBookSnapshotIds',
      'candidatePassportSnapshotIds',
    ]) {
      assert.equal(
        source.includes(token),
        true,
        `${token} must remain in the M18 impact graph.`,
      )
    }
  },
)

test(
  'M18 Change Case severity makes allergen changes critical',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      source,
      /values\.has\(\s*['"]allergen['"]/,
    )

    assert.match(
      source,
      /return ['"]allergen_critical['"]/,
    )
  },
)

test(
  'M18 Change Case cannot auto publish source changes',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      source,
      /automaticPublication:\s*false/,
    )

    assert.match(
      source,
      /HOSPITALITY_CHANGE_CASE_APPROVAL_REQUIRED/,
    )

    assert.match(
      source,
      /HOSPITALITY_CHANGE_CASE_MAKER_CHECKER_REQUIRED/,
    )
  },
)

test(
  'M18 frontend exposes B01 through B11 Hospitality navigation',
  () => {
    const source =
      readFrontend(
        'src/features/hospitality/components/HospitalityShell.jsx',
      )

    for (
      let index = 1;
      index <= 11;
      index += 1
    ) {
      const code =
        `B${String(index).padStart(2, '0')}`

      assert.equal(
        source.includes(code),
        true,
        `${code} must remain in Hospitality navigation.`,
      )
    }
  },
)

test(
  'M18 frontend public Passport explicitly avoids blanket free-from claims',
  () => {
    const source =
      readFrontend(
        'src/features/hospitality/pages/PublicDishPassportPage.jsx',
      )

    assert.match(
      source,
      /Unknown allergen evidence is not presented as a free-from claim/,
    )

    assert.match(
      source,
      /This is not a blanket free-from statement/,
    )
  },
)