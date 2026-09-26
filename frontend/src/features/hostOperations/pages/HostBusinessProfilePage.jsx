import {
  Building2,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Send,
  Store,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  getHostCommercialProfile,
  getHostOperationalOrganization,
  getHostOperationsErrorMessage,
  submitHostCommercialProfile,
} from '../services/hostOperations.service'

const PROFILE_TYPES = [
  {
    value: 'seller',
    label: 'Seller',
    description: 'Sell products directly to customers through EPANTRY.',
  },
  {
    value: 'b2b',
    label: 'B2B / Hospitality',
    description: 'Supply businesses, kitchens or hospitality teams through EPANTRY.',
  },
  {
    value: 'brand',
    label: 'Brand',
    description: 'Manage a brand presence and products. Brand approval is handled separately.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Use more than one business model under the same Host account.',
  },
]

const PROFILE_STEPS = [
  {
    number: '1',
    title: 'Choose your business type',
    description: 'Pick the option that best matches how you operate.',
    className: 'border-sky-200 bg-sky-100/80',
    badgeClassName: 'bg-sky-600 text-white',
  },
  {
    number: '2',
    title: 'Add context if needed',
    description: 'Use the note only when EPANTRY needs extra business context.',
    className: 'border-cyan-200 bg-cyan-100/80',
    badgeClassName: 'bg-cyan-700 text-white',
  },
  {
    number: '3',
    title: 'Save your profile',
    description: 'EPANTRY records the choice and shares it with the operations team.',
    className: 'border-violet-200 bg-violet-100/80',
    badgeClassName: 'bg-violet-600 text-white',
  },
  {
    number: '4',
    title: 'Next: Operations Center',
    description: 'Review readiness, delivery coverage, KYB and launch setup next.',
    className: 'border-emerald-200 bg-emerald-100/80',
    badgeClassName: 'bg-emerald-700 text-white',
  },
]

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export default function HostBusinessProfilePage() {
  const [organization, setOrganization] = useState(null)
  const [latestRequest, setLatestRequest] = useState(null)
  const [organizationType, setOrganizationType] = useState('seller')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [onboardingRequired, setOnboardingRequired] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const orgData = await getHostOperationalOrganization()

      if (!orgData?.organization) {
        setOnboardingRequired(true)
        setOrganization(null)
        return
      }

      setOnboardingRequired(false)

      const data = await getHostCommercialProfile()

      setOrganization(data?.organization || orgData.organization)
      setLatestRequest(data?.latestRequest || null)
      setOrganizationType(
        data?.organization?.organizationType ||
        orgData.organization.organizationType ||
        'seller',
      )
    } catch (requestError) {
      setError(
        getHostOperationsErrorMessage(
          requestError,
          'Unable to load Host business profile.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const data = await submitHostCommercialProfile({
        organizationType,
        note,
      })

      setOrganization(data?.organization || organization)
      setLatestRequest(data?.request || null)
      setNote('')
      setNotice('Business profile saved. EPANTRY operations has been notified.')
    } catch (requestError) {
      setError(
        getHostOperationsErrorMessage(
          requestError,
          'Unable to save Host business profile.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-2.5 pb-3 pt-0 sm:px-5 sm:pb-6 lg:px-6 lg:pb-7">
      <header className="rounded-[22px] border border-emerald-200 bg-emerald-100/85 p-4 shadow-sm sm:rounded-[28px] sm:p-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white sm:text-[10px]">
          <Store size={13} aria-hidden="true" />
          Host Business Setup
        </div>
        <h1 className="mt-3 text-[21px] font-black tracking-tight text-emerald-950 sm:mt-4 sm:text-3xl">
          <span className="sm:hidden">Choose your business setup</span>
          <span className="hidden sm:inline">Tell EPANTRY how your business operates</span>
        </h1>
        <p className="mt-1.5 max-w-3xl text-[11px] font-semibold leading-[17px] text-emerald-900/75 sm:mt-2 sm:text-sm sm:leading-6">
          <span className="sm:hidden">Pick what best fits your business. EPANTRY will organize the right Host tools for you.</span>
          <span className="hidden sm:inline">Choose the setup that best matches your business. EPANTRY uses it to organize the right Host tools and share your selection with the operations team.</span>
        </p>
      </header>

      <section className="mt-3 rounded-[22px] border border-violet-200 bg-violet-100/70 p-2.5 shadow-sm sm:mt-4 sm:rounded-[26px] sm:p-4">
        <p className="px-0.5 text-[9px] font-black uppercase tracking-[0.13em] text-violet-700 sm:text-[10px]">
          How this page works
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:grid-cols-4 sm:gap-3">
          {PROFILE_STEPS.map((step) => (
            <div
              key={step.number}
              className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.className}`}
            >
              <div className="flex items-start gap-2">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-black sm:size-6 sm:text-[10px] ${step.badgeClassName}`}>
                  {step.number}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black leading-[13px] text-stone-950 sm:text-xs sm:leading-4">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold leading-[13px] text-stone-600 sm:text-[11px] sm:leading-4">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-800 sm:mt-4 sm:p-4 sm:text-sm">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800 sm:mt-4 sm:p-4 sm:text-sm">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 grid min-h-56 place-items-center rounded-[22px] border border-sky-200 bg-sky-50 sm:mt-5 sm:min-h-72 sm:rounded-[24px]">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      ) : onboardingRequired ? (
        <section className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 p-4 sm:mt-5 sm:rounded-[24px] sm:p-6">
          <Building2 className="text-amber-700" />
          <h2 className="mt-3 text-base font-black text-amber-950 sm:text-lg">
            Set up your Host workspace first
          </h2>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-amber-800 sm:text-sm sm:leading-6">
            Your business profile is linked to your Host workspace. Complete the initial Host setup, then come back here to choose your business type.
          </p>
          <Link
            to="/host/operations"
            className="focus-ring mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-black text-white"
          >
            Open Host Dashboard
          </Link>
        </section>
      ) : (
        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[22px] border border-sky-200 bg-sky-100/70 p-3.5 shadow-sm sm:rounded-[24px] sm:p-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-700 sm:text-xs">
                {organization?.displayName || 'Host organization'}
              </p>
              <h2 className="mt-1 text-base font-black text-stone-950 sm:mt-2 sm:text-xl">
                How do you operate?
              </h2>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-600 sm:text-sm">
                Pick the option that best describes how your business works today.
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
              {PROFILE_TYPES.map((item) => (
                <label
                  key={item.value}
                  className={[
                    'cursor-pointer rounded-[16px] border p-2.5 transition sm:rounded-[20px] sm:p-4',
                    organizationType === item.value
                      ? 'border-emerald-400 bg-emerald-100/90'
                      : 'border-sky-200 bg-white/85 hover:border-sky-300',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <input
                      type="radio"
                      name="organizationType"
                      value={item.value}
                      checked={organizationType === item.value}
                      onChange={() => setOrganizationType(item.value)}
                      className="mt-0.5 accent-emerald-700 sm:mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black leading-4 text-stone-950 sm:text-sm">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[9px] font-semibold leading-[13px] text-stone-600 sm:mt-1 sm:text-xs sm:leading-5">
                        {item.description}
                      </span>
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <label className="mt-3 block sm:mt-5">
              <span className="text-[10px] font-black text-stone-700 sm:text-xs">
                Anything we should know? <span className="font-semibold text-stone-500">(optional)</span>
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                maxLength={1200}
                placeholder="Example: We supply hospitality businesses across Delhi NCR."
                className="focus-ring mt-1.5 h-20 w-full resize-y rounded-[14px] border border-sky-200 bg-white/90 px-3 py-2.5 text-[10px] font-semibold text-stone-900 outline-none sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="focus-ring ml-auto mt-3 flex w-fit items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2.5 text-[10px] font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-0 sm:mt-5 sm:inline-flex sm:px-4 sm:py-3 sm:text-xs"
            >
              {busy ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {busy ? 'Saving profile' : 'Save business profile'}
            </button>
          </section>

          <aside className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-1">
            <section className="rounded-[18px] border border-violet-200 bg-violet-100/75 p-3 shadow-sm sm:rounded-[24px] sm:p-5">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-violet-600 sm:text-[10px] sm:tracking-[0.14em]">
                Current business type
              </p>
              <p className="mt-1.5 text-sm font-black text-stone-950 sm:mt-2 sm:text-xl">
                {titleize(organization?.organizationType)}
              </p>
            </section>

            <section className="rounded-[18px] border border-cyan-200 bg-cyan-100/75 p-3 shadow-sm sm:rounded-[24px] sm:p-5">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-cyan-700 sm:text-[10px] sm:tracking-[0.14em]">
                Latest profile update
              </p>
              {latestRequest ? (
                <>
                  <p className="mt-1.5 text-[10px] font-black leading-4 text-stone-950 sm:mt-2 sm:text-sm">
                    {titleize(latestRequest.organizationType)} profile submitted
                  </p>
                  <p className="mt-1 text-[9px] font-semibold leading-[13px] text-stone-600 sm:mt-2 sm:text-xs sm:leading-5">
                    Shared with {latestRequest.notifiedAdminCount} EPANTRY operations admin account(s).
                  </p>
                  <p className="mt-1 text-[8px] text-stone-500 sm:mt-2 sm:text-[11px]">
                    {latestRequest.createdAt
                      ? new Date(latestRequest.createdAt).toLocaleString()
                      : '—'}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[9px] font-semibold leading-[13px] text-stone-600 sm:mt-2 sm:text-xs sm:leading-5">
                  No business profile update has been submitted yet.
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
