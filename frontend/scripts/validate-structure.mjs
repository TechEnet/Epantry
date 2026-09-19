import { existsSync } from 'node:fs'

const requiredPaths = [
  'public/banners',
  'public/brands',
  'public/products',
  'public/recipes',

  'src/api/apiClient.js',
  'src/app/AppProviders.jsx',
  'src/components/common/EmptyState.jsx',
  'src/components/common/LoadingSpinner.jsx',
  'src/components/common/ModulePlaceholderPage.jsx',
  'src/components/common/ScrollToTop.jsx',
  'src/components/common/SearchBar.jsx',
  'src/components/layout/Footer.jsx',
  'src/components/layout/Navbar.jsx',
  'src/config/env.js',

  'src/features/account/pages/AccountSettingsPage.jsx',
  'src/features/account/services/account.service.js',

  'src/features/auth/context/AuthContext.jsx',
  'src/features/auth/pages/ForgotPasswordPage.jsx',
  'src/features/auth/pages/LoginPage.jsx',
  'src/features/auth/pages/MfaEnrollmentPage.jsx',
  'src/features/auth/pages/RegisterPage.jsx',
  'src/features/auth/services/auth.service.js',
  'src/features/auth/services/mfa.service.js',
  'src/features/auth/services/reauth.service.js',
  'src/features/auth/services/registration.service.js',

  'src/features/households/context/HouseholdContext.jsx',
  'src/features/households/pages/HouseholdPage.jsx',
  'src/features/households/services/household.service.js',

  'src/features/landing/api/featuredContentApi.js',
  'src/features/landing/components/ClosingCtaSection.jsx',
  'src/features/landing/components/FeaturedContentSection.jsx',
  'src/features/landing/components/HeroSection.jsx',
  'src/features/landing/components/HowItWorksSection.jsx',
  'src/features/landing/content/landingContent.js',
  'src/features/landing/hooks/useLandingFeaturedQuery.js',
  'src/features/landing/pages/LandingPage.jsx',

  'src/features/grocery/pages/GroceryPage.jsx',
  'src/features/brands/pages/BrandsPage.jsx',
  'src/features/recipes/pages/RecipesPage.jsx',
  'src/features/search/pages/SearchPage.jsx',

  'src/features/system/api/system.api.js',
  'src/features/system/components/AppErrorBoundary.jsx',
  'src/features/system/components/BootstrapSync.jsx',
  'src/features/system/components/RouteLoading.jsx',
  'src/features/system/hooks/useBootstrapQuery.js',
  'src/features/system/hooks/useHealthQuery.js',
  'src/features/system/pages/SystemDebugPage.jsx',

  'src/lib/motion.js',
  'src/lib/queryClient.js',
  'src/routes/AppRoutes.jsx',
  'src/schemas/system.schema.js',
  'src/store/app.store.js',
  'src/App.jsx',
  'src/main.jsx',
  'src/index.css',

  '../.gitignore',
  '.env.example',
  'package.json',
  'vite.config.js',
  'index.html',
]

const forbiddenLegacyPaths = [
  'src/components/home',
  'src/components/products',
  'src/components/brands',
  'src/components/recipes',
  'src/context',
  'src/data',
  'src/hooks',
  'src/pages',
  'src/constants',
  'src/utils',
  'scripts/validate-data.mjs',
  'scripts/validate-phase1.mjs',
]

const errors = []

for (
  const item
  of requiredPaths
) {
  if (
    !existsSync(
      item,
    )
  ) {
    errors.push(
      `Missing required project path: ${item}`,
    )
  }
}

for (
  const item
  of forbiddenLegacyPaths
) {
  if (
    existsSync(
      item,
    )
  ) {
    errors.push(
      `Legacy prototype path should not exist: ${item}`,
    )
  }
}

if (
  errors.length
) {
  console.error(
    `Structure validation failed with ${errors.length} error(s):`,
  )

  for (
    const error
    of errors
  ) {
    console.error(
      `- ${error}`,
    )
  }

  process.exit(1)
}

console.log(
  `Structure validation passed (${requiredPaths.length} required paths checked).`,
)

console.log(
  'Legacy prototype directories are not present.',
)