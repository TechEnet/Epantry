import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  buildPublicProductPipeline,
  listPublicProducts,
} from '../catalog/catalog.public.service.js'

import {
  Brand,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  buildCurrentPublishedPackVersionFilter,
} from '../marketplace/marketplace.host.service.js'

import {
  BrandAuthorityGrant,
} from './brandAuthority.models.js'

function stringifyId(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return null
  }

  return String(
    value,
  )
}

function escapeRegex(
  value,
) {
  return String(
    value ||
      '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function normalizePublicSlugPart(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    )
}

export function buildBrandWorldProductSlug({
  family,
  variant,
  pack,
}) {
  const familySlug =
    family?.slug ||
    normalizePublicSlugPart(
      family?.name ||
        family?.displayName,
    )

  const variantKey =
    variant?.variantKey ||
    variant?.slug ||
    normalizePublicSlugPart(
      variant?.name ||
        variant?.displayName,
    )

  const packKey =
    pack?.packKey ||
    pack?.slug ||
    normalizePublicSlugPart(
      pack?.name ||
        pack?.displayName,
    )

  if (
    !familySlug ||
    !variantKey ||
    !packKey
  ) {
    return null
  }

  return `${familySlug}--${variantKey}--${packKey}`
}

function serializePrimaryImage(
  images,
) {
  const normalized =
    (
      Array.isArray(
        images,
      )
        ? images
        : []
    )
      .map(
        (image) => ({
          url:
            image?.url ||
            '',

          alt:
            image?.alt ||
            '',

          sortOrder:
            Number(
              image?.sortOrder ||
                0,
            ),
        }),
      )
      .filter(
        (image) =>
          Boolean(
            image.url,
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.sortOrder -
          right.sortOrder,
      )

  return (
    normalized[0] ||
    null
  )
}

function buildBrandIdentityFilter(
  brandKey,
) {
  if (
    mongoose.Types.ObjectId.isValid(
      brandKey,
    )
  ) {
    return {
      _id:
        brandKey,

      status:
        'active',
    }
  }

  return {
    slug:
      brandKey,

    status:
      'active',
  }
}

export function serializePublicBrand(
  brand,
  verification = null,
) {
  const value =
    typeof brand?.toObject ===
      'function'
      ? brand.toObject()
      : brand

  if (!value) {
    return null
  }

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    name:
      value.name ||
      value.displayName ||
      '',

    displayName:
      value.displayName ||
      value.name ||
      '',

    slug:
      value.slug ||
      '',

    description:
      value.description ||
      '',

    website:
      value.website ||
      value.websiteUrl ||
      null,

    countryCode:
      value.countryCode ||
      value.countryOfOrigin ||
      null,

    verified:
      verification?.verified ===
      true,

    verifiedMarkets:
      verification?.marketCodes ||
      [],

    authorityTypes:
      verification?.authorityTypes ||
      [],
  }
}

export function serializePublicBrandVersionHistory(
  version,
) {
  const value =
    typeof version?.toObject ===
      'function'
      ? version.toObject()
      : version

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    versionNumber:
      value.versionNumber ??
      value.version ??
      value.sequence ??
      null,

    status:
      value.status,

    effectiveFrom:
      value.effectiveFrom ||
      null,

    effectiveTo:
      value.effectiveTo ||
      null,

    publishedAt:
      value.publishedAt ||
      null,

    retiredAt:
      value.retiredAt ||
      null,

    changeReason:
      value.changeReason ||
      '',

    createdAt:
      value.createdAt ||
      null,
  }
}

async function loadPublicVerificationMap(
  brandIds,
  now = new Date(),
) {
  if (
    brandIds.length ===
    0
  ) {
    return new Map()
  }

  const authorities =
    await BrandAuthorityGrant.find({
      brandId: {
        $in:
          brandIds,
      },

      status:
        'active',

      validFrom: {
        $lte:
          now,
      },

      $or: [
        {
          validUntil:
            null,
        },

        {
          validUntil: {
            $gt:
              now,
          },
        },
      ],
    })
      .select({
        brandId:
          1,

        marketCodes:
          1,

        authorityType:
          1,
      })
      .lean()

  const map =
    new Map()

  for (
    const authority of
    authorities
  ) {
    const brandId =
      String(
        authority.brandId,
      )

    const current =
      map.get(
        brandId,
      ) || {
        verified:
          true,

        marketCodes:
          new Set(),

        authorityTypes:
          new Set(),
      }

    for (
      const market of
      authority.marketCodes ||
      []
    ) {
      current.marketCodes.add(
        market,
      )
    }

    if (
      authority.authorityType
    ) {
      current.authorityTypes.add(
        authority.authorityType,
      )
    }

    map.set(
      brandId,
      current,
    )
  }

  return new Map(
    [
      ...map.entries(),
    ].map(
      (
        [
          brandId,
          value,
        ],
      ) => [
        brandId,
        {
          verified:
            true,

          marketCodes: [
            ...value.marketCodes,
          ].sort(),

          authorityTypes: [
            ...value.authorityTypes,
          ].sort(),
        },
      ],
    ),
  )
}

async function loadPublicProductCountMap(
  brandIds,
  now = new Date(),
) {
  if (
    brandIds.length ===
    0
  ) {
    return new Map()
  }

  const allowedBrandIds =
    new Set(
      brandIds.map(
        (
          brandId,
        ) =>
          String(
            brandId,
          ),
      ),
    )

  const counts =
    new Map()

  const countedPackIds =
    new Set()

  const limit =
    100

  let page =
    1

  while (true) {
    const [
      result = {
        data:
          [],

        metadata:
          [],
      },
    ] =
      await ProductVersion.aggregate(
        buildPublicProductPipeline({
          page,

          limit,

          listedOnly:
            false,

          now,
        }),
      )

    const products =
      result.data ||
      []

    for (
      const product of
      products
    ) {
      const brandId =
        stringifyId(
          product?.brand?._id ||
            product?.brand?.id,
        )

      const packId =
        stringifyId(
          product?.pack?._id ||
            product?.pack?.id ||
            product?.packId,
        )

      if (
        !brandId ||
        !packId ||
        !allowedBrandIds.has(
          brandId,
        ) ||
        countedPackIds.has(
          packId,
        )
      ) {
        continue
      }

      countedPackIds.add(
        packId,
      )

      counts.set(
        brandId,
        (
          counts.get(
            brandId,
          ) ||
          0
        ) +
          1,
      )
    }

    const total =
      Number(
        result.metadata?.[0]
          ?.total ||
          0,
      )

    if (
      page *
        limit >=
      total
    ) {
      break
    }

    page +=
      1
  }

  return counts
}

export async function listPublicBrandWorlds({
  page,
  limit,
  search,
}) {
  const filter = {
    status:
      'active',
  }

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        'i',
      )

    filter.$or = [
      {
        name:
          expression,
      },

      {
        displayName:
          expression,
      },

      {
        slug:
          expression,
      },
    ]
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    brands,
    total,
  ] =
    await Promise.all([
      Brand.find(
        filter,
      )
        .sort({
          name:
            1,

          _id:
            1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      Brand.countDocuments(
        filter,
      ),
    ])

  const brandIds =
    brands.map(
      (
        brand,
      ) =>
        brand._id,
    )

  const [
    verificationMap,
    productCountMap,
  ] =
    await Promise.all([
      loadPublicVerificationMap(
        brandIds,
      ),

      loadPublicProductCountMap(
        brandIds,
      ),
    ])

  return {
    brands:
      brands.map(
        (
          brand,
        ) => ({
          ...serializePublicBrand(
            brand,
            verificationMap.get(
              String(
                brand._id,
              ),
            ),
          ),

          productCount:
            productCountMap.get(
              String(
                brand._id,
              ),
            ) ||
            0,
        }),
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  }
}

async function requirePublicBrand(
  brandKey,
) {
  const brand =
    await Brand.findOne(
      buildBrandIdentityFilter(
        brandKey,
      ),
    ).lean()

  if (!brand) {
    throw new ApiError(
      404,
      'Brand was not found.',
      [
        {
          code:
            'BRAND_WORLD_NOT_FOUND',
        },
      ],
    )
  }

  return brand
}

async function loadCurrentPublishedPackVersion(
  packId,
  now,
) {
  return ProductVersion.findOne(
    buildCurrentPublishedPackVersionFilter(
      packId,
      now,
    ),
  )
    .sort({
      effectiveFrom:
        -1,

      createdAt:
        -1,

      _id:
        -1,
    })
    .lean()
}

export async function getPublicBrandWorld(
  brandKey,
) {
  const now =
    new Date()

  const brand =
    await requirePublicBrand(
      brandKey,
    )

  const verificationMap =
    await loadPublicVerificationMap(
      [
        brand._id,
      ],
      now,
    )

  /*
  |--------------------------------------------------------------------------
  | Resolve Brand products from the same public Grocery truth
  |--------------------------------------------------------------------------
  |
  | Brand World must show the same currently published canonical products
  | resolved by the public Catalog pipeline. Resolving products again via
  | independent Family -> Variant -> Pack -> ProductVersion queries can drift
  | after governed retire/re-publish/re-list cycles.
  |
  | The shared public Product pipeline already resolves the current hierarchy,
  | publication window. Reuse it here so a current published ProductVersion
  | cannot disappear from its Brand World because of a second lookup path.
  |
  */

  const brandSlug =
    brand.slug ||
    normalizePublicSlugPart(
      brand.name ||
        brand.displayName,
    )

  const listedProducts =
    []

  const pageSize =
    100

  let page =
    1

  while (true) {
    const [
      result = {
        data:
          [],

        metadata:
          [],
      },
    ] =
      await ProductVersion.aggregate(
        buildPublicProductPipeline({
          page,

          limit:
            pageSize,

          brandSlug,

          listedOnly:
            false,

          now,
        }),
      )

    listedProducts.push(
      ...(result.data || []),
    )

    const total =
      Number(
        result.metadata?.[0]
          ?.total ||
          0,
      )

    if (
      page *
        pageSize >=
      total
    ) {
      break
    }

    page +=
      1
  }

  /*
  |--------------------------------------------------------------------------
  | Resolve the same privacy-cleared public image used by Grocery
  |--------------------------------------------------------------------------
  |
  | The raw canonical aggregate above intentionally preserves the existing
  | Brand World product data/structure, but it does not run the public image
  | enrichment step. Host NPI package images can therefore be visible on the
  | Grocery page while `version.images` is empty here.
  |
  | Read only the public image projection through the existing Grocery service
  | and map it back by ProductVersion ID. No other Brand World data is replaced.
  |
  */

  const publicImageByVersionId =
    new Map()

  let imagePage =
    1

  while (true) {
    const imageResult =
      await listPublicProducts({
        page:
          imagePage,

        limit:
          pageSize,

        brandSlug,

        listedOnly:
          false,
      })

    for (
      const product of
      imageResult.products || []
    ) {
      const productVersionId =
        stringifyId(
          product.productVersionId ||
            product.id,
        )

      if (
        productVersionId &&
        product.image?.url
      ) {
        publicImageByVersionId.set(
          productVersionId,
          product.image,
        )
      }
    }

    const totalPages =
      Number(
        imageResult.pagination?.pages ||
          0,
      )

    if (
      totalPages === 0 ||
      imagePage >= totalPages
    ) {
      break
    }

    imagePage +=
      1
  }

  const familyMap =
    new Map()

  for (
    const version of
    listedProducts
  ) {
    const family =
      version.family ||
      {}

    const variant =
      version.variant ||
      {}

    const pack =
      version.pack ||
      {}

    const familyId =
      stringifyId(
        family._id ||
          family.id,
      )

    const variantId =
      stringifyId(
        variant._id ||
          variant.id ||
          version.variantId,
      )

    const packId =
      stringifyId(
        pack._id ||
          pack.id ||
          version.packId,
      )

    if (
      !familyId ||
      !variantId ||
      !packId
    ) {
      continue
    }

    const productSlug =
      buildBrandWorldProductSlug({
        family: {
          ...family,

          name:
            family.canonicalName ||
            family.name ||
            family.displayName ||
            '',
        },

        variant: {
          ...variant,

          name:
            variant.canonicalName ||
            variant.name ||
            variant.displayName ||
            '',
        },

        pack,
      })

    const familyGroup =
      familyMap.get(
        familyId,
      ) || {
        id:
          familyId,

        name:
          family.canonicalName ||
          family.displayName ||
          family.name ||
          '',

        slug:
          family.slug ||
          '',

        products:
          [],
      }

    familyGroup.products.push({
      packId,

      productFamilyId:
        familyId,

      productVariantId:
        variantId,

      familyName:
        family.canonicalName ||
        family.displayName ||
        family.name ||
        '',

      variantName:
        variant.canonicalName ||
        variant.displayName ||
        variant.name ||
        '',

      packName:
        pack.displayName ||
        pack.name ||
        '',

      packType:
        pack.packType ||
        pack.type ||
        null,

      productSlug,

      productPath:
        productSlug
          ? `/grocery/product/${productSlug}`
          : null,

      currentVersion: {
        id:
          stringifyId(
            version._id ||
              version.id,
          ),

        displayName:
          version.displayName ||
          family.canonicalName ||
          family.displayName ||
          family.name ||
          '',

        description:
          version.description ||
          family.description ||
          '',

        gtin:
          version.gtin ||
          null,

        netQuantity:
          version.netQuantity ||
          null,

        effectiveFrom:
          version.effectiveFrom ||
          null,

        publishedAt:
          version.publishedAt ||
          null,

        image:
          publicImageByVersionId.get(
            stringifyId(
              version._id ||
                version.id,
            ),
          ) ||
          serializePrimaryImage(
            version.images,
          ),
      },

      historyAvailable:
        true,
    })

    familyMap.set(
      familyId,
      familyGroup,
    )
  }

  const familyGroups =
    [
      ...familyMap.values(),
    ]
      .map(
        (
          family,
        ) => ({
          ...family,

          products:
            family.products.sort(
              (
                left,
                right,
              ) =>
                String(
                  left.currentVersion?.displayName ||
                    '',
                ).localeCompare(
                  String(
                    right.currentVersion?.displayName ||
                      '',
                  ),
                ),
            ),
        }),
      )
      .sort(
        (
          left,
          right,
        ) =>
          String(
            left.name ||
              '',
          ).localeCompare(
            String(
              right.name ||
                '',
            ),
          ),
      )

  return {
    brand:
      serializePublicBrand(
        brand,
        verificationMap.get(
          String(
            brand._id,
          ),
        ),
      ),

    productFamilies:
      familyGroups,

    productCount:
      familyGroups.reduce(
        (
          total,
          family,
        ) =>
          total +
          family.products.length,
        0,
      ),
  }
}

export async function getPublicBrandProductHistory({
  brandKey,
  packId,
}) {
  const brand =
    await requirePublicBrand(
      brandKey,
    )

  const pack =
    await Pack.findOne({
      _id:
        packId,

      status:
        'active',
    }).lean()

  if (!pack) {
    throw new ApiError(
      404,
      'Pack was not found.',
      [
        {
          code:
            'BRAND_WORLD_PACK_NOT_FOUND',
        },
      ],
    )
  }

  const variant =
    await ProductVariant.findOne({
      _id:
        pack.productVariantId,

      status:
        'active',
    }).lean()

  if (!variant) {
    throw new ApiError(
      404,
      'Product Variant was not found.',
      [
        {
          code:
            'BRAND_WORLD_VARIANT_NOT_FOUND',
        },
      ],
    )
  }

  const family =
    await ProductFamily.findOne({
      _id:
        variant.productFamilyId,

      brandId:
        brand._id,

      status:
        'active',
    }).lean()

  if (!family) {
    throw new ApiError(
      404,
      'Pack does not belong to this Brand.',
      [
        {
          code:
            'BRAND_WORLD_PACK_BRAND_MISMATCH',
        },
      ],
    )
  }

  const versions =
    await ProductVersion.find({
      packId:
        pack._id,

      status: {
        $in: [
          'published',
          'retired',
        ],
      },
    })
      .sort({
        createdAt:
          -1,

        _id:
          -1,
      })
      .lean()

  return {
    brand: {
      id:
        stringifyId(
          brand._id,
        ),

      name:
        brand.displayName ||
        brand.name ||
        '',

      slug:
        brand.slug ||
        '',
    },

    product: {
      productFamilyId:
        stringifyId(
          family._id,
        ),

      productVariantId:
        stringifyId(
          variant._id,
        ),

      packId:
        stringifyId(
          pack._id,
        ),

      familyName:
        family.displayName ||
        family.name ||
        '',

      variantName:
        variant.displayName ||
        variant.name ||
        '',

      packName:
        pack.displayName ||
        pack.name ||
        '',
    },

    history:
      versions.map(
        serializePublicBrandVersionHistory,
      ),
  }
}