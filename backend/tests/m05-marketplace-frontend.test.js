import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

function readFrontendFile(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../../frontend/${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  )
}

test(
  'M05 frontend exposes Host Marketplace route using Host application access',
  () => {
    const source =
      readFrontendFile(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /path\s*=\s*["']\/host\/marketplace["']/,
    )

    assert.match(
      source,
      /APPLICATION_ACCESS_TYPES\.HOST/,
    )

    assert.match(
      source,
      /HostMarketplacePage/,
    )
  },
)

test(
  'M05 frontend exposes Marketplace Ops through marketplace.read permission',
  () => {
    const source =
      readFrontendFile(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /path\s*=\s*["']\/admin\/marketplace["']/,
    )

    assert.match(
      source,
      /permission\s*=\s*["']marketplace\.read["']/,
    )
  },
)

test(
  'M05 Admin Shell shows Marketplace Ops only with marketplace.read',
  () => {
    const source =
      readFrontendFile(
        'src/features/admin/components/AdminShell.jsx',
      )

    assert.match(
      source,
      /Marketplace Ops/,
    )

    assert.match(
      source,
      /marketplace\.read/,
    )
  },
)

test(
  'M05 Product Detail composes public Marketplace Offers by pincode',
  () => {
    const source =
      readFrontendFile(
        'src/features/grocery/pages/ProductDetailPage.jsx',
      )

    assert.match(
      source,
      /getPublicPackOffers/,
    )

    assert.match(
      source,
      /pincode/,
    )

    assert.match(
      source,
      /Available Offers/,
    )
  },
)

test(
  'M05 frontend Marketplace service keeps public and Host endpoints separate',
  () => {
    const source =
      readFrontendFile(
        'src/features/marketplace/services/marketplace.service.js',
      )

    assert.match(
      source,
      /\/marketplace\/packs\//,
    )

    assert.match(
      source,
      /\/host\/marketplace\/offers/,
    )

    assert.match(
      source,
      /\/host\/marketplace\/inventory-nodes/,
    )

    assert.match(
      source,
      /\/host\/marketplace\/service-areas/,
    )
  },
)

test(
  'M05 Host Marketplace UI exposes price inventory serviceability and activation workflow',
  () => {
    const source =
      readFrontendFile(
        'src/features/marketplace/pages/HostMarketplacePage.jsx',
      )

    assert.match(
      source,
      /createHostPriceRule/,
    )

    assert.match(
      source,
      /createInventorySnapshots/,
    )

    assert.match(
      source,
      /createServiceArea/,
    )

    assert.match(
      source,
      /activateHostOffer/,
    )
  },
)

test(
  'M05 frontend Host Marketplace mutations obtain CSRF protection',
  () => {
    const source =
      readFrontendFile(
        'src/features/marketplace/services/marketplace.service.js',
      )

    assert.match(
      source,
      /\/auth\/csrf/,
    )

    assert.match(
      source,
      /x-csrf-token/,
    )
  },
)

test(
  'M05 Product Detail does not persist Marketplace price or inventory into canonical Product',
  () => {
    const source =
      readFrontendFile(
        'src/features/grocery/pages/ProductDetailPage.jsx',
      )

    assert.doesNotMatch(
      source,
      /updateProductVersion/,
    )

    assert.doesNotMatch(
      source,
      /publishProductVersion/,
    )
  },
)