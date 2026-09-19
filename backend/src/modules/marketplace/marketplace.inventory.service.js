import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HostOffer,
  InventoryNode,
  InventorySnapshot,
} from './marketplace.models.js'

import {
  normalizeMarketplaceKey,
  normalizePostalCode,
} from './marketplace.constants.js'

import {
  buildOwnedHostOfferFilter,
  ensureHostMarketplaceOrganization,
  requireActiveHostMarketplaceOrganization,
  validateOfferCanonicalPack,
} from './marketplace.host.service.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function stringifyId(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return null
  }

  return String(
    value,
  )
}

function actorIdFromUser(
  user,
) {
  return (
    user?._id ||
    user?.id ||
    null
  )
}

function escapeRegex(
  value,
) {
  return String(
    value ||
      '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function duplicateKeyError(
  error,
) {
  return (
    error?.code ===
    11000
  )
}

/*
|--------------------------------------------------------------------------
| Tenant-scoped Filters
|--------------------------------------------------------------------------
*/

export function buildOwnedInventoryNodeFilter({
  inventoryNodeId,
  organizationId,
}) {
  return {
    _id:
      inventoryNodeId,

    organizationId,
  }
}

export function buildOwnedInventorySnapshotFilter({
  organizationId,
  offerId,
  inventoryNodeId,
}) {
  const filter = {
    organizationId,

    offerId,
  }

  if (
    inventoryNodeId
  ) {
    filter.inventoryNodeId =
      inventoryNodeId
  }

  return filter
}

/*
|--------------------------------------------------------------------------
| Freshness
|--------------------------------------------------------------------------
|
| No global freshness threshold is guessed here.
|
| Caller may provide maxAgeSeconds.
|--------------------------------------------------------------------------
*/

export function resolveInventoryFreshness(
  snapshot,
  {
    at = new Date(),
    maxAgeSeconds,
  } = {},
) {
  if (
    !snapshot?.observedAt
  ) {
    return {
      observedAt:
        null,

      ageSeconds:
        null,

      maxAgeSeconds:
        maxAgeSeconds ??
        null,

      isFresh:
        null,
    }
  }

  const observedAt =
    new Date(
      snapshot.observedAt,
    )

  const referenceAt =
    new Date(
      at,
    )

  const ageSeconds =
    Math.max(
      0,
      Math.floor(
        (
          referenceAt.getTime() -
          observedAt.getTime()
        ) /
          1000,
      ),
    )

  return {
    observedAt,

    ageSeconds,

    maxAgeSeconds:
      maxAgeSeconds ??
      null,

    isFresh:
      maxAgeSeconds ===
        undefined ||
      maxAgeSeconds ===
        null
        ? null
        : ageSeconds <=
          maxAgeSeconds,
  }
}

/*
|--------------------------------------------------------------------------
| Inventory Math
|--------------------------------------------------------------------------
*/

export function getSellableQuantity(
  snapshot,
) {
  const available =
    Number(
      snapshot?.availableQuantity ||
        0,
    )

  const reserved =
    Number(
      snapshot?.reservedQuantity ||
        0,
    )

  return Math.max(
    0,
    available -
      reserved,
  )
}

export function summarizeCurrentInventory(
  snapshots,
  {
    at = new Date(),
    maxAgeSeconds,
  } = {},
) {
  const items =
    (
      snapshots ||
      []
    ).map(
      (
        snapshot,
      ) => {
        const freshness =
          resolveInventoryFreshness(
            snapshot,
            {
              at,
              maxAgeSeconds,
            },
          )

        return {
          ...snapshot,

          sellableQuantity:
            getSellableQuantity(
              snapshot,
            ),

          freshness,
        }
      },
    )

  const totals =
    items.reduce(
      (
        accumulator,
        item,
      ) => {
        accumulator.availableQuantity +=
          Number(
            item.availableQuantity ||
              0,
          )

        accumulator.reservedQuantity +=
          Number(
            item.reservedQuantity ||
              0,
          )

        accumulator.sellableQuantity +=
          Number(
            item.sellableQuantity ||
              0,
          )

        return accumulator
      },
      {
        availableQuantity:
          0,

        reservedQuantity:
          0,

        sellableQuantity:
          0,
      },
    )

  const freshnessValues =
    items
      .map(
        (
          item,
        ) =>
          item.freshness
            ?.isFresh,
      )
      .filter(
        (
          value,
        ) =>
          value !==
          null &&
          value !==
          undefined,
      )

  return {
    items,

    totals,

    availability:
      totals.sellableQuantity >
      0
        ? 'in_stock'
        : 'out_of_stock',

    allFresh:
      maxAgeSeconds ===
        undefined ||
      maxAgeSeconds ===
        null
        ? null
        : freshnessValues.length ===
            items.length &&
          freshnessValues.every(
            Boolean,
          ),
  }
}

/*
|--------------------------------------------------------------------------
| Serializers
|--------------------------------------------------------------------------
*/

export function serializeInventoryNode(
  node,
) {
  if (!node) {
    return null
  }

  const value =
    typeof node.toObject ===
    'function'
      ? node.toObject()
      : node

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    organizationId:
      stringifyId(
        value.organizationId,
      ),

    name:
      value.name,

    nodeKey:
      value.nodeKey,

    nodeType:
      value.nodeType,

    status:
      value.status,

    address: {
      line1:
        value.address
          ?.line1 ||
        '',

      line2:
        value.address
          ?.line2 ||
        '',

      city:
        value.address
          ?.city ||
        '',

      state:
        value.address
          ?.state ||
        '',

      postalCode:
        value.address
          ?.postalCode ||
        '',

      countryCode:
        value.address
          ?.countryCode ||
        'IN',
    },

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

export function serializeInventorySnapshot(
  snapshot,
  {
    at = new Date(),
    maxAgeSeconds,
  } = {},
) {
  if (!snapshot) {
    return null
  }

  const value =
    typeof snapshot.toObject ===
    'function'
      ? snapshot.toObject()
      : snapshot

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    organizationId:
      stringifyId(
        value.organizationId,
      ),

    offerId:
      stringifyId(
        value.offerId,
      ),

    inventoryNodeId:
      stringifyId(
        value.inventoryNodeId,
      ),

    availableQuantity:
      value.availableQuantity,

    reservedQuantity:
      value.reservedQuantity,

    sellableQuantity:
      getSellableQuantity(
        value,
      ),

    sourceType:
      value.sourceType,

    sourceReference:
      value.sourceReference ||
      '',

    observedAt:
      value.observedAt,

    recordedAt:
      value.createdAt ||
      null,

    createdByUserId:
      stringifyId(
        value.createdByUserId,
      ),

    freshness:
      resolveInventoryFreshness(
        value,
        {
          at,
          maxAgeSeconds,
        },
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Inventory Nodes
|--------------------------------------------------------------------------
*/

export async function createInventoryNode(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const organization =
    await ensureHostMarketplaceOrganization(
      actorUser,
    )

  try {
    const node =
      await InventoryNode.create({
        organizationId:
          organization._id,

        name:
          input.name,

        nodeKey:
          input.nodeKey
            ? normalizeMarketplaceKey(
                input.nodeKey,
              )
            : normalizeMarketplaceKey(
                input.name,
              ),

        nodeType:
          input.nodeType,

        status:
          'active',

        address: {
          ...input.address,

          postalCode:
            normalizePostalCode(
              input.address
                ?.postalCode ||
                '',
            ),
        },

        createdByUserId:
          actorUserId,

        updatedByUserId:
          actorUserId,
      })

    return {
      inventoryNode:
        serializeInventoryNode(
          node,
        ),
    }
  } catch (error) {
    if (
      duplicateKeyError(
        error,
      )
    ) {
      throw new ApiError(
        409,
        'Inventory Node key already exists inside this Host organization.',
        [
          {
            code:
              'MARKETPLACE_INVENTORY_NODE_DUPLICATE',
          },
        ],
      )
    }

    throw error
  }
}

export async function listInventoryNodes(
  {
    page,
    limit,
    status,
    search,
  },
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const filter = {
    organizationId:
      organization._id,
  }

  if (
    status !==
    'all'
  ) {
    filter.status =
      status
  }

  if (
    search
  ) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        'i',
      )

    filter.$or = [
      {
        name:
          expression,
      },

      {
        nodeKey:
          expression,
      },

      {
        'address.city':
          expression,
      },

      {
        'address.postalCode':
          expression,
      },
    ]
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    nodes,
    total,
  ] =
    await Promise.all([
      InventoryNode.find(
        filter,
      )
        .sort({
          updatedAt:
            -1,

          _id:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      InventoryNode.countDocuments(
        filter,
      ),
    ])

  return {
    inventoryNodes:
      nodes.map(
        serializeInventoryNode,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  }
}

export async function getInventoryNode(
  inventoryNodeId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const node =
    await InventoryNode.findOne(
      buildOwnedInventoryNodeFilter({
        inventoryNodeId,

        organizationId:
          organization._id,
      }),
    ).lean()

  if (!node) {
    throw new ApiError(
      404,
      'Inventory Node was not found.',
      [
        {
          code:
            'MARKETPLACE_INVENTORY_NODE_NOT_FOUND',
        },
      ],
    )
  }

  return {
    inventoryNode:
      serializeInventoryNode(
        node,
      ),
  }
}

export async function updateInventoryNode(
  inventoryNodeId,
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const node =
    await InventoryNode.findOne(
      buildOwnedInventoryNodeFilter({
        inventoryNodeId,

        organizationId:
          organization._id,
      }),
    )

  if (!node) {
    throw new ApiError(
      404,
      'Inventory Node was not found.',
      [
        {
          code:
            'MARKETPLACE_INVENTORY_NODE_NOT_FOUND',
        },
      ],
    )
  }

  if (
    input.name !==
    undefined
  ) {
    node.name =
      input.name
  }

  if (
    input.nodeType !==
    undefined
  ) {
    node.nodeType =
      input.nodeType
  }

  if (
    input.status !==
    undefined
  ) {
    node.status =
      input.status
  }

  if (
    input.address !==
    undefined
  ) {
    node.address = {
      ...input.address,

      postalCode:
        normalizePostalCode(
          input.address
            ?.postalCode ||
            '',
        ),
    }
  }

  node.updatedByUserId =
    actorUserId

  await node.save()

  return {
    inventoryNode:
      serializeInventoryNode(
        node,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Owned Offer Helper
|--------------------------------------------------------------------------
*/

async function requireOwnedInventoryOffer(
  offerId,
  actorUser,
  {
    allowRetired =
      false,
  } = {},
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const offer =
    await HostOffer.findOne(
      buildOwnedHostOfferFilter({
        offerId,

        organizationId:
          organization._id,
      }),
    )

  if (!offer) {
    throw new ApiError(
      404,
      'Host Offer was not found.',
      [
        {
          code:
            'MARKETPLACE_OFFER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    !allowRetired &&
    offer.status ===
      'retired'
  ) {
    throw new ApiError(
      409,
      'A retired Host Offer cannot receive Inventory Snapshots.',
      [
        {
          code:
            'MARKETPLACE_OFFER_RETIRED',
        },
      ],
    )
  }

  return {
    organization,

    offer,
  }
}

/*
|--------------------------------------------------------------------------
| Bulk Inventory Snapshot
|--------------------------------------------------------------------------
|
| Snapshot records are append-only.
|
| No update/delete path exists.
|--------------------------------------------------------------------------
*/

export async function createBulkInventorySnapshots(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const offerIds = [
    ...new Set(
      input.items.map(
        (
          item,
        ) =>
          item.offerId,
      ),
    ),
  ]

  const nodeIds = [
    ...new Set(
      input.items.map(
        (
          item,
        ) =>
          item.inventoryNodeId,
      ),
    ),
  ]

  const [
    offers,
    nodes,
  ] =
    await Promise.all([
      HostOffer.find({
        _id: {
          $in:
            offerIds,
        },

        organizationId:
          organization._id,
      }).lean(),

      InventoryNode.find({
        _id: {
          $in:
            nodeIds,
        },

        organizationId:
          organization._id,
      }).lean(),
    ])

  if (
    offers.length !==
    offerIds.length
  ) {
    throw new ApiError(
      404,
      'One or more Host Offers were not found.',
      [
        {
          code:
            'MARKETPLACE_INVENTORY_OFFER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    nodes.length !==
    nodeIds.length
  ) {
    throw new ApiError(
      404,
      'One or more Inventory Nodes were not found.',
      [
        {
          code:
            'MARKETPLACE_INVENTORY_NODE_NOT_FOUND',
        },
      ],
    )
  }

  const offersById =
    new Map(
      offers.map(
        (
          offer,
        ) => [
          String(
            offer._id,
          ),
          offer,
        ],
      ),
    )

  const nodesById =
    new Map(
      nodes.map(
        (
          node,
        ) => [
          String(
            node._id,
          ),
          node,
        ],
      ),
    )

  for (
    const item of
    input.items
  ) {
    const offer =
      offersById.get(
        String(
          item.offerId,
        ),
      )

    const node =
      nodesById.get(
        String(
          item.inventoryNodeId,
        ),
      )

    if (
      offer.status ===
      'retired'
    ) {
      throw new ApiError(
        409,
        'Retired Host Offer cannot receive Inventory Snapshots.',
        [
          {
            code:
              'MARKETPLACE_INVENTORY_OFFER_RETIRED',

            offerId:
              String(
                offer._id,
              ),
          },
        ],
      )
    }

    if (
      node.status !==
      'active'
    ) {
      throw new ApiError(
        409,
        'Disabled Inventory Node cannot receive Inventory Snapshots.',
        [
          {
            code:
              'MARKETPLACE_INVENTORY_NODE_DISABLED',

            inventoryNodeId:
              String(
                node._id,
              ),
          },
        ],
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Canonical eligibility
  |--------------------------------------------------------------------------
  |
  | Validate each unique canonical Pack once.
  |--------------------------------------------------------------------------
  */

  const packIds = [
    ...new Set(
      offers.map(
        (
          offer,
        ) =>
          String(
            offer.packId,
          ),
      ),
    ),
  ]

  await Promise.all(
    packIds.map(
      (
        packId,
      ) =>
        validateOfferCanonicalPack(
          packId,
        ),
    ),
  )

  const now =
    new Date()

  const documents =
    input.items.map(
      (
        item,
      ) => ({
        organizationId:
          organization._id,

        offerId:
          item.offerId,

        inventoryNodeId:
          item.inventoryNodeId,

        availableQuantity:
          item.availableQuantity,

        reservedQuantity:
          item.reservedQuantity,

        sourceType:
          item.sourceType,

        sourceReference:
          item.sourceReference,

        observedAt:
          item.observedAt
            ? new Date(
                item.observedAt,
              )
            : now,

        createdByUserId:
          actorUserId,
      }),
    )

  const created =
    await InventorySnapshot.insertMany(
      documents,
      {
        ordered:
          true,
      },
    )

  return {
    accepted:
      created.length,

    inventorySnapshots:
      created.map(
        (
          snapshot,
        ) =>
          serializeInventorySnapshot(
            snapshot,
          ),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Inventory History
|--------------------------------------------------------------------------
*/

export async function listHostInventoryHistory(
  offerId,
  {
    page,
    limit,
    inventoryNodeId,
  },
  actorUser,
) {
  const {
    organization,
    offer,
  } =
    await requireOwnedInventoryOffer(
      offerId,
      actorUser,
      {
        allowRetired:
          true,
      },
    )

  if (
    inventoryNodeId
  ) {
    const ownedNode =
      await InventoryNode.findOne(
        buildOwnedInventoryNodeFilter({
          inventoryNodeId,

          organizationId:
            organization._id,
        }),
      )
        .select({
          _id:
            1,
        })
        .lean()

    if (
      !ownedNode
    ) {
      throw new ApiError(
        404,
        'Inventory Node was not found.',
        [
          {
            code:
              'MARKETPLACE_INVENTORY_NODE_NOT_FOUND',
          },
        ],
      )
    }
  }

  const filter =
    buildOwnedInventorySnapshotFilter({
      organizationId:
        organization._id,

      offerId:
        offer._id,

      inventoryNodeId,
    })

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    snapshots,
    total,
  ] =
    await Promise.all([
      InventorySnapshot.find(
        filter,
      )
        .sort({
          observedAt:
            -1,

          _id:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      InventorySnapshot.countDocuments(
        filter,
      ),
    ])

  return {
    inventorySnapshots:
      snapshots.map(
        (
          snapshot,
        ) =>
          serializeInventorySnapshot(
            snapshot,
          ),
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  }
}

/*
|--------------------------------------------------------------------------
| Current Inventory
|--------------------------------------------------------------------------
|
| Current = newest Snapshot for each ACTIVE Inventory Node.
|--------------------------------------------------------------------------
*/

export async function getHostCurrentInventory(
  offerId,
  {
    maxAgeSeconds,
  },
  actorUser,
) {
  const {
    organization,
    offer,
  } =
    await requireOwnedInventoryOffer(
      offerId,
      actorUser,
      {
        allowRetired:
          true,
      },
    )

  const activeNodes =
    await InventoryNode.find({
      organizationId:
        organization._id,

      status:
        'active',
    })
      .select({
        _id:
          1,

        name:
          1,

        nodeKey:
          1,

        nodeType:
          1,
      })
      .lean()

  if (
    activeNodes.length ===
    0
  ) {
    return {
      offerId:
        String(
          offer._id,
        ),

      availability:
        'out_of_stock',

      totals: {
        availableQuantity:
          0,

        reservedQuantity:
          0,

        sellableQuantity:
          0,
      },

      allFresh:
        maxAgeSeconds ===
          undefined
          ? null
          : false,

      inventory:
        [],
    }
  }

  const activeNodeIds =
    activeNodes.map(
      (
        node,
      ) =>
        node._id,
    )

  const snapshots =
    await InventorySnapshot.aggregate([
      {
        $match: {
          organizationId:
            organization._id,

          offerId:
            offer._id,

          inventoryNodeId: {
            $in:
              activeNodeIds,
          },
        },
      },

      {
        $sort: {
          observedAt:
            -1,

          _id:
            -1,
        },
      },

      {
        $group: {
          _id:
            '$inventoryNodeId',

          snapshot: {
            $first:
              '$$ROOT',
          },
        },
      },

      {
        $replaceRoot: {
          newRoot:
            '$snapshot',
        },
      },

      {
        $sort: {
          observedAt:
            -1,
        },
      },
    ])

  const at =
    new Date()

  const serialized =
    snapshots.map(
      (
        snapshot,
      ) =>
        serializeInventorySnapshot(
          snapshot,
          {
            at,
            maxAgeSeconds,
          },
        ),
    )

  const summary =
    summarizeCurrentInventory(
      serialized,
      {
        at,
        maxAgeSeconds,
      },
    )

  const nodesById =
    new Map(
      activeNodes.map(
        (
          node,
        ) => [
          String(
            node._id,
          ),

          node,
        ],
      ),
    )

  return {
    offerId:
      String(
        offer._id,
      ),

    availability:
      summary.availability,

    totals:
      summary.totals,

    allFresh:
      summary.allFresh,

    inventory:
      summary.items.map(
        (
          item,
        ) => {
          const node =
            nodesById.get(
              String(
                item.inventoryNodeId,
              ),
            )

          return {
            ...item,

            inventoryNode:
              node
                ? {
                    id:
                      String(
                        node._id,
                      ),

                    name:
                      node.name,

                    nodeKey:
                      node.nodeKey,

                    nodeType:
                      node.nodeType,
                  }
                : null,
          }
        },
      ),
  }
}