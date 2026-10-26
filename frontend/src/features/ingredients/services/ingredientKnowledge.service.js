import { apiClient } from '../../../api/apiClient'

export async function getIngredientKnowledge(reference, { listingId = '' } = {}) {
  const response = await apiClient.get(
    `/catalog/ingredients/knowledge/${encodeURIComponent(reference)}`,
    { params: listingId ? { listing: listingId } : {} },
  )
  return response?.data?.data || null
}
