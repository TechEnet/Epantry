import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  UserConsent,
} from '../users/userConsent.model.js'

import {
  PrivacyRightsRequest,
  RegulatoryProfile,
  RetentionPolicy,
  SecurityEvent,
} from './hardening.models.js'

const SENSITIVE_SECURITY_KEY_PATTERN =
  /password|passcode|otp|token|secret|cookie|authorization|credential|session|csrf|card|cvv|accountnumber|upi/i

const MAX_SECURITY_METADATA_DEPTH =
  6

const MAX_SECURITY_METADATA_ARRAY =
  50

const MAX_SECURITY_METADATA_KEYS =
  80

const MAX_SECURITY_STRING_LENGTH =
  1000

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

function actorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated EPANTRY identity is required.',
      [
        {
          code:
            'M20_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function sanitizeSecurityMetadata(
  value,
  depth = 0,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  if (
    depth >
    MAX_SECURITY_METADATA_DEPTH
  ) {
    return '[MAX_DEPTH]'
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString()
  }

  if (
    typeof value ===
    'string'
  ) {
    return value.slice(
      0,
      MAX_SECURITY_STRING_LENGTH,
    )
  }

  if (
    typeof value ===
      'number' ||
    typeof value ===
      'boolean'
  ) {
    return value
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value
      .slice(
        0,
        MAX_SECURITY_METADATA_ARRAY,
      )
      .map(
        (item) =>
          sanitizeSecurityMetadata(
            item,
            depth + 1,
          ),
      )
  }

  if (
    typeof value?.toHexString ===
    'function'
  ) {
    return value.toHexString()
  }

  if (
    typeof value ===
    'object'
  ) {
    const result = {}

    for (
      const [
        key,
        nestedValue,
      ] of Object.entries(
        value,
      ).slice(
        0,
        MAX_SECURITY_METADATA_KEYS,
      )
    ) {
      if (
        SENSITIVE_SECURITY_KEY_PATTERN.test(
          key,
        )
      ) {
        result[key] =
          '[REDACTED]'

        continue
      }

      result[key] =
        sanitizeSecurityMetadata(
          nestedValue,
          depth + 1,
        )
    }

    return result
  }

  return String(
    value,
  ).slice(
    0,
    MAX_SECURITY_STRING_LENGTH,
  )
}

export async function recordSecurityEvent({
  eventType,
  severity = 'warning',
  sourceDomain,
  occurredAt = new Date(),
  requestId = '',
  correlationId = '',
  actorUserId = null,
  organizationId = null,
  metadata = {},
}) {
  return SecurityEvent.create({
    eventVersion:
      1,
    eventType,
    severity,
    sourceDomain,
    occurredAt,
    requestId,
    correlationId,
    actorUserId,
    organizationId,
    metadata:
      sanitizeSecurityMetadata(
        metadata,
      ),
  })
}

export async function recordSecurityEventBestEffort(
  input,
) {
  try {
    return await recordSecurityEvent(
      input,
    )
  } catch {
    return null
  }
}

async function currentConsentSnapshot(
  userId,
) {
  const rows =
    await UserConsent.aggregate([
      {
        $match: {
          userId:
            new mongoose.Types.ObjectId(
              String(userId),
            ),
        },
      },
      {
        $sort: {
          recordedAt:
            -1,
          _id:
            -1,
        },
      },
      {
        $group: {
          _id:
            '$consentType',
          decision: {
            $first:
              '$decision',
          },
          version: {
            $first:
              '$version',
          },
          recordedAt: {
            $first:
              '$recordedAt',
          },
        },
      },
    ])

  return Object.fromEntries(
    rows.map(
      (row) => [
        row._id,
        {
          decision:
            row.decision,
          version:
            row.version,
          recordedAt:
            row.recordedAt,
        },
      ],
    ),
  )
}

function activeDateFilter(
  at,
) {
  return {
    effectiveFrom: {
      $lte:
        at,
    },
    $and: [
      {
        $or: [
          {
            effectiveTo:
              null,
          },
          {
            effectiveTo: {
              $gte:
                at,
            },
          },
        ],
      },
      {
        $or: [
          {
            supersededAt:
              null,
          },
          {
            supersededAt: {
              $gt:
                at,
            },
          },
        ],
      },
    ],
  }
}

export async function getApplicableRetentionPolicies({
  at = new Date(),
}) {
  const policies =
    await RetentionPolicy.find({
      status: {
        $in: [
          'effective',
          'superseded',
        ],
      },
      ...activeDateFilter(
        at,
      ),
    })
      .sort({
        policyKey:
          1,
        versionNumber:
          -1,
      })
      .lean()

  const latestByKey =
    new Map()

  for (
    const policy of
    policies
  ) {
    if (
      !latestByKey.has(
        policy.policyKey,
      )
    ) {
      latestByKey.set(
        policy.policyKey,
        policy,
      )
    }
  }

  return [
    ...latestByKey.values(),
  ]
}

function serializePrivacyRequest(
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
    requestId:
      item.requestId,
    requestType:
      item.requestType,
    scope:
      item.scope,
    status:
      item.status,
    requestedAt:
      item.requestedAt,
    retentionEvaluation:
      item.retentionEvaluation ||
      [],
    exportArtifactStatus:
      item.exportArtifactStatus,
    blockedReasonCode:
      item.blockedReasonCode ||
      '',
    completedAt:
      item.completedAt ||
      null,
  }
}

export async function getPrivacyContext({
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const [
    consentSnapshot,
    recentRequests,
  ] = await Promise.all([
    currentConsentSnapshot(
      userId,
    ),
    PrivacyRightsRequest.find({
      userId,
    })
      .sort({
        requestedAt:
          -1,
      })
      .limit(20)
      .lean(),
  ])

  return {
    consentSnapshot,
    requests:
      recentRequests.map(
        serializePrivacyRequest,
      ),
    policy: {
      consentAuthority:
        'm02_user_consent_events',
      deletionIsBlindCascade:
        false,
      immutableCommercialAuditRecordsMayRequireRetention:
        true,
    },
  }
}

export async function createPrivacyRightsRequest({
  input,
  actorUser,
  requestId = '',
}) {
  const userId =
    actorId(
      actorUser,
    )

  const existing =
    await PrivacyRightsRequest.findOne({
      userId,
      requestType:
        input.requestType,
      status: {
        $in: [
          'submitted',
          'in_review',
          'blocked',
          'processing',
        ],
      },
    })
      .sort({
        requestedAt:
          -1,
      })
      .lean()

  if (existing) {
    return {
      privacyRequest:
        serializePrivacyRequest(
          existing,
        ),
      deduplicated:
        true,
    }
  }

  const [
    retentionPolicies,
    consentSnapshot,
  ] = await Promise.all([
    getApplicableRetentionPolicies({
      at:
        new Date(),
    }),
    currentConsentSnapshot(
      userId,
    ),
  ])

  const retentionEvaluation =
    retentionPolicies.map(
      (policy) => ({
        policyKey:
          policy.policyKey,
        policyVersionNumber:
          policy.versionNumber,
        dataClass:
          policy.dataClass,
        action:
          policy.dispositionAction,
        immutableRecordClass:
          policy.immutableRecordClass ===
          true,
      }),
    )

  const created =
    await PrivacyRightsRequest.create({
      userId,
      requestType:
        input.requestType,
      scope:
        input.scope,
      status:
        'submitted',
      requestedAt:
        new Date(),
      retentionEvaluation,
      consentSnapshot,
      exportArtifactStatus:
        'not_generated',
    })

  await recordSecurityEventBestEffort({
    eventType:
      'privacy_right_request_created',
    severity:
      'info',
    sourceDomain:
      'privacy',
    requestId,
    correlationId:
      requestId,
    actorUserId:
      userId,
    metadata: {
      requestType:
        input.requestType,
      policyCount:
        retentionEvaluation.length,
    },
  })

  return {
    privacyRequest:
      serializePrivacyRequest(
        created,
      ),
    deduplicated:
      false,
  }
}

export async function listOwnPrivacyRequests({
  actorUser,
}) {
  const records =
    await PrivacyRightsRequest.find({
      userId:
        actorId(
          actorUser,
        ),
    })
      .sort({
        requestedAt:
          -1,
      })
      .limit(100)
      .lean()

  return {
    requests:
      records.map(
        serializePrivacyRequest,
      ),
  }
}

export async function getOwnPrivacyRequest({
  requestObjectId,
  actorUser,
}) {
  const record =
    await PrivacyRightsRequest.findOne({
      _id:
        requestObjectId,
      userId:
        actorId(
          actorUser,
        ),
    }).lean()

  if (!record) {
    throw new ApiError(
      404,
      'Privacy request was not found.',
      [
        {
          code:
            'PRIVACY_REQUEST_NOT_FOUND',
        },
      ],
    )
  }

  return {
    privacyRequest:
      serializePrivacyRequest(
        record,
      ),
  }
}

function assertAdminActor(
  actorUser,
) {
  return actorId(
    actorUser,
  )
}

async function auditTrustSafetyMutation({
  actorUser,
  adminAuthorization,
  entityType,
  entityId,
  reason,
  beforeSnapshot = null,
  afterSnapshot = null,
  requestId = '',
}) {
  return recordAdminAuditEvent({
    actorUser,
    adminAuthorization,
    action:
      'trust_safety.mutate',
    permissionKey:
      'trust_safety.mutate',
    entityType,
    entityId,
    outcome:
      'success',
    reasonCode:
      'trust_safety.enforcement',
    reasonDetails:
      reason,
    beforeSnapshot,
    afterSnapshot,
    metadata: {
      m20Governance:
        true,
    },
    requestId,
  })
}

function serializeRetentionPolicy(
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
    policyKey:
      item.policyKey,
    versionNumber:
      item.versionNumber,
    dataClass:
      item.dataClass,
    purpose:
      item.purpose,
    retentionDays:
      item.retentionDays,
    dispositionAction:
      item.dispositionAction,
    immutableRecordClass:
      item.immutableRecordClass ===
      true,
    applicability:
      item.applicability ||
      [],
    effectiveFrom:
      item.effectiveFrom,
    effectiveTo:
      item.effectiveTo ||
      null,
    evidenceRefs:
      item.evidenceRefs ||
      [],
    status:
      item.status,
    createdAt:
      item.createdAt ||
      null,
  }
}

export async function listRetentionPolicies() {
  const records =
    await RetentionPolicy.find({})
      .sort({
        policyKey:
          1,
        versionNumber:
          -1,
      })
      .limit(500)
      .lean()

  return {
    policies:
      records.map(
        serializeRetentionPolicy,
      ),
  }
}

export async function createRetentionPolicy({
  input,
  actorUser,
  adminAuthorization,
  requestId = '',
}) {
  const userId =
    assertAdminActor(
      actorUser,
    )

  const latest =
    await RetentionPolicy.findOne({
      policyKey:
        input.policyKey,
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  if (
    latest &&
    [
      'draft',
      'in_review',
      'approved',
    ].includes(
      latest.status,
    )
  ) {
    throw new ApiError(
      409,
      'Finish the open Retention Policy version before creating another version.',
      [
        {
          code:
            'RETENTION_POLICY_OPEN_VERSION_EXISTS',
        },
      ],
    )
  }

  const created =
    await RetentionPolicy.create({
      policyKey:
        input.policyKey,
      versionNumber:
        Number(
          latest?.versionNumber ||
          0,
        ) + 1,
      dataClass:
        input.dataClass,
      purpose:
        input.purpose,
      retentionDays:
        input.retentionDays,
      dispositionAction:
        input.dispositionAction,
      immutableRecordClass:
        input.immutableRecordClass,
      applicability:
        [
          ...new Set(
            input.applicability,
          ),
        ],
      effectiveFrom:
        input.effectiveFrom,
      effectiveTo:
        input.effectiveTo,
      evidenceRefs:
        input.evidenceRefs,
      status:
        'draft',
      createdByUserId:
        userId,
    })

  await auditTrustSafetyMutation({
    actorUser,
    adminAuthorization,
    entityType:
      'retention_policy',
    entityId:
      created._id,
    reason:
      input.reason,
    afterSnapshot:
      serializeRetentionPolicy(
        created,
      ),
    requestId,
  })

  return {
    policy:
      serializeRetentionPolicy(
        created,
      ),
  }
}

export async function changeRetentionPolicyStatus({
  policyId,
  action,
  reason,
  actorUser,
  adminAuthorization,
  requestId = '',
}) {
  const userId =
    assertAdminActor(
      actorUser,
    )

  const policy =
    await RetentionPolicy.findById(
      policyId,
    )

  if (!policy) {
    throw new ApiError(
      404,
      'Retention Policy was not found.',
      [
        {
          code:
            'RETENTION_POLICY_NOT_FOUND',
        },
      ],
    )
  }

  const before =
    serializeRetentionPolicy(
      policy,
    )

  const now =
    new Date()

  if (
    action ===
    'submit'
  ) {
    if (
      policy.status !==
      'draft'
    ) {
      throw new ApiError(
        409,
        'Only a draft Retention Policy can be submitted.',
        [
          {
            code:
              'RETENTION_POLICY_SUBMIT_STATE_INVALID',
          },
        ],
      )
    }

    policy.status =
      'in_review'
    policy.submittedAt =
      now
    policy.submittedByUserId =
      userId
  } else if (
    action ===
    'approve'
  ) {
    if (
      policy.status !==
      'in_review'
    ) {
      throw new ApiError(
        409,
        'Only an in-review Retention Policy can be approved.',
        [
          {
            code:
              'RETENTION_POLICY_APPROVE_STATE_INVALID',
          },
        ],
      )
    }

    if (
      id(
        policy.createdByUserId,
      ) ===
      id(
        userId,
      )
    ) {
      throw new ApiError(
        409,
        'Retention Policy maker-checker requires a different approver.',
        [
          {
            code:
              'RETENTION_POLICY_MAKER_CHECKER_REQUIRED',
          },
        ],
      )
    }

    policy.status =
      'approved'
    policy.approvedAt =
      now
    policy.approvedByUserId =
      userId
  } else if (
    action ===
    'activate'
  ) {
    if (
      policy.status !==
      'approved'
    ) {
      throw new ApiError(
        409,
        'Only an approved Retention Policy can be activated.',
        [
          {
            code:
              'RETENTION_POLICY_ACTIVATE_STATE_INVALID',
          },
        ],
      )
    }

    if (
      id(
        policy.createdByUserId,
      ) ===
      id(
        userId,
      )
    ) {
      throw new ApiError(
        409,
        'Retention Policy activation cannot be performed by its maker.',
        [
          {
            code:
              'RETENTION_POLICY_MAKER_CHECKER_REQUIRED',
          },
        ],
      )
    }

    await RetentionPolicy.updateMany(
      {
        _id: {
          $ne:
            policy._id,
        },
        policyKey:
          policy.policyKey,
        status:
          'effective',
      },
      {
        $set: {
          status:
            'superseded',
          supersededAt:
            policy.effectiveFrom,
        },
      },
    )

    policy.status =
      'effective'
    policy.activatedAt =
      now
    policy.activatedByUserId =
      userId
  }

  await policy.save()

  await auditTrustSafetyMutation({
    actorUser,
    adminAuthorization,
    entityType:
      'retention_policy',
    entityId:
      policy._id,
    reason,
    beforeSnapshot:
      before,
    afterSnapshot:
      serializeRetentionPolicy(
        policy,
      ),
    requestId,
  })

  return {
    policy:
      serializeRetentionPolicy(
        policy,
      ),
  }
}

function serializeRegulatoryProfile(
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
    profileKey:
      item.profileKey,
    versionNumber:
      item.versionNumber,
    jurisdiction:
      item.jurisdiction,
    operatorApplicability:
      item.operatorApplicability ||
      [],
    effectiveFrom:
      item.effectiveFrom,
    effectiveTo:
      item.effectiveTo ||
      null,
    requiredFields:
      item.requiredFields ||
      [],
    calculationMethodologyVersion:
      item.calculationMethodologyVersion,
    presentationRules:
      item.presentationRules ||
      {},
    evidenceRefs:
      item.evidenceRefs ||
      [],
    status:
      item.status,
    createdAt:
      item.createdAt ||
      null,
  }
}

export async function listRegulatoryProfiles() {
  const records =
    await RegulatoryProfile.find({})
      .sort({
        profileKey:
          1,
        versionNumber:
          -1,
      })
      .limit(500)
      .lean()

  return {
    profiles:
      records.map(
        serializeRegulatoryProfile,
      ),
  }
}

export async function createRegulatoryProfile({
  input,
  actorUser,
  adminAuthorization,
  requestId = '',
}) {
  const userId =
    assertAdminActor(
      actorUser,
    )

  const latest =
    await RegulatoryProfile.findOne({
      profileKey:
        input.profileKey,
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  if (
    latest &&
    [
      'draft',
      'in_review',
      'approved',
    ].includes(
      latest.status,
    )
  ) {
    throw new ApiError(
      409,
      'Finish the open Regulatory Profile version before creating another version.',
      [
        {
          code:
            'REGULATORY_PROFILE_OPEN_VERSION_EXISTS',
        },
      ],
    )
  }

  const created =
    await RegulatoryProfile.create({
      profileKey:
        input.profileKey,
      versionNumber:
        Number(
          latest?.versionNumber ||
          0,
        ) + 1,
      jurisdiction:
        input.jurisdiction,
      operatorApplicability: [
        ...new Set(
          input.operatorApplicability,
        ),
      ],
      effectiveFrom:
        input.effectiveFrom,
      effectiveTo:
        input.effectiveTo,
      requiredFields: [
        ...new Set(
          input.requiredFields,
        ),
      ],
      calculationMethodologyVersion:
        input.calculationMethodologyVersion,
      presentationRules:
        input.presentationRules,
      evidenceRefs:
        input.evidenceRefs,
      status:
        'draft',
      createdByUserId:
        userId,
    })

  await auditTrustSafetyMutation({
    actorUser,
    adminAuthorization,
    entityType:
      'regulatory_profile',
    entityId:
      created._id,
    reason:
      input.reason,
    afterSnapshot:
      serializeRegulatoryProfile(
        created,
      ),
    requestId,
  })

  return {
    profile:
      serializeRegulatoryProfile(
        created,
      ),
  }
}

export async function changeRegulatoryProfileStatus({
  profileId,
  action,
  reason,
  actorUser,
  adminAuthorization,
  requestId = '',
}) {
  const userId =
    assertAdminActor(
      actorUser,
    )

  const profile =
    await RegulatoryProfile.findById(
      profileId,
    )

  if (!profile) {
    throw new ApiError(
      404,
      'Regulatory Profile was not found.',
      [
        {
          code:
            'REGULATORY_PROFILE_NOT_FOUND',
        },
      ],
    )
  }

  const before =
    serializeRegulatoryProfile(
      profile,
    )

  const now =
    new Date()

  if (
    action ===
    'submit'
  ) {
    if (
      profile.status !==
      'draft'
    ) {
      throw new ApiError(
        409,
        'Only a draft Regulatory Profile can be submitted.',
        [
          {
            code:
              'REGULATORY_PROFILE_SUBMIT_STATE_INVALID',
          },
        ],
      )
    }

    profile.status =
      'in_review'
    profile.submittedAt =
      now
    profile.submittedByUserId =
      userId
  } else if (
    action ===
    'approve'
  ) {
    if (
      profile.status !==
      'in_review'
    ) {
      throw new ApiError(
        409,
        'Only an in-review Regulatory Profile can be approved.',
        [
          {
            code:
              'REGULATORY_PROFILE_APPROVE_STATE_INVALID',
          },
        ],
      )
    }

    if (
      id(
        profile.createdByUserId,
      ) ===
      id(
        userId,
      )
    ) {
      throw new ApiError(
        409,
        'Regulatory Profile maker-checker requires a different approver.',
        [
          {
            code:
              'REGULATORY_PROFILE_MAKER_CHECKER_REQUIRED',
          },
        ],
      )
    }

    profile.status =
      'approved'
    profile.approvedAt =
      now
    profile.approvedByUserId =
      userId
  } else if (
    action ===
    'activate'
  ) {
    if (
      profile.status !==
      'approved'
    ) {
      throw new ApiError(
        409,
        'Only an approved Regulatory Profile can be activated.',
        [
          {
            code:
              'REGULATORY_PROFILE_ACTIVATE_STATE_INVALID',
          },
        ],
      )
    }

    if (
      id(
        profile.createdByUserId,
      ) ===
      id(
        userId,
      )
    ) {
      throw new ApiError(
        409,
        'Regulatory Profile activation cannot be performed by its maker.',
        [
          {
            code:
              'REGULATORY_PROFILE_MAKER_CHECKER_REQUIRED',
          },
        ],
      )
    }

    await RegulatoryProfile.updateMany(
      {
        _id: {
          $ne:
            profile._id,
        },
        profileKey:
          profile.profileKey,
        status:
          'effective',
      },
      {
        $set: {
          status:
            'superseded',
          supersededAt:
            profile.effectiveFrom,
        },
      },
    )

    profile.status =
      'effective'
    profile.activatedAt =
      now
    profile.activatedByUserId =
      userId
  }

  await profile.save()

  await auditTrustSafetyMutation({
    actorUser,
    adminAuthorization,
    entityType:
      'regulatory_profile',
    entityId:
      profile._id,
    reason,
    beforeSnapshot:
      before,
    afterSnapshot:
      serializeRegulatoryProfile(
        profile,
      ),
    requestId,
  })

  return {
    profile:
      serializeRegulatoryProfile(
        profile,
      ),
  }
}

export async function getApplicableRegulatoryProfile({
  jurisdiction,
  operatorContext,
  at = new Date(),
}) {
  const record =
    await RegulatoryProfile.findOne({
      jurisdiction:
        String(
          jurisdiction,
        ).trim().toUpperCase(),
      operatorApplicability:
        operatorContext,
      status: {
        $in: [
          'effective',
          'superseded',
        ],
      },
      ...activeDateFilter(
        at,
      ),
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  return record
    ? serializeRegulatoryProfile(
        record,
      )
    : null
}

export async function listSecurityEvents({
  limit = 100,
  severity = null,
}) {
  const filter = {}

  if (severity) {
    filter.severity =
      severity
  }

  const records =
    await SecurityEvent.find(
      filter,
    )
      .sort({
        occurredAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(limit) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  return {
    securityEvents:
      records.map(
        (record) => ({
          id:
            id(
              record._id,
            ),
          securityEventId:
            record.securityEventId,
          eventType:
            record.eventType,
          severity:
            record.severity,
          sourceDomain:
            record.sourceDomain,
          occurredAt:
            record.occurredAt,
          requestId:
            record.requestId,
          correlationId:
            record.correlationId,
          metadata:
            record.metadata ||
            {},
        }),
      ),
  }
}