import { apiClient } from '../../api/apiClient'

// Policy version must match the backend. The API is authoritative about the
// current version; the frontend never guesses that a saved old choice is valid.
export const COOKIE_POLICY_VERSION = 'm1a-2026-11-05'
export const COOKIE_SETTINGS_EVENT = 'epantry:open-cookie-settings'
export const COOKIE_CONSENT_UPDATED_EVENT = 'epantry:cookie-consent-updated'
const CONSENT_CROSS_TAB_KEY = 'epantry:cookie-consent-sync'

// M1-B will use this gate. It starts DENIED, including during API errors,
// bootstrapping, logout and between account changes.
let analyticsAllowed = false

export function isWebsiteAnalyticsAllowed() {
  return analyticsAllowed === true
}

export function setRuntimeCookieConsent(result) {
  analyticsAllowed = result?.hasDecision === true && result.categories?.analytics === true
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, {
      detail: { analytics: analyticsAllowed, hasDecision: result?.hasDecision === true, preferences: result?.categories?.preferences === true },
    }))
  }
}

export function clearRuntimeCookieConsent() {
  setRuntimeCookieConsent(null)
}

export async function loadCookieConsent(signal) {
  const response = await apiClient.get('/privacy/consent', { signal })
  return response.data.data
}

export async function saveCookieConsent({ preferences, analytics, source, isUpdate }) {
  const response = await apiClient.request({
    url: '/privacy/consent',
    method: isUpdate ? 'patch' : 'post',
    headers: { 'x-epantry-consent': '1' },
    data: {
      policyVersion: COOKIE_POLICY_VERSION,
      source,
      preferences: Boolean(preferences),
      analytics: Boolean(analytics),
    },
  })
  return response.data.data
}

export function notifyOtherConsentTabs() {
  try {
    window.localStorage.setItem(CONSENT_CROSS_TAB_KEY, String(Date.now()))
  } catch {
    // Preference storage is authoritative on the server; tab hints are best effort.
  }
}

export function isConsentSyncStorageEvent(event) {
  return event.key === CONSENT_CROSS_TAB_KEY
}
