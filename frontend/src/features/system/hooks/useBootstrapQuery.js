import { useQuery } from '@tanstack/react-query'

import { getBootstrapMeta } from '../api/system.api'

export function useBootstrapQuery() {
  return useQuery({
    queryKey: ['system', 'bootstrap'],
    queryFn: getBootstrapMeta,
    staleTime: 5 * 60 * 1000,
  })
}
