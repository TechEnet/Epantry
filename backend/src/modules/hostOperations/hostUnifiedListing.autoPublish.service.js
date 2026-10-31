import { ApiError } from '../../utils/ApiError.js'
import { Brand, Category, ProductFamily, ProductVariant, Pack, ProductVersion } from '../catalog/catalog.models.js'
import { MarketplaceOrganization, HostOffer, PriceRule, InventoryNode, InventorySnapshot, ServiceArea } from '../marketplace/marketplace.models.js'
import { HospitalityOutlet } from '../hospitality/hospitality.models.js'
import { User } from '../users/user.model.js'

// Called ONLY inside the Super Admin's existing approval transaction.
// Never called from Host writes or from the public checkout path.
const purchasableTypes = new Set(['prepared_food', 'kitchen_recipe', 'grocery'])
export function needsCommercialPublication(packet) {
  return packet?.type === 'grocery' || packet?.type === 'prepared_food' ||
    (packet?.type === 'kitchen_recipe' && packet?.sellReadyMade === true)
}
const reject = (message) => { throw new ApiError(409, message) }
const asId = (value) => String(value || '')
const moneyMinor = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 && number <= 10_000_000 &&
    Number.isSafeInteger(Math.round(number * 100)) ? Math.round(number * 100) : null
}
const packValue = (packet) => {
  const unit = packet.selling?.packUnit || 'piece'
  const valid = ['g', 'kg', 'ml', 'l', 'piece', 'dozen'].includes(unit)
  const raw = Number(packet.selling?.packQuantity)
  // A complete ready-made dish is sold as one prepared pack when the Host
  // has not specified its physical size; never infer grams/ml from servings.
  const value = Number.isFinite(raw) && raw > 0 ? raw :
    packet.type === 'grocery' ? null : 1
  if (!valid || value === null) reject('Add a valid pack size before submitting for one-step approval.')
  return { value, unit }
}
async function inserted(Model, fields, session) {
  const [entry] = await Model.create([fields], { session })
  return entry
}
function ensureExistingActive(entry, label) {
  if (!entry || entry.status !== 'active') reject(`${label} is not active; Super Admin cannot enable selling.`)
  return entry
}

// Establish a private, listing-owned catalog hierarchy. The Host's business is
// the seller identity; do not claim that it owns any third-party product brand.
async function catalogForApprovedPacket({ listing, packet, organization, reviewerId, now, session }) {
  const existingId = String(listing.publishedPacket?.catalogProductVersionId || packet.catalogProductVersionId || '')
  let existing = /^[a-f\d]{24}$/i.test(existingId)
    ? await ProductVersion.findById(existingId).session(session) : null
  if (existing && existing.publicationStatus !== 'published') {
    reject('The previously linked catalog product is no longer published. Review its identity before approval.')
  }
  const familySlug = `epantry-listing-${asId(listing._id)}`
  let family = await ProductFamily.findOne({ slug: familySlug }).session(session)
  if (existing && !family) {
    // A manually linked published product stays canonical. Never modify shared
    // brand/product truth as a side effect of approving this Host's offer.
    return { version: existing, packId: existing.packId, managed: false }
  }
  const owner = listing.ownerUserId
  if (!family) {
    const brandSlug = `epantry-host-${asId(owner)}`
    let brand = await Brand.findOne({ slug: brandSlug }).session(session)
    if (!brand) brand = await inserted(Brand, {
      name: `Host kitchen ${asId(owner).slice(-6)}`, slug: brandSlug,
      status: 'active', createdByUserId: reviewerId,
    }, session)
    ensureExistingActive(brand, 'Host catalog identity')
    const categorySlug = packet.type === 'grocery' ? 'epantry-host-grocery' : 'epantry-ready-made-food'
    let category = await Category.findOne({ slug: categorySlug }).session(session)
    if (!category) category = await inserted(Category, {
      name: packet.type === 'grocery' ? 'Host Grocery' : 'Ready-made Food',
      slug: categorySlug, status: 'active', createdByUserId: reviewerId,
    }, session)
    ensureExistingActive(category, 'Food category')
    family = await inserted(ProductFamily, {
      brandId: brand._id, categoryId: category._id,
      canonicalName: packet.title, slug: familySlug, description: packet.description || '',
      status: 'active', createdByUserId: reviewerId,
    }, session)
  }
  ensureExistingActive(family, 'Listing catalog family')
  let variant = await ProductVariant.findOne({ familyId: family._id, variantKey: 'approved-host-listing' }).session(session)
  if (!variant) variant = await inserted(ProductVariant, {
    familyId: family._id, canonicalName: packet.title,
    variantKey: 'approved-host-listing', market: 'IN', status: 'active',
    createdByUserId: reviewerId,
  }, session)
  ensureExistingActive(variant, 'Listing variant')
  let pack = await Pack.findOne({ variantId: variant._id, packKey: 'single-prepared-pack' }).session(session)
  if (!pack) pack = await inserted(Pack, {
    variantId: variant._id, displayName: packet.title,
    packKey: 'single-prepared-pack', packType: 'other',
    status: 'active', createdByUserId: reviewerId,
  }, session)
  ensureExistingActive(pack, 'Listing pack')
  // Never change old published identity data silently: version it on review.
  const current = await ProductVersion.findOne({ packId: pack._id, publicationStatus: 'published' })
    .sort({ version: -1 }).session(session)
  const latest = await ProductVersion.findOne({ packId: pack._id }).sort({ version: -1 }).session(session)
  if (latest && latest.publicationStatus !== 'published') {
    reject('A catalog revision is already pending for this listing. Resolve it before approval.')
  }
  if (current) await ProductVersion.updateOne({ _id: current._id },
    { $set: { publicationStatus: 'retired', effectiveTo: now, retiredAt: now,
      retiredByUserId: reviewerId, retireReason: 'Replaced by the approved Unified Listing revision.' } }, { session })
  const ingredients = (packet.ingredients || []).slice(0, 100)
    .filter((line) => line.name).map((line, index) => ({ displayName: line.name, order: index }))
  const version = await inserted(ProductVersion, {
    variantId: variant._id, packId: pack._id,
    version: (latest?.version || 0) + 1,
    displayName: packet.title, gtin: packet.type === 'grocery' ? (packet.selling?.barcode || null) : null,
    netQuantity: packValue(packet), ingredients,
    ingredientDeclarationText: ingredients.map((item) => item.displayName).join(', '),
    images: (packet.images || []).slice(0, 12).map((url, index) => ({ url, alt: packet.title, sortOrder: index })),
    countryOfOrigin: packet.countryOfOrigin || '',
    manufacturerName: packet.type === 'grocery' ? (packet.manufacturerPacker || '') : '',
    provenance: [{ fieldPath: 'displayName', evidenceState: 'operator_declared',
      extractionMethod: 'manual', confidence: null, reviewedByUserId: reviewerId, reviewedAt: now }],
    publicationStatus: 'published', effectiveFrom: now, publishedAt: now,
    publishedByUserId: reviewerId, createdByUserId: reviewerId,
    supersedesVersionId: current?._id || null,
    changeReason: `Super Admin approved Unified Host Listing ${asId(listing._id)}`,
  }, session)
  return { version, packId: pack._id, managed: true }
}

// Price, stock and PIN coverage are scoped to this ONE listing, rather than
// reusing an outlet-wide node whose service areas could leak to other offers.
async function activateApprovedOffer({ listing, packet, organization, packId, reviewerId, now, session }) {
  const sale = moneyMinor(packet.selling?.salePrice)
  const list = moneyMinor(packet.selling?.listPrice ?? packet.selling?.salePrice)
  const stock = Number(packet.selling?.stockQuantity)
  if (!sale || !list || sale > list) reject('Enter a valid selling price and list price before approval.')
  if (!Number.isSafeInteger(stock) || stock < 1) reject('Add at least one item in stock before approval can enable customer purchasing.')
  const minOrder = Number(packet.selling?.minimumOrderQuantity) || 1
  const maxOrder = packet.selling?.maximumOrderQuantity == null ? null : Number(packet.selling.maximumOrderQuantity)
  if (!Number.isSafeInteger(minOrder) || minOrder < 1 || minOrder > stock ||
      (maxOrder !== null && (!Number.isSafeInteger(maxOrder) || maxOrder < minOrder))) {
    reject('Minimum and maximum order quantities must be whole numbers within the available stock.')
  }
  const mode = packet.delivery?.fulfillment === 'pickup' ? 'pickup' : 'delivery'
  const pins = [...new Set((packet.delivery?.postalCodes || []).map(v => String(v).trim()))]
  if (mode === 'delivery' && (!pins.length || pins.some(v => !/^[1-9][0-9]{5}$/.test(v)))) {
    reject('Add valid delivery PIN codes before approving an online selling listing.')
  }
  // All restaurant/kitchen listings must reference an active owned outlet.
  let outlet = null
  if (packet.type !== 'grocery') {
    const outletId = asId(packet.selling?.outletId)
    if (!/^[a-f\d]{24}$/i.test(outletId)) reject('Choose an existing kitchen outlet for this Ready-made Food.')
    outlet = await HospitalityOutlet.findOne({ _id: outletId,
      organizationId: organization._id, status: 'active' }).session(session)
    if (!outlet) reject('The selected kitchen outlet is not active or does not belong to this Host.')
  }
  let offer = await HostOffer.findOne({ organizationId: organization._id,
    packId, status: { $in: ['draft', 'active', 'paused'] } }).session(session)
  if (offer && offer.merchantSku !== `epantry-${asId(listing._id)}`) {
    reject('This Pack already has another Host offer. Use its approved identity or resolve the duplicate before review.')
  }
  if (!offer) offer = await inserted(HostOffer, {
    organizationId: organization._id, packId,
    merchantSku: `epantry-${asId(listing._id)}`,
    fulfillmentTypes: [mode], status: 'active',
    minimumOrderQuantity: minOrder,
    maximumOrderQuantity: maxOrder,
    createdByUserId: reviewerId, updatedByUserId: reviewerId,
  }, session)
  else {
    offer.status = 'active'
    offer.fulfillmentTypes = [mode]
    offer.minimumOrderQuantity = minOrder
    offer.maximumOrderQuantity = maxOrder
    offer.updatedByUserId = reviewerId
    await offer.save({ session })
  }
  // The previous effective rule is history, not a parallel conflicting price.
  await PriceRule.updateMany({ offerId: offer._id, effectiveTo: null },
    { $set: { effectiveTo: now, status: 'expired' } }, { session })
  await inserted(PriceRule, {
    organizationId: organization._id, offerId: offer._id,
    listPrice: { amountMinor: list, currency: 'INR' },
    salePrice: { amountMinor: sale, currency: 'INR' },
    status: 'active', effectiveFrom: now, source: 'unified_listing_super_admin_approval',
    changeReason: `Approved listing ${asId(listing._id)}: exact Host submitted pack price`,
    createdByUserId: reviewerId,
  }, session)
  const nodeKey = `listing-${asId(listing._id)}`
  let node = await InventoryNode.findOne({ organizationId: organization._id, nodeKey }).session(session)
  if (!node) node = await inserted(InventoryNode, {
    organizationId: organization._id, nodeKey,
    name: (outlet?.name ? `${outlet.name} - ${packet.title}` : `Host stock - ${packet.title}`).slice(0, 220),
    nodeType: outlet ? 'store' : 'other', status: 'active',
    address: outlet?.address || {},
    createdByUserId: reviewerId, updatedByUserId: reviewerId,
  }, session)
  else {
    node.status = 'active'
    if (outlet) node.address = outlet.address
    node.updatedByUserId = reviewerId
    await node.save({ session })
  }
  const previousStock = await InventorySnapshot.findOne({ offerId: offer._id,
    inventoryNodeId: node._id }).sort({ observedAt: -1, _id: -1 }).session(session)
  const reserved = Number(previousStock?.reservedQuantity || 0)
  if (stock < reserved) reject('Stock is below quantities already reserved by customers. Correct stock before approving.')
  await inserted(InventorySnapshot, {
    organizationId: organization._id, offerId: offer._id, inventoryNodeId: node._id,
    availableQuantity: stock, reservedQuantity: reserved,
    sourceType: 'manual', sourceReference: `approved-host-listing-${asId(listing._id)}`,
    observedAt: now, createdByUserId: reviewerId,
  }, session)
  const areaKey = `listing-${asId(listing._id)}`
  let area = await ServiceArea.findOne({ organizationId: organization._id, serviceAreaKey: areaKey }).session(session)
  if (!area) area = await inserted(ServiceArea, {
    organizationId: organization._id, inventoryNodeId: node._id,
    name: `Delivery - ${packet.title}`.slice(0, 220), serviceAreaKey: areaKey,
    postalCodes: pins, fulfillmentTypes: [mode], status: 'active',
    createdByUserId: reviewerId, updatedByUserId: reviewerId,
  }, session)
  else {
    area.inventoryNodeId = node._id
    area.postalCodes = pins
    area.fulfillmentTypes = [mode]
    area.status = 'active'
    area.updatedByUserId = reviewerId
    await area.save({ session })
  }
  return { offerId: offer._id }
}

export async function publishApprovedListingForSale({ listing, packet, reviewerId, now, session }) {
  if (!needsCommercialPublication(packet)) return { packet, offerId: null }
  if (!purchasableTypes.has(packet.type)) reject('This listing type cannot be sold as a finished pack.')
  const host = await User.findOne({ _id: listing.ownerUserId, hostEnabled: true,
    hostAccessStatus: 'active', accountStatus: 'active' }).session(session)
  if (!host) reject('The Host account is not active. Selling cannot be approved for a suspended Host.')
  let organization = await MarketplaceOrganization.findOne({ ownerUserId: listing.ownerUserId }).session(session)
  if (organization && organization.status !== 'active') {
    reject('The Host business is suspended or inactive. It must be restored before approval.')
  }
  // No additional Host onboarding screen: an active Host's Marketplace identity
  // can be established from its already-approved Host account in this review.
  if (!organization) organization = await inserted(MarketplaceOrganization, {
    ownerUserId: listing.ownerUserId, displayName: host.name,
    slug: `host-${asId(listing.ownerUserId)}`, organizationType: 'hybrid',
    status: 'active', createdByUserId: reviewerId, updatedByUserId: reviewerId,
  }, session)
  const catalog = await catalogForApprovedPacket({ listing, packet, organization, reviewerId, now, session })
  const result = await activateApprovedOffer({ listing, packet, organization,
    packId: catalog.packId, reviewerId, now, session })
  return { packet: { ...packet, selling: { ...packet.selling,
      packQuantity: packValue(packet).value, packUnit: packValue(packet).unit },
      catalogProductVersionId: asId(catalog.version._id) },
    offerId: result.offerId, packId: catalog.packId }
}
