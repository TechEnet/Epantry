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

// Public read model for approved Host listing packets. Never expose
// private Host-cost, inventory, delivery service-area or raw operational data.
export function publicListing(record) {
  const packet = record.packet || {}
  const commercial = record.type === 'grocery' || record.type === 'prepared_food' || packet.sellReadyMade
  return {
    id: String(record._id), slug: publicHostSlug(record), title: record.title, type: record.type,
    category: packet.category,
    grocerySubcategory: record.type === 'grocery' ? (packet.grocerySubcategory || '') : '',
    packagingType: record.type === 'grocery' ? (packet.packagingType || '') : '',
    description: packet.description, images: packet.images || [],
    videoUrl: packet.videoUrl || '', brandName: packet.brandName || '',
    countryOfOrigin: packet.countryOfOrigin || '', regionOfOrigin: packet.regionOfOrigin || '',
    localRecipeName: packet.localRecipeName || '', localRecipeLanguage: packet.localRecipeLanguage || '',
    englishNameReading: packet.englishNameReading || '',
    productFamily: record.type === 'grocery' ? (packet.productFamily || '') : '',
    manufacturerPacker: record.type === 'grocery' ? (packet.manufacturerPacker || '') : '',
    unitsPerPack: record.type === 'grocery' ? (packet.unitsPerPack ?? null) : null,
    servingSize: record.type === 'grocery' ? (packet.servingSize || '') : '',
    barcode: record.type === 'grocery' ? (packet.selling?.barcode || '') : '',
    shareRecipe: Boolean(packet.shareRecipe), sellReadyMade: Boolean(packet.sellReadyMade),
    baseServings: packet.baseServings, difficulty: record.type === 'grocery' ? '' : (packet.difficulty || 'not_declared'), ingredients: packet.ingredients?.map((item) => ({
      name: item.name, quantity: item.quantity, unit: item.unit, imageUrl: item.imageUrl,
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
