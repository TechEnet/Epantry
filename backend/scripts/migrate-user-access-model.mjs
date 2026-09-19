import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js'

import mongoose from 'mongoose'

const APPLY_CHANGES =
  process.argv.includes(
    '--apply',
  )

const LEGACY_HOST_ACCOUNT_TYPES =
  new Set([
    'seller',
    'brand',
    'b2b',
    'host',
  ])

const LEGACY_HOST_ROLES =
  new Set([
    'seller',
    'brand',
    'b2b_operator',
    'host',
  ])

const VALID_GLOBAL_STATUSES =
  new Set([
    'active',
    'suspended',
    'disabled',
    'locked',
  ])

const VALID_HOST_ACCESS_STATUSES =
  new Set([
    'not_requested',
    'pending',
    'active',
    'rejected',
    'suspended',
  ])

const VALID_MODES =
  new Set([
    'customer',
    'host',
  ])

function hasLegacyRole(
  roles,
  role,
) {
  return Array.isArray(
    roles,
  ) &&
    roles.includes(
      role,
    )
}

function hasAnyLegacyHostRole(
  roles,
) {
  if (
    !Array.isArray(
      roles,
    )
  ) {
    return false
  }

  return roles.some(
    (role) =>
      LEGACY_HOST_ROLES.has(
        role,
      ),
  )
}

function resolveGlobalAccountStatus({
  document,
  legacyHostTrack,
}) {
  if (
    VALID_GLOBAL_STATUSES.has(
      document.accountStatus,
    )
  ) {
    return document.accountStatus
  }

  /*
  |--------------------------------------------------------------------------
  | Old Business Pending / Rejected State
  |--------------------------------------------------------------------------
  |
  | Business approval used to be stored in global accountStatus.
  |
  | It now moves into hostAccessStatus so Customer access can remain active.
  |
  */

  if (
    legacyHostTrack &&
    [
      'pending',
      'rejected',
    ].includes(
      document.accountStatus,
    )
  ) {
    return 'active'
  }

  /*
  |--------------------------------------------------------------------------
  | Unknown Legacy State = Fail Closed
  |--------------------------------------------------------------------------
  */

  return 'disabled'
}

function resolveHostAccessStatus({
  document,
  legacyHostTrack,
  legacyHostGranted,
}) {
  if (
    VALID_HOST_ACCESS_STATUSES.has(
      document.hostAccessStatus,
    )
  ) {
    return document.hostAccessStatus
  }

  if (
    document.hostEnabled ===
      true ||
    legacyHostGranted
  ) {
    return 'active'
  }

  if (
    !legacyHostTrack
  ) {
    return 'not_requested'
  }

  switch (
    document.accountStatus
  ) {
    case 'rejected':
      return 'rejected'

    case 'suspended':
      return 'suspended'

    case 'pending':
    case 'active':
    case 'disabled':
    case 'locked':
    default:
      return 'pending'
  }
}

function resolveNewAccessState(
  document,
) {
  const legacyRoles =
    Array.isArray(
      document.roles,
    )
      ? document.roles
      : []

  const legacyAccountType =
    String(
      document.accountType ||
        '',
    ).trim()

  const legacyHostTrack =
    LEGACY_HOST_ACCOUNT_TYPES.has(
      legacyAccountType,
    )

  const legacyHostGranted =
    hasAnyLegacyHostRole(
      legacyRoles,
    )

  const legacySuperAdmin =
    legacyAccountType ===
      'super_admin' ||
    hasLegacyRole(
      legacyRoles,
      'super_admin',
    )

  const superAdminEnabled =
    document.superAdminEnabled ===
      true ||
    legacySuperAdmin

  let hostAccessStatus =
    resolveHostAccessStatus({
      document,
      legacyHostTrack,
      legacyHostGranted,
    })

  let hostEnabled =
    document.hostEnabled ===
      true ||
    legacyHostGranted

  if (
    hostEnabled
  ) {
    hostAccessStatus =
      'active'
  } else if (
    hostAccessStatus ===
    'active'
  ) {
    hostEnabled =
      true
  }

  let customerEnabled

  if (
    typeof document.customerEnabled ===
    'boolean'
  ) {
    customerEnabled =
      document.customerEnabled
  } else {
    customerEnabled =
      legacyAccountType ===
        'customer' ||
      hasLegacyRole(
        legacyRoles,
        'customer',
      ) ||
      legacyHostTrack ||
      hostEnabled
  }

  /*
  |--------------------------------------------------------------------------
  | Every Host Retains Customer Access
  |--------------------------------------------------------------------------
  */

  if (
    hostEnabled ||
    legacyHostTrack
  ) {
    customerEnabled =
      true
  }

  const accountStatus =
    resolveGlobalAccountStatus({
      document,
      legacyHostTrack,
    })

  let activeMode =
    VALID_MODES.has(
      document.activeMode,
    )
      ? document.activeMode
      : null

  if (
    activeMode ===
      'host' &&
    !hostEnabled
  ) {
    activeMode =
      null
  }

  if (
    activeMode ===
      'customer' &&
    !customerEnabled
  ) {
    activeMode =
      null
  }

  if (!activeMode) {
    if (
      legacyHostGranted &&
      hostEnabled
    ) {
      activeMode =
        'host'
    } else if (
      customerEnabled
    ) {
      activeMode =
        'customer'
    } else if (
      hostEnabled
    ) {
      activeMode =
        'host'
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Super-admin-only Account
  |--------------------------------------------------------------------------
  */

  if (
    superAdminEnabled &&
    !customerEnabled &&
    !hostEnabled
  ) {
    activeMode =
      null
  }

  return {
    accountStatus,
    customerEnabled,
    hostEnabled,
    hostAccessStatus,
    superAdminEnabled,
    activeMode,
  }
}

async function migrateUsers(
  db,
) {
  const users =
    db.collection(
      'users',
    )

  const documents =
    await users
      .find({})
      .toArray()

  let changed =
    0

  let alreadyCurrent =
    0

  const previews = []

  for (
    const document
    of documents
  ) {
    const nextState =
      resolveNewAccessState(
        document,
      )

    const hasLegacyFields =
      Object.prototype.hasOwnProperty.call(
        document,
        'accountType',
      ) ||
      Object.prototype.hasOwnProperty.call(
        document,
        'roles',
      )

    const stateChanged =
      document.accountStatus !==
        nextState.accountStatus ||
      document.customerEnabled !==
        nextState.customerEnabled ||
      document.hostEnabled !==
        nextState.hostEnabled ||
      document.hostAccessStatus !==
        nextState.hostAccessStatus ||
      document.superAdminEnabled !==
        nextState.superAdminEnabled ||
      document.activeMode !==
        nextState.activeMode ||
      hasLegacyFields

    if (
      !stateChanged
    ) {
      alreadyCurrent +=
        1

      continue
    }

    changed +=
      1

    if (
      previews.length <
      20
    ) {
      previews.push({
        id:
          String(
            document._id,
          ),

        email:
          document.email ||
          null,

        legacy: {
          accountType:
            document.accountType ||
            null,

          roles:
            Array.isArray(
              document.roles,
            )
              ? document.roles
              : [],

          accountStatus:
            document.accountStatus ||
            null,
        },

        next:
          nextState,
      })
    }

    if (
      APPLY_CHANGES
    ) {
      await users.updateOne(
        {
          _id:
            document._id,
        },

        {
          $set:
            nextState,

          $unset: {
            accountType:
              '',

            roles:
              '',
          },
        },
      )
    }
  }

  return {
    total:
      documents.length,

    changed,

    alreadyCurrent,

    previews,
  }
}

async function migrateVerificationChallenges(
  db,
) {
  const challenges =
    db.collection(
      'verification_challenges',
    )

  const query = {
    accountType: {
      $in: [
        'seller',
        'brand',
        'b2b',
      ],
    },
  }

  const count =
    await challenges.countDocuments(
      query,
    )

  if (
    APPLY_CHANGES &&
    count >
      0
  ) {
    await challenges.updateMany(
      query,

      {
        $set: {
          accountType:
            'host',
        },
      },
    )
  }

  return count
}

async function removeLegacyUserIndexes(
  db,
) {
  const users =
    db.collection(
      'users',
    )

  const indexes =
    await users
      .indexes()
      .catch(
        () => [],
      )

  const legacyIndexes =
    indexes.filter(
      (index) => {
        const keys =
          Object.keys(
            index.key ||
              {},
          )

        return keys.includes(
          'accountType',
        ) ||
          keys.includes(
            'roles',
          )
      },
    )

  if (
    APPLY_CHANGES
  ) {
    for (
      const index
      of legacyIndexes
    ) {
      await users.dropIndex(
        index.name,
      )
    }
  }

  return legacyIndexes.map(
    (index) =>
      index.name,
  )
}

async function run() {
  console.log(
    APPLY_CHANGES
      ? 'EPANTRY access-model migration: APPLY mode'
      : 'EPANTRY access-model migration: DRY RUN',
  )

  console.log(
    APPLY_CHANGES
      ? 'Database changes WILL be written.'
      : 'No database changes will be written. Re-run with --apply after reviewing the preview.',
  )

  await connectDatabase()

  try {
    const db =
      mongoose.connection.db

    const userResult =
      await migrateUsers(
        db,
      )

    const challengeCount =
      await migrateVerificationChallenges(
        db,
      )

    const legacyIndexes =
      await removeLegacyUserIndexes(
        db,
      )

    console.log(
      JSON.stringify(
        {
          mode:
            APPLY_CHANGES
              ? 'apply'
              : 'dry-run',

          users:
            userResult,

          verificationChallengesToConvert:
            challengeCount,

          legacyUserIndexes:
            legacyIndexes,
        },

        null,
        2,
      ),
    )

    if (
      !APPLY_CHANGES
    ) {
      console.log(
        '\nReview the preview above. If it is correct, run:\nnode scripts/migrate-user-access-model.mjs --apply',
      )
    } else {
      console.log(
        '\nMigration applied successfully.',
      )
    }
  } finally {
    await disconnectDatabase()
  }
}

run().catch(
  async (
    error,
  ) => {
    console.error(
      'Access-model migration failed:',
      error,
    )

    await disconnectDatabase()
      .catch(
        () => undefined,
      )

    process.exitCode =
      1
  },
)