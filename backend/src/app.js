import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'

import {
  env,
} from './config/env.js'

import {
  errorMiddleware,
  notFoundMiddleware,
} from './middlewares/error.middleware.js'

import {
  requestIdMiddleware,
} from './middlewares/requestId.middleware.js'

import {
  requestLoggerMiddleware,
} from './middlewares/requestLogger.middleware.js'

import {
  analyticsInstrumentationMiddleware,
} from './middlewares/analyticsInstrumentation.middleware.js'

import {
  apiRateLimiter,
  helmetMiddleware,
  sensitiveResponseNoStoreMiddleware,
} from './middlewares/security.middleware.js'

import adminRoutes from './modules/admin/admin.routes.js'
import adminGovernanceRoutes from './modules/adminGovernance/adminGovernance.routes.js'
import analyticsRoutes from './modules/analytics/analytics.routes.js'

import {
  adminAnalyticsRouter,
  experimentRouter,
  hostAnalyticsRouter,
} from './modules/analytics/analytics.batch2.routes.js'

import authRoutes from './modules/auth/auth.routes.js'

import brandAuthorityAdminRoutes from './modules/brands/brandAuthority.admin.routes.js'
import brandAuthorityHostRoutes from './modules/brands/brandAuthority.host.routes.js'
import brandAuthorityPublicRoutes from './modules/brands/brandAuthority.public.routes.js'

import catalogPublicRoutes from './modules/catalog/catalog.public.routes.js'

import commerceHostRoutes from './modules/commerce/commerce.host.routes.js'
import commerceRoutes from './modules/commerce/commerce.routes.js'
import commerceWebhookRoutes from './modules/commerce/commerce.webhook.routes.js'

import communityRoutes from './modules/community/community.routes.js'
import communityExpansionRoutes from './modules/communityExpansion/communityExpansion.routes.js'
import deliveryAddressRoutes from './modules/deliveryAddresses/deliveryAddress.routes.js'

import executionScaleRoutes, {
  executionScaleWebhookRouter,
} from './modules/executionScale/executionScale.routes.js'

import expansionExecutionRoutes from './modules/expansionExecution/expansionExecution.routes.js'

import foodIntelligenceAdminRoutes from './modules/foodIntelligence/foodIntelligence.admin.routes.js'
import foodIntelligencePublicRoutes from './modules/foodIntelligence/foodIntelligence.public.routes.js'
import foodIntelligenceWorkspaceRoutes from './modules/foodIntelligence/foodIntelligence.workspace.routes.js'

import {
  adminPrivacyRouter,
  adminRegulatoryRouter,
  privacyRouter,
} from './modules/hardening/hardening.routes.js'

import householdRoutes from './modules/households/household.routes.js'

import hospitalityRoutes from './modules/hospitality/hospitality.routes.js'

import {
  hospitalityPassportPrivateRoutes,
  hospitalityPassportPublicRoutes,
} from './modules/hospitality/hospitality.passport.routes.js'

import hostOperationsRoutes from './modules/hostOperations/hostOperations.routes.js'
import hostOperationsFinanceRoutes from './modules/hostOperations/hostOperations.finance.routes.js'
import hostOperationsIntegrationRoutes from './modules/hostOperations/hostOperations.integration.routes.js'

import learningRoutes from './modules/learning/learning.routes.js'

import landingRoutes from './modules/landing/landing.routes.js'
import locationRoutes from './modules/location/location.routes.js'

import marketplaceHostRoutes from './modules/marketplace/marketplace.host.routes.js'
import marketplacePublicRoutes from './modules/marketplace/marketplace.public.routes.js'

import {
  adminMediaPrivacyRouter,
  customerMediaPrivacyRouter,
  hostMediaPrivacyRouter,
} from './modules/mediaPrivacy/mediaPrivacy.routes.js'

import metaRoutes from './modules/meta/meta.routes.js'
import notificationRoutes from './modules/notifications/notification.routes.js'

import {
  outcomePlanRecipeRoutes,
  outcomePlanRoutes,
} from './modules/outcomes/outcomePlan.routes.js'

import pantryRecipeRoutes from './modules/pantry/pantry.recipe.routes.js'
import pantryRoutes from './modules/pantry/pantry.routes.js'

import planningRoutes from './modules/planning/planning.routes.js'
import planningWasteRoutes from './modules/planning/planning.waste.routes.js'

import purchaseSourceRoutes from './modules/purchaseSources/purchaseSource.routes.js'

import recipeAdminRoutes from './modules/recipes/recipe.admin.routes.js'
import recipePublicRoutes from './modules/recipes/recipe.public.routes.js'

import {
  adminReliabilityRouter,
} from './modules/reliability/reliability.routes.js'

import retailMediaRoutes from './modules/retailMedia/retailMedia.routes.js'

import searchAdminRoutes from './modules/search/search.admin.routes.js'
import searchRoutes from './modules/search/search.routes.js'

import universalProductRoutes from './modules/universalProduct/universalProduct.routes.js'

import accountRoutes from './modules/users/account.routes.js'
import healthRoutes from './routes/health.routes.js'

const app =
  express()

app.disable(
  'x-powered-by',
)

app.use(
  helmetMiddleware,
)

app.use(
  requestIdMiddleware,
)

app.use(
  requestLoggerMiddleware,
)

app.use(
  cors({
    origin:
      env.frontendUrl,

    credentials:
      true,
  }),
)

app.use(
  cookieParser(),
)

/*
|--------------------------------------------------------------------------
| M11 Raw Razorpay Webhook
|--------------------------------------------------------------------------
|
| Must remain before the global JSON body parser.
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/webhooks',

  apiRateLimiter,

  commerceWebhookRoutes,
)

/*
|--------------------------------------------------------------------------
| M22 Raw Partner Webhook
|--------------------------------------------------------------------------
|
| Signed partner webhooks require untouched raw request bytes.
|
| This mount must remain ahead of the global JSON and URL-encoded body
| parsers.
|
| Webhook processing stores:
|
| hash
| provider event id
| normalized bounded metadata
|
| It never stores the raw body.
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/execution-scale/webhooks',

  apiRateLimiter,

  executionScaleWebhookRouter,
)

app.use(
  express.json({
    limit:
      '1mb',
  }),
)

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      '1mb',
  }),
)

app.use(
  '/api',

  apiRateLimiter,
)

/*
|--------------------------------------------------------------------------
| M19 Best-effort Analytics
|--------------------------------------------------------------------------
*/

app.use(
  analyticsInstrumentationMiddleware,
)

app.use(
  '/api/v1',

  healthRoutes,
)

app.use(
  '/api/v1/meta',

  metaRoutes,
)

app.use(
  '/api/v1',

  searchRoutes,
)

app.use(
  '/api/v1/auth',

  sensitiveResponseNoStoreMiddleware,

  authRoutes,
)

app.use(
  '/api/v1/account',

  sensitiveResponseNoStoreMiddleware,

  accountRoutes,
)

app.use(
  '/api/v1/households',

  sensitiveResponseNoStoreMiddleware,

  householdRoutes,
)

app.use(
  '/api/v1/pantry',

  sensitiveResponseNoStoreMiddleware,

  pantryRoutes,
)

app.use(
  '/api/v1/delivery-addresses',

  sensitiveResponseNoStoreMiddleware,

  deliveryAddressRoutes,
)


/*
|--------------------------------------------------------------------------
| M22 Connected Purchase Sources
|--------------------------------------------------------------------------
|
| Customer-owned provider connections feed normalized purchase evidence into
| a selected household. Provider OAuth credentials remain outside MongoDB.
|
*/

app.use(
  '/api/v1/purchase-sources',

  sensitiveResponseNoStoreMiddleware,

  purchaseSourceRoutes,
)

app.use(
  '/api/v1',

  sensitiveResponseNoStoreMiddleware,

  planningRoutes,
)

app.use(
  '/api/v1',

  sensitiveResponseNoStoreMiddleware,

  planningWasteRoutes,
)

app.use(
  '/api/v1',

  sensitiveResponseNoStoreMiddleware,

  universalProductRoutes,
)

/*
|--------------------------------------------------------------------------
| M19 Analytics / Experiment / Notification
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/analytics',

  sensitiveResponseNoStoreMiddleware,

  analyticsRoutes,
)

app.use(
  '/api/v1/experiments',

  experimentRouter,
)

app.use(
  '/api/v1/host/analytics',

  hostAnalyticsRouter,
)

app.use(
  '/api/v1/admin/analytics',

  adminAnalyticsRouter,
)

app.use(
  '/api/v1/notifications',

  sensitiveResponseNoStoreMiddleware,

  notificationRoutes,
)

/*
|--------------------------------------------------------------------------
| M20 Security / Privacy / Reliability / Regulatory
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/privacy',

  sensitiveResponseNoStoreMiddleware,

  privacyRouter,
)

app.use(
  '/api/v1/admin/privacy',

  adminPrivacyRouter,
)

app.use(
  '/api/v1/admin/reliability',

  adminReliabilityRouter,
)

app.use(
  '/api/v1/admin/regulatory-profiles',

  adminRegulatoryRouter,
)

/*
|--------------------------------------------------------------------------
| M24 Upload Privacy Detection + Redaction Safety
|--------------------------------------------------------------------------
|
| Customer and Host media remain owner/organization scoped. Trust & Safety
| review remains inside the M03 Admin permission plane.
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/media-privacy',

  sensitiveResponseNoStoreMiddleware,

  customerMediaPrivacyRouter,
)

app.use(
  '/api/v1/host/media-privacy',

  sensitiveResponseNoStoreMiddleware,

  hostMediaPrivacyRouter,
)

app.use(
  '/api/v1/admin/media-privacy',

  sensitiveResponseNoStoreMiddleware,

  adminMediaPrivacyRouter,
)

/*
|--------------------------------------------------------------------------
| M15 Community
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  communityRoutes,
)


/*
|--------------------------------------------------------------------------
| M23 Learn / EPANTRY Pro Learning Experience
|--------------------------------------------------------------------------
|
| M15 CreatorCourse and CourseEntitlement remain the source of truth.
| M23 owns curriculum, lesson progress, bookmarks, notes and authorized media
| delivery only. Pro is still an entitlement, never a new application role.
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/learning',

  sensitiveResponseNoStoreMiddleware,

  learningRoutes,
)

/*
|--------------------------------------------------------------------------
| M21 Community Trust
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  communityExpansionRoutes,
)

/*
|--------------------------------------------------------------------------
| M21 Retail Media
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  retailMediaRoutes,
)

/*
|--------------------------------------------------------------------------
| M22 Batch 2 Safe Sponsored + Creator Transactions
|--------------------------------------------------------------------------
|
| Feature flag:
|
| m22.safe_expansion_execution
|
| This layer composes M08/M12/M21 sponsored safety and M15/M21 Creator
| governance. It does not introduce Creator/Advertiser application roles.
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  expansionExecutionRoutes,
)

/*
|--------------------------------------------------------------------------
| M22 Batch 1 Production Ecosystem + Execution Scale
|--------------------------------------------------------------------------
|
| Feature flag:
|
| m22.execution_scale
|
| Rollout gate only.
|
| Authorization remains:
|
| Host capability + exact Host/Hospitality permissions
| M03 Admin permissions
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  executionScaleRoutes,
)

/*
|--------------------------------------------------------------------------
| M16 Host Operations
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  hostOperationsRoutes,
)

app.use(
  '/api/v1',

  hostOperationsFinanceRoutes,
)

app.use(
  '/api/v1',

  hostOperationsIntegrationRoutes,
)

/*
|--------------------------------------------------------------------------
| M18 Hospitality
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/host/hospitality',

  sensitiveResponseNoStoreMiddleware,

  hospitalityRoutes,
)

app.use(
  '/api/v1/host/hospitality',

  hospitalityPassportPrivateRoutes,
)

app.use(
  '/api/v1/dish-passports',

  hospitalityPassportPublicRoutes,
)

/*
|--------------------------------------------------------------------------
| M17 Admin Governance
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  adminGovernanceRoutes,
)

/*
|--------------------------------------------------------------------------
| M10 Outcome Plans
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/outcome-plans',

  outcomePlanRoutes,
)

/*
|--------------------------------------------------------------------------
| M11 Commerce
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  commerceRoutes,
)

/*
|--------------------------------------------------------------------------
| M05 Marketplace Host
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/host/marketplace',

  sensitiveResponseNoStoreMiddleware,

  marketplaceHostRoutes,
)

/*
|--------------------------------------------------------------------------
| M11 Host Commerce
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/host/commerce',

  sensitiveResponseNoStoreMiddleware,

  commerceHostRoutes,
)

/*
|--------------------------------------------------------------------------
| M06 Host Brand Authority
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/host',

  sensitiveResponseNoStoreMiddleware,

  brandAuthorityHostRoutes,
)

/*
|--------------------------------------------------------------------------
| Admin Domain Routes
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1/admin',

  sensitiveResponseNoStoreMiddleware,

  brandAuthorityAdminRoutes,
)

app.use(
  '/api/v1/admin',

  sensitiveResponseNoStoreMiddleware,

  recipeAdminRoutes,
)

app.use(
  '/api/v1/admin',

  sensitiveResponseNoStoreMiddleware,

  foodIntelligenceWorkspaceRoutes,
)

app.use(
  '/api/v1/admin',

  sensitiveResponseNoStoreMiddleware,

  foodIntelligenceAdminRoutes,
)

app.use(
  '/api/v1/admin/search-ai',

  searchAdminRoutes,
)

app.use(
  '/api/v1/admin',

  sensitiveResponseNoStoreMiddleware,

  adminRoutes,
)

/*
|--------------------------------------------------------------------------
| Public / Customer Domain Routes
|--------------------------------------------------------------------------
*/

app.use(
  '/api/v1',

  foodIntelligencePublicRoutes,
)

app.use(
  '/api/v1/landing',

  landingRoutes,
)

app.use(
  '/api/v1/catalog',

  catalogPublicRoutes,
)

app.use(
  '/api/v1/marketplace',

  marketplacePublicRoutes,
)

app.use(
  '/api/v1/brands',

  brandAuthorityPublicRoutes,
)

app.use(
  '/api/v1/recipes',

  outcomePlanRecipeRoutes,
)

app.use(
  '/api/v1/recipes',

  pantryRecipeRoutes,
)

app.use(
  '/api/v1/recipes',

  recipePublicRoutes,
)

app.use(
  '/api/v1/location',

  locationRoutes,
)

app.get(
  '/',

  (
    req,
    res,
  ) => {
    return res
      .status(
        200,
      )
      .json({
        success:
          true,

        message:
          'Welcome to EPANTRY API',

        data: {
          version:
            'v1',

          requestId:
            req.requestId,
        },
      })
  },
)

app.use(
  notFoundMiddleware,
)

app.use(
  errorMiddleware,
)

export default app