import mongoose from 'mongoose'

import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js'

import {
  env,
} from '../src/config/env.js'

import {
  ProductVersion,
} from '../src/modules/catalog/catalog.models.js'

import {
  HostOffer,
} from '../src/modules/marketplace/marketplace.models.js'

const CONFIRMATION =
  'RETIRE_UNLISTED_PRODUCT_VERSIONS'

function hasConfirmation() {
  return process.argv.includes(
    `--confirm=${CONFIRMATION}`,
  )
}

async function findTargets() {
  const retiredOffers =
    await HostOffer.find({
      status:
        'retired',
    })
      .select({
        _id: 1,
        packId: 1,
        merchantSku: 1,
        organizationId: 1,
        status: 1,
      })
      .lean()

  const packIdStrings =
    [
      ...new Set(
        retiredOffers
          .map((offer) =>
            String(
              offer.packId ||
                '',
            ),
          )
          .filter(Boolean),
      ),
    ]

  const targets = []

  for (const packId of packIdStrings) {
    const remainingOffer =
      await HostOffer.exists({
        packId,

        status: {
          $ne:
            'retired',
        },
      })

    if (remainingOffer) {
      continue
    }

    const versions =
      await ProductVersion.find({
        packId,

        publicationStatus:
          'published',
      })
        .select({
          _id: 1,
          packId: 1,
          displayName: 1,
          gtin: 1,
          version: 1,
          publicationStatus: 1,
        })
        .sort({
          version: -1,
        })
        .lean()

    for (const version of versions) {
      targets.push({
        ...version,
        retiredOfferSkus:
          retiredOffers
            .filter(
              (offer) =>
                String(
                  offer.packId,
                ) ===
                packId,
            )
            .map(
              (offer) =>
                offer.merchantSku ||
                String(
                  offer._id,
                ),
            ),
      })
    }
  }

  return targets
}

async function main() {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Retired-listing reconciliation is blocked in production.',
    )
  }

  await connectDatabase()

  const targets =
    await findTargets()

  console.log(
    '\nRetired Host listing -> canonical ProductVersion reconciliation preview',
  )

  console.table(
    targets.map((version) => ({
      action:
        'RETIRE PRODUCT VERSION',
      productVersionId:
        String(
          version._id,
        ),
      packId:
        String(
          version.packId,
        ),
      displayName:
        version.displayName,
      gtin:
        version.gtin ||
        '',
      version:
        version.version,
      retiredOfferSkus:
        version.retiredOfferSkus.join(
          ', ',
        ),
    })),
  )

  if (!targets.length) {
    console.log(
      '\nNo published ProductVersions are backed only by retired Host Offers. Nothing to change.',
    )
    return
  }

  if (!hasConfirmation()) {
    console.log(
      '\nDRY RUN ONLY. No database records were changed.',
    )
    console.log(
      `Run again with --confirm=${CONFIRMATION} to retire these stale published ProductVersions.`,
    )
    return
  }

  const now =
    new Date()

  const result =
    await ProductVersion.updateMany(
      {
        _id: {
          $in:
            targets.map(
              (version) =>
                version._id,
            ),
        },

        publicationStatus:
          'published',
      },
      {
        $set: {
          publicationStatus:
            'retired',
          effectiveTo:
            now,
          retiredAt:
            now,
          retiredByUserId:
            null,
          retireReason:
            'Reconciled after all Host Offers for this Pack were already retired.',
        },
      },
    )

  console.log(
    `\nRetired ${result.modifiedCount} stale published ProductVersion record(s).`,
  )

  const remainingTargets =
    await findTargets()

  if (remainingTargets.length) {
    console.table(
      remainingTargets.map((version) => ({
        productVersionId:
          String(
            version._id,
          ),
        displayName:
          version.displayName,
        gtin:
          version.gtin ||
          '',
      })),
    )

    throw new Error(
      'Reconciliation verification failed: stale published ProductVersions still remain.',
    )
  }

  console.log(
    '\nReconciliation verified. Packs with only retired Host Offers no longer have published ProductVersions.',
  )
}

main()
  .catch((error) => {
    console.error(
      '\nRetired-listing reconciliation failed:',
      error,
    )

    process.exitCode = 1
  })
  .finally(async () => {
    if (
      mongoose.connection.readyState !==
      0
    ) {
      await disconnectDatabase()
    }
  })
