import {
  apiClient,
} from '../../../api/apiClient'

const ORGANIZATION_STORAGE_KEY =
  'epantry_hospitality_organization_id'

function unwrap(
  response,
) {
  if (
    response?.data &&
    typeof response.data ===
      'object' &&
    Object.prototype.hasOwnProperty.call(
      response.data,
      'success',
    )
  ) {
    return response.data.data
  }

  return (
    response?.data ??
    response
  )
}

export function getHospitalityErrorMessage(
  error,
  fallback = 'Unable to complete this Hospitality operation.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

export function getSelectedHospitalityOrganizationId() {
  return window.localStorage.getItem(
    ORGANIZATION_STORAGE_KEY,
  ) || ''
}

export function setSelectedHospitalityOrganizationId(
  organizationId,
) {
  const value =
    String(
      organizationId ||
      '',
    ).trim()

  if (!value) {
    window.localStorage.removeItem(
      ORGANIZATION_STORAGE_KEY,
    )

    return
  }

  window.localStorage.setItem(
    ORGANIZATION_STORAGE_KEY,
    value,
  )
}

function organizationHeaders() {
  const organizationId =
    getSelectedHospitalityOrganizationId()

  return organizationId
    ? {
        'x-epantry-organization-id':
          organizationId,
      }
    : {}
}

async function csrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrap(
      response,
    )

  if (!data?.csrfToken) {
    throw new Error(
      'Unable to establish CSRF protection for this Hospitality action.',
    )
  }

  return data.csrfToken
}

async function get(
  url,
  config = {},
) {
  return unwrap(
    await apiClient.get(
      url,
      {
        ...config,
        headers: {
          ...organizationHeaders(),
          ...(config.headers || {}),
        },
      },
    ),
  )
}

async function mutate({
  method = 'post',
  url,
  data = {},
}) {
  const csrf =
    await csrfToken()

  return unwrap(
    await apiClient.request({
      method,
      url,
      data,
      headers: {
        ...organizationHeaders(),
        'x-csrf-token':
          csrf,
      },
    }),
  )
}

export const getHospitalityContext = () =>
  get(
    '/host/hospitality/context',
  )

export const initializeHospitalityProfile = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/profile/initialize',
    data:
      input,
  })

export const listHospitalityOutlets = () =>
  get(
    '/host/hospitality/outlets',
  )

export const createHospitalityOutlet = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/outlets',
    data:
      input,
  })

export const listHospitalityMemberGrants = () =>
  get(
    '/host/hospitality/member-grants',
  )

export const upsertHospitalityMemberGrant = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/member-grants',
    data:
      input,
  })

export const listHospitalitySuppliers = () =>
  get(
    '/host/hospitality/suppliers',
  )

export const createHospitalitySupplier = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/suppliers',
    data:
      input,
  })

export const listHospitalitySupplierProducts = () =>
  get(
    '/host/hospitality/supplier-products',
  )

export const createHospitalitySupplierProduct = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/supplier-products',
    data:
      input,
  })

export const listHospitalityProductionRecipes = () =>
  get(
    '/host/hospitality/production-recipes',
  )

export const createHospitalityProductionRecipe = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/production-recipes',
    data:
      input,
  })

export const submitHospitalityProductionRecipe = (
  id,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/production-recipes/${encodeURIComponent(String(id))}/submit`,
    data:
      input,
  })

export const approveHospitalityProductionRecipe = (
  id,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/production-recipes/${encodeURIComponent(String(id))}/approve`,
    data:
      input,
  })

export const listHospitalityMenus = () =>
  get(
    '/host/hospitality/menus',
  )

export const createHospitalityMenu = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/menus',
    data:
      input,
  })

export const addHospitalityMenuItem = (
  menuId,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/menus/${encodeURIComponent(String(menuId))}/items`,
    data:
      input,
  })

export const calculateHospitalityRecipeCost = (
  recipeId,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/costing/production-recipes/${encodeURIComponent(String(recipeId))}/calculate`,
    data:
      input,
  })

export const createHospitalityStockObservation = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/stock-observations',
    data:
      input,
  })

export const listHospitalityProductionPlans = () =>
  get(
    '/host/hospitality/production-plans',
  )

export const createHospitalityProductionPlan = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/production-plans',
    data:
      input,
  })

export const createHospitalityProcurementPlan = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/procurement-plans',
    data:
      input,
  })

export const listDishPassportSnapshots = () =>
  get(
    '/host/hospitality/dish-passports',
  )

export const generateDishPassportSnapshot = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/dish-passports/generate',
    data:
      input,
  })

export const approveDishPassportSnapshot = (
  id,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/dish-passports/${encodeURIComponent(String(id))}/approve`,
    data:
      input,
  })

export const publishDishPassportSnapshot = (
  id,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/dish-passports/${encodeURIComponent(String(id))}/publish`,
    data:
      input,
  })

export async function getPublicDishPassport(
  publicId,
) {
  return unwrap(
    await apiClient.get(
      `/dish-passports/${encodeURIComponent(String(publicId))}`,
    ),
  )
}

export const listGreyBookSnapshots = () =>
  get(
    '/host/hospitality/grey-books',
  )

export const generateGreyBookSnapshot = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/grey-books/generate',
    data:
      input,
  })

export function greyBookExportUrl(
  id,
  format = 'csv',
) {
  return `/api/v1/host/hospitality/grey-books/${encodeURIComponent(String(id))}/export?format=${encodeURIComponent(format)}`
}

export const listHospitalityChangeCases = () =>
  get(
    '/host/hospitality/change-cases',
  )

export const detectHospitalityChangeImpact = (
  input,
) =>
  mutate({
    url:
      '/host/hospitality/change-cases/detect',
    data:
      input,
  })

export const recalculateHospitalityChangeCase = (
  id,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/change-cases/${encodeURIComponent(String(id))}/recalculate`,
    data:
      input,
  })

export const decideHospitalityChangeCase = (
  id,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/change-cases/${encodeURIComponent(String(id))}/decision`,
    data:
      input,
  })

export const publishHospitalityChangeCase = (
  id,
  input,
) =>
  mutate({
    url:
      `/host/hospitality/change-cases/${encodeURIComponent(String(id))}/publish`,
    data:
      input,
  })