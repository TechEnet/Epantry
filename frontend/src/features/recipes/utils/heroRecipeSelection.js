import { hostDetailPath } from '../../host/services/approvedHostDetail.adapter'
/*
 * Pure, testable personalized recommendation selector.
 * Purchases come ONLY from paid EPANTRY order history. No title inferred
 * from an arbitrary grocery order may be displayed as a recipe order unless
 * it exactly matches a currently published recipe or approved food listing.
 */
export const normalizeName = (value) => String(value || '')
  .normalize('NFKC')
  .toLocaleLowerCase('en')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const presentDate = (value) => {
  const time = Date.parse(value || '')
  return Number.isFinite(time) ? time : 0
}

export function normalizeRecipeSources({ publicRecipes = [], featuredRecipes = [], hostListings = [] }) {
  const byId = new Map()
  const insert = (card) => {
    if (!card || !card.name || !card.path) return
    const existing = byId.get(card.id)
    byId.set(card.id, existing ? {
      ...existing,
      ...card,
      image: card.image || existing.image,
      cuisine: card.cuisine || existing.cuisine,
      publishedAt: card.publishedAt || existing.publishedAt,
    } : card)
  }

  for (const item of publicRecipes) {
    const dish = item?.dish || {}
    const recipe = item?.recipe || {}
    const slug = String(dish.slug || '').trim()
    if (!slug) continue
    insert({
      id: `recipe:${slug}`,
      slug,
      name: dish.name || recipe.title || '',
      image: dish.heroImageUrl || '',
      cuisine: dish.cuisine || dish.course || 'Recipe',
      path: `/recipes/${encodeURIComponent(slug)}`,
      publishedAt: recipe.publishedAt || '',
    })
  }

  for (const item of featuredRecipes) {
    const slug = String(item?.slug || '').trim()
    if (!slug) continue
    insert({
      id: `recipe:${slug}`,
      slug,
      name: item?.name || item?.title || '',
      image: item?.image || '',
      cuisine: item?.cuisine || item?.dietaryType || 'Recipe',
      path: `/recipes/${encodeURIComponent(slug)}`,
      publishedAt: '',
    })
  }

  const kindLabels = {
    drinks: 'Drinks', sweets: 'Sweets', desserts: 'Desserts', bakery: 'Bakery',
    brand_recipe: 'Recipe', kitchen_recipe: 'Recipe', prepared_food: 'Ready-made food',
  }
  for (const item of hostListings) {
    if (!item?.id || !item?.title || item.type === 'grocery') continue
    const kind = kindLabels[item.category] || kindLabels[item.type]
    if (!kind) continue
    // Host packet records can represent prepared food as well as shared recipes.
    // Only Super-Admin-approved public records reach this endpoint.
    insert({
      id: `host:${item.id}`,
      slug: '',
      name: item.title,
      image: Array.isArray(item.images) ? String(item.images[0] || '') : '',
      cuisine: kind,
      path: hostDetailPath(item),
      publishedAt: item.approvedAt || '',
    })
  }

  return [...byId.values()].sort((a, b) => presentDate(b.publishedAt) - presentDate(a.publishedAt))
}

export function selectHeroRecipes({ catalog = [], orders = [], recentViews = [], maxItems = 9 }) {
  const byName = new Map()
  const bySlug = new Map()
  const byId = new Map()
  const ambiguousNames = new Set()
  for (const card of catalog) {
    byId.set(card.id, card)
    const key = normalizeName(card.name)
    if (key && byName.has(key) && byName.get(key).id !== card.id) ambiguousNames.add(key)
    else if (key && !byName.has(key)) byName.set(key, card)
    if (card.slug) bySlug.set(card.slug, card)
  }
  // Order summaries have only item names, not guaranteed recipe identifiers.
  // Do not label a dish as ordered when two distinct listings share its name.
  for (const key of ambiguousNames) byName.delete(key)

  const ordered = []
  const viewed = []
  const seen = new Set()
  const add = (card, label, target) => {
    if (!card || seen.has(card.id)) return
    seen.add(card.id)
    target.push({ ...card, label })
  }

  // A created, pending, failed, cancelled or refunded order is NOT a purchase.
  for (const order of orders) {
    if (order?.paymentStatus !== 'paid') continue
    if (['customer_cancelled', 'seller_cancelled', 'returned', 'refunded'].includes(order?.status)) continue
    const names = (order.sellerProgress || []).flatMap((seller) => seller.itemNames || [])
    if (order.primaryItemName) names.unshift(order.primaryItemName)
    for (const name of names) add(byName.get(normalizeName(name)), 'Ordered', ordered)
  }

  for (const view of recentViews) {
    const card = view.listingId
      ? byId.get(`host:${view.listingId}`)
      : bySlug.get(view.slug)
    add(card, 'Recently viewed', viewed)
  }

  const remaining = catalog.filter((card) => !seen.has(card.id))
  const fresh = remaining[0] ? [{ ...remaining[0], label: 'Discover next' }] : []
  if (fresh[0]) seen.add(fresh[0].id)

  // Reserve the final position for one item the customer has not viewed.
  // Orders remain first, then recent views, then the discovery choice.
  const prioritySlots = Math.max(0, maxItems - (fresh.length ? 1 : 0))
  const selected = [...ordered, ...viewed].slice(0, prioritySlots).concat(fresh)
  // Keep an informative ribbon for first-time visitors and empty accounts.
  for (const card of catalog) {
    if (selected.length >= Math.min(4, maxItems)) break
    if (!seen.has(card.id)) {
      selected.push({ ...card, label: 'Explore' })
      seen.add(card.id)
    }
  }
  return selected.slice(0, maxItems)
}
