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
    description: 'Sell products through EPANTRY marketplace operations.',
  },
  {
    value: 'b2b',
    label: 'B2B / Hospitality',
    description: 'Operate hospitality, procurement or professional food workflows.',
  },
  {
    value: 'brand',
    label: 'Brand',
    description: 'Operate as a brand. Canonical brand authority still requires the separate Brand Authority grant.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Use more than one Host commercial function under the same organization.',
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
      setNotice('Business profile saved. Super Admin has been notified in the Notification Center.')
    } catch (requestError) {
      setError(
        getHostOperationsErrorMessage(
          requestError,
          'Unable to declare Host business profile.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-7">
      <header className="rounded-[28px] bg-stone-950 p-6 text-white shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
          <Store size={14} aria-hidden="true" />
          Host Business Profile
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight">
          Choose how this Host operates
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
          For now, the Host may self-declare Seller, B2B, Brand or Hybrid. Every declaration sends an in-app operational notification to active Super Admin accounts.
        </p>
      </header>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 grid min-h-72 place-items-center rounded-[24px] border border-stone-200 bg-white">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      ) : onboardingRequired ? (
        <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-6">
          <Building2 className="text-amber-700" />
          <h2 className="mt-3 text-lg font-black text-amber-950">
            Initialize your Host organization first
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Business profile declaration belongs to a Host organization. Complete the organization setup on the Host Dashboard first.
          </p>
          <Link
            to="/host/operations"
            className="focus-ring mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-black text-white"
          >
            Open Host Dashboard
          </Link>
        </section>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                {organization?.displayName || 'Host organization'}
              </p>
              <h2 className="mt-2 text-xl font-black text-stone-950">
                Commercial type
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Select the type that best describes the current Host operation.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {PROFILE_TYPES.map((item) => (
                <label
                  key={item.value}
                  className={[
                    'cursor-pointer rounded-[20px] border p-4 transition',
                    organizationType === item.value
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-stone-200 bg-white hover:border-stone-300',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="organizationType"
                      value={item.value}
                      checked={organizationType === item.value}
                      onChange={() => setOrganizationType(item.value)}
                      className="mt-1 accent-emerald-700"
                    />
                    <span>
                      <span className="block text-sm font-black text-stone-950">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">
                        {item.description}
                      </span>
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-black text-stone-700">
                Optional note for Super Admin
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                maxLength={1200}
                placeholder="Example: We operate as a B2B hospitality supplier in Delhi NCR."
                className="focus-ring mt-2 w-full resize-y rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none"
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="focus-ring mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {busy ? 'Saving profile' : 'Save & notify Super Admin'}
            </button>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                Current organization type
              </p>
              <p className="mt-2 text-xl font-black text-stone-950">
                {titleize(organization?.organizationType)}
              </p>
            </section>

            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                Latest Super Admin notification
              </p>
              {latestRequest ? (
                <>
                  <p className="mt-2 text-sm font-black text-stone-950">
                    {titleize(latestRequest.organizationType)} declared
                  </p>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    Sent to {latestRequest.notifiedAdminCount} active Super Admin account(s).
                  </p>
                  <p className="mt-2 text-[11px] text-stone-400">
                    {latestRequest.createdAt
                      ? new Date(latestRequest.createdAt).toLocaleString()
                      : '—'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  No commercial profile notification has been sent yet.
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
