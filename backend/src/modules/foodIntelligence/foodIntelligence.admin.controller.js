import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  calculateProductFoodIntelligence,
  declareProductFoodIntelligence,
  getLatestProductFoodIntelligenceDeclaration,
} from './foodIntelligence.product.service.js'

import {
  calculateRecipeFoodIntelligence,
  declareRecipeFoodIntelligence,
  getLatestRecipeFoodIntelligenceDeclaration,
} from './foodIntelligence.recipe.service.js'

import {
  activateIngredientRelation,
  activateRuleProfile,
  approveFoodCalculation,
  createIngredientRelationDraft,
  createRuleProfileDraft,
  getFoodCalculation,
  listFoodCalculations,
  listIngredientRelations,
  listRuleProfiles,
  retireIngredientRelation,
  retireRuleProfile,
  testFoodRule,
} from './foodIntelligence.governance.service.js'

import {
  calculateProductFoodIntelligenceSchema,
  calculateRecipeFoodIntelligenceSchema,
  declareProductFoodIntelligenceSchema,
  declareRecipeFoodIntelligenceSchema,
  productVersionFoodParamsSchema,
  recipeVersionFoodParamsSchema,
} from './foodIntelligence.integration.validation.js'

import {
  createIngredientRelationSchema,
  createRuleProfileSchema,
  foodGovernanceIdParamsSchema,
  lifecycleReasonSchema,
  listFoodCalculationsQuerySchema,
  listIngredientRelationsQuerySchema,
  listRuleProfilesQuerySchema,
  testFoodRuleSchema,
} from './foodIntelligence.governance.validation.js'

function parseOrThrow(
  schema,
  input,
) {
  const result =
    schema.safeParse(
      input,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      'Invalid Food Intelligence request.',
      result.error.issues.map(
        (
          issue,
        ) => ({
          code:
            'VALIDATION_ERROR',

          field:
            issue.path.join(
              '.',
            ),

          message:
            issue.message,
        }),
      ),
    )
  }

  return result.data
}


function actorUserFromRequest(
  req,
) {
  return (
    req.currentUser ||
    req.user ||
    null
  )
}

function permissionKeysFromRequest(
  req,
) {
  const raw =
    req.adminAuthorization
      ?.permissionKeys ||
    req.adminAuthorization
      ?.permissions ||
    req.adminAuthorization
      ?.effectivePermissions ||
    []

  return new Set(
    raw
      .map(
        (
          value,
        ) =>
          typeof value ===
          'string'
            ? value
            : value?.key,
      )
      .filter(
        Boolean,
      ),
  )
}

function chooseCalculationAuditPolicy(
  req,
  entityType,
) {
  const permissions =
    permissionKeysFromRequest(
      req,
    )

  if (
    entityType ===
      'product_version' &&
    permissions.has(
      'catalog.mutate',
    )
  ) {
    return {
      action:
        'catalog.mutate',

      permissionKey:
        'catalog.mutate',

      reasonCode:
        'catalog.governance',
    }
  }

  if (
    entityType ===
      'recipe_version' &&
    permissions.has(
      'recipe.mutate',
    )
  ) {
    return {
      action:
        'recipe.mutate',

      permissionKey:
        'recipe.mutate',

      reasonCode:
        'recipe.governance',
    }
  }

  return {
    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',
  }
}

async function recordFoodAudit({
  req,
  action,
  permissionKey,
  reasonCode,
  reasonDetails,
  entityType,
  entityId,
  beforeSnapshot =
    null,
  afterSnapshot =
    null,
  metadata =
    null,
}) {
  await recordAdminAuditEvent({
    actorUser:
      actorUserFromRequest(
      req,
    ),

    adminAuthorization:
      req.adminAuthorization,

    action,

    permissionKey,

    entityType,

    entityId:
      String(
        entityId,
      ),

    reasonCode,

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    metadata,

    requestId:
      req.requestId,
  })
}

/*
|--------------------------------------------------------------------------
| Product + Recipe Calculation
|--------------------------------------------------------------------------
*/

export async function calculateProductFoodIntelligenceController(
  req,
  res,
) {
  const {
    productVersionId,
  } =
    parseOrThrow(
      productVersionFoodParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      calculateProductFoodIntelligenceSchema,
      req.body,
    )

  const data =
    await calculateProductFoodIntelligence(
      productVersionId,
      input,
      actorUserFromRequest(
      req,
    ),
    )

  const audit =
    chooseCalculationAuditPolicy(
      req,
      'product_version',
    )

  await recordFoodAudit({
    req,

    ...audit,

    reasonDetails:
      input.reason,

    entityType:
      'FoodCalculation',

    entityId:
      data.calculation._id,

    afterSnapshot:
      data.calculation,

    metadata: {
      targetEntityType:
        'product_version',

      targetEntityId:
        productVersionId,
    },
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Product Food Intelligence calculated successfully.',

      data,
    })
}

export async function getLatestProductFoodIntelligenceController(
  req,
  res,
) {
  const {
    productVersionId,
  } =
    parseOrThrow(
      productVersionFoodParamsSchema,
      req.params,
    )

  const data =
    await getLatestProductFoodIntelligenceDeclaration(
      productVersionId,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Latest Product Food Intelligence declaration loaded.',

      data,
    })
}

export async function declareProductFoodIntelligenceController(
  req,
  res,
) {
  const {
    productVersionId,
  } =
    parseOrThrow(
      productVersionFoodParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      declareProductFoodIntelligenceSchema,
      req.body,
    )

  const data =
    await declareProductFoodIntelligence(
      productVersionId,
      input,
      actorUserFromRequest(
        req,
      ),
    )

  const audit =
    chooseCalculationAuditPolicy(
      req,
      'product_version',
    )

  await recordFoodAudit({
    req,

    ...audit,

    reasonDetails:
      input.reason,

    entityType:
      'FoodCalculation',

    entityId:
      data.calculation._id,

    afterSnapshot:
      data.calculation,

    metadata: {
      targetEntityType:
        'product_version',

      targetEntityId:
        productVersionId,

      declarationType:
        'super_admin_product_declaration',
    },
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Product Food Intelligence declaration saved and approved.',

      data,
    })
}

export async function getLatestRecipeFoodIntelligenceController(
  req,
  res,
) {
  const {
    recipeVersionId,
  } =
    parseOrThrow(
      recipeVersionFoodParamsSchema,
      req.params,
    )

  const data =
    await getLatestRecipeFoodIntelligenceDeclaration(
      recipeVersionId,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Recipe Food Intelligence status loaded successfully.',

      data,
    })
}

export async function calculateRecipeFoodIntelligenceController(
  req,
  res,
) {
  const {
    recipeVersionId,
  } =
    parseOrThrow(
      recipeVersionFoodParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      calculateRecipeFoodIntelligenceSchema,
      req.body,
    )

  const data =
    await calculateRecipeFoodIntelligence(
      recipeVersionId,
      input,
      actorUserFromRequest(
      req,
    ),
    )

  const audit =
    chooseCalculationAuditPolicy(
      req,
      'recipe_version',
    )

  await recordFoodAudit({
    req,

    ...audit,

    reasonDetails:
      input.reason,

    entityType:
      'FoodCalculation',

    entityId:
      data.calculation._id,

    afterSnapshot:
      data.calculation,

    metadata: {
      targetEntityType:
        'recipe_version',

      targetEntityId:
        recipeVersionId,
    },
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Recipe Food Intelligence calculated successfully.',

      data,
    })
}


export async function declareRecipeFoodIntelligenceController(
  req,
  res,
) {
  const {
    recipeVersionId,
  } =
    parseOrThrow(
      recipeVersionFoodParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      declareRecipeFoodIntelligenceSchema,
      req.body,
    )

  const data =
    await declareRecipeFoodIntelligence(
      recipeVersionId,
      input,
      actorUserFromRequest(
        req,
      ),
    )

  const audit =
    chooseCalculationAuditPolicy(
      req,
      'recipe_version',
    )

  await recordFoodAudit({
    req,

    ...audit,

    reasonDetails:
      input.reason,

    entityType:
      'FoodCalculation',

    entityId:
      data.calculation._id,

    afterSnapshot:
      data.calculation,

    metadata: {
      targetEntityType:
        'recipe_version',

      targetEntityId:
        recipeVersionId,

      declarationType:
        'super_admin_recipe_declaration',
    },
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Recipe Food Intelligence declaration saved and approved.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Ingredient / Allergen Mapping
|--------------------------------------------------------------------------
*/

export async function listIngredientRelationsController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listIngredientRelationsQuerySchema,
      req.query,
    )

  const data =
    await listIngredientRelations(
      query,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Ingredient allergen mappings loaded successfully.',

      data,
    })
}

export async function createIngredientRelationController(
  req,
  res,
) {
  const input =
    parseOrThrow(
      createIngredientRelationSchema,
      req.body,
    )

  const data =
    await createIngredientRelationDraft(
      input,
      actorUserFromRequest(
      req,
    ),
    )

  await recordFoodAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.changeReason,

    entityType:
      'IngredientRelation',

    entityId:
      data._id,

    afterSnapshot:
      data,
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Ingredient allergen mapping draft created successfully.',

      data,
    })
}

export async function activateIngredientRelationController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      foodGovernanceIdParamsSchema,
      req.params,
    )

  const {
    reason,
  } =
    parseOrThrow(
      lifecycleReasonSchema,
      req.body,
    )

  const data =
    await activateIngredientRelation(
      id,
      actorUserFromRequest(
      req,
    ),
    )

  await recordFoodAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      reason,

    entityType:
      'IngredientRelation',

    entityId:
      id,

    afterSnapshot:
      data,
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Ingredient allergen mapping activated successfully.',

      data,
    })
}

export async function retireIngredientRelationController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      foodGovernanceIdParamsSchema,
      req.params,
    )

  const {
    reason,
  } =
    parseOrThrow(
      lifecycleReasonSchema,
      req.body,
    )

  const data =
    await retireIngredientRelation(
      id,
      actorUserFromRequest(
      req,
    ),
      reason,
    )

  await recordFoodAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      reason,

    entityType:
      'IngredientRelation',

    entityId:
      id,

    afterSnapshot:
      data,
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Ingredient allergen mapping retired successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Rule Profiles
|--------------------------------------------------------------------------
*/

export async function listRuleProfilesController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listRuleProfilesQuerySchema,
      req.query,
    )

  const data =
    await listRuleProfiles(
      query,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Food Rule Profiles loaded successfully.',

      data,
    })
}

export async function createRuleProfileController(
  req,
  res,
) {
  const input =
    parseOrThrow(
      createRuleProfileSchema,
      req.body,
    )

  const data =
    await createRuleProfileDraft(
      input,
      actorUserFromRequest(
      req,
    ),
    )

  await recordFoodAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.changeReason,

    entityType:
      'RuleProfile',

    entityId:
      data._id,

    afterSnapshot:
      data,
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Food Rule Profile draft created successfully.',

      data,
    })
}

export async function activateRuleProfileController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      foodGovernanceIdParamsSchema,
      req.params,
    )

  const {
    reason,
  } =
    parseOrThrow(
      lifecycleReasonSchema,
      req.body,
    )

  const data =
    await activateRuleProfile(
      id,
      actorUserFromRequest(
      req,
    ),
    )

  await recordFoodAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      reason,

    entityType:
      'RuleProfile',

    entityId:
      id,

    afterSnapshot:
      data,
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Food Rule Profile activated successfully.',

      data,
    })
}

export async function retireRuleProfileController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      foodGovernanceIdParamsSchema,
      req.params,
    )

  const {
    reason,
  } =
    parseOrThrow(
      lifecycleReasonSchema,
      req.body,
    )

  const data =
    await retireRuleProfile(
      id,
    )

  await recordFoodAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      reason,

    entityType:
      'RuleProfile',

    entityId:
      id,

    afterSnapshot:
      data,
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Food Rule Profile retired successfully.',

      data,
    })
}

export async function testFoodRuleController(
  req,
  res,
) {
  const input =
    parseOrThrow(
      testFoodRuleSchema,
      req.body,
    )

  const data =
    testFoodRule(
      input,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Food Rule test completed successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Trust / Safety Calculation Queue
|--------------------------------------------------------------------------
*/

export async function listFoodCalculationsController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listFoodCalculationsQuerySchema,
      req.query,
    )

  const data =
    await listFoodCalculations(
      query,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Food Calculations loaded successfully.',

      data,
    })
}

export async function getFoodCalculationController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      foodGovernanceIdParamsSchema,
      req.params,
    )

  const data =
    await getFoodCalculation(
      id,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Food Calculation loaded successfully.',

      data,
    })
}

export async function approveFoodCalculationController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      foodGovernanceIdParamsSchema,
      req.params,
    )

  const {
    reason,
  } =
    parseOrThrow(
      lifecycleReasonSchema,
      req.body,
    )

  const data =
    await approveFoodCalculation(
      id,
      actorUserFromRequest(
      req,
    ),
    )

  await recordFoodAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      reason,

    entityType:
      'FoodCalculation',

    entityId:
      data.approved._id,

    beforeSnapshot:
      data.source,

    afterSnapshot:
      data.approved,
  })

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Food Calculation approved as a new immutable snapshot.',

      data,
    })
}