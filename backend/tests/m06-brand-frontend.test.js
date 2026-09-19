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
  'M06 frontend service exposes Public Brand World and Product history APIs',
  () => {
    const source =
      readFrontendFile(
        'src/features/brands/services/brandAuthority.service.js',
      )

    assert.match(
      source,
      /\/brands/,
    )

    assert.match(
      source,
      /getBrandWorld/,
    )

    assert.match(
      source,
      /getBrandProductHistory/,
    )
  },
)

test(
  'M06 frontend service keeps Host and Admin Brand Authority endpoints separate',
  () => {
    const source =
      readFrontendFile(
        'src/features/brands/services/brandAuthority.service.js',
      )

    assert.match(
      source,
      /\/host\/brands/,
    )

    assert.match(
      source,
      /\/host\/brand-overrides/,
    )

    assert.match(
      source,
      /\/admin\/brand-claims/,
    )

    assert.match(
      source,
      /\/admin\/brand-overrides/,
    )
  },
)

test(
  'M06 Brand Directory uses Brand World API and links to Brand detail',
  () => {
    const source =
      readFrontendFile(
        'src/features/brands/pages/BrandsPage.jsx',
      )

    assert.match(
      source,
      /listBrandWorlds/,
    )

    assert.match(
      source,
      /\/brands\//,
    )

    assert.match(
      source,
      /Verified/,
    )
  },
)

test(
  'M06 Brand Detail renders canonical Product Families and history links',
  () => {
    const source =
      readFrontendFile(
        'src/features/brands/pages/BrandDetailPage.jsx',
      )

    assert.match(
      source,
      /getBrandWorld/,
    )

    assert.match(
      source,
      /productFamilies/,
    )

    assert.match(
      source,
      /Version history/,
    )
  },
)

test(
  'M06 Product history frontend uses read-only public history endpoint',
  () => {
    const source =
      readFrontendFile(
        'src/features/brands/pages/BrandProductHistoryPage.jsx',
      )

    assert.match(
      source,
      /getBrandProductHistory/,
    )

    assert.match(
      source,
      /Canonical version timeline/,
    )

    assert.doesNotMatch(
      source,
      /publishProductVersion/,
    )
  },
)

test(
  'M06 Host Brand workspace exposes evidence claim authority and override proposal workflow',
  () => {
    const source =
      readFrontendFile(
        'src/features/brands/pages/HostBrandAuthorityPage.jsx',
      )

    assert.match(
      source,
      /createHostBrandIdentityCheck/,
    )

    assert.match(
      source,
      /createHostBrandClaim/,
    )

    assert.match(
      source,
      /listHostBrandAuthorities/,
    )

    assert.match(
      source,
      /createHostBrandOverride/,
    )

    assert.match(
      source,
      /submitHostBrandOverride/,
    )
  },
)

test(
  'M06 Host Brand frontend does not expose Brand approval authority',
  () => {
    const source =
      readFrontendFile(
        'src/features/brands/pages/HostBrandAuthorityPage.jsx',
      )

    assert.doesNotMatch(
      source,
      /approveAdminBrandClaim/,
    )

    assert.doesNotMatch(
      source,
      /reviewAdminBrandOverride/,
    )
  },
)

test(
  'M06 Admin Brand page exposes claim evidence override conflict and authority governance',
  () => {
    const source =
      readFrontendFile(
        'src/features/admin/pages/AdminBrandAuthorityPage.jsx',
      )

    assert.match(
      source,
      /approveAdminBrandClaim/,
    )

    assert.match(
      source,
      /reviewAdminBrandIdentityCheck/,
    )

    assert.match(
      source,
      /reviewAdminBrandOverride/,
    )

    assert.match(
      source,
      /resolveAdminBrandConflict/,
    )
  },
)

test(
  'M06 frontend routes protect Host Brand workspace by Host application access',
  () => {
    const source =
      readFrontendFile(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /path="\/host\/brands"/,
    )

    assert.match(
      source,
      /APPLICATION_ACCESS_TYPES\.HOST/,
    )
  },
)

test(
  'M06 frontend routes permission gate Brand administration by existing admin permissions',
  () => {
    const source =
      readFrontendFile(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /path="\/admin\/brands"/,
    )

    assert.match(
      source,
      /catalog\.read/,
    )

    assert.match(
      source,
      /trust_safety\.read/,
    )
  },
)