import {
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'

import {
  useLocation,
  useNavigationType,
} from 'react-router-dom'

const scrollPositions = new Map()

// Detail views are always entered from the beginning. Preserve Back/Forward
// position restoration for browse/search/list pages.
function isItemDetailPath(pathname) {
  return (
    /^\/grocery\/product\/[^/]+\/?$/.test(pathname) ||
    (
      /^\/recipes\/[^/]+\/?$/.test(pathname) &&
      pathname !== '/recipes/what-should-we-cook'
    )
  )
}

export default function ScrollToTop() {
  const location = useLocation()
  const navigationType = useNavigationType()

  const previousPathnameRef = useRef(
    location.pathname,
  )

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('scrollRestoration' in window.history)
    ) {
      return undefined
    }

    const previousScrollRestoration =
      window.history.scrollRestoration

    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration =
        previousScrollRestoration
    }
  }, [])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const locationKey = location.key
    const currentPathname = location.pathname
    const previousPathname = previousPathnameRef.current

    previousPathnameRef.current = currentPathname

    let cancelled = false
    const timerIds = []
    const frameIds = []

    function clearRestoreTimers() {
      timerIds.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
    }

    function stopRestore() {
      if (cancelled) {
        return
      }

      cancelled = true
      clearRestoreTimers()
      frameIds.forEach((frameId) => {
        window.cancelAnimationFrame(frameId)
      })
    }

    if (isItemDetailPath(currentPathname)) {
      // index.css makes document scrolling smooth. A normal "auto" reset
      // would animate through the previous page's footer. Force an immediate
      // top reset, including on POP and direct-load navigation.
      function openItemAtTop() {
        if (cancelled) return
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'instant',
        })
      }

      openItemAtTop()

      // Lazy-loaded detail views can replace a much taller browse page.
      // Repeat briefly after render so that layout changes cannot leave the
      // viewport at the previous page's bottom. Never fight user scrolling.
      frameIds.push(
        window.requestAnimationFrame(openItemAtTop),
      )
      ;[80, 240, 500].forEach((delay) => {
        timerIds.push(
          window.setTimeout(openItemAtTop, delay),
        )
      })

      window.addEventListener('wheel', stopRestore, {
        passive: true,
        once: true,
      })
      window.addEventListener('touchstart', stopRestore, {
        passive: true,
        once: true,
      })
      window.addEventListener('pointerdown', stopRestore, {
        passive: true,
        once: true,
      })
    } else if (navigationType === 'POP') {
      const savedPosition =
        scrollPositions.get(locationKey)

      if (savedPosition) {
        function restoreScrollPosition() {
          if (cancelled) {
            return
          }

          window.scrollTo({
            top: savedPosition.top,
            left: savedPosition.left,
            behavior: 'auto',
          })

          const horizontalRestored =
            Math.abs(
              window.scrollX -
                savedPosition.left,
            ) <= 1

          const verticalRestored =
            Math.abs(
              window.scrollY -
                savedPosition.top,
            ) <= 1

          if (
            horizontalRestored &&
            verticalRestored
          ) {
            stopRestore()
          }
        }

        restoreScrollPosition()

        if (!cancelled) {
          ;[
            50,
            150,
            300,
            600,
            1000,
            1500,
            2200,
          ].forEach((delay) => {
            timerIds.push(
              window.setTimeout(
                restoreScrollPosition,
                delay,
              ),
            )
          })
        }

        window.addEventListener(
          'wheel',
          stopRestore,
          {
            passive: true,
            once: true,
          },
        )

        window.addEventListener(
          'touchstart',
          stopRestore,
          {
            passive: true,
            once: true,
          },
        )

        window.addEventListener(
          'pointerdown',
          stopRestore,
          {
            passive: true,
            once: true,
          },
        )
      }
    } else if (
      previousPathname !==
      currentPathname
    ) {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto',
      })
    }

    return () => {
      scrollPositions.set(
        locationKey,
        {
          left: window.scrollX,
          top: window.scrollY,
        },
      )

      stopRestore()

      window.removeEventListener(
        'wheel',
        stopRestore,
      )
      window.removeEventListener(
        'touchstart',
        stopRestore,
      )
      window.removeEventListener(
        'pointerdown',
        stopRestore,
      )
    }
  }, [
    location.key,
    location.pathname,
    navigationType,
  ])

  return null
}
