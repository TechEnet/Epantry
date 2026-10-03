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
  CanonicalIngredient,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  HostOffer,
  InventorySnapshot,
} from '../marketplace/marketplace.models.js'

import {
  AvailabilityWatch,
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

    case 'item_available':
      return entityId
        ? `/grocery/search-results?q=${entityId}`
        : '/grocery'

    case 'security_notice':
      return '/account/settings'

    case 'host_commercial_profile_request':
      return '/admin/host-operations'

    case 'hospitality_approval_requested': {
      const focusPrefixByEntityType = {
        restaurant_recipe_listing:
          'restaurant_recipe',
        hospitality_production_recipe:
          'production_recipe',
        hospitality_dish_passport:
          'dish_passport',
        hospitality_change_case:
          'change_case',
      }

      const focusPrefix =
        focusPrefixByEntityType[
          item.relatedEntityType
        ]

      if (
        entityId &&
        focusPrefix
      ) {
        return `/admin/host-operations?tab=hospitality&focus=${encodeURIComponent(
          `${focusPrefix}:${String(
            item.relatedEntityId ||
              '',
          )}`,
        )}`
      }

      return '/admin/host-operations?tab=hospitality'
    }

    case 'creator_approval_requested':
      if (
        item.relatedEntityType ===
          'creator_profile'
      ) {
        return '/admin/community?tab=creators'
      }

      return '/admin/community#creator-content-governance'

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

    case 'host_inventory_low':
      if (
        item.relatedEntityType ===
          'host_offer'
      ) {
        return entityId
          ? `/host/marketplace?editOffer=${entityId}`
          : '/host/marketplace'
      }

      return '/host/marketplace'

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


function normalizeAvailabilityTerm(
  value,
) {
  return String(
    value || '',
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(
  value,
) {
  return String(
    value || '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function buildPublishedProductVersionFilter(
  now = new Date(),
) {
  return {
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
  }
}

async function resolveAvailabilityPackProfile(
  packId,
) {
  const pack =
    await Pack.findOne({
      _id:
        packId,
      status:
        'active',
    })
      .lean()

  if (!pack) {
    return null
  }

  const version =
    await ProductVersion.findOne({
      packId:
        pack._id,
      ...buildPublishedProductVersionFilter(),
    })
      .sort({
        version:
          -1,
        publishedAt:
          -1,
        updatedAt:
          -1,
      })
      .lean()

  if (!version) {
    return null
  }

  const variant =
    await ProductVariant.findOne({
      _id:
        pack.variantId,
      status:
        'active',
    })
      .lean()

  if (!variant) {
    return null
  }

  const family =
    await ProductFamily.findOne({
      _id:
        variant.familyId,
      status:
        'active',
    })
      .lean()

  if (!family) {
    return null
  }

  const labels = [
    version.displayName,
    pack.displayName,
    variant.canonicalName,
    family.canonicalName,
  ]
    .map(
      normalizeAvailabilityTerm,
    )
    .filter(Boolean)

  return {
    packId:
      String(
        pack._id,
      ),
    displayName:
      version.displayName ||
      pack.displayName ||
      family.canonicalName,
    labels,
    searchText:
      labels.join(' '),
  }
}

async function isPackCurrentlyAvailable(
  packId,
) {
  const offers =
    await HostOffer.find({
      packId,
      status:
        'active',
    })
      .select({
        _id:
          1,
      })
      .lean()

  if (
    offers.length ===
      0
  ) {
    return false
  }

  const offerIds =
    offers.map(
      (offer) =>
        offer._id,
    )

  const latestSnapshots =
    await InventorySnapshot.aggregate([
      {
        $match: {
          offerId: {
            $in:
              offerIds,
          },
        },
      },
      {
        $sort: {
          observedAt:
            -1,
          _id:
            -1,
        },
      },
      {
        $group: {
          _id:
            '$offerId',
          availableQuantity: {
            $first:
              '$availableQuantity',
          },
          reservedQuantity: {
            $first:
              '$reservedQuantity',
          },
        },
      },
    ])

  return latestSnapshots.some(
    (snapshot) =>
      Math.max(
        0,
        Number(
          snapshot.availableQuantity ||
            0,
        ) -
          Number(
            snapshot.reservedQuantity ||
              0,
          ),
      ) > 0,
  )
}

async function candidateAvailabilityPackIds({
  query,
  packId = null,
}) {
  if (packId) {
    return [
      String(
        packId,
      ),
    ]
  }

  const normalized =
    normalizeAvailabilityTerm(
      query,
    )

  if (
    normalized.length <
      2
  ) {
    return []
  }

  const regex =
    new RegExp(
      escapeRegex(
        normalized,
      ).replace(/\\ /g, '\\s+'),
      'i',
    )

  const [
    versions,
    packs,
    variants,
    families,
  ] =
    await Promise.all([
      ProductVersion.find({
        ...buildPublishedProductVersionFilter(),
        displayName:
          regex,
      })
        .select({
          packId:
            1,
        })
        .limit(24)
        .lean(),

      Pack.find({
        status:
          'active',
        displayName:
          regex,
      })
        .select({
          _id:
            1,
        })
        .limit(24)
        .lean(),

      ProductVariant.find({
        status:
          'active',
        canonicalName:
          regex,
      })
        .select({
          _id:
            1,
        })
        .limit(24)
        .lean(),

      ProductFamily.find({
        status:
          'active',
        canonicalName:
          regex,
      })
        .select({
          _id:
            1,
        })
        .limit(24)
        .lean(),
    ])

  const variantIds =
    new Set(
      variants.map(
        (variant) =>
          String(
            variant._id,
          ),
      ),
    )

  if (
    families.length >
      0
  ) {
    const familyVariants =
      await ProductVariant.find({
        familyId: {
          $in:
            families.map(
              (family) =>
                family._id,
            ),
        },
        status:
          'active',
      })
        .select({
          _id:
            1,
        })
        .lean()

    for (
      const variant of
      familyVariants
    ) {
      variantIds.add(
        String(
          variant._id,
        ),
      )
    }
  }

  const variantPacks =
    variantIds.size > 0
      ? await Pack.find({
          variantId: {
            $in: [
              ...variantIds,
            ],
          },
          status:
            'active',
        })
          .select({
            _id:
              1,
          })
          .lean()
      : []

  return [
    ...new Set([
      ...versions.map(
        (version) =>
          String(
            version.packId,
          ),
      ),
      ...packs.map(
        (pack) =>
          String(
            pack._id,
          ),
      ),
      ...variantPacks.map(
        (pack) =>
          String(
            pack._id,
          ),
      ),
    ]),
  ].slice(
    0,
    30,
  )
}

export async function checkItemAvailability({
  input,
}) {
  let query =
    String(
      input.query ||
        '',
    ).trim()

  if (
    input.canonicalIngredientId
  ) {
    const ingredient =
      await CanonicalIngredient.findById(
        input.canonicalIngredientId,
      )
        .select({
          canonicalName:
            1,
        })
        .lean()

    if (
      ingredient?.canonicalName &&
      !query
    ) {
      query =
        ingredient.canonicalName
    }
  }

  const packIds =
    await candidateAvailabilityPackIds({
      query,
      packId:
        input.packId,
    })

  for (
    const candidatePackId of
    packIds
  ) {
    if (
      !(
        await isPackCurrentlyAvailable(
          candidatePackId,
        )
      )
    ) {
      continue
    }

    const profile =
      await resolveAvailabilityPackProfile(
        candidatePackId,
      )

    if (profile) {
      return {
        available:
          true,
        match:
          profile,
      }
    }
  }

  return {
    available:
      false,
    match:
      null,
  }
}

export async function createAvailabilityWatch({
  input,
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const availability =
    await checkItemAvailability({
      input,
    })

  if (
    availability.available
  ) {
    return {
      alreadyAvailable:
        true,
      watch:
        null,
      match:
        availability.match,
    }
  }

  const normalizedQuery =
    normalizeAvailabilityTerm(
      input.query,
    )

  const watchKey =
    input.packId
      ? `pack:${input.packId}`
      : input.canonicalIngredientId
        ? `ingredient:${input.canonicalIngredientId}`
        : `query:${normalizedQuery}`

  const watch =
    await AvailabilityWatch.findOneAndUpdate(
      {
        userId,
        watchKey,
      },
      {
        $set: {
          query:
            String(
              input.query,
            ).trim(),
          normalizedQuery,
          canonicalIngredientId:
            input.canonicalIngredientId ||
            null,
          packId:
            input.packId ||
            null,
          source:
            input.source ||
            'search',
          status:
            'active',
          matchedPackId:
            null,
          matchedProductName:
            '',
          notifiedAt:
            null,
        },
        $setOnInsert: {
          userId,
          watchKey,
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
    alreadyAvailable:
      false,
    watch: {
      id:
        String(
          watch._id,
        ),
      query:
        watch.query,
      status:
        watch.status,
      source:
        watch.source,
    },
    match:
      null,
  }
}

function watchMatchesPack(
  watch,
  profile,
) {
  if (
    watch.packId &&
    String(
      watch.packId,
    ) ===
      String(
        profile.packId,
      )
  ) {
    return true
  }

  const term =
    normalizeAvailabilityTerm(
      watch.normalizedQuery ||
        watch.query,
    )

  if (!term) {
    return false
  }

  return (
    profile.searchText.includes(
      term,
    ) ||
    profile.labels.some(
      (label) =>
        term.includes(
          label,
        ),
    )
  )
}

export async function fulfillAvailabilityWatchesForPack(
  packId,
) {
  if (
    !packId ||
    !(
      await isPackCurrentlyAvailable(
        packId,
      )
    )
  ) {
    return {
      notified:
        0,
    }
  }

  const profile =
    await resolveAvailabilityPackProfile(
      packId,
    )

  if (!profile) {
    return {
      notified:
        0,
    }
  }

  const watches =
    await AvailabilityWatch.find({
      status:
        'active',
    })
      .limit(5000)

  let notified =
    0

  for (
    const watch of
    watches
  ) {
    if (
      !watchMatchesPack(
        watch,
        profile,
      )
    ) {
      continue
    }

    await createNotificationIntent({
      userId:
        watch.userId,
      category:
        'planning',
      triggerType:
        'item_available',
      reasonCode:
        'watched_item_available',
      explanation:
        `${profile.displayName} is now available on EPANTRY.`,
      relatedEntityType:
        'availability_query',
      relatedEntityId:
        watch.query,
      sourceDomain:
        'marketplace',
      sourceVersion:
        'availability-watch-v1',
      actions: [
        'dismiss',
      ],
      requestedChannels: [
        'in_app',
        'email',
      ],
      dedupeKey:
        `availability:${String(
          watch._id,
        )}:${profile.packId}`,
    })

    watch.status =
      'notified'
    watch.matchedPackId =
      profile.packId
    watch.matchedProductName =
      profile.displayName
    watch.notifiedAt =
      new Date()

    await watch.save()

    notified +=
      1
  }

  return {
    notified,
  }
}

export async function fulfillAvailabilityWatchesForPackBestEffort(
  packId,
) {
  try {
    return await fulfillAvailabilityWatchesForPack(
      packId,
    )
  } catch {
    return {
      notified:
        0,
      failed:
        true,
    }
  }
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