import {
  recordAnalyticsEventBestEffort,
} from '../modules/analytics/analytics.service.js'

import {
  resolveHostOrganization,
} from '../modules/analytics/analytics.batch2.service.js'

function pathnameOf(
  req,
) {
  return String(
    req.originalUrl ||
      req.url ||
      '',
  ).split('?')[0]
}

function bodyObject(
  req,
) {
  return (
    req.body &&
    typeof req.body ===
      'object' &&
    !Array.isArray(
      req.body,
    )
  )
    ? req.body
    : {}
}

function recipeEntityFromPath(
  pathname,
) {
  const match =
    pathname.match(
      /^\/api\/v1\/recipes\/([^/]+)$/,
    )

  if (!match) {
    return []
  }

  return [
    {
      entityType:
        'recipe',
      entityId:
        decodeURIComponent(
          match[1],
        ).slice(
          0,
          160,
        ),
      version:
        '',
    },
  ]
}

function outcomePlanEntityFromPath(
  pathname,
) {
  const match =
    pathname.match(
      /^\/api\/v1\/outcome-plans\/([a-f\d]{24})(?:\/requirements)?$/i,
    )

  if (!match) {
    return []
  }

  return [
    {
      entityType:
        'outcome_plan',
      entityId:
        match[1],
      version:
        '',
    },
  ]
}

function notificationSafeSpecs(
  req,
) {
  const pathname =
    pathnameOf(
      req,
    )

  const method =
    String(
      req.method ||
        '',
    ).toUpperCase()

  const body =
    bodyObject(
      req,
    )

  if (
    method ===
      'POST' &&
    pathname ===
      '/api/v1/search'
  ) {
    return [
      {
        eventName:
          'search.query_submitted',
        sourceDomain:
          'search',
        entities:
          [],
        payload: {
          queryLength:
            String(
              body.query ||
                body.text ||
                '',
            ).length,
          intentType:
            String(
              body.intentType ||
                body.intent ||
                'search',
            ).slice(
              0,
              80,
            ),
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    pathname ===
      '/api/v1/search/refine'
  ) {
    return [
      {
        eventName:
          'search.query_submitted',
        sourceDomain:
          'search',
        entities:
          [],
        payload: {
          queryLength:
            String(
              body.query ||
                body.text ||
                '',
            ).length,
          intentType:
            'refinement',
        },
      },
    ]
  }

  if (
    method ===
      'GET' &&
    /^\/api\/v1\/recipes\/[^/]+$/.test(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'recipe.viewed',
        sourceDomain:
          'recipes',
        entities:
          recipeEntityFromPath(
            pathname,
          ),
        payload: {
          source:
            'recipe_detail',
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    /^\/api\/v1\/recipes\/[^/]+\/outcome-plan$/.test(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'recipe.selected',
        sourceDomain:
          'outcomes',
        entities:
          [],
        payload: {
          source:
            'outcome_plan',
        },
      },
      {
        eventName:
          'outcome.readiness_calculated',
        sourceDomain:
          'outcomes',
        entities:
          [],
        payload: {
          readyLineCount:
            0,
          shortageLineCount:
            0,
          unknownLineCount:
            0,
        },
      },
      {
        eventName:
          'outcome.requirements_calculated',
        sourceDomain:
          'outcomes',
        entities:
          [],
        payload: {
          requirementCount:
            0,
          shortageCount:
            0,
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    pathname ===
      '/api/v1/outcome-plans'
  ) {
    return [
      {
        eventName:
          'outcome.readiness_calculated',
        sourceDomain:
          'outcomes',
        entities:
          [],
        payload: {
          readyLineCount:
            0,
          shortageLineCount:
            0,
          unknownLineCount:
            0,
        },
      },
      {
        eventName:
          'outcome.requirements_calculated',
        sourceDomain:
          'outcomes',
        entities:
          [],
        payload: {
          requirementCount:
            0,
          shortageCount:
            0,
        },
      },
    ]
  }

  if (
    method ===
      'PATCH' &&
    /^\/api\/v1\/outcome-plans\/[a-f\d]{24}\/requirements$/i.test(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'outcome.requirements_calculated',
        sourceDomain:
          'outcomes',
        entities:
          outcomePlanEntityFromPath(
            pathname,
          ),
        payload: {
          requirementCount:
            0,
          shortageCount:
            0,
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    pathname ===
      '/api/v1/pantry/observations'
  ) {
    const sourceType =
      String(
        body.sourceType ||
          '',
      )

    return [
      {
        eventName:
          sourceType ===
            'manual_quantity_correction'
            ? 'pantry.corrected'
            : 'pantry.marked',
        sourceDomain:
          'pantry',
        entities:
          [],
        payload:
          sourceType ===
          'manual_quantity_correction'
            ? {
                correctionType:
                  sourceType,
                source:
                  'customer',
              }
            : {
                state:
                  sourceType,
                source:
                  'customer',
              },
      },
    ]
  }

  if (
    method ===
      'PATCH' &&
    /^\/api\/v1\/pantry\/items\/[a-f\d]{24}$/i.test(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'pantry.corrected',
        sourceDomain:
          'pantry',
        entities:
          [],
        payload: {
          correctionType:
            'pantry_item_correction',
          source:
            'customer',
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    [
      '/api/v1/basket-optimize',
      '/api/v1/cart',
    ].includes(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'commerce.basket_created',
        sourceDomain:
          'commerce',
        entities:
          [],
        payload: {
          lineCount:
            Array.isArray(
              body.lines,
            )
              ? body.lines.length
              : 0,
          fulfillmentMode:
            String(
              body.fulfillmentMode ||
                'unspecified',
            ).slice(
              0,
              80,
            ),
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    pathname ===
      '/api/v1/external-handoffs'
  ) {
    return [
      {
        eventName:
          'commerce.handoff_created',
        sourceDomain:
          'commerce',
        entities:
          [],
        payload: {
          partnerKey:
            String(
              body.partnerKey ||
                '',
            ).slice(
              0,
              80,
            ),
          handoffType:
            String(
              body.handoffType ||
                'external',
            ).slice(
              0,
              80,
            ),
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    pathname ===
      '/api/v1/checkout'
  ) {
    return [
      {
        eventName:
          'commerce.order_created',
        sourceDomain:
          'commerce',
        entities:
          [],
        payload: {
          lineCount:
            Array.isArray(
              body.lines,
            )
              ? body.lines.length
              : 0,
          currency:
            String(
              body.currency ||
                'INR',
            ).slice(
              0,
              3,
            ),
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    /^\/api\/v1\/next-basket\/[^/]+\/feedback$/.test(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'trust.correction_recorded',
        sourceDomain:
          'planning',
        entities:
          [],
        payload: {
          correctionDomain:
            'next_basket',
          correctionType:
            String(
              body.action ||
                body.feedbackType ||
                'feedback',
            ).slice(
              0,
              80,
            ),
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    /^\/api\/v1\/host\/hospitality\/change-cases\/[a-f\d]{24}\/publish$/i.test(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'trust.correction_recorded',
        sourceDomain:
          'hospitality',
        entities:
          [],
        payload: {
          correctionDomain:
            'hospitality_change_management',
          correctionType:
            'change_case_published',
        },
      },
    ]
  }

  if (
    method ===
      'POST' &&
    /^\/api\/v1\/host\/hospitality\/dish-passports\/[a-f\d]{24}\/publish$/i.test(
      pathname,
    )
  ) {
    return [
      {
        eventName:
          'trust.correction_recorded',
        sourceDomain:
          'hospitality',
        entities:
          [],
        payload: {
          correctionDomain:
            'dish_passport',
          correctionType:
            'passport_published',
        },
      },
    ]
  }

  return []
}

async function organizationIdForRequest(
  req,
  pathname,
) {
  const user =
    req.currentUser ||
    req.user

  if (
    !user ||
    user.hostEnabled !==
      true ||
    user.hostAccessStatus !==
      'active' ||
    !pathname.startsWith(
      '/api/v1/host/',
    )
  ) {
    return null
  }

  try {
    const organization =
      await resolveHostOrganization({
        actorUser:
          user,
        organizationIdHint:
          req.get(
            'x-epantry-organization-id',
          ) ||
          null,
      })

    return organization?._id ||
      null
  } catch {
    return null
  }
}

export function analyticsInstrumentationMiddleware(
  req,
  res,
  next,
) {
  const pathname =
    pathnameOf(
      req,
    )

  if (
    !pathname.startsWith(
      '/api/v1/',
    ) ||
    pathname.startsWith(
      '/api/v1/analytics',
    ) ||
    pathname.startsWith(
      '/api/v1/notifications',
    ) ||
    pathname.startsWith(
      '/api/v1/experiments',
    ) ||
    pathname.startsWith(
      '/api/v1/admin/analytics',
    ) ||
    pathname.startsWith(
      '/api/v1/host/analytics',
    )
  ) {
    return next()
  }

  const specs =
    notificationSafeSpecs(
      req,
    )

  if (
    specs.length ===
    0
  ) {
    return next()
  }

  res.once(
    'finish',
    () => {
      if (
        res.statusCode <
          200 ||
        res.statusCode >=
          300
      ) {
        return
      }

      void (
        async () => {
          const organizationId =
            await organizationIdForRequest(
              req,
              pathname,
            )

          for (
            const spec of
            specs
          ) {
            await recordAnalyticsEventBestEffort({
              input: {
                eventName:
                  spec.eventName,
                eventVersion:
                  1,
                occurredAt:
                  new Date(),
                correlationId:
                  req.requestId ||
                  '',
                sessionId:
                  '',
                householdId:
                  '',
                entities:
                  spec.entities ||
                  [],
                sourceDomain:
                  spec.sourceDomain,
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
                payload:
                  spec.payload ||
                  {},
              },
              actorUser:
                req.currentUser ||
                req.user ||
                null,
              requestId:
                req.requestId ||
                '',
              organizationId,
            })
          }
        }
      )()
    },
  )

  return next()
}