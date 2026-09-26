import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Eye,
  IndianRupee,
  Megaphone,
  Pause,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createHostCampaign,
  listHostCampaigns,
  submitHostCampaign,
} from '../../hostOperations/services/hostOperations.service'

import {
  createRetailMediaCampaignFromBrief,
  createRetailMediaCampaignPaymentIntent,
  getHostRetailMediaPricing,
  getRetailMediaErrorMessage,
  listHostRetailMediaCampaigns,
  transitionRetailMediaCampaign,
  verifyRetailMediaCampaignPayment,
} from '../services/retailMedia.service'

const RAZORPAY_CHECKOUT_URL =
  'https://checkout.razorpay.com/v1/checkout.js'

const inputClass =
  'focus-ring w-full rounded-[13px] border border-stone-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-stone-900 outline-none placeholder:text-stone-400 sm:rounded-xl sm:px-3.5 sm:text-sm'

const primaryButtonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-[13px] bg-[#176b57] px-3.5 py-2.5 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(23,107,87,0.16)] transition hover:bg-[#125846] disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-xl sm:px-4 sm:text-sm'

const PLACEMENTS = [
  'home',
  'search',
  'recipe',
  'product_detail',
  'pantry_replenishment',
  'basket_compare',
  'post_purchase',
]

const TEST_PLACEMENT_PRICING_MINOR = Object.freeze({
  home: 250000,
  search: 200000,
  recipe: 120000,
  product_detail: 150000,
  pantry_replenishment: 100000,
  basket_compare: 180000,
  post_purchase: 80000,
})

const STEP_CARDS = [
  {
    number: '01',
    title: 'Create campaign',
    text: 'Add the campaign goal and promotion details.',
    className: 'border-[#b9e9d8] bg-[#e6f8f1]',
  },
  {
    number: '02',
    title: 'Choose placements',
    text: 'Pick where the ad appears and see the price.',
    className: 'border-[#bddff2] bg-[#e9f5fb]',
  },
  {
    number: '03',
    title: 'Pay in test mode',
    text: 'Complete the Razorpay test payment to EPANTRY.',
    className: 'border-[#d8cff2] bg-[#f1edfb]',
  },
  {
    number: '04',
    title: 'Super Admin approval',
    text: 'After approval, activate the campaign here.',
    className: 'border-[#b9e9d8] bg-[#edf9f4]',
  },
]

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function formatMoneyMinor(
  amountMinor,
  currency = 'INR',
) {
  const amount =
    Number(amountMinor || 0) /
    100

  try {
    return new Intl.NumberFormat(
      'en-IN',
      {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      },
    ).format(amount)
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

function newBriefForm() {
  return {
    title: '',
    objective: 'awareness',
    commercialDisclosure: '',
  }
}

function newCampaignForm() {
  return {
    briefId: '',
    placements: ['home'],
    contextualTags: '',
    headline: '',
    body: '',
    landingRef: '',
    sponsorLabel: 'Sponsored',
  }
}

let razorpayScriptPromise = null

function loadRazorpayCheckout() {
  if (
    typeof window === 'undefined'
  ) {
    return Promise.resolve(false)
  }

  if (window.Razorpay) {
    return Promise.resolve(true)
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise
  }

  razorpayScriptPromise =
    new Promise((resolve) => {
      const existing =
        document.querySelector(
          `script[src="${RAZORPAY_CHECKOUT_URL}"]`,
        )

      if (existing) {
        existing.addEventListener(
          'load',
          () => resolve(Boolean(window.Razorpay)),
          { once: true },
        )
        existing.addEventListener(
          'error',
          () => resolve(false),
          { once: true },
        )
        return
      }

      const script =
        document.createElement('script')

      script.src =
        RAZORPAY_CHECKOUT_URL
      script.async = true
      script.dataset.epantryRetailMediaRazorpay =
        'true'
      script.onload = () =>
        resolve(Boolean(window.Razorpay))
      script.onerror = () =>
        resolve(false)

      document.body.appendChild(script)
    })

  return razorpayScriptPromise
}

export default function HostRetailMediaPage() {
  const [briefs, setBriefs] =
    useState([])

  const [campaigns, setCampaigns] =
    useState([])

  const [pricing, setPricing] =
    useState(null)

  const [briefForm, setBriefForm] =
    useState(newBriefForm())

  const [campaignForm, setCampaignForm] =
    useState(newCampaignForm())

  const [loading, setLoading] =
    useState(true)

  const [busy, setBusy] =
    useState(false)

  const [payingCampaignId, setPayingCampaignId] =
    useState('')

  const [error, setError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const load =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const [
          briefResult,
          campaignResult,
          pricingResult,
        ] = await Promise.allSettled([
          listHostCampaigns(),
          listHostRetailMediaCampaigns(),
          getHostRetailMediaPricing(),
        ])

        let criticalError = ''

        if (
          briefResult.status ===
          'fulfilled'
        ) {
          setBriefs(
            briefResult.value
              ?.campaignBriefs || [],
          )
        } else {
          criticalError =
            getRetailMediaErrorMessage(
              briefResult.reason,
              'Unable to load campaign basics right now.',
            )
        }

        if (
          campaignResult.status ===
          'fulfilled'
        ) {
          setCampaigns(
            campaignResult.value
              ?.campaigns || [],
          )
        } else if (!criticalError) {
          criticalError =
            getRetailMediaErrorMessage(
              campaignResult.reason,
              'Unable to load your sponsored campaigns right now.',
            )
        }

        if (
          pricingResult.status ===
          'fulfilled'
        ) {
          setPricing(
            pricingResult.value || null,
          )
        } else {
          setPricing(null)
        }

        if (criticalError) {
          setError(criticalError)
        }
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    load()
  }, [load])

  const submittedBriefs =
    useMemo(
      () =>
        briefs.filter(
          (brief) =>
            brief.status ===
            'submitted_for_future_media_review',
        ),
      [briefs],
    )

  const selectedBrief =
    useMemo(
      () =>
        submittedBriefs.find(
          (brief) =>
            brief.id ===
            campaignForm.briefId,
        ) || null,
      [
        campaignForm.briefId,
        submittedBriefs,
      ],
    )

  const pricingByPlacement =
    useMemo(() => {
      const map = new Map(
        PLACEMENTS.map(
          (placement) => [
            placement,
            TEST_PLACEMENT_PRICING_MINOR[
              placement
            ] || 0,
          ],
        ),
      )

      for (
        const item of
        pricing?.placementPricing || []
      ) {
        const amountMinor =
          Number(
            item.amountMinor || 0,
          )

        if (amountMinor > 0) {
          map.set(
            item.placement,
            amountMinor,
          )
        }
      }

      return map
    }, [pricing])

  const selectedPlacementTotalMinor =
    useMemo(
      () =>
        campaignForm.placements.reduce(
          (total, placement) =>
            total +
            Number(
              pricingByPlacement.get(
                placement,
              ) || 0,
            ),
          0,
        ),
      [
        campaignForm.placements,
        pricingByPlacement,
      ],
    )

  async function run(
    task,
    successMessage,
  ) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await task()
      setNotice(successMessage)
      await load()
    } catch (requestError) {
      setError(
        getRetailMediaErrorMessage(
          requestError,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  async function createBrief() {
    await run(
      async () => {
        await createHostCampaign({
          brandId: null,
          authorityGrantId: null,
          title: briefForm.title,
          objective:
            briefForm.objective,
          marketCodes: ['IN'],
          requestedPlacements: [],
          startsAt: null,
          endsAt: null,
          budgetAmountMinor: 0,
          currency: 'INR',
          promotedEntityType:
            'generic',
          promotedEntityId: '',
          commercialDisclosure:
            briefForm.commercialDisclosure,
        })

        setBriefForm(
          newBriefForm(),
        )
      },
      'Campaign basics saved. Submit the brief, then choose placements and pricing.',
    )
  }

  async function submitBrief(
    briefId,
  ) {
    await run(
      () =>
        submitHostCampaign(
          briefId,
        ),
      'Campaign brief is ready for placement setup.',
    )
  }

  async function createCampaign() {
    const tags =
      campaignForm.contextualTags
        .split(',')
        .map((value) =>
          value.trim(),
        )
        .filter(Boolean)

    await run(
      async () => {
        await createRetailMediaCampaignFromBrief({
          briefId:
            campaignForm.briefId,
          input: {
            placements:
              campaignForm.placements,
            startsAt: null,
            endsAt: null,
            dailyBudgetMinor: 0,
            lifetimeBudgetMinor:
              selectedPlacementTotalMinor,
            bidMinor: 0,
            qualityScore: 50,
            contextualTags: tags,
            frequencyCapPerContext: 3,
            headline:
              campaignForm.headline,
            body:
              campaignForm.body,
            landingRef:
              campaignForm.landingRef,
            sponsorLabel:
              campaignForm.sponsorLabel,
          },
        })

        setCampaignForm(
          newCampaignForm(),
        )
      },
      'Campaign created. Complete the Razorpay test payment; Super Admin approval comes next.',
    )
  }

  async function transition(
    campaignId,
    action,
  ) {
    await run(
      () =>
        transitionRetailMediaCampaign({
          campaignId,
          action,
        }),
      action === 'activate'
        ? 'Campaign is now active.'
        : action === 'pause'
          ? 'Campaign paused.'
          : 'Campaign resumed.',
    )
  }

  function togglePlacement(
    placement,
  ) {
    setCampaignForm(
      (current) => {
        const selected =
          current.placements.includes(
            placement,
          )

        return {
          ...current,
          placements: selected
            ? current.placements.filter(
                (item) =>
                  item !== placement,
              )
            : [
                ...current.placements,
                placement,
              ],
        }
      },
    )
  }

  async function payCampaign(
    campaign,
  ) {
    setPayingCampaignId(
      campaign.id,
    )
    setError('')
    setNotice('')

    try {
      const payment =
        await createRetailMediaCampaignPaymentIntent({
          campaignId:
            campaign.id,
        })

      if (payment?.alreadyPaid) {
        setNotice(
          'Campaign payment is already complete.',
        )
        await load()
        return
      }

      const checkout =
        payment?.checkout

      if (
        !checkout?.configured ||
        !checkout?.keyId ||
        !checkout?.providerOrderId
      ) {
        throw new Error(
          'Razorpay test payment is not configured.',
        )
      }

      if (checkout.mode !== 'test') {
        throw new Error(
          'Campaign payments are restricted to Razorpay test mode right now.',
        )
      }

      const loaded =
        await loadRazorpayCheckout()

      if (
        !loaded ||
        !window.Razorpay
      ) {
        throw new Error(
          'Unable to load Razorpay test checkout.',
        )
      }

      const razorpay =
        new window.Razorpay({
          key: checkout.keyId,
          amount:
            checkout.amountMinor,
          currency:
            checkout.currency,
          name: 'EPANTRY',
          description:
            `Sponsored campaign: ${campaign.title}`,
          order_id:
            checkout.providerOrderId,
          handler: async (
            response,
          ) => {
            try {
              await verifyRetailMediaCampaignPayment({
                campaignId:
                  campaign.id,
                razorpayPaymentId:
                  response.razorpay_payment_id,
                razorpayOrderId:
                  response.razorpay_order_id,
                razorpaySignature:
                  response.razorpay_signature,
              })

              setNotice(
                'Test payment received by the EPANTRY platform. The campaign is now waiting for Super Admin approval.',
              )
              await load()
            } catch (verifyError) {
              setError(
                getRetailMediaErrorMessage(
                  verifyError,
                  'Payment returned but verification failed.',
                ),
              )
            } finally {
              setPayingCampaignId('')
            }
          },
          modal: {
            ondismiss: () =>
              setPayingCampaignId(''),
          },
          theme: {
            color: '#176b57',
          },
        })

      razorpay.on(
        'payment.failed',
        () => {
          setError(
            'Test payment was not completed. The campaign has not been sent for approval.',
          )
          setPayingCampaignId('')
        },
      )

      razorpay.open()
    } catch (paymentError) {
      setError(
        getRetailMediaErrorMessage(
          paymentError,
          'Unable to start campaign test payment.',
        ),
      )
      setPayingCampaignId('')
    }
  }

  return (
    <div className="p-2.5 sm:p-5 lg:p-6">
      <section className="rounded-[22px] border border-[#b8e6d7] bg-[linear-gradient(135deg,#e8f8f2_0%,#edf7fb_100%)] p-3 shadow-[0_12px_30px_rgba(23,107,87,0.08)] sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#176b57] sm:text-[10px]">
              Sponsored Campaigns
            </p>

            <div className="mt-1 flex min-w-0 items-center justify-between gap-2 sm:mt-2 sm:block">
              <h1 className="min-w-0 whitespace-nowrap text-[14px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Promote your products on EPANTRY
              </h1>

              <button
                type="button"
                onClick={load}
                disabled={
                  loading ||
                  busy ||
                  Boolean(payingCampaignId)
                }
                className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#acdcca] bg-white/90 px-1.5 py-1.5 text-[8px] font-black text-[#176b57] shadow-sm disabled:opacity-40 sm:hidden"
              >
                <RefreshCw
                  size={11}
                  aria-hidden="true"
                />
                Refresh
              </button>
            </div>

            <p className="mt-1 max-w-3xl text-[8px] font-semibold leading-[1.35] text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
              <span className="block whitespace-nowrap text-[7px] sm:hidden">
                Choose placement, pay, then wait for approval.
              </span>
              <span className="hidden sm:inline">
                Choose where your promotion appears, see the placement price, pay in Razorpay test mode, then wait for Super Admin approval before going live.
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={
              loading ||
              busy ||
              Boolean(payingCampaignId)
            }
            className="focus-ring hidden shrink-0 items-center gap-1.5 rounded-xl border border-[#acdcca] bg-white/90 px-4 py-2.5 text-sm font-black text-[#176b57] shadow-sm disabled:opacity-40 sm:inline-flex"
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 xl:grid-cols-4">
          {STEP_CARDS.map(
            (step) => (
              <article
                key={step.number}
                className={`min-w-0 rounded-[14px] border p-2.5 sm:rounded-[18px] sm:p-4 ${step.className}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-8 sm:text-[10px]">
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-tight text-stone-950 sm:text-[13px]">
                      {step.number === '03' ? (
                        <>
                          <span className="sm:hidden">Make payment</span>
                          <span className="hidden sm:inline">{step.title}</span>
                        </>
                      ) : step.title}
                    </p>
                    <p className="mt-1 text-[8px] font-semibold leading-[1.35] text-stone-600 sm:text-[10px] sm:leading-4">
                      {step.number === '03' ? (
                        <>
                          <span className="sm:hidden">Pay EPANTRY securely.</span>
                          <span className="hidden sm:inline">{step.text}</span>
                        </>
                      ) : step.text}
                    </p>
                  </div>
                </div>
              </article>
            ),
          )}
        </div>

        <div
          className="mt-2 min-h-4 text-[10px] font-bold sm:mt-3 sm:min-h-5 sm:text-sm"
          aria-live="polite"
        >
          {error ? (
            <p className="text-red-700">
              {error}
            </p>
          ) : notice ? (
            <p className="text-[#176b57]">
              {notice}
            </p>
          ) : loading ? (
            <p className="text-stone-500">
              Loading campaign workspace…
            </p>
          ) : pricing?.testModeBypass ? (
            <p className="text-[#2c789d]">
              <span className="block whitespace-nowrap text-[7px] sm:hidden">
                Campaign setup is ready.
              </span>
              <span className="hidden sm:inline">
                Test workspace active · placement pricing and Razorpay checkout are available for testing.
              </span>
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:mt-4 lg:grid-cols-12 lg:items-start lg:gap-4">
        <section className="order-2 self-start rounded-[20px] border border-[#c9e8dd] bg-[linear-gradient(145deg,#eff9f5_0%,#f8fcfa_100%)] p-3 shadow-[0_12px_28px_rgba(23,107,87,0.07)] sm:order-none sm:rounded-[26px] sm:p-5 lg:col-span-5">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[12px] bg-white text-[#176b57] shadow-sm sm:size-10 sm:rounded-[14px]">
              <Megaphone
                size={17}
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-[14px] font-black text-stone-950 sm:text-lg">
                Campaign basics
              </h2>
              <p className="mt-0.5 text-[9px] font-semibold leading-[1.45] text-stone-600 sm:mt-1 sm:text-xs sm:leading-5">
                Name the promotion, choose its goal, and tell EPANTRY what you are advertising.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
            <input
              className={inputClass}
              value={briefForm.title}
              onChange={(event) =>
                setBriefForm(
                  (current) => ({
                    ...current,
                    title:
                      event.target.value,
                  }),
                )
              }
              placeholder="Campaign name"
            />

            <select
              className={inputClass}
              value={briefForm.objective}
              onChange={(event) =>
                setBriefForm(
                  (current) => ({
                    ...current,
                    objective:
                      event.target.value,
                  }),
                )
              }
            >
              <option value="awareness">Build awareness</option>
              <option value="consideration">Get consideration</option>
              <option value="conversion">Drive purchases</option>
              <option value="sampling">Promote sampling</option>
              <option value="promotion">Promote an offer</option>
            </select>

            <textarea
              rows={2}
              className={`${inputClass} sm:col-span-2`}
              value={
                briefForm.commercialDisclosure
              }
              onChange={(event) =>
                setBriefForm(
                  (current) => ({
                    ...current,
                    commercialDisclosure:
                      event.target.value,
                  }),
                )
              }
              placeholder="Briefly describe what is being promoted and any commercial offer customers should know about."
            />
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !briefForm.title.trim() ||
              briefForm.commercialDisclosure.trim().length <
                5
            }
            onClick={createBrief}
            className={`${primaryButtonClass} mt-3 sm:mt-4`}
          >
            <Megaphone
              size={15}
              aria-hidden="true"
            />
            Save campaign basics
          </button>

          {briefs.length ? (
            <div className="mt-3 space-y-2 sm:mt-4">
              {briefs.map(
                (brief) => (
                  <div
                    key={brief.id}
                    className="flex items-center justify-between gap-2 rounded-[14px] border border-[#cfe8df] bg-white/90 p-2.5 shadow-[0_5px_14px_rgba(23,107,87,0.04)] sm:rounded-2xl sm:p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black text-stone-900 sm:text-sm">
                        {brief.title}
                      </p>
                      <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[10px]">
                        {titleize(
                          brief.status,
                        )}{' '}
                        ·{' '}
                        {titleize(
                          brief.objective,
                        )}
                      </p>
                    </div>

                    {brief.status ===
                    'draft' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          submitBrief(
                            brief.id,
                          )
                        }
                        className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#b8dccf] bg-white px-2.5 py-1.5 text-[9px] font-black text-[#176b57] sm:px-3 sm:py-2 sm:text-xs"
                      >
                        <Send
                          size={12}
                          aria-hidden="true"
                        />
                        Continue
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-[#e2f5ed] px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-[#176b57] sm:text-[9px]">
                        Ready
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          ) : null}
        </section>

        <section className="order-3 self-start rounded-[20px] border border-[#c4dfee] bg-[linear-gradient(145deg,#eef7fb_0%,#f8fbfd_100%)] p-3 shadow-[0_12px_28px_rgba(34,106,144,0.07)] sm:order-none sm:rounded-[26px] sm:p-5 lg:col-span-7 lg:row-span-2">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[12px] bg-white text-[#2c789d] shadow-sm sm:size-10 sm:rounded-[14px]">
              <ShieldCheck
                size={17}
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-[14px] font-black text-stone-950 sm:text-lg">
                Placement & sponsored content
              </h2>
              <p className="mt-0.5 text-[9px] font-semibold leading-[1.45] text-stone-600 sm:mt-1 sm:text-xs sm:leading-5">
                Choose where the promotion appears. Each placement has its own fixed test price.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
            {submittedBriefs.length ? (
              <div className="rounded-[15px] border border-[#cfe3ed] bg-white/80 p-2.5 sm:rounded-2xl sm:p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-600 sm:text-[10px]">
                      Campaign to promote
                    </p>
                    <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[10px]">
                      Choose the campaign basics you completed on the left.
                    </p>
                  </div>
                  {selectedBrief ? (
                    <span className="shrink-0 rounded-full bg-[#e4f6ef] px-2 py-1 text-[8px] font-black uppercase text-[#176b57] sm:text-[9px]">
                      Selected
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 grid gap-1.5 sm:mt-3 sm:grid-cols-2 sm:gap-2">
                  {submittedBriefs.map(
                    (brief) => {
                      const selected =
                        campaignForm.briefId ===
                        brief.id

                      return (
                        <button
                          type="button"
                          key={brief.id}
                          onClick={() =>
                            setCampaignForm(
                              (current) => ({
                                ...current,
                                briefId:
                                  brief.id,
                              }),
                            )
                          }
                          className={[
                            'focus-ring min-w-0 rounded-[12px] border p-2.5 text-left transition sm:rounded-[14px] sm:p-3',
                            selected
                              ? 'border-[#65b99e] bg-[#e6f7f0] shadow-[inset_0_0_0_1px_rgba(23,107,87,0.08)]'
                              : 'border-stone-200 bg-white hover:border-[#bcd9e5]',
                          ].join(' ')}
                        >
                          <span className="block truncate text-[10px] font-black text-stone-950 sm:text-xs">
                            {brief.title}
                          </span>
                          <span className="mt-0.5 block text-[8px] font-semibold text-stone-500 sm:text-[9px]">
                            {titleize(
                              brief.objective,
                            )}
                          </span>
                        </button>
                      )
                    },
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[15px] border border-[#c9e8dd] bg-[#e8f7f1] p-2.5 sm:rounded-2xl sm:p-3.5">
                <div className="flex items-start gap-2">
                  <CircleAlert
                    size={15}
                    className="mt-0.5 shrink-0 text-[#176b57]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                      Complete campaign basics first
                    </p>
                    <p className="mt-0.5 text-[8px] font-semibold leading-[1.4] text-stone-600 sm:text-[10px]">
                      Save the campaign on the left, then tap Continue. It will appear here for placement setup.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-[15px] border border-[#d0e6f1] bg-white/75 p-2.5 sm:rounded-2xl sm:p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-600 sm:text-[10px]">
                  Choose placements · test prices
                </p>
                <span className="rounded-full bg-[#e6f7f0] px-2 py-1 text-[9px] font-black text-[#176b57] sm:text-xs">
                  {formatMoneyMinor(
                    selectedPlacementTotalMinor,
                    pricing?.currency ||
                      'INR',
                  )}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:grid-cols-3 sm:gap-2">
                {PLACEMENTS.map(
                  (placement) => {
                    const selected =
                      campaignForm.placements.includes(
                        placement,
                      )
                    const amountMinor =
                      pricingByPlacement.get(
                        placement,
                      ) || 0

                    return (
                      <button
                        type="button"
                        key={placement}
                        disabled={!campaignForm.briefId}
                        onClick={() =>
                          togglePlacement(
                            placement,
                          )
                        }
                        className={[
                          'focus-ring min-w-0 rounded-[12px] border px-2.5 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 sm:rounded-[14px] sm:px-3 sm:py-3',
                          selected
                            ? 'border-[#5bb89a] bg-[#e5f7f0] shadow-[inset_0_0_0_1px_rgba(23,107,87,0.08)]'
                            : 'border-stone-200 bg-white text-stone-600',
                        ].join(' ')}
                      >
                        <span className="block truncate text-[9px] font-black text-stone-900 sm:text-[11px]">
                          {titleize(
                            placement,
                          )}
                        </span>
                        <span className="mt-0.5 block text-[8px] font-bold text-stone-500 sm:text-[9px]">
                          {formatMoneyMinor(
                            amountMinor,
                            pricing?.currency ||
                              'INR',
                          )}
                        </span>
                      </button>
                    )
                  },
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
              <input
                className={inputClass}
                disabled={!campaignForm.briefId}
                value={campaignForm.headline}
                onChange={(event) =>
                  setCampaignForm(
                    (current) => ({
                      ...current,
                      headline:
                        event.target.value,
                    }),
                  )
                }
                placeholder="Sponsored headline"
              />

              <select
                className={inputClass}
                disabled={!campaignForm.briefId}
                value={campaignForm.sponsorLabel}
                onChange={(event) =>
                  setCampaignForm(
                    (current) => ({
                      ...current,
                      sponsorLabel:
                        event.target.value,
                    }),
                  )
                }
              >
                <option value="Sponsored">Sponsored</option>
                <option value="Ad">Ad</option>
                <option value="Paid placement">Paid placement</option>
              </select>
            </div>

            <textarea
              rows={2}
              className={inputClass}
              disabled={!campaignForm.briefId}
              value={campaignForm.body}
              onChange={(event) =>
                setCampaignForm(
                  (current) => ({
                    ...current,
                    body:
                      event.target.value,
                  }),
                )
              }
              placeholder="Short promotion message"
            />

            <input
              className={inputClass}
              disabled={!campaignForm.briefId}
              value={campaignForm.landingRef}
              onChange={(event) =>
                setCampaignForm(
                  (current) => ({
                    ...current,
                    landingRef:
                      event.target.value,
                  }),
                )
              }
              placeholder="Where should customers land? Add the EPANTRY page/reference."
            />

            <input
              className={inputClass}
              disabled={!campaignForm.briefId}
              value={campaignForm.contextualTags}
              onChange={(event) =>
                setCampaignForm(
                  (current) => ({
                    ...current,
                    contextualTags:
                      event.target.value,
                  }),
                )
              }
              placeholder="Optional context: cuisine, occasion, ingredient family"
            />

            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#d8d0ef] bg-[#f3effb] p-2.5 sm:p-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black text-stone-950 sm:text-xs">
                  <span className="sm:hidden">Amount to pay</span>
                  <span className="hidden sm:inline">Test payment total</span>
                </p>
                <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[10px]">
                  <span className="block whitespace-nowrap text-[7px] sm:hidden">
                    Payment goes to EPANTRY before approval.
                  </span>
                  <span className="hidden sm:inline">
                    {pricing?.paymentProvider?.configured &&
                    pricing?.paymentProvider?.mode === 'test'
                      ? 'Razorpay test checkout ready · payment goes to the EPANTRY platform before Super Admin review.'
                      : 'This is the test amount. Configure Razorpay test keys before payment.'}
                  </span>
                </p>
              </div>
              <p className="shrink-0 text-[15px] font-black text-[#5f4a95] sm:text-xl">
                {formatMoneyMinor(
                  selectedPlacementTotalMinor,
                  pricing?.currency ||
                    'INR',
                )}
              </p>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !campaignForm.briefId ||
                !campaignForm.placements.length ||
                selectedPlacementTotalMinor <=
                  0 ||
                !campaignForm.headline.trim() ||
                !campaignForm.landingRef.trim()
              }
              onClick={createCampaign}
              className={primaryButtonClass}
            >
              <ShieldCheck
                size={15}
                aria-hidden="true"
              />
              Create campaign
            </button>
          </div>
        </section>

        <section className="order-1 self-start rounded-[20px] border border-[#d7d0ee] bg-[linear-gradient(145deg,#f4f1fb_0%,#fbf9ff_100%)] p-3 shadow-[0_12px_28px_rgba(95,74,149,0.07)] sm:order-none sm:rounded-[26px] sm:p-5 lg:col-span-5">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[12px] bg-white text-[#6c52a4] shadow-sm sm:size-10 sm:rounded-[14px]">
              <BadgeCheck
                size={17}
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-black text-stone-950 sm:text-lg">
                  Your campaigns
                </h2>
                <span className="shrink-0 rounded-full border border-[#ddd4ef] bg-white/90 px-2 py-1 text-[8px] font-black text-[#6c52a4] sm:text-[9px]">
                  {campaigns.length}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] font-semibold leading-[1.45] text-stone-600 sm:mt-1 sm:text-xs sm:leading-5">
                Pay first, then Super Admin reviews the campaign. Approved campaigns can be activated from here.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3">
            {campaigns.length ? (
              campaigns.map(
                (campaign) => {
                  const payment =
                    campaign.payment || {}
                  const isPaid =
                    payment.status ===
                    'paid'
                  const isPaying =
                    payingCampaignId ===
                    campaign.id

                  return (
                    <article
                      key={campaign.id}
                      className="overflow-hidden rounded-[16px] border border-[#ded7f0] bg-white/90 p-3 shadow-[0_7px_18px_rgba(95,74,149,0.06)] sm:rounded-[20px] sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-black text-stone-950 sm:text-sm">
                            {campaign.title}
                          </p>
                          <p className="mt-0.5 text-[8px] font-bold text-stone-500 sm:text-[10px]">
                            {titleize(
                              campaign.objective,
                            )}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="rounded-full bg-[#e6f7f0] px-2 py-1 text-[8px] font-black uppercase text-[#176b57] sm:text-[9px]">
                            {campaign.creative?.sponsorLabel ||
                              'Sponsored'}
                          </span>
                          <span className="rounded-full border border-[#ddd4ef] bg-[#f7f4fc] px-2 py-1 text-[7px] font-black uppercase tracking-[0.06em] text-[#6c52a4] sm:text-[8px]">
                            {titleize(campaign.status)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1 sm:mt-3">
                        {(campaign.placements || []).map(
                          (placement) => (
                            <span
                              key={placement}
                              className="rounded-full border border-[#d3e7ef] bg-[#eef7fb] px-2 py-1 text-[8px] font-black text-[#2c6d8e] sm:text-[9px]"
                            >
                              {titleize(
                                placement,
                              )}
                            </span>
                          ),
                        )}
                      </div>

                      <div className="mt-2 rounded-[13px] border border-stone-100 bg-[#fafaf8] p-2.5 sm:mt-3 sm:p-3">
                        <p className="text-[10px] font-black text-stone-900 sm:text-xs">
                          {campaign.creative?.headline ||
                            'Sponsored content'}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[8px] font-semibold leading-[1.4] text-stone-500 sm:text-[10px] sm:leading-4">
                          {campaign.creative?.body ||
                            campaign.commercialDisclosure}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3 rounded-[13px] border border-[#cbe7dc] bg-[linear-gradient(135deg,#edf9f4_0%,#f5fbf8_100%)] p-2.5 sm:mt-3 sm:p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isPaid ? (
                              <CheckCircle2
                                size={13}
                                className="text-[#176b57]"
                                aria-hidden="true"
                              />
                            ) : (
                              <CreditCard
                                size={13}
                                className="text-[#6c52a4]"
                                aria-hidden="true"
                              />
                            )}
                            <p className="text-[9px] font-black text-stone-950 sm:text-xs">
                              {isPaid
                                ? 'Payment received'
                                : 'Payment required'}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[9px]">
                            {payment.recipient ||
                              pricing?.recipient ||
                              'EPANTRY platform'}
                          </p>
                        </div>

                        <p className="shrink-0 text-[13px] font-black text-stone-950 sm:text-lg">
                          {formatMoneyMinor(
                            payment.requiredAmountMinor,
                            payment.currency ||
                              pricing?.currency ||
                              'INR',
                          )}
                        </p>
                      </div>

                      {campaign.status ===
                        'pending_review' &&
                      !isPaid ? (
                        <button
                          type="button"
                          disabled={
                            busy ||
                            isPaying ||
                            pricing?.paymentProvider?.mode !==
                              'test'
                          }
                          onClick={() =>
                            payCampaign(
                              campaign,
                            )
                          }
                          className={`${primaryButtonClass} mt-2 w-full sm:mt-3`}
                        >
                          <IndianRupee
                            size={14}
                            aria-hidden="true"
                          />
                          {isPaying ? (
                            <>
                              <span className="sm:hidden">Opening payment…</span>
                              <span className="hidden sm:inline">Opening test payment…</span>
                            </>
                          ) : (
                            <>
                              <span className="sm:hidden">
                                Pay {formatMoneyMinor(
                                  payment.requiredAmountMinor,
                                  payment.currency || 'INR',
                                )}
                              </span>
                              <span className="hidden sm:inline">
                                Pay {formatMoneyMinor(
                                  payment.requiredAmountMinor,
                                  payment.currency || 'INR',
                                )} · Test mode
                              </span>
                            </>
                          )}
                        </button>
                      ) : null}

                      {campaign.status ===
                        'pending_review' &&
                      isPaid ? (
                        <div className="mt-2 flex items-start gap-2 rounded-[12px] border border-[#c7dded] bg-[#edf6fb] p-2.5 text-[9px] font-semibold leading-[1.4] text-[#275f7c] sm:mt-3 sm:text-[10px]">
                          <ShieldCheck
                            size={14}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          Payment complete. Waiting for Super Admin approval.
                        </div>
                      ) : null}

                      {campaign.review?.reason ? (
                        <div className="mt-2 flex items-start gap-2 rounded-[12px] border border-stone-200 bg-white p-2.5 text-[9px] font-semibold leading-[1.4] text-stone-600 sm:mt-3 sm:text-[10px]">
                          <CircleAlert
                            size={14}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          Review note: {campaign.review.reason}
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
                        {campaign.status ===
                          'approved' &&
                        isPaid ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              transition(
                                campaign.id,
                                'activate',
                              )
                            }
                            className={primaryButtonClass}
                          >
                            <Play
                              size={14}
                              aria-hidden="true"
                            />
                            Activate campaign
                          </button>
                        ) : null}

                        {campaign.status ===
                        'active' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              transition(
                                campaign.id,
                                'pause',
                              )
                            }
                            className="focus-ring inline-flex items-center gap-2 rounded-[12px] border border-stone-200 bg-white px-3 py-2 text-[10px] font-black text-stone-700 sm:text-xs"
                          >
                            <Pause
                              size={14}
                              aria-hidden="true"
                            />
                            Pause
                          </button>
                        ) : null}

                        {campaign.status ===
                        'paused' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              transition(
                                campaign.id,
                                'resume',
                              )
                            }
                            className={primaryButtonClass}
                          >
                            <Play
                              size={14}
                              aria-hidden="true"
                            />
                            Resume
                          </button>
                        ) : null}
                      </div>
                    </article>
                  )
                },
              )
            ) : (
              <p className="rounded-[15px] border border-[#e3ddf1] bg-white/80 p-3 text-[10px] font-semibold leading-[1.5] text-stone-500 sm:text-sm">
                No sponsored campaigns yet. Create campaign basics above to get started.
              </p>
            )}
          </div>
        </section>

      </div>

      <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
        <div className="flex items-start gap-2 rounded-[16px] border border-[#c7e4d8] bg-[#eef9f4] p-3 text-[9px] font-semibold leading-[1.5] text-stone-600 sm:text-[10px]">
          <Eye
            size={15}
            className="mt-0.5 shrink-0 text-[#176b57]"
            aria-hidden="true"
          />
          <p>
            <span className="block whitespace-nowrap text-[7px] sm:hidden">
              Promotions are labeled; normal results stay unchanged.
            </span>
            <span className="hidden sm:inline">
              Every promotion is clearly labeled Sponsored / Ad / Paid placement. Paid ranking never changes organic “best match”, “best value” or safety conclusions.
            </span>
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-[16px] border border-[#cbdfea] bg-[#eef7fb] p-3 text-[9px] font-semibold leading-[1.5] text-stone-600 sm:text-[10px]">
          <ShieldCheck
            size={15}
            className="mt-0.5 shrink-0 text-[#2c789d]"
            aria-hidden="true"
          />
          <p>
            <span className="block whitespace-nowrap text-[7px] sm:hidden">
              Health and allergy data is never used for ads.
            </span>
            <span className="hidden sm:inline">
              Sensitive health or allergy inferences are never advertising targeting segments. Product and Recipe ads remain subject to independent safety eligibility.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
