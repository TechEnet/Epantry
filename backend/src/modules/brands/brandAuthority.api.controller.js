import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  assertDistinctMakerCheckerActors,
} from '../admin/adminSafety.middleware.js'

import {
  BrandAuthorityGrant,
  BrandClaim,
  ContentConflictCase,
  ContentOverrideProposal,
  TrademarkOrIdentityCheck,
} from './brandAuthority.models.js'

import {
  approveBrandClaim,
  changeBrandAuthorityLifecycle,
  getAdminBrandClaim,
  listAdminBrandAuthorities,
  listAdminBrandClaims,
  rejectBrandClaim,
  reviewBrandIdentityCheck,
} from './brandAuthority.admin.service.js'

import {
  adminBrandClaimIdParamsSchema,
  adminBrandIdentityCheckIdParamsSchema,
  approveBrandClaimSchema,
  brandAuthorityGrantIdParamsSchema,
  changeBrandAuthorityLifecycleSchema,
  listAdminBrandAuthoritiesQuerySchema,
  listAdminBrandClaimsQuerySchema,
  rejectBrandClaimSchema,
  reviewBrandIdentityCheckSchema,
} from './brandAuthority.admin.validation.js'

import {
  createBrandClaim,
  createBrandIdentityCheck,
  getBrandClaim,
  getBrandIdentityCheck,
  listBrandClaims,
  listBrandIdentityChecks,
} from './brandAuthority.host.service.js'

import {
  brandClaimIdParamsSchema,
  brandIdentityCheckIdParamsSchema,
  createBrandClaimSchema,
  createBrandIdentityCheckSchema,
  listBrandClaimsQuerySchema,
  listBrandIdentityChecksQuerySchema,
} from './brandAuthority.host.validation.js'

import {
  createContentOverrideProposal,
  isCriticalBrandOverrideField,
  resolveContentConflictCase,
  reviewContentOverrideProposal,
  submitContentOverrideProposal,
} from './brandAuthority.override.service.js'

import {
  contentConflictCaseIdParamsSchema,
  contentOverrideProposalIdParamsSchema,
  createContentOverrideProposalSchema,
  resolveContentConflictSchema,
  reviewContentOverrideProposalSchema,
} from './brandAuthority.override.validation.js'

import {
  getHostContentOverride,
  listAdminBrandConflicts,
  listAdminContentOverrides,
  listHostBrandAuthorities,
  listHostContentOverrides,
} from './brandAuthority.workspace.service.js'

import {
  hostBrandIdParamsSchema,
  listAdminBrandConflictsQuerySchema,
  listHostBrandAuthoritiesQuerySchema,
  listWorkspaceContentOverridesQuerySchema,
} from './brandAuthority.workspace.validation.js'

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
      'Invalid Brand Authority request.',
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

function actorUserIdFromRequest(
  req,
) {
  return String(
    req.currentUser?._id ||
    req.currentUser?.id ||
    '',
  ).trim()
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

function proposalHasCriticalFields(
  proposal,
) {
  return (
    proposal?.fieldChanges ||
    []
  ).some(
    (
      change,
    ) =>
      isCriticalBrandOverrideField(
        change.fieldKey,
      ),
  )
}

function requireCriticalOverrideAuthority(
  req,
  proposal,
) {
  if (
    !proposalHasCriticalFields(
      proposal,
    )
  ) {
    return
  }

  const permissionKeys =
    permissionKeysFromRequest(
      req,
    )

  if (
    !permissionKeys.has(
      'trust_safety.mutate',
    )
  ) {
    throw new ApiError(
      403,
      'Critical Brand content requires Trust & Safety mutation authority.',
      [
        {
          code:
            'BRAND_OVERRIDE_CRITICAL_TRUST_SAFETY_REQUIRED',
        },
      ],
    )
  }
}

function assertCriticalOverrideMakerChecker(
  req,
  proposal,
  decision,
) {
  if (
    decision !==
      'approve' ||
    !proposalHasCriticalFields(
      proposal,
    )
  ) {
    return
  }

  assertDistinctMakerCheckerActors({
    makerUserId:
      proposal.submittedByUserId,

    checkerUserId:
      actorUserIdFromRequest(
        req,
      ),
  })
}

function chooseContentAuditPolicy(
  req,
  proposal,
) {
  const permissions =
    permissionKeysFromRequest(
      req,
    )

  if (
    proposalHasCriticalFields(
      proposal,
    ) ||
    permissions.has(
      'trust_safety.mutate',
    )
  ) {
    return {
      action:
        'trust_safety.mutate',

      permissionKey:
        'trust_safety.mutate',

      reasonCode:
        'trust_safety.enforcement',
    }
  }

  return {
    action:
      'catalog.mutate',

    permissionKey:
      'catalog.mutate',

    reasonCode:
      'catalog.governance',
  }
}

async function recordBrandAudit({
  req,

  action,
  permissionKey,
  reasonCode,
  reasonDetails,

  entityType,
  entityId,

  beforeSnapshot,
  afterSnapshot,

  metadata,
}) {
  await recordAdminAuditEvent({
    actorUser:
      req.currentUser,

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
| Host — Identity Evidence
|--------------------------------------------------------------------------
*/

export async function createHostBrandIdentityCheckController(
  req,
  res,
) {
  const {
    brandId,
  } =
    parseOrThrow(
      hostBrandIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      createBrandIdentityCheckSchema,
      {
        ...req.body,

        brandId,
      },
    )

  const data =
    await createBrandIdentityCheck(
      input,
      req.currentUser,
    )

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Brand identity evidence submitted successfully.',

      data,
    })
}

export async function listHostBrandIdentityChecksController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listBrandIdentityChecksQuerySchema,
      req.query,
    )

  const data =
    await listBrandIdentityChecks(
      query,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand identity evidence loaded successfully.',

      data,
    })
}

export async function getHostBrandIdentityCheckController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      brandIdentityCheckIdParamsSchema,
      req.params,
    )

  const data =
    await getBrandIdentityCheck(
      id,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand identity evidence loaded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Host — Claims
|--------------------------------------------------------------------------
*/

export async function createHostBrandClaimController(
  req,
  res,
) {
  const {
    brandId,
  } =
    parseOrThrow(
      hostBrandIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      createBrandClaimSchema,
      {
        ...req.body,

        brandId,
      },
    )

  const data =
    await createBrandClaim(
      input,
      req.currentUser,
    )

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Brand Claim submitted successfully.',

      data,
    })
}

export async function listHostBrandClaimsController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listBrandClaimsQuerySchema,
      req.query,
    )

  const data =
    await listBrandClaims(
      query,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Claims loaded successfully.',

      data,
    })
}

export async function getHostBrandClaimController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      brandClaimIdParamsSchema,
      req.params,
    )

  const data =
    await getBrandClaim(
      id,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Claim loaded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Host — Authorities
|--------------------------------------------------------------------------
*/

export async function listHostBrandAuthoritiesController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listHostBrandAuthoritiesQuerySchema,
      req.query,
    )

  const data =
    await listHostBrandAuthorities(
      query,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand authorities loaded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Host — Content Overrides
|--------------------------------------------------------------------------
*/

export async function createHostContentOverrideController(
  req,
  res,
) {
  const input =
    parseOrThrow(
      createContentOverrideProposalSchema,
      req.body,
    )

  const data =
    await createContentOverrideProposal(
      input,
      req.currentUser,
    )

  return res
    .status(
      201,
    )
    .json({
      success:
        true,

      message:
        'Brand Content Override draft created successfully.',

      data,
    })
}

export async function listHostContentOverridesController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listWorkspaceContentOverridesQuerySchema,
      req.query,
    )

  const data =
    await listHostContentOverrides(
      query,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Content Override proposals loaded successfully.',

      data,
    })
}

export async function getHostContentOverrideController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      contentOverrideProposalIdParamsSchema,
      req.params,
    )

  const data =
    await getHostContentOverride(
      id,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Content Override proposal loaded successfully.',

      data,
    })
}

export async function submitHostContentOverrideController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      contentOverrideProposalIdParamsSchema,
      req.params,
    )

  const data =
    await submitContentOverrideProposal(
      id,
      req.currentUser,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Content Override submitted for review.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Admin — Claim Reads
|--------------------------------------------------------------------------
*/

export async function listAdminBrandClaimsController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listAdminBrandClaimsQuerySchema,
      req.query,
    )

  const data =
    await listAdminBrandClaims(
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
        'Brand Claim review queue loaded successfully.',

      data,
    })
}

export async function getAdminBrandClaimController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      adminBrandClaimIdParamsSchema,
      req.params,
    )

  const data =
    await getAdminBrandClaim(
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
        'Brand Claim loaded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Admin — Identity Evidence Review
|--------------------------------------------------------------------------
*/

export async function reviewAdminBrandIdentityCheckController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      adminBrandIdentityCheckIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      reviewBrandIdentityCheckSchema,
      req.body,
    )

  const before =
    await TrademarkOrIdentityCheck.findById(
      id,
    ).lean()

  const data =
    await reviewBrandIdentityCheck(
      id,
      input,
      req.currentUser,
    )

  await recordBrandAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    entityType:
      'brand_identity_check',

    entityId:
      id,

    beforeSnapshot:
      before,

    afterSnapshot:
      data.identityCheck,

    metadata: {
      operation:
        'brand_identity_review',

      decision:
        input.decision,
    },
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand identity evidence reviewed successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Admin — Claim Approval / Rejection
|--------------------------------------------------------------------------
*/

export async function approveAdminBrandClaimController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      adminBrandClaimIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      approveBrandClaimSchema,
      req.body,
    )

  const before =
    await BrandClaim.findById(
      id,
    ).lean()

  const data =
    await approveBrandClaim(
      id,
      input,
      req.currentUser,
    )

  await recordBrandAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    entityType:
      'brand_claim',

    entityId:
      id,

    beforeSnapshot:
      before,

    afterSnapshot: {
      claim:
        data.claim,

      authority:
        data.authority,
    },

    metadata: {
      operation:
        'brand_claim_approve',

      authorityId:
        data.authority?.id ||
        null,

      marketCodes:
        input.marketCodes,

      scopes:
        input.scopes,
    },
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Authority granted successfully.',

      data,
    })
}

export async function rejectAdminBrandClaimController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      adminBrandClaimIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      rejectBrandClaimSchema,
      req.body,
    )

  const before =
    await BrandClaim.findById(
      id,
    ).lean()

  const data =
    await rejectBrandClaim(
      id,
      input,
      req.currentUser,
    )

  await recordBrandAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    entityType:
      'brand_claim',

    entityId:
      id,

    beforeSnapshot:
      before,

    afterSnapshot:
      data.claim,

    metadata: {
      operation:
        'brand_claim_reject',
    },
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Claim rejected successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Admin — Authorities
|--------------------------------------------------------------------------
*/

export async function listAdminBrandAuthoritiesController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listAdminBrandAuthoritiesQuerySchema,
      req.query,
    )

  const data =
    await listAdminBrandAuthorities(
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
        'Brand authorities loaded successfully.',

      data,
    })
}

export async function changeAdminBrandAuthorityLifecycleController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      brandAuthorityGrantIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      changeBrandAuthorityLifecycleSchema,
      req.body,
    )

  const before =
    await BrandAuthorityGrant.findById(
      id,
    ).lean()

  const data =
    await changeBrandAuthorityLifecycle(
      id,
      input,
      req.currentUser,
    )

  await recordBrandAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    entityType:
      'brand_authority',

    entityId:
      id,

    beforeSnapshot:
      before,

    afterSnapshot:
      data.authority,

    metadata: {
      operation:
        'brand_authority_lifecycle',

      lifecycleAction:
        input.action,
    },
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Authority lifecycle updated successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Admin — Content Override Reads
|--------------------------------------------------------------------------
*/

export async function listAdminContentOverridesController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listWorkspaceContentOverridesQuerySchema,
      req.query,
    )

  const data =
    await listAdminContentOverrides(
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
        'Brand Content Override queue loaded successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Admin — Content Override Review
|--------------------------------------------------------------------------
*/

export async function reviewAdminContentOverrideController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      contentOverrideProposalIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      reviewContentOverrideProposalSchema,
      req.body,
    )

  const before =
    await ContentOverrideProposal.findById(
      id,
    ).lean()

  requireCriticalOverrideAuthority(
    req,
    before,
  )

  assertCriticalOverrideMakerChecker(
    req,
    before,
    input.decision,
  )

  const auditPolicy =
    chooseContentAuditPolicy(
      req,
      before,
    )

  const data =
    await reviewContentOverrideProposal(
      id,
      input,
      req.currentUser,
    )

  await recordBrandAudit({
    req,

    ...auditPolicy,

    reasonDetails:
      input.reason,

    entityType:
      'brand_content_override',

    entityId:
      id,

    beforeSnapshot:
      before,

    afterSnapshot:
      data.proposal,

    metadata: {
      operation:
        'brand_content_override_review',

      decision:
        input.decision,

      critical:
        proposalHasCriticalFields(
          before,
        ),
    },
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Content Override reviewed successfully.',

      data,
    })
}

/*
|--------------------------------------------------------------------------
| Admin — Conflict Queue
|--------------------------------------------------------------------------
*/

export async function listAdminBrandConflictsController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listAdminBrandConflictsQuerySchema,
      req.query,
    )

  const data =
    await listAdminBrandConflicts(
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
        'Brand Content Conflict queue loaded successfully.',

      data,
    })
}

export async function resolveAdminBrandConflictController(
  req,
  res,
) {
  const {
    id,
  } =
    parseOrThrow(
      contentConflictCaseIdParamsSchema,
      req.params,
    )

  const input =
    parseOrThrow(
      resolveContentConflictSchema,
      req.body,
    )

  const before =
    await ContentConflictCase.findById(
      id,
    ).lean()

  if (
    before?.severity ===
      'safety_critical' &&
    input.resolution ===
      'approve_proposal'
  ) {
    const selectedProposal =
      await ContentOverrideProposal.findById(
        input.selectedProposalId,
      )
        .select({
          submittedByUserId:
            1,
        })
        .lean()

    assertDistinctMakerCheckerActors({
      makerUserId:
        selectedProposal
          ?.submittedByUserId,

      checkerUserId:
        actorUserIdFromRequest(
          req,
        ),
    })
  }

  const data =
    await resolveContentConflictCase(
      id,
      input,
      req.currentUser,
    )

  await recordBrandAudit({
    req,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    entityType:
      'brand_content_conflict',

    entityId:
      id,

    beforeSnapshot:
      before,

    afterSnapshot:
      data.conflict,

    metadata: {
      operation:
        'brand_content_conflict_resolution',

      resolution:
        input.resolution,

      selectedProposalId:
        input.selectedProposalId ||
        null,
    },
  })

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand Content Conflict resolved successfully.',

      data,
    })
}