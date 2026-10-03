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
  FoodCalculation,
} from '../foodIntelligence/foodIntelligence.models.js'

import {
  declareRecipeFoodIntelligenceSchema,
} from '../foodIntelligence/foodIntelligence.integration.validation.js'

import {
  declareRecipeFoodIntelligence,
  getLatestRecipeFoodIntelligenceDeclaration,
  submitRecipeFoodIntelligenceDeclaration,
} from '../foodIntelligence/foodIntelligence.recipe.service.js'

import {
  MarketplaceOrganization,
} from '../marketplace/marketplace.models.js'

import {
  ensureHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  Dish,
  RecipeIngredient,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  createAdminRecipe,
  getAdminRecipeVersion,
  updateAdminRecipeDraft,
} from '../recipes/recipe.admin.service.js'

import {
  createAdminRecipeSchema,
} from '../recipes/recipe.admin.validation.js'

import {
  convertRecipeQuantity,
} from '../recipes/recipe.scaling.js'

import {
  notifyActiveSuperAdminsBestEffort,
} from '../notifications/notification.service.js'

import {
  User,
} from '../users/user.model.js'

import {
  DishPassportSnapshot,
} from './hospitality.passport.models.js'

import {
  HOSPITALITY_PERMISSION_KEYS,
  HospitalityMemberGrant,
  HospitalityMenu,
  HospitalityMenuAvailability,
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

function rootSuperAdminActorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (
    !value ||
    actorUser?.superAdminEnabled !==
      true
  ) {
    throw new ApiError(
      403,
      'Real Super Admin authority is required for Hospitality approval.',
      [
        {
          code:
            'HOSPITALITY_ROOT_SUPER_ADMIN_REQUIRED',
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

    recipeFoundationMode:
      item.recipeFoundationMode ||
      'legacy_hospitality',

    listingOutletId:
      id(
        item.listingOutletId,
      ),

    customerVisibility:
      item.customerVisibility ||
      'organization_only',

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
  sourceRecipeVersionByProductionRecipeId = new Map(),
  availabilityByMenuItemId = new Map(),
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

          sourceRecipeVersionId:
            id(
              menuItem.sourceRecipeVersionId,
            ) ||
            sourceRecipeVersionByProductionRecipeId.get(
              id(
                menuItem.productionRecipeVersionId,
              ),
            ) ||
            null,

          displayName:
            menuItem.displayName,

          sellingPrice:
            menuItem.sellingPrice ||
            null,

          status:
            menuItem.status,

          availability:
            availabilityByMenuItemId.get(
              id(
                menuItem._id,
              ),
            ) || {
              status:
                'available',

              note:
                '',

              observedAt:
                null,

              source:
                'default_available',
            },
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

    sourceRecipeVersionId:
      id(
        item.sourceRecipeVersionId,
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
  sourceRecipeVersionByProductionRecipeId = new Map(),
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
      (
        item.items ||
        []
      ).map(
        (
          planItem,
        ) => ({
          ...(
            typeof planItem?.toObject ===
            'function'
              ? planItem.toObject()
              : planItem
          ),

          productionRecipeVersionId:
            id(
              planItem.productionRecipeVersionId,
            ),

          sourceRecipeVersionId:
            id(
              planItem.sourceRecipeVersionId,
            ) ||
            sourceRecipeVersionByProductionRecipeId.get(
              id(
                planItem.productionRecipeVersionId,
              ),
            ) ||
            null,
        }),
      ),

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

async function loadOperationalRecipeLineageMap({
  organizationId,
  productionRecipeVersionIds,
}) {
  const uniqueIds = [
    ...new Set(
      (
        productionRecipeVersionIds ||
        []
      )
        .map(id)
        .filter(Boolean),
    ),
  ]

  if (
    uniqueIds.length ===
    0
  ) {
    return new Map()
  }

  const recipes =
    await HospitalityProductionRecipeVersion.find({
      organizationId,

      _id: {
        $in:
          uniqueIds,
      },
    })
      .select({
        _id:
          1,

        sourceRecipeVersionId:
          1,
      })
      .lean()

  return new Map(
    recipes.map(
      (
        recipe,
      ) => [
        id(
          recipe._id,
        ),
        id(
          recipe.sourceRecipeVersionId,
        ),
      ],
    ),
  )
}

function serializeMenuAvailability(
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

    menuId:
      id(
        item.menuId,
      ),

    menuItemId:
      id(
        item.menuItemId,
      ),

    outletId:
      id(
        item.outletId,
      ),

    productionRecipeVersionId:
      id(
        item.productionRecipeVersionId,
      ),

    sourceRecipeVersionId:
      id(
        item.sourceRecipeVersionId,
      ),

    status:
      item.status,

    note:
      item.note ||
      '',

    observedAt:
      item.observedAt ||
      null,

    source:
      'recorded',
  }
}

async function loadLatestMenuAvailabilityMap({
  organizationId,
  menuItemIds,
}) {
  const uniqueIds = [
    ...new Set(
      (
        menuItemIds ||
        []
      )
        .map(id)
        .filter(Boolean),
    ),
  ]

  if (
    uniqueIds.length ===
    0
  ) {
    return new Map()
  }

  const records =
    await HospitalityMenuAvailability.find({
      organizationId,

      menuItemId: {
        $in:
          uniqueIds,
      },
    })
      .sort({
        observedAt:
          -1,

        createdAt:
          -1,
      })
      .lean()

  const latestByMenuItemId =
    new Map()

  for (
    const record of
    records
  ) {
    const menuItemId =
      id(
        record.menuItemId,
      )

    if (
      menuItemId &&
      !latestByMenuItemId.has(
        menuItemId,
      )
    ) {
      latestByMenuItemId.set(
        menuItemId,
        serializeMenuAvailability(
          record,
        ),
      )
    }
  }

  return latestByMenuItemId
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
| Host-safe Catalog Ingredient Lookup
|--------------------------------------------------------------------------
*/

export async function searchHospitalityCanonicalIngredients({
  search,
  limit = 10,
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
      'hospitality.suppliers.read',
      'hospitality.suppliers.manage',
      'hospitality.recipes.read',
      'hospitality.recipes.manage',
    ],
  )

  const normalizedSearch =
    String(
      search ||
        '',
    ).trim()

  if (
    normalizedSearch.length <
    2
  ) {
    return {
      ingredients: [],
    }
  }

  const safeLimit =
    Math.min(
      20,
      Math.max(
        1,
        Number(limit) ||
          10,
      ),
    )

  const escaped =
    normalizedSearch.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    )

  const expression =
    new RegExp(
      escaped,
      'i',
    )

  const ingredients =
    await CanonicalIngredient.find({
      status:
        'active',

      $or: [
        {
          canonicalName:
            expression,
        },
        {
          aliases:
            expression,
        },
        {
          slug:
            expression,
        },
      ],
    })
      .sort({
        canonicalName:
          1,
      })
      .limit(
        safeLimit,
      )
      .select(
        '_id canonicalName slug aliases attributes',
      )
      .lean()

  return {
    ingredients:
      ingredients.map(
        (ingredient) => ({
          id:
            id(
              ingredient._id,
            ),

          canonicalName:
            ingredient.canonicalName,

          slug:
            ingredient.slug,

          aliases:
            ingredient.aliases ||
            [],

          attributes:
            ingredient.attributes ||
            {},
        }),
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

function internalHospitalityDishSlug(
  productionRecipe,
) {
  const organizationKey =
    id(
      productionRecipe.organizationId,
    )
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      ) ||
    'organization'

  const recipeKey =
    String(
      productionRecipe.recipeKey ||
        productionRecipe.title ||
        'recipe',
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      ) ||
    'recipe'

  return [
    'hospitality',
    organizationKey,
    recipeKey,
  ]
    .join('-')
    .slice(
      0,
      220,
    )
}

async function ensureInternalHospitalityFoodIntelligence({
  productionRecipe,
  sourceRecipeVersionId,
}) {
  if (
    !productionRecipe ||
    !sourceRecipeVersionId
  ) {
    return {
      created:
        false,
    }
  }

  const sourceRecipe =
    await RecipeVersion.findOne({
      _id:
        sourceRecipeVersionId,

      status:
        'published',
    })
      .select(
        '_id sourceType sourceName',
      )
      .lean()

  if (!sourceRecipe) {
    return {
      created:
        false,
    }
  }

  const expectedSourceName =
    `Hospitality:${id(
      productionRecipe._id,
    )}`

  const isInternalHospitalityLineage =
    sourceRecipe.sourceType ===
      'internal' &&
    sourceRecipe.sourceName ===
      expectedSourceName

  if (
    !isInternalHospitalityLineage
  ) {
    return {
      created:
        false,
    }
  }

  const existingApproved =
    await FoodCalculation.findOne({
      entityType:
        'recipe_version',

      entityId:
        sourceRecipe._id,

      status:
        'approved',
    })
      .sort({
        calculationVersion:
          -1,
      })
      .select(
        '_id calculationVersion',
      )
      .lean()

  if (existingApproved) {
    return {
      created:
        false,

      foodCalculationId:
        id(
          existingApproved._id,
        ),
    }
  }

  const approvedByUserId =
    productionRecipe.approvedByUserId

  if (!approvedByUserId) {
    throw new ApiError(
      409,
      'This kitchen recipe needs its Super Admin approval record before a dish record can be created.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_APPROVAL_RECORD_REQUIRED',
        },
      ],
    )
  }

  const declaration =
    await declareRecipeFoodIntelligence(
      sourceRecipe._id,
      {
        jurisdictionCode:
          'IN',

        nutrition:
          [],

        allergens:
          [],

        dietaryClassification:
          'not_declared',

        basis:
          'Super Admin-approved Hospitality kitchen recipe formulation. This internal record declares no nutrition, allergen, or dietary claims.',

        reason:
          'Created automatically for the internal EPANTRY lineage of a Super Admin-approved Hospitality kitchen recipe so its Dish Record can retain governed Food Intelligence lineage without requiring duplicate Host data entry.',
      },
      {
        _id:
          approvedByUserId,
      },
    )

  return {
    created:
      true,

    foodCalculationId:
      id(
        declaration?.calculation?._id ||
          declaration?.calculation?.id,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Approved Kitchen Recipe -> internal EPANTRY Recipe lineage
|--------------------------------------------------------------------------
|
| A Host Kitchen Recipe may intentionally be created without selecting an
| existing EPANTRY Dish/Recipe. Once that Kitchen Recipe has already been
| approved by the root Super Admin, Dish Records still need stable M07/M08
| lineage. This helper materializes only the missing M07 lineage from that
| already-approved formulation.
|
| The generated Dish is disabled so it is not exposed as a public customer
| Recipe listing. The Recipe Version is published only as governed internal
| lineage and keeps the exact per-serving ingredient formulation required by
| the approved Hospitality Production Recipe.
|--------------------------------------------------------------------------
*/
export async function ensureHospitalityProductionRecipePublishedLineage({
  productionRecipeVersionId,
}) {
  const existingRecipe =
    await HospitalityProductionRecipeVersion.findById(
      productionRecipeVersionId,
    ).lean()

  if (!existingRecipe) {
    throw new ApiError(
      404,
      'Kitchen recipe was not found.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  if (
    existingRecipe.status !==
    'approved'
  ) {
    throw new ApiError(
      409,
      'The kitchen recipe must be approved by Super Admin before a dish record can be created.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_APPROVED_PRODUCTION_RECIPE_REQUIRED',
        },
      ],
    )
  }

  if (
    existingRecipe.sourceRecipeVersionId
  ) {
    const linkedRecipe =
      await RecipeVersion.findOne({
        _id:
          existingRecipe.sourceRecipeVersionId,

        status:
          'published',
      }).lean()

    if (linkedRecipe) {
      if (
        existingRecipe.dishId &&
        id(
          linkedRecipe.dishId,
        ) !==
          id(
            existingRecipe.dishId,
          )
      ) {
        throw new ApiError(
          409,
          'The linked EPANTRY dish and recipe do not match. Ask a Super Admin to review this kitchen recipe link.',
          [
            {
              code:
                'HOSPITALITY_SOURCE_RECIPE_DISH_MISMATCH',
            },
          ],
        )
      }

      if (
        !existingRecipe.dishId
      ) {
        await HospitalityProductionRecipeVersion.updateOne(
          {
            _id:
              existingRecipe._id,
          },
          {
            $set: {
              dishId:
                linkedRecipe.dishId,
            },
          },
        )
      }

      await ensureInternalHospitalityFoodIntelligence({
        productionRecipe:
          existingRecipe,

        sourceRecipeVersionId:
          linkedRecipe._id,
      })

      return {
        dishId:
          id(
            linkedRecipe.dishId,
          ),

        sourceRecipeVersionId:
          id(
            linkedRecipe._id,
          ),

        created:
          false,
      }
    }
  }

  if (
    existingRecipe.dishId
  ) {
    const linkedRecipe =
      await RecipeVersion.findOne({
        dishId:
          existingRecipe.dishId,

        status:
          'published',
      })
        .sort({
          versionNumber:
            -1,
        })
        .lean()

    if (linkedRecipe) {
      await HospitalityProductionRecipeVersion.updateOne(
        {
          _id:
            existingRecipe._id,
        },
        {
          $set: {
            sourceRecipeVersionId:
              linkedRecipe._id,
          },
        },
      )

      await ensureInternalHospitalityFoodIntelligence({
        productionRecipe:
          existingRecipe,

        sourceRecipeVersionId:
          linkedRecipe._id,
      })

      return {
        dishId:
          id(
            existingRecipe.dishId,
          ),

        sourceRecipeVersionId:
          id(
            linkedRecipe._id,
          ),

        created:
          false,
      }
    }

    throw new ApiError(
      409,
      'The EPANTRY dish linked to this kitchen recipe does not have a published recipe yet. Ask a Super Admin to publish that recipe, then try again.',
      [
        {
          code:
            'HOSPITALITY_SOURCE_RECIPE_PUBLICATION_REQUIRED',
        },
      ],
    )
  }

  if (
    !existingRecipe.approvedByUserId
  ) {
    throw new ApiError(
      409,
      'This kitchen recipe does not contain its Super Admin approval record yet. Ask a Super Admin to review it again before creating the dish record.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_APPROVAL_RECORD_REQUIRED',
        },
      ],
    )
  }

  const ingredientLines =
    await HospitalityProductionRecipeIngredient.find({
      organizationId:
        existingRecipe.organizationId,

      productionRecipeVersionId:
        existingRecipe._id,
    })
      .sort({
        lineNumber:
          1,
      })
      .lean()

  if (
    ingredientLines.length ===
    0
  ) {
    throw new ApiError(
      409,
      'Add at least one ingredient to this kitchen recipe before creating a dish record.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_INGREDIENTS_REQUIRED',
        },
      ],
    )
  }

  const productionBaseYield =
    Number(
      existingRecipe.baseYieldPortions,
    )

  if (
    !Number.isFinite(
      productionBaseYield,
    ) ||
    productionBaseYield <=
      0
  ) {
    throw new ApiError(
      409,
      'The kitchen recipe has an invalid batch portion count. Correct the recipe before creating a dish record.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_BASE_YIELD_INVALID',
        },
      ],
    )
  }

  const canonicalBaseServings =
    Math.min(
      productionBaseYield,
      1000,
    )

  const quantityScale =
    canonicalBaseServings /
    productionBaseYield

  const lineageSourceName =
    `Hospitality:${id(
      existingRecipe._id,
    )}`

  const dishSlug =
    internalHospitalityDishSlug(
      existingRecipe,
    )

  const session =
    await mongoose.startSession()

  let dishId =
    null

  let sourceRecipeVersionId =
    null

  let created =
    false

  try {
    await session.withTransaction(
      async () => {
        const recipe =
          await HospitalityProductionRecipeVersion.findOne({
            _id:
              existingRecipe._id,

            status:
              'approved',
          }).session(
            session,
          )

        if (!recipe) {
          throw new ApiError(
            409,
            'The kitchen recipe is no longer approved. Refresh the page and try again.',
            [
              {
                code:
                  'HOSPITALITY_PASSPORT_APPROVED_PRODUCTION_RECIPE_REQUIRED',
              },
            ],
          )
        }

        if (
          recipe.sourceRecipeVersionId
        ) {
          const alreadyLinked =
            await RecipeVersion.findOne({
              _id:
                recipe.sourceRecipeVersionId,

              status:
                'published',
            })
              .session(
                session,
              )
              .lean()

          if (alreadyLinked) {
            dishId =
              alreadyLinked.dishId

            sourceRecipeVersionId =
              alreadyLinked._id

            if (
              !recipe.dishId
            ) {
              recipe.dishId =
                alreadyLinked.dishId

              await recipe.save({
                session,
              })
            }

            return
          }
        }

        let dish =
          await Dish.findOne({
            slug:
              dishSlug,
          }).session(
            session,
          )

        if (!dish) {
          const [
            createdDish,
          ] =
            await Dish.create(
              [
                {
                  name:
                    recipe.title,

                  slug:
                    dishSlug,

                  description:
                    `Internal EPANTRY lineage for the approved Hospitality kitchen recipe "${recipe.title}".`,

                  tags: [
                    'hospitality-internal',
                  ],

                  status:
                    'disabled',

                  nextRecipeVersionNumber:
                    2,

                  createdByUserId:
                    recipe.approvedByUserId,

                  disabledAt:
                    recipe.approvedAt ||
                    new Date(),

                  disabledByUserId:
                    recipe.approvedByUserId,

                  disabledReason:
                    'Internal Hospitality lineage record. This Dish is not a public customer recipe listing.',
                },
              ],
              {
                session,
              },
            )

          dish =
            createdDish
        }

        let sourceRecipe =
          await RecipeVersion.findOne({
            dishId:
              dish._id,

            sourceOrganizationId:
              recipe.organizationId,

            sourceName:
              lineageSourceName,

            status:
              'published',
          }).session(
            session,
          )

        if (!sourceRecipe) {
          const latestVersion =
            await RecipeVersion.findOne({
              dishId:
                dish._id,
            })
              .sort({
                versionNumber:
                  -1,
              })
              .select(
                'versionNumber',
              )
              .session(
                session,
              )
              .lean()

          const versionNumber =
            Number(
              latestVersion?.versionNumber ||
                0,
            ) +
            1

          const approvedAt =
            recipe.approvedAt ||
            new Date()

          const [
            createdRecipe,
          ] =
            await RecipeVersion.create(
              [
                {
                  dishId:
                    dish._id,

                  versionNumber,

                  title:
                    recipe.title,

                  description:
                    'Internal governed recipe lineage generated from a Super Admin-approved Hospitality kitchen recipe.',

                  baseServings:
                    canonicalBaseServings,

                  scalingMethod:
                    'linear',

                  preparationTimeMinutes:
                    0,

                  cookingTimeMinutes:
                    0,

                  difficulty:
                    'easy',

                  sourceType:
                    'internal',

                  sourceName:
                    lineageSourceName,

                  sourceOrganizationId:
                    recipe.organizationId,

                  status:
                    'published',

                  changeReason:
                    'Internal lineage generated from an approved Hospitality kitchen recipe.',

                  unsafeIncomplete:
                    true,

                  unsafeIncompleteReason:
                    'This internal lineage mirrors the approved Hospitality ingredient formulation and intentionally does not create a public preparation recipe.',

                  effectiveFrom:
                    approvedAt,

                  createdByUserId:
                    recipe.approvedByUserId,

                  submittedAt:
                    recipe.submittedAt ||
                    approvedAt,

                  submittedByUserId:
                    recipe.submittedByUserId ||
                    recipe.createdByUserId,

                  reviewedAt:
                    approvedAt,

                  reviewedByUserId:
                    recipe.approvedByUserId,

                  publishedAt:
                    approvedAt,

                  publishedByUserId:
                    recipe.approvedByUserId,
                },
              ],
              {
                session,
              },
            )

          sourceRecipe =
            createdRecipe

          await RecipeIngredient.create(
            ingredientLines.map(
              (
                ingredient,
              ) => ({
                recipeVersionId:
                  sourceRecipe._id,

                lineNumber:
                  ingredient.lineNumber,

                canonicalIngredientId:
                  ingredient.canonicalIngredientId,

                quantity:
                  Number(
                    ingredient.quantity,
                  ) *
                  quantityScale,

                unit:
                  ingredient.unit,

                preparationState:
                  '',

                optional:
                  ingredient.optional ===
                  true,

                role:
                  'main',

                notes:
                  ingredient.notes ||
                  '',
              }),
            ),
            {
              session,
            },
          )

          dish.nextRecipeVersionNumber =
            versionNumber +
            1

          await dish.save({
            session,
          })

          created =
            true
        }

        recipe.dishId =
          dish._id

        recipe.sourceRecipeVersionId =
          sourceRecipe._id

        await recipe.save({
          session,
        })

        dishId =
          dish._id

        sourceRecipeVersionId =
          sourceRecipe._id
      },
    )
  } finally {
    await session.endSession()
  }

  await ensureInternalHospitalityFoodIntelligence({
    productionRecipe:
      existingRecipe,

    sourceRecipeVersionId,
  })

  return {
    dishId:
      id(
        dishId,
      ),

    sourceRecipeVersionId:
      id(
        sourceRecipeVersionId,
      ),

    created,
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
  | Optional restaurant listing outlet
  |--------------------------------------------------------------------------
  */

  if (
    input.listingOutletId
  ) {
    const listingOutlet =
      await HospitalityOutlet.findOne({
        _id:
          input.listingOutletId,

        organizationId:
          context.organization._id,

        status:
          'active',
      })
        .select(
          '_id',
        )
        .lean()

    if (!listingOutlet) {
      throw new ApiError(
        404,
        'The selected restaurant outlet was not found for this Host organization.',
        [
          {
            code:
              'HOSPITALITY_RECIPE_LISTING_OUTLET_NOT_FOUND',
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

                recipeFoundationMode:
                  input.sourceRecipeVersionId
                    ? 'core_recipe_linked'
                    : 'legacy_hospitality',

                listingOutletId:
                  input.listingOutletId,

                customerVisibility:
                  input.customerVisibility,

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

  await notifyActiveSuperAdminsBestEffort({
    triggerType:
      'hospitality_approval_requested',
    reasonCode:
      'hospitality_production_recipe_submitted',
    explanation: `${context.organization?.displayName || 'Host'} submitted the kitchen recipe ${recipe.title || recipe.recipeKey || 'Kitchen recipe'} for Super Admin approval.`,
    relatedEntityType:
      'hospitality_production_recipe',
    relatedEntityId:
      id(
        recipe._id,
      ),
    sourceDomain:
      'hospitality',
    sourceVersion:
      'hospitality-production-recipe-v1',
    dedupeScope: `hospitality-production-recipe-submitted:${id(recipe._id)}`,
  })

  return getHospitalityProductionRecipe({
    productionRecipeVersionId:
      recipe._id,

    actorUser,

    organizationIdHint:
      context.organization._id,
  })
}

function buildM7HospitalityReleaseGate({
  verification,
}) {
  const dataParityReady =
    verification?.releaseReady ===
    true

  return {
    stage:
      'm7_final_release_gate',

    dataParityReady,

    fullArchitectureRegression: {
      required:
        true,

      command:
        'node --test tests/m7-architecture-release.test.js',

      status:
        'must_pass_before_duplicate_authoring_retirement',
    },

    duplicateAuthoringRetirement: {
      state:
        dataParityReady
          ? 'awaiting_final_regression'
          : 'blocked_by_data_parity',

      keepLegacyPathVisible:
        true,

      canRetireAfterFinalRegression:
        dataParityReady,

      reason:
        dataParityReady
          ? 'Hospitality recipe data parity is verified. Keep the legacy authoring path visible until the final M7 architecture regression passes in the release environment.'
          : 'Hospitality recipe data parity is not complete. Keep the legacy authoring path visible and readable until every migration parity check passes.',
    },

    rule:
      'M7 does not automatically hide or delete the legacy Hospitality recipe authoring path. Retirement requires both verified data parity and a passing final architecture regression.',
  }
}

async function buildHospitalityRecipeMigrationAudit() {
  const recipes =
    await HospitalityProductionRecipeVersion.find({})
      .select(
        '_id organizationId recipeKey versionNumber dishId sourceRecipeVersionId recipeFoundationMode listingOutletId customerVisibility title status',
      )
      .sort({
        createdAt:
          1,

        _id:
          1,
      })
      .lean()

  if (
    recipes.length ===
    0
  ) {
    const verification = {
      mode:
        'dry_run',
      writesPerformed:
        false,
      projectedRecordCounts: {
        beforeProductionRecipeRecords:
          0,
        afterProductionRecipeRecords:
          0,
        beforeOperationalReferences:
          0,
        afterOperationalReferences:
          0,
        deletedRecords:
          0,
        rewrittenHistoricalRecords:
          0,
      },
      checks: {
        noBrokenRecipeLinks:
          true,
        allHospitalityRecipesMapped:
          true,
        linkedIngredientParity:
          true,
        downstreamReferenceParity:
          true,
        legacyRecordsPreserved:
          true,
      },
      releaseReady:
        true,
    }

    return {
      summary: {
        totalProductionRecipes:
          0,

        coreLinked:
          0,

        legacyUnlinked:
          0,

        legacyInternalBridge:
          0,

        brokenLinks:
          0,

        ingredientParityGaps:
          0,

        dependencyParityGaps:
          0,

        recipesWithOperationalReferences:
          0,

        totalOperationalReferences:
          0,
      },

      records:
        [],

      verification,

      releaseGate:
        buildM7HospitalityReleaseGate({
          verification,
        }),

      migrationRule:
        'M5 keeps every existing Hospitality Production Recipe readable. M7 dry-run verification is read-only and no Hospitality recipe record is deleted or rewritten.',
    }
  }

  const recipeIds =
    recipes.map(
      (recipe) =>
        recipe._id,
    )

  const linkedRecipeIds = [
    ...new Set(
      recipes
        .map(
          (recipe) =>
            id(
              recipe.sourceRecipeVersionId,
            ),
        )
        .filter(Boolean),
    ),
  ]

  const organizationIds = [
    ...new Set(
      recipes
        .map(
          (recipe) =>
            id(
              recipe.organizationId,
            ),
        )
        .filter(Boolean),
    ),
  ]

  const [
    linkedRecipes,
    organizations,
    hospitalityIngredientCounts,
    coreIngredientCounts,
    menuItemCounts,
    productionPlanCounts,
    recipeCostCounts,
    passportCounts,
  ] =
    await Promise.all([
      linkedRecipeIds.length
        ? RecipeVersion.find({
            _id: {
              $in:
                linkedRecipeIds,
            },
          })
            .select(
              '_id dishId status sourceType sourceName sourceOrganizationId sourceOutletId visibility unsafeIncomplete',
            )
            .lean()
        : [],

      organizationIds.length
        ? MarketplaceOrganization.find({
            _id: {
              $in:
                organizationIds,
            },
          })
            .select(
              '_id displayName slug',
            )
            .lean()
        : [],

      HospitalityProductionRecipeIngredient.aggregate([
        {
          $match: {
            productionRecipeVersionId: {
              $in:
                recipeIds,
            },
          },
        },
        {
          $group: {
            _id:
              '$productionRecipeVersionId',

            count: {
              $sum:
                1,
            },
          },
        },
      ]),

      linkedRecipeIds.length
        ? RecipeIngredient.aggregate([
            {
              $match: {
                recipeVersionId: {
                  $in:
                    linkedRecipeIds.map(
                      (value) =>
                        new mongoose.Types.ObjectId(
                          value,
                        ),
                    ),
                },
              },
            },
            {
              $group: {
                _id:
                  '$recipeVersionId',

                count: {
                  $sum:
                    1,
                },
              },
            },
          ])
        : [],

      HospitalityMenuItem.aggregate([
        {
          $match: {
            productionRecipeVersionId: {
              $in:
                recipeIds,
            },
          },
        },
        {
          $group: {
            _id:
              '$productionRecipeVersionId',

            count: {
              $sum:
                1,
            },

            missingSourceCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $ifNull: [
                          '$sourceRecipeVersionId',
                          null,
                        ],
                      },
                      null,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            sourceRecipeVersionIds: {
              $addToSet:
                '$sourceRecipeVersionId',
            },
          },
        },
      ]),

      HospitalityProductionPlan.aggregate([
        {
          $unwind:
            '$items',
        },
        {
          $match: {
            'items.productionRecipeVersionId': {
              $in:
                recipeIds,
            },
          },
        },
        {
          $group: {
            _id:
              '$items.productionRecipeVersionId',

            count: {
              $sum:
                1,
            },

            missingSourceCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $ifNull: [
                          '$items.sourceRecipeVersionId',
                          null,
                        ],
                      },
                      null,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            sourceRecipeVersionIds: {
              $addToSet:
                '$items.sourceRecipeVersionId',
            },
          },
        },
      ]),

      HospitalityRecipeCost.aggregate([
        {
          $match: {
            productionRecipeVersionId: {
              $in:
                recipeIds,
            },
          },
        },
        {
          $group: {
            _id:
              '$productionRecipeVersionId',

            count: {
              $sum:
                1,
            },

            missingSourceCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $ifNull: [
                          '$sourceRecipeVersionId',
                          null,
                        ],
                      },
                      null,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            sourceRecipeVersionIds: {
              $addToSet:
                '$sourceRecipeVersionId',
            },
          },
        },
      ]),

      DishPassportSnapshot.aggregate([
        {
          $match: {
            productionRecipeVersionId: {
              $in:
                recipeIds,
            },
          },
        },
        {
          $group: {
            _id:
              '$productionRecipeVersionId',

            count: {
              $sum:
                1,
            },

            missingSourceCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $ifNull: [
                          '$sourceRecipeVersionId',
                          null,
                        ],
                      },
                      null,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            sourceRecipeVersionIds: {
              $addToSet:
                '$sourceRecipeVersionId',
            },
          },
        },
      ]),
    ])

  function countMap(
    rows,
  ) {
    return new Map(
      rows.map(
        (row) => [
          id(
            row._id,
          ),
          Number(
            row.count ||
              0,
          ),
        ],
      ),
    )
  }

  function referenceMap(
    rows,
  ) {
    return new Map(
      rows.map(
        (row) => [
          id(
            row._id,
          ),
          {
            count:
              Number(
                row.count ||
                  0,
              ),

            missingSourceCount:
              Number(
                row.missingSourceCount ||
                  0,
              ),

            sourceRecipeVersionIds: [
              ...new Set(
                (row.sourceRecipeVersionIds || [])
                  .map(
                    (value) =>
                      id(
                        value,
                      ),
                  )
                  .filter(Boolean),
              ),
            ],
          },
        ],
      ),
    )
  }

  const sourceRecipeById =
    new Map(
      linkedRecipes.map(
        (recipe) => [
          id(
            recipe._id,
          ),
          recipe,
        ],
      ),
    )

  const organizationById =
    new Map(
      organizations.map(
        (organization) => [
          id(
            organization._id,
          ),
          organization,
        ],
      ),
    )

  const hospitalityIngredientsByRecipe =
    countMap(
      hospitalityIngredientCounts,
    )

  const coreIngredientsByRecipe =
    countMap(
      coreIngredientCounts,
    )

  const menuItemsByRecipe =
    referenceMap(
      menuItemCounts,
    )

  const productionPlansByRecipe =
    referenceMap(
      productionPlanCounts,
    )

  const recipeCostsByRecipe =
    referenceMap(
      recipeCostCounts,
    )

  const passportsByRecipe =
    referenceMap(
      passportCounts,
    )

  const records =
    recipes.map(
      (recipe) => {
        const recipeId =
          id(
            recipe._id,
          )

        const sourceRecipeId =
          id(
            recipe.sourceRecipeVersionId,
          )

        const sourceRecipe =
          sourceRecipeId
            ? sourceRecipeById.get(
                sourceRecipeId,
              ) ||
              null
            : null

        const legacyInternalBridge =
          sourceRecipe?.sourceType ===
            'internal' &&
          sourceRecipe?.sourceName ===
            `Hospitality:${recipeId}`

        let linkState =
          'legacy_unlinked'

        if (
          sourceRecipeId &&
          !sourceRecipe
        ) {
          linkState =
            'broken_link'
        } else if (
          legacyInternalBridge
        ) {
          linkState =
            'legacy_internal_bridge'
        } else if (
          sourceRecipe
        ) {
          linkState =
            'core_linked'
        }

        const menuItemReferences =
          menuItemsByRecipe.get(
            recipeId,
          ) || {
            count:
              0,
            missingSourceCount:
              0,
            sourceRecipeVersionIds:
              [],
          }

        const productionPlanReferences =
          productionPlansByRecipe.get(
            recipeId,
          ) || {
            count:
              0,
            missingSourceCount:
              0,
            sourceRecipeVersionIds:
              [],
          }

        const recipeCostReferences =
          recipeCostsByRecipe.get(
            recipeId,
          ) || {
            count:
              0,
            missingSourceCount:
              0,
            sourceRecipeVersionIds:
              [],
          }

        const passportReferences =
          passportsByRecipe.get(
            recipeId,
          ) || {
            count:
              0,
            missingSourceCount:
              0,
            sourceRecipeVersionIds:
              [],
          }

        const dependencyCounts = {
          menuItems:
            menuItemReferences.count,

          productionPlanItems:
            productionPlanReferences.count,

          costSnapshots:
            recipeCostReferences.count,

          dishRecords:
            passportReferences.count,
        }

        function canonicalReferenceState(
          reference,
        ) {
          if (!sourceRecipeId) {
            return {
              expectedSourceRecipeVersionId:
                null,
              total:
                reference.count,
              missingSourceCount:
                reference.missingSourceCount,
              observedSourceRecipeVersionIds:
                reference.sourceRecipeVersionIds,
              complete:
                null,
            }
          }

          const unexpectedSourceIds =
            reference.sourceRecipeVersionIds.filter(
              (value) =>
                value !==
                sourceRecipeId,
            )

          return {
            expectedSourceRecipeVersionId:
              sourceRecipeId,
            total:
              reference.count,
            missingSourceCount:
              reference.missingSourceCount,
            observedSourceRecipeVersionIds:
              reference.sourceRecipeVersionIds,
            complete:
              reference.missingSourceCount ===
                0 &&
              unexpectedSourceIds.length ===
                0,
          }
        }

        const canonicalDependencyCoverage = {
          menuItems:
            canonicalReferenceState(
              menuItemReferences,
            ),
          productionPlanItems:
            canonicalReferenceState(
              productionPlanReferences,
            ),
          costSnapshots:
            canonicalReferenceState(
              recipeCostReferences,
            ),
          dishRecords:
            canonicalReferenceState(
              passportReferences,
            ),
        }

        const canonicalDependencyParity =
          sourceRecipeId
            ? Object.values(
                canonicalDependencyCoverage,
              ).every(
                (entry) =>
                  entry.complete ===
                  true,
              )
            : null

        const totalOperationalReferences =
          Object.values(
            dependencyCounts,
          ).reduce(
            (
              total,
              value,
            ) =>
              total +
              Number(
                value ||
                  0,
              ),
            0,
          )

        const hospitalityIngredientCount =
          hospitalityIngredientsByRecipe.get(
            recipeId,
          ) ||
          0

        const coreIngredientCount =
          sourceRecipeId
            ? coreIngredientsByRecipe.get(
                sourceRecipeId,
              ) ||
              0
            : 0

        const organization =
          organizationById.get(
            id(
              recipe.organizationId,
            ),
          ) ||
          null

        return {
          productionRecipeVersionId:
            recipeId,

          organizationId:
            id(
              recipe.organizationId,
            ),

          organizationName:
            organization?.displayName ||
            'Hospitality business',

          title:
            recipe.title,

          recipeKey:
            recipe.recipeKey,

          versionNumber:
            recipe.versionNumber,

          status:
            recipe.status,

          recipeFoundationMode:
            recipe.recipeFoundationMode ||
            (linkState ===
            'core_linked'
              ? 'core_recipe_linked'
              : 'legacy_hospitality'),

          listingOutletId:
            id(
              recipe.listingOutletId,
            ),

          customerVisibility:
            recipe.customerVisibility ||
            'organization_only',

          dishId:
            id(
              recipe.dishId,
            ),

          sourceRecipeVersionId:
            sourceRecipeId,

          sourceRecipeStatus:
            sourceRecipe?.status ||
            null,

          sourceRecipeType:
            sourceRecipe?.sourceType ||
            null,

          sourceRecipeVisibility:
            sourceRecipe?.visibility ||
            'public',

          linkState,

          hospitalityIngredientCount,

          coreIngredientCount,

          ingredientCountMatches:
            sourceRecipe
              ? hospitalityIngredientCount ===
                coreIngredientCount
              : null,

          dependencyCounts,

          canonicalDependencyCoverage,

          canonicalDependencyParity,

          totalOperationalReferences,

          protectedByMigration:
            totalOperationalReferences >
            0,
        }
      },
    )

  const summary = {
    totalProductionRecipes:
      records.length,

    coreLinked:
      records.filter(
        (record) =>
          record.linkState ===
          'core_linked',
      ).length,

    legacyUnlinked:
      records.filter(
        (record) =>
          record.linkState ===
          'legacy_unlinked',
      ).length,

    legacyInternalBridge:
      records.filter(
        (record) =>
          record.linkState ===
          'legacy_internal_bridge',
      ).length,

    brokenLinks:
      records.filter(
        (record) =>
          record.linkState ===
          'broken_link',
      ).length,

    ingredientParityGaps:
      records.filter(
        (record) =>
          record.sourceRecipeVersionId &&
          record.ingredientCountMatches ===
            false,
      ).length,

    dependencyParityGaps:
      records.filter(
        (record) =>
          record.sourceRecipeVersionId &&
          record.canonicalDependencyParity ===
            false,
      ).length,

    recipesWithOperationalReferences:
      records.filter(
        (record) =>
          record.totalOperationalReferences >
          0,
      ).length,

    totalOperationalReferences:
      records.reduce(
        (
          total,
          record,
        ) =>
          total +
          record.totalOperationalReferences,
        0,
      ),
  }

  const verification = {
    mode:
      'dry_run',

    writesPerformed:
      false,

    projectedRecordCounts: {
      beforeProductionRecipeRecords:
        summary.totalProductionRecipes,
      afterProductionRecipeRecords:
        summary.totalProductionRecipes,
      beforeOperationalReferences:
        summary.totalOperationalReferences,
      afterOperationalReferences:
        summary.totalOperationalReferences,
      deletedRecords:
        0,
      rewrittenHistoricalRecords:
        0,
    },

    checks: {
      noBrokenRecipeLinks:
        summary.brokenLinks ===
        0,
      allHospitalityRecipesMapped:
        summary.legacyUnlinked ===
        0,
      linkedIngredientParity:
        summary.ingredientParityGaps ===
        0,
      downstreamReferenceParity:
        summary.dependencyParityGaps ===
        0,
      legacyRecordsPreserved:
        true,
    },
  }

  verification.releaseReady =
    Object.values(
      verification.checks,
    ).every(Boolean)

  return {
    summary,

    records,

    verification,

    releaseGate:
      buildM7HospitalityReleaseGate({
        verification,
      }),

    migrationRule:
      'M5 keeps every existing Hospitality Production Recipe readable. M7 dry-run verification is read-only: existing Hospitality recipe records and Menu, Production Plan, Costing and Dish Record references remain readable while canonical RecipeVersion linkage is checked before any duplicate path can be retired.',
  }
}

export async function listAdminHospitalityProductionRecipeApprovals({
  actorUser,
}) {
  rootSuperAdminActorId(
    actorUser,
  )

  const recipes =
    await HospitalityProductionRecipeVersion.find({
      status:
        'in_review',
    })
      .sort({
        submittedAt:
          1,

        createdAt:
          1,
      })
      .lean()

  const organizationIds =
    [
      ...new Set(
        recipes
          .map(
            (recipe) =>
              id(
                recipe.organizationId,
              ),
          )
          .filter(Boolean),
      ),
    ]

  const organizations =
    organizationIds.length
      ? await MarketplaceOrganization.find({
          _id: {
            $in:
              organizationIds,
          },
        })
          .select(
            'displayName slug organizationType status ownerUserId',
          )
          .lean()
      : []

  const organizationById =
    new Map(
      organizations.map(
        (organization) => [
          id(
            organization._id,
          ),
          organization,
        ],
      ),
    )

  const ownerUserIds =
    [
      ...new Set(
        organizations
          .map(
            (organization) =>
              id(
                organization.ownerUserId,
              ),
          )
          .filter(Boolean),
      ),
    ]

  const ownerUsers =
    ownerUserIds.length
      ? await User.find({
          _id: {
            $in:
              ownerUserIds,
          },
        })
          .select(
            'name email hostWorkspaceType hostAccessStatus',
          )
          .lean()
      : []

  const ownerUserById =
    new Map(
      ownerUsers.map(
        (user) => [
          id(
            user._id,
          ),
          user,
        ],
      ),
    )

  const migrationAudit =
    await buildHospitalityRecipeMigrationAudit()

  return {
    productionRecipes:
      recipes.map(
        (recipe) => {
          const organization =
            organizationById.get(
              id(
                recipe.organizationId,
              ),
            ) ||
            null

          return {
            ...serializeProductionRecipe(
              recipe,
            ),

            organizationName:
              organization?.displayName ||
              'Hospitality business',

            organizationSlug:
              organization?.slug ||
              '',

            organizationType:
              organization?.organizationType ||
              null,

            hostUser:
              (() => {
                const owner =
                  organization?.ownerUserId
                    ? ownerUserById.get(
                        id(
                          organization.ownerUserId,
                        ),
                      )
                    : null

                return owner
                  ? {
                      id:
                        id(
                          owner._id,
                        ),

                      name:
                        owner.name ||
                        '',

                      email:
                        owner.email ||
                        '',

                      hostWorkspaceType:
                        owner.hostWorkspaceType ||
                        null,

                      hostAccessStatus:
                        owner.hostAccessStatus ||
                        null,
                    }
                  : null
              })(),

            submittedByUserId:
              id(
                recipe.submittedByUserId,
              ),
          }
        },
      ),

    migrationAudit,
  }
}

export async function approveHospitalityProductionRecipeAsSuperAdmin({
  productionRecipeVersionId,
  input,
  actorUser,
}) {
  const approverUserId =
    rootSuperAdminActorId(
      actorUser,
    )

  const recipe =
    await HospitalityProductionRecipeVersion.findById(
      productionRecipeVersionId,
    )

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

  if (
    recipe.status !==
    'in_review'
  ) {
    throw new ApiError(
      409,
      'Production Recipe must be in review before Super Admin approval.',
      [
        {
          code:
            'HOSPITALITY_PRODUCTION_RECIPE_APPROVAL_STATE_INVALID',
        },
      ],
    )
  }

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
        'Linked EPANTRY Recipe Version must be published before the Hospitality recipe can be approved.',
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
    approverUserId

  recipe.changeReason =
    input.reason

  await recipe.save()

  const organization =
    await MarketplaceOrganization.findById(
      recipe.organizationId,
    )
      .select(
        'displayName slug',
      )
      .lean()

  return {
    productionRecipe: {
      ...serializeProductionRecipe(
        recipe,
      ),

      organizationName:
        organization?.displayName ||
        'Hospitality business',
    },

    approvalAuthority:
      'root_super_admin',
  }
}

export async function approveHospitalityProductionRecipe({
  productionRecipeVersionId,
  input,
  actorUser,
  organizationIdHint,
}) {
  void productionRecipeVersionId
  void input
  void actorUser
  void organizationIdHint

  throw new ApiError(
    403,
    'Kitchen recipe approval is reserved for Super Admin. Submit the recipe for review and wait for the Super Admin decision.',
    [
      {
        code:
          'HOSPITALITY_SUPER_ADMIN_APPROVAL_REQUIRED',
      },
    ],
  )
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

  const sourceRecipeVersionByProductionRecipeId =
    await loadOperationalRecipeLineageMap({
      organizationId:
        context.organization._id,

      productionRecipeVersionIds:
        items.map(
          (
            item,
          ) =>
            item.productionRecipeVersionId,
        ),
    })

  const availabilityByMenuItemId =
    await loadLatestMenuAvailabilityMap({
      organizationId:
        context.organization._id,

      menuItemIds:
        items.map(
          (
            item,
          ) =>
            item._id,
        ),
    })

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

            sourceRecipeVersionByProductionRecipeId,

            availabilityByMenuItemId,
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

export async function deleteHospitalityMenu({
  menuId,
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

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const deletedMenu =
          await HospitalityMenu.findOneAndDelete(
            {
              _id:
                menu._id,

              organizationId:
                context.organization._id,
            },
            {
              session,
            },
          )

        if (!deletedMenu) {
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

        await HospitalityMenuAvailability.deleteMany(
          {
            organizationId:
              context.organization._id,

            menuId:
              menu._id,
          },
          {
            session,
          },
        )

        await HospitalityMenuItem.deleteMany(
          {
            organizationId:
              context.organization._id,

            menuId:
              menu._id,
          },
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
    menu: {
      id:
        id(
          menu._id,
        ),

      menuCode:
        menu.menuCode,

      name:
        menu.name,
    },
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

  const productionRecipe =
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

        sourceRecipeVersionId:
          productionRecipe.sourceRecipeVersionId ||
          null,

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

        sourceRecipeVersionId:
          id(
            menuItem.sourceRecipeVersionId,
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

export async function setHospitalityMenuItemAvailability({
  menuId,
  menuItemId,
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
    }).lean()

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

  const menuItem =
    await HospitalityMenuItem.findOne({
      _id:
        menuItemId,

      organizationId:
        context.organization._id,

      menuId:
        menu._id,
    }).lean()

  if (!menuItem) {
    throw new ApiError(
      404,
      'Hospitality menu item was not found.',
      [
        {
          code:
            'HOSPITALITY_MENU_ITEM_NOT_FOUND',
        },
      ],
    )
  }

  const productionRecipe =
    await HospitalityProductionRecipeVersion.findOne({
      _id:
        menuItem.productionRecipeVersionId,

      organizationId:
        context.organization._id,
    })
      .select({
        sourceRecipeVersionId:
          1,
      })
      .lean()

  const availability =
    await HospitalityMenuAvailability.create({
      organizationId:
        context.organization._id,

      outletId:
        menu.outletId,

      menuId:
        menu._id,

      menuItemId:
        menuItem._id,

      productionRecipeVersionId:
        menuItem.productionRecipeVersionId,

      sourceRecipeVersionId:
        menuItem.sourceRecipeVersionId ||
        productionRecipe?.sourceRecipeVersionId ||
        null,

      status:
        input.status,

      note:
        input.note ||
        '',

      observedAt:
        input.observedAt ||
        new Date(),

      changedByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    availability:
      serializeMenuAvailability(
        availability,
      ),
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

      sourceRecipeVersionId:
        recipe.sourceRecipeVersionId ||
        null,

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

export async function listHospitalityCurrentStock({
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
      'hospitality.procurement.read',
      'hospitality.procurement.manage',
    ],
  )

  const match = {
    organizationId:
      context.organization._id,
  }

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    match.outletId = {
      $in:
        context.outletIds.map(
          (
            outletId,
          ) =>
            new mongoose.Types.ObjectId(
              outletId,
            ),
        ),
    }
  }

  const latest =
    await HospitalityStockObservation.aggregate([
      {
        $match:
          match,
      },
      {
        $sort: {
          observedAt:
            -1,

          createdAt:
            -1,
        },
      },
      {
        $group: {
          _id: {
            outletId:
              '$outletId',

            canonicalIngredientId:
              '$canonicalIngredientId',
          },

          observation: {
            $first:
              '$$ROOT',
          },
        },
      },
      {
        $replaceRoot: {
          newRoot:
            '$observation',
        },
      },
      {
        $sort: {
          observedAt:
            -1,
        },
      },
    ])

  const ingredientIds =
    latest
      .map(
        (
          observation,
        ) =>
          observation.canonicalIngredientId,
      )
      .filter(Boolean)

  const ingredients =
    ingredientIds.length
      ? await CanonicalIngredient.find({
          _id: {
            $in:
              ingredientIds,
          },
        })
          .select(
            '_id canonicalName slug',
          )
          .lean()
      : []

  const ingredientById =
    new Map(
      ingredients.map(
        (
          ingredient,
        ) => [
          id(
            ingredient._id,
          ),
          ingredient,
        ],
      ),
    )

  return {
    currentStock:
      latest.map(
        (
          observation,
        ) => {
          const ingredient =
            ingredientById.get(
              id(
                observation.canonicalIngredientId,
              ),
            )

          return {
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

            canonicalIngredientName:
              ingredient?.canonicalName ||
              'Ingredient',

            canonicalIngredientSlug:
              ingredient?.slug ||
              '',

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
          }
        },
      ),
  }
}

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

  const resolvedItems =
    []

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

    const sourceRecipeVersionId =
      id(
        recipe.sourceRecipeVersionId,
      )

    resolvedItems.push({
      productionRecipeVersionId:
        recipe._id,

      sourceRecipeVersionId:
        recipe.sourceRecipeVersionId ||
        null,

      portions:
        item.portions,
    })

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

            contributingSourceRecipeVersionIds:
              sourceRecipeVersionId
                ? [
                    sourceRecipeVersionId,
                  ]
                : [],
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

      if (
        sourceRecipeVersionId &&
        !existing.contributingSourceRecipeVersionIds.includes(
          sourceRecipeVersionId,
        )
      ) {
        existing.contributingSourceRecipeVersionIds.push(
          sourceRecipeVersionId,
        )
      }
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

        contributingRecipeVersionIds:
          requirement.contributingRecipeVersionIds ||
          [],

        contributingSourceRecipeVersionIds:
          requirement.contributingSourceRecipeVersionIds ||
          [],
      })
    }
  }

  return {
    items:
      resolvedItems,

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
        calculation.items,

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

  const sourceRecipeVersionByProductionRecipeId =
    await loadOperationalRecipeLineageMap({
      organizationId:
        context.organization._id,

      productionRecipeVersionIds:
        plans.flatMap(
          (
            plan,
          ) =>
            (
              plan.items ||
              []
            ).map(
              (
                item,
              ) =>
                item.productionRecipeVersionId,
            ),
        ),
    })

  return {
    productionPlans:
      plans.map(
        (
          plan,
        ) =>
          serializeProductionPlan(
            plan,
            sourceRecipeVersionByProductionRecipeId,
          ),
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
  | Canonical recipe lineage for procurement
  |--------------------------------------------------------------------------
  | New Production Plans persist canonical RecipeVersion IDs directly. Older
  | plans remain readable by resolving their Hospitality Production Recipe
  | overlays at runtime instead of rewriting historical records.
  |--------------------------------------------------------------------------
  */

  const sourceRecipeVersionByProductionRecipeId =
    await loadOperationalRecipeLineageMap({
      organizationId:
        context.organization._id,

      productionRecipeVersionIds:
        productionPlans.flatMap(
          (
            plan,
          ) =>
            (
              plan.items ||
              []
            ).map(
              (
                item,
              ) =>
                item.productionRecipeVersionId,
            ),
        ),
    })

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

      const matchingGrossRequirement =
        (
          plan.grossRequirements ||
          []
        ).find(
          (
            grossRequirement,
          ) =>
            id(
              grossRequirement.canonicalIngredientId,
            ) ===
            key,
        ) ||
        null

      const contributingProductionRecipeVersionIds =
        [
          ...new Set(
            (
              requirement.contributingRecipeVersionIds ||
              matchingGrossRequirement?.contributingRecipeVersionIds ||
              []
            )
              .map(id)
              .filter(Boolean),
          ),
        ]

      const contributingSourceRecipeVersionIds =
        [
          ...new Set(
            [
              ...(
                requirement.contributingSourceRecipeVersionIds ||
                matchingGrossRequirement?.contributingSourceRecipeVersionIds ||
                []
              ).map(id),

              ...contributingProductionRecipeVersionIds.map(
                (
                  productionRecipeVersionId,
                ) =>
                  sourceRecipeVersionByProductionRecipeId.get(
                    productionRecipeVersionId,
                  ) ||
                  null,
              ),
            ].filter(Boolean),
          ),
        ]

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

            sourceProductionRecipeVersionIds:
              contributingProductionRecipeVersionIds,

            sourceRecipeVersionIds:
              contributingSourceRecipeVersionIds,
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

      for (
        const productionRecipeVersionId of
        contributingProductionRecipeVersionIds
      ) {
        if (
          !existing.sourceProductionRecipeVersionIds.includes(
            productionRecipeVersionId,
          )
        ) {
          existing.sourceProductionRecipeVersionIds.push(
            productionRecipeVersionId,
          )
        }
      }

      for (
        const sourceRecipeVersionId of
        contributingSourceRecipeVersionIds
      ) {
        if (
          !existing.sourceRecipeVersionIds.includes(
            sourceRecipeVersionId,
          )
        ) {
          existing.sourceRecipeVersionIds.push(
            sourceRecipeVersionId,
          )
        }
      }
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

      sourceProductionRecipeVersionIds:
        requirement.sourceProductionRecipeVersionIds ||
        [],

      sourceRecipeVersionIds:
        requirement.sourceRecipeVersionIds ||
        [],

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
/*
|--------------------------------------------------------------------------
| M5-B Restaurant Recipe Listings
|--------------------------------------------------------------------------
|
| Restaurant recipes use the core Dish + RecipeVersion authoring model and
| keep HospitalityProductionRecipeVersion as the outlet/production overlay.
| Existing legacy Hospitality recipes remain untouched.
|--------------------------------------------------------------------------
*/

function restaurantRecipeKey(recipeVersionId) {
  return `restaurant_${String(recipeVersionId).slice(-12).toLowerCase()}`
}

function restaurantRecipeFoodIntelligence(input) {
  const raw = input?.foodIntelligence

  if (!raw) {
    return null
  }

  const parsed = declareRecipeFoodIntelligenceSchema.safeParse(raw)

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ||
        'Invalid Restaurant Recipe food information.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_FOOD_INTELLIGENCE_INVALID',
          issues: parsed.error.issues,
        },
      ],
    )
  }

  return parsed.data
}

function restaurantCoreRecipeInput({
  input,
  context,
  outlet,
}) {
  const rawRecipe = input?.recipe || {}
  const {
    foodIntelligence,
    ...recipe
  } = rawRecipe

  const parsed = createAdminRecipeSchema.safeParse({
    ...recipe,
    tags: Array.from(
      new Set([
        ...(Array.isArray(recipe.tags) ? recipe.tags : []),
        'restaurant-recipe',
      ]),
    ),
    source: {
      type: 'chef',
      name:
        context.organization?.displayName ||
        'Restaurant Recipe',
      url: '',
      brandId: null,
      organizationId: id(context.organization._id),
      outletId: id(outlet._id),
    },
    visibility:
      input.customerVisibility === 'organization_only'
        ? 'organization_only'
        : 'public',
  })

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ||
        'Invalid Restaurant Recipe.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_INPUT_INVALID',
          issues: parsed.error.issues,
        },
      ],
    )
  }

  return {
    recipeInput: parsed.data,
    foodIntelligence: restaurantRecipeFoodIntelligence({
      foodIntelligence,
    }),
  }
}

async function requireRestaurantOutlet({
  context,
  outletId,
}) {
  const outlet = await HospitalityOutlet.findOne({
    _id: outletId,
    organizationId: context.organization._id,
    status: {
      $ne: 'closed',
    },
  })

  if (!outlet) {
    throw new ApiError(
      404,
      'Choose an active outlet for this Restaurant Recipe.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_OUTLET_NOT_FOUND',
        },
      ],
    )
  }

  return outlet
}

async function validateRestaurantOperationalIngredients({
  context,
  recipeInput,
  operationalIngredients,
}) {
  const coreRows = recipeInput.ingredients || []

  if (
    coreRows.some(
      (row) => !row.canonicalIngredientId,
    )
  ) {
    throw new ApiError(
      400,
      'Restaurant Recipes must use matched EPANTRY ingredients before they can be submitted.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_CANONICAL_INGREDIENT_REQUIRED',
        },
      ],
    )
  }

  if (coreRows.length !== operationalIngredients.length) {
    throw new ApiError(
      400,
      'Operational ingredient settings must be provided for every Restaurant Recipe ingredient.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_OPERATIONAL_INGREDIENT_MISMATCH',
        },
      ],
    )
  }

  for (let index = 0; index < coreRows.length; index += 1) {
    if (
      id(coreRows[index].canonicalIngredientId) !==
      id(operationalIngredients[index].canonicalIngredientId)
    ) {
      throw new ApiError(
        400,
        'Operational ingredient settings must stay aligned with the Recipe ingredient order.',
        [
          {
            code: 'HOSPITALITY_RESTAURANT_RECIPE_OPERATIONAL_ORDER_MISMATCH',
          },
        ],
      )
    }
  }

  const supplierProductIds = operationalIngredients
    .map((row) => row.preferredSupplierProductId)
    .filter(Boolean)

  if (supplierProductIds.length) {
    const count = await HospitalitySupplierProduct.countDocuments({
      _id: {
        $in: supplierProductIds,
      },
      organizationId: context.organization._id,
      status: 'active',
    })

    if (count !== new Set(supplierProductIds.map(String)).size) {
      throw new ApiError(
        400,
        'One or more preferred supplier items are not active for this Hospitality organization.',
        [
          {
            code: 'HOSPITALITY_RESTAURANT_RECIPE_SUPPLIER_ITEM_INVALID',
          },
        ],
      )
    }
  }
}

async function createRestaurantOperationalOverlay({
  context,
  outlet,
  coreRecipe,
  recipeInput,
  operationalIngredients,
  customerVisibility,
  kitchenNote,
  actorUser,
}) {
  const userId = actorId(actorUser)
  const recipeVersionId = coreRecipe.recipeVersion.id

  const overlay = await HospitalityProductionRecipeVersion.create({
    organizationId: context.organization._id,
    recipeKey: restaurantRecipeKey(recipeVersionId),
    versionNumber: 1,
    dishId: coreRecipe.dish.id,
    sourceRecipeVersionId: recipeVersionId,
    recipeFoundationMode: 'core_recipe_linked',
    listingOutletId: outlet._id,
    customerVisibility,
    title: recipeInput.title,
    baseYieldPortions: recipeInput.baseServings,
    productionUnit: 'portion',
    status: 'in_review',
    changeReason:
      kitchenNote ||
      'Restaurant Recipe submitted for Super Admin review.',
    createdByUserId: userId,
    submittedAt: new Date(),
    submittedByUserId: userId,
  })

  const rows = recipeInput.ingredients.map((ingredient, index) => ({
    organizationId: context.organization._id,
    productionRecipeVersionId: overlay._id,
    lineNumber: index + 1,
    canonicalIngredientId: ingredient.canonicalIngredientId,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    expectedWastePercentage:
      operationalIngredients[index]?.expectedWastePercentage || 0,
    preferredSupplierProductId:
      operationalIngredients[index]?.preferredSupplierProductId || null,
    optional: ingredient.optional === true,
    notes:
      operationalIngredients[index]?.note ||
      ingredient.notes ||
      '',
  }))

  await HospitalityProductionRecipeIngredient.insertMany(rows)

  return overlay
}

async function restaurantRecipeSummary({
  version,
  overlay,
  outlet,
  dish,
}) {
  return {
    id: id(version._id),
    recipeVersionId: id(version._id),
    dishId: id(version.dishId),
    productionRecipeVersionId: id(overlay?._id),
    organizationId: id(version.sourceOrganizationId),
    outletId: id(version.sourceOutletId),
    outletName: outlet?.name || '',
    title: version.title || dish?.name || '',
    dishName: dish?.name || version.title || '',
    heroImageUrl: dish?.heroImageUrl || '',
    cuisine: dish?.cuisine || '',
    course: dish?.course || '',
    baseServings: version.baseServings,
    status: version.status,
    customerVisibility:
      overlay?.customerVisibility ||
      (version.visibility === 'public'
        ? 'public_candidate'
        : 'organization_only'),
    operationalStatus: overlay?.status || null,
    submittedAt: version.submittedAt || overlay?.submittedAt || null,
    reviewedAt: version.reviewedAt || overlay?.approvedAt || null,
    createdAt: version.createdAt || null,
    updatedAt: version.updatedAt || null,
  }
}

export async function listHospitalityRestaurantRecipes({
  actorUser,
  organizationIdHint = null,
}) {
  const context = await resolveHospitalityContext(
    actorUser,
    organizationIdHint,
  )

  assertPermission(context, 'hospitality.recipes.read')

  const versions = await RecipeVersion.find({
    sourceOrganizationId: context.organization._id,
    sourceType: 'chef',
  })
    .sort({
      createdAt: -1,
    })
    .lean()

  const versionIds = versions.map((version) => version._id)
  const dishIds = versions.map((version) => version.dishId).filter(Boolean)
  const outletIds = versions.map((version) => version.sourceOutletId).filter(Boolean)

  const [overlays, dishes, outlets] = await Promise.all([
    HospitalityProductionRecipeVersion.find({
      organizationId: context.organization._id,
      sourceRecipeVersionId: {
        $in: versionIds,
      },
      recipeFoundationMode: 'core_recipe_linked',
    }).lean(),
    Dish.find({
      _id: {
        $in: dishIds,
      },
    }).lean(),
    HospitalityOutlet.find({
      _id: {
        $in: outletIds,
      },
      organizationId: context.organization._id,
    }).lean(),
  ])

  const overlayByVersion = new Map(
    overlays.map((item) => [id(item.sourceRecipeVersionId), item]),
  )
  const dishById = new Map(dishes.map((item) => [id(item._id), item]))
  const outletById = new Map(outlets.map((item) => [id(item._id), item]))

  return {
    restaurantRecipes: await Promise.all(
      versions.map((version) =>
        restaurantRecipeSummary({
          version,
          overlay: overlayByVersion.get(id(version._id)),
          outlet: outletById.get(id(version.sourceOutletId)),
          dish: dishById.get(id(version.dishId)),
        }),
      ),
    ),
  }
}

export async function getHospitalityRestaurantRecipe({
  recipeVersionId,
  actorUser,
  organizationIdHint = null,
}) {
  const context = await resolveHospitalityContext(
    actorUser,
    organizationIdHint,
  )

  assertPermission(context, 'hospitality.recipes.read')

  const version = await RecipeVersion.findOne({
    _id: recipeVersionId,
    sourceOrganizationId: context.organization._id,
    sourceType: 'chef',
  }).lean()

  if (!version) {
    throw new ApiError(
      404,
      'Restaurant Recipe was not found.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  const [overlay, outlet, recipe] = await Promise.all([
    HospitalityProductionRecipeVersion.findOne({
      organizationId: context.organization._id,
      sourceRecipeVersionId: version._id,
      recipeFoundationMode: 'core_recipe_linked',
    }).lean(),
    HospitalityOutlet.findOne({
      _id: version.sourceOutletId,
      organizationId: context.organization._id,
    }).lean(),
    getAdminRecipeVersion(version._id),
  ])

  const operationalIngredients = overlay
    ? await HospitalityProductionRecipeIngredient.find({
        productionRecipeVersionId: overlay._id,
      })
        .sort({
          lineNumber: 1,
        })
        .lean()
    : []

  return {
    listing: await restaurantRecipeSummary({
      version,
      overlay,
      outlet,
      dish: recipe?.dish,
    }),
    recipe,
    operationalRecipe: overlay
      ? serializeProductionRecipe(overlay, operationalIngredients)
      : null,
    foodIntelligence:
      await getLatestRecipeFoodIntelligenceDeclaration(version._id),
  }
}

export async function createHospitalityRestaurantRecipe({
  input,
  actorUser,
  organizationIdHint = null,
}) {
  const context = await resolveHospitalityContext(
    actorUser,
    organizationIdHint,
  )

  assertPermission(context, 'hospitality.recipes.manage')

  const outlet = await requireRestaurantOutlet({
    context,
    outletId: input.outletId,
  })

  const {
    recipeInput,
    foodIntelligence,
  } = restaurantCoreRecipeInput({
    input,
    context,
    outlet,
  })

  await validateRestaurantOperationalIngredients({
    context,
    recipeInput,
    operationalIngredients: input.operationalIngredients,
  })

  const created = await createAdminRecipe(
    recipeInput,
    actorUser,
  )

  const userId = actorId(actorUser)
  const submittedAt = new Date()

  const version = await RecipeVersion.findOneAndUpdate(
    {
      _id: created.recipeVersion.id,
      sourceOrganizationId: context.organization._id,
      sourceType: 'chef',
      status: 'draft',
    },
    {
      $set: {
        status: 'in_review',
        submittedAt,
        submittedByUserId: userId,
        changeReason:
          input.kitchenNote ||
          'Restaurant Recipe submitted for Super Admin review.',
      },
    },
    {
      new: true,
    },
  )

  if (!version) {
    throw new ApiError(
      409,
      'Restaurant Recipe could not enter the Super Admin review state.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_REVIEW_STATE_INVALID',
        },
      ],
    )
  }

  if (foodIntelligence) {
    await submitRecipeFoodIntelligenceDeclaration(
      version._id,
      foodIntelligence,
      actorUser,
    )
  }

  const overlay = await createRestaurantOperationalOverlay({
    context,
    outlet,
    coreRecipe: created,
    recipeInput,
    operationalIngredients: input.operationalIngredients,
    customerVisibility: input.customerVisibility,
    kitchenNote: input.kitchenNote,
    actorUser,
  })

  await notifyActiveSuperAdminsBestEffort({
    triggerType: 'hospitality_approval_requested',
    reasonCode: 'restaurant_recipe_listing_submitted',
    explanation: `${context.organization?.displayName || 'Restaurant'} submitted ${recipeInput.title} for Super Admin approval.`,
    relatedEntityType: 'restaurant_recipe_listing',
    relatedEntityId: id(version._id),
    sourceDomain: 'hospitality',
    sourceVersion: 'm5b-restaurant-recipe-v1',
    dedupeScope: `restaurant-recipe-review:${id(version._id)}`,
  })

  return getHospitalityRestaurantRecipe({
    recipeVersionId: version._id,
    actorUser,
    organizationIdHint: id(context.organization._id),
  })
}

export async function updateHospitalityRestaurantRecipe({
  recipeVersionId,
  input,
  actorUser,
  organizationIdHint = null,
}) {
  const context = await resolveHospitalityContext(
    actorUser,
    organizationIdHint,
  )

  assertPermission(context, 'hospitality.recipes.manage')

  const existing = await RecipeVersion.findOne({
    _id: recipeVersionId,
    sourceOrganizationId: context.organization._id,
    sourceType: 'chef',
  })

  if (!existing) {
    throw new ApiError(
      404,
      'Restaurant Recipe was not found.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  if (existing.status !== 'draft') {
    throw new ApiError(
      409,
      'Restaurant Recipe can only be edited after Super Admin requests changes.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_EDIT_STATE_INVALID',
        },
      ],
    )
  }

  const outlet = await requireRestaurantOutlet({
    context,
    outletId: input.outletId,
  })

  const {
    recipeInput,
    foodIntelligence,
  } = restaurantCoreRecipeInput({
    input,
    context,
    outlet,
  })

  await validateRestaurantOperationalIngredients({
    context,
    recipeInput,
    operationalIngredients: input.operationalIngredients,
  })

  await updateAdminRecipeDraft(
    existing._id,
    recipeInput,
    actorUser,
  )

  const overlay = await HospitalityProductionRecipeVersion.findOne({
    organizationId: context.organization._id,
    sourceRecipeVersionId: existing._id,
    recipeFoundationMode: 'core_recipe_linked',
  })

  if (!overlay) {
    throw new ApiError(
      409,
      'Restaurant Recipe operational settings were not found.',
      [
        {
          code: 'HOSPITALITY_RESTAURANT_RECIPE_OVERLAY_NOT_FOUND',
        },
      ],
    )
  }

  overlay.listingOutletId = outlet._id
  overlay.customerVisibility = input.customerVisibility
  overlay.title = recipeInput.title
  overlay.baseYieldPortions = recipeInput.baseServings
  overlay.status = 'in_review'
  overlay.changeReason =
    input.kitchenNote ||
    'Restaurant Recipe resubmitted for Super Admin review.'
  overlay.submittedAt = new Date()
  overlay.submittedByUserId = actorId(actorUser)
  await overlay.save()

  await HospitalityProductionRecipeIngredient.deleteMany({
    productionRecipeVersionId: overlay._id,
  })

  await HospitalityProductionRecipeIngredient.insertMany(
    recipeInput.ingredients.map((ingredient, index) => ({
      organizationId: context.organization._id,
      productionRecipeVersionId: overlay._id,
      lineNumber: index + 1,
      canonicalIngredientId: ingredient.canonicalIngredientId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      expectedWastePercentage:
        input.operationalIngredients[index]?.expectedWastePercentage || 0,
      preferredSupplierProductId:
        input.operationalIngredients[index]?.preferredSupplierProductId || null,
      optional: ingredient.optional === true,
      notes:
        input.operationalIngredients[index]?.note ||
        ingredient.notes ||
        '',
    })),
  )

  existing.status = 'in_review'
  existing.submittedAt = new Date()
  existing.submittedByUserId = actorId(actorUser)
  existing.changeReason = overlay.changeReason
  await existing.save()

  if (foodIntelligence) {
    await submitRecipeFoodIntelligenceDeclaration(
      existing._id,
      foodIntelligence,
      actorUser,
    )
  }

  await notifyActiveSuperAdminsBestEffort({
    triggerType: 'hospitality_approval_requested',
    reasonCode: 'restaurant_recipe_listing_resubmitted',
    explanation: `${context.organization?.displayName || 'Restaurant'} resubmitted ${recipeInput.title} for Super Admin approval.`,
    relatedEntityType: 'restaurant_recipe_listing',
    relatedEntityId: id(existing._id),
    sourceDomain: 'hospitality',
    sourceVersion: 'm5b-restaurant-recipe-v1',
    dedupeScope: `restaurant-recipe-review:${id(existing._id)}:${Date.now()}`,
  })

  return getHospitalityRestaurantRecipe({
    recipeVersionId: existing._id,
    actorUser,
    organizationIdHint: id(context.organization._id),
  })
}

export async function listAdminHospitalityRestaurantRecipeApprovals() {
  const versions = await RecipeVersion.find({
    sourceType: 'chef',
    status: 'in_review',
  })
    .sort({
      submittedAt: 1,
      createdAt: 1,
    })
    .lean()

  const versionIds = versions.map((version) => version._id)
  const organizationIds = versions
    .map((version) => version.sourceOrganizationId)
    .filter(Boolean)
  const outletIds = versions
    .map((version) => version.sourceOutletId)
    .filter(Boolean)
  const dishIds = versions.map((version) => version.dishId).filter(Boolean)

  const [overlays, organizations, outlets, dishes] = await Promise.all([
    HospitalityProductionRecipeVersion.find({
      sourceRecipeVersionId: {
        $in: versionIds,
      },
      recipeFoundationMode: 'core_recipe_linked',
    }).lean(),
    MarketplaceOrganization.find({
      _id: {
        $in: organizationIds,
      },
    })
      .select(
        'displayName slug organizationType status ownerUserId',
      )
      .lean(),
    HospitalityOutlet.find({
      _id: {
        $in: outletIds,
      },
    }).lean(),
    Dish.find({
      _id: {
        $in: dishIds,
      },
    }).lean(),
  ])

  const ownerUserIds = [
    ...new Set(
      organizations
        .map((organization) => id(organization.ownerUserId))
        .filter(Boolean),
    ),
  ]

  const ownerUsers = ownerUserIds.length
    ? await User.find({
        _id: {
          $in: ownerUserIds,
        },
      })
        .select('name email hostWorkspaceType hostAccessStatus')
        .lean()
    : []

  const ownerUserById = new Map(
    ownerUsers.map((user) => [id(user._id), user]),
  )

  const overlayByVersion = new Map(
    overlays.map((item) => [id(item.sourceRecipeVersionId), item]),
  )
  const organizationById = new Map(
    organizations.map((item) => [id(item._id), item]),
  )
  const outletById = new Map(outlets.map((item) => [id(item._id), item]))
  const dishById = new Map(dishes.map((item) => [id(item._id), item]))

  return {
    restaurantRecipes: await Promise.all(
      versions.map(async (version) => ({
        ...(await restaurantRecipeSummary({
          version,
          overlay: overlayByVersion.get(id(version._id)),
          outlet: outletById.get(id(version.sourceOutletId)),
          dish: dishById.get(id(version.dishId)),
        })),
        organizationName:
          organizationById.get(id(version.sourceOrganizationId))?.displayName ||
          'Restaurant',
        organizationSlug:
          organizationById.get(id(version.sourceOrganizationId))?.slug ||
          '',
        organizationType:
          organizationById.get(id(version.sourceOrganizationId))?.organizationType ||
          null,
        hostUser:
          (() => {
            const organization = organizationById.get(
              id(version.sourceOrganizationId),
            )
            const owner = organization?.ownerUserId
              ? ownerUserById.get(id(organization.ownerUserId))
              : null

            return owner
              ? {
                  id: id(owner._id),
                  name: owner.name || '',
                  email: owner.email || '',
                  hostWorkspaceType: owner.hostWorkspaceType || null,
                  hostAccessStatus: owner.hostAccessStatus || null,
                }
              : null
          })(),
      })),
    ),
  }
}

export async function reviewHospitalityRestaurantRecipeAsSuperAdmin({
  recipeVersionId,
  input,
  actorUser,
}) {
  const adminUserId = rootSuperAdminActorId(actorUser)

  const version = await RecipeVersion.findOne({
    _id: recipeVersionId,
    sourceType: 'chef',
    status: 'in_review',
  })

  if (!version) {
    throw new ApiError(
      404,
      'Restaurant Recipe awaiting review was not found.',
      [
        {
          code: 'ADMIN_RESTAURANT_RECIPE_REVIEW_NOT_FOUND',
        },
      ],
    )
  }

  const overlay = await HospitalityProductionRecipeVersion.findOne({
    sourceRecipeVersionId: version._id,
    recipeFoundationMode: 'core_recipe_linked',
  })

  if (!overlay) {
    throw new ApiError(
      409,
      'Restaurant Recipe operational settings are missing.',
      [
        {
          code: 'ADMIN_RESTAURANT_RECIPE_OVERLAY_MISSING',
        },
      ],
    )
  }

  if (input.decision === 'approve') {
    const food = await getLatestRecipeFoodIntelligenceDeclaration(version._id)

    if (food?.latest?.declaration && !food?.latestApproved) {
      await declareRecipeFoodIntelligence(
        version._id,
        food.latest.declaration,
        actorUser,
      )
    }

    version.status = 'published'
    version.reviewedAt = new Date()
    version.reviewedByUserId = adminUserId
    version.changeReason = input.reason
    await version.save()

    await Dish.updateOne(
      {
        _id: version.dishId,
      },
      {
        $set: {
          status: 'active',
        },
      },
    )

    overlay.status = 'approved'
    overlay.approvedAt = new Date()
    overlay.approvedByUserId = adminUserId
    overlay.changeReason = input.reason
    await overlay.save()
  } else {
    version.status = 'draft'
    version.submittedAt = null
    version.submittedByUserId = null
    version.reviewedAt = new Date()
    version.reviewedByUserId = adminUserId
    version.changeReason = input.reason
    await version.save()

    overlay.status = 'draft'
    overlay.submittedAt = null
    overlay.submittedByUserId = null
    overlay.changeReason = input.reason
    await overlay.save()
  }

  return {
    decision: input.decision,
    recipeVersionId: id(version._id),
    status: version.status,
    operationalStatus: overlay.status,
    reason: input.reason,
  }
}
