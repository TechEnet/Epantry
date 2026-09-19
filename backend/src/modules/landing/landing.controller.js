import {
  ApiResponse,
} from "../../utils/ApiResponse.js";

import {
  getLandingFeaturedContent,
} from "./landing.service.js";

/*
|--------------------------------------------------------------------------
| Featured Landing Content
|--------------------------------------------------------------------------
*/

export async function landingFeaturedController(
  req,
  res
) {
  const data =
    await getLandingFeaturedContent();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...data,
          requestId:
            req.requestId,
        },
        "Landing featured content loaded successfully"
      )
    );
}