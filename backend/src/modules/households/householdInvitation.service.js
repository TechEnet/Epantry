import crypto from 'crypto'

import mongoose from 'mongoose'

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
  HouseholdMembership,
} from './householdMembership.model.js'

import {
  HouseholdInvitation,
} from './householdInvitation.model.js'

import {
  HOUSEHOLD_INVITATION_MAX_RESENDS,
  HOUSEHOLD_INVITATION_TTL_HOURS,
  normalizeHouseholdInvitationEmail,
  parseCreateHouseholdInvitationInput,
  parseHouseholdInvitationId,
  parseHouseholdInvitationToken,
} from './householdInvitation.validation.js'

import {
  requireHouseholdMembershipAccess,
} from './household.service.js'

/*
|--------------------------------------------------------------------------
| Token Security
|--------------------------------------------------------------------------
*/

function createInvitationToken() {
  return crypto
    .randomBytes(
      32,
    )
    .toString(
      'base64url',
    )
}

function hashInvitationToken(
  token,
) {
  return crypto
    .createHash(
      'sha256',
    )
    .update(
      token,
      'utf8',
    )
    .digest(
      'hex',
    )
}

function buildInvitationExpiry(
  now =
    new Date(),
) {
  return new Date(
    now.getTime() +
      HOUSEHOLD_INVITATION_TTL_HOURS *
        60 *
        60 *
        1000,
  )
}

/*
|--------------------------------------------------------------------------
| Display Role Label
|--------------------------------------------------------------------------
*/

function resolveHouseholdInvitationRoleLabel(
  invitation,
) {
  if (
    invitation?.role ===
    'admin'
  ) {
    return 'Admin'
  }

  const label =
    String(
      invitation?.roleLabel ||
        '',
    ).trim()

  return label ||
    'Member'
}

/*
|--------------------------------------------------------------------------
| Safe Serialization
|--------------------------------------------------------------------------
*/

export function serializeHouseholdInvitation(
  invitation,
) {
  if (!invitation) {
    return null
  }

  return {
    id:
      String(
        invitation._id,
      ),

    householdId:
      String(
        invitation.householdId,
      ),

    invitedEmail:
      invitation.invitedEmail,

    role:
      invitation.role,

    roleLabel:
      resolveHouseholdInvitationRoleLabel(
        invitation,
      ),

    status:
      invitation.status,

    expiresAt:
      invitation.expiresAt,

    resendCount:
      invitation.resendCount ||
      0,

    deliveryStatus:
      invitation.deliveryStatus,

    deliveryAttemptCount:
      invitation.deliveryAttemptCount ||
      0,

    lastDeliveryAttemptAt:
      invitation.lastDeliveryAttemptAt ||
      null,

    lastDeliveredAt:
      invitation.lastDeliveredAt ||
      null,

    acceptedAt:
      invitation.acceptedAt ||
      null,

    declinedAt:
      invitation.declinedAt ||
      null,

    revokedAt:
      invitation.revokedAt ||
      null,

    expiredAt:
      invitation.expiredAt ||
      null,

    createdAt:
      invitation.createdAt,

    updatedAt:
      invitation.updatedAt,
  }
}

function serializeAcceptedMembership(
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

    endedAt:
      membership.endedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Lifecycle Helpers
|--------------------------------------------------------------------------
*/

async function expireInvitationIfNeeded(
  invitation,
) {
  if (
    !invitation ||
    invitation.status !==
      'pending' ||
    !invitation.expiresAt ||
    invitation.expiresAt >
      new Date()
  ) {
    return invitation
  }

  const now =
    new Date()

  const expiredInvitation =
    await HouseholdInvitation.findOneAndUpdate(
      {
        _id:
          invitation._id,

        status:
          'pending',

        expiresAt: {
          $lte:
            now,
        },
      },

      {
        $set: {
          status:
            'expired',

          expiredAt:
            now,
        },
      },

      {
        new:
          true,
      },
    ).lean()

  return expiredInvitation ||
    HouseholdInvitation.findById(
      invitation._id,
    ).lean()
}

async function expireStaleHouseholdInvitations(
  householdId,
) {
  const now =
    new Date()

  await HouseholdInvitation.updateMany(
    {
      householdId,

      status:
        'pending',

      expiresAt: {
        $lte:
          now,
      },
    },

    {
      $set: {
        status:
          'expired',

        expiredAt:
          now,
      },
    },
  )
}

async function requireActiveHousehold(
  householdId,
) {
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

  return household
}

async function requireInvitationActor({
  actorUserId,
  householdId,
}) {
  const membership =
    await requireHouseholdMembershipAccess({
      userId:
        actorUserId,

      householdId,

      allowedRoles: [
        'owner',
        'admin',
      ],
    })

  await requireActiveHousehold(
    householdId,
  )

  return membership
}

async function requireActiveInviteeUser(
  userId,
) {
  const user =
    await User.findById(
      userId,
    ).lean()

  if (
    !user ||
    user.accountStatus !==
      'active'
  ) {
    throw new ApiError(
      403,
      'Household invitation access is not available for this account.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_ACCOUNT_UNAVAILABLE',
        },
      ],
    )
  }

  if (
    user.emailVerified !==
    true
  ) {
    throw new ApiError(
      403,
      'Verify your email before accepting a household invitation.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_EMAIL_VERIFICATION_REQUIRED',
        },
      ],
    )
  }

  if (
    user.customerEnabled !==
    true
  ) {
    throw new ApiError(
      403,
      'Customer access is required to join a household.',
      [
        {
          code:
            'HOUSEHOLD_CUSTOMER_ACCESS_REQUIRED',
        },
      ],
    )
  }

  return user
}

function requireMatchingInvitationEmail({
  user,
  invitation,
}) {
  const currentEmail =
    normalizeHouseholdInvitationEmail(
      user.email,
    )

  if (
    currentEmail !==
    invitation.invitedEmail
  ) {
    throw new ApiError(
      403,
      'This household invitation was sent to a different email address.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_EMAIL_MISMATCH',
        },
      ],
    )
  }
}

function getInvitationIdFromNotificationLocator(
  value,
) {
  const normalized =
    String(
      value ||
      '',
    ).trim()

  const prefix =
    'notification-'

  if (
    !normalized.startsWith(
      prefix,
    )
  ) {
    return null
  }

  const invitationId =
    normalized.slice(
      prefix.length,
    )

  return mongoose.isValidObjectId(
    invitationId,
  )
    ? invitationId
    : null
}

async function findInvitationByToken(
  token,
) {
  const notificationInvitationId =
    getInvitationIdFromNotificationLocator(
      token,
    )

  let invitation

  if (
    notificationInvitationId
  ) {
    invitation =
      await HouseholdInvitation.findById(
        notificationInvitationId,
      ).lean()
  } else {
    const normalizedToken =
      parseHouseholdInvitationToken(
        token,
      )

    const tokenHash =
      hashInvitationToken(
        normalizedToken,
      )

    invitation =
      await HouseholdInvitation.findOne({
        tokenHash,
      }).lean()
  }

  if (!invitation) {
    throw new ApiError(
      404,
      'Household invitation was not found.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_FOUND',
        },
      ],
    )
  }

  invitation =
    await expireInvitationIfNeeded(
      invitation,
    )

  return invitation
}

export async function getHouseholdInvitationPublicPreview({
  token,
}) {
  if (
    getInvitationIdFromNotificationLocator(
      token,
    )
  ) {
    throw new ApiError(
      404,
      'Household invitation was not found.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_FOUND',
        },
      ],
    )
  }

  const invitation =
    await findInvitationByToken(
      token,
    )

  const [
    household,
    inviter,
  ] =
    await Promise.all([
      Household.findOne({
        _id:
          invitation.householdId,

        status:
          'active',
      })
        .select({
          name:
            1,
        })
        .lean(),

      User.findById(
        invitation.invitedByUserId,
      )
        .select({
          name:
            1,
        })
        .lean(),
    ])

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
    invitation: {
      id:
        String(
          invitation._id,
        ),

      invitedEmail:
        invitation.invitedEmail,

      role:
        invitation.role,

      roleLabel:
        resolveHouseholdInvitationRoleLabel(
          invitation,
        ),

      status:
        invitation.status,

      expiresAt:
        invitation.expiresAt,
    },

    household: {
      id:
        String(
          household._id,
        ),

      name:
        household.name,
    },

    inviter: {
      name:
        inviter?.name ||
        'A household administrator',
    },
  }
}

/*
|--------------------------------------------------------------------------
| Create Invitation
|--------------------------------------------------------------------------
|
| Owner may invite admin/member.
| Admin may invite members, but may not create peer admins.
|
| The returned invitationToken is INTERNAL delivery material. Controllers
| must never serialize it into normal API responses.
|
*/

export async function createHouseholdInvitation({
  actorUserId,
  householdId,
  payload,
}) {
  const input =
    parseCreateHouseholdInvitationInput(
      payload,
    )

  const actorMembership =
    await requireInvitationActor({
      actorUserId,
      householdId,
    })

  if (
    actorMembership.role ===
      'admin' &&
    input.role ===
      'admin'
  ) {
    throw new ApiError(
      403,
      'Only the household owner can invite another household admin.',
      [
        {
          code:
            'HOUSEHOLD_OWNER_REQUIRED_FOR_ADMIN_INVITE',
        },
      ],
    )
  }

  const actorUser =
    await User.findById(
      actorUserId,
    )
      .select({
        email:
          1,
      })
      .lean()

  const invitedEmail =
    input.email

  if (
    actorUser?.email &&
    normalizeHouseholdInvitationEmail(
      actorUser.email,
    ) ===
      invitedEmail
  ) {
    throw new ApiError(
      409,
      'You are already a member of this household.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_SELF_NOT_ALLOWED',
        },
      ],
    )
  }

  await expireStaleHouseholdInvitations(
    householdId,
  )

  const existingPendingInvitation =
    await HouseholdInvitation.findOne({
      householdId,

      invitedEmail,

      status:
        'pending',
    }).lean()

  if (
    existingPendingInvitation
  ) {
    throw new ApiError(
      409,
      'A pending invitation already exists for this email address.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_ALREADY_PENDING',

          invitationId:
            String(
              existingPendingInvitation._id,
            ),
        },
      ],
    )
  }

  const existingUser =
    await User.findOne({
      email:
        invitedEmail,
    })
      .select({
        _id:
          1,
      })
      .lean()

  if (
    existingUser?._id
  ) {
    const existingMembership =
      await HouseholdMembership.findOne({
        householdId,

        userId:
          existingUser._id,

        status:
          'active',
      }).lean()

    if (
      existingMembership
    ) {
      throw new ApiError(
        409,
        'This user is already an active member of the household.',
        [
          {
            code:
              'HOUSEHOLD_MEMBER_ALREADY_ACTIVE',
          },
        ],
      )
    }
  }

  const invitationToken =
    createInvitationToken()

  const tokenHash =
    hashInvitationToken(
      invitationToken,
    )

  const now =
    new Date()

  try {
    const invitation =
      await HouseholdInvitation.create({
        householdId,

        invitedEmail,

        role:
          input.role,

        roleLabel:
          input.role ===
            'admin'
            ? 'Admin'
            : String(
                input.roleLabel ||
                  'Member',
              ).trim(),

        status:
          'pending',

        tokenHash,

        expiresAt:
          buildInvitationExpiry(
            now,
          ),

        invitedByUserId:
          actorUserId,

        deliveryStatus:
          'pending',

        deliveryAttemptCount:
          0,

        lastDeliveryAttemptAt:
          null,

        lastDeliveredAt:
          null,

        deliveryProviderMessageId:
          null,
      })

    return {
      invitation:
        serializeHouseholdInvitation(
          invitation,
        ),

      invitationToken,
    }
  } catch (error) {
    if (
      error?.code ===
      11000
    ) {
      throw new ApiError(
        409,
        'A pending household invitation already exists for this email address.',
        [
          {
            code:
              'HOUSEHOLD_INVITATION_CREATE_CONFLICT',
          },
        ],
      )
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| List Household Invitations
|--------------------------------------------------------------------------
*/

export async function listHouseholdInvitationsForActor({
  actorUserId,
  householdId,
}) {
  await requireInvitationActor({
    actorUserId,
    householdId,
  })

  await expireStaleHouseholdInvitations(
    householdId,
  )

  const invitations =
    await HouseholdInvitation.find({
      householdId,
    })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        100,
      )
      .lean()

  return {
    invitations:
      invitations.map(
        serializeHouseholdInvitation,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Invitation Preview For Logged-in Invitee
|--------------------------------------------------------------------------
*/

export async function getHouseholdInvitationForUser({
  userId,
  token,
}) {
  const invitation =
    await findInvitationByToken(
      token,
    )

  const user =
    await requireActiveInviteeUser(
      userId,
    )

  requireMatchingInvitationEmail({
    user,
    invitation,
  })

  const [
    household,
    inviter,
  ] =
    await Promise.all([
      requireActiveHousehold(
        invitation.householdId,
      ),

      User.findById(
        invitation.invitedByUserId,
      )
        .select({
          name:
            1,
        })
        .lean(),
    ])

  return {
    invitation:
      serializeHouseholdInvitation(
        invitation,
      ),

    household: {
      id:
        String(
          household._id,
        ),

      name:
        household.name,
    },

    inviter: {
      name:
        inviter?.name ||
        'A household administrator',
    },
  }
}

/*
|--------------------------------------------------------------------------
| Accept Invitation
|--------------------------------------------------------------------------
|
| Acceptance is transactional because invitation consumption and household
| membership activation are one authorization change.
|
*/

export async function acceptHouseholdInvitationForUser({
  userId,
  token,
}) {
  const invitationBeforeTransaction =
    await findInvitationByToken(
      token,
    )

  const user =
    await requireActiveInviteeUser(
      userId,
    )

  requireMatchingInvitationEmail({
    user,
    invitation:
      invitationBeforeTransaction,
  })

  if (
    invitationBeforeTransaction.status ===
      'expired'
  ) {
    throw new ApiError(
      410,
      'This household invitation has expired.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_EXPIRED',
        },
      ],
    )
  }

  if (
    invitationBeforeTransaction.status ===
      'accepted' &&
    String(
      invitationBeforeTransaction.acceptedByUserId ||
        '',
    ) ===
      String(
        userId,
      )
  ) {
    const existingMembership =
      await HouseholdMembership.findOne({
        householdId:
          invitationBeforeTransaction.householdId,

        userId,

        status:
          'active',
      }).lean()

    return {
      invitation:
        serializeHouseholdInvitation(
          invitationBeforeTransaction,
        ),

      membership:
        serializeAcceptedMembership(
          existingMembership,
        ),

      alreadyAccepted:
        true,
    }
  }

  if (
    invitationBeforeTransaction.status !==
    'pending'
  ) {
    throw new ApiError(
      409,
      'This household invitation is no longer available.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_PENDING',

          status:
            invitationBeforeTransaction.status,
        },
      ],
    )
  }

  const session =
    await mongoose.startSession()

  let result =
    null

  try {
    await session.withTransaction(
      async () => {
        const invitation =
          await HouseholdInvitation.findOne({
            _id:
              invitationBeforeTransaction._id,

            tokenHash:
              invitationBeforeTransaction.tokenHash,
          })
            .session(
              session,
            )

        if (!invitation) {
          throw new ApiError(
            404,
            'Household invitation was not found.',
            [
              {
                code:
                  'HOUSEHOLD_INVITATION_NOT_FOUND',
              },
            ],
          )
        }

        if (
          invitation.status !==
          'pending'
        ) {
          throw new ApiError(
            409,
            'This household invitation is no longer available.',
            [
              {
                code:
                  'HOUSEHOLD_INVITATION_NOT_PENDING',

                status:
                  invitation.status,
              },
            ],
          )
        }

        const now =
          new Date()

        if (
          invitation.expiresAt <=
          now
        ) {
          throw new ApiError(
            410,
            'This household invitation has expired.',
            [
              {
                code:
                  'HOUSEHOLD_INVITATION_EXPIRED',
              },
            ],
          )
        }

        const household =
          await Household.findOne({
            _id:
              invitation.householdId,

            status:
              'active',
          })
            .session(
              session,
            )

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

        const existingTargetMembership =
          await HouseholdMembership.findOne({
            householdId:
              invitation.householdId,

            userId,
          })
            .session(
              session,
            )

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

        let membership =
          existingTargetMembership

        if (
          membership &&
          membership.status ===
            'active'
        ) {
          membership.role =
            invitation.role

          membership.roleLabel =
            resolveHouseholdInvitationRoleLabel(
              invitation,
            )

          membership.selectedForContext =
            true

          membership.roleUpdatedAt =
            now

          membership.roleUpdatedByUserId =
            invitation.invitedByUserId

          await membership.save({
            session,
          })
        } else {
          const historicalMembership =
            await HouseholdMembership.findOne({
              householdId:
                invitation.householdId,

              userId,
            })
              .session(
                session,
              )

          if (
            historicalMembership
          ) {
            historicalMembership.role =
              invitation.role

            historicalMembership.roleLabel =
              resolveHouseholdInvitationRoleLabel(
                invitation,
              )

            historicalMembership.status =
              'active'

            historicalMembership.selectedForContext =
              true

            historicalMembership.joinedAt =
              now

            historicalMembership.endedAt =
              null

            historicalMembership.endedByUserId =
              null

            historicalMembership.roleUpdatedAt =
              now

            historicalMembership.roleUpdatedByUserId =
              invitation.invitedByUserId

            membership =
              await historicalMembership.save({
                session,
              })
          } else {
            const createdMemberships =
              await HouseholdMembership.create(
                [
                  {
                    householdId:
                      invitation.householdId,

                    userId,

                    role:
                      invitation.role,

                    roleLabel:
                      resolveHouseholdInvitationRoleLabel(
                        invitation,
                      ),

                    status:
                      'active',

                    selectedForContext:
                      true,

                    joinedAt:
                      now,

                    endedAt:
                      null,

                    endedByUserId:
                      null,

                    roleUpdatedAt:
                      now,

                    roleUpdatedByUserId:
                      invitation.invitedByUserId,
                  },
                ],

                {
                  session,
                },
              )

            membership =
              createdMemberships[0]
          }
        }

        invitation.status =
          'accepted'

        invitation.acceptedByUserId =
          userId

        invitation.acceptedAt =
          now

        await invitation.save({
          session,
        })

        result = {
          invitation:
            serializeHouseholdInvitation(
              invitation,
            ),

          membership:
            serializeAcceptedMembership(
              membership,
            ),

          alreadyAccepted:
            false,
        }
      },
    )
  } catch (error) {
    if (
      error?.code ===
      11000
    ) {
      throw new ApiError(
        409,
        'Household membership changed while this invitation was being accepted. Please refresh and try again.',
        [
          {
            code:
              'HOUSEHOLD_MEMBERSHIP_ACCEPT_CONFLICT',
          },
        ],
      )
    }

    throw error
  } finally {
    await session.endSession()
  }

  return result
}

/*
|--------------------------------------------------------------------------
| Decline Invitation
|--------------------------------------------------------------------------
*/

export async function declineHouseholdInvitationForUser({
  userId,
  token,
}) {
  const invitation =
    await findInvitationByToken(
      token,
    )

  const user =
    await requireActiveInviteeUser(
      userId,
    )

  requireMatchingInvitationEmail({
    user,
    invitation,
  })

  if (
    invitation.status ===
    'expired'
  ) {
    throw new ApiError(
      410,
      'This household invitation has expired.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_EXPIRED',
        },
      ],
    )
  }

  if (
    invitation.status !==
    'pending'
  ) {
    throw new ApiError(
      409,
      'This household invitation is no longer pending.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_PENDING',

          status:
            invitation.status,
        },
      ],
    )
  }

  const now =
    new Date()

  const declinedInvitation =
    await HouseholdInvitation.findOneAndUpdate(
      {
        _id:
          invitation._id,

        status:
          'pending',
      },

      {
        $set: {
          status:
            'declined',

          declinedByUserId:
            userId,

          declinedAt:
            now,
        },
      },

      {
        new:
          true,
      },
    ).lean()

  if (!declinedInvitation) {
    throw new ApiError(
      409,
      'This household invitation changed before it could be declined.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_STATE_CONFLICT',
        },
      ],
    )
  }

  return {
    invitation:
      serializeHouseholdInvitation(
        declinedInvitation,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Revoke Invitation
|--------------------------------------------------------------------------
*/

export async function revokeHouseholdInvitationForActor({
  actorUserId,
  householdId,
  invitationId,
}) {
  const safeInvitationId =
    parseHouseholdInvitationId(
      invitationId,
    )

  const actorMembership =
    await requireInvitationActor({
      actorUserId,
      householdId,
    })

  const invitation =
    await HouseholdInvitation.findOne({
      _id:
        safeInvitationId,

      householdId,
    }).lean()

  if (!invitation) {
    throw new ApiError(
      404,
      'Household invitation was not found.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_FOUND',
        },
      ],
    )
  }

  const currentInvitation =
    await expireInvitationIfNeeded(
      invitation,
    )

  if (
    actorMembership.role ===
      'admin' &&
    currentInvitation.role ===
      'admin'
  ) {
    throw new ApiError(
      403,
      'Only the household owner can revoke an administrator invitation.',
      [
        {
          code:
            'HOUSEHOLD_OWNER_REQUIRED_FOR_ADMIN_INVITE',
        },
      ],
    )
  }

  if (
    currentInvitation.status !==
    'pending'
  ) {
    throw new ApiError(
      409,
      'Only a pending household invitation can be revoked.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_PENDING',

          status:
            currentInvitation.status,
        },
      ],
    )
  }

  const now =
    new Date()

  const revokedInvitation =
    await HouseholdInvitation.findOneAndUpdate(
      {
        _id:
          currentInvitation._id,

        status:
          'pending',
      },

      {
        $set: {
          status:
            'revoked',

          revokedByUserId:
            actorUserId,

          revokedAt:
            now,
        },
      },

      {
        new:
          true,
      },
    ).lean()

  if (!revokedInvitation) {
    throw new ApiError(
      409,
      'Household invitation changed before it could be revoked.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_STATE_CONFLICT',
        },
      ],
    )
  }

  return {
    invitation:
      serializeHouseholdInvitation(
        revokedInvitation,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Prepare Resend
|--------------------------------------------------------------------------
|
| Resend rotates the secret token and extends expiry. An old email link stops
| working immediately after a successful resend preparation.
|
| The returned invitationToken is internal delivery material only.
|
*/

export async function prepareHouseholdInvitationResend({
  actorUserId,
  householdId,
  invitationId,
}) {
  const safeInvitationId =
    parseHouseholdInvitationId(
      invitationId,
    )

  const actorMembership =
    await requireInvitationActor({
      actorUserId,
      householdId,
    })

  let invitation =
    await HouseholdInvitation.findOne({
      _id:
        safeInvitationId,

      householdId,
    }).lean()

  if (!invitation) {
    throw new ApiError(
      404,
      'Household invitation was not found.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_FOUND',
        },
      ],
    )
  }

  invitation =
    await expireInvitationIfNeeded(
      invitation,
    )

  if (
    invitation.status !==
    'pending' &&
    invitation.status !==
    'expired'
  ) {
    throw new ApiError(
      409,
      'Only a pending or expired household invitation can be resent.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_RESEND_NOT_ALLOWED',

          status:
            invitation.status,
        },
      ],
    )
  }

  if (
    actorMembership.role ===
      'admin' &&
    invitation.role ===
      'admin'
  ) {
    throw new ApiError(
      403,
      'Only the household owner can resend an administrator invitation.',
      [
        {
          code:
            'HOUSEHOLD_OWNER_REQUIRED_FOR_ADMIN_INVITE',
        },
      ],
    )
  }

  if (
    invitation.resendCount >=
    HOUSEHOLD_INVITATION_MAX_RESENDS
  ) {
    throw new ApiError(
      429,
      'This invitation has reached the resend limit. Revoke it and create a new invitation if needed.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_RESEND_LIMIT_REACHED',
        },
      ],
    )
  }

  const invitationToken =
    createInvitationToken()

  const now =
    new Date()

  const updatedInvitation =
    await HouseholdInvitation.findOneAndUpdate(
      {
        _id:
          invitation._id,

        householdId,

        status: {
          $in: [
            'pending',
            'expired',
          ],
        },
      },

      {
        $set: {
          status:
            'pending',

          tokenHash:
            hashInvitationToken(
              invitationToken,
            ),

          expiresAt:
            buildInvitationExpiry(
              now,
            ),

          expiredAt:
            null,

          deliveryStatus:
            'pending',

          deliveryProviderMessageId:
            null,
        },

        $inc: {
          resendCount:
            1,
        },
      },

      {
        new:
          true,

        runValidators:
          true,
      },
    ).lean()

  if (!updatedInvitation) {
    throw new ApiError(
      409,
      'Household invitation changed before it could be resent.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_STATE_CONFLICT',
        },
      ],
    )
  }

  return {
    invitation:
      serializeHouseholdInvitation(
        updatedInvitation,
      ),

    invitationToken,
  }
}

/*
|--------------------------------------------------------------------------
| Record Delivery Attempt
|--------------------------------------------------------------------------
|
| This is called by the Part 2 delivery adapter after it attempts email
| delivery. Provider credentials/messages remain outside the invitation model.
|
*/

export async function recordHouseholdInvitationDelivery({
  invitationId,
  delivered,
  providerMessageId =
    null,
}) {
  const safeInvitationId =
    parseHouseholdInvitationId(
      invitationId,
    )

  const now =
    new Date()

  const update = {
    $set: {
      deliveryStatus:
        delivered
          ? 'sent'
          : 'failed',

      lastDeliveryAttemptAt:
        now,

      deliveryProviderMessageId:
        providerMessageId
          ? String(
              providerMessageId,
            ).slice(
              0,
              240,
            )
          : null,
    },

    $inc: {
      deliveryAttemptCount:
        1,
    },
  }

  if (
    delivered
  ) {
    update.$set.lastDeliveredAt =
      now
  }

  const invitation =
    await HouseholdInvitation.findByIdAndUpdate(
      safeInvitationId,
      update,
      {
        new:
          true,

        runValidators:
          true,
      },
    ).lean()

  if (!invitation) {
    throw new ApiError(
      404,
      'Household invitation was not found.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_NOT_FOUND',
        },
      ],
    )
  }

  return {
    invitation:
      serializeHouseholdInvitation(
        invitation,
      ),
  }
}
