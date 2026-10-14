import mongoose from "mongoose";

import {
  ApiResponse,
} from "../../utils/ApiResponse.js";

import {
  getLandingFeaturedContent,
} from "./landing.service.js";

/*
|--------------------------------------------------------------------------|
| Featured Landing Content
|--------------------------------------------------------------------------|
| Public-only, bounded 15-second cache avoids repeated DB aggregation on
| simultaneous homepage visits. requestId stays per response. Failures are
| never cached, and disconnected DB never serves stale material.
*/
const CACHE_MS = 15000
let cachedFeatured = null
let expiresAt = 0
let pendingFeatured = null

async function loadFeatured() {
  if (mongoose.connection.readyState !== 1) {
    // Never mask a disconnected database with cached public data.
    cachedFeatured = null
    expiresAt = 0
    return getLandingFeaturedContent()
  }
  if (cachedFeatured && Date.now() < expiresAt) return cachedFeatured
  if (pendingFeatured) return pendingFeatured

  pendingFeatured = getLandingFeaturedContent()
  try {
    const data = await pendingFeatured
    cachedFeatured = data
    expiresAt = Date.now() + CACHE_MS
    return data
  } finally {
    pendingFeatured = null
  }
}

export async function landingFeaturedController(
  req,
  res
) {
  const data =
    await loadFeatured();

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