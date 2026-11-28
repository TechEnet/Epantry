// Run from backend: node scripts/repair-recipe-ingredient-identities.mjs
// Preview by default. Add --apply only after checking the output.
import { connectDatabase, disconnectDatabase } from '../src/config/db.js'
import { listRecipeIngredientPacks } from '../src/modules/commerce/commerce.service.js'
import { syncApprovedRecipeIngredientIdentities } from '../src/modules/hostOperations/hostRecipeIngredientIdentity.service.js'
const flags = process.argv.slice(2)
if (flags.some(flag => flag !== '--apply' && flag !== '--dry-run') || (flags.includes('--apply') && flags.includes('--dry-run'))) {
  console.error('Usage: node scripts/repair-recipe-ingredient-identities.mjs [--dry-run | --apply]')
  process.exit(1)
}
try {
  await connectDatabase()
  const apply = flags.includes('--apply')
  const rows = await syncApprovedRecipeIngredientIdentities({ apply })
  console.log(apply ? 'APPLY: approved grocery-backed ingredient identities' : 'DRY RUN: no database changes')
  console.table(rows)
  console.log(JSON.stringify(rows.reduce((counts, row) => ({ ...counts, [row.result]: (counts[row.result] || 0) + 1 }), {}), null, 2))
  const ids = [...new Set(rows.map(row => row.canonicalIngredientId).filter(Boolean))]
  const packs = {}
  for (let i = 0; i < ids.length; i += 15) {
    const result = await listRecipeIngredientPacks({ canonicalIngredientIds: ids.slice(i, i + 15) })
    Object.assign(packs, result.packsByIngredient)
  }
  console.log('Live availability for linked recipe ingredients (no PIN required):')
  console.table(rows.map(row => ({ recipe: row.recipe, ingredient: row.ingredient,
    identity: row.result,
    availableOffers: row.canonicalIngredientId ? (packs[row.canonicalIngredientId] || []).length : 'not linked',
    packSizes: (packs[row.canonicalIngredientId] || []).map(pack => `${pack.packQuantity} ${pack.packUnit}`).join(', '),
  })))
  console.log('No listings, prices, orders, inventory, or recipe quantities were changed.')
} catch (error) {
  console.error(error?.message || error)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}
