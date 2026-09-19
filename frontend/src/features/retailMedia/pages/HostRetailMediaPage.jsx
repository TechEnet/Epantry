import {
  BadgeCheck,
  CircleAlert,
  Eye,
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
  getRetailMediaErrorMessage,
  listHostRetailMediaCampaigns,
  transitionRetailMediaCampaign,
} from '../services/retailMedia.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

const buttonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40'

const PLACEMENTS = [
  'home',
  'search',
  'recipe',
  'product_detail',
  'pantry_replenishment',
  'basket_compare',
  'post_purchase',
]

function titleize(value) {
  return String(
    value || '',
  )
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function newBriefForm() {
  return {
    title: '',
    objective: 'awareness',
    budgetAmountMinor: 0,
    commercialDisclosure: '',
  }
}

function newCampaignForm() {
  return {
    briefId: '',
    placements: [
      'home',
    ],
    dailyBudgetMinor: 0,
    lifetimeBudgetMinor: 0,
    bidMinor: 0,
    qualityScore: 50,
    contextualTags: '',
    frequencyCapPerContext: 3,
    headline: '',
    body: '',
    landingRef: '',
    sponsorLabel: 'Sponsored',
  }
}

export default function HostRetailMediaPage() {
  const [briefs, setBriefs] =
    useState([])

  const [campaigns, setCampaigns] =
    useState([])

  const [briefForm, setBriefForm] =
    useState(
      newBriefForm(),
    )

  const [campaignForm, setCampaignForm] =
    useState(
      newCampaignForm(),
    )

  const [loading, setLoading] =
    useState(true)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const [
            briefResult,
            campaignResult,
          ] =
            await Promise.all([
              listHostCampaigns(),
              listHostRetailMediaCampaigns(),
            ])

          setBriefs(
            briefResult?.campaignBriefs ||
              [],
          )

          setCampaigns(
            campaignResult?.campaigns ||
              [],
          )
        } catch (requestError) {
          setError(
            getRetailMediaErrorMessage(
              requestError,
              'Unable to load S10 Retail Media.',
            ),
          )
        } finally {
          setLoading(false)
        }
      },
      [],
    )

  useEffect(
    () => {
      load()
    },
    [load],
  )

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

  async function run(
    task,
    successMessage,
  ) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await task()
      setNotice(
        successMessage,
      )
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
          title:
            briefForm.title,
          objective:
            briefForm.objective,
          marketCodes: [
            'IN',
          ],
          requestedPlacements: [],
          startsAt: null,
          endsAt: null,
          budgetAmountMinor:
            Number(
              briefForm.budgetAmountMinor ||
                0,
            ),
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
      'Governed Host Campaign Brief created. Submit it before creating a Retail Media campaign.',
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
      'Campaign Brief submitted to M21 Retail Media policy review input.',
    )
  }

  async function createCampaign() {
    const tags =
      campaignForm.contextualTags
        .split(',')
        .map(
          (value) =>
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
            dailyBudgetMinor:
              Number(
                campaignForm.dailyBudgetMinor ||
                  0,
              ),
            lifetimeBudgetMinor:
              Number(
                campaignForm.lifetimeBudgetMinor ||
                  0,
              ),
            bidMinor:
              Number(
                campaignForm.bidMinor ||
                  0,
              ),
            qualityScore:
              Number(
                campaignForm.qualityScore ||
                  50,
              ),
            contextualTags:
              tags,
            frequencyCapPerContext:
              Number(
                campaignForm.frequencyCapPerContext ||
                  3,
              ),
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
      'Retail Media campaign created in pending policy review state.',
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
      `Campaign ${action} completed.`,
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
          placements:
            selected
              ? current.placements.filter(
                  (item) =>
                    item !==
                    placement,
                )
              : [
                  ...current.placements,
                  placement,
                ],
        }
      },
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-7">
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              M21 · S10 Retail Media Studio
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
              Governed sponsored discovery
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-stone-600">
              Campaigns originate from the frozen M16 Host Campaign Brief, require M21 policy approval, and keep paid rank separate from organic relevance and safety. Sensitive health or allergy inferences are never advertising targeting segments.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading || busy}
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 disabled:opacity-40"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        <div
          className="mt-4 min-h-6 text-sm font-bold"
          aria-live="polite"
        >
          {error ? (
            <p className="text-red-700">
              {error}
            </p>
          ) : notice ? (
            <p className="text-emerald-800">
              {notice}
            </p>
          ) : loading ? (
            <p className="text-stone-500">
              Loading Retail Media governance…
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <Megaphone
              size={22}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-lg font-black text-stone-950">
                1. Host Campaign Brief
              </h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                M16 remains the commercial intent intake. M21 does not bypass its organization and Brand-authority controls.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
              placeholder="Campaign title"
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
              <option value="awareness">Awareness</option>
              <option value="consideration">Consideration</option>
              <option value="conversion">Conversion</option>
              <option value="sampling">Sampling</option>
              <option value="promotion">Promotion</option>
            </select>

            <input
              type="number"
              min="0"
              className={inputClass}
              value={briefForm.budgetAmountMinor}
              onChange={(event) =>
                setBriefForm(
                  (current) => ({
                    ...current,
                    budgetAmountMinor:
                      Number(
                        event.target.value,
                      ),
                  }),
                )
              }
              placeholder="Budget minor units"
            />

            <textarea
              rows={3}
              className={`${inputClass} sm:col-span-2`}
              value={briefForm.commercialDisclosure}
              onChange={(event) =>
                setBriefForm(
                  (current) => ({
                    ...current,
                    commercialDisclosure:
                      event.target.value,
                  }),
                )
              }
              placeholder="Commercial disclosure"
            />
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !briefForm.title.trim() ||
              briefForm.commercialDisclosure.trim().length < 5
            }
            onClick={createBrief}
            className={`${buttonClass} mt-4`}
          >
            <Megaphone
              size={16}
              aria-hidden="true"
            />
            Create brief
          </button>

          <div className="mt-5 space-y-2">
            {briefs.map(
              (brief) => (
                <div
                  key={brief.id}
                  className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-black text-stone-900">
                      {brief.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      {titleize(
                        brief.status,
                      )} · {brief.objective}
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
                      className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                    >
                      <Send
                        size={14}
                        aria-hidden="true"
                      />
                      Submit
                    </button>
                  ) : null}
                </div>
              ),
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={22}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-lg font-black text-stone-950">
                2. Retail Media campaign
              </h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                Every served unit carries an explicit Sponsored / Ad / Paid placement label and always preserves an organic path.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <select
              className={inputClass}
              value={campaignForm.briefId}
              onChange={(event) =>
                setCampaignForm(
                  (current) => ({
                    ...current,
                    briefId:
                      event.target.value,
                  }),
                )
              }
            >
              <option value="">
                Select submitted Campaign Brief
              </option>
              {submittedBriefs.map(
                (brief) => (
                  <option
                    key={brief.id}
                    value={brief.id}
                  >
                    {brief.title}
                  </option>
                ),
              )}
            </select>

            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-stone-500">
                Placements
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PLACEMENTS.map(
                  (placement) => {
                    const selected =
                      campaignForm.placements.includes(
                        placement,
                      )

                    return (
                      <button
                        type="button"
                        key={placement}
                        onClick={() =>
                          togglePlacement(
                            placement,
                          )
                        }
                        className={[
                          'focus-ring rounded-full px-3 py-2 text-xs font-black',
                          selected
                            ? 'bg-emerald-700 text-white'
                            : 'border border-stone-200 bg-white text-stone-600',
                        ].join(' ')}
                      >
                        {titleize(
                          placement,
                        )}
                      </button>
                    )
                  },
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
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
                placeholder="Sponsored creative headline"
              />

              <select
                className={inputClass}
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

              <textarea
                rows={3}
                className={`${inputClass} sm:col-span-2`}
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
                placeholder="Creative body"
              />

              <input
                className={`${inputClass} sm:col-span-2`}
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
                placeholder="EPANTRY landing reference"
              />

              <input
                className={`${inputClass} sm:col-span-2`}
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
                placeholder="Context tags, comma separated — cuisine, occasion, ingredient family; never allergy/health targeting"
              />

              <input
                type="number"
                min="0"
                className={inputClass}
                value={campaignForm.dailyBudgetMinor}
                onChange={(event) =>
                  setCampaignForm(
                    (current) => ({
                      ...current,
                      dailyBudgetMinor:
                        Number(
                          event.target.value,
                        ),
                    }),
                  )
                }
                placeholder="Daily budget minor"
              />

              <input
                type="number"
                min="0"
                className={inputClass}
                value={campaignForm.lifetimeBudgetMinor}
                onChange={(event) =>
                  setCampaignForm(
                    (current) => ({
                      ...current,
                      lifetimeBudgetMinor:
                        Number(
                          event.target.value,
                        ),
                    }),
                  )
                }
                placeholder="Lifetime budget minor"
              />

              <input
                type="number"
                min="0"
                className={inputClass}
                value={campaignForm.bidMinor}
                onChange={(event) =>
                  setCampaignForm(
                    (current) => ({
                      ...current,
                      bidMinor:
                        Number(
                          event.target.value,
                        ),
                    }),
                  )
                }
                placeholder="Bid minor"
              />

              <input
                type="number"
                min="0"
                max="100"
                className={inputClass}
                value={campaignForm.qualityScore}
                onChange={(event) =>
                  setCampaignForm(
                    (current) => ({
                      ...current,
                      qualityScore:
                        Number(
                          event.target.value,
                        ),
                    }),
                  )
                }
                placeholder="Quality score"
              />

              <input
                type="number"
                min="1"
                max="50"
                className={inputClass}
                value={campaignForm.frequencyCapPerContext}
                onChange={(event) =>
                  setCampaignForm(
                    (current) => ({
                      ...current,
                      frequencyCapPerContext:
                        Number(
                          event.target.value,
                        ),
                    }),
                  )
                }
                placeholder="Frequency cap"
              />
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !campaignForm.briefId ||
                !campaignForm.placements.length ||
                !campaignForm.headline.trim() ||
                !campaignForm.landingRef.trim()
              }
              onClick={createCampaign}
              className={buttonClass}
            >
              <ShieldCheck
                size={16}
                aria-hidden="true"
              />
              Create pending-review campaign
            </button>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <BadgeCheck
            size={22}
            className="mt-0.5 text-emerald-700"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-black text-stone-950">
              Governed campaign lifecycle
            </h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Admin Trust & Safety approval is required before activation. M21 does not claim billing, settlement, ROAS or transaction attribution from an impression.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {campaigns.length ? (
            campaigns.map(
              (campaign) => (
                <article
                  key={campaign.id}
                  className="rounded-2xl border border-stone-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-stone-950">
                        {campaign.title}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        {titleize(
                          campaign.status,
                        )} · {campaign.objective}
                      </p>
                    </div>

                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-900">
                      {campaign.creative?.sponsorLabel ||
                        'Sponsored'}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl bg-stone-50 p-3">
                    <p className="text-sm font-black text-stone-900">
                      {campaign.creative?.headline ||
                        'Creative pending'}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">
                      {campaign.creative?.body ||
                        campaign.commercialDisclosure}
                    </p>
                  </div>

                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-950">
                    <Eye
                      size={16}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    Paid ranking never changes organic “best match”, “best value” or safety conclusions. An organic alternative path remains available.
                  </div>

                  {campaign.review?.reason ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-stone-200 p-3 text-xs font-semibold text-stone-600">
                      <CircleAlert
                        size={16}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      Policy review: {campaign.review.reason}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {campaign.status ===
                    'approved' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          transition(
                            campaign.id,
                            'activate',
                          )
                        }
                        className={buttonClass}
                      >
                        <Play
                          size={15}
                          aria-hidden="true"
                        />
                        Activate
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
                        className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-black"
                      >
                        <Pause
                          size={15}
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
                        className={buttonClass}
                      >
                        <Play
                          size={15}
                          aria-hidden="true"
                        />
                        Resume
                      </button>
                    ) : null}
                  </div>
                </article>
              ),
            )
          ) : (
            <p className="rounded-2xl bg-stone-50 p-5 text-sm font-semibold text-stone-500 lg:col-span-2">
              No M21 Retail Media campaigns yet.
            </p>
          )}
        </div>
      </section>

      <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-950">
        Product and Recipe sponsored units are fail-closed in this first serving lane until independent server-side safety eligibility exists. Declared dietary or allergy constraints may suppress an ad, but must never become targeting segments.
      </p>
    </div>
  )
}