// A Host packet keeps its own governed identity while sharing customer detail routes.
// Suffix prevents same-name Host listings colliding with each other or catalog slugs.
export function publicHostSlug(record) {
  if (record?.publicSlug) return String(record.publicSlug)
  const base = String(record?.title || record?.packet?.title || 'host-food')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110) || 'host-food'
  const id = String(record?._id || record?.id || '')
  return `${base}-${id.slice(-10)}`
}

// Existing approved records without snapshots remain publicly accessible.
// A newer submitted/draft/rejected revision NEVER changes the last approved read model.
export function publicHostListingFilter(extra = {}) {
  return { ...extra, deletedAt: null, $or: [
    { status: 'approved' },
    { publishedPacket: { $exists: true, $ne: null } },
  ] }
}
export function publishedHostRecord(record) {
  if (!record?.publishedPacket) return record
  return { ...record, status: 'approved', packet: record.publishedPacket,
    title: record.publishedTitle || record.publishedPacket.title || record.title,
    type: record.publishedType || record.publishedPacket.type || record.type }
}

// Public read model for approved Host listing packets. Never expose
// private Host-cost, inventory, delivery service-area or raw operational data.
export function publicListing(record) {
  const approved = publishedHostRecord(record)
  const packet = approved.packet || {}
  const commercial = approved.type === 'grocery' || approved.type === 'prepared_food' || packet.sellReadyMade
  return {
    id: String(record._id), slug: publicHostSlug(record), title: approved.title, type: approved.type,
    category: packet.category,
    grocerySubcategory: approved.type === 'grocery' ? (packet.grocerySubcategory || '') : '',
    packagingType: approved.type === 'grocery' ? (packet.packagingType || '') : '',
    description: packet.description, images: packet.images || [],
    videoUrl: packet.videoUrl || '', brandName: packet.brandName || '',
    countryOfOrigin: packet.countryOfOrigin || '', regionOfOrigin: packet.regionOfOrigin || '',
    localRecipeName: packet.localRecipeName || '', localRecipeLanguage: packet.localRecipeLanguage || '',
    englishNameReading: packet.englishNameReading || '',
    productFamily: approved.type === 'grocery' ? (packet.productFamily || '') : '',
    manufacturerPacker: approved.type === 'grocery' ? (packet.manufacturerPacker || '') : '',
    unitsPerPack: approved.type === 'grocery' ? (packet.unitsPerPack ?? null) : null,
    servingSize: approved.type === 'grocery' ? (packet.servingSize || '') : '',
    barcode: approved.type === 'grocery' ? (packet.selling?.barcode || '') : '',
    // Only resolved from a published canonical ProductVersion by the public route.
    canonicalPackId: record.verifiedPackId || null,
    // Link to the existing canonical product screen, whose Marketplace controls
    // perform live seller, price, inventory and serviceability checks.
    marketplaceProductPath: record.verifiedProductPath || null,
    packQuantity: approved.type === 'grocery' ? (packet.selling?.packQuantity ?? null) : null,
    packUnit: approved.type === 'grocery' ? (packet.selling?.packUnit || '') : '',
    cuisine: approved.type === 'grocery' ? '' : (packet.cuisine || ''),
    preparationMinutes: approved.type === 'grocery' ? null : (packet.preparationMinutes ?? null),
    cookingMinutes: approved.type === 'grocery' ? null : (packet.cookingMinutes ?? null),
    shareRecipe: Boolean(packet.shareRecipe), sellReadyMade: Boolean(packet.sellReadyMade),
    // Only publish the fulfillment MODE, never private coverage or Host operational data.
    fulfillmentType: commercial ? (packet.delivery?.fulfillment === 'pickup' ? 'pickup' : 'delivery') : null,
    baseServings: packet.shareRecipe ? packet.baseServings : null,
    difficulty: approved.type === 'grocery' || !packet.shareRecipe ? '' : (packet.difficulty || 'not_declared'),
    // Full quantities and preparation instructions are private unless the
    // Host has explicitly chosen to share the approved recipe.
    ingredients: (packet.shareRecipe ? packet.ingredients : [])?.map((item) => ({
      name: item.name, quantity: item.quantity, unit: item.unit, imageUrl: item.imageUrl,
      role: item.role || 'main', preparationState: item.preparationState || '',
      scalingRule: item.scalingRule || 'proportional',
    })) || [],
    steps: packet.shareRecipe ? packet.steps?.map((item) => ({ instruction: item.instruction, timerMinutes: item.timerMinutes, imageUrl: item.imageUrl })) || [] : [],
    nutrition: packet.nutrition ? {
      basis: packet.nutrition.basis,
      energyKcal: packet.nutrition.energyKcal, proteinG: packet.nutrition.proteinG,
      carbohydrateG: packet.nutrition.carbohydrateG, fatG: packet.nutrition.fatG,
      fiberG: packet.nutrition.fiberG, sugarG: packet.nutrition.sugarG, sodiumMg: packet.nutrition.sodiumMg,
    } : null,
    allergens: packet.allergens || [], dietary: packet.dietary || '',
    offer: commercial ? { declaredPrice: packet.selling?.salePrice ?? null, currency: 'INR', purchasable: false } : null,
    foodEvidenceStatus: 'host_declared_unverified',
    approvedAt: record.approvedAt,
  }
}
