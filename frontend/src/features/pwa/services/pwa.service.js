export const PWA_EVENTS = Object.freeze({
  ready: 'epantry:pwa-ready',
  updateAvailable: 'epantry:pwa-update-available',
  offlineReady: 'epantry:pwa-offline-ready',
  registrationError: 'epantry:pwa-registration-error',
  connectivityChanged: 'epantry:connectivity-changed',
  installAvailable: 'epantry:pwa-install-available',
  installed: 'epantry:pwa-installed',
})

export function getConnectivitySnapshot() {
  if (
    typeof navigator ===
    'undefined'
  ) {
    return {
      online: true,
    }
  }

  return {
    online:
      navigator.onLine !==
      false,
  }
}

export function isStandalonePwa() {
  if (
    typeof window ===
      'undefined' ||
    typeof navigator ===
      'undefined'
  ) {
    return false
  }

  const displayModeStandalone =
    typeof window.matchMedia ===
      'function' &&
    window.matchMedia(
      '(display-mode: standalone)',
    ).matches

  const iosStandalone =
    navigator.standalone ===
    true

  return Boolean(
    displayModeStandalone ||
      iosStandalone,
  )
}

export function canInstallPwa() {
  if (
    typeof window ===
    'undefined'
  ) {
    return false
  }

  return (
    window.epantryPwa
      ?.installAvailable ===
    true
  )
}

export async function installPwa() {
  if (
    typeof window ===
      'undefined' ||
    typeof window.epantryPwa
      ?.install !==
      'function'
  ) {
    return {
      available: false,
      accepted: false,
    }
  }

  return window.epantryPwa.install()
}

export function activatePwaUpdate() {
  if (
    typeof window ===
      'undefined' ||
    typeof window.epantryPwa
      ?.activateUpdate !==
      'function'
  ) {
    return false
  }

  return Boolean(
    window.epantryPwa.activateUpdate(),
  )
}

export async function purgePwaCaches() {
  if (
    typeof window ===
    'undefined'
  ) {
    return false
  }

  if (
    typeof window.epantryPwa
      ?.purgeCaches ===
      'function'
  ) {
    return Boolean(
      await window.epantryPwa.purgeCaches(),
    )
  }

  if (
    !('caches' in window)
  ) {
    return false
  }

  const keys =
    await window.caches.keys()

  const epantryKeys =
    keys.filter(
      (key) =>
        key.startsWith(
          'epantry-pwa',
        ),
    )

  await Promise.all(
    epantryKeys.map(
      (key) =>
        window.caches.delete(
          key,
        ),
    ),
  )

  return true
}

export function shouldShowIosInstallHint() {
  if (
    typeof navigator ===
      'undefined' ||
    isStandalonePwa()
  ) {
    return false
  }

  const userAgent =
    String(
      navigator.userAgent ||
        '',
    )

  const platform =
    String(
      navigator.platform ||
        '',
    )

  const iosDevice =
    /iPad|iPhone|iPod/i.test(
      userAgent,
    ) ||
    (
      platform ===
        'MacIntel' &&
      Number(
        navigator.maxTouchPoints ||
          0,
      ) > 1
    )

  return iosDevice
}
