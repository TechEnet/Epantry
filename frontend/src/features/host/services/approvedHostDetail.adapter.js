// Approved Host submissions retain their own governance identity. These adapters
// provide the EXISTING customer Recipe and Grocery detail components with data;
// they do not turn a Host submission into a governed catalog product or recipe.
export const HOST_DETAIL_PREFIX = 'host--'
const HOST_ID = /^[a-f\d]{24}$/i
export function hostListingIdFromSlug(slug) {
  const value = String(slug || '')
  const id = value.startsWith(HOST_DETAIL_PREFIX) ? value.slice(HOST_DETAIL_PREFIX.length) : ''
  return HOST_ID.test(id) ? id : ''
}
export function hostDetailPath(listing) {
  const id = String(listing?.id || '')
  if (!HOST_ID.test(id)) return '/explore/host-listings'
  return listing.type === 'grocery'
    ? `/grocery/product/${HOST_DETAIL_PREFIX}${id}`
    : `/recipes/${HOST_DETAIL_PREFIX}${id}`
}
function text(value) { return String(value ?? '').trim() }
function finite(value) {
  if (value === null || value === undefined || text(value) === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
function readable(value) { return text(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) }
export function hostListingAsRecipe(listing) {
  if (!listing || listing.type === 'grocery') throw new Error('This listing is not a recipe.')
  const baseServings = Math.max(1, finite(listing.baseServings) || 1)
  const slug = `${HOST_DETAIL_PREFIX}${listing.id}`
  const steps = (listing.steps || []).map((step, i) => ({
    id: `${listing.id}-step-${i}`, stepNumber: i + 1,
    instruction: text(step.instruction),
    timerSeconds: finite(step.timerMinutes) === null ? null : finite(step.timerMinutes) * 60,
    imageUrl: text(step.imageUrl),
  }))
  return {
    hostListing: true,
    hostSubmission: listing,
    dish: {
      id: null, slug, name: text(listing.title), description: text(listing.description),
      heroImageUrl: (listing.images || [])[0] || '',
      cuisine: text(listing.countryOfOrigin), course: readable(listing.category || 'Recipe'),
    },
    recipe: {
      id: null, title: text(listing.title), description: text(listing.description),
      baseServings, preparationTimeMinutes: 0,
      cookingTimeMinutes: steps.reduce((sum, step) => sum + (step.timerSeconds || 0), 0) / 60,
      difficulty: 'Not declared', source: { type: 'host_submission' },
    },
    ingredients: (listing.ingredients || []).map((line, i) => ({
      id: `${listing.id}-ingredient-${i}`, lineNumber: i + 1,
      ingredient: { name: text(line.name), imageUrl: text(line.imageUrl) },
      canonicalIngredientId: null, // Not verified by Host listing approval.
      quantity: finite(line.quantity) ?? text(line.quantity), unit: text(line.unit),
      preparationState: '', optional: false,
    })),
    steps,
  }
}
export function scaleHostRecipe(original, servings) {
  const factor = Math.max(1, Number(servings) || 1) / Math.max(1, Number(original?.recipe?.baseServings) || 1)
  return {
    scaling: {
      ingredients: (original?.ingredients || []).map(line => ({
        ...line,
        displayQuantity: typeof line.quantity === 'number'
          ? Math.round(line.quantity * factor * 1000) / 1000
          : line.quantity,
        displayUnit: line.unit,
      })),
    },
  }
}
export function hostListingAsGrocery(listing) {
  if (!listing || listing.type !== 'grocery') throw new Error('This listing is not grocery.')
  const nutrition = listing.nutrition || {}
  const keys = [['energyKcal','Energy','kcal'],['proteinG','Protein','g'],['carbohydrateG','Carbohydrate','g'],['fatG','Fat','g'],['fiberG','Fibre','g'],['sugarG','Sugar','g'],['sodiumMg','Sodium','mg']]
  const quantityMatch = text(listing.title).match(/(?:^|[–-]\s*)(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/i)
  const netQuantity = quantityMatch ? { value: Number(quantityMatch[1]), unit: quantityMatch[2].toLowerCase() } : null
  const images = (listing.images || []).map((url, i) => ({ url, alt: `${text(listing.title)} image ${i+1}` })).filter(i => i.url)
  const allergens = (listing.allergens || []).map(a => ({
    allergenKey: text(typeof a === 'string' ? a : (a.key || a.name || a.allergenKey)),
    relationType: text(typeof a === 'string' ? 'declared' : (a.status || a.relationType || a.value || 'declared')),
  })).filter(a => a.allergenKey)
  return {
    isHostListing: true, hostSubmission: listing,
    slug: `${HOST_DETAIL_PREFIX}${listing.id}`,
    displayName: text(listing.title), description: text(listing.description),
    images, image: images[0] || null,
    category: { name: readable(listing.grocerySubcategory || listing.category || 'Grocery'), slug: text(listing.category) },
    brand: listing.brandName ? { name: text(listing.brandName) } : null,
    family: listing.productFamily ? { name: text(listing.productFamily) } : null, variant: null,
    netQuantity, unitsPerPack: finite(listing.unitsPerPack), servingSize: text(listing.servingSize),
    manufacturerPacker: text(listing.manufacturerPacker), regionOfOrigin: text(listing.regionOfOrigin),
    pack: { name: netQuantity ? `${netQuantity.value} ${netQuantity.unit}` : readable(listing.packagingType), type: readable(listing.packagingType), multipackCount: finite(listing.unitsPerPack) },
    // No canonical pack or public marketplace offer is claimed by listing approval.
    packId: null, canonicalPackId: null,
    manufacturerName: text(listing.manufacturerPacker), countryOfOrigin: text(listing.countryOfOrigin),
    barcode: text(listing.barcode), gtin: text(listing.barcode),
    ingredientDeclarationText: (listing.ingredients || []).map(a => text(a.name)).filter(Boolean).join(', '),
    ingredients: (listing.ingredients || []).map(a => ({ displayName: text(a.name), percentage: null })),
    allergenStatement: allergens.map(a => `${readable(a.allergenKey)}: ${readable(a.relationType)}`).join(' · '),
    allergens,
    nutrition: { basis: text(nutrition.basis), servingSize: /^\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|piece)\s*$/i.test(text(listing.servingSize)) ? { value: Number(text(listing.servingSize).match(/\d+(?:\.\d+)?/)[0]), unit: text(listing.servingSize).match(/(kg|g|ml|l|piece)\s*$/i)[1].toLowerCase() } : null, nutrients: keys
      .filter(([key]) => finite(nutrition[key]) !== null)
      .map(([key, nutrientKey, unit]) => ({ nutrientKey, amount: finite(nutrition[key]), unit })) },
    claims: [], certifications: [],
    hostDeclaredPrice: listing.offer?.declaredPrice ?? null,
  }
}
