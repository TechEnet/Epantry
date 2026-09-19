import mongoose from 'mongoose'

import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js'

import {
  env,
} from '../src/config/env.js'

import {
  HostOffer,
} from '../src/modules/marketplace/marketplace.models.js'

const CONFIRMATION =
  'ALLOW_RELIST_AFTER_RETIREMENT'

function hasConfirmation() {
  return process.argv.includes(
    `--confirm=${CONFIRMATION}`,
  )
}

function sameKey(
  left,
  right,
) {
  return JSON.stringify(
    left,
  ) === JSON.stringify(
    right,
  )
}

const PACK_KEY = {
  organizationId: 1,
  packId: 1,
}

const SKU_KEY = {
  organizationId: 1,
  merchantSku: 1,
}

const CURRENT_STATUS_FILTER = {
  status: {
    $in: [
      'draft',
      'active',
      'paused',
    ],
  },
}

async function main() {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Host Offer index migration is blocked in production.',
    )
  }

  await connectDatabase()

  const collection =
    HostOffer.collection

  const indexes =
    await collection.indexes()

  const targetIndexes =
    indexes.filter(
      (index) =>
        sameKey(
          index.key,
          PACK_KEY,
        ) ||
        sameKey(
          index.key,
          SKU_KEY,
        ),
    )

  console.log(
    '\nHost Offer relisting index migration preview',
  )

  console.table(
    targetIndexes.map(
      (index) => ({
        action:
          'REPLACE INDEX',
        name:
          index.name,
        key:
          JSON.stringify(
            index.key,
          ),
        unique:
          Boolean(
            index.unique,
          ),
        partialFilter:
          index.partialFilterExpression
            ? JSON.stringify(
                index.partialFilterExpression,
              )
            : 'none',
      }),
    ),
  )

  const retiredCount =
    await HostOffer.countDocuments({
      status:
        'retired',
    })

  const currentCount =
    await HostOffer.countDocuments({
      status: {
        $in: [
          'draft',
          'active',
          'paused',
        ],
      },
    })

  console.log(
    `\nCurrent Offers: ${currentCount}`,
  )
  console.log(
    `Retired historical Offers: ${retiredCount}`,
  )
  console.log(
    'Retired Offers will remain in history; they will simply stop blocking a fresh listing for the same Pack/SKU.',
  )

  if (!hasConfirmation()) {
    console.log(
      '\nDRY RUN ONLY. No indexes were changed.',
    )
    console.log(
      `Run again with --confirm=${CONFIRMATION} to apply the migration.`,
    )
    return
  }

  for (const index of targetIndexes) {
    if (
      index.name ===
      '_id_'
    ) {
      continue
    }

    await collection.dropIndex(
      index.name,
    )
  }

  await collection.createIndex(
    PACK_KEY,
    {
      unique:
        true,

      partialFilterExpression:
        CURRENT_STATUS_FILTER,
    },
  )

  await collection.createIndex(
    SKU_KEY,
    {
      unique:
        true,

      partialFilterExpression: {
        ...CURRENT_STATUS_FILTER,

        merchantSku: {
          $type:
            'string',

          $gt:
            '',
        },
      },
    },
  )

  const after =
    await collection.indexes()

  const migrated =
    after.filter(
      (index) =>
        sameKey(
          index.key,
          PACK_KEY,
        ) ||
        sameKey(
          index.key,
          SKU_KEY,
        ),
    )

  console.log(
    '\nUpdated Host Offer indexes',
  )

  console.table(
    migrated.map(
      (index) => ({
        name:
          index.name,
        key:
          JSON.stringify(
            index.key,
          ),
        unique:
          Boolean(
            index.unique,
          ),
        partialFilter:
          JSON.stringify(
            index.partialFilterExpression ||
              {},
          ),
      }),
    ),
  )

  const packIndex =
    migrated.find(
      (index) =>
        sameKey(
          index.key,
          PACK_KEY,
        ),
    )

  const skuIndex =
    migrated.find(
      (index) =>
        sameKey(
          index.key,
          SKU_KEY,
        ),
    )

  if (
    !packIndex?.unique ||
    !packIndex?.partialFilterExpression ||
    !skuIndex?.unique ||
    !skuIndex?.partialFilterExpression
  ) {
    throw new Error(
      'Migration verification failed: current-only unique indexes were not created correctly.',
    )
  }

  console.log(
    '\nMigration verified. Retired Host Offers no longer block re-listing the same Pack or Merchant SKU.',
  )
}

main()
  .catch((error) => {
    console.error(
      '\nHost Offer index migration failed:',
      error,
    )

    process.exitCode = 1
  })
  .finally(async () => {
    if (
      mongoose.connection.readyState !==
      0
    ) {
      await disconnectDatabase()
    }
  })
