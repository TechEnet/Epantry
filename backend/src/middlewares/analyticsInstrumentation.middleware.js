import crypto from 'crypto'

import { hasAnalyticsConsentForRequest } from '../modules/cookieConsent/cookieConsent.service.js'

import {
  recordAnalyticsEventBestEffort,
} from '../modules/analytics/analytics.service.js'

import {
  organizationForPublicListingPath,
  organizationForPublishedRecipe,
  organizationsForSavedCart,
  safeHostAttribution,
} from '../modules/analytics/analytics.hostAttribution.service.js'

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

  // A real successful read of a Super Admin-approved Host listing.
  // This is a non-paid content view, not an invented search impression.
  if (method === 'GET' && (
    /^\/api\/v1\/public\/host-listings\/[a-f\d]{24}$/i.test(pathname) ||
    /^\/api\/v1\/public\/host-listings\/by-slug\/[^/]+$/.test(pathname)
  )) {
    return [{
      eventName: 'discovery.listing_viewed',
      sourceDomain: 'host_listings',
      entities: [],
      decisionContext: 'organic',
      payload: { surface: 'public_listing_detail' },
    }]
  }

  // A completed cooking action is already committed by Pantry and is
  // idempotent at the domain boundary. This event is analytics-only.
  if (method === 'POST' &&
      /^\/api\/v1\/recipes\/[^/]+\/cooked$/.test(pathname)) {
    const servings = Number(body.targetServings)
    return [{
      eventName: 'recipe.cooked',
      sourceDomain: 'recipes',
      entities: [],
      payload: {
        portions: Number.isFinite(servings) && servings > 0 ? servings : 1,
        completionSource: 'customer_cooked_action',
      },
    }]
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
          recipeEntityFromPath(pathname.replace(/\/outcome-plan$/, '')),
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

  const savedCartAction = req.method === 'POST' && [
    '/api/v1/cart',
    '/api/v1/cart/direct',
    '/api/v1/cart/restaurant-recipe',
  ].includes(pathname)

  if (
    specs.length === 0 && !savedCartAction
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
          // M1-A: M19 analytics is optional measurement, not a required
          // shopping/pantry action or a security audit log. Skip recording
          // before consent, after rejection, or when consent cannot be read.
          if (!(await hasAnalyticsConsentForRequest(req))) return
          const recipeMatch = pathname.match(
            /^\/api\/v1\/recipes\/([^/]+)(?:\/(?:outcome-plan|cooked))?$/,
          )
          const recipeAttribution = recipeMatch && specs.some((item) =>
            item.eventName.startsWith('recipe.'))
            ? await safeHostAttribution(() =>
                organizationForPublishedRecipe(decodeURIComponent(recipeMatch[1])))
            : null
          const listingAttribution = specs.some((item) =>
            item.eventName === 'discovery.listing_viewed')
            ? await safeHostAttribution(() => organizationForPublicListingPath(pathname))
            : null
          const hostOrganizationId = await organizationIdForRequest(req, pathname)
          const ownerOrganizationId = recipeAttribution?.organizationId ||
            listingAttribution?.organizationId || hostOrganizationId || null

          for (const spec of specs) {
            const entity = spec.eventName === 'discovery.listing_viewed' &&
                listingAttribution?.listingId
              ? [{ entityType: 'host_listing', entityId: listingAttribution.listingId, version: '' }]
              : spec.eventName.startsWith('recipe.') && recipeAttribution?.dishId && !(spec.entities || []).length
                ? [{ entityType: 'recipe', entityId: recipeAttribution.dishId, version: '' }]
                : spec.entities || []
            // Repeating a committed cooking command must never count twice.
            const cookKey = spec.eventName === 'recipe.cooked'
              ? String(req.get('idempotency-key') || '')
              : ''
            const clientEventId = cookKey && recipeAttribution?.dishId
              ? `cook_${crypto.createHash('sha256').update([
                  req.currentUser?._id || req.currentUser?.id || '',
                  recipeAttribution.dishId, cookKey,
                ].join(':')).digest('hex')}`
              : null
            await recordAnalyticsEventBestEffort({
              input: {
                clientEventId,
                eventName: spec.eventName,
                eventVersion: 1,
                occurredAt: new Date(),
                correlationId: req.requestId || '',
                sessionId: '',
                householdId: '',
                entities: entity,
                sourceDomain: spec.sourceDomain,
                sourceVersion: ['discovery.listing_viewed', 'recipe.cooked'].includes(spec.eventName)
                  ? 'm19-host-attribution-v2'
                  : 'm19-v1',
                decisionContext: spec.decisionContext || 'not_applicable',
                confidenceTier: 'verified',
                featureFlags: [],
                experiments: [],
                payload: spec.payload || {},
              },
              actorUser: req.currentUser || req.user || null,
              requestId: req.requestId || '',
              organizationId: ownerOrganizationId,
            })
          }

          // Host recipe listings use the public Host packet read route,
          // not the canonical /recipes/:slug route. Count their verified
          // detail views as recipe engagement too, without claiming cooking.
          if (listingAttribution?.isRecipe && listingAttribution.organizationId) {
            await recordAnalyticsEventBestEffort({
              input: {
                eventName: 'recipe.viewed',
                eventVersion: 1,
                occurredAt: new Date(),
                correlationId: req.requestId || '',
                sessionId: '',
                householdId: '',
                entities: [{
                  entityType: 'host_listing',
                  entityId: listingAttribution.listingId,
                  version: '',
                }],
                sourceDomain: 'host_listings',
                sourceVersion: 'm19-host-attribution-v2',
                decisionContext: 'not_applicable',
                confidenceTier: 'verified',
                featureFlags: [],
                experiments: [],
                payload: { source: 'public_host_recipe_detail' },
              },
              actorUser: req.currentUser || req.user || null,
              requestId: req.requestId || '',
              organizationId: listingAttribution.organizationId,
            })
          }

          // An actual persisted Marketplace cart is authoritative for the
          // seller scope; never infer seller ownership from client-provided
          // product IDs, a requested business ID or a quote preview.
          if (savedCartAction) {
            const carts = await safeHostAttribution(() =>
              organizationsForSavedCart({
                actorUser: req.currentUser || req.user,
                idempotencyKey: req.get('idempotency-key'),
              })) || []
            for (const cart of carts) {
              await recordAnalyticsEventBestEffort({
                input: {
                  clientEventId: `hostbasket_${crypto.createHash('sha256')
                    .update(`${cart.cartId}:${cart.organizationId}`).digest('hex')}`,
                  eventName: 'commerce.host_basket_created',
                  eventVersion: 1,
                  occurredAt: new Date(),
                  correlationId: req.requestId || '',
                  sessionId: '',
                  householdId: '',
                  entities: [{ entityType: 'marketplace_cart', entityId: cart.cartId, version: '' }],
                  sourceDomain: 'commerce',
                  sourceVersion: 'm19-host-attribution-v2',
                  decisionContext: 'not_applicable',
                  confidenceTier: 'verified',
                  featureFlags: [],
                  experiments: [],
                  payload: { lineCount: cart.lineCount, fulfillmentMode: 'marketplace' },
                },
                actorUser: req.currentUser || req.user || null,
                requestId: req.requestId || '',
                organizationId: cart.organizationId,
              })
            }
          }
        }
      )()
    },
  )

  return next()
}