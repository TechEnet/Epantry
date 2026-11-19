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
  getBasketQuote,
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
    quoteDetails,
    setQuoteDetails,
  ] = useState(null)

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

      setLoading(true)
      setError('')
      setPartners([])
      setPartnerId('')
      setQuoteDetails(null)

      async function load() {
        try {
          const [result, currentQuote] =
            await Promise.all([
              getExternalHandoffPartners(),
              getBasketQuote(quoteId),
            ])

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

          setQuoteDetails(currentQuote)

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
    [quoteId],
  )

  async function handleHandoff() {
    if (
      !quoteId ||
      !partnerId ||
      !quoteDetails?.unmatchedRequirements?.length ||
      quoteDetails.quote?.stale ||
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
                External shopping
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              Browse a retailer for missing items
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">
              Your missing items are not currently covered by eligible EPANTRY offers.
              You can visit an approved retailer website, but EPANTRY has not
              verified that retailer's exact product, pack size, price or stock.
            </p>

            {quoteDetails?.quote?.stale && (
              <p role="alert" className="mt-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                Your basket has changed. Return to Compare and refresh your offers
                before visiting a retailer.
              </p>
            )}

            {Array.isArray(quoteDetails?.unmatchedRequirements) &&
              quoteDetails.unmatchedRequirements.length > 0 && (
              <section className="mt-6 border-y border-[#D6E2D8] bg-[#F1F6EF] px-4 py-4">
                <h2 className="text-lg font-bold text-[#173F35]">Items you still need</h2>
                <p className="mt-1 text-sm text-[#526459]">
                  Use this list to search at the retailer. Packs and availability
                  are not pre-matched on external websites.
                </p>
                <ul className="mt-3 divide-y divide-[#D6E2D8]">
                  {quoteDetails.unmatchedRequirements.map((item) => (
                    <li key={item.requirementLineId} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                      <span className="font-semibold text-[#173F35]">{item.label}</span>
                      <span className="text-[#4E655A]">{item.quantity} {item.unit || ''}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
                    You can return to the comparison to review eligible EPANTRY offers.
                    No external retailer link is available until a partner is configured.
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
                      !quoteDetails?.unmatchedRequirements?.length ||
                      quoteDetails.quote?.stale ||
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
                        ? 'Opening retailer…'
                        : `Visit ${selected?.label || 'retailer'} website`
                    }
                  </button>
                </div>
              )}
            </div>

            {selected && !loading && (
              <div className="mt-5 border-l-[3px] border-amber-500 bg-[#FFF5DC] px-4 py-4 text-sm leading-6 text-[#5C4828]">
                <p className="font-semibold">Before you visit {selected.label}</p>
                <p className="mt-1">
                  This opens a retailer website, not an EPANTRY checkout. Search for
                  the correct product and pack size there and confirm its price,
                  delivery fees, stock and payment terms independently.
                </p>
                <p className="mt-2 font-semibold">
                  {selected.relationship === 'affiliate'
                    ? 'Disclosure: EPANTRY may earn a commission from this affiliate link.'
                    : selected.relationship === 'commercial'
                      ? 'Disclosure: EPANTRY has a commercial relationship with this retailer.'
                      : selected.relationship === 'none'
                        ? 'Partner registry reports no commercial relationship for this link.'
                        : 'Commercial relationship details have not been provided for this partner.'}
                </p>
                <p className="mt-1">Retailers are not ranked by affiliate commission.</p>
              </div>
            )}

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

              The website link comes from EPANTRY's approved HTTPS partner list.
              Visiting it does not create an EPANTRY order or reserve any product.
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}