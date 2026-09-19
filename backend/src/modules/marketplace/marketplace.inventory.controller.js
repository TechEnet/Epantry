import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  hostOfferIdParamsSchema,
} from './marketplace.host.validation.js'

import {
  bulkInventorySnapshotSchema,
  createInventoryNodeSchema,
  currentInventoryQuerySchema,
  inventoryNodeIdParamsSchema,
  listInventoryHistoryQuerySchema,
  listInventoryNodesQuerySchema,
  updateInventoryNodeSchema,
} from './marketplace.inventory.validation.js'

import {
  createBulkInventorySnapshots,
  createInventoryNode,
  getHostCurrentInventory,
  getInventoryNode,
  listHostInventoryHistory,
  listInventoryNodes,
  updateInventoryNode,
} from './marketplace.inventory.service.js'

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

function wrap(
  handler,
) {
  return async function wrappedController(
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
| Inventory Nodes
|--------------------------------------------------------------------------
*/

export const listInventoryNodesController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listInventoryNodesQuerySchema,
          req.query,
          'MARKETPLACE_INVENTORY_NODE_QUERY_INVALID',
          'Invalid Inventory Node query.',
        )

      const result =
        await listInventoryNodes(
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Inventory Nodes loaded',
      )
    },
  )

export const getInventoryNodeController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          inventoryNodeIdParamsSchema,
          req.params,
          'MARKETPLACE_INVENTORY_NODE_ID_INVALID',
          'Invalid Inventory Node ID.',
        )

      const result =
        await getInventoryNode(
          id,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Inventory Node loaded',
      )
    },
  )

export const createInventoryNodeController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createInventoryNodeSchema,
          req.body,
          'MARKETPLACE_INVENTORY_NODE_INPUT_INVALID',
          'Invalid Inventory Node input.',
        )

      const result =
        await createInventoryNode(
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        201,
        result,
        'Inventory Node created',
      )
    },
  )

export const updateInventoryNodeController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          inventoryNodeIdParamsSchema,
          req.params,
          'MARKETPLACE_INVENTORY_NODE_ID_INVALID',
          'Invalid Inventory Node ID.',
        )

      const input =
        parseOrThrow(
          updateInventoryNodeSchema,
          req.body,
          'MARKETPLACE_INVENTORY_NODE_INPUT_INVALID',
          'Invalid Inventory Node input.',
        )

      const result =
        await updateInventoryNode(
          id,
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Inventory Node updated',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Bulk Inventory
|--------------------------------------------------------------------------
*/

export const createBulkInventorySnapshotsController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          bulkInventorySnapshotSchema,
          req.body,
          'MARKETPLACE_INVENTORY_BULK_INPUT_INVALID',
          'Invalid bulk Inventory input.',
        )

      const result =
        await createBulkInventorySnapshots(
          input,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        201,
        result,
        'Inventory Snapshots recorded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Offer Inventory
|--------------------------------------------------------------------------
*/

export const listHostInventoryHistoryController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          hostOfferIdParamsSchema,
          req.params,
          'MARKETPLACE_OFFER_ID_INVALID',
          'Invalid Host Offer ID.',
        )

      const query =
        parseOrThrow(
          listInventoryHistoryQuerySchema,
          req.query,
          'MARKETPLACE_INVENTORY_QUERY_INVALID',
          'Invalid Inventory history query.',
        )

      const result =
        await listHostInventoryHistory(
          id,
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Inventory history loaded',
      )
    },
  )

export const getHostCurrentInventoryController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          hostOfferIdParamsSchema,
          req.params,
          'MARKETPLACE_OFFER_ID_INVALID',
          'Invalid Host Offer ID.',
        )

      const query =
        parseOrThrow(
          currentInventoryQuerySchema,
          req.query,
          'MARKETPLACE_INVENTORY_QUERY_INVALID',
          'Invalid current Inventory query.',
        )

      const result =
        await getHostCurrentInventory(
          id,
          query,
          req.currentUser,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Current Inventory resolved',
      )
    },
  )