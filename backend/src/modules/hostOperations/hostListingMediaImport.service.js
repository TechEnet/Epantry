// Fetch public Drive image URLs through Cloudinary without accepting arbitrary remote hosts.
// A Host must grant "Anyone with the link: Viewer" for each Drive image file.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ACCEPTED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp'])

function importError(message, code = 'MEDIA_IMPORT_FAILED') {
  const error = new Error(message)
  error.code = code
  return error
}

export function driveImageFileId(raw) {
  let url
  try { url = new URL(String(raw || '').trim()) } catch { return '' }
  if (url.protocol !== 'https:' || url.username || url.password || !['drive.google.com', 'www.drive.google.com'].includes(url.hostname)) return ''
  if (/\/folders\//.test(url.pathname)) return ''
  const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,})\/?/)
  const id = match?.[1] || (['/open', '/uc', '/thumbnail'].includes(url.pathname) ? url.searchParams.get('id') : '') || ''
  return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : ''
}

export function validateImportedImageSource(raw, cloudName) {
  const urlText = String(raw || '').trim()
  if (!urlText || urlText.length > 1800) throw importError('Use a public Google Drive image-file link or an EPANTRY Cloudinary image URL.', 'IMAGE_URL_INVALID')
  let parsed
  try { parsed = new URL(urlText) } catch { throw importError('Invalid image URL.', 'IMAGE_URL_INVALID') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw importError('Only HTTPS image links without embedded credentials are supported.', 'IMAGE_URL_INVALID')
  if (parsed.hostname === 'res.cloudinary.com') {
    const cloud = parsed.pathname.match(/^\/([^/]+)\/image\/upload\/[^?#]+$/)?.[1]
    if (!cloudName || cloud !== cloudName) throw importError('Use an image uploaded to this EPANTRY Cloudinary account.', 'IMAGE_URL_INVALID')
    return { kind: 'existing', imageUrl: parsed.href }
  }
  const id = driveImageFileId(urlText)
  if (!id) throw importError('Only public Google Drive IMAGE FILE links or EPANTRY Cloudinary images are supported. Folder links cannot be imported.', 'IMAGE_URL_INVALID')
  const resourceKey = parsed.searchParams.get('resourcekey') || ''
  if (resourceKey && !/^[A-Za-z0-9_-]{1,120}$/.test(resourceKey)) throw importError('Google Drive resource key is invalid.', 'IMAGE_URL_INVALID')
  return { kind: 'google_drive', id, resourceKey }
}

function cloudinarySettings() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim()
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim()
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim()
  if (!cloudName || !apiKey || !apiSecret) throw importError('Cloudinary image uploads are not configured on the backend.', 'MEDIA_NOT_CONFIGURED')
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) throw importError('Invalid Cloudinary configuration.', 'MEDIA_NOT_CONFIGURED')
  return { cloudName, apiKey, apiSecret }
}

async function uploadPublicImage({ cloudName, apiKey, apiSecret }, remoteUrl) {
  const form = new FormData()
  form.append('file', remoteUrl)
  form.append('folder', 'epantry/host-bulk-listings')
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`
  const result = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Basic ${auth}` }, body: form, signal: AbortSignal.timeout(25000) })
  const json = await result.json().catch(() => ({}))
  if (!result.ok || !json.secure_url) throw importError('Image could not be fetched from Google Drive. Check that the file is an image and sharing is Anyone with the link: Viewer.')
  if (json.resource_type !== 'image' || !ACCEPTED_FORMATS.has(String(json.format || '').toLowerCase()) || !Number.isFinite(Number(json.bytes)) || Number(json.bytes) > MAX_IMAGE_BYTES) throw importError('Only JPG, PNG and WebP images up to 8 MB are allowed.')
  return json.secure_url
}

export async function importHostListingRemoteImage(sourceUrl) {
  const settings = cloudinarySettings()
  const source = validateImportedImageSource(sourceUrl, settings.cloudName)
  if (source.kind === 'existing') return source.imageUrl
  const id = encodeURIComponent(source.id)
  const resourceKey = source.resourceKey ? `&resourcekey=${encodeURIComponent(source.resourceKey)}` : ''
  const urls = [
    `https://drive.google.com/uc?export=download&id=${id}${resourceKey}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600${resourceKey}`,
  ]
  for (const url of urls) {
    try { return await uploadPublicImage(settings, url) } catch (error) {
      if (error.name === 'TimeoutError') continue
      if (error.code === 'MEDIA_NOT_CONFIGURED') throw error
    }
  }
  throw importError('Google Drive image import failed. Make the IMAGE file public (Anyone with the link: Viewer), check its format, or upload it manually in the listing editor.')
}
