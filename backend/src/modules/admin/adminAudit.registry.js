/*
|--------------------------------------------------------------------------
| Admin Audit Registry
|--------------------------------------------------------------------------
|
| This registry defines privileged mutation actions and their accepted
| reason codes.
|
| Important architecture rule:
|
| - Customer remains Customer
| - Seller + Brand + B2B are consolidated into Host
| - Super Admin retains existing full authority
| - Specialized internal admins remain permission profiles only
|
*/

function freezeReasonDefinition(
  definition,
) {
  return Object.freeze({
    ...definition,
  })
}

/*
|--------------------------------------------------------------------------
| Reason Definitions
|--------------------------------------------------------------------------
*/

export const ADMIN_AUDIT_REASON_DEFINITIONS =
  Object.freeze([
    freezeReasonDefinition({
      code:
        'host_review.approved',

      label:
        'Host application approved',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'host_review.rejected',

      label:
        'Host application rejected',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'host_review.suspended',

      label:
        'Host access suspended',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'admin_role.created',

      label:
        'Admin role created',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'admin_role.updated',

      label:
        'Admin role updated',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'admin_role.disabled',

      label:
        'Admin role disabled',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'admin_assignment.granted',

      label:
        'Admin assignment granted',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'admin_assignment.updated',

      label:
        'Admin assignment updated',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'admin_assignment.revoked',

      label:
        'Admin assignment revoked',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'catalog.governance',

      label:
        'Catalog governance action',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'recipe.governance',

      label:
        'Recipe governance action',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'marketplace.operation',

      label:
        'Marketplace operation',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'trust_safety.enforcement',

      label:
        'Trust and safety enforcement',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'finance.adjustment',

      label:
        'Finance adjustment',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'cms.governance',

      label:
        'CMS governance action',

      requiresDetails:
        false,
    }),

    freezeReasonDefinition({
      code:
        'security.exception',

      label:
        'Security exception',

      requiresDetails:
        true,
    }),

    freezeReasonDefinition({
      code:
        'other.justified',

      label:
        'Other justified administrative action',

      requiresDetails:
        true,
    }),
  ])

export const ADMIN_AUDIT_REASON_CODES =
  Object.freeze(
    ADMIN_AUDIT_REASON_DEFINITIONS.map(
      (definition) =>
        definition.code,
    ),
  )

const ADMIN_AUDIT_REASON_CODE_SET =
  new Set(
    ADMIN_AUDIT_REASON_CODES,
  )

/*
|--------------------------------------------------------------------------
| Critical Action → Allowed Reasons
|--------------------------------------------------------------------------
*/

export const ADMIN_AUDIT_CRITICAL_ACTION_REASONS =
  Object.freeze({
    'host.review.approve':
      Object.freeze([
        'host_review.approved',
      ]),

    'host.review.reject':
      Object.freeze([
        'host_review.rejected',
      ]),

    'host.review.suspend':
      Object.freeze([
        'host_review.suspended',
      ]),

    'admin.role.create':
      Object.freeze([
        'admin_role.created',
      ]),

    'admin.role.update':
      Object.freeze([
        'admin_role.updated',
      ]),

    'admin.role.disable':
      Object.freeze([
        'admin_role.disabled',
      ]),

    'admin.assignment.grant':
      Object.freeze([
        'admin_assignment.granted',
      ]),

    'admin.assignment.update':
      Object.freeze([
        'admin_assignment.updated',
      ]),

    'admin.assignment.revoke':
      Object.freeze([
        'admin_assignment.revoked',
      ]),

    'catalog.mutate':
      Object.freeze([
        'catalog.governance',
      ]),

    'catalog.publish':
      Object.freeze([
        'catalog.governance',
      ]),

    'recipe.mutate':
      Object.freeze([
        'recipe.governance',
      ]),

    'recipe.publish':
      Object.freeze([
        'recipe.governance',
      ]),

    'marketplace.mutate':
      Object.freeze([
        'marketplace.operation',
      ]),

    'trust_safety.mutate':
      Object.freeze([
        'trust_safety.enforcement',
      ]),

    'finance.mutate':
      Object.freeze([
        'finance.adjustment',
      ]),

    'cms.mutate':
      Object.freeze([
        'cms.governance',
      ]),

    'cms.publish':
      Object.freeze([
        'cms.governance',
      ]),
  })

export const ADMIN_AUDIT_CRITICAL_ACTIONS =
  Object.freeze(
    Object.keys(
      ADMIN_AUDIT_CRITICAL_ACTION_REASONS,
    ),
  )

/*
|--------------------------------------------------------------------------
| Reason Helpers
|--------------------------------------------------------------------------
*/

export function isKnownAdminAuditReasonCode(
  reasonCode,
) {
  const normalized =
    String(
      reasonCode ||
        '',
    )
      .trim()
      .toLowerCase()

  return ADMIN_AUDIT_REASON_CODE_SET.has(
    normalized,
  )
}

export function getAdminAuditReasonDefinition(
  reasonCode,
) {
  const normalized =
    String(
      reasonCode ||
        '',
    )
      .trim()
      .toLowerCase()

  return ADMIN_AUDIT_REASON_DEFINITIONS.find(
    (definition) =>
      definition.code ===
      normalized,
  ) || null
}

export function isCriticalAdminAuditAction(
  action,
) {
  const normalized =
    String(
      action ||
        '',
    )
      .trim()
      .toLowerCase()

  return Boolean(
    ADMIN_AUDIT_CRITICAL_ACTION_REASONS[
      normalized
    ],
  )
}

export function getAllowedAdminAuditReasonCodes(
  action,
) {
  const normalized =
    String(
      action ||
        '',
    )
      .trim()
      .toLowerCase()

  return [
    ...(
      ADMIN_AUDIT_CRITICAL_ACTION_REASONS[
        normalized
      ] ||
      []
    ),
  ]
}