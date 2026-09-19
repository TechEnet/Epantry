import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  createNotificationIntentBestEffort,
} from '../notifications/notification.service.js'

import {
  customerPantryObservationSchema,
  pantryHistoryQuerySchema,
  pantryItemApiParamsSchema,
  pantryItemPatchSchema,
  pantryListQuerySchema,
  pantryPreferencesPatchSchema,
} from './pantry.api.validation.js'

import {
  createCustomerPantryObservation,
  getPantryItemHistory,
  getPantryPreferences,
  listPantryItems,
  requireCurrentPantryHousehold,
  serializePantryItem,
  serializePantryObservation,
  updatePantryItemFromCustomer,
  updatePantryPreferences,
} from './pantry.service.js'

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

function parseOrThrow(
  schema,
  value,
  code,
  message,
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
| Response
|--------------------------------------------------------------------------
*/

function sendSuccess(
  req,
  res,
  status,
  data,
  message,
) {
  return res
    .status(
      status,
    )
    .json(
      new ApiResponse(
        status,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    )
}

/*
|--------------------------------------------------------------------------
| Async Wrapper
|--------------------------------------------------------------------------
*/

function wrap(
  handler,
) {
  return async function wrappedPantryController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET /pantry
|--------------------------------------------------------------------------
*/

export const listPantryController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          pantryListQuerySchema,
          req.query,
          'PANTRY_QUERY_INVALID',
          'Invalid Pantry query.',
        )

      const result =
        await listPantryItems(
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Pantry loaded successfully.',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| POST /pantry/observations
|--------------------------------------------------------------------------
*/

export const createPantryObservationController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          customerPantryObservationSchema,
          req.body,
          'PANTRY_OBSERVATION_INVALID',
          'Invalid Pantry observation.',
        )

      const result =
        await createCustomerPantryObservation(
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        201,
        {
          item:
            serializePantryItem(
              result.item,
            ),

          observation:
            serializePantryObservation(
              result.observation,
            ),
        },
        'Pantry observation recorded successfully.',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| PATCH /pantry/items/:id
|--------------------------------------------------------------------------
*/

export const updatePantryItemController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          pantryItemApiParamsSchema,
          req.params,
          'PANTRY_ITEM_ID_INVALID',
          'Invalid Pantry item ID.',
        )

      const input =
        parseOrThrow(
          pantryItemPatchSchema,
          req.body,
          'PANTRY_ITEM_PATCH_INVALID',
          'Invalid Pantry item update.',
        )

      const result =
        await updatePantryItemFromCustomer(
          id,
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        {
          item:
            serializePantryItem(
              result.item,
            ),

          observation:
            serializePantryObservation(
              result.observation,
            ),
        },
        'Pantry item updated through a new observation.',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| GET /pantry/items/:id/history
|--------------------------------------------------------------------------
*/

export const getPantryItemHistoryController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          pantryItemApiParamsSchema,
          req.params,
          'PANTRY_ITEM_ID_INVALID',
          'Invalid Pantry item ID.',
        )

      const query =
        parseOrThrow(
          pantryHistoryQuerySchema,
          req.query,
          'PANTRY_HISTORY_QUERY_INVALID',
          'Invalid Pantry history query.',
        )

      const result =
        await getPantryItemHistory(
          id,
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Pantry item history loaded successfully.',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| POST /pantry/items/:id/setup-reminder
|--------------------------------------------------------------------------
|
| Creates one deduplicated in-app reminder when a Customer skips the
| immediate Pantry detail drawer after confirming an ingredient at home.
|
*/

export const createPantrySetupReminderController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          pantryItemApiParamsSchema,
          req.params,
          'PANTRY_ITEM_ID_INVALID',
          'Invalid Pantry item ID.',
        )

      const history =
        await getPantryItemHistory(
          id,
          {
            page: 1,
            limit: 1,
          },
          req.currentUser,
        )

      const {
        householdId,
      } =
        await requireCurrentPantryHousehold(
          req.currentUser,
        )

      const userId =
        req.currentUser?._id ||
        req.currentUser?.id

      const itemName =
        history?.item?.displayName ||
        'Pantry item'

      const reminder =
        await createNotificationIntentBestEffort({
          userId,
          householdId,
          category: 'pantry',
          triggerType: 'pantry_setup_reminder',
          reasonCode: 'pantry_details_incomplete',
          explanation: `${itemName} is in your Pantry. Add quantity, storage and an optional use-soon reminder to improve planning.`,
          relatedEntityType: 'pantry_item',
          relatedEntityId: id,
          sourceDomain: 'pantry',
          sourceVersion: 'customer-workflow-v1',
          actions: [
            'dismiss',
          ],
          requestedChannels: [
            'in_app',
          ],
          dedupeKey: `pantry-setup:${String(userId)}:${id}`,
          correlationId:
            req.requestId ||
            '',
        })

      return sendSuccess(
        req,
        res,
        200,
        {
          notification:
            reminder?.notification ||
            null,
          deduplicated:
            reminder?.deduplicated ===
            true,
        },
        'Pantry setup reminder saved.',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| GET /pantry/preferences
|--------------------------------------------------------------------------
*/

export const getPantryPreferencesController =
  wrap(
    async (
      req,
      res,
    ) => {
      const result =
        await getPantryPreferences(
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Pantry preferences loaded successfully.',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| PATCH /pantry/preferences
|--------------------------------------------------------------------------
*/

export const updatePantryPreferencesController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          pantryPreferencesPatchSchema,
          req.body,
          'PANTRY_PREFERENCES_INVALID',
          'Invalid Pantry preferences.',
        )

      const result =
        await updatePantryPreferences(
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Pantry preferences updated successfully.',
      )
    },
  )