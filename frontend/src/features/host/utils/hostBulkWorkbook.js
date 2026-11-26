// Browser-only, dependency-free reader for EPANTRY .xlsx templates.
// It reads values from the fixed named worksheets; formulas/macros are never executed.
const MAX_FILE_BYTES = 3 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024
const MAX_LISTINGS = 100
const TYPES = new Set(['grocery', 'brand_recipe', 'kitchen_recipe', 'prepared_food'])
const CATEGORIES = new Set(['grocery', 'breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'sweets', 'desserts', 'bakery', 'main_course', 'side_dish', 'other'])
const MAX_REFS = 500

function failure(message) { throw new Error(message) }
function bytes(input, begin, length) { return new Uint8Array(input.slice(begin, begin + length)) }
async function readZip(input) {
  const view = new DataView(input)
  if (view.byteLength > MAX_FILE_BYTES) failure('Excel workbook must be smaller than 3 MB.')
  let eocd = -1
  for (let at = view.byteLength - 22; at >= Math.max(0, view.byteLength - 65557); at--) {
    if (view.getUint32(at, true) === 0x06054b50) { eocd = at; break }
  }
  if (eocd < 0) failure('This is not a valid .xlsx workbook.')
  const size = view.getUint32(eocd + 12, true)
  const start = view.getUint32(eocd + 16, true)
  const count = view.getUint16(eocd + 10, true)
  if (size > MAX_FILE_BYTES || start + size > eocd || count > 100) failure('Excel workbook has an unsupported archive structure.')
  let position = start; let uncompressedTotal = 0
  const entries = new Map()
  const decoder = new TextDecoder()
  for (let i = 0; i < count; i++) {
    if (position + 46 > eocd || view.getUint32(position, true) !== 0x02014b50) failure('Workbook contains an invalid ZIP entry.')
    const flags = view.getUint16(position + 8, true)
    const method = view.getUint16(position + 10, true)
    const compressedSize = view.getUint32(position + 20, true)
    const uncompressedSize = view.getUint32(position + 24, true)
    const nameLength = view.getUint16(position + 28, true)
    const extraLength = view.getUint16(position + 30, true)
    const commentLength = view.getUint16(position + 32, true)
    const localOffset = view.getUint32(position + 42, true)
    const name = decoder.decode(bytes(input, position + 46, nameLength))
    position += 46 + nameLength + extraLength + commentLength
    if (flags & 1) failure('Password-protected Excel files cannot be imported.')
    if (name.startsWith('xl/') && (name.endsWith('.xml') || name.endsWith('.rels'))) {
      uncompressedTotal += uncompressedSize
      if (uncompressedTotal > MAX_UNCOMPRESSED_BYTES) failure('Excel workbook exceeds the safe unpacked size limit.')
      if (localOffset + 30 > input.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) failure('Broken Excel workbook entry.')
      const localName = view.getUint16(localOffset + 26, true)
      const localExtra = view.getUint16(localOffset + 28, true)
      const offset = localOffset + 30 + localName + localExtra
      if (offset + compressedSize > input.byteLength) failure('Workbook entry is incomplete.')
      let contents = bytes(input, offset, compressedSize)
      if (method === 8) {
        if (typeof DecompressionStream !== 'function') failure('Please use an updated Chrome, Edge, Safari or Firefox browser to import Excel.')
        try {
          const stream = new Blob([contents]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
          contents = new Uint8Array(await new Response(stream).arrayBuffer())
        } catch { failure('Excel ZIP compression is not supported by this browser.') }
      } else if (method !== 0) failure('Unsupported Excel ZIP compression.')
      if (contents.length !== uncompressedSize) failure('Workbook ZIP entry failed size validation.')
      entries.set(name, decoder.decode(contents))
    }
  }
  return entries
}
function xml(text, label) {
  if (!text) failure(`Workbook is missing ${label}.`)
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) failure('Workbook contains unsupported XML declarations.')
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) failure(`Workbook ${label} is unreadable.`)
  return doc
}
function first(node, name) { return node.getElementsByTagName(name)[0] }
function excelCell(cell, shared) {
  const kind = cell.getAttribute('t')
  const v = first(cell, 'v')?.textContent ?? ''
  if (kind === 'inlineStr') return [...cell.getElementsByTagName('t')].map((part) => part.textContent).join('')
  if (kind === 's') return shared[Number(v)] ?? ''
  if (kind === 'b') return v === '1' ? 'TRUE' : 'FALSE'
  return v
}
function parseRows(text, shared, label) {
  if (!text) return []
  const doc = xml(text, label)
  const nodes = [...doc.getElementsByTagName('row')]
  if (nodes.length > 3000) failure(`${label} has too many rows (maximum 3000).`)
  const rows = nodes.map((row) => {
    const result = {}
    for (const cell of row.getElementsByTagName('c')) {
      const ref = cell.getAttribute('r') || ''
      const letters = ref.match(/^[A-Z]+/)?.[0]
      if (!letters) continue
      let column = 0
      for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64
      result[column - 1] = String(excelCell(cell, shared)).trim()
    }
    return result
  })
  if (!rows.length) return []
  const headers = Object.values(rows[0]).filter(Boolean)
  if (!headers.length) return []
  const names = rows[0]
  return rows.slice(1).filter((r) => Object.values(r).some((v) => v !== '')).map((r, i) => {
    const item = { __row: i + 2 }
    Object.keys(names).forEach((index) => { const key = names[index]; if (key) item[key] = r[index] ?? '' })
    return item
  })
}
function must(row, field, tab) { if (!row[field]) failure(`${tab} row ${row.__row}: ${field} is required.`) }
function number(value) {
  if (value === undefined || value === null || value === '') return ''
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : ''
}
function truthy(value, defaultValue = false) {
  if (value === '') return defaultValue
  return ['yes', 'true', '1', 'y'].includes(String(value).toLowerCase())
}
function rowList(rows, key, name) {
  const map = new Map()
  for (const row of rows) {
    must(row, 'listing_key', name)
    if (!map.has(row.listing_key)) map.set(row.listing_key, [])
    map.get(row.listing_key).push(row)
  }
  return map
}
function mediaUrl(value, tab, row, allowLocal = false) {
  const input = String(value || '').trim()
  if (!input) return ''
  if (allowLocal && !/^https:\/\//i.test(input)) {
    const path = input.replace(/^\.\//, '')
    const segments = path.split('/')
    if (path.length > 300 || /[\\\x00-\x1f?#:]/.test(path) || segments.some((part) => !part || part === '.' || part === '..') || !/\.(jpe?g|png|webp)$/i.test(path)) {
      failure(`${tab} row ${row}: use a safe .webp/.jpg/.png ZIP media path.`)
    }
    return path
  }
  let url
  try { url = new URL(input) } catch { failure(`${tab} row ${row}: image link is not a valid URL.`) }
  if (url.protocol !== 'https:' || url.username || url.password) failure(`${tab} row ${row}: image link must be public HTTPS.`)
  if (!['drive.google.com', 'www.drive.google.com', 'res.cloudinary.com'].includes(url.hostname)) failure(`${tab} row ${row}: use a public Google Drive file link or EPANTRY Cloudinary image.`)
  return url.href
}
// Extra optional worksheets are imported into the existing Listing Packet fields.
// Placeholder text from QA references is never treated as verified label evidence.
function extraText(value) {
  const input = String(value ?? '').trim()
  if (!input || /^\[.*\]$/.test(input) || /^(?:not supplied|not verified|not declared|n\/a)$/i.test(input)) return ''
  return input
}
function groceryFacet(value) {
  const raw = extraText(value).toLowerCase().replace(/&/g, 'and')
  const known = {
    'vegetables and greens':'vegetables','fruits':'fruits',
    'milk, dairy and cheese':'dairy','eggs':'eggs',
    'meat and poultry':'meat_poultry','fish and seafood':'seafood',
    'grains, rice and cereals':'grains_rice','pulses, beans and lentils':'pulses_legumes',
    'spices, sauces and condiments':'spices_condiments','cooking oil and ghee':'oils_ghee',
    'canned and jarred food':'canned_jarred','packaged snacks':'packaged_snacks',
    'other packaged food':'packaged_food','frozen food':'frozen_food',
    'beverages':'beverages','bread and bakery':'bakery_bread','other groceries':'other_grocery',
  }
  return known[raw] || (['vegetables','fruits','dairy','eggs','meat_poultry','seafood','grains_rice','pulses_legumes','spices_condiments','oils_ghee','canned_jarred','packaged_snacks','packaged_food','frozen_food','beverages','bakery_bread','other_grocery'].includes(raw)?raw:'')
}
function groceryPack(value) {
  const raw=extraText(value).toLowerCase().replace(/\s+/g,'_')
  return ({'loose_/_unpackaged':'loose','packet_/_pouch':'packet','can_/_tin':'can','box_/_carton':'box'}[raw]) ||
    (['loose','packet','can','jar','bottle','box','tray','other'].includes(raw)?raw:'')
}

function makePacket(row, categoryDefault, type, mapped, allowLocal = false) {
  const isRecipe = type !== 'grocery'
  const sellingAllowed = type === 'grocery' || type === 'prepared_food' || (type === 'kitchen_recipe' && truthy(row.sell_ready_made))
  const groceryMeta = mapped.groceryDetails.get(row.listing_key)?.[0] || {}
  const recipeMeta = mapped.recipeDetails.get(row.listing_key)?.[0] || {}
  const ingredients = (mapped.ingredients.get(row.listing_key) || []).map((i) => ({
    name: i.ingredient_name || '', quantity: number(i.quantity), unit: i.unit || 'g',
    unitPrice: number(i.pack_price_inr), priceQuantity: number(i.pack_quantity), priceUnit: i.pack_unit || 'g',
    imageUrl: mediaUrl(i.ingredient_image_url, 'Ingredients', i.__row, allowLocal), note: i.note || '',
  }))
  const steps = (mapped.steps.get(row.listing_key) || []).sort((a, b) => Number(a.step_number) - Number(b.step_number)).map((s) => ({
    instruction: s.instruction || '', timerMinutes: number(s.timer_minutes), imageUrl: mediaUrl(s.step_image_url, 'Steps', s.__row, allowLocal),
  }))
  const photos = (mapped.photos.get(row.listing_key) || []).sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)).map((p) => mediaUrl(p.photo_url, 'Photos', p.__row, allowLocal)).filter(Boolean)
  return {
    type, title: row.title || '', description: row.description || '', category: row.category || categoryDefault,
    grocerySubcategory: type === 'grocery' ? groceryFacet(groceryMeta.grocery_subcategory) : '',
    packagingType: type === 'grocery' ? groceryPack(groceryMeta.packaging_type) : '',
    countryOfOrigin: type === 'grocery' ? extraText(groceryMeta.country_of_origin) : extraText(recipeMeta.country),
    regionOfOrigin: type === 'grocery' ? extraText(groceryMeta.region_of_origin) : extraText(recipeMeta.region),
    productFamily: type === 'grocery' ? extraText(groceryMeta.product_family) : '',
    manufacturerPacker: type === 'grocery' ? extraText(groceryMeta.manufacturer_packer) : '',
    unitsPerPack: type === 'grocery' ? number(groceryMeta.units_per_pack) : '',
    servingSize: type === 'grocery' ? extraText(groceryMeta.serving_size) : '',
    labelDeclaration: {
      ingredients: type === 'grocery' ? extraText(groceryMeta.ingredients_printed_label) : '',
      allergens: type === 'grocery' ? extraText(groceryMeta.allergen_statement_printed_label) : '',
      claims: type === 'grocery' ? extraText(groceryMeta.claims_printed_label) : '',
    },
    localRecipeName: isRecipe ? extraText(recipeMeta.local_recipe_name) : '',
    localRecipeLanguage: isRecipe ? extraText(recipeMeta.language) : '',
    englishNameReading: isRecipe ? extraText(recipeMeta.pronunciation) : '',
    cuisine: isRecipe ? extraText(recipeMeta.cuisine) : '',
    preparationMinutes: isRecipe ? number(recipeMeta.prep_minutes) : '',
    cookingMinutes: isRecipe ? number(recipeMeta.cook_minutes) : '',
    difficulty: isRecipe ? ({ advanced:'hard', medium:'medium', easy:'easy', hard:'hard' }[String(recipeMeta.difficulty || '').trim().toLowerCase()] || 'not_declared') : 'not_declared',
    brandName: row.brand_name || '', sku: row.sku || '', images: photos, videoUrl: isRecipe ? (row.video_url || '') : '',
    baseServings: row.base_servings === '' ? (isRecipe ? 4 : '') : number(row.base_servings),
    shareRecipe: type === 'brand_recipe' || (type === 'kitchen_recipe' && truthy(row.share_recipe, true)) || (type === 'prepared_food' && truthy(row.share_recipe)),
    sellReadyMade: type === 'prepared_food' || (type === 'kitchen_recipe' && truthy(row.sell_ready_made)),
    ingredients: isRecipe ? ingredients : [], steps: isRecipe ? steps : [],
    nutrition: { basis: row.nutrition_basis || 'Per serving', energyKcal: number(row.energy_kcal), proteinG: number(row.protein_g), carbohydrateG: number(row.carbohydrate_g), fatG: number(row.fat_g), fiberG: number(row.fiber_g), sugarG: number(row.sugar_g), sodiumMg: number(row.sodium_mg), evidenceNote: row.nutrition_evidence_note || '' },
    allergens: (mapped.allergens.get(row.listing_key) || []).map((a) => ({ key: a.allergen || '', relationship: a.relationship || 'unknown' })),
    dietary: row.dietary || 'not_declared', sourceNotes: row.source_notes || '',
    selling: { listPrice: sellingAllowed ? number(row.list_price_inr) : '', salePrice: sellingAllowed ? number(row.sale_price_inr) : '', stockQuantity: sellingAllowed ? number(row.stock_quantity) : '', stockUnit: row.stock_unit || 'piece', packQuantity: number(row.pack_quantity), packUnit: row.pack_unit || 'piece', minimumOrderQuantity: row.minimum_order_quantity === '' ? 1 : number(row.minimum_order_quantity), maximumOrderQuantity: number(row.maximum_order_quantity), barcode: row.barcode || '', packagingCost: number(row.packaging_cost_inr), labourCost: number(row.labour_cost_inr), outletId: row.outlet_id || '', menuId: row.menu_id || '' },
    delivery: { fulfillment: row.fulfillment === 'pickup' ? 'pickup' : 'delivery', postalCodes: String(row.delivery_pincodes || '').split(/[;,\s]+/).filter(Boolean), preparationMinutes: number(row.preparation_minutes), note: row.delivery_note || '' },
  }
}

export async function parseHostBulkWorkbook(file, allowedTypes = [], options = {}) {
  if (!file || !/\.xlsx$/i.test(file.name || '')) failure('Select an EPANTRY .xlsx template file.')
  const entries = await readZip(await file.arrayBuffer())
  const book = xml(entries.get('xl/workbook.xml'), 'workbook.xml')
  const relationships = xml(entries.get('xl/_rels/workbook.xml.rels'), 'workbook relationships')
  const paths = new Map([...relationships.getElementsByTagName('Relationship')].map((node) => [node.getAttribute('Id'), node.getAttribute('Target')]))
  const shared = entries.has('xl/sharedStrings.xml') ? [...xml(entries.get('xl/sharedStrings.xml'), 'shared strings').getElementsByTagName('si')].map((node) => [...node.getElementsByTagName('t')].map((t) => t.textContent).join('')) : []
  const sheets = new Map()
  for (const sheet of book.getElementsByTagName('sheet')) {
    const key = sheet.getAttribute('r:id')
    const target = paths.get(key)
    if (!target) continue
    const path = target.startsWith('/') ? target.replace(/^\//, '') : `xl/${target.replace(/^\.\.\//, '')}`
    sheets.set(sheet.getAttribute('name'), parseRows(entries.get(path), shared, sheet.getAttribute('name')))
  }
  if (!sheets.has('Setup') || !sheets.has('Listings') || !sheets.has('Photos')) failure('Use the downloadable EPANTRY Excel template. Setup, Listings and Photos sheets are required.')
  // Setup is a 2-column configuration sheet with a special (non-header) structure.
  const setupPath = [...book.getElementsByTagName('sheet')].find((s) => s.getAttribute('name') === 'Setup')
  const setupTarget = paths.get(setupPath?.getAttribute('r:id'))
  const setupXML = setupTarget?.startsWith('/') ? setupTarget.replace(/^\//, '') : `xl/${setupTarget || ''}`
  const setupNodes = xml(entries.get(setupXML), 'Setup').getElementsByTagName('row')
  const config = Object.fromEntries([...setupNodes].map((r) => {
    const columns = [...r.getElementsByTagName('c')].map((c) => excelCell(c, shared))
    return [columns[0], columns[1]]
  }))
  const type = config.packet_type
  if (!TYPES.has(type) || String(config.format_version) !== '1') failure('Unknown or outdated EPANTRY Excel template.')
  if (!allowedTypes.includes(type)) failure('Your Host workspace does not have permission for this listing type.')
  const listings = sheets.get('Listings') || []
  if (!listings.length || listings.length > MAX_LISTINGS) failure('Fill 1 to 100 rows in the Listings sheet.')
  const linked = {
    photos: rowList(sheets.get('Photos') || [], 'photo_url', 'Photos'),
    ingredients: rowList(sheets.get('Ingredients') || [], 'ingredient_name', 'Ingredients'),
    steps: rowList(sheets.get('Steps') || [], 'instruction', 'Steps'),
    allergens: rowList(sheets.get('Allergens') || [], 'allergen', 'Allergens'),
    groceryDetails: rowList(sheets.get('Grocery Details') || [], 'listing_key', 'Grocery Details'),
    recipeDetails: rowList(sheets.get('Recipe Details') || [], 'listing_key', 'Recipe Details'),
  }
  const keys = new Set()
  for (const row of listings) {
    must(row, 'listing_key', 'Listings'); must(row, 'title', 'Listings')
    if (keys.has(row.listing_key)) failure(`Listings row ${row.__row}: duplicate listing_key ${row.listing_key}.`)
    keys.add(row.listing_key)
  }
  for (const [tab, mapping] of Object.entries(linked)) {
    for (const key of mapping.keys()) if (!keys.has(key)) failure(`${tab}: listing_key "${key}" is missing from Listings.`)
  }
  if (type === 'grocery' && (sheets.has('Ingredients') || sheets.has('Steps'))) failure('Grocery template must not contain Ingredients or Steps sheets.')
  if (type !== 'grocery' && (!sheets.has('Ingredients') || !sheets.has('Steps'))) failure('Recipe and ready-made templates require Ingredients and Steps sheets.')
  const issues = []
  const numericListingFields = ['base_servings', 'sale_price_inr', 'list_price_inr', 'stock_quantity', 'pack_quantity', 'minimum_order_quantity', 'maximum_order_quantity', 'packaging_cost_inr', 'labour_cost_inr', 'preparation_minutes', 'energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg']
  for (const row of listings) {
    for (const name of numericListingFields) {
      if (row[name] && number(row[name]) === '') failure(`Listings row ${row.__row}: ${name} must be a valid number, not ${row[name]}.`)
    }
  }
  for (const [name, list, keys] of [
    ['Ingredients', sheets.get('Ingredients') || [], ['quantity', 'pack_price_inr', 'pack_quantity']],
    ['Steps', sheets.get('Steps') || [], ['step_number', 'timer_minutes']],
    ['Photos', sheets.get('Photos') || [], ['display_order']],
  ]) {
    for (const row of list) for (const key of keys) {
      if (row[key] && number(row[key]) === '') failure(`${name} row ${row.__row}: ${key} must be a valid number.`)
    }
  }
  for (const row of listings) for (const field of ['share_recipe', 'sell_ready_made']) {
    const value = String(row[field] || '').trim().toLowerCase()
    if (value && !['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'].includes(value)) failure(`Listings row ${row.__row}: ${field} must be TRUE or FALSE.`)
  }
  const packets = listings.map((row) => {
    const count = (collection) => collection.get(row.listing_key)?.length || 0
    if (count(linked.photos) > 12) failure(`Listing ${row.listing_key} has more than 12 main photos.`)
    if (count(linked.ingredients) > 100) failure(`Listing ${row.listing_key} has more than 100 ingredients.`)
    if (count(linked.steps) > 75) failure(`Listing ${row.listing_key} has more than 75 steps.`)
    if (count(linked.allergens) > 20) failure(`Listing ${row.listing_key} has more than 20 allergen rows.`)
    const packet = makePacket(row, config.default_category || 'other', type, linked, options.allowLocalMediaPaths === true)
    if (!CATEGORIES.has(packet.category)) issues.push({ row: row.__row, key: row.listing_key, message: `Unknown category: ${packet.category}` })
    if (!packet.images.length) issues.push({ row: row.__row, key: row.listing_key, message: 'Add a main image in Photos before final submission.' })
    if (type !== 'grocery' && !packet.ingredients.length) issues.push({ row: row.__row, key: row.listing_key, message: 'Ingredients sheet has no rows for this recipe.' })
    if (type !== 'grocery' && !packet.steps.length) issues.push({ row: row.__row, key: row.listing_key, message: 'Steps sheet has no rows for this recipe.' })
    if (packet.delivery.fulfillment === 'delivery' && ((type === 'grocery') || (type === 'prepared_food') || packet.sellReadyMade) && !packet.delivery.postalCodes.length) issues.push({ row: row.__row, key: row.listing_key, message: 'Delivery listing needs Host-selected pincodes.' })
    return packet
  })
  const sources = new Set()
  for (const packet of packets) {
    for (const image of packet.images) sources.add(image)
    for (const ing of packet.ingredients) if (ing.imageUrl) sources.add(ing.imageUrl)
    for (const step of packet.steps) if (step.imageUrl) sources.add(step.imageUrl)
  }
  if (sources.size > MAX_REFS) failure(`This file contains ${sources.size} images; import a smaller batch (up to ${MAX_REFS} unique links).`)
  return { template: config.template_id || type, type, packets, issues, mediaCount: sources.size, listingKeys: listings.map((row) => row.listing_key) }
}

// Reuse successfully imported images within the current browser session. If
// the fifth image fails, retrying the Excel import does not reupload images 1-4.
// This cache never writes to the database or browser storage.
const completedWorkbookImages = new Map()
const MAX_IMPORTED_IMAGES_IN_MEMORY = 500
const RETRYABLE_CODES = new Set([
  'DRIVE_TIMEOUT', 'DRIVE_NETWORK_FAILED', 'DRIVE_TEMPORARY_ERROR',
  'CLOUDINARY_TIMEOUT', 'CLOUDINARY_NETWORK_FAILED',
])
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function isTransientImportError(cause) {
  const code = String(cause?.response?.data?.code || cause?.code || '')
  const message = String(cause?.response?.data?.message || cause?.message || '')
  if (RETRYABLE_CODES.has(code)) return true
  if (['DRIVE_NOT_PUBLIC', 'DRIVE_HTML_RESPONSE', 'IMAGE_FORMAT_UNSUPPORTED',
       'IMAGE_TOO_LARGE', 'IMAGE_URL_INVALID', 'CLOUDINARY_IMAGE_INVALID'].includes(code)) return false
  return /timeout|timed out|temporary|temporarily|rate.?limit|\b429\b|\b502\b|\b503\b|network|could not contact|unable to reach/i.test(message)
}

export async function ingestWorkbookImages(packets, importer, onProgress) {
  if (!Array.isArray(packets) || typeof importer !== 'function') {
    failure('Invalid Excel image-import request.')
  }
  // All images are uploaded before ANY draft-saving API call.
  const owners = new Map()
  function add(url, packet, role) {
    if (!url || owners.has(url)) return
    owners.set(url, {
      title: packet.title || 'Untitled listing',
      sku: packet.sku || '',
      role,
    })
  }
  for (const packet of packets) {
    ;(packet.images || []).forEach((url, i) => add(url, packet, `main photo ${i + 1}`))
    ;(packet.ingredients || []).forEach((item, i) => add(item.imageUrl, packet, `ingredient photo ${i + 1}`))
    ;(packet.steps || []).forEach((item, i) => add(item.imageUrl, packet, `step photo ${i + 1}`))
  }
  const urls = [...owners.keys()]
  if (urls.length > MAX_REFS) failure(`This workbook has too many unique images (maximum ${MAX_REFS}).`)
  const resolved = new Map()
  let completed = 0

  // Sequential imports prevent Google Drive from rate-limiting concurrent
  // downloads. Cloudinary failures can be retried without making drafts.
  for (const [index, url] of urls.entries()) {
    const cached = completedWorkbookImages.get(url)
    if (cached?.imageUrl) {
      resolved.set(url, cached.imageUrl)
      completed += 1
      onProgress?.(completed, urls.length)
      continue
    }
    let response
    let lastError
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await importer(url)
        if (!response?.imageUrl || !/^https:\/\//i.test(response.imageUrl)) {
          throw new Error('The image service did not return an EPANTRY image URL.')
        }
        break
      } catch (cause) {
        lastError = cause
        if (attempt === 2 || !isTransientImportError(cause)) break
        await delay(450)
      }
    }
    if (!response?.imageUrl) {
      const context = owners.get(url)
      const identity = `"${context?.title || 'Untitled listing'}"`
      const message = lastError?.message || 'Google Drive/Cloudinary image import failed.'
      const error = new Error(`Excel photo ${index + 1} of ${urls.length} for ${identity} (${context?.role || 'photo'}): ${message} No draft-save request was sent.`)
      error.code = 'BULK_IMAGE_IMPORT_FAILED'
      throw error
    }
    resolved.set(url, response.imageUrl)
    // Bound cache growth; an entire successful import remains available for retry.
    if (completedWorkbookImages.size >= MAX_IMPORTED_IMAGES_IN_MEMORY) {
      completedWorkbookImages.delete(completedWorkbookImages.keys().next().value)
    }
    completedWorkbookImages.set(url, { imageUrl: response.imageUrl })
    completed += 1
    onProgress?.(completed, urls.length)
  }

  return packets.map((packet) => ({
    ...packet,
    images: (packet.images || []).map((url) => resolved.get(url)),
    ingredients: (packet.ingredients || []).map((item) => ({
      ...item, imageUrl: item.imageUrl ? resolved.get(item.imageUrl) : '',
    })),
    steps: (packet.steps || []).map((item) => ({
      ...item, imageUrl: item.imageUrl ? resolved.get(item.imageUrl) : '',
    })),
  }))
}
