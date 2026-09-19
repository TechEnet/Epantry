import {
  BadgeCheck,
  CircleAlert,
  FileWarning,
  Megaphone,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  useAdmin,
} from '../../admin/context/AdminContext'

import {
  getCommunityExpansionErrorMessage,
  listAdminCommunityReports,
  listAdminCreatorContent,
  resolveAdminCommunityReport,
  reviewAdminCreatorContent,
} from '../services/communityExpansion.service'

import {
  listAdminAdDecisionLogs,
  listAdminRetailMediaCampaigns,
  reviewAdminRetailMediaCampaign,
} from '../../retailMedia/services/retailMedia.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

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

export default function AdminExpansionTrustPanel() {
  const {
    hasAdminPermission,
  } =
    useAdmin()

  const canMutate =
    hasAdminPermission(
      'trust_safety.mutate',
    )

  const [reports, setReports] =
    useState([])

  const [creatorContent, setCreatorContent] =
    useState([])

  const [campaigns, setCampaigns] =
    useState([])

  const [decisionLogs, setDecisionLogs] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const [reasonById, setReasonById] =
    useState({})

  const [evidenceById, setEvidenceById] =
    useState({})

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const [
            reportResult,
            creatorContentResult,
            campaignResult,
            logResult,
          ] =
            await Promise.all([
              listAdminCommunityReports({
                limit: 50,
              }),
              listAdminCreatorContent({
                limit: 50,
              }),
              listAdminRetailMediaCampaigns({
                limit: 50,
              }),
              listAdminAdDecisionLogs({
                limit: 50,
              }),
            ])

          setReports(
            reportResult?.reports ||
              [],
          )

          setCreatorContent(
            creatorContentResult?.creatorContent ||
              [],
          )

          setCampaigns(
            campaignResult?.campaigns ||
              [],
          )

          setDecisionLogs(
            logResult?.adDecisionLogs ||
              [],
          )
        } catch (requestError) {
          setError(
            getCommunityExpansionErrorMessage(
              requestError,
              'Unable to load M21 expansion governance.',
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

  function evidenceRefs(id) {
    return String(
      evidenceById[id] || '',
    )
      .split('\n')
      .map(
        (value) =>
          value.trim(),
      )
      .filter(Boolean)
  }

  async function run(
    task,
    message,
  ) {
    setBusy(true)
    setNotice('')
    setError('')

    try {
      await task()
      setNotice(message)
      await load()
    } catch (requestError) {
      setError(
        getCommunityExpansionErrorMessage(
          requestError,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            M21 Expansion Governance
          </p>

          <h2 className="mt-2 text-xl font-black text-stone-950">
            Community trust, creator provenance & Retail Media policy
          </h2>

          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-stone-600">
            M03 remains the permission and immutable audit authority. M15 remains Community/Creator truth, M16 remains Host Campaign Brief truth, M19 keeps organic and sponsored analytics separated, and M20 launch controls remain release authority.
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
            Loading expansion trust evidence…
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-start gap-2">
            <FileWarning
              size={18}
              className="mt-0.5 text-amber-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-black text-stone-950">
                Community reports
              </h3>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                Spam, unsafe advice, copyright, fake review, undisclosed sponsorship and dangerous allergen claims are governed without direct DB deletion.
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[540px] space-y-3 overflow-y-auto pr-1">
            {reports.length ? (
              reports.map(
                (report) => (
                  <article
                    key={report.id}
                    className="rounded-xl border border-stone-200 p-3"
                  >
                    <p className="text-xs font-black text-stone-900">
                      {titleize(
                        report.reason,
                      )}
                    </p>

                    <p className="mt-1 text-[11px] font-semibold text-stone-500">
                      {titleize(
                        report.subjectType,
                      )} · {titleize(
                        report.status,
                      )}
                    </p>

                    {canMutate &&
                    ['open', 'in_review'].includes(
                      report.status,
                    ) ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          rows={2}
                          className={inputClass}
                          value={reasonById[report.id] || ''}
                          onChange={(event) =>
                            setReasonById(
                              (current) => ({
                                ...current,
                                [report.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Resolution reason"
                        />

                        <textarea
                          rows={2}
                          className={inputClass}
                          value={evidenceById[report.id] || ''}
                          onChange={(event) =>
                            setEvidenceById(
                              (current) => ({
                                ...current,
                                [report.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Evidence refs, one per line"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  resolveAdminCommunityReport({
                                    reportId:
                                      report.id,
                                    action:
                                      'quarantine_content',
                                    reason:
                                      reasonById[report.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(report.id),
                                  }),
                                'Community content quarantined through governed Trust & Safety workflow.',
                              )
                            }
                            className="focus-ring rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-black text-white"
                          >
                            Quarantine
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  resolveAdminCommunityReport({
                                    reportId:
                                      report.id,
                                    action:
                                      'dismiss',
                                    reason:
                                      reasonById[report.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(report.id),
                                  }),
                                'Community report dismissed with evidence.',
                              )
                            }
                            className="focus-ring rounded-lg border border-stone-200 px-3 py-2 text-[11px] font-black"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500">
                No Community trust reports.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-start gap-2">
            <BadgeCheck
              size={18}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-black text-stone-950">
                Creator content provenance
              </h3>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                Rights, lineage, sponsored disclosure and takedown state are explicit. Food Intelligence is always recalculated, never copied from a creator/fork.
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[540px] space-y-3 overflow-y-auto pr-1">
            {creatorContent.length ? (
              creatorContent.map(
                (item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-stone-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-stone-900">
                          {titleize(
                            item.contentType,
                          )}
                        </p>

                        <p className="mt-1 text-[11px] font-semibold text-stone-500">
                          {titleize(
                            item.governanceState,
                          )}
                        </p>
                      </div>

                      {item.rights?.sponsored ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-900">
                          {item.rights?.sponsorLabel ||
                            'Sponsored'}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-[11px] font-semibold leading-5 text-stone-500">
                      Owner/licensor: {item.rights?.ownerOrLicensor || '—'} · Takedown: {item.rights?.takedownState || 'clear'}
                    </p>

                    {item.rights?.sponsored ? (
                      <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] font-semibold text-amber-900">
                        Disclosure: {item.rights?.disclosureText || 'Missing'}
                      </p>
                    ) : null}

                    {canMutate &&
                    item.governanceState ===
                      'pending_review' ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          rows={2}
                          className={inputClass}
                          value={reasonById[item.id] || ''}
                          onChange={(event) =>
                            setReasonById(
                              (current) => ({
                                ...current,
                                [item.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Governance reason"
                        />

                        <textarea
                          rows={2}
                          className={inputClass}
                          value={evidenceById[item.id] || ''}
                          onChange={(event) =>
                            setEvidenceById(
                              (current) => ({
                                ...current,
                                [item.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Evidence refs, one per line"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminCreatorContent({
                                    creatorContentId:
                                      item.id,
                                    decision:
                                      'approved',
                                    reason:
                                      reasonById[item.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(item.id),
                                  }),
                                'Creator content provenance approved.',
                              )
                            }
                            className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-black text-white"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminCreatorContent({
                                    creatorContentId:
                                      item.id,
                                    decision:
                                      'restricted',
                                    reason:
                                      reasonById[item.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(item.id),
                                  }),
                                'Creator content restricted through governed rights workflow.',
                              )
                            }
                            className="focus-ring rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-900"
                          >
                            Restrict
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500">
                No Creator content governance records.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-start gap-2">
            <Megaphone
              size={18}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-black text-stone-950">
                Retail Media policy
              </h3>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                Sponsored ranking is a separate lane. Hard safety and organic relevance are not purchasable, and sensitive health/allergy data is not a targeting segment.
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[390px] space-y-3 overflow-y-auto pr-1">
            {campaigns.length ? (
              campaigns.map(
                (campaign) => (
                  <article
                    key={campaign.id}
                    className="rounded-xl border border-stone-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-stone-900">
                          {campaign.title}
                        </p>

                        <p className="mt-1 text-[11px] font-semibold text-stone-500">
                          {titleize(
                            campaign.status,
                          )} · {campaign.promotedEntityType}
                        </p>
                      </div>

                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-900">
                        {campaign.creative?.sponsorLabel || 'Sponsored'}
                      </span>
                    </div>

                    {canMutate &&
                    campaign.status ===
                      'pending_review' ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          rows={2}
                          className={inputClass}
                          value={reasonById[campaign.id] || ''}
                          onChange={(event) =>
                            setReasonById(
                              (current) => ({
                                ...current,
                                [campaign.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Ad policy reason"
                        />

                        <textarea
                          rows={2}
                          className={inputClass}
                          value={evidenceById[campaign.id] || ''}
                          onChange={(event) =>
                            setEvidenceById(
                              (current) => ({
                                ...current,
                                [campaign.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Evidence refs, one per line"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminRetailMediaCampaign({
                                    campaignId:
                                      campaign.id,
                                    decision:
                                      'approve',
                                    reason:
                                      reasonById[campaign.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(campaign.id),
                                  }),
                                'Retail Media campaign approved for Host activation.',
                              )
                            }
                            className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-black text-white"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminRetailMediaCampaign({
                                    campaignId:
                                      campaign.id,
                                    decision:
                                      'reject',
                                    reason:
                                      reasonById[campaign.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(campaign.id),
                                  }),
                                'Retail Media campaign rejected.',
                              )
                            }
                            className="focus-ring rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-black text-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500">
                No Retail Media campaigns.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert
                size={16}
                className="mt-0.5 text-stone-500"
                aria-hidden="true"
              />

              <p className="text-[11px] font-semibold leading-5 text-stone-600">
                AdDecisionLog is append-only evidence. A served impression is not transaction revenue and does not create billing or settlement truth.
              </p>
            </div>

            <p className="mt-2 text-xs font-black text-stone-900">
              Recent decision evidence: {decisionLogs.length}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <CircleAlert
          size={18}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />

        <p className="text-xs font-semibold leading-5">
          Creator/Community content cannot bypass M07/M08 food governance. Retail Media cannot bypass dietary, allergen, serviceability or organic ranking rules. No Creator, Advertiser, Brand, Seller or B2B top-level application role is introduced.
        </p>
      </div>
    </section>
  )
}