// M2 listing packet validation and estimates. This module has no database or HTTP side effects.
// Publication, Admin decisions, and operational offer creation are intentionally M3 responsibilities.
export const LISTING_TYPES = Object.freeze(['grocery', 'brand_recipe', 'kitchen_recipe', 'prepared_food'])
export const LISTING_CATEGORIES = Object.freeze([
  'grocery', 'breakfast', 'brunch', 'lunch', 'dinner', 'snacks', 'drinks', 'sweets',
  'desserts', 'bakery', 'main_course', 'side_dish', 'other',
])
const ALLOWED_UNITS = new Set(['g', 'kg', 'ml', 'l', 'piece', 'tsp', 'tbsp', 'cup'])
// Optional Hybrid grocery facets, persisted without changing the legacy grocery category.
const GROCERY_SUBCATEGORIES = new Set(['vegetables','fruits','dairy','eggs','meat_poultry','seafood','grains_rice','pulses_legumes','spices_condiments','oils_ghee','canned_jarred','packaged_snacks','packaged_food','frozen_food','beverages','bakery_bread','other_grocery'])
const PACKAGING_TYPES = new Set(['loose','packet','can','jar','bottle','box','tray','other'])
// Grocery photo roles are optional metadata; image URLs remain unchanged for public consumers.
const GROCERY_IMAGE_ROLES = new Set(['front_of_pack','ingredients_panel','allergen_statement','nutrition_panel','barcode','back_manufacturer_panel','certification_mark'])
const WORKSPACE_TYPES = new Set(['b2b', 'brand_seller', 'chef_restaurant', 'hybrid'])
const ACCESS = Object.freeze({
  b2b: ['grocery', 'kitchen_recipe', 'prepared_food'],
  brand_seller: ['grocery', 'brand_recipe'],
  chef_restaurant: ['kitchen_recipe', 'prepared_food'],
  hybrid: LISTING_TYPES,
  legacy: LISTING_TYPES,
})
const MASS = { g: 1, kg: 1000 }
const VOLUME = { ml: 1, l: 1000 }
const MAX_LISTING_BYTES = 180000
const INGREDIENT_ROLES = new Set(['main', 'optional', 'garnish'])
const SCALING_RULES = new Set(['proportional', 'fixed'])
// Check digits are calculated locally; no external barcode service is trusted.
export function isValidGtin(value) {
  const digits = String(value || '').trim()
  if (!/^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/.test(digits)) return false
  const sum = [...digits.slice(0, -1)].reverse().reduce((total, char, index) =>
    total + Number(char) * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1))
}


function text(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max)
}
function finiteNonnegative(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}
function cleanUrl(value) {
  const raw = text(value, 1800)
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
function list(value, count) { return Array.isArray(value) ? value.slice(0, count) : [] }
export function normalizeListingWorkspace(value) {
  const key = text(value, 40).toLowerCase()
  return WORKSPACE_TYPES.has(key) ? key : 'legacy'
}
export function allowedListingTypes(workspace) {
  return ACCESS[normalizeListingWorkspace(workspace)]
}
export function canHostListType(workspace, type) {
  return allowedListingTypes(workspace).includes(type)
}
export function normalizeListingPacket(raw = {}) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const type = text(input.type, 40)
  const recipeAllowed = type !== 'grocery'
  const commercial = type === 'grocery' || type === 'prepared_food' || (type === 'kitchen_recipe' && Boolean(input.sellReadyMade))
  const ingredients = recipeAllowed ? list(input.ingredients, 100).map((item) => ({
    name: text(item?.name, 200),
    canonicalIngredientId: text(item?.canonicalIngredientId, 80),
    imageUrl: cleanUrl(item?.imageUrl),
    quantity: finiteNonnegative(item?.quantity),
    unit: ALLOWED_UNITS.has(item?.unit) ? item.unit : 'g',
    unitPrice: finiteNonnegative(item?.unitPrice),
    priceQuantity: finiteNonnegative(item?.priceQuantity),
    priceUnit: ALLOWED_UNITS.has(item?.priceUnit) ? item.priceUnit : 'g',
    priceSource: 'host_declared',
    role: INGREDIENT_ROLES.has(item?.role) ? item.role : 'main',
    preparationState: text(item?.preparationState, 120),
    scalingRule: SCALING_RULES.has(item?.scalingRule) ? item.scalingRule : 'proportional',
    note: text(item?.note, 500),
  })) : []
  const steps = recipeAllowed ? list(input.steps, 75).map((step) => ({
    instruction: text(step?.instruction, 1600),
    timerMinutes: finiteNonnegative(step?.timerMinutes),
    imageUrl: cleanUrl(step?.imageUrl),
  })) : []
  const postalCodes = [...new Set(list(input.delivery?.postalCodes, 600)
    .map((code) => text(code, 12)).filter((code) => /^[1-9][0-9]{5}$/.test(code)))].slice(0, 500)
  const images = list(input.images, 12).map(cleanUrl).filter(Boolean)
  const imageRoles = type === 'grocery'
    ? list(input.imageRoles, 12).map((item) => ({
        url: cleanUrl(item?.url),
        role: text(item?.role, 70),
      })).filter((item) => images.includes(item.url) && GROCERY_IMAGE_ROLES.has(item.role))
    : []
  return {
    type,
    title: text(input.title, 180),
    description: text(input.description, 3000),
    category: text(input.category, 50),
    grocerySubcategory: type === 'grocery' && GROCERY_SUBCATEGORIES.has(input.grocerySubcategory) ? input.grocerySubcategory : '',
    packagingType: type === 'grocery' && PACKAGING_TYPES.has(input.packagingType) ? input.packagingType : '',
    images,
    imageRoles,
    videoUrl: recipeAllowed ? cleanUrl(input.videoUrl) : '',
    videoFileName: recipeAllowed && cleanUrl(input.videoUrl)
      ? text(input.videoFileName, 180).replace(/[\/\\\x00-\x1f\x7f]/g, '').trim()
      : '',
    brandName: text(input.brandName, 140),
    // Host-declared origin is not an independently verified geography claim.
    countryOfOrigin: text(input.countryOfOrigin, 100),
    regionOfOrigin: text(input.regionOfOrigin, 100),
    localRecipeName: recipeAllowed ? text(input.localRecipeName, 200) : '',
    localRecipeLanguage: recipeAllowed ? text(input.localRecipeLanguage, 80) : '',
    englishNameReading: recipeAllowed ? text(input.englishNameReading, 200) : '',
    productFamily: type === 'grocery' ? text(input.productFamily, 160) : '',
    manufacturerPacker: type === 'grocery' ? text(input.manufacturerPacker, 180) : '',
    unitsPerPack: type === 'grocery' ? finiteNonnegative(input.unitsPerPack) : null,
    servingSize: type === 'grocery' ? text(input.servingSize, 100) : '',
    sku: text(input.sku, 120),
    catalogProductVersionId: type === 'grocery' ? text(input.catalogProductVersionId, 24) : '',
    labelDeclaration: type === 'grocery' ? {
      ingredients: text(input.labelDeclaration?.ingredients, 6000),
      allergens: text(input.labelDeclaration?.allergens, 3000),
      claims: text(input.labelDeclaration?.claims, 2500),
    } : { ingredients: '', allergens: '', claims: '' },
    cuisine: recipeAllowed ? text(input.cuisine, 100) : '',
    preparationMinutes: recipeAllowed ? finiteNonnegative(input.preparationMinutes) : null,
    cookingMinutes: recipeAllowed ? finiteNonnegative(input.cookingMinutes) : null,
    baseServings: finiteNonnegative(input.baseServings),
    difficulty: recipeAllowed && ['easy', 'medium', 'hard'].includes(String(input.difficulty || '').toLowerCase()) ? String(input.difficulty).toLowerCase() : 'not_declared',
    ingredients,
    steps,
    nutrition: {
      basis: text(input.nutrition?.basis, 350),
      energyKcal: finiteNonnegative(input.nutrition?.energyKcal),
      proteinG: finiteNonnegative(input.nutrition?.proteinG),
      carbohydrateG: finiteNonnegative(input.nutrition?.carbohydrateG),
      fatG: finiteNonnegative(input.nutrition?.fatG),
      fiberG: finiteNonnegative(input.nutrition?.fiberG),
      sugarG: finiteNonnegative(input.nutrition?.sugarG),
      sodiumMg: finiteNonnegative(input.nutrition?.sodiumMg),
      evidenceNote: text(input.nutrition?.evidenceNote, 1000),
    },
    allergens: list(input.allergens, 20).map((item) => ({
      key: text(item?.key, 70), relationship: text(item?.relationship, 35),
    })).filter((item) => item.key && ['contains', 'may_contain', 'does_not_contain', 'unknown'].includes(item.relationship)),
    dietary: text(input.dietary, 100),
    shareRecipe: type === 'brand_recipe' ? true : recipeAllowed ? Boolean(input.shareRecipe) : false,
    sellReadyMade: type === 'prepared_food' ? true : commercial && type !== 'brand_recipe' && Boolean(input.sellReadyMade),
    selling: {
      listPrice: commercial ? finiteNonnegative(input.selling?.listPrice) : null,
      salePrice: commercial ? finiteNonnegative(input.selling?.salePrice) : null,
      stockQuantity: commercial ? finiteNonnegative(input.selling?.stockQuantity) : null,
      stockUnit: text(input.selling?.stockUnit, 30) || 'piece',
      packQuantity: commercial ? finiteNonnegative(input.selling?.packQuantity) : null,
      packUnit: commercial && ALLOWED_UNITS.has(input.selling?.packUnit) ? input.selling.packUnit : 'piece',
      minimumOrderQuantity: commercial ? finiteNonnegative(input.selling?.minimumOrderQuantity) : null,
      maximumOrderQuantity: commercial ? finiteNonnegative(input.selling?.maximumOrderQuantity) : null,
      barcode: text(input.selling?.barcode, 100),
      packagingCost: commercial ? finiteNonnegative(input.selling?.packagingCost) : null,
      labourCost: commercial ? finiteNonnegative(input.selling?.labourCost) : null,
      currency: 'INR',
      outletId: text(input.selling?.outletId, 80),
      menuId: text(input.selling?.menuId, 80),
    },
    delivery: {
      fulfillment: commercial && input.delivery?.fulfillment === 'pickup' ? 'pickup' : 'delivery',
      postalCodes,
      preparationMinutes: finiteNonnegative(input.delivery?.preparationMinutes),
      note: text(input.delivery?.note, 700),
    },
    sourceNotes: text(input.sourceNotes, 1200),
  }
}
export function calculateListingEstimate(packet) {
  let known = 0
  let total = 0
  const lines = (packet.ingredients || []).map((ingredient) => {
    const amount = Number(ingredient.quantity)
    const price = ingredient.unitPrice
    const priceQuantity = ingredient.priceQuantity
    const sourceUnit = ingredient.unit
    const priceUnit = ingredient.priceUnit
    const unitGroup = MASS[sourceUnit] && MASS[priceUnit] ? MASS :
      VOLUME[sourceUnit] && VOLUME[priceUnit] ? VOLUME : null
    const converted = unitGroup
      ? amount * unitGroup[sourceUnit] / unitGroup[priceUnit]
      : sourceUnit === priceUnit ? amount : null
    const cost = price !== null && priceQuantity > 0 && converted !== null && Number.isFinite(converted)
      ? Math.round((converted / priceQuantity) * price * 100) / 100 : null
    if (cost !== null) { known += 1; total += cost }
    return { name: ingredient.name, estimatedCost: cost, priceSource: 'host_declared' }
  })
  const complete = lines.length > 0 && known === lines.length
  const ingredientTotal = Math.round(total * 100) / 100
  const servingCount = Number(packet.baseServings) || 0
  const extras = (packet.selling?.packagingCost ?? 0) + (packet.selling?.labourCost ?? 0)
  return {
    ingredientLines: lines,
    knownCosts: known,
    totalIngredients: lines.length,
    incomplete: !complete,
    ingredientCost: known > 0 ? ingredientTotal : null,
    fullRecipeCost: complete ? Math.round((ingredientTotal + extras) * 100) / 100 : null,
    perServingCost: complete && servingCount > 0 ? Math.round((ingredientTotal + extras) / servingCount * 100) / 100 : null,
    source: 'Host-entered estimate; not a verified marketplace price',
  }
}
export function validateListingPacket(packet, { submit = false, workspace = 'legacy' } = {}) {
  const errors = []
  if (!LISTING_TYPES.includes(packet.type)) errors.push('Choose a supported food listing type.')
  if (!canHostListType(workspace, packet.type)) errors.push('This Host workspace cannot create that listing type.')
  if (JSON.stringify(packet).length > MAX_LISTING_BYTES) errors.push('Listing exceeds the permitted size.')
  if (!submit) return errors
  if (packet.countryOfOrigin && !/^[\p{L} .,&()'-]{2,100}$/u.test(packet.countryOfOrigin)) errors.push('Country of origin should be a country name, not a code or URL.')
  if (packet.regionOfOrigin && !packet.countryOfOrigin) errors.push('Choose a country before adding a region or state.')
  if (packet.type === 'grocery' && packet.selling.barcode && !isValidGtin(packet.selling.barcode)) {
    errors.push('Enter a valid 8, 12, 13 or 14 digit barcode from the product label.')
  }
  if (packet.catalogProductVersionId && !/^[0-9a-f]{24}$/i.test(packet.catalogProductVersionId)) {
    errors.push('Choose a valid matched EPANTRY catalog product.')
  }
  if (packet.type !== 'grocery' && (packet.preparationMinutes !== null && packet.preparationMinutes > 10080 || packet.cookingMinutes !== null && packet.cookingMinutes > 10080)) {
    errors.push('Check preparation and cooking times; each must be within seven days.')
  }
  if (packet.unitsPerPack !== null && (!Number.isInteger(packet.unitsPerPack) || packet.unitsPerPack < 1)) errors.push('Units per pack must be a whole number greater than zero.')
  if (packet.title.length < 3) errors.push('Item name must contain at least three characters.')
  if (!LISTING_CATEGORIES.includes(packet.category)) errors.push('Choose a valid food category.')
  if (!packet.images.length) errors.push('Upload at least one image for the listing.')
  if (packet.type !== 'grocery') {
    if (!packet.shareRecipe && !packet.sellReadyMade && packet.type !== 'brand_recipe') errors.push('Choose Share Recipe or Sell Ready-made Item.')
    if (!packet.baseServings || packet.baseServings < 1) errors.push('Add a valid number of servings.')
    if (!packet.ingredients.length || packet.ingredients.some((item) => !item.name || !item.quantity || item.quantity <= 0)) errors.push('Complete the ingredient names and quantities.')
    if (!packet.steps.length || packet.steps.some((step) => !step.instruction)) errors.push('Add all preparation instructions.')
  }
  if ((packet.type === 'prepared_food' || (packet.type === 'kitchen_recipe' && packet.sellReadyMade)) && !packet.selling.outletId) errors.push('Choose the kitchen outlet before submitting. It cannot be supplied after approval.')
  if (packet.type === 'grocery' && (!packet.selling.packQuantity || packet.selling.packQuantity <= 0)) errors.push('Enter the packaged product quantity and unit.')
  if (packet.type === 'grocery' || packet.type === 'prepared_food' || packet.sellReadyMade) {
    if (packet.selling.salePrice === null || packet.selling.salePrice <= 0) errors.push('Add a selling price greater than zero.')
    if (packet.selling.stockQuantity === null) errors.push('Enter available stock (zero is allowed).')
    if (packet.delivery.fulfillment === 'delivery' && packet.delivery.postalCodes.length === 0) errors.push('Enter the delivery pincodes selected by this Host.')
  }
  if (packet.selling.maximumOrderQuantity !== null && packet.selling.minimumOrderQuantity !== null && packet.selling.maximumOrderQuantity < packet.selling.minimumOrderQuantity) errors.push('Maximum order quantity cannot be below minimum order quantity.')
  if (packet.selling.listPrice !== null && packet.selling.salePrice !== null && packet.selling.salePrice > packet.selling.listPrice) errors.push('Selling price cannot exceed list price.')
  return errors
}
