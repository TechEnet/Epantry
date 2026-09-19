import mongoose from 'mongoose'

import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js'

import {
  env,
} from '../src/config/env.js'

import {
  Brand,
} from '../src/modules/catalog/catalog.models.js'

const CONFIRMATION =
  'DELETE_ALL_BRANDS_EXCEPT_ALOK_RESTO'

function hasConfirmation() {
  return process.argv.includes(
    `--confirm=${CONFIRMATION}`,
  )
}

function isAlokResto(brand) {
  const name = String(
    brand?.name || '',
  )
    .trim()
    .toLowerCase()

  const slug = String(
    brand?.slug || '',
  )
    .trim()
    .toLowerCase()

  return (
    name === 'alok resto' ||
    slug === 'alok-resto'
  )
}

async function main() {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Brand cleanup is blocked in production.',
    )
  }

  await connectDatabase()

  const brands = await Brand.find({})
    .select({
      _id: 1,
      name: 1,
      slug: 1,
      status: 1,
    })
    .sort({
      name: 1,
    })
    .lean()

  const keep = brands.filter(
    isAlokResto,
  )

  if (keep.length === 0) {
    throw new Error(
      'Alok Resto brand was not found. Nothing was deleted.',
    )
  }

  const remove = brands.filter(
    (brand) => !isAlokResto(brand),
  )

  console.log('\nBrand cleanup preview')
  console.table(
    brands.map((brand) => ({
      action: isAlokResto(brand)
        ? 'KEEP'
        : 'DELETE',
      id: String(brand._id),
      name: brand.name,
      slug: brand.slug,
      status: brand.status,
    })),
  )

  console.log(
    `\nKeeping ${keep.length} Alok Resto brand record(s).`,
  )
  console.log(
    `Deleting ${remove.length} other brand record(s).`,
  )

  if (!hasConfirmation()) {
    console.log(
      '\nDRY RUN ONLY. No database records were changed.',
    )
    console.log(
      `Run again with --confirm=${CONFIRMATION} to perform the deletion.`,
    )
    return
  }

  if (remove.length === 0) {
    console.log(
      '\nNo non-Alok-Resto brands remain. Nothing to delete.',
    )
    return
  }

  const removeIds = remove.map(
    (brand) => brand._id,
  )

  const result = await Brand.deleteMany({
    _id: {
      $in: removeIds,
    },
  })

  const remaining = await Brand.find({})
    .select({
      _id: 1,
      name: 1,
      slug: 1,
      status: 1,
    })
    .sort({
      name: 1,
    })
    .lean()

  console.log(
    `\nDeleted ${result.deletedCount} brand record(s).`,
  )

  console.log('\nRemaining brands')
  console.table(
    remaining.map((brand) => ({
      id: String(brand._id),
      name: brand.name,
      slug: brand.slug,
      status: brand.status,
    })),
  )

  const unexpected = remaining.filter(
    (brand) => !isAlokResto(brand),
  )

  if (unexpected.length > 0) {
    throw new Error(
      'Cleanup verification failed: a non-Alok-Resto brand still exists.',
    )
  }

  console.log(
    '\nCleanup verified: only Alok Resto remains in the brands collection.',
  )
}

main()
  .catch((error) => {
    console.error(
      '\nBrand cleanup failed:',
      error,
    )

    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await disconnectDatabase()
    }
  })
