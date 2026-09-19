import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  CanonicalIngredient,
  Pack,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  MarketplaceOrganization,
} from '../marketplace/marketplace.models.js'

import {
  ensureHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  Dish,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  convertRecipeQuantity,
} from '../recipes/recipe.scaling.js'

import {
  User,
} from '../users/user.model.js'

import {
  HOSPITALITY_PERMISSION_KEYS,
  HospitalityMemberGrant,
  HospitalityMenu,
  HospitalityMenuItem,
  HospitalityOutlet,
  HospitalityProcurementPlan,
  HospitalityProductionPlan,
  HospitalityProductionRecipeIngredient,
  HospitalityProductionRecipeVersion,
  HospitalityProfile,
  HospitalityRecipeCost,
  HospitalityStockObservation,
  HospitalitySupplier,
  HospitalitySupplierProduct,
} from './hospitality.models.js'

const ALL_HOSPITALITY_PERMISSIONS =
  new Set(
    HOSPITALITY_PERMISSION_KEYS,
  )

function id(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated Host identity is required.',
      [
        {
          code:
            'HOSPITALITY_HOST_IDENTITY_REQUIRED',
        },
      ],
    )
  }

  return value
}

function duplicateKeyError(
  error,
) {
  return (
    error?.code ===
    11000
  )
}

function roundQuantity(
  value,
) {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    throw new ApiError(
      400,
      'Hospitality quantity calculation produced an invalid number.',
      [
        {
          code:
            'HOSPITALITY_QUANTITY_INVALID',
        },
      ],
    )
  }

  return Number(
    value.toFixed(6),
  )
}

/*
|--------------------------------------------------------------------------
| Hospitality Authorization
|--------------------------------------------------------------------------
*/

function assertPermission(
  context,
  permissionKey,
) {
  if (
    context.isOrganizationOwner ===
      true ||
    context.permissionKeys.includes(
      permissionKey,
    )
  ) {
    return
  }

  throw new ApiError(
    403,
    'Hospitality permission is required for this operation.',
    [
      {
        code:
          'HOSPITALITY_PERMISSION_REQUIRED',

        permissionKey,
      },
    ],
  )
}

function assertAnyPermission(
  context,
  permissionKeys,
) {
  if (
    context.isOrganizationOwner ===
    true
  ) {
    return
  }

  if (
    permissionKeys.some(
      (permissionKey) =>
        context.permissionKeys.includes(
          permissionKey,
        ),
    )
  ) {
    return
  }

  throw new ApiError(
    403,
    'Hospitality permission is required for this operation.',
    [
      {
        code:
          'HOSPITALITY_PERMISSION_REQUIRED',

        requiredAnyPermissionKeys:
          permissionKeys,
      },
    ],
  )
}

function assertOutletScope(
  context,
  outletId,
) {
  if (
    context.isOrganizationOwner ===
      true ||
    context.outletIds.length ===
      0
  ) {
    return
  }

  if (
    context.outletIds.includes(
      id(outletId),
    )
  ) {
    return
  }

  throw new ApiError(
    403,
    'This Hospitality operator is not scoped to the requested outlet.',
    [
      {
        code:
          'HOSPITALITY_OUTLET_SCOPE_REQUIRED',

        outletId:
          id(outletId),
      },
    ],
  )
}

function assertOrganizationOwner(
  context,
) {
  if (
    context.isOrganizationOwner ===
    true
  ) {
    return
  }

  throw new ApiError(
    403,
    'Only the organization owner may change Hospitality member grants.',
    [
      {
        code:
          'HOSPITALITY_ORGANIZATION_OWNER_REQUIRED',
      },
    ],
  )
}

/*
|--------------------------------------------------------------------------
| Serialization
|--------------------------------------------------------------------------
*/

function serializeContext(
  context,
) {
  return {
    organization: {
      id:
        id(
          context.organization._id,
        ),

      displayName:
        context.organization.displayName,

      slug:
        context.organization.slug,

      organizationType:
        context.organization.organizationType,

      status:
        context.organization.status,
    },

    isOrganizationOwner:
      context.isOrganizationOwner,

    permissionKeys:
      context.permissionKeys,

    outletIds:
      context.outletIds,

    organizationSelectionRequired:
      false,
  }
}

function serializeOutlet(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    outletCode:
      item.outletCode,

    name:
      item.name,

    status:
      item.status,

    inheritanceMode:
      item.inheritanceMode,

    kitchenName:
      item.kitchenName ||
      '',

    costCenterCode:
      item.costCenterCode ||
      '',

    timezone:
      item.timezone,

    address:
      item.address ||
      {},

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeSupplier(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    supplierCode:
      item.supplierCode,

    name:
      item.name,

    status:
      item.status,

    leadTimeDays:
      item.leadTimeDays,

    serviceOutletIds:
      (
        item.serviceOutletIds ||
        []
      ).map(id),

    contact:
      item.contact ||
      {},

    notes:
      item.notes ||
      '',

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeSupplierProduct(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    supplierId:
      id(
        item.supplierId,
      ),

    supplierSku:
      item.supplierSku,

    versionNumber:
      item.versionNumber,

    canonicalPackId:
      id(
        item.canonicalPackId,
      ),

    canonicalIngredientId:
      id(
        item.canonicalIngredientId,
      ),

    localDescription:
      item.localDescription ||
      '',

    packQuantity:
      item.packQuantity,

    packUnit:
      item.packUnit,

    contractCost:
      item.contractCost,

    minimumOrderPacks:
      item.minimumOrderPacks,

    leadTimeDays:
      item.leadTimeDays,

    status:
      item.status,

    effectiveFrom:
      item.effectiveFrom ||
      null,

    effectiveTo:
      item.effectiveTo ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeProductionRecipe(
  value,
  ingredients = [],
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    recipeKey:
      item.recipeKey,

    versionNumber:
      item.versionNumber,

    dishId:
      id(
        item.dishId,
      ),

    sourceRecipeVersionId:
      id(
        item.sourceRecipeVersionId,
      ),

    title:
      item.title,

    baseYieldPortions:
      item.baseYieldPortions,

    finishedYield:
      item.finishedYield ||
      null,

    productionUnit:
      item.productionUnit,

    status:
      item.status,

    changeReason:
      item.changeReason,

    effectiveFrom:
      item.effectiveFrom ||
      null,

    effectiveTo:
      item.effectiveTo ||
      null,

    submittedAt:
      item.submittedAt ||
      null,

    approvedAt:
      item.approvedAt ||
      null,

    ingredients:
      ingredients.map(
        (
          ingredient,
        ) => ({
          id:
            id(
              ingredient._id,
            ),

          lineNumber:
            ingredient.lineNumber,

          canonicalIngredientId:
            id(
              ingredient.canonicalIngredientId,
            ),

          quantity:
            ingredient.quantity,

          unit:
            ingredient.unit,

          expectedWastePercentage:
            ingredient.expectedWastePercentage,

          preferredSupplierProductId:
            id(
              ingredient.preferredSupplierProductId,
            ),

          optional:
            ingredient.optional ===
            true,

          notes:
            ingredient.notes ||
            '',
        }),
      ),

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeMenu(
  value,
  items = [],
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    outletId:
      id(
        item.outletId,
      ),

    menuCode:
      item.menuCode,

    name:
      item.name,

    status:
      item.status,

    effectiveFrom:
      item.effectiveFrom ||
      null,

    effectiveTo:
      item.effectiveTo ||
      null,

    items:
      items.map(
        (
          menuItem,
        ) => ({
          id:
            id(
              menuItem._id,
            ),

          productionRecipeVersionId:
            id(
              menuItem.productionRecipeVersionId,
            ),

          displayName:
            menuItem.displayName,

          sellingPrice:
            menuItem.sellingPrice ||
            null,

          status:
            menuItem.status,
        }),
      ),

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeRecipeCost(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    outletId:
      id(
        item.outletId,
      ),

    productionRecipeVersionId:
      id(
        item.productionRecipeVersionId,
      ),

    currency:
      item.currency,

    totalCostMinor:
      item.totalCostMinor,

    costPerPortionMinor:
      item.costPerPortionMinor,

    lines:
      item.lines ||
      [],

    calculatedAt:
      item.calculatedAt,
  }
}

function serializeProductionPlan(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    outletId:
      id(
        item.outletId,
      ),

    planDate:
      item.planDate,

    status:
      item.status,

    items:
      item.items ||
      [],

    grossRequirements:
      item.grossRequirements ||
      [],

    stockReconciliation:
      item.stockReconciliation ||
      [],

    netRequirements:
      item.netRequirements ||
      [],

    calculationVersion:
      item.calculationVersion,

    calculatedAt:
      item.calculatedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,
  }
}

function serializeProcurementPlan(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    outletIds:
      (
        item.outletIds ||
        []
      ).map(id),

    productionPlanIds:
      (
        item.productionPlanIds ||
        []
      ).map(id),

    status:
      item.status,

    currency:
      item.currency,

    lines:
      item.lines ||
      [],

    totalExpectedCostMinor:
      item.totalExpectedCostMinor,

    supplierSelectionPolicy:
      item.supplierSelectionPolicy,

    automaticPurchaseOrderSubmission:
      item.automaticPurchaseOrderSubmission ===
      true,

    createdAt:
      item.createdAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Tenant Resolution
|--------------------------------------------------------------------------
*/

async function requireOrganization(
  organizationId,
) {
  const organization =
    await MarketplaceOrganization.findOne({
      _id:
        organizationId,

      status:
        'active',
    })

  if (!organization) {
    throw new ApiError(
      404,
      'Active Hospitality organization was not found.',
      [
        {
          code:
            'HOSPITALITY_ORGANIZATION_NOT_FOUND',
        },
      ],
    )
  }

  return organization
}

export async function resolveHospitalityContext(
  actorUser,
  organizationIdHint = null,
) {
  const userId =
    actorId(
      actorUser,
    )

  /*
  |--------------------------------------------------------------------------
  | Explicit organization selection
  |--------------------------------------------------------------------------
  */

  if (
    organizationIdHint
  ) {
    const organization =
      await requireOrganization(
        organizationIdHint,
      )

    if (
      id(
        organization.ownerUserId,
      ) ===
      id(
        userId,
      )
    ) {
      return {
        organization,

        isOrganizationOwner:
          true,

        permissionKeys: [
          ...HOSPITALITY_PERMISSION_KEYS,
        ],

        outletIds:
          [],
      }
    }

    const grant =
      await HospitalityMemberGrant.findOne({
        organizationId:
          organization._id,

        userId,

        status:
          'active',
      })

    if (!grant) {
      throw new ApiError(
        403,
        'Host does not have Hospitality access to the selected organization.',
        [
          {
            code:
              'HOSPITALITY_ORGANIZATION_ACCESS_REQUIRED',
          },
        ],
      )
    }

    return {
      organization,

      isOrganizationOwner:
        false,

      permissionKeys: [
        ...new Set(
          grant.permissionKeys ||
          [],
        ),
      ],

      outletIds:
        (
          grant.outletIds ||
          []
        ).map(id),
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Organization owner
  |--------------------------------------------------------------------------
  */

  const ownedOrganization =
    await MarketplaceOrganization.findOne({
      ownerUserId:
        userId,

      status:
        'active',
    })

  if (
    ownedOrganization
  ) {
    return {
      organization:
        ownedOrganization,

      isOrganizationOwner:
        true,

      permissionKeys: [
        ...HOSPITALITY_PERMISSION_KEYS,
      ],

      outletIds:
        [],
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Delegated Hospitality Host
  |--------------------------------------------------------------------------
  */

  const grants =
    await HospitalityMemberGrant.find({
      userId,

      status:
        'active',
    })
      .limit(2)
      .lean()

  if (
    grants.length ===
    0
  ) {
    throw new ApiError(
      403,
      'Host has no active Hospitality organization access.',
      [
        {
          code:
            'HOSPITALITY_ACCESS_REQUIRED',
        },
      ],
    )
  }

  if (
    grants.length >
    1
  ) {
    throw new ApiError(
      409,
      'Select an organization before using the Hospitality workspace.',
      [
        {
          code:
            'HOSPITALITY_ORGANIZATION_SELECTION_REQUIRED',

          header:
            'x-epantry-organization-id',
        },
      ],
    )
  }

  const organization =
    await requireOrganization(
      grants[0].organizationId,
    )

  return {
    organization,

    isOrganizationOwner:
      false,

    permissionKeys: [
      ...new Set(
        grants[0].permissionKeys ||
        [],
      ),
    ],

    outletIds:
      (
        grants[0].outletIds ||
        []
      ).map(id),
  }
}

async function ensureOwnerHospitalityContext(
  actorUser,
) {
  const organization =
    await ensureHostMarketplaceOrganization(
      actorUser,
    )

  return {
    organization,

    isOrganizationOwner:
      true,

    permissionKeys: [
      ...HOSPITALITY_PERMISSION_KEYS,
    ],

    outletIds:
      [],
  }
}

/*
|--------------------------------------------------------------------------
| Domain Requirements
|--------------------------------------------------------------------------
*/

async function requireOwnedOutlet(
  context,
  outletId,
) {
  assertOutletScope(
    context,
    outletId,
  )

  const outlet =
    await HospitalityOutlet.findOne({
      _id:
        outletId,

      organizationId:
        context.organization._id,
    })

  if (!outlet) {
    throw new ApiError(
      404,
      'Hospitality outlet was not found in this organization.',
      [
        {
          code:
            'HOSPITALITY_OUTLET_NOT_FOUND',
        },
      ],
    )
  }

  return outlet
}

async function requireCanonicalIngredient(
  canonicalIngredientId,
) {
  const ingredient =
    await CanonicalIngredient.findOne({
      _id:
        canonicalIngredientId,

      status:
        'active',
    })

  if (!ingredient) {
    throw new ApiError(
      404,
      'Active canonical Ingredient was not found.',
      [
        {
          code:
            'HOSPITALITY_CANONICAL_INGREDIENT_NOT_FOUND',
        },
      ],
    )
  }

  return ingredient
}

async function requireCurrentPublishedPack(
  packId,
) {
  const pack =
    await Pack.findOne({
      _id:
        packId,

      status:
        'active',
    })

  if (!pack) {
    throw new ApiError(
      404,
      'Active canonical Pack was not found.',
      [
        {
          code:
            'HOSPITALITY_CANONICAL_PACK_NOT_FOUND',
        },
      ],
    )
  }

  const now =
    new Date()

  const currentVersion =
    await ProductVersion.findOne({
      packId:
        pack._id,

      publicationStatus:
        'published',

      $and: [
        {
          $or: [
            {
              effectiveFrom:
                null,
            },
            {
              effectiveFrom: {
                $lte:
                  now,
              },
            },
          ],
        },
        {
          $or: [
            {
              effectiveTo:
                null,
            },
            {
              effectiveTo: {
                $gt:
                  now,
              },
            },
          ],
        },
      ],
    })
      .sort({
        version:
          -1,
      })

  if (
    !currentVersion
  ) {
    throw new ApiError(
      409,
      'Supplier mapping requires a currently published canonical Product Version.',
      [
        {
          code:
            'HOSPITALITY_PACK_PUBLISHED_VERSION_REQUIRED',
        },
      ],
    )
  }

  return {
    pack,
    currentVersion,
  }
}

async function requireSupplier(
  context,
  supplierId,
) {
  const supplier =
    await HospitalitySupplier.findOne({
      _id:
        supplierId,

      organizationId:
        context.organization._id,
    })

  if (!supplier) {
    throw new ApiError(
      404,
      'Hospitality supplier was not found.',
      [
        {
          code:
            'HOSPITALITY_SUPPLIER_NOT_FOUND',
        },
      ],
    )
  }

  return supplier
}

async function requireProductionRecipe(
  context,
  productionRecipeVersionId,
) {
  const recipe =
    await HospitalityProductionRecipeVersion.findOne({
      _id:
        productionRecipeVersionId,

      organizationId:
        context.organization._id,
    })

  if (!recipe) {
    throw new ApiError(
      404,
      'Hospitality Production Recipe Version was not found.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  return recipe
}

async function requireApprovedProductionRecipe(
  context,
  productionRecipeVersionId,
) {
  const recipe =
    await requireProductionRecipe(
      context,
      productionRecipeVersionId,
    )

  if (
    recipe.status !==
    'approved'
  ) {
    throw new ApiError(
      409,
      'Only an approved Production Recipe Version may be used operationally.',
      [
        {
          code:
            'HOSPITALITY_APPROVED_PRODUCTION_RECIPE_REQUIRED',
        },
      ],
    )
  }

  return recipe
}

async function requireActiveSupplierProduct(
  context,
  supplierProductId,
  now = new Date(),
) {
  const item =
    await HospitalitySupplierProduct.findOne({
      _id:
        supplierProductId,

      organizationId:
        context.organization._id,

      status:
        'active',

      $and: [
        {
          $or: [
            {
              effectiveFrom:
                null,
            },
            {
              effectiveFrom: {
                $lte:
                  now,
              },
            },
          ],
        },
        {
          $or: [
            {
              effectiveTo:
                null,
            },
            {
              effectiveTo: {
                $gt:
                  now,
              },
            },
          ],
        },
      ],
    })

  if (!item) {
    throw new ApiError(
      409,
      'An active effective Supplier Product is required.',
      [
        {
          code:
            'HOSPITALITY_SUPPLIER_PRODUCT_ACTIVE_REQUIRED',
        },
      ],
    )
  }

  return item
}

/*
|--------------------------------------------------------------------------
| Deterministic Hospitality Math
|--------------------------------------------------------------------------
*/

function grossQuantityForWaste(
  netQuantity,
  expectedWastePercentage,
) {
  const retainedFraction =
    1 -
    Number(
      expectedWastePercentage ||
      0,
    ) /
      100

  if (
    retainedFraction <=
    0
  ) {
    throw new ApiError(
      409,
      'Expected waste makes the Production Recipe requirement unusable.',
      [
        {
          code:
            'HOSPITALITY_WASTE_ASSUMPTION_INVALID',
        },
      ],
    )
  }

  return roundQuantity(
    Number(
      netQuantity,
    ) /
      retainedFraction,
  )
}

function requirementCostFromSupplierProduct({
  requirementQuantity,
  requirementUnit,
  supplierProduct,
  wholePacks = false,
}) {
  let requirementInPackUnit =
    null

  try {
    requirementInPackUnit =
      convertRecipeQuantity({
        quantity:
          requirementQuantity,

        fromUnit:
          requirementUnit,

        toUnit:
          supplierProduct.packUnit,
      })
  } catch {
    return {
      eligible:
        false,

      reason:
        'unit_not_convertible',
    }
  }

  const exactPacks =
    requirementInPackUnit /
    supplierProduct.packQuantity

  const packCount =
    wholePacks
      ? Math.max(
          supplierProduct.minimumOrderPacks,
          Math.ceil(
            exactPacks,
          ),
        )
      : exactPacks

  return {
    eligible:
      true,

    requirementInPackUnit:
      roundQuantity(
        requirementInPackUnit,
      ),

    exactPacks:
      roundQuantity(
        exactPacks,
      ),

    packCount:
      wholePacks
        ? packCount
        : roundQuantity(
            packCount,
          ),

    expectedCostMinor:
      Math.round(
        packCount *
          supplierProduct.contractCost.amountMinor,
      ),

    currency:
      supplierProduct.contractCost.currency,
  }
}

/*
|--------------------------------------------------------------------------
| Profile / Context
|--------------------------------------------------------------------------
*/

export async function getHospitalityContext({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.read',
  )

  const profile =
    await HospitalityProfile.findOne({
      organizationId:
        context.organization._id,
    }).lean()

  return {
    context:
      serializeContext(
        context,
      ),

    profile:
      profile
        ? {
            id:
              id(
                profile._id,
              ),

            organizationId:
              id(
                profile.organizationId,
              ),

            status:
              profile.status,

            defaultCurrency:
              profile.defaultCurrency,

            measurementSystem:
              profile.measurementSystem,

            notes:
              profile.notes ||
              '',
          }
        : null,
  }
}

export async function initializeHospitalityProfile({
  input,
  actorUser,
}) {
  const context =
    await ensureOwnerHospitalityContext(
      actorUser,
    )

  const userId =
    actorId(
      actorUser,
    )

  const profile =
    await HospitalityProfile.findOneAndUpdate(
      {
        organizationId:
          context.organization._id,
      },
      {
        $setOnInsert: {
          organizationId:
            context.organization._id,

          createdByUserId:
            userId,
        },

        $set: {
          status:
            'active',

          defaultCurrency:
            input.defaultCurrency,

          notes:
            input.notes,

          updatedByUserId:
            userId,
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
    context:
      serializeContext(
        context,
      ),

    profile: {
      id:
        id(
          profile._id,
        ),

      organizationId:
        id(
          profile.organizationId,
        ),

      status:
        profile.status,

      defaultCurrency:
        profile.defaultCurrency,

      measurementSystem:
        profile.measurementSystem,

      notes:
        profile.notes ||
        '',
    },
  }
}

/*
|--------------------------------------------------------------------------
| Outlets
|--------------------------------------------------------------------------
*/

export async function listHospitalityOutlets({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.read',
  )

  const filter = {
    organizationId:
      context.organization._id,
  }

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    filter._id = {
      $in:
        context.outletIds,
    }
  }

  const outlets =
    await HospitalityOutlet.find(
      filter,
    )
      .sort({
        name:
          1,
      })
      .lean()

  return {
    outlets:
      outlets.map(
        serializeOutlet,
      ),
  }
}

export async function createHospitalityOutlet({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.outlets.manage',
  )

  const userId =
    actorId(
      actorUser,
    )

  try {
    const outlet =
      await HospitalityOutlet.create({
        ...input,

        organizationId:
          context.organization._id,

        createdByUserId:
          userId,

        updatedByUserId:
          userId,
      })

    return {
      outlet:
        serializeOutlet(
          outlet,
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
        'Outlet code already exists inside this organization.',
        [
          {
            code:
              'HOSPITALITY_OUTLET_CODE_CONFLICT',
          },
        ],
      )
    }

    throw error
  }
}

export async function updateHospitalityOutlet({
  outletId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.outlets.manage',
  )

  const outlet =
    await requireOwnedOutlet(
      context,
      outletId,
    )

  for (
    const [
      key,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    outlet[key] =
      value
  }

  outlet.updatedByUserId =
    actorId(
      actorUser,
    )

  await outlet.save()

  return {
    outlet:
      serializeOutlet(
        outlet,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Member Grants
|--------------------------------------------------------------------------
*/

export async function listHospitalityMemberGrants({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  if (
    context.isOrganizationOwner !==
    true
  ) {
    assertPermission(
      context,
      'hospitality.members.manage',
    )
  }

  const grants =
    await HospitalityMemberGrant.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  return {
    grants:
      grants.map(
        (
          grant,
        ) => ({
          id:
            id(
              grant._id,
            ),

          userId:
            id(
              grant.userId,
            ),

          permissionKeys:
            grant.permissionKeys ||
            [],

          outletIds:
            (
              grant.outletIds ||
              []
            ).map(id),

          status:
            grant.status,

          reason:
            grant.reason,

          revokedAt:
            grant.revokedAt ||
            null,
        }),
      ),
  }
}

export async function upsertHospitalityMemberGrant({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  /*
  | Permission delegation is owner-controlled.
  |
  | A delegated member cannot grant themselves broader permissions.
  */

  assertOrganizationOwner(
    context,
  )

  const targetUser =
    await User.findOne({
      _id:
        input.userId,

      accountStatus:
        'active',

      hostEnabled:
        true,

      hostAccessStatus:
        'active',
    }).lean()

  if (!targetUser) {
    throw new ApiError(
      409,
      'Hospitality membership requires an active Host identity.',
      [
        {
          code:
            'HOSPITALITY_MEMBER_ACTIVE_HOST_REQUIRED',
        },
      ],
    )
  }

  if (
    id(
      targetUser._id,
    ) ===
    id(
      context.organization.ownerUserId,
    )
  ) {
    throw new ApiError(
      409,
      'Organization owner already has full Hospitality authority.',
      [
        {
          code:
            'HOSPITALITY_OWNER_GRANT_REDUNDANT',
        },
      ],
    )
  }

  for (
    const outletId of
    input.outletIds
  ) {
    await requireOwnedOutlet(
      {
        ...context,

        isOrganizationOwner:
          true,
      },
      outletId,
    )
  }

  const grant =
    await HospitalityMemberGrant.findOneAndUpdate(
      {
        organizationId:
          context.organization._id,

        userId:
          targetUser._id,
      },
      {
        $set: {
          permissionKeys: [
            ...new Set([
              'hospitality.read',
              ...input.permissionKeys,
            ]),
          ].filter(
            (key) =>
              ALL_HOSPITALITY_PERMISSIONS.has(
                key,
              ),
          ),

          outletIds: [
            ...new Set(
              input.outletIds.map(
                String,
              ),
            ),
          ],

          status:
            'active',

          reason:
            input.reason,

          grantedByUserId:
            actorId(
              actorUser,
            ),

          revokedAt:
            null,

          revokedByUserId:
            null,
        },
      },
      {
        upsert:
          true,

        new:
          true,

        runValidators:
          true,
      },
    )

  return {
    grant: {
      id:
        id(
          grant._id,
        ),

      userId:
        id(
          grant.userId,
        ),

      permissionKeys:
        grant.permissionKeys,

      outletIds:
        grant.outletIds.map(
          id,
        ),

      status:
        grant.status,

      reason:
        grant.reason,
    },
  }
}

export async function revokeHospitalityMemberGrant({
  grantId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertOrganizationOwner(
    context,
  )

  const grant =
    await HospitalityMemberGrant.findOne({
      _id:
        grantId,

      organizationId:
        context.organization._id,
    })

  if (!grant) {
    throw new ApiError(
      404,
      'Hospitality member grant was not found.',
      [
        {
          code:
            'HOSPITALITY_MEMBER_GRANT_NOT_FOUND',
        },
      ],
    )
  }

  grant.status =
    'revoked'

  grant.reason =
    input.reason

  grant.revokedAt =
    new Date()

  grant.revokedByUserId =
    actorId(
      actorUser,
    )

  await grant.save()

  return {
    grant: {
      id:
        id(
          grant._id,
        ),

      userId:
        id(
          grant.userId,
        ),

      permissionKeys:
        grant.permissionKeys,

      outletIds:
        grant.outletIds.map(
          id,
        ),

      status:
        grant.status,

      reason:
        grant.reason,

      revokedAt:
        grant.revokedAt,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Suppliers
|--------------------------------------------------------------------------
*/

export async function listHospitalitySuppliers({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertAnyPermission(
    context,
    [
      'hospitality.suppliers.read',
      'hospitality.suppliers.manage',
    ],
  )

  const supplierFilter = {
    organizationId:
      context.organization._id,
  }

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    supplierFilter.$or = [
      {
        serviceOutletIds: {
          $size:
            0,
        },
      },
      {
        serviceOutletIds: {
          $in:
            context.outletIds,
        },
      },
    ]
  }

  const suppliers =
    await HospitalitySupplier.find(
      supplierFilter,
    )
      .sort({
        name:
          1,
      })
      .lean()

  return {
    suppliers:
      suppliers.map(
        serializeSupplier,
      ),
  }
}

export async function createHospitalitySupplier({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.suppliers.manage',
  )

  for (
    const outletId of
    input.serviceOutletIds
  ) {
    await requireOwnedOutlet(
      context,
      outletId,
    )
  }

  try {
    const supplier =
      await HospitalitySupplier.create({
        ...input,

        organizationId:
          context.organization._id,

        createdByUserId:
          actorId(
            actorUser,
          ),

        updatedByUserId:
          actorId(
            actorUser,
          ),
      })

    return {
      supplier:
        serializeSupplier(
          supplier,
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
        'Supplier code already exists inside this organization.',
        [
          {
            code:
              'HOSPITALITY_SUPPLIER_CODE_CONFLICT',
          },
        ],
      )
    }

    throw error
  }
}

export async function updateHospitalitySupplier({
  supplierId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.suppliers.manage',
  )

  const supplier =
    await requireSupplier(
      context,
      supplierId,
    )

  if (
    input.serviceOutletIds
  ) {
    for (
      const outletId of
      input.serviceOutletIds
    ) {
      await requireOwnedOutlet(
        context,
        outletId,
      )
    }
  }

  for (
    const [
      key,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    supplier[key] =
      value
  }

  supplier.updatedByUserId =
    actorId(
      actorUser,
    )

  await supplier.save()

  return {
    supplier:
      serializeSupplier(
        supplier,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Supplier Products
|--------------------------------------------------------------------------
*/

export async function listHospitalitySupplierProducts({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertAnyPermission(
    context,
    [
      'hospitality.suppliers.read',
      'hospitality.suppliers.manage',
      'hospitality.costing.read',
      'hospitality.procurement.read',
    ],
  )

  const productFilter = {
    organizationId:
      context.organization._id,
  }

  /*
  | Outlet-scoped operators may only see supplier contracts applicable to
  | their own outlets or organization-wide suppliers.
  */

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    const visibleSuppliers =
      await HospitalitySupplier.find({
        organizationId:
          context.organization._id,

        $or: [
          {
            serviceOutletIds: {
              $size:
                0,
            },
          },
          {
            serviceOutletIds: {
              $in:
                context.outletIds,
            },
          },
        ],
      })
        .select(
          '_id',
        )
        .lean()

    productFilter.supplierId = {
      $in:
        visibleSuppliers.map(
          (
            supplier,
          ) =>
            supplier._id,
        ),
    }
  }

  const items =
    await HospitalitySupplierProduct.find(
      productFilter,
    )
      .sort({
        createdAt:
          -1,
      })
      .lean()

  return {
    supplierProducts:
      items.map(
        serializeSupplierProduct,
      ),
  }
}

export async function createHospitalitySupplierProduct({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.suppliers.manage',
  )

  await requireSupplier(
    context,
    input.supplierId,
  )

  if (
    input.canonicalIngredientId
  ) {
    await requireCanonicalIngredient(
      input.canonicalIngredientId,
    )
  }

  if (
    input.canonicalPackId
  ) {
    await requireCurrentPublishedPack(
      input.canonicalPackId,
    )
  }

  /*
  | Supplier contract terms are versioned.
  |
  | Existing cost/pack/MOQ terms are not price-overwritten through PATCH.
  */

  const latestVersion =
    await HospitalitySupplierProduct.findOne({
      organizationId:
        context.organization._id,

      supplierId:
        input.supplierId,

      supplierSku:
        input.supplierSku,
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  const versionNumber =
    Number(
      latestVersion?.versionNumber ||
      0,
    ) +
    1

  try {
    const item =
      await HospitalitySupplierProduct.create({
        ...input,

        organizationId:
          context.organization._id,

        versionNumber,

        status:
          'active',

        createdByUserId:
          actorId(
            actorUser,
          ),

        updatedByUserId:
          actorId(
            actorUser,
          ),
      })

    return {
      supplierProduct:
        serializeSupplierProduct(
          item,
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
        'Supplier Product version could not be created safely.',
        [
          {
            code:
              'HOSPITALITY_SUPPLIER_PRODUCT_VERSION_CONFLICT',
          },
        ],
      )
    }

    throw error
  }
}

export async function updateHospitalitySupplierProduct({
  supplierProductId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.suppliers.manage',
  )

  const item =
    await HospitalitySupplierProduct.findOne({
      _id:
        supplierProductId,

      organizationId:
        context.organization._id,
    })

  if (!item) {
    throw new ApiError(
      404,
      'Supplier Product was not found.',
      [
        {
          code:
            'HOSPITALITY_SUPPLIER_PRODUCT_NOT_FOUND',
        },
      ],
    )
  }

  /*
  | Validator only allows lifecycle / descriptive fields.
  |
  | New price/pack/MOQ terms require a new Supplier Product version.
  */

  for (
    const [
      key,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    item[key] =
      value
  }

  item.updatedByUserId =
    actorId(
      actorUser,
    )

  await item.save()

  return {
    supplierProduct:
      serializeSupplierProduct(
        item,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Production Recipes
|--------------------------------------------------------------------------
*/

export async function listHospitalityProductionRecipes({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertAnyPermission(
    context,
    [
      'hospitality.recipes.read',
      'hospitality.recipes.manage',
      'hospitality.recipes.approve',
    ],
  )

  const recipes =
    await HospitalityProductionRecipeVersion.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        recipeKey:
          1,

        versionNumber:
          -1,
      })
      .lean()

  return {
    productionRecipes:
      recipes.map(
        (
          recipe,
        ) =>
          serializeProductionRecipe(
            recipe,
          ),
      ),
  }
}

export async function getHospitalityProductionRecipe({
  productionRecipeVersionId,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertAnyPermission(
    context,
    [
      'hospitality.recipes.read',
      'hospitality.recipes.manage',
      'hospitality.recipes.approve',
      'hospitality.costing.read',
      'hospitality.procurement.read',
    ],
  )

  const recipe =
    await requireProductionRecipe(
      context,
      productionRecipeVersionId,
    )

  const ingredients =
    await HospitalityProductionRecipeIngredient.find({
      productionRecipeVersionId:
        recipe._id,

      organizationId:
        context.organization._id,
    })
      .sort({
        lineNumber:
          1,
      })
      .lean()

  return {
    productionRecipe:
      serializeProductionRecipe(
        recipe,
        ingredients,
      ),
  }
}

export async function createHospitalityProductionRecipe({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.recipes.manage',
  )

  /*
  |--------------------------------------------------------------------------
  | Optional M07 lineage
  |--------------------------------------------------------------------------
  */

  if (
    input.dishId
  ) {
    const dish =
      await Dish.findOne({
        _id:
          input.dishId,

        status: {
          $ne:
            'retired',
        },
      }).lean()

    if (!dish) {
      throw new ApiError(
        404,
        'Referenced M07 Dish was not found.',
        [
          {
            code:
              'HOSPITALITY_SOURCE_DISH_NOT_FOUND',
          },
        ],
      )
    }
  }

  if (
    input.sourceRecipeVersionId
  ) {
    const sourceRecipe =
      await RecipeVersion.findOne({
        _id:
          input.sourceRecipeVersionId,

        status: {
          $in: [
            'in_review',
            'published',
          ],
        },
      }).lean()

    if (
      !sourceRecipe
    ) {
      throw new ApiError(
        409,
        'Production Recipe source must be an existing governed M07 Recipe Version.',
        [
          {
            code:
              'HOSPITALITY_SOURCE_RECIPE_VERSION_INVALID',
          },
        ],
      )
    }

    if (
      input.dishId &&
      id(
        sourceRecipe.dishId,
      ) !==
        id(
          input.dishId,
        )
    ) {
      throw new ApiError(
        409,
        'Dish and source Recipe Version identities do not match.',
        [
          {
            code:
              'HOSPITALITY_SOURCE_RECIPE_DISH_MISMATCH',
          },
        ],
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Canonical Ingredient validation
  |--------------------------------------------------------------------------
  */

  const canonicalIngredientIds = [
    ...new Set(
      input.ingredients.map(
        (
          ingredient,
        ) =>
          ingredient.canonicalIngredientId,
      ),
    ),
  ]

  const ingredientCount =
    await CanonicalIngredient.countDocuments({
      _id: {
        $in:
          canonicalIngredientIds,
      },

      status:
        'active',
    })

  if (
    ingredientCount !==
    canonicalIngredientIds.length
  ) {
    throw new ApiError(
      409,
      'Every Production Recipe ingredient must reference an active canonical Ingredient.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_INGREDIENT_INVALID',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Preferred Supplier Product validation
  |--------------------------------------------------------------------------
  */

  for (
    const ingredient of
    input.ingredients
  ) {
    if (
      ingredient.preferredSupplierProductId
    ) {
      const supplierProduct =
        await requireActiveSupplierProduct(
          context,
          ingredient.preferredSupplierProductId,
        )

      if (
        supplierProduct.canonicalIngredientId &&
        id(
          supplierProduct.canonicalIngredientId,
        ) !==
          id(
            ingredient.canonicalIngredientId,
          )
      ) {
        throw new ApiError(
          409,
          'Preferred Supplier Product does not match the Production Recipe canonical Ingredient.',
          [
            {
              code:
                'HOSPITALITY_SUPPLIER_INGREDIENT_MISMATCH',
            },
          ],
        )
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Version progression
  |--------------------------------------------------------------------------
  */

  const latest =
    await HospitalityProductionRecipeVersion.findOne({
      organizationId:
        context.organization._id,

      recipeKey:
        input.recipeKey,
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  if (
    latest &&
    ![
      'approved',
      'retired',
    ].includes(
      latest.status,
    )
  ) {
    throw new ApiError(
      409,
      'Finish the current Production Recipe draft/review cycle before creating another version.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_OPEN_VERSION_EXISTS',
        },
      ],
    )
  }

  const versionNumber =
    Number(
      latest?.versionNumber ||
      0,
    ) +
    1

  /*
  |--------------------------------------------------------------------------
  | Atomic Production Recipe + Ingredient creation
  |--------------------------------------------------------------------------
  */

  const session =
    await mongoose.startSession()

  let recipe =
    null

  let createdIngredients =
    []

  try {
    await session.withTransaction(
      async () => {
        const [
          createdRecipe,
        ] =
          await HospitalityProductionRecipeVersion.create(
            [
              {
                organizationId:
                  context.organization._id,

                recipeKey:
                  input.recipeKey,

                versionNumber,

                dishId:
                  input.dishId,

                sourceRecipeVersionId:
                  input.sourceRecipeVersionId,

                title:
                  input.title,

                baseYieldPortions:
                  input.baseYieldPortions,

                finishedYield:
                  input.finishedYield,

                productionUnit:
                  input.productionUnit,

                status:
                  'draft',

                changeReason:
                  input.changeReason,

                createdByUserId:
                  actorId(
                    actorUser,
                  ),
              },
            ],
            {
              session,
            },
          )

        recipe =
          createdRecipe

        createdIngredients =
          await HospitalityProductionRecipeIngredient.create(
            input.ingredients.map(
              (
                ingredient,
              ) => ({
                ...ingredient,

                organizationId:
                  context.organization._id,

                productionRecipeVersionId:
                  createdRecipe._id,
              }),
            ),
            {
              session,
            },
          )
      },
    )
  } finally {
    await session.endSession()
  }

  return {
    productionRecipe:
      serializeProductionRecipe(
        recipe,
        createdIngredients,
      ),
  }
}

export async function submitHospitalityProductionRecipe({
  productionRecipeVersionId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.recipes.manage',
  )

  const recipe =
    await requireProductionRecipe(
      context,
      productionRecipeVersionId,
    )

  if (
    recipe.status !==
    'draft'
  ) {
    throw new ApiError(
      409,
      'Only a draft Production Recipe Version can enter review.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_SUBMIT_STATE_INVALID',
        },
      ],
    )
  }

  const ingredientCount =
    await HospitalityProductionRecipeIngredient.countDocuments({
      productionRecipeVersionId:
        recipe._id,

      organizationId:
        context.organization._id,
    })

  if (
    ingredientCount ===
    0
  ) {
    throw new ApiError(
      409,
      'Production Recipe requires canonical Ingredient lines before review.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_INGREDIENTS_REQUIRED',
        },
      ],
    )
  }

  recipe.status =
    'in_review'

  recipe.submittedAt =
    new Date()

  recipe.submittedByUserId =
    actorId(
      actorUser,
    )

  recipe.changeReason =
    input.reason

  await recipe.save()

  return getHospitalityProductionRecipe({
    productionRecipeVersionId:
      recipe._id,

    actorUser,

    organizationIdHint:
      context.organization._id,
  })
}

export async function approveHospitalityProductionRecipe({
  productionRecipeVersionId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.recipes.approve',
  )

  const recipe =
    await requireProductionRecipe(
      context,
      productionRecipeVersionId,
    )

  if (
    recipe.status !==
    'in_review'
  ) {
    throw new ApiError(
      409,
      'Production Recipe must be in review before approval.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_APPROVAL_STATE_INVALID',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Maker-checker
  |--------------------------------------------------------------------------
  */

  if (
    id(
      recipe.submittedByUserId,
    ) ===
    id(
      actorId(
        actorUser,
      ),
    )
  ) {
    throw new ApiError(
      409,
      'Production Recipe approval requires a different checker from the submitter.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_MAKER_CHECKER_REQUIRED',
        },
      ],
    )
  }

  /*
  | If linked to M07, publication must already be governed there.
  */

  if (
    recipe.sourceRecipeVersionId
  ) {
    const sourceRecipe =
      await RecipeVersion.findOne({
        _id:
          recipe.sourceRecipeVersionId,

        status:
          'published',
      }).lean()

    if (
      !sourceRecipe
    ) {
      throw new ApiError(
        409,
        'Linked M07 Recipe Version must be published before the Production Recipe can be approved.',
        [
          {
            code:
              'HOSPITALITY_SOURCE_RECIPE_PUBLICATION_REQUIRED',
          },
        ],
      )
    }
  }

  recipe.status =
    'approved'

  recipe.approvedAt =
    new Date()

  recipe.approvedByUserId =
    actorId(
      actorUser,
    )

  recipe.changeReason =
    input.reason

  await recipe.save()

  return getHospitalityProductionRecipe({
    productionRecipeVersionId:
      recipe._id,

    actorUser,

    organizationIdHint:
      context.organization._id,
  })
}

/*
|--------------------------------------------------------------------------
| Menus
|--------------------------------------------------------------------------
*/

export async function listHospitalityMenus({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertAnyPermission(
    context,
    [
      'hospitality.read',
      'hospitality.recipes.read',
    ],
  )

  const filter = {
    organizationId:
      context.organization._id,
  }

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    filter.outletId = {
      $in:
        context.outletIds,
    }
  }

  const menus =
    await HospitalityMenu.find(
      filter,
    )
      .sort({
        createdAt:
          -1,
      })
      .lean()

  const items =
    await HospitalityMenuItem.find({
      organizationId:
        context.organization._id,

      menuId: {
        $in:
          menus.map(
            (
              menu,
            ) =>
              menu._id,
          ),
      },
    }).lean()

  const itemsByMenu =
    new Map()

  for (
    const item of
    items
  ) {
    const key =
      id(
        item.menuId,
      )

    const current =
      itemsByMenu.get(
        key,
      ) ||
      []

    current.push(
      item,
    )

    itemsByMenu.set(
      key,
      current,
    )
  }

  return {
    menus:
      menus.map(
        (
          menu,
        ) =>
          serializeMenu(
            menu,

            itemsByMenu.get(
              id(
                menu._id,
              ),
            ) ||
              [],
          ),
      ),
  }
}

export async function createHospitalityMenu({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.recipes.manage',
  )

  await requireOwnedOutlet(
    context,
    input.outletId,
  )

  if (
    input.effectiveFrom &&
    input.effectiveTo &&
    input.effectiveFrom >=
      input.effectiveTo
  ) {
    throw new ApiError(
      400,
      'Menu effectiveTo must be after effectiveFrom.',
      [
        {
          code:
            'HOSPITALITY_MENU_EFFECTIVE_WINDOW_INVALID',
        },
      ],
    )
  }

  try {
    const menu =
      await HospitalityMenu.create({
        ...input,

        organizationId:
          context.organization._id,

        status:
          'draft',

        createdByUserId:
          actorId(
            actorUser,
          ),

        updatedByUserId:
          actorId(
            actorUser,
          ),
      })

    return {
      menu:
        serializeMenu(
          menu,
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
        'Menu code already exists for this outlet.',
        [
          {
            code:
              'HOSPITALITY_MENU_CODE_CONFLICT',
          },
        ],
      )
    }

    throw error
  }
}

export async function addHospitalityMenuItem({
  menuId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.recipes.manage',
  )

  const menu =
    await HospitalityMenu.findOne({
      _id:
        menuId,

      organizationId:
        context.organization._id,
    })

  if (!menu) {
    throw new ApiError(
      404,
      'Hospitality menu was not found.',
      [
        {
          code:
            'HOSPITALITY_MENU_NOT_FOUND',
        },
      ],
    )
  }

  assertOutletScope(
    context,
    menu.outletId,
  )

  await requireApprovedProductionRecipe(
    context,
    input.productionRecipeVersionId,
  )

  try {
    const menuItem =
      await HospitalityMenuItem.create({
        organizationId:
          context.organization._id,

        menuId:
          menu._id,

        productionRecipeVersionId:
          input.productionRecipeVersionId,

        displayName:
          input.displayName,

        sellingPrice:
          input.sellingPrice,

        status:
          'active',
      })

    return {
      menuItem: {
        id:
          id(
            menuItem._id,
          ),

        menuId:
          id(
            menuItem.menuId,
          ),

        productionRecipeVersionId:
          id(
            menuItem.productionRecipeVersionId,
          ),

        displayName:
          menuItem.displayName,

        sellingPrice:
          menuItem.sellingPrice ||
          null,

        status:
          menuItem.status,
      },
    }
  } catch (error) {
    if (
      duplicateKeyError(
        error,
      )
    ) {
      throw new ApiError(
        409,
        'Production Recipe is already present on this menu.',
        [
          {
            code:
              'HOSPITALITY_MENU_ITEM_CONFLICT',
          },
        ],
      )
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Costing
|--------------------------------------------------------------------------
*/

function supplierServesOutlet(
  supplier,
  outletId,
) {
  if (!outletId) {
    return true
  }

  const serviceOutletIds =
    (
      supplier.serviceOutletIds ||
      []
    ).map(id)

  return (
    serviceOutletIds.length ===
      0 ||
    serviceOutletIds.includes(
      id(
        outletId,
      ),
    )
  )
}

async function costingSupplierProductForIngredient(
  context,
  ingredient,
  now,
  outletId,
) {
  /*
  |--------------------------------------------------------------------------
  | Explicit preferred Supplier Product
  |--------------------------------------------------------------------------
  */

  if (
    ingredient.preferredSupplierProductId
  ) {
    const preferred =
      await requireActiveSupplierProduct(
        context,
        ingredient.preferredSupplierProductId,
        now,
      )

    const supplier =
      await HospitalitySupplier.findOne({
        _id:
          preferred.supplierId,

        organizationId:
          context.organization._id,

        status:
          'active',
      }).lean()

    if (
      !supplier ||
      !supplierServesOutlet(
        supplier,
        outletId,
      )
    ) {
      throw new ApiError(
        409,
        'Preferred Supplier Product is not serviceable for the selected outlet.',
        [
          {
            code:
              'HOSPITALITY_COSTING_SUPPLIER_OUTLET_MISMATCH',
          },
        ],
      )
    }

    return preferred
  }

  /*
  |--------------------------------------------------------------------------
  | Otherwise inspect active effective mappings by Ingredient.
  |--------------------------------------------------------------------------
  */

  const candidateProducts =
    await HospitalitySupplierProduct.find({
      organizationId:
        context.organization._id,

      canonicalIngredientId:
        ingredient.canonicalIngredientId,

      status:
        'active',

      $and: [
        {
          $or: [
            {
              effectiveFrom:
                null,
            },
            {
              effectiveFrom: {
                $lte:
                  now,
              },
            },
          ],
        },
        {
          $or: [
            {
              effectiveTo:
                null,
            },
            {
              effectiveTo: {
                $gt:
                  now,
              },
            },
          ],
        },
      ],
    })
      .sort({
        'contractCost.amountMinor':
          1,
      })
      .lean()

  for (
    const candidate of
    candidateProducts
  ) {
    const supplier =
      await HospitalitySupplier.findOne({
        _id:
          candidate.supplierId,

        organizationId:
          context.organization._id,

        status:
          'active',
      }).lean()

    if (
      supplier &&
      supplierServesOutlet(
        supplier,
        outletId,
      )
    ) {
      return candidate
    }
  }

  return null
}

export async function calculateHospitalityRecipeCost({
  productionRecipeVersionId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.costing.read',
  )

  const recipe =
    await requireApprovedProductionRecipe(
      context,
      productionRecipeVersionId,
    )

  /*
  | Outlet-scoped member may not request organization-wide cost visibility.
  */

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0 &&
    !input.outletId
  ) {
    throw new ApiError(
      400,
      'Outlet-scoped Hospitality costing requires an explicit outlet.',
      [
        {
          code:
            'HOSPITALITY_COSTING_OUTLET_REQUIRED',
        },
      ],
    )
  }

  if (
    input.outletId
  ) {
    await requireOwnedOutlet(
      context,
      input.outletId,
    )
  }

  const ingredients =
    await HospitalityProductionRecipeIngredient.find({
      organizationId:
        context.organization._id,

      productionRecipeVersionId:
        recipe._id,

      optional:
        false,
    })
      .sort({
        lineNumber:
          1,
      })

  const now =
    new Date()

  const lines =
    []

  let totalCostMinor =
    0

  let currency =
    null

  for (
    const ingredient of
    ingredients
  ) {
    const supplierProduct =
      await costingSupplierProductForIngredient(
        context,
        ingredient,
        now,
        input.outletId,
      )

    if (
      !supplierProduct
    ) {
      throw new ApiError(
        409,
        'Recipe costing is incomplete because a required Ingredient has no effective Supplier Product.',
        [
          {
            code:
              'HOSPITALITY_COSTING_SUPPLIER_MAPPING_REQUIRED',

            canonicalIngredientId:
              id(
                ingredient.canonicalIngredientId,
              ),
          },
        ],
      )
    }

    const grossQuantity =
      grossQuantityForWaste(
        ingredient.quantity,
        ingredient.expectedWastePercentage,
      )

    const cost =
      requirementCostFromSupplierProduct({
        requirementQuantity:
          grossQuantity,

        requirementUnit:
          ingredient.unit,

        supplierProduct,

        /*
        | Recipe cost uses proportional pack consumption.
        |
        | Procurement later rounds to purchasable packs.
        */
        wholePacks:
          false,
      })

    if (
      !cost.eligible
    ) {
      throw new ApiError(
        409,
        'Recipe costing cannot convert an Ingredient requirement into the Supplier Product pack unit.',
        [
          {
            code:
              'HOSPITALITY_COSTING_UNIT_CONVERSION_REQUIRED',

            canonicalIngredientId:
              id(
                ingredient.canonicalIngredientId,
              ),

            supplierProductId:
              id(
                supplierProduct._id,
              ),
          },
        ],
      )
    }

    /*
    | No implicit FX.
    */

    if (
      currency &&
      currency !==
        cost.currency
    ) {
      throw new ApiError(
        409,
        'Recipe costing cannot combine multiple currencies without a governed FX policy.',
        [
          {
            code:
              'HOSPITALITY_COSTING_CURRENCY_MISMATCH',
          },
        ],
      )
    }

    currency =
      cost.currency

    totalCostMinor +=
      cost.expectedCostMinor

    lines.push({
      lineNumber:
        ingredient.lineNumber,

      canonicalIngredientId:
        id(
          ingredient.canonicalIngredientId,
        ),

      netQuantity:
        ingredient.quantity,

      grossQuantity,

      unit:
        ingredient.unit,

      expectedWastePercentage:
        ingredient.expectedWastePercentage,

      supplierProductId:
        id(
          supplierProduct._id,
        ),

      supplierId:
        id(
          supplierProduct.supplierId,
        ),

      supplierSku:
        supplierProduct.supplierSku,

      supplierProductVersionNumber:
        supplierProduct.versionNumber,

      contractPackQuantity:
        supplierProduct.packQuantity,

      contractPackUnit:
        supplierProduct.packUnit,

      exactPackUsage:
        cost.exactPacks,

      expectedCostMinor:
        cost.expectedCostMinor,

      currency:
        cost.currency,
    })
  }

  const costPerPortionMinor =
    Math.round(
      totalCostMinor /
      recipe.baseYieldPortions,
    )

  const costSnapshot =
    await HospitalityRecipeCost.create({
      organizationId:
        context.organization._id,

      outletId:
        input.outletId,

      productionRecipeVersionId:
        recipe._id,

      currency:
        currency ||
        'INR',

      totalCostMinor,

      costPerPortionMinor,

      lines,

      calculatedAt:
        now,

      calculatedByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    recipeCost:
      serializeRecipeCost(
        costSnapshot,
      ),

    policy: {
      moneyStoredInMinorUnits:
        true,

      supplierContractCostIsNotMarketplaceOfferPrice:
        true,

      fxConversionPerformed:
        false,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Stock Observations
|--------------------------------------------------------------------------
*/

export async function createHospitalityStockObservation({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.procurement.manage',
  )

  await requireOwnedOutlet(
    context,
    input.outletId,
  )

  await requireCanonicalIngredient(
    input.canonicalIngredientId,
  )

  const observation =
    await HospitalityStockObservation.create({
      ...input,

      organizationId:
        context.organization._id,

      observedByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    stockObservation: {
      id:
        id(
          observation._id,
        ),

      outletId:
        id(
          observation.outletId,
        ),

      canonicalIngredientId:
        id(
          observation.canonicalIngredientId,
        ),

      quantity:
        observation.quantity,

      unit:
        observation.unit,

      source:
        observation.source,

      observedAt:
        observation.observedAt,

      note:
        observation.note ||
        '',
    },
  }
}

async function latestStockObservation({
  context,
  outletId,
  canonicalIngredientId,
}) {
  return HospitalityStockObservation.findOne({
    organizationId:
      context.organization._id,

    outletId,

    canonicalIngredientId,
  })
    .sort({
      observedAt:
        -1,

      createdAt:
        -1,
    })
    .lean()
}

/*
|--------------------------------------------------------------------------
| Production Planning
|--------------------------------------------------------------------------
*/

async function calculateProductionPlanRequirements({
  context,
  outletId,
  items,
}) {
  const grossByIngredient =
    new Map()

  /*
  |--------------------------------------------------------------------------
  | Scale approved Production Recipes
  |--------------------------------------------------------------------------
  */

  for (
    const item of
    items
  ) {
    const recipe =
      await requireApprovedProductionRecipe(
        context,
        item.productionRecipeVersionId,
      )

    const ingredients =
      await HospitalityProductionRecipeIngredient.find({
        organizationId:
          context.organization._id,

        productionRecipeVersionId:
          recipe._id,

        optional:
          false,
      }).lean()

    const scale =
      Number(
        item.portions,
      ) /
      recipe.baseYieldPortions

    for (
      const ingredient of
      ingredients
    ) {
      const scaledNet =
        roundQuantity(
          ingredient.quantity *
          scale,
        )

      const scaledGross =
        grossQuantityForWaste(
          scaledNet,
          ingredient.expectedWastePercentage,
        )

      const key =
        id(
          ingredient.canonicalIngredientId,
        )

      const existing =
        grossByIngredient.get(
          key,
        )

      if (
        !existing
      ) {
        grossByIngredient.set(
          key,
          {
            canonicalIngredientId:
              key,

            quantity:
              scaledGross,

            unit:
              ingredient.unit,

            contributingRecipeVersionIds: [
              id(
                recipe._id,
              ),
            ],
          },
        )

        continue
      }

      let converted =
        null

      try {
        converted =
          convertRecipeQuantity({
            quantity:
              scaledGross,

            fromUnit:
              ingredient.unit,

            toUnit:
              existing.unit,
          })
      } catch {
        throw new ApiError(
          409,
          'Production requirements for the same Ingredient use incompatible units and cannot be silently consolidated.',
          [
            {
              code:
                'HOSPITALITY_REQUIREMENT_UNIT_CONFLICT',

              canonicalIngredientId:
                key,
            },
          ],
        )
      }

      existing.quantity =
        roundQuantity(
          existing.quantity +
          converted,
        )

      existing.contributingRecipeVersionIds.push(
        id(
          recipe._id,
        ),
      )
    }
  }

  const grossRequirements = [
    ...grossByIngredient.values(),
  ]

  const stockReconciliation =
    []

  const netRequirements =
    []

  /*
  |--------------------------------------------------------------------------
  | Reconcile latest append-only stock observation
  |--------------------------------------------------------------------------
  */

  for (
    const requirement of
    grossRequirements
  ) {
    const observation =
      await latestStockObservation({
        context,

        outletId,

        canonicalIngredientId:
          requirement.canonicalIngredientId,
      })

    let usableOnHand =
      0

    let conversionState =
      'none'

    if (
      observation
    ) {
      try {
        usableOnHand =
          convertRecipeQuantity({
            quantity:
              observation.quantity,

            fromUnit:
              observation.unit,

            toUnit:
              requirement.unit,
          })

        conversionState =
          'converted'
      } catch {
        /*
        | Cannot prove compatibility.
        | Fail conservative: do not subtract incompatible observation.
        */

        usableOnHand =
          0

        conversionState =
          'unit_not_convertible'
      }
    }

    const netQuantity =
      roundQuantity(
        Math.max(
          0,
          requirement.quantity -
            usableOnHand,
        ),
      )

    stockReconciliation.push({
      canonicalIngredientId:
        requirement.canonicalIngredientId,

      requiredGrossQuantity:
        requirement.quantity,

      requiredUnit:
        requirement.unit,

      observationId:
        id(
          observation?._id,
        ),

      observedQuantity:
        observation?.quantity ??
        null,

      observedUnit:
        observation?.unit ??
        null,

      observedAt:
        observation?.observedAt ??
        null,

      observationSource:
        observation?.source ??
        null,

      usableOnHandQuantity:
        usableOnHand,

      conversionState,
    })

    if (
      netQuantity >
      0
    ) {
      netRequirements.push({
        canonicalIngredientId:
          requirement.canonicalIngredientId,

        quantity:
          netQuantity,

        unit:
          requirement.unit,
      })
    }
  }

  return {
    grossRequirements,
    stockReconciliation,
    netRequirements,
  }
}

export async function createHospitalityProductionPlan({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.procurement.manage',
  )

  await requireOwnedOutlet(
    context,
    input.outletId,
  )

  const calculation =
    await calculateProductionPlanRequirements({
      context,

      outletId:
        input.outletId,

      items:
        input.items,
    })

  const plan =
    await HospitalityProductionPlan.create({
      organizationId:
        context.organization._id,

      outletId:
        input.outletId,

      planDate:
        input.planDate,

      status:
        'calculated',

      items:
        input.items,

      grossRequirements:
        calculation.grossRequirements,

      stockReconciliation:
        calculation.stockReconciliation,

      netRequirements:
        calculation.netRequirements,

      calculationVersion:
        'm18-v1',

      createdByUserId:
        actorId(
          actorUser,
        ),

      calculatedByUserId:
        actorId(
          actorUser,
        ),

      calculatedAt:
        new Date(),
    })

  return {
    productionPlan:
      serializeProductionPlan(
        plan,
      ),

    policy: {
      latestObservedStockOnly:
        true,

      stockObservationHistoryPreserved:
        true,

      automaticInventoryMutation:
        false,
    },
  }
}

export async function listHospitalityProductionPlans({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertAnyPermission(
    context,
    [
      'hospitality.procurement.read',
      'hospitality.procurement.manage',
    ],
  )

  const filter = {
    organizationId:
      context.organization._id,
  }

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    filter.outletId = {
      $in:
        context.outletIds,
    }
  }

  const plans =
    await HospitalityProductionPlan.find(
      filter,
    )
      .sort({
        planDate:
          -1,

        createdAt:
          -1,
      })
      .lean()

  return {
    productionPlans:
      plans.map(
        serializeProductionPlan,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Procurement Supplier Comparison
|--------------------------------------------------------------------------
*/

async function supplierCandidatesForRequirement({
  context,
  requirement,
  outletIds,
  now,
}) {
  const supplierProducts =
    await HospitalitySupplierProduct.find({
      organizationId:
        context.organization._id,

      canonicalIngredientId:
        requirement.canonicalIngredientId,

      status:
        'active',

      $and: [
        {
          $or: [
            {
              effectiveFrom:
                null,
            },
            {
              effectiveFrom: {
                $lte:
                  now,
              },
            },
          ],
        },
        {
          $or: [
            {
              effectiveTo:
                null,
            },
            {
              effectiveTo: {
                $gt:
                  now,
              },
            },
          ],
        },
      ],
    }).lean()

  const candidates =
    []

  for (
    const supplierProduct of
    supplierProducts
  ) {
    const supplier =
      await HospitalitySupplier.findOne({
        _id:
          supplierProduct.supplierId,

        organizationId:
          context.organization._id,

        status:
          'active',
      }).lean()

    if (
      !supplier
    ) {
      continue
    }

    const serviceOutletIds =
      (
        supplier.serviceOutletIds ||
        []
      ).map(id)

    const servesEveryOutlet =
      serviceOutletIds.length ===
        0 ||
      outletIds.every(
        (
          outletId,
        ) =>
          serviceOutletIds.includes(
            outletId,
          ),
      )

    if (
      !servesEveryOutlet
    ) {
      continue
    }

    const cost =
      requirementCostFromSupplierProduct({
        requirementQuantity:
          requirement.quantity,

        requirementUnit:
          requirement.unit,

        supplierProduct,

        /*
        | Procurement must buy whole Supplier packs.
        */
        wholePacks:
          true,
      })

    if (
      !cost.eligible
    ) {
      continue
    }

    candidates.push({
      supplierProductId:
        id(
          supplierProduct._id,
        ),

      supplierProductVersionNumber:
        supplierProduct.versionNumber,

      supplierId:
        id(
          supplier._id,
        ),

      supplierName:
        supplier.name,

      supplierSku:
        supplierProduct.supplierSku,

      requiredPackCount:
        cost.packCount,

      contractPackQuantity:
        supplierProduct.packQuantity,

      contractPackUnit:
        supplierProduct.packUnit,

      expectedCostMinor:
        cost.expectedCostMinor,

      currency:
        cost.currency,

      leadTimeDays:
        supplierProduct.leadTimeDays ||
        supplier.leadTimeDays ||
        0,
    })
  }

  return candidates.sort(
    (
      a,
      b,
    ) => {
      /*
      | No hidden FX comparison.
      */

      if (
        a.currency !==
        b.currency
      ) {
        return a.currency.localeCompare(
          b.currency,
        )
      }

      if (
        a.expectedCostMinor !==
        b.expectedCostMinor
      ) {
        return (
          a.expectedCostMinor -
          b.expectedCostMinor
        )
      }

      return a.supplierName.localeCompare(
        b.supplierName,
      )
    },
  )
}

export async function createHospitalityProcurementPlan({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.procurement.manage',
  )

  /*
  |--------------------------------------------------------------------------
  | Load calculated production plans from this exact organization
  |--------------------------------------------------------------------------
  */

  const productionPlans =
    await HospitalityProductionPlan.find({
      _id: {
        $in:
          input.productionPlanIds,
      },

      organizationId:
        context.organization._id,

      status: {
        $in: [
          'calculated',
          'approved',
        ],
      },
    }).lean()

  if (
    productionPlans.length !==
    input.productionPlanIds.length
  ) {
    throw new ApiError(
      409,
      'Every Procurement Plan source must be a calculated Production Plan owned by this organization.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_PLAN_SET_INVALID',
        },
      ],
    )
  }

  const outletIds = [
    ...new Set(
      productionPlans.map(
        (
          plan,
        ) =>
          id(
            plan.outletId,
          ),
      ),
    ),
  ]

  for (
    const outletId of
    outletIds
  ) {
    assertOutletScope(
      context,
      outletId,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Consolidate net shortages across plans / outlets
  |--------------------------------------------------------------------------
  */

  const consolidated =
    new Map()

  for (
    const plan of
    productionPlans
  ) {
    for (
      const requirement of
      plan.netRequirements ||
      []
    ) {
      const key =
        id(
          requirement.canonicalIngredientId,
        )

      const existing =
        consolidated.get(
          key,
        )

      if (
        !existing
      ) {
        consolidated.set(
          key,
          {
            canonicalIngredientId:
              key,

            quantity:
              requirement.quantity,

            unit:
              requirement.unit,

            sourceProductionPlanIds: [
              id(
                plan._id,
              ),
            ],
          },
        )

        continue
      }

      let converted =
        null

      try {
        converted =
          convertRecipeQuantity({
            quantity:
              requirement.quantity,

            fromUnit:
              requirement.unit,

            toUnit:
              existing.unit,
          })
      } catch {
        throw new ApiError(
          409,
          'Net requirements use incompatible units and cannot be consolidated for procurement.',
          [
            {
              code:
                'HOSPITALITY_PROCUREMENT_UNIT_CONFLICT',

              canonicalIngredientId:
                key,
            },
          ],
        )
      }

      existing.quantity =
        roundQuantity(
          existing.quantity +
          converted,
        )

      existing.sourceProductionPlanIds.push(
        id(
          plan._id,
        ),
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Supplier comparison
  |--------------------------------------------------------------------------
  */

  const now =
    new Date()

  const lines =
    []

  let totalExpectedCostMinor =
    0

  let currency =
    null

  for (
    const requirement of
    consolidated.values()
  ) {
    const candidates =
      await supplierCandidatesForRequirement({
        context,
        requirement,
        outletIds,
        now,
      })

    const selected =
      candidates[0] ||
      null

    if (
      selected &&
      currency &&
      currency !==
        selected.currency
    ) {
      throw new ApiError(
        409,
        'Procurement comparison cannot combine currencies without a governed FX policy.',
        [
          {
            code:
              'HOSPITALITY_PROCUREMENT_CURRENCY_MISMATCH',
          },
        ],
      )
    }

    if (
      selected
    ) {
      currency =
        selected.currency

      totalExpectedCostMinor +=
        selected.expectedCostMinor
    }

    lines.push({
      canonicalIngredientId:
        requirement.canonicalIngredientId,

      quantity:
        requirement.quantity,

      unit:
        requirement.unit,

      sourceProductionPlanIds:
        requirement.sourceProductionPlanIds,

      candidates,

      selectedSupplierProductId:
        selected?.supplierProductId ||
        null,

      selectedSupplierId:
        selected?.supplierId ||
        null,

      selectedExpectedCostMinor:
        selected?.expectedCostMinor ??
        null,

      selectionReason:
        selected
          ? 'lowest_known_contract_cost'
          : 'no_eligible_supplier_mapping',
    })
  }

  const plan =
    await HospitalityProcurementPlan.create({
      organizationId:
        context.organization._id,

      outletIds,

      productionPlanIds:
        productionPlans.map(
          (
            planItem,
          ) =>
            planItem._id,
        ),

      status:
        'draft',

      currency:
        currency ||
        'INR',

      lines,

      totalExpectedCostMinor,

      supplierSelectionPolicy:
        'lowest_known_contract_cost',

      /*
      | M18 Batch 1 does not submit POs to supplier systems.
      */
      automaticPurchaseOrderSubmission:
        false,

      createdByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    procurementPlan:
      serializeProcurementPlan(
        plan,
      ),

    policy: {
      supplierComparisonIsDeterministic:
        true,

      automaticPurchaseOrderSubmission:
        false,

      rfqAuctionImplemented:
        false,

      fxConversionPerformed:
        false,
    },
  }
}

export async function getHospitalityProcurementPlan({
  procurementPlanId,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertAnyPermission(
    context,
    [
      'hospitality.procurement.read',
      'hospitality.procurement.manage',
    ],
  )

  const plan =
    await HospitalityProcurementPlan.findOne({
      _id:
        procurementPlanId,

      organizationId:
        context.organization._id,
    })

  if (!plan) {
    throw new ApiError(
      404,
      'Hospitality Procurement Plan was not found.',
      [
        {
          code:
            'HOSPITALITY_PROCUREMENT_PLAN_NOT_FOUND',
        },
      ],
    )
  }

  for (
    const outletId of
    plan.outletIds
  ) {
    assertOutletScope(
      context,
      outletId,
    )
  }

  return {
    procurementPlan:
      serializeProcurementPlan(
        plan,
      ),
  }
}