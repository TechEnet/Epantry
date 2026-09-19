export const BRAND_CLAIM_TYPES =
  Object.freeze([
    'owner',
    'licensee',
    'distributor',
  ])

export const BRAND_CLAIM_STATUSES =
  Object.freeze([
    'pending_review',
    'verified',
    'rejected',
    'conflict',
    'suspended',
    'revoked',
    'expired',
  ])

export const BRAND_AUTHORITY_STATUSES =
  Object.freeze([
    'active',
    'suspended',
    'revoked',
    'expired',
  ])

export const BRAND_AUTHORITY_SCOPES =
  Object.freeze([
    'official_content',
    'regulated_facts',
    'claims_certifications',
    'packaging_media',
    'brand_recipes',
  ])

export const BRAND_IDENTITY_CHECK_TYPES =
  Object.freeze([
    'trademark',
    'corporate_domain',
    'authorization_letter',
    'gs1_company_identity',
    'manufacturer_document',
    'packaging_label',
    'other',
  ])

export const BRAND_IDENTITY_CHECK_STATUSES =
  Object.freeze([
    'pending',
    'verified',
    'rejected',
    'conflict',
    'expired',
  ])

export const BRAND_OVERRIDE_STATUSES =
  Object.freeze([
    'draft',
    'submitted',
    'in_review',
    'approved',
    'rejected',
    'conflict',
    'activated',
    'withdrawn',
  ])

export const BRAND_OVERRIDE_FIELD_KEYS =
  Object.freeze([
    'display_name',
    'description',
    'pack_images',
    'ingredient_declaration',
    'allergens',
    'nutrition',
    'dietary_flags',
    'certifications',
    'claims',
    'manufacturer',
    'importer',
    'country_of_origin',
    'net_quantity',
    'preparation_instructions',
    'storage_instructions',
    'category_attributes',
    'packaging',
  ])

export const BRAND_OVERRIDE_CRITICAL_FIELD_KEYS =
  Object.freeze([
    'ingredient_declaration',
    'allergens',
    'nutrition',
    'dietary_flags',
    'certifications',
    'claims',
    'net_quantity',
  ])

export const BRAND_CONFLICT_STATUSES =
  Object.freeze([
    'open',
    'in_review',
    'resolved',
    'quarantined',
  ])

export const BRAND_CONFLICT_SEVERITIES =
  Object.freeze([
    'standard',
    'regulated',
    'safety_critical',
  ])

export function normalizeBrandAuthorityKey(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '_',
    )
    .replace(
      /^_+|_+$/g,
      '',
    )
}

export function normalizeBrandMarketCode(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .toUpperCase()
}

export function isValidBrandMarketCode(
  value,
) {
  return /^[A-Z]{2}$/.test(
    normalizeBrandMarketCode(
      value,
    ),
  )
}