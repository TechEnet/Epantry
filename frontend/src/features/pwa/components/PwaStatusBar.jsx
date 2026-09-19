import {
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'

import {
  useState,
} from 'react'

import {
  usePwa,
} from '../context/PwaContext'

const secondaryButtonClass =
  'focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-current/20 px-3 py-2 text-xs font-black'

export default function PwaStatusBar() {
  const {
    offline,
    reconnectNotice,
    updateAvailable,
    installAvailable,
    iosInstallHint,
    registrationError,
    install,
    activateUpdate,
    dismissReconnectNotice,
    dismissRegistrationError,
  } = usePwa()

  const [
    installBusy,
    setInstallBusy,
  ] = useState(false)

  const [
    installHintDismissed,
    setInstallHintDismissed,
  ] = useState(false)

  const [
    iosHintDismissed,
    setIosHintDismissed,
  ] = useState(false)

  async function handleInstall() {
    if (installBusy) {
      return
    }

    setInstallBusy(
      true,
    )

    try {
      await install()
    } finally {
      setInstallBusy(
        false,
      )
    }
  }

  let content =
    null

  if (offline) {
    content = {
      tone:
        'border-amber-300 bg-amber-50 text-amber-950',
      icon:
        WifiOff,
      message:
        'You are offline. Server changes, checkout and payment are not confirmed until the connection returns.',
      action:
        null,
      dismiss:
        null,
    }
  } else if (updateAvailable) {
    content = {
      tone:
        'border-emerald-300 bg-emerald-50 text-emerald-950',
      icon:
        RefreshCw,
      message:
        'A newer EPANTRY app shell is ready.',
      action: (
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={activateUpdate}
        >
          <RefreshCw
            size={14}
            aria-hidden="true"
          />
          Update now
        </button>
      ),
      dismiss:
        null,
    }
  } else if (reconnectNotice) {
    content = {
      tone:
        'border-emerald-300 bg-emerald-50 text-emerald-950',
      icon:
        Wifi,
      message:
        'Back online. Active reads are refreshing; retry any interrupted write yourself because EPANTRY does not replay mutations automatically.',
      action:
        null,
      dismiss:
        dismissReconnectNotice,
    }
  } else if (
    installAvailable &&
    !installHintDismissed
  ) {
    content = {
      tone:
        'border-stone-300 bg-white text-stone-950',
      icon:
        Download,
      message:
        'Install EPANTRY for a home-screen, standalone mobile experience.',
      action: (
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={installBusy}
          onClick={handleInstall}
        >
          <Download
            size={14}
            aria-hidden="true"
          />
          {installBusy
            ? 'Opening…'
            : 'Install'}
        </button>
      ),
      dismiss:
        () =>
          setInstallHintDismissed(
            true,
          ),
    }
  } else if (
    iosInstallHint &&
    !iosHintDismissed
  ) {
    content = {
      tone:
        'border-stone-300 bg-white text-stone-950',
      icon:
        Download,
      message:
        'On iPhone or iPad, use Safari Share → Add to Home Screen to install EPANTRY.',
      action:
        null,
      dismiss:
        () =>
          setIosHintDismissed(
            true,
          ),
    }
  } else if (registrationError) {
    content = {
      tone:
        'border-stone-300 bg-white text-stone-800',
      icon:
        Wifi,
      message:
        'Install/offline helpers are unavailable in this browser session. Online EPANTRY continues to work normally.',
      action:
        null,
      dismiss:
        dismissRegistrationError,
    }
  }

  if (!content) {
    return null
  }

  const Icon =
    content.icon

  return (
    <div
      className="pointer-events-none fixed inset-x-2 bottom-20 z-[80] lg:bottom-4"
      style={{
        paddingBottom:
          'env(safe-area-inset-bottom, 0px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          'pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg',
          content.tone,
        ].join(' ')}
      >
        <Icon
          size={18}
          className="shrink-0"
          aria-hidden="true"
        />

        <p className="min-w-0 flex-1 text-xs font-bold leading-5 sm:text-sm">
          {content.message}
        </p>

        {content.action}

        {content.dismiss ? (
          <button
            type="button"
            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            onClick={content.dismiss}
            aria-label="Dismiss message"
          >
            <X
              size={16}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
    </div>
  )
}
