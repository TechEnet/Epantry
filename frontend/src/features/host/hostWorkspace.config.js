export const HOST_WORKSPACE_TYPES = Object.freeze({
  B2B: 'b2b',
  BRAND_SELLER: 'brand_seller',
  HYBRID: 'hybrid',
  CHEF_RESTAURANT: 'chef_restaurant',
  LEGACY: 'legacy',
})

const KNOWN_HOST_WORKSPACE_TYPES = new Set([
  HOST_WORKSPACE_TYPES.B2B,
  HOST_WORKSPACE_TYPES.BRAND_SELLER,
  HOST_WORKSPACE_TYPES.HYBRID,
  HOST_WORKSPACE_TYPES.CHEF_RESTAURANT,
])

const COMMON_HOST_PATHS = Object.freeze([
  '/host/operations',
  '/host/operations-center',
  '/host/business-profile',
  '/host/profile',
  '/host/settings',
  '/account/security/mfa',
])

const COMMERCE_HOST_PATHS = Object.freeze([
  '/host/catalog',
  '/host/scan',
  '/host/product-intelligence',
  '/host/data-quality',
  '/host/listing-history',
  '/host/marketplace',
  '/host/orders',
  '/host/fulfillment',
  '/host/earnings',
  '/host/finance',
  '/host/analytics',
])

const BRAND_HOST_PATHS = Object.freeze([
  '/host/brands',
  '/host/brand-recipes',
  '/host/campaigns',
])

const CHEF_RESTAURANT_PATHS = Object.freeze([
  '/host/hospitality',
  '/host/creator-studio',
])

const ROUTE_PREFIXES_BY_WORKSPACE = Object.freeze({
  [HOST_WORKSPACE_TYPES.B2B]: [
    ...COMMON_HOST_PATHS,
    ...COMMERCE_HOST_PATHS,
  ],

  [HOST_WORKSPACE_TYPES.BRAND_SELLER]: [
    ...COMMON_HOST_PATHS,
    ...COMMERCE_HOST_PATHS,
    ...BRAND_HOST_PATHS,
  ],

  [HOST_WORKSPACE_TYPES.HYBRID]: [
    ...COMMON_HOST_PATHS,
    ...COMMERCE_HOST_PATHS,
    ...BRAND_HOST_PATHS,
  ],

  [HOST_WORKSPACE_TYPES.CHEF_RESTAURANT]: [
    ...COMMON_HOST_PATHS,
    ...CHEF_RESTAURANT_PATHS,
  ],
})

export function normalizeHostWorkspaceType(value) {
  const raw =
    typeof value === 'object' && value !== null
      ? value.hostWorkspaceType
      : value

  const normalized = String(raw || '')
    .trim()
    .toLowerCase()

  return KNOWN_HOST_WORKSPACE_TYPES.has(normalized)
    ? normalized
    : HOST_WORKSPACE_TYPES.LEGACY
}

export function getHostWorkspaceLabel(value) {
  switch (normalizeHostWorkspaceType(value)) {
    case HOST_WORKSPACE_TYPES.B2B:
      return 'B2B'

    case HOST_WORKSPACE_TYPES.BRAND_SELLER:
      return 'Brand / Seller'

    case HOST_WORKSPACE_TYPES.HYBRID:
      return 'Hybrid'

    case HOST_WORKSPACE_TYPES.CHEF_RESTAURANT:
      return 'Chef + Restaurant'

    default:
      return 'Legacy Host'
  }
}

function pathMatchesPrefix(pathname, prefix) {
  if (pathname === prefix) {
    return true
  }

  return pathname.startsWith(`${prefix}/`)
}

export function isHostPathAllowed(pathname, workspaceType) {
  const normalizedPath = String(pathname || '').trim()
  const normalizedWorkspace = normalizeHostWorkspaceType(workspaceType)

  if (!normalizedPath) {
    return false
  }

  /*
  |--------------------------------------------------------------------------
  | Legacy compatibility
  |--------------------------------------------------------------------------
  |
  | Existing approved Hosts created before M1 do not have hostWorkspaceType.
  | They keep the pre-M1 Host route set so no existing workspace/data vanishes.
  | A later governed migration can assign those users a locked workspace type.
  */
  if (normalizedWorkspace === HOST_WORKSPACE_TYPES.LEGACY) {
    const isNewCreatorWorkspace =
      normalizedPath === '/host/creator-studio' ||
      normalizedPath.startsWith('/host/creator-studio/')

    if (isNewCreatorWorkspace) {
      return false
    }

    return (
      normalizedPath.startsWith('/host/') ||
      normalizedPath === '/host' ||
      normalizedPath === '/account/security/mfa'
    )
  }

  const allowedPrefixes =
    ROUTE_PREFIXES_BY_WORKSPACE[normalizedWorkspace] || []

  return allowedPrefixes.some((prefix) =>
    pathMatchesPrefix(normalizedPath, prefix),
  )
}

export function isChefRestaurantWorkspace(value) {
  return (
    normalizeHostWorkspaceType(value) ===
    HOST_WORKSPACE_TYPES.CHEF_RESTAURANT
  )
}
