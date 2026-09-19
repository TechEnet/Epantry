import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HostOffer,
  PriceRule,
} from './marketplace.models.js'

import {
  buildOwnedHostOfferFilter,
  requireActiveHostMarketplaceOrganization,
  validateOfferCanonicalPack,
} from './marketplace.host.service.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function stringifyId(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return null
  }

  return String(
    value,
  )
}

function actorIdFromUser(
  user,
) {
  return (
    user?._id ||
    user?.id ||
    null
  )
}

function toDate(
  value,
) {
  return value instanceof Date
    ? value
    : new Date(
        value,
      )
}

/*
|--------------------------------------------------------------------------
| Effective Rule Filter
|--------------------------------------------------------------------------
|
| Multiple historical open-ended rules may exist.
|
| Resolution is deterministic:
|
| newest effectiveFrom wins.
|
| Same offer + same effectiveFrom is rejected when creating a rule.
|--------------------------------------------------------------------------
*/

export function buildEffectivePriceRuleFilter({
  organizationId,
  offerId,
  at,
}) {
  const effectiveAt =
    toDate(
      at,
    )

  return {
    organizationId,

    offerId,

    status: {
      $ne:
        'disabled',
    },

    effectiveFrom: {
      $lte:
        effectiveAt,
    },

    $or: [
      {
        effectiveTo:
          null,
      },

      {
        effectiveTo: {
          $gt:
            effectiveAt,
        },
      },
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Pure Effective Price Selection
|--------------------------------------------------------------------------
|
| Used by tests and future public offer composition.
|--------------------------------------------------------------------------
*/

export function selectEffectivePriceRule(
  rules,
  at = new Date(),
) {
  const effectiveAt =
    toDate(
      at,
    ).getTime()

  const eligible =
    (
      rules ||
      []
    )
      .filter(
        (
          rule,
        ) => {
          if (
            rule.status ===
            'disabled'
          ) {
            return false
          }

          const startsAt =
            toDate(
              rule.effectiveFrom,
            ).getTime()

          if (
            startsAt >
            effectiveAt
          ) {
            return false
          }

          if (
            rule.effectiveTo
          ) {
            const endsAt =
              toDate(
                rule.effectiveTo,
              ).getTime()

            if (
              endsAt <=
              effectiveAt
            ) {
              return false
            }
          }

          return true
        },
      )
      .sort(
        (
          left,
          right,
        ) => {
          const leftStart =
            toDate(
              left.effectiveFrom,
            ).getTime()

          const rightStart =
            toDate(
              right.effectiveFrom,
            ).getTime()

          if (
            leftStart !==
            rightStart
          ) {
            return (
              rightStart -
              leftStart
            )
          }

          return String(
            right._id ||
              right.id ||
              '',
          ).localeCompare(
            String(
              left._id ||
                left.id ||
                '',
            ),
          )
        },
      )

  return (
    eligible[0] ||
    null
  )
}

/*
|--------------------------------------------------------------------------
| Lifecycle Projection
|--------------------------------------------------------------------------
*/

export function resolvePriceRuleLifecycle(
  rule,
  at = new Date(),
) {
  if (
    rule.status ===
    'disabled'
  ) {
    return 'disabled'
  }

  const effectiveAt =
    toDate(
      at,
    ).getTime()

  const startsAt =
    toDate(
      rule.effectiveFrom,
    ).getTime()

  if (
    startsAt >
    effectiveAt
  ) {
    return 'scheduled'
  }

  if (
    rule.effectiveTo &&
    toDate(
      rule.effectiveTo,
    ).getTime() <=
      effectiveAt
  ) {
    return 'expired'
  }

  return 'active'
}

/*
|--------------------------------------------------------------------------
| Serializer
|--------------------------------------------------------------------------
*/

export function serializePriceRule(
  rule,
  at = new Date(),
) {
  if (!rule) {
    return null
  }

  const value =
    typeof rule.toObject ===
    'function'
      ? rule.toObject()
      : rule

  const effectiveAmountMinor =
    value.salePrice
      ?.amountMinor ??
    value.listPrice
      ?.amountMinor ??
    null

  const currency =
    value.salePrice
      ?.currency ||
    value.listPrice
      ?.currency ||
    null

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    organizationId:
      stringifyId(
        value.organizationId,
      ),

    offerId:
      stringifyId(
        value.offerId,
      ),

    listPrice:
      value.listPrice
        ? {
            amountMinor:
              value.listPrice
                .amountMinor,

            currency:
              value.listPrice
                .currency,
          }
        : null,

    salePrice:
      value.salePrice
        ? {
            amountMinor:
              value.salePrice
                .amountMinor,

            currency:
              value.salePrice
                .currency,
          }
        : null,

    effectivePrice: {
      amountMinor:
        effectiveAmountMinor,

      currency,
    },

    lifecycle:
      resolvePriceRuleLifecycle(
        value,
        at,
      ),

    effectiveFrom:
      value.effectiveFrom,

    effectiveTo:
      value.effectiveTo ||
      null,

    source:
      value.source ||
      'manual',

    changeReason:
      value.changeReason ||
      '',

    /*
    |--------------------------------------------------------------------------
    | Price Freshness
    |--------------------------------------------------------------------------
    |
    | createdAt is the authoritative time EPANTRY recorded this commercial
    | price observation.
    |--------------------------------------------------------------------------
    */

    recordedAt:
      value.createdAt ||
      null,

    createdByUserId:
      stringifyId(
        value.createdByUserId,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Require Owned Offer
|--------------------------------------------------------------------------
*/

async function requireOwnedPriceOffer(
  offerId,
  actorUser,
) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const offer =
    await HostOffer.findOne(
      buildOwnedHostOfferFilter({
        offerId,

        organizationId:
          organization._id,
      }),
    )

  if (
    !offer
  ) {
    throw new ApiError(
      404,
      'Host Offer was not found.',
      [
        {
          code:
            'MARKETPLACE_OFFER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    offer.status ===
    'retired'
  ) {
    throw new ApiError(
      409,
      'A retired Host Offer cannot receive new Price Rules.',
      [
        {
          code:
            'MARKETPLACE_OFFER_RETIRED',
        },
      ],
    )
  }

  return {
    organization,

    offer,
  }
}

/*
|--------------------------------------------------------------------------
| Create Price Rule
|--------------------------------------------------------------------------
|
| Price history is append-only through this API.
|
| No PATCH / DELETE PriceRule endpoint exists.
|--------------------------------------------------------------------------
*/

export async function createHostPriceRule(
  offerId,
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    organization,
    offer,
  } =
    await requireOwnedPriceOffer(
      offerId,
      actorUser,
    )

  /*
  |--------------------------------------------------------------------------
  | Canonical Product must remain publishable/current.
  |--------------------------------------------------------------------------
  */

  await validateOfferCanonicalPack(
    offer.packId,
  )

  const effectiveFrom =
    new Date(
      input.effectiveFrom,
    )

  const effectiveTo =
    input.effectiveTo
      ? new Date(
          input.effectiveTo,
        )
      : null

  /*
  |--------------------------------------------------------------------------
  | Prevent ambiguous equal-start rules.
  |--------------------------------------------------------------------------
  |
  | Older open-ended rules are allowed to remain as history.
  | Resolver precedence makes the newest effectiveFrom authoritative.
  |--------------------------------------------------------------------------
  */

  const sameStartRule =
    await PriceRule.findOne({
      organizationId:
        organization._id,

      offerId:
        offer._id,

      effectiveFrom,
    })
      .select({
        _id:
          1,
      })
      .lean()

  if (
    sameStartRule
  ) {
    throw new ApiError(
      409,
      'A Price Rule already exists for this Offer at the same effectiveFrom.',
      [
        {
          code:
            'MARKETPLACE_PRICE_EFFECTIVE_START_CONFLICT',
        },
      ],
    )
  }

  const now =
    new Date()

  const priceRule =
    await PriceRule.create({
      organizationId:
        organization._id,

      offerId:
        offer._id,

      listPrice:
        input.listPrice,

      salePrice:
        input.salePrice,

      status:
        effectiveFrom >
        now
          ? 'scheduled'
          : 'active',

      effectiveFrom,

      effectiveTo,

      source:
        input.source,

      changeReason:
        input.changeReason,

      createdByUserId:
        actorUserId,
    })

  return {
    priceRule:
      serializePriceRule(
        priceRule,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Price History
|--------------------------------------------------------------------------
*/

export async function listHostPriceRules(
  offerId,
  {
    page,
    limit,
  },
  actorUser,
) {
  const {
    organization,
    offer,
  } =
    await requireOwnedPriceOffer(
      offerId,
      actorUser,
    )

  const filter = {
    organizationId:
      organization._id,

    offerId:
      offer._id,
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    priceRules,
    total,
  ] =
    await Promise.all([
      PriceRule.find(
        filter,
      )
        .sort({
          effectiveFrom:
            -1,

          _id:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      PriceRule.countDocuments(
        filter,
      ),
    ])

  return {
    priceRules:
      priceRules.map(
        (
          rule,
        ) =>
          serializePriceRule(
            rule,
          ),
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  }
}

/*
|--------------------------------------------------------------------------
| Effective Price
|--------------------------------------------------------------------------
*/

export async function getHostEffectivePrice(
  offerId,
  at,
  actorUser,
) {
  const {
    organization,
    offer,
  } =
    await requireOwnedPriceOffer(
      offerId,
      actorUser,
    )

  const effectiveAt =
    at
      ? new Date(
          at,
        )
      : new Date()

  const priceRule =
    await PriceRule.findOne(
      buildEffectivePriceRuleFilter({
        organizationId:
          organization._id,

        offerId:
          offer._id,

        at:
          effectiveAt,
      }),
    )
      .sort({
        effectiveFrom:
          -1,

        _id:
          -1,
      })
      .lean()

  return {
    effectiveAt,

    priceRule:
      serializePriceRule(
        priceRule,
        effectiveAt,
      ),
  }
}