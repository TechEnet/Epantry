import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  createNotificationIntentBestEffort,
} from '../notifications/notification.service.js'

import {
  User,
} from '../users/user.model.js'

import {
  Household,
} from './household.model.js'

import {
  HouseholdInvitation,
} from './householdInvitation.model.js'

import {
  recordHouseholdInvitationDelivery,
} from './householdInvitation.service.js'

/*
|--------------------------------------------------------------------------
| Delivery Configuration
|--------------------------------------------------------------------------
|
| Household invitations reuse the existing Brevo transactional-email
| configuration. No second mail provider/configuration surface is introduced.
|
*/

function assertHouseholdInvitationEmailConfiguration() {
  if (
    !env.brevoApiKey ||
    !env.brevoSenderEmail ||
    !env.frontendUrl
  ) {
    throw new ApiError(
      500,
      'Household invitation email delivery is not configured.',
      [
        {
          code:
            'HOUSEHOLD_INVITATION_EMAIL_NOT_CONFIGURED',
        },
      ],
    )
  }
}

/*
|--------------------------------------------------------------------------
| Invitation URL
|--------------------------------------------------------------------------
|
| Raw invitation tokens are used only to build the one-time frontend link.
| They are never written to logs or persisted by this delivery service.
|
*/

function buildHouseholdInvitationUrl(
  invitationToken,
) {
  const baseUrl =
    String(
      env.frontendUrl,
    ).replace(
      /\/+$/,
      '',
    )

  return `${baseUrl}/household-invitations/${encodeURIComponent(
    invitationToken,
  )}`
}

/*
|--------------------------------------------------------------------------
| Delivery Context
|--------------------------------------------------------------------------
*/

async function loadHouseholdInvitationDeliveryContext(
  invitationId,
) {
  const invitation =
    await HouseholdInvitation.findById(
      invitationId,
    )
      .select({
        householdId:
          1,
        invitedEmail:
          1,
        role:
          1,
        roleLabel:
          1,
        status:
          1,
        expiresAt:
          1,
        invitedByUserId:
          1,
      })
      .lean()

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
      'Only a pending household invitation can be delivered.',
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
    invitation,
    household,
    inviter,
  }
}

function getHouseholdInvitationRoleLabel(
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
| Brevo Transactional Email
|--------------------------------------------------------------------------
|
| Invitation delivery uses the same Brevo transactional-email configuration
| as registration OTP email. Transient transport/provider failures are retried
| once before the invitation is marked as failed.
|
*/

const BREVO_TRANSACTIONAL_EMAIL_URL =
  'https://api.brevo.com/v3/smtp/email'

const HOUSEHOLD_INVITATION_EMAIL_TIMEOUT_MS =
  20000

const HOUSEHOLD_INVITATION_EMAIL_MAX_ATTEMPTS =
  2

function wait(
  milliseconds,
) {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      )
    },
  )
}

function shouldRetryBrevoStatus(
  status,
) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  )
}

async function readBrevoFailure(
  response,
) {
  const payload =
    await response
      .json()
      .catch(
        () => null,
      )

  return {
    status:
      response.status,

    providerCode:
      String(
        payload?.code ||
          '',
      )
        .trim()
        .slice(
          0,
          120,
        ) ||
      null,
  }
}

function getHouseholdInvitationEmailErrorCode({
  status = null,
  networkFailure = false,
}) {
  if (
    networkFailure
  ) {
    return 'HOUSEHOLD_INVITATION_EMAIL_NETWORK_FAILED'
  }

  if (
    status === 401 ||
    status === 403
  ) {
    return 'HOUSEHOLD_INVITATION_EMAIL_PROVIDER_AUTH_FAILED'
  }

  if (
    status === 400
  ) {
    return 'HOUSEHOLD_INVITATION_EMAIL_PROVIDER_REJECTED'
  }

  if (
    status === 429
  ) {
    return 'HOUSEHOLD_INVITATION_EMAIL_PROVIDER_RATE_LIMITED'
  }

  return 'HOUSEHOLD_INVITATION_EMAIL_DELIVERY_FAILED'
}

function logHouseholdInvitationEmailFailure({
  attempt,
  status = null,
  providerCode = null,
  networkFailure = false,
}) {
  console.error(
    '[household-invitation-email] delivery failed',
    {
      attempt,
      status,
      providerCode,
      networkFailure,
    },
  )
}

async function sendBrevoHouseholdInvitationEmail({
  invitation,
  household,
  inviter,
  invitationToken,
}) {
  assertHouseholdInvitationEmailConfiguration()

  const invitationUrl =
    buildHouseholdInvitationUrl(
      invitationToken,
    )

  const inviterName =
    String(
      inviter?.name ||
        'A household administrator',
    ).trim()

  const householdName =
    String(
      household.name ||
        'EPANTRY household',
    ).trim()

  const roleLabel =
    getHouseholdInvitationRoleLabel(
      invitation,
    )

  const requestBody = {
    sender: {
      name:
        env.brevoSenderName,

      email:
        env.brevoSenderEmail,
    },

    to: [
      {
        email:
          invitation.invitedEmail,
      },
    ],

    subject:
      `Join ${householdName} on EPANTRY`,

    textContent:
      [
        'Hello,',
        '',
        `${inviterName} invited you to join "${householdName}" on EPANTRY as ${roleLabel}.`,
        '',
        'Open this secure invitation link:',
        invitationUrl,
        '',
        `This invitation expires on ${new Date(
          invitation.expiresAt,
        ).toISOString()}.`,
        '',
        'Use the same email address that received this invitation. If you do not have an EPANTRY account yet, create a Customer account with this email and complete the existing verification steps.',
        '',
        'After sign-in or registration, EPANTRY will ask you to accept or reject the household invitation.',
        '',
        'If you were not expecting this invitation, you can ignore this email.',
      ].join(
        '\n',
      ),
  }

  let lastFailure = {
    status:
      null,

    providerCode:
      null,

    networkFailure:
      false,
  }

  for (
    let attempt = 1;
    attempt <=
    HOUSEHOLD_INVITATION_EMAIL_MAX_ATTEMPTS;
    attempt += 1
  ) {
    let response

    try {
      response =
        await fetch(
          BREVO_TRANSACTIONAL_EMAIL_URL,
          {
            method:
              'POST',

            headers: {
              accept:
                'application/json',

              'api-key':
                env.brevoApiKey,

              'content-type':
                'application/json',
            },

            body:
              JSON.stringify(
                requestBody,
              ),

            signal:
              AbortSignal.timeout(
                HOUSEHOLD_INVITATION_EMAIL_TIMEOUT_MS,
              ),
          },
        )
    } catch {
      lastFailure = {
        status:
          null,

        providerCode:
          null,

        networkFailure:
          true,
      }

      if (
        attempt <
        HOUSEHOLD_INVITATION_EMAIL_MAX_ATTEMPTS
      ) {
        await wait(
          600,
        )

        continue
      }

      logHouseholdInvitationEmailFailure({
        attempt,
        ...lastFailure,
      })

      break
    }

    if (
      response.ok
    ) {
      const result =
        await response
          .json()
          .catch(
            () => ({}),
          )

      return {
        messageId:
          result.messageId ||
          null,
      }
    }

    lastFailure = {
      ...(await readBrevoFailure(
        response,
      )),

      networkFailure:
        false,
    }

    if (
      attempt <
        HOUSEHOLD_INVITATION_EMAIL_MAX_ATTEMPTS &&
      shouldRetryBrevoStatus(
        response.status,
      )
    ) {
      await wait(
        response.status === 429
          ? 1200
          : 600,
      )

      continue
    }

    logHouseholdInvitationEmailFailure({
      attempt,
      ...lastFailure,
    })

    break
  }

  throw new ApiError(
    502,
    'Unable to send the household invitation email right now.',
    [
      {
        code:
          getHouseholdInvitationEmailErrorCode(
            lastFailure,
          ),

        providerStatus:
          lastFailure.status,

        providerCode:
          lastFailure.providerCode,
      },
    ],
  )
}

/*
|--------------------------------------------------------------------------
| Deliver Invitation
|--------------------------------------------------------------------------
*/

export async function deliverHouseholdInvitationEmail({
  invitationId,
  invitationToken,
}) {
  const context =
    await loadHouseholdInvitationDeliveryContext(
      invitationId,
    )

  try {
    const delivery =
      await sendBrevoHouseholdInvitationEmail({
        ...context,
        invitationToken,
      })

    const recorded =
      await recordHouseholdInvitationDelivery({
        invitationId,
        delivered:
          true,
        providerMessageId:
          delivery.messageId,
      })

    return {
      delivered:
        true,
      invitation:
        recorded.invitation,
    }
  } catch (error) {
    await recordHouseholdInvitationDelivery({
      invitationId,
      delivered:
        false,
      providerMessageId:
        null,
    }).catch(
      () => undefined,
    )

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Best-effort Controller Helper
|--------------------------------------------------------------------------
|
| The invitation itself is the source of truth. If email delivery fails, the
| invitation remains pending and can be resent later instead of creating a
| duplicate invitation because the HTTP request failed after persistence.
|
*/

export async function deliverHouseholdInvitationEmailBestEffort(
  options,
) {
  try {
    return await deliverHouseholdInvitationEmail(
      options,
    )
  } catch (error) {
    return {
      delivered:
        false,
      errorCode:
        error?.errors?.[0]?.code ||
        'HOUSEHOLD_INVITATION_EMAIL_DELIVERY_FAILED',
    }
  }
}


/*
|--------------------------------------------------------------------------
| In-app Invitation Notification
|--------------------------------------------------------------------------
*/

export async function notifyHouseholdInviteeInAppBestEffort({
  invitationId,
  userId = null,
}) {
  try {
    const invitation =
      await HouseholdInvitation.findById(
        invitationId,
      )
        .select({
          householdId:
            1,
          invitedEmail:
            1,
          role:
            1,
          roleLabel:
            1,
          status:
            1,
          invitedByUserId:
            1,
        })
        .lean()

    if (
      !invitation ||
      invitation.status !==
        'pending'
    ) {
      return null
    }

    const invitee =
      userId
        ? await User.findById(
            userId,
          )
            .select({
              _id:
                1,
              email:
                1,
            })
            .lean()
        : await User.findOne({
            email:
              invitation.invitedEmail,
          })
            .select({
              _id:
                1,
              email:
                1,
            })
            .lean()

    if (
      !invitee?._id ||
      String(
        invitee.email ||
        '',
      )
        .trim()
        .toLowerCase() !==
        invitation.invitedEmail
    ) {
      return null
    }

    const [
      household,
      inviter,
    ] =
      await Promise.all([
        Household.findById(
          invitation.householdId,
        )
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
      return null
    }

    const roleLabel =
      getHouseholdInvitationRoleLabel(
        invitation,
      )

    return createNotificationIntentBestEffort({
      userId:
        invitee._id,
      householdId:
        invitation.householdId,
      category:
        'household',
      triggerType:
        'household_invitation_received',
      reasonCode:
        'household_invitation_received',
      explanation: `${inviter?.name || 'A household administrator'} invited you to join ${household.name} as ${roleLabel}. Open this notification to accept or reject the invitation.`,
      relatedEntityType:
        'household_invitation',
      relatedEntityId:
        String(
          invitation._id,
        ),
      sourceDomain:
        'households',
      sourceVersion:
        'multi-household-invitations-v1',
      actions: [
        'dismiss',
      ],
      requestedChannels: [
        'in_app',
      ],
      dedupeKey: `household-invitation-received:${String(invitation._id)}:${String(invitee._id)}`,
      correlationId:
        String(
          invitation._id,
        ),
    })
  } catch {
    return null
  }
}

export async function notifyPendingHouseholdInvitationsForUserBestEffort({
  userId,
  email,
}) {
  try {
    const normalizedEmail =
      String(
        email ||
        '',
      )
        .trim()
        .toLowerCase()

    if (
      !userId ||
      !normalizedEmail
    ) {
      return []
    }

    const invitations =
      await HouseholdInvitation.find({
        invitedEmail:
          normalizedEmail,
        status:
          'pending',
        expiresAt: {
          $gt:
            new Date(),
        },
      })
        .select({
          _id:
            1,
        })
        .lean()

    const results = []

    for (
      const invitation of
      invitations
    ) {
      const result =
        await notifyHouseholdInviteeInAppBestEffort({
          invitationId:
            invitation._id,
          userId,
        })

      if (result) {
        results.push(
          result,
        )
      }
    }

    return results
  } catch {
    return []
  }
}

/*
|--------------------------------------------------------------------------
| Invitation Decision Notice To Inviter
|--------------------------------------------------------------------------
*/

async function sendBrevoHouseholdInvitationDecisionEmail({
  inviter,
  invitee,
  household,
  invitation,
  decision,
}) {
  assertHouseholdInvitationEmailConfiguration()

  if (!inviter?.email) {
    return {
      delivered:
        false,
    }
  }

  const roleLabel =
    getHouseholdInvitationRoleLabel(
      invitation,
    )

  const decisionLabel =
    decision ===
    'accepted'
      ? 'accepted'
      : 'rejected'

  const response =
    await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method:
          'POST',
        headers: {
          accept:
            'application/json',
          'api-key':
            env.brevoApiKey,
          'content-type':
            'application/json',
        },
        body:
          JSON.stringify({
            sender: {
              name:
                env.brevoSenderName,
              email:
                env.brevoSenderEmail,
            },
            to: [
              {
                email:
                  inviter.email,
              },
            ],
            subject:
              `${invitee?.name || invitation.invitedEmail} ${decisionLabel} your EPANTRY household invitation`,
            textContent: [
              'Hello,',
              '',
              `${invitee?.name || invitation.invitedEmail} ${decisionLabel} your invitation to join "${household.name}" as ${roleLabel}.`,
              '',
              'Open EPANTRY Household to review your current members and invitations.',
            ].join(
              '\n',
            ),
          }),
        signal:
          AbortSignal.timeout(
            10000,
          ),
      },
    )

  if (!response.ok) {
    throw new Error(
      'Invitation decision email delivery failed.',
    )
  }

  return {
    delivered:
      true,
  }
}

export async function notifyHouseholdInvitationDecisionBestEffort({
  invitationId,
  inviteeUserId,
  decision,
}) {
  try {
    const invitation =
      await HouseholdInvitation.findById(
        invitationId,
      )
        .select({
          householdId:
            1,
          invitedEmail:
            1,
          role:
            1,
          roleLabel:
            1,
          invitedByUserId:
            1,
        })
        .lean()

    if (!invitation) {
      return null
    }

    const [
      household,
      inviter,
      invitee,
    ] =
      await Promise.all([
        Household.findById(
          invitation.householdId,
        )
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
            email:
              1,
          })
          .lean(),
        User.findById(
          inviteeUserId,
        )
          .select({
            name:
              1,
          })
          .lean(),
      ])

    if (
      !household ||
      !inviter?._id
    ) {
      return null
    }

    const accepted =
      decision ===
      'accepted'

    const roleLabel =
      getHouseholdInvitationRoleLabel(
        invitation,
      )

    const explanation =
      accepted
        ? `${invitee?.name || invitation.invitedEmail} accepted your invitation to join ${household.name} as ${roleLabel}.`
        : `${invitee?.name || invitation.invitedEmail} rejected your invitation to join ${household.name} as ${roleLabel}.`

    await Promise.allSettled([
      createNotificationIntentBestEffort({
        userId:
          inviter._id,
        householdId:
          invitation.householdId,
        category:
          'household',
        triggerType:
          accepted
            ? 'household_invitation_accepted'
            : 'household_invitation_declined',
        reasonCode:
          accepted
            ? 'household_invitation_accepted'
            : 'household_invitation_declined',
        explanation,
        relatedEntityType:
          'household_invitation',
        relatedEntityId:
          String(
            invitation._id,
          ),
        sourceDomain:
          'households',
        sourceVersion:
          'multi-household-invitations-v1',
        actions: [
          'dismiss',
        ],
        requestedChannels: [
          'in_app',
        ],
        dedupeKey: `household-invitation-${decision}:${String(invitation._id)}:${String(inviter._id)}`,
        correlationId:
          String(
            invitation._id,
          ),
      }),
      sendBrevoHouseholdInvitationDecisionEmail({
        inviter,
        invitee,
        household,
        invitation,
        decision,
      }),
    ])

    return {
      notified:
        true,
    }
  } catch {
    return null
  }
}
