import {
    AlertTriangle,
    Banknote,
    Bot,
    Boxes,
    Building2,
    CheckCircle2,
    Clock3,
    Database,
    FileWarning,
    Flag,
    History,
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
    XCircle,
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
    getLandingFeaturedContent,
  } from '../../landing/api/featuredContentApi';

  import {
    getRetailMediaErrorMessage,
    listAdminAdDecisionLogs,
    listAdminRetailMediaCampaigns,
    reviewAdminRetailMediaCampaign,
  } from '../../retailMedia/services/retailMedia.service';

  import {
    getAdminProductVersions,
  } from '../../admin/services/catalogAdmin.service';

  import {
    listAdminNpiBulkBatches,
    listAdminNpiReviewQueue,
  } from '../../universalProduct/services/universalProduct.service';

  import {
    listAdminRecipes,
  } from '../../recipes/services/recipe.service';

  import {
    decideAdminSettlement,
    listAdminSettlements,
    markAdminSettlementPaid,
  } from '../../hostOperations/services/hostOperations.service';
  
  import {
    activateAdminFoodRule,
    createAdminFoodRuleDraft,
    createAdminFeatureFlag,
    createAdminReviewCase,
    decideAdminReviewCase,
    executeAdminGovernanceAction,
    getAdminCommandCenter,
    getAdminGovernanceErrorMessage,
    getAdminIntegrationOverview,
    getAdminPolicyOverview,
    listAdminIncidents,
    listAdminFeatureFlags,
    listAdminMarketplaceOrderExceptions,
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
  
  const USER_METRIC_LABELS = Object.freeze({
    'Open review cases': 'Open reviews',
    'Critical reviews': 'Urgent reviews',
    'Host activation queue': 'Host approvals',
    'Order exceptions': 'Order issues',
    'Failed webhooks': 'Connection issues',
    'Pending settlements': 'Pending payouts',
    'Active incidents': 'Safety alerts',
    'Enabled feature flags': 'Active controls',
  });
  
  const USER_METRIC_STYLES = [
    'bg-[#dff0f3] text-[#0b5f68]',
    'bg-[#e5e8f8] text-[#40508d]',
    'bg-[#dff1e7] text-[#176647]',
    'bg-[#ece7f7] text-[#5b4588]',
    'bg-[#f4e6ea] text-[#8a4053]',
    'bg-[#dff2f0] text-[#176a67]',
    'bg-[#e5ebf5] text-[#365681]',
    'bg-[#e8eee7] text-[#466347]',
  ];
  
  function UsersMetricCard({
    label,
    value,
    icon: Icon,
    index,
  }) {
    return (
        <div className="bg-[#f5faf9] p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase leading-3.5 tracking-[0.08em] text-stone-500 sm:text-xs sm:leading-4 sm:tracking-[0.09em]">
                        {USER_METRIC_LABELS[label] || label}
                    </p>
  
                    <p className="mt-1.5 text-xl font-black leading-none text-stone-950 sm:mt-3 sm:text-[30px]">
                        {value ?? 0}
                    </p>
                </div>
  
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${USER_METRIC_STYLES[index % USER_METRIC_STYLES.length]}`}>
                    <Icon
                        size={16}
                        aria-hidden="true"
                    />
                </span>
            </div>
        </div>
    );
  }
  
  function UsersStepCard({
    number,
    title,
    body,
    mobileTitle,
    mobileBody,
    icon: Icon,
    tone,
    to,
  }) {
    const tones = {
        amber:
            'bg-[#dceff2] text-[#0d6070]',
        sky:
            'bg-[#dfe8f8] text-[#31598d]',
        emerald:
            'bg-[#dff1e7] text-[#176647]',
        violet:
            'bg-[#ebe5f7] text-[#5c4388]',
    };
  
    const borderClasses = {
        1: 'border-b border-r border-white/15 lg:border-b-0',
        2: 'border-b border-white/15 lg:border-b-0 lg:border-r',
        3: 'border-r border-white/15',
        4: '',
    };
  
    const content = (
        <div
            className={`h-full min-h-[104px] p-3 sm:min-h-[150px] sm:p-5 ${borderClasses[number] || ''}`}
        >
            <div className="flex items-center justify-between gap-2 sm:gap-3">
                <span className={`grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${tones[tone]}`}>
                    <Icon
                        size={16}
                        aria-hidden="true"
                    />
                </span>
  
                <span className="text-[9px] font-black tracking-[0.12em] text-white/45 sm:text-xs sm:tracking-[0.14em]">
                    0{number}
                </span>
            </div>
  
            <h3 className="mt-2.5 text-[12px] font-black leading-4 text-white sm:mt-4 sm:text-[15px] sm:leading-5">
                <span className="sm:hidden">{mobileTitle || title}</span>
                <span className="hidden sm:inline">{title}</span>
            </h3>
  
            <p className="mt-1 text-[10px] font-semibold leading-4 text-white/65 sm:mt-1.5 sm:text-[13px] sm:leading-5">
                <span className="sm:hidden">{mobileBody || body}</span>
                <span className="hidden sm:inline">{body}</span>
            </p>
        </div>
    );
  
    if (!to) {
        return content;
    }
  
    return (
        <Link
            to={to}
            className="focus-ring block h-full transition hover:bg-white/[0.04]"
        >
            {content}
        </Link>
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
  
  // A17: only display records loaded from the Trust & Safety domain.
  // A failed request must never be presented as a genuinely empty queue.
  function TrustSafetyWorkQueue({
    title,
    subtitle,
    items,
    total,
    error,
    onSelect,
    selectedId,
    onMore,
    loadingMore,
    icon: Icon,
    tone,
  }) {
    const tones = {
      blue: 'bg-[#e5effb] text-[#265a83]',
      peach: 'bg-[#ffede0] text-[#955338]',
      mint: 'bg-[#e5f3e9] text-[#196344]',
    };
    const failed = Boolean(error);
    const [expanded, setExpanded] = useState(false);
    const visibleItems = expanded ? items : items.slice(0, 4);

    return (
      <section className="min-w-0 border-b border-[#d9e2dd] last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
        <div className="flex items-center justify-between gap-3 px-3.5 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
              <Icon size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold leading-5 text-[#1a332b] sm:text-base">{title}</h3>
              <p className="text-xs leading-4 text-stone-500">{subtitle}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[#f0f3ef] px-3 py-1 text-sm font-bold text-[#315d4d]">
            {failed ? '—' : total}
          </span>
        </div>

        {failed ? (
          <div role="alert" className="mx-3.5 mb-3 rounded-xl border border-red-200 bg-red-50 p-3 sm:mx-5">
            <p className="text-sm font-semibold text-red-800">Unable to load {title.toLowerCase()}.</p>
            <p className="mt-1 break-words text-xs text-red-700">{error}</p>
            <p className="mt-1 text-xs text-red-700">Use Refresh above to try again.</p>
          </div>
        ) : items.length ? (
          <div className="border-t border-[#e6ebe6]">
            {visibleItems.map((item, index) => (
              <button
                key={item.id || `${title}-${index}`}
                type="button"
                onClick={() => onSelect(item)}
                className={`focus-ring flex w-full min-w-0 items-center justify-between gap-3 border-b border-[#e9ece8] px-3.5 py-3 text-left last:border-b-0 hover:bg-[#f1f8f3] sm:px-5 ${selectedId === item.id ? 'bg-[#e6f4eb]' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold leading-5 text-[#1f3430]">
                    {item.summary || item.title || item.description || item.caseKey || item.incidentKey || item.supportKey || 'Untitled record'}
                  </span>
                  <span className="mt-1 block truncate text-xs text-stone-500">
                    {item.caseKey || item.incidentKey || item.supportKey || 'Record'} · {titleize(item.domain || 'trust_safety')} · {titleize(item.status)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-emerald-800">Review →</span>
              </button>
            ))}
            {!expanded && items.length > 4 ? (
              <button type="button" onClick={() => setExpanded(true)}
                className="focus-ring w-full px-4 py-3 text-sm font-bold text-[#0e6b4c] hover:bg-[#f1f8f3]">
                View all {items.length} loaded records
              </button>
            ) : null}
            {expanded && items.length > 4 ? (
              <button type="button" onClick={() => setExpanded(false)}
                className="focus-ring w-full border-t border-[#e9ece8] px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-[#f1f8f3]">
                Show fewer
              </button>
            ) : null}
            {total > items.length && (expanded || items.length <= 4) ? (
              <button type="button" disabled={loadingMore} onClick={onMore}
                className="focus-ring w-full px-4 py-3 text-sm font-bold text-[#0e6b4c] hover:bg-[#f1f8f3] disabled:opacity-50">
                {loadingMore ? 'Loading…' : `Show more (${total - items.length} remaining)`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="border-t border-[#e6ebe6] px-3.5 py-4 text-sm leading-5 text-stone-600 sm:px-5">
            No {title.toLowerCase()} in Trust & Safety right now.
          </p>
        )}
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
                'Data Quality & Duplicate Review',
            description:
                'Check product records that need attention, spot possible duplicates, and move each item to the right review workspace.',
            domain:
                'catalog',
            icon:
                SearchCheck,
        },
  
        recipeReview: {
            code:
                'A10',
            title:
                'Recipe Review & Publishing',
            description:
                'Review recipes waiting for a decision, confirm food checks, and follow recent recipe versions.',
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
                'FINANCE',
            title:
                'Finance & Payouts',
            description:
                'Review Host payout batches, approve ready amounts, and record completed payments.',
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
                'Food Rules & Feature Access',
            description:
                'Create and review food safety rules, manage feature access, and track related admin work.',
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
                'AI Assistant Health',
            description:
                'Track Food Copilot results, backup usage and issues in one place.',
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
  

  function dataQualityDraftName(draft) {
    return (
        draft?.candidateFields?.displayName?.value ||
        draft?.displayName ||
        'Unnamed product'
    );
  }

  function dataQualityStatusLabel(value) {
    const labels = {
        provisional: 'Needs a first check',
        ready_for_review: 'Ready to review',
        needs_more_evidence: 'More proof needed',
        approved_for_catalog: 'Approved for Catalog',
        rejected: 'Rejected',
        in_review: 'In review',
        draft: 'Draft',
        published: 'Published',
        retired: 'Retired',
        submitted: 'Submitted',
        needs_attention: 'Needs attention',
        completed: 'Completed',
    };

    return labels[value] || titleize(value);
  }

  function DataQualityStep({ number, title, body, mobileBody, icon: StepIcon }) {
    const borderClass =
        number === 4
            ? ''
            : 'border-b border-stone-300/80 lg:border-b-0 lg:border-r';

    return (
        <div className={`grid min-h-[92px] grid-cols-[30px_minmax(0,1fr)] gap-3 px-3.5 py-3.5 sm:min-h-[118px] sm:grid-cols-[36px_minmax(0,1fr)] sm:gap-4 sm:px-5 sm:py-5 ${borderClass}`}>
            <div className="pt-0.5">
                <span className="text-[11px] font-black tracking-[0.08em] text-[#16665c] sm:text-xs">
                    0{number}
                </span>
            </div>

            <div className="min-w-0">
                <div className="flex items-center gap-2 text-[#16665c]">
                    <StepIcon size={15} aria-hidden="true" />
                    <h3 className="text-[13px] font-black leading-4 text-stone-950 sm:text-[15px] sm:leading-5">
                        {title}
                    </h3>
                </div>

                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-600 sm:hidden">
                    {mobileBody || body}
                </p>
                <p className="mt-1.5 hidden text-sm font-semibold leading-5 text-stone-600 sm:block">
                    {body}
                </p>
            </div>
        </div>
    );
  }

  function DataQualityRow({ title, meta, status, tone = 'blue', to }) {
    const tones = {
        blue: 'border-[#6f9ab5] text-[#24526b]',
        green: 'border-[#64a785] text-[#176647]',
        coral: 'border-[#d48b7c] text-[#9a4a3d]',
        slate: 'border-[#94a0a8] text-[#4d5a64]',
    };

    const content = (
        <div className="grid gap-2 border-t border-stone-200/90 px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 sm:py-3.5 lg:px-6">
            <div className="min-w-0">
                <p className="truncate text-sm font-black text-stone-950 sm:text-[15px]">
                    {title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">
                    {meta}
                </p>
            </div>

            <span className={`w-fit border-l-2 pl-2 text-[10px] font-black ${tones[tone] || tones.slate}`}>
                {status}
            </span>
        </div>
    );

    return to ? (
        <Link to={to} className="block transition hover:bg-white/70">
            {content}
        </Link>
    ) : content;
  }


  function RecipeReviewStep({ number, title, body, mobileBody, icon: StepIcon }) {
    const mobileBorder =
        number === 1
            ? 'border-b border-r'
            : number === 2
                ? 'border-b'
                : number === 3
                    ? 'border-r'
                    : '';

    const desktopBorder = number < 4 ? 'lg:border-r lg:border-b-0' : 'lg:border-b-0';

    return (
        <div className={`min-w-0 border-stone-200 px-3.5 py-3.5 sm:px-5 sm:py-5 ${mobileBorder} ${desktopBorder}`}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black tracking-[0.10em] text-[#315f7a] sm:text-xs">
                    0{number}
                </span>
                <StepIcon size={15} className="text-[#176647]" aria-hidden="true" />
            </div>
            <h3 className="mt-1.5 text-[13px] font-black leading-4 text-stone-950 sm:mt-2 sm:text-[15px] sm:leading-5">
                {title}
            </h3>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-600 sm:hidden">
                {mobileBody || body}
            </p>
            <p className="mt-1.5 hidden text-sm font-semibold leading-5 text-stone-600 sm:block">
                {body}
            </p>
        </div>
    );
  }

  function formatRecipeWorkspaceDate(value) {
    if (!value) {
        return 'Date not available';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Date not available';
    }

    return date.toLocaleString();
  }

  function recipeSourceLabel(version) {
    if (version?.source?.organizationId) {
        return version?.source?.name || 'Host submission';
    }

    const sourceType = String(version?.source?.type || '').toLowerCase();

    if (['brand', 'chef', 'community'].includes(sourceType)) {
        return version?.source?.name || 'Host submission';
    }

    return version?.source?.name || 'EPANTRY recipe';
  }


  function orderIssueLabel(status) {
    const labels = {
      delivery_failed: 'Delivery failed',
      return_requested: 'Return requested',
      partial_unavailable: 'Some items unavailable',
      substitution_requested: 'Replacement requested',
    };

    return labels[status] || titleize(status);
  }

  function formatOrderMoney(amountMinor, currency = 'INR') {
    if (amountMinor === null || amountMinor === undefined) {
      return 'Not available';
    }

    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2,
      }).format(Number(amountMinor) / 100);
    } catch {
      return `${currency || 'INR'} ${(Number(amountMinor) / 100).toFixed(2)}`;
    }
  }

  function orderReference(order) {
    const value = String(order?.id || '');
    return value ? value.slice(-8).toUpperCase() : '—';
  }


  function integrationHealthLabel(item) {
    if (item?.status === 'disabled') {
      return 'Paused';
    }

    if (item?.lastDeliveryStatus === 'failed') {
      return 'Needs attention';
    }

    if (item?.lastDeliveryStatus === 'success') {
      return 'Working';
    }

    return 'Not used yet';
  }

  function integrationHealthClass(item) {
    const label = integrationHealthLabel(item);

    if (label === 'Needs attention') {
      return 'text-[#a2543c]';
    }

    if (label === 'Working') {
      return 'text-emerald-700';
    }

    return 'text-stone-500';
  }

  function integrationLastSeen(value) {
    if (!value) {
      return 'No delivery yet';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Delivery time unavailable';
    }

    return date.toLocaleString();
  }

  function financeMoney(minor, currency = 'INR') {
    const amount = Number(minor || 0) / 100;

    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `₹${amount.toLocaleString('en-IN')}`;
    }
  }

  function financeStatusLabel(value) {
    const status = String(value || '').toLowerCase();

    if (status === 'pending_approval') return 'Waiting for approval';
    if (status === 'approved') return 'Ready to pay';
    if (status === 'paid') return 'Paid';
    if (status === 'rejected') return 'Returned';
    if (status === 'void') return 'Voided';

    return titleize(status || 'unknown');
  }

  function financeStatusClass(value) {
    const status = String(value || '').toLowerCase();

    if (status === 'pending_approval') return 'border-[#c8dbe6] bg-[#edf5f9] text-[#315f7a]';
    if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (status === 'paid') return 'border-[#d9d3ed] bg-[#f2eff9] text-[#5b4b85]';
    if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-700';

    return 'border-stone-200 bg-stone-50 text-stone-600';
  }

  function financeDate(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function financePeriod(item) {
    if (!item?.periodStart || !item?.periodEnd) return 'Period not available';
    return `${financeDate(item.periodStart)} – ${financeDate(item.periodEnd)}`;
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
    const [aiHealthRefresh, setAiHealthRefresh] = useState(0);
  
    const [busy, setBusy] =
        useState(false);
  
    const [error, setError] =
        useState('');
  
    const [notice, setNotice] =
        useState('');
  
    const [commandCenter, setCommandCenter] =
        useState(null);
    const [commandCenterError, setCommandCenterError] = useState('');
  
    const [reviewCases, setReviewCases] =
        useState([]);
  
    const [incidents, setIncidents] =
        useState([]);
  
    const [supportCases, setSupportCases] =
        useState([]);

    const [trustSafetyQueueState, setTrustSafetyQueueState] = useState({
      reviews: { total: 0, page: 1, error: '' },
      incidents: { total: 0, page: 1, error: '' },
      support: { total: 0, page: 1, error: '' },
    });
    const [trustSafetyMore, setTrustSafetyMore] = useState('');
    // "All permitted" uses the backend's permission-filtered scope;
    // "Trust & Safety" restricts to its original domain. No private records are exposed.
    const [trustSafetyScope, setTrustSafetyScope] = useState('all');


    const [dataQualityLoading, setDataQualityLoading] =
        useState(false);

    const [dataQualityError, setDataQualityError] =
        useState('');

    const [dataQualityWorkspace, setDataQualityWorkspace] =
        useState({
            drafts: [],
            draftTotal: 0,
            batches: [],
            batchSummary: {},
            versions: [],
            versionTotal: 0,
        });

    const [recipeReviewLoading, setRecipeReviewLoading] =
        useState(false);

    const [recipeReviewError, setRecipeReviewError] =
        useState('');

    const [recipeReviewRecipes, setRecipeReviewRecipes] =
        useState([]);


    const [ordersLoading, setOrdersLoading] =
        useState(false);

    const [ordersError, setOrdersError] =
        useState('');

    const [ordersWorkspace, setOrdersWorkspace] =
        useState({
            orders: [],
            summary: {
                total: 0,
                deliveryFailed: 0,
                returnsRequested: 0,
                itemsUnavailable: 0,
                substitutionsRequested: 0,
            },
        });

    const [selectedOrderId, setSelectedOrderId] =
        useState('');

    const [showAllOrderCases, setShowAllOrderCases] =
        useState(false);


    const [integrationLoading, setIntegrationLoading] =
        useState(false);

    const [integrationError, setIntegrationError] =
        useState('');

    const [integrationWorkspace, setIntegrationWorkspace] =
        useState({
            webhooks: [],
            summary: {
                total: 0,
                active: 0,
                failed: 0,
                healthy: 0,
                neverUsed: 0,
                disabled: 0,
                organizations: 0,
            },
            pagination: {},
        });

    const [selectedIntegrationId, setSelectedIntegrationId] =
        useState('');

    const [showAllIntegrationCases, setShowAllIntegrationCases] =
        useState(false);

    const [financeLoading, setFinanceLoading] =
        useState(false);

    const [financeError, setFinanceError] =
        useState('');

    const [financeSettlements, setFinanceSettlements] =
        useState([]);

    const [financeSummary, setFinanceSummary] =
        useState({
            total: 0,
            pendingApproval: 0,
            approved: 0,
            paid: 0,
            rejected: 0,
            waitingAmountMinor: 0,
            paidAmountMinor: 0,
        });

    const [selectedFinanceSettlementId, setSelectedFinanceSettlementId] =
        useState('');

    const [financeView, setFinanceView] =
        useState('action');

    const [financeReason, setFinanceReason] =
        useState('');

    const [financePayoutReference, setFinancePayoutReference] =
        useState('');

    const [cmsLoading, setCmsLoading] =
        useState(false);

    const [cmsError, setCmsError] =
        useState('');

    const [cmsWorkspace, setCmsWorkspace] =
        useState({
            grocery: [],
            brands: [],
            recipes: [],
        });

    const [cmsCollection, setCmsCollection] =
        useState('grocery');

    const [cmsShowAll, setCmsShowAll] =
        useState(false);

    const [adReviewLoading, setAdReviewLoading] =
        useState(false);

    const [adReviewError, setAdReviewError] =
        useState('');

    const [adCampaigns, setAdCampaigns] =
        useState([]);

    const [adDecisionLogs, setAdDecisionLogs] =
        useState([]);

    const [selectedAdCampaignId, setSelectedAdCampaignId] =
        useState('');

    const [adQueueView, setAdQueueView] =
        useState('review');

    const [adReviewReason, setAdReviewReason] =
        useState('');

    const [adEvidenceRef, setAdEvidenceRef] =
        useState('');
  
    const [policy, setPolicy] =
        useState(null);

    const [policyLoadIssues, setPolicyLoadIssues] = useState({ rules: '', flags: '' });
    const [policyRulesExpanded, setPolicyRulesExpanded] = useState(false);
    const [policyFlagsExpanded, setPolicyFlagsExpanded] = useState(false);
    const [policyRelatedIssues, setPolicyRelatedIssues] = useState([]);
    const [ruleForm, setRuleForm] = useState({
        ruleKey: '', ruleType: 'allergen', jurisdictionCode: 'IN',
        description: '', changeReason: '',
    });
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [showFlagForm, setShowFlagForm] = useState(false);
    const [ruleActionReason, setRuleActionReason] = useState('');
    const [policyFlagAction, setPolicyFlagAction] = useState(null);

    function beginPolicyFlagAction(flag) {
        setPolicyFlagAction((previous) => {
            if (previous?.id === flag.id) return null;
            return {
                id: flag.id,
                enabled: !flag.enabled,
                environment: flag.environments?.[0] || 'development',
                rollout: String(flag.rolloutPercentage > 0 ? flag.rolloutPercentage : 100),
                reason: '',
                reference: '',
            };
        });
    }


  
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
                if (section === 'trustSafety' || section === 'aiQuality') setCommandCenterError('');
                if (section === 'policy') {
                    setPolicyLoadIssues({ rules: '', flags: '' });
                    setPolicyRelatedIssues([]);
                }

                if (section === 'recipeReview' || section === 'finance') {
                    setReviewCases([]);
                    setIncidents([]);
                    setSupportCases([]);
                    setLoading(false);
                    return;
                }
  
                try {
                    const tasks = [
                        getAdminCommandCenter(),
                    ];
  
                    if (
                        config.domain
                    ) {
                        // Cross-domain safety work can be in any permitted Admin domain.
                        // Passing no domain makes the server restrict results to permitted areas.
                        const queueDomain = section === 'trustSafety'
                            ? (trustSafetyScope === 'all' ? undefined : 'trust_safety')
                            : config.domain;
                        tasks.push(
                            listAdminReviewCases({ page: 1, limit: 50, domain: queueDomain }),
                            listAdminIncidents({ page: 1, limit: 30, domain: queueDomain }),
                            listAdminSupportCases({ page: 1, limit: 30, domain: queueDomain }),
                        );
                    }
  
                    if (
                        section ===
                        'policy'
                    ) {
                        // Independent flags request keeps available flags visible if the
                        // food-rule overview fails. Both APIs are read-only and protected.
                        tasks.push(
                            getAdminPolicyOverview(),
                            listAdminFeatureFlags(),
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
                    } else if (section === 'trustSafety' || section === 'aiQuality') {
                        setCommandCenter(null);
                        setCommandCenterError(getAdminGovernanceErrorMessage(
                            results[0].reason, 'Could not load the platform overview.',
                        ));
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

                        if (section === 'trustSafety') {
                            const queueResult = (result) => ({
                                total: result?.status === 'fulfilled'
                                    ? Number(result.value?.pagination?.total ?? 0)
                                    : 0,
                                page: 1,
                                error: result?.status === 'rejected'
                                    ? getAdminGovernanceErrorMessage(result.reason, 'Unable to reach the server.')
                                    : '',
                            });
                            setTrustSafetyQueueState({
                                reviews: queueResult(reviewResult),
                                incidents: queueResult(incidentResult),
                                support: queueResult(supportResult),
                            });
                        }


                        if (section === 'policy') {
                            setPolicyRelatedIssues([
                                ['Review cases', reviewResult],
                                ['Incidents', incidentResult],
                                ['Support cases', supportResult],
                            ].filter(([, result]) => result?.status === 'rejected')
                                .map(([label, result]) => `${label}: ${getAdminGovernanceErrorMessage(result.reason)}`));
                        }
                    } else {
                        setReviewCases([]);
                        setIncidents([]);
                        setSupportCases([]);
                    }
  
                    if (section === 'policy') {
                        const index = config.domain ? 4 : 1;
                        const overview = results[index];
                        const separateFlags = results[index + 1];
                        const rulesLoaded = overview?.status === 'fulfilled';
                        const flagsLoaded = separateFlags?.status === 'fulfilled' || rulesLoaded;
                        const base = rulesLoaded ? (overview.value || {}) : {};
                        setPolicy({
                            ...base,
                            ruleProfiles: rulesLoaded ? (base.ruleProfiles || []) : [],
                            featureFlags: separateFlags?.status === 'fulfilled'
                                ? (separateFlags.value?.featureFlags || [])
                                : (base.featureFlags || []),
                        });
                        setPolicyLoadIssues({
                            rules: rulesLoaded ? '' : getAdminGovernanceErrorMessage(
                                overview?.reason, 'Unable to load food rules.',
                            ),
                            flags: flagsLoaded ? '' : getAdminGovernanceErrorMessage(
                                separateFlags?.reason, 'Unable to load feature controls.',
                            ),
                        });
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
                trustSafetyScope,
            ],
        );
  
    useEffect(
        () => {
            load();
        },
        [load],
    );

    const loadMoreTrustSafety = useCallback(async (queue) => {
      if (section !== 'trustSafety' || trustSafetyMore) return;
      const api = {
        reviews: { fetch: listAdminReviewCases, set: setReviewCases, limit: 50 },
        incidents: { fetch: listAdminIncidents, set: setIncidents, limit: 30 },
        support: { fetch: listAdminSupportCases, set: setSupportCases, limit: 30 },
      }[queue];
      if (!api) return;
      const page = trustSafetyQueueState[queue].page + 1;
      setTrustSafetyMore(queue);
      try {
        const response = await api.fetch({ page, limit: api.limit, domain: trustSafetyScope === 'all' ? undefined : 'trust_safety' });
        const newRecords = queue === 'reviews' ? response.reviewCases : queue === 'incidents' ? response.incidents : response.supportCases;
        api.set(previous => {
          const seen = new Set(previous.map(item => item.id));
          return [...previous, ...(newRecords || []).filter(item => !seen.has(item.id))];
        });
        setTrustSafetyQueueState(previous => ({
          ...previous,
          [queue]: { total: Number(response.pagination?.total || 0), page, error: '' },
        }));
      } catch (requestError) {
        setTrustSafetyQueueState(previous => ({
          ...previous,
          [queue]: { ...previous[queue], error: getAdminGovernanceErrorMessage(requestError, 'Could not load more records.') },
        }));
      } finally {
        setTrustSafetyMore('');
      }
    }, [section, trustSafetyMore, trustSafetyQueueState, trustSafetyScope]);


    const loadDataQualityWorkspace =
        useCallback(
            async () => {
                if (
                    section !==
                    'dataQuality'
                ) {
                    return;
                }

                setDataQualityLoading(true);
                setDataQualityError('');

                try {
                    const [
                        reviewQueue,
                        bulkBatches,
                        catalogVersions,
                    ] =
                        await Promise.all([
                            listAdminNpiReviewQueue({
                                page: 1,
                                limit: 100,
                            }),
                            listAdminNpiBulkBatches({
                                page: 1,
                                limit: 100,
                            }),
                            getAdminProductVersions({
                                page: 1,
                                limit: 100,
                                publicationStatus: 'in_review',
                            }),
                        ]);

                    setDataQualityWorkspace({
                        drafts:
                            reviewQueue?.drafts ||
                            [],
                        draftTotal:
                            reviewQueue?.pagination?.total ||
                            0,
                        batches:
                            bulkBatches?.batches ||
                            [],
                        batchSummary:
                            bulkBatches?.summary ||
                            {},
                        versions:
                            catalogVersions?.items ||
                            [],
                        versionTotal:
                            catalogVersions?.pagination?.total ||
                            0,
                    });
                } catch (requestError) {
                    setDataQualityError(
                        getAdminGovernanceErrorMessage(
                            requestError,
                            'Unable to load catalog quality data.',
                        ),
                    );
                } finally {
                    setDataQualityLoading(false);
                }
            },
            [section],
        );

    useEffect(
        () => {
            loadDataQualityWorkspace();
        },
        [loadDataQualityWorkspace],
    );

    const loadRecipeReviewWorkspace =
        useCallback(
            async () => {
                if (section !== 'recipeReview') {
                    return;
                }

                setRecipeReviewLoading(true);
                setRecipeReviewError('');

                try {
                    const firstPage =
                        await listAdminRecipes({
                            page: 1,
                            limit: 100,
                            status: 'all',
                            search: '',
                        });

                    const combined =
                        Array.isArray(firstPage?.recipes)
                            ? [...firstPage.recipes]
                            : [];

                    const pageCount =
                        Number(firstPage?.pagination?.pages || 0);

                    if (pageCount > 1) {
                        const remainingPages =
                            await Promise.all(
                                Array.from(
                                    { length: pageCount - 1 },
                                    (_, index) =>
                                        listAdminRecipes({
                                            page: index + 2,
                                            limit: 100,
                                            status: 'all',
                                            search: '',
                                        }),
                                ),
                            );

                        for (const pageData of remainingPages) {
                            if (Array.isArray(pageData?.recipes)) {
                                combined.push(...pageData.recipes);
                            }
                        }
                    }

                    setRecipeReviewRecipes(combined);
                } catch (requestError) {
                    setRecipeReviewError(
                        getAdminGovernanceErrorMessage(
                            requestError,
                            'Unable to load recipe review data.',
                        ),
                    );
                } finally {
                    setRecipeReviewLoading(false);
                }
            },
            [section],
        );

    useEffect(
        () => {
            loadRecipeReviewWorkspace();
        },
        [loadRecipeReviewWorkspace],
    );
  

    const loadOrdersWorkspace =
        useCallback(
            async () => {
                if (section !== 'orders') {
                    return;
                }

                setOrdersLoading(true);
                setOrdersError('');

                try {
                    const result =
                        await listAdminMarketplaceOrderExceptions();

                    const orders =
                        Array.isArray(result?.orders)
                            ? result.orders
                            : [];

                    setOrdersWorkspace({
                        orders,
                        summary: {
                            total: Number(result?.summary?.total || orders.length || 0),
                            deliveryFailed: Number(result?.summary?.deliveryFailed || 0),
                            returnsRequested: Number(result?.summary?.returnsRequested || 0),
                            itemsUnavailable: Number(result?.summary?.itemsUnavailable || 0),
                            substitutionsRequested: Number(result?.summary?.substitutionsRequested || 0),
                        },
                    });

                    setSelectedOrderId((current) =>
                        orders.some((item) => item.id === current)
                            ? current
                            : orders[0]?.id || '',
                    );
                } catch (requestError) {
                    setOrdersWorkspace({
                        orders: [],
                        summary: {
                            total: 0,
                            deliveryFailed: 0,
                            returnsRequested: 0,
                            itemsUnavailable: 0,
                            substitutionsRequested: 0,
                        },
                    });
                    setSelectedOrderId('');
                    setOrdersError(
                        getAdminGovernanceErrorMessage(
                            requestError,
                            'Unable to load current order issues.',
                        ),
                    );
                } finally {
                    setOrdersLoading(false);
                }
            },
            [section],
        );

    useEffect(
        () => {
            loadOrdersWorkspace();
        },
        [loadOrdersWorkspace],
    );


    const loadIntegrationWorkspace =
        useCallback(
            async () => {
                if (section !== 'integrations') {
                    return;
                }

                setIntegrationLoading(true);
                setIntegrationError('');

                try {
                    const result =
                        await getAdminIntegrationOverview({
                            limit: 250,
                        });

                    const webhooks =
                        Array.isArray(result?.webhooks)
                            ? result.webhooks
                            : [];

                    setIntegrationWorkspace({
                        webhooks,
                        summary: {
                            total: Number(result?.summary?.total || webhooks.length || 0),
                            active: Number(result?.summary?.active || 0),
                            failed: Number(result?.summary?.failed || 0),
                            healthy: Number(result?.summary?.healthy || 0),
                            neverUsed: Number(result?.summary?.neverUsed || 0),
                            disabled: Number(result?.summary?.disabled || 0),
                            organizations: Number(result?.summary?.organizations || 0),
                        },
                        pagination: result?.pagination || {},
                    });

                    setSelectedIntegrationId((current) =>
                        webhooks.some((item) => item.id === current)
                            ? current
                            : webhooks[0]?.id || '',
                    );
                } catch (requestError) {
                    setIntegrationWorkspace({
                        webhooks: [],
                        summary: {
                            total: 0,
                            active: 0,
                            failed: 0,
                            healthy: 0,
                            neverUsed: 0,
                            disabled: 0,
                            organizations: 0,
                        },
                        pagination: {},
                    });
                    setSelectedIntegrationId('');
                    setIntegrationError(
                        getAdminGovernanceErrorMessage(
                            requestError,
                            'Unable to load integration health.',
                        ),
                    );
                } finally {
                    setIntegrationLoading(false);
                }
            },
            [section],
        );

    useEffect(
        () => {
            loadIntegrationWorkspace();
        },
        [loadIntegrationWorkspace],
    );

    const loadFinanceWorkspace =
        useCallback(
            async () => {
                if (section !== 'finance') {
                    return;
                }

                setFinanceLoading(true);
                setFinanceError('');

                try {
                    const firstPage =
                        await listAdminSettlements({
                            page: 1,
                            limit: 50,
                        });

                    const combined =
                        Array.isArray(firstPage?.settlements)
                            ? [...firstPage.settlements]
                            : [];

                    const pageCount =
                        Number(firstPage?.pagination?.pages || 0);

                    if (pageCount > 1) {
                        const remainingPages =
                            await Promise.all(
                                Array.from(
                                    { length: pageCount - 1 },
                                    (_, index) =>
                                        listAdminSettlements({
                                            page: index + 2,
                                            limit: 50,
                                        }),
                                ),
                            );

                        for (const pageData of remainingPages) {
                            if (Array.isArray(pageData?.settlements)) {
                                combined.push(...pageData.settlements);
                            }
                        }
                    }

                    const fallbackSummary = {
                        total: combined.length,
                        pendingApproval: combined.filter((item) => item?.status === 'pending_approval').length,
                        approved: combined.filter((item) => item?.status === 'approved').length,
                        paid: combined.filter((item) => item?.status === 'paid').length,
                        rejected: combined.filter((item) => item?.status === 'rejected').length,
                        waitingAmountMinor: combined
                            .filter((item) => ['pending_approval', 'approved'].includes(item?.status))
                            .reduce((total, item) => total + Number(item?.totals?.netPayableMinor || 0), 0),
                        paidAmountMinor: combined
                            .filter((item) => item?.status === 'paid')
                            .reduce((total, item) => total + Number(item?.totals?.netPayableMinor || 0), 0),
                    };

                    setFinanceSettlements(combined);
                    setFinanceSummary({
                        ...fallbackSummary,
                        ...(firstPage?.summary || {}),
                    });

                    setSelectedFinanceSettlementId((current) => {
                        if (combined.some((item) => item?.id === current)) {
                            return current;
                        }

                        return (
                            combined.find((item) => ['pending_approval', 'approved'].includes(item?.status))?.id ||
                            combined[0]?.id ||
                            ''
                        );
                    });
                } catch (requestError) {
                    setFinanceSettlements([]);
                    setFinanceSummary({
                        total: 0,
                        pendingApproval: 0,
                        approved: 0,
                        paid: 0,
                        rejected: 0,
                        waitingAmountMinor: 0,
                        paidAmountMinor: 0,
                    });
                    setSelectedFinanceSettlementId('');
                    setFinanceError(
                        getAdminGovernanceErrorMessage(
                            requestError,
                            'Unable to load Host payout records.',
                        ),
                    );
                } finally {
                    setFinanceLoading(false);
                }
            },
            [section],
        );

    useEffect(
        () => {
            loadFinanceWorkspace();
        },
        [loadFinanceWorkspace],
    );

    const loadCmsWorkspace =
        useCallback(
            async () => {
                if (section !== 'cms') {
                    return;
                }

                setCmsLoading(true);
                setCmsError('');

                try {
                    const result =
                        await getLandingFeaturedContent();

                    setCmsWorkspace({
                        grocery: Array.isArray(result?.grocery) ? result.grocery : [],
                        brands: Array.isArray(result?.brands) ? result.brands : [],
                        recipes: Array.isArray(result?.recipes) ? result.recipes : [],
                    });
                } catch (requestError) {
                    setCmsWorkspace({
                        grocery: [],
                        brands: [],
                        recipes: [],
                    });
                    setCmsError(
                        requestError?.response?.data?.message ||
                        requestError?.message ||
                        'Unable to load the current homepage content.',
                    );
                } finally {
                    setCmsLoading(false);
                }
            },
            [section],
        );

    useEffect(
        () => {
            loadCmsWorkspace();
        },
        [loadCmsWorkspace],
    );

    const loadAdReviewWorkspace =
        useCallback(
            async () => {
                if (section !== 'adReview') {
                    return;
                }

                setAdReviewLoading(true);
                setAdReviewError('');

                try {
                    const [campaignResult, decisionResult] =
                        await Promise.allSettled([
                            listAdminRetailMediaCampaigns({
                                limit: 200,
                            }),
                            listAdminAdDecisionLogs({
                                limit: 50,
                            }),
                        ]);

                    if (campaignResult.status === 'fulfilled') {
                        setAdCampaigns(
                            Array.isArray(campaignResult.value?.campaigns)
                                ? campaignResult.value.campaigns
                                : [],
                        );
                    } else {
                        setAdCampaigns([]);
                        setAdReviewError(
                            getRetailMediaErrorMessage(
                                campaignResult.reason,
                                'Unable to load ad campaigns right now.',
                            ),
                        );
                    }

                    setAdDecisionLogs(
                        decisionResult.status === 'fulfilled' &&
                        Array.isArray(decisionResult.value?.adDecisionLogs)
                            ? decisionResult.value.adDecisionLogs
                            : [],
                    );
                } finally {
                    setAdReviewLoading(false);
                }
            },
            [section],
        );

    useEffect(
        () => {
            loadAdReviewWorkspace();
        },
        [loadAdReviewWorkspace],
    );

    useEffect(
        () => {
            if (section !== 'adReview' || adReviewLoading) {
                return;
            }

            const currentExists =
                adCampaigns.some((campaign) => campaign.id === selectedAdCampaignId);

            if (!currentExists) {
                const firstPending =
                    adCampaigns.find((campaign) => campaign.status === 'pending_review');

                setSelectedAdCampaignId(firstPending?.id || adCampaigns[0]?.id || '');
            }
        },
        [section, adReviewLoading, adCampaigns, selectedAdCampaignId],
    );

    const metricEntries =
        useMemo(
            () =>
                buildMetricEntries(
                    commandCenter,
                ),
            [commandCenter],
        );
  
    const dataQualitySummary =
        useMemo(
            () => {
                const drafts =
                    dataQualityWorkspace.drafts ||
                    [];

                const directDuplicates =
                    drafts.filter(
                        (draft) =>
                            Boolean(
                                draft?.duplicateCandidateProductVersionId,
                            ),
                    ).length;

                const moreProofNeeded =
                    drafts.filter(
                        (draft) =>
                            draft?.status ===
                            'needs_more_evidence',
                    ).length;

                const bulkIssues =
                    Number(
                        dataQualityWorkspace.batchSummary?.issues ||
                        0,
                    );

                const bulkDuplicates =
                    Number(
                        dataQualityWorkspace.batchSummary?.potentialDuplicates ||
                        0,
                    );

                return {
                    waitingReview:
                        Number(
                            dataQualityWorkspace.draftTotal ||
                            0,
                        ),
                    possibleDuplicates:
                        Math.max(
                            directDuplicates,
                            bulkDuplicates,
                        ),
                    catalogReview:
                        Number(
                            dataQualityWorkspace.versionTotal ||
                            0,
                        ),
                    needsAttention:
                        Math.max(
                            moreProofNeeded,
                            bulkIssues,
                        ),
                };
            },
            [dataQualityWorkspace],
        );

    const dataQualityDuplicateDrafts =
        useMemo(
            () =>
                (dataQualityWorkspace.drafts || [])
                    .filter(
                        (draft) =>
                            Boolean(
                                draft?.duplicateCandidateProductVersionId,
                            ),
                    )
                    .slice(0, 6),
            [dataQualityWorkspace.drafts],
        );

    const dataQualityAttentionBatches =
        useMemo(
            () =>
                (dataQualityWorkspace.batches || [])
                    .filter(
                        (batch) =>
                            Number(
                                batch?.review?.validationIssues ||
                                0,
                            ) > 0 ||
                            Number(
                                batch?.review?.needsEvidence ||
                                0,
                            ) > 0 ||
                            Number(
                                batch?.review?.potentialDuplicates ||
                                0,
                            ) > 0,
                    )
                    .slice(0, 6),
            [dataQualityWorkspace.batches],
        );

    const recipeReviewWorkspace =
        useMemo(
            () => {
                const recipes =
                    Array.isArray(recipeReviewRecipes)
                        ? recipeReviewRecipes
                        : [];

                const waiting =
                    recipes
                        .filter(
                            (item) =>
                                item?.latestVersion?.status === 'in_review',
                        )
                        .sort(
                            (left, right) =>
                                new Date(
                                    right?.latestVersion?.submittedAt ||
                                    right?.latestVersion?.updatedAt ||
                                    0,
                                ).getTime() -
                                new Date(
                                    left?.latestVersion?.submittedAt ||
                                    left?.latestVersion?.updatedAt ||
                                    0,
                                ).getTime(),
                        );

                const foodCheckNeeded =
                    waiting.filter(
                        (item) =>
                            item?.foodIntelligence?.approved !== true,
                    );

                const foodCheckReady =
                    waiting.filter(
                        (item) =>
                            item?.foodIntelligence?.approved === true,
                    );

                const published =
                    recipes.filter(
                        (item) =>
                            item?.latestVersion?.status === 'published',
                    );

                const drafts =
                    recipes.filter(
                        (item) =>
                            item?.latestVersion?.status === 'draft',
                    );

                const recent =
                    [...recipes]
                        .sort(
                            (left, right) =>
                                new Date(
                                    right?.latestVersion?.updatedAt ||
                                    right?.dish?.updatedAt ||
                                    0,
                                ).getTime() -
                                new Date(
                                    left?.latestVersion?.updatedAt ||
                                    left?.dish?.updatedAt ||
                                    0,
                                ).getTime(),
                        )
                        .slice(0, 10);

                return {
                    recipes,
                    waiting,
                    foodCheckNeeded,
                    foodCheckReady,
                    published,
                    drafts,
                    recent,
                };
            },
            [recipeReviewRecipes],
        );


    const selectedOrder =
        useMemo(
            () =>
                (ordersWorkspace.orders || []).find(
                    (item) => item.id === selectedOrderId,
                ) || null,
            [ordersWorkspace.orders, selectedOrderId],
        );

    const orderDisputeCases =
        useMemo(
            () =>
                (reviewCases || []).filter(
                    (item) => item?.caseType === 'marketplace_dispute',
                ),
            [reviewCases],
        );

    const visibleOrderDisputeCases =
        showAllOrderCases
            ? orderDisputeCases
            : orderDisputeCases.slice(0, 10);

    const selectedOrderCase =
        selectedOrder
            ? orderDisputeCases.find(
                (item) =>
                    item?.entity?.type === 'seller_order' &&
                    item?.entity?.id === selectedOrder.id &&
                    !['resolved', 'dismissed'].includes(item?.status),
            ) || null
            : null;


    const selectedFinanceSettlement =
        useMemo(
            () =>
                financeSettlements.find(
                    (item) => item?.id === selectedFinanceSettlementId,
                ) || null,
            [financeSettlements, selectedFinanceSettlementId],
        );

    const selectedIntegration =
        useMemo(
            () =>
                (integrationWorkspace.webhooks || []).find(
                    (item) => item.id === selectedIntegrationId,
                ) || null,
            [integrationWorkspace.webhooks, selectedIntegrationId],
        );

    const integrationReviewCases =
        useMemo(
            () =>
                (reviewCases || []).filter(
                    (item) =>
                        item?.caseType === 'integration_failure' ||
                        item?.entity?.type === 'organization_webhook',
                ),
            [reviewCases],
        );

    const visibleIntegrationCases =
        showAllIntegrationCases
            ? integrationReviewCases
            : integrationReviewCases.slice(0, 10);

    const selectedIntegrationCase =
        selectedIntegration
            ? integrationReviewCases.find(
                (item) =>
                    item?.entity?.type === 'organization_webhook' &&
                    item?.entity?.id === selectedIntegration.id &&
                    !['resolved', 'dismissed'].includes(item?.status),
            ) || null
            : null;

    const canMutateSelectedSafetyRecord = (record) => {
        if (!record || section !== 'trustSafety') return canMutateDomain;
        const domain = record.domain || 'trust_safety';
        const editPermissions = {
            trust_safety: ['trust_safety.mutate'],
            catalog: ['catalog.mutate', 'catalog.publish'],
            recipe: ['recipe.mutate', 'recipe.publish'],
            marketplace: ['marketplace.mutate'],
            finance: ['finance.mutate'],
            cms: ['cms.mutate', 'cms.publish'],
        };
        return domain === 'admin'
            ? isRootSuperAdmin
            : (editPermissions[domain] || []).some(hasAdminPermission);
    };

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
  

    if (section === 'adReview') {
        const refreshing = loading || adReviewLoading;
        const canReviewAds =
            isRootSuperAdmin &&
            hasAdminPermission('trust_safety.mutate');

        const money = (amountMinor, currency = 'INR') => {
            const amount = Number(amountMinor || 0) / 100;

            try {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency,
                    maximumFractionDigits: 0,
                }).format(amount);
            } catch {
                return `₹${amount.toLocaleString('en-IN')}`;
            }
        };

        const shortDate = (value) => {
            if (!value) return 'Not set';

            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return 'Not set';

            return parsed.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
        };

        const statusLabel = (value) => {
            const labels = {
                pending_review: 'Waiting for review',
                approved: 'Approved',
                active: 'Live',
                paused: 'Paused',
                rejected: 'Rejected',
                ended: 'Ended',
                unpaid: 'Payment pending',
                initiated: 'Payment started',
                paid: 'Paid',
            };

            return labels[value] || titleize(value);
        };

        const statusTone = (value) => {
            if (['approved', 'active', 'paid'].includes(value)) {
                return 'border-emerald-200 bg-emerald-50 text-emerald-800';
            }

            if (['pending_review', 'initiated'].includes(value)) {
                return 'border-[#c8d8e5] bg-[#eef5fa] text-[#315f7a]';
            }

            if (value === 'rejected') {
                return 'border-rose-200 bg-rose-50 text-rose-700';
            }

            return 'border-stone-200 bg-stone-50 text-stone-600';
        };

        const pendingCampaigns =
            adCampaigns.filter((campaign) => campaign.status === 'pending_review');

        const paidPendingCampaigns =
            pendingCampaigns.filter((campaign) => campaign.payment?.status === 'paid');

        const liveOrApprovedCampaigns =
            adCampaigns.filter((campaign) => ['approved', 'active'].includes(campaign.status));

        const visibleCampaigns =
            adQueueView === 'review'
                ? pendingCampaigns
                : adCampaigns;

        const selectedAdCampaign =
            adCampaigns.find((campaign) => campaign.id === selectedAdCampaignId) ||
            null;

        const selectedInVisibleQueue =
            selectedAdCampaign &&
            visibleCampaigns.some((campaign) => campaign.id === selectedAdCampaign.id)
                ? selectedAdCampaign
                : visibleCampaigns[0] || null;

        const selectedCampaign = selectedInVisibleQueue;

        const selectCampaign = (campaign) => {
            setSelectedAdCampaignId(campaign?.id || '');
            setAdReviewReason('');
            setAdEvidenceRef(
                campaign?.title
                    ? `Campaign brief: ${campaign.title}`
                    : 'Campaign brief',
            );
        };

        const reviewCampaign = async (decision) => {
            if (!selectedCampaign || adReviewReason.trim().length < 10) {
                return;
            }

            setBusy(true);
            setError('');
            setNotice('');

            try {
                await reviewAdminRetailMediaCampaign({
                    campaignId: selectedCampaign.id,
                    decision,
                    reason: adReviewReason.trim(),
                    evidenceRefs: [
                        adEvidenceRef.trim() || `Campaign brief: ${selectedCampaign.title}`,
                    ],
                });

                setNotice(
                    decision === 'approve'
                        ? 'Campaign approved.'
                        : 'Campaign rejected.',
                );
                setAdReviewReason('');
                await Promise.all([
                    loadAdReviewWorkspace(),
                    load(),
                ]);
            } catch (requestError) {
                setError(
                    getRetailMediaErrorMessage(
                        requestError,
                        'Unable to save the campaign decision.',
                    ),
                );
            } finally {
                setBusy(false);
            }
        };

        const queueLabel = (campaign) =>
            campaign?.organizationName ||
            campaign?.brandName ||
            'Host business';

        const placementLabel = (value) =>
            ({
                home: 'Homepage',
                search: 'Search',
                recipe: 'Recipes',
                product_detail: 'Product pages',
                pantry_replenishment: 'Pantry reminders',
                basket_compare: 'Basket compare',
                post_purchase: 'After purchase',
            }[value] || titleize(value));

        const genericFollowUpCount =
            reviewCases.length + incidents.length + supportCases.length;

        const refreshAdPage = () => {
            load();
            loadAdReviewWorkspace();
        };

        return (
            <AdminShell
                title="Ads & Promotions Review"
                description="Review paid campaigns before they can run on EPANTRY."
                actions={
                    <button
                        type="button"
                        onClick={refreshAdPage}
                        disabled={refreshing}
                        className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw
                            size={14}
                            className={refreshing ? 'animate-spin' : ''}
                            aria-hidden="true"
                        />
                        Refresh
                    </button>
                }
            >
                <div className="overflow-hidden bg-[#f5f4f1] pb-7 sm:pb-9">
                    <section className="border-b border-[#26384c] bg-[#233247] text-white">
                        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
                            <div className="px-4 py-4 sm:px-7 sm:py-6">
                                <p className="text-[11px] font-bold text-[#b8c9dc] sm:text-xs">Ad review workspace</p>
                                <h2 className="mt-1 max-w-3xl text-[22px] font-black leading-[1.08] sm:text-[31px]">
                                    Check the campaign. Confirm payment. Make the decision.
                                </h2>
                                <p className="mt-2 line-clamp-2 max-w-2xl text-xs font-semibold leading-5 text-white/70 sm:hidden">
                                    Review the ad customers may see, then approve or reject it.
                                </p>
                                <p className="mt-2 hidden max-w-2xl text-sm font-semibold leading-6 text-white/70 sm:block">
                                    Open a paid campaign, check the creative and disclosure, then record the Super Admin decision.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-t border-white/12 p-3 sm:gap-3 sm:p-5 lg:border-l lg:border-t-0">
                                {[
                                    ['Waiting', pendingCampaigns.length, 'bg-[#31445d]'],
                                    ['Paid & ready', paidPendingCampaigns.length, 'bg-[#315467]'],
                                    ['Approved / live', liveOrApprovedCampaigns.length, 'bg-[#4b426a]'],
                                ].map(([label, value, tone]) => (
                                    <div key={label} className={`rounded-2xl border border-white/10 px-3 py-3 ${tone}`}>
                                        <p className="text-xl font-black sm:text-2xl">{value}</p>
                                        <p className="mt-1 text-[9px] font-bold leading-4 text-white/65 sm:text-[11px]">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 border-t border-white/12 lg:grid-cols-4">
                            {[
                                ['01', 'Choose campaign', 'Open the campaign that needs a decision.'],
                                ['02', 'Check the ad', 'Read the headline, message and landing destination.'],
                                ['03', 'Confirm payment', 'Make sure payment and sponsorship disclosure are ready.'],
                                ['04', 'Approve or reject', 'Save a clear reason for the decision.'],
                            ].map(([number, title, copy], index) => (
                                <div
                                    key={number}
                                    className={`px-4 py-3 sm:px-6 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/12' : ''} ${index >= 2 ? 'border-t border-white/12 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-white/12' : ''}`}
                                >
                                    <p className="text-[10px] font-black text-[#9fc2d7]">{number}</p>
                                    <p className="mt-1 text-sm font-black">{title}</p>
                                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-white/65 sm:text-xs sm:leading-5">{copy}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {adReviewError ? (
                        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 sm:px-7 sm:text-sm">
                            {adReviewError}
                        </div>
                    ) : null}

                    {error ? (
                        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 sm:px-7 sm:text-sm">
                            {error}
                        </div>
                    ) : null}

                    {notice ? (
                        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 sm:px-7 sm:text-sm">
                            {notice}
                        </div>
                    ) : null}

                    <section className="border-b border-stone-200 bg-white">
                        <div className="flex flex-col gap-3 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
                            <div>
                                <p className="text-[10px] font-bold text-[#315f7a]">Campaign review</p>
                                <h2 className="mt-0.5 text-lg font-black text-stone-950">Campaigns that need a decision</h2>
                            </div>

                            <div className="inline-flex w-fit rounded-xl border border-stone-200 bg-[#f3f4f5] p-1">
                                <button
                                    type="button"
                                    onClick={() => setAdQueueView('review')}
                                    className={`rounded-lg px-3 py-2 text-xs font-black ${adQueueView === 'review' ? 'bg-[#22384f] text-white' : 'text-stone-600'}`}
                                >
                                    Needs review ({pendingCampaigns.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAdQueueView('all')}
                                    className={`rounded-lg px-3 py-2 text-xs font-black ${adQueueView === 'all' ? 'bg-[#22384f] text-white' : 'text-stone-600'}`}
                                >
                                    All campaigns ({adCampaigns.length})
                                </button>
                            </div>
                        </div>

                        {adReviewLoading ? (
                            <div className="flex min-h-[220px] items-center justify-center gap-2 px-4 py-8 text-sm font-semibold text-stone-600">
                                <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                                Loading campaigns…
                            </div>
                        ) : visibleCampaigns.length === 0 ? (
                            <div className="px-4 py-6 sm:px-7 sm:py-8">
                                <p className="text-sm font-black text-stone-900">
                                    {adQueueView === 'review' ? 'No campaigns need review right now.' : 'No ad campaigns have been created yet.'}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">
                                    {adQueueView === 'review' && adCampaigns.length
                                        ? 'Approved, live and past campaigns are available under All campaigns.'
                                        : 'Paid Host campaigns will appear here when they are ready for Super Admin review.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
                                <aside className="border-b border-stone-200 bg-[#f8f7f4] lg:border-b-0 lg:border-r">
                                    <div className="px-4 py-3 sm:hidden">
                                        <label className="text-xs font-bold text-stone-600">
                                            Choose campaign
                                            <select
                                                value={selectedCampaign?.id || ''}
                                                onChange={(event) => {
                                                    const campaign = visibleCampaigns.find((item) => item.id === event.target.value);
                                                    if (campaign) selectCampaign(campaign);
                                                }}
                                                className={`${inputClass} mt-2`}
                                            >
                                                {visibleCampaigns.map((campaign) => (
                                                    <option key={campaign.id} value={campaign.id}>
                                                        {campaign.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>

                                    <div className="hidden max-h-[680px] overflow-y-auto sm:block">
                                        {visibleCampaigns.map((campaign, index) => {
                                            const active = campaign.id === selectedCampaign?.id;

                                            return (
                                                <button
                                                    key={campaign.id}
                                                    type="button"
                                                    onClick={() => selectCampaign(campaign)}
                                                    className={`block w-full border-b border-stone-200 px-4 py-3 text-left transition sm:px-5 ${active ? 'bg-[#eaf2f8]' : 'bg-[#f8f7f4] hover:bg-white'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-stone-950">{campaign.title}</p>
                                                            <p className="mt-0.5 truncate text-xs font-semibold text-stone-500">{queueLabel(campaign)}</p>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${statusTone(campaign.status)}`}>
                                                            {statusLabel(campaign.status)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-[11px] font-bold text-stone-500">
                                                        {campaign.placements?.length || 0} placements · {statusLabel(campaign.payment?.status)}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </aside>

                                <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5">
                                    {selectedCampaign ? (
                                        <>
                                            <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusTone(selectedCampaign.status)}`}>
                                                            {statusLabel(selectedCampaign.status)}
                                                        </span>
                                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusTone(selectedCampaign.payment?.status)}`}>
                                                            {statusLabel(selectedCampaign.payment?.status)}
                                                        </span>
                                                    </div>
                                                    <h3 className="mt-2 text-xl font-black text-stone-950 sm:text-2xl">{selectedCampaign.title}</h3>
                                                    <p className="mt-1 text-xs font-semibold text-stone-500 sm:text-sm">
                                                        {selectedCampaign.organizationName || 'Host business'}
                                                        {selectedCampaign.brandName ? ` · ${selectedCampaign.brandName}` : ''}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-black text-[#315f7a]">
                                                    {money(selectedCampaign.payment?.requiredAmountMinor, selectedCampaign.payment?.currency)}
                                                </p>
                                            </div>

                                            <div className="grid border-b border-stone-200 sm:grid-cols-4">
                                                {[
                                                    ['Goal', titleize(selectedCampaign.objective)],
                                                    ['Market', selectedCampaign.marketCodes?.join(', ') || 'Not set'],
                                                    ['Starts', shortDate(selectedCampaign.startsAt)],
                                                    ['Ends', shortDate(selectedCampaign.endsAt)],
                                                ].map(([label, value], index) => (
                                                    <div key={label} className={`py-3 ${index > 0 ? 'sm:border-l sm:border-stone-200 sm:pl-4' : 'sm:pr-4'}`}>
                                                        <p className="text-[10px] font-bold text-stone-400">{label}</p>
                                                        <p className="mt-1 line-clamp-2 text-xs font-black leading-5 text-stone-800 sm:text-sm">{value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="grid gap-0 border-b border-stone-200 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                                                <div className="py-4 lg:pr-6">
                                                    <p className="text-[10px] font-bold text-[#5b4b85]">Ad customers may see</p>
                                                    <div className="mt-2 rounded-2xl border border-[#d9d3e7] bg-[#f5f2fb] p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-[#5b4b85] shadow-sm">
                                                                {selectedCampaign.creative?.sponsorLabel || 'Sponsored'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-stone-500">
                                                                {selectedCampaign.placements?.length || 0} placements
                                                            </span>
                                                        </div>
                                                        <h4 className="mt-3 text-lg font-black text-stone-950">{selectedCampaign.creative?.headline || selectedCampaign.title}</h4>
                                                        {selectedCampaign.creative?.body ? (
                                                            <p className="mt-1.5 line-clamp-3 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">{selectedCampaign.creative.body}</p>
                                                        ) : null}
                                                        <p className="mt-3 break-all text-[11px] font-bold text-[#315f7a]">{selectedCampaign.creative?.landingRef || 'No landing destination provided'}</p>
                                                    </div>
                                                </div>

                                                <div className="border-t border-stone-200 py-4 lg:border-l lg:border-t-0 lg:pl-6">
                                                    <p className="text-[10px] font-bold text-[#315f7a]">Review checks</p>
                                                    <div className="mt-2 divide-y divide-stone-200">
                                                        <div className="flex items-center justify-between gap-4 py-2.5">
                                                            <span className="text-xs font-semibold text-stone-500">Payment</span>
                                                            <span className="text-xs font-black text-stone-900">{statusLabel(selectedCampaign.payment?.status)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 py-2.5">
                                                            <span className="text-xs font-semibold text-stone-500">Disclosure</span>
                                                            <span className="max-w-[65%] text-right text-xs font-black text-stone-900">{selectedCampaign.commercialDisclosure || 'Not provided'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 py-2.5">
                                                            <span className="text-xs font-semibold text-stone-500">Placements</span>
                                                            <span className="max-w-[65%] text-right text-xs font-black text-stone-900">{selectedCampaign.placements?.map(placementLabel).join(', ') || 'Not selected'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 py-2.5">
                                                            <span className="text-xs font-semibold text-stone-500">Frequency</span>
                                                            <span className="text-xs font-black text-stone-900">Up to {selectedCampaign.frequencyCapPerContext || 1} times</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedCampaign.status === 'pending_review' ? (
                                                <div className="pt-4">
                                                    {selectedCampaign.payment?.status !== 'paid' ? (
                                                        <div className="mb-3 flex items-start gap-2 border-l-2 border-[#d69c4c] bg-[#fbf6ee] px-3 py-2.5 text-xs font-bold text-[#7a5525]">
                                                            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                                                            Payment is not complete yet. You can reject the campaign, but approval becomes available after payment.
                                                        </div>
                                                    ) : null}

                                                    {canReviewAds ? (
                                                        <div className="grid gap-3">
                                                            <textarea
                                                                value={adReviewReason}
                                                                onChange={(event) => setAdReviewReason(event.target.value)}
                                                                rows={3}
                                                                placeholder="Why are you approving or rejecting this campaign?"
                                                                className={inputClass}
                                                            />
                                                            <input
                                                                value={adEvidenceRef}
                                                                onChange={(event) => setAdEvidenceRef(event.target.value)}
                                                                placeholder="Evidence / reference"
                                                                className={inputClass}
                                                            />
                                                            <div className="flex flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={busy || adReviewReason.trim().length < 10 || selectedCampaign.payment?.status !== 'paid'}
                                                                    onClick={() => reviewCampaign('approve')}
                                                                    className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#294f68] px-4 text-xs font-black text-white disabled:opacity-40"
                                                                >
                                                                    <CheckCircle2 size={15} aria-hidden="true" />
                                                                    Approve campaign
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={busy || adReviewReason.trim().length < 10}
                                                                    onClick={() => reviewCampaign('reject')}
                                                                    className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-700 disabled:opacity-40"
                                                                >
                                                                    <XCircle size={15} aria-hidden="true" />
                                                                    Reject campaign
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs font-semibold text-stone-500">You can review this campaign, but only an authorised Super Admin can record the final decision.</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="pt-4">
                                                    <p className="text-sm font-black text-stone-900">Decision recorded</p>
                                                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">
                                                        {selectedCampaign.review?.reason || `This campaign is ${statusLabel(selectedCampaign.status).toLowerCase()}.`}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="border-b border-stone-200 bg-[#f0f3f6]">
                        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
                            <div className="border-b border-stone-200 px-4 py-4 sm:px-7 sm:py-5 lg:border-b-0 lg:border-r">
                                <p className="text-[10px] font-bold text-[#5b4b85]">Recent serving decisions</p>
                                <h2 className="mt-1 text-lg font-black text-stone-950">What the ad system decided recently</h2>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">Recent sponsored-placement outcomes stay visible for review.</p>
                            </div>

                            <div className="bg-white/75 px-4 sm:px-7">
                                {adDecisionLogs.length === 0 ? (
                                    <div className="py-5">
                                        <p className="text-sm font-black text-stone-900">No serving decisions recorded yet.</p>
                                    </div>
                                ) : (
                                    adDecisionLogs.slice(0, 8).map((log, index) => (
                                        <div key={log.id || `${log.campaignId}-${index}`} className={`grid gap-1 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4 ${index > 0 ? 'border-t border-stone-200' : ''}`}>
                                            <div>
                                                <p className="text-sm font-black text-stone-900">{placementLabel(log.placement)}</p>
                                                <p className="mt-0.5 text-xs font-semibold text-stone-500">{log.marketCode || 'IN'} · {titleize(log.promotedEntityType)}</p>
                                            </div>
                                            <p className="text-xs font-semibold text-stone-600">{(log.reasonCodes || []).map(titleize).join(', ') || 'No extra note'}</p>
                                            <span className="text-xs font-black text-[#315f7a]">{titleize(log.outcome)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </section>

                    <details className="border-b border-stone-200 bg-[#eceeea]">
                        <summary className="cursor-pointer list-none px-4 py-4 sm:px-7">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-500">Other admin follow-up</p>
                                    <p className="mt-0.5 text-sm font-black text-stone-900">Marketplace cases and platform signals</p>
                                </div>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-stone-600 shadow-sm">{genericFollowUpCount} open items</span>
                            </div>
                        </summary>

                        <div className="border-t border-stone-200 bg-white px-4 py-4 sm:px-7 sm:py-5">
                            <div className="grid gap-4 sm:grid-cols-3">
                                {[
                                    ['Review cases', reviewCases],
                                    ['Incidents', incidents],
                                    ['Support cases', supportCases],
                                ].map(([label, items]) => (
                                    <div key={label} className="border-l-2 border-[#c8d7e3] pl-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-black text-stone-900">{label}</p>
                                            <span className="text-xs font-black text-[#315f7a]">{items.length}</span>
                                        </div>
                                        {items.length ? (
                                            <div className="mt-2 space-y-2">
                                                {items.slice(0, 4).map((item) => (
                                                    <div key={item.id} className="border-t border-stone-100 pt-2 first:border-t-0 first:pt-0">
                                                        <p className="line-clamp-1 text-xs font-black text-stone-800">{item.summary || item.title || item.caseKey || item.incidentKey || item.supportKey || 'Admin item'}</p>
                                                        <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-stone-500">{titleize(item.status)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-2 text-xs font-semibold text-stone-400">Nothing open.</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <details className="mt-4 border-t border-stone-200 pt-3">
                                <summary className="cursor-pointer text-xs font-black text-stone-600">Other platform counts</summary>
                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {metricEntries.map(([label, value]) => (
                                        <div key={label} className="rounded-xl border border-stone-200 bg-[#f8f7f4] px-3 py-2.5">
                                            <p className="text-lg font-black text-stone-900">{value ?? 0}</p>
                                            <p className="mt-0.5 line-clamp-2 text-[10px] font-bold text-stone-500">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    </details>
                </div>
            </AdminShell>
        );
    }

    if (section === 'cms') {
        const refreshing = loading || cmsLoading;
        const collectionItems =
            Array.isArray(cmsWorkspace[cmsCollection])
                ? cmsWorkspace[cmsCollection]
                : [];

        const collectionDefinitions = [
            {
                value: 'grocery',
                label: 'Grocery',
                count: cmsWorkspace.grocery.length,
                managePath: '/admin/catalog',
                description: 'Published products currently feeding the homepage.',
            },
            {
                value: 'brands',
                label: 'Brands',
                count: cmsWorkspace.brands.length,
                managePath: '/admin/brands',
                description: 'Brands currently available to the homepage collection.',
            },
            {
                value: 'recipes',
                label: 'Recipes',
                count: cmsWorkspace.recipes.length,
                managePath: '/admin/recipes',
                description: 'Published recipes currently available to the homepage.',
            },
        ];

        const selectedCollection =
            collectionDefinitions.find((item) => item.value === cmsCollection) ||
            collectionDefinitions[0];

        const liveItemCount =
            cmsWorkspace.grocery.length +
            cmsWorkspace.brands.length +
            cmsWorkspace.recipes.length;

        const openCmsWork =
            reviewCases.filter((item) => !['resolved', 'dismissed', 'closed'].includes(item?.status)).length +
            incidents.filter((item) => !['resolved', 'closed'].includes(item?.status)).length +
            supportCases.filter((item) => !['resolved', 'closed'].includes(item?.status)).length;

        const cmsItemTitle = (item) =>
            item?.name ||
            item?.displayName ||
            item?.title ||
            'Unnamed item';

        const cmsItemMeta = (item) => {
            if (cmsCollection === 'grocery') {
                return [
                    item?.brand,
                    item?.subCategory,
                    item?.quantity != null
                        ? `${item.quantity}${item?.unit ? ` ${item.unit}` : ''}`
                        : '',
                ]
                    .filter(Boolean)
                    .join(' · ');
            }

            if (cmsCollection === 'brands') {
                const count = Number(item?.productCount || 0);
                return `${count} ${count === 1 ? 'listed product' : 'listed products'}`;
            }

            return [
                item?.cuisine,
                item?.dietaryType,
                item?.servings != null ? `${item.servings} servings` : '',
            ]
                .filter(Boolean)
                .join(' · ');
        };

        const activitySelection =
            selectedReviewCase
                ? { type: 'review', item: selectedReviewCase }
                : selectedIncident
                    ? { type: 'incident', item: selectedIncident }
                    : selectedSupportCase
                        ? { type: 'support', item: selectedSupportCase }
                        : null;

        const refreshCmsPage = () => {
            load();
            loadCmsWorkspace();
        };

        const chooseCmsActivity = (type, item) => {
            setSelectedReviewCase(type === 'review' ? item : null);
            setSelectedIncident(type === 'incident' ? item : null);
            setSelectedSupportCase(type === 'support' ? item : null);
            setReason('');
            setEvidenceLabel('');
            setEvidenceReferenceId('');
        };

        const cmsActivityTitle = (type, item) => {
            if (type === 'review') {
                return item?.summary || item?.caseKey || 'CMS review';
            }

            if (type === 'incident') {
                return item?.title || item?.incidentKey || 'CMS incident';
            }

            return item?.title || item?.supportKey || 'CMS support case';
        };

        const cmsActivityDescription = (type, item) => {
            if (type === 'review') {
                return item?.details || item?.entity?.label || 'Content change waiting for review.';
            }

            if (type === 'incident') {
                return item?.summary || 'Homepage issue being tracked.';
            }

            return item?.description || 'CMS support work being tracked.';
        };

        const completeCmsReview = async () => {
            if (!selectedReviewCase || reason.trim().length < 5) {
                return;
            }

            const result = await run(
                () =>
                    decideAdminReviewCase(
                        selectedReviewCase.id,
                        {
                            decision: 'resolve',
                            reason: reason.trim(),
                            evidence: evidence(),
                        },
                    ),
                'CMS review resolved.',
            );

            if (result) {
                setSelectedReviewCase(null);
                setReason('');
            }
        };

        const updateCmsIncident = async (status) => {
            if (!selectedIncident || reason.trim().length < 3) {
                return;
            }

            const result = await run(
                () =>
                    updateAdminIncident(
                        selectedIncident.id,
                        {
                            status,
                            bannerEnabled: status === 'resolved' ? false : selectedIncident.bannerEnabled,
                            reason: reason.trim(),
                            evidence: evidence(),
                        },
                    ),
                status === 'resolved'
                    ? 'CMS incident resolved.'
                    : 'CMS incident moved to monitoring.',
            );

            if (result) {
                setSelectedIncident(null);
                setReason('');
            }
        };

        const updateCmsSupport = async (status) => {
            if (!selectedSupportCase || reason.trim().length < 3) {
                return;
            }

            const result = await run(
                () =>
                    updateAdminSupportCase(
                        selectedSupportCase.id,
                        {
                            status,
                            reason: reason.trim(),
                            evidence: evidence(),
                        },
                    ),
                status === 'resolved'
                    ? 'CMS support case resolved.'
                    : 'CMS support work started.',
            );

            if (result) {
                setSelectedSupportCase(null);
                setReason('');
            }
        };

        const renderCmsRows = (items) =>
            items.map((item, index) => (
                <div
                    key={item?.id || item?.slug || `${cmsCollection}-${index}`}
                    className={`flex items-center justify-between gap-4 py-3 ${index > 0 ? 'border-t border-stone-200' : ''}`}
                >
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-stone-950">
                            {cmsItemTitle(item)}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">
                            {cmsItemMeta(item) || 'Published and available to the homepage.'}
                        </p>
                    </div>

                    <Link
                        to={selectedCollection.managePath}
                        className="focus-ring shrink-0 rounded-lg border border-[#c8d7e3] bg-white px-3 py-2 text-[11px] font-black text-[#294f68]"
                    >
                        Manage
                    </Link>
                </div>
            ));

        return (
            <AdminShell
                title="Home Content"
                description="See what is live on the homepage, open the right source, and review CMS changes."
                actions={
                    <button
                        type="button"
                        onClick={refreshCmsPage}
                        disabled={refreshing}
                        className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw
                            size={14}
                            className={refreshing ? 'animate-spin' : ''}
                            aria-hidden="true"
                        />
                        Refresh
                    </button>
                }
            >
                <div className="overflow-hidden bg-[#f6f4ef] pb-7 sm:pb-9">
                    <section className="border-b border-[#203b52] bg-[#1d3550] text-white">
                        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
                            <div className="px-4 py-5 sm:px-7 sm:py-7">
                                <p className="text-[11px] font-bold text-[#b9d6e8] sm:text-xs">Homepage workspace</p>
                                <h2 className="mt-1.5 max-w-3xl text-[23px] font-black leading-[1.08] sm:text-[32px]">
                                    See what is live. Change the source. Confirm the result.
                                </h2>
                                <p className="mt-2 line-clamp-2 max-w-2xl text-xs font-semibold leading-5 text-white/70 sm:hidden">
                                    Published Grocery, Brand and Recipe records feed the homepage.
                                </p>
                                <p className="mt-2 hidden max-w-2xl text-sm font-semibold leading-6 text-white/70 sm:block">
                                    Homepage collections are built from published Grocery, Brand and Recipe records. Open the source record when something needs to change.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-px border-t border-white/15 bg-white/15 lg:border-l lg:border-t-0">
                                {[
                                    ['Live items', liveItemCount],
                                    ['CMS reviews', reviewCases.length],
                                    ['Open issues', openCmsWork],
                                ].map(([label, value]) => (
                                    <div key={label} className="bg-[#25445d] px-3 py-4 sm:px-4 sm:py-5">
                                        <p className="text-xl font-black sm:text-2xl">{value}</p>
                                        <p className="mt-1 text-[9px] font-bold leading-4 text-white/60 sm:text-[11px]">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
                            {[
                                ['01', 'Check homepage', 'See the content customers can open now.'],
                                ['02', 'Open the source', 'Update the product, brand or recipe record.'],
                                ['03', 'Review changes', 'Handle any CMS review or issue that needs action.'],
                                ['04', 'Confirm live', 'Refresh and make sure the homepage looks right.'],
                            ].map(([number, title, body], index) => (
                                <div
                                    key={number}
                                    className={`px-4 py-3 sm:px-5 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-white/15' : ''}`}
                                >
                                    <p className="text-[10px] font-black text-[#9fc8df] sm:text-xs">{number}</p>
                                    <p className="mt-1 text-sm font-black">{title}</p>
                                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-white/65 sm:text-xs sm:leading-5">{body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {cmsError || error ? (
                        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:px-7 sm:text-sm">
                            {cmsError || error}
                        </div>
                    ) : null}

                    {notice ? (
                        <div className="border-b border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-800 sm:px-7 sm:text-sm">
                            {notice}
                        </div>
                    ) : null}

                    <section className="border-b border-stone-200 bg-white">
                        <div className="border-b border-stone-200 px-4 py-4 sm:px-7 sm:py-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[#315f7a]">Homepage collections</p>
                                    <h2 className="mt-0.5 text-xl font-black text-stone-950">Choose what you want to check</h2>
                                </div>
                                <a
                                    href="/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-[#c8d7e3] bg-[#edf4f8] px-3 text-xs font-black text-[#294f68]"
                                >
                                    View homepage
                                </a>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-3">
                            {collectionDefinitions.map((item, index) => {
                                const active = cmsCollection === item.value;
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => {
                                            setCmsCollection(item.value);
                                            setCmsShowAll(false);
                                        }}
                                        className={`focus-ring flex min-h-[76px] items-center justify-between gap-4 px-4 py-3 text-left sm:px-6 sm:py-4 ${index > 0 ? 'border-t border-stone-200 sm:border-l sm:border-t-0' : ''} ${active ? 'bg-[#e9f1f7] text-[#173b52]' : 'bg-white text-stone-700 hover:bg-stone-50'}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-black">{item.label}</p>
                                            <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 opacity-65 sm:text-xs">{item.description}</p>
                                        </div>
                                        <span className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-full px-2 text-xs font-black ${active ? 'bg-[#173b52] text-white' : 'bg-stone-100 text-stone-600'}`}>
                                            {item.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="border-b border-stone-200 bg-[#fbfaf7]">
                        <div className="flex items-end justify-between gap-4 border-b border-stone-200 px-4 py-3 sm:px-7 sm:py-4">
                            <div>
                                <p className="text-xs font-bold text-[#315f7a]">{selectedCollection.label}</p>
                                <h2 className="mt-0.5 text-lg font-black text-stone-950">Live homepage items</h2>
                            </div>
                            <Link
                                to={selectedCollection.managePath}
                                className="focus-ring shrink-0 text-xs font-black text-[#294f68] underline decoration-[#aac5d5] underline-offset-4"
                            >
                                Open manager
                            </Link>
                        </div>

                        {cmsLoading ? (
                            <div className="flex min-h-28 items-center justify-center gap-2 px-4 py-6 text-sm font-semibold text-stone-500">
                                <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                                Loading homepage content…
                            </div>
                        ) : collectionItems.length === 0 ? (
                            <div className="px-4 py-5 sm:px-7">
                                <p className="text-sm font-black text-stone-900">Nothing is live in this collection yet.</p>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">Publish an eligible record in its source manager, then refresh this page.</p>
                            </div>
                        ) : (
                            <>
                                <div className="px-4 sm:hidden">
                                    {renderCmsRows(cmsShowAll ? collectionItems : collectionItems.slice(0, 6))}
                                </div>
                                <div className="hidden px-7 sm:block">
                                    {renderCmsRows(cmsShowAll ? collectionItems : collectionItems.slice(0, 10))}
                                </div>

                                {collectionItems.length > 6 ? (
                                    <div className="border-t border-stone-200 py-3 text-center sm:hidden">
                                        <button
                                            type="button"
                                            onClick={() => setCmsShowAll((value) => !value)}
                                            className="focus-ring rounded-lg border border-[#c8d7e3] bg-white px-4 py-2 text-xs font-black text-[#294f68]"
                                        >
                                            {cmsShowAll ? 'Show fewer' : `View all ${collectionItems.length}`}
                                        </button>
                                    </div>
                                ) : null}

                                {collectionItems.length > 10 ? (
                                    <div className="hidden border-t border-stone-200 py-3 text-center sm:block">
                                        <button
                                            type="button"
                                            onClick={() => setCmsShowAll((value) => !value)}
                                            className="focus-ring rounded-lg border border-[#c8d7e3] bg-white px-4 py-2 text-xs font-black text-[#294f68]"
                                        >
                                            {cmsShowAll ? 'Show fewer' : `View all ${collectionItems.length}`}
                                        </button>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </section>

                    <section className="border-b border-stone-200 bg-white">
                        <div className="border-b border-stone-200 px-4 py-4 sm:px-7 sm:py-5">
                            <p className="text-xs font-bold text-[#6b558d]">CMS review activity</p>
                            <h2 className="mt-0.5 text-xl font-black text-stone-950">Changes and issues that need admin attention</h2>
                            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">Open an item only when a homepage or CMS change needs a recorded admin decision.</p>
                        </div>

                        <div className="grid lg:grid-cols-3">
                            {[
                                ['review', 'Change reviews', reviewCases],
                                ['incident', 'Homepage issues', incidents],
                                ['support', 'Support work', supportCases],
                            ].map(([type, label, items], groupIndex) => (
                                <div key={type} className={`min-w-0 px-4 py-4 sm:px-6 ${groupIndex > 0 ? 'border-t border-stone-200 lg:border-l lg:border-t-0' : ''}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-black text-stone-900">{label}</p>
                                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black text-stone-600">{items.length}</span>
                                    </div>

                                    {items.length === 0 ? (
                                        <p className="mt-3 text-xs font-semibold text-stone-400">Nothing waiting.</p>
                                    ) : (
                                        <div className="mt-2">
                                            {items.map((item, index) => (
                                                <button
                                                    key={item?.id || `${type}-${index}`}
                                                    type="button"
                                                    onClick={() => chooseCmsActivity(type, item)}
                                                    className={`focus-ring block w-full py-3 text-left ${index > 0 ? 'border-t border-stone-200' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-xs font-black text-stone-900">{cmsActivityTitle(type, item)}</p>
                                                            <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-500">{cmsActivityDescription(type, item)}</p>
                                                        </div>
                                                        <span className="shrink-0 rounded-full bg-[#f0edf7] px-2 py-1 text-[9px] font-black text-[#675184]">{titleize(item?.status)}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {activitySelection ? (
                        <section className="border-b border-stone-200 bg-[#eef3f7] px-4 py-4 sm:px-7 sm:py-5">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
                                <div>
                                    <p className="text-xs font-bold text-[#315f7a]">Selected admin item</p>
                                    <h2 className="mt-1 text-lg font-black text-stone-950">{cmsActivityTitle(activitySelection.type, activitySelection.item)}</h2>
                                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">{cmsActivityDescription(activitySelection.type, activitySelection.item)}</p>
                                    <p className="mt-2 text-[11px] font-bold text-stone-500">Status: {titleize(activitySelection.item?.status)}</p>
                                </div>

                                <div>
                                    <input
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder="Reason for this decision"
                                        className="h-11 w-full rounded-xl border border-[#c8d7e3] bg-white px-3 text-sm font-semibold text-stone-800 outline-none focus:border-[#315f7a]"
                                    />

                                    <details className="mt-2 border-t border-[#c8d7e3] pt-2">
                                        <summary className="cursor-pointer text-[11px] font-black text-stone-600">Add evidence (optional)</summary>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                            <input
                                                value={evidenceLabel}
                                                onChange={(event) => setEvidenceLabel(event.target.value)}
                                                placeholder="Evidence label"
                                                className="h-10 rounded-lg border border-[#c8d7e3] bg-white px-3 text-xs font-semibold text-stone-800 outline-none focus:border-[#315f7a]"
                                            />
                                            <input
                                                value={evidenceReferenceId}
                                                onChange={(event) => setEvidenceReferenceId(event.target.value)}
                                                placeholder="Reference ID"
                                                className="h-10 rounded-lg border border-[#c8d7e3] bg-white px-3 text-xs font-semibold text-stone-800 outline-none focus:border-[#315f7a]"
                                            />
                                        </div>
                                    </details>

                                    {canMutateDomain ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {activitySelection.type === 'review' ? (
                                                <button
                                                    type="button"
                                                    disabled={busy || reason.trim().length < 5}
                                                    onClick={completeCmsReview}
                                                    className="focus-ring rounded-lg bg-[#315f7a] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                                >
                                                    Resolve review
                                                </button>
                                            ) : null}

                                            {activitySelection.type === 'incident' ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={busy || reason.trim().length < 3}
                                                        onClick={() => updateCmsIncident('monitoring')}
                                                        className="focus-ring rounded-lg border border-[#c8d7e3] bg-white px-3 py-2 text-xs font-black text-[#315f7a] disabled:opacity-50"
                                                    >
                                                        Keep monitoring
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy || reason.trim().length < 3}
                                                        onClick={() => updateCmsIncident('resolved')}
                                                        className="focus-ring rounded-lg bg-[#315f7a] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                                    >
                                                        Resolve issue
                                                    </button>
                                                </>
                                            ) : null}

                                            {activitySelection.type === 'support' ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={busy || reason.trim().length < 3}
                                                        onClick={() => updateCmsSupport('in_progress')}
                                                        className="focus-ring rounded-lg border border-[#c8d7e3] bg-white px-3 py-2 text-xs font-black text-[#315f7a] disabled:opacity-50"
                                                    >
                                                        Start work
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy || reason.trim().length < 3}
                                                        onClick={() => updateCmsSupport('resolved')}
                                                        className="focus-ring rounded-lg bg-[#315f7a] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                                    >
                                                        Resolve
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-xs font-semibold text-stone-500">You can review this item, but you cannot change its status.</p>
                                    )}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {metricEntries.length ? (
                        <details className="bg-[#efeee9]">
                            <summary className="cursor-pointer list-none border-b border-stone-200 px-4 py-3 text-xs font-black text-stone-700 sm:px-7">
                                Other admin signals
                            </summary>
                            <div className="grid grid-cols-2 sm:grid-cols-4">
                                {metricEntries.map(([label, value], index) => (
                                    <div
                                        key={label}
                                        className={`px-4 py-3 ${index % 2 === 1 ? 'border-l border-stone-200' : ''} ${index >= 2 ? 'border-t border-stone-200 sm:border-t-0' : ''} ${index > 0 ? 'sm:border-l sm:border-stone-200' : ''}`}
                                    >
                                        <p className="text-lg font-black text-stone-900">{value ?? 0}</p>
                                        <p className="mt-0.5 text-[10px] font-bold text-stone-500">{USER_METRIC_LABELS[label] || label}</p>
                                    </div>
                                ))}
                            </div>
                        </details>
                    ) : null}
                </div>
            </AdminShell>
        );
    }


    if (section === 'orders') {
        const summary = ordersWorkspace.summary || {};
        const refreshing = loading || ordersLoading;

        const refreshOrdersPage = () => {
            load();
            loadOrdersWorkspace();
        };

        const createDisputeForSelectedOrder = async () => {
            if (!selectedOrder || reason.trim().length < 5) {
                return;
            }

            const itemLabel =
                selectedOrder.itemNames?.[0] ||
                selectedOrder.sellerName ||
                'Order';

            const result = await run(
                () =>
                    createAdminReviewCase({
                        domain: 'marketplace',
                        caseType: 'marketplace_dispute',
                        entity: {
                            type: 'seller_order',
                            id: selectedOrder.id,
                            label: itemLabel,
                        },
                        severity: 'medium',
                        priority: 'p2',
                        summary: `${orderIssueLabel(selectedOrder.status)} — ${itemLabel}`,
                        details: reason.trim(),
                        evidence: [],
                    }),
                'Dispute review started.',
            );

            if (result?.reviewCase) {
                setSelectedReviewCase(result.reviewCase);
            }
        };

        const decideSelectedOrderCase = async (decision) => {
            if (!selectedReviewCase || reason.trim().length < 5) {
                return;
            }

            const result = await run(
                () =>
                    decideAdminReviewCase(
                        selectedReviewCase.id,
                        {
                            decision,
                            reason: reason.trim(),
                            evidence: evidence(),
                        },
                    ),
                decision === 'resolve'
                    ? 'Dispute resolved.'
                    : decision === 'dismiss'
                        ? 'Dispute closed without action.'
                        : 'Dispute marked for follow-up.',
            );

            if (result) {
                setSelectedReviewCase(null);
                setReason('');
            }
        };

        return (
            <AdminShell
                title="Orders & Disputes"
                description="Review order problems and coordinate disputes without changing the recorded order history."
                actions={
                    <button
                        type="button"
                        onClick={refreshOrdersPage}
                        disabled={refreshing}
                        className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw
                            size={14}
                            className={refreshing ? 'animate-spin' : ''}
                            aria-hidden="true"
                        />
                        Refresh
                    </button>
                }
            >
                <div className="min-h-[100svh] bg-[#f6f4ee]">
                    <section className="border-b border-[#0d332b] bg-[#123e32] text-white">
                        <div className="grid lg:grid-cols-[minmax(0,1fr)_460px]">
                            <div className="px-4 py-5 sm:px-7 sm:py-7">
                                <p className="text-xs font-bold text-emerald-200">Order support workspace</p>
                                <h2 className="mt-1.5 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
                                    Fix order problems with a clear review trail.
                                </h2>
                                <p className="mt-2 line-clamp-2 max-w-2xl text-xs font-semibold leading-5 text-emerald-50/80 sm:hidden">
                                    Check the order, open a dispute when needed, then record the decision.
                                </p>
                                <p className="mt-2 hidden max-w-2xl text-sm font-semibold leading-6 text-emerald-50/80 sm:block">
                                    Use this page for failed deliveries, returns, unavailable items and replacement requests that need Super Admin attention.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 border-t border-white/15 lg:border-l lg:border-t-0">
                                {[
                                    ['Open issues', summary.total || 0],
                                    ['Delivery failed', summary.deliveryFailed || 0],
                                    ['Returns', summary.returnsRequested || 0],
                                    ['Item changes', (summary.itemsUnavailable || 0) + (summary.substitutionsRequested || 0)],
                                ].map(([label, value], index) => (
                                    <div
                                        key={label}
                                        className={`px-4 py-3 sm:px-5 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15' : ''}`}
                                    >
                                        <p className="text-xl font-black sm:text-2xl">{value}</p>
                                        <p className="mt-0.5 text-[10px] font-semibold text-emerald-100 sm:text-xs">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
                            {[
                                ['01', 'Find the issue', 'Open an order that needs attention.'],
                                ['02', 'Check the order', 'Review the Host, items and current status.'],
                                ['03', 'Open a dispute', 'Start a case when an admin decision is needed.'],
                                ['04', 'Record the outcome', 'Resolve, close or send the case for follow-up.'],
                            ].map(([number, title, body], index) => (
                                <div
                                    key={number}
                                    className={`px-4 py-3 sm:px-5 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-white/15' : ''}`}
                                >
                                    <p className="text-[10px] font-black text-emerald-200 sm:text-xs">{number}</p>
                                    <p className="mt-1 text-sm font-black">{title}</p>
                                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-emerald-50/75 sm:text-xs sm:leading-5">{body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {ordersError ? (
                        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:px-7 sm:text-sm">
                            {ordersError}
                        </div>
                    ) : null}

                    {error ? (
                        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:px-7 sm:text-sm">
                            {error}
                        </div>
                    ) : null}

                    {notice ? (
                        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 sm:px-7 sm:text-sm">
                            {notice}
                        </div>
                    ) : null}

                    <section className="border-b border-stone-200 bg-white">
                        <div className="flex items-end justify-between gap-4 border-b border-stone-200 bg-[#e7f2ee] px-4 py-4 sm:px-7 sm:py-5">
                            <div>
                                <p className="text-xs font-bold text-emerald-700">01 · Order issues</p>
                                <h2 className="mt-0.5 text-xl font-black text-stone-950">Orders that need attention</h2>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">
                                    Select an order to see what happened and decide whether a dispute case is needed.
                                </p>
                            </div>
                            <p className="shrink-0 text-sm font-black text-emerald-800">{summary.total || 0} open</p>
                        </div>

                        {ordersLoading ? (
                            <div className="flex min-h-36 items-center justify-center gap-2 px-4 py-8 text-sm font-semibold text-stone-500 sm:px-7">
                                <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                                Loading order issues…
                            </div>
                        ) : !(ordersWorkspace.orders || []).length ? (
                            <div className="px-4 py-6 sm:px-7">
                                <p className="text-sm font-black text-stone-900">No order issues need admin review right now.</p>
                                <p className="mt-1 text-xs font-semibold text-stone-500">Failed deliveries, returns and item problems will appear here automatically.</p>
                            </div>
                        ) : (
                            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
                                <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
                                    <div className="px-4 py-3 sm:hidden">
                                        <label className="text-xs font-bold text-stone-600">
                                            Choose an order issue
                                            <select
                                                value={selectedOrderId}
                                                onChange={(event) => setSelectedOrderId(event.target.value)}
                                                className="mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-bold text-stone-800 outline-none focus:border-emerald-500"
                                            >
                                                {(ordersWorkspace.orders || []).map((order) => (
                                                    <option key={order.id} value={order.id}>
                                                        {orderIssueLabel(order.status)} · {order.itemNames?.[0] || order.sellerName}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>

                                    <div className="hidden max-h-[560px] overflow-y-auto sm:block">
                                        {(ordersWorkspace.orders || []).map((order, index) => {
                                            const active = selectedOrderId === order.id;
                                            return (
                                                <button
                                                    key={order.id}
                                                    type="button"
                                                    onClick={() => setSelectedOrderId(order.id)}
                                                    className={`block w-full border-t border-stone-100 px-5 py-3 text-left first:border-t-0 ${active ? 'bg-[#eef6f2]' : 'bg-white hover:bg-stone-50'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-stone-950">{order.itemNames?.[0] || order.sellerName}</p>
                                                            <p className="mt-0.5 text-xs font-semibold text-stone-500">{order.sellerName} · {order.itemCount || 0} item{Number(order.itemCount || 0) === 1 ? '' : 's'}</p>
                                                        </div>
                                                        <span className="shrink-0 text-[10px] font-black text-[#a2543c]">{orderIssueLabel(order.status)}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </aside>

                                <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5">
                                    {selectedOrder ? (
                                        <>
                                            <div className="flex flex-col gap-2 border-b border-stone-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-[#a2543c]">{orderIssueLabel(selectedOrder.status)}</p>
                                                    <h3 className="mt-1 truncate text-lg font-black text-stone-950 sm:text-xl">
                                                        {selectedOrder.itemNames?.[0] || 'Order issue'}
                                                    </h3>
                                                    <p className="mt-1 text-xs font-semibold text-stone-500">Host: {selectedOrder.sellerName}</p>
                                                </div>
                                                <p className="text-xs font-bold text-stone-500">Order reference {orderReference(selectedOrder)}</p>
                                            </div>

                                            <div className="grid grid-cols-2 border-b border-stone-200 sm:grid-cols-3">
                                                {[
                                                    ['Items', selectedOrder.itemNames?.length ? selectedOrder.itemNames.join(', ') : `${selectedOrder.itemCount || 0} items`],
                                                    ['Order value', formatOrderMoney(selectedOrder.totalMinor, selectedOrder.currency)],
                                                    ['Fulfillment', selectedOrder.fulfillmentType ? titleize(selectedOrder.fulfillmentType) : 'Not set'],
                                                ].map(([label, value], index) => (
                                                    <div key={label} className={`min-w-0 py-3 ${index > 0 ? 'border-l border-stone-200 pl-3 sm:pl-4' : 'pr-3 sm:pr-4'} ${index === 2 ? 'col-span-2 border-l-0 border-t border-stone-200 pl-0 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-4' : ''}`}>
                                                        <p className="text-[10px] font-bold text-stone-400">{label}</p>
                                                        <p className="mt-1 line-clamp-2 text-xs font-black leading-5 text-stone-800 sm:text-sm">{value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="pt-4">
                                                {selectedOrderCase ? (
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-sm font-black text-stone-900">A dispute case is already open.</p>
                                                            <p className="mt-0.5 text-xs font-semibold text-stone-500">Open the case below to continue the review.</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReviewCase(selectedOrderCase)}
                                                            className="focus-ring inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173b4f] px-4 text-xs font-black text-white"
                                                        >
                                                            Open dispute case
                                                        </button>
                                                    </div>
                                                ) : canMutateDomain ? (
                                                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                                        <label className="text-xs font-bold text-stone-600">
                                                            Why does this order need admin review?
                                                            <textarea
                                                                value={reason}
                                                                onChange={(event) => setReason(event.target.value)}
                                                                rows={2}
                                                                placeholder="Briefly explain the problem."
                                                                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none focus:border-emerald-500"
                                                            />
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={createDisputeForSelectedOrder}
                                                            disabled={busy || reason.trim().length < 5}
                                                            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
                                                        >
                                                            Start dispute review
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-semibold text-stone-500">You can review this issue, but you do not have permission to open a dispute case.</p>
                                                )}
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="border-b border-stone-200 bg-[#eef3f7]">
                        <div className="flex items-end justify-between gap-4 border-b border-[#d6e0e7] px-4 py-4 sm:px-7 sm:py-5">
                            <div>
                                <p className="text-xs font-bold text-[#315f7a]">02 · Dispute cases</p>
                                <h2 className="mt-0.5 text-xl font-black text-stone-950">Admin decisions in progress</h2>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">Cases keep the reason and decision history together.</p>
                            </div>
                            <p className="shrink-0 text-sm font-black text-[#315f7a]">{orderDisputeCases.length} cases</p>
                        </div>

                        {orderDisputeCases.length ? (
                            <div className="bg-white/70">
                                {visibleOrderDisputeCases.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedReviewCase(item)}
                                        className={`grid w-full gap-2 px-4 py-3 text-left transition hover:bg-white sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-center sm:px-7 ${index > 0 ? 'border-t border-stone-200' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-stone-950">{item.summary}</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-stone-500">{item.details || 'No additional note.'}</p>
                                        </div>
                                        <p className="text-xs font-bold text-stone-600">{titleize(item.status)}</p>
                                        <span className="text-xs font-black text-[#315f7a]">Review</span>
                                    </button>
                                ))}

                                {orderDisputeCases.length > 10 ? (
                                    <div className="border-t border-stone-200 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllOrderCases((current) => !current)}
                                            className="focus-ring rounded-lg border border-[#bfd3df] bg-white px-4 py-2 text-xs font-black text-[#315f7a]"
                                        >
                                            {showAllOrderCases ? 'Show fewer' : `View all ${orderDisputeCases.length}`}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="px-4 py-5 sm:px-7">
                                <p className="text-sm font-black text-stone-900">No dispute cases are open.</p>
                                <p className="mt-1 text-xs font-semibold text-stone-500">Start a dispute from an order issue when admin review is needed.</p>
                            </div>
                        )}
                    </section>

                    {selectedReviewCase ? (
                        <section className="border-b border-stone-200 bg-white">
                            <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
                                <div className="border-b border-stone-200 bg-[#173b4f] px-4 py-4 text-white sm:px-7 sm:py-5 lg:border-b-0 lg:border-r">
                                    <p className="text-xs font-bold text-sky-200">Selected dispute</p>
                                    <h2 className="mt-1 text-lg font-black">Record the next decision</h2>
                                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-sky-50/80">Add a short reason, then resolve, close or send the case for follow-up.</p>
                                </div>
                                <div className="px-4 py-4 sm:px-7 sm:py-5">
                                    <div className="flex flex-col gap-2 border-b border-stone-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-stone-950">{selectedReviewCase.summary}</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-stone-500">{selectedReviewCase.details || 'No additional note.'}</p>
                                        </div>
                                        <span className="text-xs font-black text-[#315f7a]">{titleize(selectedReviewCase.status)}</span>
                                    </div>

                                    {canMutateDomain ? (
                                        <div className="pt-3">
                                            <textarea
                                                value={reason}
                                                onChange={(event) => setReason(event.target.value)}
                                                rows={2}
                                                placeholder="Reason for this decision"
                                                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none focus:border-[#315f7a]"
                                            />
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideSelectedOrderCase('resolve')} className="focus-ring rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Resolve</button>
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideSelectedOrderCase('needs_action')} className="focus-ring rounded-xl border border-[#bfd3df] bg-[#edf5f9] px-4 py-2.5 text-xs font-black text-[#315f7a] disabled:opacity-50">Needs follow-up</button>
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideSelectedOrderCase('dismiss')} className="focus-ring rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-black text-stone-700 disabled:opacity-50">Close without action</button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    <section className="bg-[#102f2a] px-4 py-4 text-white sm:px-7 sm:py-5">
                        <p className="text-sm font-black">Order history stays intact.</p>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-emerald-50/70">Admin decisions are recorded separately, so the original order and payment history remain unchanged.</p>
                    </section>
                </div>
            </AdminShell>
        );
    }


    if (section === 'finance') {
        const actionSettlements =
            financeSettlements.filter(
                (item) => ['pending_approval', 'approved'].includes(item?.status),
            );

        const displayedSettlements =
            financeView === 'action'
                ? actionSettlements
                : financeSettlements;

        const selected =
            displayedSettlements.find(
                (item) => item?.id === selectedFinanceSettlementId,
            ) ||
            displayedSettlements[0] ||
            null;

        const canFinanceMutate =
            hasAdminPermission('finance.mutate');

        const refreshFinancePage = () => {
            loadFinanceWorkspace();
        };

        const selectFinanceView = (nextView) => {
            setFinanceView(nextView);

            const nextRows =
                nextView === 'action'
                    ? actionSettlements
                    : financeSettlements;

            if (!nextRows.some((item) => item?.id === selectedFinanceSettlementId)) {
                setSelectedFinanceSettlementId(nextRows[0]?.id || '');
            }
        };

        const runFinanceAction = async (action, successMessage) => {
            setBusy(true);
            setFinanceError('');
            setNotice('');

            try {
                await action();
                setNotice(successMessage);
                setFinanceReason('');
                setFinancePayoutReference('');
                await loadFinanceWorkspace();
            } catch (requestError) {
                setFinanceError(
                    getAdminGovernanceErrorMessage(
                        requestError,
                        'Unable to update this payout.',
                    ),
                );
            } finally {
                setBusy(false);
            }
        };

        const financeSummaryCards = [
            {
                label: 'Needs approval',
                value: financeSummary.pendingApproval || 0,
                icon: Clock3,
                tone: 'border-[#c8d8e6] bg-[#edf4f9] text-[#315f7a]',
            },
            {
                label: 'Ready to pay',
                value: financeSummary.approved || 0,
                icon: CheckCircle2,
                tone: 'border-[#d8d0eb] bg-[#f2eff8] text-[#5b4b85]',
            },
            {
                label: 'Paid',
                value: financeSummary.paid || 0,
                icon: History,
                tone: 'border-stone-200 bg-white text-stone-700',
            },
        ];

        return (
            <AdminShell
                title="Finance & Payouts"
                description="Approve Host payouts and record completed transfers."
                actions={
                    <button
                        type="button"
                        onClick={refreshFinancePage}
                        disabled={financeLoading}
                        className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw
                            size={14}
                            className={financeLoading ? 'animate-spin' : ''}
                            aria-hidden="true"
                        />
                        Refresh
                    </button>
                }
            >
                <div className="min-h-[100svh] bg-[#f4f5f7] pb-5 sm:pb-7">
                    <section className="border-b border-[#243849] bg-[#172a3a] text-white">
                        <div className="grid lg:grid-cols-[minmax(0,1fr)_390px]">
                            <div className="px-4 py-4 sm:px-7 sm:py-6">
                                <p className="text-[11px] font-bold text-[#9fc5dd] sm:text-xs">Payout control</p>
                                <h2 className="mt-1 max-w-3xl text-[23px] font-black leading-[1.08] sm:text-[32px]">
                                    Review the payout. Approve it. Record the transfer.
                                </h2>
                                <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-white/70 sm:text-sm sm:leading-6">
                                    <span className="sm:hidden">Check the Host, amount and payment status.</span>
                                    <span className="hidden sm:inline">See each Host payout from approval through completed payment.</span>
                                </p>
                                <div className="mt-3 flex items-center gap-3 text-xs font-bold text-[#bed3e2] sm:mt-4">
                                    <span>{financeMoney(financeSummary.waitingAmountMinor || 0)} waiting</span>
                                    <span className="h-1 w-1 rounded-full bg-white/35" />
                                    <span>{financeMoney(financeSummary.paidAmountMinor || 0)} paid</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-t border-white/10 p-3 sm:gap-3 sm:p-4 lg:border-l lg:border-t-0">
                                {financeSummaryCards.map(({ label, value, icon: CardIcon, tone }) => (
                                    <div
                                        key={label}
                                        className={`rounded-[16px] border p-3 ${tone}`}
                                    >
                                        <CardIcon size={15} aria-hidden="true" />
                                        <p className="mt-2 text-xl font-black leading-none sm:text-2xl">{value}</p>
                                        <p className="mt-1 text-[9px] font-bold leading-3 sm:text-[10px]">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-2 border-b border-[#d9e1e7] bg-[#eaf0f4] lg:grid-cols-4">
                        {[
                            ['01', 'Choose payout', 'Open the Host payout.'],
                            ['02', 'Check amount', 'Confirm orders and total.'],
                            ['03', 'Approve', 'Approve or return it.'],
                            ['04', 'Record payment', 'Save the transfer reference.'],
                        ].map(([number, title, body], index) => (
                            <div
                                key={number}
                                className={`px-4 py-3 sm:px-5 sm:py-3.5 ${index % 2 === 1 ? 'border-l border-[#d9e1e7]' : ''} ${index >= 2 ? 'border-t border-[#d9e1e7] lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-[#d9e1e7]' : ''}`}
                            >
                                <p className="text-[10px] font-black text-[#58758a]">{number}</p>
                                <p className="mt-0.5 text-sm font-black text-[#172a3a]">{title}</p>
                                <p className="mt-0.5 text-[10px] font-semibold leading-4 text-stone-500 sm:text-xs">{body}</p>
                            </div>
                        ))}
                    </section>

                    {financeError ? (
                        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 sm:px-7 sm:text-sm">
                            {financeError}
                        </div>
                    ) : null}

                    {notice ? (
                        <div className="border-b border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-800 sm:px-7 sm:text-sm">
                            {notice}
                        </div>
                    ) : null}

                    <section className="border-b border-stone-200 bg-white">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-7 sm:py-4">
                            <div>
                                <p className="text-xs font-black text-[#315f7a]">Payouts</p>
                                <p className="mt-0.5 text-xs font-semibold text-stone-500">
                                    {financeView === 'action' ? 'Only payouts that need action.' : 'Complete payout history.'}
                                </p>
                            </div>

                            <div className="inline-flex shrink-0 rounded-xl border border-stone-200 bg-[#f3f4f5] p-1">
                                <button
                                    type="button"
                                    onClick={() => selectFinanceView('action')}
                                    className={`focus-ring rounded-lg px-3 py-2 text-[11px] font-black transition ${financeView === 'action' ? 'bg-[#315f7a] text-white shadow-sm' : 'text-stone-600'}`}
                                >
                                    Action ({actionSettlements.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => selectFinanceView('all')}
                                    className={`focus-ring rounded-lg px-3 py-2 text-[11px] font-black transition ${financeView === 'all' ? 'bg-[#315f7a] text-white shadow-sm' : 'text-stone-600'}`}
                                >
                                    All ({financeSettlements.length})
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="border-b border-stone-200 bg-[#f8f9fa]">
                        <div className="flex items-end justify-between gap-4 border-b border-stone-200 px-4 py-3 sm:px-7 sm:py-4">
                            <div>
                                <p className="text-xs font-bold text-[#5b4b85]">Host payout queue</p>
                                <h2 className="mt-0.5 text-lg font-black text-stone-950 sm:text-xl">
                                    {financeView === 'action' ? 'Waiting for your decision' : 'Payout history'}
                                </h2>
                            </div>
                            <p className="shrink-0 text-sm font-black text-[#315f7a]">{displayedSettlements.length}</p>
                        </div>

                        {financeLoading ? (
                            <div className="flex min-h-28 items-center justify-center gap-2 bg-white px-4 py-6 text-sm font-semibold text-stone-500 sm:px-7">
                                <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                                Loading payouts…
                            </div>
                        ) : displayedSettlements.length === 0 ? (
                            <div className="bg-white px-4 py-5 sm:px-7 sm:py-6">
                                <p className="text-sm font-black text-stone-900">
                                    {financeView === 'action' ? 'No payouts need action.' : 'No payout records yet.'}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-stone-500">
                                    {financeView === 'action'
                                        ? 'Create a payout batch when delivered Host orders are ready.'
                                        : 'Payouts will appear here after a batch is created.'}
                                </p>
                                <Link
                                    to="/admin/host-operations?tab=finance"
                                    className="focus-ring mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#315f7a] px-4 text-xs font-black text-white"
                                >
                                    Prepare payout batch
                                </Link>
                            </div>
                        ) : (
                            <div className="grid bg-white lg:grid-cols-[330px_minmax(0,1fr)]">
                                <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
                                    <div className="px-4 py-3 lg:hidden">
                                        <label className="text-xs font-bold text-stone-600">
                                            Choose payout
                                            <select
                                                value={selected?.id || ''}
                                                onChange={(event) => setSelectedFinanceSettlementId(event.target.value)}
                                                className="mt-2 h-11 w-full rounded-xl border border-[#c8d8e6] bg-white px-3 text-sm font-bold text-stone-800 outline-none focus:border-[#315f7a]"
                                            >
                                                {displayedSettlements.map((item) => (
                                                    <option key={item.id} value={item.id}>
                                                        {(item.organization?.displayName || 'Host business')} — {financeMoney(item?.totals?.netPayableMinor || 0, item.currency)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>

                                    <div className="hidden max-h-[560px] overflow-y-auto lg:block">
                                        {displayedSettlements.map((item, index) => {
                                            const active = selected?.id === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSelectedFinanceSettlementId(item.id)}
                                                    className={`w-full px-5 py-3.5 text-left transition ${index > 0 ? 'border-t border-stone-100' : ''} ${active ? 'bg-[#edf4f9]' : 'hover:bg-stone-50'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-stone-950">{item.organization?.displayName || 'Host business'}</p>
                                                            <p className="mt-0.5 text-xs font-semibold text-stone-500">{financePeriod(item)}</p>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${financeStatusClass(item.status)}`}>
                                                            {financeStatusLabel(item.status)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <span className="text-xs font-semibold text-stone-500">{item.lineCount || 0} orders</span>
                                                        <span className="text-sm font-black text-[#315f7a]">{financeMoney(item?.totals?.netPayableMinor || 0, item.currency)}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </aside>

                                <div className="min-w-0 px-4 py-4 sm:px-7 sm:py-5">
                                    {selected ? (
                                        <>
                                            <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-[#315f7a]">Selected payout</p>
                                                    <h3 className="mt-0.5 truncate text-xl font-black text-stone-950 sm:text-2xl">
                                                        {selected.organization?.displayName || 'Host business'}
                                                    </h3>
                                                    <p className="mt-0.5 text-xs font-semibold text-stone-500">{financePeriod(selected)}</p>
                                                </div>
                                                <span className={`w-fit shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black ${financeStatusClass(selected.status)}`}>
                                                    {financeStatusLabel(selected.status)}
                                                </span>
                                            </div>

                                            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(110px,0.7fr))]">
                                                <div className="rounded-2xl border border-[#c8d8e6] bg-[#edf4f9] p-4">
                                                    <p className="text-[10px] font-bold text-[#315f7a]">Host receives</p>
                                                    <p className="mt-1 text-2xl font-black text-[#172a3a]">{financeMoney(selected?.totals?.netPayableMinor || 0, selected.currency)}</p>
                                                    <p className="mt-1 text-[10px] font-semibold text-stone-500">{selected.lineCount || 0} delivered orders</p>
                                                </div>

                                                {[
                                                    ['Order value', financeMoney(selected?.totals?.grossMerchandiseMinor || 0, selected.currency)],
                                                    ['Platform fee', financeMoney(selected?.totals?.platformFeeMinor || 0, selected.currency)],
                                                    ['Tax held', financeMoney(selected?.totals?.taxWithheldMinor || 0, selected.currency)],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="border-t border-stone-200 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                                                        <p className="text-[10px] font-bold text-stone-500">{label}</p>
                                                        <p className="mt-1 text-sm font-black text-stone-900">{value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-4 grid gap-x-6 gap-y-3 border-t border-stone-200 pt-3 sm:grid-cols-2">
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-500">Created</p>
                                                    <p className="mt-0.5 text-sm font-bold text-stone-900">{financeDate(selected.createdAt)}</p>
                                                </div>
                                                {selected.payoutReference ? (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-stone-500">Payment reference</p>
                                                        <p className="mt-0.5 break-all text-sm font-bold text-stone-900">{selected.payoutReference}</p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {selected.status === 'pending_approval' ? (
                                                <div className="mt-4 border-t border-[#c8d8e6] bg-[#eef4f8] px-4 py-4 sm:px-5">
                                                    <p className="text-xs font-black text-[#315f7a]">Approve or return</p>
                                                    {canFinanceMutate ? (
                                                        <>
                                                            <textarea
                                                                value={financeReason}
                                                                onChange={(event) => setFinanceReason(event.target.value)}
                                                                rows={2}
                                                                placeholder="Short decision note"
                                                                className="mt-2 w-full rounded-xl border border-[#c8d8e6] bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none focus:border-[#315f7a]"
                                                            />
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={busy || financeReason.trim().length < 3}
                                                                    onClick={() => runFinanceAction(
                                                                        () => decideAdminSettlement(selected.id, { decision: 'approve', reason: financeReason.trim() }),
                                                                        'Payout approved.',
                                                                    )}
                                                                    className="focus-ring rounded-xl bg-[#315f7a] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                                                                >
                                                                    Approve payout
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={busy || financeReason.trim().length < 3}
                                                                    onClick={() => runFinanceAction(
                                                                        () => decideAdminSettlement(selected.id, { decision: 'reject', reason: financeReason.trim() }),
                                                                        'Payout returned for changes.',
                                                                    )}
                                                                    className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-black text-rose-700 disabled:opacity-50"
                                                                >
                                                                    <XCircle size={14} aria-hidden="true" />
                                                                    Return
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <p className="mt-2 text-xs font-semibold text-stone-500">You can review this payout, but you cannot change it.</p>
                                                    )}
                                                </div>
                                            ) : null}

                                            {selected.status === 'approved' ? (
                                                <div className="mt-4 border-t border-[#d8d0eb] bg-[#f2eff8] px-4 py-4 sm:px-5">
                                                    <p className="text-xs font-black text-[#5b4b85]">Record payment</p>
                                                    {canFinanceMutate ? (
                                                        <>
                                                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                                <input
                                                                    value={financePayoutReference}
                                                                    onChange={(event) => setFinancePayoutReference(event.target.value)}
                                                                    placeholder="Payment reference"
                                                                    className="h-11 rounded-xl border border-[#d8d0eb] bg-white px-3 text-sm font-semibold text-stone-800 outline-none focus:border-[#5b4b85]"
                                                                />
                                                                <input
                                                                    value={financeReason}
                                                                    onChange={(event) => setFinanceReason(event.target.value)}
                                                                    placeholder="Payment note"
                                                                    className="h-11 rounded-xl border border-[#d8d0eb] bg-white px-3 text-sm font-semibold text-stone-800 outline-none focus:border-[#5b4b85]"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                disabled={busy || financePayoutReference.trim().length < 3 || financeReason.trim().length < 3}
                                                                onClick={() => runFinanceAction(
                                                                    () => markAdminSettlementPaid(selected.id, { payoutReference: financePayoutReference.trim(), reason: financeReason.trim() }),
                                                                    'Payment recorded.',
                                                                )}
                                                                className="focus-ring mt-2 inline-flex items-center gap-2 rounded-xl bg-[#5b4b85] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                                                            >
                                                                <Banknote size={15} aria-hidden="true" />
                                                                Mark as paid
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <p className="mt-2 text-xs font-semibold text-stone-500">You can review this payout, but you cannot record payment.</p>
                                                    )}
                                                </div>
                                            ) : null}

                                            {selected.status === 'paid' ? (
                                                <div className="mt-4 border-t border-[#d8d0eb] bg-[#f4f1f8] px-4 py-4 sm:px-5">
                                                    <p className="text-xs font-black text-[#5b4b85]">Payment complete</p>
                                                    <p className="mt-1 text-sm font-black text-stone-900">Paid {financeDate(selected.paidAt)}</p>
                                                </div>
                                            ) : null}

                                            {selected.status === 'rejected' ? (
                                                <div className="mt-4 border-t border-rose-200 bg-rose-50 px-4 py-4 sm:px-5">
                                                    <p className="text-xs font-black text-rose-700">Returned</p>
                                                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-stone-600">{selected.reason || 'This payout needs to be prepared again.'}</p>
                                                </div>
                                            ) : null}
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </AdminShell>
        );
    }

    if (section === 'integrations') {
        const summary = integrationWorkspace.summary || {};
        const refreshing = loading || integrationLoading;

        const refreshIntegrationPage = () => {
            load();
            loadIntegrationWorkspace();
        };

        const createIntegrationReview = async () => {
            if (!selectedIntegration || reason.trim().length < 5) {
                return;
            }

            const result = await run(
                () =>
                    createAdminReviewCase({
                        domain: 'marketplace',
                        caseType: 'integration_failure',
                        entity: {
                            type: 'organization_webhook',
                            id: selectedIntegration.id,
                            label: `${selectedIntegration.organizationName} — ${selectedIntegration.name}`,
                        },
                        severity: 'medium',
                        priority: 'p2',
                        summary: `Connection issue — ${selectedIntegration.organizationName}`,
                        details: reason.trim(),
                        evidence: [],
                    }),
                'Connection review started.',
            );

            if (result?.reviewCase) {
                setSelectedReviewCase(result.reviewCase);
            }
        };

        const decideIntegrationCase = async (decision) => {
            const activeCase = selectedReviewCase || selectedIntegrationCase;
            if (!activeCase || reason.trim().length < 5) {
                return;
            }

            const result = await run(
                () =>
                    decideAdminReviewCase(
                        activeCase.id,
                        {
                            decision,
                            reason: reason.trim(),
                            evidence: evidence(),
                        },
                    ),
                decision === 'resolve'
                    ? 'Connection review resolved.'
                    : decision === 'dismiss'
                        ? 'Connection review closed.'
                        : 'Connection review marked for follow-up.',
            );

            if (result) {
                setSelectedReviewCase(null);
                setReason('');
            }
        };

        const selectedCase =
            selectedReviewCase?.caseType === 'integration_failure'
                ? selectedReviewCase
                : selectedIntegrationCase;

        return (
            <AdminShell
                title="Integrations & Connections"
                description="Monitor Host connections and review delivery failures from one place."
                actions={
                    <button
                        type="button"
                        onClick={refreshIntegrationPage}
                        disabled={refreshing}
                        className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw
                            size={14}
                            className={refreshing ? 'animate-spin' : ''}
                            aria-hidden="true"
                        />
                        Refresh
                    </button>
                }
            >
                <div className="min-h-[100svh] bg-[#f4f5f1] pb-6 sm:pb-8">
                    <section className="border-b border-[#123f35] bg-[#123f35] text-white">
                        <div className="grid lg:grid-cols-[minmax(0,1fr)_460px]">
                            <div className="px-4 py-5 sm:px-7 sm:py-7">
                                <p className="text-xs font-bold text-emerald-200">Connection workspace</p>
                                <h2 className="mt-1.5 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
                                    See which Host connections are working and which need attention.
                                </h2>
                                <p className="mt-2 line-clamp-2 max-w-2xl text-xs font-semibold leading-5 text-emerald-50/80 sm:hidden">
                                    Open a connection, check its latest delivery, and start a review when something fails.
                                </p>
                                <p className="mt-2 hidden max-w-2xl text-sm font-semibold leading-6 text-emerald-50/80 sm:block">
                                    This page shows webhook connections already configured by Hosts. Use it to spot failures and record the admin follow-up without exposing signing secrets.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 border-t border-white/15 lg:border-l lg:border-t-0">
                                {[
                                    ['Connections', summary.total || 0],
                                    ['Working', summary.healthy || 0],
                                    ['Need attention', summary.failed || 0],
                                    ['Not used yet', summary.neverUsed || 0],
                                ].map(([label, value], index) => (
                                    <div
                                        key={label}
                                        className={`px-4 py-3 sm:px-5 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15' : ''}`}
                                    >
                                        <p className="text-xl font-black sm:text-2xl">{value}</p>
                                        <p className="mt-0.5 text-[10px] font-semibold text-emerald-100 sm:text-xs">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
                            {[
                                ['01', 'Choose a connection', 'Open the Host connection you want to check.'],
                                ['02', 'Check delivery', 'See whether its latest delivery worked or failed.'],
                                ['03', 'Review a failure', 'Record the problem when admin follow-up is needed.'],
                                ['04', 'Close the review', 'Resolve it or keep it open for follow-up.'],
                            ].map(([number, title, body], index) => (
                                <div
                                    key={number}
                                    className={`px-4 py-3 sm:px-5 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-white/15' : ''}`}
                                >
                                    <p className="text-[10px] font-black text-emerald-200 sm:text-xs">{number}</p>
                                    <p className="mt-1 text-sm font-black">{title}</p>
                                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-emerald-50/75 sm:text-xs sm:leading-5">{body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {integrationError ? (
                        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:px-7 sm:text-sm">
                            {integrationError}
                        </div>
                    ) : null}

                    {error ? (
                        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:px-7 sm:text-sm">
                            {error}
                        </div>
                    ) : null}

                    {notice ? (
                        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 sm:px-7 sm:text-sm">
                            {notice}
                        </div>
                    ) : null}

                    <section className="border-b border-stone-200 bg-white">
                        <div className="flex items-end justify-between gap-4 border-b border-stone-200 bg-[#e7f2ee] px-4 py-4 sm:px-7 sm:py-5">
                            <div>
                                <p className="text-xs font-bold text-emerald-700">01 · Host connections</p>
                                <h2 className="mt-0.5 text-xl font-black text-stone-950">Check connection health</h2>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">
                                    Select a connection to see the Host, destination and latest delivery result.
                                </p>
                            </div>
                            <p className="shrink-0 text-sm font-black text-emerald-800">{summary.total || 0} total</p>
                        </div>

                        {integrationLoading ? (
                            <div className="flex min-h-36 items-center justify-center gap-2 px-4 py-8 text-sm font-semibold text-stone-500 sm:px-7">
                                <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                                Loading connections…
                            </div>
                        ) : !(integrationWorkspace.webhooks || []).length ? (
                            <div className="px-4 py-6 sm:px-7">
                                <p className="text-sm font-black text-stone-900">No Host connections are configured yet.</p>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold text-stone-500">Connections will appear here after a Host adds a webhook in its integration settings.</p>
                            </div>
                        ) : (
                            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
                                <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
                                    <div className="px-4 py-3 sm:hidden">
                                        <label className="text-xs font-bold text-stone-600">
                                            Choose a connection
                                            <select
                                                value={selectedIntegrationId}
                                                onChange={(event) => setSelectedIntegrationId(event.target.value)}
                                                className="mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-bold text-stone-800 outline-none focus:border-emerald-500"
                                            >
                                                {(integrationWorkspace.webhooks || []).map((item) => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.organizationName} — {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>

                                    <div className="hidden max-h-[540px] overflow-y-auto sm:block">
                                        {(integrationWorkspace.webhooks || []).map((item, index) => {
                                            const active = selectedIntegrationId === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSelectedIntegrationId(item.id)}
                                                    className={`block w-full border-t border-stone-100 px-5 py-3 text-left first:border-t-0 ${active ? 'bg-[#eef6f2]' : 'bg-white hover:bg-stone-50'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-stone-950">{item.organizationName}</p>
                                                            <p className="mt-0.5 truncate text-xs font-semibold text-stone-500">{item.name}</p>
                                                        </div>
                                                        <span className={`shrink-0 text-[10px] font-black ${integrationHealthClass(item)}`}>{integrationHealthLabel(item)}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </aside>

                                <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5">
                                    {selectedIntegration ? (
                                        <>
                                            <div className="flex flex-col gap-2 border-b border-stone-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-bold ${integrationHealthClass(selectedIntegration)}`}>{integrationHealthLabel(selectedIntegration)}</p>
                                                    <h3 className="mt-1 truncate text-lg font-black text-stone-950 sm:text-xl">{selectedIntegration.organizationName}</h3>
                                                    <p className="mt-1 truncate text-xs font-semibold text-stone-500">{selectedIntegration.name}</p>
                                                </div>
                                                <p className="text-xs font-bold text-stone-500">{selectedIntegration.endpointHost}</p>
                                            </div>

                                            <div className="grid grid-cols-2 border-b border-stone-200 sm:grid-cols-3">
                                                {[
                                                    ['Latest delivery', integrationLastSeen(selectedIntegration.lastDeliveryAt)],
                                                    ['Events', selectedIntegration.eventTypes?.length ? `${selectedIntegration.eventTypes.length} selected` : 'No events selected'],
                                                    ['Connection', selectedIntegration.status === 'disabled' ? 'Paused' : 'Active'],
                                                ].map(([label, value], index) => (
                                                    <div key={label} className={`min-w-0 py-3 ${index > 0 ? 'border-l border-stone-200 pl-3 sm:pl-4' : 'pr-3 sm:pr-4'} ${index === 2 ? 'col-span-2 border-l-0 border-t border-stone-200 pl-0 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-4' : ''}`}>
                                                        <p className="text-[10px] font-bold text-stone-400">{label}</p>
                                                        <p className="mt-1 line-clamp-2 text-xs font-black leading-5 text-stone-800 sm:text-sm">{value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="pt-4">
                                                {selectedIntegrationCase ? (
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-sm font-black text-stone-900">An admin review is already open.</p>
                                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-stone-500">Continue the review below and record the next decision.</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReviewCase(selectedIntegrationCase)}
                                                            className="focus-ring inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173b4f] px-4 text-xs font-black text-white"
                                                        >
                                                            Continue review
                                                        </button>
                                                    </div>
                                                ) : selectedIntegration.lastDeliveryStatus === 'failed' && canMutateDomain ? (
                                                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                                        <label className="text-xs font-bold text-stone-600">
                                                            What needs attention?
                                                            <textarea
                                                                value={reason}
                                                                onChange={(event) => setReason(event.target.value)}
                                                                rows={2}
                                                                placeholder="Briefly explain the connection problem."
                                                                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none focus:border-emerald-500"
                                                            />
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={createIntegrationReview}
                                                            disabled={busy || reason.trim().length < 5}
                                                            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
                                                        >
                                                            Start review
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-semibold text-stone-500">
                                                        {selectedIntegration.lastDeliveryStatus === 'failed'
                                                            ? 'You can see this failure, but you do not have permission to start an admin review.'
                                                            : 'No admin action is needed for this connection right now.'}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="border-b border-stone-200 bg-[#eef3f7]">
                        <div className="flex items-end justify-between gap-4 border-b border-[#d6e0e7] px-4 py-4 sm:px-7 sm:py-5">
                            <div>
                                <p className="text-xs font-bold text-[#315f7a]">02 · Admin reviews</p>
                                <h2 className="mt-0.5 text-xl font-black text-stone-950">Connection problems being followed up</h2>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">Reviews keep the problem and decision history together.</p>
                            </div>
                            <p className="shrink-0 text-sm font-black text-[#315f7a]">{integrationReviewCases.length} open</p>
                        </div>

                        {integrationReviewCases.length ? (
                            <div className="bg-white/70">
                                {visibleIntegrationCases.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedReviewCase(item)}
                                        className={`grid w-full gap-2 px-4 py-3 text-left transition hover:bg-white sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-center sm:px-7 ${index > 0 ? 'border-t border-stone-200' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-stone-950">{item.entity?.label || item.summary}</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-stone-500">{item.details || item.summary}</p>
                                        </div>
                                        <p className="text-xs font-bold text-stone-600">{titleize(item.status)}</p>
                                        <span className="text-xs font-black text-[#315f7a]">Review</span>
                                    </button>
                                ))}

                                {integrationReviewCases.length > 10 ? (
                                    <div className="border-t border-stone-200 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllIntegrationCases((current) => !current)}
                                            className="focus-ring rounded-lg border border-[#bfd3df] bg-white px-4 py-2 text-xs font-black text-[#315f7a]"
                                        >
                                            {showAllIntegrationCases ? 'Show fewer' : `View all ${integrationReviewCases.length}`}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="px-4 py-5 sm:px-7">
                                <p className="text-sm font-black text-stone-900">No connection reviews are open.</p>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold text-stone-500">A failed connection can be opened for admin review from the section above.</p>
                            </div>
                        )}
                    </section>

                    {selectedCase ? (
                        <section className="border-b border-stone-200 bg-white">
                            <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
                                <div className="border-b border-stone-200 bg-[#173b4f] px-4 py-4 text-white sm:px-7 sm:py-5 lg:border-b-0 lg:border-r">
                                    <p className="text-xs font-bold text-sky-200">Selected review</p>
                                    <h2 className="mt-1 text-lg font-black">Record the next decision</h2>
                                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-sky-50/80">Resolve it, close it, or keep it open for follow-up.</p>
                                </div>
                                <div className="px-4 py-4 sm:px-7 sm:py-5">
                                    <div className="flex flex-col gap-2 border-b border-stone-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-stone-950">{selectedCase.entity?.label || selectedCase.summary}</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-stone-500">{selectedCase.details || 'No additional note.'}</p>
                                        </div>
                                        <span className="text-xs font-black text-[#315f7a]">{titleize(selectedCase.status)}</span>
                                    </div>

                                    {canMutateDomain ? (
                                        <div className="pt-3">
                                            <textarea
                                                value={reason}
                                                onChange={(event) => setReason(event.target.value)}
                                                rows={2}
                                                placeholder="Reason for this decision"
                                                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none focus:border-[#315f7a]"
                                            />
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideIntegrationCase('resolve')} className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Resolve</button>
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideIntegrationCase('needs_action')} className="focus-ring rounded-lg border border-[#bfd3df] bg-[#edf5f9] px-3 py-2 text-xs font-black text-[#315f7a] disabled:opacity-50">Needs follow-up</button>
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideIntegrationCase('dismiss')} className="focus-ring rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-black text-stone-600 disabled:opacity-50">Close</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="pt-3 text-xs font-semibold text-stone-500">You can read this review, but you cannot change its decision.</p>
                                    )}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    <section className="bg-[#eceeea] px-4 py-4 sm:px-7 sm:py-5">
                        <div className="flex items-start gap-3">
                            <Webhook size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-black text-stone-900">Connection settings stay with the Host.</p>
                                <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-stone-600">This page monitors delivery health and records admin follow-up. Signing secrets are never shown here.</p>
                            </div>
                        </div>
                    </section>
                </div>
            </AdminShell>
        );
    }

    const Icon =
        config.icon;
  
    return (
        <AdminShell
            title={
                section === 'trustSafety'
                    ? 'Trust, Safety & Claims'
                    : section === 'users'
                    ? 'People & Businesses'
                    : section === 'dataQuality'
                        ? 'Data Quality & Duplicate Review'
                        : section === 'recipeReview'
                            ? 'Recipe Publishing Review'
                            : section === 'policy' ? <><span className="sm:hidden">Food rules & features</span><span className="hidden sm:inline">Food Rules & Feature Access</span></> : `${config.code} · ${config.title}`
            }
            description={
                section === 'trustSafety'
                    ? 'Review safety reports, handle incidents and follow up on claims.'
                    : section === 'users'
                    ? 'Find customer and Host accounts, review business access, and move to the right admin tool without editing records blindly.'
                    : section === 'recipeReview'
                        ? 'Review recipes waiting for a decision, check food readiness, and move each recipe to the right next step.'
                        : section === 'policy' ? <><span className="text-[13px] leading-[1.3] sm:hidden">Manage rules and features.</span><span className="hidden sm:inline">Create and review food safety rules, manage feature access, and track related admin work.</span></> : config.description
            }
            flushTop={section === 'users'}
            actions={
                <button
                    type="button"
                    onClick={() => {
                        if (section === 'recipeReview') {
                            loadRecipeReviewWorkspace();
                            return;
                        }

                        load();

                        if (section === 'aiQuality') {
                            setAiHealthRefresh((value) => value + 1);
                        }

                        if (section === 'dataQuality') {
                            loadDataQualityWorkspace();
                        }
                    }}
                    disabled={section === 'recipeReview' ? recipeReviewLoading : loading}
                    className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
                >
                    <RefreshCw
                        size={14}
                        className={
                            (section === 'recipeReview' ? recipeReviewLoading : loading)
                                ? 'animate-spin'
                                : ''
                        }
                        aria-hidden="true"
                    />
  
                    Refresh
                </button>
            }
        >
            {section !== 'dataQuality' && section !== 'recipeReview' ? (
                <div className="flex items-center gap-2 text-emerald-700">
                    <Icon
                        size={18}
                        aria-hidden="true"
                    />
  
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.13em]">
                        {section === 'users'
                            ? 'People & business access'
                            : section === 'trustSafety'
                                ? 'Safety reports & claims'
                                : 'Governed admin operations'}
                    </p>
                </div>
            ) : null}
  
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
  
            {section === 'users' ? (
                <section className="mt-3 overflow-hidden rounded-[22px] bg-[#123f4b] shadow-[0_18px_50px_rgba(18,63,75,0.14)] sm:mt-5 sm:rounded-[28px]">
                    <div className="grid gap-2.5 px-3.5 py-4 sm:gap-4 sm:px-6 sm:py-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end lg:gap-8 lg:px-8 lg:py-7">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9fe2df] sm:text-xs">
                                People & business workflow
                            </p>
  
                            <h2 className="mt-1.5 max-w-xl text-[18px] font-black leading-[1.12] text-white sm:mt-2 sm:text-2xl sm:leading-tight lg:text-[28px]">
                                <span className="sm:hidden">Find. Check access. Act safely.</span>
                                <span className="hidden sm:inline">Find the record. Verify access. Make the right change.</span>
                            </h2>
                        </div>
  
                        <p className="max-w-2xl text-[11px] font-semibold leading-4 text-white/65 sm:text-sm sm:leading-6 lg:justify-self-end">
                            <span className="sm:hidden">One guided path for people, Hosts and business access.</span>
                            <span className="hidden sm:inline">Use one guided path for Customer, Host and business access work so sensitive changes stay deliberate and traceable.</span>
                        </p>
                    </div>
  
                    <div className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
                        <UsersStepCard
                            number={1}
                            title="Find the account"
                            body="Use Admin search to find a Customer, Host or business."
                            mobileTitle="Find account"
                            mobileBody="Search Customer, Host or business."
                            icon={SearchCheck}
                            tone="amber"
                        />
  
                        <UsersStepCard
                            number={2}
                            title="Review business access"
                            body="Check Host approval and business access before changing anything."
                            mobileTitle="Check access"
                            mobileBody="Review Host and business access."
                            icon={Building2}
                            tone="sky"
                            to="/admin/host-operations"
                        />
  
                        <UsersStepCard
                            number={3}
                            title="Manage admin access"
                            body="Open roles and permissions when internal admin access needs a change."
                            mobileTitle="Admin access"
                            mobileBody="Open roles only when needed."
                            icon={ShieldCheck}
                            tone="emerald"
                            to={isRootSuperAdmin ? '/admin/roles' : '/admin/host-operations'}
                        />
  
                        <UsersStepCard
                            number={4}
                            title="Confirm the history"
                            body="Check the audit trail after sensitive access or business changes."
                            mobileTitle="Confirm history"
                            mobileBody="Verify sensitive changes in audit."
                            icon={Database}
                            tone="violet"
                            to="/admin/audit"
                        />
                    </div>
                </section>
            ) : null}
  
            {section !== 'recipeReview' && loading ? (
                <div
                    className={`grid place-items-center rounded-[22px] border border-stone-200 bg-white ${
                        section === 'users'
                            ? 'mt-3 min-h-40 sm:mt-4 sm:min-h-52'
                            : 'mt-5 min-h-72'
                    }`}
                >
                    <LoaderCircle className="animate-spin text-emerald-700" />
                </div>
            ) : (
                <>
                    {metricEntries.length &&
                    section !== 'dataQuality' &&
                    section !== 'recipeReview' && section !== 'policy' && section !== 'trustSafety' && section !== 'aiQuality' ? (
                        section === 'users' ? (
                            <section className="mt-3 overflow-hidden rounded-[22px] border border-[#c7dcdf] bg-[#c7dcdf] shadow-sm sm:mt-5 sm:rounded-[28px]">
                                <div className="bg-[#e8f3f3] px-3.5 py-3 sm:px-6 sm:py-5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#17666b] sm:text-xs">
                                        Access & operational snapshot
                                    </p>
  
                                    <div className="mt-0.5 flex flex-col gap-0.5 sm:mt-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                                        <h2 className="text-[16px] font-black leading-5 text-stone-950 sm:text-xl">
                                            <span className="sm:hidden">Review what needs attention</span>
                                            <span className="hidden sm:inline">What needs review before access changes move forward</span>
                                        </h2>
  
                                        <p className="max-w-xl text-[10px] font-semibold leading-4 text-stone-600 sm:text-sm sm:leading-5">
                                            <span className="sm:hidden">Queues, approvals, payouts and active controls.</span>
                                            <span className="hidden sm:inline">Review queues, Host approvals, payouts and active controls in one place.</span>
                                        </p>
                                    </div>
                                </div>
  
                                <div className="grid grid-cols-2 gap-px bg-[#c7dcdf] lg:grid-cols-4">
                                    {metricEntries.map(
                                        ([
                                            label,
                                            value,
                                            MetricIcon,
                                        ], index) => (
                                            <UsersMetricCard
                                                key={label}
                                                label={label}
                                                value={value}
                                                icon={MetricIcon}
                                                index={index}
                                            />
                                        ),
                                    )}
                                </div>
                            </section>
                        ) : (
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
                        )
                    ) : null}
  
                    {section === 'users' ? (
                        <section className="mt-3 overflow-hidden rounded-[22px] border border-[#d8dde5] bg-[#f3f5f7] shadow-sm sm:mt-5 sm:rounded-[28px]">
                            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
                                <div className="bg-[#193b63] p-4 text-white sm:p-6 lg:p-7">
                                    <div className="flex items-center gap-2.5 sm:block">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/12 text-[#bfe8e0] sm:h-11 sm:w-11 sm:rounded-xl">
                                        <UsersRound
                                            size={19}
                                            aria-hidden="true"
                                        />
                                    </span>
  
                                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#add7e7] sm:mt-5 sm:text-xs sm:tracking-[0.14em]">
                                        Account discovery
                                    </p>
                                    </div>
  
                                    <h2 className="mt-2 text-[18px] font-black leading-5 sm:mt-1.5 sm:text-2xl sm:leading-tight">
                                        Find a person or business
                                    </h2>
  
                                    <p className="mt-1.5 max-w-xl text-[10.5px] font-semibold leading-4 text-white/68 sm:mt-3 sm:text-sm sm:leading-6">
                                        <span className="sm:hidden">Search Customers, Hosts or businesses. Results follow your admin access.</span>
                                        <span className="hidden sm:inline">Use the Admin search above to find Customers, Hosts and businesses. Sensitive contact details stay protected and results follow your admin access.</span>
                                    </p>
                                </div>
  
                                <div className="bg-[#e4f1ec] p-4 sm:p-6 lg:p-7">
                                    <div className="flex items-center gap-2.5 sm:block">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#176647] shadow-sm sm:h-11 sm:w-11 sm:rounded-xl">
                                        <Building2
                                            size={19}
                                            aria-hidden="true"
                                        />
                                    </span>
  
                                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#1d6a50] sm:mt-5 sm:text-xs sm:tracking-[0.14em]">
                                        Governed access
                                    </p>
                                    </div>
  
                                    <h2 className="mt-2 text-[18px] font-black leading-5 text-stone-950 sm:mt-1.5 sm:text-2xl sm:leading-tight">
                                        Open the right access tool
                                    </h2>
  
                                    <p className="mt-1.5 max-w-2xl text-[10.5px] font-semibold leading-4 text-stone-600 sm:mt-3 sm:text-sm sm:leading-6">
                                        <span className="sm:hidden">Use Host Operations or Roles & Permissions for controlled access changes.</span>
                                        <span className="hidden sm:inline">Business approval, Host access and internal Admin permissions stay in their dedicated review pages so every change remains traceable.</span>
                                    </p>
  
                                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-5 sm:gap-2.5">
                                        <Link
                                            to="/admin/host-operations"
                                            className="focus-ring inline-flex items-center justify-center rounded-lg bg-[#126444] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#0d5338] sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                                        >
                                            Review Hosts
                                        </Link>
  
                                        {isRootSuperAdmin ? (
                                            <Link
                                                to="/admin/roles"
                                                className="focus-ring inline-flex items-center justify-center rounded-lg border border-[#b8d4ca] bg-white px-3 py-2 text-[11px] font-black text-stone-900 transition hover:border-[#82b7a4] sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                                            >
                                                Roles & permissions
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
  
                            <div className="border-t border-[#d8dde5] bg-white px-5 py-4 sm:px-6 sm:py-5 lg:px-7">
                                <div className="grid gap-1.5 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#3e5d78] sm:text-xs">
                                        Where changes happen
                                    </span>
  
                                    <p className="text-[11px] font-semibold leading-5 text-stone-600 sm:text-sm sm:leading-6">
                                        Profile details stay with the account owner, Host approval stays in Host operations, and roles stay in Access & Permissions. This page helps you find the record and open the correct tool.
                                    </p>
                                </div>
                            </div>
                        </section>
                    ) : null}
  
                    {section === 'aiQuality' ? (
                        <div className="mt-3 space-y-4 sm:mt-5 sm:space-y-5">
                            {hasAdminPermission('admin.audit.read') ? (
                                <AdminAiQualityPanel refreshSignal={aiHealthRefresh} />
                            ) : (
                                <section className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
                                    <p className="font-bold">AI activity is restricted.</p>
                                    <p className="mt-1 leading-5">Ask an authorised Super Admin for access to view Food Copilot run history. Product reviews can still be handled in their own section.</p>
                                </section>
                            )}

                            <section className="overflow-hidden rounded-[18px] border border-[#dfded8] bg-[#f8f7f3]">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e4de] px-4 py-3 sm:px-5">
                                    <div>
                                        <h2 className="text-base font-bold text-stone-900">Other platform checks</h2>
                                        <p className="mt-0.5 text-sm text-stone-600">The wider admin overview, separate from Food Copilot activity.</p>
                                    </div>
                                    {commandCenterError ? (
                                        <span className="text-xs font-bold text-rose-700">Overview unavailable — use Refresh</span>
                                    ) : null}
                                </div>
                                <div className="grid grid-cols-2 gap-px bg-[#e7e5dd] sm:grid-cols-4">
                                    {metricEntries.map(([label, value, MetricIcon]) => (
                                        <div key={label} className="min-w-0 bg-[#fcfbf8] px-3 py-3 sm:px-5 sm:py-4">
                                            <div className="flex items-center gap-2">
                                                <MetricIcon size={15} className="shrink-0 text-emerald-700" aria-hidden="true" />
                                                <span className="text-xl font-extrabold text-[#174836]">{commandCenterError ? '—' : (value ?? 0)}</span>
                                            </div>
                                            <p className="mt-1 text-xs font-semibold leading-4 text-stone-600 sm:text-sm">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3 sm:pt-4">
                                <p className="max-w-2xl text-sm leading-5 text-stone-600">Product and recipe approvals still need human review.</p>
                                <Link to="/admin/product-intelligence" className={primaryButtonClass}>
                                    Open Product Intelligence review
                                </Link>
                            </div>
                        </div>
                    ) : null}

                    {section === 'policy' ? (
                        <div className="mt-2 space-y-3 sm:mt-5 sm:space-y-5">
                            <section className="overflow-hidden rounded-2xl border border-[#c6ded3] bg-[#e3f2ea]">
                                <div className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3 sm:px-6 sm:py-6">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-emerald-800"><span className="sm:hidden">Admin controls</span><span className="hidden sm:inline">Platform safety and access</span></p>
                                        <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#123f30] sm:text-[29px]"><span className="sm:hidden">Set rules. Manage features.</span><span className="hidden sm:inline">Keep food rules clear. Control what goes live.</span></h2>
                                        <p className="mt-1 max-w-2xl text-sm leading-5 text-[#3d5e51]"><span className="sm:hidden">Create rules. Control what is live.</span><span className="hidden sm:inline">Create food-rule drafts, review feature availability, and record why changes are made.</span></p>
                                    </div>
                                    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#c5ded2] bg-white text-center sm:min-w-[225px]">
                                        {[['Food rules', policyLoadIssues.rules ? '—' : policy?.ruleProfiles?.length ?? '—'], ['Features', policyLoadIssues.flags ? '—' : policy?.featureFlags?.length ?? '—'], ['Enabled', policyLoadIssues.flags ? '—' : policy?.featureFlags?.filter((flag) => flag.enabled).length ?? '—']].map(([label, value]) => (
                                            <div key={label} className="min-w-0 border-r border-stone-100 px-2 py-1.5 last:border-r-0 sm:py-3">
                                                <p className="text-xl font-extrabold text-[#124b36]">{value}</p>
                                                <p className="text-xs font-semibold text-stone-600">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-px border-t border-[#c6ded3] bg-[#c6ded3]">
                                    {[['01', 'Write or review a food rule'], ['02', 'Choose available features'], ['03', 'Save with a reason']].map(([number, label]) => (
                                        <div key={number} className="flex min-w-0 items-center justify-center gap-1 bg-[#f2faf6] px-1 py-2 text-center text-xs sm:justify-start sm:gap-2 sm:px-5 sm:py-3 sm:text-sm">
                                            <span className="font-extrabold text-emerald-800">{number}</span><span className="font-semibold text-[#27483c]"><span className="sm:hidden">{number === '01' ? 'Rules' : number === '02' ? 'Features' : 'Save'}</span><span className="hidden sm:inline">{label}</span></span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="overflow-hidden rounded-2xl border border-[#d1e3dd] bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#eaf3f6] px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-[#285d75]">01 · Food safety</p>
                                        <h2 className="mt-0.5 text-xl font-extrabold text-[#1c4054]">Food rules</h2>
                                        <p className="mt-1 text-sm leading-5 text-[#446371]"><span className="sm:hidden">Write rules. Another admin approves.</span><span className="hidden sm:inline">Set nutrition, allergen and dietary guidance. New rules start as drafts and need a different reviewer to approve them.</span></p>
                                    </div>
                                    {hasAdminPermission('trust_safety.mutate') ? (
                                        <button type="button" onClick={() => setShowRuleForm((current) => !current)} className="focus-ring shrink-0 rounded-xl bg-[#175c49] px-4 py-2.5 text-sm font-bold text-white">{showRuleForm ? 'Close form' : '+ Create food rule'}</button>
                                    ) : null}
                                </div>
                                {showRuleForm && hasAdminPermission('trust_safety.mutate') ? (
                                    <form className="grid gap-3 border-b border-[#d6e6e0] bg-[#f4faf7] p-4 sm:grid-cols-2 sm:p-5" onSubmit={(event) => {
                                        event.preventDefault();
                                        run(() => createAdminFoodRuleDraft({
                                            ruleKey: ruleForm.ruleKey.trim(),
                                            ruleType: ruleForm.ruleType,
                                            jurisdictionCode: ruleForm.jurisdictionCode.trim().toUpperCase(),
                                            definition: { description: ruleForm.description.trim() },
                                            evidenceSourceIds: [], effectiveFrom: null, effectiveTo: null,
                                            changeReason: ruleForm.changeReason.trim(),
                                        }), 'Food rule draft saved. A different authorised reviewer must activate it.').then((result) => {
                                            if (result) { setShowRuleForm(false); setRuleForm({ ruleKey: '', ruleType: 'allergen', jurisdictionCode: 'IN', description: '', changeReason: '' }); }
                                        });
                                    }}>
                                        <label className="min-w-0 text-sm font-semibold text-stone-700">Rule name / identifier
                                            <input className={`${inputClass} mt-1`} required minLength={2} maxLength={120} placeholder="e.g. milk-allergen-policy" value={ruleForm.ruleKey} onChange={(e) => setRuleForm((s) => ({...s, ruleKey: e.target.value}))} />
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">Rule topic
                                                <select className={`${inputClass} mt-1`} value={ruleForm.ruleType} onChange={(e) => setRuleForm((s) => ({...s, ruleType: e.target.value}))}><option value="allergen">Allergens</option><option value="nutrition">Nutrition</option><option value="dietary">Dietary</option></select>
                                            </label>
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">Country / region
                                                <input className={`${inputClass} mt-1`} required minLength={2} maxLength={20} value={ruleForm.jurisdictionCode} onChange={(e) => setRuleForm((s) => ({...s, jurisdictionCode: e.target.value}))} />
                                            </label>
                                        </div>
                                        <label className="min-w-0 text-sm font-semibold text-stone-700 sm:col-span-2">Rule details
                                            <textarea className={`${inputClass} mt-1 min-h-[85px]`} required minLength={10} maxLength={4000} value={ruleForm.description} onChange={(e) => setRuleForm((s) => ({...s, description: e.target.value}))} placeholder="Describe the food-safety rule clearly for review." />
                                        </label>
                                        <label className="min-w-0 text-sm font-semibold text-stone-700 sm:col-span-2">Why is this rule needed?
                                            <input className={`${inputClass} mt-1`} required minLength={3} maxLength={1000} value={ruleForm.changeReason} onChange={(e) => setRuleForm((s) => ({...s, changeReason: e.target.value}))} placeholder="Reason for creating this draft" />
                                        </label>
                                        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                                            <p className="text-sm text-stone-600">Saving creates a draft, not an active safety decision. Recent MFA may be required.</p>
                                            <button type="submit" disabled={busy || ruleForm.description.trim().length < 10 || ruleForm.changeReason.trim().length < 3 || ruleForm.ruleKey.trim().length < 2} className={primaryButtonClass}>Save rule draft</button>
                                        </div>
                                    </form>
                                ) : null}
                                {policyLoadIssues.rules ? (
                                    <p role="alert" className="p-4 text-sm text-rose-700">Food rules could not load: {policyLoadIssues.rules}. Select Refresh to retry.</p>
                                ) : !policy?.ruleProfiles?.length ? (
                                    <div className="px-4 py-5 sm:px-6"><p className="text-sm font-bold text-stone-900">No food rules have been created yet.</p><p className="mt-1 text-sm text-stone-600">Start with a draft using Create food rule above.</p></div>
                                ) : (
                                    <div className="divide-y divide-stone-100">
                                        {(policyRulesExpanded ? policy.ruleProfiles : policy.ruleProfiles.slice(0, 6)).map((rule) => (
                                            <div key={rule.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                                                <div className="min-w-0">
                                                    <p className="break-words text-sm font-bold text-stone-900">{rule.ruleKey}</p>
                                                    <p className="mt-0.5 text-sm text-stone-600">{titleize(rule.ruleType)} · {rule.jurisdictionCode || 'All regions'} · Version {rule.version}</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rule.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{titleize(rule.status)}</span>
                                                    {rule.status === 'draft' && hasAdminPermission('trust_safety.mutate') ? (
                                                        <button type="button" disabled={busy} onClick={() => {
                                                            const reason = window.prompt('Approval reason (another authorised reviewer must approve this draft):', ruleActionReason);
                                                            if (!reason || reason.trim().length < 3) return;
                                                            setRuleActionReason(reason);
                                                            run(() => activateAdminFoodRule(rule.id, reason.trim()), 'Food rule activated.');
                                                        }} className="focus-ring rounded-lg border border-[#badace] bg-white px-3 py-2 text-sm font-bold text-[#176448] disabled:opacity-50">Approve draft</button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                        {policy.ruleProfiles.length > 6 ? <button type="button" onClick={() => setPolicyRulesExpanded((v) => !v)} className="focus-ring w-full px-4 py-3 text-left text-sm font-bold text-emerald-800">{policyRulesExpanded ? 'Show fewer' : `View all ${policy.ruleProfiles.length} rules`}</button> : null}
                                    </div>
                                )}
                                <p className="border-t border-stone-100 px-3 py-2 text-sm text-stone-600 sm:px-6 sm:py-3"><span className="sm:hidden">A different admin must approve.</span><span className="hidden sm:inline">Only authorised food-safety admins can change rules. The creator cannot approve their own draft.</span></p>
                            </section>

                            <section className="overflow-hidden rounded-2xl border border-[#dad8ed] bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#eeeaf8] px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-[#66558b]">02 · Feature availability</p>
                                        <h2 className="mt-0.5 text-xl font-extrabold text-[#302850]">Manage platform features</h2>
                                        <p className="mt-1 text-sm leading-5 text-[#615779]"><span className="sm:hidden">Choose where a feature runs.</span><span className="hidden sm:inline">Enable or pause a feature in its selected environment. This does not change account permissions.</span></p>
                                    </div>
                                    <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[#5c5084]">{policyLoadIssues.flags ? 'Unavailable' : `${policy?.featureFlags?.length ?? 0} features`}</span>
                                </div>
                                {isRootSuperAdmin ? (
                                    <div className="grid gap-3 border-b border-[#e8e4f2] bg-[#faf9fd] p-3 sm:grid-cols-2 sm:p-5">
                                        <p className="text-sm font-semibold text-[#4f416f] sm:hidden">Tap a feature to enable or pause it.</p>
                                        <label className="hidden min-w-0 text-sm font-semibold text-stone-700 sm:block">New feature reason <span className="font-normal text-stone-500">(10+ characters)</span>
                                            <input className={`${inputClass} mt-1`} minLength={10} value={featureFlagForm.reason} placeholder="e.g. Feature passed final checks" onChange={(e) => setFeatureFlagForm((s) => ({ ...s, reason: e.target.value }))} />
                                        </label>
                                        <label className="hidden min-w-0 text-sm font-semibold text-stone-700 sm:block">New feature reference
                                            <input className={`${inputClass} mt-1`} value={featureFlagForm.evidenceLabel} placeholder="e.g. QA-2026-010" onChange={(e) => setFeatureFlagForm((s) => ({ ...s, evidenceLabel: e.target.value }))} />
                                        </label>
                                        <p className="text-sm text-stone-600 sm:col-span-2"><span className="sm:hidden">Each change needs a reason and MFA.</span><span className="hidden sm:inline">Select a feature to enter its reason and reference. Saving also requires recent MFA.</span></p>
                                    </div>
                                ) : <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">Only the Root Super Admin can enable, pause or create features.</p>}
                                {policyLoadIssues.flags ? (
                                    <p role="alert" className="p-4 text-sm text-rose-700">Features could not load: {policyLoadIssues.flags}. Select Refresh to retry.</p>
                                ) : !policy?.featureFlags?.length ? (
                                    <p className="p-4 text-sm text-stone-600 sm:p-5">No platform features found yet. Use Add a feature below if you have Root Super Admin access.</p>
                                ) : (
                                    <div className="divide-y divide-stone-100">
                                        {(policyFlagsExpanded ? policy.featureFlags : policy.featureFlags.slice(0, 8)).map((flag) => {
                                            return (
                                                <div key={flag.id} className="grid min-w-0 gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-3">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="break-words text-sm font-extrabold text-stone-900">{flag.key}</p>
                                                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${flag.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{flag.enabled ? 'Enabled' : 'Paused'}</span>
                                                        </div>
                                                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-600 sm:line-clamp-none">{flag.description || 'No description provided.'}</p>
                                                        <p className="mt-1 text-sm text-[#625986]">{(flag.environments || []).length ? flag.environments.map((env) => ({ development: 'Testing site', staging: 'Preview site', production: 'Live site' }[env] || env)).join(', ') : 'No site selected'} · {flag.enabled && flag.rolloutPercentage > 0 ? `${flag.rolloutPercentage}% of visitors` : 'Not shown to visitors'}</p>
                                                    </div>
                                                    {isRootSuperAdmin ? (
                                                        <div className="min-w-0">
                                                            <button type="button" disabled={busy || Boolean(policyLoadIssues.flags)}
                                                                aria-expanded={policyFlagAction?.id === flag.id}
                                                                onClick={() => beginPolicyFlagAction(flag)}
                                                                className={`focus-ring w-full rounded-lg border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${flag.enabled ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-[#165b48] bg-[#165b48] text-white hover:bg-[#0e4334]'}`}>
                                                                {policyFlagAction?.id === flag.id ? 'Close changes' : (flag.enabled ? 'Pause feature' : 'Enable feature')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs font-medium text-stone-500">Only the Root Super Admin can change this feature.</p>
                                                    )}
                                                    {isRootSuperAdmin && policyFlagAction?.id === flag.id ? (
                                                        <div className="min-w-0 rounded-xl border border-[#ddd4ef] bg-[#f8f6fd] p-3 sm:col-span-2 sm:p-4">
                                                            <p className="text-sm font-bold text-[#392d61]">{policyFlagAction.enabled ? 'Enable' : 'Pause'} {flag.key}</p>
                                                            <p className="mt-1 text-sm text-stone-600">{policyFlagAction.enabled ? 'Choose the site and how many visitors can see it.' : 'Pause this feature without deleting it.'} Every change is recorded.</p>
                                                            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                                                                {(flag.environments || []).length ? (
                                                                    <p className="min-w-0 self-center text-sm font-semibold text-stone-700">Assigned sites: <span className="font-normal">{flag.environments.map((env) => ({ development: 'Testing site', staging: 'Preview site', production: 'Live website' }[env] || env)).join(', ')}</span></p>
                                                                ) : (
                                                                    <label className="min-w-0 text-sm font-semibold text-stone-700">Assign a site
                                                                        <select className={`${inputClass} mt-1`} value={policyFlagAction.environment} onChange={(e) => setPolicyFlagAction((s) => ({ ...s, environment: e.target.value }))}>
                                                                            <option value="development">Testing site</option><option value="staging">Preview site</option><option value="production">Live website</option>
                                                                        </select>
                                                                    </label>
                                                                )}
                                                                {policyFlagAction.enabled ? (
                                                                    <label className="min-w-0 text-sm font-semibold text-stone-700">Visitors who can see it (%)
                                                                        <input type="number" min="1" max="100" className={`${inputClass} mt-1`} value={policyFlagAction.rollout} onChange={(e) => setPolicyFlagAction((s) => ({ ...s, rollout: e.target.value }))} />
                                                                    </label>
                                                                ) : <p className="self-center text-sm text-stone-600">The feature will stop running.</p>}
                                                                <label className="min-w-0 text-sm font-semibold text-stone-700">Reason for change
                                                                    <input className={`${inputClass} mt-1`} maxLength={4000} placeholder="Why is this change needed?" value={policyFlagAction.reason} onChange={(e) => setPolicyFlagAction((s) => ({ ...s, reason: e.target.value }))} />
                                                                </label>
                                                                <label className="min-w-0 text-sm font-semibold text-stone-700">Reference (required for live / high-risk)
                                                                    <input className={`${inputClass} mt-1`} placeholder="Approval ticket or evidence" value={policyFlagAction.reference} onChange={(e) => setPolicyFlagAction((s) => ({ ...s, reference: e.target.value }))} />
                                                                </label>
                                                            </div>
                                                            <p className="mt-2 text-sm text-[#675b7d]">Root Super Admin access and recent MFA are required. Live/high-risk changes also need evidence.</p>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <button type="button" className={primaryButtonClass} disabled={busy || policyFlagAction.reason.trim().length < 10 || (policyFlagAction.enabled && !(Number(policyFlagAction.rollout) >= 1 && Number(policyFlagAction.rollout) <= 100)) || ((flag.riskLevel === 'high' || flag.riskLevel === 'critical' || (policyFlagAction.enabled && ((flag.environments || []).includes('production') || (!(flag.environments || []).length && policyFlagAction.environment === 'production')))) && !policyFlagAction.reference.trim())} onClick={() => {
                                                                    const current = policyFlagAction;
                                                                    run(() => updateAdminFeatureFlag(flag.id, {
                                                                        enabled: current.enabled,
                                                                        ...((!flag.enabled && current.enabled && !(flag.environments || []).length) ? { environments: [current.environment] } : {}),
                                                                        ...(current.enabled ? { rolloutPercentage: Number(current.rollout) } : {}),
                                                                        reason: current.reason.trim(),
                                                                        evidence: current.reference.trim() ? [{ type: 'external_reference', label: current.reference.trim(), referenceId: '', uri: '', checksumSha256: '', note: '' }] : [],
                                                                    }), `${flag.key} ${current.enabled ? 'enabled' : 'paused'} successfully.`).then((result) => {
                                                                        if (result) setPolicyFlagAction(null);
                                                                    });
                                                                }}>{policyFlagAction.enabled ? 'Confirm enable' : 'Confirm pause'}</button>
                                                                <button type="button" onClick={() => setPolicyFlagAction(null)} className="focus-ring rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700">Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                        {policy.featureFlags.length > 8 ? <button type="button" onClick={() => setPolicyFlagsExpanded((v) => !v)} className="focus-ring w-full px-4 py-3 text-left text-sm font-bold text-emerald-800">{policyFlagsExpanded ? 'Show fewer features' : `View all ${policy.featureFlags.length} features`}</button> : null}
                                    </div>
                                )}
                            </section>

                            {isRootSuperAdmin ? (
                                <section className="overflow-hidden rounded-2xl border border-[#cfe4d4] bg-[#f0f7ef]">
                                    <button type="button" onClick={() => setShowFlagForm((v) => !v)} className="focus-ring flex w-full items-center justify-between gap-2 px-3 py-3 text-left sm:gap-3 sm:px-6 sm:py-4">
                                        <span className="min-w-0"><span className="block text-sm font-bold text-emerald-800">03 · New feature</span><span className="mt-1 block text-xl font-extrabold text-[#184333]">Add a feature control</span><span className="mt-1 block text-sm text-[#476351]"><span className="sm:hidden">Add it paused. Enable later.</span><span className="hidden sm:inline">Create a paused feature now; enable it when it's ready.</span></span></span>
                                        <span className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800">{showFlagForm ? 'Close' : 'Open form'}</span>
                                    </button>
                                    {showFlagForm ? (
                                        <div className="grid gap-3 border-t border-[#d8e8da] p-3 sm:grid-cols-2 sm:p-6">
                                            <label className="min-w-0 text-sm font-semibold text-stone-700 sm:hidden">Reason for creating this feature
                                                <input className={`${inputClass} mt-1`} minLength={10} value={featureFlagForm.reason} placeholder="Why is this needed?" onChange={(e) => setFeatureFlagForm((state) => ({ ...state, reason: e.target.value }))} />
                                            </label>
                                            <label className="min-w-0 text-sm font-semibold text-stone-700 sm:hidden">Approval ticket or reference
                                                <input className={`${inputClass} mt-1`} value={featureFlagForm.evidenceLabel} placeholder="e.g. QA-2026-010" onChange={(e) => setFeatureFlagForm((state) => ({ ...state, evidenceLabel: e.target.value }))} />
                                            </label>
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">Feature ID
                                                <input className={`${inputClass} mt-1`} placeholder="e.g. pantry.new-view" value={featureFlagForm.key} onChange={(e) => setFeatureFlagForm((s) => ({ ...s, key: e.target.value.toLowerCase() }))} />
                                            </label>
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">What does it do?
                                                <input className={`${inputClass} mt-1`} placeholder="Short description" value={featureFlagForm.description} onChange={(e) => setFeatureFlagForm((s) => ({ ...s, description: e.target.value }))} />
                                            </label>
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">Available in
                                                <select className={`${inputClass} mt-1`} value={featureFlagForm.environments} onChange={(e) => setFeatureFlagForm((s) => ({ ...s, environments: e.target.value }))}><option value="development">Testing (development)</option><option value="staging">Preview (staging)</option><option value="production">Live website (production)</option></select>
                                            </label>
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">Impact level
                                                <select className={`${inputClass} mt-1`} value={featureFlagForm.riskLevel} onChange={(e) => setFeatureFlagForm((s) => ({ ...s, riskLevel: e.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
                                            </label>
                                            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                                                <p className="text-sm leading-5 text-[#486455]">The change reason and ticket above are required. All new features start paused.</p>
                                                <button type="button" disabled={busy || Boolean(policyLoadIssues.flags) || !/^[a-z][a-z0-9_.-]{2,}$/.test(featureFlagForm.key.trim()) || featureFlagForm.description.trim().length < 5 || featureFlagForm.reason.trim().length < 10 || !featureFlagForm.evidenceLabel.trim()} onClick={() => run(() => createAdminFeatureFlag({
                                                    key: featureFlagForm.key.trim(), description: featureFlagForm.description.trim(), enabled: false,
                                                    environments: [featureFlagForm.environments], rolloutPercentage: 0, ownerDomain: 'admin',
                                                    riskLevel: featureFlagForm.riskLevel, expiresAt: null, reason: featureFlagForm.reason.trim(),
                                                    evidence: [{ type: 'external_reference', label: featureFlagForm.evidenceLabel.trim(), referenceId: '', uri: '', checksumSha256: '', note: '' }],
                                                }), 'Feature created in paused state.').then((result) => { if (result) setShowFlagForm(false); })} className={primaryButtonClass}>Create paused feature</button>
                                            </div>
                                        </div>
                                    ) : null}
                                </section>
                            ) : null}

                            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                                <div className="bg-[#edf2f4] px-3 py-3 sm:px-6 sm:py-4">
                                    <h2 className="text-xl font-extrabold text-stone-900">Related admin work</h2>
                                    <p className="mt-1 text-sm text-stone-600"><span className="sm:hidden">Review cases, incidents and support.</span><span className="hidden sm:inline">Check review requests, platform incidents and support issues filed under the Admin area.</span></p>
                                </div>
                                {policyRelatedIssues.length ? <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Some admin records could not load: {policyRelatedIssues.join(' · ')}. Select Refresh to retry.</p> : null}
                                <div className="grid gap-px bg-stone-200 lg:grid-cols-3">
                                    {[
                                        ['Review requests', 'Cases waiting for an admin decision.', reviewCases, setSelectedReviewCase],
                                        ['Incidents', 'Issues being investigated or resolved.', incidents, setSelectedIncident],
                                        ['Support requests', 'Help requests assigned to the Admin area.', supportCases, setSelectedSupportCase],
                                    ].map(([name, help, records, select]) => (
                                        <div key={name} className="min-w-0 bg-white p-4 sm:p-5">
                                            <div className="flex items-center justify-between gap-2"><h3 className="text-base font-extrabold text-stone-900">{name}</h3><span className="rounded-full bg-[#e8f0ed] px-2.5 py-1 text-sm font-bold text-[#225c45]">{records.length}</span></div>
                                            <p className="mt-1 text-sm text-stone-600">{help}</p>
                                            {records.length ? <div className="mt-3 space-y-1.5">{records.slice(0, 3).map((record) => (
                                                <button key={record.id} type="button" onClick={() => select(record)} className="focus-ring block w-full rounded-lg bg-[#f6f8f7] px-3 py-2 text-left text-sm font-semibold text-[#195b45] hover:bg-[#e8f3ed]">{record.title || record.subject?.label || record.reviewCaseKey || record.incidentKey || record.supportKey || 'Open record'} →</button>
                                            ))}</div> : <p className="mt-3 text-sm font-medium text-stone-500">No records in this Admin area right now.</p>}
                                        </div>
                                    ))}
                                </div>
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
                        <div className="-mx-2.5 -mb-2.5 mt-2.5 min-h-[100svh] bg-[#f2f3ef] sm:-mx-5 sm:-mb-5 sm:mt-5 lg:-mx-6 lg:-mb-6">
                            <section className="bg-[#0f4d45] text-white">
                                <div className="grid gap-5 px-4 py-5 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:gap-10 lg:px-9 lg:py-9">
                                    <div className="max-w-3xl">
                                        <p className="text-[10px] font-black tracking-[0.08em] text-[#a8ddd3] sm:text-xs">
                                            Product quality desk
                                        </p>

                                        <h2 className="mt-1.5 max-w-3xl text-[22px] font-black leading-[1.1] sm:mt-2 sm:text-[34px] sm:leading-[1.08]">
                                            See what needs attention, then open the right review workspace.
                                        </h2>

                                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-[1.45] text-white/72 sm:hidden">
                                            Reviews, duplicates, batch issues and catalog approvals are grouped here.
                                        </p>
                                        <p className="mt-3 hidden max-w-2xl text-[15px] font-semibold leading-6 text-white/72 sm:block">
                                            Use this page as the starting point for product data checks. It shows what is waiting, what may be duplicated, and where each issue should be resolved.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-4 border-y border-white/15 lg:border-y-0 lg:border-l lg:border-white/15">
                                        {[
                                            ['Waiting review', dataQualitySummary.waitingReview],
                                            ['Duplicates', dataQualitySummary.possibleDuplicates],
                                            ['Catalog', dataQualitySummary.catalogReview],
                                            ['Attention', dataQualitySummary.needsAttention],
                                        ].map(([label, value], index) => (
                                            <div
                                                key={label}
                                                className={`px-2.5 py-3 sm:px-4 sm:py-4 lg:px-5 ${index < 3 ? 'border-r border-white/15' : ''}`}
                                            >
                                                <p className="text-xl font-black sm:text-[30px]">
                                                    {value}
                                                </p>
                                                <p className="mt-0.5 text-[9px] font-bold leading-3 text-white/58 sm:mt-1 sm:text-[11px] sm:leading-4">
                                                    {label}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <section className="border-b border-stone-300 bg-[#edf1ef]">
                                <div className="px-4 pt-4 sm:px-7 sm:pt-6 lg:px-9">
                                    <p className="text-[10px] font-black tracking-[0.08em] text-[#16665c] sm:text-xs">
                                        How to use this page
                                    </p>
                                    <h3 className="mt-1 text-lg font-black text-stone-950 sm:text-2xl">
                                        Follow the issue from review to final catalog decision.
                                    </h3>
                                </div>

                                <div className="mt-3 grid grid-cols-1 border-t border-stone-300/80 lg:mt-5 lg:grid-cols-4">
                                    <DataQualityStep
                                        number={1}
                                        title="Check new product reviews"
                                        body="Start with products waiting for a decision or more proof."
                                        mobileBody="Review products waiting for a decision."
                                        icon={SearchCheck}
                                    />
                                    <DataQualityStep
                                        number={2}
                                        title="Compare possible duplicates"
                                        body="Check whether a submitted product already exists in the catalog."
                                        mobileBody="Compare products that may already exist."
                                        icon={Boxes}
                                    />
                                    <DataQualityStep
                                        number={3}
                                        title="Resolve product data issues"
                                        body="Open the review or batch workspace when proof or product data is incomplete."
                                        mobileBody="Fix missing proof or batch issues."
                                        icon={FileWarning}
                                    />
                                    <DataQualityStep
                                        number={4}
                                        title="Finish catalog approval"
                                        body="Complete the final checks before a governed product can move forward."
                                        mobileBody="Finish checks before catalog approval."
                                        icon={CheckCircle2}
                                    />
                                </div>
                            </section>

                            {dataQualityError ? (
                                <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 sm:px-7 sm:py-3 sm:text-sm lg:px-9">
                                    {dataQualityError}
                                </div>
                            ) : null}

                            {dataQualityLoading ? (
                                <div className="grid min-h-[220px] place-items-center bg-white sm:min-h-[320px]">
                                    <div className="text-center">
                                        <LoaderCircle className="mx-auto animate-spin text-[#126a60]" />
                                        <p className="mt-2 text-xs font-bold text-stone-500 sm:mt-3 sm:text-sm">
                                            Loading current product quality data…
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[#f7f7f4]">
                                    <div className="grid gap-3 border-b border-stone-300 bg-white px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-7 sm:py-6 lg:px-9">
                                        <div>
                                            <p className="text-[10px] font-black tracking-[0.08em] text-[#5a6a65] sm:text-xs">
                                                Work waiting for you
                                            </p>
                                            <h3 className="mt-1 text-xl font-black text-stone-950 sm:text-[28px]">
                                                Four workstreams, one quality view.
                                            </h3>
                                            <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-stone-600 sm:text-sm sm:leading-6">
                                                Open the workstream that matches the problem instead of changing product records from this summary page.
                                            </p>
                                        </div>

                                        <p className="text-xs font-bold text-stone-500 sm:text-sm">
                                            {dataQualitySummary.waitingReview + dataQualitySummary.possibleDuplicates + dataQualitySummary.catalogReview + dataQualitySummary.needsAttention} items currently need attention
                                        </p>
                                    </div>

                                    <section className="grid border-b border-stone-300 bg-white lg:grid-cols-[72px_300px_minmax(0,1fr)]">
                                        <div className="hidden border-r border-stone-200 px-4 py-6 text-[36px] font-black leading-none text-[#b7d8cf] lg:block">
                                            01
                                        </div>
                                        <div className="border-b border-stone-200 border-l-[4px] border-l-[#2b7c70] px-4 py-4 sm:px-6 sm:py-5 lg:border-b-0 lg:border-l-0 lg:border-r lg:px-6 lg:py-6">
                                            <div className="flex items-start justify-between gap-3 lg:block">
                                                <div>
                                                    <p className="text-[10px] font-black text-[#16665c] sm:text-xs">
                                                        Product review queue
                                                    </p>
                                                    <h4 className="mt-1 text-base font-black text-stone-950 sm:text-lg">
                                                        Products waiting for a decision
                                                    </h4>
                                                </div>
                                                <Link
                                                    to="/admin/product-intelligence"
                                                    className="focus-ring shrink-0 text-xs font-black text-[#16665c] underline decoration-[#16665c]/30 underline-offset-4 sm:text-sm lg:mt-4 lg:inline-flex"
                                                >
                                                    Open review
                                                </Link>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-[1.45] text-stone-600 sm:hidden">
                                                Check product details and proof before Catalog.
                                            </p>
                                            <p className="mt-2 hidden text-sm font-semibold leading-5 text-stone-600 sm:block">
                                                Review submitted product details and proof before sending them to Catalog.
                                            </p>
                                        </div>

                                        <div className="min-w-0 bg-[#fbfcfb]">
                                            {(dataQualityWorkspace.drafts || []).length ? (
                                                <div>
                                                    {(dataQualityWorkspace.drafts || []).slice(0, 8).map((draft) => (
                                                        <DataQualityRow
                                                            key={draft.id}
                                                            title={dataQualityDraftName(draft)}
                                                            meta={draft.duplicateCandidateProductVersionId
                                                                ? 'Possible duplicate found · compare this product before approving it.'
                                                                : draft.safetyReviewRequired
                                                                    ? 'Extra safety check required before this product can move forward.'
                                                                    : 'Submitted product is waiting for a review decision.'}
                                                            status={draft.duplicateCandidateProductVersionId
                                                                ? 'Possible duplicate'
                                                                : dataQualityStatusLabel(draft.status)}
                                                            tone={draft.duplicateCandidateProductVersionId
                                                                ? 'coral'
                                                                : draft.status === 'needs_more_evidence'
                                                                    ? 'blue'
                                                                    : 'green'}
                                                            to="/admin/product-intelligence"
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="px-4 py-4 text-xs font-semibold text-stone-500 sm:px-5 sm:py-6 sm:text-sm lg:px-6">
                                                    No products are waiting for review right now.
                                                </p>
                                            )}
                                        </div>
                                    </section>

                                    <section className="grid border-b border-stone-300 bg-[#f4f7f9] lg:grid-cols-[72px_300px_minmax(0,1fr)]">
                                        <div className="hidden border-r border-stone-200 px-4 py-6 text-[36px] font-black leading-none text-[#c0d3e1] lg:block">
                                            02
                                        </div>
                                        <div className="border-b border-stone-200 border-l-[4px] border-l-[#5d7f9a] px-4 py-4 sm:px-6 sm:py-5 lg:border-b-0 lg:border-l-0 lg:border-r lg:px-6 lg:py-6">
                                            <div className="flex items-start justify-between gap-3 lg:block">
                                                <div>
                                                    <p className="text-[10px] font-black text-[#355a76] sm:text-xs">
                                                        Possible duplicates
                                                    </p>
                                                    <h4 className="mt-1 text-base font-black text-stone-950 sm:text-lg">
                                                        Products that may already exist
                                                    </h4>
                                                </div>
                                                <span className="shrink-0 text-lg font-black text-[#355a76] sm:text-xl lg:mt-4 lg:block">
                                                    {dataQualitySummary.possibleDuplicates}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-[1.45] text-stone-600 sm:hidden">
                                                Compare matches before keeping or approving a record.
                                            </p>
                                            <p className="mt-2 hidden text-sm font-semibold leading-5 text-stone-600 sm:block">
                                                Compare matching records before deciding which product should move forward.
                                            </p>
                                        </div>

                                        <div className="min-w-0 bg-white/60">
                                            {dataQualityDuplicateDrafts.length ? (
                                                dataQualityDuplicateDrafts.map((draft) => (
                                                    <DataQualityRow
                                                        key={draft.id}
                                                        title={dataQualityDraftName(draft)}
                                                        meta="A matching catalog product was found. Compare both records before deciding what to keep."
                                                        status="Compare records"
                                                        tone="coral"
                                                        to="/admin/product-intelligence"
                                                    />
                                                ))
                                            ) : (
                                                <p className="px-4 py-4 text-xs font-semibold text-stone-500 sm:px-5 sm:py-6 sm:text-sm lg:px-6">
                                                    No possible duplicates need review right now.
                                                </p>
                                            )}
                                        </div>
                                    </section>

                                    <section className="grid border-b border-stone-300 bg-[#f2f7f4] lg:grid-cols-[72px_300px_minmax(0,1fr)]">
                                        <div className="hidden border-r border-stone-200 px-4 py-6 text-[36px] font-black leading-none text-[#b9d9c8] lg:block">
                                            03
                                        </div>
                                        <div className="border-b border-stone-200 border-l-[4px] border-l-[#4c8b67] px-4 py-4 sm:px-6 sm:py-5 lg:border-b-0 lg:border-l-0 lg:border-r lg:px-6 lg:py-6">
                                            <div className="flex items-start justify-between gap-3 lg:block">
                                                <div>
                                                    <p className="text-[10px] font-black text-[#236748] sm:text-xs">
                                                        Catalog approval
                                                    </p>
                                                    <h4 className="mt-1 text-base font-black text-stone-950 sm:text-lg">
                                                        Products waiting for final approval
                                                    </h4>
                                                </div>
                                                <span className="shrink-0 text-lg font-black text-[#236748] sm:text-xl lg:mt-4 lg:block">
                                                    {dataQualityWorkspace.versionTotal}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-[1.45] text-stone-600 sm:hidden">
                                                Finish the final catalog check before publishing.
                                            </p>
                                            <p className="mt-2 hidden text-sm font-semibold leading-5 text-stone-600 sm:block">
                                                Review governed product versions that are waiting for final catalog approval.
                                            </p>
                                            <Link
                                                to="/admin/catalog"
                                                className="focus-ring mt-2.5 inline-flex w-fit items-center text-xs font-black text-[#236748] underline decoration-[#236748]/30 underline-offset-4 sm:mt-4 sm:text-sm"
                                            >
                                                Open Catalog & Listings
                                            </Link>
                                        </div>

                                        <div className="min-w-0 bg-white/65">
                                            {(dataQualityWorkspace.versions || []).length ? (
                                                (dataQualityWorkspace.versions || []).slice(0, 6).map((version) => (
                                                    <DataQualityRow
                                                        key={version.id}
                                                        title={version.displayName || 'Unnamed catalog product'}
                                                        meta={version.gtin
                                                            ? `Barcode ${version.gtin}`
                                                            : 'No barcode recorded for this product version.'}
                                                        status="In review"
                                                        tone="green"
                                                        to="/admin/catalog"
                                                    />
                                                ))
                                            ) : (
                                                <p className="px-4 py-4 text-xs font-semibold text-stone-500 sm:px-5 sm:py-6 sm:text-sm lg:px-6">
                                                    No products are waiting for catalog approval right now.
                                                </p>
                                            )}
                                        </div>
                                    </section>

                                    <section className="grid bg-[#f5f5f2] lg:grid-cols-[72px_300px_minmax(0,1fr)]">
                                        <div className="hidden border-r border-stone-200 px-4 py-6 text-[36px] font-black leading-none text-[#ccd2d0] lg:block">
                                            04
                                        </div>
                                        <div className="border-b border-stone-200 border-l-[4px] border-l-[#5d6b70] px-4 py-4 sm:px-6 sm:py-5 lg:border-b-0 lg:border-l-0 lg:border-r lg:px-6 lg:py-6">
                                            <div className="flex items-start justify-between gap-3 lg:block">
                                                <div>
                                                    <p className="text-[10px] font-black text-[#4f6471] sm:text-xs">
                                                        Host batch checks
                                                    </p>
                                                    <h4 className="mt-1 text-base font-black text-stone-950 sm:text-lg">
                                                        Uploaded batches needing attention
                                                    </h4>
                                                </div>
                                                <Link
                                                    to="/admin/bulk-product-review"
                                                    className="focus-ring shrink-0 text-xs font-black text-[#3e5965] underline decoration-[#3e5965]/30 underline-offset-4 sm:text-sm lg:mt-4 lg:inline-flex"
                                                >
                                                    Open batches
                                                </Link>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-[1.45] text-stone-600 sm:hidden">
                                                Check uploads with missing proof, errors or duplicate warnings.
                                            </p>
                                            <p className="mt-2 hidden text-sm font-semibold leading-5 text-stone-600 sm:block">
                                                Open a batch when products have validation problems, missing proof or duplicate warnings.
                                            </p>
                                        </div>

                                        <div className="min-w-0 bg-white/65">
                                            {dataQualityAttentionBatches.length ? (
                                                dataQualityAttentionBatches.map((batch) => {
                                                    const issueCount =
                                                        Number(batch?.review?.validationIssues || 0) +
                                                        Number(batch?.review?.needsEvidence || 0);
                                                    const duplicateCount =
                                                        Number(batch?.review?.potentialDuplicates || 0);

                                                    return (
                                                        <DataQualityRow
                                                            key={batch.id}
                                                            title={batch?.organization?.displayName || 'Host submission'}
                                                            meta={`${batch.sourceFileName || 'Uploaded batch'} · ${issueCount} item${issueCount === 1 ? '' : 's'} need attention · ${duplicateCount} possible duplicate${duplicateCount === 1 ? '' : 's'}`}
                                                            status={dataQualityStatusLabel(batch.status)}
                                                            tone={duplicateCount > 0 ? 'coral' : 'blue'}
                                                            to="/admin/bulk-product-review"
                                                        />
                                                    );
                                                })
                                            ) : (
                                                <p className="px-4 py-4 text-xs font-semibold text-stone-500 sm:px-5 sm:py-6 sm:text-sm lg:px-6">
                                                    No Host batches need a quality review right now.
                                                </p>
                                            )}
                                        </div>
                                    </section>

                                    <section className="grid border-t border-stone-300 bg-[#102f35] text-white sm:grid-cols-3">
                                        <Link
                                            to="/admin/product-intelligence"
                                            className="focus-ring border-b border-white/12 px-4 py-3.5 transition hover:bg-white/[0.05] sm:border-b-0 sm:border-r sm:px-6 sm:py-5"
                                        >
                                            <p className="text-sm font-black">Review submitted products</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-white/60">
                                                Check product facts, proof and duplicate warnings.
                                            </p>
                                        </Link>

                                        <Link
                                            to="/admin/bulk-product-review"
                                            className="focus-ring border-b border-white/12 px-4 py-3.5 transition hover:bg-white/[0.05] sm:border-b-0 sm:border-r sm:px-6 sm:py-5"
                                        >
                                            <p className="text-sm font-black">Review Host batches</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-white/60">
                                                Resolve batch issues and duplicate warnings.
                                            </p>
                                        </Link>

                                        <Link
                                            to="/admin/catalog"
                                            className="focus-ring px-4 py-3.5 transition hover:bg-white/[0.05] sm:px-6 sm:py-5"
                                        >
                                            <p className="text-sm font-black">Open Catalog & Listings</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-white/60">
                                                Finish approvals and manage governed records.
                                            </p>
                                        </Link>
                                    </section>
                                </div>
                            )}
                        </div>
                    ) : null}
  
                    {section === 'recipeReview' ? (
                        <div className="-m-2.5 min-h-[100svh] bg-[#f4f3ee] sm:-m-5 lg:-m-6">
                            <section className="border-b border-[#183f4a] bg-[#173b4f] text-white">
                                <div className="grid gap-5 px-4 py-5 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-end lg:gap-12">
                                    <div className="max-w-3xl">
                                        <p className="text-[10px] font-black tracking-[0.12em] text-[#a9d8c5] sm:text-xs">
                                            Recipe publishing review
                                        </p>
                                        <h2 className="mt-1.5 max-w-2xl text-[22px] font-black leading-[1.12] sm:mt-2 sm:text-[32px] sm:leading-[1.08]">
                                            <span className="sm:hidden">Review recipes and move each one to the right next step.</span>
                                            <span className="hidden sm:inline">Review recipes, check food readiness, and move each recipe to the right next step.</span>
                                        </h2>
                                        <p className="mt-2 line-clamp-2 max-w-2xl text-[11px] font-semibold leading-4 text-white/72 sm:mt-3 sm:block sm:text-sm sm:leading-6">
                                            <span className="sm:hidden">Start with recipes waiting for you, check food readiness, then continue the review.</span>
                                            <span className="hidden sm:inline">Use this workspace to see what is waiting for review, whether the food check is ready, and where to continue the decision.</span>
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-4 border-y border-white/14 lg:border-y-0 lg:border-l">
                                        {[
                                            ['Waiting', recipeReviewWorkspace.waiting.length],
                                            ['Need food check', recipeReviewWorkspace.foodCheckNeeded.length],
                                            ['Published', recipeReviewWorkspace.published.length],
                                            ['Recipes loaded', recipeReviewWorkspace.recipes.length],
                                        ].map(([label, value], index) => (
                                            <div key={label} className={`px-2 py-3 text-center sm:px-3 sm:py-4 ${index > 0 ? 'border-l border-white/12' : ''}`}>
                                                <p className="text-lg font-black leading-none sm:text-2xl">{value}</p>
                                                <p className="mt-1 text-[9px] font-bold leading-3 text-white/62 sm:text-[11px] sm:leading-4">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <section className="border-b border-stone-300 bg-[#fbfcfa]">
                                <div className="px-4 pt-3 sm:px-7 sm:pt-5">
                                    <p className="text-[10px] font-black text-[#315f7a] sm:text-xs">How to review a recipe</p>
                                </div>
                                <div className="mt-2 grid grid-cols-2 border-t border-stone-200 lg:grid-cols-4">
                                    <RecipeReviewStep
                                        number={1}
                                        title="Check what is waiting"
                                        body="Start with recipes that are waiting for a Super Admin decision."
                                        mobileBody="Open recipes waiting for your decision."
                                        icon={SearchCheck}
                                    />
                                    <RecipeReviewStep
                                        number={2}
                                        title="Open the recipe"
                                        body="Check the ingredients, method, source, image and the latest recipe version."
                                        mobileBody="Check the recipe details and latest version."
                                        icon={CheckCircle2}
                                    />
                                    <RecipeReviewStep
                                        number={3}
                                        title="Check food readiness"
                                        body="Confirm that nutrition, allergen and dietary checks are ready before publishing."
                                        mobileBody="Confirm the food checks are ready."
                                        icon={ShieldCheck}
                                    />
                                    <RecipeReviewStep
                                        number={4}
                                        title="Choose the next step"
                                        body="Approve the recipe, send it back for changes, or continue publishing when it is ready."
                                        mobileBody="Approve, return or continue publishing."
                                        icon={Database}
                                    />
                                </div>
                            </section>

                            {recipeReviewError ? (
                                <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:px-7 sm:py-4 sm:text-sm">
                                    {recipeReviewError}
                                </div>
                            ) : null}

                            <section className="border-b border-[#c8ddd4] bg-white">
                                <div className="grid sm:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
                                    <div className="border-b border-[#c8ddd4] bg-[#dff1e9] px-4 py-4 sm:border-b-0 sm:border-r sm:px-6 sm:py-6">
                                        <p className="text-[10px] font-black text-[#176647] sm:text-xs">01 · Decisions waiting</p>
                                        <h3 className="mt-0.5 text-base font-black text-stone-950 sm:mt-1 sm:text-xl">Recipes that need your review</h3>
                                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-600 sm:text-sm sm:leading-5">
                                            <span className="sm:hidden">Open a recipe, check the details and decide what happens next.</span>
                                            <span className="hidden sm:inline">These recipes are waiting for a Super Admin decision. Open one to review the details and record the next step.</span>
                                        </p>
                                        <Link to="/admin/recipes" className="focus-ring mt-2 inline-flex text-xs font-black text-[#176647] underline decoration-[#176647]/30 underline-offset-4 sm:mt-4 sm:text-sm">
                                            Open Recipe Management
                                        </Link>
                                    </div>

                                    <div className="min-w-0">
                                        {recipeReviewLoading ? (
                                            <div className="flex items-center gap-2 px-4 py-4 text-xs font-bold text-stone-600 sm:px-7 sm:py-6 sm:text-sm">
                                                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                                                Loading recipes…
                                            </div>
                                        ) : recipeReviewWorkspace.waiting.length ? (
                                            recipeReviewWorkspace.waiting.slice(0, 10).map((item, index) => {
                                                const dish = item?.dish || {};
                                                const version = item?.latestVersion || {};
                                                const foodReady = item?.foodIntelligence?.approved === true;

                                                return (
                                                    <div key={version.id || dish.id || index} className={`grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1.5fr)_150px_150px_auto] sm:items-center sm:px-7 sm:py-4 ${index > 0 ? 'border-t border-stone-200' : ''}`}>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-stone-950 sm:text-[15px]">{dish.name || version.title || 'Untitled recipe'}</p>
                                                            <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-500 sm:text-xs sm:leading-5">
                                                                {recipeSourceLabel(version)} · Version {version.versionNumber || '—'} · {formatRecipeWorkspaceDate(version.submittedAt || version.updatedAt)}
                                                            </p>
                                                        </div>
                                                        <p className="text-xs font-bold text-stone-600">{dish.cuisine || 'Cuisine not set'}</p>
                                                        <p className={`text-xs font-black ${foodReady ? 'text-emerald-700' : 'text-[#a2543c]'}`}>
                                                            {foodReady ? 'Food check ready' : 'Food check needed'}
                                                        </p>
                                                        <Link to={version.id ? `/admin/recipes/${version.id}` : '/admin/recipes'} className="focus-ring w-fit text-xs font-black text-[#245b73] underline decoration-[#245b73]/30 underline-offset-4 sm:justify-self-end sm:text-sm">
                                                            Open recipe
                                                        </Link>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="px-4 py-5 sm:px-7 sm:py-7">
                                                <p className="text-sm font-black text-stone-900">No recipes need a decision right now.</p>
                                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-stone-500 sm:text-sm sm:leading-5">New Host or EPANTRY submissions will appear here when they are ready for review.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="border-b border-[#c9d9e2] bg-[#eaf2f6]">
                                <div className="grid sm:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
                                    <div className="border-b border-[#c9d9e2] px-4 py-4 sm:border-b-0 sm:border-r sm:px-6 sm:py-6">
                                        <p className="text-[10px] font-black text-[#315f7a] sm:text-xs">02 · Food readiness</p>
                                        <h3 className="mt-0.5 text-base font-black text-stone-950 sm:mt-1 sm:text-xl">Check whether the recipe is ready to publish</h3>
                                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-600 sm:text-sm sm:leading-5">
                                            <span className="sm:hidden">Recipes need approved food checks before they are ready to publish.</span>
                                            <span className="hidden sm:inline">Use the food check status to see which recipes still need nutrition, allergen or dietary review before publishing.</span>
                                        </p>
                                        <Link to="/admin/food-intelligence" className="focus-ring mt-2 inline-flex text-xs font-black text-[#315f7a] underline decoration-[#315f7a]/30 underline-offset-4 sm:mt-4 sm:text-sm">
                                            Open Food Checks
                                        </Link>
                                    </div>

                                    <div className="grid grid-cols-2 bg-white/75">
                                        <div className="border-r border-[#c9d9e2] px-4 py-4 sm:px-7 sm:py-6">
                                            <p className="text-2xl font-black text-[#a2543c] sm:text-3xl">{recipeReviewWorkspace.foodCheckNeeded.length}</p>
                                            <p className="mt-1 text-xs font-black text-stone-900 sm:text-sm">Still needs a food check</p>
                                            <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-stone-500 sm:text-xs">These recipes are not ready for publishing yet.</p>
                                        </div>
                                        <div className="px-4 py-4 sm:px-7 sm:py-6">
                                            <p className="text-2xl font-black text-emerald-700 sm:text-3xl">{recipeReviewWorkspace.foodCheckReady.length}</p>
                                            <p className="mt-1 text-xs font-black text-stone-900 sm:text-sm">Food check complete</p>
                                            <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-stone-500 sm:text-xs">These recipes have an approved food check.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="border-b border-stone-300 bg-[#f8f7f3]">
                                <div className="grid sm:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
                                    <div className="border-b border-stone-300 px-4 py-4 sm:border-b-0 sm:border-r sm:px-6 sm:py-6">
                                        <p className="text-[10px] font-black text-[#5b6470] sm:text-xs">03 · Recent recipe activity</p>
                                        <h3 className="mt-0.5 text-base font-black text-stone-950 sm:mt-1 sm:text-xl">See what changed recently</h3>
                                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-600 sm:text-sm sm:leading-5">
                                            <span className="sm:hidden">Recent recipes help you see what changed and where to manage it.</span>
                                            <span className="hidden sm:inline">Use recent activity to see the latest recipe status, food-check state and the right place to manage each record.</span>
                                        </p>
                                        <Link to="/admin/catalog" className="focus-ring mt-2 inline-flex text-xs font-black text-[#4f6471] underline decoration-[#4f6471]/30 underline-offset-4 sm:mt-4 sm:text-sm">
                                            Open Catalog & Listings
                                        </Link>
                                    </div>

                                    <div className="min-w-0 bg-white/72">
                                        {recipeReviewLoading ? (
                                            <div className="px-4 py-4 text-xs font-bold text-stone-500 sm:px-7 sm:py-6 sm:text-sm">Loading recent recipes…</div>
                                        ) : recipeReviewWorkspace.recent.length ? (
                                            recipeReviewWorkspace.recent.map((item, index) => {
                                                const dish = item?.dish || {};
                                                const version = item?.latestVersion || {};
                                                const foodReady = item?.foodIntelligence?.approved === true;
                                                const status = version.status === 'in_review'
                                                    ? 'Waiting for review'
                                                    : version.status === 'published'
                                                        ? 'Published'
                                                        : version.status === 'retired'
                                                            ? 'Retired'
                                                            : 'Draft';

                                                return (
                                                    <div key={version.id || dish.id || index} className={`grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.5fr)_150px_160px_auto] sm:items-center sm:px-7 sm:py-3.5 ${index > 0 ? 'border-t border-stone-200' : ''}`}>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-stone-950">{dish.name || version.title || 'Untitled recipe'}</p>
                                                            <p className="mt-0.5 truncate text-[11px] font-semibold text-stone-500">{dish.cuisine || 'Cuisine not set'} · Version {version.versionNumber || '—'}</p>
                                                        </div>
                                                        <p className="text-xs font-bold text-stone-600">{status}</p>
                                                        <p className={`text-xs font-black ${foodReady ? 'text-emerald-700' : 'text-[#a2543c]'}`}>{foodReady ? 'Food check ready' : 'Food check needed'}</p>
                                                        <Link to={version.status === 'in_review' && version.id ? `/admin/recipes/${version.id}` : '/admin/catalog'} className="focus-ring w-fit text-xs font-black text-[#315f7a] underline decoration-[#315f7a]/30 underline-offset-4 sm:justify-self-end">
                                                            {version.status === 'in_review' ? 'Review' : 'Manage'}
                                                        </Link>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="px-4 py-5 text-xs font-semibold text-stone-500 sm:px-7 sm:py-7 sm:text-sm">No recipe activity is available yet.</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="grid border-b border-[#102f35] bg-[#102f35] text-white sm:grid-cols-2">
                                <Link to="/admin/recipes" className="focus-ring border-b border-white/12 px-4 py-3.5 transition hover:bg-white/[0.05] sm:border-b-0 sm:border-r sm:px-7 sm:py-5">
                                    <p className="text-[10px] font-black text-[#9fd0be] sm:text-xs">Continue the recipe review</p>
                                    <p className="mt-0.5 text-sm font-black">Open Recipe Management</p>
                                    <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-white/60">Review the full recipe, make changes and record the final decision.</p>
                                </Link>
                                <Link to="/admin/food-intelligence" className="focus-ring px-4 py-3.5 transition hover:bg-white/[0.05] sm:px-7 sm:py-5">
                                    <p className="text-[10px] font-black text-[#9fd0be] sm:text-xs">Check food readiness</p>
                                    <p className="mt-0.5 text-sm font-black">Open Food Checks</p>
                                    <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-white/60">Review nutrition, allergens and dietary information before publishing.</p>
                                </Link>
                            </section>

                            <section className="flex items-start gap-3 bg-white px-4 py-3.5 sm:px-7 sm:py-5">
                                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                                <div>
                                    <h3 className="text-sm font-black text-stone-950">Review history stays recorded</h3>
                                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-stone-600 sm:text-sm sm:leading-5">
                                        Recipe decisions, food checks and publishing changes are saved in admin history so you can see what changed later.
                                    </p>
                                </div>
                            </section>
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
  
                    {section === 'trustSafety' ? (
                      <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
                        <section className="overflow-hidden rounded-[20px] border border-[#c9dfd4] bg-[#e8f4ed] sm:rounded-[24px]">
                          <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-6 sm:py-5">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#17664d]">Trust &amp; Safety workspace</p>
                              <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#113f30] sm:text-[26px]">
                                <span className="whitespace-nowrap sm:hidden">Review safety reports</span>
                                <span className="hidden sm:inline">Check reports. Protect customers. Resolve issues.</span>
                              </h2>
                              <p className="mt-1.5 text-sm leading-5 text-[#365b4e]">
                                <span className="whitespace-nowrap sm:hidden">Manage cases, incidents &amp; support.</span>
                                <span className="hidden sm:inline">Review cases, follow incidents, handle support requests and record each decision.</span>
                              </p>
                            </div>
                            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#c9dfd4] bg-white/90 sm:min-w-[310px]">
                              {[
                                ['Review cases', trustSafetyQueueState.reviews.error ? '—' : trustSafetyQueueState.reviews.total],
                                ['Incidents', trustSafetyQueueState.incidents.error ? '—' : trustSafetyQueueState.incidents.total],
                                ['Support', trustSafetyQueueState.support.error ? '—' : trustSafetyQueueState.support.total],
                              ].map(([label, value], index) => (
                                <div key={label} className={`min-w-0 px-2 py-2.5 text-center sm:px-3 ${index ? 'border-l border-[#e1ebe4]' : ''}`}>
                                  <p className="text-xl font-extrabold text-[#123d30] sm:text-2xl">{value}</p>
                                  <p className="text-xs leading-4 text-stone-600">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 border-t border-[#c9dfd4] bg-[#f3f9f5]">
                            {[
                              ['01', 'Choose a report'],
                              ['02', 'Check the facts'],
                              ['03', 'Record the result'],
                            ].map(([number, label], index) => (
                              <div key={number} className={`flex min-w-0 items-center gap-2 px-2.5 py-2.5 sm:gap-3 sm:px-5 sm:py-3 ${index ? 'border-l border-[#d6e4da]' : ''}`}>
                                <span className="shrink-0 text-xs font-extrabold text-[#187050]">{number}</span>
                                <p className="text-xs font-semibold leading-4 text-[#254c3d] sm:text-sm">{label}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* Restore the complete platform overview from the original A17 page.
                            These are real Command Center metrics, not calculated from the 3 queues. */}
                        <section className="overflow-hidden rounded-[19px] border border-[#dfe5df] bg-white sm:rounded-[22px]">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7ece8] px-4 py-3 sm:px-5">
                            <div className="min-w-0">
                              <h2 className="text-[17px] font-bold text-[#173b2e] sm:text-lg">Platform safety &amp; operations</h2>
                              <p className="text-sm leading-5 text-stone-600">The original eight admin counts, with their permitted data.</p>
                            </div>
                            <span className="text-xs font-semibold text-stone-500">Platform overview</span>
                          </div>
                          {commandCenterError ? (
                            <div role="alert" className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:m-4">
                              Platform counts could not load: {commandCenterError}. Try Refresh.
                            </div>
                          ) : metricEntries.length ? (
                            <div className="grid grid-cols-2 gap-px bg-[#e1e8e2] sm:grid-cols-4">
                              {metricEntries.map(([label, value, MetricIcon]) => (
                                <div key={label} className="flex min-w-0 items-start justify-between gap-2 bg-[#fbfcfa] px-3 py-3 sm:px-4 sm:py-4">
                                  <div className="min-w-0">
                                    <p className="text-[21px] font-extrabold leading-7 text-[#18382e] sm:text-[25px]">{value}</p>
                                    <p className="mt-0.5 text-xs font-semibold leading-4 text-[#52655a] sm:text-sm">{label}</p>
                                  </div>
                                  <MetricIcon size={16} className="mt-1 shrink-0 text-[#19805b]" aria-hidden="true" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-4 py-4 text-sm text-stone-600">No platform counts are available for your admin permissions.</p>
                          )}
                          <p className="border-t border-[#e7ece8] px-4 py-2.5 text-xs leading-5 text-stone-600 sm:px-5">
                            <span className="whitespace-nowrap sm:hidden">Counts vary by access.</span>
                            <span className="hidden sm:inline">Platform totals and the report lists below can be different: each number has its own category and permissions.</span>
                          </p>
                        </section>

                        <section className="overflow-hidden rounded-[19px] border border-[#d9e2dd] bg-white sm:rounded-[23px]">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5ebe6] px-3.5 py-3 sm:px-5 sm:py-4">
                            <div className="min-w-0">
                              <h2 className="text-[17px] font-bold text-[#1b3a2c] sm:text-xl">Review cases, incidents &amp; support</h2>
                              <p className="text-sm leading-5 text-stone-600">Open a record for details, decisions and follow-up actions.</p>
                            </div>
                            <div className="flex min-w-0 items-center gap-1 rounded-xl border border-[#cfdfd5] bg-[#f3f8f4] p-1" aria-label="Report scope">
                              <button type="button"
                                onClick={() => { setTrustSafetyScope('all'); setSelectedReviewCase(null); setSelectedIncident(null); setSelectedSupportCase(null); }}
                                aria-pressed={trustSafetyScope === 'all'}
                                className={`focus-ring rounded-lg px-2.5 py-2 text-xs font-bold sm:px-3 sm:text-sm ${trustSafetyScope === 'all' ? 'bg-[#15583f] text-white' : 'text-[#305c48]'}`}>
                                All permitted areas
                              </button>
                              <button type="button"
                                onClick={() => { setTrustSafetyScope('trust_safety'); setSelectedReviewCase(null); setSelectedIncident(null); setSelectedSupportCase(null); }}
                                aria-pressed={trustSafetyScope === 'trust_safety'}
                                className={`focus-ring rounded-lg px-2.5 py-2 text-xs font-bold sm:px-3 sm:text-sm ${trustSafetyScope === 'trust_safety' ? 'bg-[#15583f] text-white' : 'text-[#305c48]'}`}>
                                Trust &amp; Safety only
                              </button>
                            </div>
                          </div>
                          <p className="bg-[#f7faf8] px-3.5 py-2 text-xs leading-5 text-[#436451] sm:px-5">
                            {trustSafetyScope === 'all'
                              ? 'Showing records across the areas your Admin account can view.'
                              : 'Showing only records filed under Trust & Safety.'}
                          </p>
                          <div className="grid min-w-0 lg:grid-cols-3">
                            <TrustSafetyWorkQueue title="Review cases" subtitle="Reports that need a decision"
                              icon={FileWarning} tone="blue" items={reviewCases}
                              total={trustSafetyQueueState.reviews.total} error={trustSafetyQueueState.reviews.error}
                              selectedId={selectedReviewCase?.id}
                              onSelect={(item) => { setSelectedReviewCase(item); setSelectedIncident(null); setSelectedSupportCase(null); }}
                              onMore={() => loadMoreTrustSafety('reviews')} loadingMore={trustSafetyMore === 'reviews'} />
                            <TrustSafetyWorkQueue title="Incidents" subtitle="Safety issues to investigate"
                              icon={ShieldAlert} tone="peach" items={incidents}
                              total={trustSafetyQueueState.incidents.total} error={trustSafetyQueueState.incidents.error}
                              selectedId={selectedIncident?.id}
                              onSelect={(item) => { setSelectedIncident(item); setSelectedReviewCase(null); setSelectedSupportCase(null); }}
                              onMore={() => loadMoreTrustSafety('incidents')} loadingMore={trustSafetyMore === 'incidents'} />
                            <TrustSafetyWorkQueue title="Support cases" subtitle="Requests that need a response"
                              icon={UsersRound} tone="mint" items={supportCases}
                              total={trustSafetyQueueState.support.total} error={trustSafetyQueueState.support.error}
                              selectedId={selectedSupportCase?.id}
                              onSelect={(item) => { setSelectedSupportCase(item); setSelectedReviewCase(null); setSelectedIncident(null); }}
                              onMore={() => loadMoreTrustSafety('support')} loadingMore={trustSafetyMore === 'support'} />
                          </div>
                        </section>

                        {/* Preserve both original safety notice and governance boundary. */}
                        <div className="flex items-start gap-2 rounded-xl border border-[#eadaae] bg-[#fff6df] px-3.5 py-3 sm:px-5">
                          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#956018]" aria-hidden="true" />
                          <p className="min-w-0 text-sm leading-5 text-[#724b17]">
                            <span className="whitespace-nowrap sm:hidden">Check evidence; never assume safe.</span>
                            <span className="hidden sm:inline">Critical safety decisions need supporting evidence. Unknown food or allergen information must never be treated as safe or allergen-free.</span>
                          </p>
                        </div>
                        <section className="rounded-[18px] bg-stone-950 px-4 py-4 text-white sm:px-5">
                          <div className="flex items-start gap-3">
                            <Database size={19} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
                            <div className="min-w-0">
                              <h2 className="text-sm font-bold">Governance boundary</h2>
                              <p className="mt-1 text-sm leading-5 text-stone-300">
                                Important changes need permission, verification when required, and a recorded reason. Never edit database records directly.
                              </p>
                              <details className="mt-2 text-xs leading-5 text-stone-400">
                                <summary className="cursor-pointer font-semibold text-emerald-200">View original audit process</summary>
                                <p className="mt-1">EPANTRY checks access, confirms identity when needed, records the reason and evidence, and saves a permanent audit history. Make changes through EPANTRY, not the database.</p>
                              </details>
                            </div>
                          </div>
                        </section>
                      </div>
                    ) : null}

                    {config.domain &&
                    section !== 'dataQuality' &&
                    section !== 'recipeReview' && section !== 'trustSafety' ? (
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
  
                    {section !== 'dataQuality' &&
                    section !== 'recipeReview' &&
                    (selectedReviewCase ||
                        selectedIncident ||
                        selectedSupportCase) ? (
                        <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                            <h2 className="text-sm font-black text-stone-950">
                                {section === 'trustSafety' ? 'Reason and supporting evidence' : 'Action context'}
                            </h2>
  
                            <p className="mt-1 text-xs leading-5 text-stone-500">
                                {section === 'trustSafety'
                                    ? 'Add the reason and any evidence for your decision. Some actions require extra verification.'
                                    : 'Mutating governance actions use the same explicit reason/evidence context and are re-checked by backend permission + MFA boundaries.'}
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
                                    placeholder={section === 'trustSafety' ? 'Why are you taking this action?' : 'Governance decision/action reason'}
                                />
  
                                <input
                                    className={inputClass}
                                    value={evidenceLabel}
                                    onChange={(event) =>
                                        setEvidenceLabel(
                                            event.target.value,
                                        )
                                    }
                                    placeholder={section === 'trustSafety' ? 'Evidence or case reference' : 'Evidence / ticket label'}
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
  
                    {section !== 'dataQuality' &&
                    section !== 'recipeReview' &&
                    selectedReviewCase ? (
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
  
                            {canMutateSelectedSafetyRecord(selectedReviewCase) ? (
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
  
                    {section !== 'dataQuality' &&
                    section !== 'recipeReview' &&
                    selectedIncident &&
                    (canMutateDomain || section === 'trustSafety') ? (
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
  
                            {canMutateSelectedSafetyRecord(selectedIncident) ? (
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
                            ) : (
                              <p className="mt-3 text-sm text-stone-500">You can view this report. Updates need Trust & Safety edit access.</p>
                            )}
                        </section>
                    ) : null}
  
                    {section !== 'dataQuality' &&
                    section !== 'recipeReview' &&
                    selectedSupportCase &&
                    (canMutateDomain || section === 'trustSafety') ? (
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
  
                            {canMutateSelectedSafetyRecord(selectedSupportCase) ? (
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
                            ) : (
                              <p className="mt-3 text-sm text-stone-500">You can view this case. Updates need Trust & Safety edit access.</p>
                            )}
                        </section>
                    ) : null}
  
  
                    {section !== 'recipeReview' && section !== 'policy' && section !== 'trustSafety' ? (
                    <section
                        className={`shadow-sm ${
                            section === 'users'
                                ? 'mt-3 rounded-[18px] border border-emerald-900/10 bg-[#123E32] p-4 text-white sm:mt-4 sm:rounded-[22px] sm:p-5'
                                : 'mt-5 rounded-[24px] border border-stone-200 bg-stone-950 p-5 text-white'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <Database
                                size={18}
                                className="mt-0.5 shrink-0 text-emerald-300"
                                aria-hidden="true"
                            />
  
                            <div>
                                <h2 className="text-sm font-black">
                                    {section === 'users'
                                        ? 'Sensitive changes stay traceable'
                                        : section === 'aiQuality' ? 'Safe AI review' : 'Governance boundary'}
                                </h2>
  
                                <p className={`mt-1.5 text-xs leading-5 ${section === 'users' ? 'text-emerald-50/75' : 'text-stone-400'}`}>
                                    {section === 'users'
                                        ? 'High-impact access changes follow permission checks and are recorded in Admin history, so you can always see what changed and who changed it.'
                                        : section === 'aiQuality'
                                            ? 'AI can assist, but only authorised reviewers approve product information, food-safety decisions and publication. Sensitive admin actions remain permission-checked and audited.'
                                            : 'Admin UI → permission check → recent MFA where required → reason/evidence → owning domain service → immutable M03 audit. Direct database editing is not an M17 operating model.'}
                                </p>
                            </div>
                        </div>
                    </section>
                    ) : null}
                </>
            )}
        </AdminShell>
    );
  }