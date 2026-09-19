import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  acceptHouseholdInvitationForUser,
  createHouseholdInvitation,
  declineHouseholdInvitationForUser,
  getHouseholdInvitationForUser,
  getHouseholdInvitationPublicPreview,
  listHouseholdInvitationsForActor,
  prepareHouseholdInvitationResend,
  revokeHouseholdInvitationForActor,
} from './householdInvitation.service.js'

import {
  deliverHouseholdInvitationEmailBestEffort,
  notifyHouseholdInvitationDecisionBestEffort,
  notifyHouseholdInviteeInAppBestEffort,
} from './householdInvitation.delivery.service.js'

/*
|--------------------------------------------------------------------------
| POST /households/:householdId/invitations
|--------------------------------------------------------------------------
*/

export async function createHouseholdInvitationController(
  req,
  res,
) {
  const result =
    await createHouseholdInvitation({
      actorUserId:
        req.currentUser._id,
      householdId:
        req.params.householdId,
      payload:
        req.body,
    })

  const delivery =
    await deliverHouseholdInvitationEmailBestEffort({
      invitationId:
        result.invitation.id,
      invitationToken:
        result.invitationToken,
    })

  await notifyHouseholdInviteeInAppBestEffort({
    invitationId:
      result.invitation.id,
  })

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {
          invitation:
            delivery.invitation ||
            result.invitation,

          delivery: {
            delivered:
              delivery.delivered,

            errorCode:
              delivery.delivered
                ? null
                : delivery.errorCode,
          },

          requestId:
            req.requestId,
        },
        delivery.delivered
          ? 'Household invitation created and email sent'
          : 'Household invitation created, but email delivery is pending retry',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| GET /households/:householdId/invitations
|--------------------------------------------------------------------------
*/

export async function listHouseholdInvitationsController(
  req,
  res,
) {
  const result =
    await listHouseholdInvitationsForActor({
      actorUserId:
        req.currentUser._id,
      householdId:
        req.params.householdId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...result,
          requestId:
            req.requestId,
        },
        'Household invitations loaded',
      ),
    )
}


/*
|--------------------------------------------------------------------------
| GET /households/invitations/:token/preview
|--------------------------------------------------------------------------
*/

export async function getHouseholdInvitationPreviewController(
  req,
  res,
) {
  const result =
    await getHouseholdInvitationPublicPreview({
      token:
        req.params.token,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...result,
          requestId:
            req.requestId,
        },
        'Household invitation preview loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| GET /households/invitations/:token
|--------------------------------------------------------------------------
*/

export async function getHouseholdInvitationController(
  req,
  res,
) {
  const result =
    await getHouseholdInvitationForUser({
      userId:
        req.currentUser._id,
      token:
        req.params.token,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...result,
          requestId:
            req.requestId,
        },
        'Household invitation loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| POST /households/invitations/:token/accept
|--------------------------------------------------------------------------
*/

export async function acceptHouseholdInvitationController(
  req,
  res,
) {
  const result =
    await acceptHouseholdInvitationForUser({
      userId:
        req.currentUser._id,
      token:
        req.params.token,
    })

  if (
    result?.invitation?.id &&
    result?.alreadyAccepted !==
      true
  ) {
    await notifyHouseholdInvitationDecisionBestEffort({
      invitationId:
        result.invitation.id,
      inviteeUserId:
        req.currentUser._id,
      decision:
        'accepted',
    })
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...result,
          requestId:
            req.requestId,
        },
        result.alreadyAccepted
          ? 'Household invitation was already accepted'
          : 'Household invitation accepted successfully',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| POST /households/invitations/:token/decline
|--------------------------------------------------------------------------
*/

export async function declineHouseholdInvitationController(
  req,
  res,
) {
  const result =
    await declineHouseholdInvitationForUser({
      userId:
        req.currentUser._id,
      token:
        req.params.token,
    })

  if (
    result?.invitation?.id
  ) {
    await notifyHouseholdInvitationDecisionBestEffort({
      invitationId:
        result.invitation.id,
      inviteeUserId:
        req.currentUser._id,
      decision:
        'declined',
    })
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...result,
          requestId:
            req.requestId,
        },
        'Household invitation declined',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| POST /households/:householdId/invitations/:invitationId/resend
|--------------------------------------------------------------------------
*/

export async function resendHouseholdInvitationController(
  req,
  res,
) {
  const prepared =
    await prepareHouseholdInvitationResend({
      actorUserId:
        req.currentUser._id,
      householdId:
        req.params.householdId,
      invitationId:
        req.params.invitationId,
    })

  const delivery =
    await deliverHouseholdInvitationEmailBestEffort({
      invitationId:
        prepared.invitation.id,
      invitationToken:
        prepared.invitationToken,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          invitation:
            delivery.invitation ||
            prepared.invitation,

          delivery: {
            delivered:
              delivery.delivered,

            errorCode:
              delivery.delivered
                ? null
                : delivery.errorCode,
          },

          requestId:
            req.requestId,
        },
        delivery.delivered
          ? 'Household invitation resent successfully'
          : 'Household invitation token rotated, but email delivery is pending retry',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| DELETE /households/:householdId/invitations/:invitationId
|--------------------------------------------------------------------------
*/

export async function revokeHouseholdInvitationController(
  req,
  res,
) {
  const result =
    await revokeHouseholdInvitationForActor({
      actorUserId:
        req.currentUser._id,
      householdId:
        req.params.householdId,
      invitationId:
        req.params.invitationId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...result,
          requestId:
            req.requestId,
        },
        'Household invitation revoked',
      ),
    )
}
