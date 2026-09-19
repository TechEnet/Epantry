import {
  useEffect,
  useState,
} from 'react'

import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  createCommerceIdempotencyKey,
  createExternalHandoff,
  getCommerceErrorMessage,
  getExternalHandoffPartners,
} from '../services/commerce.service'

export default function ExternalHandoffPage() {
  const {
    planId,
    quoteId,
  } =
    useParams()

  const [
    partners,
    setPartners,
  ] =
    useState(
      [],
    )

  const [
    partnerId,
    setPartnerId,
  ] =
    useState(
      '',
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    handingOff,
    setHandingOff,
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

  useEffect(
    () => {
      let active =
        true

      async function load() {
        try {
          const result =
            await getExternalHandoffPartners()

          if (
            !active
          ) {
            return
          }

          const available =
            result?.partners ||
            []

          setPartners(
            available,
          )

          setPartnerId(
            available[0]?.id ||
            '',
          )
        } catch (
          loadError
        ) {
          if (
            active
          ) {
            setError(
              getCommerceErrorMessage(
                loadError,
                'Unable to load external retailer partners.',
              ),
            )
          }
        } finally {
          if (
            active
          ) {
            setLoading(
              false,
            )
          }
        }
      }

      load()

      return () => {
        active =
          false
      }
    },
    [],
  )

  async function handleHandoff() {
    if (
      !quoteId ||
      !partnerId ||
      handingOff
    ) {
      return
    }

    setHandingOff(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await createExternalHandoff({
          basketQuoteId:
            quoteId,

          partnerId,

          idempotencyKey:
            createCommerceIdempotencyKey(
              'external-handoff',
            ),
        })

      const destination =
        result?.handoff
          ?.destinationUrl

      if (
        !destination
      ) {
        throw new Error(
          'Retailer destination was not returned.',
        )
      }

      window.location.assign(
        destination,
      )
    } catch (
      handoffError
    ) {
      setError(
        getCommerceErrorMessage(
          handoffError,
          'Unable to prepare external retailer handoff.',
        ),
      )

      setHandingOff(
        false,
      )
    }
  }

  const selected =
    partners.find(
      (
        partner,
      ) =>
        partner.id ===
        partnerId,
    ) ||
    null

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="page-shell py-6 sm:py-9">
        <Link
          to={`/outcome-plans/${planId}/compare`}
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 hover:text-stone-950"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Back to Fulfillment Compare
        </Link>

        <section className="mt-3 overflow-hidden rounded-[30px] border border-sky-200 bg-white shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sky-700">
              <ExternalLink
                size={18}
                aria-hidden="true"
              />

              <p className="text-xs font-black uppercase tracking-[0.14em]">
                P21 · External Handoff
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              Continue unmatched requirements outside EPANTRY
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">
              External retailer product selection, price, payment and
              fulfilment remain outside the EPANTRY transaction.
            </p>

            <div className="mt-6 rounded-[24px] border border-sky-200 bg-sky-50 p-5">
              {loading ? (
                <p className="text-sm font-bold text-sky-900">
                  Loading configured retailer partners…
                </p>
              ) : partners.length ===
                0 ? (
                <div>
                  <h2 className="font-black text-sky-950">
                    No external retailer partner configured
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-sky-800">
                    EPANTRY will not accept arbitrary redirect URLs from the
                    browser.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="text-xs font-black uppercase tracking-[0.1em] text-sky-700">
                    Retailer partner

                    <select
                      value={
                        partnerId
                      }
                      onChange={(
                        event,
                      ) =>
                        setPartnerId(
                          event.target.value,
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-sky-300 bg-white px-3 py-3 text-sm font-black text-stone-900 outline-none focus:border-sky-600"
                    >
                      {partners.map(
                        (
                          partner,
                        ) => (
                          <option
                            key={
                              partner.id
                            }
                            value={
                              partner.id
                            }
                          >
                            {
                              partner.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={
                      handleHandoff
                    }
                    disabled={
                      !partnerId ||
                      handingOff
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ExternalLink
                      size={16}
                      aria-hidden="true"
                    />

                    {
                      handingOff
                        ? 'Preparing handoff…'
                        : `Leave EPANTRY for ${selected?.label || 'retailer'}`
                    }
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-start gap-2 text-xs font-semibold leading-5 text-stone-500">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              Destination URL is resolved by the server from the approved HTTPS
              partner registry. The browser sends only partner identity.
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}