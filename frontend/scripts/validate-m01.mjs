import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

const requiredFiles = [
  'src/features/landing/pages/LandingPage.jsx',
  'src/features/landing/components/HeroSection.jsx',
  'src/features/landing/components/FeaturedContentSection.jsx',
  'src/features/landing/components/HowItWorksSection.jsx',
  'src/features/landing/components/ClosingCtaSection.jsx',
  'src/features/landing/content/landingContent.js',
  'src/features/landing/api/featuredContentApi.js',
  'src/features/landing/hooks/useLandingFeaturedQuery.js',
  'src/features/grocery/pages/GroceryPage.jsx',
  'src/features/brands/pages/BrandsPage.jsx',
  'src/features/recipes/pages/RecipesPage.jsx',
  'src/features/search/pages/SearchPage.jsx',
  'src/routes/AppRoutes.jsx',
  'src/components/layout/Navbar.jsx',
  'src/components/layout/Footer.jsx',
]

const forbiddenLegacyPaths = [
  'src/pages/Home.jsx',
  'src/pages/ProductPage.jsx',
  'src/pages/BrandPage.jsx',
  'src/pages/RecipePage.jsx',
  'src/context/ProductContext.jsx',
  'src/context/BrandContext.jsx',
  'src/context/RecipeContext.jsx',
  'src/data/products.data.js',
  'src/data/brands.data.js',
  'src/data/recipes.data.js',
]

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing required M01 file: ${file}`)
  }
}

for (const file of forbiddenLegacyPaths) {
  if (fs.existsSync(path.join(root, file))) {
    failures.push(`Legacy prototype file should not exist: ${file}`)
  }
}

function walk(directory) {
  const files = []

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
    } else if (/\.(js|jsx|mjs|ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

const sourceFiles = walk(path.join(root, 'src'))
const sourceText = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')

if (sourceText.includes('/explore')) {
  failures.push('Legacy /explore route is still referenced in frontend source.')
}

const requiredRoutes = [
  'path="/"',
  'path="/grocery"',
  'path="/brands"',
  'path="/recipes"',
  'path="/search"',
]

const routes = fs.readFileSync(path.join(root, 'src/routes/AppRoutes.jsx'), 'utf8')
for (const route of requiredRoutes) {
  if (!routes.includes(route)) {
    failures.push(`Required M01 route missing: ${route}`)
  }
}

const devanagariPattern = /[\u0900-\u097F]/
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8')
  if (devanagariPattern.test(content)) {
    failures.push(`Hindi/Devanagari text detected: ${path.relative(root, file)}`)
  }
}

if (failures.length) {
  console.error(`\nM01 validation failed with ${failures.length} error(s):\n`)
  for (const failure of failures) console.error(`- ${failure}`)
  console.error('')
  process.exit(1)
}

console.log('M01 validation passed.')
console.log('Landing, real module routes, English-only source and legacy isolation checks passed.')
