const PWA_EVENTS = Object.freeze({
  ready: 'epantry:pwa-ready',
  updateAvailable: 'epantry:pwa-update-available',
  offlineReady: 'epantry:pwa-offline-ready',
  registrationError: 'epantry:pwa-registration-error',
  connectivityChanged: 'epantry:connectivity-changed',
  installAvailable: 'epantry:pwa-install-available',
  installed: 'epantry:pwa-installed',
})

const AUTH_SESSION_CLEARED_EVENT =
  'epantry:auth-session-cleared'

function dispatch(
  name,
  detail = {},
) {
  window.dispatchEvent(
    new CustomEvent(
      name,
      {
        detail,
      },
    ),
  )
}

function publishConnectivity() {
  const online =
    navigator.onLine

  document.documentElement.dataset.network =
    online
      ? 'online'
      : 'offline'

  dispatch(
    PWA_EVENTS.connectivityChanged,
    {
      online,
    },
  )
}

publishConnectivity()

window.addEventListener(
  'online',
  publishConnectivity,
)

window.addEventListener(
  'offline',
  publishConnectivity,
)

let deferredInstallPrompt =
  null

let userApprovedActivation =
  false

function getActiveWorker() {
  return (
    navigator.serviceWorker
      ?.controller ||
    controller.registration
      ?.active ||
    null
  )
}

async function purgeBrowserCachesFallback() {
  if (!('caches' in window)) {
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

const controller = {
  registration: null,
  waitingWorker: null,

  get installAvailable() {
    return Boolean(
      deferredInstallPrompt,
    )
  },

  activateUpdate() {
    if (!controller.waitingWorker) {
      return false
    }

    userApprovedActivation =
      true

    controller.waitingWorker.postMessage({
      type:
        'EPANTRY_SKIP_WAITING',
    })

    return true
  },

  async install() {
    if (!deferredInstallPrompt) {
      return {
        available: false,
        accepted: false,
      }
    }

    const promptEvent =
      deferredInstallPrompt

    deferredInstallPrompt =
      null

    await promptEvent.prompt()

    const choice =
      await promptEvent.userChoice

    const accepted =
      choice?.outcome ===
      'accepted'

    if (!accepted) {
      deferredInstallPrompt =
        null
    }

    return {
      available: true,
      accepted,
      outcome:
        choice?.outcome ||
        'unknown',
    }
  },

  async purgeCaches() {
    const worker =
      getActiveWorker()

    if (worker) {
      worker.postMessage({
        type:
          'EPANTRY_PURGE_CACHES',
      })
    }

    return purgeBrowserCachesFallback()
  },

  async unregister() {
    if (!controller.registration) {
      return false
    }

    return controller.registration.unregister()
  },
}

Object.defineProperty(
  window,
  'epantryPwa',
  {
    value:
      controller,
    configurable:
      false,
    enumerable:
      false,
    writable:
      false,
  },
)

window.addEventListener(
  'beforeinstallprompt',
  (event) => {
    event.preventDefault()

    deferredInstallPrompt =
      event

    dispatch(
      PWA_EVENTS.installAvailable,
      {},
    )
  },
)

window.addEventListener(
  'appinstalled',
  () => {
    deferredInstallPrompt =
      null

    dispatch(
      PWA_EVENTS.installed,
      {},
    )
  },
)

window.addEventListener(
  AUTH_SESSION_CLEARED_EVENT,
  () => {
    void controller.purgeCaches()
  },
)

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        '/sw.js',
        {
          scope: '/',
          updateViaCache: 'none',
        },
      )

    controller.registration =
      registration

    dispatch(
      PWA_EVENTS.ready,
      {
        registration,
      },
    )

    if (
      registration.waiting &&
      navigator.serviceWorker
        .controller
    ) {
      controller.waitingWorker =
        registration.waiting

      dispatch(
        PWA_EVENTS.updateAvailable,
        {
          registration,
        },
      )
    }

    registration.addEventListener(
      'updatefound',
      () => {
        const installingWorker =
          registration.installing

        if (!installingWorker) {
          return
        }

        installingWorker.addEventListener(
          'statechange',
          () => {
            if (
              installingWorker.state !==
              'installed'
            ) {
              return
            }

            if (
              navigator.serviceWorker
                .controller
            ) {
              controller.waitingWorker =
                installingWorker

              dispatch(
                PWA_EVENTS.updateAvailable,
                {
                  registration,
                },
              )

              return
            }

            dispatch(
              PWA_EVENTS.offlineReady,
              {
                registration,
              },
            )
          },
        )
      },
    )

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        controller.waitingWorker =
          null

        if (
          userApprovedActivation
        ) {
          window.location.reload()
        }
      },
    )
  } catch (error) {
    dispatch(
      PWA_EVENTS.registrationError,
      {
        message:
          error instanceof Error
            ? error.message
            : 'Service worker registration failed.',
      },
    )
  }
}

window.addEventListener(
  'load',
  registerServiceWorker,
  {
    once: true,
  },
)
