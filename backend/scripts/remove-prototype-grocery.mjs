import mongoose from 'mongoose'

import products from '../seed-data/products.js'
import internationalProducts from '../seed-data/internationalProducts.js'

import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js'

import {
  env,
} from '../src/config/env.js'

import {
  EvidenceSource,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../src/modules/catalog/catalog.models.js'

import {
  FoodCalculation,
} from '../src/modules/foodIntelligence/foodIntelligence.models.js'

const REQUIRED_CONFIRMATION =
  '--confirm=REMOVE_PROTOTYPE_GROCERY'

const SEED_CHANGE_REASON =
  'Development seed migration from legacy M01 catalog.'

const prototypeProducts = [
  ...products,
  ...internationalProducts,
]

const prototypeLegacyIds = [
  ...new Set(
    prototypeProducts
      .map((item) => String(item?.id || '').trim())
      .filter(Boolean),
  ),
]

function uniqueObjectIds(values) {
  return [
    ...new Set(
      values
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  ]
    .filter((value) => mongoose.isValidObjectId(value))
    .map((value) => new mongoose.Types.ObjectId(value))
}

function deletedCount(result) {
  return Number(result?.deletedCount || 0)
}

async function removePrototypeGrocery() {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Prototype grocery cleanup is blocked in production.',
    )
  }

  if (!process.argv.includes(REQUIRED_CONFIRMATION)) {
    throw new Error(
      `Explicit confirmation is required. Run with ${REQUIRED_CONFIRMATION}`,
    )
  }

  await connectDatabase()

  const summary = {
    legacyPrototypeProducts: 0,
    seedEvidenceSources: 0,
    productFoodCalculations: 0,
    productVersions: 0,
    orphanPacks: 0,
    orphanVariants: 0,
    orphanFamilies: 0,
  }

  /*
  |--------------------------------------------------------------------------
  | 1. Find ONLY the canonical product versions created by the old
  |    development grocery seed.
  |--------------------------------------------------------------------------
  |
  | Brand, Category, Host, Recipe, User, Brand Authority, NPI drafts,
  | Offers, Inventory, Orders and every other project domain are untouched.
  |
  */

  const seedEvidence = await EvidenceSource.find(
    {
      entityType: 'product_version',
      'metadata.seedSource': 'development_seed',
      'metadata.seedVersion': 'm04',
      'metadata.legacyProductId': {
        $in: prototypeLegacyIds,
      },
    },
    {
      _id: 1,
      entityId: 1,
    },
  ).lean()

  const seedEvidenceIds = uniqueObjectIds(
    seedEvidence.map((item) => item?._id),
  )

  const candidateVersionIds = uniqueObjectIds(
    seedEvidence.map((item) => item?.entityId),
  )

  const seedVersions = candidateVersionIds.length
    ? await ProductVersion.find(
        {
          _id: {
            $in: candidateVersionIds,
          },
          changeReason: SEED_CHANGE_REASON,
          createdByUserId: null,
        },
        {
          _id: 1,
          packId: 1,
          variantId: 1,
        },
      ).lean()
    : []

  const seedVersionIds = uniqueObjectIds(
    seedVersions.map((item) => item?._id),
  )

  const affectedPackIds = uniqueObjectIds(
    seedVersions.map((item) => item?.packId),
  )

  const affectedVariantIds = uniqueObjectIds(
    seedVersions.map((item) => item?.variantId),
  )

  /*
  |--------------------------------------------------------------------------
  | 2. Remove Food Intelligence calculations attached ONLY to those old
  |    prototype ProductVersions.
  |--------------------------------------------------------------------------
  */

  if (seedVersionIds.length) {
    summary.productFoodCalculations = deletedCount(
      await FoodCalculation.deleteMany({
        entityType: 'product_version',
        entityId: {
          $in: seedVersionIds,
        },
      }),
    )
  }

  /*
  |--------------------------------------------------------------------------
  | 3. Remove the old seed ProductVersions and their seed evidence only.
  |--------------------------------------------------------------------------
  */

  if (seedVersionIds.length) {
    summary.productVersions = deletedCount(
      await ProductVersion.deleteMany({
        _id: {
          $in: seedVersionIds,
        },
        changeReason: SEED_CHANGE_REASON,
        createdByUserId: null,
      }),
    )
  }

  if (seedEvidenceIds.length) {
    summary.seedEvidenceSources = deletedCount(
      await EvidenceSource.deleteMany({
        _id: {
          $in: seedEvidenceIds,
        },
        'metadata.seedSource': 'development_seed',
      }),
    )
  }

  /*
  |--------------------------------------------------------------------------
  | 4. Remove ONLY now-empty hierarchy records that belonged to those seed
  |    versions. If a Pack/Variant/Family has any real data, it is preserved.
  |--------------------------------------------------------------------------
  */

  for (const packId of affectedPackIds) {
    const remainingVersion = await ProductVersion.exists({
      packId,
    })

    if (!remainingVersion) {
      const pack = await Pack.findById(
        packId,
        {
          _id: 1,
          variantId: 1,
        },
      ).lean()

      if (pack) {
        summary.orphanPacks += deletedCount(
          await Pack.deleteOne({
            _id: pack._id,
          }),
        )

        if (pack.variantId) {
          affectedVariantIds.push(
            new mongoose.Types.ObjectId(
              String(pack.variantId),
            ),
          )
        }
      }
    }
  }

  const uniqueVariantIds = uniqueObjectIds(
    affectedVariantIds,
  )

  const affectedFamilyIds = []

  for (const variantId of uniqueVariantIds) {
    const remainingPack = await Pack.exists({
      variantId,
    })

    if (!remainingPack) {
      const variant = await ProductVariant.findById(
        variantId,
        {
          _id: 1,
          familyId: 1,
        },
      ).lean()

      if (variant) {
        summary.orphanVariants += deletedCount(
          await ProductVariant.deleteOne({
            _id: variant._id,
          }),
        )

        if (variant.familyId) {
          affectedFamilyIds.push(
            variant.familyId,
          )
        }
      }
    }
  }

  for (const familyId of uniqueObjectIds(affectedFamilyIds)) {
    const remainingVariant = await ProductVariant.exists({
      familyId,
    })

    if (!remainingVariant) {
      summary.orphanFamilies += deletedCount(
        await ProductFamily.deleteOne({
          _id: familyId,
        }),
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | 5. Remove the old M01 compatibility copies of the SAME automatic grocery
  |    seed records. No Brand or Recipe records are touched.
  |--------------------------------------------------------------------------
  */

  summary.legacyPrototypeProducts = deletedCount(
    await mongoose.connection
      .collection('products')
      .deleteMany({
        id: {
          $in: prototypeLegacyIds,
        },
        seedSource: 'development_seed',
        seedVersion: 'm01',
      }),
  )

  console.log('\nPrototype grocery cleanup complete.\n')
  console.table(summary)

  console.log(
    '\nPreserved: Hosts, users, brands, brand authority, recipes, categories, NPI drafts, offers, inventory, orders and all non-seed grocery listings.',
  )
}

try {
  await removePrototypeGrocery()
} catch (error) {
  console.error(`Prototype grocery cleanup failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}
