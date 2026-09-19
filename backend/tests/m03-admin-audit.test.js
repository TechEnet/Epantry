import assert from 'node:assert/strict'

import {
  test,
} from 'node:test'

/*
|--------------------------------------------------------------------------
| Test Environment
|--------------------------------------------------------------------------
*/

process.env.NODE_ENV =
  'test'

process.env.PORT =
  process.env.PORT ||
  '5001'

process.env.MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/epantry_test'

process.env.FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'http://localhost:5173'

/*
|--------------------------------------------------------------------------
| Production Imports
|--------------------------------------------------------------------------
*/

const {
  ADMIN_AUDIT_CRITICAL_ACTIONS,
  ADMIN_AUDIT_REASON_CODES,
  getAllowedAdminAuditReasonCodes,
  isCriticalAdminAuditAction,
} =
  await import(
    '../src/modules/admin/adminAudit.registry.js'
  )

const {
  AdminAuditEvent,
} =
  await import(
    '../src/modules/admin/adminAudit.model.js'
  )

const {
  normalizeAdminAuditReason,
  recordAdminAuditEvent,
  sanitizeAdminAuditValue,
} =
  await import(
    '../src/modules/admin/adminAudit.service.js'
  )

/*
|--------------------------------------------------------------------------
| Temporary Model Mock
|--------------------------------------------------------------------------
*/

async function withMockedAuditCreate(
  callback,
) {
  const originalCreate =
    AdminAuditEvent.create

  let capturedPayload =
    null

  AdminAuditEvent.create =
    async (
      payload,
    ) => {
      capturedPayload =
        payload

      return {
        ...payload,

        _id:
          '64b000000000000000000901',
      }
    }

  try {
    return await callback(
      () =>
        capturedPayload,
    )
  } finally {
    AdminAuditEvent.create =
      originalCreate
  }
}

/*
|--------------------------------------------------------------------------
| Registry
|--------------------------------------------------------------------------
*/

test(
  'admin audit registry defines unique controlled reasons for critical privileged actions',

  () => {
    assert.equal(
      new Set(
        ADMIN_AUDIT_REASON_CODES,
      ).size,
      ADMIN_AUDIT_REASON_CODES.length,
    )

    assert.equal(
      ADMIN_AUDIT_CRITICAL_ACTIONS.includes(
        'host.review.approve',
      ),
      true,
    )

    assert.equal(
      isCriticalAdminAuditAction(
        'finance.mutate',
      ),
      true,
    )

    assert.deepEqual(
      getAllowedAdminAuditReasonCodes(
        'host.review.reject',
      ),
      [
        'host_review.rejected',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Critical Reason Required
|--------------------------------------------------------------------------
*/

test(
  'critical privileged action cannot be audited without a reason code',

  () => {
    assert.throws(
      () =>
        normalizeAdminAuditReason({
          action:
            'host.review.suspend',
        }),

      (error) =>
        error?.statusCode ===
          400 &&
        error?.errors?.[0]?.code ===
          'ADMIN_REASON_REQUIRED',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Action / Reason Binding
|--------------------------------------------------------------------------
*/

test(
  'critical privileged action rejects a reason code belonging to another action',

  () => {
    assert.throws(
      () =>
        normalizeAdminAuditReason({
          action:
            'host.review.reject',

          reasonCode:
            'host_review.approved',
        }),

      (error) =>
        error?.statusCode ===
          400 &&
        error?.errors?.[0]?.code ===
          'ADMIN_REASON_ACTION_MISMATCH',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Justified Other Reason
|--------------------------------------------------------------------------
*/

test(
  'reason codes requiring explanation cannot omit reason details',

  () => {
    assert.throws(
      () =>
        normalizeAdminAuditReason({
          action:
            'security.review',

          reasonCode:
            'other.justified',
        }),

      (error) =>
        error?.statusCode ===
          400 &&
        error?.errors?.[0]?.code ===
          'ADMIN_REASON_DETAILS_REQUIRED',
    )

    const reason =
      normalizeAdminAuditReason({
        action:
          'security.review',

        reasonCode:
          'other.justified',

        reasonDetails:
          'Manual review completed after support escalation.',
      })

    assert.equal(
      reason.code,
      'other.justified',
    )

    assert.equal(
      Boolean(
        reason.details,
      ),
      true,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Sensitive Snapshot Redaction
|--------------------------------------------------------------------------
*/

test(
  'admin audit snapshot sanitizer removes authentication secrets recursively',

  () => {
    const snapshot =
      sanitizeAdminAuditValue({
        email:
          'user@example.com',

        password:
          'never-store-this',

        nested: {
          otp:
            '123456',

          sessionCookie:
            'secret-cookie',

          hostAccessStatus:
            'pending',
        },
      })

    assert.equal(
      snapshot.email,
      'user@example.com',
    )

    assert.equal(
      snapshot.password,
      '[REDACTED]',
    )

    assert.equal(
      snapshot.nested.otp,
      '[REDACTED]',
    )

    assert.equal(
      snapshot.nested.sessionCookie,
      '[REDACTED]',
    )

    assert.equal(
      snapshot.nested.hostAccessStatus,
      'pending',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Root Super Admin Audit
|--------------------------------------------------------------------------
*/

test(
  'root Super Admin audit event preserves existing Super Admin authority source',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedAuditCreate(
      async (
        getPayload,
      ) => {
        await recordAdminAuditEvent({
          actorUser: {
            _id:
              '64b000000000000000000911',
          },

          adminAuthorization: {
            source:
              'super_admin',

            isRootSuperAdmin:
              true,

            roleKeys: [
              'root_super_admin',
            ],

            permissionKeys: [
              'host.review.approve',
            ],
          },

          action:
            'host.review.approve',

          permissionKey:
            'host.review.approve',

          entityType:
            'user',

          entityId:
            '64b000000000000000000912',

          reasonCode:
            'host_review.approved',

          beforeSnapshot: {
            customerEnabled:
              true,

            hostEnabled:
              false,

            hostAccessStatus:
              'pending',
          },

          afterSnapshot: {
            customerEnabled:
              true,

            hostEnabled:
              true,

            hostAccessStatus:
              'active',
          },

          requestId:
            'test-request-root-admin',
        })

        const payload =
          getPayload()

        assert.equal(
          payload.actor.source,
          'super_admin',
        )

        assert.equal(
          payload.actor.isRootSuperAdmin,
          true,
        )

        assert.equal(
          payload.actor.roleKeys.includes(
            'root_super_admin',
          ),
          true,
        )

        assert.equal(
          payload.reason.code,
          'host_review.approved',
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Limited Admin Audit
|--------------------------------------------------------------------------
*/

test(
  'limited internal admin audit records delegated role and permission context without changing top-level access',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedAuditCreate(
      async (
        getPayload,
      ) => {
        await recordAdminAuditEvent({
          actorUser: {
            _id:
              '64b000000000000000000921',

            customerEnabled:
              true,

            superAdminEnabled:
              false,

            activeMode:
              'customer',
          },

          adminAuthorization: {
            source:
              'assignment',

            isRootSuperAdmin:
              false,

            roleKeys: [
              'catalog_admin',
            ],

            permissionKeys: [
              'catalog.read',
              'catalog.mutate',
            ],
          },

          action:
            'catalog.mutate',

          permissionKey:
            'catalog.mutate',

          entityType:
            'product',

          entityId:
            'product-101',

          reasonCode:
            'catalog.governance',

          beforeSnapshot: {
            name:
              'Old Product',

            token:
              'must-not-be-stored',
          },

          afterSnapshot: {
            name:
              'Updated Product',
          },

          requestId:
            'test-request-catalog-admin',
        })

        const payload =
          getPayload()

        assert.equal(
          payload.actor.source,
          'assignment',
        )

        assert.equal(
          payload.actor.isRootSuperAdmin,
          false,
        )

        assert.deepEqual(
          payload.actor.roleKeys,
          [
            'catalog_admin',
          ],
        )

        assert.equal(
          payload.beforeSnapshot.token,
          '[REDACTED]',
        )

        assert.equal(
          payload.afterSnapshot.name,
          'Updated Product',
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Unknown Permission
|--------------------------------------------------------------------------
*/

test(
  'admin audit refuses unknown legacy or undeployed permission authority',

  async () => {
    await assert.rejects(
      recordAdminAuditEvent({
        actorUser: {
          _id:
            '64b000000000000000000931',
        },

        adminAuthorization: {
          source:
            'assignment',

          roleKeys:
            [],

          permissionKeys:
            [],
        },

        action:
          'legacy.operation',

        permissionKey:
          'seller.manage',

        entityType:
          'user',

        entityId:
          '64b000000000000000000932',

        requestId:
          'test-request-legacy',
      }),

      (error) =>
        error?.statusCode ===
          400 &&
        error?.errors?.[0]?.code ===
          'ADMIN_AUDIT_PERMISSION_INVALID',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Model Validation
|--------------------------------------------------------------------------
*/

test(
  'valid privileged audit event satisfies immutable audit schema',

  async () => {
    const event =
      new AdminAuditEvent({
        actor: {
          userId:
            '64b000000000000000000941',

          source:
            'assignment',

          isRootSuperAdmin:
            false,

          roleKeys: [
            'finance_admin',
          ],

          permissionKeys: [
            'finance.read',
            'finance.mutate',
          ],
        },

        action:
          'finance.mutate',

        permissionKey:
          'finance.mutate',

        entity: {
          type:
            'financial_operation',

          id:
            'finance-operation-101',
        },

        outcome:
          'success',

        reason: {
          code:
            'finance.adjustment',

          details:
            'Approved finance correction.',
        },

        beforeSnapshot: {
          amount:
            100,
        },

        afterSnapshot: {
          amount:
            120,
        },

        requestId:
          'test-audit-validation',
      })

    await event.validate()

    assert.equal(
      event.action,
      'finance.mutate',
    )

    assert.equal(
      event.reason.code,
      'finance.adjustment',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Append-only Document
|--------------------------------------------------------------------------
*/

test(
  'existing admin audit document cannot be saved as an update',

  async () => {
    const event =
      new AdminAuditEvent({
        actor: {
          userId:
            '64b000000000000000000951',

          source:
            'super_admin',

          isRootSuperAdmin:
            true,

          roleKeys: [
            'root_super_admin',
          ],

          permissionKeys: [
            'admin.audit.read',
          ],
        },

        action:
          'admin.audit.read',

        permissionKey:
          'admin.audit.read',

        entity: {
          type:
            'audit_event',

          id:
            'audit-101',
        },

        outcome:
          'success',

        requestId:
          'test-audit-immutability',
      })

    event.isNew =
      false

    await assert.rejects(
      event.save(),

      /append-only/i,
    )
  },
)