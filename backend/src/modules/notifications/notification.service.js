import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAnalyticsEventBestEffort,
} from '../analytics/analytics.service.js'

import {
  createCustomerPantryObservation,
} from '../pantry/pantry.service.js'

import {
  User,
} from '../users/user.model.js'

import {
  Notification,
  NotificationAction,
  NotificationPreference,
} from './notification.models.js'

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
      'Authenticated Customer identity is required.',
      [
        {
          code:
            'NOTIFICATION_USER_REQUIRED',
        },
      ],
    )
  }

  return value
}

/*
|--------------------------------------------------------------------------
| M25 Notification Deep Link Resolver
|--------------------------------------------------------------------------
|
| Deep links are derived server-side from controlled notification taxonomy.
| Stored relatedEntityId values are encoded only as route parameters and can
| never inject an arbitrary origin or URL.
|
*/

function encodedEntityId(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    ).trim()

  return normalized
    ? encodeURIComponent(
        normalized,
      )
    : ''
}

function resolveNotificationDeepLink(
  item,
) {
  const entityId =
    encodedEntityId(
      item.relatedEntityId,
    )

  switch (
    item.triggerType
  ) {
    case 'planned_meal_shortage':
      return '/next-basket'

    case 'repeat_meal_gap':
      return '/meal-plan'

    case 'pantry_setup_reminder':
      return entityId
        ? `/pantry/items/${entityId}`
        : '/pantry'

    case 'likely_low_item':
    case 'use_soon_ingredient':
    case 'after_opening_window':
      return '/pantry'

    case 'shared_list_update':
      return '/account/household'

    case 'household_invitation_received':
      return entityId
        ? `/household-invitations/notification-${entityId}`
        : '/account/household'

    case 'household_invitation_accepted':
    case 'household_invitation_declined':
      return '/account/household'

    case 'meaningful_price_deviation':
      return '/next-basket'

    case 'class_reminder':
      if (
        entityId &&
        [
          'course',
          'creator_course',
        ].includes(
          item.relatedEntityType,
        )
      ) {
        return `/learn/courses/${entityId}`
      }

      return '/learn'

    case 'order_milestone':
      if (
        item.relatedEntityType ===
          'host_seller_order'
      ) {
        return entityId
          ? `/host/orders/${entityId}`
          : '/host/orders'
      }

      return entityId
        ? `/orders/${entityId}`
        : '/orders'

    case 'security_notice':
      return '/account/settings'

    case 'host_commercial_profile_request':
      return '/admin/host-operations'

    case 'host_registration':
      return '/admin/hosts'

    case 'host_listing_created':
    case 'host_listing_updated':
      if (
        item.relatedEntityType ===
          'host_recipe_listing'
      ) {
        return entityId
          ? `/admin/recipes/${entityId}`
          : '/admin/recipes'
      }

      return '/admin/marketplace'

    default:
      return '/notifications'
  }
}

function serializePreference(
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
    inAppEnabled:
      item.inAppEnabled,
    emailEnabled:
      item.emailEnabled,
    smsEnabled:
      item.smsEnabled,
    whatsappEnabled:
      item.whatsappEnabled,
    planningEnabled:
      item.planningEnabled,
    pantryEnabled:
      item.pantryEnabled,
    householdEnabled:
      item.householdEnabled,
    orderEnabled:
      item.orderEnabled,
    priceEnabled:
      item.priceEnabled,
    classEnabled:
      item.classEnabled,
    securityEnabled:
      item.securityEnabled,
    marketingEnabled:
      item.marketingEnabled,
    operationsEnabled:
      item.operationsEnabled !== false,
    disabledReasonCodes:
      item.disabledReasonCodes ||
      [],
    quietHours:
      item.quietHours ||
      {},
  }
}

function serializeNotification(
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
    notificationId:
      item.notificationId,
    category:
      item.category,
    triggerType:
      item.triggerType,
    reasonCode:
      item.reasonCode,
    explanation:
      item.explanation,
    relatedEntityType:
      item.relatedEntityType ||
      '',
    relatedEntityId:
      item.relatedEntityId ||
      '',
    sourceDomain:
      item.sourceDomain,
    sourceVersion:
      item.sourceVersion ||
      '',
    actions:
      item.actions ||
      [],
    eligibleChannels:
      item.eligibleChannels ||
      [],
    status:
      item.status,
    snoozedUntil:
      item.snoozedUntil ||
      null,
    deliveredAt:
      item.deliveredAt ||
      null,
    readAt:
      item.readAt ||
      null,
    createdAt:
      item.createdAt ||
      null,
    deepLink: {
      path:
        resolveNotificationDeepLink(
          item,
        ),
      source:
        'server_derived',
      requiresAuthentication:
        true,
    },
  }
}

async function ensurePreferences(
  userId,
) {
  return NotificationPreference.findOneAndUpdate(
    {
      userId,
    },
    {
      $setOnInsert: {
        userId,
        updatedByUserId:
          userId,
        securityEnabled:
          true,
        marketingEnabled:
          false,
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
}

export async function getNotificationPreferences({
  actorUser,
}) {
  const preferences =
    await ensurePreferences(
      actorId(
        actorUser,
      ),
    )

  return {
    preferences:
      serializePreference(
        preferences,
      ),
  }
}

export async function updateNotificationPreferences({
  input,
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  if (
    input.marketingEnabled ===
    true
  ) {
    throw new ApiError(
      409,
      'Marketing notifications require explicit purpose-scoped consent from the existing consent workflow.',
      [
        {
          code:
            'NOTIFICATION_MARKETING_CONSENT_REQUIRED',
        },
      ],
    )
  }

  const existing =
    await ensurePreferences(
      userId,
    )

  for (
    const [
      key,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    existing[key] =
      value
  }

  existing.securityEnabled =
    true

  existing.updatedByUserId =
    userId

  await existing.save()

  return {
    preferences:
      serializePreference(
        existing,
      ),
  }
}

const REQUIRED_HOUSEHOLD_INVITATION_TRIGGERS =
  new Set([
    'household_invitation_received',
    'household_invitation_accepted',
    'household_invitation_declined',
  ])

function isRequiredHouseholdInvitationTrigger(
  triggerType,
) {
  return REQUIRED_HOUSEHOLD_INVITATION_TRIGGERS.has(
    triggerType,
  )
}

function categoryEnabled(
  preferences,
  category,
) {
  const mapping = {
    planning:
      'planningEnabled',
    pantry:
      'pantryEnabled',
    household:
      'householdEnabled',
    order:
      'orderEnabled',
    price:
      'priceEnabled',
    class:
      'classEnabled',
    security:
      'securityEnabled',
    marketing:
      'marketingEnabled',
    operations:
      'operationsEnabled',
  }

  const key =
    mapping[category]

  if (!key) {
    return false
  }

  if (category === 'operations') {
    return preferences[key] !== false
  }

  return preferences[key] === true
}

function eligibleChannels(
  preferences,
  requestedChannels,
  category,
) {
  const enabled =
    new Set()

  if (
    preferences.inAppEnabled
  ) {
    enabled.add(
      'in_app',
    )
  }

  if (
    preferences.emailEnabled
  ) {
    enabled.add(
      'email',
    )
  }

  if (
    preferences.smsEnabled
  ) {
    enabled.add(
      'sms',
    )
  }

  if (
    preferences.whatsappEnabled
  ) {
    enabled.add(
      'whatsapp',
    )
  }

  if (
    category ===
    'security'
  ) {
    enabled.add(
      'in_app',
    )
  }

  return [
    ...new Set(
      requestedChannels,
    ),
  ].filter(
    (channel) =>
      enabled.has(
        channel,
      ),
  )
}

export async function createNotificationIntent({
  userId,
  householdId = null,
  category,
  triggerType,
  reasonCode,
  explanation,
  relatedEntityType = '',
  relatedEntityId = '',
  sourceDomain,
  sourceVersion = '',
  actions = [
    'dismiss',
  ],
  requestedChannels = [
    'in_app',
  ],
  dedupeKey = null,
  correlationId = '',
}) {
  const preferences =
    await ensurePreferences(
      userId,
    )

  if (
    dedupeKey
  ) {
    const existing =
      await Notification.findOne({
        userId,
        dedupeKey,
      })

    if (existing) {
      return {
        notification:
          serializeNotification(
            existing,
          ),
        deduplicated:
          true,
      }
    }
  }

  let suppressionReason =
    ''

  const requiredHouseholdInvitation =
    isRequiredHouseholdInvitationTrigger(
      triggerType,
    )

  if (
    !requiredHouseholdInvitation &&
    !categoryEnabled(
      preferences,
      category,
    )
  ) {
    suppressionReason =
      'category_preference_disabled'
  }

  if (
    !requiredHouseholdInvitation &&
    (
      preferences.disabledReasonCodes ||
      []
    ).includes(
      reasonCode,
    )
  ) {
    suppressionReason =
      'reason_code_stopped_by_customer'
  }

  const channels =
    requiredHouseholdInvitation
      ? [
          'in_app',
        ]
      : eligibleChannels(
          preferences,
          requestedChannels,
          category,
        )

  if (
    channels.length ===
      0 &&
    !suppressionReason
  ) {
    suppressionReason =
      'no_enabled_delivery_channel'
  }

  const created =
    await Notification.create({
      userId,
      householdId,
      category,
      triggerType,
      reasonCode,
      explanation,
      relatedEntityType,
      relatedEntityId,
      sourceDomain,
      sourceVersion,
      actions: [
        ...new Set(
          actions,
        ),
      ],
      eligibleChannels:
        channels,
      status:
        suppressionReason
          ? 'suppressed'
          : 'pending',
      suppressionReason,
      dedupeKey,
      deliveryProvider:
        channels.some(
          (channel) =>
            channel !==
            'in_app',
        )
          ? 'brevo'
          : 'internal',
    })

  await recordAnalyticsEventBestEffort({
    input: {
      eventName:
        'notification.intent_created',
      eventVersion:
        1,
      occurredAt:
        created.createdAt ||
        new Date(),
      correlationId,
      sessionId:
        '',
      householdId:
        householdId
          ? String(
              householdId,
            )
          : '',
      entities: [
        {
          entityType:
            'notification',
          entityId:
            String(
              created._id,
            ),
          version:
            '1',
        },
      ],
      sourceDomain:
        'notifications',
      sourceVersion:
        'm19-v1',
      decisionContext:
        'not_applicable',
      confidenceTier:
        'verified',
      featureFlags:
        [],
      experiments:
        [],
      payload: {
        category,
        reasonCode,
        suppressed:
          Boolean(
            suppressionReason,
          ),
      },
    },
    actorUser: {
      _id:
        userId,
    },
  })

  return {
    notification:
      serializeNotification(
        created,
      ),
    deduplicated:
      false,
  }
}

export async function createNotificationIntentBestEffort(
  options,
) {
  try {
    return await createNotificationIntent(
      options,
    )
  } catch {
    return null
  }
}

export async function notifyActiveSuperAdminsBestEffort({
  triggerType,
  reasonCode,
  explanation,
  relatedEntityType = '',
  relatedEntityId = '',
  sourceDomain,
  sourceVersion = '',
  dedupeScope,
  correlationId = '',
}) {
  try {
    const superAdmins =
      await User.find({
        superAdminEnabled: true,
        accountStatus: 'active',
      })
        .select('_id')
        .lean()

    const results = []

    for (const admin of superAdmins) {
      const result =
        await createNotificationIntentBestEffort({
          userId: admin._id,
          category: 'operations',
          triggerType,
          reasonCode,
          explanation,
          relatedEntityType,
          relatedEntityId,
          sourceDomain,
          sourceVersion,
          actions: [
            'dismiss',
          ],
          requestedChannels: [
            'in_app',
          ],
          dedupeKey: `${dedupeScope}:${id(admin._id)}`,
          correlationId,
        })

      if (result) {
        results.push(
          result,
        )
      }
    }

    return results
  } catch {
    return []
  }
}

export async function listNotifications({
  actorUser,
  input,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const filter = {
    userId,
    status: {
      $ne:
        'suppressed',
    },
  }

  if (
    input.status
  ) {
    filter.status =
      input.status
  }

  const notifications =
    await Notification.find(
      filter,
    )
      .sort({
        createdAt:
          -1,
      })
      .limit(
        input.limit,
      )
      .lean()

  return {
    notifications:
      notifications.map(
        serializeNotification,
      ),
  }
}

export async function markNotificationRead({
  notificationId,
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const notification =
    await Notification.findOne({
      _id: notificationId,
      userId,
      status: {
        $ne: 'suppressed',
      },
    })

  if (!notification) {
    throw new ApiError(
      404,
      'Notification was not found.',
      [
        {
          code: 'NOTIFICATION_NOT_FOUND',
        },
      ],
    )
  }

  if (!notification.readAt) {
    notification.readAt =
      new Date()

    if (
      [
        'pending',
        'delivered',
        'action_required_domain',
      ].includes(
        notification.status,
      )
    ) {
      notification.status =
        'read'
    }

    await notification.save()
  }

  return {
    notification:
      serializeNotification(
        notification,
      ),
  }
}

export async function markAllNotificationsRead({
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const now =
    new Date()

  const result =
    await Notification.updateMany(
      {
        userId,
        status: {
          $in: [
            'pending',
            'delivered',
            'action_required_domain',
          ],
        },
      },
      {
        $set: {
          status: 'read',
          readAt: now,
        },
      },
    )

  return {
    markedReadCount:
      result.modifiedCount ||
      0,
    readAt: now,
  }
}

export async function markNotificationDelivered({
  notificationId,
  channel,
  correlationId = '',
}) {
  const notification =
    await Notification.findById(
      notificationId,
    )

  if (!notification) {
    return null
  }

  if (
    notification.status ===
    'suppressed'
  ) {
    return notification
  }

  notification.status =
    'delivered'

  notification.deliveredAt =
    new Date()

  await notification.save()

  await recordAnalyticsEventBestEffort({
    input: {
      eventName:
        'notification.delivered',
      eventVersion:
        1,
      occurredAt:
        notification.deliveredAt,
      correlationId,
      sessionId:
        '',
      householdId:
        notification.householdId
          ? String(
              notification.householdId,
            )
          : '',
      entities: [
        {
          entityType:
            'notification',
          entityId:
            String(
              notification._id,
            ),
          version:
            '1',
        },
      ],
      sourceDomain:
        'notifications',
      sourceVersion:
        'm19-v1',
      decisionContext:
        'not_applicable',
      confidenceTier:
        'verified',
      featureFlags:
        [],
      experiments:
        [],
      payload: {
        category:
          notification.category,
        reasonCode:
          notification.reasonCode,
        channel,
      },
    },
    actorUser: {
      _id:
        notification.userId,
    },
  })

  return notification
}

export async function performNotificationAction({
  notificationId,
  input,
  actorUser,
  correlationId = '',
}) {
  const userId =
    actorId(
      actorUser,
    )

  const notification =
    await Notification.findOne({
      _id:
        notificationId,
      userId,
      status: {
        $ne:
          'suppressed',
      },
    })

  if (!notification) {
    throw new ApiError(
      404,
      'Notification was not found.',
      [
        {
          code:
            'NOTIFICATION_NOT_FOUND',
        },
      ],
    )
  }

  if (
    !notification.actions.includes(
      input.action,
    )
  ) {
    throw new ApiError(
      409,
      'This action is not available for the selected notification.',
      [
        {
          code:
            'NOTIFICATION_ACTION_NOT_ALLOWED',
          action:
            input.action,
        },
      ],
    )
  }

  if (
    input.action ===
      'snooze' &&
    input.snoozeUntil <=
      new Date()
  ) {
    throw new ApiError(
      400,
      'Snooze time must be in the future.',
      [
        {
          code:
            'NOTIFICATION_SNOOZE_TIME_INVALID',
        },
      ],
    )
  }

  let domainDelegation =
    null

  switch (
    input.action
  ) {
    case 'accept':
      notification.status =
        'read'
      notification.readAt =
        new Date()
      break

    case 'dismiss':
      notification.status =
        'dismissed'
      break

    case 'snooze':
      notification.status =
        'snoozed'
      notification.snoozedUntil =
        input.snoozeUntil
      break

    case 'stop_suggesting': {
      notification.status =
        'dismissed'

      const preferences =
        await ensurePreferences(
          userId,
        )

      preferences.disabledReasonCodes = [
        ...new Set([
          ...(
            preferences.disabledReasonCodes ||
            []
          ),
          notification.reasonCode,
        ]),
      ]

      preferences.updatedByUserId =
        userId

      await preferences.save()
      break
    }

    case 'still_have':
    case 'bought_elsewhere': {
      const pantryInput = {
        sourceType:
          input.action ===
          'still_have'
            ? 'manual_have'
            : 'bought_elsewhere',
        observedAt:
          new Date().toISOString(),
        note:
          input.action ===
          'still_have'
            ? 'Customer confirmed they still have this item from a notification action.'
            : 'Customer confirmed they bought this item elsewhere from a notification action.',
      }

      if (
        notification.relatedEntityType ===
        'canonical_pack'
      ) {
        pantryInput.canonicalPackId =
          notification.relatedEntityId
      } else if (
        notification.relatedEntityType ===
        'canonical_ingredient'
      ) {
        pantryInput.canonicalIngredientId =
          notification.relatedEntityId
      } else {
        throw new ApiError(
          409,
          'This notification does not contain canonical Pantry identity required for the selected action.',
          [
            {
              code:
                'NOTIFICATION_PANTRY_DELEGATION_IDENTITY_REQUIRED',
            },
          ],
        )
      }

      const pantryResult =
        await createCustomerPantryObservation(
          pantryInput,
          actorUser,
        )

      notification.status =
        'read'
      notification.readAt =
        new Date()

      domainDelegation = {
        domain:
          'pantry',
        requestedAction:
          input.action ===
          'still_have'
            ? 'record_customer_still_has_observation'
            : 'record_bought_elsewhere_observation',
        relatedEntityType:
          notification.relatedEntityType,
        relatedEntityId:
          notification.relatedEntityId,
        status:
          'completed',
        pantryObservationId:
          id(
            pantryResult?.observation?._id ||
            pantryResult?._id ||
            null,
          ),
      }
      break
    }

    default:
      break
  }

  notification.lastActionAt =
    new Date()

  await notification.save()

  const actionRecord =
    await NotificationAction.create({
      notificationId:
        notification._id,
      userId,
      action:
        input.action,
      occurredAt:
        notification.lastActionAt,
      snoozeUntil:
        input.snoozeUntil ||
        null,
      relatedEntityType:
        notification.relatedEntityType ||
        '',
      relatedEntityId:
        notification.relatedEntityId ||
        '',
      domainDelegation,
    })

  await recordAnalyticsEventBestEffort({
    input: {
      eventName:
        'notification.actioned',
      eventVersion:
        1,
      occurredAt:
        actionRecord.occurredAt,
      correlationId,
      sessionId:
        '',
      householdId:
        notification.householdId
          ? String(
              notification.householdId,
            )
          : '',
      entities: [
        {
          entityType:
            'notification',
          entityId:
            String(
              notification._id,
            ),
          version:
            '1',
        },
      ],
      sourceDomain:
        'notifications',
      sourceVersion:
        'm19-v1',
      decisionContext:
        'not_applicable',
      confidenceTier:
        'verified',
      featureFlags:
        [],
      experiments:
        [],
      payload: {
        category:
          notification.category,
        reasonCode:
          notification.reasonCode,
        action:
          input.action,
        domainDelegationRequired:
          Boolean(
            domainDelegation,
          ),
      },
    },
    actorUser,
  })

  return {
    notification:
      serializeNotification(
        notification,
      ),
    action: {
      id:
        id(
          actionRecord._id,
        ),
      action:
        actionRecord.action,
      occurredAt:
        actionRecord.occurredAt,
      domainDelegation,
    },
  }
}