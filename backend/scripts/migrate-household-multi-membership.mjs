import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js'

import {
  env,
} from '../src/config/env.js'

import {
  HouseholdMembership,
} from '../src/modules/households/householdMembership.model.js'

const CONFIRMATION =
  'ENABLE_MULTI_HOUSEHOLD_MEMBERSHIPS'

function hasConfirmation() {
  return process.argv.includes(
    `--confirm=${CONFIRMATION}`,
  )
}

async function main() {
  if (
    env.nodeEnv ===
    'production'
  ) {
    throw new Error(
      'Multi-household membership migration is blocked in production.',
    )
  }

  await connectDatabase()

  const collection =
    HouseholdMembership.collection

  const indexes =
    await collection.indexes()

  const oldIndex =
    indexes.find(
      (index) =>
        index.name ===
        'one_active_household_per_user',
    ) ||
    null

  const activeMembershipCount =
    await HouseholdMembership.countDocuments({
      status:
        'active',
    })

  const activeUsers =
    await HouseholdMembership.aggregate([
      {
        $match: {
          status:
            'active',
        },
      },
      {
        $group: {
          _id:
            '$userId',
          count: {
            $sum:
              1,
          },
        },
      },
    ])

  console.log(
    '\nHousehold multi-membership migration preview',
  )
  console.log(
    `Active Household memberships: ${activeMembershipCount}`,
  )
  console.log(
    `Users with active Household membership: ${activeUsers.length}`,
  )
  console.log(
    oldIndex
      ? 'Will drop legacy index: one_active_household_per_user'
      : 'Legacy one-active-household index is already absent.',
  )
  console.log(
    'Will backfill selectedForContext so each user keeps exactly one working Household context.',
  )

  if (!hasConfirmation()) {
    console.log(
      '\nDRY RUN ONLY. No membership data or indexes were changed.',
    )
    console.log(
      `Run again with --confirm=${CONFIRMATION} to apply the migration.`,
    )
    return
  }

  await HouseholdMembership.updateMany(
    {
      selectedForContext: {
        $exists:
          false,
      },
    },
    {
      $set: {
        selectedForContext:
          false,
      },
    },
  )

  await HouseholdMembership.updateMany(
    {
      status:
        'active',
    },
    {
      $set: {
        selectedForContext:
          false,
      },
    },
  )

  for (
    const group of
    activeUsers
  ) {
    const membership =
      await HouseholdMembership.findOne({
        userId:
          group._id,
        status:
          'active',
      })
        .sort({
          joinedAt:
            1,
          createdAt:
            1,
        })
        .select(
          '_id',
        )
        .lean()

    if (
      membership?._id
    ) {
      await HouseholdMembership.updateOne(
        {
          _id:
            membership._id,
        },
        {
          $set: {
            selectedForContext:
              true,
          },
        },
      )
    }
  }

  if (oldIndex) {
    await collection.dropIndex(
      oldIndex.name,
    )
  }

  await collection.createIndex(
    {
      userId:
        1,
    },
    {
      unique:
        true,
      partialFilterExpression: {
        status:
          'active',
        selectedForContext:
          true,
      },
      name:
        'one_selected_household_context_per_user',
    },
  )

  console.log(
    '\nMigration applied successfully.',
  )
  console.log(
    'Users may now hold multiple active Household memberships while one membership remains selected as the working context.',
  )
}

main()
  .catch(
    (error) => {
      console.error(
        error,
      )
      process.exitCode =
        1
    },
  )
  .finally(
    async () => {
      await disconnectDatabase()
    },
  )
