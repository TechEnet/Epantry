import {
  BadgeCheck,
  CircleAlert,
  Megaphone,
  ShieldCheck,
} from 'lucide-react'

import {
  useState,
} from 'react'

import {
  decideSafeSponsoredPlacement,
  getExpansionExecutionErrorMessage,
} from '../services/expansionExecution.service'

export default function SafeSponsoredPlacement({
  searchSessionId,
  placement = 'search',
}) {
  const [
    pincode,
    setPincode,
  ] =
    useState(
      '',
    )

  const [
    sponsored,
    setSponsored,
  ] =
    useState(
      null,
    )

  const [
    policy,
    setPolicy,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  if (!searchSessionId) {
    return null
  }

  async function loadSponsored() {
    setLoading(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await decideSafeSponsoredPlacement({
          searchSessionId,
          placement,

          marketCode:
            'IN',

          ...(pincode.trim()
            ? {
                pincode:
                  pincode.trim(),
              }
            : {}),
        })

      setSponsored(
        result?.sponsored ||
        null,
      )

      setPolicy(
        result?.policy ||
        null,
      )
    } catch (
      requestError
    ) {
      setError(
        getExpansionExecutionErrorMessage(
          requestError,
          'Sponsored eligibility could not be evaluated.',
        ),
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  return (
    <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck
          size={20}
          className="mt-0.5 shrink-0 text-amber-800"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">
            M22 safe sponsored discovery
          </p>

          <h3 className="mt-1 text-base font-black text-stone-950">
            Paid rank only after organic safety
          </h3>

          <p className="mt-2 text-xs font-semibold leading-5 text-stone-600">
            Product or Recipe sponsorship cannot resurrect an item removed by dietary, allergen or other deterministic hard constraints. The candidate must already exist in this Search session&apos;s organic eligible set, and Food Intelligence is rechecked before paid rank.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={
                pincode
              }
              onChange={(
                event,
              ) =>
                setPincode(
                  event.target.value,
                )
              }
              placeholder="Pincode for Product serviceability (optional for Recipe)"
              className="focus-ring min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-800 outline-none"
            />

            <button
              type="button"
              disabled={
                loading
              }
              onClick={
                loadSponsored
              }
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              <Megaphone
                size={15}
                aria-hidden="true"
              />

              {loading
                ? 'Checking…'
                : 'Check sponsored option'}
            </button>
          </div>

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">
              <CircleAlert
                size={15}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              {error}
            </div>
          ) : null}

          {sponsored ? (
            <article className="mt-4 rounded-2xl border border-amber-300 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-900">
                  {sponsored.sponsorLabel ||
                    'Sponsored'}
                </span>

                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-700">
                  <BadgeCheck
                    size={13}
                    aria-hidden="true"
                  />

                  Organic eligible first
                </span>
              </div>

              <h4 className="mt-3 text-base font-black text-stone-950">
                {sponsored.headline}
              </h4>

              {sponsored.body ? (
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {sponsored.body}
                </p>
              ) : null}

              <div className="mt-3 rounded-xl bg-stone-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                  Why am I seeing this?
                </p>

                <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-stone-600">
                  {(sponsored.whyAmISeeingThis || []).map(
                    (
                      reason,
                    ) => (
                      <li
                        key={
                          reason
                        }
                      >
                        • {reason}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </article>
          ) : policy ? (
            <p className="mt-3 rounded-xl border border-stone-200 bg-white p-3 text-xs font-semibold leading-5 text-stone-600">
              No eligible paid Product/Recipe unit was served. Organic results remain unchanged.
            </p>
          ) : null}

          <p className="mt-3 text-[11px] font-semibold leading-5 text-amber-950">
            Sponsored placement never changes the organic result order, never weakens allergen safety, and never converts unknown evidence into a verified-safe claim.
          </p>
        </div>
      </div>
    </section>
  )
}