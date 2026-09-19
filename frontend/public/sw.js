const CACHE_PREFIX = 'epantry-pwa'
const CACHE_VERSION = 'm25-v2'
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`
const ASSET_CACHE = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`

const CORE_SHELL = Object.freeze([
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa-register.js',
  '/icons/epantry-pwa.svg',
])

function isSameOrigin(
  url,
) {
  return (
    url.origin ===
    self.location.origin
  )
}

function isApiRequest(
  url,
) {
  return (
    url.pathname === '/api' ||
    url.pathname.startsWith(
      '/api/',
    )
  )
}

function isCacheableStaticAsset(
  request,
  url,
) {
  if (!isSameOrigin(url)) {
    return false
  }

  if (
    url.pathname.startsWith(
      '/assets/',
    ) ||
    url.pathname.startsWith(
      '/icons/',
    )
  ) {
    return (
      [
        'script',
        'style',
        'font',
        'worker',
        'manifest',
      ].includes(
        request.destination,
      ) ||
      url.pathname.startsWith(
        '/icons/',
      )
    )
  }

  return (
    url.pathname ===
      '/pwa-register.js' ||
    url.pathname ===
      '/manifest.webmanifest'
  )
}

async function safePut(
  cacheName,
  request,
  response,
) {
  if (
    !response ||
    !response.ok ||
    response.type !== 'basic'
  ) {
    return
  }

  const cache =
    await caches.open(
      cacheName,
    )

  await cache.put(
    request,
    response.clone(),
  )
}

async function networkFirstNavigation(
  request,
) {
  try {
    const response =
      await fetch(
        request,
      )

    if (
      response &&
      response.ok &&
      response.type ===
        'basic'
    ) {
      await safePut(
        SHELL_CACHE,
        '/index.html',
        response,
      )
    }

    return response
  } catch {
    const cache =
      await caches.open(
        SHELL_CACHE,
      )

    return (
      (await cache.match(
        '/index.html',
      )) ||
      (await cache.match(
        '/offline.html',
      )) ||
      Response.error()
    )
  }
}

async function staleWhileRevalidate(
  request,
) {
  const cache =
    await caches.open(
      ASSET_CACHE,
    )

  const cached =
    await cache.match(
      request,
    )

  const network =
    fetch(
      request,
    )
      .then(
        async (
          response,
        ) => {
          await safePut(
            ASSET_CACHE,
            request,
            response,
          )

          return response
        },
      )
      .catch(
        () => null,
      )

  if (cached) {
    void network

    return cached
  }

  return (
    (await network) ||
    Response.error()
  )
}

async function purgeEpantryCaches() {
  const keys =
    await caches.keys()

  await Promise.all(
    keys
      .filter(
        (key) =>
          key.startsWith(
            CACHE_PREFIX,
          ),
      )
      .map(
        (key) =>
          caches.delete(
            key,
          ),
      ),
  )
}

function safeNotificationPath(
  value,
) {
  const raw =
    String(
      value ||
        '',
    ).trim()

  if (
    !raw ||
    !raw.startsWith('/') ||
    raw.startsWith('//')
  ) {
    return '/notifications'
  }

  try {
    const url =
      new URL(
        raw,
        self.location.origin,
      )

    if (
      url.origin !==
      self.location.origin
    ) {
      return '/notifications'
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/notifications'
  }
}

self.addEventListener(
  'install',
  (event) => {
    event.waitUntil(
      caches
        .open(
          SHELL_CACHE,
        )
        .then(
          (cache) =>
            cache.addAll(
              CORE_SHELL,
            ),
        ),
    )
  },
)

self.addEventListener(
  'activate',
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then(
          (keys) =>
            Promise.all(
              keys
                .filter(
                  (key) =>
                    key.startsWith(
                      CACHE_PREFIX,
                    ) &&
                    ![
                      SHELL_CACHE,
                      ASSET_CACHE,
                    ].includes(
                      key,
                    ),
                )
                .map(
                  (key) =>
                    caches.delete(
                      key,
                    ),
                ),
            ),
        )
        .then(
          () =>
            self.clients.claim(),
        ),
    )
  },
)

self.addEventListener(
  'message',
  (event) => {
    const type =
      event.data?.type

    if (
      type ===
      'EPANTRY_SKIP_WAITING'
    ) {
      void self.skipWaiting()

      return
    }

    if (
      type ===
      'EPANTRY_PURGE_CACHES'
    ) {
      event.waitUntil(
        purgeEpantryCaches(),
      )
    }
  },
)

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close()

    const path =
      safeNotificationPath(
        event.notification
          ?.data?.deepLinkPath ||
          event.notification
            ?.data?.deepLink,
      )

    const destination =
      new URL(
        path,
        self.location.origin,
      ).href

    event.waitUntil(
      self.clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then(
          async (
            clientList,
          ) => {
            for (
              const client of
              clientList
            ) {
              if (
                typeof client.navigate ===
                'function'
              ) {
                await client.navigate(
                  destination,
                )

                return client.focus()
              }
            }

            if (
              self.clients.openWindow
            ) {
              return self.clients.openWindow(
                destination,
              )
            }

            return undefined
          },
        ),
    )
  },
)

self.addEventListener(
  'fetch',
  (event) => {
    const {
      request,
    } = event

    if (
      request.method !==
      'GET'
    ) {
      return
    }

    const url =
      new URL(
        request.url,
      )

    /*
    |------------------------------------------------------------------
    | M25 Sensitive Network Boundary
    |------------------------------------------------------------------
    |
    | API/account data is always network-only. The service worker never
    | manufactures a response for POST/PATCH/DELETE and never caches private
    | JSON. Checkout/payment therefore stays server-authoritative.
    |
    */

    if (
      !isSameOrigin(url) ||
      isApiRequest(url)
    ) {
      return
    }

    if (
      request.mode ===
      'navigate'
    ) {
      event.respondWith(
        networkFirstNavigation(
          request,
        ),
      )

      return
    }

    if (
      isCacheableStaticAsset(
        request,
        url,
      )
    ) {
      event.respondWith(
        staleWhileRevalidate(
          request,
        ),
      )
    }
  },
)
