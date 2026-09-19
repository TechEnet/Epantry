import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  ADMIN_AUDIT_OUTCOMES,
} from './adminAudit.model.js'

import {
  getAdminAuditEvent,
  listAdminAuditEvents,
} from './adminAudit.service.js'

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const objectIdPattern =
  /^[a-f\d]{24}$/i

const auditEventIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const auditActionPattern =
  /^[a-z][a-z0-9_.:-]*$/

const listAuditQuerySchema =
  z.object({
    page:
      z.coerce
        .number()
        .int()
        .min(
          1,
        )
        .optional()
        .default(
          1,
        ),

    limit:
      z.coerce
        .number()
        .int()
        .min(
          1,
        )
        .max(
          100,
        )
        .optional()
        .default(
          50,
        ),

    actorUserId:
      z.string()
        .trim()
        .regex(
          objectIdPattern,
          'A valid actor user ID is required.',
        )
        .optional(),

    action:
      z.string()
        .trim()
        .toLowerCase()
        .max(
          120,
        )
        .regex(
          auditActionPattern,
          'Invalid audit action.',
        )
        .optional(),

    permissionKey:
      z.string()
        .trim()
        .toLowerCase()
        .max(
          120,
        )
        .optional(),

    entityType:
      z.string()
        .trim()
        .toLowerCase()
        .min(
          1,
        )
        .max(
          100,
        )
        .optional(),

    entityId:
      z.string()
        .trim()
        .min(
          1,
        )
        .max(
          160,
        )
        .optional(),

    outcome:
      z.enum(
        ADMIN_AUDIT_OUTCOMES,
      )
        .optional(),

    requestId:
      z.string()
        .trim()
        .min(
          1,
        )
        .max(
          120,
        )
        .optional(),

    from:
      z.string()
        .datetime({
          offset:
            true,
        })
        .optional(),

    to:
      z.string()
        .datetime({
          offset:
            true,
        })
        .optional(),
  })
  .strict()

const auditEventParamsSchema =
  z.object({
    eventId:
      z.string()
        .trim()
        .toLowerCase()
        .regex(
          auditEventIdPattern,
          'A valid audit event ID is required.',
        ),
  })
  .strict()

/*
|--------------------------------------------------------------------------
| Parse Helper
|--------------------------------------------------------------------------
*/

function parseOrThrow(
  schema,
  value,
  {
    code,
    message,
  },
) {
  const result =
    schema.safeParse(
      value,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      result.error
        .issues[0]
        ?.message ||
        message,
      [
        {
          code,
        },
      ],
    )
  }

  return result.data
}

/*
|--------------------------------------------------------------------------
| List Audit Events
|--------------------------------------------------------------------------
*/

export async function listAdminAuditEventsController(
  req,
  res,
  next,
) {
  try {
    const query =
      parseOrThrow(
        listAuditQuerySchema,
        req.query,
        {
          code:
            'ADMIN_AUDIT_QUERY_INVALID',

          message:
            'Invalid administrative audit query.',
        },
      )

    const result =
      await listAdminAuditEvents(
        query,
      )

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

          'Administrative audit events loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Audit Event Detail
|--------------------------------------------------------------------------
*/

export async function getAdminAuditEventController(
  req,
  res,
  next,
) {
  try {
    const {
      eventId,
    } =
      parseOrThrow(
        auditEventParamsSchema,
        req.params,
        {
          code:
            'ADMIN_AUDIT_EVENT_ID_INVALID',

          message:
            'A valid administrative audit event ID is required.',
        },
      )

    const event =
      await getAdminAuditEvent(
        eventId,
      )

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            event,

            requestId:
              req.requestId,
          },

          'Administrative audit event loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}