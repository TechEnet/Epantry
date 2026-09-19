import mongoose from 'mongoose'

import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  User,
} from '../users/user.model.js'

import {
  Household,
} from './household.model.js'

import {
  HOUSEHOLD_MEMBERSHIP_ROLES,
  HouseholdMembership,
} from './householdMembership.model.js'

/*
|--------------------------------------------------------------------------
| Household Validation
|--------------------------------------------------------------------------
*/

const householdNameSchema =
  z.string()
    .trim()
    .min(
      2,
      'Household name must contain at least 2 characters.',
    )
    .max(
      120,
      'Household name cannot exceed 120 characters.',
    )
    .transform(
      (value) =>
        value.replace(
          /\s+/g,
          ' ',
        ),
    )

const usualPeopleCountSchema =
  z.coerce
    .number()
    .int(
      'Usual people count must be a whole number.',
    )
    .min(
      1,
      'Usual people count must be at least 1.',
    )
    .max(
      50,
      'Usual people count cannot exceed 50.',
    )

const createHouseholdSchema =
  z.object({
    name:
      householdNameSchema,

    usualPeopleCount:
      usualPeopleCountSchema
        .default(1),
  })
    .strict()

const updateHouseholdSchema =
  z.object({
    name:
      householdNameSchema
        .optional(),

    usualPeopleCount:
      usualPeopleCountSchema
        .optional(),
  })
    .strict()
    .refine(
      (value) =>
        Object.keys(
          value,
        ).length >
        0,

      {
        message:
          'At least one household field is required.',
      },
    )

/*
|--------------------------------------------------------------------------
| Household Member Management Validation
|--------------------------------------------------------------------------
*/

const managedMembershipIdSchema =
  z.string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'Household membership id is invalid.',
    )

const managedHouseholdRoleSchema =
  z.enum([
    'admin',
    'member',
  ])

function parseManagedMembershipId(
  membershipId,
) {
  const parsed =
    managedMembershipIdSchema.safeParse(
      membershipId,
    )

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Household membership id is invalid.',
      [
        {
          code:
            'HOUSEHOLD_MEMBERSHIP_ID_INVALID',
        },
      ],
    )
  }

  return parsed.data
}

function parseManagedHouseholdRole(
  payload,
) {
  const parsed =
    z.object({
      role:
        managedHouseholdRoleSchema,
    })
      .strict()
      .safeParse(
        payload || {},
      )

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Household member role is invalid.',
      [
        {
          code:
            'HOUSEHOLD_MEMBER_ROLE_INVALID',
        },
      ],
    )
  }

  return parsed.data.role
}

/*
|--------------------------------------------------------------------------
| Member Projection
|--------------------------------------------------------------------------
*/

const HOUSEHOLD_MEMBER_USER_PROJECTION = {
  name:
    1,
}

const HOUSEHOLD_ROLE_PRIORITY = {
  owner:
    0,

  admin:
    1,

  member:
    2,
}

const VALID_HOUSEHOLD_ROLES =
  new Set(
    HOUSEHOLD_MEMBERSHIP_ROLES,
  )

/*
|--------------------------------------------------------------------------
| Validation Helpers
|--------------------------------------------------------------------------
*/

function parseCreateHouseholdInput(
  payload,
) {
  const parsed =
    createHouseholdSchema.safeParse(
      payload || {},
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Invalid household details.',
    )
  }

  return parsed.data
}

function parseUpdateHouseholdInput(
  payload,
) {
  const parsed =
    updateHouseholdSchema.safeParse(
      payload || {},
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Invalid household details.',
    )
  }

  return parsed.data
}

function normalizeAllowedHouseholdRoles(
  roles,
) {
  if (
    !Array.isArray(
      roles,
    ) ||
    roles.length ===
      0
  ) {
    return []
  }

  const normalized = [
    ...new Set(
      roles
        .map(
          (role) =>
            String(
              role ||
                '',
            ).trim(),
        )
        .filter(Boolean),
    ),
  ]

  const invalidRoles =
    normalized.filter(
      (role) =>
        !VALID_HOUSEHOLD_ROLES.has(
          role,
        ),
    )

  if (
    invalidRoles.length >
    0
  ) {
    throw new Error(
      `Unknown household role(s): ${invalidRoles.join(', ')}`,
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Safe Serialization
|--------------------------------------------------------------------------
*/

function serializeHousehold(
  household,
) {
  if (!household) {
    return null
  }

  return {
    id:
      String(
        household._id,
      ),

    name:
      household.name,

    usualPeopleCount:
      household
        .usualPeopleCount,

    status:
      household.status,

    createdAt:
      household.createdAt,

    updatedAt:
      household.updatedAt,
  }
}

function serializeMembership(
  membership,
) {
  if (!membership) {
    return null
  }

  return {
    id:
      String(
        membership._id,
      ),

    householdId:
      String(
        membership.householdId,
      ),

    role:
      membership.role,

    roleLabel:
      membership.role ===
        'owner'
        ? 'Owner'
        : membership.role ===
            'admin'
          ? 'Admin'
          : String(
              membership.roleLabel ||
                '',
            ).trim() ||
            'Member',

    status:
      membership.status,

    selectedForContext:
      membership.selectedForContext ===
      true,

    joinedAt:
      membership.joinedAt,

    endedAt:
      membership.endedAt ||
      null,

    createdAt:
      membership.createdAt,

    updatedAt:
      membership.updatedAt,
  }
}

/*
|--------------------------------------------------------------------------
| Active Household Context Resolution
|--------------------------------------------------------------------------
|
| A Customer may have multiple active memberships. One membership is marked
| selectedForContext and becomes the working Household used by Pantry, meal
| planning and other Household-scoped Customer features.
|
| Older data may not have the selector yet, so the earliest active membership
| is selected lazily and safely.
|
*/

async function findSelectedActiveMembershipForUser(
  userId,
) {
  let membership =
    await HouseholdMembership.findOne({
      userId,

      status:
        'active',

      selectedForContext:
        true,
    }).lean()

  if (membership) {
    return membership
  }

  const fallback =
    await HouseholdMembership.findOne({
      userId,

      status:
        'active',
    })
      .sort({
        joinedAt:
          1,

        createdAt:
          1,
      })
      .lean()

  if (!fallback) {
    return null
  }

  await HouseholdMembership.updateMany(
    {
      userId,

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

  const selected =
    await HouseholdMembership.findOneAndUpdate(
      {
        _id:
          fallback._id,

        userId,

        status:
          'active',
      },
      {
        $set: {
          selectedForContext:
            true,
        },
      },
      {
        new:
          true,
      },
    ).lean()

  return selected ||
    fallback
}

async function listActiveHouseholdContextsForUser(
  userId,
) {
  const memberships =
    await HouseholdMembership.find({
      userId,

      status:
        'active',
    })
      .sort({
        joinedAt:
          1,

        createdAt:
          1,
      })
      .lean()

  if (memberships.length === 0) {
    return []
  }

  const households =
    await Household.find({
      _id: {
        $in:
          memberships.map(
            (membership) =>
              membership.householdId,
          ),
      },

      status:
        'active',
    }).lean()

  const householdById =
    new Map(
      households.map(
        (household) => [
          String(
            household._id,
          ),
          household,
        ],
      ),
    )

  return memberships
    .map(
      (membership) => {
        const household =
          householdById.get(
            String(
              membership.householdId,
            ),
          )

        if (!household) {
          return null
        }

        return {
          household:
            serializeHousehold(
              household,
            ),

          membership:
            serializeMembership(
              membership,
            ),
        }
      },
    )
    .filter(Boolean)
}

/*
|--------------------------------------------------------------------------
| Reusable Household Membership Authorization
|--------------------------------------------------------------------------
|
| This is a defense-in-depth service check.
|
| Route middleware may already have loaded an authorized household tenant,
| but domain services can call this function again when they are reused from
| another route, job or future internal workflow.
|
| There is intentionally no super-admin bypass.
|
*/

export async function requireHouseholdMembershipAccess({
  userId,
  householdId,
  allowedRoles = [],
}) {
  if (
    !userId ||
    !mongoose.isValidObjectId(
      householdId,
    )
  ) {
    throw new ApiError(
      403,
      'Household access is not available.',
      [
        {
          code:
            'HOUSEHOLD_MEMBERSHIP_REQUIRED',
        },
      ],
    )
  }

  const normalizedAllowedRoles =
    normalizeAllowedHouseholdRoles(
      allowedRoles,
    )

  const membership =
    await HouseholdMembership.findOne({
      userId,

      householdId,

      status:
        'active',
    }).lean()

  if (!membership) {
    throw new ApiError(
      403,
      'You do not have access to this household.',
      [
        {
          code:
            'HOUSEHOLD_MEMBERSHIP_REQUIRED',
        },
      ],
    )
  }

  if (
    normalizedAllowedRoles.length >
      0 &&
    !normalizedAllowedRoles.includes(
      membership.role,
    )
  ) {
    throw new ApiError(
      403,
      'Your household role does not allow this action.',
      [
        {
          code:
            'HOUSEHOLD_ROLE_REQUIRED',

          allowedRoles:
            normalizedAllowedRoles,
        },
      ],
    )
  }

  return membership
}

/*
|--------------------------------------------------------------------------
| Household Context By Explicit ID
|--------------------------------------------------------------------------
|
| The caller-supplied householdId becomes usable only after membership is
| proven for the current EPANTRY user.
|
*/

export async function getHouseholdContextByIdForUser({
  userId,
  householdId,
}) {
  const membership =
    await requireHouseholdMembershipAccess({
      userId,

      householdId,
    })

  const household =
    await Household.findOne({
      _id:
        householdId,

      status:
        'active',
    }).lean()

  if (!household) {
    throw new ApiError(
      404,
      'Household was not found.',
      [
        {
          code:
            'HOUSEHOLD_NOT_FOUND',
        },
      ],
    )
  }

  return {
    hasHousehold:
      true,

    household:
      serializeHousehold(
        household,
      ),

    membership:
      serializeMembership(
        membership,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Current Household Context
|--------------------------------------------------------------------------
*/

export async function getCurrentHouseholdContext(
  userId,
) {
  const membership =
    await findSelectedActiveMembershipForUser(
      userId,
    )

  const households =
    await listActiveHouseholdContextsForUser(
      userId,
    )

  if (!membership) {
    return {
      hasHousehold:
        false,

      household:
        null,

      membership:
        null,

      households,
    }
  }

  const household =
    await Household.findOne({
      _id:
        membership
          .householdId,

      status:
        'active',
    }).lean()

  if (!household) {
    throw new ApiError(
      409,
      'Your selected household is not currently available.',
      [
        {
          code:
            'HOUSEHOLD_CONTEXT_UNAVAILABLE',
        },
      ],
    )
  }

  return {
    hasHousehold:
      true,

    household:
      serializeHousehold(
        household,
      ),

    membership:
      serializeMembership(
        membership,
      ),

    households,
  }
}

/*
|--------------------------------------------------------------------------
| Select Working Household
|--------------------------------------------------------------------------
*/

export async function selectCurrentHouseholdForUser({
  userId,
  householdId,
}) {
  await requireHouseholdMembershipAccess({
    userId,

    householdId,
  })

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        await HouseholdMembership.updateMany(
          {
            userId,

            status:
              'active',
          },
          {
            $set: {
              selectedForContext:
                false,
            },
          },
          {
            session,
          },
        )

        const selected =
          await HouseholdMembership.findOneAndUpdate(
            {
              userId,

              householdId,

              status:
                'active',
            },
            {
              $set: {
                selectedForContext:
                  true,
              },
            },
            {
              new:
                true,

              session,
            },
          )

        if (!selected) {
          throw new ApiError(
            404,
            'Household membership was not found.',
            [
              {
                code:
                  'HOUSEHOLD_MEMBERSHIP_REQUIRED',
              },
            ],
          )
        }
      },
    )
  } finally {
    await session.endSession()
  }

  return getCurrentHouseholdContext(
    userId,
  )
}

/*
|--------------------------------------------------------------------------
| Build Safe Member List
|--------------------------------------------------------------------------
*/

async function buildSafeHouseholdMembers({
  householdId,
  currentUserId,
}) {
  const memberships =
    await HouseholdMembership.find({
      householdId,

      status:
        'active',
    })
      .sort({
        joinedAt:
          1,
      })
      .lean()

  const userIds =
    memberships.map(
      (membership) =>
        membership.userId,
    )

  const users =
    await User.find(
      {
        _id: {
          $in:
            userIds,
        },
      },

      HOUSEHOLD_MEMBER_USER_PROJECTION,
    ).lean()

  const usersById =
    new Map(
      users.map(
        (user) => [
          String(
            user._id,
          ),

          user,
        ],
      ),
    )

  return memberships
    .map(
      (membership) => {
        const memberUser =
          usersById.get(
            String(
              membership.userId,
            ),
          )

        if (!memberUser) {
          return null
        }

        return {
          membershipId:
            String(
              membership._id,
            ),

          user: {
            id:
              String(
                memberUser._id,
              ),

            name:
              memberUser.name,
          },

          role:
            membership.role,

          roleLabel:
            membership.role ===
              'owner'
              ? 'Owner'
              : membership.role ===
                  'admin'
                ? 'Admin'
                : String(
                    membership.roleLabel ||
                      '',
                  ).trim() ||
                  'Member',

          status:
            membership.status,

          joinedAt:
            membership.joinedAt,

          isCurrentUser:
            String(
              membership.userId,
            ) ===
            String(
              currentUserId,
            ),
        }
      },
    )
    .filter(Boolean)
    .sort(
      (
        left,
        right,
      ) => {
        const roleDifference =
          (
            HOUSEHOLD_ROLE_PRIORITY[
              left.role
            ] ??
            99
          ) -
          (
            HOUSEHOLD_ROLE_PRIORITY[
              right.role
            ] ??
            99
          )

        if (
          roleDifference !==
          0
        ) {
          return roleDifference
        }

        return String(
          left
            .user
            .name,
        ).localeCompare(
          String(
            right
              .user
              .name,
          ),
        )
      },
    )
}

/*
|--------------------------------------------------------------------------
| Current Household Members
|--------------------------------------------------------------------------
*/

export async function getHouseholdMembersForUser(
  userId,
) {
  const context =
    await getCurrentHouseholdContext(
      userId,
    )

  if (
    !context.hasHousehold
  ) {
    return {
      ...context,

      members: [],
    }
  }

  await requireHouseholdMembershipAccess({
    userId,

    householdId:
      context
        .household
        .id,
  })

  const members =
    await buildSafeHouseholdMembers({
      householdId:
        context
          .household
          .id,

      currentUserId:
        userId,
    })

  return {
    ...context,

    members,
  }
}

/*
|--------------------------------------------------------------------------
| Explicit Household Members
|--------------------------------------------------------------------------
|
| Used by tenant-scoped routes such as:
|
| GET /households/:householdId/members
|
*/

export async function getHouseholdMembersByIdForUser({
  userId,
  householdId,
}) {
  const context =
    await getHouseholdContextByIdForUser({
      userId,

      householdId,
    })

  const members =
    await buildSafeHouseholdMembers({
      householdId:
        context
          .household
          .id,

      currentUserId:
        userId,
    })

  return {
    ...context,

    members,
  }
}

/*
|--------------------------------------------------------------------------
| Create Household + Owner Membership
|--------------------------------------------------------------------------
*/

export async function createHouseholdForUser({
  userId,
  payload,
}) {
  const input =
    parseCreateHouseholdInput(
      payload,
    )

  const existingMembership =
    await HouseholdMembership.findOne({
      userId,

      status:
        'active',
    }).lean()

  if (
    existingMembership
  ) {
    throw new ApiError(
      409,
      'You already belong to an active household.',
      [
        {
          code:
            'HOUSEHOLD_ALREADY_EXISTS',
        },
      ],
    )
  }

  const user =
    await User.findById(
      userId,
    )
      .select({
        email:
          1,
      })
      .lean()

  const normalizedEmail =
    String(
      user?.email ||
        '',
    )
      .trim()
      .toLowerCase()

  if (normalizedEmail) {
    const pendingInvitation =
      await HouseholdInvitation.findOne({
        invitedEmail:
          normalizedEmail,

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

    if (pendingInvitation) {
      throw new ApiError(
        409,
        'Review your pending household invitation before creating a new household.',
        [
          {
            code:
              'HOUSEHOLD_INVITATION_PENDING',
          },
        ],
      )
    }
  }

  let household =
    null

  try {
    household =
      await Household.create({
        name:
          input.name,

        usualPeopleCount:
          input
            .usualPeopleCount,

        status:
          'active',

        createdByUserId:
          userId,
      })

    const membership =
      await HouseholdMembership.create({
        householdId:
          household._id,

        userId,

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

    return {
      hasHousehold:
        true,

      household:
        serializeHousehold(
          household,
        ),

      membership:
        serializeMembership(
          membership,
        ),
    }
  } catch (error) {
    if (
      household?._id
    ) {
      await Household.deleteOne({
        _id:
          household._id,

        createdByUserId:
          userId,
      }).catch(
        () => undefined,
      )
    }

    if (
      error?.code ===
      11000
    ) {
      throw new ApiError(
        409,
        'An active household context already exists for this account.',
        [
          {
            code:
              'HOUSEHOLD_CREATE_CONFLICT',
          },
        ],
      )
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Update Household Resource
|--------------------------------------------------------------------------
|
| Defense in depth:
|
| The route uses tenant middleware + household-role middleware.
| This service ALSO verifies owner/admin membership before mutation.
|
*/

export async function updateHouseholdForUser({
  userId,
  householdId,
  payload,
}) {
  const input =
    parseUpdateHouseholdInput(
      payload,
    )

  const membership =
    await requireHouseholdMembershipAccess({
      userId,

      householdId,

      allowedRoles: [
        'owner',
        'admin',
      ],
    })

  const household =
    await Household.findOneAndUpdate(
      {
        _id:
          householdId,

        status:
          'active',
      },

      {
        $set:
          input,
      },

      {
        new:
          true,

        runValidators:
          true,
      },
    ).lean()

  if (!household) {
    throw new ApiError(
      404,
      'Household was not found.',
      [
        {
          code:
            'HOUSEHOLD_NOT_FOUND',
        },
      ],
    )
  }

  return {
    hasHousehold:
      true,

    household:
      serializeHousehold(
        household,
      ),

    membership:
      serializeMembership(
        membership,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Update Household Member Role
|--------------------------------------------------------------------------
|
| Only the household owner may promote/demote admin/member roles.
| Ownership transfer is intentionally not part of the normal member-role API.
|
*/

export async function updateHouseholdMemberRoleForUser({
  actorUserId,
  householdId,
  membershipId,
  payload,
}) {
  const safeMembershipId =
    parseManagedMembershipId(
      membershipId,
    )

  const nextRole =
    parseManagedHouseholdRole(
      payload,
    )

  await requireHouseholdMembershipAccess({
    userId:
      actorUserId,

    householdId,

    allowedRoles: [
      'owner',
    ],
  })

  const targetMembership =
    await HouseholdMembership.findOne({
      _id:
        safeMembershipId,

      householdId,

      status:
        'active',
    })

  if (!targetMembership) {
    throw new ApiError(
      404,
      'Household member was not found.',
      [
        {
          code:
            'HOUSEHOLD_MEMBER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    targetMembership.role ===
    'owner'
  ) {
    throw new ApiError(
      409,
      'Household ownership cannot be changed through the member-role endpoint.',
      [
        {
          code:
            'HOUSEHOLD_OWNER_ROLE_PROTECTED',
        },
      ],
    )
  }

  if (
    targetMembership.role ===
    nextRole
  ) {
    return {
      membership:
        serializeMembership(
          targetMembership,
        ),

      unchanged:
        true,
    }
  }

  const now =
    new Date()

  targetMembership.role =
    nextRole

  targetMembership.roleUpdatedAt =
    now

  targetMembership.roleUpdatedByUserId =
    actorUserId

  await targetMembership.save()

  return {
    membership:
      serializeMembership(
        targetMembership,
      ),

    unchanged:
      false,
  }
}

/*
|--------------------------------------------------------------------------
| Remove Household Member
|--------------------------------------------------------------------------
|
| Owner may remove admin/member.
| Admin may remove a standard member only.
| Owner removal/transfer requires a separate governed lifecycle.
|
*/

export async function removeHouseholdMemberForUser({
  actorUserId,
  householdId,
  membershipId,
}) {
  const safeMembershipId =
    parseManagedMembershipId(
      membershipId,
    )

  const actorMembership =
    await requireHouseholdMembershipAccess({
      userId:
        actorUserId,

      householdId,

      allowedRoles: [
        'owner',
        'admin',
      ],
    })

  const targetMembership =
    await HouseholdMembership.findOne({
      _id:
        safeMembershipId,

      householdId,

      status:
        'active',
    })

  if (!targetMembership) {
    throw new ApiError(
      404,
      'Household member was not found.',
      [
        {
          code:
            'HOUSEHOLD_MEMBER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    targetMembership.role ===
    'owner'
  ) {
    throw new ApiError(
      409,
      'The household owner cannot be removed. Transfer ownership through a dedicated workflow first.',
      [
        {
          code:
            'HOUSEHOLD_OWNER_REMOVAL_PROTECTED',
        },
      ],
    )
  }

  if (
    String(
      targetMembership.userId,
    ) ===
    String(
      actorUserId,
    )
  ) {
    throw new ApiError(
      409,
      'Use the household leave workflow to remove your own membership.',
      [
        {
          code:
            'HOUSEHOLD_SELF_REMOVAL_REQUIRES_LEAVE_FLOW',
        },
      ],
    )
  }

  if (
    actorMembership.role ===
      'admin' &&
    targetMembership.role !==
      'member'
  ) {
    throw new ApiError(
      403,
      'A household admin can remove standard members only.',
      [
        {
          code:
            'HOUSEHOLD_OWNER_REQUIRED_FOR_ADMIN_REMOVAL',
        },
      ],
    )
  }

  const now =
    new Date()

  targetMembership.status =
    'removed'

  targetMembership.endedAt =
    now

  targetMembership.endedByUserId =
    actorUserId

  await targetMembership.save()

  return {
    membership:
      serializeMembership(
        targetMembership,
      ),
  }
}

