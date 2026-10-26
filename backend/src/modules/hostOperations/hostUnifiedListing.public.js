// Public read model for approved Host listing packets. Never expose
// private Host-cost, inventory, delivery service-area or raw operational data.
export function publicListing(record) {
  const packet = record.packet || {}
  const commercial = record.type === 'grocery' || record.type === 'prepared_food' || packet.sellReadyMade
  return {
    id: String(record._id), title: record.title, type: record.type,
    category: packet.category,
    grocerySubcategory: record.type === 'grocery' ? (packet.grocerySubcategory || '') : '',
    packagingType: record.type === 'grocery' ? (packet.packagingType || '') : '',
    description: packet.description, images: packet.images || [],
    videoUrl: packet.videoUrl || '', brandName: packet.brandName || '',
    shareRecipe: Boolean(packet.shareRecipe), sellReadyMade: Boolean(packet.sellReadyMade),
    baseServings: packet.baseServings, ingredients: packet.ingredients?.map((item) => ({
      name: item.name, quantity: item.quantity, unit: item.unit, imageUrl: item.imageUrl,
      canonicalIngredientId: /^[a-f0-9]{24}$/i.test(String(item.canonicalIngredientId || '')) ? item.canonicalIngredientId : '',
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
