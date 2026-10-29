import { apiClient } from '../../../api/apiClient'

const unwrap = (response) => response?.data?.data ?? response?.data ?? null
async function csrfToken() {
  const response = unwrap(await apiClient.get('/auth/csrf'))
  if (!response?.csrfToken) throw new Error('Unable to establish CSRF protection.')
  return response.csrfToken
}
async function write(method, path, data) {
  const csrf = await csrfToken()
  return unwrap(await apiClient.request({ method, url: path, data, headers: { 'x-csrf-token': csrf } }))
}
export async function listHostListingPackets() {
  return unwrap(await apiClient.get('/host/listing-packets'))
}
// Host-only canonical ingredient autocomplete. Never call the Customer-only
// /community/ingredients API from Host Studio: its 403 triggers a role redirect.
export async function searchHostListingIngredients({ search, limit = 6 } = {}) {
  const name = String(search || '').trim()
  if (name.length < 2) return { ingredients: [] }
  return unwrap(await apiClient.get('/host/listing-packets/catalog/ingredients', {
    params: { search: name.slice(0, 120), limit },
  }))
}

export async function listHostApprovedBrands() {
  return unwrap(await apiClient.get('/host/listing-packets/catalog/approved-brands'))
}
export async function checkHostListingBarcode(gtin) {
  return unwrap(await apiClient.get('/host/listing-packets/catalog/barcode', {
    params: { gtin: String(gtin || '').trim() },
  }))
}
export async function searchHostPublishedProducts(search) {
  return unwrap(await apiClient.get('/host/listing-packets/catalog/published-products', { params: { search } }))
}
export async function getHostListingPacket(id) {
  return unwrap(await apiClient.get(`/host/listing-packets/${encodeURIComponent(id)}`))
}
export async function getHostListingSellingReadiness(id) {
  return unwrap(await apiClient.get(`/host/listing-packets/${encodeURIComponent(id)}/selling-readiness`))
}
export async function createHostListingPacket(packet) {
  return write('post', '/host/listing-packets', { packet })
}
export async function updateHostListingPacket(id, packet) {
  return write('patch', `/host/listing-packets/${encodeURIComponent(id)}`, { packet })
}
export async function submitHostListingSectionRevision(id, sections) {
  return write('post', `/host/listing-packets/${encodeURIComponent(id)}/section-revision`, { sections })
}
export async function submitHostListingPacket(id) {
  return write('post', `/host/listing-packets/${encodeURIComponent(id)}/submit`, {})
}
export async function deleteHostListingPacket(id) {
  return write('delete', `/host/listing-packets/${encodeURIComponent(id)}`, {})
}
export async function importHostListingPackets(packets) {
  return write('post', '/host/listing-packets/bulk', { packets })
}
export async function uploadHostListingVideo(file) {
  if (!file || !['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video.')
  const intentResult = await write('post', '/host/listing-packets/video-upload-intent', {})
  const intent = intentResult?.uploadIntent
  if (!intent?.signature || !intent?.uploadUrl || !intent?.apiKey) throw new Error('Video upload is unavailable.')
  if (file.size > (intent.constraints?.maxBytes || 0)) throw new Error('Video exceeds the upload size limit (50 MB).')
  const data = new FormData()
  data.append('file', file)
  data.append('api_key', intent.apiKey)
  data.append('signature', intent.signature)
  Object.entries(intent.signedParameters || {}).forEach(([key, value]) => data.append(key, String(value)))
  const response = await fetch(intent.uploadUrl, { method: 'POST', body: data })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json.secure_url) throw new Error(json?.error?.message || 'Video upload failed.')
  if (json.resource_type !== 'video' || json.format !== 'mp4') {
    throw new Error('Video optimization did not return the expected MP4. Please retry.')
  }
  return json.secure_url
}

export async function uploadHostListingImage(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  const intentResult = await write('post', '/host/listing-packets/image-upload-intent', {})
  const intent = intentResult?.uploadIntent
  if (!intent?.signature || !intent?.uploadUrl || !intent?.apiKey) throw new Error('Image upload is unavailable.')
  if (file.size > (intent.constraints?.maxBytes || 0)) throw new Error('Image exceeds the 8 MB upload limit.')
  const data = new FormData()
  data.append('file', file)
  data.append('api_key', intent.apiKey)
  data.append('signature', intent.signature)
  Object.entries(intent.signedParameters || {}).forEach(([key, value]) => data.append(key, String(value)))
  const response = await fetch(intent.uploadUrl, { method: 'POST', body: data })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json.secure_url) throw new Error(json?.error?.message || 'Image upload failed.')
  if (json.resource_type !== 'image' || json.format !== 'webp') {
    throw new Error('Image optimization did not return the expected WebP. Please retry.')
  }
  return json.secure_url
}

// Super Admin decisions remain separate from Host writes and Customer reads.
export async function listAdminHostListingPackets(status = '') {
  return unwrap(await apiClient.get('/admin/host-listing-packets', { params: status ? { status } : {} }))
}
export async function reviewAdminHostListingPacket(id, decision) {
  return write('post', `/admin/host-listing-packets/${encodeURIComponent(id)}/decision`, decision)
}
export async function linkAdminHostListingCatalog(id, productVersionId) {
  return write('post', `/admin/host-listing-packets/${encodeURIComponent(id)}/link-catalog`, { productVersionId })
}
export async function listPublicHostListings(category = '') {
  return unwrap(await apiClient.get('/public/host-listings', { params: category ? { category } : {} }))
}
export async function getPublicHostListingBySlug(slug) {
  return unwrap(await apiClient.get(`/public/host-listings/by-slug/${encodeURIComponent(slug)}`))
}
export async function getPublicHostListing(id) {
  return unwrap(await apiClient.get(`/public/host-listings/${encodeURIComponent(id)}`))
}

// Import a public Drive image to the Host Cloudinary account before saving draft packets.
export async function importHostListingRemoteImage(sourceUrl) {
  return write('post', '/host/listing-packets/import-image', { sourceUrl })
}
