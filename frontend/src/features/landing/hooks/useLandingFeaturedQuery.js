import {
  useQuery,
} from "@tanstack/react-query";

import {
  getLandingFeaturedContent,
} from "../api/featuredContentApi.js";

/*
|--------------------------------------------------------------------------
| Landing Featured Query
|--------------------------------------------------------------------------
*/

export function useLandingFeaturedQuery() {
  return useQuery({
    queryKey: [
      "landing",
      "featured",
    ],

    queryFn:
      getLandingFeaturedContent,

    staleTime:
      5 * 60 * 1000,
  });
}