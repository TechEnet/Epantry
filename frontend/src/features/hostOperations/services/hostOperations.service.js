import { apiClient } from '../../../api/apiClient'

function unwrap(response) {
  return response?.data?.data ??
    response?.data ??
    null
}

function path(value) {
  return encodeURIComponent(
    String(
      value ||
        '',
    ).trim(),
  )
}

export function getHostOperationsErrorMessage(
  error,
  fallback =
    'Unable to complete this Host operation.',
) {
  return error?.response?.data?.message ||
    error?.message ||
    fallback
}

export function createHostOperationsIdempotencyKey(
  prefix =
    'host-operation',
) {
  const random =
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`

  return `${prefix}:${random}`.slice(
    0,
    160,
  )
}

async function getCsrfToken() {
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
      'Unable to establish CSRF protection.',
    )
  }

  return data.csrfToken
}

async function mutate({
  method = 'post',
  url,
  data = {},
  idempotencyKey = '',
}) {
  const csrfToken =
    await getCsrfToken()

  const headers = {
    'x-csrf-token':
      csrfToken,
  }

  if (idempotencyKey) {
    headers['idempotency-key'] =
      idempotencyKey
  }

  const response =
    await apiClient.request({
      method,
      url,
      data,
      headers,
    })

  return unwrap(
    response,
  )
}

export async function getHostOperationalOrganization() {
  return unwrap(
    await apiClient.get(
      '/host/operations/organization',
    ),
  )
}

export async function createHostOperationalOrganization(input) {
  return mutate({
    url:
      '/host/operations/organization',

    data:
      input,
  })
}

export async function getHostCommercialProfile() {
  return unwrap(
    await apiClient.get(
      '/host/operations/organization/commercial-profile',
    ),
  )
}

export async function submitHostCommercialProfile(input) {
  return mutate({
    url:
      '/host/operations/organization/commercial-profile',

    data:
      input,
  })
}

export async function updateHostOperationalProfile(input) {
  return mutate({
    method:
      'put',

    url:
      '/host/operations/organization/profile',

    data:
      input,
  })
}

export async function getHostOperationalReadiness() {
  return unwrap(
    await apiClient.get(
      '/host/operations/organization/readiness',
    ),
  )
}

export async function requestHostOperationalActivation(reason) {
  return mutate({
    url:
      '/host/operations/organization/request-activation',

    data: {
      reason,
    },
  })
}

export async function listHostDocuments() {
  return unwrap(
    await apiClient.get(
      '/host/operations/documents',
    ),
  )
}

export async function registerHostDocument(input) {
  return mutate({
    url:
      '/host/operations/documents',

    data:
      input,
  })
}

export async function getHostKyb() {
  return unwrap(
    await apiClient.get(
      '/host/operations/kyb',
    ),
  )
}

export async function saveHostKyb(input) {
  return mutate({
    method:
      'put',

    url:
      '/host/operations/kyb',

    data:
      input,
  })
}

export async function submitHostKyb() {
  return mutate({
    url:
      '/host/operations/kyb/submit',
  })
}

export async function listHostTeam() {
  return unwrap(
    await apiClient.get(
      '/host/operations/team',
    ),
  )
}

export async function addHostTeamMember(input) {
  return mutate({
    url:
      '/host/operations/team',

    data:
      input,
  })
}

export async function updateHostTeamMember(
  memberId,
  input,
) {
  return mutate({
    method:
      'patch',

    url:
      `/host/operations/team/${path(memberId)}`,

    data:
      input,
  })
}

export async function listHostCatalogImports(params = {}) {
  return unwrap(
    await apiClient.get(
      '/host/operations/catalog-imports',
      {
        params,
      },
    ),
  )
}

export async function getHostCatalogImport(importId) {
  return unwrap(
    await apiClient.get(
      `/host/operations/catalog-imports/${path(importId)}`,
    ),
  )
}

export async function createHostCatalogImport(input) {
  return mutate({
    url:
      '/host/operations/catalog-imports',

    data:
      input,

    idempotencyKey:
      createHostOperationsIdempotencyKey(
        'catalog-import',
      ),
  })
}

export async function getHostDataQuality() {
  return unwrap(
    await apiClient.get(
      '/host/operations/data-quality',
    ),
  )
}

export async function listHostRecipeListings() {
  return unwrap(
    await apiClient.get(
      '/host/operations/recipes',
    ),
  )
}

export async function listHostRecipeListingHistory() {
  return unwrap(
    await apiClient.get(
      '/host/operations/recipes/history',
    ),
  )
}

export async function createHostRecipeListing(input) {
  return mutate({
    url:
      '/host/operations/recipes',

    data:
      input,
  })
}

export async function getHostRecipeListing(recipeVersionId) {
  return unwrap(
    await apiClient.get(
      `/host/operations/recipes/${path(recipeVersionId)}`,
    ),
  )
}

export async function updateHostRecipeListing(
  recipeVersionId,
  input,
) {
  return mutate({
    method:
      'patch',

    url:
      `/host/operations/recipes/${path(recipeVersionId)}`,

    data:
      input,
  })
}

export async function deleteHostRecipeListing(recipeVersionId) {
  return mutate({
    method:
      'delete',

    url:
      `/host/operations/recipes/${path(recipeVersionId)}`,
  })
}

export async function listHostBrandRecipeSubmissions(params = {}) {
  return unwrap(
    await apiClient.get(
      '/host/operations/brand-recipes',
      {
        params,
      },
    ),
  )
}

export async function createHostBrandRecipeSubmission(input) {
  return mutate({
    url:
      '/host/operations/brand-recipes',

    data:
      input,
  })
}

export async function listHostCampaigns() {
  return unwrap(
    await apiClient.get(
      '/host/operations/campaigns',
    ),
  )
}

export async function createHostCampaign(input) {
  return mutate({
    url:
      '/host/operations/campaigns',

    data:
      input,
  })
}

export async function submitHostCampaign(campaignId) {
  return mutate({
    url:
      `/host/operations/campaigns/${path(campaignId)}/submit`,

    data: {
      acknowledgment:
        true,
    },
  })
}

export async function getHostEarningsOverview() {
  return unwrap(
    await apiClient.get(
      '/host/operations/finance/earnings',
    ),
  )
}

export async function getHostFinanceSummary() {
  return unwrap(
    await apiClient.get(
      '/host/operations/finance/summary',
    ),
  )
}

export async function listHostSettlements(params = {}) {
  return unwrap(
    await apiClient.get(
      '/host/operations/finance/settlements',
      {
        params,
      },
    ),
  )
}

export async function getHostSettlement(settlementId) {
  return unwrap(
    await apiClient.get(
      `/host/operations/finance/settlements/${path(settlementId)}`,
    ),
  )
}

export async function listHostServiceAccounts() {
  return unwrap(
    await apiClient.get(
      '/host/operations/integrations/service-accounts',
    ),
  )
}

export async function createHostServiceAccount(input) {
  return mutate({
    url:
      '/host/operations/integrations/service-accounts',

    data:
      input,
  })
}

export async function updateHostServiceAccount(
  serviceAccountId,
  input,
) {
  return mutate({
    method:
      'patch',

    url:
      `/host/operations/integrations/service-accounts/${path(serviceAccountId)}`,

    data:
      input,
  })
}

export async function rotateHostServiceAccountCredential(serviceAccountId) {
  return mutate({
    url:
      `/host/operations/integrations/service-accounts/${path(serviceAccountId)}/rotate`,
  })
}

export async function listHostWebhooks() {
  return unwrap(
    await apiClient.get(
      '/host/operations/integrations/webhooks',
    ),
  )
}

export async function createHostWebhook(input) {
  return mutate({
    url:
      '/host/operations/integrations/webhooks',

    data:
      input,
  })
}

export async function updateHostWebhook(
  webhookId,
  input,
) {
  return mutate({
    method:
      'patch',

    url:
      `/host/operations/integrations/webhooks/${path(webhookId)}`,

    data:
      input,
  })
}

export async function rotateHostWebhookSecret(webhookId) {
  return mutate({
    url:
      `/host/operations/integrations/webhooks/${path(webhookId)}/rotate-secret`,
  })
}

export async function listHostOperationsAudit(params = {}) {
  return unwrap(
    await apiClient.get(
      '/host/operations/integrations/audit',
      {
        params,
      },
    ),
  )
}

export async function listAdminHostKyb(params = {}) {
  return unwrap(
    await apiClient.get(
      '/admin/host-operations/kyb',
      {
        params,
      },
    ),
  )
}

export async function decideAdminHostKyb(
  kybId,
  input,
) {
  return mutate({
    url:
      `/admin/host-operations/kyb/${path(kybId)}/decision`,

    data:
      input,
  })
}

export async function decideAdminHostActivation(
  organizationId,
  input,
) {
  return mutate({
    url:
      `/admin/host-operations/organizations/${path(organizationId)}/activation`,

    data:
      input,
  })
}

export async function listAdminBrandRecipes(params = {}) {
  return unwrap(
    await apiClient.get(
      '/admin/host-operations/brand-recipes',
      {
        params,
      },
    ),
  )
}

export async function reviewAdminBrandRecipe(
  submissionId,
  input,
) {
  return mutate({
    url:
      `/admin/host-operations/brand-recipes/${path(submissionId)}/review`,

    data:
      input,
  })
}

export async function listAdminSettlements(params = {}) {
  return unwrap(
    await apiClient.get(
      '/admin/host-operations/finance/settlements',
      {
        params,
      },
    ),
  )
}

export async function createAdminSettlement(input) {
  return mutate({
    url:
      '/admin/host-operations/finance/settlements',

    data:
      input,
  })
}

export async function decideAdminSettlement(
  settlementId,
  input,
) {
  return mutate({
    url:
      `/admin/host-operations/finance/settlements/${path(settlementId)}/decision`,

    data:
      input,
  })
}

export async function markAdminSettlementPaid(
  settlementId,
  input,
) {
  return mutate({
    url:
      `/admin/host-operations/finance/settlements/${path(settlementId)}/paid`,

    data:
      input,
  })
}