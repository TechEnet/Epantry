/* Session-only navigation state for a single recipe cooking journey.
 * Commerce, pantry quantities, stock and purchase status remain server-owned.
 */
const KEY = 'epantry:active-cooking-journey:v1'
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

function safeSlug(value) {
  const slug = String(value || '').trim()
  return /^[a-z0-9][a-z0-9_-]{0,179}$/i.test(slug) ? slug : ''
}

function safeId(value) {
  const id = String(value || '').trim()
  return /^[a-z0-9_-]{8,110}$/i.test(id) ? id : ''
}

function safeServings(value, fallback = 1) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : fallback
}

function read() {
  if (typeof window === 'undefined') return null
  try {
    const data = JSON.parse(window.sessionStorage.getItem(KEY) || 'null')
    if (!data || !safeSlug(data.slug) || !Number.isFinite(data.updatedAt) ||
      Date.now() - data.updatedAt > MAX_AGE_MS || data.updatedAt > Date.now() + 60000) return null
    return {
      slug: safeSlug(data.slug),
      servings: safeServings(data.servings),
      stepIndex: Math.max(0, Math.min(500, Math.trunc(Number(data.stepIndex) || 0))),
      planId: safeId(data.planId),
      cartId: safeId(data.cartId),
      orderId: safeId(data.orderId),
      updatedAt: data.updatedAt,
    }
  } catch {
    return null
  }
}

export function getCookingJourney(slug = '') {
  const data = read()
  if (!data || (slug && data.slug !== safeSlug(slug))) return null
  return data
}

export function saveCookingJourney(update = {}) {
  if (typeof window === 'undefined') return null
  const slug = safeSlug(update.slug)
  if (!slug) return null
  const previous = getCookingJourney(slug)
  const state = {
    slug,
    servings: safeServings(update.servings, previous?.servings || 1),
    stepIndex: update.stepIndex == null
      ? previous?.stepIndex || 0
      : Math.max(0, Math.min(500, Math.trunc(Number(update.stepIndex) || 0))),
    planId: update.planId === null ? '' : safeId(update.planId ?? previous?.planId),
    cartId: update.cartId === null ? '' : safeId(update.cartId ?? previous?.cartId),
    orderId: update.orderId === null ? '' : safeId(update.orderId ?? previous?.orderId),
    updatedAt: Date.now(),
  }
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state))
    window.dispatchEvent(new Event('epantry-cooking-journey-updated'))
  } catch { /* navigation state is optional; backend data remains authoritative */ }
  return state
}

export function attachCookingCart(planId, cartId) {
  const current = read()
  if (!current || !planId || current.planId !== String(planId) || !safeId(cartId)) return null
  return saveCookingJourney({ ...current, cartId: String(cartId) })
}

export function attachRecipeCart(slug, cartId) {
  const current = getCookingJourney(slug)
  if (!current || !safeId(cartId)) return null
  return saveCookingJourney({ ...current, cartId: String(cartId) })
}

export function attachCookingOrder(cartId, orderId) {
  const current = read()
  if (!current || current.cartId !== String(cartId) || !safeId(orderId)) return null
  return saveCookingJourney({ ...current, orderId: String(orderId) })
}

export function getCookingReturnPath({ slug = '', planId = '', cartId = '', orderId = '' } = {}) {
  const current = read()
  if (!current || (slug && current.slug !== safeSlug(slug)) ||
    (planId && current.planId !== String(planId)) ||
    (cartId && current.cartId !== String(cartId)) ||
    (orderId && current.orderId !== String(orderId))) return ''
  return `/recipes/${encodeURIComponent(current.slug)}?cook=1`
}
