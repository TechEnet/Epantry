// EPANTRY Host Bulk Listing: safely import PUBLIC Google Drive image files.
// Google Drive's /view and /uc URLs may return HTML rather than an image.
// Fetch validated image bytes server-side, then upload the bytes to Cloudinary.
// Never fetch a user-controlled arbitrary URL or follow a redirect off Google's
// image hosts. This file intentionally has no database or draft writes.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 20000
const CLOUDINARY_TIMEOUT_MS = 30000

function importError(message, code = 'MEDIA_IMPORT_FAILED') {
  const error = new Error(message)
  error.code = code
  return error
}

function allowedDriveSourceHost(hostname) {
  return hostname === 'drive.google.com' || hostname === 'www.drive.google.com'
}

function allowedDriveImageFetchHost(hostname) {
  return allowedDriveSourceHost(hostname)
    || hostname === 'drive.usercontent.google.com'
    || hostname === 'googleusercontent.com'
    || hostname.endsWith('.googleusercontent.com')
}

export function driveImageFileId(raw) {
  let url
  try { url = new URL(String(raw || '').trim()) } catch { return '' }
  if (url.protocol !== 'https:' || url.username || url.password || !allowedDriveSourceHost(url.hostname)) return ''
  if (/\/folders\//i.test(url.pathname)) return ''
  const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,})(?:\/|$)/)
  const id = match?.[1] || (['/open', '/uc', '/thumbnail'].includes(url.pathname) ? url.searchParams.get('id') : '') || ''
  return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : ''
}

export function validateImportedImageSource(raw, cloudName) {
  const urlText = String(raw || '').trim()
  if (!urlText || urlText.length > 1800) {
    throw importError('Use a public Google Drive image-file link or an EPANTRY Cloudinary image URL.', 'IMAGE_URL_INVALID')
  }
  let url
  try { url = new URL(urlText) } catch { throw importError('Invalid image URL.', 'IMAGE_URL_INVALID') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw importError('Only standard HTTPS image links without embedded credentials are supported.', 'IMAGE_URL_INVALID')
  }
  if (url.hostname === 'res.cloudinary.com') {
    const cloud = url.pathname.match(/^\/([^/]+)\/image\/upload\/[^?#]+$/)?.[1]
    if (!cloudName || cloud !== cloudName) {
      throw importError('Use an image uploaded to this EPANTRY Cloudinary account.', 'IMAGE_URL_INVALID')
    }
    return { kind: 'existing', imageUrl: url.href }
  }
  const id = driveImageFileId(urlText)
  if (!id) {
    throw importError('Only public Google Drive IMAGE FILE links or EPANTRY Cloudinary images are supported. Folder links cannot be imported.', 'IMAGE_URL_INVALID')
  }
  const resourceKey = url.searchParams.get('resourcekey') || ''
  if (resourceKey && !/^[A-Za-z0-9_-]{1,120}$/.test(resourceKey)) {
    throw importError('Invalid Google Drive resource key.', 'IMAGE_URL_INVALID')
  }
  return { kind: 'google_drive', id, resourceKey }
}

function cloudinarySettings() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim()
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim()
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim()
  if (!cloudName || !apiKey || !apiSecret || !/^[A-Za-z0-9_-]+$/.test(cloudName)) {
    throw importError('Cloudinary image uploads are not configured on the backend.', 'MEDIA_NOT_CONFIGURED')
  }
  return { cloudName, apiKey, apiSecret }
}

function imageMimeFromBytes(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return ''
}

async function readLimitedImage(response) {
  const claimed = Number(response.headers.get('content-length') || 0)
  if (claimed > MAX_IMAGE_BYTES) {
    throw importError('This Drive image exceeds 8 MB. Compress it or upload a smaller WebP/JPG/PNG.', 'IMAGE_TOO_LARGE')
  }
  if (!response.body) throw importError('Google Drive returned an empty image response.', 'DRIVE_EMPTY_FILE')
  const reader = response.body.getReader()
  const chunks = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => {})
        throw importError('This Drive image exceeds 8 MB. Compress it or upload a smaller WebP/JPG/PNG.', 'IMAGE_TOO_LARGE')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  const data = Buffer.concat(chunks, length)
  const mime = imageMimeFromBytes(data)
  if (!mime) {
    const preview = data.subarray(0, 220).toString('utf8').toLowerCase()
    if (/<(!doctype|html)|<head|<body|google drive|sign in|access denied/.test(preview)) {
      throw importError('Google Drive sent an HTML preview or sign-in page rather than image bytes. Confirm that the specific image file is shared with Anyone with the link as Viewer and allows downloads.', 'DRIVE_HTML_RESPONSE')
    }
    throw importError('The Drive file is not a supported JPG, PNG or WebP image. Download and re-upload it as an image.', 'IMAGE_FORMAT_UNSUPPORTED')
  }
  return { data, mime }
}

async function fetchImageWithSafeRedirects(sourceUrl) {
  let current = new URL(sourceUrl)
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'https:' || current.username || current.password || current.port || !allowedDriveImageFetchHost(current.hostname)) {
      throw importError('Google Drive redirected outside its approved download hosts. Image import was stopped for security.', 'DRIVE_UNSAFE_REDIRECT')
    }
    let response
    try {
      response = await fetch(current.href, {
        method: 'GET', redirect: 'manual', signal, cache: 'no-store',
        headers: { Accept: 'image/webp,image/jpeg,image/png,image/*;q=0.9,*/*;q=0.5' },
      })
    } catch (cause) {
      if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') {
        throw importError('Google Drive did not respond in time. Retry this Excel import after checking the file link.', 'DRIVE_TIMEOUT')
      }
      throw importError('Could not contact Google Drive for this image. Check the link and retry.', 'DRIVE_NETWORK_FAILED')
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel().catch(() => {})
      if (!location) throw importError('Drive redirected without a file location.', 'DRIVE_BAD_REDIRECT')
      current = new URL(location, current)
      continue
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      await response.body?.cancel().catch(() => {})
      throw importError('Google Drive denied access to this image (HTTP 401/403/404). Confirm that the individual image file is publicly readable; Drive may also block automated requests temporarily.', 'DRIVE_NOT_PUBLIC')
    }
    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel().catch(() => {})
      throw importError(`Google Drive temporarily refused the image request (HTTP ${response.status}). Retry this Excel import after a short interval.`, 'DRIVE_TEMPORARY_ERROR')
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      throw importError(`Google Drive image download failed (HTTP ${response.status}).`, 'DRIVE_HTTP_ERROR')
    }
    return readLimitedImage(response)
  }
  throw importError('Google Drive redirected too many times for this image.', 'DRIVE_TOO_MANY_REDIRECTS')
}

async function fetchPublicDriveImage({ id, resourceKey }) {
  const key = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : ''
  const safeId = encodeURIComponent(id)
  // Different public Drive files return image bytes from different endpoints.
  // Never fetch the /view page itself. Each attempt verifies the actual bytes.
  const candidates = [
    `https://drive.google.com/thumbnail?id=${safeId}&sz=w2000${key}`,
    `https://drive.usercontent.google.com/download?id=${safeId}&export=download&confirm=t${key}`,
    `https://drive.google.com/uc?export=download&id=${safeId}${key}`,
    `https://lh3.googleusercontent.com/d/${safeId}=w2000`,
  ]
  // Prefer the most actionable error over the final fallback's error.
  // Example: a Drive 429 followed by a thumbnail 403 is a transient failure,
  // not proof that the user's image permission is private.
  const priorities = {
    IMAGE_TOO_LARGE: 100,
    IMAGE_FORMAT_UNSUPPORTED: 90,
    DRIVE_TEMPORARY_ERROR: 80,
    DRIVE_TIMEOUT: 75,
    DRIVE_NETWORK_FAILED: 70,
    DRIVE_NOT_PUBLIC: 60,
    DRIVE_HTML_RESPONSE: 50,
    DRIVE_UNSAFE_REDIRECT: 40,
  }
  let bestError
  for (const candidate of candidates) {
    try { return await fetchImageWithSafeRedirects(candidate) }
    catch (error) {
      if (!bestError || (priorities[error?.code] || 0) > (priorities[bestError?.code] || 0)) bestError = error
      if (error?.code === 'IMAGE_TOO_LARGE') break
    }
  }
  throw bestError || importError('Could not retrieve image bytes from the public Google Drive link. Check file-level sharing, download access and supported format (JPG/PNG/WebP).', 'DRIVE_FETCH_FAILED')
}

// Regression fix: Cloudinary may preserve JPG/PNG even when an upload requested
// format=webp. The former code rejected successful JPEG/PNG uploads AFTER bytes
// were stored, breaking the Excel-only flow on later images. Accept the same
// three formats as the site's normal image uploader and never depend on an
// incoming transformation for acceptance.
async function uploadVerifiedImage({ cloudName, apiKey, apiSecret }, { data, mime }) {
  const form = new FormData()
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  form.append('file', new Blob([data], { type: mime }), `host-drive-import.${ext}`)
  form.append('folder', 'epantry/host-bulk-listings')
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  let response
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}` },
      body: form,
      signal: AbortSignal.timeout(CLOUDINARY_TIMEOUT_MS),
    })
  } catch (cause) {
    if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') {
      throw importError('Cloudinary image upload timed out. No draft was saved.', 'CLOUDINARY_TIMEOUT')
    }
    throw importError('Unable to reach Cloudinary while storing this image.', 'CLOUDINARY_NETWORK_FAILED')
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.secure_url) {
    const detail = String(result?.error?.message || '').slice(0, 180)
    const suffix = detail ? `: ${detail}` : ` (HTTP ${response.status})`
    throw importError(`Cloudinary failed to store the Drive image${suffix}`, 'CLOUDINARY_UPLOAD_FAILED')
  }
  const actualFormat = String(result.format || '').toLowerCase()
  const location = String(result.secure_url || '')
  let uploadedUrl
  try { uploadedUrl = new URL(location) } catch {
    throw importError('Cloudinary returned an invalid image address.', 'CLOUDINARY_IMAGE_INVALID')
  }
  if (result.resource_type !== 'image'
      || !['jpg', 'jpeg', 'png', 'webp'].includes(actualFormat)
      || uploadedUrl.protocol !== 'https:'
      || uploadedUrl.hostname !== 'res.cloudinary.com'
      || !uploadedUrl.pathname.startsWith(`/${cloudName}/image/upload/`)
      || (result.bytes != null && (!Number.isFinite(Number(result.bytes)) || Number(result.bytes) <= 0))) {
    throw importError('Cloudinary returned an invalid image response (expected JPG, PNG or WebP).', 'CLOUDINARY_IMAGE_INVALID')
  }
  return uploadedUrl.href
}

export async function importHostListingRemoteImage(sourceUrl) {
  const settings = cloudinarySettings()
  const source = validateImportedImageSource(sourceUrl, settings.cloudName)
  if (source.kind === 'existing') return source.imageUrl
  const verified = await fetchPublicDriveImage(source)
  return uploadVerifiedImage(settings, verified)
}
