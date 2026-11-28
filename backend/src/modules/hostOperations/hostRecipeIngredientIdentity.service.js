import { CanonicalIngredient, ProductVersion, Pack } from '../catalog/catalog.models.js'
import { HostUnifiedListingPacket } from './hostUnifiedListing.models.js'
import { publicHostListingFilter, publishedHostRecord } from './hostUnifiedListing.public.js'
import { normalizeCatalogSlug } from '../catalog/catalog.constants.js'

const isId = value => /^[a-f\d]{24}$/i.test(String(value || ''))
const clean = value => String(value || '').normalize('NFKC').trim()
  .replace(/(?:\s*[-\u2013\u2014,]\s*|\s+)\d+(?:\.\d+)?\s*(?:kg|g|gm|grams?|ml|l|litres?|liters?|oz|lb|pieces?|pcs|packs?)\s*$/i, '').trim()
export const ingredientKey = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const labels = row => [row.canonicalName, ...(row.aliases || [])]
const tokenKey = value => ingredientKey(value).split(' ').filter(Boolean).sort().join(' ')
const sameName = (left, right) => Boolean(ingredientKey(left)) && (ingredientKey(left) === ingredientKey(right) || tokenKey(left) === tokenKey(right))
const lookupNames = value => {
  const raw = clean(value)
  return [raw, raw.replace(/\([^)]*\)/g, ' '), ...[...raw.matchAll(/\(([^)]+)\)/g)].map(match => match[1])]
}
// Purchase identity is stricter than photo search: no fuzzy or substring guesses.
export function resolveIngredientIdentity(row, catalog) {
  const key = ingredientKey(row?.name)
  if (!key) return null
  const exact = catalog.filter(item => labels(item).some(name => ingredientKey(name) === key))
  const matches = exact.length ? exact : catalog.filter(item => labels(item).some(name => sameName(name, row.name)))
  const saved = matches.find(item => String(item._id) === String(row.canonicalIngredientId || ''))
  if (saved || matches.length) return saved || (matches.length === 1 ? matches[0] : null)
  // Preserve the existing governed parenthetical-name/alias fallback.
  const keys = new Set(lookupNames(row.name).map(ingredientKey).filter(Boolean))
  const fallback = catalog.filter(item => labels(item).some(name => keys.has(ingredientKey(name))))
  return fallback.length === 1 ? fallback[0] : null
}
const esc = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// The DB search only narrows candidates; the exact normalized comparison above decides.
function lookupPatterns(names) {
  return [...new Set(names.map(ingredientKey).filter(Boolean).map(name => name.split(' ').sort((a,b) => b.length-a.length)[0]))].map(word =>
    new RegExp(`(?:^|[^a-z0-9])${esc(word)}(?:[^a-z0-9]|$)`, 'i'))
}
export async function loadRecipeIngredientIdentities(rows) {
  const ids = [...new Set(rows.map(row => String(row.canonicalIngredientId || '')).filter(isId))]
  const patterns = lookupPatterns(rows.flatMap(row => lookupNames(row.name)))
  const conditions = []
  if (ids.length) conditions.push({ _id: { $in: ids } })
  if (patterns.length) conditions.push({ canonicalName: { $in: patterns } }, { aliases: { $in: patterns } })
  return conditions.length ? CanonicalIngredient.find({ status: 'active', $or: conditions })
    .select('_id canonicalName aliases').lean() : []
}
function groceryKey(packet) { return ingredientKey(packet.title) }
const groceryQuery = () => publicHostListingFilter({})
// Explicitly approved grocery + current published product + active pack. This never
// creates a listing, a product version, a price, inventory, or an offer.
async function approvedGroceryRows(now, names = []) {
  const base = groceryQuery()
  const patterns = lookupPatterns(names)
  if (patterns.length) base.$and.push({ $or: [
    { publishedTitle: { $in: patterns } }, { 'publishedPacket.title': { $in: patterns } },
    { publishedPacket: null, 'packet.title': { $in: patterns } },
  ] })
  const records = await HostUnifiedListingPacket.find({ ...base, $or: [
    { publishedType: 'grocery' }, { 'publishedPacket.type': 'grocery' }, { publishedPacket: null, type: 'grocery' },
  ] }).select('_id packet publishedPacket type publishedType title publishedTitle reviewedByUserId').lean()
  const groceries = records.map(publishedHostRecord).filter(row => row.type === 'grocery' && isId(row.packet?.catalogProductVersionId))
  const ids = [...new Set(groceries.map(row => String(row.packet.catalogProductVersionId)))]
  if (!ids.length) return []
  const versions = await ProductVersion.find({ _id: { $in: ids }, publicationStatus: 'published', $and: [
    { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: now } }] },
    { $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }] },
  ] }).select('_id packId displayName').lean()
  const packs = await Pack.find({ _id: { $in: versions.map(row => row.packId) }, status: 'active' }).select('_id').lean()
  const active = new Set(packs.map(row => String(row._id)))
  const byId = new Map(versions.filter(row => active.has(String(row.packId))).map(row => [String(row._id), row]))
  return groceries.flatMap(row => {
    const version = byId.get(String(row.packet.catalogProductVersionId))
    return version && sameName(row.packet.title, version.displayName)
      ? [{ ...row, version }] : []
  })
}
// Match current approved grocery versions for existing canonical names and aliases.
// The caller also retains the original governed catalog matching rules.
export async function listGroceryBackedVersionIds(ingredient, now) {
  const names = labels(ingredient).filter(Boolean)
  if (!names.length) return []
  const groceries = await approvedGroceryRows(now, names.flatMap(lookupNames))
  // Use the full normalized identity or a governed catalog alias. Do not
  // drop product qualifiers or infer a substitution from a common word.
  const equivalent = (title, name) => sameName(title, name)
  return [...new Set(groceries.filter(row => names.some(name => equivalent(row.packet.title, name)))
    .map(row => String(row.version._id)))]
}

// Only identical normalized grocery titles, ignoring a trailing pack size.
// Distinct product identities are never inferred from a common word or photo.
export function planIngredientIdentity(row, catalog, groceries) {
  const key = ingredientKey(row?.name)
  if (!key) return { reason: 'empty_name' }
  const existing = catalog.filter(item => labels(item).some(name => ingredientKey(name) === key))
  if (existing.length) return { reason: resolveIngredientIdentity(row, existing) ? 'already_linked' : 'ambiguous_catalog' }
  if (resolveIngredientIdentity(row, catalog)) return { reason: 'already_linked' }
  const fallbackKeys = new Set(lookupNames(row.name).map(ingredientKey).filter(Boolean))
  if (catalog.some(item => labels(item).some(name => fallbackKeys.has(ingredientKey(name))))) return { reason: 'ambiguous_catalog' }
  const matches = groceries.filter(item => groceryKey(item.packet) === key)
  if (!matches.length) return { reason: 'no_exact_approved_grocery' }
  const source = matches[0]
  const canonicalName = clean(source.packet.title)
  const slug = normalizeCatalogSlug(canonicalName)
  if (!slug || canonicalName.length > 220 || slug.length > 250) return { reason: 'invalid_identity' }
  return { reason: 'create', canonicalName, slug, source }
}
// Only called by explicit maintenance command or existing Super Admin approval path.
// No public/customer GET performs writes. Existing recipes and grocery records are unchanged.
export async function syncApprovedRecipeIngredientIdentities({ apply = false, listingId = null, reviewerId = null } = {}) {
  const groceries = await approvedGroceryRows(new Date())
  const records = await HostUnifiedListingPacket.find({ ...publicHostListingFilter({}), $or: [
    { 'publishedPacket.shareRecipe': true }, { publishedPacket: null, 'packet.shareRecipe': true },
  ] }).select('_id packet publishedPacket type publishedType title publishedTitle').lean()
  const recipes = records.map(publishedHostRecord).filter(row => row.type !== 'grocery' && row.packet?.shareRecipe === true)
  const changed = listingId ? String(listingId) : ''
  const changedGrocery = groceries.find(row => String(row._id) === changed)
  const scope = recipes.filter(row => !changed || changedGrocery || String(row._id) === changed)
  const rows = scope.flatMap(recipe => (recipe.packet.ingredients || []).map(row => ({ ...row, recipe: recipe.title })))
    .filter(row => !changedGrocery || ingredientKey(row.name) === groceryKey(changedGrocery.packet))
  const catalog = await loadRecipeIngredientIdentities(rows)
  const report = []
  for (const row of rows) {
    const plan = planIngredientIdentity(row, catalog, groceries)
    if (plan.reason !== 'create') {
      const linked = plan.reason === 'already_linked' ? resolveIngredientIdentity(row, catalog) : null
      report.push({ recipe: row.recipe, ingredient: row.name, result: plan.reason,
        ...(linked && isId(linked._id) ? { canonicalIngredientId: String(linked._id) } : {}) })
      continue
    }
    const occupied = await CanonicalIngredient.findOne({ slug: plan.slug }).select('_id status canonicalName aliases').lean()
    if (occupied) {
      report.push({ recipe: row.recipe, ingredient: row.name, result: 'existing_slug_requires_review' }); continue
    }
    let linkedId = ''
    if (apply) {
      try {
        const doc = await CanonicalIngredient.findOneAndUpdate({ slug: plan.slug }, { $setOnInsert: {
          canonicalName: plan.canonicalName, slug: plan.slug, aliases: [], status: 'active',
          attributes: { approvedGroceryIdentity: { listingId: String(plan.source._id), productVersionId: String(plan.source.version._id), evidence: 'super_admin_approved_grocery_title' } },
          createdByUserId: reviewerId || plan.source.reviewedByUserId || null,
          updatedByUserId: reviewerId || plan.source.reviewedByUserId || null,
        } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean()
        if (doc.status !== 'active' || ingredientKey(doc.canonicalName) !== ingredientKey(plan.canonicalName)) {
          report.push({ recipe: row.recipe, ingredient: row.name, result: 'existing_slug_requires_review' }); continue
        }
        catalog.push(doc)
        linkedId = String(doc._id)
      } catch (error) {
        if (error?.code !== 11000) throw error
        report.push({ recipe: row.recipe, ingredient: row.name, result: 'concurrent_identity_retry' }); continue
      }
    } else catalog.push({ _id: `preview:${plan.slug}`, canonicalName: plan.canonicalName, aliases: [] })
    report.push({ recipe: row.recipe, ingredient: row.name, result: apply ? 'linked' : 'would_link', canonicalName: plan.canonicalName, ...(linkedId ? { canonicalIngredientId: linkedId } : {}) })
  }
  return report
}
