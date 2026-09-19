import {
  apiClient,
} from "../../../api/apiClient.js";

/*
|--------------------------------------------------------------------------
| Featured Landing Content
|--------------------------------------------------------------------------
*/

export async function getLandingFeaturedContent() {
  const response =
    await apiClient.get(
      "/landing/featured"
    );

  return response.data.data;
}