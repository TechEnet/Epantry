import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HOUSEHOLD_INVITATION_ROLES,
} from './householdInvitation.model.js'

/*
|--------------------------------------------------------------------------
| Invitation Policy Constants
|--------------------------------------------------------------------------
*/

export const HOUSEHOLD_INVITATION_TTL_HOURS =
  72

export const HOUSEHOLD_INVITATION_MAX_RESENDS =
  10

/*
|--------------------------------------------------------------------------
| Shared Validation
|--------------------------------------------------------------------------
*/

const emailSchema =
  z.string()
    .trim()
    .email(
      'Enter a valid email address.',
    )
    .max(
      254,
      'Email address is too long.',
    )
    .transform(
      (value) =>
        value.toLowerCase(),
    )

const roleSchema =
  z.enum(
    HOUSEHOLD_INVITATION_ROLES,
  )

const roleLabelSchema =
  z.string()
    .trim()
    .min(
      2,
      'Household role label must be at least 2 characters.',
    )
    .max(
      40,
      'Household role label must be 40 characters or fewer.',
    )

const tokenSchema =
  z.string()
    .trim()
    .min(
      32,
      'Household invitation token is invalid.',
    )
    .max(
      512,
      'Household invitation token is invalid.',
    )

const invitationIdSchema =
  z.string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'Household invitation id is invalid.',
    )

/*
|--------------------------------------------------------------------------
| Request Schemas
|--------------------------------------------------------------------------
*/

const createHouseholdInvitationSchema =
  z.object({
    email:
      emailSchema,

    role:
      roleSchema
        .default(
          'member',
        ),

    roleLabel:
      roleLabelSchema
        .optional(),
  })
    .strict()
    .superRefine(
      (value, context) => {
        if (
          value.role ===
            'member' &&
          ['owner', 'admin'].includes(
            String(
              value.roleLabel ||
                '',
            )
              .trim()
              .toLowerCase(),
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ['roleLabel'],

            message:
              'Owner and Admin are reserved household authority roles.',
          })
        }
      },
    )

/*
|--------------------------------------------------------------------------
| Parse Helpers
|--------------------------------------------------------------------------
*/

function throwValidationError(
  parsed,
  fallbackMessage,
) {
  throw new ApiError(
    400,
    parsed.error
      .issues[0]
      ?.message ||
      fallbackMessage,
    [
      {
        code:
          'HOUSEHOLD_INVITATION_VALIDATION_FAILED',
      },
    ],
  )
}

export function parseCreateHouseholdInvitationInput(
  payload,
) {
  const parsed =
    createHouseholdInvitationSchema.safeParse(
      payload || {},
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Invalid household invitation details.',
    )
  }

  return parsed.data
}

export function parseHouseholdInvitationToken(
  token,
) {
  const parsed =
    tokenSchema.safeParse(
      token,
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Household invitation token is invalid.',
    )
  }

  return parsed.data
}

export function parseHouseholdInvitationId(
  invitationId,
) {
  const parsed =
    invitationIdSchema.safeParse(
      invitationId,
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Household invitation id is invalid.',
    )
  }

  return parsed.data
}

export function normalizeHouseholdInvitationEmail(
  email,
) {
  const parsed =
    emailSchema.safeParse(
      email,
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Email address is invalid.',
    )
  }

  return parsed.data
}
