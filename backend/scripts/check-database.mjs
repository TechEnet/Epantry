import mongoose from 'mongoose'

import { connectDatabase, disconnectDatabase } from '../src/config/db.js'

const baselineMode =
  process.argv.includes(
    '--baseline',
  )

const FOCUS_GROUPS = {
  recipes: [
    /^dishes$/i,
    /^recipeversions$/i,
    /^recipeingredients$/i,
    /^recipesteps$/i,
  ],

  communityRecipes: [
    /community/i,
  ],

  hostProfiles: [
    /^users$/i,
    /marketplaceorganizations/i,
    /host/i,
  ],

  hospitality: [
    /^hospitality/i,
  ],

  creatorContent: [
    /creator/i,
  ],

  subscriptionsAndEntitlements: [
    /entitlement/i,
    /subscription/i,
    /learning/i,
  ],

  notifications: [
    /notification/i,
  ],
}

function matchesAny(
  name,
  expressions,
) {
  return expressions.some(
    (expression) =>
      expression.test(
        name,
      ),
  )
}

async function captureBaseline() {
  const database =
    mongoose.connection.db

  if (!database) {
    throw new Error(
      'MongoDB connection does not expose a database handle.',
    )
  }

  const collectionMetadata =
    await database
      .listCollections(
        {},
        {
          nameOnly:
            true,
        },
      )
      .toArray()

  const collections =
    []

  for (
    const metadata of collectionMetadata
      .filter(
        (item) =>
          item?.name,
      )
      .sort(
        (left, right) =>
          left.name.localeCompare(
            right.name,
          ),
      )
  ) {
    const count =
      await database
        .collection(
          metadata.name,
        )
        .countDocuments(
          {},
        )

    collections.push({
      name:
        metadata.name,

      count,
    })
  }

  const focus =
    Object.fromEntries(
      Object.entries(
        FOCUS_GROUPS,
      ).map(
        ([
          key,
          expressions,
        ]) => [
          key,
          collections.filter(
            (collection) =>
              matchesAny(
                collection.name,
                expressions,
              ),
          ),
        ],
      ),
    )

  return {
    capturedAt:
      new Date().toISOString(),

    databaseName:
      database.databaseName ||
      null,

    mode:
      'read_only_m0_baseline',

    relationships: {
      officialRecipe:
        'RecipeVersion.dishId -> Dish._id; ingredient/step records reference RecipeVersion._id',

      communityRecipe:
        'Community recipe records retain creator ownership and RecipeVersion lineage',

      hostOrganization:
        'Host identity -> MarketplaceOrganization owner/membership -> organizationType',

      hospitality:
        'Hospitality entities remain organization-scoped and may reference source RecipeVersion lineage',

      learning:
        'Learning progress/entitlements remain userId + courseId scoped',

      notifications:
        'Notification records remain user-scoped with dedupe/deep-link metadata',
    },

    focus,

    collections,
  }
}

try {
  await connectDatabase()

  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB did not reach connected state')
  }

  console.log('MongoDB readiness check passed.')

  if (baselineMode) {
    const baseline =
      await captureBaseline()

    console.log(
      JSON.stringify(
        baseline,
        null,
        2,
      ),
    )
  }

  await disconnectDatabase()
} catch (error) {
  console.error(`MongoDB readiness check failed: ${error.message}`)
  process.exitCode = 1
}
