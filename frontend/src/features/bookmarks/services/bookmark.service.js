import { apiClient } from '../../../api/apiClient'

const unwrap = response => response?.data?.data ?? response?.data ?? {}
let cachedUser = ''
let cachedList = null
let inFlight = null
let cacheEpoch = 0
if (typeof window !== 'undefined') {
  window.addEventListener('epantry:auth-session-cleared', () => {
    cacheEpoch += 1
    cachedUser = ''
    cachedList = null
    inFlight = null
  })
}

export function bookmarkKey(kind, slug) {
  return `${kind}:${String(slug || '').trim().toLowerCase()}`
}

export async function listBookmarks(userId = '') {
  const identity = String(userId || '')
  if (cachedUser !== identity) {
    cacheEpoch += 1
    cachedUser = identity
    cachedList = null
    inFlight = null
  }
  if (cachedList) return cachedList
  if (!inFlight) {
    const epoch = cacheEpoch
    inFlight = apiClient.get('/bookmarks').then(response => {
      const items = unwrap(response)?.items || []
      if (epoch === cacheEpoch) cachedList = items
      return items
    }).finally(() => { if (epoch === cacheEpoch) inFlight = null })
  }
  return inFlight
}

function changed(userId = '') {
  cacheEpoch += 1
  cachedUser = String(userId || '')
  cachedList = null
  inFlight = null
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('epantry:bookmarks-changed'))
}

async function secureWrite(method, url, data) {
  const csrf = unwrap(await apiClient.get('/auth/csrf'))?.csrfToken
  if (!csrf) throw new Error('Unable to verify your session. Please retry.')
  return unwrap(await apiClient.request({ method, url, data, headers: { 'x-csrf-token': csrf } }))
}

export async function saveBookmark(kind, slug, userId = '') {
  const result = await secureWrite('post', '/bookmarks', { kind, slug })
  changed(userId)
  return result
}

export async function removeBookmark(kind, slug, userId = '') {
  const result = await secureWrite('delete', `/bookmarks/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}`)
  changed(userId)
  return result
}
