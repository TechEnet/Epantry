import crypto from 'crypto'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  requireLearnerCourseAccess,
} from './learning.access.service.js'

import {
  CourseLesson,
  CourseMediaAsset,
} from './learning.models.js'

function clean(value) {
  return String(value || '').trim()
}

function encodeCloudinaryPublicPath(value) {
  return clean(value)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function urlSafeBase64Sha1(value) {
  return crypto
    .createHash('sha1')
    .update(value)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function resolveExternalHttps(assetReference) {
  let url

  try {
    url = new URL(assetReference)
  } catch {
    throw new ApiError(
      409,
      'Learning media URL is invalid.',
      [
        {
          code: 'LEARNING_MEDIA_URL_INVALID',
        },
      ],
    )
  }

  if (url.protocol !== 'https:') {
    throw new ApiError(
      409,
      'Learning media delivery requires HTTPS.',
      [
        {
          code: 'LEARNING_MEDIA_HTTPS_REQUIRED',
        },
      ],
    )
  }

  return url.toString()
}

function parseCloudinaryReference(assetReference) {
  const normalized = clean(assetReference)
  const match = normalized.match(/^v(\d+)\/(.+)\.([a-z0-9]{2,12})$/i)

  if (!match) {
    throw new ApiError(
      409,
      'Cloudinary learning asset reference must use v<version>/<public-id>.<format>.',
      [
        {
          code: 'LEARNING_CLOUDINARY_REFERENCE_INVALID',
        },
      ],
    )
  }

  return {
    version: Number(match[1]),
    publicId: match[2],
    format: match[3].toLowerCase(),
  }
}

function buildCloudinaryAuthenticatedUrl({
  assetReference,
  resourceType,
}) {
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME)
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET)

  if (!cloudName || !apiSecret) {
    throw new ApiError(
      503,
      'Authenticated learning media delivery is not configured.',
      [
        {
          code: 'LEARNING_MEDIA_PROVIDER_NOT_CONFIGURED',
        },
      ],
    )
  }

  const {
    version,
    publicId,
    format,
  } = parseCloudinaryReference(assetReference)

  const deliveryPath =
    `v${version}/${publicId}.${format}`

  const signature = urlSafeBase64Sha1(
    `${deliveryPath}${apiSecret}`,
  ).slice(0, 8)

  return (
    `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/` +
    `${resourceType}/authenticated/s--${signature}--/` +
    `v${version}/${encodeCloudinaryPublicPath(publicId)}.${encodeURIComponent(format)}`
  )
}

function resolveDeliveryUrl(media) {
  switch (media.storageProvider) {
    case 'external_https':
      return resolveExternalHttps(media.assetReference)

    case 'cloudinary_authenticated_video':
      return buildCloudinaryAuthenticatedUrl({
        assetReference: media.assetReference,
        resourceType: 'video',
      })

    case 'cloudinary_authenticated_raw':
      return buildCloudinaryAuthenticatedUrl({
        assetReference: media.assetReference,
        resourceType: 'raw',
      })

    default:
      throw new ApiError(
        409,
        'This learning media provider does not have a configured delivery resolver.',
        [
          {
            code: 'LEARNING_MEDIA_PROVIDER_UNSUPPORTED',
            provider: media.storageProvider,
          },
        ],
      )
  }
}

export async function resolveLearningMediaDelivery({
  courseId,
  lessonId,
  mediaId,
  actorUser,
}) {
  const lesson = await CourseLesson.findOne({
    _id: lessonId,
    courseId,
    status: 'published',
  }).lean()

  if (!lesson) {
    throw new ApiError(
      404,
      'Published course lesson was not found.',
      [
        {
          code: 'LEARNING_LESSON_NOT_FOUND',
        },
      ],
    )
  }

  const access = await requireLearnerCourseAccess({
    courseId,
    actorUser,
    lesson,
    allowPreview: true,
  })

  const media = await CourseMediaAsset.findOne({
    _id: mediaId,
    courseId,
    lessonId,
    availabilityState: 'available',
  }).lean()

  if (!media) {
    throw new ApiError(
      404,
      'Available course media was not found.',
      [
        {
          code: 'LEARNING_MEDIA_NOT_FOUND',
        },
      ],
    )
  }

  const deliveryUrl = resolveDeliveryUrl(media)

  return {
    media: {
      id: String(media._id),
      mediaType: media.mediaType,
      language: media.language || '',
      label: media.label || '',
      mimeType: media.mimeType || '',
      durationSeconds: media.durationSeconds || 0,
      downloadable: media.downloadable === true,
    },
    delivery: {
      url: deliveryUrl,
      purpose:
        media.downloadable === true
          ? 'playback_or_download'
          : 'playback',
      cachePolicy: 'private_no_store',
    },
    access: {
      accessReason: access.accessReason,
      entitlementId: access.entitlement?._id
        ? String(access.entitlement._id)
        : null,
    },
    policy: {
      stableStorageReferenceExposed: false,
      learnerAccessCheckedBeforeDelivery: true,
    },
  }
}
