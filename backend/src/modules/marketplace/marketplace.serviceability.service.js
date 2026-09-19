import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HostOffer,
  InventoryNode,
  ServiceArea,
} from './marketplace.models.js'

import {
  normalizeMarketplaceKey,
  normalizePostalCode,
} from './marketplace.constants.js'

import {
  buildOwnedHostOfferFilter,
  requireActiveHostMarketplaceOrganization,
  validateOfferCanonicalPack,
} from './marketplace.host.service.js'

import {
  buildOwnedInventoryNodeFilter,
} from './marketplace.inventory.service.js'

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
| Tenant Filters
|--------------------------------------------------------------------------
*/

export function buildOwnedServiceAreaFilter({
  serviceAreaId,
  organizationId,
}) {
  return {
    _id:
      serviceAreaId,

    organizationId,
  }
}

/*
|--------------------------------------------------------------------------
| Exact Postal Code Filter
|--------------------------------------------------------------------------
|
| There is no radius / nearby / inferred serviceability in M05.
|
| Pincode must exist explicitly inside ServiceArea.postalCodes.
|--------------------------------------------------------------------------
*/

export function buildServiceAreaPostalCodeFilter({
  organizationId,
  postalCode,
}) {
  return {
    organizationId,

    status:
      'active',

    postalCodes:
      normalizePostalCode(
        postalCode,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Fulfillment Intersection
|--------------------------------------------------------------------------
*/

export function resolveFulfillmentIntersection({
  offerFulfillmentTypes,
  serviceAreaFulfillmentTypes,
  requestedFulfillmentType,
}) {
  const offerTypes =
    new Set(
      offerFulfillmentTypes ||
        [],
    )

  let eligible =
    [
      ...new Set(
        serviceAreaFulfillmentTypes ||
          [],
      ),
    ].filter(
      (
        type,
      ) =>
        offerTypes.has(
          type,
        ),
    )

  if (
    requestedFulfillmentType
  ) {
    eligible =
      eligible.filter(
        (
          type,
        ) =>
          type ===
          requestedFulfillmentType,
      )
  }

  return eligible
}

/*
|--------------------------------------------------------------------------
| Inventory Node Resolution
|--------------------------------------------------------------------------
|
| Node-specific Service Area:
|   only its active Inventory Node may fulfill.
|
| Organization-wide Service Area:
|   all active Inventory Nodes may fulfill.
|
| Serviceability requires at least one active Inventory Node.
|--------------------------------------------------------------------------
*/

export function resolveServiceAreaInventoryNodeIds({
  serviceArea,
  activeInventoryNodeIds,
}) {
  const activeIds =
    new Set(
      (
        activeInventoryNodeIds ||
        []
      ).map(
        String,
      ),
    )

  if (
    serviceArea?.inventoryNodeId
  ) {
    const nodeId =
      String(
        serviceArea.inventoryNodeId,
      )

    return activeIds.has(
      nodeId,
    )
      ? [
          nodeId,
        ]
      : []
  }

  return [
    ...activeIds,
  ]
}

/*
|--------------------------------------------------------------------------
| Serializer
|--------------------------------------------------------------------------
*/

export function serializeServiceArea(
  serviceArea,
) {
  if (
    !serviceArea
  ) {
    return null
  }

  const value =
    typeof serviceArea.toObject ===
    'function'
      ? serviceArea.toObject()
      : serviceArea

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

    inventoryNodeId:
      stringifyId(
        value.inventoryNodeId,
      ),

    name:
      value.name,

    serviceAreaKey:
      value.serviceAreaKey,

    postalCodes:
      value.postalCodes ||
      [],

    fulfillmentTypes:
      value.fulfillmentTypes ||
      [],

    status:
      value.status,

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Require Owned Active Inventory Node
|--------------------------------------------------------------------------
*/

async function requireOwnedActiveInventoryNode(
  inventoryNodeId,
  organizationId,
) {
  const node =
    await InventoryNode.findOne(
      buildOwnedInventoryNodeFilter({
        inventoryNodeId,

        organizationId,
      }),
    ).lean()

  if (
    !node
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

  if (
    node.status !==
    'active'
  ) {
    throw new ApiError(
      409,
      'Disabled Inventory Node cannot be assigned to an active Service Area.',
      [
        {
          code:
            'MARKETPLACE_SERVICE_AREA_NODE_DISABLED',
        },
      ],
    )
  }

  return node
}

/*
|--------------------------------------------------------------------------
| Create Service Area
|--------------------------------------------------------------------------
*/

export async function createServiceArea(
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

  if (
    input.inventoryNodeId
  ) {
    await requireOwnedActiveInventoryNode(
      input.inventoryNodeId,
      organization._id,
    )
  }

  try {
    const serviceArea =
      await ServiceArea.create({
        organizationId:
          organization._id,

        inventoryNodeId:
          input.inventoryNodeId,

        name:
          input.name,

        serviceAreaKey:
          input.serviceAreaKey
            ? normalizeMarketplaceKey(
                input.serviceAreaKey,
              )
            : normalizeMarketplaceKey(
                input.name,
              ),

        postalCodes:
          input.postalCodes.map(
            normalizePostalCode,
          ),

        fulfillmentTypes:
          input.fulfillmentTypes,

        status:
          'active',

        createdByUserId:
          actorUserId,

        updatedByUserId:
          actorUserId,
      })

    return {
      serviceArea:
        serializeServiceArea(
          serviceArea,
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
        'Service Area key already exists inside this Host organization.',
        [
          {
            code:
              'MARKETPLACE_SERVICE_AREA_DUPLICATE',
          },
        ],
      )
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| List Service Areas
|--------------------------------------------------------------------------
*/

export async function listServiceAreas(
  {
    page,
    limit,
    status,
    inventoryNodeId,
    pincode,
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
    inventoryNodeId
  ) {
    filter.inventoryNodeId =
      inventoryNodeId
  }

  if (
    pincode
  ) {
    filter.postalCodes =
      normalizePostalCode(
        pincode,
      )
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
        serviceAreaKey:
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
    serviceAreas,
    total,
  ] =
    await Promise.all([
      ServiceArea.find(
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

      ServiceArea.countDocuments(
        filter,
      ),
    ])

  return {
    serviceAreas:
      serviceAreas.map(
        serializeServiceArea,
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
| Get Service Area
|--------------------------------------------------------------------------
*/

export async function getServiceArea(
  serviceAreaId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const serviceArea =
    await ServiceArea.findOne(
      buildOwnedServiceAreaFilter({
        serviceAreaId,

        organizationId:
          organization._id,
      }),
    ).lean()

  if (
    !serviceArea
  ) {
    throw new ApiError(
      404,
      'Service Area was not found.',
      [
        {
          code:
            'MARKETPLACE_SERVICE_AREA_NOT_FOUND',
        },
      ],
    )
  }

  return {
    serviceArea:
      serializeServiceArea(
        serviceArea,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Update Service Area
|--------------------------------------------------------------------------
*/

export async function updateServiceArea(
  serviceAreaId,
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

  const serviceArea =
    await ServiceArea.findOne(
      buildOwnedServiceAreaFilter({
        serviceAreaId,

        organizationId:
          organization._id,
      }),
    )

  if (
    !serviceArea
  ) {
    throw new ApiError(
      404,
      'Service Area was not found.',
      [
        {
          code:
            'MARKETPLACE_SERVICE_AREA_NOT_FOUND',
        },
      ],
    )
  }

  if (
    input.inventoryNodeId !==
      undefined &&
    input.inventoryNodeId !==
      null
  ) {
    await requireOwnedActiveInventoryNode(
      input.inventoryNodeId,
      organization._id,
    )
  }

  if (
    input.name !==
    undefined
  ) {
    serviceArea.name =
      input.name
  }

  if (
    input.inventoryNodeId !==
    undefined
  ) {
    serviceArea.inventoryNodeId =
      input.inventoryNodeId
  }

  if (
    input.postalCodes !==
    undefined
  ) {
    serviceArea.postalCodes =
      input.postalCodes.map(
        normalizePostalCode,
      )
  }

  if (
    input.fulfillmentTypes !==
    undefined
  ) {
    serviceArea.fulfillmentTypes =
      input.fulfillmentTypes
  }

  if (
    input.status !==
    undefined
  ) {
    serviceArea.status =
      input.status
  }

  serviceArea.updatedByUserId =
    actorUserId

  await serviceArea.save()

  return {
    serviceArea:
      serializeServiceArea(
        serviceArea,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Host Offer Serviceability Resolver
|--------------------------------------------------------------------------
|
| This resolves geographic + fulfillment capability only.
|
| It deliberately DOES NOT claim:
|
| - product is in stock
| - price exists
| - delivery ETA
|
| Part 6 will compose those independent commercial signals.
|--------------------------------------------------------------------------
*/

export async function resolveHostOfferServiceability(
  offerId,
  {
    pincode,
    fulfillmentType,
  },
  actorUser,
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
    ).lean()

  if (
    !offer
  ) {
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
    offer.status ===
    'retired'
  ) {
    return {
      offerId:
        String(
          offer._id,
        ),

      pincode:
        normalizePostalCode(
          pincode,
        ),

      requestedFulfillmentType:
        fulfillmentType ||
        null,

      serviceable:
        false,

      reason:
        'offer_retired',

      fulfillmentTypes:
        [],

      inventoryNodeIds:
        [],

      serviceAreas:
        [],
    }
  }

  await validateOfferCanonicalPack(
    offer.packId,
  )

  const normalizedPincode =
    normalizePostalCode(
      pincode,
    )

  const serviceAreas =
    await ServiceArea.find(
      buildServiceAreaPostalCodeFilter({
        organizationId:
          organization._id,

        postalCode:
          normalizedPincode,
      }),
    ).lean()

  if (
    serviceAreas.length ===
    0
  ) {
    return {
      offerId:
        String(
          offer._id,
        ),

      pincode:
        normalizedPincode,

      requestedFulfillmentType:
        fulfillmentType ||
        null,

      serviceable:
        false,

      reason:
        'pincode_not_served',

      fulfillmentTypes:
        [],

      inventoryNodeIds:
        [],

      serviceAreas:
        [],
    }
  }

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

  const activeNodeIds =
    activeNodes.map(
      (
        node,
      ) =>
        String(
          node._id,
        ),
    )

  const eligibleAreas =
    []

  const eligibleNodeIds =
    new Set()

  const eligibleFulfillmentTypes =
    new Set()

  for (
    const serviceArea of
    serviceAreas
  ) {
    const fulfillmentTypes =
      resolveFulfillmentIntersection({
        offerFulfillmentTypes:
          offer.fulfillmentTypes,

        serviceAreaFulfillmentTypes:
          serviceArea.fulfillmentTypes,

        requestedFulfillmentType:
          fulfillmentType,
      })

    if (
      fulfillmentTypes.length ===
      0
    ) {
      continue
    }

    const inventoryNodeIds =
      resolveServiceAreaInventoryNodeIds({
        serviceArea,

        activeInventoryNodeIds:
          activeNodeIds,
      })

    if (
      inventoryNodeIds.length ===
      0
    ) {
      continue
    }

    for (
      const nodeId of
      inventoryNodeIds
    ) {
      eligibleNodeIds.add(
        nodeId,
      )
    }

    for (
      const type of
      fulfillmentTypes
    ) {
      eligibleFulfillmentTypes.add(
        type,
      )
    }

    eligibleAreas.push({
      serviceArea:
        serializeServiceArea(
          serviceArea,
        ),

      fulfillmentTypes,

      inventoryNodeIds,
    })
  }

  if (
    eligibleAreas.length ===
    0
  ) {
    return {
      offerId:
        String(
          offer._id,
        ),

      pincode:
        normalizedPincode,

      requestedFulfillmentType:
        fulfillmentType ||
        null,

      serviceable:
        false,

      reason:
        activeNodes.length ===
        0
          ? 'no_active_inventory_node'
          : 'fulfillment_not_supported',

      fulfillmentTypes:
        [],

      inventoryNodeIds:
        [],

      serviceAreas:
        [],
    }
  }

  const activeNodesById =
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

    pincode:
      normalizedPincode,

    requestedFulfillmentType:
      fulfillmentType ||
      null,

    serviceable:
      true,

    reason:
      'serviceable',

    fulfillmentTypes: [
      ...eligibleFulfillmentTypes,
    ],

    inventoryNodeIds: [
      ...eligibleNodeIds,
    ],

    inventoryNodes: [
      ...eligibleNodeIds,
    ]
      .map(
        (
          nodeId,
        ) => {
          const node =
            activeNodesById.get(
              nodeId,
            )

          if (
            !node
          ) {
            return null
          }

          return {
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
        },
      )
      .filter(
        Boolean,
      ),

    serviceAreas:
      eligibleAreas,
  }
}