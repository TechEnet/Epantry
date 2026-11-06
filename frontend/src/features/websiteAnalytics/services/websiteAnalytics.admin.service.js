import { apiClient } from '../../../api/apiClient'

export async function getWebsiteAnalyticsReport({ days = 7, from, to, signal } = {}) {
  const params = from && to ? { from, to } : { days }
  const response = await apiClient.get('/admin/website-analytics/report', { params, signal })
  if (response?.data?.success === false) {
    throw new Error(response.data.message || 'Website analytics could not be loaded.')
  }
  return response?.data?.data ?? response?.data ?? response
}

export function websiteAnalyticsErrorMessage(error) {
  if (error?.response?.status === 403) return 'Super Admin access is required to view website analytics.'
  if (error?.response?.status === 401) return 'Your session needs to be verified. Sign in again.'
  return error?.response?.data?.message || error?.message || 'Website analytics could not be loaded. Please retry.'
}
