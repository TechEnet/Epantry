import {
  AlertTriangle,
  Bot,
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  FileWarning,
  Flag,
  LoaderCircle,
  Megaphone,
  RefreshCw,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
  WalletCards,
  Webhook,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import AdminShell from '../../admin/components/AdminShell';

import {
  useAdmin,
} from '../../admin/context/AdminContext';

import AdminAiQualityPanel from '../../search/components/AdminAiQualityPanel';

import {
  createAdminFeatureFlag,
  decideAdminReviewCase,
  executeAdminGovernanceAction,
  getAdminCommandCenter,
  getAdminGovernanceErrorMessage,
  getAdminPolicyOverview,
  listAdminIncidents,
  listAdminReviewCases,
  listAdminSupportCases,
  updateAdminFeatureFlag,
  updateAdminIncident,
  updateAdminSupportCase,
} from '../services/adminGovernance.service';

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400';

const primaryButtonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50';

function titleize(value) {
  return String(
      value ||
      'unknown',
  )
      .split('_')
      .filter(Boolean)
      .map(
          (part) =>
              `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
      )
      .join(' ');
}

function MetricCard({
  label,
  value,
  icon: Icon,
}) {
  return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                  {label}
              </p>

              <Icon
                  size={16}
                  className="text-emerald-700"
                  aria-hidden="true"
              />
          </div>

          <p className="mt-3 text-2xl font-black text-stone-950">
              {value ?? 0}
          </p>
      </div>
  );
}

function Notice({
  children,
  tone = 'stone',
}) {
  const styles = {
      stone:
          'border-stone-200 bg-white text-stone-600',
      amber:
          'border-amber-200 bg-amber-50 text-amber-900',
      emerald:
          'border-emerald-200 bg-emerald-50 text-emerald-800',
      red:
          'border-red-200 bg-red-50 text-red-700',
  };

  return (
      <div
          className={`rounded-2xl border p-4 text-sm font-semibold leading-6 ${styles[tone]}`}
      >
          {children}
      </div>
  );
}

function QueueList({
  title,
  items,
  emptyLabel,
  onSelect,
}) {
  return (
      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-stone-950">
              {title}
          </h2>

          <div className="mt-4 space-y-2">
              {items.length ? (
                  items.map(
                      (item) => (
                          <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                  onSelect?.(
                                      item,
                                  )
                              }
                              className="focus-ring block w-full rounded-2xl border border-stone-200 p-4 text-left hover:border-emerald-200 hover:bg-emerald-50/30"
                          >
                              <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                      <p className="truncate text-sm font-black text-stone-900">
                                          {item.summary ||
                                              item.title ||
                                              item.supportKey ||
                                              item.caseKey ||
                                              item.incidentKey}
                                      </p>

                                      <p className="mt-1 truncate text-xs font-semibold text-stone-500">
                                          {item.caseKey ||
                                              item.incidentKey ||
                                              item.supportKey ||
                                              item.domain}
                                          {' · '}
                                          {titleize(
                                              item.status,
                                          )}
                                      </p>
                                  </div>

                                  <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[9px] font-black uppercase text-stone-500">
                                      {item.priority ||
                                          item.severity ||
                                          item.domain}
                                  </span>
                              </div>
                          </button>
                      ),
                  )
              ) : (
                  <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-400">
                      {emptyLabel}
                  </p>
              )}
          </div>
      </section>
  );
}

const SECTION_CONFIG =
  Object.freeze({
      users: {
          code:
              'A02',
          title:
              'Users & Organizations',
          description:
              'Permission-filtered identity and organization operations. M17 does not create a second identity or organization source of truth.',
          domain:
              null,
          icon:
              UsersRound,
      },

      dataQuality: {
          code:
              'A08',
          title:
              'Data Quality / Duplicate Review',
          description:
              'Unified catalog review queue over M04/M14 truth. Emergency quarantine delegates to the owning catalog lifecycle service.',
          domain:
              'catalog',
          icon:
              SearchCheck,
      },

      recipeReview: {
          code:
              'A10',
          title:
              'Recipe Review / Version Governance',
          description:
              'Cross-recipe review queue while M07 publication and M08 food-safety governance remain authoritative.',
          domain:
              'recipe',
          icon:
              CheckCircle2,
      },

      orders: {
          code:
              'A12',
          title:
              'Marketplace Orders / Disputes',
          description:
              'Exception and dispute coordination over frozen M11 SellerOrder/ledger truth. This workspace does not rewrite transaction history.',
          domain:
              'marketplace',
          icon:
              ShoppingBag,
      },

      finance: {
          code:
              'A13',
          title:
              'Finance / Settlement Ops',
          description:
              'Governance view over M16 settlement reconciliation. Maker-checker and external payout reconciliation remain owned by M16.',
          domain:
              'finance',
          icon:
              WalletCards,
      },

      integrations: {
          code:
              'A14',
          title:
              'Retailer / Integration Ops',
          description:
              'Operational health and incident coordination around existing organization API/webhook seams. M17 does not invent retailer adapters or delivery workers.',
          domain:
              'marketplace',
          icon:
              Webhook,
      },

      policy: {
          code:
              'A15',
          title:
              'Rules / Feature Flags',
          description:
              'M08 RuleProfile remains food-policy truth; M17 feature flags are a separate platform rollout control and never an authorization source.',
          domain:
              'admin',
          icon:
              Flag,
      },

      cms: {
          code:
              'A16',
          title:
              'CMS / Home Collections',
          description:
              'Governed CMS review surface. Until a canonical CMS publishing engine exists, M17 tracks review/support state instead of acting as a direct content database editor.',
          domain:
              'cms',
          icon:
              Boxes,
      },

      trustSafety: {
          code:
              'A17',
          title:
              'Trust & Safety / Claims',
          description:
              'Cross-domain high-risk review, incident and support coordination with evidence and immutable audit context.',
          domain:
              'trust_safety',
          icon:
              ShieldAlert,
      },

      privacy: {
          code:
              'A18',
          title:
              'Privacy Rights / Consent Ops',
          description:
              'Operational case shell for privacy-rights requests. M17 does not pretend to implement export/delete propagation or retention engines that do not yet exist.',
          domain:
              'trust_safety',
          icon:
              ShieldCheck,
      },

      adReview: {
          code:
              'A20',
          title:
              'Ad Review / Policy',
          description:
              'Disclosure and policy review seam for M16 campaign briefs. No auction, paid ranking, serving, billing or ROAS engine is introduced here.',
          domain:
              'marketplace',
          icon:
              Megaphone,
      },

      aiQuality: {
          code:
              'A21',
          title:
              'AI Extraction / Model Quality',
          description:
              'Operational quality metadata and governed escalation. AI can summarize/prioritize but cannot approve critical truth or publication.',
          domain:
              null,
          icon:
              Bot,
      },
  });

function buildMetricEntries(commandCenter) {
  const metrics =
      commandCenter?.metrics ||
      {};

  return [
      [
          'Open review cases',
          metrics.reviewQueue?.open,
          FileWarning,
      ],
      [
          'Critical reviews',
          metrics.reviewQueue?.critical,
          ShieldAlert,
      ],
      [
          'Host activation queue',
          metrics.marketplace?.hostActivationAwaitingReview,
          Building2,
      ],
      [
          'Order exceptions',
          metrics.marketplace?.orderExceptions,
          ShoppingBag,
      ],
      [
          'Failed webhooks',
          metrics.marketplace?.failedWebhooks,
          Webhook,
      ],
      [
          'Pending settlements',
          metrics.finance?.pendingSettlements,
          WalletCards,
      ],
      [
          'Active incidents',
          metrics.trustSafety?.activeIncidents,
          AlertTriangle,
      ],
      [
          'Enabled feature flags',
          metrics.policy?.enabledFeatureFlags,
          Flag,
      ],
  ].filter(
      ([, value]) =>
          value !== undefined &&
          value !== null,
  );
}

export default function AdminGovernancePage({
  section,
}) {
  const config =
      SECTION_CONFIG[section] ||
      SECTION_CONFIG.trustSafety;

  const {
      isRootSuperAdmin,
      hasAdminPermission,
  } =
      useAdmin();

  const [loading, setLoading] =
      useState(true);

  const [busy, setBusy] =
      useState(false);

  const [error, setError] =
      useState('');

  const [notice, setNotice] =
      useState('');

  const [commandCenter, setCommandCenter] =
      useState(null);

  const [reviewCases, setReviewCases] =
      useState([]);

  const [incidents, setIncidents] =
      useState([]);

  const [supportCases, setSupportCases] =
      useState([]);

  const [policy, setPolicy] =
      useState(null);

  const [
      selectedReviewCase,
      setSelectedReviewCase,
  ] =
      useState(null);

  const [
      selectedIncident,
      setSelectedIncident,
  ] =
      useState(null);

  const [
      selectedSupportCase,
      setSelectedSupportCase,
  ] =
      useState(null);

  const [reason, setReason] =
      useState('');

  const [
      evidenceLabel,
      setEvidenceLabel,
  ] =
      useState('');

  const [
      evidenceReferenceId,
      setEvidenceReferenceId,
  ] =
      useState('');

  const [
      featureFlagForm,
      setFeatureFlagForm,
  ] =
      useState({
          key:
              '',
          description:
              '',
          environments:
              'development',
          rolloutPercentage:
              0,
          riskLevel:
              'low',
          reason:
              '',
          evidenceLabel:
              '',
      });

  const load =
      useCallback(
          async () => {
              setLoading(true);
              setError('');

              try {
                  const tasks = [
                      getAdminCommandCenter(),
                  ];

                  if (
                      config.domain
                  ) {
                      tasks.push(
                          listAdminReviewCases({
                              page:
                                  1,
                              limit:
                                  50,
                              domain:
                                  config.domain,
                          }),
                          listAdminIncidents({
                              page:
                                  1,
                              limit:
                                  30,
                              domain:
                                  config.domain,
                          }),
                          listAdminSupportCases({
                              page:
                                  1,
                              limit:
                                  30,
                              domain:
                                  config.domain,
                          }),
                      );
                  }

                  if (
                      section ===
                      'policy'
                  ) {
                      tasks.push(
                          getAdminPolicyOverview(),
                      );
                  }

                  const results =
                      await Promise.allSettled(
                          tasks,
                      );

                  if (
                      results[0].status ===
                      'fulfilled'
                  ) {
                      setCommandCenter(
                          results[0].value,
                      );
                  }

                  if (
                      config.domain
                  ) {
                      const reviewResult =
                          results[1];

                      const incidentResult =
                          results[2];

                      const supportResult =
                          results[3];

                      setReviewCases(
                          reviewResult?.status ===
                          'fulfilled'
                              ? reviewResult.value?.reviewCases ||
                              []
                              : [],
                      );

                      setIncidents(
                          incidentResult?.status ===
                          'fulfilled'
                              ? incidentResult.value?.incidents ||
                              []
                              : [],
                      );

                      setSupportCases(
                          supportResult?.status ===
                          'fulfilled'
                              ? supportResult.value?.supportCases ||
                              []
                              : [],
                      );
                  } else {
                      setReviewCases([]);
                      setIncidents([]);
                      setSupportCases([]);
                  }

                  if (
                      section ===
                      'policy'
                  ) {
                      const index =
                          config.domain
                              ? 4
                              : 1;

                      setPolicy(
                          results[index]?.status ===
                          'fulfilled'
                              ? results[index].value
                              : null,
                      );
                  } else {
                      setPolicy(null);
                  }
              } catch (requestError) {
                  setError(
                      getAdminGovernanceErrorMessage(
                          requestError,
                          'Unable to load this governance surface.',
                      ),
                  );
              } finally {
                  setLoading(false);
              }
          },
          [
              config.domain,
              section,
          ],
      );

  useEffect(
      () => {
          load();
      },
      [load],
  );

  const metricEntries =
      useMemo(
          () =>
              buildMetricEntries(
                  commandCenter,
              ),
          [commandCenter],
      );

  const canMutateDomain =
      useMemo(
          () => {
              const map = {
                  catalog:
                      hasAdminPermission(
                          'catalog.mutate',
                      ) ||
                      hasAdminPermission(
                          'catalog.publish',
                      ),

                  recipe:
                      hasAdminPermission(
                          'recipe.mutate',
                      ) ||
                      hasAdminPermission(
                          'recipe.publish',
                      ),

                  marketplace:
                      hasAdminPermission(
                          'marketplace.mutate',
                      ),

                  finance:
                      hasAdminPermission(
                          'finance.mutate',
                      ),

                  trust_safety:
                      hasAdminPermission(
                          'trust_safety.mutate',
                      ),

                  cms:
                      hasAdminPermission(
                          'cms.mutate',
                      ) ||
                      hasAdminPermission(
                          'cms.publish',
                      ),

                  admin:
                      isRootSuperAdmin,
              };

              return config.domain
                  ? map[config.domain] ===
                  true
                  : false;
          },
          [
              config.domain,
              hasAdminPermission,
              isRootSuperAdmin,
          ],
      );

  async function run(
      action,
      successMessage,
  ) {
      setBusy(true);
      setError('');
      setNotice('');

      try {
          const result =
              await action();

          setNotice(
              successMessage,
          );

          await load();

          return result;
      } catch (requestError) {
          setError(
              getAdminGovernanceErrorMessage(
                  requestError,
              ),
          );

          return null;
      } finally {
          setBusy(false);
      }
  }

  function evidence() {
      if (
          !evidenceLabel.trim()
      ) {
          return [];
      }

      return [
          {
              type:
                  'external_reference',
              label:
                  evidenceLabel.trim(),
              referenceId:
                  evidenceReferenceId.trim(),
              uri:
                  '',
              checksumSha256:
                  '',
              note:
                  '',
          },
      ];
  }

  const Icon =
      config.icon;

  return (
      <AdminShell
          title={`${config.code} · ${config.title}`}
          description={config.description}
          actions={
              <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
              >
                  <RefreshCw
                      size={14}
                      className={
                          loading
                              ? 'animate-spin'
                              : ''
                      }
                      aria-hidden="true"
                  />

                  Refresh
              </button>
          }
      >
          <div className="flex items-center gap-2 text-emerald-700">
              <Icon
                  size={18}
                  aria-hidden="true"
              />

              <p className="text-xs font-black uppercase tracking-[0.13em]">
                  M17 governed operations
              </p>
          </div>

          {error ? (
              <div className="mt-4">
                  <Notice tone="red">
                      {error}
                  </Notice>
              </div>
          ) : null}

          {notice ? (
              <div className="mt-4">
                  <Notice tone="emerald">
                      {notice}
                  </Notice>
              </div>
          ) : null}

          {loading ? (
              <div className="mt-5 grid min-h-72 place-items-center rounded-[24px] border border-stone-200 bg-white">
                  <LoaderCircle className="animate-spin text-emerald-700" />
              </div>
          ) : (
              <>
                  {metricEntries.length ? (
                      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {metricEntries.map(
                              ([
                                  label,
                                  value,
                                  MetricIcon,
                              ]) => (
                                  <MetricCard
                                      key={label}
                                      label={label}
                                      value={value}
                                      icon={MetricIcon}
                                  />
                              ),
                          )}
                      </section>
                  ) : null}

                  {section === 'users' ? (
                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                              <UsersRound className="text-emerald-700" />

                              <h2 className="mt-4 text-lg font-black">
                                  Identity lookup
                              </h2>

                              <p className="mt-2 text-sm leading-6 text-stone-500">
                                  Use the global search in the Admin shell to locate Users and Marketplace Organizations. Results are permission-filtered and user emails are masked by the backend.
                              </p>
                          </section>

                          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                              <Building2 className="text-emerald-700" />

                              <h2 className="mt-4 text-lg font-black">
                                  Existing governed lifecycle
                              </h2>

                              <div className="mt-4 flex flex-wrap gap-2">
                                  <Link
                                      to="/admin/hosts"
                                      className={primaryButtonClass}
                                  >
                                      Host access review
                                  </Link>

                                  {isRootSuperAdmin ? (
                                      <Link
                                          to="/admin/roles"
                                          className="focus-ring rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-black"
                                      >
                                          Roles & assignments
                                      </Link>
                                  ) : null}
                              </div>
                          </section>

                          <div className="lg:col-span-2">
                              <Notice tone="amber">
                                  M17 does not create a generic “edit User” or “edit Organization” database form. Account, Host access, organization, KYB and commercial mutations stay with their owning services and audit boundaries.
                              </Notice>
                          </div>
                      </div>
                  ) : null}

                  {section === 'aiQuality' ? (
                      <div className="mt-5">
                          <Notice tone="amber">
                              AI may summarize review state and suggest prioritization only. It cannot publish canonical Product/Recipe truth, clear allergen uncertainty, activate Hosts or approve settlements.
                          </Notice>

                          {hasAdminPermission(
                              'admin.audit.read',
                          ) ? (
                              <AdminAiQualityPanel />
                          ) : (
                              <Notice>
                                  Search/AI runtime quality metadata requires admin.audit.read. Catalog/Trust operators can continue to the governed M14 NPI review surface.
                              </Notice>
                          )}

                          <div className="mt-4">
                              <Link
                                  to="/admin/product-intelligence"
                                  className={primaryButtonClass}
                              >
                                  Open Product Intelligence review
                              </Link>
                          </div>
                      </div>
                  ) : null}

                  {section === 'policy' ? (
                      <div className="mt-5 space-y-5">
                          <Notice tone="amber">
                              Feature flags affect rollout behavior only. They never grant roles, permissions, Host access or Super Admin authority. Food/safety rules remain M08 RuleProfile truth.
                          </Notice>

                          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                              <h2 className="text-lg font-black">
                                  M08 Rule Profiles
                              </h2>

                              <div className="mt-4 space-y-2">
                                  {(policy?.ruleProfiles || [])
                                      .slice(
                                          0,
                                          30,
                                      )
                                      .map(
                                          (rule) => (
                                              <div
                                                  key={rule.id}
                                                  className="rounded-2xl bg-stone-50 p-4"
                                              >
                                                  <div className="flex justify-between gap-3">
                                                      <p className="text-sm font-black">
                                                          {rule.ruleKey}
                                                      </p>

                                                      <span className="text-xs font-black text-emerald-700">
                                                          {titleize(
                                                              rule.status,
                                                          )}
                                                      </span>
                                                  </div>

                                                  <p className="mt-1 text-xs text-stone-500">
                                                      {rule.jurisdictionCode} · v{rule.version} · {titleize(rule.ruleType)}
                                                  </p>
                                              </div>
                                          ),
                                      )}
                              </div>
                          </section>

                          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                              <div className="flex items-center gap-2">
                                  <Flag
                                      size={18}
                                      className="text-emerald-700"
                                  />

                                  <h2 className="text-lg font-black">
                                      Platform Feature Flags
                                  </h2>
                              </div>

                              <div className="mt-4 space-y-2">
                                  {(policy?.featureFlags || [])
                                      .map(
                                          (flag) => (
                                              <div
                                                  key={flag.id}
                                                  className="rounded-2xl border border-stone-200 p-4"
                                              >
                                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                      <div>
                                                          <p className="text-sm font-black">
                                                              {flag.key}
                                                          </p>

                                                          <p className="mt-1 text-xs leading-5 text-stone-500">
                                                              {flag.description}
                                                          </p>

                                                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                                                              {flag.environments.join(', ')} · {flag.rolloutPercentage}% · v{flag.version}
                                                          </p>
                                                      </div>

                                                      <span
                                                          className={`rounded-full px-3 py-1 text-[10px] font-black ${
                                                              flag.enabled
                                                                  ? 'bg-emerald-100 text-emerald-800'
                                                                  : 'bg-stone-100 text-stone-500'
                                                          }`}
                                                      >
                                                          {flag.enabled
                                                              ? 'Enabled'
                                                              : 'Disabled'}
                                                      </span>
                                                  </div>

                                                  {isRootSuperAdmin ? (
                                                      <button
                                                          type="button"
                                                          disabled={
                                                              busy ||
                                                              featureFlagForm.reason.trim().length < 10 ||
                                                              !featureFlagForm.evidenceLabel.trim()
                                                          }
                                                          onClick={() =>
                                                              run(
                                                                  () =>
                                                                      updateAdminFeatureFlag(
                                                                          flag.id,
                                                                          {
                                                                              enabled:
                                                                                  !flag.enabled,
                                                                              reason:
                                                                                  featureFlagForm.reason.trim(),
                                                                              evidence: [
                                                                                  {
                                                                                      type:
                                                                                          'external_reference',
                                                                                      label:
                                                                                          featureFlagForm.evidenceLabel.trim(),
                                                                                      referenceId:
                                                                                          '',
                                                                                      uri:
                                                                                          '',
                                                                                      checksumSha256:
                                                                                          '',
                                                                                      note:
                                                                                          '',
                                                                                  },
                                                                              ],
                                                                          },
                                                                      ),
                                                                  `Feature flag ${flag.key} updated.`,
                                                              )
                                                          }
                                                          className="focus-ring mt-3 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                                                      >
                                                          {flag.enabled
                                                              ? 'Disable'
                                                              : 'Enable'}
                                                      </button>
                                                  ) : null}
                                              </div>
                                          ),
                                      )}
                              </div>

                              {isRootSuperAdmin ? (
                                  <div className="mt-5 border-t border-stone-200 pt-5">
                                      <h3 className="text-sm font-black">
                                          Super Admin change context
                                      </h3>

                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                          <input
                                              className={inputClass}
                                              value={featureFlagForm.reason}
                                              onChange={(event) =>
                                                  setFeatureFlagForm(
                                                      (current) => ({
                                                          ...current,
                                                          reason:
                                                              event.target.value,
                                                      }),
                                                  )
                                              }
                                              placeholder="Reason for flag change (10+ chars)"
                                          />

                                          <input
                                              className={inputClass}
                                              value={featureFlagForm.evidenceLabel}
                                              onChange={(event) =>
                                                  setFeatureFlagForm(
                                                      (current) => ({
                                                          ...current,
                                                          evidenceLabel:
                                                              event.target.value,
                                                      }),
                                                  )
                                              }
                                              placeholder="Evidence / ticket label"
                                          />
                                      </div>

                                      <div className="mt-5 rounded-2xl bg-stone-50 p-4">
                                          <p className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
                                              Create flag
                                          </p>

                                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                              <input
                                                  className={inputClass}
                                                  value={featureFlagForm.key}
                                                  onChange={(event) =>
                                                      setFeatureFlagForm(
                                                          (current) => ({
                                                              ...current,
                                                              key:
                                                                  event.target.value.toLowerCase(),
                                                          }),
                                                      )
                                                  }
                                                  placeholder="feature.key"
                                              />

                                              <input
                                                  className={inputClass}
                                                  value={featureFlagForm.description}
                                                  onChange={(event) =>
                                                      setFeatureFlagForm(
                                                          (current) => ({
                                                              ...current,
                                                              description:
                                                                  event.target.value,
                                                          }),
                                                      )
                                                  }
                                                  placeholder="Description"
                                              />

                                              <select
                                                  className={inputClass}
                                                  value={featureFlagForm.environments}
                                                  onChange={(event) =>
                                                      setFeatureFlagForm(
                                                          (current) => ({
                                                              ...current,
                                                              environments:
                                                                  event.target.value,
                                                          }),
                                                      )
                                                  }
                                              >
                                                  <option value="development">
                                                      Development
                                                  </option>

                                                  <option value="staging">
                                                      Staging
                                                  </option>

                                                  <option value="production">
                                                      Production
                                                  </option>
                                              </select>

                                              <select
                                                  className={inputClass}
                                                  value={featureFlagForm.riskLevel}
                                                  onChange={(event) =>
                                                      setFeatureFlagForm(
                                                          (current) => ({
                                                              ...current,
                                                              riskLevel:
                                                                  event.target.value,
                                                          }),
                                                      )
                                                  }
                                              >
                                                  <option value="low">
                                                      Low risk
                                                  </option>

                                                  <option value="medium">
                                                      Medium risk
                                                  </option>

                                                  <option value="high">
                                                      High risk
                                                  </option>

                                                  <option value="critical">
                                                      Critical
                                                  </option>
                                              </select>
                                          </div>

                                          <button
                                              type="button"
                                              disabled={
                                                  busy ||
                                                  featureFlagForm.key.trim().length < 3 ||
                                                  featureFlagForm.description.trim().length < 5 ||
                                                  featureFlagForm.reason.trim().length < 10 ||
                                                  !featureFlagForm.evidenceLabel.trim()
                                              }
                                              onClick={() =>
                                                  run(
                                                      () =>
                                                          createAdminFeatureFlag({
                                                              key:
                                                                  featureFlagForm.key.trim(),
                                                              description:
                                                                  featureFlagForm.description.trim(),
                                                              enabled:
                                                                  false,
                                                              environments: [
                                                                  featureFlagForm.environments,
                                                              ],
                                                              rolloutPercentage:
                                                                  Number(featureFlagForm.rolloutPercentage) ||
                                                                  0,
                                                              ownerDomain:
                                                                  'admin',
                                                              riskLevel:
                                                                  featureFlagForm.riskLevel,
                                                              expiresAt:
                                                                  null,
                                                              reason:
                                                                  featureFlagForm.reason.trim(),
                                                              evidence: [
                                                                  {
                                                                      type:
                                                                          'external_reference',
                                                                      label:
                                                                          featureFlagForm.evidenceLabel.trim(),
                                                                      referenceId:
                                                                          '',
                                                                      uri:
                                                                          '',
                                                                      checksumSha256:
                                                                          '',
                                                                      note:
                                                                          '',
                                                                  },
                                                              ],
                                                          }),
                                                      'Feature flag created disabled by default.',
                                                  )
                                              }
                                              className={`${primaryButtonClass} mt-3`}
                                          >
                                              <Flag size={15} />

                                              Create disabled flag
                                          </button>
                                      </div>
                                  </div>
                              ) : null}
                          </section>
                      </div>
                  ) : null}

                  {section === 'integrations' ? (
                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                          <Notice tone="amber">
                              M17 A14 is an operational governance surface. Webhook registration and secret management remain organization-scoped M16 Host operations. Outbound delivery workers, retailer adapters and circuit breakers are not fabricated here.
                          </Notice>

                          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                              <Webhook className="text-emerald-700" />

                              <h2 className="mt-4 text-lg font-black">
                                  Integration health
                              </h2>

                              <p className="mt-2 text-sm text-stone-500">
                                  Failed active webhooks:{' '}
                                  <strong>
                                      {commandCenter?.metrics?.marketplace?.failedWebhooks ??
                                          0}
                                  </strong>
                              </p>

                              <p className="mt-2 text-xs leading-5 text-stone-500">
                                  Failures should create or attach to an Incident/ReviewCase before any recovery change is attempted.
                              </p>
                          </section>
                      </div>
                  ) : null}

                  {section === 'finance' ? (
                      <div className="mt-5">
                          <Notice tone="amber">
                              Settlement creation, checker approval and paid reconciliation remain on the frozen M16 finance surface. M17 adds cross-domain governance context only.
                          </Notice>

                          <Link
                              to="/admin/host-operations"
                              className={`${primaryButtonClass} mt-4`}
                          >
                              Open M16 settlement operations
                          </Link>
                      </div>
                  ) : null}

                  {section === 'orders' ? (
                      <div className="mt-5">
                          <Notice tone="amber">
                              Order/refund/fulfillment truth remains M11. ReviewCase can coordinate a dispute but cannot rewrite CommerceLedgerEntry history.
                          </Notice>

                          <Link
                              to="/admin/marketplace"
                              className={`${primaryButtonClass} mt-4`}
                          >
                              Open marketplace operations
                          </Link>
                      </div>
                  ) : null}

                  {section === 'dataQuality' ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                          <Link
                              to="/admin/catalog"
                              className={primaryButtonClass}
                          >
                              Open governed catalog
                          </Link>

                          <Link
                              to="/admin/product-intelligence"
                              className="focus-ring rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black"
                          >
                              Open M14 NPI review
                          </Link>
                      </div>
                  ) : null}

                  {section === 'recipeReview' ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                          <Link
                              to="/admin/recipes"
                              className={primaryButtonClass}
                          >
                              Open M07 Recipe Management
                          </Link>

                          <Link
                              to="/admin/food-intelligence"
                              className="focus-ring rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black"
                          >
                              Open M08 Food Intelligence
                          </Link>
                      </div>
                  ) : null}

                  {[
                      'cms',
                      'privacy',
                      'adReview',
                  ].includes(
                      section,
                  ) ? (
                      <div className="mt-5">
                          <Notice tone="amber">
                              This is intentionally a governed operational seam, not a claim that the future canonical engine already exists. Use ReviewCases/Incidents/SupportCases for evidence, assignment and decisions until the owning domain workflow is implemented.
                          </Notice>
                      </div>
                  ) : null}

                  {config.domain ? (
                      <div className="mt-5 grid gap-5 xl:grid-cols-3">
                          <QueueList
                              title="Review cases"
                              items={reviewCases}
                              emptyLabel="No review cases in this permitted domain."
                              onSelect={setSelectedReviewCase}
                          />

                          <QueueList
                              title="Incidents"
                              items={incidents}
                              emptyLabel="No incidents in this permitted domain."
                              onSelect={setSelectedIncident}
                          />

                          <QueueList
                              title="Support cases"
                              items={supportCases}
                              emptyLabel="No support cases in this permitted domain."
                              onSelect={setSelectedSupportCase}
                          />
                      </div>
                  ) : null}

                  {(selectedReviewCase ||
                      selectedIncident ||
                      selectedSupportCase) ? (
                      <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                          <h2 className="text-sm font-black text-stone-950">
                              Action context
                          </h2>

                          <p className="mt-1 text-xs leading-5 text-stone-500">
                              Mutating governance actions use the same explicit reason/evidence context and are re-checked by backend permission + MFA boundaries.
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <input
                                  className={inputClass}
                                  value={reason}
                                  onChange={(event) =>
                                      setReason(
                                          event.target.value,
                                      )
                                  }
                                  placeholder="Governance decision/action reason"
                              />

                              <input
                                  className={inputClass}
                                  value={evidenceLabel}
                                  onChange={(event) =>
                                      setEvidenceLabel(
                                          event.target.value,
                                      )
                                  }
                                  placeholder="Evidence / ticket label"
                              />

                              <input
                                  className={`${inputClass} sm:col-span-2`}
                                  value={evidenceReferenceId}
                                  onChange={(event) =>
                                      setEvidenceReferenceId(
                                          event.target.value,
                                      )
                                  }
                                  placeholder="Evidence reference ID (optional)"
                              />
                          </div>
                      </section>
                  ) : null}

                  {selectedReviewCase ? (
                      <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                  <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-700">
                                      {selectedReviewCase.caseKey}
                                  </p>

                                  <h2 className="mt-2 text-xl font-black text-stone-950">
                                      {selectedReviewCase.summary}
                                  </h2>

                                  <p className="mt-2 text-sm leading-6 text-stone-500">
                                      {selectedReviewCase.details ||
                                          'No additional details.'}
                                  </p>
                              </div>

                              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black">
                                  {titleize(
                                      selectedReviewCase.status,
                                  )}
                              </span>
                          </div>

                          {canMutateDomain ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                      type="button"
                                      disabled={
                                          busy ||
                                          reason.trim().length < 5
                                      }
                                      onClick={() =>
                                          run(
                                              () =>
                                                  decideAdminReviewCase(
                                                      selectedReviewCase.id,
                                                      {
                                                          decision:
                                                              'resolve',
                                                          reason:
                                                              reason.trim(),
                                                          evidence:
                                                              evidence(),
                                                      },
                                                  ),
                                              'Review case resolved with immutable audit context.',
                                          )
                                      }
                                      className={primaryButtonClass}
                                  >
                                      <CheckCircle2 size={15} />

                                      Resolve case
                                  </button>

                                  {[
                                      'product_version',
                                      'recipe_version',
                                      'dish',
                                  ].includes(
                                      selectedReviewCase.entity?.type,
                                  ) ? (
                                      <button
                                          type="button"
                                          disabled={
                                              busy ||
                                              reason.trim().length < 10 ||
                                              evidence().length === 0
                                          }
                                          onClick={() =>
                                              run(
                                                  () =>
                                                      executeAdminGovernanceAction({
                                                          entityType:
                                                              selectedReviewCase.entity.type,
                                                          entityId:
                                                              selectedReviewCase.entity.id,
                                                          action:
                                                              'quarantine',
                                                          reviewCaseId:
                                                              selectedReviewCase.id,
                                                          summary:
                                                              selectedReviewCase.summary,
                                                          reason:
                                                              reason.trim(),
                                                          evidence:
                                                              evidence(),
                                                      }),
                                                  'Governed quarantine executed through the owning domain service.',
                                              )
                                          }
                                          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 disabled:opacity-50"
                                      >
                                          <ShieldAlert size={15} />

                                          Quarantine
                                      </button>
                                  ) : null}

                                  {selectedReviewCase.entity?.type ===
                                  'dish' ? (
                                      <button
                                          type="button"
                                          disabled={
                                              busy ||
                                              reason.trim().length < 10 ||
                                              evidence().length === 0
                                          }
                                          onClick={() =>
                                              run(
                                                  () =>
                                                      executeAdminGovernanceAction({
                                                          entityType:
                                                              'dish',
                                                          entityId:
                                                              selectedReviewCase.entity.id,
                                                          action:
                                                              'recover',
                                                          reviewCaseId:
                                                              selectedReviewCase.id,
                                                          summary:
                                                              selectedReviewCase.summary,
                                                          reason:
                                                              reason.trim(),
                                                          evidence:
                                                              evidence(),
                                                      }),
                                                  'Dish recovery delegated to the frozen M07 lifecycle service.',
                                              )
                                          }
                                          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black disabled:opacity-50"
                                      >
                                          <RotateCcw size={15} />

                                          Recover Dish
                                      </button>
                                  ) : null}
                              </div>
                          ) : (
                              <p className="mt-4 text-xs font-semibold text-stone-400">
                                  Your current administrative profile can review this domain but has no mutation permission.
                              </p>
                          )}
                      </section>
                  ) : null}

                  {selectedIncident &&
                  canMutateDomain ? (
                      <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-[0.1em] text-amber-700">
                              {selectedIncident.incidentKey}
                          </p>

                          <h2 className="mt-2 text-lg font-black">
                              {selectedIncident.title}
                          </h2>

                          <p className="mt-2 text-sm leading-6 text-stone-500">
                              {selectedIncident.summary}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                  type="button"
                                  disabled={
                                      busy ||
                                      reason.trim().length < 3
                                  }
                                  onClick={() =>
                                      run(
                                          () =>
                                              updateAdminIncident(
                                                  selectedIncident.id,
                                                  {
                                                      status:
                                                          'monitoring',
                                                      reason:
                                                          reason.trim(),
                                                      evidence:
                                                          evidence(),
                                                  },
                                              ),
                                          'Incident moved to monitoring.',
                                      )
                                  }
                                  className="focus-ring rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-900 disabled:opacity-50"
                              >
                                  Monitor
                              </button>

                              <button
                                  type="button"
                                  disabled={
                                      busy ||
                                      reason.trim().length < 3
                                  }
                                  onClick={() =>
                                      run(
                                          () =>
                                              updateAdminIncident(
                                                  selectedIncident.id,
                                                  {
                                                      status:
                                                          'resolved',
                                                      bannerEnabled:
                                                          false,
                                                      reason:
                                                          reason.trim(),
                                                      evidence:
                                                          evidence(),
                                                  },
                                              ),
                                          'Incident resolved and active banner disabled.',
                                      )
                                  }
                                  className={primaryButtonClass}
                              >
                                  Resolve incident
                              </button>
                          </div>
                      </section>
                  ) : null}

                  {selectedSupportCase &&
                  canMutateDomain ? (
                      <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-700">
                              {selectedSupportCase.supportKey}
                          </p>

                          <h2 className="mt-2 text-lg font-black">
                              {selectedSupportCase.title}
                          </h2>

                          <p className="mt-2 text-sm leading-6 text-stone-500">
                              {selectedSupportCase.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                  type="button"
                                  disabled={
                                      busy ||
                                      reason.trim().length < 3
                                  }
                                  onClick={() =>
                                      run(
                                          () =>
                                              updateAdminSupportCase(
                                                  selectedSupportCase.id,
                                                  {
                                                      status:
                                                          'in_progress',
                                                      reason:
                                                          reason.trim(),
                                                      evidence:
                                                          evidence(),
                                                  },
                                              ),
                                          'Support case moved in progress.',
                                      )
                                  }
                                  className="focus-ring rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black disabled:opacity-50"
                              >
                                  Start work
                              </button>

                              <button
                                  type="button"
                                  disabled={
                                      busy ||
                                      reason.trim().length < 3
                                  }
                                  onClick={() =>
                                      run(
                                          () =>
                                              updateAdminSupportCase(
                                                  selectedSupportCase.id,
                                                  {
                                                      status:
                                                          'resolved',
                                                      reason:
                                                          reason.trim(),
                                                      evidence:
                                                          evidence(),
                                                  },
                                              ),
                                          'Support case resolved.',
                                      )
                                  }
                                  className={primaryButtonClass}
                              >
                                  Resolve support case
                              </button>
                          </div>
                      </section>
                  ) : null}

                  {section === 'trustSafety' ? (
                      <div className="mt-5">
                          <Notice tone="amber">
                              Critical safety decisions require evidence. Unknown food/allergen evidence remains uncertainty; this console cannot convert unknown into “free-from”.
                          </Notice>
                      </div>
                  ) : null}

                  <section className="mt-5 rounded-[24px] border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
                      <div className="flex items-start gap-3">
                          <Database
                              size={18}
                              className="mt-0.5 shrink-0 text-emerald-400"
                              aria-hidden="true"
                          />

                          <div>
                              <h2 className="text-sm font-black">
                                  Governance boundary
                              </h2>

                              <p className="mt-2 text-xs leading-5 text-stone-400">
                                  Admin UI → permission check → recent MFA where required → reason/evidence → owning domain service → immutable M03 audit. Direct database editing is not an M17 operating model.
                              </p>
                          </div>
                      </div>
                  </section>
              </>
          )}
      </AdminShell>
  );
}