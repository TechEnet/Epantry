import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  CanonicalIngredient,
  Pack,
} from '../catalog/catalog.models.js'

import {
  Household,
} from '../households/household.model.js'

import {
  HouseholdMembership,
} from '../households/householdMembership.model.js'

import {
  PantryHouseholdPreference,
  PantryItem,
  PantryObservation,
} from './pantry.models.js'

import {
  buildPantryIdentityKey,
  buildPantryObservationProjection,
  projectPantryItemAtTime,
  projectPantryItemFromObservation,
} from './pantry.state.js'

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
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return String(
    value,
  )
}

function asPlainObject(
  value,
) {
  if (!value) {
    return null
  }

  if (
    typeof value.toObject ===
    'function'
  ) {
    return value.toObject()
  }

  return {
    ...value,
  }
}

function actorIdFromUser(
  actorUser,
) {
  const actorUserId =
    actorUser?._id ||
    actorUser?.id

  if (!actorUserId) {
    throw new ApiError(
      401,
      'Authenticated user identity is required.',
      [
        {
          code:
            'PANTRY_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return actorUserId
}

function withSession(
  query,
  session,
) {
  if (
    session
  ) {
    query.session(
      session,
    )
  }

  return query
}

function referenceId(
  value,
) {
  if (!value) {
    return null
  }

  if (
    typeof value ===
      'object'
  ) {
    return stringifyId(
      value._id ||
      value.id ||
      null,
    )
  }

  return stringifyId(
    value,
  )
}

async function resolvePantryIdentityMetadata(
  items = [],
) {
  const rawItems =
    items
      .filter(
        Boolean,
      )
      .map(
        asPlainObject,
      )

  const ingredientIds =
    [
      ...new Set(
        rawItems
          .map((item) =>
            referenceId(
              item.canonicalIngredientId,
            ),
          )
          .filter(
            Boolean,
          ),
      ),
    ]

  const packIds =
    [
      ...new Set(
        rawItems
          .map((item) =>
            referenceId(
              item.canonicalPackId,
            ),
          )
          .filter(
            Boolean,
          ),
      ),
    ]

  const [
    ingredients,
    packs,
  ] =
    await Promise.all([
      ingredientIds.length
        ? CanonicalIngredient
            .find({
              _id: {
                $in:
                  ingredientIds,
              },
            })
            .select({
              _id:
                1,

              canonicalName:
                1,
            })
            .lean()
        : [],

      packIds.length
        ? Pack
            .find({
              _id: {
                $in:
                  packIds,
              },
            })
            .select({
              _id:
                1,

              displayName:
                1,
            })
            .lean()
        : [],
    ])

  const ingredientById =
    new Map(
      ingredients.map(
        (ingredient) => [
          stringifyId(
            ingredient._id,
          ),
          ingredient,
        ],
      ),
    )

  const packById =
    new Map(
      packs.map(
        (pack) => [
          stringifyId(
            pack._id,
          ),
          pack,
        ],
      ),
    )

  const metadataByItemId =
    new Map()

  for (
    const item
    of rawItems
  ) {
    const itemId =
      referenceId(
        item._id ||
        item.id,
      )

    if (!itemId) {
      continue
    }

    const ingredientId =
      referenceId(
        item.canonicalIngredientId,
      )

    const packId =
      referenceId(
        item.canonicalPackId,
      )

    const ingredient =
      ingredientId
        ? ingredientById.get(
            ingredientId,
          ) || null
        : null

    const pack =
      packId
        ? packById.get(
            packId,
          ) || null
        : null

    metadataByItemId.set(
      itemId,
      {
        displayName:
          ingredient
            ?.canonicalName ||
          pack?.displayName ||
          null,

        canonicalIngredient:
          ingredient
            ? {
                id:
                  ingredientId,

                canonicalName:
                  ingredient.canonicalName,
              }
            : null,

        canonicalPack:
          pack
            ? {
                id:
                  packId,

                displayName:
                  pack.displayName,
              }
            : null,
      },
    )
  }

  return metadataByItemId
}

/*
|--------------------------------------------------------------------------
| Current Household
|--------------------------------------------------------------------------
|
| Household authority comes only from an active membership.
|
| No application access type receives an implicit tenant bypass.
|
*/

export async function requireCurrentPantryHousehold(
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  let membership =
    await HouseholdMembership
      .findOne({
        userId:
          actorUserId,

        status:
          'active',

        selectedForContext:
          true,
      })
      .lean()

  if (!membership) {
    const fallback =
      await HouseholdMembership
        .findOne({
          userId:
            actorUserId,

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
      throw new ApiError(
        403,
        'An active Household membership is required to use Pantry.',
        [
          {
            code:
              'HOUSEHOLD_MEMBERSHIP_REQUIRED',
          },
        ],
      )
    }

    await HouseholdMembership.updateMany(
      {
        userId:
          actorUserId,

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

    membership =
      await HouseholdMembership.findOneAndUpdate(
        {
          _id:
            fallback._id,

          userId:
            actorUserId,

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
  }

  const household =
    await Household
      .findOne({
        _id:
          membership.householdId,

        status:
          'active',
      })
      .lean()

  if (!household) {
    throw new ApiError(
      403,
      'The Household is not currently active.',
      [
        {
          code:
            'HOUSEHOLD_NOT_ACTIVE',
        },
      ],
    )
  }

  return {
    householdId:
      household._id,

    household,

    membership,
  }
}

/*
|--------------------------------------------------------------------------
| Direct Commerce Household Bootstrap
|--------------------------------------------------------------------------
|
| Pantry/recipe planning still requires an explicit active Household.
| Direct product shopping is different: a Customer must be able to buy a
| published Marketplace product even when they have never configured Pantry.
|
| The commerce data model already requires householdId for carts/orders, so
| first direct purchase provisions one private personal Household + owner
| membership. After that, every downstream checkout/order path continues to
| use the normal requireCurrentPantryHousehold authority boundary.
|
| This helper is intentionally exported for direct commerce only. Pantry,
| recipe and planning services must continue calling requireCurrentPantryHousehold.
|
*/

export async function requireOrProvisionDirectCommerceHousehold(
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  try {
    return await requireCurrentPantryHousehold(
      actorUser,
    )
  } catch (error) {
    const membershipRequired =
      error instanceof
        ApiError &&
      error.statusCode ===
        403 &&
      Array.isArray(
        error.errors,
      ) &&
      error.errors.some(
        (item) =>
          item?.code ===
          'HOUSEHOLD_MEMBERSHIP_REQUIRED',
      )

    if (!membershipRequired) {
      throw error
    }
  }

  const existingActiveMembership =
    await HouseholdMembership
      .findOne({
        userId:
          actorUserId,

        status:
          'active',
      })
      .lean()

  if (existingActiveMembership) {
    return requireCurrentPantryHousehold(
      actorUser,
    )
  }

  const personalNameSource =
    String(
      actorUser?.name ||
      actorUser?.fullName ||
      actorUser?.displayName ||
      'Personal',
    ).trim()

  const householdName =
    `${
      personalNameSource ||
      'Personal'
    } Household`.slice(
      0,
      120,
    )

  const household =
    await Household.create({
      name:
        householdName.length >=
        2
          ? householdName
          : 'Personal Household',

      usualPeopleCount:
        1,

      status:
        'active',

      createdByUserId:
        actorUserId,
    })

  try {
    await HouseholdMembership.create({
      householdId:
        household._id,

      userId:
        actorUserId,

      role:
        'owner',

      status:
        'active',

      joinedAt:
        new Date(),

      endedAt:
        null,
    })
  } catch (error) {
    if (error?.code !== 11000) {
      await Household.deleteOne({
        _id:
          household._id,

        createdByUserId:
          actorUserId,
      })

      throw error
    }

    await Household.deleteOne({
      _id:
        household._id,

      createdByUserId:
        actorUserId,
    })
  }

  return requireCurrentPantryHousehold(
    actorUser,
  )
}

/*
|--------------------------------------------------------------------------
| Canonical Identity
|--------------------------------------------------------------------------
*/

async function requireCanonicalPantryIdentity({
  canonicalPackId,
  canonicalIngredientId,
  session =
    null,
}) {
  if (
    canonicalPackId
  ) {
    const pack =
      await withSession(
        Pack
          .findById(
            canonicalPackId,
          )
          .select(
            '_id',
          ),

        session,
      ).lean()

    if (!pack) {
      throw new ApiError(
        404,
        'Canonical Pack was not found.',
        [
          {
            code:
              'PANTRY_CANONICAL_PACK_NOT_FOUND',
          },
        ],
      )
    }
  }

  if (
    canonicalIngredientId
  ) {
    const ingredient =
      await withSession(
        CanonicalIngredient
          .findById(
            canonicalIngredientId,
          )
          .select(
            '_id',
          ),

        session,
      ).lean()

    if (!ingredient) {
      throw new ApiError(
        404,
        'Canonical Ingredient was not found.',
        [
          {
            code:
              'PANTRY_CANONICAL_INGREDIENT_NOT_FOUND',
          },
        ],
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Item Serializer
|--------------------------------------------------------------------------
*/

export function serializePantryItem(
  pantryItem,
  {
    at =
      new Date(),

    identityMetadata =
      null,
  } = {},
) {
  if (!pantryItem) {
    return null
  }

  const raw =
    asPlainObject(
      pantryItem,
    )

  const projected =
    projectPantryItemAtTime(
      raw,
      at,
    )

  return {
    id:
      stringifyId(
        raw._id ||
        raw.id,
      ),

    canonicalPackId:
      referenceId(
        raw.canonicalPackId,
      ),

    canonicalIngredientId:
      referenceId(
        raw.canonicalIngredientId,
      ),

    displayName:
      identityMetadata
        ?.displayName ||
      raw.canonicalIngredientId
        ?.canonicalName ||
      raw.canonicalPackId
        ?.displayName ||
      null,

    canonicalIngredient:
      identityMetadata
        ?.canonicalIngredient ||
      (
        raw.canonicalIngredientId
          ?.canonicalName
          ? {
              id:
                referenceId(
                  raw.canonicalIngredientId,
                ),

              canonicalName:
                raw.canonicalIngredientId
                  .canonicalName,
            }
          : null
      ),

    canonicalPack:
      identityMetadata
        ?.canonicalPack ||
      (
        raw.canonicalPackId
          ?.displayName
          ? {
              id:
                referenceId(
                  raw.canonicalPackId,
                ),

              displayName:
                raw.canonicalPackId
                  .displayName,
            }
          : null
      ),

    state:
      projected?.state ||
      raw.state,

    quantity:
      projected
        ?.quantityEstimate ??
      raw.quantityEstimate ??
      null,

    confidence:
      projected
        ?.confidence ??
      raw.confidence ??
      0,

    storageZone:
      projected
        ?.storageZone ??
      raw.storageZone ??
      null,

    openedAt:
      projected
        ?.openedAt ??
      raw.openedAt ??
      null,

    useSoonAt:
      projected
        ?.useSoonAt ??
      raw.useSoonAt ??
      null,

    plannedUseAt:
      projected
        ?.plannedUseAt ??
      raw.plannedUseAt ??
      null,

    trackingPaused:
      Boolean(
        projected
          ?.trackingPausedAt ??
        raw.trackingPausedAt,
      ),

    lastObservationAt:
      projected
        ?.lastObservationAt ??
      raw.lastObservationAt ??
      null,

    lastSourceType:
      projected
        ?.lastSourceType ??
      raw.lastSourceType ??
      null,

    createdAt:
      raw.createdAt ||
      null,

    updatedAt:
      raw.updatedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Observation Serializer
|--------------------------------------------------------------------------
*/

export function serializePantryObservation(
  observation,
) {
  const value =
    asPlainObject(
      observation,
    )

  if (!value) {
    return null
  }

  return {
    id:
      stringifyId(
        value._id ||
        value.id,
      ),

    pantryItemId:
      stringifyId(
        value.pantryItemId,
      ),

    sourceType:
      value.sourceType,

    stateSignal:
      value.stateSignal ??
      null,

    quantity:
      value.quantitySignal ??
      null,

    customerCorrection:
      value.customerCorrection ===
      true,

    observedAt:
      value.observedAt,

    storageZone:
      value.storageZoneSignal ??
      null,

    openedAt:
      value.openedAtSignal ??
      null,

    useSoonAt:
      value.useSoonAtSignal ??
      null,

    plannedUseAt:
      value.plannedUseAtSignal ??
      null,

    note:
      value.note ||
      '',

    projectionApplied:
      value.projectionApplied ===
      true,

    projectionReason:
      value.projectionReason ||
      null,

    createdAt:
      value.createdAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Find/Create Pantry Item
|--------------------------------------------------------------------------
*/

async function requireOrCreatePantryItem({
  householdId,
  canonicalPackId,
  canonicalIngredientId,
  actorUserId,
  session,
}) {
  const identityKey =
    buildPantryIdentityKey({
      canonicalPackId,
      canonicalIngredientId,
    })

  let item =
    await withSession(
      PantryItem.findOne({
        householdId,

        identityKey,
      }),

      session,
    )

  if (item) {
    return item
  }

  const created =
    await PantryItem.create(
      [
        {
          householdId,

          canonicalPackId:
            canonicalPackId ||
            null,

          canonicalIngredientId:
            canonicalIngredientId ||
            null,

          identityKey,

          state:
            'uncertain',

          quantityEstimate: {
            mode:
              'unknown',
          },

          confidence:
            0,

          evidenceStrength:
            0,

          lastSourceType:
            null,

          lastObservationId:
            null,

          lastObservationAt:
            null,

          createdByUserId:
            actorUserId,

          updatedByUserId:
            actorUserId,
        },
      ],

      {
        session,
      },
    )

  item =
    created[0]

  return item
}

/*
|--------------------------------------------------------------------------
| Internal Observation Write
|--------------------------------------------------------------------------
|
| PantryObservation is immutable.
|
| Projection decision is calculated BEFORE creation so the final observation
| can be written once with projectionApplied/projectionReason.
|
*/

export async function createPantryObservationForHousehold({
  householdId,

  canonicalPackId =
    null,

  canonicalIngredientId =
    null,

  sourceType,

  quantity,

  observedAt =
    new Date(),

  storageZone,

  openedAt,

  useSoonAt,

  plannedUseAt,

  note =
    '',

  actorUser,

  customerCorrection =
    false,

  stateSignal =
    undefined,

  session =
    null,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const execute =
    async (
      activeSession,
    ) => {
      await requireCanonicalPantryIdentity({
        canonicalPackId,
        canonicalIngredientId,
        session:
          activeSession,
      })

      const item =
        await requireOrCreatePantryItem({
          householdId,

          canonicalPackId,

          canonicalIngredientId,

          actorUserId,

          session:
            activeSession,
        })

      const currentItem =
        asPlainObject(
          item,
        )

      const generated =
        buildPantryObservationProjection({
          currentItem,

          input: {
            sourceType,

            quantity,

            storageZone,

            openedAt,

            useSoonAt,

            plannedUseAt,

            note,
          },

          observedAt,
        })

      const observationForProjection = {
        ...generated,

        stateSignal:
          stateSignal ===
          undefined
            ? generated.stateSignal
            : stateSignal,

        customerCorrection:
          customerCorrection ===
            true,
      }

      const projection =
        projectPantryItemFromObservation({
          currentItem,

          observation:
            observationForProjection,

          actorUserId,
        })

      const projectionApplied =
        projection.applied ===
        true

      const projectionReason =
        projection.reason ||
        (
          projectionApplied
            ? 'applied'
            : 'not_applied'
        )

      const createdObservations =
        await PantryObservation.create(
          [
            {
              householdId,

              pantryItemId:
                item._id,

              sourceType,

              stateSignal:
                observationForProjection
                  .stateSignal,

              quantitySignal:
                observationForProjection
                  .quantitySignal,

              confidenceWeight:
                observationForProjection
                  .confidenceWeight,

              evidenceStrength:
                observationForProjection
                  .evidenceStrength,

              customerCorrection:
                observationForProjection
                  .customerCorrection,

              observedAt:
                observationForProjection
                  .observedAt,

              actorUserId,

              storageZoneSignal:
                observationForProjection
                  .storageZoneSignal,

              openedAtSignal:
                observationForProjection
                  .openedAtSignal,

              useSoonAtSignal:
                observationForProjection
                  .useSoonAtSignal,

              plannedUseAtSignal:
                observationForProjection
                  .plannedUseAtSignal,

              note:
                observationForProjection
                  .note,

              projectionApplied,

              projectionReason,
            },
          ],

          {
            session:
              activeSession,
          },
        )

      const observation =
        createdObservations[0]

      if (
        projectionApplied
      ) {
        const nextItem =
          projection.item

        await PantryItem.updateOne(
          {
            _id:
              item._id,

            householdId,
          },

          {
            $set: {
              state:
                nextItem.state,

              quantityEstimate:
                nextItem.quantityEstimate,

              confidence:
                nextItem.confidence,

              evidenceStrength:
                nextItem.evidenceStrength,

              lastSourceType:
                nextItem.lastSourceType,

              lastObservationId:
                observation._id,

              lastObservationAt:
                nextItem.lastObservationAt,

              storageZone:
                nextItem.storageZone,

              openedAt:
                nextItem.openedAt,

              useSoonAt:
                nextItem.useSoonAt,

              plannedUseAt:
                nextItem.plannedUseAt,

              trackingPausedAt:
                nextItem.trackingPausedAt,

              updatedByUserId:
                actorUserId,
            },
          },

          {
            session:
              activeSession,

            runValidators:
              true,
          },
        )
      }

      const refreshedItem =
        await withSession(
          PantryItem
            .findOne({
              _id:
                item._id,

              householdId,
            }),

          activeSession,
        ).lean()

      return {
        item:
          refreshedItem,

        observation:
          asPlainObject(
            observation,
          ),
      }
    }

  if (
    session
  ) {
    return execute(
      session,
    )
  }

  const transaction =
    await mongoose.startSession()

  try {
    let result

    await transaction.withTransaction(
      async () => {
        result =
          await execute(
            transaction,
          )
      },
    )

    return result
  } finally {
    await transaction.endSession()
  }
}

/*
|--------------------------------------------------------------------------
| Customer Observation
|--------------------------------------------------------------------------
*/

export async function createCustomerPantryObservation(
  input,
  actorUser,
) {
  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  return createPantryObservationForHousehold({
    householdId,

    canonicalPackId:
      input.canonicalPackId ||
      null,

    canonicalIngredientId:
      input.canonicalIngredientId ||
      null,

    sourceType:
      input.sourceType,

    quantity:
      input.quantity,

    observedAt:
      input.observedAt ||
      new Date(),

    storageZone:
      input.storageZone,

    openedAt:
      input.openedAt,

    useSoonAt:
      input.useSoonAt,

    plannedUseAt:
      input.plannedUseAt,

    note:
      input.note,

    actorUser,

    customerCorrection:
      input.sourceType ===
      'manual_quantity_correction',
  })
}

/*
|--------------------------------------------------------------------------
| List Pantry
|--------------------------------------------------------------------------
*/

export async function listPantryItems(
  query,
  actorUser,
) {
  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const page =
    query.page ||
    1

  const limit =
    query.limit ||
    50

  const filter = {
    householdId,
  }

  if (
    query.state
  ) {
    filter.state =
      query.state
  }

  if (
    query.canonicalPackId
  ) {
    filter.canonicalPackId =
      query.canonicalPackId
  }

  if (
    query.canonicalIngredientId
  ) {
    filter.canonicalIngredientId =
      query.canonicalIngredientId
  }

  const [
    items,
    total,
  ] =
    await Promise.all([
      PantryItem
        .find(
          filter,
        )
        .sort({
          updatedAt:
            -1,

          _id:
            1,
        })
        .skip(
          (
            page -
            1
          ) *
          limit,
        )
        .limit(
          limit,
        )
        .lean(),

      PantryItem.countDocuments(
        filter,
      ),
    ])

  const at =
    new Date()

  const identityMetadataByItemId =
    await resolvePantryIdentityMetadata(
      items,
    )

  return {
    items:
      items.map(
        (
          item,
        ) =>
          serializePantryItem(
            item,
            {
              at,

              identityMetadata:
                identityMetadataByItemId.get(
                  referenceId(
                    item._id ||
                    item.id,
                  ),
                ) ||
                null,
            },
          ),
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        Math.max(
          1,
          Math.ceil(
            total /
            limit,
          ),
        ),
    },
  }
}

/*
|--------------------------------------------------------------------------
| Require Household-owned Item
|--------------------------------------------------------------------------
*/

export async function requireOwnedPantryItem(
  pantryItemId,
  actorUser,
) {
  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const item =
    await PantryItem
      .findOne({
        _id:
          pantryItemId,

        householdId,
      })
      .lean()

  if (!item) {
    throw new ApiError(
      404,
      'Pantry item was not found.',
      [
        {
          code:
            'PANTRY_ITEM_NOT_FOUND',
        },
      ],
    )
  }

  return {
    householdId,

    item,
  }
}

/*
|--------------------------------------------------------------------------
| PATCH Item Through Observation
|--------------------------------------------------------------------------
*/

export async function updatePantryItemFromCustomer(
  pantryItemId,
  input,
  actorUser,
) {
  const {
    householdId,
    item,
  } =
    await requireOwnedPantryItem(
      pantryItemId,
      actorUser,
    )

  const observedAt =
    input.observedAt ||
    new Date()

  return createPantryObservationForHousehold({
    householdId,

    canonicalPackId:
      item.canonicalPackId ||
      null,

    canonicalIngredientId:
      item.canonicalIngredientId ||
      null,

    sourceType:
      input.sourceType,

    quantity:
      input.quantity,

    observedAt,

    storageZone:
      input.storageZone,

    openedAt:
      input.sourceType ===
        'opened'
        ? (
            input.openedAt ||
            observedAt
          )
        : input.openedAt,

    useSoonAt:
      input.useSoonAt,

    plannedUseAt:
      input.plannedUseAt,

    note:
      input.note,

    actorUser,

    customerCorrection:
      input.sourceType ===
      'manual_quantity_correction',
  })
}

/*
|--------------------------------------------------------------------------
| Item History
|--------------------------------------------------------------------------
*/

export async function getPantryItemHistory(
  pantryItemId,
  query,
  actorUser,
) {
  const {
    householdId,
    item,
  } =
    await requireOwnedPantryItem(
      pantryItemId,
      actorUser,
    )

  const page =
    query.page ||
    1

  const limit =
    query.limit ||
    50

  const filter = {
    householdId,

    pantryItemId:
      item._id,
  }

  const [
    observations,
    total,
  ] =
    await Promise.all([
      PantryObservation
        .find(
          filter,
        )
        .sort({
          observedAt:
            -1,

          _id:
            -1,
        })
        .skip(
          (
            page -
            1
          ) *
          limit,
        )
        .limit(
          limit,
        )
        .lean(),

      PantryObservation.countDocuments(
        filter,
      ),
    ])

  const identityMetadataByItemId =
    await resolvePantryIdentityMetadata([
      item,
    ])

  return {
    item:
      serializePantryItem(
        item,
        {
          identityMetadata:
            identityMetadataByItemId.get(
              referenceId(
                item._id ||
                item.id,
              ),
            ) ||
            null,
        },
      ),

    observations:
      observations.map(
        serializePantryObservation,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        Math.max(
          1,
          Math.ceil(
            total /
            limit,
          ),
        ),
    },
  }
}

/*
|--------------------------------------------------------------------------
| Preferences
|--------------------------------------------------------------------------
*/

function serializePantryPreferences(
  preference,
) {
  if (!preference) {
    return {
      pantryTrackingEnabled:
        true,

      replenishmentPromptsEnabled:
        true,

      defaultStorageZone:
        'pantry',

      doNotTrackPackIds:
        [],

      doNotTrackIngredientIds:
        [],
    }
  }

  const value =
    asPlainObject(
      preference,
    )

  return {
    pantryTrackingEnabled:
      value.pantryTrackingEnabled !==
      false,

    replenishmentPromptsEnabled:
      value.replenishmentPromptsEnabled !==
      false,

    defaultStorageZone:
      value.defaultStorageZone ||
      'pantry',

    doNotTrackPackIds:
      (
        value.doNotTrackPackIds ||
        []
      ).map(
        stringifyId,
      ),

    doNotTrackIngredientIds:
      (
        value.doNotTrackIngredientIds ||
        []
      ).map(
        stringifyId,
      ),

    updatedAt:
      value.updatedAt ||
      null,
  }
}

export async function getPantryPreferences(
  actorUser,
) {
  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const preference =
    await PantryHouseholdPreference
      .findOne({
        householdId,
      })
      .lean()

  return {
    preferences:
      serializePantryPreferences(
        preference,
      ),
  }
}

export async function updatePantryPreferences(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const preference =
    await PantryHouseholdPreference.findOneAndUpdate(
      {
        householdId,
      },

      {
        $set: {
          ...input,

          updatedByUserId:
            actorUserId,
        },

        $setOnInsert: {
          householdId,
        },
      },

      {
        new:
          true,

        upsert:
          true,

        runValidators:
          true,
      },
    )

  return {
    preferences:
      serializePantryPreferences(
        preference,
      ),
  }
}