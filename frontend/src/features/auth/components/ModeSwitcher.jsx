import {
  ArrowLeftRight,
  LoaderCircle,
} from 'lucide-react'

import {
  useState,
} from 'react'

import {
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  useAuth,
} from '../context/AuthContext'

export default function ModeSwitcher({
  compact = false,
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    activeMode,
    canSwitchToCustomer,
    canSwitchToHost,
    isSwitchingMode,
    switchMode,
  } = useAuth()

  const [error, setError] = useState('')

  if (!canSwitchToCustomer || !canSwitchToHost) {
    return null
  }

  const currentMode =
    activeMode ||
    (location.pathname.startsWith('/host') ? 'host' : 'customer')

  const targetMode =
    currentMode === 'host'
      ? 'customer'
      : 'host'

  const handleSwitch = async () => {
    if (isSwitchingMode) {
      return
    }

    setError('')

    try {
      await switchMode(targetMode)

      navigate(
        targetMode === 'host'
          ? '/host/operations'
          : '/dashboard',
      )
    } catch (switchError) {
      setError(
        switchError?.message ||
        'Unable to switch EPANTRY mode.',
      )
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSwitch}
        disabled={isSwitchingMode}
        className={[
          'focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 font-black text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50',
          compact
            ? 'h-9 px-3 text-[11px]'
            : 'h-10 px-3.5 text-xs',
        ].join(' ')}
        title={`Switch to ${targetMode === 'host' ? 'Host' : 'Customer'} mode`}
      >
        {isSwitchingMode ? (
          <LoaderCircle
            size={15}
            className="animate-spin"
            aria-hidden="true"
          />
        ) : (
          <ArrowLeftRight
            size={15}
            aria-hidden="true"
          />
        )}

        <span>
          {isSwitchingMode
            ? 'Switching'
            : `Switch to ${targetMode === 'host' ? 'Host' : 'Customer'}`}
        </span>
      </button>

      {error ? (
        <p className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-red-200 bg-red-50 p-2 text-[10px] font-bold text-red-700 shadow-lg">
          {error}
        </p>
      ) : null}
    </div>
  )
}
