import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

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
  AdminAuditEvent,
} =
  await import(
    '../src/modules/admin/adminAudit.model.js'
  )

const {
  buildAdminAuditExplorerFilter,
  getAdminAuditEvent,
  listAdminAuditEvents,
  serializeAdminAuditEvent,
} =
  await import(
    '../src/modules/admin/adminAudit.service.js'
  )

/*
|--------------------------------------------------------------------------
| Fixtures
|--------------------------------------------------------------------------
*/

const ACTOR_USER_ID =
  '64b000000000000000002001'

const AUDIT_EVENT_ID =
  '5b5f8a68-3f05-4e91-a17f-dcb34f000001'

function createAuditEvent(
  overrides =
    {},
) {
  return {
    _id:
      '64b000000000000000002002',

    eventId:
      AUDIT_EVENT_ID,

    actor: {
      userId:
        ACTOR_USER_ID,

      source:
        'assignment',

      isRootSuperAdmin:
        false,

      roleKeys: [
        'marketplace_ops',
      ],

      permissionKeys: [
        'host.review.read',
        'host.review.approve',
      ],
    },

    action:
      'host.review.approve',

    permissionKey:
      'host.review.approve',

    entity: {
      type:
        'user',

      id:
        '64b000000000000000002003',
    },

    outcome:
      'success',

    reason: {
      code:
        'host_review.approved',

      details:
        'Review complete.',
    },

    beforeSnapshot: {
      hostAccessStatus:
        'pending',
    },

    afterSnapshot: {
      hostAccessStatus:
        'active',
    },

    metadata: {
      lifecycle:
        'host_access',
    },

    requestId:
      'audit-explorer-test',

    occurredAt:
      new Date(
        '2026-08-20T10:00:00.000Z',
      ),

    createdAt:
      new Date(
        '2026-08-20T10:00:00.000Z',
      ),

    ...overrides,
  }
}

/*
|--------------------------------------------------------------------------
| Query Doubles
|--------------------------------------------------------------------------
*/

function createLeanResult(
  value,
) {
  return {
    lean:
      async () =>
        value,
  }
}

function createFindQuery(
  value,
  capture,
) {
  return {
    sort(
      sort,
    ) {
      capture.sort =
        sort

      return this
    },

    skip(
      skip,
    ) {
      capture.skip =
        skip

      return this
    },

    limit(
      limit,
    ) {
      capture.limit =
        limit

      return this
    },

    async lean() {
      return value
    },
  }
}

/*
|--------------------------------------------------------------------------
| Model Mock
|--------------------------------------------------------------------------
*/

async function withMockedModelMethods(
  replacements,
  callback,
) {
  const originals = []

  try {
    for (
      const {
        target,
        key,
        implementation,
      }
      of replacements
    ) {
      originals.push({
        target,

        key,

        implementation:
          target[key],
      })

      target[key] =
        implementation
    }

    return await callback()
  } finally {
    for (
      const original
      of originals.reverse()
    ) {
      original.target[
        original.key
      ] =
        original
          .implementation
    }
  }
}

/*
|--------------------------------------------------------------------------
| Serializer
|--------------------------------------------------------------------------
*/

test(
  'audit explorer serializer exposes immutable audit context without mongoose internals',

  () => {
    const serialized =
      serializeAdminAuditEvent(
        createAuditEvent(),
      )

    assert.equal(
      serialized.eventId,
      AUDIT_EVENT_ID,
    )

    assert.equal(
      serialized.actor.userId,
      ACTOR_USER_ID,
    )

    assert.equal(
      serialized.action,
      'host.review.approve',
    )

    assert.equal(
      serialized.beforeSnapshot
        .hostAccessStatus,
      'pending',
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        serialized,
        '__v',
      ),
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Filter Builder
|--------------------------------------------------------------------------
*/

test(
  'audit explorer builds exact actor action entity outcome request and date filters',

  () => {
    const result =
      buildAdminAuditExplorerFilter({
        actorUserId:
          ACTOR_USER_ID,

        action:
          'HOST.REVIEW.APPROVE',

        permissionKey:
          'host.review.approve',

        entityType:
          'USER',

        entityId:
          'target-user',

        outcome:
          'success',

        requestId:
          'request-101',

        from:
          '2026-08-01T00:00:00.000Z',

        to:
          '2026-08-31T23:59:59.000Z',
      })

    assert.equal(
      result.filter[
        'actor.userId'
      ],
      ACTOR_USER_ID,
    )

    assert.equal(
      result.filter.action,
      'host.review.approve',
    )

    assert.equal(
      result.filter.permissionKey,
      'host.review.approve',
    )

    assert.equal(
      result.filter[
        'entity.type'
      ],
      'user',
    )

    assert.equal(
      result.filter[
        'entity.id'
      ],
      'target-user',
    )

    assert.equal(
      result.filter.outcome,
      'success',
    )

    assert.equal(
      result.filter.requestId,
      'request-101',
    )

    assert.ok(
      result.filter
        .occurredAt
        .$gte instanceof
        Date,
    )

    assert.ok(
      result.filter
        .occurredAt
        .$lte instanceof
        Date,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Invalid Actor
|--------------------------------------------------------------------------
*/

test(
  'audit explorer rejects invalid actor user ID before database access',

  () => {
    assert.throws(
      () =>
        buildAdminAuditExplorerFilter({
          actorUserId:
            'invalid-user',
        }),

      (error) =>
        error?.statusCode ===
          400 &&
        error?.errors?.[0]?.code ===
          'ADMIN_AUDIT_ACTOR_ID_INVALID',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Invalid Date Range
|--------------------------------------------------------------------------
*/

test(
  'audit explorer rejects reversed date range',

  () => {
    assert.throws(
      () =>
        buildAdminAuditExplorerFilter({
          from:
            '2026-08-31T00:00:00.000Z',

          to:
            '2026-08-01T00:00:00.000Z',
        }),

      (error) =>
        error?.statusCode ===
          400 &&
        error?.errors?.[0]?.code ===
          'ADMIN_AUDIT_DATE_RANGE_INVALID',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

test(
  'audit explorer lists newest events with bounded pagination',

  {
    concurrency:
      false,
  },

  async () => {
    const capture = {}

    await withMockedModelMethods(
      [
        {
          target:
            AdminAuditEvent,

          key:
            'find',

          implementation(
            filter,
          ) {
            capture.filter =
              filter

            return createFindQuery(
              [
                createAuditEvent(),
              ],

              capture,
            )
          },
        },

        {
          target:
            AdminAuditEvent,

          key:
            'countDocuments',

          implementation:
            async () =>
              101,
        },
      ],

      async () => {
        const result =
          await listAdminAuditEvents({
            page:
              2,

            limit:
              50,

            action:
              'host.review.approve',
          })

        assert.equal(
          result.events.length,
          1,
        )

        assert.equal(
          result.pagination.page,
          2,
        )

        assert.equal(
          result.pagination.limit,
          50,
        )

        assert.equal(
          result.pagination.total,
          101,
        )

        assert.equal(
          result.pagination
            .totalPages,
          3,
        )
      },
    )

    assert.equal(
      capture.filter.action,
      'host.review.approve',
    )

    assert.deepEqual(
      capture.sort,
      {
        occurredAt:
          -1,

        _id:
          -1,
      },
    )

    assert.equal(
      capture.skip,
      50,
    )

    assert.equal(
      capture.limit,
      50,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Event Detail
|--------------------------------------------------------------------------
*/

test(
  'audit explorer loads an immutable event by eventId',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            AdminAuditEvent,

          key:
            'findOne',

          implementation(
            filter,
          ) {
            assert.equal(
              filter.eventId,
              AUDIT_EVENT_ID,
            )

            return createLeanResult(
              createAuditEvent(),
            )
          },
        },
      ],

      async () => {
        const result =
          await getAdminAuditEvent(
            AUDIT_EVENT_ID,
          )

        assert.equal(
          result.eventId,
          AUDIT_EVENT_ID,
        )

        assert.equal(
          result.reason.code,
          'host_review.approved',
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Missing Event
|--------------------------------------------------------------------------
*/

test(
  'audit explorer returns 404 for an unknown valid event ID',

  {
    concurrency:
      false,
  },

  async () => {
    await withMockedModelMethods(
      [
        {
          target:
            AdminAuditEvent,

          key:
            'findOne',

          implementation() {
            return createLeanResult(
              null,
            )
          },
        },
      ],

      async () => {
        await assert.rejects(
          getAdminAuditEvent(
            AUDIT_EVENT_ID,
          ),

          (error) =>
            error?.statusCode ===
              404 &&
            error?.errors?.[0]?.code ===
              'ADMIN_AUDIT_EVENT_NOT_FOUND',
        )
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Route Security
|--------------------------------------------------------------------------
*/

test(
  'audit explorer routes require MFA resolved admin authorization and admin.audit.read',

  async () => {
    const source =
      await readFile(
        new URL(
          '../src/modules/admin/admin.routes.js',
          import.meta.url,
        ),

        'utf8',
      )

    assert.match(
      source,

      /router\.get\(\s*'\/audit',\s*authenticateSession,\s*loadCurrentUser,\s*requireActiveAccount,\s*requireMfaAssurance,\s*loadAdminAuthorization,\s*requireAdminPermission\(\s*'admin\.audit\.read',\s*\),\s*listAdminAuditEventsController,/s,
    )

    assert.match(
      source,

      /router\.get\(\s*'\/audit\/:eventId',\s*authenticateSession,\s*loadCurrentUser,\s*requireActiveAccount,\s*requireMfaAssurance,\s*loadAdminAuthorization,\s*requireAdminPermission\(\s*'admin\.audit\.read',\s*\),\s*getAdminAuditEventController,/s,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Read-only Contract
|--------------------------------------------------------------------------
*/

test(
  'admin router exposes no public audit mutation endpoint',

  async () => {
    const source =
      await readFile(
        new URL(
          '../src/modules/admin/admin.routes.js',
          import.meta.url,
        ),

        'utf8',
      )

    assert.doesNotMatch(
      source,
      /router\.(post|patch|put|delete)\(\s*['"]\/audit/i,
    )
  },
)