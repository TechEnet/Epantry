import { useQuery } from '@tanstack/react-query'

import { getBackendHealth } from '../api/system.api'

export function useHealthQuery() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: getBackendHealth,
    staleTime: 60 * 1000,
  })
}
