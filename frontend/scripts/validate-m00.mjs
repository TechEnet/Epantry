import { existsSync, readFileSync } from 'node:fs'

const errors = []
const required = [
  'src/app/AppProviders.jsx',
  'src/api/apiClient.js',
  'src/config/env.js',
  'src/lib/queryClient.js',
  'src/lib/motion.js',
  'src/store/app.store.js',
  'src/schemas/system.schema.js',
  'src/features/system/api/system.api.js',
  'src/features/system/hooks/useHealthQuery.js',
  'src/features/system/hooks/useBootstrapQuery.js',
  'src/features/system/pages/SystemDebugPage.jsx',
]

for (const path of required) {
  if (!existsSync(path)) errors.push(`Missing M00 frontend path: ${path}`)
}

const providers = readFileSync('src/app/AppProviders.jsx', 'utf8')
for (const contract of ['QueryClientProvider', 'MotionConfig', 'BrowserRouter', 'reducedMotion="user"']) {
  if (!providers.includes(contract)) errors.push(`AppProviders missing: ${contract}`)
}

const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8')
if (!routes.includes('Suspense')) errors.push('Route-level loading shell is missing')
if (!routes.includes('path="/__debug"')) errors.push('M00 debug route is missing')

if (errors.length) {
  console.error(`M00 validation failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('M00 frontend validation passed.')
