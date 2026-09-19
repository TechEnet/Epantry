import { apiClient } from '../../../api/apiClient'
import {
  bootstrapResponseSchema,
  healthResponseSchema,
} from '../../../schemas/system.schema'

export async function getBackendHealth() {
  const response = await apiClient.get('/health')
  return healthResponseSchema.parse(response.data)
}

export async function getBootstrapMeta() {
  const response = await apiClient.get('/meta/bootstrap')
  return bootstrapResponseSchema.parse(response.data)
}
