import { z } from 'zod'

export const WEBSITE_EVENT_NAMES = Object.freeze([
  'session_start', 'page_view', 'recipe_view', 'product_view',
  'search_submit', 'filter_apply', 'bookmark_add', 'bookmark_remove',
  'add_to_cart', 'begin_checkout', 'external_retailer_handoff',
])

export const WEBSITE_PAGE_KEYS = Object.freeze([
  '/', '/grocery', '/grocery/category/:slug', '/grocery/search-results',
  '/grocery/product/:slug', '/recipes', '/recipes/:slug',
  '/brands', '/brands/:brandKey', '/community', '/learn', '/about',
  '/cart/:cartId', '/checkout/:cartId', '/saved-items',
])

const uuid = z.string().uuid()
const shortToken = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i)
const optionalToken = shortToken.optional().default('')
const campaign = z.string().regex(/^[a-z0-9][a-z0-9_\-]{0,63}$/i).optional().default('')
const referrerHost = z.string().regex(/^[a-z0-9.-]{0,100}$/i).optional().default('')

export const websiteEventSchema = z.object({
  eventId: uuid,
  visitorId: uuid,
  sessionId: uuid,
  eventName: z.enum(WEBSITE_EVENT_NAMES),
  occurredAt: z.iso.datetime({ offset: true }),
  pageKey: z.enum(WEBSITE_PAGE_KEYS),
  entityType: z.enum(['', 'recipe', 'product']).optional().default(''),
  entityId: optionalToken,
  filterKey: z.enum(['', 'cuisine', 'meal_type', 'category', 'brand', 'sort', 'availability', 'price_range', 'dietary']).optional().default(''),
  source: z.enum(['direct', 'search', 'referral', 'campaign', 'unknown']).optional().default('unknown'),
  medium: z.enum(['none', 'organic', 'referral', 'campaign', 'unknown']).optional().default('unknown'),
  campaign,
  referrerHost,
  deviceClass: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).optional().default('unknown'),
}).strict().superRefine((value, ctx) => {
  if (value.eventName === 'recipe_view' &&
      (value.pageKey !== '/recipes/:slug' || value.entityType !== 'recipe' || !value.entityId)) {
    ctx.addIssue({ code: 'custom', message: 'Recipe views require a public recipe reference.' })
  }
  if (value.eventName === 'product_view' &&
      (value.pageKey !== '/grocery/product/:slug' || value.entityType !== 'product' || !value.entityId)) {
    ctx.addIssue({ code: 'custom', message: 'Product views require a public product reference.' })
  }
  if (['page_view', 'session_start'].includes(value.eventName) &&
      (value.entityType || value.entityId || value.filterKey)) {
    ctx.addIssue({ code: 'custom', message: 'Page/session events cannot include action details.' })
  }
  if (value.filterKey && value.eventName !== 'filter_apply') {
    ctx.addIssue({ code: 'custom', message: 'Filters can only be attached to filter events.' })
  }
  if (!['recipe_view', 'product_view', 'bookmark_add', 'bookmark_remove', 'add_to_cart'].includes(value.eventName) &&
      (value.entityId || value.entityType)) {
    ctx.addIssue({ code: 'custom', message: 'This event must not include entity information.' })
  }
  if (value.eventName === 'filter_apply' && !value.filterKey) {
    ctx.addIssue({ code: 'custom', message: 'Filter events require an approved filter category.' })
  }
  if (value.entityId && !value.entityType) {
    ctx.addIssue({ code: 'custom', message: 'Entity type is required with entity ID.' })
  }
  // Never accept a browser-claimed sale; real purchases come from confirmed
  // orders in the commerce backend during M1-C, not public analytics posts.
})
