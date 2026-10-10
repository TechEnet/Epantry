import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  AdminAuditEvent,
} from '../admin/adminAudit.model.js'

import {
  recordAdminAuditEvent,
  sanitizeAdminAuditValue,
} from '../admin/adminAudit.service.js'

import {
  adminAuthorizationHasAnyPermission,
  resolveAdminAuthorization,
} from '../admin/adminPermission.service.js'

import {
  Brand,
  CanonicalIngredient,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  retireProductVersion,
} from '../catalog/catalog.governance.service.js'

import {
  SellerOrder,
} from '../commerce/commerce.transaction.models.js'

import {
  CommercePaymentIntent,
} from '../commerce/commerce.final.models.js'

import {
  RuleProfile,
} from '../foodIntelligence/foodIntelligence.models.js'

import {
  HostBrandRecipeSubmission,
  HostKybCase,
  HostOperationalProfile,
} from '../hostOperations/hostOperations.models.js'

import {
  HostSettlement,
  HostSettlementLine,
} from '../hostOperations/hostOperations.finance.models.js'

import {
  HostWebhookEndpoint,
} from '../hostOperations/hostOperations.integration.models.js'

import {
  MarketplaceOrganization,
} from '../marketplace/marketplace.models.js'

import {
  changeDishLifecycle,
  changeRecipeVersionLifecycle,
} from '../recipes/recipe.governance.service.js'

import {
  Dish,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  User,
} from '../users/user.model.js'

import {
  ProMembershipPayment,
} from '../learning/learning.models.js'

import {
  Campaign,
} from '../retailMedia/retailMedia.models.js'

import {
  CreatorPaymentEvidence,
  CreatorSession,
  CreatorSessionBooking,
} from '../expansionExecution/expansionExecution.models.js'

import {
  SearchDemandEvent,
} from '../search/search.models.js'

import {
  ADMIN_GOVERNANCE_DOMAINS,
  AdminFeatureFlag,
  AdminIncident,
  AdminReviewCase,
  AdminSupportCase,
} from './adminGovernance.models.js'

const GOVERNANCE_DOMAIN_POLICY = Object.freeze({
  admin: Object.freeze({
    read: Object.freeze([
      'admin.dashboard.read',
      'admin.audit.read',
      'admin.roles.read',
      'admin.assignments.read',
    ]),

    mutate: Object.freeze([
      'admin.roles.manage',
      'admin.assignments.manage',
    ]),
  }),

  catalog: Object.freeze({
    read: Object.freeze([
      'catalog.read',
    ]),

    mutate: Object.freeze([
      'catalog.mutate',
      'catalog.publish',
    ]),
  }),

  recipe: Object.freeze({
    read: Object.freeze([
      'recipe.read',
    ]),

    mutate: Object.freeze([
      'recipe.mutate',
      'recipe.publish',
    ]),
  }),

  marketplace: Object.freeze({
    read: Object.freeze([
      'marketplace.read',
    ]),

    mutate: Object.freeze([
      'marketplace.mutate',
    ]),
  }),

  finance: Object.freeze({
    read: Object.freeze([
      'finance.read',
    ]),

    mutate: Object.freeze([
      'finance.mutate',
    ]),
  }),

  trust_safety: Object.freeze({
    read: Object.freeze([
      'trust_safety.read',
    ]),

    mutate: Object.freeze([
      'trust_safety.mutate',
    ]),
  }),

  cms: Object.freeze({
    read: Object.freeze([
      'cms.read',
    ]),

    mutate: Object.freeze([
      'cms.mutate',
      'cms.publish',
    ]),
  }),

  host_review: Object.freeze({
    read: Object.freeze([
      'host.review.read',
      'marketplace.read',
    ]),

    mutate: Object.freeze([
      'host.review.approve',
      'host.review.reject',
      'host.review.suspend',
      'marketplace.mutate',
    ]),
  }),
})

const GOVERNANCE_ACTION_REGISTRY = Object.freeze({
  product_version: Object.freeze({
    domain: 'catalog',

    actions: Object.freeze({
      quarantine: Object.freeze({
        permissionKey: 'catalog.publish',
        implementation: 'retire_published_product_version',
      }),

      disable: Object.freeze({
        permissionKey: 'catalog.publish',
        implementation: 'retire_published_product_version',
      }),
    }),
  }),

  recipe_version: Object.freeze({
    domain: 'recipe',

    actions: Object.freeze({
      quarantine: Object.freeze({
        permissionKey: 'recipe.mutate',
        implementation: 'disable_recipe_version',
      }),

      disable: Object.freeze({
        permissionKey: 'recipe.mutate',
        implementation: 'disable_recipe_version',
      }),
    }),
  }),

  dish: Object.freeze({
    domain: 'recipe',

    actions: Object.freeze({
      quarantine: Object.freeze({
        permissionKey: 'recipe.mutate',
        implementation: 'disable_dish',
      }),

      disable: Object.freeze({
        permissionKey: 'recipe.mutate',
        implementation: 'disable_dish',
      }),

      recover: Object.freeze({
        permissionKey: 'recipe.mutate',
        implementation: 'restore_disabled_dish',
      }),
    }),
  }),
})

const TERMINAL_REVIEW_CASE_STATUSES = new Set([
  'resolved',
  'dismissed',
])

function id(value) {
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

function actorId(actorUser) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated administrative identity is required.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function maskEmail(value) {
  const normalized =
    String(
      value ||
        '',
    ).trim()

  const atIndex =
    normalized.indexOf('@')

  if (
    atIndex <= 0
  ) {
    return ''
  }

  const local =
    normalized.slice(
      0,
      atIndex,
    )

  const domain =
    normalized.slice(
      atIndex + 1,
    )

  const visible =
    local.slice(
      0,
      Math.min(
        2,
        local.length,
      ),
    )

  return `${visible}${'*'.repeat(
    Math.max(
      1,
      local.length -
        visible.length,
    ),
  )}@${domain}`
}

function normalizeEvidence(values) {
  const result = []
  const seen = new Set()

  for (
    const evidence of
    Array.isArray(values)
      ? values
      : []
  ) {
    const key = [
      evidence.type,
      evidence.label,
      evidence.referenceId,
      evidence.uri,
      evidence.checksumSha256,
      evidence.note,
    ].join('|')

    if (
      seen.has(key)
    ) {
      continue
    }

    seen.add(key)
    result.push(evidence)
  }

  return result
}

function hasPermission(
  adminAuthorization,
  permissionKey,
) {
  return (
    adminAuthorization
      ?.permissionKeys ||
    []
  ).includes(
    permissionKey,
  )
}

function firstGrantedPermission(
  adminAuthorization,
  permissionKeys,
) {
  return permissionKeys.find(
    (permissionKey) =>
      hasPermission(
        adminAuthorization,
        permissionKey,
      ),
  ) || null
}

function domainPolicy(domain) {
  const policy =
    GOVERNANCE_DOMAIN_POLICY[
      domain
    ]

  if (!policy) {
    throw new ApiError(
      400,
      'Unknown governance domain.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_DOMAIN_INVALID',

          domain,
        },
      ],
    )
  }

  return policy
}

function assertDomainRead(
  adminAuthorization,
  domain,
) {
  const policy =
    domainPolicy(
      domain,
    )

  const granted =
    firstGrantedPermission(
      adminAuthorization,
      policy.read,
    )

  if (!granted) {
    throw new ApiError(
      403,
      'Administrative read permission is required for this governance domain.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_DOMAIN_READ_REQUIRED',

          domain,

          requiredAnyPermissionKeys:
            policy.read,
        },
      ],
    )
  }

  return granted
}

function assertDomainMutate(
  adminAuthorization,
  domain,
) {
  const policy =
    domainPolicy(
      domain,
    )

  const granted =
    firstGrantedPermission(
      adminAuthorization,
      policy.mutate,
    )

  if (!granted) {
    throw new ApiError(
      403,
      'Administrative mutation permission is required for this governance domain.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_DOMAIN_MUTATE_REQUIRED',

          domain,

          requiredAnyPermissionKeys:
            policy.mutate,
        },
      ],
    )
  }

  return granted
}

function assertExactPermission(
  adminAuthorization,
  permissionKey,
) {
  if (
    !hasPermission(
      adminAuthorization,
      permissionKey,
    )
  ) {
    throw new ApiError(
      403,
      'The required administrative permission is not granted.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ACTION_PERMISSION_REQUIRED',

          permissionKey,
        },
      ],
    )
  }

  return permissionKey
}

function assertRootSuperAdmin(
  adminAuthorization,
) {
  if (
    adminAuthorization
      ?.isRootSuperAdmin !==
    true
  ) {
    throw new ApiError(
      403,
      'This platform policy action is restricted to the real Super Admin control plane.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ROOT_SUPER_ADMIN_REQUIRED',
        },
      ],
    )
  }
}

function allowedDomains(
  adminAuthorization,
  mode = 'read',
) {
  return ADMIN_GOVERNANCE_DOMAINS.filter(
    (domain) => {
      const permissionKeys =
        domainPolicy(domain)[
          mode
        ]

      return adminAuthorizationHasAnyPermission(
        adminAuthorization,
        permissionKeys,
      )
    },
  )
}

function serializeReviewCase(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      id(
        item._id ||
          item.id,
      ),

    caseKey:
      item.caseKey,

    domain:
      item.domain,

    caseType:
      item.caseType,

    entity:
      item.entity ||
      null,

    severity:
      item.severity,

    priority:
      item.priority,

    status:
      item.status,

    summary:
      item.summary,

    details:
      item.details ||
      '',

    evidence:
      item.evidence ||
      [],

    assignedToUserId:
      id(
        item.assignedToUserId,
      ),

    decision:
      item.decision ||
      null,

    beforeSnapshot:
      item.beforeSnapshot ??
      null,

    afterSnapshot:
      item.afterSnapshot ??
      null,

    timeline:
      item.timeline ||
      [],

    resolvedAt:
      item.resolvedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeIncident(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      id(
        item._id ||
          item.id,
      ),

    incidentKey:
      item.incidentKey,

    domain:
      item.domain,

    title:
      item.title,

    summary:
      item.summary,

    severity:
      item.severity,

    status:
      item.status,

    impactedSurfaces:
      item.impactedSurfaces ||
      [],

    evidence:
      item.evidence ||
      [],

    banner:
      item.banner ||
      {
        enabled: false,
        message: '',
      },

    assignedToUserId:
      id(
        item.assignedToUserId,
      ),

    timeline:
      item.timeline ||
      [],

    startedAt:
      item.startedAt ||
      null,

    resolvedAt:
      item.resolvedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeSupportCase(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      id(
        item._id ||
          item.id,
      ),

    supportKey:
      item.supportKey,

    domain:
      item.domain,

    subject:
      item.subject ||
      null,

    title:
      item.title,

    description:
      item.description,

    priority:
      item.priority,

    status:
      item.status,

    evidence:
      item.evidence ||
      [],

    assignedToUserId:
      id(
        item.assignedToUserId,
      ),

    timeline:
      item.timeline ||
      [],

    resolvedAt:
      item.resolvedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeFeatureFlag(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      id(
        item._id ||
          item.id,
      ),

    key:
      item.key,

    description:
      item.description,

    enabled:
      item.enabled ===
      true,

    environments:
      item.environments ||
      [],

    rolloutPercentage:
      item.rolloutPercentage ||
      0,

    ownerDomain:
      item.ownerDomain,

    riskLevel:
      item.riskLevel,

    expiresAt:
      item.expiresAt ||
      null,

    changeReason:
      item.changeReason,

    changeEvidence:
      item.changeEvidence ||
      [],

    version:
      item.version,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

async function recordGovernanceAudit({
  actorUser,
  adminAuthorization,
  permissionKey,
  action,
  entityType,
  entityId,
  reason,
  beforeSnapshot,
  afterSnapshot,
  metadata,
  requestId,
}) {
  return recordAdminAuditEvent({
    actorUser,
    adminAuthorization,
    action,
    permissionKey:
      permissionKey ||
      null,
    entityType,
    entityId:
      String(
        entityId,
      ),
    reasonCode:
      'other.justified',
    reasonDetails:
      reason,
    beforeSnapshot,
    afterSnapshot,
    metadata,
    requestId,
  })
}

async function requireAssignableAdminUser(
  userId,
) {
  if (!userId) {
    return null
  }

  const user =
    await User.findOne({
      _id:
        userId,

      accountStatus:
        'active',
    })
      .lean()

  if (!user) {
    throw new ApiError(
      404,
      'Assigned administrative user was not found or is inactive.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ASSIGNEE_NOT_FOUND',
        },
      ],
    )
  }

  const authorization =
    await resolveAdminAuthorization(
      user,
    )

  if (
    authorization.isAdmin !==
    true
  ) {
    throw new ApiError(
      409,
      'A governance case can only be assigned to an active administrative identity.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ASSIGNEE_ADMIN_REQUIRED',
        },
      ],
    )
  }

  return {
    id:
      id(
        user._id,
      ),

    name:
      user.name,

    emailMasked:
      maskEmail(
        user.email,
      ),
  }
}

export async function getAdminIntegrationOverview({
  adminAuthorization,
  limit = 250,
}) {
  const canRead =
    adminAuthorizationHasAnyPermission(
      adminAuthorization,
      [
        'marketplace.read',
        'host.review.read',
        'admin.dashboard.read',
      ],
    )

  if (!canRead) {
    throw new ApiError(
      403,
      'You do not have permission to review integration health.',
      [
        {
          code:
            'ADMIN_INTEGRATION_READ_FORBIDDEN',
        },
      ],
    )
  }

  const safeLimit =
    Math.min(
      500,
      Math.max(
        1,
        Number(limit) ||
          250,
      ),
    )

  const [
    records,
    total,
  ] =
    await Promise.all([
      HostWebhookEndpoint.find({})
        .select(
          '_id organizationId name endpointUrl eventTypes status lastDeliveryAt lastDeliveryStatus createdAt updatedAt',
        )
        .sort({
          lastDeliveryAt: -1,
          updatedAt: -1,
          createdAt: -1,
        })
        .limit(
          safeLimit,
        )
        .lean(),

      HostWebhookEndpoint.countDocuments({}),
    ])

  const organizationIds = [
    ...new Set(
      records
        .map(
          (item) =>
            id(
              item.organizationId,
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
            '_id displayName organizationType status',
          )
          .lean()
      : []

  const organizationMap =
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

  const webhooks =
    records.map(
      (item) => {
        const organization =
          organizationMap.get(
            id(
              item.organizationId,
            ),
          ) ||
          null

        let endpointHost =
          'Endpoint configured'

        try {
          endpointHost =
            new URL(
              item.endpointUrl,
            ).host ||
            endpointHost
        } catch {
          endpointHost =
            'Endpoint configured'
        }

        return {
          id:
            id(
              item._id,
            ),
          name:
            item.name ||
            'Webhook connection',
          organizationId:
            id(
              item.organizationId,
            ),
          organizationName:
            organization?.displayName ||
            'Host organization',
          organizationType:
            organization?.organizationType ||
            '',
          organizationStatus:
            organization?.status ||
            '',
          endpointHost,
          eventTypes:
            Array.isArray(
              item.eventTypes,
            )
              ? item.eventTypes
              : [],
          status:
            item.status ||
            'active',
          lastDeliveryStatus:
            item.lastDeliveryStatus ||
            'never',
          lastDeliveryAt:
            item.lastDeliveryAt ||
            null,
          updatedAt:
            item.updatedAt ||
            null,
          createdAt:
            item.createdAt ||
            null,
        }
      },
    )

  const active =
    webhooks.filter(
      (item) =>
        item.status ===
        'active',
    )

  const failed =
    active.filter(
      (item) =>
        item.lastDeliveryStatus ===
        'failed',
    )

  const healthy =
    active.filter(
      (item) =>
        item.lastDeliveryStatus ===
        'success',
    )

  const neverUsed =
    active.filter(
      (item) =>
        item.lastDeliveryStatus ===
        'never',
    )

  return {
    summary: {
      total,
      active:
        active.length,
      failed:
        failed.length,
      healthy:
        healthy.length,
      neverUsed:
        neverUsed.length,
      disabled:
        webhooks.filter(
          (item) =>
            item.status ===
            'disabled',
        ).length,
      organizations:
        new Set(
          webhooks
            .map(
              (item) =>
                item.organizationId,
            )
            .filter(Boolean),
        ).size,
    },
    webhooks,
    pagination: {
      total,
      limit:
        safeLimit,
      hasMore:
        total >
        safeLimit,
    },
  }
}

export async function getAdminGovernanceCommandCenter({
  adminAuthorization,
}) {
  const readableDomains =
    allowedDomains(
      adminAuthorization,
      'read',
    )

  const metrics = {}

  const openReviewCaseCount =
    readableDomains.length
      ? await AdminReviewCase.countDocuments({
          domain: {
            $in:
              readableDomains,
          },

          status: {
            $in: [
              'open',
              'in_review',
              'blocked',
            ],
          },
        })
      : 0

  const criticalReviewCaseCount =
    readableDomains.length
      ? await AdminReviewCase.countDocuments({
          domain: {
            $in:
              readableDomains,
          },

          severity:
            'critical',

          status: {
            $in: [
              'open',
              'in_review',
              'blocked',
            ],
          },
        })
      : 0

  metrics.reviewQueue = {
    open:
      openReviewCaseCount,

    critical:
      criticalReviewCaseCount,
  }

  if (
    readableDomains.includes(
      'catalog',
    )
  ) {
    metrics.catalog = {
      productVersionsInReview:
        await ProductVersion.countDocuments({
          publicationStatus:
            'in_review',
        }),
    }
  }

  if (
    readableDomains.includes(
      'recipe',
    )
  ) {
    const [
      recipeVersionsInReview,
      brandRecipeSubmissions,
    ] =
      await Promise.all([
        RecipeVersion.countDocuments({
          status:
            'in_review',
        }),

        HostBrandRecipeSubmission.countDocuments({
          status:
            'submitted',
        }),
      ])

    metrics.recipe = {
      recipeVersionsInReview,
      brandRecipeSubmissions,
    }
  }

  if (
    readableDomains.includes(
      'marketplace',
    ) ||
    readableDomains.includes(
      'host_review',
    )
  ) {
    const [
      kybAwaitingReview,
      hostActivationAwaitingReview,
      marketplaceIncidents,
      failedWebhooks,
      pendingCampaignReviews,
    ] =
      await Promise.all([
        HostKybCase.countDocuments({
          status: {
            $in: [
              'submitted',
              'needs_information',
            ],
          },
        }),

        HostOperationalProfile.countDocuments({
          activationState:
            'pending_review',
        }),

        SellerOrder.countDocuments({
          status: {
            $in: [
              'delivery_failed',
              'return_requested',
              'partial_unavailable',
              'substitution_requested',
            ],
          },
        }),

        HostWebhookEndpoint.countDocuments({
          status:
            'active',

          lastDeliveryStatus:
            'failed',
        }),

        Campaign.countDocuments({
          status:
            'pending_review',
          'payment.status':
            'paid',
        }),
      ])

    metrics.marketplace = {
      kybAwaitingReview,
      hostActivationAwaitingReview,
      orderExceptions:
        marketplaceIncidents,
      failedWebhooks,
      pendingCampaignReviews,
    }
  }

  if (
    readableDomains.includes(
      'finance',
    )
  ) {
    const [
      pendingSettlements,
      approvedAwaitingPayoutReconciliation,
    ] =
      await Promise.all([
        HostSettlement.countDocuments({
          status:
            'pending_approval',
        }),

        HostSettlement.countDocuments({
          status:
            'approved',
        }),
      ])

    metrics.finance = {
      pendingSettlements,
      approvedAwaitingPayoutReconciliation,
    }
  }

  if (
    readableDomains.includes(
      'trust_safety',
    )
  ) {
    const [
      activeIncidents,
      openSupportCases,
    ] =
      await Promise.all([
        AdminIncident.countDocuments({
          domain: {
            $in:
              readableDomains,
          },

          status: {
            $ne:
              'resolved',
          },
        }),

        AdminSupportCase.countDocuments({
          domain: {
            $in:
              readableDomains,
          },

          status: {
            $in: [
              'open',
              'in_progress',
              'waiting',
            ],
          },
        }),
      ])

    metrics.trustSafety = {
      activeIncidents,
      openSupportCases,
    }
  }

  if (
    hasPermission(
      adminAuthorization,
      'admin.dashboard.read',
    )
  ) {
    const [
      enabledFeatureFlags,
      activeRuleProfiles,
    ] =
      await Promise.all([
        AdminFeatureFlag.countDocuments({
          enabled:
            true,
        }),

        RuleProfile.countDocuments({
          status:
            'active',
        }),
      ])

    metrics.policy = {
      enabledFeatureFlags,
      activeRuleProfiles,
    }
  }

  if (
    hasPermission(
      adminAuthorization,
      'admin.audit.read',
    )
  ) {
    const since =
      new Date(
        Date.now() -
          24 *
            60 *
            60 *
            1000,
      )

    metrics.audit = {
      deniedOrFailedLast24Hours:
        await AdminAuditEvent.countDocuments({
          outcome: {
            $in: [
              'denied',
              'failed',
            ],
          },

          occurredAt: {
            $gte:
              since,
          },
        }),
    }
  }

  const incidentBanners =
    readableDomains.length
      ? await AdminIncident.find({
          domain: {
            $in:
              readableDomains,
          },

          status: {
            $ne:
              'resolved',
          },

          'banner.enabled':
            true,
        })
          .sort({
            severity: 1,
            startedAt: -1,
          })
          .limit(10)
          .lean()
      : []

  return {
    metrics,

    incidentBanners:
      incidentBanners.map(
        serializeIncident,
      ),

    readableDomains,

    aiPolicy: {
      caseSummarizationAllowed:
        true,
      anomalyPrioritizationSuggestionAllowed:
        true,
      authoritativeDecisionAllowed:
        false,
      criticalOverrideApprovalAllowed:
        false,
    },

    policy: {
      databaseDirectEditExpected:
        false,
      immutableAdminAuditRequired:
        true,
      historicalTruthPreserved:
        true,
    },
  }
}

function result(
  type,
  item,
) {
  return {
    type,
    ...item,
  }
}


function startOfCurrentMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

async function sumMoney(Model, match, expression) {
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, amountMinor: { $sum: expression }, count: { $sum: 1 } } },
  ])

  return {
    amountMinor: Number(row?.amountMinor || 0),
    count: Number(row?.count || 0),
  }
}

function serializeMoneyRow({ id, source, amountMinor, occurredAt, label, status = 'paid' }) {
  return {
    id: String(id || ''),
    source,
    label,
    amountMinor: Number(amountMinor || 0),
    currency: 'INR',
    status,
    occurredAt: occurredAt || null,
  }
}


export async function listAdminMarketplaceOrderExceptions({
  adminAuthorization,
}) {
  assertDomainRead(
    adminAuthorization,
    'marketplace',
  )

  const exceptionStatuses = [
    'delivery_failed',
    'return_requested',
    'partial_unavailable',
    'substitution_requested',
  ]

  const [orders, counts] =
    await Promise.all([
      SellerOrder
        .find({
          status: {
            $in: exceptionStatuses,
          },
        })
        .select(
          '_id parentOrderId organizationId sellerName items commercialSnapshot fulfillment status createdAt updatedAt',
        )
        .sort({
          updatedAt: -1,
          createdAt: -1,
          _id: -1,
        })
        .limit(100)
        .lean(),

      SellerOrder.aggregate([
        {
          $match: {
            status: {
              $in: exceptionStatuses,
            },
          },
        },
        {
          $group: {
            _id: '$status',
            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ])

  const summary = {
    total: 0,
    deliveryFailed: 0,
    returnsRequested: 0,
    itemsUnavailable: 0,
    substitutionsRequested: 0,
  }

  for (const row of counts) {
    const count = Number(row?.count || 0)
    summary.total += count

    if (row?._id === 'delivery_failed') {
      summary.deliveryFailed = count
    } else if (row?._id === 'return_requested') {
      summary.returnsRequested = count
    } else if (row?._id === 'partial_unavailable') {
      summary.itemsUnavailable = count
    } else if (row?._id === 'substitution_requested') {
      summary.substitutionsRequested = count
    }
  }

  return {
    orders: orders.map((order) => {
      const itemNames = (order.items || [])
        .map((item) => String(item?.displayName || '').trim())
        .filter(Boolean)

      const totalMinor =
        order?.commercialSnapshot?.totalLandedCostMinor ??
        order?.commercialSnapshot?.itemSubtotalMinor ??
        null

      return {
        id: id(order._id),
        parentOrderId: id(order.parentOrderId),
        organizationId: id(order.organizationId),
        sellerName: order.sellerName || 'Host',
        status: order.status,
        itemCount: itemNames.length || (order.items || []).length,
        itemNames,
        totalMinor,
        currency: order?.commercialSnapshot?.currency || 'INR',
        fulfillmentType: order?.fulfillment?.fulfillmentType || null,
        createdAt: order.createdAt || null,
        updatedAt: order.updatedAt || null,
      }
    }),
    summary,
    limitedTo: 100,
  }
}

export async function getAdminEarningsOverview() {
  const monthStart = startOfCurrentMonth()

  const [
    commerceAll,
    commerceMonth,
    proAll,
    proMonth,
    mediaAll,
    mediaMonth,
    creatorAll,
    creatorMonth,
    marketplaceFeeAll,
    marketplaceFeeMonth,
    hostPaidAll,
    hostPaidMonth,
    hostPendingAll,
    recentCommerce,
    recentPro,
    recentMedia,
    recentCreator,
    recentMarketplaceFees,
  ] = await Promise.all([
    sumMoney(CommercePaymentIntent, { status: 'paid' }, '$amountMinor'),
    sumMoney(CommercePaymentIntent, { status: 'paid', paidAt: { $gte: monthStart } }, '$amountMinor'),
    sumMoney(ProMembershipPayment, { status: 'paid' }, '$amountMinor'),
    sumMoney(ProMembershipPayment, { status: 'paid', paidAt: { $gte: monthStart } }, '$amountMinor'),
    sumMoney(Campaign, { 'payment.status': 'paid' }, '$payment.requiredAmountMinor'),
    sumMoney(Campaign, { 'payment.status': 'paid', 'payment.paidAt': { $gte: monthStart } }, '$payment.requiredAmountMinor'),
    sumMoney(CreatorPaymentEvidence, {}, '$amountMinor'),
    sumMoney(CreatorPaymentEvidence, { verifiedAt: { $gte: monthStart } }, '$amountMinor'),
    sumMoney(HostSettlementLine, {}, '$platformFeeMinor'),
    sumMoney(HostSettlementLine, { occurredAt: { $gte: monthStart } }, '$platformFeeMinor'),
    sumMoney(HostSettlement, { status: 'paid' }, '$totals.netPayableMinor'),
    sumMoney(HostSettlement, { status: 'paid', paidAt: { $gte: monthStart } }, '$totals.netPayableMinor'),
    sumMoney(HostSettlement, { status: { $in: ['pending_approval', 'approved'] } }, '$totals.netPayableMinor'),
    CommercePaymentIntent.find({ status: 'paid' })
      .select('_id ownerUserId parentOrderId amountMinor currency paidAt createdAt updatedAt')
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(30)
      .lean(),
    ProMembershipPayment.find({ status: 'paid' })
      .select('_id userId planCode amountMinor validityMonths currency paidAt createdAt updatedAt')
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(30)
      .lean(),
    Campaign.find({ 'payment.status': 'paid' })
      .select('_id organizationId title objective payment createdAt updatedAt')
      .sort({ 'payment.paidAt': -1, createdAt: -1 })
      .limit(30)
      .lean(),
    CreatorPaymentEvidence.find({})
      .select('_id bookingId customerUserId amountMinor currency verifiedAt createdAt')
      .sort({ verifiedAt: -1, createdAt: -1 })
      .limit(30)
      .lean(),
    HostSettlementLine.find({ platformFeeMinor: { $gt: 0 } })
      .select('_id organizationId sellerOrderId grossMerchandiseMinor platformFeeMinor occurredAt createdAt')
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(30)
      .lean(),
  ])

  const summarize = ({ commerce, pro, media, creator, marketplaceFee, hostPaid }) => ({
    platformRevenueMinor:
      Number(pro.amountMinor || 0) +
      Number(media.amountMinor || 0) +
      Number(marketplaceFee.amountMinor || 0),
    grossCollectionsMinor:
      Number(commerce.amountMinor || 0) +
      Number(pro.amountMinor || 0) +
      Number(media.amountMinor || 0) +
      Number(creator.amountMinor || 0),
    commerceCollectionsMinor: Number(commerce.amountMinor || 0),
    proRevenueMinor: Number(pro.amountMinor || 0),
    retailMediaRevenueMinor: Number(media.amountMinor || 0),
    creatorCollectionsMinor: Number(creator.amountMinor || 0),
    marketplaceFeeMinor: Number(marketplaceFee.amountMinor || 0),
    hostPayoutsPaidMinor: Number(hostPaid.amountMinor || 0),
    transactionCount:
      Number(commerce.count || 0) +
      Number(pro.count || 0) +
      Number(media.count || 0) +
      Number(creator.count || 0),
  })

  const parentOrderIds = recentCommerce
    .map((row) => row.parentOrderId)
    .filter(Boolean)

  const feeSellerOrderIds = recentMarketplaceFees
    .map((row) => row.sellerOrderId)
    .filter(Boolean)

  const bookingIds = recentCreator
    .map((row) => row.bookingId)
    .filter(Boolean)

  const sellerOrderMatch = []
  if (parentOrderIds.length) sellerOrderMatch.push({ parentOrderId: { $in: parentOrderIds } })
  if (feeSellerOrderIds.length) sellerOrderMatch.push({ _id: { $in: feeSellerOrderIds } })

  const [sellerOrders, creatorBookings] = await Promise.all([
    sellerOrderMatch.length
      ? SellerOrder.find({ $or: sellerOrderMatch })
          .select('_id parentOrderId organizationId sellerName items commercialSnapshot fulfillment status createdAt updatedAt')
          .lean()
      : [],
    bookingIds.length
      ? CreatorSessionBooking.find({ _id: { $in: bookingIds } })
          .select('_id sessionId customerUserId amountMinor currency status confirmedAt createdAt')
          .lean()
      : [],
  ])

  const sessionIds = creatorBookings
    .map((row) => row.sessionId)
    .filter(Boolean)

  const creatorSessions = sessionIds.length
    ? await CreatorSession.find({ _id: { $in: sessionIds } })
        .select('_id ownerUserId title startsAt endsAt')
        .lean()
    : []

  const userIds = new Set()
  for (const row of recentCommerce) if (row.ownerUserId) userIds.add(String(row.ownerUserId))
  for (const row of recentPro) if (row.userId) userIds.add(String(row.userId))
  for (const row of recentCreator) if (row.customerUserId) userIds.add(String(row.customerUserId))
  for (const row of creatorSessions) if (row.ownerUserId) userIds.add(String(row.ownerUserId))

  const organizationIds = new Set()
  for (const row of recentMedia) if (row.organizationId) organizationIds.add(String(row.organizationId))
  for (const row of recentMarketplaceFees) if (row.organizationId) organizationIds.add(String(row.organizationId))
  for (const row of sellerOrders) if (row.organizationId) organizationIds.add(String(row.organizationId))

  const [users, organizations] = await Promise.all([
    userIds.size
      ? User.find({ _id: { $in: [...userIds] } }).select('_id name email').lean()
      : [],
    organizationIds.size
      ? MarketplaceOrganization.find({ _id: { $in: [...organizationIds] } })
          .select('_id displayName ownerUserId')
          .lean()
      : [],
  ])

  const userById = new Map(users.map((row) => [String(row._id), row]))
  const organizationById = new Map(organizations.map((row) => [String(row._id), row]))
  const bookingById = new Map(creatorBookings.map((row) => [String(row._id), row]))
  const sessionById = new Map(creatorSessions.map((row) => [String(row._id), row]))
  const sellerOrderById = new Map(sellerOrders.map((row) => [String(row._id), row]))

  const sellerOrdersByParent = new Map()
  for (const order of sellerOrders) {
    const key = String(order.parentOrderId || '')
    if (!key) continue
    if (!sellerOrdersByParent.has(key)) sellerOrdersByParent.set(key, [])
    sellerOrdersByParent.get(key).push(order)
  }

  const displayUser = (value, fallback = 'Customer') => {
    const row = userById.get(String(value || ''))
    return String(row?.name || row?.email || fallback).trim() || fallback
  }

  const displayOrganization = (value, fallback = 'Host') => {
    const row = organizationById.get(String(value || ''))
    return String(row?.displayName || fallback).trim() || fallback
  }

  const itemNamesFromOrder = (order) => (order?.items || [])
    .map((item) => String(item?.displayName || '').trim())
    .filter(Boolean)

  const orderAmountMinor = (order) => Number(
    order?.commercialSnapshot?.totalLandedCostMinor ??
    order?.commercialSnapshot?.itemSubtotalMinor ??
    0,
  )

  const shortItemReason = (items, fallback) => {
    if (!items.length) return fallback
    if (items.length === 1) return items[0]
    return `${items[0]} + ${items.length - 1} more item${items.length - 1 === 1 ? '' : 's'}`
  }

  const platformPayments = [
    ...recentPro.map((row) => {
      const planLabel = String(row.planCode || 'Pro')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())

      return {
        ...serializeMoneyRow({
          id: row._id,
          source: 'pro_membership',
          label: `${displayUser(row.userId)} paid EPANTRY`,
          amountMinor: row.amountMinor,
          occurredAt: row.paidAt || row.updatedAt || row.createdAt,
        }),
        payerName: displayUser(row.userId),
        recipientName: 'EPANTRY',
        reason: `${planLabel} membership`,
        detail: {
          type: 'Membership',
          plan: planLabel,
          validityMonths: Number(row.validityMonths || 0),
        },
      }
    }),
    ...recentMedia.map((row) => ({
      ...serializeMoneyRow({
        id: row._id,
        source: 'retail_media',
        label: `${displayOrganization(row.organizationId)} paid EPANTRY`,
        amountMinor: row?.payment?.requiredAmountMinor,
        occurredAt: row?.payment?.paidAt || row.updatedAt || row.createdAt,
      }),
      payerName: displayOrganization(row.organizationId, 'Advertiser'),
      recipientName: 'EPANTRY',
      reason: row.title || 'Advertising campaign',
      detail: {
        type: 'Ads & paid placements',
        campaign: row.title || 'Advertising campaign',
        objective: row.objective || '',
      },
    })),
    ...recentMarketplaceFees.map((row) => {
      const order = sellerOrderById.get(String(row.sellerOrderId || ''))
      const items = itemNamesFromOrder(order)
      const payerName = displayOrganization(row.organizationId, order?.sellerName || 'Host')

      return {
        ...serializeMoneyRow({
          id: row._id,
          source: 'marketplace_fee',
          label: `EPANTRY earned a marketplace fee`,
          amountMinor: row.platformFeeMinor,
          occurredAt: row.occurredAt || row.createdAt,
        }),
        payerName,
        recipientName: 'EPANTRY',
        reason: shortItemReason(items, 'Marketplace order'),
        detail: {
          type: 'Marketplace fee',
          items,
          grossMerchandiseMinor: Number(row.grossMerchandiseMinor || 0),
          platformFeeMinor: Number(row.platformFeeMinor || 0),
          orderStatus: order?.status || '',
        },
      }
    }),
  ]
    .filter((row) => Number(row.amountMinor || 0) > 0)
    .sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0))
    .slice(0, 40)

  const customerToHostPayments = []

  for (const payment of recentCommerce) {
    const customerName = displayUser(payment.ownerUserId)
    const orders = sellerOrdersByParent.get(String(payment.parentOrderId || '')) || []

    if (!orders.length) {
      customerToHostPayments.push({
        ...serializeMoneyRow({
          id: payment._id,
          source: 'customer_order',
          label: `${customerName} paid for a marketplace order`,
          amountMinor: payment.amountMinor,
          occurredAt: payment.paidAt || payment.updatedAt || payment.createdAt,
        }),
        payerName: customerName,
        recipientName: 'Marketplace Host',
        reason: 'Marketplace order',
        detail: {
          type: 'Customer order',
          items: [],
        },
      })
      continue
    }

    for (const order of orders) {
      const items = itemNamesFromOrder(order)
      const amountMinor = orderAmountMinor(order)
      const recipientName = order.sellerName ||
        displayOrganization(order.organizationId, 'Host')

      customerToHostPayments.push({
        ...serializeMoneyRow({
          id: `${payment._id}:${order._id}`,
          source: 'customer_order',
          label: `${customerName} paid ${recipientName}`,
          amountMinor: amountMinor || payment.amountMinor,
          occurredAt: payment.paidAt || payment.updatedAt || payment.createdAt,
        }),
        payerName: customerName,
        recipientName,
        reason: shortItemReason(items, 'Marketplace order'),
        detail: {
          type: 'Customer order',
          items,
          orderStatus: order.status || '',
          fulfillmentType: order?.fulfillment?.fulfillmentType || '',
          subtotalMinor: Number(order?.commercialSnapshot?.itemSubtotalMinor || 0),
          feesMinor: Number(order?.commercialSnapshot?.knownFeesMinor || 0),
          totalMinor: amountMinor || payment.amountMinor,
        },
      })
    }
  }

  for (const payment of recentCreator) {
    const booking = bookingById.get(String(payment.bookingId || ''))
    const session = booking ? sessionById.get(String(booking.sessionId || '')) : null
    const customerName = displayUser(payment.customerUserId)
    const creatorName = session?.ownerUserId
      ? displayUser(session.ownerUserId, 'Creator')
      : 'Creator'

    customerToHostPayments.push({
      ...serializeMoneyRow({
        id: payment._id,
        source: 'creator_session',
        label: `${customerName} paid ${creatorName}`,
        amountMinor: payment.amountMinor,
        occurredAt: payment.verifiedAt || payment.createdAt,
      }),
      payerName: customerName,
      recipientName: creatorName,
      reason: session?.title || 'Creator session',
      detail: {
        type: 'Creator session',
        session: session?.title || 'Creator session',
        startsAt: session?.startsAt || null,
      },
    })
  }

  customerToHostPayments.sort(
    (a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0),
  )

  const recent = [...platformPayments, ...customerToHostPayments]
    .sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0))
    .slice(0, 40)

  return {
    paymentDataVersion: 2,
    currency: 'INR',
    allTime: summarize({
      commerce: commerceAll,
      pro: proAll,
      media: mediaAll,
      creator: creatorAll,
      marketplaceFee: marketplaceFeeAll,
      hostPaid: hostPaidAll,
    }),
    currentMonth: summarize({
      commerce: commerceMonth,
      pro: proMonth,
      media: mediaMonth,
      creator: creatorMonth,
      marketplaceFee: marketplaceFeeMonth,
      hostPaid: hostPaidMonth,
    }),
    pendingHostPayoutMinor: Number(hostPendingAll.amountMinor || 0),
    sources: [
      { key: 'pro_membership', label: 'Pro memberships', amountMinor: proAll.amountMinor, kind: 'platform_revenue' },
      { key: 'retail_media', label: 'Ads & paid placements', amountMinor: mediaAll.amountMinor, kind: 'platform_revenue' },
      { key: 'marketplace_fee', label: 'Marketplace fees', amountMinor: marketplaceFeeAll.amountMinor, kind: 'platform_revenue' },
      { key: 'customer_orders', label: 'Customer orders', amountMinor: commerceAll.amountMinor, kind: 'pass_through_collection' },
      { key: 'creator_sessions', label: 'Creator sessions', amountMinor: creatorAll.amountMinor, kind: 'pass_through_collection' },
    ],
    platformPayments,
    customerToHostPayments: customerToHostPayments.slice(0, 40),
    recent,
  }
}

export async function getAdminSearchDemand({ query }) {
  const days = Math.max(1, Math.min(3650, Number(query?.days || 30)))
  const limit = Math.max(5, Math.min(100, Number(query?.limit || 40)))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const match = {
    occurredAt: { $gte: since },
  }

  const q = String(query?.q || '').trim()
  const area = String(query?.area || '').trim()

  if (q) {
    match.normalizedQuery = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  }

  if (area) {
    const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    match.$or = [
      { 'area.city': { $regex: escaped, $options: 'i' } },
      { 'area.state': { $regex: escaped, $options: 'i' } },
      { 'area.postcode': { $regex: escaped, $options: 'i' } },
    ]
  }

  const [
    totalSearches,
    uniqueCustomersRows,
    topQueries,
    topAreas,
    queryByArea,
    recent,
  ] = await Promise.all([
    SearchDemandEvent.countDocuments(match),
    SearchDemandEvent.aggregate([
      { $match: match },
      { $group: { _id: '$ownerUserId' } },
      { $count: 'count' },
    ]),
    SearchDemandEvent.aggregate([
      { $match: match },
      { $group: { _id: '$normalizedQuery', displayQuery: { $first: '$displayQuery' }, searches: { $sum: 1 }, customers: { $addToSet: '$ownerUserId' } } },
      { $project: { _id: 0, query: '$displayQuery', searches: 1, uniqueCustomers: { $size: '$customers' } } },
      { $sort: { searches: -1, query: 1 } },
      { $limit: 15 },
    ]),
    SearchDemandEvent.aggregate([
      { $match: match },
      { $group: {
          _id: {
            city: { $ifNull: ['$area.city', ''] },
            state: { $ifNull: ['$area.state', ''] },
            postcode: { $ifNull: ['$area.postcode', ''] },
          },
          searches: { $sum: 1 },
          customers: { $addToSet: '$ownerUserId' },
        },
      },
      { $project: { _id: 0, city: '$_id.city', state: '$_id.state', postcode: '$_id.postcode', searches: 1, uniqueCustomers: { $size: '$customers' } } },
      { $sort: { searches: -1 } },
      { $limit: 15 },
    ]),
    SearchDemandEvent.aggregate([
      { $match: match },
      { $group: {
          _id: {
            query: '$normalizedQuery',
            city: { $ifNull: ['$area.city', ''] },
            state: { $ifNull: ['$area.state', ''] },
            postcode: { $ifNull: ['$area.postcode', ''] },
          },
          displayQuery: { $first: '$displayQuery' },
          searches: { $sum: 1 },
        },
      },
      { $project: { _id: 0, query: '$displayQuery', city: '$_id.city', state: '$_id.state', postcode: '$_id.postcode', searches: 1 } },
      { $sort: { searches: -1 } },
      { $limit: 20 },
    ]),
    SearchDemandEvent.find(match)
      .sort({ occurredAt: -1, _id: -1 })
      .limit(limit)
      .select('displayQuery surface area occurredAt')
      .lean(),
  ])

  return {
    windowDays: days,
    totalSearches,
    uniqueCustomers: Number(uniqueCustomersRows?.[0]?.count || 0),
    topQuery: topQueries?.[0] || null,
    topArea: topAreas?.[0] || null,
    topQueries,
    topAreas,
    queryByArea,
    recent: recent.map((row) => ({
      id: String(row._id),
      query: row.displayQuery,
      surface: row.surface,
      area: row.area || {},
      occurredAt: row.occurredAt,
    })),
  }
}

export async function searchAdminGovernance({
  query,
  adminAuthorization,
}) {
  const search =
    query.q.trim()

  const regex =
    new RegExp(
      escapeRegExp(
        search,
      ),
      'i',
    )

  const exactObjectId =
    mongoose.isValidObjectId(
      search,
    )
      ? search
      : null

  const requestedTypes =
    new Set(
      query.types ||
        [
          'user',
          'organization',
          'brand',
          'ingredient',
          'product_version',
          'dish',
          'recipe_version',
          'seller_order',
          'settlement',
          'review_case',
          'incident',
          'support_case',
          'audit_event',
        ],
    )

  const perTypeLimit =
    Math.min(
      10,
      Math.max(
        3,
        Math.ceil(
          query.limit /
            Math.max(
              1,
              requestedTypes.size,
            ),
        ),
      ),
    )

  const tasks = []

  const pushTask = (
    type,
    promise,
    mapper,
  ) => {
    if (
      !requestedTypes.has(
        type,
      )
    ) {
      return
    }

    tasks.push(
      promise.then(
        (items) =>
          items.map(
            (item) =>
              mapper(
                item,
              ),
          ),
      ),
    )
  }

  const canSearchIdentity =
    hasPermission(
      adminAuthorization,
      'admin.dashboard.read',
    ) ||
    hasPermission(
      adminAuthorization,
      'host.review.read',
    ) ||
    hasPermission(
      adminAuthorization,
      'marketplace.read',
    ) ||
    hasPermission(
      adminAuthorization,
      'trust_safety.read',
    )

  if (
    canSearchIdentity
  ) {
    const userOr = [
      {
        name:
          regex,
      },
      {
        email:
          regex,
      },
    ]

    if (
      exactObjectId
    ) {
      userOr.unshift({
        _id:
          exactObjectId,
      })
    }

    pushTask(
      'user',
      User.find({
        $or:
          userOr,
      })
        .select(
          '_id name email accountStatus customerEnabled hostEnabled hostAccessStatus',
        )
        .limit(
          perTypeLimit,
        )
        .lean(),
      (user) =>
        result(
          'user',
          {
            id:
              id(
                user._id,
              ),
            title:
              user.name,
            subtitle:
              maskEmail(
                user.email,
              ),
            status:
              user.accountStatus,
            metadata: {
              customerEnabled:
                user.customerEnabled ===
                true,
              hostEnabled:
                user.hostEnabled ===
                true,
              hostAccessStatus:
                user.hostAccessStatus,
            },
            routeHint:
              '/admin/users-organizations',
          },
        ),
    )

    const organizationOr = [
      {
        displayName:
          regex,
      },
      {
        slug:
          regex,
      },
      {
        externalReference:
          regex,
      },
    ]

    if (
      exactObjectId
    ) {
      organizationOr.unshift({
        _id:
          exactObjectId,
      })
    }

    pushTask(
      'organization',
      MarketplaceOrganization.find({
        $or:
          organizationOr,
      })
        .select(
          '_id displayName slug organizationType status ownerUserId',
        )
        .limit(
          perTypeLimit,
        )
        .lean(),
      (organization) =>
        result(
          'organization',
          {
            id:
              id(
                organization._id,
              ),
            title:
              organization.displayName,
            subtitle:
              `${organization.organizationType} · ${organization.slug}`,
            status:
              organization.status,
            metadata: {
              ownerUserId:
                id(
                  organization.ownerUserId,
                ),
            },
            routeHint:
              '/admin/users-organizations',
          },
        ),
    )
  }

  if (
    hasPermission(
      adminAuthorization,
      'catalog.read',
    )
  ) {
    pushTask(
      'brand',
      Brand.find({
        $or: [
          {
            name:
              regex,
          },
          {
            slug:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id name slug status',
        )
        .limit(
          perTypeLimit,
        )
        .lean(),
      (brand) =>
        result(
          'brand',
          {
            id:
              id(
                brand._id,
              ),
            title:
              brand.name,
            subtitle:
              brand.slug,
            status:
              brand.status,
            routeHint:
              '/admin/brands',
          },
        ),
    )

    pushTask(
      'ingredient',
      CanonicalIngredient.find({
        $or: [
          {
            canonicalName:
              regex,
          },
          {
            slug:
              regex,
          },
          {
            aliases:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id canonicalName slug status',
        )
        .limit(
          perTypeLimit,
        )
        .lean(),
      (ingredient) =>
        result(
          'ingredient',
          {
            id:
              id(
                ingredient._id,
              ),
            title:
              ingredient.canonicalName,
            subtitle:
              ingredient.slug,
            status:
              ingredient.status,
            routeHint:
              '/admin/catalog/ingredients',
          },
        ),
    )

    pushTask(
      'product_version',
      ProductVersion.find({
        $or: [
          {
            displayName:
              regex,
          },
          {
            gtin:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
                {
                  packId:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id displayName gtin packId variantId version publicationStatus',
        )
        .sort({
          version: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (productVersion) =>
        result(
          'product_version',
          {
            id:
              id(
                productVersion._id,
              ),
            title:
              productVersion.displayName,
            subtitle:
              `${productVersion.gtin || 'No GTIN'} · v${productVersion.version}`,
            status:
              productVersion.publicationStatus,
            metadata: {
              packId:
                id(
                  productVersion.packId,
                ),
              variantId:
                id(
                  productVersion.variantId,
                ),
            },
            routeHint:
              `/admin/catalog/products/${id(productVersion._id)}`,
          },
        ),
    )
  }

  if (
    hasPermission(
      adminAuthorization,
      'recipe.read',
    )
  ) {
    pushTask(
      'dish',
      Dish.find({
        $or: [
          {
            name:
              regex,
          },
          {
            slug:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id name slug status',
        )
        .limit(
          perTypeLimit,
        )
        .lean(),
      (dish) =>
        result(
          'dish',
          {
            id:
              id(
                dish._id,
              ),
            title:
              dish.name,
            subtitle:
              dish.slug,
            status:
              dish.status,
            routeHint:
              '/admin/recipes',
          },
        ),
    )

    pushTask(
      'recipe_version',
      RecipeVersion.find({
        $or: [
          {
            title:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
                {
                  dishId:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id dishId title version status source',
        )
        .sort({
          version: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (recipeVersion) =>
        result(
          'recipe_version',
          {
            id:
              id(
                recipeVersion._id,
              ),
            title:
              recipeVersion.title,
            subtitle:
              `v${recipeVersion.version} · ${recipeVersion.source?.type || 'unknown source'}`,
            status:
              recipeVersion.status,
            metadata: {
              dishId:
                id(
                  recipeVersion.dishId,
                ),
            },
            routeHint:
              `/admin/recipes/${id(recipeVersion._id)}`,
          },
        ),
    )
  }

  if (
    hasPermission(
      adminAuthorization,
      'marketplace.read',
    )
  ) {
    pushTask(
      'seller_order',
      SellerOrder.find({
        $or: [
          {
            sellerName:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
                {
                  parentOrderId:
                    exactObjectId,
                },
                {
                  organizationId:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id parentOrderId organizationId sellerName status createdAt',
        )
        .sort({
          createdAt: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (order) =>
        result(
          'seller_order',
          {
            id:
              id(
                order._id,
              ),
            title:
              `SellerOrder ${id(order._id).slice(-8).toUpperCase()}`,
            subtitle:
              order.sellerName,
            status:
              order.status,
            metadata: {
              parentOrderId:
                id(
                  order.parentOrderId,
                ),
              organizationId:
                id(
                  order.organizationId,
                ),
            },
            routeHint:
              '/admin/marketplace',
          },
        ),
    )
  }

  if (
    hasPermission(
      adminAuthorization,
      'finance.read',
    )
  ) {
    pushTask(
      'settlement',
      HostSettlement.find({
        $or: [
          {
            payoutReference:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
                {
                  organizationId:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id organizationId periodStart periodEnd currency status totals payoutReference',
        )
        .sort({
          createdAt: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (settlement) =>
        result(
          'settlement',
          {
            id:
              id(
                settlement._id,
              ),
            title:
              `Settlement ${id(settlement._id).slice(-8).toUpperCase()}`,
            subtitle:
              settlement.payoutReference ||
              `${settlement.currency} · ${settlement.totals?.netPayableMinor || 0} minor units`,
            status:
              settlement.status,
            metadata: {
              organizationId:
                id(
                  settlement.organizationId,
                ),
              periodStart:
                settlement.periodStart,
              periodEnd:
                settlement.periodEnd,
            },
            routeHint:
              '/admin/host-operations',
          },
        ),
    )
  }

  const readableGovernanceDomains =
    allowedDomains(
      adminAuthorization,
      'read',
    )

  if (
    readableGovernanceDomains.length
  ) {
    pushTask(
      'review_case',
      AdminReviewCase.find({
        domain: {
          $in:
            readableGovernanceDomains,
        },

        $or: [
          {
            caseKey:
              regex,
          },
          {
            summary:
              regex,
          },
          {
            details:
              regex,
          },
          {
            'entity.id':
              search,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id caseKey domain entity summary severity priority status',
        )
        .sort({
          createdAt: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (reviewCase) =>
        result(
          'review_case',
          {
            id:
              id(
                reviewCase._id,
              ),
            title:
              reviewCase.summary,
            subtitle:
              `${reviewCase.caseKey} · ${reviewCase.domain}`,
            status:
              reviewCase.status,
            metadata: {
              severity:
                reviewCase.severity,
              priority:
                reviewCase.priority,
              entity:
                reviewCase.entity,
            },
            routeHint:
              `/admin/governance/review-cases/${id(reviewCase._id)}`,
          },
        ),
    )

    pushTask(
      'incident',
      AdminIncident.find({
        domain: {
          $in:
            readableGovernanceDomains,
        },

        $or: [
          {
            incidentKey:
              regex,
          },
          {
            title:
              regex,
          },
          {
            summary:
              regex,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id incidentKey domain title severity status banner startedAt',
        )
        .sort({
          startedAt: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (incident) =>
        result(
          'incident',
          {
            id:
              id(
                incident._id,
              ),
            title:
              incident.title,
            subtitle:
              `${incident.incidentKey} · ${incident.domain}`,
            status:
              incident.status,
            metadata: {
              severity:
                incident.severity,
              banner:
                incident.banner,
            },
            routeHint:
              '/admin/governance/incidents',
          },
        ),
    )

    pushTask(
      'support_case',
      AdminSupportCase.find({
        domain: {
          $in:
            readableGovernanceDomains,
        },

        $or: [
          {
            supportKey:
              regex,
          },
          {
            title:
              regex,
          },
          {
            description:
              regex,
          },
          {
            'subject.id':
              search,
          },
          ...(exactObjectId
            ? [
                {
                  _id:
                    exactObjectId,
                },
              ]
            : []),
        ],
      })
        .select(
          '_id supportKey domain subject title priority status',
        )
        .sort({
          createdAt: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (supportCase) =>
        result(
          'support_case',
          {
            id:
              id(
                supportCase._id,
              ),
            title:
              supportCase.title,
            subtitle:
              `${supportCase.supportKey} · ${supportCase.domain}`,
            status:
              supportCase.status,
            metadata: {
              priority:
                supportCase.priority,
              subject:
                supportCase.subject,
            },
            routeHint:
              '/admin/governance/support-cases',
          },
        ),
    )
  }

  if (
    hasPermission(
      adminAuthorization,
      'admin.audit.read',
    )
  ) {
    pushTask(
      'audit_event',
      AdminAuditEvent.find({
        $or: [
          {
            eventId:
              regex,
          },
          {
            action:
              regex,
          },
          {
            'entity.id':
              search,
          },
        ],
      })
        .select(
          'eventId action outcome permissionKey entity reason occurredAt',
        )
        .sort({
          occurredAt: -1,
        })
        .limit(
          perTypeLimit,
        )
        .lean(),
      (auditEvent) =>
        result(
          'audit_event',
          {
            id:
              id(
                auditEvent._id,
              ),
            title:
              auditEvent.action,
            subtitle:
              `${auditEvent.entity?.type || 'entity'} · ${auditEvent.entity?.id || ''}`,
            status:
              auditEvent.outcome,
            metadata: {
              eventId:
                auditEvent.eventId,
              permissionKey:
                auditEvent.permissionKey,
              reason:
                auditEvent.reason,
              occurredAt:
                auditEvent.occurredAt,
            },
            routeHint:
              '/admin/audit',
          },
        ),
    )
  }

  const groups =
    await Promise.all(
      tasks,
    )

  const results =
    groups
      .flat()
      .slice(
        0,
        query.limit,
      )

  return {
    query:
      search,
    results,
    resultCount:
      results.length,
    permissionFiltered:
      true,
  }
}

export async function listAdminReviewCases({
  query,
  adminAuthorization,
}) {
  const readableDomains =
    allowedDomains(
      adminAuthorization,
      'read',
    )

  if (
    query.domain
  ) {
    assertDomainRead(
      adminAuthorization,
      query.domain,
    )
  }

  const filter = {
    domain: {
      $in:
        query.domain
          ? [
              query.domain,
            ]
          : readableDomains,
    },
  }

  for (
    const key of [
      'status',
      'severity',
      'priority',
      'assignedToUserId',
    ]
  ) {
    if (
      query[key]
    ) {
      filter[key] =
        query[key]
    }
  }

  const skip =
    (query.page - 1) *
    query.limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      AdminReviewCase.find(
        filter,
      )
        .sort({
          priority: 1,
          severity: 1,
          createdAt: 1,
        })
        .skip(skip)
        .limit(
          query.limit,
        )
        .lean(),

      AdminReviewCase.countDocuments(
        filter,
      ),
    ])

  return {
    reviewCases:
      records.map(
        serializeReviewCase,
      ),

    pagination: {
      page:
        query.page,
      limit:
        query.limit,
      total,
      pages:
        total
          ? Math.ceil(
              total /
                query.limit,
            )
          : 0,
    },
  }
}

export async function getAdminReviewCase({
  reviewCaseId,
  adminAuthorization,
}) {
  const reviewCase =
    await AdminReviewCase.findById(
      reviewCaseId,
    )

  if (!reviewCase) {
    throw new ApiError(
      404,
      'Review case was not found.',
      [
        {
          code:
            'ADMIN_REVIEW_CASE_NOT_FOUND',
        },
      ],
    )
  }

  assertDomainRead(
    adminAuthorization,
    reviewCase.domain,
  )

  return {
    reviewCase:
      serializeReviewCase(
        reviewCase,
      ),
  }
}

export async function createAdminReviewCase({
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const permissionKey =
    assertDomainMutate(
      adminAuthorization,
      input.domain,
    )

  const userId =
    actorId(
      actorUser,
    )

  const reviewCase =
    await AdminReviewCase.create({
      ...input,

      evidence:
        normalizeEvidence(
          input.evidence,
        ),

      createdByUserId:
        userId,

      updatedByUserId:
        userId,

      timeline: [
        {
          eventType:
            'created',
          actorUserId:
            userId,
          note:
            input.summary,
          metadata: {
            severity:
              input.severity,
            priority:
              input.priority,
          },
        },
      ],
    })

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey,
    action:
      'governance.review_case.create',
    entityType:
      'review_case',
    entityId:
      reviewCase._id,
    reason:
      input.details ||
      input.summary,
    beforeSnapshot:
      null,
    afterSnapshot:
      serializeReviewCase(
        reviewCase,
      ),
    metadata: {
      domain:
        input.domain,
      caseType:
        input.caseType,
      subjectEntity:
        input.entity,
    },
    requestId,
  })

  return {
    reviewCase:
      serializeReviewCase(
        reviewCase,
      ),
  }
}

export async function assignAdminReviewCase({
  reviewCaseId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const reviewCase =
    await AdminReviewCase.findById(
      reviewCaseId,
    )

  if (!reviewCase) {
    throw new ApiError(
      404,
      'Review case was not found.',
      [
        {
          code:
            'ADMIN_REVIEW_CASE_NOT_FOUND',
        },
      ],
    )
  }

  const permissionKey =
    assertDomainMutate(
      adminAuthorization,
      reviewCase.domain,
    )

  if (
    TERMINAL_REVIEW_CASE_STATUSES.has(
      reviewCase.status,
    )
  ) {
    throw new ApiError(
      409,
      'A terminal review case cannot be reassigned.',
      [
        {
          code:
            'ADMIN_REVIEW_CASE_ASSIGNMENT_STATE_INVALID',
        },
      ],
    )
  }

  const assignee =
    await requireAssignableAdminUser(
      input.assignedToUserId,
    )

  const before =
    serializeReviewCase(
      reviewCase,
    )

  reviewCase.assignedToUserId =
    input.assignedToUserId ||
    null

  reviewCase.status =
    input.assignedToUserId
      ? 'in_review'
      : reviewCase.status

  reviewCase.updatedByUserId =
    actorId(
      actorUser,
    )

  reviewCase.timeline.push({
    eventType:
      'assigned',
    actorUserId:
      actorId(
        actorUser,
      ),
    note:
      input.reason,
    metadata: {
      assignedToUserId:
        input.assignedToUserId ||
        null,
    },
  })

  await reviewCase.save()

  const after =
    serializeReviewCase(
      reviewCase,
    )

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey,
    action:
      'governance.review_case.assign',
    entityType:
      'review_case',
    entityId:
      reviewCase._id,
    reason:
      input.reason,
    beforeSnapshot:
      before,
    afterSnapshot:
      after,
    metadata: {
      assignee,
    },
    requestId,
  })

  return {
    reviewCase:
      after,
    assignee,
  }
}

export async function decideAdminReviewCase({
  reviewCaseId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const reviewCase =
    await AdminReviewCase.findById(
      reviewCaseId,
    )

  if (!reviewCase) {
    throw new ApiError(
      404,
      'Review case was not found.',
      [
        {
          code:
            'ADMIN_REVIEW_CASE_NOT_FOUND',
        },
      ],
    )
  }

  const permissionKey =
    assertDomainMutate(
      adminAuthorization,
      reviewCase.domain,
    )

  if (
    TERMINAL_REVIEW_CASE_STATUSES.has(
      reviewCase.status,
    )
  ) {
    throw new ApiError(
      409,
      'This review case already has a terminal decision.',
      [
        {
          code:
            'ADMIN_REVIEW_CASE_ALREADY_TERMINAL',
        },
      ],
    )
  }

  const mergedEvidence =
    normalizeEvidence([
      ...(reviewCase.evidence || []),
      ...(input.evidence || []),
    ])

  if (
    reviewCase.severity ===
      'critical' &&
    mergedEvidence.length ===
      0
  ) {
    throw new ApiError(
      409,
      'Critical review case decisions require evidence.',
      [
        {
          code:
            'ADMIN_REVIEW_CASE_CRITICAL_EVIDENCE_REQUIRED',
        },
      ],
    )
  }

  const before =
    serializeReviewCase(
      reviewCase,
    )

  const decisionMap = {
    accept: {
      status:
        'resolved',
      code:
        'accepted',
    },
    reject: {
      status:
        'resolved',
      code:
        'rejected',
    },
    needs_action: {
      status:
        'blocked',
      code:
        'needs_action',
    },
    resolve: {
      status:
        'resolved',
      code:
        'resolved',
    },
    dismiss: {
      status:
        'dismissed',
      code:
        'dismissed',
    },
  }

  const next =
    decisionMap[
      input.decision
    ]

  reviewCase.status =
    next.status

  reviewCase.evidence =
    mergedEvidence

  reviewCase.decision = {
    code:
      next.code,
    reason:
      input.reason,
    decidedByUserId:
      actorId(
        actorUser,
      ),
    decidedAt:
      new Date(),
  }

  reviewCase.updatedByUserId =
    actorId(
      actorUser,
    )

  reviewCase.resolvedAt =
    [
      'resolved',
      'dismissed',
    ].includes(
      next.status,
    )
      ? new Date()
      : null

  reviewCase.timeline.push({
    eventType:
      'decision',
    actorUserId:
      actorId(
        actorUser,
      ),
    note:
      input.reason,
    metadata: {
      decision:
        input.decision,
      status:
        next.status,
    },
  })

  await reviewCase.save()

  const after =
    serializeReviewCase(
      reviewCase,
    )

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey,
    action:
      'governance.review_case.decide',
    entityType:
      'review_case',
    entityId:
      reviewCase._id,
    reason:
      input.reason,
    beforeSnapshot:
      before,
    afterSnapshot:
      after,
    metadata: {
      decision:
        input.decision,
      evidenceCount:
        mergedEvidence.length,
    },
    requestId,
  })

  return {
    reviewCase:
      after,
  }
}

export async function listAdminIncidents({
  query,
  adminAuthorization,
}) {
  const readableDomains =
    allowedDomains(
      adminAuthorization,
      'read',
    )

  if (
    query.domain
  ) {
    assertDomainRead(
      adminAuthorization,
      query.domain,
    )
  }

  const filter = {
    domain: {
      $in:
        query.domain
          ? [
              query.domain,
            ]
          : readableDomains,
    },
  }

  for (
    const key of [
      'status',
      'severity',
    ]
  ) {
    if (
      query[key]
    ) {
      filter[key] =
        query[key]
    }
  }

  const skip =
    (query.page - 1) *
    query.limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      AdminIncident.find(
        filter,
      )
        .sort({
          startedAt: -1,
        })
        .skip(skip)
        .limit(
          query.limit,
        )
        .lean(),

      AdminIncident.countDocuments(
        filter,
      ),
    ])

  return {
    incidents:
      records.map(
        serializeIncident,
      ),

    pagination: {
      page:
        query.page,
      limit:
        query.limit,
      total,
      pages:
        total
          ? Math.ceil(
              total /
                query.limit,
            )
          : 0,
    },
  }
}

export async function createAdminIncident({
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const permissionKey =
    assertDomainMutate(
      adminAuthorization,
      input.domain,
    )

  const userId =
    actorId(
      actorUser,
    )

  const incident =
    await AdminIncident.create({
      domain:
        input.domain,
      title:
        input.title,
      summary:
        input.summary,
      severity:
        input.severity,
      impactedSurfaces:
        [
          ...new Set(
            input.impactedSurfaces,
          ),
        ],
      evidence:
        normalizeEvidence(
          input.evidence,
        ),
      banner: {
        enabled:
          input.bannerEnabled,
        message:
          input.bannerMessage,
      },
      createdByUserId:
        userId,
      updatedByUserId:
        userId,
      timeline: [
        {
          eventType:
            'created',
          actorUserId:
            userId,
          note:
            input.summary,
          metadata: {
            severity:
              input.severity,
          },
        },
      ],
    })

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey,
    action:
      'governance.incident.create',
    entityType:
      'incident',
    entityId:
      incident._id,
    reason:
      input.summary,
    beforeSnapshot:
      null,
    afterSnapshot:
      serializeIncident(
        incident,
      ),
    metadata: {
      domain:
        input.domain,
      severity:
        input.severity,
    },
    requestId,
  })

  return {
    incident:
      serializeIncident(
        incident,
      ),
  }
}

export async function updateAdminIncident({
  incidentId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const incident =
    await AdminIncident.findById(
      incidentId,
    )

  if (!incident) {
    throw new ApiError(
      404,
      'Incident was not found.',
      [
        {
          code:
            'ADMIN_INCIDENT_NOT_FOUND',
        },
      ],
    )
  }

  const permissionKey =
    assertDomainMutate(
      adminAuthorization,
      incident.domain,
    )

  const before =
    serializeIncident(
      incident,
    )

  if (
    input.status
  ) {
    incident.status =
      input.status

    incident.resolvedAt =
      input.status ===
      'resolved'
        ? new Date()
        : null
  }

  if (
    input.assignedToUserId !==
    undefined
  ) {
    await requireAssignableAdminUser(
      input.assignedToUserId,
    )

    incident.assignedToUserId =
      input.assignedToUserId ||
      null
  }

  if (
    input.bannerEnabled !==
    undefined
  ) {
    incident.banner.enabled =
      input.bannerEnabled
  }

  if (
    input.bannerMessage !==
    undefined
  ) {
    incident.banner.message =
      input.bannerMessage
  }

  if (
    incident.banner.enabled &&
    !incident.banner.message
  ) {
    throw new ApiError(
      409,
      'An enabled incident banner requires a message.',
      [
        {
          code:
            'ADMIN_INCIDENT_BANNER_MESSAGE_REQUIRED',
        },
      ],
    )
  }

  incident.evidence =
    normalizeEvidence([
      ...(incident.evidence || []),
      ...(input.evidence || []),
    ])

  if (
    incident.severity ===
      'critical' &&
    incident.evidence.length ===
      0
  ) {
    throw new ApiError(
      409,
      'Critical incident updates require evidence.',
      [
        {
          code:
            'ADMIN_INCIDENT_CRITICAL_EVIDENCE_REQUIRED',
        },
      ],
    )
  }

  incident.updatedByUserId =
    actorId(
      actorUser,
    )

  incident.timeline.push({
    eventType:
      'status_changed',
    actorUserId:
      actorId(
        actorUser,
      ),
    note:
      input.reason,
    metadata: {
      status:
        incident.status,
      bannerEnabled:
        incident.banner.enabled,
    },
  })

  await incident.save()

  const after =
    serializeIncident(
      incident,
    )

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey,
    action:
      'governance.incident.update',
    entityType:
      'incident',
    entityId:
      incident._id,
    reason:
      input.reason,
    beforeSnapshot:
      before,
    afterSnapshot:
      after,
    metadata: {
      evidenceAdded:
        input.evidence?.length ||
        0,
    },
    requestId,
  })

  return {
    incident:
      after,
  }
}

export async function listAdminSupportCases({
  query,
  adminAuthorization,
}) {
  const readableDomains =
    allowedDomains(
      adminAuthorization,
      'read',
    )

  if (
    query.domain
  ) {
    assertDomainRead(
      adminAuthorization,
      query.domain,
    )
  }

  const filter = {
    domain: {
      $in:
        query.domain
          ? [
              query.domain,
            ]
          : readableDomains,
    },
  }

  for (
    const key of [
      'status',
      'priority',
    ]
  ) {
    if (
      query[key]
    ) {
      filter[key] =
        query[key]
    }
  }

  const skip =
    (query.page - 1) *
    query.limit

  const [
    records,
    total,
  ] =
    await Promise.all([
      AdminSupportCase.find(
        filter,
      )
        .sort({
          priority: 1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(
          query.limit,
        )
        .lean(),

      AdminSupportCase.countDocuments(
        filter,
      ),
    ])

  return {
    supportCases:
      records.map(
        serializeSupportCase,
      ),

    pagination: {
      page:
        query.page,
      limit:
        query.limit,
      total,
      pages:
        total
          ? Math.ceil(
              total /
                query.limit,
            )
          : 0,
    },
  }
}

export async function createAdminSupportCase({
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const permissionKey =
    assertDomainMutate(
      adminAuthorization,
      input.domain,
    )

  const userId =
    actorId(
      actorUser,
    )

  const supportCase =
    await AdminSupportCase.create({
      ...input,
      evidence:
        normalizeEvidence(
          input.evidence,
        ),
      createdByUserId:
        userId,
      updatedByUserId:
        userId,
      timeline: [
        {
          eventType:
            'created',
          actorUserId:
            userId,
          note:
            input.description,
          metadata: {
            priority:
              input.priority,
          },
        },
      ],
    })

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey,
    action:
      'governance.support_case.create',
    entityType:
      'support_case',
    entityId:
      supportCase._id,
    reason:
      input.description,
    beforeSnapshot:
      null,
    afterSnapshot:
      serializeSupportCase(
        supportCase,
      ),
    metadata: {
      domain:
        input.domain,
      subject:
        input.subject,
    },
    requestId,
  })

  return {
    supportCase:
      serializeSupportCase(
        supportCase,
      ),
  }
}

export async function updateAdminSupportCase({
  supportCaseId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const supportCase =
    await AdminSupportCase.findById(
      supportCaseId,
    )

  if (!supportCase) {
    throw new ApiError(
      404,
      'Support case was not found.',
      [
        {
          code:
            'ADMIN_SUPPORT_CASE_NOT_FOUND',
        },
      ],
    )
  }

  const permissionKey =
    assertDomainMutate(
      adminAuthorization,
      supportCase.domain,
    )

  const before =
    serializeSupportCase(
      supportCase,
    )

  if (
    input.status
  ) {
    supportCase.status =
      input.status

    supportCase.resolvedAt =
      [
        'resolved',
        'closed',
      ].includes(
        input.status,
      )
        ? new Date()
        : null
  }

  if (
    input.assignedToUserId !==
    undefined
  ) {
    await requireAssignableAdminUser(
      input.assignedToUserId,
    )

    supportCase.assignedToUserId =
      input.assignedToUserId ||
      null
  }

  supportCase.evidence =
    normalizeEvidence([
      ...(supportCase.evidence || []),
      ...(input.evidence || []),
    ])

  supportCase.updatedByUserId =
    actorId(
      actorUser,
    )

  supportCase.timeline.push({
    eventType:
      'status_changed',
    actorUserId:
      actorId(
        actorUser,
      ),
    note:
      input.reason,
    metadata: {
      status:
        supportCase.status,
      assignedToUserId:
        id(
          supportCase.assignedToUserId,
        ),
    },
  })

  await supportCase.save()

  const after =
    serializeSupportCase(
      supportCase,
    )

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey,
    action:
      'governance.support_case.update',
    entityType:
      'support_case',
    entityId:
      supportCase._id,
    reason:
      input.reason,
    beforeSnapshot:
      before,
    afterSnapshot:
      after,
    metadata: {
      evidenceAdded:
        input.evidence?.length ||
        0,
    },
    requestId,
  })

  return {
    supportCase:
      after,
  }
}

export async function listAdminFeatureFlags({
  query,
  adminAuthorization,
}) {
  if (
    !hasPermission(
      adminAuthorization,
      'admin.dashboard.read',
    )
  ) {
    throw new ApiError(
      403,
      'Admin dashboard read permission is required to inspect platform feature flags.',
      [
        {
          code:
            'ADMIN_FEATURE_FLAG_READ_REQUIRED',
        },
      ],
    )
  }

  const filter = {}

  if (
    query.environment
  ) {
    filter.environments =
      query.environment
  }

  if (
    query.enabled !==
    undefined
  ) {
    filter.enabled =
      query.enabled
  }

  const flags =
    await AdminFeatureFlag.find(
      filter,
    )
      .sort({
        key: 1,
      })
      .lean()

  return {
    featureFlags:
      flags.map(
        serializeFeatureFlag,
      ),

    mutationAuthority:
      'root_super_admin_only',
  }
}

export async function getAdminPolicyOverview({
  adminAuthorization,
}) {
  if (
    !hasPermission(
      adminAuthorization,
      'admin.dashboard.read',
    )
  ) {
    throw new ApiError(
      403,
      'Admin dashboard read permission is required to inspect platform policy state.',
      [
        {
          code:
            'ADMIN_POLICY_READ_REQUIRED',
        },
      ],
    )
  }

  const [
    featureFlags,
    ruleProfiles,
  ] =
    await Promise.all([
      AdminFeatureFlag.find({})
        .sort({
          key: 1,
        })
        .lean(),

      RuleProfile.find({
        status: {
          $in: [
            'draft',
            'active',
          ],
        },
      })
        .select(
          '_id ruleKey version ruleType jurisdictionCode status effectiveFrom effectiveTo changeReason',
        )
        .sort({
          ruleKey: 1,
          jurisdictionCode: 1,
          version: -1,
        })
        .limit(200)
        .lean(),
    ])

  return {
    featureFlags:
      featureFlags.map(
        serializeFeatureFlag,
      ),

    ruleProfiles:
      ruleProfiles.map(
        (ruleProfile) => ({
          id:
            id(
              ruleProfile._id,
            ),
          ruleKey:
            ruleProfile.ruleKey,
          version:
            ruleProfile.version,
          ruleType:
            ruleProfile.ruleType,
          jurisdictionCode:
            ruleProfile.jurisdictionCode,
          status:
            ruleProfile.status,
          effectiveFrom:
            ruleProfile.effectiveFrom ||
            null,
          effectiveTo:
            ruleProfile.effectiveTo ||
            null,
          changeReason:
            ruleProfile.changeReason,
        }),
      ),

    commandRegistry:
      GOVERNANCE_ACTION_REGISTRY,

    policy: {
      ruleProfilesReusedFromM08:
        true,
      featureFlagsOwnedByM17:
        true,
      directDatabaseMutation:
        false,
      criticalActionReasonAndEvidenceRequired:
        true,
      makerCheckerBoundariesRemainDomainOwned:
        true,
    },
  }
}

export async function createAdminFeatureFlag({
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  assertRootSuperAdmin(
    adminAuthorization,
  )

  const userId =
    actorId(
      actorUser,
    )

  let flag =
    null

  try {
    flag =
      await AdminFeatureFlag.create({
        key:
          input.key,
        description:
          input.description,
        enabled:
          input.enabled,
        environments: [
          ...new Set(
            input.environments,
          ),
        ],
        rolloutPercentage:
          input.rolloutPercentage,
        ownerDomain:
          input.ownerDomain,
        riskLevel:
          input.riskLevel,
        expiresAt:
          input.expiresAt,
        changeReason:
          input.reason,
        changeEvidence:
          normalizeEvidence(
            input.evidence,
          ),
        version:
          1,
        createdByUserId:
          userId,
        updatedByUserId:
          userId,
      })
  } catch (error) {
    if (
      error?.code ===
      11000
    ) {
      throw new ApiError(
        409,
        'Feature flag key already exists.',
        [
          {
            code:
              'ADMIN_FEATURE_FLAG_KEY_CONFLICT',
          },
        ],
      )
    }

    throw error
  }

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey:
      null,
    action:
      'platform.feature_flag.mutate',
    entityType:
      'feature_flag',
    entityId:
      flag._id,
    reason:
      input.reason,
    beforeSnapshot:
      null,
    afterSnapshot:
      serializeFeatureFlag(
        flag,
      ),
    metadata: {
      operation:
        'create',
      authorizationBoundary:
        'root_super_admin_only',
      evidenceCount:
        input.evidence.length,
    },
    requestId,
  })

  return {
    featureFlag:
      serializeFeatureFlag(
        flag,
      ),
  }
}

export async function updateAdminFeatureFlag({
  featureFlagId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  assertRootSuperAdmin(
    adminAuthorization,
  )

  const flag =
    await AdminFeatureFlag.findById(
      featureFlagId,
    )

  if (!flag) {
    throw new ApiError(
      404,
      'Feature flag was not found.',
      [
        {
          code:
            'ADMIN_FEATURE_FLAG_NOT_FOUND',
        },
      ],
    )
  }

  const before =
    serializeFeatureFlag(
      flag,
    )

  const nextRiskLevel =
    input.riskLevel ||
    flag.riskLevel

  const nextEnabled =
    input.enabled !==
    undefined
      ? input.enabled
      : flag.enabled

  const nextEnvironments =
    input.environments ||
    flag.environments

  const highRisk =
    [
      'high',
      'critical',
    ].includes(
      nextRiskLevel,
    ) ||
    (
      nextEnabled &&
      nextEnvironments.includes(
        'production',
      )
    )

  if (
    highRisk &&
    input.evidence.length ===
      0
  ) {
    throw new ApiError(
      409,
      'High-risk or production feature-flag changes require fresh evidence.',
      [
        {
          code:
            'ADMIN_FEATURE_FLAG_EVIDENCE_REQUIRED',
        },
      ],
    )
  }

  for (
    const key of [
      'description',
      'enabled',
      'rolloutPercentage',
      'ownerDomain',
      'riskLevel',
      'expiresAt',
    ]
  ) {
    if (
      input[key] !==
      undefined
    ) {
      flag[key] =
        input[key]
    }
  }

  if (
    input.environments
  ) {
    flag.environments = [
      ...new Set(
        input.environments,
      ),
    ]
  }

  flag.changeReason =
    input.reason

  flag.changeEvidence =
    normalizeEvidence(
      input.evidence,
    )

  flag.updatedByUserId =
    actorId(
      actorUser,
    )

  flag.version +=
    1

  await flag.save()

  const after =
    serializeFeatureFlag(
      flag,
    )

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey:
      null,
    action:
      'platform.feature_flag.mutate',
    entityType:
      'feature_flag',
    entityId:
      flag._id,
    reason:
      input.reason,
    beforeSnapshot:
      before,
    afterSnapshot:
      after,
    metadata: {
      operation:
        'update',
      authorizationBoundary:
        'root_super_admin_only',
      evidenceCount:
        input.evidence.length,
    },
    requestId,
  })

  return {
    featureFlag:
      after,
  }
}

async function entitySnapshot(
  entityType,
  entityId,
) {
  if (
    entityType ===
    'product_version'
  ) {
    return ProductVersion.findById(
      entityId,
    ).lean()
  }

  if (
    entityType ===
    'recipe_version'
  ) {
    return RecipeVersion.findById(
      entityId,
    ).lean()
  }

  if (
    entityType ===
    'dish'
  ) {
    return Dish.findById(
      entityId,
    ).lean()
  }

  return null
}

async function requireActionReviewCase({
  input,
  domain,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  if (
    input.reviewCaseId
  ) {
    const reviewCase =
      await AdminReviewCase.findById(
        input.reviewCaseId,
      )

    if (!reviewCase) {
      throw new ApiError(
        404,
        'Review case was not found.',
        [
          {
            code:
              'ADMIN_GOVERNANCE_ACTION_REVIEW_CASE_NOT_FOUND',
          },
        ],
      )
    }

    if (
      reviewCase.domain !==
        domain ||
      reviewCase.entity.type !==
        input.entityType ||
      reviewCase.entity.id !==
        input.entityId
    ) {
      throw new ApiError(
        409,
        'Review case entity does not match the requested governance action.',
        [
          {
            code:
              'ADMIN_GOVERNANCE_ACTION_CASE_ENTITY_MISMATCH',
          },
        ],
      )
    }

    assertDomainMutate(
      adminAuthorization,
      reviewCase.domain,
    )

    return reviewCase
  }

  const created =
    await createAdminReviewCase({
      input: {
        domain,
        caseType:
          input.action ===
          'recover'
            ? 'data_quality'
            : 'safety',
        entity: {
          type:
            input.entityType,
          id:
            input.entityId,
          label:
            input.summary ||
            '',
        },
        severity:
          'critical',
        priority:
          'p0',
        summary:
          input.summary ||
          `Emergency ${input.action} action for ${input.entityType}`,
        details:
          input.reason,
        evidence:
          input.evidence,
      },
      actorUser,
      adminAuthorization,
      requestId,
    })

  return AdminReviewCase.findById(
    created.reviewCase.id,
  )
}

export async function executeAdminGovernanceAction({
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const entityPolicy =
    GOVERNANCE_ACTION_REGISTRY[
      input.entityType
    ]

  if (!entityPolicy) {
    throw new ApiError(
      400,
      'Unsupported governed entity type.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ACTION_ENTITY_UNSUPPORTED',
        },
      ],
    )
  }

  const actionPolicy =
    entityPolicy.actions[
      input.action
    ]

  if (!actionPolicy) {
    if (
      input.action ===
        'recover' &&
      input.entityType ===
        'product_version'
    ) {
      throw new ApiError(
        409,
        'A retired Product Version cannot be silently restored. Create and govern a corrected superseding Product Version through M04.',
        [
          {
            code:
              'ADMIN_PRODUCT_RECOVERY_REQUIRES_NEW_VERSION',
          },
        ],
      )
    }

    if (
      input.action ===
        'recover' &&
      input.entityType ===
        'recipe_version'
    ) {
      throw new ApiError(
        409,
        'A disabled or retired Recipe Version cannot be silently restored. Use the existing versioned M07 correction workflow.',
        [
          {
            code:
              'ADMIN_RECIPE_VERSION_RECOVERY_REQUIRES_VERSIONED_WORKFLOW',
          },
        ],
      )
    }

    throw new ApiError(
      409,
      'This governance action is not supported for the selected entity.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ACTION_UNSUPPORTED',
        },
      ],
    )
  }

  assertExactPermission(
    adminAuthorization,
    actionPolicy.permissionKey,
  )

  const beforeRaw =
    await entitySnapshot(
      input.entityType,
      input.entityId,
    )

  if (!beforeRaw) {
    throw new ApiError(
      404,
      'Governed entity was not found.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ACTION_ENTITY_NOT_FOUND',
        },
      ],
    )
  }

  const reviewCase =
    await requireActionReviewCase({
      input,
      domain:
        entityPolicy.domain,
      actorUser,
      adminAuthorization,
      requestId,
    })

  if (
    TERMINAL_REVIEW_CASE_STATUSES.has(
      reviewCase.status,
    )
  ) {
    throw new ApiError(
      409,
      'Governance action cannot execute against a terminal review case.',
      [
        {
          code:
            'ADMIN_GOVERNANCE_ACTION_CASE_TERMINAL',
        },
      ],
    )
  }

  let domainResult =
    null

  if (
    input.entityType ===
      'product_version'
  ) {
    domainResult =
      await retireProductVersion({
        versionId:
          input.entityId,
        reasonCode:
          'catalog.governance',
        reasonDetails:
          input.reason,
        actorUser,
        adminAuthorization,
        requestId,
      })
  } else if (
    input.entityType ===
      'recipe_version'
  ) {
    domainResult =
      await changeRecipeVersionLifecycle(
        input.entityId,
        {
          action:
            'disable',
          reason:
            input.reason,
        },
        actorUser,
        {
          adminAuthorization,
          requestId,
        },
      )
  } else if (
    input.entityType ===
      'dish'
  ) {
    domainResult =
      await changeDishLifecycle(
        input.entityId,
        {
          action:
            input.action ===
            'recover'
              ? 'restore'
              : 'disable',
          reason:
            input.reason,
        },
        actorUser,
        {
          adminAuthorization,
          requestId,
        },
      )
  }

  const afterRaw =
    await entitySnapshot(
      input.entityType,
      input.entityId,
    )

  const beforeSnapshot =
    sanitizeAdminAuditValue(
      beforeRaw,
    )

  const afterSnapshot =
    sanitizeAdminAuditValue(
      afterRaw,
    )

  reviewCase.status =
    'resolved'

  reviewCase.evidence =
    normalizeEvidence([
      ...(reviewCase.evidence || []),
      ...input.evidence,
    ])

  reviewCase.beforeSnapshot =
    beforeSnapshot

  reviewCase.afterSnapshot =
    afterSnapshot

  reviewCase.decision = {
    code:
      input.action ===
      'recover'
        ? 'recovered'
        : input.action ===
          'quarantine'
          ? 'quarantined'
          : 'disabled',
    reason:
      input.reason,
    decidedByUserId:
      actorId(
        actorUser,
      ),
    decidedAt:
      new Date(),
  }

  reviewCase.resolvedAt =
    new Date()

  reviewCase.updatedByUserId =
    actorId(
      actorUser,
    )

  reviewCase.timeline.push({
    eventType:
      'command_executed',
    actorUserId:
      actorId(
        actorUser,
      ),
    note:
      input.reason,
    metadata: {
      requestedAction:
        input.action,
      implementation:
        actionPolicy.implementation,
      permissionKey:
        actionPolicy.permissionKey,
    },
  })

  await reviewCase.save()

  await recordGovernanceAudit({
    actorUser,
    adminAuthorization,
    permissionKey:
      actionPolicy.permissionKey,
    action:
      'governance.command.executed',
    entityType:
      input.entityType,
    entityId:
      input.entityId,
    reason:
      input.reason,
    beforeSnapshot,
    afterSnapshot,
    metadata: {
      reviewCaseId:
        id(
          reviewCase._id,
        ),
      reviewCaseKey:
        reviewCase.caseKey,
      requestedAction:
        input.action,
      implementation:
        actionPolicy.implementation,
      evidenceCount:
        input.evidence.length,
      historicalTruthPreserved:
        true,
    },
    requestId,
  })

  return {
    action: {
      requested:
        input.action,
      implementation:
        actionPolicy.implementation,
      entityType:
        input.entityType,
      entityId:
        input.entityId,
      permissionKey:
        actionPolicy.permissionKey,
    },

    domainResult,

    reviewCase:
      serializeReviewCase(
        reviewCase,
      ),

    policy: {
      directDatabaseMutation:
        false,
      domainServiceDelegation:
        true,
      reasonAndEvidenceRequired:
        true,
      historicalTruthPreserved:
        true,
      productVersionRecoveryRequiresNewVersion:
        true,
      recipeVersionRecoveryRequiresVersionedWorkflow:
        true,
    },
  }
}