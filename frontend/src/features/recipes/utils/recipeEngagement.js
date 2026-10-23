/*
 * Public-recipe browsing history for the landing discovery ribbon.
 * Stored per account (or in a separate guest bucket). No private orders,
 * ingredients, or customer identifiers are written into browsing entries.
 */
const STORAGE_PREFIX = 'epantry-recent-recipes-v1'
const MAX_RECENT = 24
export const RECIPE_VIEWED_EVENT = 'epantry:recipe-viewed'

export function recipeHistoryScope(userId) {
  const raw = String(userId || '').trim()
  return raw ? `${STORAGE_PREFIX}:user:${encodeURIComponent(raw)}` : `${STORAGE_PREFIX}:guest`
}

export function getRecentRecipeViews(userId) {
  if (typeof window === 'undefined') return []
  try {
    const saved = JSON.parse(window.localStorage.getItem(recipeHistoryScope(userId)) || '[]')
    return Array.isArray(saved)
      ? saved.filter((item) => item && (typeof item.slug === 'string' && item.slug || typeof item.listingId === 'string' && item.listingId)).slice(0, MAX_RECENT)
      : []
  } catch {
    return []
  }
}

export function recordApprovedFoodView(listing, userId) {
  if (typeof window === 'undefined') return
  const listingId = String(listing?.id || '').trim()
  const name = String(listing?.title || '').trim()
  if (!listingId || !name) return
  const entry = {
    listingId, name, slug: '',
    image: Array.isArray(listing?.images) ? String(listing.images[0] || '') : '',
    cuisine: String(listing?.category || '').trim(),
    visitedAt: new Date().toISOString(),
  }
  try {
    const remaining = getRecentRecipeViews(userId).filter((item) => item.listingId !== listingId)
    window.localStorage.setItem(recipeHistoryScope(userId), JSON.stringify([entry, ...remaining].slice(0, MAX_RECENT)))
    window.dispatchEvent(new CustomEvent(RECIPE_VIEWED_EVENT))
  } catch {
    // Browsing still works without client storage.
  }
}

export function recordRecipeView(recipe, userId) {
  if (typeof window === 'undefined') return
  const slug = String(recipe?.slug || '').trim()
  const name = String(recipe?.name || recipe?.title || '').trim()
  if (!slug || !name) return

  const entry = {
    slug,
    name,
    image: String(recipe?.image || '').trim(),
    cuisine: String(recipe?.cuisine || '').trim(),
    visitedAt: new Date().toISOString(),
  }
  try {
    const remaining = getRecentRecipeViews(userId).filter((item) => item.slug !== slug)
    window.localStorage.setItem(recipeHistoryScope(userId), JSON.stringify([entry, ...remaining].slice(0, MAX_RECENT)))
    window.dispatchEvent(new CustomEvent(RECIPE_VIEWED_EVENT))
  } catch {
    // Private-mode/storage-restricted sessions must still browse recipes.
  }
}
