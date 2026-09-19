import crypto from 'crypto'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  createRecipeImageUploadIntent,
} from '../../integrations/media/cloudinary.provider.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  BrandAuthorityGrant,
} from '../brands/brandAuthority.models.js'

import {
  Brand,
  CanonicalIngredient,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  getLatestRecipeFoodIntelligenceDeclaration,
  submitRecipeFoodIntelligenceDeclaration,
} from '../foodIntelligence/foodIntelligence.recipe.service.js'

import {
  declareRecipeFoodIntelligenceSchema,
} from '../foodIntelligence/foodIntelligence.integration.validation.js'

import {
  HostOffer,
  InventorySnapshot,
  MarketplaceOrganization,
  PriceRule,
  ServiceArea,
} from '../marketplace/marketplace.models.js'

import {
  buildCurrentPublishedPackVersionFilter,
  findHostMarketplaceOrganization,
  serializeMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  normalizeMarketplaceKey,
} from '../marketplace/marketplace.constants.js'

import {
  normalizeCatalogSlug,
} from '../catalog/catalog.constants.js'

import {
  createNotificationIntentBestEffort,
  notifyActiveSuperAdminsBestEffort,
} from '../notifications/notification.service.js'

import {
  createAdminRecipe,
  createNextAdminRecipeVersion,
  getAdminRecipeVersion,
  updateAdminRecipeDraft,
} from '../recipes/recipe.admin.service.js'

import {
  createAdminRecipeSchema,
} from '../recipes/recipe.admin.validation.js'

import {
  Dish,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  User,
} from '../users/user.model.js'

import {
  HOST_ORG_PERMISSION_KEYS,
  HostBrandRecipeSubmission,
  HostCommercialProfileRequest,
  HostCampaignBrief,
  HostCatalogIngestJob,
  HostCatalogIngestRow,
  HostKybCase,
  HostOperationalProfile,
  HostOrganizationDocument,
  HostOrganizationMember,
} from './hostOperations.models.js'

const OWNER_PERMISSION_SET =
  new Set(
    HOST_ORG_PERMISSION_KEYS,
  )

function id(
  value,
) {
  if (
    value === null ||
    value === undefined
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
            'HOST_OPERATIONS_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function uniq(
  values,
) {
  return [
    ...new Set(
      (
        Array.isArray(
          values,
        )
          ? values
          : []
      )
        .map(
          (
            value,
          ) =>
            String(
              value ||
                '',
            ).trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ]
}

function normalizeTaxRegistration(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      '',
    )
}

function taxFingerprint(
  value,
) {
  const normalized =
    normalizeTaxRegistration(
      value,
    )

  if (!normalized) {
    return {
      last4:
        '',

      fingerprintSha256:
        '',
    }
  }

  return {
    last4:
      normalized.slice(
        -4,
      ),

    fingerprintSha256:
      crypto
        .createHash(
          'sha256',
        )
        .update(
          normalized,
        )
        .digest(
          'hex',
        ),
  }
}

function serializeOperationalProfile(
  profile,
) {
  if (!profile) {
    return null
  }

  const value =
    typeof profile.toObject ===
    'function'
      ? profile.toObject()
      : profile

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    organizationId:
      id(
        value.organizationId,
      ),

    activationState:
      value.activationState,

    legalEntityName:
      value.legalEntityName ||
      '',

    businessType:
      value.businessType ||
      'other',

    jurisdictionCountryCode:
      value.jurisdictionCountryCode ||
      'IN',

    registeredAddress:
      value.registeredAddress ||
      {},

    supportEmail:
      value.supportEmail ||
      '',

    supportPhone:
      value.supportPhone ||
      '',

    commercial:
      value.commercial ||
      {},

    activationReview:
      value.activationReview ||
      {},

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

function serializeMember(
  member,
) {
  const value =
    typeof member?.toObject ===
    'function'
      ? member.toObject()
      : member

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    organizationId:
      id(
        value.organizationId,
      ),

    userId:
      id(
        value.userId,
      ),

    status:
      value.status,

    roleLabel:
      value.roleLabel ||
      'Staff',

    permissionKeys:
      value.permissionKeys ||
      [],

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

function serializeDocument(
  document,
) {
  const value =
    typeof document?.toObject ===
    'function'
      ? document.toObject()
      : document

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    organizationId:
      id(
        value.organizationId,
      ),

    documentType:
      value.documentType,

    label:
      value.label,

    providerKey:
      value.providerKey ||
      '',

    originalFileName:
      value.originalFileName ||
      '',

    mimeType:
      value.mimeType ||
      '',

    bytes:
      value.bytes ||
      0,

    checksumSha256:
      value.checksumSha256 ||
      '',

    status:
      value.status,

    expiresAt:
      value.expiresAt ||
      null,

    reviewedAt:
      value.reviewedAt ||
      null,

    reviewReason:
      value.reviewReason ||
      '',

    createdAt:
      value.createdAt ||
      null,
  }
}

function serializeKyb(
  kyb,
) {
  const value =
    typeof kyb?.toObject ===
    'function'
      ? kyb.toObject()
      : kyb

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    organizationId:
      id(
        value.organizationId,
      ),

    status:
      value.status,

    legalEntityName:
      value.legalEntityName,

    businessType:
      value.businessType,

    jurisdictionCountryCode:
      value.jurisdictionCountryCode,

    taxRegistration: {
      registrationType:
        value.taxRegistration
          ?.registrationType ||
        '',

      last4:
        value.taxRegistration
          ?.last4 ||
        '',

      storedFullValue:
        false,
    },

    documentIds:
      (
        value.documentIds ||
        []
      ).map(
        id,
      ),

    submittedAt:
      value.submittedAt ||
      null,

    reviewedAt:
      value.reviewedAt ||
      null,

    reviewReason:
      value.reviewReason ||
      '',

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

function serializeImportJob(
  job,
) {
  const value =
    typeof job?.toObject ===
    'function'
      ? job.toObject()
      : job

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    organizationId:
      id(
        value.organizationId,
      ),

    sourceType:
      value.sourceType,

    status:
      value.status,

    rowCount:
      value.rowCount,

    matchedCount:
      value.matchedCount,

    npiRequiredCount:
      value.npiRequiredCount,

    invalidCount:
      value.invalidCount,

    averageDataQualityScore:
      value.averageDataQualityScore,

    createdAt:
      value.createdAt ||
      null,
  }
}

function serializeImportRow(
  row,
) {
  const value =
    typeof row?.toObject ===
    'function'
      ? row.toObject()
      : row

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    rowNumber:
      value.rowNumber,

    merchantSku:
      value.merchantSku ||
      '',

    gtin:
      value.gtin ||
      '',

    requestedPackId:
      id(
        value.requestedPackId,
      ),

    matchedPackId:
      id(
        value.matchedPackId,
      ),

    matchedProductVersionId:
      id(
        value.matchedProductVersionId,
      ),

    state:
      value.state,

    dataQualityScore:
      value.dataQualityScore,

    recipeEligible:
      value.recipeEligible ===
      true,

    issueCodes:
      value.issueCodes ||
      [],

    inputSnapshot:
      value.inputSnapshot ||
      {},

    npiHandoff:
      value.npiHandoff ||
      {},
  }
}

function serializeBrandRecipeSubmission(
  submission,
) {
  const value =
    typeof submission?.toObject ===
    'function'
      ? submission.toObject()
      : submission

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    organizationId:
      id(
        value.organizationId,
      ),

    brandId:
      id(
        value.brandId,
      ),

    authorityGrantId:
      id(
        value.authorityGrantId,
      ),

    marketCode:
      value.marketCode,

    dishId:
      id(
        value.dishId,
      ),

    recipeVersionId:
      id(
        value.recipeVersionId,
      ),

    status:
      value.status,

    nominationDisclosure:
      value.nominationDisclosure,

    nominatedProductPackIds:
      (
        value.nominatedProductPackIds ||
        []
      ).map(
        id,
      ),

    submittedAt:
      value.createdAt ||
      null,

    reviewedAt:
      value.reviewedAt ||
      null,

    reviewReason:
      value.reviewReason ||
      '',
  }
}

function serializeHostRecipeListing(
  recipeVersion,
) {
  const value =
    typeof recipeVersion?.toObject ===
    'function'
      ? recipeVersion.toObject()
      : recipeVersion

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    dishId:
      id(
        value.dishId,
      ),

    title:
      value.title ||
      '',

    versionNumber:
      Number(
        value.versionNumber ||
          1,
      ),

    status:
      value.status ||
      'draft',

    sourceType:
      value.sourceType ||
      'community',

    sourceOrganizationId:
      id(
        value.sourceOrganizationId,
      ),

    submittedAt:
      value.submittedAt ||
      null,

    publishedAt:
      value.publishedAt ||
      null,

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,

    reviewedAt:
      value.reviewedAt ||
      null,

    canEdit:
      [
        'draft',
        'in_review',
        'published',
      ].includes(
        value.status,
      ),

    canDelete:
      [
        'draft',
        'in_review',
        'published',
      ].includes(
        value.status,
      ),
  }
}

function serializeCampaignBrief(
  brief,
) {
  const value =
    typeof brief?.toObject ===
    'function'
      ? brief.toObject()
      : brief

  if (!value) {
    return null
  }

  return {
    id:
      id(
        value._id ||
          value.id,
      ),

    organizationId:
      id(
        value.organizationId,
      ),

    brandId:
      id(
        value.brandId,
      ),

    authorityGrantId:
      id(
        value.authorityGrantId,
      ),

    title:
      value.title,

    objective:
      value.objective,

    marketCodes:
      value.marketCodes ||
      [],

    requestedPlacements:
      value.requestedPlacements ||
      [],

    startsAt:
      value.startsAt ||
      null,

    endsAt:
      value.endsAt ||
      null,

    budget:
      value.budget ||
      {
        amountMinor:
          0,

        currency:
          'INR',
      },

    promotedEntityType:
      value.promotedEntityType,

    promotedEntityId:
      value.promotedEntityId ||
      '',

    commercialDisclosure:
      value.commercialDisclosure,

    status:
      value.status,

    submittedAt:
      value.submittedAt ||
      null,

    createdAt:
      value.createdAt ||
      null,
  }
}


function serializeCommercialProfileRequest(
  request,
) {
  const value =
    typeof request?.toObject === 'function'
      ? request.toObject()
      : request

  if (!value) {
    return null
  }

  return {
    id: id(value._id || value.id),
    organizationId: id(value.organizationId),
    requestedByUserId: id(value.requestedByUserId),
    organizationType: value.organizationType,
    previousOrganizationType: value.previousOrganizationType || null,
    note: value.note || '',
    status: value.status,
    notifiedAdminCount: (value.notifiedAdminUserIds || []).length,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

export async function resolveHostOperationsContext(
  actorUser,
  {
    allowMissing = false,
  } = {},
) {
  const userId =
    actorId(
      actorUser,
    )

  const ownedOrganization =
    await findHostMarketplaceOrganization(
      actorUser,
    )

  if (
    ownedOrganization
  ) {
    return {
      organization:
        ownedOrganization,

      member:
        null,

      isOwner:
        true,

      permissionKeys: [
        ...OWNER_PERMISSION_SET,
      ],
    }
  }

  const member =
    await HostOrganizationMember.findOne({
      userId,

      status:
        'active',
    }).sort({
      createdAt:
        1,
    })

  if (member) {
    const organization =
      await MarketplaceOrganization.findOne({
        _id:
          member.organizationId,

        status:
          'active',
      })

    if (organization) {
      return {
        organization,

        member,

        isOwner:
          false,

        permissionKeys:
          member.permissionKeys ||
          [],
      }
    }
  }

  if (
    allowMissing
  ) {
    return null
  }

  throw new ApiError(
    404,
    'Host organization was not found for this identity.',
    [
      {
        code:
          'HOST_OPERATIONS_ORGANIZATION_NOT_FOUND',
      },
    ],
  )
}

export function contextHasPermission(
  context,
  permissionKey,
) {
  return (
    context?.isOwner ===
      true ||
    (
      context?.permissionKeys ||
      []
    ).includes(
      permissionKey,
    )
  )
}

export function assertHostOperationsPermission(
  context,
  permissionKey,
) {
  if (
    !contextHasPermission(
      context,
      permissionKey,
    )
  ) {
    throw new ApiError(
      403,
      'Host organization permission is required.',
      [
        {
          code:
            'HOST_ORGANIZATION_PERMISSION_REQUIRED',

          permissionKey,
        },
      ],
    )
  }
}

async function ensureOperationalProfile(
  organization,
  actorUser,
) {
  const userId =
    actorId(
      actorUser,
    )

  return HostOperationalProfile.findOneAndUpdate(
    {
      organizationId:
        organization._id,
    },
    {
      $setOnInsert: {
        organizationId:
          organization._id,

        activationState:
          'onboarding',

        createdByUserId:
          userId,
      },

      $set: {
        updatedByUserId:
          userId,
      },
    },
    {
      new:
        true,

      upsert:
        true,

      setDefaultsOnInsert:
        true,
    },
  )
}

export async function createHostOperationsOrganization({
  input,
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const existingContext =
    await resolveHostOperationsContext(
      actorUser,
      {
        allowMissing:
          true,
      },
    )

  if (
    existingContext
  ) {
    const profile =
      await ensureOperationalProfile(
        existingContext.organization,
        actorUser,
      )

    return {
      organization:
        serializeMarketplaceOrganization(
          existingContext.organization,
        ),

      operationalProfile:
        serializeOperationalProfile(
          profile,
        ),

      access: {
        isOwner:
          existingContext.isOwner,

        permissionKeys:
          existingContext.permissionKeys,
      },
    }
  }

  const organizationSlug =
    normalizeMarketplaceKey(
      `host-${id(
        userId,
      )}`,
    )

  let organization =
    null

  try {
    organization =
      await MarketplaceOrganization.create({
        ownerUserId:
          userId,

        displayName:
          input.displayName,

        slug:
          organizationSlug,

        organizationType:
          input.organizationType,

        status:
          'active',

        createdByUserId:
          userId,

        updatedByUserId:
          userId,

        metadata: {
          m16OperationalActivationRequired:
            true,
        },
      })
  } catch (
    error
  ) {
    if (
      error?.code !==
      11000
    ) {
      throw error
    }

    organization =
      await MarketplaceOrganization.findOne({
        ownerUserId:
          userId,
      })
  }

  if (
    !organization
  ) {
    throw new ApiError(
      409,
      'Unable to initialize a unique Host organization identity.',
      [
        {
          code:
            'HOST_OPERATIONS_ORGANIZATION_CONFLICT',
        },
      ],
    )
  }

  const profile =
    await ensureOperationalProfile(
      organization,
      actorUser,
    )

  return {
    organization:
      serializeMarketplaceOrganization(
        organization,
      ),

    operationalProfile:
      serializeOperationalProfile(
        profile,
      ),

    access: {
      isOwner:
        true,

      permissionKeys: [
        ...OWNER_PERMISSION_SET,
      ],
    },
  }
}

export async function getHostOperationsOrganization({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
      {
        allowMissing:
          true,
      },
    )

  if (
    !context
  ) {
    return {
      organization:
        null,

      operationalProfile:
        null,

      access:
        null,

      onboardingRequired:
        true,
    }
  }

  assertHostOperationsPermission(
    context,
    'organization.read',
  )

  const profile =
    await ensureOperationalProfile(
      context.organization,
      actorUser,
    )

  return {
    organization:
      serializeMarketplaceOrganization(
        context.organization,
      ),

    operationalProfile:
      serializeOperationalProfile(
        profile,
      ),

    access: {
      isOwner:
        context.isOwner,

      roleLabel:
        context.member
          ?.roleLabel ||
        (
          context.isOwner
            ? 'Owner'
            : 'Staff'
        ),

      permissionKeys:
        context.permissionKeys,
    },

    onboardingRequired:
      false,
  }
}

export async function updateHostOperationalProfile({
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'organization.manage',
  )

  const userId =
    actorId(
      actorUser,
    )

  const commercialSetupComplete =
    Boolean(
      input.commercial
        .fulfillmentTypes
        .length &&
      input.commercial
        .cancellationPolicySummary &&
      input.commercial
        .returnPolicySummary &&
      input.legalEntityName,
    )

  const profile =
    await HostOperationalProfile.findOneAndUpdate(
      {
        organizationId:
          context.organization._id,
      },
      {
        $set: {
          legalEntityName:
            input.legalEntityName,

          businessType:
            input.businessType,

          jurisdictionCountryCode:
            input.jurisdictionCountryCode,

          registeredAddress:
            input.registeredAddress,

          supportEmail:
            input.supportEmail,

          supportPhone:
            input.supportPhone,

          commercial: {
            ...input.commercial,

            commercialSetupComplete,
          },

          updatedByUserId:
            userId,
        },

        $setOnInsert: {
          activationState:
            'onboarding',

          createdByUserId:
            userId,
        },
      },
      {
        new:
          true,

        upsert:
          true,

        setDefaultsOnInsert:
          true,
      },
    )

  return {
    operationalProfile:
      serializeOperationalProfile(
        profile,
      ),
  }
}


export async function getHostCommercialProfileDeclaration({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(actorUser)

  assertHostOperationsPermission(
    context,
    'organization.read',
  )

  const latestRequest =
    await HostCommercialProfileRequest.findOne({
      organizationId: context.organization._id,
    })
      .sort({
        createdAt: -1,
      })
      .lean()

  return {
    organization: serializeMarketplaceOrganization(
      context.organization,
    ),
    latestRequest: serializeCommercialProfileRequest(
      latestRequest,
    ),
  }
}

export async function submitHostCommercialProfileDeclaration({
  input,
  actorUser,
  correlationId = '',
}) {
  const context =
    await resolveHostOperationsContext(actorUser)

  assertHostOperationsPermission(
    context,
    'organization.manage',
  )

  const organization =
    context.organization

  const previousOrganizationType =
    organization.organizationType || null

  organization.organizationType =
    input.organizationType

  organization.updatedByUserId =
    actorId(actorUser)

  organization.metadata = {
    ...(organization.metadata || {}),
    hostCommercialProfileSelfDeclared: true,
    hostCommercialProfileDeclaredAt: new Date().toISOString(),
  }

  await organization.save()

  const request =
    await HostCommercialProfileRequest.create({
      organizationId: organization._id,
      requestedByUserId: actorId(actorUser),
      organizationType: input.organizationType,
      previousOrganizationType,
      note: input.note || '',
      status: 'declared',
    })

  const superAdmins =
    await User.find({
      superAdminEnabled: true,
      accountStatus: 'active',
    })
      .select('_id')
      .lean()

  const notifiedAdminUserIds = []

  for (const admin of superAdmins) {
    const notificationResult =
      await createNotificationIntentBestEffort({
        userId: admin._id,
        category: 'operations',
        triggerType: 'host_commercial_profile_request',
        reasonCode: `host_declared_${input.organizationType}`,
        explanation: `${organization.displayName} declared its Host commercial profile as ${input.organizationType.toUpperCase()}. Host self-selection is currently enabled; this notification is for Super Admin visibility.`,
        relatedEntityType: 'host_commercial_profile_request',
        relatedEntityId: id(request._id),
        sourceDomain: 'host_operations',
        sourceVersion: 'commercial-profile-v1',
        actions: [
          'accept',
          'dismiss',
        ],
        requestedChannels: [
          'in_app',
        ],
        dedupeKey: `host-commercial-profile:${id(request._id)}:${id(admin._id)}`,
        correlationId,
      })

    if (notificationResult) {
      notifiedAdminUserIds.push(
        admin._id,
      )
    }
  }

  request.notifiedAdminUserIds =
    notifiedAdminUserIds

  await request.save()

  return {
    organization: serializeMarketplaceOrganization(
      organization,
    ),
    request: serializeCommercialProfileRequest(
      request,
    ),
  }
}

export async function listOrganizationMembers({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'team.read',
  )

  const members =
    await HostOrganizationMember.find({
      organizationId:
        id(
          context.organization._id,
        ),
    })
      .sort({
        createdAt:
          1,
      })
      .lean()

  return {
    owner: {
      userId:
        id(
          context.organization
            .ownerUserId,
        ),

      roleLabel:
        'Owner',

      permissionKeys: [
        ...OWNER_PERMISSION_SET,
      ],

      status:
        'active',
    },

    members:
      members.map(
        serializeMember,
      ),
  }
}

export async function addOrganizationMember({
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'team.manage',
  )

  const userId =
    actorId(
      actorUser,
    )

  if (
    id(
      input.userId,
    ) ===
    id(
      context.organization
        .ownerUserId,
    )
  ) {
    throw new ApiError(
      409,
      'Organization owner already has full tenant authority.',
      [
        {
          code:
            'HOST_ORG_OWNER_ALREADY_MEMBER',
        },
      ],
    )
  }

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
    })
      .select(
        '_id name email',
      )
      .lean()

  if (
    !targetUser
  ) {
    throw new ApiError(
      409,
      'Team member must already have active Host capability.',
      [
        {
          code:
            'HOST_ORG_MEMBER_ACTIVE_HOST_REQUIRED',
        },
      ],
    )
  }

  const [
    otherOwnedOrganization,
    otherActiveMembership,
  ] =
    await Promise.all([
      MarketplaceOrganization.exists({
        ownerUserId:
          targetUser._id,

        _id: {
          $ne:
            context.organization._id,
        },
      }),

      HostOrganizationMember.exists({
        userId:
          targetUser._id,

        organizationId: {
          $ne:
            context.organization._id,
        },

        status:
          'active',
      }),
    ])

  if (
    otherOwnedOrganization ||
    otherActiveMembership
  ) {
    throw new ApiError(
      409,
      'This Host identity is already bound to another active organization context.',
      [
        {
          code:
            'HOST_ORG_MEMBER_MULTI_TENANT_CONTEXT_NOT_SUPPORTED',
        },
      ],
    )
  }

  const member =
    await HostOrganizationMember.findOneAndUpdate(
      {
        organizationId:
          context.organization._id,

        userId:
          targetUser._id,
      },
      {
        $set: {
          status:
            'active',

          roleLabel:
            input.roleLabel,

          permissionKeys:
            uniq(
              input.permissionKeys,
            ),

          updatedByUserId:
            userId,
        },

        $setOnInsert: {
          invitedByUserId:
            userId,

          createdByUserId:
            userId,
        },
      },
      {
        new:
          true,

        upsert:
          true,

        setDefaultsOnInsert:
          true,
      },
    )

  return {
    member:
      serializeMember(
        member,
      ),

    user: {
      id:
        id(
          targetUser._id,
        ),

      name:
        targetUser.name,

      email:
        targetUser.email,
    },
  }
}

export async function updateOrganizationMember({
  memberId,
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'team.manage',
  )

  const member =
    await HostOrganizationMember.findOne({
      _id:
        memberId,

      organizationId:
        context.organization._id,
    })

  if (
    !member
  ) {
    throw new ApiError(
      404,
      'Organization member was not found.',
      [
        {
          code:
            'HOST_ORG_MEMBER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    input.status
  ) {
    member.status =
      input.status
  }

  if (
    input.roleLabel
  ) {
    member.roleLabel =
      input.roleLabel
  }

  if (
    input.permissionKeys
  ) {
    member.permissionKeys =
      uniq(
        input.permissionKeys,
      )
  }

  member.updatedByUserId =
    actorId(
      actorUser,
    )

  await member.save()

  return {
    member:
      serializeMember(
        member,
      ),
  }
}

export async function registerOrganizationDocument({
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'documents.manage',
  )

  if (
    !input.providerAssetId &&
    !input.checksumSha256
  ) {
    throw new ApiError(
      400,
      'A private storage asset reference or SHA-256 checksum is required.',
      [
        {
          code:
            'HOST_DOCUMENT_EVIDENCE_REFERENCE_REQUIRED',
        },
      ],
    )
  }

  const document =
    await HostOrganizationDocument.create({
      organizationId:
        context.organization._id,

      ...input,

      createdByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    document:
      serializeDocument(
        document,
      ),
  }
}

export async function listOrganizationDocuments({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'documents.read',
  )

  const documents =
    await HostOrganizationDocument.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  return {
    documents:
      documents.map(
        serializeDocument,
      ),
  }
}

export async function upsertHostKybCase({
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'kyb.manage',
  )

  const userId =
    actorId(
      actorUser,
    )

  const current =
    await HostKybCase.findOne({
      organizationId:
        context.organization._id,
    })

  if (
    current &&
    [
      'submitted',
      'approved',
    ].includes(
      current.status,
    )
  ) {
    throw new ApiError(
      409,
      'Submitted or approved KYB cannot be edited directly.',
      [
        {
          code:
            'HOST_KYB_EDIT_STATE_INVALID',
        },
      ],
    )
  }

  if (
    input.documentIds.length
  ) {
    const documentCount =
      await HostOrganizationDocument.countDocuments({
        _id: {
          $in:
            input.documentIds,
        },

        organizationId:
          context.organization._id,
      })

    if (
      documentCount !==
      input.documentIds.length
    ) {
      throw new ApiError(
        400,
        'Every KYB document must belong to the same Host organization.',
        [
          {
            code:
              'HOST_KYB_DOCUMENT_SCOPE_INVALID',
          },
        ],
      )
    }
  }

  const fingerprint =
    taxFingerprint(
      input.taxRegistrationValue,
    )

  const kyb =
    await HostKybCase.findOneAndUpdate(
      {
        organizationId:
          context.organization._id,
      },
      {
        $set: {
          legalEntityName:
            input.legalEntityName,

          businessType:
            input.businessType,

          jurisdictionCountryCode:
            input.jurisdictionCountryCode,

          taxRegistration: {
            registrationType:
              input.taxRegistrationType,

            ...fingerprint,
          },

          documentIds:
            input.documentIds,

          status:
            'draft',

          reviewReason:
            '',

          updatedByUserId:
            userId,
        },

        $setOnInsert: {
          createdByUserId:
            userId,
        },
      },
      {
        new:
          true,

        upsert:
          true,

        setDefaultsOnInsert:
          true,
      },
    )

  return {
    kyb:
      serializeKyb(
        kyb,
      ),
  }
}

export async function getHostKybCase({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'kyb.read',
  )

  const kyb =
    await HostKybCase.findOne({
      organizationId:
        context.organization._id,
    }).lean()

  return {
    kyb:
      serializeKyb(
        kyb,
      ),
  }
}

export async function submitHostKybCase({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'kyb.manage',
  )

  const kyb =
    await HostKybCase.findOne({
      organizationId:
        context.organization._id,
    })

  if (
    !kyb
  ) {
    throw new ApiError(
      409,
      'Create the KYB case before submission.',
      [
        {
          code:
            'HOST_KYB_REQUIRED',
        },
      ],
    )
  }

  if (
    ![
      'draft',
      'needs_information',
      'rejected',
    ].includes(
      kyb.status,
    )
  ) {
    throw new ApiError(
      409,
      'KYB cannot be submitted from its current state.',
      [
        {
          code:
            'HOST_KYB_SUBMIT_STATE_INVALID',
        },
      ],
    )
  }

  if (
    !kyb.documentIds.length ||
    !kyb.legalEntityName
  ) {
    throw new ApiError(
      409,
      'Legal entity information and at least one scoped evidence document are required.',
      [
        {
          code:
            'HOST_KYB_INCOMPLETE',
        },
      ],
    )
  }

  kyb.status =
    'submitted'

  kyb.submittedAt =
    new Date()

  kyb.reviewReason =
    ''

  kyb.updatedByUserId =
    actorId(
      actorUser,
    )

  await kyb.save()

  return {
    kyb:
      serializeKyb(
        kyb,
      ),
  }
}

async function evaluateOperationalReadiness(
  organizationId,
) {
  const [
    profile,
    kyb,
    documentCount,
    importJob,
    activeOfferCount,
    priceCount,
    inventoryCount,
    serviceAreaCount,
  ] =
    await Promise.all([
      HostOperationalProfile.findOne({
        organizationId,
      }).lean(),

      HostKybCase.findOne({
        organizationId,
      }).lean(),

      HostOrganizationDocument.countDocuments({
        organizationId,

        status: {
          $in: [
            'registered',
            'accepted',
          ],
        },
      }),

      HostCatalogIngestJob.findOne({
        organizationId,

        matchedCount: {
          $gt:
            0,
        },
      })
        .sort({
          createdAt:
            -1,
        })
        .lean(),

      HostOffer.countDocuments({
        organizationId,

        status:
          'active',
      }),

      PriceRule.countDocuments({
        organizationId,

        status: {
          $in: [
            'active',
            'scheduled',
          ],
        },
      }),

      InventorySnapshot.countDocuments({
        organizationId,
      }),

      ServiceArea.countDocuments({
        organizationId,

        status:
          'active',
      }),
    ])

  const checks = {
    profileComplete:
      Boolean(
        profile?.legalEntityName,
      ),

    kybApproved:
      kyb?.status ===
      'approved',

    commercialSetupComplete:
      profile
        ?.commercial
        ?.commercialSetupComplete ===
      true,

    documentsPresent:
      documentCount >
      0,

    catalogValidated:
      Boolean(
        importJob,
      ),

    activeOfferPresent:
      activeOfferCount >
      0,

    pricingConfigured:
      priceCount >
      0,

    inventoryObserved:
      inventoryCount >
      0,

    serviceabilityConfigured:
      serviceAreaCount >
      0,
  }

  return {
    checks,

    readyForActivationRequest:
      Object.values(
        checks,
      ).every(
        Boolean,
      ),

    activationState:
      profile?.activationState ||
      'onboarding',

    counts: {
      documents:
        documentCount,

      activeOffers:
        activeOfferCount,

      priceRules:
        priceCount,

      inventorySnapshots:
        inventoryCount,

      serviceAreas:
        serviceAreaCount,
    },
  }
}

export async function getHostOperationalReadiness({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'organization.read',
  )

  return {
    readiness:
      await evaluateOperationalReadiness(
        context.organization._id,
      ),
  }
}

export async function requestHostOperationalActivation({
  reason,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'organization.manage',
  )

  const readiness =
    await evaluateOperationalReadiness(
      context.organization._id,
    )

  if (
    [
      'active',
      'suspended',
    ].includes(
      readiness.activationState,
    )
  ) {
    throw new ApiError(
      409,
      'This organization cannot request activation from its current operational state.',
      [
        {
          code:
            'HOST_OPERATIONAL_ACTIVATION_REQUEST_STATE_INVALID',

          activationState:
            readiness.activationState,
        },
      ],
    )
  }

  if (
    !readiness.readyForActivationRequest
  ) {
    throw new ApiError(
      409,
      'Operational activation readiness checks are incomplete.',
      [
        {
          code:
            'HOST_OPERATIONAL_READINESS_INCOMPLETE',

          checks:
            readiness.checks,
        },
      ],
    )
  }

  const profile =
    await ensureOperationalProfile(
      context.organization,
      actorUser,
    )

  profile.activationState =
    'pending_review'

  profile.activationReview.requestedAt =
    new Date()

  profile.activationReview.reason =
    reason

  profile.updatedByUserId =
    actorId(
      actorUser,
    )

  await profile.save()

  return {
    operationalProfile:
      serializeOperationalProfile(
        profile,
      ),

    readiness,
  }
}

function productDataQuality(
  productVersion,
) {
  if (
    !productVersion
  ) {
    return {
      score:
        0,

      recipeEligible:
        false,

      issueCodes: [
        'NO_CANONICAL_PRODUCT_MATCH',
        'NPI_REQUIRED',
      ],
    }
  }

  let score =
    30

  const issues =
    []

  if (
    productVersion.gtin
  ) {
    score +=
      10
  } else {
    issues.push(
      'GTIN_MISSING',
    )
  }

  const hasIngredientEvidence =
    Boolean(
      productVersion
        .ingredientDeclarationText ||
      productVersion
        .ingredients
        ?.length,
    )

  if (
    hasIngredientEvidence
  ) {
    score +=
      15
  } else {
    issues.push(
      'INGREDIENT_EVIDENCE_MISSING',
    )
  }

  const allergenRows =
    productVersion.allergens ||
    []

  const hasReviewedAllergens =
    allergenRows.length >
      0 &&
    allergenRows.every(
      (
        item,
      ) =>
        item.evidenceState !==
        'unknown_review_required',
    )

  if (
    hasReviewedAllergens
  ) {
    score +=
      15
  } else {
    issues.push(
      'ALLERGEN_EVIDENCE_INCOMPLETE',
    )
  }

  if (
    productVersion
      .nutrition
      ?.basis &&
    productVersion
      .nutrition
      ?.nutrients
      ?.length
  ) {
    score +=
      10
  } else {
    issues.push(
      'NUTRITION_INCOMPLETE',
    )
  }

  const reviewedProvenance =
    (
      productVersion.provenance ||
      []
    ).filter(
      (
        item,
      ) =>
        item.evidenceState !==
        'unknown_review_required',
    )

  if (
    reviewedProvenance.length
  ) {
    score +=
      10
  } else {
    issues.push(
      'PROVENANCE_REVIEW_REQUIRED',
    )
  }

  if (
    productVersion
      .netQuantity
      ?.value >
      0 &&
    productVersion
      .netQuantity
      ?.unit
  ) {
    score +=
      5
  } else {
    issues.push(
      'NET_QUANTITY_INCOMPLETE',
    )
  }

  if (
    productVersion
      .images
      ?.length
  ) {
    score +=
      3
  } else {
    issues.push(
      'PACK_IMAGE_MISSING',
    )
  }

  if (
    productVersion
      .manufacturerName ||
    productVersion
      .countryOfOrigin
  ) {
    score +=
      2
  }

  const recipeEligible =
    score >=
      75 &&
    hasIngredientEvidence &&
    hasReviewedAllergens

  if (
    !recipeEligible
  ) {
    issues.push(
      'NOT_RECIPE_ELIGIBLE',
    )
  }

  return {
    score:
      Math.min(
        100,
        score,
      ),

    recipeEligible,

    issueCodes:
      uniq(
        issues,
      ),
  }
}

async function resolveImportRow(
  row,
) {
  let productVersion =
    null

  if (
    row.packId
  ) {
    productVersion =
      await ProductVersion.findOne(
        buildCurrentPublishedPackVersionFilter(
          row.packId,
        ),
      )
        .sort({
          version:
            -1,
        })
        .lean()
  }

  if (
    !productVersion &&
    row.gtin
  ) {
    productVersion =
      await ProductVersion.findOne({
        gtin:
          row.gtin,

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
                    new Date(),
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
                    new Date(),
                },
              },
            ],
          },
        ],
      })
        .sort({
          effectiveFrom:
            -1,

          version:
            -1,
        })
        .lean()
  }

  if (
    productVersion
  ) {
    const quality =
      productDataQuality(
        productVersion,
      )

    return {
      state:
        'canonical_match',

      matchedPackId:
        productVersion.packId,

      matchedProductVersionId:
        productVersion._id,

      ...quality,

      npiHandoff: {
        required:
          false,

        nextPath:
          '',

        reason:
          '',
      },
    }
  }

  if (
    row.gtin ||
    row.displayName
  ) {
    return {
      state:
        'needs_npi',

      matchedPackId:
        null,

      matchedProductVersionId:
        null,

      score:
        row.gtin
          ? 20
          : 10,

      recipeEligible:
        false,

      issueCodes: [
        'NO_CANONICAL_PRODUCT_MATCH',
        'NPI_REQUIRED',
      ],

      npiHandoff: {
        required:
          true,

        nextPath:
          '/host/product-intelligence',

        reason:
          'Use M14 AI-assisted NPI/evidence flow. Imported facts remain provisional until governed review.',
      },
    }
  }

  return {
    state:
      'invalid',

    matchedPackId:
      null,

    matchedProductVersionId:
      null,

    score:
      0,

    recipeEligible:
      false,

    issueCodes: [
      'INSUFFICIENT_PRODUCT_IDENTITY',
    ],

    npiHandoff: {
      required:
        false,

      nextPath:
        '',

      reason:
        '',
    },
  }
}

export async function createCatalogIngestJob({
  input,
  idempotencyKey,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'catalog.ingest',
  )

  const userId =
    actorId(
      actorUser,
    )

  const existing =
    await HostCatalogIngestJob.findOne({
      organizationId:
        context.organization._id,

      idempotencyKey,
    }).lean()

  if (
    existing
  ) {
    return getCatalogIngestJob({
      jobId:
        existing._id,

      actorUser,
    })
  }

  const resolvedRows =
    []

  for (
    let index =
      0;
    index <
    input.rows.length;
    index +=
      1
  ) {
    const row =
      input.rows[
        index
      ]

    resolvedRows.push({
      rowNumber:
        index +
        1,

      row,

      result:
        await resolveImportRow(
          row,
        ),
    })
  }

  const matchedCount =
    resolvedRows.filter(
      (
        item,
      ) =>
        item.result
          .state ===
        'canonical_match',
    ).length

  const npiRequiredCount =
    resolvedRows.filter(
      (
        item,
      ) =>
        item.result
          .state ===
        'needs_npi',
    ).length

  const invalidCount =
    resolvedRows.filter(
      (
        item,
      ) =>
        item.result
          .state ===
        'invalid',
    ).length

  const averageDataQualityScore =
    Number(
      (
        resolvedRows.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.result
              .score,

          0,
        ) /
        resolvedRows.length
      ).toFixed(
        2,
      ),
    )

  const job =
    await HostCatalogIngestJob.create({
      organizationId:
        context.organization._id,

      sourceType:
        input.sourceType,

      status:
        invalidCount ||
        npiRequiredCount
          ? 'completed_with_issues'
          : 'completed',

      rowCount:
        resolvedRows.length,

      matchedCount,

      npiRequiredCount,

      invalidCount,

      averageDataQualityScore,

      idempotencyKey,

      createdByUserId:
        userId,
    })

  await HostCatalogIngestRow.insertMany(
    resolvedRows.map(
      ({
        rowNumber,
        row,
        result,
      }) => ({
        organizationId:
          context.organization._id,

        jobId:
          job._id,

        rowNumber,

        merchantSku:
          row.merchantSku,

        gtin:
          row.gtin,

        requestedPackId:
          row.packId,

        matchedPackId:
          result.matchedPackId,

        matchedProductVersionId:
          result.matchedProductVersionId,

        state:
          result.state,

        dataQualityScore:
          result.score,

        recipeEligible:
          result.recipeEligible,

        issueCodes:
          result.issueCodes,

        inputSnapshot:
          row,

        npiHandoff:
          result.npiHandoff,
      }),
    ),
  )

  return getCatalogIngestJob({
    jobId:
      job._id,

    actorUser,
  })
}

export async function listCatalogIngestJobs({
  page,
  limit,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'catalog.read',
  )

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    jobs,
    total,
  ] =
    await Promise.all([
      HostCatalogIngestJob.find({
        organizationId:
          context.organization._id,
      })
        .sort({
          createdAt:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      HostCatalogIngestJob.countDocuments({
        organizationId:
          context.organization._id,
      }),
    ])

  return {
    jobs:
      jobs.map(
        serializeImportJob,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function getCatalogIngestJob({
  jobId,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'catalog.read',
  )

  const job =
    await HostCatalogIngestJob.findOne({
      _id:
        jobId,

      organizationId:
        context.organization._id,
    }).lean()

  if (
    !job
  ) {
    throw new ApiError(
      404,
      'Catalog ingest job was not found.',
      [
        {
          code:
            'HOST_CATALOG_INGEST_JOB_NOT_FOUND',
        },
      ],
    )
  }

  const rows =
    await HostCatalogIngestRow.find({
      jobId:
        job._id,

      organizationId:
        context.organization._id,
    })
      .sort({
        rowNumber:
          1,
      })
      .lean()

  return {
    job:
      serializeImportJob(
        job,
      ),

    rows:
      rows.map(
        serializeImportRow,
      ),

    policy: {
      canonicalProductMutationPerformed:
        false,

      automaticOfferCreationPerformed:
        false,

      npiUsesM14:
        true,

      externalOrAiFactsAreCanonical:
        false,
    },
  }
}

export async function getCatalogDataQualitySummary({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'catalog.read',
  )

  const rows =
    await HostCatalogIngestRow.find({
      organizationId:
        context.organization._id,
    }).lean()

  const latestByIdentity =
    new Map()

  for (
    const row of rows.sort(
      (
        a,
        b,
      ) =>
        new Date(
          b.createdAt,
        ) -
        new Date(
          a.createdAt,
        ),
    )
  ) {
    const key =
      row.merchantSku ||
      row.gtin ||
      id(
        row.requestedPackId,
      ) ||
      id(
        row._id,
      )

    if (
      !latestByIdentity.has(
        key,
      )
    ) {
      latestByIdentity.set(
        key,
        row,
      )
    }
  }

  const values = [
    ...latestByIdentity.values(),
  ]

  const average =
    values.length
      ? Number(
          (
            values.reduce(
              (
                total,
                row,
              ) =>
                total +
                Number(
                  row.dataQualityScore ||
                    0,
                ),

              0,
            ) /
            values.length
          ).toFixed(
            2,
          ),
        )
      : 0

  return {
    summary: {
      productsObserved:
        values.length,

      canonicalMatches:
        values.filter(
          (
            row,
          ) =>
            row.state ===
            'canonical_match',
        ).length,

      npiRequired:
        values.filter(
          (
            row,
          ) =>
            row.state ===
            'needs_npi',
        ).length,

      recipeEligible:
        values.filter(
          (
            row,
          ) =>
            row.recipeEligible ===
            true,
        ).length,

      averageDataQualityScore:
        average,

      issueCounts:
        values.reduce(
          (
            acc,
            row,
          ) => {
            for (
              const code of
                row.issueCodes ||
                []
            ) {
              acc[
                code
              ] =
                (
                  acc[
                    code
                  ] ||
                  0
                ) +
                1
            }

            return acc
          },
          {},
        ),
    },

    policy: {
      unknownAllergenEvidenceIsNotFreeFrom:
        true,

      recipeEligibilityRequiresReviewedSafetyEvidence:
        true,
    },
  }
}

function normalizeHostRecipeIngredientName(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .replace(
      /\s+/g,
      ' ',
    )
    .slice(
      0,
      220,
    )
}

function normalizeOptionalObjectIdText(
  value,
) {
  const normalized =
    String(
      value ??
        '',
    ).trim()

  if (
    !normalized ||
    [
      'null',
      'undefined',
    ].includes(
      normalized.toLowerCase(),
    )
  ) {
    return ''
  }

  return /^[a-f\d]{24}$/i.test(
    normalized,
  )
    ? normalized
    : ''
}

async function resolveHostRecipeIngredientRows({
  ingredients,
  context,
  actorUser,
}) {
  if (
    !Array.isArray(
      ingredients,
    ) ||
    ingredients.length <
      1
  ) {
    throw new ApiError(
      400,
      'Host Recipe requires at least one ingredient.',
      [
        {
          code:
            'HOST_RECIPE_INGREDIENT_REQUIRED',
        },
      ],
    )
  }

  const resolved = []
  const proposedAt =
    new Date()
  const proposedByUserId =
    actorId(
      actorUser,
    )

  for (
    const ingredient of
      ingredients
  ) {
    const requestedCanonicalId =
      normalizeOptionalObjectIdText(
        ingredient?.canonicalIngredientId,
      )

    if (requestedCanonicalId) {
      const matchedCanonicalIngredient =
        await CanonicalIngredient
          .findOne({
            _id:
              requestedCanonicalId,

            status: {
              $ne:
                'retired',
            },
          })
          .lean()

      if (matchedCanonicalIngredient) {
        resolved.push({
          ...ingredient,
          canonicalIngredientId:
            id(
              matchedCanonicalIngredient._id,
            ),
        })

        continue
      }
    }

    const proposedName =
      normalizeHostRecipeIngredientName(
        ingredient?.proposedIngredientName ||
        ingredient?.ingredientName ||
        ingredient?.ingredientQuery,
      )

    if (!proposedName) {
      throw new ApiError(
        400,
        'Every Host Recipe ingredient needs either a canonical match or a proposed ingredient name.',
        [
          {
            code:
              'HOST_RECIPE_INGREDIENT_NAME_REQUIRED',
          },
        ],
      )
    }

    const slug =
      normalizeCatalogSlug(
        proposedName,
      )

    if (!slug) {
      throw new ApiError(
        400,
        'Host Recipe ingredient name could not be normalized.',
        [
          {
            code:
              'HOST_RECIPE_INGREDIENT_NAME_INVALID',

            proposedIngredientName:
              proposedName,
          },
        ],
      )
    }

    let canonicalIngredient =
      await CanonicalIngredient.findOne({
        slug,
      })

    if (
      canonicalIngredient?.status ===
        'retired'
    ) {
      throw new ApiError(
        409,
        'A retired canonical Ingredient already uses this name. Super Admin must resolve it before the Recipe can be submitted.',
        [
          {
            code:
              'HOST_RECIPE_INGREDIENT_RETIRED_CONFLICT',

            proposedIngredientName:
              proposedName,
          },
        ],
      )
    }

    if (
      canonicalIngredient?.status ===
        'disabled' &&
      canonicalIngredient
        ?.attributes
        ?.hostRecipeProposal
        ?.state !==
        'pending'
    ) {
      throw new ApiError(
        409,
        'A disabled canonical Ingredient already uses this name. Super Admin must resolve it before the Recipe can be submitted.',
        [
          {
            code:
              'HOST_RECIPE_INGREDIENT_DISABLED_CONFLICT',

            proposedIngredientName:
              proposedName,
          },
        ],
      )
    }

    if (!canonicalIngredient) {
      try {
        canonicalIngredient =
          await CanonicalIngredient.create({
            canonicalName:
              proposedName,

            slug,

            aliases:
              [],

            parentId:
              null,

            status:
              'disabled',

            attributes: {
              hostRecipeProposal: {
                state:
                  'pending',

                proposedName,

                organizationId:
                  id(
                    context.organization._id,
                  ),

                proposedByUserId:
                  id(
                    proposedByUserId,
                  ),

                proposedAt,
              },
            },

            createdByUserId:
              proposedByUserId,

            updatedByUserId:
              proposedByUserId,
          })
      } catch (
        error
      ) {
        if (
          error?.code !==
          11000
        ) {
          throw error
        }

        canonicalIngredient =
          await CanonicalIngredient.findOne({
            slug,
          })
      }
    }

    if (!canonicalIngredient) {
      throw new ApiError(
        500,
        'Host Recipe proposed Ingredient could not be staged for Super Admin review.',
        [
          {
            code:
              'HOST_RECIPE_INGREDIENT_PROPOSAL_FAILED',

            proposedIngredientName:
              proposedName,
          },
        ],
      )
    }

    resolved.push({
      ...ingredient,

      canonicalIngredientId:
        id(
          canonicalIngredient._id,
        ),
    })
  }

  for (
    const ingredient of
      resolved
  ) {
    const canonicalIngredientId =
      normalizeOptionalObjectIdText(
        ingredient?.canonicalIngredientId,
      )

    if (!canonicalIngredientId) {
      throw new ApiError(
        500,
        'Host Recipe Ingredient resolution produced an invalid canonical identity.',
        [
          {
            code:
              'HOST_RECIPE_INGREDIENT_CANONICAL_ID_INVALID',
          },
        ],
      )
    }

    ingredient.canonicalIngredientId =
      canonicalIngredientId
  }

  return resolved.map(
    (
      ingredient,
    ) => {
      const {
        proposedIngredientName,
        ingredientName,
        ingredientQuery,
        ...recipeIngredient
      } = ingredient

      return recipeIngredient
    },
  )
}


export async function createHostRecipeImageUploadIntent({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.submit',
  )

  const userId =
    actorId(
      actorUser,
    )

  try {
    return {
      uploadIntent:
        createRecipeImageUploadIntent({
          userId,
        }),
    }
  } catch (error) {
    throw new ApiError(
      503,
      'Recipe image upload is temporarily unavailable.',
      [
        {
          code:
            error?.code ||
            'RECIPE_IMAGE_PROVIDER_UNAVAILABLE',
        },
      ],
    )
  }
}

function parseOptionalHostRecipeFoodIntelligence(
  input,
) {
  const raw =
    input?.foodIntelligence

  if (!raw) {
    return null
  }

  const parsed =
    declareRecipeFoodIntelligenceSchema.safeParse(
      raw,
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Invalid Host Recipe Food Intelligence declaration.',
      [
        {
          code:
            'HOST_RECIPE_FOOD_INTELLIGENCE_INVALID',

          issues:
            parsed.error.issues,
        },
      ],
    )
  }

  return parsed.data
}

function stripHostRecipeFoodIntelligence(
  input,
) {
  const {
    foodIntelligence,
    ...recipeInput
  } =
    input ||
    {}

  return recipeInput
}

export async function createHostRecipeListing({
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.submit',
  )

  const userId =
    actorId(
      actorUser,
    )

  const foodIntelligenceInput =
    parseOptionalHostRecipeFoodIntelligence(
      input,
    )

  const recipeListingInput =
    stripHostRecipeFoodIntelligence(
      input,
    )

  const resolvedIngredients =
    await resolveHostRecipeIngredientRows({
      ingredients:
        recipeListingInput?.ingredients,

      context,
      actorUser,
    })

  const recipeInput = {
    ...recipeListingInput,

    ingredients:
      resolvedIngredients,

    source: {
      type:
        'community',

      name:
        context.organization
          ?.displayName ||
        'Host Recipe',

      url:
        '',

      brandId:
        null,

      organizationId:
        id(
          context.organization._id,
        ),
    },
  }

  const parsedRecipeInput =
    createAdminRecipeSchema.safeParse(
      recipeInput,
    )

  if (
    !parsedRecipeInput.success
  ) {
    throw new ApiError(
      400,
      parsedRecipeInput.error
        .issues[0]
        ?.message ||
        'Invalid Host Recipe listing.',
      [
        {
          code:
            'HOST_RECIPE_INPUT_INVALID',

          issues:
            parsedRecipeInput.error
              .issues,
        },
      ],
    )
  }

  const created =
    await createAdminRecipe(
      parsedRecipeInput.data,
      actorUser,
    )

  const submittedAt =
    new Date()

  const submittedRecipeVersion =
    await RecipeVersion.findOneAndUpdate(
      {
        _id:
          created.recipeVersion.id,

        createdByUserId:
          userId,

        status:
          'draft',
      },
      {
        $set: {
          status:
            'in_review',

          submittedAt,

          submittedByUserId:
            userId,

          changeReason:
            'Submitted by Host for Super Admin review.',
        },
      },
      {
        new:
          true,
      },
    )

  if (!submittedRecipeVersion) {
    throw new ApiError(
      409,
      'Host Recipe could not enter the Super Admin review state.',
      [
        {
          code:
            'HOST_RECIPE_REVIEW_STATE_INVALID',
        },
      ],
    )
  }

  if (
    foodIntelligenceInput
  ) {
    await submitRecipeFoodIntelligenceDeclaration(
      submittedRecipeVersion._id,
      foodIntelligenceInput,
      actorUser,
    )
  }

  const foodIntelligence =
    await getLatestRecipeFoodIntelligenceDeclaration(
      submittedRecipeVersion._id,
    )

  await notifyActiveSuperAdminsBestEffort({
    triggerType:
      'host_listing_created',
    reasonCode:
      'host_recipe_listing_created',
    explanation: `${context.organization?.displayName || 'Host'} created a Recipe listing and submitted it for Super Admin review.`,
    relatedEntityType:
      'host_recipe_listing',
    relatedEntityId:
      id(
        submittedRecipeVersion._id,
      ),
    sourceDomain:
      'host_operations',
    sourceVersion:
      'host-recipe-v1',
    dedupeScope: `host-recipe-created:${id(submittedRecipeVersion._id)}`,
  })

  return {
    listing:
      serializeHostRecipeListing(
        submittedRecipeVersion,
      ),

    recipe:
      await getAdminRecipeVersion(
        created.recipeVersion.id,
      ),

    foodIntelligence,

    policy: {
      hostCanSubmit:
        true,

      hostCanPublish:
        false,

      superAdminApprovalRequired:
        true,
    },
  }
}

function hostRecipeDraftPayload(
  parsedRecipeInput,
) {
  const {
    name,
    slug,
    description,
    cuisine,
    course,
    tags,
    language,
    heroImageUrl,
    ...draftPayload
  } = parsedRecipeInput

  return draftPayload
}

async function requireOwnedHostRecipeVersion({
  recipeVersionId,
  context,
}) {
  const recipeVersion =
    await RecipeVersion.findOne({
      _id:
        recipeVersionId,

      sourceOrganizationId:
        context.organization._id,
    })

  if (!recipeVersion) {
    throw new ApiError(
      404,
      'Host Recipe listing was not found.',
      [
        {
          code:
            'HOST_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  return recipeVersion
}

export async function getHostRecipeListing({
  recipeVersionId,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.read',
  )

  const recipeVersion =
    await requireOwnedHostRecipeVersion({
      recipeVersionId,
      context,
    })

  const foodIntelligence =
    await getLatestRecipeFoodIntelligenceDeclaration(
      recipeVersion._id,
    )

  return {
    listing:
      serializeHostRecipeListing(
        recipeVersion,
      ),

    recipe:
      await getAdminRecipeVersion(
        recipeVersion._id,
      ),

    foodIntelligence,

    policy: {
      hostCanEdit:
        [
          'draft',
          'in_review',
          'published',
        ].includes(
          recipeVersion.status,
        ),

      hostCanDelete:
        [
          'draft',
          'in_review',
          'published',
        ].includes(
          recipeVersion.status,
        ),

      hostCanPublish:
        false,

      superAdminApprovalRequired:
        true,
    },
  }
}

export async function updateHostRecipeListing({
  recipeVersionId,
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.submit',
  )

  const userId =
    actorId(
      actorUser,
    )

  let recipeVersion =
    await requireOwnedHostRecipeVersion({
      recipeVersionId,
      context,
    })

  if (
    ![
      'draft',
      'in_review',
      'published',
    ].includes(
      recipeVersion.status,
    )
  ) {
    throw new ApiError(
      409,
      'This Host Recipe listing cannot be edited from its current lifecycle state.',
      [
        {
          code:
            'HOST_RECIPE_EDIT_STATE_INVALID',
        },
      ],
    )
  }

  const foodIntelligenceInput =
    parseOptionalHostRecipeFoodIntelligence(
      input,
    )

  const recipeListingInput =
    stripHostRecipeFoodIntelligence(
      input,
    )

  const resolvedIngredients =
    await resolveHostRecipeIngredientRows({
      ingredients:
        recipeListingInput?.ingredients,

      context,
      actorUser,
    })

  const recipeInput = {
    ...recipeListingInput,

    ingredients:
      resolvedIngredients,

    source: {
      type:
        'community',

      name:
        context.organization
          ?.displayName ||
        'Host Recipe',

      url:
        '',

      brandId:
        null,

      organizationId:
        id(
          context.organization._id,
        ),
    },
  }

  const parsedRecipeInput =
    createAdminRecipeSchema.safeParse(
      recipeInput,
    )

  if (
    !parsedRecipeInput.success
  ) {
    throw new ApiError(
      400,
      parsedRecipeInput.error
        .issues[0]
        ?.message ||
        'Invalid Host Recipe listing.',
      [
        {
          code:
            'HOST_RECIPE_INPUT_INVALID',

          issues:
            parsedRecipeInput.error
              .issues,
        },
      ],
    )
  }

  if (
    recipeVersion.status ===
    'published'
  ) {
    const nextVersion =
      await createNextAdminRecipeVersion(
        recipeVersion.dishId,
        {
          sourceRecipeVersionId:
            id(
              recipeVersion._id,
            ),

          changeReason:
            'Host created a governed revision from the published Recipe listing.',
        },
        actorUser,
      )

    recipeVersion =
      await requireOwnedHostRecipeVersion({
        recipeVersionId:
          nextVersion.recipeVersion.id,

        context,
      })
  }

  const wasInReview =
    recipeVersion.status ===
    'in_review'

  if (wasInReview) {
    const transition =
      await RecipeVersion.updateOne(
        {
          _id:
            recipeVersion._id,

          status:
            'in_review',
        },
        {
          $set: {
            status:
              'draft',

            changeReason:
              'Host editing before Super Admin review.',
          },
        },
      )

    if (
      transition.modifiedCount !==
      1
    ) {
      throw new ApiError(
        409,
        'Recipe review state changed before the edit could begin.',
        [
          {
            code:
              'HOST_RECIPE_EDIT_CONFLICT',
          },
        ],
      )
    }
  }

  try {
    await updateAdminRecipeDraft(
      recipeVersion._id,
      hostRecipeDraftPayload(
        parsedRecipeInput.data,
      ),
      actorUser,
    )

    await Dish.updateOne(
      {
        _id:
          recipeVersion.dishId,
      },
      {
        $set: {
          name:
            parsedRecipeInput.data.name,

          description:
            parsedRecipeInput.data.description,

          cuisine:
            parsedRecipeInput.data.cuisine,

          course:
            parsedRecipeInput.data.course,

          tags:
            parsedRecipeInput.data.tags,

          language:
            parsedRecipeInput.data.language,

          heroImageUrl:
            parsedRecipeInput.data.heroImageUrl,
        },
      },
    )

    const resubmitted =
      await RecipeVersion.updateOne(
        {
          _id:
            recipeVersion._id,

          status:
            'draft',
        },
        {
          $set: {
            status:
              'in_review',

            submittedAt:
              new Date(),

            submittedByUserId:
              userId,

            reviewedAt:
              null,

            reviewedByUserId:
              null,

            changeReason:
              'Updated by Host and resubmitted for Super Admin review.',
          },
        },
      )

    if (
      resubmitted.modifiedCount !==
      1
    ) {
      throw new ApiError(
        409,
        'Recipe state changed before the edited submission could be returned to review.',
        [
          {
            code:
              'HOST_RECIPE_RESUBMIT_CONFLICT',
          },
        ],
      )
    }

    if (
      foodIntelligenceInput
    ) {
      await submitRecipeFoodIntelligenceDeclaration(
        recipeVersion._id,
        foodIntelligenceInput,
        actorUser,
      )
    }
  } catch (error) {
    if (wasInReview) {
      await RecipeVersion.updateOne(
        {
          _id:
            recipeVersion._id,

          status:
            'draft',
        },
        {
          $set: {
            status:
              'in_review',

            submittedAt:
              recipeVersion.submittedAt ||
              new Date(),

            submittedByUserId:
              recipeVersion.submittedByUserId ||
              userId,

            reviewedAt:
              recipeVersion.reviewedAt ||
              null,

            reviewedByUserId:
              recipeVersion.reviewedByUserId ||
              null,

            changeReason:
              recipeVersion.changeReason ||
              'Submitted by Host for Super Admin review.',
          },
        },
      )
    }

    throw error
  }

  await notifyActiveSuperAdminsBestEffort({
    triggerType:
      'host_listing_updated',
    reasonCode:
      'host_recipe_listing_updated',
    explanation: `${context.organization?.displayName || 'Host'} updated a Recipe listing and resubmitted it for Super Admin review.`,
    relatedEntityType:
      'host_recipe_listing',
    relatedEntityId:
      id(
        recipeVersion._id,
      ),
    sourceDomain:
      'host_operations',
    sourceVersion:
      'host-recipe-v1',
    dedupeScope: `host-recipe-updated:${id(recipeVersion._id)}:${Date.now()}`,
  })

  return getHostRecipeListing({
    recipeVersionId:
      recipeVersion._id,

    actorUser,
  })
}

export async function deleteHostRecipeListing({
  recipeVersionId,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.submit',
  )

  const userId =
    actorId(
      actorUser,
    )

  const recipeVersion =
    await requireOwnedHostRecipeVersion({
      recipeVersionId,
      context,
    })

  if (
    ![
      'draft',
      'in_review',
      'published',
    ].includes(
      recipeVersion.status,
    )
  ) {
    throw new ApiError(
      409,
      'This Host Recipe listing cannot be deleted from its current lifecycle state.',
      [
        {
          code:
            'HOST_RECIPE_DELETE_STATE_INVALID',
        },
      ],
    )
  }

  const now =
    new Date()

  const deletingPublishedVersion =
    recipeVersion.status ===
    'published'

  const deleted =
    await RecipeVersion.findOneAndUpdate(
      {
        _id:
          recipeVersion._id,

        sourceOrganizationId:
          context.organization._id,

        status:
          recipeVersion.status,
      },
      {
        $set:
          deletingPublishedVersion
            ? {
                status:
                  'retired',

                retiredAt:
                  now,

                retiredByUserId:
                  userId,

                effectiveTo:
                  now,

                changeReason:
                  'Published Recipe listing retired by owning Host.',
              }
            : {
                status:
                  'disabled',

                disabledAt:
                  now,

                disabledByUserId:
                  userId,

                changeReason:
                  'Deleted by Host before canonical publication.',
              },
      },
      {
        new:
          true,

        runValidators:
          true,
      },
    )

  if (!deleted) {
    throw new ApiError(
      409,
      'Recipe state changed before deletion completed.',
      [
        {
          code:
            'HOST_RECIPE_DELETE_CONFLICT',
        },
      ],
    )
  }

  const otherLiveVersion =
    await RecipeVersion.exists({
      dishId:
        recipeVersion.dishId,

      _id: {
        $ne:
          recipeVersion._id,
      },

      status: {
        $nin: [
          'disabled',
          'retired',
        ],
      },
    })

  if (!otherLiveVersion) {
    await Dish.updateOne(
      {
        _id:
          recipeVersion.dishId,

        status: {
          $ne:
            'retired',
        },
      },
      {
        $set: {
          status:
            'disabled',

          disabledAt:
            now,

          disabledByUserId:
            userId,

          disabledReason:
            deletingPublishedVersion
              ? 'Published Recipe listing retired by owning Host.'
              : 'Deleted by Host before canonical publication.',
        },
      },
    )
  }

  return {
    deleted:
      true,

    listing:
      serializeHostRecipeListing(
        deleted,
      ),
  }
}

export async function listHostRecipeListings({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.read',
  )

  const recipeVersions =
    await RecipeVersion.find({
      sourceOrganizationId:
        context.organization._id,

      status: {
        $nin: [
          'disabled',
          'retired',
        ],
      },
    })
      .sort({
        createdAt:
          -1,

        _id:
          -1,
      })
      .limit(
        100,
      )
      .lean()

  return {
    recipes:
      recipeVersions.map(
        serializeHostRecipeListing,
      ),
  }
}

export async function listHostRecipeListingHistory({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.read',
  )

  const recipeVersions =
    await RecipeVersion.find({
      sourceOrganizationId:
        context.organization._id,
    })
      .sort({
        createdAt:
          -1,

        _id:
          -1,
      })
      .limit(
        250,
      )
      .lean()

  return {
    recipes:
      recipeVersions.map(
        serializeHostRecipeListing,
      ),
  }
}

async function requireBrandRecipeAuthority({
  context,
  brandId,
  authorityGrantId,
  marketCode,
}) {
  const now =
    new Date()

  const authority =
    await BrandAuthorityGrant.findOne({
      _id:
        authorityGrantId,

      organizationId:
        context.organization._id,

      brandId,

      status:
        'active',

      marketCodes:
        marketCode,

      scopes:
        'brand_recipes',

      validFrom: {
        $lte:
          now,
      },

      $or: [
        {
          validUntil:
            null,
        },

        {
          validUntil: {
            $gt:
              now,
          },
        },
      ],
    }).lean()

  if (
    !authority
  ) {
    throw new ApiError(
      403,
      'Active Brand authority with brand_recipes scope is required.',
      [
        {
          code:
            'HOST_BRAND_RECIPE_AUTHORITY_REQUIRED',
        },
      ],
    )
  }

  const brand =
    await Brand.findOne({
      _id:
        brandId,

      status:
        'active',
    }).lean()

  if (
    !brand
  ) {
    throw new ApiError(
      404,
      'Canonical Brand was not found.',
      [
        {
          code:
            'HOST_BRAND_RECIPE_BRAND_NOT_FOUND',
        },
      ],
    )
  }

  return {
    authority,

    brand,
  }
}

export async function createBrandRecipeSubmission({
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.submit',
  )

  const userId =
    actorId(
      actorUser,
    )

  const {
    authority,
    brand,
  } =
    await requireBrandRecipeAuthority({
      context,

      brandId:
        input.brandId,

      authorityGrantId:
        input.authorityGrantId,

      marketCode:
        input.marketCode,
    })

  if (
    input.nominatedProductPackIds
      .length
  ) {
    const packs =
      await Pack.find({
        _id: {
          $in:
            input.nominatedProductPackIds,
        },

        status:
          'active',
      })
        .select(
          '_id variantId',
        )
        .lean()

    if (
      packs.length !==
      input.nominatedProductPackIds
        .length
    ) {
      throw new ApiError(
        400,
        'Every nominated product must reference an active canonical Pack.',
        [
          {
            code:
              'HOST_BRAND_RECIPE_PACK_INVALID',
          },
        ],
      )
    }

    const variants =
      await ProductVariant.find({
        _id: {
          $in:
            packs.map(
              (
                pack,
              ) =>
                pack.variantId,
            ),
        },

        status:
          'active',
      })
        .select(
          '_id familyId',
        )
        .lean()

    const familyIds =
      uniq(
        variants.map(
          (
            variant,
          ) =>
            id(
              variant.familyId,
            ),
        ),
      )

    const families =
      await ProductFamily.find({
        _id: {
          $in:
            familyIds,
        },

        brandId:
          brand._id,

        status:
          'active',
      })
        .select(
          '_id',
        )
        .lean()

    const brandFamilyIds =
      new Set(
        families.map(
          (
            family,
          ) =>
            id(
              family._id,
            ),
        ),
      )

    const allPacksBelongToBrand =
      variants.length ===
        packs.length &&
      variants.every(
        (
          variant,
        ) =>
          brandFamilyIds.has(
            id(
              variant.familyId,
            ),
          ),
      )

    if (
      !allPacksBelongToBrand
    ) {
      throw new ApiError(
        403,
        'Nominated products must belong to the Brand covered by this authority grant.',
        [
          {
            code:
              'HOST_BRAND_RECIPE_PACK_BRAND_SCOPE_INVALID',
          },
        ],
      )
    }

    const authorityFamilyIds =
      new Set(
        (
          authority.productFamilyIds ||
          []
        ).map(
          id,
        ),
      )

    if (
      authorityFamilyIds.size >
        0 &&
      variants.some(
        (
          variant,
        ) =>
          !authorityFamilyIds.has(
            id(
              variant.familyId,
            ),
          ),
      )
    ) {
      throw new ApiError(
        403,
        'One or more nominated products fall outside the ProductFamily scope of this Brand authority.',
        [
          {
            code:
              'HOST_BRAND_RECIPE_PACK_FAMILY_SCOPE_INVALID',
          },
        ],
      )
    }
  }

  const recipeInput = {
    ...input.recipe,

    source: {
      type:
        'brand',

      name:
        brand.name,

      url:
        '',

      brandId:
        input.brandId,

      organizationId:
        context.organization._id,
    },
  }

  const created =
    await createAdminRecipe(
      recipeInput,
      actorUser,
    )

  const submittedRecipeVersion =
    await RecipeVersion.findOneAndUpdate(
      {
        _id:
          created.recipeVersion.id,

        createdByUserId:
          userId,

        status:
          'draft',
      },
      {
        $set: {
          status:
            'in_review',

          submittedAt:
            new Date(),

          submittedByUserId:
            userId,
        },
      },
      {
        new:
          true,
      },
    )

  if (
    !submittedRecipeVersion
  ) {
    throw new ApiError(
      409,
      'Brand Recipe could not enter the governed review state.',
      [
        {
          code:
            'HOST_BRAND_RECIPE_REVIEW_STATE_INVALID',
        },
      ],
    )
  }

  let submission =
    null

  try {
    submission =
      await HostBrandRecipeSubmission.create({
        organizationId:
          context.organization._id,

        brandId:
          brand._id,

        authorityGrantId:
          authority._id,

        marketCode:
          input.marketCode,

        dishId:
          created.dish.id,

        recipeVersionId:
          created.recipeVersion.id,

        status:
          'submitted',

        nominationDisclosure:
          input.nominationDisclosure,

        nominatedProductPackIds:
          input.nominatedProductPackIds,

        submittedByUserId:
          userId,
      })
  } catch (
    error
  ) {
    await RecipeVersion.updateOne(
      {
        _id:
          created.recipeVersion.id,

        createdByUserId:
          userId,

        status:
          'in_review',
      },
      {
        $set: {
          status:
            'draft',
        },

        $unset: {
          submittedAt:
            1,

          submittedByUserId:
            1,
        },
      },
    )

    throw error
  }

  return {
    submission:
      serializeBrandRecipeSubmission(
        submission,
      ),

    recipe:
      await getAdminRecipeVersion(
        created.recipeVersion.id,
      ),

    policy: {
      brandNominationIsDisclosed:
        true,

      publicationPerformed:
        false,

      requiresM07M08Governance:
        true,
    },
  }
}

export async function listBrandRecipeSubmissions({
  page,
  limit,
  status,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.read',
  )

  const filter = {
    organizationId:
      context.organization._id,
  }

  if (
    status
  ) {
    filter.status =
      status
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      HostBrandRecipeSubmission.find(
        filter,
      )
        .sort({
          createdAt:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      HostBrandRecipeSubmission.countDocuments(
        filter,
      ),
    ])

  return {
    submissions:
      records.map(
        serializeBrandRecipeSubmission,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function getBrandRecipeSubmission({
  submissionId,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'recipes.read',
  )

  const submission =
    await HostBrandRecipeSubmission.findOne({
      _id:
        submissionId,

      organizationId:
        context.organization._id,
    }).lean()

  if (
    !submission
  ) {
    throw new ApiError(
      404,
      'Brand Recipe submission was not found.',
      [
        {
          code:
            'HOST_BRAND_RECIPE_SUBMISSION_NOT_FOUND',
        },
      ],
    )
  }

  return {
    submission:
      serializeBrandRecipeSubmission(
        submission,
      ),

    recipe:
      await getAdminRecipeVersion(
        submission.recipeVersionId,
      ),
  }
}

async function requireOptionalCampaignBrandAuthority({
  context,
  brandId,
  authorityGrantId,
  marketCodes,
}) {
  if (
    !brandId &&
    !authorityGrantId
  ) {
    return null
  }

  const now =
    new Date()

  const authority =
    await BrandAuthorityGrant.findOne({
      _id:
        authorityGrantId,

      organizationId:
        context.organization._id,

      brandId,

      status:
        'active',

      marketCodes: {
        $all:
          marketCodes,
      },

      validFrom: {
        $lte:
          now,
      },

      $or: [
        {
          validUntil:
            null,
        },

        {
          validUntil: {
            $gt:
              now,
          },
        },
      ],
    }).lean()

  if (
    !authority
  ) {
    throw new ApiError(
      403,
      'Verified Brand authority is required for a Brand-attributed campaign brief.',
      [
        {
          code:
            'HOST_CAMPAIGN_BRAND_AUTHORITY_REQUIRED',
        },
      ],
    )
  }

  return authority
}

export async function createCampaignBrief({
  input,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.manage',
  )

  const authority =
    await requireOptionalCampaignBrandAuthority({
      context,

      brandId:
        input.brandId,

      authorityGrantId:
        input.authorityGrantId,

      marketCodes:
        input.marketCodes,
    })

  const brief =
    await HostCampaignBrief.create({
      organizationId:
        context.organization._id,

      brandId:
        input.brandId,

      authorityGrantId:
        authority?._id ||
        null,

      title:
        input.title,

      objective:
        input.objective,

      marketCodes:
        uniq(
          input.marketCodes.map(
            (
              value,
            ) =>
              value.toUpperCase(),
          ),
        ),

      requestedPlacements:
        uniq(
          input.requestedPlacements,
        ),

      startsAt:
        input.startsAt,

      endsAt:
        input.endsAt,

      budget: {
        amountMinor:
          input.budgetAmountMinor,

        currency:
          input.currency,
      },

      promotedEntityType:
        input.promotedEntityType,

      promotedEntityId:
        input.promotedEntityId,

      commercialDisclosure:
        input.commercialDisclosure,

      status:
        'draft',

      createdByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    campaignBrief:
      serializeCampaignBrief(
        brief,
      ),

    policy: {
      paidPlacementServingImplemented:
        false,

      auctionImplemented:
        false,

      attributionImplemented:
        false,

      sponsoredLabelRequired:
        true,

      organicRankingOverrideAllowed:
        false,
    },
  }
}

export async function listCampaignBriefs({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.read',
  )

  const records =
    await HostCampaignBrief.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  return {
    campaignBriefs:
      records.map(
        serializeCampaignBrief,
      ),
  }
}

export async function submitCampaignBrief({
  campaignId,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.manage',
  )

  const brief =
    await HostCampaignBrief.findOne({
      _id:
        campaignId,

      organizationId:
        context.organization._id,

      status:
        'draft',
    })

  if (
    !brief
  ) {
    throw new ApiError(
      404,
      'Draft campaign brief was not found.',
      [
        {
          code:
            'HOST_CAMPAIGN_BRIEF_NOT_FOUND',
        },
      ],
    )
  }

  brief.status =
    'submitted_for_future_media_review'

  brief.submittedAt =
    new Date()

  await brief.save()

  return {
    campaignBrief:
      serializeCampaignBrief(
        brief,
      ),

    nextAction:
      'Future Retail Media policy/review implementation',
  }
}

export async function listAdminKybQueue({
  page,
  limit,
  status,
}) {
  let filter =
    null

  if (
    status
  ) {
    filter = {
      status,
    }
  } else {
    const pendingActivationProfiles =
      await HostOperationalProfile.find({
        activationState:
          'pending_review',
      })
        .select({
          organizationId:
            1,
        })
        .lean()

    const pendingActivationOrganizationIds =
      pendingActivationProfiles.map(
        (
          profile,
        ) =>
          profile.organizationId,
      )

    filter = {
      $or: [
        {
          status: {
            $in: [
              'submitted',
              'needs_information',
            ],
          },
        },
        {
          status:
            'approved',

          organizationId: {
            $in:
              pendingActivationOrganizationIds,
          },
        },
      ],
    }
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      HostKybCase.find(
        filter,
      )
        .sort({
          submittedAt:
            1,

          createdAt:
            1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      HostKybCase.countDocuments(
        filter,
      ),
    ])

  const organizationIds =
    uniq(
      records.map(
        (
          record,
        ) =>
          id(
            record.organizationId,
          ),
      ),
    )

  const operationalProfiles =
    organizationIds.length
      ? await HostOperationalProfile.find({
          organizationId: {
            $in:
              organizationIds,
          },
        })
          .select({
            organizationId:
              1,

            activationState:
              1,

            activationReview:
              1,
          })
          .lean()
      : []

  const profileByOrganizationId =
    new Map(
      operationalProfiles.map(
        (
          profile,
        ) => [
          id(
            profile.organizationId,
          ),
          profile,
        ],
      ),
    )

  return {
    kybCases:
      records.map(
        (
          record,
        ) => {
          const serialized =
            serializeKyb(
              record,
            )

          const profile =
            profileByOrganizationId.get(
              id(
                record.organizationId,
              ),
            ) ||
            null

          return {
            ...serialized,

            activationState:
              profile?.activationState ||
              'onboarding',

            activationReview:
              profile?.activationReview ||
              {},
          }
        },
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function getAdminKybCase({
  kybId,
}) {
  const kyb =
    await HostKybCase.findById(
      kybId,
    ).lean()

  if (
    !kyb
  ) {
    throw new ApiError(
      404,
      'KYB case was not found.',
      [
        {
          code:
            'ADMIN_HOST_KYB_NOT_FOUND',
        },
      ],
    )
  }

  const [
    organization,
    profile,
    documents,
  ] =
    await Promise.all([
      MarketplaceOrganization.findById(
        kyb.organizationId,
      ).lean(),

      HostOperationalProfile.findOne({
        organizationId:
          kyb.organizationId,
      }).lean(),

      HostOrganizationDocument.find({
        organizationId:
          kyb.organizationId,

        _id: {
          $in:
            kyb.documentIds,
        },
      }).lean(),
    ])

  return {
    kyb:
      serializeKyb(
        kyb,
      ),

    organization:
      serializeMarketplaceOrganization(
        organization,
      ),

    operationalProfile:
      serializeOperationalProfile(
        profile,
      ),

    documents:
      documents.map(
        serializeDocument,
      ),
  }
}

export async function decideAdminKybCase({
  kybId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const kyb =
    await HostKybCase.findById(
      kybId,
    )

  if (
    !kyb
  ) {
    throw new ApiError(
      404,
      'KYB case was not found.',
      [
        {
          code:
            'ADMIN_HOST_KYB_NOT_FOUND',
        },
      ],
    )
  }

  if (
    ![
      'submitted',
      'needs_information',
    ].includes(
      kyb.status,
    )
  ) {
    throw new ApiError(
      409,
      'KYB case is not awaiting a governance decision.',
      [
        {
          code:
            'ADMIN_HOST_KYB_DECISION_STATE_INVALID',
        },
      ],
    )
  }

  const before =
    serializeKyb(
      kyb,
    )

  kyb.status =
    input.decision

  kyb.reviewedAt =
    new Date()

  kyb.reviewedByUserId =
    actorId(
      actorUser,
    )

  kyb.reviewReason =
    input.reason

  await kyb.save()

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      'marketplace.mutate',

    permissionKey:
      'marketplace.mutate',

    entityType:
      'host_kyb_case',

    entityId:
      id(
        kyb._id,
      ),

    reasonCode:
      'marketplace.operation',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeKyb(
        kyb,
      ),

    metadata: {
      operation:
        'm16_kyb_decision',

      decision:
        input.decision,
    },

    requestId,
  })

  return {
    kyb:
      serializeKyb(
        kyb,
      ),
  }
}

export async function decideAdminOperationalActivation({
  organizationId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const organization =
    await MarketplaceOrganization.findById(
      organizationId,
    )

  if (
    !organization
  ) {
    throw new ApiError(
      404,
      'Marketplace organization was not found.',
      [
        {
          code:
            'ADMIN_HOST_ORGANIZATION_NOT_FOUND',
        },
      ],
    )
  }

  const profile =
    await HostOperationalProfile.findOne({
      organizationId:
        organization._id,
    })

  if (
    !profile
  ) {
    throw new ApiError(
      409,
      'M16 operational profile has not been initialized.',
      [
        {
          code:
            'ADMIN_HOST_OPERATIONAL_PROFILE_REQUIRED',
        },
      ],
    )
  }

  const readiness =
    await evaluateOperationalReadiness(
      organization._id,
    )

  const before =
    serializeOperationalProfile(
      profile.toObject(),
    )

  if (
    input.decision ===
    'activate'
  ) {
    if (
      profile.activationState !==
      'pending_review'
    ) {
      throw new ApiError(
        409,
        'Organization must request operational activation before approval.',
        [
          {
            code:
              'ADMIN_HOST_ACTIVATION_REQUEST_REQUIRED',

            activationState:
              profile.activationState,
          },
        ],
      )
    }

    if (
      !readiness.readyForActivationRequest ||
      !input.testOrderReference
    ) {
      throw new ApiError(
        409,
        'Activation requires complete readiness and an admin-verified test order reference.',
        [
          {
            code:
              'ADMIN_HOST_ACTIVATION_READINESS_INCOMPLETE',

            checks:
              readiness.checks,
          },
        ],
      )
    }

    profile.activationState =
      'active'
  } else if (
    input.decision ===
    'suspend'
  ) {
    profile.activationState =
      'suspended'
  } else {
    profile.activationState =
      'onboarding'
  }

  profile.activationReview.reviewedAt =
    new Date()

  profile.activationReview.reviewedByUserId =
    actorId(
      actorUser,
    )

  profile.activationReview.reason =
    input.reason

  profile.activationReview.testOrderReference =
    input.testOrderReference ||
    ''

  profile.updatedByUserId =
    actorId(
      actorUser,
    )

  await profile.save()

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      'marketplace.mutate',

    permissionKey:
      'marketplace.mutate',

    entityType:
      'host_operational_profile',

    entityId:
      id(
        profile._id,
      ),

    reasonCode:
      'marketplace.operation',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeOperationalProfile(
        profile,
      ),

    metadata: {
      operation:
        'm16_operational_activation',

      decision:
        input.decision,

      testOrderReference:
        input.testOrderReference ||
        '',
    },

    requestId,
  })

  return {
    operationalProfile:
      serializeOperationalProfile(
        profile,
      ),

    readiness,
  }
}

export async function listAdminBrandRecipeSubmissions({
  page,
  limit,
  status,
}) {
  const filter =
    status
      ? {
          status,
        }
      : {
          status:
            'submitted',
        }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      HostBrandRecipeSubmission.find(
        filter,
      )
        .sort({
          createdAt:
            1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      HostBrandRecipeSubmission.countDocuments(
        filter,
      ),
    ])

  return {
    submissions:
      records.map(
        serializeBrandRecipeSubmission,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function reviewAdminBrandRecipeSubmission({
  submissionId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const submission =
    await HostBrandRecipeSubmission.findById(
      submissionId,
    )

  if (
    !submission
  ) {
    throw new ApiError(
      404,
      'Brand Recipe submission was not found.',
      [
        {
          code:
            'ADMIN_BRAND_RECIPE_SUBMISSION_NOT_FOUND',
        },
      ],
    )
  }

  if (
    submission.status !==
    'submitted'
  ) {
    throw new ApiError(
      409,
      'Brand Recipe submission is not awaiting review.',
      [
        {
          code:
            'ADMIN_BRAND_RECIPE_REVIEW_STATE_INVALID',
        },
      ],
    )
  }

  const before =
    serializeBrandRecipeSubmission(
      submission,
    )

  submission.status =
    input.decision ===
    'accept_for_governance'
      ? 'accepted_for_governance'
      : input.decision ===
          'request_changes'
        ? 'changes_requested'
        : 'rejected'

  submission.reviewedAt =
    new Date()

  submission.reviewedByUserId =
    actorId(
      actorUser,
    )

  submission.reviewReason =
    input.reason

  await submission.save()

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      'recipe.mutate',

    permissionKey:
      'recipe.mutate',

    entityType:
      'brand_recipe_submission',

    entityId:
      id(
        submission._id,
      ),

    reasonCode:
      'recipe.governance',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeBrandRecipeSubmission(
        submission,
      ),

    metadata: {
      operation:
        'm16_brand_recipe_intake_review',

      decision:
        input.decision,

      canonicalRecipePublishPerformed:
        false,
    },

    requestId,
  })

  return {
    submission:
      serializeBrandRecipeSubmission(
        submission,
      ),

    recipe:
      await getAdminRecipeVersion(
        submission.recipeVersionId,
      ),

    nextAction:
      submission.status ===
      'accepted_for_governance'
        ? 'Continue through existing M07 editorial/QA/safety and M08 governance before publication.'
        : 'Host must provide corrected/new governed Recipe evidence.',
  }
}