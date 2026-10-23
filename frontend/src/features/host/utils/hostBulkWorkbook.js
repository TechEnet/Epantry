// Browser-only, dependency-free reader for EPANTRY .xlsx templates.
// It reads values from the fixed named worksheets; formulas/macros are never executed.
const MAX_FILE_BYTES = 3 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024
const MAX_LISTINGS = 25
const TYPES = new Set(['grocery', 'brand_recipe', 'kitchen_recipe', 'prepared_food'])
const CATEGORIES = new Set(['grocery', 'breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'sweets', 'desserts', 'bakery', 'main_course', 'side_dish', 'other'])
const MAX_REFS = 120

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
function mediaUrl(value, tab, row) {
  const input = String(value || '').trim()
  if (!input) return ''
  let url
  try { url = new URL(input) } catch { failure(`${tab} row ${row}: image link is not a valid URL.`) }
  if (url.protocol !== 'https:' || url.username || url.password) failure(`${tab} row ${row}: image link must be public HTTPS.`)
  if (!['drive.google.com', 'www.drive.google.com', 'res.cloudinary.com'].includes(url.hostname)) failure(`${tab} row ${row}: use a public Google Drive file link or EPANTRY Cloudinary image.`)
  return url.href
}
function makePacket(row, categoryDefault, type, mapped) {
  const isRecipe = type !== 'grocery'
  const sellingAllowed = type === 'grocery' || type === 'prepared_food' || (type === 'kitchen_recipe' && truthy(row.sell_ready_made))
  const ingredients = (mapped.ingredients.get(row.listing_key) || []).map((i) => ({
    name: i.ingredient_name || '', quantity: number(i.quantity), unit: i.unit || 'g',
    unitPrice: number(i.pack_price_inr), priceQuantity: number(i.pack_quantity), priceUnit: i.pack_unit || 'g',
    imageUrl: mediaUrl(i.ingredient_image_url, 'Ingredients', i.__row), note: i.note || '',
  }))
  const steps = (mapped.steps.get(row.listing_key) || []).sort((a, b) => Number(a.step_number) - Number(b.step_number)).map((s) => ({
    instruction: s.instruction || '', timerMinutes: number(s.timer_minutes), imageUrl: mediaUrl(s.step_image_url, 'Steps', s.__row),
  }))
  const photos = (mapped.photos.get(row.listing_key) || []).sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)).map((p) => mediaUrl(p.photo_url, 'Photos', p.__row)).filter(Boolean)
  return {
    type, title: row.title || '', description: row.description || '', category: row.category || categoryDefault,
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

export async function parseHostBulkWorkbook(file, allowedTypes = []) {
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
  if (!listings.length || listings.length > MAX_LISTINGS) failure('Fill 1 to 25 rows in the Listings sheet.')
  const linked = {
    photos: rowList(sheets.get('Photos') || [], 'photo_url', 'Photos'),
    ingredients: rowList(sheets.get('Ingredients') || [], 'ingredient_name', 'Ingredients'),
    steps: rowList(sheets.get('Steps') || [], 'instruction', 'Steps'),
    allergens: rowList(sheets.get('Allergens') || [], 'allergen', 'Allergens'),
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
    const packet = makePacket(row, config.default_category || 'other', type, linked)
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
  return { template: config.template_id || type, type, packets, issues, mediaCount: sources.size }
}

export async function ingestWorkbookImages(packets, importer, onProgress) {
  const images = new Set()
  for (const packet of packets) {
    packet.images.forEach((url) => images.add(url))
    packet.ingredients.forEach((i) => { if (i.imageUrl) images.add(i.imageUrl) })
    packet.steps.forEach((s) => { if (s.imageUrl) images.add(s.imageUrl) })
  }
  const map = new Map()
  const urls = [...images]
  let next = 0
  let completed = 0
  let error = null
  // Import up to three files concurrently, without flooding Cloudinary or freezing the UI.
  async function worker() {
    while (!error) {
      const index = next++
      if (index >= urls.length) return
      try {
        const reply = await importer(urls[index])
        if (!reply?.imageUrl) failure('This image is not public or is not a supported image file.')
        map.set(urls[index], reply.imageUrl)
        completed++
        onProgress?.(completed, urls.length)
      } catch (cause) {
        error = new Error(`Image ${index + 1} (${urls[index]}): ${cause?.message || 'Import failed'}`)
        return
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, () => worker()))
  if (error) throw error
  return packets.map((packet) => ({
    ...packet,
    images: packet.images.map((url) => map.get(url)),
    ingredients: packet.ingredients.map((row) => ({ ...row, imageUrl: row.imageUrl ? map.get(row.imageUrl) : '' })),
    steps: packet.steps.map((row) => ({ ...row, imageUrl: row.imageUrl ? map.get(row.imageUrl) : '' })),
  }))
}
