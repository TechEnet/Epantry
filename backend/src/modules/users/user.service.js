import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Household,
} from '../households/household.model.js'

import {
  HouseholdInvitation,
} from '../households/householdInvitation.model.js'

import {
  HouseholdMembership,
} from '../households/householdMembership.model.js'

import {
  USER_ACTIVE_MODES,
  User,
} from './user.model.js'

/*
|--------------------------------------------------------------------------
| Current User Projection
|--------------------------------------------------------------------------
*/

const CURRENT_USER_PROJECTION = {
  firebaseUid:
    1,

  name:
    1,

  email:
    1,

  phone:
    1,

  profilePhotoUrl:
    1,

  emailVerified:
    1,

  phoneVerified:
    1,

  accountStatus:
    1,

  customerEnabled:
    1,

  hostEnabled:
    1,

  hostAccessStatus:
    1,

  superAdminEnabled:
    1,

  activeMode:
    1,

  lastLoginAt:
    1,

  createdAt:
    1,

  updatedAt:
    1,
}

/*
|--------------------------------------------------------------------------
| Access Helpers
|--------------------------------------------------------------------------
*/

export function hasCustomerAccess(
  user,
) {
  return user?.customerEnabled ===
    true
}

export function hasHostAccess(
  user,
) {
  return (
    user?.hostEnabled ===
      true &&
    user?.hostAccessStatus ===
      'active'
  )
}

export function hasSuperAdminAccess(
  user,
) {
  return user?.superAdminEnabled ===
    true
}

/*
|--------------------------------------------------------------------------
| Ensure Personal Customer Household
|--------------------------------------------------------------------------
|
| Customer workspace features share a Household-scoped data model.
|
| Older Customer accounts can exist without an active Household membership,
| which makes Pantry/planning and other Household-backed Customer pages fail
| even though Customer access itself is valid.
|
| Authenticated Customers therefore receive one private personal Household
| lazily when their application identity is loaded and no active membership
| exists yet. Existing memberships are never replaced or changed.
|
| Super Admin identities are intentionally excluded. Host identities retain
| Customer access, so the same rule only applies when they are also Customers.
|
*/

async function ensurePersonalCustomerHousehold(
  user,
) {
  if (
    !user?._id ||
    !hasCustomerAccess(
      user,
    ) ||
    hasSuperAdminAccess(
      user,
    )
  ) {
    return
  }

  const existingMembership =
    await HouseholdMembership
      .findOne({
        userId:
          user._id,

        status:
          'active',
      })
      .select(
        '_id',
      )
      .lean()

  if (
    existingMembership
  ) {
    return
  }

  const pendingInvitation =
    await HouseholdInvitation
      .findOne({
        invitedEmail:
          String(
            user.email ||
            '',
          )
            .trim()
            .toLowerCase(),

        status:
          'pending',

        expiresAt: {
          $gt:
            new Date(),
        },
      })
      .select(
        '_id',
      )
      .lean()

  if (
    pendingInvitation
  ) {
    return
  }

  const nameSource =
    String(
      user.name ||
      'Personal',
    ).trim()

  const householdName =
    `${
      nameSource ||
      'Personal'
    } Household`.slice(
      0,
      120,
    )

  const household =
    await Household.create({
      name:
        householdName.length >=
        2
          ? householdName
          : 'Personal Household',

      usualPeopleCount:
        1,

      status:
        'active',

      createdByUserId:
        user._id,
    })

  try {
    await HouseholdMembership.create({
      householdId:
        household._id,

      userId:
        user._id,

      role:
        'owner',

      status:
        'active',

      selectedForContext:
        true,

      joinedAt:
        new Date(),

      endedAt:
        null,
    })
  } catch (error) {
    await Household.deleteOne({
      _id:
        household._id,

      createdByUserId:
        user._id,
    })

    if (
      error?.code ===
      11000
    ) {
      const concurrentMembership =
        await HouseholdMembership
          .findOne({
            userId:
              user._id,

            status:
              'active',
          })
          .select(
            '_id',
          )
          .lean()

      if (
        concurrentMembership
      ) {
        return
      }
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Available Customer / Host Modes
|--------------------------------------------------------------------------
|
| Super Admin does not participate in Customer ↔ Host mode switching.
|
*/

export function getAvailableModes(
  user,
) {
  if (
    hasSuperAdminAccess(
      user,
    )
  ) {
    return []
  }

  const modes = []

  if (
    hasCustomerAccess(
      user,
    )
  ) {
    modes.push(
      'customer',
    )
  }

  if (
    hasHostAccess(
      user,
    )
  ) {
    modes.push(
      'host',
    )
  }

  return modes
}

/*
|--------------------------------------------------------------------------
| Resolved Active Mode
|--------------------------------------------------------------------------
*/

export function getResolvedActiveMode(
  user,
) {
  if (
    hasSuperAdminAccess(
      user,
    )
  ) {
    return null
  }

  const availableModes =
    getAvailableModes(
      user,
    )

  if (
    USER_ACTIVE_MODES.includes(
      user?.activeMode,
    ) &&
    availableModes.includes(
      user.activeMode,
    )
  ) {
    return user.activeMode
  }

  if (
    availableModes.includes(
      'customer',
    )
  ) {
    return 'customer'
  }

  if (
    availableModes.includes(
      'host',
    )
  ) {
    return 'host'
  }

  return null
}

/*
|--------------------------------------------------------------------------
| Find User By Firebase UID
|--------------------------------------------------------------------------
*/

export async function findUserByFirebaseUid(
  firebaseUid,
) {
  if (
    typeof firebaseUid !==
      'string' ||
    !firebaseUid.trim()
  ) {
    return null
  }

  return User.findOne(
    {
      firebaseUid:
        firebaseUid.trim(),
    },

    CURRENT_USER_PROJECTION,
  ).lean()
}

/*
|--------------------------------------------------------------------------
| Require EPANTRY User
|--------------------------------------------------------------------------
*/

export async function requireUserByFirebaseUid(
  firebaseUid,
) {
  const user =
    await findUserByFirebaseUid(
      firebaseUid,
    )

  if (!user) {
    throw new ApiError(
      403,
      'Your EPANTRY profile is not available. Please complete account setup.',
    )
  }

  await ensurePersonalCustomerHousehold(
    user,
  )

  return user
}

/*
|--------------------------------------------------------------------------
| Session Eligibility
|--------------------------------------------------------------------------
|
| Host onboarding does not control the global account state.
|
*/

export function assertSessionEligibleAccount(
  user,
) {
  switch (
    user.accountStatus
  ) {
    case 'active':
      return

    case 'suspended':
      throw new ApiError(
        403,
        'This account is currently suspended.',
      )

    case 'disabled':
      throw new ApiError(
        403,
        'This account is currently disabled.',
      )

    case 'locked':
      throw new ApiError(
        423,
        'This account is temporarily locked.',
      )

    default:
      throw new ApiError(
        403,
        'This account is not currently available.',
      )
  }
}

/*
|--------------------------------------------------------------------------
| Record Successful Login
|--------------------------------------------------------------------------
*/

export async function recordSuccessfulLogin(
  userId,
) {
  const lastLoginAt =
    new Date()

  await User.updateOne(
    {
      _id:
        userId,
    },

    {
      $set: {
        lastLoginAt,
      },
    },
  )

  return lastLoginAt
}

/*
|--------------------------------------------------------------------------
| MFA Policy
|--------------------------------------------------------------------------
|
| Existing TOTP security remains unchanged.
|
| Active Host:
|   MFA required.
|
| Super Admin:
|   MFA required.
|
| Pending Host:
|   MFA recommended.
|
*/

export function getMfaPolicyForUser(
  user,
) {
  const hostAccessActive =
    hasHostAccess(
      user,
    )

  const superAdminAccessActive =
    hasSuperAdminAccess(
      user,
    )

  const hostOnboardingPending =
    user?.hostAccessStatus ===
    'pending'

  const required =
    hostAccessActive ||
    superAdminAccessActive

  const recommended =
    required ||
    hostOnboardingPending

  return {
    required,

    recommended,

    reason:
      superAdminAccessActive
        ? 'super_admin'
        : hostAccessActive
          ? 'host'
          : hostOnboardingPending
            ? 'host_onboarding'
            : null,
  }
}

/*
|--------------------------------------------------------------------------
| Normalize Requested Mode
|--------------------------------------------------------------------------
*/

function normalizeRequestedMode(
  mode,
) {
  if (
    typeof mode !==
    'string'
  ) {
    throw new ApiError(
      400,
      'A valid application mode is required.',
      [
        {
          code:
            'AUTH_MODE_INVALID',
        },
      ],
    )
  }

  const normalizedMode =
    mode
      .trim()
      .toLowerCase()

  if (
    !USER_ACTIVE_MODES.includes(
      normalizedMode,
    )
  ) {
    throw new ApiError(
      400,
      'Application mode must be customer or host.',
      [
        {
          code:
            'AUTH_MODE_INVALID',

          allowedModes:
            USER_ACTIVE_MODES,
        },
      ],
    )
  }

  return normalizedMode
}

/*
|--------------------------------------------------------------------------
| Assert Mode Access
|--------------------------------------------------------------------------
*/

function assertModeAccess(
  user,
  mode,
) {
  if (
    hasSuperAdminAccess(
      user,
    )
  ) {
    throw new ApiError(
      403,
      'Customer and Host mode switching is not available for Super Admin access.',
      [
        {
          code:
            'AUTH_MODE_SWITCH_NOT_AVAILABLE',
        },
      ],
    )
  }

  if (
    mode ===
      'customer' &&
    !hasCustomerAccess(
      user,
    )
  ) {
    throw new ApiError(
      403,
      'Customer access is not enabled for this account.',
      [
        {
          code:
            'AUTH_CUSTOMER_ACCESS_REQUIRED',
        },
      ],
    )
  }

  if (
    mode ===
      'host' &&
    !hasHostAccess(
      user,
    )
  ) {
    throw new ApiError(
      403,
      'Host access is not active for this account.',
      [
        {
          code:
            'AUTH_HOST_ACCESS_REQUIRED',

          hostAccessStatus:
            user?.hostAccessStatus ||
            'not_requested',
        },
      ],
    )
  }
}

/*
|--------------------------------------------------------------------------
| Switch Active Application Mode
|--------------------------------------------------------------------------
*/

export async function switchUserActiveMode({
  user,
  mode,
}) {
  if (
    !user?._id
  ) {
    throw new ApiError(
      500,
      'Unable to resolve the current EPANTRY user.',
    )
  }

  assertSessionEligibleAccount(
    user,
  )

  const normalizedMode =
    normalizeRequestedMode(
      mode,
    )

  assertModeAccess(
    user,
    normalizedMode,
  )

  if (
    getResolvedActiveMode(
      user,
    ) ===
    normalizedMode
  ) {
    return user
  }

  const accessFilter =
    normalizedMode ===
      'host'
      ? {
          hostEnabled:
            true,

          hostAccessStatus:
            'active',

          superAdminEnabled: {
            $ne:
              true,
          },
        }
      : {
          customerEnabled:
            true,

          superAdminEnabled: {
            $ne:
              true,
          },
        }

  const updatedUser =
    await User.findOneAndUpdate(
      {
        _id:
          user._id,

        accountStatus:
          'active',

        ...accessFilter,
      },

      {
        $set: {
          activeMode:
            normalizedMode,
        },
      },

      {
        new:
          true,

        runValidators:
          true,

        projection:
          CURRENT_USER_PROJECTION,
      },
    ).lean()

  if (
    !updatedUser
  ) {
    const latestUser =
      await User.findById(
        user._id,

        CURRENT_USER_PROJECTION,
      ).lean()

    if (
      !latestUser
    ) {
      throw new ApiError(
        403,
        'Your EPANTRY profile is no longer available.',
        [
          {
            code:
              'AUTH_USER_UNAVAILABLE',
          },
        ],
      )
    }

    assertSessionEligibleAccount(
      latestUser,
    )

    assertModeAccess(
      latestUser,
      normalizedMode,
    )

    throw new ApiError(
      409,
      'Your account access changed while switching modes. Please try again.',
      [
        {
          code:
            'AUTH_MODE_SWITCH_CONFLICT',
        },
      ],
    )
  }

  return updatedUser
}

/*
|--------------------------------------------------------------------------
| Become A Host Eligibility
|--------------------------------------------------------------------------
*/

function assertHostRequestAvailable(
  user,
) {
  assertSessionEligibleAccount(
    user,
  )

  if (
    hasSuperAdminAccess(
      user,
    )
  ) {
    throw new ApiError(
      403,
      'Host onboarding is not available through a Super Admin account.',
      [
        {
          code:
            'AUTH_HOST_ONBOARDING_NOT_AVAILABLE',
        },
      ],
    )
  }

  if (
    !hasCustomerAccess(
      user,
    )
  ) {
    throw new ApiError(
      403,
      'Customer access is required before requesting Host access.',
      [
        {
          code:
            'AUTH_CUSTOMER_ACCESS_REQUIRED',
        },
      ],
    )
  }
}

/*
|--------------------------------------------------------------------------
| Request Host Access
|--------------------------------------------------------------------------
|
| Customer
|     ↓
| Become a Host
|     ↓
| hostAccessStatus = pending
| hostEnabled = false
| activeMode = customer
|
| IMPORTANT:
|
| A request does NOT grant Host authorization.
|
*/

export async function requestHostAccess({
  user,
}) {
  if (
    !user?._id
  ) {
    throw new ApiError(
      500,
      'Unable to resolve the current EPANTRY user.',
    )
  }

  assertHostRequestAvailable(
    user,
  )

  /*
  |--------------------------------------------------------------------------
  | Already Active
  |--------------------------------------------------------------------------
  */

  if (
    hasHostAccess(
      user,
    )
  ) {
    return {
      user,

      requestChanged:
        false,

      hostRequestState:
        'already_active',
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Already Pending
  |--------------------------------------------------------------------------
  */

  if (
    user.hostAccessStatus ===
    'pending'
  ) {
    return {
      user,

      requestChanged:
        false,

      hostRequestState:
        'already_pending',
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Suspended Host Access
  |--------------------------------------------------------------------------
  |
  | A suspended Host cannot bypass suspension by submitting a fresh public
  | request.
  |
  */

  if (
    user.hostAccessStatus ===
    'suspended'
  ) {
    throw new ApiError(
      403,
      'Host access for this account is currently suspended.',
      [
        {
          code:
            'AUTH_HOST_ACCESS_SUSPENDED',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Rejected Host Application
  |--------------------------------------------------------------------------
  |
  | Re-application policy should be introduced deliberately later.
  |
  | Do not silently convert rejected → pending.
  |
  */

  if (
    user.hostAccessStatus ===
    'rejected'
  ) {
    throw new ApiError(
      409,
      'Your previous Host application was not approved. A new Host application cannot be submitted through this flow yet.',
      [
        {
          code:
            'AUTH_HOST_REAPPLICATION_REQUIRED',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Unknown / Inconsistent Active State
  |--------------------------------------------------------------------------
  */

  if (
    user.hostAccessStatus ===
      'active' &&
    !hasHostAccess(
      user,
    )
  ) {
    throw new ApiError(
      409,
      'Host access is in an inconsistent state. Please contact support.',
      [
        {
          code:
            'AUTH_HOST_ACCESS_STATE_INVALID',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | not_requested → pending
  |--------------------------------------------------------------------------
  |
  | Atomic filter ensures:
  |
  | - account is still active
  | - Customer access still exists
  | - user is not Super Admin
  | - Host access has not already been changed concurrently
  |
  */

  const updatedUser =
    await User.findOneAndUpdate(
      {
        _id:
          user._id,

        accountStatus:
          'active',

        customerEnabled:
          true,

        superAdminEnabled: {
          $ne:
            true,
        },

        hostEnabled:
          false,

        hostAccessStatus:
          'not_requested',
      },

      {
        $set: {
          hostEnabled:
            false,

          hostAccessStatus:
            'pending',

          /*
          |--------------------------------------------------------------------------
          | Pending Host stays in Customer mode
          |--------------------------------------------------------------------------
          */

          activeMode:
            'customer',
        },
      },

      {
        new:
          true,

        runValidators:
          true,

        projection:
          CURRENT_USER_PROJECTION,
      },
    ).lean()

  if (
    updatedUser
  ) {
    return {
      user:
        updatedUser,

      requestChanged:
        true,

      hostRequestState:
        'submitted',
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Concurrent State Change
  |--------------------------------------------------------------------------
  */

  const latestUser =
    await User.findById(
      user._id,

      CURRENT_USER_PROJECTION,
    ).lean()

  if (
    !latestUser
  ) {
    throw new ApiError(
      403,
      'Your EPANTRY profile is no longer available.',
      [
        {
          code:
            'AUTH_USER_UNAVAILABLE',
        },
      ],
    )
  }

  assertHostRequestAvailable(
    latestUser,
  )

  if (
    hasHostAccess(
      latestUser,
    )
  ) {
    return {
      user:
        latestUser,

      requestChanged:
        false,

      hostRequestState:
        'already_active',
    }
  }

  if (
    latestUser.hostAccessStatus ===
    'pending'
  ) {
    return {
      user:
        latestUser,

      requestChanged:
        false,

      hostRequestState:
        'already_pending',
    }
  }

  throw new ApiError(
    409,
    'Your Host access state changed while submitting the request. Please try again.',
    [
      {
        code:
          'AUTH_HOST_REQUEST_CONFLICT',
      },
    ],
  )
}

/*
|--------------------------------------------------------------------------
| Activate Host Access
|--------------------------------------------------------------------------
|
| This is a service-level helper for the future controlled Super Admin /
| approval workflow.
|
| It is intentionally NOT exposed as a public route here.
|
*/

export async function activateHostAccess(
  userId,
) {
  const updatedUser =
    await User.findOneAndUpdate(
      {
        _id:
          userId,

        accountStatus:
          'active',

        customerEnabled:
          true,

        hostEnabled:
          false,

        hostAccessStatus:
          'pending',

        superAdminEnabled: {
          $ne:
            true,
        },
      },

      {
        $set: {
          customerEnabled:
            true,

          hostEnabled:
            true,

          hostAccessStatus:
            'active',
        },
      },

      {
        new:
          true,

        runValidators:
          true,

        projection:
          CURRENT_USER_PROJECTION,
      },
    ).lean()

  if (
    !updatedUser
  ) {
    throw new ApiError(
      409,
      'Host access could not be activated from the current account state.',
      [
        {
          code:
            'AUTH_HOST_ACTIVATION_CONFLICT',
        },
      ],
    )
  }

  return updatedUser
}

/*
|--------------------------------------------------------------------------
| Reject Host Access
|--------------------------------------------------------------------------
|
| Future administrative workflow helper.
|
| A rejected Host request does NOT affect Customer access.
|
*/

export async function rejectHostAccess(
  userId,
) {
  const updatedUser =
    await User.findOneAndUpdate(
      {
        _id:
          userId,

        customerEnabled:
          true,

        hostEnabled:
          false,

        hostAccessStatus:
          'pending',
      },

      {
        $set: {
          hostEnabled:
            false,

          hostAccessStatus:
            'rejected',

          activeMode:
            'customer',
        },
      },

      {
        new:
          true,

        runValidators:
          true,

        projection:
          CURRENT_USER_PROJECTION,
      },
    ).lean()

  if (
    !updatedUser
  ) {
    throw new ApiError(
      409,
      'Host application could not be rejected from the current account state.',
      [
        {
          code:
            'AUTH_HOST_REJECTION_CONFLICT',
        },
      ],
    )
  }

  return updatedUser
}

/*
|--------------------------------------------------------------------------
| Suspend Host Access
|--------------------------------------------------------------------------
|
| Future administrative workflow helper.
|
| Customer access remains available.
|
| If user was currently in Host mode, they are safely returned to Customer.
|
*/

export async function suspendHostAccess(
  userId,
) {
  const updatedUser =
    await User.findOneAndUpdate(
      {
        _id:
          userId,

        customerEnabled:
          true,

        hostEnabled:
          true,

        hostAccessStatus:
          'active',
      },

      {
        $set: {
          hostEnabled:
            false,

          hostAccessStatus:
            'suspended',

          activeMode:
            'customer',
        },
      },

      {
        new:
          true,

        runValidators:
          true,

        projection:
          CURRENT_USER_PROJECTION,
      },
    ).lean()

  if (
    !updatedUser
  ) {
    throw new ApiError(
      409,
      'Host access could not be suspended from the current account state.',
      [
        {
          code:
            'AUTH_HOST_SUSPENSION_CONFLICT',
        },
      ],
    )
  }

  return updatedUser
}

/*
|--------------------------------------------------------------------------
| Safe Current User Response
|--------------------------------------------------------------------------
*/

export function serializeCurrentUser(
  user,
) {
  const availableModes =
    getAvailableModes(
      user,
    )

  const activeMode =
    getResolvedActiveMode(
      user,
    )

  return {
    id:
      String(
        user._id,
      ),

    name:
      user.name,

    email:
      user.email,

    phone:
      user.phone ||
      null,

    profilePhotoUrl:
      user.profilePhotoUrl ||
      null,

    emailVerified:
      user.emailVerified ===
      true,

    phoneVerified:
      user.phoneVerified ===
      true,

    accountStatus:
      user.accountStatus,

    customerEnabled:
      hasCustomerAccess(
        user,
      ),

    hostEnabled:
      hasHostAccess(
        user,
      ),

    hostAccessStatus:
      user.hostAccessStatus ||
      'not_requested',

    superAdminEnabled:
      hasSuperAdminAccess(
        user,
      ),

    availableModes,

    activeMode,

    lastLoginAt:
      user.lastLoginAt ||
      null,

    createdAt:
      user.createdAt,

    updatedAt:
      user.updatedAt,
  }
}