import crypto from 'crypto'

const MAX_BYTES =
  8 *
  1024 *
  1024

const MIME_TYPES =
  Object.freeze([
    'image/jpeg',
    'image/png',
    'image/webp',
  ])

const FORMATS =
  new Set([
    'jpg',
    'jpeg',
    'png',
    'webp',
  ])

const FORMAT_MIME =
  Object.freeze({
    jpg:
      'image/jpeg',

    jpeg:
      'image/jpeg',

    png:
      'image/png',

    webp:
      'image/webp',
  })

const clean = (
  value,
) =>
  String(
    value || '',
  ).trim()

function config() {
  return {
    cloudName:
      clean(
        process.env
          .CLOUDINARY_CLOUD_NAME,
      ),

    apiKey:
      clean(
        process.env
          .CLOUDINARY_API_KEY,
      ),

    apiSecret:
      clean(
        process.env
          .CLOUDINARY_API_SECRET,
      ),
  }
}

function requireConfig() {
  const value =
    config()

  if (
    !value.cloudName ||
    !value.apiKey ||
    !value.apiSecret
  ) {
    const error =
      new Error(
        'Cloudinary product-evidence integration is not configured.',
      )

    error.code =
      'CLOUDINARY_NOT_CONFIGURED'

    throw error
  }

  return value
}

const sha1Hex = (
  value,
) =>
  crypto
    .createHash(
      'sha1',
    )
    .update(
      value,
    )
    .digest(
      'hex',
    )

function signParams(
  params,
  secret,
) {
  const serialized =
    Object
      .entries(
        params,
      )
      .filter(
        ([
          ,
          value,
        ]) =>
          value !==
            undefined &&
          value !==
            null &&
          value !==
            '',
      )
      .sort(
        (
          [a],
          [b],
        ) =>
          a.localeCompare(
            b,
          ),
      )
      .map(
        ([
          key,
          value,
        ]) =>
          `${key}=${
            Array.isArray(
              value,
            )
              ? value.join(',')
              : value
          }`,
      )
      .join('&')

  return sha1Hex(
    `${serialized}${secret}`,
  )
}

function userPrefix(
  userId,
) {
  const safe =
    clean(
      userId,
    ).replace(
      /[^a-zA-Z0-9_-]/g,
      '',
    )

  return `epantry/product-evidence/${safe}/privacy-v1`
}

function uploadFolder(
  userId,
) {
  return (
    `${userPrefix(
      userId,
    )}/` +
    new Date()
      .toISOString()
      .slice(
        0,
        7,
      )
  )
}

export function createProductEvidenceUploadIntent({
  userId,
  purpose,
}) {
  const value =
    requireConfig()

  const timestamp =
    Math.floor(
      Date.now() /
        1000,
    )

  const publicId =
    `${uploadFolder(
      userId,
    )}/${clean(
      purpose,
    ) ||
      'other'}-${crypto.randomUUID()}`

  const signedParameters = {
    allowed_formats:
      'jpg,jpeg,png,webp',

    overwrite:
      false,

    public_id:
      publicId,

    timestamp,

    transformation:
      'c_limit,h_4096,w_4096',

    type:
      'authenticated',
  }

  return {
    provider:
      'cloudinary',

    uploadUrl:
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(
        value.cloudName,
      )}/image/upload`,

    cloudName:
      value.cloudName,

    apiKey:
      value.apiKey,

    resourceType:
      'image',

    deliveryType:
      'authenticated',

    publicId,

    timestamp,

    signature:
      signParams(
        signedParameters,
        value.apiSecret,
      ),

    signedParameters,

    constraints: {
      maxBytes:
        MAX_BYTES,

      allowedMimeTypes:
        MIME_TYPES,
    },
  }
}

function retailMediaImageUserPrefix(
  userId,
) {
  const safe =
    clean(
      userId,
    ).replace(
      /[^a-zA-Z0-9_-]/g,
      '',
    )

  return `epantry/retail-media/${safe}/public-v1`
}

function retailMediaImageUploadFolder(
  userId,
) {
  return (
    `${retailMediaImageUserPrefix(
      userId,
    )}/` +
    new Date()
      .toISOString()
      .slice(
        0,
        7,
      )
  )
}

export function createRetailMediaImageUploadIntent({
  userId,
}) {
  const value =
    requireConfig()

  const timestamp =
    Math.floor(
      Date.now() /
        1000,
    )

  const publicId =
    `${retailMediaImageUploadFolder(
      userId,
    )}/creative-${crypto.randomUUID()}`

  const signedParameters = {
    allowed_formats:
      'jpg,jpeg,png,webp',

    overwrite:
      false,

    public_id:
      publicId,

    timestamp,

    transformation:
      'c_limit,h_1600,w_2400',

    type:
      'upload',
  }

  return {
    provider:
      'cloudinary',

    uploadUrl:
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(
        value.cloudName,
      )}/image/upload`,

    cloudName:
      value.cloudName,

    apiKey:
      value.apiKey,

    resourceType:
      'image',

    deliveryType:
      'upload',

    publicId,

    timestamp,

    signature:
      signParams(
        signedParameters,
        value.apiSecret,
      ),

    signedParameters,

    constraints: {
      maxBytes:
        MAX_BYTES,

      allowedMimeTypes:
        MIME_TYPES,
    },
  }
}

function recipeImageUserPrefix(
  userId,
) {
  const safe =
    clean(
      userId,
    ).replace(
      /[^a-zA-Z0-9_-]/g,
      '',
    )

  return `epantry/recipe-images/${safe}/public-v1`
}

function recipeImageUploadFolder(
  userId,
) {
  return (
    `${recipeImageUserPrefix(
      userId,
    )}/` +
    new Date()
      .toISOString()
      .slice(
        0,
        7,
      )
  )
}

export function createRecipeImageUploadIntent({
  userId,
}) {
  const value =
    requireConfig()

  const timestamp =
    Math.floor(
      Date.now() /
        1000,
    )

  const publicId =
    `${recipeImageUploadFolder(
      userId,
    )}/hero-${crypto.randomUUID()}`

  const signedParameters = {
    allowed_formats:
      'jpg,jpeg,png,webp',

    overwrite:
      false,

    public_id:
      publicId,

    timestamp,

    transformation:
      'c_limit,h_2048,w_2048',

    type:
      'upload',
  }

  return {
    provider:
      'cloudinary',

    uploadUrl:
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(
        value.cloudName,
      )}/image/upload`,

    cloudName:
      value.cloudName,

    apiKey:
      value.apiKey,

    resourceType:
      'image',

    deliveryType:
      'upload',

    publicId,

    timestamp,

    signature:
      signParams(
        signedParameters,
        value.apiSecret,
      ),

    signedParameters,

    constraints: {
      maxBytes:
        MAX_BYTES,

      allowedMimeTypes:
        MIME_TYPES,
    },
  }
}

// Host listing media only. Existing Recipe, Profile and Product Evidence
// upload intents retain their existing behaviour and delivery policies.
// Incoming transformations normalize and compress the STORED asset, not just
// its CDN delivery. Never use f_auto in an incoming transformation.
export function createHostListingImageUploadIntent({ userId }) {
  const cloud = requireConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = `${recipeImageUploadFolder(userId)}/listing-image-${crypto.randomUUID()}`
  const signedParameters = {
    allowed_formats: 'jpg,jpeg,png,webp',
    overwrite: false,
    public_id: publicId,
    timestamp,
    transformation: 'c_limit,h_2048,w_2048,q_auto:good,f_webp',
    type: 'upload',
  }
  return {
    provider: 'cloudinary',
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud.cloudName)}/image/upload`,
    cloudName: cloud.cloudName,
    apiKey: cloud.apiKey,
    resourceType: 'image',
    deliveryType: 'upload',
    publicId,
    timestamp,
    signature: signParams(signedParameters, cloud.apiSecret),
    signedParameters,
    constraints: { maxBytes: MAX_BYTES, allowedMimeTypes: MIME_TYPES, outputFormat: 'webp' },
  }
}

function profilePhotoUserPrefix(
  userId,
) {
  const safe =
    clean(
      userId,
    ).replace(
      /[^a-zA-Z0-9_-]/g,
      '',
    )

  return `epantry/profile-photos/${safe}/public-v1`
}

function profilePhotoUploadFolder(
  userId,
) {
  return (
    `${profilePhotoUserPrefix(
      userId,
    )}/` +
    new Date()
      .toISOString()
      .slice(
        0,
        7,
      )
  )
}

export function createProfilePhotoUploadIntent({
  userId,
}) {
  const value =
    requireConfig()

  const timestamp =
    Math.floor(
      Date.now() /
        1000,
    )

  const publicId =
    `${profilePhotoUploadFolder(
      userId,
    )}/avatar-${crypto.randomUUID()}`

  const signedParameters = {
    allowed_formats:
      'jpg,jpeg,png,webp',

    overwrite:
      false,

    public_id:
      publicId,

    timestamp,

    transformation:
      'c_limit,h_1024,w_1024',

    type:
      'upload',
  }

  return {
    provider:
      'cloudinary',

    uploadUrl:
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(
        value.cloudName,
      )}/image/upload`,

    cloudName:
      value.cloudName,

    apiKey:
      value.apiKey,

    resourceType:
      'image',

    deliveryType:
      'upload',

    publicId,

    timestamp,

    signature:
      signParams(
        signedParameters,
        value.apiSecret,
      ),

    signedParameters,

    constraints: {
      maxBytes:
        MAX_BYTES,

      allowedMimeTypes:
        MIME_TYPES,
    },
  }
}

async function fetchMetadata(
  publicId,
) {
  const value =
    requireConfig()

  const controller =
    new AbortController()

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      8000,
    )

  try {
    const response =
      await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(
          value.cloudName,
        )}/resources/image/authenticated/${encodeURIComponent(
          publicId,
        )}`,
        {
          method:
            'GET',

          headers: {
            Authorization:
              `Basic ${Buffer.from(
                `${value.apiKey}:${value.apiSecret}`,
              ).toString(
                'base64',
              )}`,

            Accept:
              'application/json',
          },

          signal:
            controller.signal,
        },
      )

    if (
      !response.ok
    ) {
      const error =
        new Error(
          `Cloudinary evidence metadata lookup failed with status ${response.status}.`,
        )

      error.code =
        'CLOUDINARY_EVIDENCE_METADATA_FAILED'

      throw error
    }

    return response.json()
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      const timeoutError =
        new Error(
          'Cloudinary evidence metadata lookup timed out.',
        )

      timeoutError.code =
        'CLOUDINARY_EVIDENCE_METADATA_TIMEOUT'

      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(
      timeout,
    )
  }
}

export async function verifyProductEvidenceUploadResult(
  input,
) {
  const value =
    requireConfig()

  const publicId =
    clean(
      input.publicId,
    )

  const version =
    Number(
      input.version,
    )

  if (
    !publicId.startsWith(
      `${userPrefix(
        input.userId,
      )}/`,
    )
  ) {
    const error =
      new Error(
        'Cloudinary evidence asset is outside the authenticated user upload scope.',
      )

    error.code =
      'CLOUDINARY_EVIDENCE_SCOPE_INVALID'

    throw error
  }

  if (
    !Number.isInteger(
      version,
    ) ||
    version <= 0
  ) {
    const error =
      new Error(
        'Cloudinary evidence version is invalid.',
      )

    error.code =
      'CLOUDINARY_EVIDENCE_VERSION_INVALID'

    throw error
  }

  const expected =
    sha1Hex(
      `public_id=${publicId}&version=${version}${value.apiSecret}`,
    )

  const supplied =
    clean(
      input.signature,
    ).toLowerCase()

  const match =
    supplied.length ===
      expected.length &&
    crypto.timingSafeEqual(
      Buffer.from(
        supplied,
      ),
      Buffer.from(
        expected,
      ),
    )

  if (
    !match
  ) {
    const error =
      new Error(
        'Cloudinary upload response signature is invalid.',
      )

    error.code =
      'CLOUDINARY_RESPONSE_SIGNATURE_INVALID'

    throw error
  }

  const format =
    clean(
      input.format,
    ).toLowerCase()

  const mimeType =
    clean(
      input.mimeType,
    ).toLowerCase()

  const bytes =
    Number(
      input.bytes,
    )

  if (
    !FORMATS.has(
      format,
    ) ||
    !MIME_TYPES.includes(
      mimeType,
    ) ||
    FORMAT_MIME[
      format
    ] !==
      mimeType
  ) {
    const error =
      new Error(
        'Unsupported or inconsistent product evidence image type.',
      )

    error.code =
      'PRODUCT_EVIDENCE_TYPE_UNSUPPORTED'

    throw error
  }

  if (
    !Number.isInteger(
      bytes,
    ) ||
    bytes <= 0 ||
    bytes >
      MAX_BYTES
  ) {
    const error =
      new Error(
        'Product evidence image exceeds the allowed size.',
      )

    error.code =
      'PRODUCT_EVIDENCE_SIZE_INVALID'

    throw error
  }

  if (
    input.resourceType !==
      'image' ||
    input.deliveryType !==
      'authenticated'
  ) {
    const error =
      new Error(
        'Product evidence must use authenticated Cloudinary image delivery.',
      )

    error.code =
      'PRODUCT_EVIDENCE_DELIVERY_INVALID'

    throw error
  }

  const metadata =
    await fetchMetadata(
      publicId,
    )

  const actualFormat =
    clean(
      metadata?.format,
    ).toLowerCase()

  const actualBytes =
    Number(
      metadata?.bytes,
    )

  const actualVersion =
    Number(
      metadata?.version,
    )

  if (
    actualVersion !==
      version ||
    actualFormat !==
      format ||
    actualBytes !==
      bytes ||
    metadata?.resource_type !==
      'image' ||
    metadata?.type !==
      'authenticated'
  ) {
    const error =
      new Error(
        'Cloudinary evidence metadata does not match the signed upload result.',
      )

    error.code =
      'CLOUDINARY_EVIDENCE_METADATA_MISMATCH'

    throw error
  }

  return {
    providerAssetId:
      clean(
        metadata?.asset_id,
      ),

    publicId,

    version:
      actualVersion,

    format:
      actualFormat,

    mimeType,

    bytes:
      actualBytes,

    width:
      Number.isFinite(
        Number(
          metadata?.width,
        ),
      )
        ? Number(
            metadata.width,
          )
        : null,

    height:
      Number.isFinite(
        Number(
          metadata?.height,
        ),
      )
        ? Number(
            metadata.height,
          )
        : null,
  }
}

function urlSafeBase64Sha1(
  value,
) {
  return crypto
    .createHash(
      'sha1',
    )
    .update(
      value,
    )
    .digest(
      'base64',
    )
    .replace(
      /\+/g,
      '-',
    )
    .replace(
      /\//g,
      '_',
    )
    .replace(
      /=+$/,
      '',
    )
}

export function buildSignedProductEvidenceUrl({
  publicId,
  version,
  format,
}) {
  const value =
    requireConfig()

  const deliveryPath =
    `v${Number(
      version,
    )}/${clean(
      publicId,
    )}.${clean(
      format,
    ).toLowerCase()}`

  const signature =
    urlSafeBase64Sha1(
      `${deliveryPath}${value.apiSecret}`,
    ).slice(
      0,
      8,
    )

  return (
    `https://res.cloudinary.com/${encodeURIComponent(
      value.cloudName,
    )}/image/authenticated/` +
    `s--${signature}--/${deliveryPath}`
  )
}

// Public Host food video upload only. Keep every existing product-evidence and
// recipe-image intent unchanged; videos have their own signed Cloudinary scope.
export function createHostListingVideoUploadIntent({ userId }) {
  const cloud = requireConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = `${recipeImageUploadFolder(userId)}/listing-video-${crypto.randomUUID()}`
  const signedParameters = {
    allowed_formats: 'mp4,webm',
    overwrite: false,
    public_id: publicId,
    timestamp,
    // Incoming Cloudinary video transcode: store a web-ready MP4 (H.264),
    // with content-aware quality compression and no upscaling above 1080p.
    // Unlike a delivery-only URL, this actually optimizes the stored video.
    transformation: 'c_limit,h_1080,w_1920,q_auto:good,vc_h264,f_mp4',
    type: 'upload',
  }
  return {
    provider: 'cloudinary',
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud.cloudName)}/video/upload`,
    cloudName: cloud.cloudName,
    apiKey: cloud.apiKey,
    resourceType: 'video',
    deliveryType: 'upload',
    publicId,
    timestamp,
    signature: signParams(signedParameters, cloud.apiSecret),
    signedParameters,
    constraints: { maxBytes: 50 * 1024 * 1024, allowedMimeTypes: ['video/mp4', 'video/webm'], outputFormat: 'mp4' },
  }
}
