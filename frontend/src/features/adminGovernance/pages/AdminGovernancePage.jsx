import {
    AlertTriangle,
    ArrowUpRight,
    ChevronRight,
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
  import AdminDsaReportsPanel from '../../dsa/components/AdminDsaReportsPanel';

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
    searchAdminGovernance,
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
  
  // The People workspace stays read-only. Account details are provided by
  // permission-filtered governance search; decisions remain in domain workspaces.
  const PEOPLE_METRIC_DESTINATIONS = {
    'Host activation queue': { to: '/admin/host-operations', permission: 'marketplace.read' },
    'Order exceptions': { to: '/admin/orders-disputes', permission: 'marketplace.read' },
    'Failed webhooks': { to: '/admin/integrations', permission: 'marketplace.read' },
    'Pending settlements': { to: '/admin/finance-ops', permission: 'finance.read' },
    'Active incidents': { to: '/admin/trust-safety', permission: 'trust_safety.read' },
    'Enabled feature flags': { to: '/admin/policy', permission: 'admin.dashboard.read' },
  };

  function PeopleBusinessWorkspace({
    entries,
    isLoading,
    loadError,
    onRefresh,
    hasAdminPermission,
    isRootSuperAdmin,
  }) {
    const [accountQuery, setAccountQuery] = useState('');
    const [accountSearchBusy, setAccountSearchBusy] = useState(false);
    const [accountSearchError, setAccountSearchError] = useState('');
    const [accountResults, setAccountResults] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);

    async function findAccounts(event) {
      event.preventDefault();
      const q = accountQuery.trim();
      if (q.length < 2 || accountSearchBusy) return;
      setAccountSearchBusy(true);
      setAccountSearchError('');
      setAccountResults(null);
      setSelectedAccount(null);
      try {
        const data = await searchAdminGovernance({ q, limit: 30, types: ['user', 'organization'] });
        setAccountResults(Array.isArray(data?.results)
          ? data.results.filter((item) => item?.type === 'user' || item?.type === 'organization')
          : []);
      } catch (requestError) {
        setAccountSearchError(getAdminGovernanceErrorMessage(requestError, 'Account search is unavailable. Please try again.'));
      } finally {
        setAccountSearchBusy(false);
      }
    }

    function clearAccountSearch() {
      setAccountQuery('');
      setAccountSearchError('');
      setAccountResults(null);
      setSelectedAccount(null);
    }

    const canReviewHosts = hasAdminPermission('marketplace.read') ||
      hasAdminPermission('finance.read') ||
      hasAdminPermission('recipe.read') ||
      hasAdminPermission('trust_safety.read');
    const canReviewHostProfiles = hasAdminPermission('host.review.read');
    const hostReviewRoute = canReviewHosts ? '/admin/host-operations'
      : canReviewHostProfiles ? '/admin/hosts' : '';
    const canViewAudit = hasAdminPermission('admin.audit.read');
    const queueEntries = entries.filter(([key]) => key !== 'Enabled feature flags');
    const controlEntry = entries.find(([key]) => key === 'Enabled feature flags');
    const positiveAttentionCount = queueEntries.reduce(
      (total, [, value]) => total + (Number(value) > 0 ? Number(value) : 0), 0,
    );

    const workspaces = [
      { number: '01', title: 'Host & business reviews', description: 'Check business access and Host requests.', to: hostReviewRoute, icon: Building2 },
      { number: '02', title: 'Team permissions', description: 'Manage internal admin access.', to: isRootSuperAdmin ? '/admin/roles' : '', icon: ShieldCheck },
      { number: '03', title: 'Activity history', description: 'Review past admin decisions.', to: canViewAudit ? '/admin/audit' : '', icon: History },
    ];

    return (
      <div className="pbw-page -mx-[10px] mt-0 w-[calc(100%+20px)] min-w-0 space-y-5 pb-0 sm:mx-0 sm:mt-4 sm:w-auto sm:space-y-8 sm:pb-5">
        <section aria-labelledby="pbw-intro-title" className="min-w-0 overflow-hidden border-y border-[#E4DAD1] bg-[#F4ECE3] sm:rounded-[18px] sm:border">
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.22fr)_minmax(310px,.78fr)]">
            <div className="min-w-0 px-4 py-5 sm:px-7 sm:py-8 lg:px-9 lg:py-10">
              <p className="flex items-center gap-2 text-[12px] font-bold tracking-[.06em] text-[#77645A] sm:text-[13px]">
                <span className="h-[8px] w-[8px] rounded-full bg-[#C77A55]" aria-hidden="true" />
                PEOPLE DIRECTORY
              </p>
              <h2 id="pbw-intro-title" className="mt-2.5 max-w-[600px] text-[27px] font-bold leading-[1.14] tracking-[-.035em] text-[#202B27] sm:mt-3 sm:text-[36px] lg:text-[42px]">
                Find an account.<br />
                <span className="text-[#B36548]">Know the next step.</span>
              </h2>
              <p className="mt-2 max-w-[515px] text-[14px] leading-[1.5] text-[#5D6159] sm:mt-3 sm:text-[16px] sm:leading-[1.6]">
                Search a Customer, Host or business to see its available details.
              </p>
              <form id="pbw-account-lookup" role="search" onSubmit={findAccounts} className="mt-4 max-w-[620px] sm:mt-6">
                <label htmlFor="pbw-account-query" className="mb-1.5 block text-[14px] font-bold text-[#3B4A40] sm:mb-2">
                  Name, email or business
                </label>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:gap-0 sm:rounded-[12px] sm:border sm:border-[#D8CFC6] sm:bg-white sm:p-[5px] sm:shadow-[0_5px_20px_rgba(28,65,51,0.04)]">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-[#D8CFC6] bg-white px-3.5 sm:border-0 sm:px-3">
                    <SearchCheck size={20} className="shrink-0 text-[#71887B]" aria-hidden="true" />
                    <input
                      id="pbw-account-query"
                      type="search"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="off"
                      value={accountQuery}
                      onChange={(event) => setAccountQuery(event.target.value)}
                      placeholder="Search people or organisations"
                      className="focus-ring min-h-[48px] w-full min-w-0 border-0 bg-transparent py-2 text-[15px] font-medium text-[#1E3830] outline-none placeholder:text-[#7A8980] sm:min-h-[46px]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={accountSearchBusy || accountQuery.trim().length < 2}
                    className="focus-ring inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#173F35] px-5 text-[15px] font-bold text-white transition-colors hover:bg-[#295E4B] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[46px]"
                  >
                    {accountSearchBusy ? <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <SearchCheck size={18} aria-hidden="true" />}
                    {accountSearchBusy ? 'Searching…' : 'Find account'}
                  </button>
                </div>
              </form>
              <p className="mt-2 text-[12.5px] leading-[1.45] text-[#587366] sm:mt-3 sm:text-[13px] sm:leading-5">
                Results are read-only. Decisions happen in the relevant admin workspace.
              </p>
            </div>

            <aside aria-label="Admin workspace shortcuts" className="min-w-0 border-t border-[#D1DFE2] bg-[#EAF2F4] px-4 py-4 sm:px-7 sm:py-7 lg:border-l lg:border-t-0 lg:px-7 lg:py-9">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-bold tracking-[.04em] text-[#5C7281]">YOUR WORKSPACES</p>
                <ArrowUpRight size={17} className="text-[#8A9A8F]" aria-hidden="true" />
              </div>
              <div className="mt-2 divide-y divide-[#D4E1E4] border-t border-[#D4E1E4] sm:mt-3">
                {workspaces.map(({ number, title, description, to, icon: WorkspaceIcon }) => {
                  const content = (
                    <div className="flex min-w-0 items-center gap-3 py-2.5 sm:py-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[#D9E8ED] text-[#2B5662] sm:h-10 sm:w-10">
                        <WorkspaceIcon size={19} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-[#8D6C60] sm:text-[12px]">{number} / {to ? 'Open workspace' : 'Limited access'}</span>
                        <span className="mt-0.5 block text-[15px] font-bold leading-5 text-[#233E43] sm:text-[16px]">{title}</span>
                        <span className="mt-0.5 hidden text-[13px] leading-5 text-[#61767A] sm:block">{description}</span>
                      </span>
                      {to ? <ChevronRight size={19} className="shrink-0 text-[#355965] transition-transform group-hover:translate-x-1" aria-hidden="true" /> : <span className="shrink-0 text-[12px] font-semibold text-[#68808B]">Locked</span>}
                    </div>
                  );
                  return to ? (
                    <Link key={number} to={to} className="focus-ring group block transition-colors hover:bg-[#DFEBEF]" aria-label={`Open ${title}`}>{content}</Link>
                  ) : (
                    <div key={number} aria-label={`${title} is restricted`} className="opacity-75">{content}</div>
                  );
                })}
              </div>
            </aside>
          </div>
        </section>

        {(accountSearchBusy || accountSearchError || accountResults !== null) ? (
          <section aria-labelledby="pbw-results-title" className="min-w-0 overflow-hidden border-y border-[#D8E2DD] bg-white sm:rounded-[16px] sm:border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E9E3] px-4 py-4 sm:px-6">
              <div>
                <p className="text-[12px] font-bold text-[#AE644B]">ACCOUNT LOOKUP</p>
                <h3 id="pbw-results-title" className="mt-0.5 text-[20px] font-bold leading-tight text-[#193B30] sm:text-[23px]">Search results</h3>
              </div>
              <button type="button" onClick={clearAccountSearch} disabled={accountSearchBusy} className="focus-ring min-h-[40px] rounded-[8px] border border-[#D3DCD3] px-3.5 text-[14px] font-bold text-[#345648] hover:bg-[#F1F5F1] disabled:opacity-50">Clear search</button>
            </div>
            {accountSearchError ? <p role="alert" className="border-b border-[#F0D9C9] bg-[#FFF1E7] px-4 py-3 text-[14px] leading-6 text-[#844B37] sm:px-6">{accountSearchError}</p> : null}
            {accountSearchBusy ? (
              <div role="status" className="flex min-h-[130px] items-center justify-center gap-3 text-[15px] text-[#4F695A]">
                <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Searching accounts…
              </div>
            ) : accountResults !== null ? (
              <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,.95fr)]">
                <div className="min-w-0 lg:border-r lg:border-[#E6EAE5]">
                  <p className="border-b border-[#EBEEE9] px-4 py-3 text-[13px] font-semibold text-[#627569] sm:px-6">
                    {accountResults.length} {accountResults.length === 1 ? 'match' : 'matches'} found
                  </p>
                  {accountResults.length ? (
                    <div className="max-h-[265px] overflow-y-auto sm:max-h-[360px]">
                      {accountResults.map((item) => {
                        const isSelected = selectedAccount?.id === item.id && selectedAccount?.type === item.type;
                        return (
                          <button
                            key={`${item.type}:${item.id}`}
                            type="button"
                            onClick={() => setSelectedAccount(item)}
                            aria-pressed={isSelected}
                            className={`focus-ring group flex min-h-[74px] w-full min-w-0 items-center gap-3 border-b border-[#EBEEE9] px-4 py-3 text-left transition-colors sm:px-6 ${isSelected ? 'bg-[#E9F3EE]' : 'hover:bg-[#F8FAF7]'}`}
                          >
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${isSelected ? 'bg-[#CFE6DA]' : 'bg-[#F0F2EE]'} text-[#285B47]`}>
                              {item.type === 'organization' ? <Building2 size={20} aria-hidden="true" /> : <UsersRound size={20} aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-[15px] font-bold leading-5 text-[#1C3B2F]">{item.title || 'Unnamed record'}</span>
                              <span className="mt-1 block break-words text-[13px] leading-5 text-[#6B7C71]">{item.type === 'organization' ? 'Business' : 'Customer / account'}{item.subtitle ? ` · ${item.subtitle}` : ''}</span>
                            </span>
                            <ChevronRight size={18} className="shrink-0 text-[#5E7A6A]" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  ) : <p className="px-4 py-6 text-[15px] leading-6 text-[#68776D] sm:px-6">No matching account or business found. Try a different name or email.</p>}
                </div>
                <div className="min-w-0 bg-[#F8FAF7] px-4 py-5 sm:px-6 sm:py-6" aria-live="polite">
                  {selectedAccount ? (
                    <div>
                      <p className="text-[12px] font-bold text-[#AE644B]">SELECTED {selectedAccount.type === 'organization' ? 'BUSINESS' : 'ACCOUNT'}</p>
                      <h4 className="mt-2 break-words text-[23px] font-bold leading-tight tracking-[-.025em] text-[#193B30]">{selectedAccount.title || 'Unnamed record'}</h4>
                      <dl className="mt-4 divide-y divide-[#DFE6DE] border-y border-[#DFE6DE]">
                        <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-3 text-[14px]"><dt className="font-medium text-[#687A6E]">Type</dt><dd className="font-bold text-[#2D4E3E]">{selectedAccount.type === 'organization' ? 'Business' : 'User account'}</dd></div>
                        <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-3 text-[14px]"><dt className="font-medium text-[#687A6E]">Status</dt><dd className="break-words font-bold text-[#2D4E3E]">{titleize(selectedAccount.status || 'Not available')}</dd></div>
                        {selectedAccount.subtitle ? <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-3 text-[14px]"><dt className="font-medium text-[#687A6E]">Reference</dt><dd className="break-words text-[#496254]">{selectedAccount.subtitle}</dd></div> : null}
                        {selectedAccount.type === 'user' ? <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-3 text-[14px]"><dt className="font-medium text-[#687A6E]">Host access</dt><dd className="break-words font-semibold text-[#2D4E3E]">{selectedAccount.metadata?.hostEnabled ? 'Enabled' : selectedAccount.metadata?.hostAccessStatus ? titleize(selectedAccount.metadata.hostAccessStatus) : 'Not enabled'}</dd></div> : null}
                      </dl>
                      {hostReviewRoute ? (
                        <Link to={hostReviewRoute} className="focus-ring mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-[9px] bg-[#173F35] px-4 py-2 text-[14px] font-bold text-white hover:bg-[#295E4B]">
                          Open Host review workspace <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                      ) : null}
                      <p className="mt-3 text-[13px] leading-5 text-[#687B6D]">The review workspace opens separately. This account is not automatically selected there.</p>
                    </div>
                  ) : (
                    <div className="flex min-h-[165px] flex-col justify-center">
                      <UsersRound size={25} className="text-[#789789]" aria-hidden="true" />
                      <p className="mt-3 text-[16px] font-bold text-[#234738]">Choose a result to see details</p>
                      <p className="mt-1 text-[14px] leading-6 text-[#66796C]">Account status and available information will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="pbw-overview-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-4 sm:mb-5 sm:px-0">
            <div>
              <p className="text-[12px] font-bold tracking-[.05em] text-[#B46B4F]">LIVE WORKLOAD / 02</p>
              <h2 id="pbw-overview-title" className="mt-1 text-[25px] font-bold tracking-[-.035em] text-[#213A31] sm:text-[31px]">At a glance</h2>
              <p className="mt-1 text-[13px] leading-5 text-[#5E7064] sm:text-[15px] sm:leading-6">All the admin queues you can currently view.</p>
            </div>
            {!isLoading && !loadError && entries.length > 0 ? (
              <div className="flex min-h-[38px] items-center gap-2 rounded-[8px] bg-[#F0E7DC] px-3 py-2 sm:min-h-[42px] sm:gap-3 sm:rounded-[9px] sm:px-4" role="status">
                <span className="text-[23px] font-bold leading-none tabular-nums text-[#8F543C]">{positiveAttentionCount}</span>
                <span className="max-w-[145px] text-[13px] font-semibold leading-4 text-[#6F594B]">{positiveAttentionCount === 1 ? 'item needs attention' : 'items need attention'}</span>
              </div>
            ) : null}
          </div>

          {loadError ? (
            <div role="alert" className="flex flex-col gap-3 border border-[#E5CABA] bg-[#FFF1E8] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div><p className="text-[15px] font-bold text-[#82452F]">Workload data could not load.</p><p className="mt-1 text-[14px] leading-5 text-[#815D4E]">{loadError}</p></div>
              <button type="button" onClick={onRefresh} className="focus-ring inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-[8px] border border-[#CCA38E] bg-white px-4 text-[14px] font-bold text-[#82452F]"><RefreshCw size={16} aria-hidden="true" /> Retry</button>
            </div>
          ) : isLoading ? (
            <div role="status" className="flex min-h-[138px] items-center justify-center gap-3 border border-[#E2E7DF] bg-[#F7F9F5] text-[15px] text-[#597262]"><LoaderCircle size={19} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading workload…</div>
          ) : entries.length ? (
            <div className={`grid min-w-0 overflow-hidden border-y border-[#E0E5DE] bg-white sm:rounded-[12px] sm:border ${controlEntry ? 'lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,.7fr)]' : ''}`}>
              <div className="min-w-0 px-0 py-0 sm:px-6 sm:py-5">
                <p className="mb-0 border-b border-[#E6EAE4] px-4 py-3 text-[12px] font-bold tracking-[.04em] text-[#7C7066] sm:mb-2 sm:border-0 sm:px-0 sm:py-0">OPEN QUEUES</p>
                {queueEntries.length ? (
                  <div className="grid min-w-0 grid-cols-2 sm:gap-x-7">
                    {queueEntries.map(([label, value, MetricIcon]) => {
                      const destination = PEOPLE_METRIC_DESTINATIONS[label];
                      const to = destination && hasAdminPermission(destination.permission) ? destination.to : '';
                      const needsAttention = Number(value) > 0;
                      const content = (
                        <div className="flex h-full min-h-[88px] min-w-0 flex-wrap content-between items-start gap-x-2 gap-y-1 border-b border-r border-[#E9ECE6] px-3 py-3 transition-colors group-hover:bg-[#F5F8F5] sm:h-auto sm:min-h-[70px] sm:flex-nowrap sm:content-normal sm:items-center sm:gap-3 sm:border-r-0 sm:px-0">
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[8px] sm:h-9 sm:w-9 ${needsAttention ? 'bg-[#F8E9E1] text-[#B46749]' : 'bg-[#EDF1EC] text-[#6D8977]'}`}>
                            <MetricIcon size={18} aria-hidden="true" />
                          </span>
                          <span className="order-3 w-full min-w-0 flex-none text-[13px] font-semibold leading-[1.3] text-[#3C5447] sm:order-none sm:w-auto sm:flex-1 sm:text-[14px] sm:leading-5">{USER_METRIC_LABELS[label] || label}</span>
                          <span className={`ml-auto shrink-0 text-[23px] font-bold leading-none tabular-nums sm:ml-0 sm:text-[24px] ${needsAttention ? 'text-[#A75A3D]' : 'text-[#244A3A]'}`}>{value ?? 0}</span>
                          {to ? <ChevronRight size={16} className="hidden shrink-0 text-[#839789] sm:block" aria-hidden="true" /> : null}
                        </div>
                      );
                      return to ? <Link key={label} to={to} className="focus-ring group block min-w-0" aria-label={`Open ${USER_METRIC_LABELS[label] || label}: ${value}`}>{content}</Link> : <div key={label} className="group min-w-0">{content}</div>;
                    })}
                    {controlEntry ? (
                      hasAdminPermission('admin.dashboard.read') ? (
                        <Link to="/admin/policy" className="focus-ring group block min-w-0 sm:hidden" aria-label={`Open Active controls: ${controlEntry[1] ?? 0}`}>
                          <div className="flex h-full min-h-[88px] flex-wrap content-between items-start gap-x-2 gap-y-1 border-b border-[#E9ECE6] bg-[#E9F0EA] px-3 py-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#D7E6D9] text-[#315E47]"><ShieldCheck size={18} aria-hidden="true" /></span>
                            <span className="ml-auto text-[23px] font-bold leading-none tabular-nums text-[#244A3A]">{controlEntry[1] ?? 0}</span>
                            <span className="w-full text-[13px] font-semibold leading-[1.3] text-[#3C5447]">Active controls <span aria-hidden="true">↗</span></span>
                          </div>
                        </Link>
                      ) : (
                        <div className="min-w-0 sm:hidden">
                          <div className="flex h-full min-h-[88px] flex-wrap content-between items-start gap-x-2 gap-y-1 border-b border-[#E9ECE6] bg-[#E9F0EA] px-3 py-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#D7E6D9] text-[#315E47]"><ShieldCheck size={18} aria-hidden="true" /></span>
                            <span className="ml-auto text-[23px] font-bold leading-none tabular-nums text-[#244A3A]">{controlEntry[1] ?? 0}</span>
                            <span className="w-full text-[13px] font-semibold leading-[1.3] text-[#3C5447]">Active controls</span>
                          </div>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : (
                  <p className="py-5 text-[14px] text-[#667A6B]">No review queues are available to your account.</p>
                )}
              </div>
              {controlEntry ? (
                <aside aria-label="Platform controls" className="hidden min-w-0 flex-col justify-between border-t border-[#DDE7E2] bg-[#E9F0EA] px-5 py-6 sm:flex sm:px-7 sm:py-7 lg:border-l lg:border-t-0">
                  <div>
                    <p className="text-[12px] font-bold tracking-[.06em] text-[#54715F]">PLATFORM SETTINGS</p>
                    <p className="mt-5 text-[46px] font-bold leading-none tabular-nums tracking-[-.04em] text-[#214B3A] sm:text-[54px]">{controlEntry[1] ?? 0}</p>
                    <p className="mt-2 text-[18px] font-bold text-[#264E3E]">Active controls</p>
                    <p className="mt-2 max-w-[260px] text-[14px] leading-6 text-[#5A7161]">Enabled feature settings in your admin overview.</p>
                  </div>
                  {hasAdminPermission('admin.dashboard.read') ? (
                    <Link to="/admin/policy" className="focus-ring mt-5 inline-flex min-h-[42px] items-center gap-2 self-start rounded-[9px] border border-[#B4C8B9] bg-white px-3.5 text-[14px] font-bold text-[#285340] transition-colors hover:bg-[#F9FCF9]">
                      View controls <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : <div className="border border-[#E1E7DF] bg-[#F8F9F5] px-5 py-5 text-[15px] text-[#586E60]">No workload summary is available for your current permissions.</div>}
        </section>
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
  
  // A17: only display records loaded from the Trust & Safety domain.
  // A failed request must never be presented as a genuinely empty queue.
  // Trust & Safety case lists reuse the original permissions, pagination and selection handlers.
  function TrustSafetyWorkQueue({
    title, subtitle, items, total, error, onSelect, selectedId, onMore, loadingMore, icon: Icon, tone,
  }) {
    const tones = {
      clay: 'bg-[#C56C42] text-[#F7F6F2]',
      sage: 'bg-[#D7DDCF] text-[#173F35]',
      forest: 'bg-[#173F35] text-[#F7F6F2]',
    };
    const failed = Boolean(error);
    const [expanded, setExpanded] = useState(false);
    const visibleItems = expanded ? items : items.slice(0, 4);
    return (
      <section className="min-w-0 bg-[#F7F6F2]">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center ${tones[tone] || tones.sage}`}>
            <Icon size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-extrabold leading-5 text-[#202421]">{title}</h3>
            {items.length ? <p className="mt-0.5 text-[13px] leading-5 text-[#173F35]">{subtitle}</p> : null}
          </div>

        </div>
        {failed ? (
          <div role="alert" className="mx-4 mb-3 border-l-4 border-[#C56C42] bg-white p-3 sm:mx-5">
            <p className="text-sm font-bold text-[#202421]">Unable to load {title.toLowerCase()}.</p>
            <p className="mt-1 break-words text-xs text-[#202421]">{error}</p>
            <p className="mt-1 text-xs text-[#173F35]">Use Refresh above to try again.</p>
          </div>
        ) : items.length ? (
          <div className="border-t border-[#D7DDCF]">
            {visibleItems.map((item, index) => (
              <button
                key={item.id || `${title}-${index}`}
                type="button"
                onClick={() => onSelect(item)}
                aria-pressed={selectedId === item.id}
                className={`focus-ring flex w-full min-w-0 items-center justify-between gap-3 border-b border-[#D7DDCF] px-4 py-3.5 text-left transition-colors hover:bg-[#D7DDCF] sm:px-5 ${selectedId === item.id ? 'bg-[#D7DDCF]' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-bold leading-5 text-[#202421]">
                    {item.summary || item.title || item.description || item.caseKey || item.incidentKey || item.supportKey || 'Untitled record'}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#173F35]">
                    {item.caseKey || item.incidentKey || item.supportKey || 'Record'} · {titleize(item.domain || 'trust_safety')} · {titleize(item.status)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-[#C56C42]">Review →</span>
              </button>
            ))}
            {!expanded && items.length > 4 ? (
              <button type="button" onClick={() => setExpanded(true)}
                className="focus-ring w-full px-4 py-3 text-sm font-bold text-[#173F35] hover:bg-[#D7DDCF]">
                View all {items.length} loaded records
              </button>
            ) : null}
            {expanded && items.length > 4 ? (
              <button type="button" onClick={() => setExpanded(false)}
                className="focus-ring w-full border-t border-[#D7DDCF] px-4 py-2.5 text-xs font-bold text-[#173F35] hover:bg-[#D7DDCF]">
                Show fewer
              </button>
            ) : null}
            {total > items.length && (expanded || items.length <= 4) ? (
              <button type="button" disabled={loadingMore} onClick={onMore}
                className="focus-ring w-full px-4 py-3 text-sm font-bold text-[#173F35] hover:bg-[#D7DDCF] disabled:opacity-50">
                {loadingMore ? 'Loading…' : `Show more (${total - items.length} remaining)`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="border-t border-[#D7DDCF] px-4 py-3 text-sm leading-5 text-[#173F35] sm:px-5">
            Nothing waiting here.
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

  const QUALITY_VIEWS = [
    { id: 'review', number: '01', label: 'Product reviews', short: 'Submitted records', icon: SearchCheck,
      tint: 'bg-[#E4F1F6]', accent: 'border-[#467B99]', text: 'text-[#235270]' },
    { id: 'duplicates', number: '02', label: 'Possible duplicates', short: 'Matches to compare', icon: Boxes,
      tint: 'bg-[#FBE7DC]', accent: 'border-[#C86C42]', text: 'text-[#9A502C]' },
    { id: 'catalog', number: '03', label: 'Catalog checks', short: 'Versions in review', icon: CheckCircle2,
      tint: 'bg-[#E6F1E6]', accent: 'border-[#4C8261]', text: 'text-[#285E40]' },
    { id: 'batches', number: '04', label: 'Batch issues', short: 'Uploads needing proof', icon: FileWarning,
      tint: 'bg-[#EDE8F6]', accent: 'border-[#81739D]', text: 'text-[#65557D]' },
  ];

  function QualityReviewRow({ title, meta, badge, to, warning }) {
    return (
      <Link to={to} className="dq-review-row focus-ring group flex min-w-0 items-center justify-between gap-2 border-b border-[#E4E8E0] px-3 py-3 text-[#173F35] transition-colors last:border-b-0 hover:bg-[#F0F4EE] focus-visible:bg-[#F0F4EE] sm:gap-3 sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] font-bold leading-[1.35] text-[#173F35]">{title}</p>
          <p className="mt-1 break-words text-[13px] leading-[1.4] text-[#5C6B60]">{meta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`hidden max-w-40 text-right text-xs font-semibold sm:inline ${warning ? 'text-[#A65331]' : 'text-[#426A58]'}`}>{badge}</span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EDF0E7] text-[#173F35] transition group-hover:bg-[#DCE0CF]" aria-hidden="true"><ChevronRight size={17}/></span>
        </div>
      </Link>
    );
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

  function MarketplaceOrderThumbnail({ imageUrl, name, small = false }) {
    const [failedUrl, setFailedUrl] = useState('');
    const showImage = Boolean(imageUrl && failedUrl !== imageUrl);
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#ECEFE8] text-[#547063] ${small ? 'h-12 w-12' : 'h-[60px] w-[60px] sm:h-[68px] sm:w-[68px]'}`}>
        {showImage ? (
          <img
            src={imageUrl}
            alt={name ? `${name} product` : 'Order item'}
            loading="lazy"
            decoding="async"
            onError={() => setFailedUrl(imageUrl)}
            className="h-full w-full object-contain"
          />
        ) : <ShoppingBag size={small ? 19 : 24} aria-label="Product image unavailable" />}
      </span>
    );
  }

  function marketplaceOrderStatusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('pending') || value.includes('failed') || value.includes('return')) {
      return 'bg-[#F5E7DB] text-[#8B503A]';
    }
    if (value.includes('delivered') || value.includes('confirmed') || value.includes('completed')) {
      return 'bg-[#E7EEE4] text-[#254F3D]';
    }
    return 'bg-[#EBEEE8] text-[#31574B]';
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
      return 'text-[#173F35]';
    }

    if (label === 'Working') {
      return 'text-[#173F35]';
    }

    return 'text-[#202421]';
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
    const [trustSafetyView, setTrustSafetyView] = useState('reports');
    const [trustSafetyActiveQueue, setTrustSafetyActiveQueue] = useState('reviews');


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
    const [dataQualityView, setDataQualityView] = useState('review');
    const [dataQualitySourceErrors, setDataQualitySourceErrors] = useState({});

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
            recentOrders: [],
            recentOrdersTotal: 0,
            recentOrdersAvailable: false,
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

    const [showAllRecentOrders, setShowAllRecentOrders] = useState(false);

    const [showAllOrderCases, setShowAllOrderCases] =
        useState(false);

    // Keep marketplace dispute cases separate from the shared cross-domain Admin queues.
    const [orderReviewCases, setOrderReviewCases] = useState([]);
    const [orderCasesError, setOrderCasesError] = useState('');
    const [orderCasesPage, setOrderCasesPage] = useState(1);
    const [orderCasesTotal, setOrderCasesTotal] = useState(0);
    const [orderCasesMoreBusy, setOrderCasesMoreBusy] = useState(false);
    const [ordersFocus, setOrdersFocus] = useState('order');


    const [integrationLoading, setIntegrationLoading] =
        useState(false);

    const [integrationError, setIntegrationError] =
        useState('');

    const [integrationWorkspace, setIntegrationWorkspace] =
        useState({
            webhooks: [],
            serviceAccounts: [],
            hosts: [],
            summary: {
                total: 0,
                active: 0,
                failed: 0,
                healthy: 0,
                neverUsed: 0,
                disabled: 0,
                organizations: 0,
                serviceAccounts: 0,
                connections: 0,
            },
            pagination: {},
        });

    const [selectedIntegrationId, setSelectedIntegrationId] =
        useState('');

    const [showAllIntegrationCases, setShowAllIntegrationCases] =
        useState(false);

    // Integration reviews are paged independently: the generic Marketplace
    // dashboard queue contains many unrelated cases and only its first page.
    const [integrationReviewRows, setIntegrationReviewRows] = useState([]);
    const [integrationReviewPage, setIntegrationReviewPage] = useState(1);
    const [integrationReviewTotal, setIntegrationReviewTotal] = useState(0);
    const [integrationReviewsError, setIntegrationReviewsError] = useState('');
    const [integrationReviewsLoading, setIntegrationReviewsLoading] = useState(false);
    const [integrationReviewsMoreBusy, setIntegrationReviewsMoreBusy] = useState(false);
    const [integrationSearch, setIntegrationSearch] = useState('');
    const [integrationHealthFilter, setIntegrationHealthFilter] = useState('all');
    const [selectedIntegrationHostId, setSelectedIntegrationHostId] = useState('');
    const [integrationDetailTab, setIntegrationDetailTab] = useState('overview');

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
                if (section === 'trustSafety' || section === 'aiQuality' || section === 'users') setCommandCenterError('');
                if (section === 'policy') {
                    setPolicyLoadIssues({ rules: '', flags: '' });
                    setPolicyRelatedIssues([]);
                }

                if (section === 'recipeReview' || section === 'finance' || section === 'dataQuality') {
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
                        if (section === 'users') setCommandCenterError('');
                    } else if (section === 'trustSafety' || section === 'aiQuality' || section === 'users') {
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


    const loadDataQualityWorkspace = useCallback(async () => {
        if (section !== 'dataQuality') return;
        setDataQualityLoading(true);
        setDataQualityError('');
        setDataQualitySourceErrors({});
        const endpoints = [
            listAdminNpiReviewQueue({ page: 1, limit: 100 }),
            listAdminNpiBulkBatches({ page: 1, limit: 100 }),
            getAdminProductVersions({ page: 1, limit: 100, publicationStatus: 'in_review' }),
        ];
        try {
            const results = await Promise.allSettled(endpoints);
            const sources = ['review', 'batches', 'catalog'];
            const issues = {};
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    issues[sources[index]] = getAdminGovernanceErrorMessage(
                        result.reason, 'This feed could not load.',
                    );
                }
            });
            const review = results[0].status === 'fulfilled' ? results[0].value : null;
            const batches = results[1].status === 'fulfilled' ? results[1].value : null;
            const catalog = results[2].status === 'fulfilled' ? results[2].value : null;
            setDataQualityWorkspace({
                drafts: review?.drafts || [],
                draftTotal: Number(review?.pagination?.total ?? 0),
                batches: batches?.batches || [],
                batchSummary: batches?.summary || {},
                versions: catalog?.items || [],
                versionTotal: Number(catalog?.pagination?.total ?? 0),
            });
            setDataQualitySourceErrors(issues);
            if (Object.keys(issues).length === sources.length) {
                setDataQualityError('Quality records could not be loaded. Please retry.');
            }
        } catch (requestError) {
            setDataQualityWorkspace({ drafts: [], draftTotal: 0, batches: [], batchSummary: {}, versions: [], versionTotal: 0 });
            setDataQualityError(getAdminGovernanceErrorMessage(requestError, 'Unable to load quality records.'));
        } finally {
            setDataQualityLoading(false);
        }
    }, [section]);

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
                if (section !== 'orders') return;

                setOrdersLoading(true);
                setOrdersError('');
                setOrderCasesError('');

                // The exception and dispute endpoints are independent: a failure in one
                // must not silently turn the other queue into an empty success state.
                const [ordersResult, casesResult] = await Promise.allSettled([
                    listAdminMarketplaceOrderExceptions(),
                    listAdminReviewCases({ page: 1, limit: 100, domain: 'marketplace' }),
                ]);

                if (ordersResult.status === 'fulfilled') {
                    const result = ordersResult.value;
                    const orders = Array.isArray(result?.orders) ? result.orders : [];
                    setOrdersWorkspace({
                        orders,
                        recentOrders: Array.isArray(result?.recentOrders) ? result.recentOrders : [],
                        recentOrdersTotal: Number(result?.recentOrdersTotal ?? 0),
                        recentOrdersAvailable: Array.isArray(result?.recentOrders) && Number.isFinite(Number(result?.recentOrdersTotal)),
                        summary: {
                            total: Number(result?.summary?.total ?? orders.length),
                            deliveryFailed: Number(result?.summary?.deliveryFailed || 0),
                            returnsRequested: Number(result?.summary?.returnsRequested || 0),
                            itemsUnavailable: Number(result?.summary?.itemsUnavailable || 0),
                            substitutionsRequested: Number(result?.summary?.substitutionsRequested || 0),
                        },
                    });
                    setSelectedOrderId(current =>
                        orders.some(item => item.id === current) ? current : orders[0]?.id || '',
                    );
                } else {
                    setOrdersError(getAdminGovernanceErrorMessage(
                        ordersResult.reason, 'Unable to load current order issues.',
                    ));
                }

                if (casesResult.status === 'fulfilled') {
                    const result = casesResult.value;
                    setOrderReviewCases(Array.isArray(result?.reviewCases) ? result.reviewCases : []);
                    setOrderCasesPage(1);
                    setOrderCasesTotal(Number(result?.pagination?.total || 0));
                } else {
                    setOrderCasesError(getAdminGovernanceErrorMessage(
                        casesResult.reason, 'Unable to load dispute cases.',
                    ));
                }
                setOrdersLoading(false);
            },
            [section],
        );

    useEffect(() => {
        loadOrdersWorkspace();
    }, [loadOrdersWorkspace]);

    const loadMoreOrderCases = useCallback(async () => {
        if (section !== 'orders' || orderCasesMoreBusy || orderReviewCases.length >= orderCasesTotal) return;
        setOrderCasesMoreBusy(true);
        setOrderCasesError('');
        try {
            const nextPage = orderCasesPage + 1;
            const result = await listAdminReviewCases({ page: nextPage, limit: 100, domain: 'marketplace' });
            const additional = Array.isArray(result?.reviewCases) ? result.reviewCases : [];
            setOrderReviewCases(previous => {
                const seen = new Set(previous.map(item => item.id));
                return [...previous, ...additional.filter(item => !seen.has(item.id))];
            });
            setOrderCasesPage(nextPage);
            setOrderCasesTotal(Number(result?.pagination?.total || 0));
        } catch (requestError) {
            setOrderCasesError(getAdminGovernanceErrorMessage(requestError, 'Could not load more dispute cases.'));
        } finally {
            setOrderCasesMoreBusy(false);
        }
    }, [section, orderCasesMoreBusy, orderCasesPage, orderCasesTotal, orderReviewCases.length]);


    const loadIntegrationWorkspace = useCallback(async () => {
        if (section !== 'integrations') return;
        setIntegrationLoading(true);
        setIntegrationReviewsLoading(true);
        setIntegrationError('');
        setIntegrationReviewsError('');

        // The overview and review queue must not mask each other's failures.
        const [overviewResult, reviewsResult] = await Promise.allSettled([
            getAdminIntegrationOverview({ limit: 500 }),
            listAdminReviewCases({ page: 1, limit: 100, domain: 'marketplace' }),
        ]);

        if (overviewResult.status === 'fulfilled') {
            const result = overviewResult.value || {};
            const webhooks = Array.isArray(result.webhooks) ? result.webhooks : [];
            const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
            const hosts = Array.isArray(result.hosts) ? result.hosts : [];
            const serviceAccounts = Array.isArray(result.serviceAccounts) ? result.serviceAccounts : [];
            setIntegrationWorkspace({
                webhooks,
                hosts,
                serviceAccounts,
                summary: {
                    total: number(result.summary?.total, webhooks.length),
                    active: number(result.summary?.active),
                    failed: number(result.summary?.failed),
                    healthy: number(result.summary?.healthy),
                    neverUsed: number(result.summary?.neverUsed),
                    disabled: number(result.summary?.disabled),
                    organizations: number(result.summary?.organizations, hosts.length),
                    serviceAccounts: number(result.summary?.serviceAccounts, serviceAccounts.length),
                    connections: number(result.summary?.connections, webhooks.length + serviceAccounts.length),
                },
                pagination: result.pagination || {},
            });
            setSelectedIntegrationHostId(current => hosts.some(row => row.id === current)
                ? current : (hosts[0]?.id || ''));
            setSelectedIntegrationId(current => webhooks.some(row => row.id === current)
                ? current : (webhooks[0]?.id || ''));
        } else {
            setIntegrationWorkspace(previous => ({ ...previous, webhooks: [], hosts: [], serviceAccounts: [], summary: {
                total: 0, active: 0, failed: 0, healthy: 0, neverUsed: 0, disabled: 0,
                organizations: 0, serviceAccounts: 0, connections: 0,
            }, pagination: {} }));
            setSelectedIntegrationHostId('');
            setSelectedIntegrationId('');
            setIntegrationError(getAdminGovernanceErrorMessage(
                overviewResult.reason, 'Could not load Host connections.',
            ));
        }
        if (reviewsResult.status === 'fulfilled') {
            const result = reviewsResult.value || {};
            setIntegrationReviewRows(Array.isArray(result.reviewCases) ? result.reviewCases : []);
            setIntegrationReviewPage(1);
            setIntegrationReviewTotal(Number(result.pagination?.total ?? 0));
        } else {
            setIntegrationReviewRows([]);
            setIntegrationReviewPage(1);
            setIntegrationReviewTotal(0);
            setIntegrationReviewsError(getAdminGovernanceErrorMessage(
                reviewsResult.reason, 'Could not load integration reviews.',
            ));
        }
        setIntegrationReviewsLoading(false);
        setIntegrationLoading(false);
    }, [section]);

    useEffect(() => { loadIntegrationWorkspace(); }, [loadIntegrationWorkspace]);

    const loadMoreIntegrationReviews = useCallback(async () => {
        if (section !== 'integrations' || integrationReviewsMoreBusy ||
            integrationReviewRows.length >= integrationReviewTotal) return;
        setIntegrationReviewsMoreBusy(true);
        setIntegrationReviewsError('');
        try {
            const page = integrationReviewPage + 1;
            const result = await listAdminReviewCases({ page, limit: 100, domain: 'marketplace' });
            const added = Array.isArray(result?.reviewCases) ? result.reviewCases : [];
            setIntegrationReviewRows(previous => {
                const seen = new Set(previous.map(item => item.id));
                return [...previous, ...added.filter(item => !seen.has(item.id))];
            });
            setIntegrationReviewPage(page);
            setIntegrationReviewTotal(Number(result?.pagination?.total ?? 0));
        } catch (requestError) {
            setIntegrationReviewsError(getAdminGovernanceErrorMessage(
                requestError, 'Could not load more reviews.',
            ));
        } finally {
            setIntegrationReviewsMoreBusy(false);
        }
    }, [section, integrationReviewsMoreBusy, integrationReviewRows.length,
        integrationReviewTotal, integrationReviewPage]);

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
                        directDuplicates + bulkDuplicates,
                    catalogReview:
                        Number(
                            dataQualityWorkspace.versionTotal ||
                            0,
                        ),
                    needsAttention:
                        moreProofNeeded + bulkIssues,
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
                    ),
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
                    ),
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
            () => (orderReviewCases || []).filter(item => item?.caseType === 'marketplace_dispute'),
            [orderReviewCases],
        );

    const activeOrderDisputeCases = orderDisputeCases.filter(
        item => !['resolved', 'dismissed'].includes(item?.status),
    );
    const closedOrderDisputeCases = orderDisputeCases.filter(
        item => ['resolved', 'dismissed'].includes(item?.status),
    );
    const visibleOrderDisputeCases = showAllOrderCases
        ? activeOrderDisputeCases
        : activeOrderDisputeCases.slice(0, 6);

    const selectedOrderCase = selectedOrder
        ? activeOrderDisputeCases.find(
            item => item?.entity?.type === 'seller_order' && item?.entity?.id === selectedOrder.id,
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
                (integrationReviewRows || []).filter(
                    (item) =>
                        item?.caseType === 'integration_failure' ||
                        item?.entity?.type === 'organization_webhook',
                ),
            [integrationReviewRows],
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
                return 'border-[#173F35] bg-[#173F35] text-[#F7F6F2]';
            }

            if (['pending_review', 'initiated'].includes(value)) {
                return 'border-[#173F35] bg-[#D7DDCF] text-[#173F35]';
            }

            if (value === 'rejected') {
                return 'border-[#C56C42] bg-[#F7F6F2] text-[#202421]';
            }

            return 'border-[#D7DDCF] bg-[#F7F6F2] text-[#202421]';
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

        // Display only the eight existing recent decisions, grouping identical
        // outcomes without losing their occurrence counts or source details.
        const recentServingGroups = [];
        const recentServingIndex = new Map();
        adDecisionLogs.slice(0, 8).forEach((log, index) => {
            const key = JSON.stringify([
                log.placement,
                log.marketCode || 'IN',
                log.promotedEntityType,
                log.reasonCodes || [],
                log.outcome,
            ]);
            if (recentServingIndex.has(key)) {
                recentServingGroups[recentServingIndex.get(key)].count += 1;
            } else {
                recentServingIndex.set(key, recentServingGroups.length);
                recentServingGroups.push({ key: `${key}-${index}`, log, count: 1 });
            }
        });

        return (
            <AdminShell
                title="Ads & Promotions Review"
                description="Review campaigns, payments and ad-placement decisions."
                actions={
                    <button
                        type="button"
                        onClick={refreshAdPage}
                        disabled={refreshing}
                        className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-4 text-sm font-bold text-[#173F35] transition hover:bg-[#D7DDCF] disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                }
            >
                {/* Ads review only: mobile layout is full width, without changing other Admin pages. */}
                <style>{`
                    @media (max-width: 639px) {
                      .page-shell:has(#admin-ads-promotions-mobile) {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                      }
                      .page-shell:has(#admin-ads-promotions-mobile) > div {
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                      }
                      .page-shell:has(#admin-ads-promotions-mobile) .epantry-workspace-canvas > div {
                        padding: 0 !important;
                      }
                      .page-shell:has(#admin-ads-promotions-mobile) .epantry-workspace-canvas > header {
                        padding: 12px 14px !important;
                      }
                      #admin-ads-promotions-mobile {
                        width: 100%;
                        min-width: 0;
                        overflow-x: clip;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-page-content { padding: 0 !important; }
                      #admin-ads-promotions-mobile .ads-mobile-summary {
                        display: block;
                        overflow: visible;
                        border-radius: 0;
                        border-bottom: 1px solid #D7DDCF;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-intro {
                        min-height: 0;
                        padding: 19px 16px 15px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-intro h2 {
                        max-width: none;
                        font-size: 24px;
                        line-height: 1.16;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-intro p { max-width: none; }
                      #admin-ads-promotions-mobile .ads-mobile-intro > div:last-child { margin-top: 12px; }
                      #admin-ads-promotions-mobile .ads-mobile-stats {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                      }
                      #admin-ads-promotions-mobile .ads-mobile-stats > div:first-child {
                        grid-column: 1 / -1;
                        padding: 11px 16px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-stats > div:first-child strong { font-size: 28px; }
                      #admin-ads-promotions-mobile .ads-mobile-stats > div:not(:first-child) {
                        padding: 12px 10px;
                        min-width: 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-stats > div:not(:first-child) p:first-child {
                        font-size: 23px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-review {
                        margin: 0;
                        padding: 18px 0 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-review > div:first-child {
                        padding: 0 16px 12px;
                        margin: 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-review-grid {
                        display: block;
                        overflow: visible;
                        border: 0;
                        border-radius: 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-inbox {
                        padding: 14px 16px 16px;
                        background: #F7F6F2;
                        color: #202421;
                        border-block: 1px solid #D7DDCF;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-inbox > p { color: #173F35; }
                      #admin-ads-promotions-mobile .ads-mobile-tabs {
                        gap: 0;
                        border-bottom: 1px solid #D7DDCF;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-tabs > button {
                        min-width: 0;
                        padding: 10px 8px !important;
                        border: 0 !important;
                        border-bottom: 3px solid transparent !important;
                        border-radius: 0 !important;
                        background: transparent !important;
                        color: #173F35 !important;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-tabs > button[aria-pressed="true"] {
                        border-bottom-color: #C56C42 !important;
                        background: #D7DDCF !important;
                        color: #202421 !important;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-list {
                        margin-top: 10px;
                        padding-right: 0;
                        gap: 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-list > button {
                        border: 0 !important;
                        border-bottom: 1px solid #D7DDCF !important;
                        border-radius: 0 !important;
                        background: transparent !important;
                        color: #202421 !important;
                        padding: 11px 3px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-list > button[aria-pressed="true"] {
                        background: #D7DDCF !important;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-empty {
                        margin: 0;
                        padding: 14px 0 0;
                        border-top: 0;
                        color: #202421;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-empty h3 { color: #202421; font-size: 19px; }
                      #admin-ads-promotions-mobile .ads-mobile-empty p { color: #173F35; }
                      #admin-ads-promotions-mobile .ads-mobile-details {
                        border-bottom: 1px solid #D7DDCF;
                        background: #F7F6F2;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-preview {
                        min-height: 0;
                        padding: 16px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-payment {
                        min-width: 0;
                        border-radius: 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-creative {
                        margin: 12px 0 0;
                        border: 0;
                        border-top: 3px solid #C56C42;
                        border-radius: 0;
                        background: transparent;
                        padding: 14px 0 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-history {
                        margin: 0;
                        padding: 20px 16px 0;
                        border-top: 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-history > div:first-child {
                        margin-bottom: 12px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-history-list {
                        border: 0;
                        border-top: 1px solid #D7DDCF;
                        border-radius: 0;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-history-row {
                        padding: 14px 0;
                        background: transparent;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-followup {
                        margin: 16px 16px 0;
                      }
                      /* Mobile type hierarchy only: keep the existing page sections and actions. */
                      .page-shell:has(#admin-ads-promotions-mobile) .epantry-workspace-canvas > header h1 {
                        font-size: 22px !important;
                        line-height: 1.17 !important;
                        letter-spacing: -0.025em;
                        text-wrap: wrap;
                      }
                      .page-shell:has(#admin-ads-promotions-mobile) .epantry-workspace-canvas > header p {
                        font-size: 13px !important;
                        line-height: 1.45 !important;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-intro h2 {
                        margin-top: 10px;
                        font-size: 21px;
                        line-height: 1.22;
                        letter-spacing: -0.02em;
                        text-wrap: balance;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-intro > div:first-child > p:first-child {
                        font-size: 11.5px;
                        letter-spacing: 0.035em;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-intro > div:first-child > p:last-child {
                        margin-top: 8px;
                        font-size: 13px;
                        line-height: 1.48;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-intro > div:last-child {
                        margin-top: 10px;
                        gap: 7px;
                        font-size: 12px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-stats > div:first-child strong {
                        font-size: 25px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-stats > div:not(:first-child) p:first-child {
                        font-size: 21px;
                        line-height: 1.1;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-stats p {
                        line-height: 1.35;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-review > div:first-child h2,
                      #admin-ads-promotions-mobile .ads-mobile-history > div:first-child h2 {
                        margin-top: 5px;
                        font-size: 21px;
                        line-height: 1.2;
                        letter-spacing: -0.018em;
                        text-wrap: balance;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-review > div:first-child > span {
                        font-size: 13px;
                        line-height: 1.4;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-inbox > div:first-child p {
                        font-size: 16px;
                        line-height: 1.3;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-inbox > p {
                        font-size: 13px;
                        line-height: 1.45;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-tabs > button > span:first-child {
                        font-size: 13.5px;
                        line-height: 1.35;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-tabs > button > span:last-child {
                        font-size: 12px;
                        line-height: 1.35;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-empty h3 {
                        font-size: 18px;
                        line-height: 1.24;
                        letter-spacing: -0.015em;
                        text-wrap: balance;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-empty > svg {
                        width: 22px;
                        height: 22px;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-preview h3,
                      #admin-ads-promotions-mobile .ads-mobile-details h3 {
                        font-size: 20px;
                        line-height: 1.23;
                        letter-spacing: -0.017em;
                        text-wrap: balance;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-preview > p,
                      #admin-ads-promotions-mobile .ads-mobile-details p {
                        overflow-wrap: anywhere;
                      }
                      #admin-ads-promotions-mobile .ads-mobile-followup summary span.block:last-child {
                        font-size: 13.5px;
                        line-height: 1.36;
                      }
                    }
                `}</style>
                <div id="admin-ads-promotions-mobile" className="w-full bg-[#F7F6F2] pb-9 text-[#202421] sm:pb-12">
                    <div className="ads-mobile-page-content w-full px-3 pt-4 sm:px-7 sm:pt-6">
                        <section aria-label="Campaign summary" className="ads-mobile-summary grid overflow-hidden rounded-[17px] lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
                            <div className="ads-mobile-intro relative flex min-h-[195px] flex-col justify-between bg-[#C56C42] px-5 py-6 sm:px-8 sm:py-8">
                                <div>
                                    <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#202421]">
                                        <span className="h-[2px] w-7 bg-[#202421]" aria-hidden="true" />
                                        Campaign review desk
                                    </p>
                                    <h2 className="mt-3 max-w-[660px] text-[29px] font-extrabold leading-[1.14] tracking-tight text-[#202421] sm:text-[39px]">
                                        Make the decision.<br className="hidden sm:block" /> Know what goes live.
                                    </h2>
                                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#202421] sm:text-[15px]">
                                        Check each campaign, its payment and where it can appear.
                                    </p>
                                </div>
                                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-[#202421] sm:text-sm">
                                    <span>Campaign</span><ChevronRight size={15} aria-hidden="true" />
                                    <span>Payment</span><ChevronRight size={15} aria-hidden="true" />
                                    <span>Decision</span>
                                </div>
                            </div>
                            <div className="ads-mobile-stats grid grid-cols-3 bg-[#D7DDCF] text-[#173F35]">
                                <div className="col-span-3 flex items-center justify-between gap-5 border-b border-[#F7F6F2] px-5 py-5 sm:px-7">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.06em]">Waiting for your review</p>
                                        <p className="mt-1 text-xs font-medium text-[#202421]">Campaigns requiring a decision</p>
                                    </div>
                                    <strong className="text-[43px] font-extrabold leading-none text-[#173F35] sm:text-[55px]">{pendingCampaigns.length}</strong>
                                </div>
                                {[
                                    ['All campaigns', adCampaigns.length],
                                    ['Paid & ready', paidPendingCampaigns.length],
                                    ['Approved / live', liveOrApprovedCampaigns.length],
                                ].map(([label, count], index) => (
                                    <div key={label} className={`min-w-0 px-3 py-4 sm:px-5 ${index !== 0 ? 'border-l border-[#F7F6F2]' : ''}`}>
                                        <p className="text-[24px] font-extrabold leading-none text-[#173F35] sm:text-[29px]">{count}</p>
                                        <p className="mt-2 text-xs font-semibold leading-4 text-[#202421]">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {adReviewError ? <div role="alert" className="mt-4 border-l-4 border-[#C56C42] bg-[#D7DDCF] px-4 py-3 text-sm font-bold text-[#202421]">{adReviewError}</div> : null}
                        {error ? <div role="alert" className="mt-4 border-l-4 border-[#C56C42] bg-[#D7DDCF] px-4 py-3 text-sm font-bold text-[#202421]">{error}</div> : null}
                        {notice ? <div role="status" className="mt-4 border-l-4 border-[#173F35] bg-[#D7DDCF] px-4 py-3 text-sm font-bold text-[#173F35]">{notice}</div> : null}

                        <section id="epantry-campaigns" aria-label="Campaign review workspace" className="ads-mobile-review mt-6 sm:mt-8">
                            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#C56C42]">01 / Campaigns</p>
                                    <h2 className="mt-1 text-[24px] font-extrabold tracking-tight text-[#202421] sm:text-[29px]">Review workspace</h2>
                                </div>
                                <span className="text-sm font-semibold text-[#173F35]">{visibleCampaigns.length} {adQueueView === 'review' ? 'awaiting review' : 'in catalogue'}</span>
                            </div>
                            <div className="ads-mobile-review-grid grid gap-0 overflow-hidden rounded-[16px] border border-[#D7DDCF] lg:grid-cols-[minmax(275px,0.72fr)_minmax(0,1.48fr)]">
                                <aside className="ads-mobile-inbox min-w-0 bg-[#202421] p-4 text-[#F7F6F2] sm:p-6" aria-label="Choose a campaign">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[17px] font-extrabold">Campaign inbox</p>
                                        <Megaphone size={19} className="text-[#C56C42]" aria-hidden="true" />
                                    </div>
                                    <p className="mb-4 mt-1 text-xs text-[#D7DDCF]">Choose a list to see its campaign details.</p>
                                    <div className="ads-mobile-tabs grid grid-cols-2 gap-2" role="group" aria-label="Campaign list filter">
                                        <button
                                            type="button"
                                            aria-pressed={adQueueView === 'review'}
                                            onClick={() => setAdQueueView('review')}
                                            className={`focus-ring min-h-11 rounded-lg px-2 py-2.5 text-left text-sm font-bold transition sm:px-3 ${adQueueView === 'review' ? 'bg-[#C56C42] text-[#202421]' : 'border border-[#D7DDCF] bg-[#202421] text-[#F7F6F2] hover:bg-[#173F35]'}`}
                                        >
                                            <span className="block">Needs review</span><span className="text-xs">{pendingCampaigns.length} campaigns</span>
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={adQueueView === 'all'}
                                            onClick={() => setAdQueueView('all')}
                                            className={`focus-ring min-h-11 rounded-lg px-2 py-2.5 text-left text-sm font-bold transition sm:px-3 ${adQueueView === 'all' ? 'bg-[#C56C42] text-[#202421]' : 'border border-[#D7DDCF] bg-[#202421] text-[#F7F6F2] hover:bg-[#173F35]'}`}
                                        >
                                            <span className="block">All campaigns</span><span className="text-xs">{adCampaigns.length} campaigns</span>
                                        </button>
                                    </div>
                                    {adReviewLoading ? (
                                        <div className="mt-6 flex items-center gap-2 text-sm text-[#F7F6F2]">
                                            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Loading campaigns…
                                        </div>
                                    ) : visibleCampaigns.length ? (
                                        <div className="ads-mobile-list mt-5 max-h-[520px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                                            {visibleCampaigns.map((campaign) => {
                                                const active = campaign.id === selectedCampaign?.id;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={campaign.id}
                                                        aria-pressed={active}
                                                        onClick={() => selectCampaign(campaign)}
                                                        className={`focus-ring flex w-full items-start justify-between gap-3 rounded-lg border-l-4 px-3 py-3 text-left transition ${active ? 'border-[#C56C42] bg-[#F7F6F2] text-[#202421]' : 'border-transparent bg-[#173F35] text-[#F7F6F2] hover:border-[#C56C42]'}`}
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block break-words text-sm font-extrabold">{campaign.title}</span>
                                                            <span className="mt-1 block break-words text-xs opacity-85">{queueLabel(campaign)}</span>
                                                            <span className="mt-2 block text-xs font-semibold">{statusLabel(campaign.status)} · {statusLabel(campaign.payment?.status)}</span>
                                                        </span>
                                                        <ChevronRight size={17} className="mt-1 shrink-0" aria-hidden="true" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="ads-mobile-empty mt-5 border-t border-[#173F35] pt-5">
                                            <CheckCircle2 size={28} className="text-[#C56C42]" strokeWidth={1.8} aria-hidden="true" />
                                            <h3 className="mt-2 text-lg font-extrabold text-[#F7F6F2]">
                                                {adQueueView === 'review' ? 'Nothing to approve right now' : 'No campaigns yet'}
                                            </h3>
                                            <p className="mt-1 text-sm leading-5 text-[#D7DDCF]">
                                                {adQueueView === 'review' ? 'Your review queue is clear.' : 'Submitted campaigns will appear here.'}
                                            </p>
                                            {adQueueView === 'review' && adCampaigns.length > 0 ? (
                                                <button type="button" onClick={() => setAdQueueView('all')} className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#C56C42] px-4 text-sm font-extrabold text-[#202421]">
                                                    Browse all campaigns <ArrowUpRight size={17} aria-hidden="true" />
                                                </button>
                                            ) : null}
                                        </div>
                                    )}
                                </aside>

                                <div className="ads-mobile-details min-w-0 bg-[#F7F6F2]">
                                    {adReviewLoading ? (
                                        <div className="flex min-h-[210px] items-center justify-center gap-3 p-6 text-sm font-semibold text-[#173F35]">
                                            <LoaderCircle size={22} className="animate-spin" aria-hidden="true" /> Loading campaign details…
                                        </div>
                                    ) : !selectedCampaign ? (
                                        <div className="ads-mobile-preview flex h-full min-h-[240px] flex-col justify-center px-5 py-6 sm:px-8">
                                            {adQueueView === 'review' && adCampaigns.length > 0 ? (
                                                <>
                                                    <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-[#C56C42]">Already in your catalogue</p>
                                                    <h3 className="mt-2 break-words text-[24px] font-extrabold leading-tight text-[#202421]">{adCampaigns[0].title}</h3>
                                                    <p className="mt-2 text-sm font-semibold text-[#173F35]">
                                                        {queueLabel(adCampaigns[0])} · {statusLabel(adCampaigns[0].status)} · {statusLabel(adCampaigns[0].payment?.status)}
                                                    </p>
                                                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#202421]">
                                                        No approval is pending. You can still open this campaign to see its record.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => { selectCampaign(adCampaigns[0]); setAdQueueView('all'); }}
                                                        className="focus-ring mt-5 inline-flex w-fit min-h-11 items-center gap-2 rounded-lg bg-[#173F35] px-5 text-sm font-extrabold text-[#F7F6F2]"
                                                    >
                                                        Open campaign record <ArrowUpRight size={17} aria-hidden="true" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xs font-bold uppercase tracking-[0.07em] text-[#C56C42]">Campaign records</p>
                                                    <h3 className="mt-2 text-xl font-extrabold text-[#202421]">No campaign selected</h3>
                                                    <p className="mt-2 text-sm text-[#173F35]">Choose a campaign from the list to see its details.</p>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="min-w-0">
                                            <div className="border-b border-[#D7DDCF] px-5 py-5 sm:px-7 sm:py-6">
                                                <div className="flex flex-wrap items-start justify-between gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-[#C56C42]">Selected campaign</p>
                                                        <h3 className="mt-2 break-words text-[24px] font-extrabold leading-[1.13] tracking-tight text-[#202421] sm:text-[31px]">{selectedCampaign.title}</h3>
                                                        <p className="mt-2 text-sm font-semibold text-[#173F35]">{queueLabel(selectedCampaign)}{selectedCampaign.brandName ? ` · ${selectedCampaign.brandName}` : ''}</p>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <span className={`rounded-full border px-3 py-1.5 text-xs font-extrabold ${statusTone(selectedCampaign.status)}`}>{statusLabel(selectedCampaign.status)}</span>
                                                            <span className={`rounded-full border px-3 py-1.5 text-xs font-extrabold ${statusTone(selectedCampaign.payment?.status)}`}>{statusLabel(selectedCampaign.payment?.status)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="ads-mobile-payment min-w-[170px] rounded-lg bg-[#173F35] px-4 py-3 text-[#F7F6F2]">
                                                        <p className="text-xs font-semibold">Required payment</p>
                                                        <p className="mt-1 text-[25px] font-extrabold leading-tight">{money(selectedCampaign.payment?.requiredAmountMinor, selectedCampaign.payment?.currency)}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#D7DDCF] pt-4 sm:grid-cols-4">
                                                    {[
                                                        ['Purpose', titleize(selectedCampaign.objective)],
                                                        ['Market', selectedCampaign.marketCodes?.join(', ') || 'Not set'],
                                                        ['Starts', shortDate(selectedCampaign.startsAt)],
                                                        ['Ends', shortDate(selectedCampaign.endsAt)],
                                                    ].map(([label, value]) => (
                                                        <div key={label} className="min-w-0">
                                                            <p className="text-xs font-medium text-[#173F35]">{label}</p>
                                                            <p className="mt-1 break-words text-sm font-extrabold text-[#202421]">{value}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid lg:grid-cols-2">
                                                <section className="min-w-0 px-5 py-5 sm:px-7" aria-label="Ad creative preview">
                                                    <h4 className="text-xs font-extrabold uppercase tracking-[0.07em] text-[#C56C42]">Ad creative</h4>
                                                    <div className="ads-mobile-creative mt-3 rounded-lg border-l-4 border-[#C56C42] bg-[#D7DDCF] p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="rounded-md bg-[#F7F6F2] px-2.5 py-1 text-xs font-bold text-[#173F35]">{selectedCampaign.creative?.sponsorLabel || 'Sponsored'}</span>
                                                            <span className="text-xs font-semibold text-[#173F35]">{selectedCampaign.placements?.length || 0} placements</span>
                                                        </div>
                                                        <p className="mt-3 break-words text-lg font-extrabold leading-snug text-[#202421]">{selectedCampaign.creative?.headline || selectedCampaign.title}</p>
                                                        {selectedCampaign.creative?.body ? <p className="mt-2 break-words text-sm leading-6 text-[#173F35]">{selectedCampaign.creative.body}</p> : null}
                                                        <p className="mt-3 break-all text-xs font-semibold text-[#173F35]">{selectedCampaign.creative?.landingRef || 'No destination provided'}</p>
                                                    </div>
                                                </section>
                                                <section className="min-w-0 border-t border-[#D7DDCF] px-5 py-5 lg:border-l lg:border-t-0 sm:px-7" aria-label="Approval checks">
                                                    <h4 className="text-xs font-extrabold uppercase tracking-[0.07em] text-[#C56C42]">Approval checklist</h4>
                                                    <div className="mt-3 divide-y divide-[#D7DDCF]">
                                                        {[
                                                            ['Payment', statusLabel(selectedCampaign.payment?.status)],
                                                            ['Sponsorship label', selectedCampaign.commercialDisclosure || 'Not provided'],
                                                            ['Placement', selectedCampaign.placements?.map(placementLabel).join(', ') || 'Not selected'],
                                                            ['Frequency', `Up to ${selectedCampaign.frequencyCapPerContext || 1} times`],
                                                        ].map(([label, value]) => (
                                                            <div key={label} className="flex items-start justify-between gap-3 py-3">
                                                                <span className="text-xs font-medium text-[#173F35]">{label}</span>
                                                                <span className="max-w-[60%] break-words text-right text-sm font-bold text-[#202421]">{value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            </div>
                                            <div className="border-t border-[#D7DDCF] bg-[#F7F6F2] px-5 py-5 sm:px-7 sm:py-6">
                                                {selectedCampaign.status === 'pending_review' ? (
                                                    <>
                                                        {selectedCampaign.payment?.status !== 'paid' ? (
                                                            <div className="mb-4 flex gap-2 rounded-lg border-l-4 border-[#C56C42] bg-[#D7DDCF] px-4 py-3 text-sm font-semibold text-[#202421]">
                                                                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#C56C42]" aria-hidden="true" />
                                                                Payment is incomplete. Approval is available once payment is confirmed.
                                                            </div>
                                                        ) : null}
                                                        {canReviewAds ? (
                                                            <div className="space-y-3">
                                                                <label className="block text-sm font-bold text-[#202421]" htmlFor="ad-review-reason">Reason for decision</label>
                                                                <textarea id="ad-review-reason" value={adReviewReason} onChange={(event) => setAdReviewReason(event.target.value)} rows={3} placeholder="Explain the campaign decision." className={inputClass} />
                                                                <label className="block text-sm font-bold text-[#202421]" htmlFor="ad-review-evidence">Review reference</label>
                                                                <input id="ad-review-evidence" value={adEvidenceRef} onChange={(event) => setAdEvidenceRef(event.target.value)} placeholder="Evidence / reference" className={inputClass} />
                                                                <div className="flex flex-wrap gap-2 pt-2">
                                                                    <button type="button" disabled={busy || adReviewReason.trim().length < 10 || selectedCampaign.payment?.status !== 'paid'} onClick={() => reviewCampaign('approve')} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#173F35] px-5 text-sm font-bold text-[#F7F6F2] disabled:opacity-40"><CheckCircle2 size={18} aria-hidden="true" /> Approve campaign</button>
                                                                    <button type="button" disabled={busy || adReviewReason.trim().length < 10} onClick={() => reviewCampaign('reject')} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#C56C42] bg-[#F7F6F2] px-5 text-sm font-bold text-[#202421] disabled:opacity-40"><XCircle size={18} className="text-[#C56C42]" aria-hidden="true" /> Reject campaign</button>
                                                                </div>
                                                            </div>
                                                        ) : <p className="text-sm text-[#173F35]">Only an authorised Super Admin can record the final decision.</p>}
                                                    </>
                                                ) : (
                                                    <div className="border-l-[3px] border-[#173F35] pl-4">
                                                        <p className="text-sm font-extrabold text-[#202421]">Decision recorded</p>
                                                        <p className="mt-1 break-words text-sm leading-6 text-[#173F35]">{selectedCampaign.review?.reason || `This campaign is ${statusLabel(selectedCampaign.status).toLowerCase()}.`}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="ads-mobile-history mt-7 border-t border-[#D7DDCF] pt-6 sm:mt-9" aria-label="Recent sponsored ad decisions">
                            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-[#C56C42]">02 / Recent checks</p>
                                    <h2 className="mt-1 text-[23px] font-extrabold leading-tight text-[#202421] sm:text-[28px]">Ad placement history</h2>
                                </div>
                                <span className="rounded-full bg-[#D7DDCF] px-4 py-2 text-xs font-bold text-[#173F35]">
                                    {Math.min(adDecisionLogs.length, 8)} recent {Math.min(adDecisionLogs.length, 8) === 1 ? 'record' : 'records'}
                                </span>
                            </div>
                            <div className="ads-mobile-history-list overflow-hidden rounded-[14px] border border-[#D7DDCF]">
                                {recentServingGroups.length === 0 ? (
                                    <p className="px-5 py-5 text-sm text-[#173F35]">No ad-placement decisions recorded yet.</p>
                                ) : (
                                    <>
                                        <div className="hidden grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4 bg-[#173F35] px-5 py-3 text-xs font-bold text-[#F7F6F2] sm:grid">
                                            <span>Placement</span><span>Market</span><span>Reason</span><span>Result</span>
                                        </div>
                                        {recentServingGroups.map((entry) => {
                                            const log = entry.log;
                                            return (
                                                <div key={entry.key} className="ads-mobile-history-row grid gap-2 border-t border-[#D7DDCF] bg-[#F7F6F2] px-4 py-4 first:border-t-0 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-extrabold text-[#202421]">{placementLabel(log.placement)}</span>
                                                        {entry.count > 1 ? <span className="rounded-full bg-[#C56C42] px-2 py-0.5 text-xs font-bold text-[#202421]">×{entry.count}</span> : null}
                                                    </div>
                                                    <span className="text-xs font-semibold text-[#173F35] sm:text-sm">{log.marketCode || 'IN'} · {titleize(log.promotedEntityType)}</span>
                                                    <p className="break-words text-xs text-[#173F35] sm:text-sm">{(log.reasonCodes || []).map(titleize).join(', ') || 'No extra note'}</p>
                                                    <span className="w-fit rounded-full border border-[#D7DDCF] bg-[#D7DDCF] px-3 py-1.5 text-xs font-bold text-[#202421]">{titleize(log.outcome)}</span>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </section>

                        <details className="ads-mobile-followup mt-7 border-y border-[#D7DDCF]" aria-label="Other admin follow-up">
                            <summary className="focus-ring flex cursor-pointer items-center justify-between gap-4 py-4 text-[#202421]">
                                <span>
                                    <span className="block text-xs font-extrabold uppercase tracking-[0.06em] text-[#C56C42]">Other admin follow-up</span>
                                    <span className="mt-1 block text-sm font-extrabold">Marketplace cases and platform issues</span>
                                </span>
                                <span className="shrink-0 bg-[#D7DDCF] px-3 py-1.5 text-xs font-bold text-[#173F35]">{genericFollowUpCount} open</span>
                            </summary>
                            <div className="border-t border-[#D7DDCF] pb-5 pt-4">
                                <div className="grid gap-5 sm:grid-cols-3">
                                    {[
                                        ['Review cases', reviewCases],
                                        ['Incidents', incidents],
                                        ['Support cases', supportCases],
                                    ].map(([label, items]) => (
                                        <div key={label} className="border-l-4 border-[#C56C42] pl-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-extrabold text-[#202421]">{label}</p>
                                                <span className="text-sm font-bold text-[#173F35]">{items.length}</span>
                                            </div>
                                            {items.length ? (
                                                <div className="mt-2 space-y-2">
                                                    {items.slice(0, 4).map((item) => (
                                                        <div key={item.id} className="border-t border-[#D7DDCF] pt-2">
                                                            <p className="break-words text-sm font-semibold text-[#202421]">{item.summary || item.title || item.caseKey || item.incidentKey || item.supportKey || 'Admin item'}</p>
                                                            <p className="mt-1 text-xs text-[#173F35]">{titleize(item.status)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <p className="mt-2 text-sm text-[#173F35]">Nothing open.</p>}
                                        </div>
                                    ))}
                                </div>
                                <details className="mt-5 border-t border-[#D7DDCF] pt-3">
                                    <summary className="focus-ring cursor-pointer text-sm font-bold text-[#173F35]">Other platform counts</summary>
                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {metricEntries.map(([label, value]) => (
                                            <div key={label} className="border border-[#D7DDCF] px-3 py-3">
                                                <p className="text-lg font-extrabold text-[#202421]">{value ?? 0}</p>
                                                <p className="mt-1 text-xs font-medium text-[#173F35]">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        </details>
                    </div>
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
            items.map((item, index) => {
                // All three image fields are already supplied by /landing/featured.
                // A missing image remains a neutral icon, never a made-up photo.
                const imageField = cmsCollection === 'brands'
                    ? (item?.logoUrl || item?.logo?.url || item?.image?.url || item?.image)
                    : (item?.image?.url || item?.image || item?.heroImageUrl);
                const imageUrl = typeof imageField === 'string' ? imageField.trim() : '';
                const ItemIcon = cmsCollection === 'brands'
                    ? Building2
                    : cmsCollection === 'grocery'
                        ? ShoppingBag
                        : Boxes;

                return (
                    <div
                        key={item?.id || item?.slug || `${cmsCollection}-${index}`}
                        className="group flex min-w-0 items-center gap-2 border-b border-[#D7DDCF] px-2 py-2.5 transition-colors hover:bg-[#D7DDCF]/30 sm:gap-4 sm:px-5 sm:py-4"
                    >
                        <div className="relative grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-lg border border-[#D7DDCF] bg-[#E6E9E0] sm:h-[94px] sm:w-[94px]">
                            <ItemIcon size={27} className="text-[#173F35]/55" aria-hidden="true" />
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={cmsItemTitle(item)}
                                    loading="lazy"
                                    decoding="async"
                                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                    className={`absolute inset-0 h-full w-full bg-[#F7F6F2] ${cmsCollection === 'brands' ? 'object-contain p-2.5' : 'object-cover'}`}
                                />
                            ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="break-words text-[13px] font-bold leading-[1.3] text-[#202421] sm:line-clamp-2 sm:text-base sm:leading-6">
                                {cmsItemTitle(item)}
                            </p>
                            {cmsItemMeta(item) ? (
                                <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-[#173F35]/75 sm:mt-1 sm:line-clamp-2 sm:text-[13px] sm:leading-5">
                                    {cmsItemMeta(item)}
                                </p>
                            ) : null}
                        </div>
                        <Link
                            to={selectedCollection.managePath}
                            aria-label={`Manage ${cmsItemTitle(item)}`}
                            className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 self-center rounded-full bg-[#D7DDCF] text-xs font-bold text-[#173F35] transition-colors hover:text-[#C56C42] sm:h-auto sm:w-auto sm:rounded-none sm:border-b-2 sm:border-[#C56C42] sm:bg-transparent sm:pb-1 sm:text-sm"
                        >
                            <span className="hidden sm:inline">Manage</span>
                            <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                );
            });

        return (
            <AdminShell
                title="Home Content"
                description={<span className="hidden sm:inline">See what is live on the homepage, open the right source, and review CMS changes.</span>}
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
                <div className="min-w-0 bg-[#F7F6F2] pb-7 sm:pb-10">
                    <section className="overflow-hidden border-b border-[#D7DDCF]">
                        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                            <div className="relative bg-[#C56C42] px-3 py-4 text-[#202421] sm:px-8 sm:py-9">
                                <p className="hidden items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] sm:flex">
                                    <span className="h-[2px] w-7 bg-[#173F35]" aria-hidden="true" />
                                    Homepage overview
                                </p>
                                <h2 className="mt-2 max-w-2xl text-[22px] font-bold leading-[1.15] tracking-[-0.03em] sm:mt-4 sm:text-[37px] sm:leading-[1.1] sm:tracking-[-0.04em]">
                                    <span className="sm:hidden">Live homepage</span>
                                    <span className="hidden sm:inline">Everything customers see, in one place.</span>
                                </h2>
                                <p className="mt-3 hidden max-w-xl text-sm leading-6 text-[#202421]/85 sm:block">
                                    Review live content, then open its source to make changes.
                                </p>
                                <a
                                    href="/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="focus-ring mt-3 inline-flex items-center gap-2 border-b-2 border-[#202421] pb-1 text-xs font-bold text-[#202421] hover:text-[#173F35] sm:mt-5 sm:text-sm"
                                >
                                    Open homepage <ArrowUpRight size={16} aria-hidden="true" />
                                </a>
                            </div>
                            <div className="grid grid-cols-3 bg-[#D7DDCF] lg:items-center">
                                {[
                                    ['Live items', liveItemCount],
                                    ['Reviews', reviewCases.length],
                                    ['Open issues', openCmsWork],
                                ].map(([label, value], index) => (
                                    <div
                                        key={label}
                                        className={`flex min-w-0 flex-col justify-center px-1.5 py-3 text-center sm:px-5 sm:py-6 ${index > 0 ? 'border-l border-[#173F35]/15' : ''}`}
                                    >
                                        <p className="text-[23px] font-bold tracking-[-0.04em] text-[#173F35] sm:text-[39px]">{value}</p>
                                        <p className="mt-0.5 text-[12px] font-semibold text-[#173F35] sm:mt-1 sm:text-[13px]">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1.5 bg-[#202421] px-5 py-3 text-xs font-semibold text-[#F7F6F2] sm:flex sm:px-8 sm:text-sm">
                            <span>01 / Check what's live</span>
                            <ChevronRight size={13} className="text-[#C56C42]" aria-hidden="true" />
                            <span>02 / Open its manager</span>
                            <ChevronRight size={13} className="text-[#C56C42]" aria-hidden="true" />
                            <span>03 / Refresh to confirm</span>
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

                    <section className="border-b border-[#D7DDCF] bg-[#F7F6F2] px-2 pb-0 pt-4 sm:px-7 sm:pt-8">
                        <div className="flex flex-wrap items-end justify-between gap-2 pb-3 sm:gap-3 sm:pb-5">
                            <div>
                                <p className="hidden text-[11px] font-bold uppercase tracking-[0.06em] text-[#C56C42] sm:block">01 / Live collections</p>
                                <h2 className="mt-0 text-[21px] font-bold tracking-[-0.03em] text-[#202421] sm:mt-1 sm:text-[30px]"><span className="sm:hidden">Collections</span><span className="hidden sm:inline">Choose what to review</span></h2>
                            </div>
                            <p className="hidden max-w-sm text-[13px] leading-5 text-[#173F35]/80 sm:block">Published grocery, brands and recipes shown on your homepage.</p>
                        </div>
                        <div className="grid grid-cols-3 overflow-hidden border border-[#D7DDCF] bg-[#F7F6F2]">
                            {collectionDefinitions.map((item, index) => {
                                const active = cmsCollection === item.value;
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => {
                                            setCmsCollection(item.value);
                                            setCmsShowAll(false);
                                        }}
                                        className={`focus-ring relative flex min-w-0 flex-col justify-between gap-1 px-2 py-2.5 text-left transition-colors sm:gap-3 sm:px-6 sm:py-5 ${index > 0 ? 'border-l border-[#D7DDCF]' : ''} ${active ? 'bg-[#173F35] text-[#F7F6F2]' : 'bg-[#F7F6F2] text-[#202421] hover:bg-[#D7DDCF]/45'}`}
                                    >
                                        {active ? <span className="absolute inset-x-0 top-0 h-[4px] bg-[#C56C42]" aria-hidden="true" /> : null}
                                        <div className="flex min-w-0 items-center justify-between gap-2">
                                            <span className="text-[12px] font-bold sm:text-[19px]">{item.label}</span>
                                            <span className={`text-[13px] font-bold sm:text-2xl ${active ? 'text-[#F7F6F2]' : 'text-[#C56C42]'}`}>{item.count}</span>
                                        </div>
                                        <span className={`hidden text-[12px] leading-5 sm:block ${active ? 'text-[#F7F6F2]/75' : 'text-[#173F35]/70'}`}>
                                            {item.value === 'grocery' ? 'Products on the homepage' : item.value === 'brands' ? 'Available brand profiles' : 'Recipes customers can open'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="bg-[#F7F6F2] px-1 py-3 sm:px-7 sm:py-7">
                        <div className="overflow-hidden border border-[#D7DDCF] border-t-[4px] border-t-[#C56C42] bg-[#F7F6F2]">
                            <div className="flex items-center justify-between gap-2 border-b border-[#D7DDCF] px-3 py-3 sm:flex-wrap sm:items-end sm:gap-3 sm:px-6 sm:py-5">
                                <div>
                                    <p className="hidden text-[11px] font-bold uppercase tracking-[0.06em] text-[#C56C42] sm:block">02 / {selectedCollection.label}</p>
                                    <h2 className="mt-0 text-[18px] font-bold tracking-[-0.02em] text-[#202421] sm:mt-1 sm:text-[26px]"><span className="sm:hidden">{selectedCollection.label} items</span><span className="hidden sm:inline">Live homepage items</span></h2>
                                    <p className="mt-1 hidden text-[13px] text-[#173F35]/75 sm:block">{collectionItems.length} {collectionItems.length === 1 ? 'item' : 'items'} in this collection</p>
                                </div>
                                <Link
                                    to={selectedCollection.managePath}
                                    className="focus-ring inline-flex shrink-0 items-center gap-1 bg-[#173F35] px-2.5 py-2 text-xs font-bold text-[#F7F6F2] transition-colors hover:bg-[#202421] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                                >
                                    <span className="sm:hidden">Manage</span><span className="hidden sm:inline">Open manager</span> <ArrowUpRight size={15} aria-hidden="true" />
                                </Link>
                            </div>
                            {cmsLoading ? (
                                <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-7 text-sm font-semibold text-[#173F35]">
                                    <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                                    Loading homepage items…
                                </div>
                            ) : collectionItems.length === 0 ? (
                                <div className="flex flex-col items-start gap-2 px-4 py-7 sm:px-6">
                                    <p className="text-base font-bold text-[#202421]">No live {selectedCollection.label.toLowerCase()} items yet</p>
                                    <p className="text-sm leading-5 text-[#173F35]/75">Publish an eligible item, then refresh this page.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid sm:hidden">
                                        {renderCmsRows(cmsShowAll ? collectionItems : collectionItems.slice(0, 6))}
                                    </div>
                                    <div className="hidden sm:grid sm:grid-cols-2 sm:[&>div:nth-child(odd)]:border-r sm:[&>div:nth-child(odd)]:border-r-[#D7DDCF]">
                                        {renderCmsRows(cmsShowAll ? collectionItems : collectionItems.slice(0, 10))}
                                    </div>
                                    {collectionItems.length > 6 ? (
                                        <div className="py-2 text-center sm:hidden">
                                            <button
                                                type="button"
                                                onClick={() => setCmsShowAll((value) => !value)}
                                                className="focus-ring border-b-2 border-[#C56C42] px-2 py-1 text-sm font-bold text-[#173F35]"
                                            >
                                                {cmsShowAll ? 'Show fewer' : `View all ${collectionItems.length} items`}
                                            </button>
                                        </div>
                                    ) : null}
                                    {collectionItems.length > 10 ? (
                                        <div className="hidden py-3 text-center sm:block">
                                            <button
                                                type="button"
                                                onClick={() => setCmsShowAll((value) => !value)}
                                                className="focus-ring border-b-2 border-[#C56C42] px-2 py-1 text-sm font-bold text-[#173F35]"
                                            >
                                                {cmsShowAll ? 'Show fewer' : `View all ${collectionItems.length} items`}
                                            </button>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </section>

                    <section className="border-y border-[#D7DDCF] bg-[#E9ECE5]">
                        <div className="flex items-center justify-between gap-2 border-b border-[#D7DDCF] px-3 py-3 sm:flex-wrap sm:items-end sm:gap-3 sm:px-7 sm:py-5">
                            <div>
                                <p className="hidden text-[11px] font-bold uppercase tracking-[0.06em] text-[#C56C42] sm:block">03 / Site checks</p>
                                <h2 className="mt-0 text-[19px] font-bold tracking-[-0.02em] text-[#202421] sm:mt-1 sm:text-[26px]"><span className="sm:hidden">Site checks</span><span className="hidden sm:inline">Changes that need attention</span></h2>
                            </div>
                            <span className="text-sm font-bold text-[#173F35]">{openCmsWork} open</span>
                        </div>
                        {reviewCases.length + incidents.length + supportCases.length === 0 ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-[13px] font-semibold text-[#173F35] sm:hidden">
                                <CheckCircle2 size={16} aria-hidden="true" /> All clear — nothing to review
                            </div>
                        ) : null}
                        <div className={`${reviewCases.length + incidents.length + supportCases.length === 0 ? 'hidden sm:grid' : 'grid'} lg:grid-cols-3`}>
                            {[
                                ['review', 'Change reviews', reviewCases],
                                ['incident', 'Homepage issues', incidents],
                                ['support', 'Support requests', supportCases],
                            ].map(([type, label, items], groupIndex) => (
                                <div key={type} className={`min-w-0 px-3 py-3 sm:px-7 sm:py-5 ${groupIndex > 0 ? 'border-t border-[#D7DDCF] lg:border-l lg:border-t-0' : ''}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold text-[#202421] sm:text-base">{label}</p>
                                        <span className="text-base font-bold text-[#173F35]">{items.length}</span>
                                    </div>
                                    {items.length === 0 ? (
                                        <p className="mt-3 hidden text-[13px] text-[#173F35]/70 sm:block">Nothing waiting</p>
                                    ) : (
                                        <div className="mt-2">
                                            {items.map((item, index) => (
                                                <button
                                                    key={item?.id || `${type}-${index}`}
                                                    type="button"
                                                    onClick={() => chooseCmsActivity(type, item)}
                                                    className={`focus-ring block w-full py-3 text-left ${index > 0 ? 'border-t border-[#D7DDCF]' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="line-clamp-2 text-sm font-bold text-[#202421]">{cmsActivityTitle(type, item)}</p>
                                                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#173F35]/75">{cmsActivityDescription(type, item)}</p>
                                                        </div>
                                                        <span className="shrink-0 border-l-2 border-[#C56C42] pl-2 text-[11px] font-semibold text-[#173F35]">{titleize(item?.status)}</span>
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
                        <section className="border-b border-[#D7DDCF] bg-[#D7DDCF] px-4 py-4 sm:px-7 sm:py-5">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
                                <div>
                                    <p className="text-xs font-bold text-[#173F35]">Selected admin item</p>
                                    <h2 className="mt-1 text-lg font-black text-[#202421]">{cmsActivityTitle(activitySelection.type, activitySelection.item)}</h2>
                                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">{cmsActivityDescription(activitySelection.type, activitySelection.item)}</p>
                                    <p className="mt-2 text-[11px] font-bold text-stone-500">Status: {titleize(activitySelection.item?.status)}</p>
                                </div>

                                <div>
                                    <input
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder="Reason for this decision"
                                        className="h-11 w-full rounded-xl border border-[#D7DDCF] bg-[#F7F6F2] px-3 text-sm font-semibold text-stone-800 outline-none focus:border-[#C56C42]"
                                    />

                                    <details className="mt-2 border-t border-[#D7DDCF] pt-2">
                                        <summary className="cursor-pointer text-[11px] font-black text-stone-600">Add evidence (optional)</summary>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                            <input
                                                value={evidenceLabel}
                                                onChange={(event) => setEvidenceLabel(event.target.value)}
                                                placeholder="Evidence label"
                                                className="h-10 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 text-xs font-semibold text-stone-800 outline-none focus:border-[#C56C42]"
                                            />
                                            <input
                                                value={evidenceReferenceId}
                                                onChange={(event) => setEvidenceReferenceId(event.target.value)}
                                                placeholder="Reference ID"
                                                className="h-10 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 text-xs font-semibold text-stone-800 outline-none focus:border-[#C56C42]"
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
                                                    className="focus-ring rounded-lg bg-[#173F35] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
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
                                                        className="focus-ring rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 py-2 text-xs font-black text-[#173F35] disabled:opacity-50"
                                                    >
                                                        Keep monitoring
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy || reason.trim().length < 3}
                                                        onClick={() => updateCmsIncident('resolved')}
                                                        className="focus-ring rounded-lg bg-[#173F35] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
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
                                                        className="focus-ring rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 py-2 text-xs font-black text-[#173F35] disabled:opacity-50"
                                                    >
                                                        Start work
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy || reason.trim().length < 3}
                                                        onClick={() => updateCmsSupport('resolved')}
                                                        className="focus-ring rounded-lg bg-[#173F35] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
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
                        <details className="bg-[#D7DDCF]">
                            <summary className="cursor-pointer list-none border-b border-[#D7DDCF] px-4 py-3 text-xs font-black text-stone-700 sm:px-7">
                                Other admin signals
                            </summary>
                            <div className="grid grid-cols-2 sm:grid-cols-4">
                                {metricEntries.map(([label, value], index) => (
                                    <div
                                        key={label}
                                        className={`px-4 py-3 ${index % 2 === 1 ? 'border-l border-[#D7DDCF]' : ''} ${index >= 2 ? 'border-t border-[#D7DDCF] sm:border-t-0' : ''} ${index > 0 ? 'sm:border-l sm:border-[#D7DDCF]' : ''}`}
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
        const openOrders = ordersWorkspace.orders || [];
        const recentOrders = ordersWorkspace.recentOrders || [];
        const visibleRecentOrders = showAllRecentOrders ? recentOrders : recentOrders.slice(0, 8);
        const refreshing = loading || ordersLoading;
        const activeCaseCount = activeOrderDisputeCases.length;
        const orderMetricUnavailable = Boolean(ordersError && !openOrders.length);
        const caseMetricUnavailable = Boolean(orderCasesError && !orderReviewCases.length);
        const chosenOrder = ordersFocus === 'order' ? selectedOrder : null;
        const chosenCase = ordersFocus === 'case' && selectedReviewCase?.caseType === 'marketplace_dispute' ? selectedReviewCase : null;
        const chosenCaseClosed = ['resolved', 'dismissed'].includes(chosenCase?.status);
        const visibleOrderList = openOrders;

        const refreshOrdersPage = () => {
            load();
            loadOrdersWorkspace();
        };

        const createDisputeForSelectedOrder = async () => {
            if (!selectedOrder || reason.trim().length < 5) return;
            const itemLabel = selectedOrder.itemNames?.[0] || selectedOrder.sellerName || 'Order';
            const result = await run(
                () => createAdminReviewCase({
                    domain: 'marketplace',
                    caseType: 'marketplace_dispute',
                    entity: { type: 'seller_order', id: selectedOrder.id, label: itemLabel },
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
                setOrdersFocus('case');
                setReason('');
                await loadOrdersWorkspace();
            }
        };

        const decideSelectedOrderCase = async (decision) => {
            if (!selectedReviewCase || reason.trim().length < 5 ||
                ['resolved', 'dismissed'].includes(selectedReviewCase.status)) return;
            const result = await run(
                () => decideAdminReviewCase(selectedReviewCase.id, {
                    decision,
                    reason: reason.trim(),
                    evidence: evidence(),
                }),
                decision === 'resolve' ? 'Dispute resolved.' :
                    decision === 'dismiss' ? 'Dispute closed without action.' : 'Dispute marked for follow-up.',
            );
            if (result) {
                setSelectedReviewCase(null);
                setReason('');
                await loadOrdersWorkspace();
            }
        };

        return (
            <AdminShell
                title="Orders & Disputes"
                description="Review order issues and manage dispute decisions."
                actions={
                    <button type="button" onClick={refreshOrdersPage} disabled={refreshing}
                        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D6DDD3] bg-white px-4 text-[14px] font-semibold text-[#173F35] disabled:opacity-50">
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
                    </button>
                }
            >
                {/* Order page only: mobile edge-to-edge layout, without modifying shared AdminShell. */}
                <style>{`
                  @media (max-width: 639px) {
                    .page-shell:has(#admin-orders-disputes-mobile) {
                      width: 100% !important;
                      max-width: none !important;
                      margin: 0 !important;
                      padding: 0 !important;
                    }
                    .page-shell:has(#admin-orders-disputes-mobile) > div {
                      border: 0 !important;
                      border-radius: 0 !important;
                      box-shadow: none !important;
                    }
                    .page-shell:has(#admin-orders-disputes-mobile) .epantry-workspace-canvas > div {
                      padding: 0 !important;
                    }
                    .page-shell:has(#admin-orders-disputes-mobile) .epantry-workspace-canvas > header {
                      padding: 12px 14px 14px !important;
                    }
                    .page-shell:has(#admin-orders-disputes-mobile) .epantry-workspace-canvas > header h1 {
                      font-size: 26px !important;
                      line-height: 1.12 !important;
                      letter-spacing: -0.03em;
                    }
                    .page-shell:has(#admin-orders-disputes-mobile) .epantry-workspace-canvas > header p {
                      font-size: 12px !important;
                      line-height: 1.45 !important;
                    }
                    #admin-orders-disputes-mobile { width: 100%; overflow-x: clip; }
                    #admin-orders-disputes-mobile .orders-hero-primary { padding: 18px 16px 20px; }
                    #admin-orders-disputes-mobile .orders-hero-kicker,
                    #admin-orders-disputes-mobile .orders-hero-support,
                    #admin-orders-disputes-mobile .orders-hero-steps,
                    #admin-orders-disputes-mobile .orders-hero-dispute-summary { display: none; }
                    #admin-orders-disputes-mobile .orders-hero-title {
                      font-size: 25px;
                      line-height: 1.14;
                      letter-spacing: -0.035em;
                      margin-top: 0;
                    }
                    #admin-orders-disputes-mobile .orders-metrics > div {
                      padding: 12px 14px;
                      min-height: 72px;
                    }
                    #admin-orders-disputes-mobile .orders-metrics > div > p:first-child {
                      font-size: 25px;
                    }
                    #admin-orders-disputes-mobile .orders-metrics > div > p:last-child {
                      font-size: 12px;
                      line-height: 1.25;
                      margin-top: 5px;
                    }
                    #admin-orders-disputes-mobile .orders-workqueue {
                      padding: 17px 0 14px;
                    }
                    #admin-orders-disputes-mobile .orders-workqueue-heading {
                      padding: 0 15px;
                      margin-bottom: 12px;
                    }
                    #admin-orders-disputes-mobile .orders-workqueue-kicker,
                    #admin-orders-disputes-mobile .orders-queue-subtitle,
                    #admin-orders-disputes-mobile .orders-empty-subtitle { display: none; }
                    #admin-orders-disputes-mobile .orders-workqueue-title {
                      font-size: 21px;
                      margin-top: 0;
                      line-height: 1.2;
                    }
                    #admin-orders-disputes-mobile .orders-workqueue-grid { gap: 9px; padding: 0 12px; }
                    #admin-orders-disputes-mobile .orders-queue-section {
                      border: 1px solid #DFE4DB;
                      border-radius: 12px;
                      overflow: hidden;
                    }
                    #admin-orders-disputes-mobile .orders-queue-head { padding: 11px 13px; }
                    #admin-orders-disputes-mobile .orders-queue-head h3 { font-size: 16px; }
                    #admin-orders-disputes-mobile .orders-empty-wrap { padding: 0; }
                    #admin-orders-disputes-mobile .orders-empty { padding: 12px 13px; gap: 9px; }
                    #admin-orders-disputes-mobile .orders-empty svg { width: 17px; height: 17px; }
                    #admin-orders-disputes-mobile .orders-empty p { font-size: 13px; line-height: 1.4; }
                    #admin-orders-disputes-mobile .orders-activity {
                      margin: 15px 12px 0;
                      border: 1px solid #E0E4DC;
                      border-radius: 14px;
                    }
                    #admin-orders-disputes-mobile .orders-activity-heading {
                      padding: 14px 14px;
                      gap: 8px;
                    }
                    #admin-orders-disputes-mobile .orders-activity-kicker { display: none; }
                    #admin-orders-disputes-mobile .orders-activity-heading h3 {
                      font-size: 19px;
                      margin-top: 0;
                      line-height: 1.2;
                    }
                    #admin-orders-disputes-mobile .orders-activity-count {
                      font-size: 12px;
                      padding: 6px 9px;
                      white-space: nowrap;
                    }
                    #admin-orders-disputes-mobile .orders-recent-row {
                      display: grid !important;
                      grid-template-columns: 52px minmax(0, 1fr) 28px;
                      grid-template-rows: auto auto;
                      gap: 5px 10px;
                      align-items: center;
                      padding: 12px 11px !important;
                      min-width: 0;
                    }
                    #admin-orders-disputes-mobile .orders-recent-row > :first-child {
                      grid-column: 1;
                      grid-row: 1 / span 2;
                      width: 52px !important;
                      height: 52px !important;
                      border-radius: 9px;
                    }
                    #admin-orders-disputes-mobile .orders-recent-identity {
                      grid-column: 2;
                      grid-row: 1;
                      align-self: end;
                    }
                    #admin-orders-disputes-mobile .orders-recent-identity > span:first-child {
                      display: -webkit-box;
                      -webkit-line-clamp: 2;
                      -webkit-box-orient: vertical;
                      overflow: hidden;
                      font-size: 14px;
                      line-height: 1.25;
                      overflow-wrap: anywhere;
                    }
                    #admin-orders-disputes-mobile .orders-recent-identity > span:nth-child(2) {
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      font-size: 11px;
                      line-height: 1.4;
                      margin-top: 3px;
                    }
                    #admin-orders-disputes-mobile .orders-recent-controls { display: contents !important; }
                    #admin-orders-disputes-mobile .orders-recent-badge {
                      grid-column: 2;
                      grid-row: 2;
                      justify-self: start;
                      max-width: 100%;
                      min-width: 0;
                      font-size: 11px;
                      padding: 4px 8px;
                      line-height: 1.3;
                      text-align: left;
                    }
                    #admin-orders-disputes-mobile .orders-recent-arrow {
                      grid-column: 3;
                      grid-row: 1 / span 2;
                      width: 28px;
                      height: 28px;
                    }
                    #admin-orders-disputes-mobile .orders-expanded-details {
                      padding: 12px 12px 15px;
                    }
                    #admin-orders-disputes-mobile .orders-expanded-heading h4 { font-size: 15px; }
                    #admin-orders-disputes-mobile .orders-expanded-heading > span {
                      font-size: 11px;
                    }
                    #admin-orders-disputes-mobile .orders-expanded-facts {
                      display: grid;
                      grid-template-columns: repeat(3, minmax(0, 1fr));
                      border-radius: 9px;
                      margin-top: 10px;
                    }
                    #admin-orders-disputes-mobile .orders-expanded-facts > div {
                      padding: 9px 8px;
                    }
                    #admin-orders-disputes-mobile .orders-expanded-facts > div dt {
                      font-size: 10px;
                      line-height: 1.2;
                    }
                    #admin-orders-disputes-mobile .orders-expanded-facts > div dd {
                      font-size: 12px;
                      line-height: 1.4;
                      overflow-wrap: anywhere;
                    }
                    /* Status is already on the selected order row: don't repeat it. */
                    #admin-orders-disputes-mobile .orders-expanded-facts > div:last-child { display: none; }
                    #admin-orders-disputes-mobile .orders-expanded-products {
                      margin-top: 12px;
                      padding-top: 12px;
                    }
                    #admin-orders-disputes-mobile .orders-expanded-products h5 { font-size: 13px; }
                    #admin-orders-disputes-mobile .orders-expanded-products > div { margin-top: 4px; }
                    #admin-orders-disputes-mobile .orders-expanded-products > div > div { gap: 9px; }
                    #admin-orders-disputes-mobile .orders-expanded-products p { font-size: 13px; line-height: 1.3; }
                    #admin-orders-disputes-mobile .orders-expanded-products [class*="shrink-0"] { font-size: 12px; }
                    #admin-orders-disputes-mobile .orders-readonly-note,
                    #admin-orders-disputes-mobile .orders-footer-note,
                    #admin-orders-disputes-mobile .orders-orders-help { display: none; }
                    #admin-orders-disputes-mobile .orders-more-button { padding: 13px; }
                    #admin-orders-disputes-mobile .orders-more-button button { min-height: 40px; }
                    #admin-orders-disputes-mobile .orders-selected-review { margin: 15px 12px 0; border-radius: 12px; }
                    #admin-orders-disputes-mobile .orders-selected-review textarea { width: 100%; }
                  }
                `}</style>
                <div id="admin-orders-disputes-mobile" className="min-w-0 bg-[#F7F6F2] text-[#202421]">
                    {/* A single editorial header replaces the old four-step dark dashboard. */}
                    <section className="orders-hero grid overflow-hidden border-b border-[#DCE1D7] lg:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="orders-hero-primary bg-[#EFE5DC] px-4 py-6 sm:px-8 sm:py-9">
                            <p className="orders-hero-kicker text-[13px] font-semibold text-[#965B42]">ORDER SUPPORT / REVIEW DESK</p>
                            <h2 className="orders-hero-title mt-2 max-w-3xl text-[27px] font-bold leading-[1.13] tracking-[-0.035em] text-[#173F35] sm:text-[36px]">
                                <span className="sm:hidden">Review orders. Resolve disputes.</span>
                                <span className="hidden sm:inline">Resolve order issues. Keep every decision clear.</span>
                            </h2>
                            <p className="orders-hero-support mt-3 max-w-xl text-[15px] leading-6 text-[#4F5B52]">
                                Review the order, open a dispute when needed, and record the outcome.
                            </p>
                            <div className="orders-hero-steps mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#DDCFC3] pt-3 text-[13px] font-semibold text-[#31574A] sm:text-[14px]">
                                <span>01 Select</span><span>02 Inspect</span><span>03 Decide</span>
                            </div>
                        </div>
                        <div className="orders-hero-dispute-summary flex items-center justify-between gap-3 bg-[#173F35] px-5 py-5 text-white lg:flex-col lg:items-start lg:justify-center lg:px-7">
                            <div>
                                <p className="text-[14px] font-medium text-[#D6E6DC]">Open dispute cases</p>
                                <p className="mt-1 text-[34px] font-bold leading-none tabular-nums sm:text-[42px]">{caseMetricUnavailable ? '—' : activeCaseCount}</p>
                            </div>
                            <p className="max-w-[150px] text-right text-[13px] leading-5 text-[#D9E7DF] lg:mt-3 lg:max-w-none lg:text-left">Decisions awaiting an admin</p>
                        </div>
                    </section>

                    <section aria-label="Order issue overview" className="orders-metrics grid grid-cols-2 divide-x divide-y divide-[#E1E5DD] border-b border-[#E1E5DD] bg-white lg:grid-cols-4 lg:divide-y-0">
                        {[
                            ['Open order issues', summary.total || 0],
                            ['Failed delivery', summary.deliveryFailed || 0],
                            ['Returns', summary.returnsRequested || 0],
                            ['Item changes', (summary.itemsUnavailable || 0) + (summary.substitutionsRequested || 0)],
                        ].map(([label, value]) => (
                            <div key={label} className="min-w-0 px-4 py-4 sm:px-7 sm:py-5">
                                <p className="text-[29px] font-bold leading-none tabular-nums text-[#173F35] sm:text-[34px]">{orderMetricUnavailable ? '—' : value}</p>
                                <p className="mt-2 text-[14px] font-medium leading-5 text-[#52645A]">{label}</p>
                            </div>
                        ))}
                    </section>

                    {ordersError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700 sm:px-7">Order issues: {ordersError}</div> : null}
                    {orderCasesError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700 sm:px-7">Dispute cases: {orderCasesError}</div> : null}
                    {error ? <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700 sm:px-7">{error}</div> : null}
                    {notice ? <div role="status" className="border-b border-[#C7DED0] bg-[#E8F2EB] px-4 py-3 text-[14px] font-medium text-[#173F35] sm:px-7">{notice}</div> : null}

                    <div className="orders-workqueue px-0 pb-5 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
                        <div className="orders-workqueue-heading mb-4 px-4 sm:px-0">
                            <p className="orders-workqueue-kicker text-[13px] font-semibold text-[#A25F43]">01 / WORK QUEUE</p>
                            <h2 className="orders-workqueue-title mt-1 text-[23px] font-bold tracking-tight text-[#173F35] sm:text-[28px]">
                                <span className="sm:hidden">Work queue</span><span className="hidden sm:inline">Choose what to review</span>
                            </h2>
                        </div>
                        <div className="orders-workqueue-grid grid gap-4 lg:grid-cols-2 lg:gap-5">
                            <section className="orders-queue-section min-w-0 border-y border-[#DAE0D6] bg-white sm:border sm:rounded-xl sm:overflow-hidden">
                                <div className="orders-queue-head flex items-center justify-between gap-3 bg-[#E8EFE7] px-4 py-4 sm:px-5">
                                    <div className="min-w-0">
                                        <h3 className="text-[19px] font-bold text-[#173F35]">Order issues</h3>
                                        <p className="orders-queue-subtitle mt-1 text-[13px] text-[#52645A]">Orders that need attention</p>
                                    </div>
                                    <span className="rounded-md bg-white px-3 py-1.5 text-[15px] font-bold tabular-nums text-[#173F35]">{orderMetricUnavailable ? '—' : (summary.total || 0)}</span>
                                </div>
                                {ordersLoading ? (
                                    <div role="status" className="flex items-center gap-2 px-4 py-5 text-[14px] text-[#53655B]"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Loading issues…</div>
                                ) : ordersError && !openOrders.length ? (
                                    <div className="px-4 py-5 text-[14px] text-[#53655B]">Issue list unavailable. Use Refresh to try again.</div>
                                ) : openOrders.length ? (
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {visibleOrderList.map(order => (
                                            <button key={order.id} type="button"
                                                onClick={() => { setSelectedOrderId(order.id); setSelectedReviewCase(null); setReason(''); setOrdersFocus('order'); }}
                                                className={`focus-ring flex w-full min-w-0 items-start justify-between gap-3 border-t border-[#E9ECE7] px-4 py-4 text-left transition-colors hover:bg-[#F3F7F2] sm:px-5 ${ordersFocus === 'order' && selectedOrderId === order.id ? 'bg-[#EDF4EE]' : ''}`}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block break-words text-[15px] font-semibold leading-5 text-[#173F35]">{order.itemNames?.[0] || order.sellerName || 'Order issue'}</span>
                                                    <span className="mt-1 block text-[13px] text-[#607068]">{order.sellerName || 'Host'} · {orderReference(order)}</span>
                                                    <span className="mt-2 inline-block text-[12px] font-semibold text-[#A45D40]">{orderIssueLabel(order.status)}</span>
                                                </span>
                                                <ChevronRight size={19} className="mt-1 shrink-0 text-[#386A55]" aria-hidden="true" />
                                            </button>
                                        ))}
                                        {Number(summary.total || 0) > openOrders.length ? (
                                            <p className="border-t border-[#E9ECE7] px-4 py-3 text-[13px] text-[#66746A]">Showing latest {openOrders.length} of {summary.total} issues.</p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="orders-empty-wrap px-4 py-5 sm:px-5">
                                        <div className="orders-empty flex items-center gap-3">
                                            <CheckCircle2 size={22} className="shrink-0 text-[#5C846E]" aria-hidden="true" />
                                            <div><p className="text-[15px] font-semibold text-[#173F35]">No order issues waiting</p><p className="orders-empty-subtitle mt-1 text-[14px] text-[#627267]">New issues will appear here.</p></div>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="orders-queue-section min-w-0 border-y border-[#E5DAD0] bg-white sm:overflow-hidden sm:rounded-xl sm:border">
                                <div className="orders-queue-head flex items-center justify-between gap-3 bg-[#F2E6DC] px-4 py-4 sm:px-5">
                                    <div className="min-w-0"><h3 className="text-[19px] font-bold text-[#173F35]">Dispute cases</h3><p className="orders-queue-subtitle mt-1 text-[13px] text-[#6D6258]">Decisions and follow-ups</p></div>
                                    <span className="rounded-md bg-white px-3 py-1.5 text-[15px] font-bold tabular-nums text-[#173F35]">{caseMetricUnavailable ? '—' : activeCaseCount}</span>
                                </div>
                                {ordersLoading && !orderReviewCases.length ? (
                                    <div role="status" className="flex items-center gap-2 px-4 py-5 text-[14px] text-[#53655B]"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Loading cases…</div>
                                ) : orderCasesError && !orderReviewCases.length ? (
                                    <p className="px-4 py-5 text-[14px] text-[#53655B]">Case list unavailable. Use Refresh to try again.</p>
                                ) : activeOrderDisputeCases.length ? (
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {visibleOrderDisputeCases.map(item => (
                                            <button key={item.id} type="button" onClick={() => { setSelectedReviewCase(item); setReason(''); setOrdersFocus('case'); }}
                                                className={`focus-ring flex w-full items-start justify-between gap-3 border-t border-[#ECE6E0] px-4 py-4 text-left transition-colors hover:bg-[#FCF5EF] sm:px-5 ${ordersFocus === 'case' && selectedReviewCase?.id === item.id ? 'bg-[#FBF1E8]' : ''}`}
                                            >
                                                <span className="min-w-0 flex-1"><span className="block break-words text-[15px] font-semibold leading-5 text-[#173F35]">{item.summary || 'Dispute case'}</span><span className="mt-1 block text-[13px] text-[#647169]">{titleize(item.status)} · {titleize(item.priority || 'p2')}</span></span>
                                                <ChevronRight size={19} className="mt-1 shrink-0 text-[#A26445]" aria-hidden="true" />
                                            </button>
                                        ))}
                                        {activeOrderDisputeCases.length > 6 ? (
                                            <div className="border-t border-[#ECE6E0] px-4 py-3 text-center"><button type="button" onClick={() => setShowAllOrderCases(value => !value)} className="focus-ring rounded-lg border border-[#D9D3C9] px-4 py-2 text-[14px] font-semibold text-[#173F35]">{showAllOrderCases ? 'Show fewer' : `View all ${activeOrderDisputeCases.length} loaded`}</button></div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="orders-empty flex items-center gap-3 px-4 py-5 sm:px-5"><CheckCircle2 size={22} className="shrink-0 text-[#B37D60]" aria-hidden="true" /><div><p className="text-[15px] font-semibold text-[#173F35]">No open disputes</p><p className="orders-empty-subtitle mt-1 text-[14px] text-[#627267]">No case needs a decision now.</p></div></div>
                                )}
                                {closedOrderDisputeCases.length ? (
                                    <details className="border-t border-[#ECE6E0] px-4 py-3 sm:px-5">
                                        <summary className="cursor-pointer text-[14px] font-semibold text-[#173F35]">Past decisions ({closedOrderDisputeCases.length})</summary>
                                        <div className="mt-3 divide-y divide-[#ECE6E0]">
                                            {closedOrderDisputeCases.map(item => (
                                                <button type="button" key={item.id} onClick={() => { setSelectedReviewCase(item); setReason(''); setOrdersFocus('case'); }} className="focus-ring flex w-full items-center justify-between gap-3 py-3 text-left text-[14px] text-[#375448] hover:text-[#173F35]">
                                                    <span className="min-w-0 break-words">{item.summary || 'Dispute'} · {titleize(item.status)}</span><ChevronRight size={17} className="shrink-0" aria-hidden="true" />
                                                </button>
                                            ))}
                                        </div>
                                    </details>
                                ) : null}
                                {orderReviewCases.length < orderCasesTotal ? (
                                    <div className="border-t border-[#ECE6E0] px-4 py-3 text-center">
                                        <button type="button" onClick={loadMoreOrderCases} disabled={orderCasesMoreBusy} className="focus-ring rounded-lg border border-[#D9D3C9] bg-white px-4 py-2 text-[14px] font-semibold text-[#173F35] disabled:opacity-50">
                                            {orderCasesMoreBusy ? 'Loading…' : 'Load more cases'}
                                        </button>
                                    </div>
                                ) : null}
                            </section>
                        </div>

                        {/* Recent seller orders are read-only, separate from actual issues and disputes. */}
                        <section aria-labelledby="recent-marketplace-orders-heading" className="orders-activity mt-5 min-w-0 overflow-hidden border-y border-[#E2E4DC] bg-white sm:rounded-2xl sm:border">
                            <div className="orders-activity-heading flex flex-wrap items-center justify-between gap-3 bg-[#EFE5DC] px-4 py-4 sm:px-6 sm:py-5">
                                <div className="min-w-0">
                                    <p className="orders-activity-kicker text-[12px] font-semibold uppercase tracking-[0.035em] text-[#9A644C]">ORDER ACTIVITY</p>
                                    <h3 id="recent-marketplace-orders-heading" className="mt-1 text-[21px] font-bold tracking-tight text-[#173F35] sm:text-[25px]">Recent marketplace orders</h3>
                                </div>
                                {ordersWorkspace.recentOrdersAvailable && !ordersError ? (
                                    <span className="orders-activity-count rounded-lg bg-white/80 px-3 py-2 text-[14px] font-semibold tabular-nums text-[#173F35]">{ordersWorkspace.recentOrdersTotal} orders</span>
                                ) : null}
                            </div>
                            {ordersLoading && !ordersWorkspace.recentOrdersAvailable ? (
                                <p role="status" className="px-4 py-5 text-[14px] text-[#53655B]">Loading order activity…</p>
                            ) : ordersError ? (
                                <p role="alert" className="px-4 py-5 text-[14px] text-[#53655B]">Recent orders could not be loaded. Use Refresh to retry.</p>
                            ) : !ordersWorkspace.recentOrdersAvailable ? (
                                <p className="px-4 py-5 text-[14px] text-[#53655B]">Recent orders need the updated backend API. Restart the backend to load them.</p>
                            ) : recentOrders.length ? (
                                <>
                                    <div className="divide-y divide-[#E8EAE3]">
                                        {visibleRecentOrders.map(order => {
                                            const firstItem = order.items?.[0];
                                            const itemCount = Number(order.itemCount || order.items?.length || 0);
                                            return (
                                                <details key={order.id} className="group min-w-0 bg-white open:bg-[#FBF9F6]">
                                                    <summary className="orders-recent-row focus-ring flex min-w-0 cursor-pointer list-none items-center gap-3 border-l-[3px] border-transparent px-3 py-3.5 transition-colors hover:bg-[#F7F7F2] group-open:border-[#B96C49] group-open:bg-[#F7F2EC] sm:gap-4 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
                                                        <MarketplaceOrderThumbnail imageUrl={firstItem?.imageUrl} name={firstItem?.name || order.itemNames?.[0]} />
                                                        <span className="orders-recent-identity min-w-0 flex-1">
                                                            <span className="block break-words text-[15px] font-bold leading-snug text-[#173F35] sm:text-[17px]">{order.itemNames?.[0] || order.sellerName || 'Seller order'}</span>
                                                            <span className="mt-1 block text-[13px] leading-5 text-[#6A756D]">{order.sellerName || 'Host'} <span aria-hidden="true">·</span> #{orderReference(order)}</span>
                                                            {itemCount > 1 ? <span className="mt-0.5 block text-[12px] font-medium text-[#587163]">+{itemCount - 1} more {itemCount === 2 ? 'item' : 'items'}</span> : null}
                                                        </span>
                                                        <span className="orders-recent-controls flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
                                                            <span className={`orders-recent-badge max-w-[105px] rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold leading-tight sm:max-w-none sm:px-3 sm:text-[13px] ${marketplaceOrderStatusClass(order.status)}`}>{titleize(order.status)}</span>
                                                            <span className="orders-recent-arrow flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF2EC] text-[#31574B] group-open:bg-[#E3E9DE]" aria-hidden="true"><ChevronRight size={18} className="transition-transform duration-200 group-open:rotate-90" /></span>
                                                        </span>
                                                    </summary>
                                                    <div className="orders-expanded-details border-t border-[#E8E5DE] px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
                                                        <div className="orders-expanded-heading flex flex-wrap items-center justify-between gap-2">
                                                            <h4 className="text-[16px] font-bold text-[#173F35] sm:text-[18px]">Order details</h4>
                                                            <span className="text-[12px] font-medium text-[#66756B]">Placed {financeDate(order.createdAt)}</span>
                                                        </div>
                                                        <dl className="orders-expanded-facts mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#E4E8E0] bg-[#E4E8E0] sm:grid-cols-4">
                                                            {[
                                                                ['Order total', formatOrderMoney(order.totalMinor, order.currency)],
                                                                ['Items', String(itemCount)],
                                                                ['Fulfillment', order.fulfillmentType ? titleize(order.fulfillmentType) : 'Not specified'],
                                                                ['Status', titleize(order.status)],
                                                            ].map(([label, value]) => (
                                                                <div key={label} className="min-w-0 bg-white px-3 py-3 sm:px-4">
                                                                    <dt className="text-[12px] font-medium text-[#6B776C]">{label}</dt>
                                                                    <dd className="mt-1 break-words text-[14px] font-semibold text-[#173F35]">{value}</dd>
                                                                </div>
                                                            ))}
                                                        </dl>
                                                        <div className="orders-expanded-products mt-4 border-t border-[#E8E8E1] pt-4">
                                                            <h5 className="text-[14px] font-bold text-[#173F35]">Products in this order</h5>
                                                            <div className="mt-2 divide-y divide-[#E7EAE3]">
                                                                {(order.items?.length ? order.items : (order.itemNames || []).map(name => ({ name }))).map((item, itemIndex) => (
                                                                    <div key={`${order.id}-line-${itemIndex}`} className="flex min-w-0 items-center gap-3 py-2.5">
                                                                        <MarketplaceOrderThumbnail imageUrl={item.imageUrl} name={item.name} small />
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="break-words text-[14px] font-semibold text-[#173F35]">{item.name || 'Product'}</p>
                                                                            {item.packCount > 0 ? <p className="mt-0.5 text-[12px] text-[#67776B]">{item.packCount} {item.packCount === 1 ? 'pack' : 'packs'}{item.packQuantity > 0 && item.packUnit ? ` · ${item.packQuantity} ${item.packUnit}` : ''}</p> : null}
                                                                        </div>
                                                                        {item.lineTotalMinor !== null && item.lineTotalMinor !== undefined ? <span className="shrink-0 text-[13px] font-semibold text-[#173F35]">{formatOrderMoney(item.lineTotalMinor, order.currency)}</span> : null}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <p className="orders-readonly-note mt-3 text-[12px] leading-5 text-[#728075]">Order details are read-only. Disputes and order issues are reviewed separately above.</p>
                                                    </div>
                                                </details>
                                            );
                                        })}
                                    </div>
                                    {recentOrders.length > 8 || ordersWorkspace.recentOrdersTotal > recentOrders.length ? (
                                        <div className="orders-more-button border-t border-[#E7E7E1] px-4 py-4 text-center sm:px-6">
                                            {recentOrders.length > 8 ? (
                                                <button type="button" onClick={() => setShowAllRecentOrders(current => !current)} className="focus-ring min-h-10 rounded-lg border border-[#BCCDBD] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#173F35] hover:bg-[#EDF2EB]">
                                                    {showAllRecentOrders ? 'Show fewer' : `View latest ${recentOrders.length} orders`}
                                                </button>
                                            ) : null}
                                            {ordersWorkspace.recentOrdersTotal > recentOrders.length ? <p className="mt-2 text-[12px] text-[#607068]">Showing the latest {recentOrders.length} of {ordersWorkspace.recentOrdersTotal} orders.</p> : null}
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <p className="px-4 py-5 text-[14px] text-[#53655B]">No marketplace orders yet. New orders will appear here after checkout.</p>
                            )}
                        </section>

                        {chosenOrder || chosenCase ? (
                            <section className="orders-selected-review mt-5 min-w-0 border-y border-[#DADFD6] bg-white sm:overflow-hidden sm:rounded-xl sm:border">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E7E0] bg-[#E9EEE8] px-4 py-4 sm:px-6">
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-[#A25F43]">02 / INSPECT & DECIDE</p>
                                        <h3 className="mt-1 break-words text-[21px] font-bold text-[#173F35] sm:text-[25px]">{chosenOrder ? 'Review this order' : 'Review this dispute'}</h3>
                                    </div>
                                    <button type="button" onClick={() => { setSelectedReviewCase(null); setSelectedOrderId(''); setReason(''); }} className="focus-ring rounded-lg border border-[#D4DCD2] bg-white px-3 py-2 text-[14px] font-semibold text-[#486257]">Close details</button>
                                </div>
                                {chosenOrder ? (
                                    <div className="px-4 py-5 sm:px-6 sm:py-6">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0"><p className="text-[13px] font-semibold text-[#A25F43]">{orderIssueLabel(chosenOrder.status)}</p><h4 className="mt-1 break-words text-[20px] font-bold text-[#173F35]">{chosenOrder.itemNames?.[0] || 'Order issue'}</h4><p className="mt-1 text-[14px] text-[#657368]">{chosenOrder.sellerName || 'Host'} · Order {orderReference(chosenOrder)}</p></div>
                                        </div>
                                        <dl className="mt-5 grid gap-0 border-y border-[#E7EAE5] sm:grid-cols-3 sm:divide-x sm:divide-[#E7EAE5]">
                                            {[
                                                ['Items', chosenOrder.itemNames?.length ? chosenOrder.itemNames.join(', ') : `${chosenOrder.itemCount || 0} items`],
                                                ['Order value', formatOrderMoney(chosenOrder.totalMinor, chosenOrder.currency)],
                                                ['Fulfillment', chosenOrder.fulfillmentType ? titleize(chosenOrder.fulfillmentType) : 'Not set'],
                                            ].map(([label, value]) => (
                                                <div key={label} className="min-w-0 border-b border-[#E7EAE5] py-3 last:border-b-0 sm:border-b-0 sm:px-4 sm:first:pl-0"><dt className="text-[13px] text-[#67756C]">{label}</dt><dd className="mt-1 break-words text-[15px] font-semibold text-[#173F35]">{value}</dd></div>
                                            ))}
                                        </dl>
                                        {selectedOrderCase ? (
                                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-[#F2E7DE] px-4 py-4">
                                                <p className="text-[14px] font-medium text-[#173F35]">A dispute is already open for this order.</p>
                                                <button type="button" onClick={() => { setSelectedReviewCase(selectedOrderCase); setReason(''); setOrdersFocus('case'); }} className="focus-ring rounded-lg bg-[#173F35] px-4 py-2.5 text-[14px] font-semibold text-white">Open dispute</button>
                                            </div>
                                        ) : canMutateDomain ? (
                                            <div className="mt-5 max-w-3xl">
                                                <label className="block text-[14px] font-semibold text-[#173F35]" htmlFor="admin-order-dispute-reason">Reason for dispute</label>
                                                <textarea id="admin-order-dispute-reason" value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={5000} placeholder="Explain what needs admin review." className="focus-ring mt-2 w-full rounded-lg border border-[#CED7CD] bg-white px-4 py-3 text-[15px] text-[#202421] outline-none" />
                                                <button type="button" onClick={createDisputeForSelectedOrder} disabled={busy || reason.trim().length < 5} className="focus-ring mt-3 min-h-11 rounded-lg bg-[#173F35] px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-50">Start dispute review</button>
                                            </div>
                                        ) : <p className="mt-4 text-[14px] text-[#657368]">You can inspect this order but cannot start a dispute.</p>}
                                    </div>
                                ) : (
                                    <div className="px-4 py-5 sm:px-6 sm:py-6">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0"><h4 className="break-words text-[20px] font-bold text-[#173F35]">{chosenCase.summary || 'Dispute case'}</h4><p className="mt-2 max-w-3xl break-words text-[14px] leading-6 text-[#627066]">{chosenCase.details || 'No further notes provided.'}</p></div>
                                            <span className="shrink-0 rounded-lg bg-[#F2E7DE] px-3 py-2 text-[13px] font-semibold text-[#81563F]">{titleize(chosenCase.status)}</span>
                                        </div>
                                        {canMutateDomain && !chosenCaseClosed ? (
                                            <div className="mt-5 max-w-3xl border-t border-[#E7EAE5] pt-5">
                                                <label className="block text-[14px] font-semibold text-[#173F35]" htmlFor="admin-order-case-reason">Reason for this decision</label>
                                                <textarea id="admin-order-case-reason" value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={4000} placeholder="Record why you are making this decision." className="focus-ring mt-2 w-full rounded-lg border border-[#CED7CD] bg-white px-4 py-3 text-[15px] text-[#202421] outline-none" />
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideSelectedOrderCase('resolve')} className="focus-ring min-h-11 rounded-lg bg-[#173F35] px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50">Resolve case</button>
                                                    <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideSelectedOrderCase('needs_action')} className="focus-ring min-h-11 rounded-lg border border-[#BBD0C0] bg-[#EDF4EE] px-4 py-2.5 text-[14px] font-semibold text-[#173F35] disabled:opacity-50">Needs follow-up</button>
                                                    <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideSelectedOrderCase('dismiss')} className="focus-ring min-h-11 rounded-lg border border-[#DAD6D1] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#564D47] disabled:opacity-50">Close without action</button>
                                                </div>
                                            </div>
                                        ) : <p className="mt-4 text-[14px] text-[#657368]">{chosenCaseClosed ? 'This case is closed. Its decision is preserved in history.' : 'You can inspect this case but cannot record a decision.'}</p>}
                                    </div>
                                )}
                            </section>
                        ) : null}
                        <p className="orders-footer-note px-4 pt-5 text-[13px] leading-5 text-[#6C786E] sm:px-0">Decisions are recorded separately. Original order and payment history stays unchanged.</p>
                    </div>
                </div>
            </AdminShell>
        );
    }


    if (section === 'finance') {
        const actionSettlements = financeSettlements.filter((item) =>
            ['pending_approval', 'approved'].includes(item?.status));
        const displayedSettlements = financeView === 'action' ? actionSettlements : financeSettlements;
        const selected = displayedSettlements.find((item) => item?.id === selectedFinanceSettlementId)
            || displayedSettlements[0] || null;
        const canFinanceMutate = hasAdminPermission('finance.mutate');
        const refreshFinancePage = () => loadFinanceWorkspace();
        const selectFinanceView = (nextView) => {
            setFinanceView(nextView);
            const nextRows = nextView === 'action' ? actionSettlements : financeSettlements;
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
                setFinanceError(getAdminGovernanceErrorMessage(requestError, 'Unable to update this payout.'));
            } finally {
                setBusy(false);
            }
        };
        const financePillTone = (status) => {
            if (status === 'approved' || status === 'paid') return 'bg-[#D7DDCF] text-[#173F35]';
            if (status === 'pending_approval') return 'bg-[#C56C42]/15 text-[#202421]';
            return 'bg-[#202421]/10 text-[#202421]';
        };
        const payoutStages = [
            { step: '01', title: 'Review', detail: 'Check the Host and order totals' },
            { step: '02', title: 'Decide', detail: 'Approve or return the request' },
            { step: '03', title: 'Record', detail: 'Save the completed transfer' },
        ];

        return (
            <AdminShell
                title="Finance & Payouts"
                description="Review Host payouts, approve requests and record completed transfers."
                actions={
                    <button
                        type="button"
                        onClick={refreshFinancePage}
                        disabled={financeLoading}
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3.5 py-2.5 text-[13px] font-semibold text-[#173F35] transition hover:bg-[#D7DDCF] disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={financeLoading ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                }
            >
                <div className="min-w-0 bg-[#F7F6F2] pb-7 text-[#202421] sm:pb-10">
                    {/* Financial summary: the numbers always come from the payout workspace. */}
                    <section aria-label="Payout overview" className="overflow-hidden border-b border-[#202421]/10">
                        <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
                            <div className="relative bg-[#C56C42] px-5 py-6 sm:px-8 sm:py-8">
                                <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.07em] text-[#202421]">
                                    <span className="h-px w-8 bg-[#202421]" /> Payout overview
                                </p>
                                <h2 className="mt-3 max-w-[630px] text-[28px] font-bold leading-[1.11] tracking-tight text-[#202421] sm:text-[36px]">
                                    Every Host payout, under control.
                                </h2>
                                <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-2 border-t border-[#202421]/25 pt-4">
                                    <div>
                                        <p className="text-[12px] font-semibold text-[#202421]/85">Waiting to be paid</p>
                                        <p className="mt-1 text-[30px] font-extrabold leading-none tracking-tight text-[#202421] sm:text-[38px] tabular-nums">
                                            {financeMoney(financeSummary.waitingAmountMinor || 0)}
                                        </p>
                                    </div>
                                    <p className="max-w-[210px] text-[13px] font-medium leading-5 text-[#202421]/85">
                                        Review the request before recording a completed transfer.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between bg-[#D7DDCF] px-5 py-5 sm:px-8 sm:py-7">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#173F35]">Current payout status</p>
                                    <WalletCards size={19} className="text-[#173F35]" aria-hidden="true" />
                                </div>
                                <div className="mt-6 grid grid-cols-3 divide-x divide-[#202421]/15">
                                    {[
                                        { label: 'To approve', value: financeSummary.pendingApproval || 0 },
                                        { label: 'Ready to pay', value: financeSummary.approved || 0 },
                                        { label: 'Paid', value: financeSummary.paid || 0 },
                                    ].map(({ label, value }, index) => (
                                        <div key={label} className={index === 0 ? 'pr-2' : 'px-3 sm:px-5'}>
                                            <p className="text-[30px] font-bold leading-none tabular-nums text-[#173F35] sm:text-[38px]">{value}</p>
                                            <p className="mt-2 text-[12px] font-semibold leading-4 text-[#202421]">{label}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-6 border-t border-[#202421]/15 pt-3 text-[13px] font-medium text-[#173F35]">
                                    <span className="font-bold">{financeMoney(financeSummary.paidAmountMinor || 0)}</span> recorded as paid
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* A quiet process guide, rather than a row of oversized cards. */}
                    <section aria-label="Payout steps" className="border-b border-[#D7DDCF] px-4 py-3 sm:px-7 sm:py-4">
                        <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
                            {payoutStages.map(({ step, title, detail }) => (
                                <div key={step} className="flex min-w-0 items-center gap-3">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#C56C42] text-[12px] font-bold text-[#202421]">{step}</span>
                                    <p className="min-w-0 text-[13px] leading-5 text-[#202421]">
                                        <span className="font-bold">{title}</span>
                                        <span className="hidden text-[#202421]/65 sm:inline"> — {detail}</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {financeError ? (
                        <div role="alert" className="mx-4 mt-4 border-l-4 border-[#C56C42] bg-[#C56C42]/15 px-4 py-3 text-[14px] font-semibold text-[#202421] sm:mx-7">
                            {financeError}
                        </div>
                    ) : null}
                    {notice ? (
                        <div role="status" className="mx-4 mt-4 border-l-4 border-[#173F35] bg-[#D7DDCF] px-4 py-3 text-[14px] font-semibold text-[#173F35] sm:mx-7">
                            {notice}
                        </div>
                    ) : null}

                    <section aria-labelledby="finance-payouts-heading" className="px-4 pt-6 sm:px-7 sm:pt-8">
                        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#202421]/15 pb-4">
                            <div>
                                <p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#173F35]">01 / Payout activity</p>
                                <h2 id="finance-payouts-heading" className="mt-1 text-[27px] font-bold tracking-tight text-[#202421] sm:text-[32px]">Payout requests</h2>
                                <p className="mt-1 text-[14px] text-[#202421]/70">Select a request to see its amount, status and available actions.</p>
                            </div>
                            <div role="group" aria-label="Filter payouts" className="inline-flex w-full gap-1 rounded-lg border border-[#D7DDCF] bg-[#D7DDCF]/45 p-1 sm:w-auto">
                                <button
                                    type="button"
                                    aria-pressed={financeView === 'action'}
                                    onClick={() => selectFinanceView('action')}
                                    className={`focus-ring flex-1 rounded-md px-3 py-2.5 text-[13px] font-bold transition sm:flex-none ${financeView === 'action' ? 'bg-[#173F35] text-[#F7F6F2]' : 'text-[#173F35] hover:bg-[#D7DDCF]'}`}
                                >
                                    Needs action <span className="ml-1 opacity-80">{actionSettlements.length}</span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={financeView === 'all'}
                                    onClick={() => selectFinanceView('all')}
                                    className={`focus-ring flex-1 rounded-md px-3 py-2.5 text-[13px] font-bold transition sm:flex-none ${financeView === 'all' ? 'bg-[#173F35] text-[#F7F6F2]' : 'text-[#173F35] hover:bg-[#D7DDCF]'}`}
                                >
                                    All payouts <span className="ml-1 opacity-80">{financeSettlements.length}</span>
                                </button>
                            </div>
                        </div>

                        {financeLoading ? (
                            <div role="status" className="flex items-center gap-3 border-b border-[#D7DDCF] py-8 text-[14px] font-medium text-[#173F35]">
                                <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Loading Host payouts…
                            </div>
                        ) : displayedSettlements.length === 0 ? (
                            <div className="mt-5 grid overflow-hidden rounded-xl border border-[#D7DDCF] lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.56fr)]">
                                <div className="bg-[#F7F6F2] px-5 py-7 sm:px-8 sm:py-10">
                                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-[#D7DDCF] text-[#173F35]">
                                        <CheckCircle2 size={25} aria-hidden="true" />
                                    </div>
                                    <h3 className="max-w-xl text-[22px] font-bold tracking-tight text-[#202421] sm:text-[27px]">
                                        {financeView === 'action' ? 'No payouts waiting for action' : 'No payout records yet'}
                                    </h3>
                                    <p className="mt-2 max-w-xl text-[14px] leading-6 text-[#202421]/70">
                                        {financeView === 'action'
                                            ? 'When a Host payout is ready for review, it will appear here.'
                                            : 'Once payout batches are prepared, you can review their history here.'}
                                    </p>
                                    <Link
                                        to="/admin/host-operations?tab=finance"
                                        className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#173F35] px-5 text-[14px] font-bold text-[#F7F6F2] transition hover:bg-[#202421]"
                                    >
                                        Prepare payout batch <ArrowUpRight size={16} aria-hidden="true" />
                                    </Link>
                                </div>
                                <div className="flex flex-col justify-center border-t border-[#D7DDCF] bg-[#D7DDCF]/55 px-5 py-6 sm:px-8 lg:border-l lg:border-t-0">
                                    <p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#173F35]">What happens next</p>
                                    <p className="mt-2 text-[19px] font-bold leading-6 text-[#173F35]">Review first. Record payment after transfer.</p>
                                    <p className="mt-2 text-[14px] leading-6 text-[#202421]/70">Approving a request and recording a transfer are separate steps.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 grid overflow-hidden rounded-xl border border-[#D7DDCF] bg-[#F7F6F2] lg:grid-cols-[minmax(250px,0.37fr)_minmax(0,1fr)]">
                                <aside aria-label="Host payout list" className="min-w-0 border-b border-[#D7DDCF] lg:border-b-0 lg:border-r">
                                    <div className="border-b border-[#D7DDCF] bg-[#D7DDCF]/55 px-4 py-3 sm:px-5">
                                        <p className="text-[13px] font-bold text-[#173F35]">Choose a payout</p>
                                        <p className="text-[12px] text-[#202421]/65">{displayedSettlements.length} records</p>
                                    </div>
                                    <div className="px-4 py-3 lg:hidden">
                                        <label htmlFor="finance-mobile-payout" className="text-[13px] font-semibold text-[#202421]">Host payout</label>
                                        <select
                                            id="finance-mobile-payout"
                                            value={selected?.id || ''}
                                            onChange={(event) => setSelectedFinanceSettlementId(event.target.value)}
                                            className="focus-ring mt-1 block h-12 w-full min-w-0 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 text-[14px] font-semibold text-[#173F35]"
                                        >
                                            {displayedSettlements.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.organization?.displayName || 'Host business'} — {financeMoney(item?.totals?.netPayableMinor || 0, item.currency)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="hidden max-h-[540px] overflow-y-auto overscroll-y-contain lg:block">
                                        {displayedSettlements.map((item) => {
                                            const active = selected?.id === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    aria-pressed={active}
                                                    onClick={() => setSelectedFinanceSettlementId(item.id)}
                                                    className={`focus-ring w-full border-b border-[#D7DDCF] px-4 py-4 text-left transition sm:px-5 ${active ? 'bg-[#173F35] text-[#F7F6F2]' : 'bg-[#F7F6F2] text-[#202421] hover:bg-[#D7DDCF]/55'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="min-w-0 break-words text-[14px] font-bold">{item.organization?.displayName || 'Host business'}</p>
                                                        <ChevronRight size={17} className="shrink-0" aria-hidden="true" />
                                                    </div>
                                                    <p className={`mt-1 text-[12px] ${active ? 'text-[#F7F6F2]/80' : 'text-[#202421]/65'}`}>{financePeriod(item)}</p>
                                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                                        <span className={`text-[12px] font-medium ${active ? 'text-[#F7F6F2]/85' : 'text-[#202421]/70'}`}>{financeStatusLabel(item.status)}</span>
                                                        <span className="text-[14px] font-bold tabular-nums">{financeMoney(item?.totals?.netPayableMinor || 0, item.currency)}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </aside>

                                {selected ? (
                                    <article className="min-w-0 bg-[#F7F6F2]">
                                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D7DDCF] px-4 py-5 sm:px-7">
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#173F35]">02 / Payout details</p>
                                                <h3 className="mt-1 break-words text-[23px] font-bold leading-tight tracking-tight text-[#202421] sm:text-[27px]">
                                                    {selected.organization?.displayName || 'Host business'}
                                                </h3>
                                                <p className="mt-1 text-[13px] text-[#202421]/65">{financePeriod(selected)}</p>
                                            </div>
                                            <span className={`inline-flex rounded-full px-3 py-1.5 text-[12px] font-bold ${financePillTone(selected.status)}`}>
                                                {financeStatusLabel(selected.status)}
                                            </span>
                                        </div>

                                        <div className="grid gap-0 border-b border-[#D7DDCF] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                            <div className="bg-[#173F35] px-4 py-5 text-[#F7F6F2] sm:px-7">
                                                <p className="text-[13px] font-semibold text-[#F7F6F2]/80">Host receives</p>
                                                <p className="mt-2 text-[30px] font-bold leading-none tracking-tight tabular-nums sm:text-[35px]">
                                                    {financeMoney(selected?.totals?.netPayableMinor || 0, selected.currency)}
                                                </p>
                                                <p className="mt-2 text-[12px] text-[#F7F6F2]/80">{selected.lineCount || 0} delivered orders</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-[#D7DDCF]/55 px-4 py-4 sm:px-6">
                                                {[
                                                    ['Order value', financeMoney(selected?.totals?.grossMerchandiseMinor || 0, selected.currency)],
                                                    ['Platform fee', financeMoney(selected?.totals?.platformFeeMinor || 0, selected.currency)],
                                                    ['Tax held', financeMoney(selected?.totals?.taxWithheldMinor || 0, selected.currency)],
                                                    ['Created', financeDate(selected.createdAt)],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="min-w-0">
                                                        <p className="text-[12px] font-medium text-[#202421]/70">{label}</p>
                                                        <p className="mt-1 break-words text-[14px] font-bold text-[#202421]">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {selected.payoutReference ? (
                                            <div className="border-b border-[#D7DDCF] px-4 py-3 sm:px-7">
                                                <p className="text-[12px] font-semibold text-[#202421]/70">Payment reference</p>
                                                <p className="mt-1 break-all text-[14px] font-bold text-[#173F35]">{selected.payoutReference}</p>
                                            </div>
                                        ) : null}

                                        {selected.status === 'pending_approval' ? (
                                            <section aria-label="Payout approval" className="px-4 py-5 sm:px-7">
                                                <p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#173F35]">03 / Decision</p>
                                                <h4 className="mt-1 text-[19px] font-bold text-[#202421]">Approve or return</h4>
                                                {canFinanceMutate ? (
                                                    <>
                                                        <label htmlFor="finance-decision-note" className="mt-3 block text-[13px] font-semibold text-[#202421]">Decision note</label>
                                                        <textarea
                                                            id="finance-decision-note"
                                                            value={financeReason}
                                                            onChange={(event) => setFinanceReason(event.target.value)}
                                                            rows={2}
                                                            placeholder="Why is this payout approved or returned?"
                                                            className="focus-ring mt-1 w-full rounded-lg border border-[#D7DDCF] bg-white px-3 py-3 text-[14px] text-[#202421] outline-none focus:border-[#173F35]"
                                                        />
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                disabled={busy || financeReason.trim().length < 3}
                                                                onClick={() => runFinanceAction(
                                                                    () => decideAdminSettlement(selected.id, { decision: 'approve', reason: financeReason.trim() }),
                                                                    'Payout approved.',
                                                                )}
                                                                className="focus-ring min-h-11 rounded-lg bg-[#173F35] px-5 text-[14px] font-bold text-[#F7F6F2] disabled:opacity-50"
                                                            >Approve payout</button>
                                                            <button
                                                                type="button"
                                                                disabled={busy || financeReason.trim().length < 3}
                                                                onClick={() => runFinanceAction(
                                                                    () => decideAdminSettlement(selected.id, { decision: 'reject', reason: financeReason.trim() }),
                                                                    'Payout returned for changes.',
                                                                )}
                                                                className="focus-ring min-h-11 rounded-lg border border-[#C56C42] bg-[#F7F6F2] px-5 text-[14px] font-bold text-[#202421] disabled:opacity-50"
                                                            >Return for changes</button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="mt-3 text-[14px] text-[#202421]/70">You can review this payout but cannot change its approval.</p>
                                                )}
                                            </section>
                                        ) : null}

                                        {selected.status === 'approved' ? (
                                            <section aria-label="Record Host payment" className="px-4 py-5 sm:px-7">
                                                <p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#173F35]">03 / Complete payout</p>
                                                <h4 className="mt-1 text-[19px] font-bold text-[#202421]">Record the completed transfer</h4>
                                                {canFinanceMutate ? (
                                                    <>
                                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                            <label className="block text-[13px] font-semibold text-[#202421]">
                                                                Transfer reference
                                                                <input
                                                                    value={financePayoutReference}
                                                                    onChange={(event) => setFinancePayoutReference(event.target.value)}
                                                                    placeholder="Payment reference"
                                                                    className="focus-ring mt-1 block h-11 w-full min-w-0 rounded-lg border border-[#D7DDCF] bg-white px-3 text-[14px] text-[#202421]"
                                                                />
                                                            </label>
                                                            <label className="block text-[13px] font-semibold text-[#202421]">
                                                                Payment note
                                                                <input
                                                                    value={financeReason}
                                                                    onChange={(event) => setFinanceReason(event.target.value)}
                                                                    placeholder="Short payment note"
                                                                    className="focus-ring mt-1 block h-11 w-full min-w-0 rounded-lg border border-[#D7DDCF] bg-white px-3 text-[14px] text-[#202421]"
                                                                />
                                                            </label>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={busy || financePayoutReference.trim().length < 3 || financeReason.trim().length < 3}
                                                            onClick={() => runFinanceAction(
                                                                () => markAdminSettlementPaid(selected.id, { payoutReference: financePayoutReference.trim(), reason: financeReason.trim() }),
                                                                'Payment recorded.',
                                                            )}
                                                            className="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#173F35] px-5 text-[14px] font-bold text-[#F7F6F2] disabled:opacity-50"
                                                        >
                                                            <Banknote size={17} aria-hidden="true" /> Mark as paid
                                                        </button>
                                                    </>
                                                ) : (
                                                    <p className="mt-3 text-[14px] text-[#202421]/70">You can review this payout but cannot record its transfer.</p>
                                                )}
                                            </section>
                                        ) : null}

                                        {selected.status === 'paid' ? (
                                            <div className="flex items-start gap-3 bg-[#D7DDCF]/55 px-4 py-5 sm:px-7">
                                                <CheckCircle2 size={21} className="shrink-0 text-[#173F35]" aria-hidden="true" />
                                                <div>
                                                    <p className="text-[15px] font-bold text-[#173F35]">Payment recorded</p>
                                                    <p className="mt-1 text-[13px] text-[#202421]/70">Paid on {financeDate(selected.paidAt)}</p>
                                                </div>
                                            </div>
                                        ) : null}
                                        {selected.status === 'rejected' ? (
                                            <div className="bg-[#C56C42]/12 px-4 py-5 sm:px-7">
                                                <p className="text-[15px] font-bold text-[#202421]">Returned for changes</p>
                                                <p className="mt-1 text-[13px] text-[#202421]/70">{selected.reason || 'This payout must be prepared again.'}</p>
                                            </div>
                                        ) : null}
                                    </article>
                                ) : null}
                            </div>
                        )}
                    </section>
                </div>
            </AdminShell>
        );
    }

    if (section === 'integrations') {
        const summary = integrationWorkspace.summary || {};
        const hosts = integrationWorkspace.hosts || [];
        const webhooks = integrationWorkspace.webhooks || [];
        const serviceAccounts = integrationWorkspace.serviceAccounts || [];
        const refreshing = integrationLoading || integrationReviewsLoading;
        const totalHosts = Number(summary.organizations || hosts.length);
        const totalConnections = Number(summary.connections ?? (webhooks.length + serviceAccounts.length));
        const configuredHostCount = hosts.filter(host =>
            webhooks.some(item => item.organizationId === host.id) ||
            serviceAccounts.some(item => item.organizationId === host.id)).length;
        const filteredHosts = hosts.filter(host => {
            const hooks = webhooks.filter(item => item.organizationId === host.id);
            const accounts = serviceAccounts.filter(item => item.organizationId === host.id);
            const configured = hooks.length + accounts.length > 0;
            const failed = hooks.some(item => item.status !== 'disabled' && item.lastDeliveryStatus === 'failed');
            const matchesFilter = integrationHealthFilter === 'all' ||
                (integrationHealthFilter === 'connected' && configured) ||
                (integrationHealthFilter === 'setup' && !configured) ||
                (integrationHealthFilter === 'failed' && failed);
            const query = integrationSearch.trim().toLowerCase();
            return matchesFilter && (!query || [host.name, host.organizationType,
                ...hooks.map(item => item.name), ...accounts.map(item => item.name)]
                .some(value => String(value || '').toLowerCase().includes(query)));
        });
        const shownHosts = filteredHosts;
        const selectedHost = filteredHosts.find(item => item.id === selectedIntegrationHostId) || filteredHosts[0] || null;
        const hostWebhooks = selectedHost ? webhooks.filter(item => item.organizationId === selectedHost.id) : [];
        const hostAccounts = selectedHost ? serviceAccounts.filter(item => item.organizationId === selectedHost.id) : [];
        const chosenConnection = hostWebhooks.find(item => item.id === selectedIntegrationId) || hostWebhooks[0] || null;
        const selectedHostHasFailure = hostWebhooks.some(item => item.status !== 'disabled' && item.lastDeliveryStatus === 'failed');
        const selectedHostConfigured = hostWebhooks.length + hostAccounts.length > 0;
        const activeConnectionCases = integrationReviewCases.filter(item =>
            !['resolved', 'dismissed'].includes(String(item.status || '').toLowerCase()));
        const pastConnectionCases = integrationReviewCases.filter(item =>
            ['resolved', 'dismissed'].includes(String(item.status || '').toLowerCase()));
        const shownConnectionCases = showAllIntegrationCases ? activeConnectionCases : activeConnectionCases.slice(0, 5);
        const selectedConnectionCase = chosenConnection
            ? activeConnectionCases.find(item => item?.entity?.id === chosenConnection.id && item?.entity?.type === 'organization_webhook') || null
            : null;
        const selectedCase = selectedReviewCase?.caseType === 'integration_failure' ? selectedReviewCase : selectedConnectionCase;
        const moreReviewsAvailable = integrationReviewRows.length < integrationReviewTotal;
        const refreshIntegrationPage = () => loadIntegrationWorkspace();

        const createIntegrationReview = async () => {
            if (!chosenConnection || reason.trim().length < 5) return;
            const result = await run(() => createAdminReviewCase({
                domain: 'marketplace', caseType: 'integration_failure',
                entity: { type: 'organization_webhook', id: chosenConnection.id,
                    label: `${chosenConnection.organizationName} — ${chosenConnection.name}` },
                severity: 'medium', priority: 'p2',
                summary: `Connection issue — ${chosenConnection.organizationName}`,
                details: reason.trim(), evidence: [],
            }), 'Connection review started.');
            if (result?.reviewCase) {
                setSelectedReviewCase(result.reviewCase);
                setReason('');
                await loadIntegrationWorkspace();
            }
        };
        const decideIntegrationCase = async decision => {
            const caseToDecide = selectedReviewCase?.caseType === 'integration_failure' ? selectedReviewCase : selectedConnectionCase;
            if (!caseToDecide || reason.trim().length < 5) return;
            const result = await run(() => decideAdminReviewCase(caseToDecide.id, {
                decision, reason: reason.trim(), evidence: evidence(),
            }), decision === 'resolve' ? 'Connection review resolved.'
                : decision === 'dismiss' ? 'Connection review closed.' : 'Connection review marked for follow-up.');
            if (result) {
                setSelectedReviewCase(null);
                setReason('');
                await loadIntegrationWorkspace();
            }
        };

        return (
            <AdminShell
                title={<><span className="sm:hidden">Host setup</span><span className="hidden sm:inline">Host Setup & Updates</span></>}
                description={<span className="hidden sm:inline">See which Hosts are ready, check update activity and handle connection problems.</span>}
                actions={
                    <button type="button" onClick={refreshIntegrationPage} disabled={refreshing}
                        className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7DDCF] bg-[#F7F6F2] px-4 py-2 text-[14px] font-semibold text-[#173F35] disabled:opacity-50 hover:bg-[#D7DDCF]">
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
                    </button>
                }
            >
                <div className="-mx-2 min-w-0 space-y-3 bg-[#F7F6F2] pb-5 text-[#202421] sm:mx-0 sm:space-y-7 sm:pb-10">
                    <section className="grid min-w-0 overflow-hidden rounded-[14px] border border-[#D7DDCF] sm:rounded-[20px] lg:grid-cols-[minmax(0,1.28fr)_minmax(360px,0.82fr)]" aria-labelledby="integrations-intro-title">
                        <div className="relative border-l-[4px] border-[#C56C42] bg-[#C56C42]/30 px-3 py-3 text-[#202421] sm:border-l-[7px] sm:px-8 sm:py-8">
                            <span className="mb-2 block h-[3px] w-8 rounded-full bg-[#C56C42] sm:mb-4 sm:w-12" aria-hidden="true" />
                            <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#173F35] sm:text-[13px]">Business connections</p>
                            <h2 id="integrations-intro-title" className="mt-1 max-w-2xl text-[20px] font-bold leading-[1.2] tracking-[-0.03em] sm:mt-2 sm:text-[32px] sm:leading-[1.17] sm:tracking-[-0.035em]"><span className="sm:hidden">Host connection status</span><span className="hidden sm:inline">Know who's connected. See what needs attention.</span></h2>
                            <p className="mt-3 hidden max-w-2xl text-[15px] leading-[1.55] text-[#202421] sm:block">Choose a Host to review its setup, latest updates and any issues that need your decision.</p>
                        </div>
                        <div className="flex flex-col justify-center bg-[#D7DDCF] px-2 py-3 sm:px-6 sm:py-6" aria-label="Connection summary">
                            <div className="grid grid-cols-3 divide-x divide-[#173F35]/20">
                                <div className="min-w-0 px-1 text-center sm:px-4">
                                    <p className="text-[24px] font-bold leading-tight text-[#202421] sm:text-[37px]">{integrationLoading || integrationError ? '—' : totalHosts}</p>
                                    <p className="mt-0.5 text-[12px] font-semibold text-[#173F35] sm:mt-1 sm:text-[14px]">Hosts</p>
                                </div>
                                <div className="min-w-0 px-1 text-center sm:px-4">
                                    <p className="text-[24px] font-bold leading-tight text-[#173F35] sm:text-[37px]">{integrationLoading || integrationError ? '—' : totalConnections}</p>
                                    <p className="mt-0.5 text-[12px] font-semibold text-[#173F35] sm:mt-1 sm:text-[14px]"><span className="sm:hidden">Links</span><span className="hidden sm:inline">Connections</span></p>
                                </div>
                                <div className="min-w-0 px-1 text-center sm:px-4">
                                    <p className="text-[24px] font-bold leading-tight text-[#202421] sm:text-[37px]">{integrationLoading || integrationError ? '—' : Number(summary.failed || 0)}</p>
                                    <p className="mt-0.5 text-[12px] font-semibold text-[#173F35] sm:mt-1 sm:text-[14px]"><span className="sm:hidden">Failed</span><span className="hidden sm:inline">Failed updates</span></p>
                                </div>
                            </div>
                            <div className="mt-5 hidden items-center gap-2 border-t border-[#173F35]/20 pt-3 text-[13px] font-semibold text-[#173F35] sm:flex">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#C56C42]" aria-hidden="true" />
                                Select a business below to inspect its status
                            </div>
                        </div>
                    </section>

                    {integrationError && (
                        <div role="alert" className="rounded-xl border border-[#C56C42] bg-[#F7F6F2] px-4 py-3 text-[14px] text-[#173F35]">
                            <strong>Host information couldn't be loaded.</strong> {integrationError}
                            <button type="button" onClick={refreshIntegrationPage} className="focus-ring ml-2 font-bold underline">Try again</button>
                        </div>
                    )}
                    {error && <p role="alert" className="rounded-xl bg-[#F7F6F2] px-4 py-3 text-[14px] text-[#173F35]">{error}</p>}
                    {notice && <p role="status" className="rounded-xl bg-[#D7DDCF] px-4 py-3 text-[14px] text-[#173F35]">{notice}</p>}

                    <div className="grid min-w-0 items-start gap-3 sm:gap-5 lg:grid-cols-[minmax(280px,0.31fr)_minmax(0,1fr)] lg:gap-6">
                        <aside className="min-w-0 overflow-hidden rounded-[14px] border border-[#D7DDCF] bg-[#F7F6F2] shadow-[0_10px_30px_-26px_#202421] sm:rounded-[18px]" aria-labelledby="integrations-hosts-heading">
                            <div className="border-t-[4px] border-[#C56C42] bg-[#F7F6F2] px-3 py-3 text-[#202421] sm:px-5 sm:py-5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#C56C42] sm:text-[13px]">01 / Select a business</p>
                                <h3 id="integrations-hosts-heading" className="mt-1 text-[19px] font-bold tracking-[-0.03em] sm:text-[23px]">Choose a Host</h3>
                                <p className="mt-1 hidden text-[14px] text-[#173F35] sm:block">Find and select the business to review.</p>
                            </div>
                            <div className="space-y-2 px-3 py-3 sm:space-y-3 sm:px-4 sm:py-4">
                                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3">
                                    <SearchCheck size={18} className="shrink-0 text-[#173F35]" aria-hidden="true" />
                                    <span className="sr-only">Search Hosts</span>
                                    <input type="search" value={integrationSearch} onChange={event => { setIntegrationSearch(event.target.value); }}
                                        placeholder="Search business names" className="min-w-0 w-full bg-transparent py-2.5 text-[14px] text-[#202421] outline-none placeholder:text-[#173F35]/70" />
                                </label>
                                <div className="sm:hidden">
                                    <label htmlFor="integration-mobile-status" className="sr-only">Filter Hosts by setup status</label>
                                    <select id="integration-mobile-status" value={integrationHealthFilter}
                                        onChange={event => setIntegrationHealthFilter(event.target.value)}
                                        className="focus-ring w-full rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 py-2.5 text-[13px] font-semibold text-[#173F35]">
                                        <option value="all">All businesses</option>
                                        <option value="connected">Set up</option>
                                        <option value="setup">Not set up</option>
                                        <option value="failed">Needs help</option>
                                    </select>
                                </div>
                                <div className="hidden max-w-full gap-2 overflow-x-auto pb-1 sm:flex" aria-label="Filter Hosts by setup status">
                                    {[
                                        ['all', 'All'], ['connected', 'Set up'], ['setup', 'Not set up'], ['failed', 'Needs help'],
                                    ].map(([value, label]) => (
                                        <button key={value} type="button" aria-pressed={integrationHealthFilter === value}
                                            onClick={() => { setIntegrationHealthFilter(value); }}
                                            className={`focus-ring min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold ${integrationHealthFilter === value
                                                ? 'bg-[#173F35] text-[#F7F6F2]' : 'border border-[#D7DDCF] bg-[#F7F6F2] text-[#173F35] hover:bg-[#D7DDCF]'}`}>{label}</button>
                                    ))}
                                </div>
                                <p className="text-[12px] text-[#173F35] sm:text-[13px]" aria-live="polite">
                                    {integrationLoading ? 'Loading businesses…' : <><span className="sm:hidden">{filteredHosts.length} Hosts · {configuredHostCount} set up</span><span className="hidden sm:inline">{`${filteredHosts.length} ${filteredHosts.length === 1 ? 'business' : 'businesses'} found · ${configuredHostCount} with setup`}</span></>}
                                </p>
                            </div>
                            {integrationLoading ? (
                                <p role="status" className="flex items-center gap-2 px-4 pb-5 text-[14px]"><LoaderCircle size={17} className="animate-spin" /> Loading Hosts…</p>
                            ) : !integrationError && (
                                <div className="border-t border-[#D7DDCF] px-2 py-2 sm:px-3">
                                    <div
                                        className={`space-y-1 ${filteredHosts.length > 8 ? 'max-h-[542px] overflow-y-auto overscroll-y-auto pr-1 sm:max-h-[814px]' : ''}`}
                                        role="group"
                                        key={`${integrationHealthFilter}:${integrationSearch}`}
                                        aria-label={filteredHosts.length > 8 ? 'Choose a Host; scroll for more businesses' : 'Choose a Host'}
                                        tabIndex={filteredHosts.length > 8 ? 0 : undefined}
                                    >
                                        {shownHosts.map(host => {
                                            const active = selectedHost?.id === host.id;
                                            const configured = webhooks.some(item => item.organizationId === host.id) || serviceAccounts.some(item => item.organizationId === host.id);
                                            const failed = webhooks.some(item => item.organizationId === host.id && item.status !== 'disabled' && item.lastDeliveryStatus === 'failed');
                                            return (
                                                <button key={host.id} type="button" aria-pressed={active} title={host.name}
                                                    onClick={() => { setSelectedIntegrationHostId(host.id); setSelectedIntegrationId(''); setSelectedReviewCase(null); setReason(''); setIntegrationDetailTab('overview'); }}
                                                    className={`focus-ring flex w-full min-w-0 items-center gap-2 rounded-xl border-l-[3px] px-2 text-left transition-colors sm:gap-3 sm:px-3 ${filteredHosts.length > 8 ? 'h-[60px] py-1.5 sm:h-[92px] sm:py-2' : 'min-h-[58px] py-2 sm:min-h-[70px] sm:py-3'} ${active
                                                        ? 'border-[#C56C42] bg-[#173F35] text-[#F7F6F2]' : 'border-transparent text-[#202421] hover:bg-[#D7DDCF]/60'}`}>
                                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold sm:h-10 sm:w-10 sm:text-[17px] ${active ? 'bg-[#F7F6F2] text-[#173F35]' : 'bg-[#D7DDCF] text-[#173F35]'}`} aria-hidden="true">
                                                        {String(host.name || 'H').trim().charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className={`block break-words text-[14px] font-bold leading-snug sm:text-[15px] ${filteredHosts.length > 8 ? 'line-clamp-2 sm:line-clamp-3' : ''}`}>{host.name}</span>
                                                        <span className={`mt-0.5 block text-[12px] font-semibold sm:mt-1 ${active ? 'text-[#F7F6F2]' : 'text-[#173F35]'}`}>
                                                            {failed ? 'Needs attention' : configured ? 'Setup found' : 'Not set up'}
                                                        </span>
                                                    </span>
                                                    {active && <ChevronRight size={18} className="shrink-0 text-[#F7F6F2]" aria-hidden="true" />}
                                                </button>
                                            );
                                        })}
                                        {!hosts.length && <p className="px-3 py-5 text-[14px] text-[#173F35]">No Host businesses are available yet.</p>}
                                        {hosts.length > 0 && !shownHosts.length && <p className="px-3 py-5 text-[14px] text-[#173F35]">No businesses match this search or filter.</p>}
                                    </div>
                                    {totalHosts > hosts.length && <p className="px-3 py-3 text-[12px] text-[#173F35]">Showing {hosts.length} of {totalHosts} registered Hosts.</p>}
                                </div>
                            )}
                        </aside>

                        <div className="min-w-0 space-y-3 sm:space-y-5">
                            <section className="min-w-0 overflow-hidden rounded-[14px] border border-[#D7DDCF] bg-[#F7F6F2] shadow-[0_10px_30px_-26px_#202421] sm:rounded-[18px]" aria-labelledby="selected-host-workspace">
                                {selectedHost ? (
                                    <>
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-l-[4px] border-[#C56C42] bg-[#202421] px-3 py-3 text-[#F7F6F2] sm:gap-4 sm:border-l-[5px] sm:px-6 sm:py-7">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#D7DDCF] sm:text-[13px]">02 / Selected business</p>
                                                <h3 id="selected-host-workspace" className="mt-1 break-words text-[19px] font-bold tracking-[-0.035em] text-[#F7F6F2] sm:text-[31px]">{selectedHost.name}</h3>
                                                <p className="mt-0.5 text-[12px] text-[#D7DDCF] sm:mt-1 sm:text-[14px]">{titleize(selectedHost.organizationType)} · {titleize(selectedHost.status)}</p>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold sm:px-3 sm:py-2 sm:text-[13px] ${selectedHostHasFailure
                                                ? 'border border-[#C56C42] bg-[#F7F6F2] text-[#202421]' : selectedHostConfigured
                                                    ? 'bg-[#D7DDCF] text-[#173F35]' : 'bg-[#D7DDCF] text-[#173F35]'}`}>
                                                {selectedHostHasFailure ? 'Needs attention' : selectedHostConfigured ? 'Has connection setup' : 'Setup not started'}
                                            </span>
                                        </div>
                                        <div className="grid min-w-0 grid-cols-3 gap-0.5 border-y border-[#D7DDCF] bg-[#D7DDCF]/35 px-1 pt-1 sm:flex sm:max-w-full sm:gap-1 sm:overflow-x-auto sm:px-5 sm:pt-1.5" role="tablist" aria-label="Business connection details">
                                            {[
                                                ['overview', 'Overview', 'Summary'],
                                                ['webhooks', `Automatic updates (${hostWebhooks.length})`, `Updates (${hostWebhooks.length})`],
                                                ['api', `System access (${hostAccounts.length})`, `Access (${hostAccounts.length})`],
                                            ].map(([value, label, mobileLabel]) => (
                                                <button key={value} type="button" role="tab" aria-selected={integrationDetailTab === value} aria-label={label}
                                                    onClick={() => setIntegrationDetailTab(value)}
                                                    className={`focus-ring min-w-0 border-b-[3px] px-1 py-3 text-[12px] font-semibold sm:shrink-0 sm:px-4 sm:py-3.5 sm:text-[14px] ${integrationDetailTab === value
                                                        ? 'border-[#C56C42] bg-[#F7F6F2] text-[#173F35]' : 'border-transparent text-[#173F35] hover:bg-[#D7DDCF]/50'}`}><span className="sm:hidden">{mobileLabel}</span><span className="hidden sm:inline">{label}</span></button>
                                            ))}
                                        </div>
                                        {integrationDetailTab === 'overview' && (
                                            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(250px,0.85fr)]">
                                                <div className="px-3 py-3 sm:px-6 sm:py-6">
                                                    <h4 className="text-[18px] font-bold text-[#202421] sm:text-[22px]">Setup at a glance</h4>
                                                    <p className="mt-1 hidden text-[14px] text-[#173F35] sm:block">What this business has already configured.</p>
                                                    <div className="mt-2 divide-y divide-[#D7DDCF] border-t border-b border-[#D7DDCF] sm:mt-4">
                                                        {[
                                                            ['Business account', 'The Host is registered on EPANTRY', true, 'Registered'],
                                                            ['Software access', hostAccounts.length ? `${hostAccounts.length} connected ${hostAccounts.length === 1 ? 'account' : 'accounts'}` : 'No software access added', hostAccounts.length > 0, hostAccounts.length ? `${hostAccounts.length} connected` : 'Not added'],
                                                            ['Automatic updates', hostWebhooks.length ? `${hostWebhooks.length} update ${hostWebhooks.length === 1 ? 'destination' : 'destinations'} added` : 'No update destination added', hostWebhooks.length > 0, hostWebhooks.length ? `${hostWebhooks.length} connected` : 'Not added'],
                                                        ].map(([label, detail, ready, mobileDetail], index) => (
                                                            <div key={label} className="flex items-center gap-2 py-2.5 sm:gap-3 sm:py-4">
                                                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${ready ? 'bg-[#D7DDCF] text-[#173F35]' : 'border border-[#C56C42] bg-[#F7F6F2] text-[#C56C42]'}`}>
                                                                    {ready ? <CheckCircle2 size={20} aria-hidden="true" /> : <span className="text-[14px] font-bold">{String(index + 1).padStart(2, '0')}</span>}
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block text-[14px] font-bold sm:text-[15px]">{label}</span>
                                                                    <span className="mt-0.5 block text-[12px] text-[#173F35] sm:hidden">{mobileDetail}</span>
                                                                    <span className="mt-0.5 hidden text-[13px] text-[#173F35] sm:block">{detail}</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-between border-t-[4px] border-[#C56C42] bg-[#173F35] px-3 py-4 text-[#F7F6F2] lg:border-l-[4px] lg:border-t-0 sm:px-6 sm:py-7">
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#D7DDCF] sm:text-[13px]">Next step</p>
                                                        <h4 className="mt-1 text-[18px] font-bold leading-tight sm:mt-2 sm:text-[22px]">
                                                            <span className="sm:hidden">{selectedHostHasFailure ? 'Check failed updates' : selectedHostConfigured ? 'Review setup' : 'Host setup needed'}</span>
                                                            <span className="hidden sm:inline">{selectedHostHasFailure ? 'Check the failed update' : selectedHostConfigured ? 'Review the existing setup' : 'The Host needs to set up a connection'}</span>
                                                        </h4>
                                                        <p className="mt-2 text-[13px] leading-[1.5] text-[#F7F6F2] sm:hidden">
                                                            {selectedHostHasFailure ? 'A recent update failed. Check its details.' : selectedHostConfigured
                                                                ? 'Review connected services and recent updates.'
                                                                : 'The Host can connect its system from Host settings.'}
                                                        </p>
                                                        <p className="mt-3 hidden text-[15px] leading-relaxed text-[#F7F6F2] sm:block">
                                                            {selectedHostHasFailure ? 'One or more updates did not reach their destination. Check the activity and open a review if needed.' : selectedHostConfigured
                                                                ? 'This business has at least one connection method. Check the details to see whether updates have been sent successfully.'
                                                                : 'No connection method has been added yet. The Host can add one in their own integration settings.'}
                                                        </p>
                                                        <p className="mt-4 hidden border-l-[3px] border-[#C56C42] pl-3 text-[13px] leading-relaxed text-[#D7DDCF] sm:block">Software access and automatic updates can be set up independently.</p>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-5">
                                                        <button type="button" onClick={() => setIntegrationDetailTab('webhooks')}
                                                            className="focus-ring min-h-10 flex-1 rounded-lg bg-[#F7F6F2] px-2 py-2 text-[12px] font-bold text-[#173F35] hover:bg-[#D7DDCF] sm:flex-none sm:px-4 sm:py-2.5 sm:text-[14px]">Check updates</button>
                                                        <button type="button" onClick={() => setIntegrationDetailTab('api')}
                                                            className="focus-ring min-h-10 flex-1 rounded-lg border border-[#D7DDCF] bg-transparent px-2 py-2 text-[12px] font-bold text-[#F7F6F2] hover:bg-[#F7F6F2]/10 sm:flex-none sm:px-4 sm:py-2.5 sm:text-[14px]"><span className="sm:hidden">Software access</span><span className="hidden sm:inline">View software access</span></button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {integrationDetailTab === 'webhooks' && (
                                            <div className="px-4 py-5 sm:px-6 sm:py-6">
                                                <h4 className="text-[20px] font-bold">Automatic update delivery</h4>
                                                <p className="mt-1 hidden text-[14px] text-[#173F35] sm:block">See whether updates sent to this Host's connected system have reached it.</p>
                                                {hostWebhooks.length ? (
                                                    <div className="mt-4 divide-y divide-[#D7DDCF] border-y border-[#D7DDCF]">
                                                        {hostWebhooks.map(webhook => (
                                                            <button key={webhook.id} type="button" aria-pressed={chosenConnection?.id === webhook.id}
                                                                onClick={() => { setSelectedIntegrationId(webhook.id); setSelectedReviewCase(null); setReason(''); }}
                                                                className={`focus-ring flex w-full flex-wrap items-center justify-between gap-3 px-3 py-4 text-left ${chosenConnection?.id === webhook.id ? 'bg-[#D7DDCF]' : 'hover:bg-[#D7DDCF]'}`}>
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block break-words text-[16px] font-bold">{webhook.name}</span>
                                                                    <span className="mt-1 block text-[13px] text-[#173F35]">Last attempt: {integrationLastSeen(webhook.lastDeliveryAt)}</span>
                                                                </span>
                                                                <span className={`rounded-full bg-[#F7F6F2] px-3 py-1.5 text-[13px] font-bold ${integrationHealthClass(webhook)}`}>{integrationHealthLabel(webhook)}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="mt-4 flex items-start gap-3 rounded-xl border-l-[4px] border-[#C56C42] bg-[#D7DDCF]/65 px-4 py-5">
                                                        <Webhook size={23} className="shrink-0 text-[#173F35]" aria-hidden="true" />
                                                        <div><h5 className="text-[17px] font-bold">No automatic updates set up</h5><p className="mt-1 hidden text-[14px] text-[#173F35] sm:block">This Host has not added a destination for system updates.</p></div>
                                                    </div>
                                                )}
                                                {chosenConnection && (
                                                    <details className="mt-4 rounded-lg bg-[#F7F6F2] px-4 py-3 text-[13px] text-[#173F35]">
                                                        <summary className="focus-ring cursor-pointer font-semibold">Technical connection address</summary>
                                                        <p className="mt-2 break-all">{chosenConnection.endpointHost || 'Address unavailable'}</p>
                                                    </details>
                                                )}
                                                {chosenConnection?.lastDeliveryStatus === 'failed' && (
                                                    <div className="mt-5 rounded-xl border-l-[4px] border-[#C56C42] bg-[#F7F6F2] px-4 py-5">
                                                        <h5 className="text-[17px] font-bold">An update could not be delivered</h5>
                                                        <p className="mt-1 text-[14px] text-[#173F35]">{chosenConnection.name} needs a closer look.</p>
                                                        {selectedConnectionCase ? (
                                                            <button type="button" onClick={() => { setSelectedReviewCase(selectedConnectionCase); setReason(''); }}
                                                                className="focus-ring mt-3 rounded-lg bg-[#173F35] px-4 py-2.5 text-[14px] font-bold text-[#F7F6F2]">Open existing review</button>
                                                        ) : canMutateDomain ? (
                                                            <div className="mt-3 max-w-xl">
                                                                <label htmlFor="webhook-failure-reason" className="text-[14px] font-semibold">What went wrong?</label>
                                                                <textarea id="webhook-failure-reason" value={reason} onChange={event => setReason(event.target.value)} rows={2}
                                                                    placeholder="Describe what needs checking" className="focus-ring mt-2 w-full rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 py-2.5 text-[15px]" />
                                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={createIntegrationReview}
                                                                    className="focus-ring mt-3 rounded-lg bg-[#173F35] px-4 py-2.5 text-[14px] font-bold text-[#F7F6F2] disabled:opacity-50">Start a review</button>
                                                            </div>
                                                        ) : <p className="mt-2 text-[14px] text-[#173F35]">Your role can view this issue but cannot change it.</p>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {integrationDetailTab === 'api' && (
                                            <div className="px-4 py-5 sm:px-6 sm:py-6">
                                                <h4 className="text-[20px] font-bold">Software accounts</h4>
                                                <p className="mt-1 hidden text-[14px] text-[#173F35] sm:block">View the accounts this Host has authorised to access its system.</p>
                                                {hostAccounts.length ? (
                                                    <div className="mt-4 divide-y divide-[#D7DDCF] border-y border-[#D7DDCF]">
                                                        {hostAccounts.map(account => (
                                                            <div key={account.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-4">
                                                                <div className="min-w-0">
                                                                    <p className="break-words text-[16px] font-bold">{account.name}</p>
                                                                    <p className="mt-1 text-[13px] text-[#173F35]">{account.scopeCount} permitted {account.scopeCount === 1 ? 'area' : 'areas'}</p>
                                                                </div>
                                                                <span className="rounded-full bg-[#D7DDCF] px-3 py-1.5 text-[13px] font-bold text-[#173F35]">{titleize(account.status)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="mt-4 flex items-start gap-3 rounded-xl border-l-[4px] border-[#C56C42] bg-[#D7DDCF]/65 px-4 py-5">
                                                        <ShieldCheck size={23} className="shrink-0 text-[#173F35]" aria-hidden="true" />
                                                        <div><h5 className="text-[17px] font-bold">No software accounts added</h5><p className="mt-1 hidden text-[14px] text-[#173F35] sm:block">This Host has not set up access for another system.</p></div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="px-5 py-10 text-[15px] text-[#173F35]" role="status">
                                        {integrationLoading ? 'Loading business details…' : 'Choose a Host from the list to see its setup and updates.'}
                                    </div>
                                )}
                            </section>

                            <section className="min-w-0 overflow-hidden rounded-[14px] border border-[#D7DDCF] bg-[#F7F6F2] sm:rounded-[18px]" aria-labelledby="integration-followups-title">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t-[4px] border-[#C56C42] bg-[#D7DDCF]/45 px-3 py-3 sm:gap-3 sm:px-6 sm:py-5">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#C56C42] sm:text-[13px]">03 / Follow up</p>
                                        <h3 id="integration-followups-title" className="mt-1 text-[18px] font-bold text-[#202421] sm:text-[22px]">Issues to review</h3>
                                        <p className="mt-1 hidden text-[14px] text-[#173F35] sm:block">Updates awaiting an admin decision.</p>
                                    </div>
                                    <span className="rounded-full bg-[#173F35] px-3 py-1.5 text-[13px] font-bold text-[#F7F6F2]">
                                        {integrationReviewsLoading ? 'Loading…' : integrationReviewsError && !integrationReviewRows.length ? 'Unavailable' : `${activeConnectionCases.length} open`}
                                    </span>
                                </div>
                                {integrationReviewsError && (
                                    <div role="alert" className="bg-[#F7F6F2] px-4 py-3 text-[14px] text-[#173F35] sm:px-6">
                                        {integrationReviewsError} <button type="button" onClick={refreshIntegrationPage} className="focus-ring ml-2 font-semibold underline">Try again</button>
                                    </div>
                                )}
                                {integrationReviewsLoading ? (
                                    <p role="status" className="flex items-center gap-2 px-4 py-5 text-[14px] sm:px-6"><LoaderCircle className="animate-spin" size={17} /> Loading issues…</p>
                                ) : activeConnectionCases.length ? (
                                    <div className="divide-y divide-[#D7DDCF]">
                                        {shownConnectionCases.map(item => (
                                            <button key={item.id} type="button" onClick={() => { setSelectedReviewCase(item); setReason(''); }}
                                                className="focus-ring flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-[#D7DDCF] sm:px-6">
                                                <span className="min-w-0 flex-1">
                                                    <span className="block break-words text-[15px] font-bold">{item.entity?.label || item.summary}</span>
                                                    <span className="mt-1 block text-[13px] text-[#173F35]">{item.summary}</span>
                                                </span>
                                                <span className="shrink-0 text-[13px] font-semibold text-[#173F35]">{titleize(item.status)} <ChevronRight size={15} className="inline" /></span>
                                            </button>
                                        ))}
                                        {activeConnectionCases.length > 5 && (
                                            <div className="py-4 text-center">
                                                <button type="button" onClick={() => setShowAllIntegrationCases(value => !value)}
                                                    className="focus-ring rounded-lg border border-[#D7DDCF] px-4 py-2 text-[14px] font-bold">
                                                    {showAllIntegrationCases ? 'Show fewer' : `View all ${activeConnectionCases.length} reviews`}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : !integrationReviewsError ? (
                                    <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-5">
                                        <CheckCircle2 size={18} className="shrink-0 text-[#173F35] sm:h-[21px] sm:w-[21px]" aria-hidden="true" />
                                        <p className="text-[13px] text-[#173F35] sm:hidden">{moreReviewsAvailable ? 'No open issues in loaded results.' : 'No issues to review.'}</p>
                                        <p className="hidden text-[14px] text-[#173F35] sm:block">{moreReviewsAvailable ? 'No open issues in the results loaded so far.' : 'No issues need an admin review right now.'}</p>
                                    </div>
                                ) : null}
                                {moreReviewsAvailable && !integrationReviewsLoading && (
                                    <div className="border-t border-[#D7DDCF] px-4 py-4 text-center">
                                        <button type="button" onClick={loadMoreIntegrationReviews} disabled={integrationReviewsMoreBusy}
                                            className="focus-ring rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-4 py-2.5 text-[14px] font-semibold disabled:opacity-50">
                                            {integrationReviewsMoreBusy ? 'Loading…' : `Load more issues (${integrationReviewRows.length} / ${integrationReviewTotal})`}
                                        </button>
                                    </div>
                                )}
                                {pastConnectionCases.length > 0 && (
                                    <details className="border-t border-[#D7DDCF] px-4 py-4 sm:px-6">
                                        <summary className="focus-ring cursor-pointer text-[14px] font-semibold">Past decisions ({pastConnectionCases.length})</summary>
                                        <div className="mt-3 divide-y divide-[#D7DDCF]">
                                            {pastConnectionCases.map(item => (
                                                <button key={item.id} type="button" onClick={() => { setSelectedReviewCase(item); setReason(''); }}
                                                    className="focus-ring flex w-full items-center justify-between gap-3 py-3 text-left text-[14px]">
                                                    <span className="min-w-0 break-words">{item.entity?.label || item.summary}</span>
                                                    <span className="shrink-0">{titleize(item.status)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </section>

                            {selectedCase && (
                                <section className="rounded-2xl border border-[#C56C42] bg-[#F7F6F2] px-4 py-5 sm:px-6" aria-labelledby="integration-decision-title">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h3 id="integration-decision-title" className="text-[21px] font-bold">Review this issue</h3>
                                        <button type="button" onClick={() => { setSelectedReviewCase(null); setReason(''); }}
                                            className="focus-ring rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 py-2 text-[13px] font-semibold">Close</button>
                                    </div>
                                    <p className="mt-2 break-words text-[15px] font-bold">{selectedCase.entity?.label || selectedCase.summary}</p>
                                    <p className="mt-1 text-[14px] text-[#173F35]">{selectedCase.details || selectedCase.summary}</p>
                                    {canMutateDomain && !['resolved', 'dismissed'].includes(String(selectedCase.status || '').toLowerCase()) ? (
                                        <div className="mt-4 max-w-3xl">
                                            <label htmlFor="integration-decision-reason" className="text-[14px] font-bold">Reason for your decision</label>
                                            <textarea id="integration-decision-reason" rows={3} value={reason} onChange={event => setReason(event.target.value)}
                                                className="focus-ring mt-2 w-full rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-4 py-3 text-[15px]" placeholder="Explain your decision" />
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideIntegrationCase('resolve')}
                                                    className="focus-ring rounded-lg bg-[#173F35] px-4 py-2.5 text-[14px] font-bold text-[#F7F6F2] disabled:opacity-50">Mark resolved</button>
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideIntegrationCase('needs_action')}
                                                    className="focus-ring rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-4 py-2.5 text-[14px] font-bold disabled:opacity-50">Needs more work</button>
                                                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decideIntegrationCase('dismiss')}
                                                    className="focus-ring rounded-lg border border-[#C56C42] bg-[#F7F6F2] px-4 py-2.5 text-[14px] font-bold text-[#173F35] disabled:opacity-50">Close without action</button>
                                            </div>
                                        </div>
                                    ) : <p className="mt-4 text-[14px] text-[#173F35]">{['resolved', 'dismissed'].includes(String(selectedCase.status || '').toLowerCase()) ? 'This review is complete.' : 'Your role can view this issue but cannot change it.'}</p>}
                                </section>
                            )}
                        </div>
                    </div>
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
                        ? <><span className="sm:hidden">Data Quality & Duplicates</span><span className="hidden sm:inline">Data Quality & Duplicate Review</span></>
                        : section === 'recipeReview'
                            ? 'Recipe Publishing Review'
                            : section === 'policy' ? <><span className="block text-[22px] leading-[1.2] tracking-[-0.02em] sm:hidden">Food rules & features</span><span className="hidden sm:inline">Food Rules & Feature Access</span></> : section === 'aiQuality' ? 'Food Copilot Health' : `${config.code} · ${config.title}`
            }
            description={
                section === 'trustSafety'
                    ? null
                    : section === 'users'
                    ? null
                    : section === 'recipeReview'
                        ? 'Review recipes waiting for a decision, check food readiness, and move each recipe to the right next step.'
                        : section === 'dataQuality'
                            ? <><span className="sm:hidden">Review issues, duplicates and batches.</span><span className="hidden sm:inline">Review product issues, duplicates and batches in one place.</span></>
                        : section === 'policy' ? <><span className="text-[13px] leading-[1.3] sm:hidden">Manage rules and features.</span><span className="hidden sm:inline">Create and review food safety rules, manage feature access, and track related admin work.</span></> : section === 'aiQuality' ? 'Monitor saved AI results and issues.' : config.description
            }
            showWorkspaceBadge={section !== 'users'}
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
                    disabled={section === 'recipeReview' ? recipeReviewLoading : section === 'dataQuality' ? dataQualityLoading : loading}
                    className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
                >
                    <RefreshCw
                        size={14}
                        className={
                            (section === 'recipeReview' ? recipeReviewLoading : section === 'dataQuality' ? dataQualityLoading : loading)
                                ? 'animate-spin'
                                : ''
                        }
                        aria-hidden="true"
                    />
  
                    Refresh
                </button>
            }
        >
            {section !== 'dataQuality' && section !== 'recipeReview' && section !== 'users' && section !== 'trustSafety' ? (
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
                                : section === 'aiQuality' ? 'Food Copilot monitoring' : 'Governed admin operations'}
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
                <PeopleBusinessWorkspace
                    entries={metricEntries}
                    isLoading={loading}
                    loadError={commandCenterError}
                    onRefresh={load}
                    hasAdminPermission={hasAdminPermission}
                    isRootSuperAdmin={isRootSuperAdmin}
                />
            ) : null}

            {section !== 'recipeReview' && section !== 'users' && section !== 'aiQuality' && loading ? (
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
                    section !== 'recipeReview' && section !== 'policy' && section !== 'trustSafety' && section !== 'aiQuality' && section !== 'users' ? (
                        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {metricEntries.map(
                                ([label, value, MetricIcon]) => (
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

                            <details className="group border-y border-[#D7DDCF] bg-[#F7F6F2]">
                                <summary className="focus-ring flex cursor-pointer items-center justify-between gap-3 px-4 py-4 text-[14px] font-bold text-[#173F35] sm:px-5">
                                    Other platform checks
                                    <span className="text-[13px] font-medium text-[#C56C42] group-open:hidden">Show details +</span>
                                    <span className="hidden text-[13px] font-medium text-[#C56C42] group-open:inline">Hide details −</span>
                                </summary>
                                {commandCenterError ? <p className="px-4 pb-3 text-[13px] text-[#C56C42] sm:px-5">Platform overview is unavailable.</p> : null}
                                <div className="grid grid-cols-2 border-t border-[#D7DDCF] sm:grid-cols-4">
                                    {metricEntries.map(([label, value, MetricIcon]) => (
                                        <div key={label} className="min-w-0 border-b border-r border-[#D7DDCF] p-3 sm:p-4">
                                            <div className="flex items-center gap-2 text-[#173F35]">
                                                <MetricIcon size={17} aria-hidden="true" />
                                                <span className="text-[23px] font-bold tabular-nums">{commandCenterError || loading ? '—' : (value ?? 0)}</span>
                                            </div>
                                            <p className="mt-1 text-[13px] leading-5 text-[#52645A]">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3 sm:pt-4">
                                <p className="max-w-2xl text-sm leading-5 text-stone-600">AI results do not approve products or recipes.</p>
                                <Link to="/admin/product-intelligence" className={primaryButtonClass}>
                                    Review product decisions
                                </Link>
                            </div>
                        </div>
                    ) : null}

                    {section === 'policy' ? (
                        <div id="epantry-policy-mobile" className="mt-4 min-w-0 space-y-6 pb-2 sm:mt-6 sm:space-y-8">
                            <style>{`
                              @media (max-width: 639px) {
                                /* Full-bleed policy content within the AdminShell's content column. */
                                #epantry-policy-mobile {
                                  width: calc(100% + 20px);
                                  margin-left: -10px;
                                  margin-right: -10px;
                                  padding-bottom: 0;
                                  overflow-x: clip;
                                }
                                #epantry-policy-mobile > section {
                                  border-radius: 0;
                                  box-shadow: none;
                                  border-left: 0;
                                  border-right: 0;
                                }
                                #epantry-policy-mobile .policy-overview-intro {
                                  padding: 15px 16px 16px;
                                  border-left-width: 4px;
                                }
                                #epantry-policy-mobile .policy-overview-intro h2 {
                                  font-size: 19px;
                                  line-height: 1.26;
                                  letter-spacing: -0.025em;
                                }
                                #epantry-policy-mobile .policy-overview-intro > p:last-child {
                                  margin-top: 6px;
                                  font-size: 13px;
                                  line-height: 1.45;
                                }
                                #epantry-policy-mobile .policy-metrics > div {
                                  padding: 12px 10px;
                                }
                                #epantry-policy-mobile .policy-metrics > div > p:first-child {
                                  font-size: 24px;
                                }
                                #epantry-policy-mobile .policy-metrics > div > p:last-child {
                                  margin-top: 4px;
                                  font-size: 12px;
                                  line-height: 1.25;
                                }
                                #epantry-policy-mobile .policy-feature-header {
                                  gap: 7px;
                                  padding: 17px 16px;
                                }
                                #epantry-policy-mobile .policy-feature-header h2 {
                                  font-size: 19px;
                                  line-height: 1.25;
                                }
                                #epantry-policy-mobile .policy-feature-header p:last-child {
                                  font-size: 13px;
                                  line-height: 1.45;
                                }
                                /* Balanced mobile typographic ladder: section -> item -> metadata. */
                                #epantry-policy-mobile .policy-overview-intro > p:first-child,
                                #epantry-policy-mobile .policy-feature-header > div > p:first-child,
                                #epantry-policy-mobile .policy-food-heading > div > p:first-child,
                                #epantry-policy-mobile .policy-followup > div:first-child > div > p:first-child {
                                  font-size: 12.5px;
                                  line-height: 1.4;
                                  letter-spacing: 0.04em;
                                }
                                #epantry-policy-mobile .policy-feature-table > div:first-child {
                                  font-size: 12.5px;
                                  line-height: 1.45;
                                }
                                #epantry-policy-mobile .policy-feature-row > div:first-child > div:first-child p {
                                  font-size: 14px;
                                  line-height: 1.35;
                                }
                                #epantry-policy-mobile .policy-feature-row > div:first-child > div:first-child span:last-child {
                                  font-size: 12.5px;
                                  line-height: 1.3;
                                }
                                #epantry-policy-mobile .policy-feature-row > div:first-child > p {
                                  font-size: 13px;
                                  line-height: 1.5;
                                }
                                #epantry-policy-mobile .policy-food-heading > div > p:last-child {
                                  font-size: 13px;
                                  line-height: 1.5;
                                }
                                #epantry-policy-mobile .policy-food-heading > p:last-child {
                                  font-size: 12.5px;
                                  line-height: 1.5;
                                }
                                #epantry-policy-mobile .policy-followup .policy-followup-row h3 {
                                  font-size: 14px;
                                  line-height: 1.35;
                                }
                                #epantry-policy-mobile .policy-followup .policy-followup-row > p {
                                  font-size: 12.5px;
                                  line-height: 1.5;
                                }
                                #epantry-policy-mobile .policy-feature-table {
                                  border: 0;
                                }
                                #epantry-policy-mobile .policy-feature-row {
                                  gap: 8px;
                                  border-left: 0 !important;
                                  padding: 12px 16px;
                                  background: #F7F6F2;
                                }
                                #epantry-policy-mobile .policy-feature-row > div:nth-child(2) {
                                  display: flex;
                                  justify-content: flex-start;
                                }
                                #epantry-policy-mobile .policy-feature-row > div:nth-child(2) button {
                                  width: auto;
                                  min-width: 128px;
                                  min-height: 38px;
                                  border-radius: 6px;
                                  padding: 8px 13px;
                                  font-size: 13px;
                                }
                                #epantry-policy-mobile .policy-feature-row > div:first-child > p {
                                  margin-top: 3px;
                                  line-height: 1.35;
                                }
                                #epantry-policy-mobile .policy-add-feature,
                                #epantry-policy-mobile .policy-add-feature button {
                                  border-radius: 0;
                                }
                                #epantry-policy-mobile .policy-add-feature > button {
                                  padding: 15px 16px;
                                }
                                #epantry-policy-mobile .policy-add-feature > button > span:first-child > span:last-child {
                                  font-size: 13px;
                                }
                                #epantry-policy-mobile .policy-food-heading {
                                  min-height: auto;
                                  padding: 18px 16px;
                                }
                                #epantry-policy-mobile .policy-food-heading h2 {
                                  font-size: 19px;
                                  line-height: 1.25;
                                }
                                #epantry-policy-mobile .policy-food-heading p {
                                  line-height: 1.45;
                                }
                                #epantry-policy-mobile .policy-rule-library {
                                  border: 0;
                                }
                                #epantry-policy-mobile .policy-followup {
                                  border-top-width: 2px;
                                }
                                #epantry-policy-mobile .policy-followup > div:first-child {
                                  padding: 17px 16px 12px;
                                }
                                #epantry-policy-mobile .policy-followup > div:first-child h2 {
                                  font-size: 19px;
                                  line-height: 1.26;
                                }
                                #epantry-policy-mobile .policy-followup .policy-followup-row {
                                  padding: 12px 16px;
                                  border-right: 0;
                                  border-bottom: 1px solid #D7DDCF;
                                }
                                #epantry-policy-mobile .policy-followup .policy-followup-row > p:last-child {
                                  margin-top: 3px;
                                }
                                /* The legacy admin queues remain reachable when they contain records.
                                   When all three are empty, avoid rendering three more empty cards. */
                                #policy-related-queues.policy-queues-empty {
                                  display: none;
                                }
                                #policy-related-queues:not(.policy-queues-empty) {
                                  display: block;
                                  margin: 0;
                                }
                                #policy-related-queues > section {
                                  margin: 0;
                                  padding: 14px 16px;
                                  border: 0;
                                  border-bottom: 1px solid #D7DDCF;
                                  border-radius: 0;
                                  box-shadow: none;
                                  background: #F7F6F2;
                                }
                                #policy-related-queues > section > div {
                                  margin-top: 8px;
                                }
                                #policy-related-queues > section button,
                                #policy-related-queues > section div > p {
                                  border-radius: 0;
                                }
                              }
                            `}</style>
                            {/* Overview: a quiet, editorial heading instead of another oversized colour banner. */}
                            <section className="border-y border-[#D7DDCF] bg-[#F7F6F2]">
                                <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.65fr)]">
                                    <div className="policy-overview-intro border-l-[5px] border-[#C56C42] px-4 py-5 sm:px-7 sm:py-7">
                                        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#C56C42]">FOOD SAFETY  /  PLATFORM CONTROLS</p>
                                        <h2 className="mt-2 max-w-[650px] text-[26px] font-bold leading-[1.16] tracking-[-0.035em] text-[#202421] sm:text-[32px]">The rules behind a trusted food platform.</h2>
                                        <p className="mt-2 text-[14px] leading-6 text-[#173F35]">Review what is available, then manage the rules that protect it.</p>
                                    </div>
                                    <div className="policy-metrics grid grid-cols-3 border-t border-[#D7DDCF] bg-[#D7DDCF] lg:border-l lg:border-t-0">
                                        {[
                                            ['Live features', policyLoadIssues.flags ? '—' : (policy?.featureFlags ?? []).filter((flag) => flag.enabled).length],
                                            ['Total features', policyLoadIssues.flags ? '—' : (policy?.featureFlags?.length ?? 0)],
                                            ['Food rules', policyLoadIssues.rules ? '—' : (policy?.ruleProfiles?.length ?? 0)],
                                        ].map(([label, value]) => (
                                            <div key={label} className="flex min-w-0 flex-col justify-center border-r border-[#173F35]/15 px-3 py-4 last:border-r-0 sm:px-5">
                                                <p className="text-[28px] font-bold leading-none tabular-nums text-[#173F35] sm:text-[34px]">{value}</p>
                                                <p className="mt-2 text-[12px] font-semibold leading-4 text-[#202421] sm:text-[13px]">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Primary operational surface: live feature states and controlled actions. */}
                            <section id="policy-feature-access" className="min-w-0 bg-[#F7F6F2]">
                                <div className="policy-feature-header flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[#C56C42] bg-[#173F35] px-4 py-5 sm:px-7 sm:py-6">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#D7DDCF]">01 / PLATFORM FEATURES</p>
                                        <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#F7F6F2] sm:text-[29px]">Control feature availability</h2>
                                        <p className="mt-1 text-[13px] leading-5 text-[#F7F6F2]/80 sm:text-sm">Check what is on and what is paused. Changes require confirmation.</p>
                                    </div>
                                    <span className="border border-[#D7DDCF]/40 px-3 py-2 text-[13px] font-bold text-[#F7F6F2]">{policyLoadIssues.flags ? 'Unavailable' : `${policy?.featureFlags?.length ?? 0} total`}</span>
                                </div>
                                <div className="policy-feature-table border-x border-[#D7DDCF]">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7DDCF] bg-[#D7DDCF]/50 px-4 py-3 text-[13px] font-medium text-[#173F35] sm:px-6">
                                        <span>Feature / availability</span>
                                        <span>{isRootSuperAdmin ? 'Root Super Admin controls' : 'View only'}</span>
                                    </div>
                                    {policyLoadIssues.flags ? (
                                    <p role="alert" className="p-4 text-sm text-rose-700">Features could not load: {policyLoadIssues.flags}. Select Refresh to retry.</p>
                                ) : !policy?.featureFlags?.length ? (
                                    <p className="p-4 text-sm text-stone-600 sm:p-5">No platform features found yet. Use Add a feature below if you have Root Super Admin access.</p>
                                ) : (
                                    <div className="divide-y divide-[#D7DDCF]">
                                        {(policyFlagsExpanded ? policy.featureFlags : policy.featureFlags.slice(0, 8)).map((flag, index) => {
                                            return (
                                                <div key={flag.id} className="policy-feature-row grid min-w-0 gap-3 border-l-[3px] bg-[#F7F6F2] px-4 py-4 transition-colors hover:bg-[#ECEEE7] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-[18px]" style={{ borderLeftColor: flag.enabled ? '#173F35' : '#C56C42' }}>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2.5">
                                                            <span className="min-w-[24px] text-[11px] font-bold tabular-nums text-[#C56C42]">{String(index + 1).padStart(2, '0')}</span>
                                                            <p className="break-words text-[15px] font-bold text-[#202421] sm:text-[16px]">{flag.key === 'aiCopilot' ? 'AI Copilot' : titleize(flag.key)}</p>
                                                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${flag.enabled ? 'bg-[#D7DDCF] text-[#173F35]' : 'bg-[#F7F6F2] text-[#C56C42] border border-[#C56C42]/50'}`}>{flag.enabled ? 'Enabled' : 'Paused'}</span>
                                                        </div>
                                                        <p className="mt-1 text-[13px] leading-5 text-[#202421]/70 sm:text-[14px]">{flag.description || 'No description provided.'}</p>
                                                        <p className="mt-1 text-[13px] leading-5 text-[#173F35]">{(flag.environments || []).length ? flag.environments.map((env) => ({ development: 'Testing site', staging: 'Preview site', production: 'Live site' }[env] || env)).join(', ') : 'No site selected'} · {flag.enabled && flag.rolloutPercentage > 0 ? `${flag.rolloutPercentage}% of visitors` : 'Not shown to visitors'}</p>
                                                    </div>
                                                    {isRootSuperAdmin ? (
                                                        <div className="min-w-0">
                                                            <button type="button" disabled={busy || Boolean(policyLoadIssues.flags)}
                                                                aria-expanded={policyFlagAction?.id === flag.id}
                                                                onClick={() => beginPolicyFlagAction(flag)}
                                                                className={`focus-ring w-full rounded-md border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${flag.enabled ? 'border-[#C56C42] bg-[#F7F6F2] text-[#202421] hover:bg-[#D7DDCF]' : 'border-[#173F35] bg-[#173F35] text-[#F7F6F2] hover:bg-[#202421]'}`}>
                                                                {policyFlagAction?.id === flag.id ? 'Close changes' : (flag.enabled ? 'Pause feature' : 'Enable feature')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs font-medium text-stone-500">Only the Root Super Admin can change this feature.</p>
                                                    )}
                                                    {isRootSuperAdmin && policyFlagAction?.id === flag.id ? (
                                                        <div className="min-w-0 border-l-[3px] border-[#C56C42] bg-[#D7DDCF]/40 p-4 sm:col-span-2 sm:p-5">
                                                            <p className="text-sm font-bold text-[#202421]">{policyFlagAction.enabled ? 'Enable' : 'Pause'} {flag.key}</p>
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
                                                            <p className="mt-2 text-sm text-[#173F35]">Root Super Admin access and recent MFA are required. Live/high-risk changes also need evidence.</p>
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
                                        {policy.featureFlags.length > 8 ? <button type="button" onClick={() => setPolicyFlagsExpanded((v) => !v)} className="focus-ring w-full border-t border-[#D7DDCF] px-5 py-3 text-left text-sm font-bold text-[#173F35]">{policyFlagsExpanded ? 'Show fewer features' : `View all ${policy.featureFlags.length} features`}</button> : null}
                                    </div>
                                )}
                                </div>
                            </section>

                            {isRootSuperAdmin ? (
                                <section className="policy-add-feature border-x border-b border-[#D7DDCF] bg-[#F7F6F2]">
                                    <button type="button" onClick={() => setShowFlagForm((v) => !v)} className="focus-ring flex w-full items-center justify-between gap-4 border-l-[3px] border-[#C56C42] px-4 py-4 text-left hover:bg-[#D7DDCF]/40 sm:px-6 sm:py-5">
                                        <span className="min-w-0"><span className="block text-sm font-bold text-[#173F35]">ADD A FEATURE</span><span className="mt-1 block text-[18px] font-bold text-[#202421]">Create a new feature</span><span className="mt-1 block text-sm text-[#173F35]"><span className="sm:hidden">Add it paused. Enable later.</span><span className="hidden sm:inline">Create a paused feature now; enable it when it's ready.</span></span></span>
                                        <span className="shrink-0 border border-[#173F35] bg-[#F7F6F2] px-3 py-2 text-sm font-bold text-[#173F35]">{showFlagForm ? 'Close' : 'Open form'}</span>
                                    </button>
                                    {showFlagForm ? (
                                        <div className="grid gap-4 border-t border-[#D7DDCF] bg-[#F7F6F2] p-4 sm:grid-cols-2 sm:p-6">
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">Reason for creating this feature
                                                <input className={`${inputClass} mt-1`} minLength={10} value={featureFlagForm.reason} placeholder="Why is this needed?" onChange={(e) => setFeatureFlagForm((state) => ({ ...state, reason: e.target.value }))} />
                                            </label>
                                            <label className="min-w-0 text-sm font-semibold text-stone-700">Approval ticket or reference
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
                                                <p className="text-sm leading-5 text-[#173F35]">The change reason and ticket above are required. All new features start paused.</p>
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

                            {/* Separate rules area; not an empty sibling panel beside the active feature controls. */}
                            <section id="policy-food-rules" className="min-w-0 border-y border-[#D7DDCF] bg-[#F7F6F2]">
                                <div className="grid lg:grid-cols-[minmax(260px,0.38fr)_minmax(0,0.62fr)]">
                                    <div className="policy-food-heading flex flex-col justify-between bg-[#C56C42] px-4 py-5 sm:px-7 sm:py-7">
                                        <div>
                                            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-[#202421]">02 / FOOD SAFETY</p>
                                            <h2 className="mt-2 text-[25px] font-bold leading-tight tracking-[-0.03em] text-[#202421] sm:text-[29px]">Food safety rules</h2>
                                            <p className="mt-2 max-w-[340px] text-[14px] leading-6 text-[#202421]">Create guidance for allergens, nutrition and dietary information.</p>
                                        </div>
                                        <p className="mt-5 border-t border-[#202421]/20 pt-3 text-[13px] font-medium leading-5 text-[#202421]">A rule starts as a draft. Another authorised reviewer must approve it.</p>
                                    </div>
                                    <div className="policy-rule-library min-w-0 border-t border-[#D7DDCF] lg:border-t-0">
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D7DDCF] px-4 py-4 sm:px-6">
                                            <div>
                                                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#173F35]">RULE LIBRARY</p>
                                                <p className="mt-1 text-[14px] text-[#202421]">{policyLoadIssues.rules ? 'Rules unavailable' : `${policy?.ruleProfiles?.length ?? 0} recorded`}</p>
                                            </div>
                                            {hasAdminPermission('trust_safety.mutate') ? (
                                                <button type="button" onClick={() => setShowRuleForm((current) => !current)} className="focus-ring inline-flex items-center justify-center bg-[#173F35] px-4 py-2.5 text-[14px] font-bold text-[#F7F6F2] transition-colors hover:bg-[#202421]">{showRuleForm ? 'Close form' : '+ Create rule'}</button>
                                            ) : null}
                                        </div>
                                        {showRuleForm && hasAdminPermission('trust_safety.mutate') ? (
                                    <form className="grid gap-4 border-b border-[#D7DDCF] bg-[#D7DDCF]/30 p-4 sm:grid-cols-2 sm:p-6" onSubmit={(event) => {
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
                                    <div className="border-b border-[#D7DDCF] px-4 py-5 sm:px-6 sm:py-6"><p className="text-[17px] font-bold text-[#202421]">No food rules created yet.</p><p className="mt-1 text-[14px] text-[#173F35]">Create a draft to start the review process.</p></div>
                                ) : (
                                    <div className="divide-y divide-[#D7DDCF]">
                                        {(policyRulesExpanded ? policy.ruleProfiles : policy.ruleProfiles.slice(0, 6)).map((rule) => (
                                            <div key={rule.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
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
                                                        }} className="focus-ring rounded-lg border border-[#D7DDCF] bg-white px-3 py-2 text-sm font-bold text-[#173F35] disabled:opacity-50">Approve draft</button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                        {policy.ruleProfiles.length > 6 ? <button type="button" onClick={() => setPolicyRulesExpanded((v) => !v)} className="focus-ring w-full px-4 py-3 text-left text-sm font-bold text-emerald-800">{policyRulesExpanded ? 'Show fewer' : `View all ${policy.ruleProfiles.length} rules`}</button> : null}
                                    </div>
                                )}
                                <p className="border-t border-[#D7DDCF] px-4 py-3 text-[13px] text-[#173F35] sm:px-6"><span className="sm:hidden">A different admin must approve.</span><span className="hidden sm:inline">Only authorised food-safety admins can change rules. The creator cannot approve their own draft.</span></p>
                                    </div>
                                </div>
                            </section>

                            <section className="policy-followup border-t-[3px] border-[#202421] bg-[#F7F6F2]">
                                <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#C56C42]">03 / ADMIN FOLLOW-UP</p>
                                        <h2 className="mt-1 text-[22px] font-bold text-[#202421] sm:text-[24px]">Other requests & issues</h2>
                                    </div>
                                    <p className="text-[13px] text-[#173F35]">Review cases, incidents and support</p>
                                </div>
                                {policyRelatedIssues.length ? <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Some admin records could not load: {policyRelatedIssues.join(' · ')}. Select Refresh to retry.</p> : null}
                                <div className="grid border-t border-[#D7DDCF] md:grid-cols-3">
                                    {[
                                        ['Review requests', 'Cases waiting for an admin decision.', reviewCases, setSelectedReviewCase],
                                        ['Incidents', 'Issues being investigated or resolved.', incidents, setSelectedIncident],
                                        ['Support requests', 'Help requests assigned to the Admin area.', supportCases, setSelectedSupportCase],
                                    ].map(([name, help, records, select]) => (
                                        <div key={name} className="policy-followup-row min-w-0 border-b border-[#D7DDCF] px-4 py-4 md:border-r md:px-6 md:py-5 md:last:border-r-0">
                                            <div className="flex items-center justify-between gap-2"><h3 className="text-[15px] font-bold text-[#202421]">{name}</h3><span className="bg-[#D7DDCF] px-2.5 py-1 text-[13px] font-bold tabular-nums text-[#173F35]">{records.length}</span></div>
                                            <p className="mt-1 text-sm text-stone-600">{help}</p>
                                            {records.length ? <div className="mt-3 space-y-1.5">{records.slice(0, 3).map((record) => (
                                                <button key={record.id} type="button" onClick={() => select(record)} className="focus-ring block w-full border-b border-[#D7DDCF] px-1 py-2 text-left text-sm font-semibold text-[#173F35] hover:text-[#C56C42]">{record.title || record.subject?.label || record.reviewCaseKey || record.incidentKey || record.supportKey || 'Open record'} →</button>
                                            ))}</div> : <p className="mt-3 text-sm font-medium text-stone-500">Nothing waiting for review.</p>}
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
                        <main id="admin-data-quality-fullbleed" className="-mx-2.5 -mb-2.5 mt-2 min-w-0 bg-[#F7F6F2] pb-4 text-[#222923] sm:-mx-5 sm:-mb-5 sm:mt-5 sm:pb-8 lg:-mx-6 lg:-mb-6">
                            {/* Page-specific mobile full-width layout. No changes to the shared AdminShell or desktop styling. */}
                            <style>{`
                              @media (max-width: 639px) {
                                .page-shell:has(#admin-data-quality-fullbleed) {
                                  box-sizing: border-box !important;
                                  width: 100% !important;
                                  max-width: none !important;
                                  margin: 0 !important;
                                  padding: 0 !important;
                                }
                                .page-shell:has(#admin-data-quality-fullbleed) > div {
                                  border: 0 !important;
                                  border-radius: 0 !important;
                                  box-shadow: none !important;
                                }
                                .page-shell:has(#admin-data-quality-fullbleed) > div > .grid > section,
                                .page-shell:has(#admin-data-quality-fullbleed) .epantry-workspace-canvas {
                                  min-width: 0;
                                  width: 100%;
                                  border-radius: 0 !important;
                                }
                                .page-shell:has(#admin-data-quality-fullbleed) .epantry-workspace-canvas > header {
                                  padding-inline: 12px !important;
                                }
                                .page-shell:has(#admin-data-quality-fullbleed) .epantry-workspace-canvas > div {
                                  padding: 0 !important;
                                }
                                #admin-data-quality-fullbleed {
                                  width: 100%;
                                  margin: 0 !important;
                                  padding-bottom: 12px;
                                }
                                /* Edge-to-edge workspace, with a deliberate 12px reading gutter.
                                   Do not restore the old giant rounded outer card. */
                                #admin-data-quality-fullbleed .data-quality-work-area {
                                  margin-inline: 12px !important;
                                  margin-top: 18px !important;
                                  margin-bottom: 18px !important;
                                }
                                #admin-data-quality-fullbleed .data-quality-work-title {
                                  padding-inline: 2px;
                                  margin-bottom: 12px !important;
                                  gap: 6px;
                                }
                                #admin-data-quality-fullbleed .data-quality-work-title h3 {
                                  font-size: 21px !important;
                                  line-height: 1.25 !important;
                                }
                                #admin-data-quality-fullbleed .data-quality-work-grid {
                                  border: 1px solid #D9E1D7 !important;
                                  border-radius: 12px !important;
                                  overflow: hidden;
                                  background: #FFFEFB;
                                }
                                #admin-data-quality-fullbleed .dq-hero-copy {
                                  padding: 18px 16px 19px !important;
                                }
                                #admin-data-quality-fullbleed .dq-hero-copy h2 {
                                  font-size: 24px !important;
                                  line-height: 1.18 !important;
                                  letter-spacing: -0.035em;
                                }
                                #admin-data-quality-fullbleed .dq-hero-copy p.dq-hero-desc {
                                  font-size: 13px !important;
                                  line-height: 1.48 !important;
                                  margin-top: 8px !important;
                                }
                                #admin-data-quality-fullbleed .dq-hero-copy .dq-hero-action {
                                  margin-top: 12px !important;
                                  min-height: 38px;
                                  border-radius: 6px;
                                }
                                #admin-data-quality-fullbleed .dq-metric {
                                  min-height: 76px !important;
                                  padding: 11px 14px !important;
                                  align-items: flex-start !important;
                                }
                                #admin-data-quality-fullbleed .dq-metric strong {
                                  font-size: 25px !important;
                                  line-height: 1.05 !important;
                                }
                                #admin-data-quality-fullbleed .dq-metric span {
                                  margin-top: 5px !important;
                                  line-height: 1.25 !important;
                                }
                                /* Four truly clickable controls; stable height prevents clipping.
                                   Tab navigation never overlaps the report below it. */
                                #admin-data-quality-fullbleed .dq-tabs {
                                  display: grid !important;
                                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                                  grid-auto-rows: minmax(100px, auto) !important;
                                  gap: 8px !important;
                                  padding: 10px !important;
                                  background: #F7F6F2 !important;
                                  align-content: start !important;
                                }
                                #admin-data-quality-fullbleed .dq-tab {
                                  box-sizing: border-box !important;
                                  display: flex !important;
                                  flex-direction: column !important;
                                  justify-content: space-between !important;
                                  align-items: stretch !important;
                                  gap: 8px !important;
                                  height: auto !important;
                                  min-height: 100px !important;
                                  padding: 12px !important;
                                  border: 1px solid #D8E1D7 !important;
                                  border-left: 3px solid #D8E1D7 !important;
                                  border-radius: 8px !important;
                                  overflow: visible !important;
                                  text-align: left !important;
                                }
                                #admin-data-quality-fullbleed .dq-tab[aria-selected="true"] {
                                  border-color: #173F35 !important;
                                  border-left-color: #C86C42 !important;
                                  background: #173F35 !important;
                                  color: #FFFEFB !important;
                                }
                                #admin-data-quality-fullbleed .dq-tab[aria-selected="false"] {
                                  background: #EFF2EC !important;
                                  color: #173F35 !important;
                                }
                                #admin-data-quality-fullbleed .dq-tab-title {
                                  display: block !important;
                                  font-size: 14px !important;
                                  line-height: 1.3 !important;
                                  letter-spacing: -0.01em;
                                  overflow-wrap: normal;
                                  word-break: normal;
                                  white-space: normal;
                                }
                                #admin-data-quality-fullbleed .dq-panel-head {
                                  padding: 12px 12px !important;
                                  align-items: center;
                                }
                                #admin-data-quality-fullbleed .dq-panel-head h4 {
                                  font-size: 17px !important;
                                  line-height: 1.25 !important;
                                }
                                #admin-data-quality-fullbleed .dq-panel-head a {
                                  min-height: 38px;
                                  border-radius: 6px;
                                  font-size: 13px !important;
                                }
                                #admin-data-quality-fullbleed .dq-review-row {
                                  min-height: 66px;
                                  padding: 11px 13px !important;
                                }
                                #admin-data-quality-fullbleed .dq-review-row p:first-child {
                                  font-size: 14px !important;
                                  line-height: 1.35 !important;
                                }
                                #admin-data-quality-fullbleed .dq-review-row p:nth-child(2) {
                                  font-size: 12.5px !important;
                                  line-height: 1.4 !important;
                                }
                              }
                              @media (max-width: 359px) {
                                #admin-data-quality-fullbleed .data-quality-work-area { margin-inline: 9px !important; }
                                #admin-data-quality-fullbleed .dq-tabs { padding: 8px !important; gap: 6px !important; }
                                #admin-data-quality-fullbleed .dq-tab { padding: 10px !important; }
                                #admin-data-quality-fullbleed .dq-tab-title { font-size: 13px !important; }
                              }
                            `}</style>
                            <header className="dq-hero grid min-w-0 border-b border-[#D8DED5] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                                <div className="dq-hero-copy bg-[#173F35] px-4 py-4 text-[#F7F6F2] sm:px-8 sm:py-8">
                                    <p className="text-[12px] font-bold text-[#E2BD9C]">PRODUCT DATA / QUALITY</p>
                                    <h2 className="mt-1.5 max-w-xl text-[22px] font-extrabold leading-[1.15] sm:mt-2 sm:text-[32px]"><span className="sm:hidden">Know what needs attention.</span><span className="hidden sm:inline">Know what needs a closer look.</span></h2>
                                    <p className="dq-hero-desc mt-1.5 max-w-xl text-[13px] leading-[1.4] text-[#D7E3D8] sm:mt-2 sm:text-[15px] sm:leading-[1.5]">Review product records, duplicate warnings and catalog issues.</p>
                                    <Link to={isRootSuperAdmin ? '/admin/host-listings?tab=review' : '/admin/product-intelligence'} className="dq-hero-action focus-ring mt-3 inline-flex min-h-9 items-center gap-2 border border-[#DBE6D7] bg-[#F7F6F2] px-3 py-2 text-[13px] font-bold text-[#173F35] transition hover:bg-[#DCE0CF] sm:mt-5 sm:min-h-10 sm:px-4 sm:py-2.5 sm:text-[14px]">
                                        <span className="sm:hidden">Open listings</span><span className="hidden sm:inline">Open listing workspace</span> <ArrowUpRight size={16} aria-hidden="true" />
                                    </Link>
                                </div>
                                <div className="grid grid-cols-2 gap-px bg-[#CBD4C8]" aria-label="Current quality signals">
                                    {[
                                        { id: 'review', label: 'Review queue', value: dataQualitySummary.waitingReview, unavailable: dataQualitySourceErrors.review, surface: 'bg-[#E3EADF]' },
                                        { id: 'duplicates', label: 'Duplicate flags', value: dataQualitySummary.possibleDuplicates, unavailable: dataQualitySourceErrors.review || dataQualitySourceErrors.batches, surface: 'bg-[#F8E6D9]' },
                                        { id: 'catalog', label: 'Catalog checks', value: dataQualitySummary.catalogReview, unavailable: dataQualitySourceErrors.catalog, surface: 'bg-[#E4EDF4]' },
                                        { id: 'batches', label: 'Needs attention', value: dataQualitySummary.needsAttention, unavailable: dataQualitySourceErrors.review || dataQualitySourceErrors.batches, surface: 'bg-[#ECE8F3]' },
                                    ].map(item => (
                                        <button key={item.id} type="button" onClick={() => setDataQualityView(item.id)} aria-label={`Show ${item.label.toLowerCase()}`} className={`dq-metric focus-ring flex min-h-[78px] flex-col items-start justify-center px-3 py-2.5 text-left transition-colors hover:brightness-[0.98] sm:min-h-[132px] sm:px-6 sm:py-3.5 ${item.surface} ${dataQualityView === item.id ? 'shadow-[inset_0_-4px_0_#C86C42]' : ''}`}>
                                            <strong className="text-[24px] font-extrabold leading-none text-[#173F35] sm:text-[35px]" aria-live="polite">{dataQualityLoading ? '…' : item.unavailable ? '—' : item.value}</strong>
                                            <span className="mt-1 text-[12px] font-semibold leading-4 text-[#466155] sm:mt-2 sm:text-[14px]">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </header>

                            {dataQualityError ? (
                                <div role="alert" className="mx-4 mt-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#C85B47] bg-[#FFF0E8] px-4 py-3 text-[14px] text-[#863B2E] sm:mx-7">
                                    <span>{dataQualityError}</span>
                                    <button type="button" onClick={loadDataQualityWorkspace} className="focus-ring inline-flex items-center gap-2 font-bold underline underline-offset-4"><RefreshCw size={15}/> Try again</button>
                                </div>
                            ) : null}
                            <section className="data-quality-work-area mx-2.5 mt-4 sm:mx-7 sm:mt-8" aria-labelledby="quality-work-heading">
                                <div className="data-quality-work-title mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-[#CDD6CC] pb-3 sm:mb-4 sm:gap-3 sm:pb-4">
                                    <div>
                                        <p className="text-[12px] font-bold text-[#C86C42]">01 / WORK QUEUE</p>
                                        <h3 id="quality-work-heading" className="mt-1 text-[21px] font-extrabold leading-[1.2] text-[#173F35] sm:text-[28px]">Choose what to review</h3>
                                    </div>
                                    <span className="hidden text-[13px] text-[#647365] sm:inline">Select a work area below</span>
                                </div>
                                <div className="data-quality-work-grid grid min-w-0 overflow-hidden border border-[#D9E1D7] bg-[#FFFEFB] lg:grid-cols-[290px_minmax(0,1fr)]">
                                    <nav className="dq-tabs grid min-w-0 grid-cols-2 gap-px bg-[#DDE4DB] lg:grid-cols-1 lg:content-start" aria-label="Quality work areas" role="tablist">
                                        {QUALITY_VIEWS.map(view => {
                                            const ViewIcon = view.icon;
                                            const selected = dataQualityView === view.id;
                                            const figure = view.id === 'review' ? dataQualitySummary.waitingReview : view.id === 'duplicates' ? dataQualitySummary.possibleDuplicates : view.id === 'catalog' ? dataQualitySummary.catalogReview : dataQualitySummary.needsAttention;
                                            const missing = view.id === 'review' ? dataQualitySourceErrors.review : view.id === 'catalog' ? dataQualitySourceErrors.catalog : dataQualitySourceErrors.review || dataQualitySourceErrors.batches;
                                            return (
                                                <button key={view.id} type="button" role="tab" aria-selected={selected} aria-controls="data-quality-panel" onMouseEnter={() => setDataQualityView(view.id)} onFocus={() => setDataQualityView(view.id)} onClick={() => setDataQualityView(view.id)} className={`dq-tab focus-ring flex min-h-[76px] min-w-0 flex-col justify-between gap-1.5 px-2.5 py-2.5 text-left transition sm:min-h-[90px] sm:flex-row sm:items-start sm:justify-start sm:gap-2.5 sm:px-4 sm:py-4 lg:min-h-[94px] ${selected ? 'border-l-[4px] border-l-[#C86C42] bg-[#173F35] text-white' : 'border-l-[4px] border-l-transparent bg-[#F1F3ED] text-[#173F35] hover:bg-[#E6EDE3]'}`}>
                                                    <span className="flex w-full items-center justify-between gap-2 sm:hidden">
                                                        <span className={`text-[11px] font-bold ${selected ? 'text-[#DCE0CF]' : 'text-[#A45E3F]'}`}>{view.number}</span>
                                                        <span className={`text-[14px] font-extrabold ${selected ? 'text-white' : 'text-[#173F35]'}`}>{dataQualityLoading ? '…' : missing ? '—' : figure}</span>
                                                    </span>
                                                    <span className={`mt-0.5 hidden size-8 shrink-0 items-center justify-center sm:flex ${selected ? 'bg-white/15 text-white' : view.tint + ' ' + view.text}`}><ViewIcon size={17} aria-hidden="true"/></span>
                                                    <span className="min-w-0 w-full sm:flex-1">
                                                        <span className="dq-tab-title block break-normal text-[13px] font-bold leading-[1.25] sm:text-[15px] sm:leading-5">{view.label}</span>
                                                        <span className={`mt-1 hidden text-[12px] leading-4 sm:block ${selected ? 'text-[#CEDFD0]' : 'text-[#617363]'}`}>{view.short}</span>
                                                    </span>
                                                    <span className={`hidden shrink-0 text-[14px] font-bold sm:inline ${selected ? 'text-white' : 'text-[#173F35]'}`}>{dataQualityLoading ? '…' : missing ? '—' : figure}</span>
                                                </button>
                                            );
                                        })}
                                    </nav>
                                    <div id="data-quality-panel" role="tabpanel" className="min-w-0 bg-[#FFFEFB]">
                                        {QUALITY_VIEWS.filter(view => view.id === dataQualityView).map(view => {
                                            const ViewIcon = view.icon;
                                            const linkTarget = view.id === 'review' || view.id === 'duplicates'
                                                ? (isRootSuperAdmin ? '/admin/host-listings?tab=evidence' : '/admin/product-intelligence')
                                                : view.id === 'catalog'
                                                    ? (isRootSuperAdmin ? '/admin/host-listings?tab=catalog' : '/admin/catalog')
                                                    : (isRootSuperAdmin ? '/admin/host-listings?tab=bulk' : '/admin/bulk-product-review');
                                            const sourceError = view.id === 'review' || view.id === 'duplicates'
                                                ? dataQualitySourceErrors.review
                                                : view.id === 'catalog' ? dataQualitySourceErrors.catalog : dataQualitySourceErrors.batches;
                                            const list = view.id === 'review'
                                                ? (dataQualityWorkspace.drafts || []).map(draft => ({
                                                    id: draft.id, name: dataQualityDraftName(draft),
                                                    meta: draft?.duplicateCandidateProductVersionId ? 'Potential catalog match · compare evidence' : draft?.safetyReviewRequired ? 'Extra safety evidence required' : dataQualityStatusLabel(draft.status),
                                                    badge: draft?.duplicateCandidateProductVersionId ? 'Possible duplicate' : 'Inspect record', warning: !!draft?.duplicateCandidateProductVersionId,
                                                }))
                                                : view.id === 'duplicates'
                                                    ? dataQualityDuplicateDrafts.map(draft => ({id: draft.id, name: dataQualityDraftName(draft), meta: 'Potential match to an existing catalog version', badge: 'Compare', warning: true}))
                                                    : view.id === 'catalog'
                                                        ? (dataQualityWorkspace.versions || []).map(version => ({id: version.id, name: version.displayName || 'Unnamed catalog product', meta: version.gtin ? `Barcode ${version.gtin}` : 'No barcode recorded', badge: 'In review', warning: false}))
                                                        : dataQualityAttentionBatches.map(batch => {
                                                            const issues = Number(batch?.review?.validationIssues || 0) + Number(batch?.review?.needsEvidence || 0);
                                                            const duplicates = Number(batch?.review?.potentialDuplicates || 0);
                                                            return {id: batch.id, name: batch?.organization?.displayName || batch?.sourceFileName || 'Host upload', meta: `${batch.sourceFileName || 'Uploaded batch'} · ${issues} issues · ${duplicates} duplicate flags`, badge: dataQualityStatusLabel(batch.status), warning: issues > 0 || duplicates > 0};
                                                        });
                                            return (
                                                <div key={view.id}>
                                                    <div className={`dq-panel-head flex items-center justify-between gap-2 border-b border-[#DFE5DB] px-3 py-3 sm:gap-3 sm:px-6 sm:py-5 ${view.tint}`} >
                                                        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                                            <span className={`hidden size-10 shrink-0 items-center justify-center bg-white/80 sm:flex ${view.text}`}><ViewIcon size={20} aria-hidden="true"/></span>
                                                            <div className="min-w-0"><p className={`text-[10px] font-bold sm:text-[12px] ${view.text}`}>{view.number} / QUALITY CHECK</p><h4 className="text-[17px] font-bold leading-[1.2] text-[#173F35] sm:text-[22px] sm:leading-6">{view.label}</h4></div>
                                                        </div>
                                                        <Link to={linkTarget} className="focus-ring inline-flex min-h-9 shrink-0 items-center gap-1 border border-[#173F35] bg-[#173F35] px-2.5 py-2 text-[12px] font-bold text-white transition hover:bg-[#235546] sm:min-h-10 sm:gap-2 sm:px-4 sm:text-[14px]"><span className="sm:hidden">Open</span><span className="hidden sm:inline">Open workspace</span> <ArrowUpRight size={15} aria-hidden="true"/></Link>
                                                    </div>
                                                    {dataQualityLoading ? (
                                                        <div role="status" className="flex items-center gap-3 px-5 py-10 text-[15px] text-[#5B7064]"><LoaderCircle className="animate-spin" size={19}/> Loading records…</div>
                                                    ) : sourceError ? (
                                                        <div role="alert" className="px-5 py-6 text-[14px] text-[#923F31]"><p>Records unavailable: {sourceError}</p><button type="button" onClick={loadDataQualityWorkspace} className="focus-ring mt-3 inline-flex items-center gap-2 font-bold underline underline-offset-4"><RefreshCw size={15}/> Retry</button></div>
                                                    ) : list.length > 0 ? (
                                                        <div role="region" aria-label={`${view.label} records`} className="max-h-[340px] divide-y divide-[#E6EBE4] overflow-y-auto overscroll-y-auto sm:max-h-[440px] lg:max-h-[500px]">
                                                            {list.map((item, index) => <QualityReviewRow key={item.id || index} title={item.name} meta={item.meta} badge={item.badge} warning={item.warning} to={linkTarget} />)}
                                                        </div>
                                                    ) : (
                                                        <div className="flex min-h-[140px] items-center gap-3 px-5 py-7 text-[#5B7064]"><CheckCircle2 size={22} className="shrink-0 text-[#50816B]"/><span className="text-[15px] leading-6">{view.id === 'review' ? 'No product drafts in this queue.' : view.id === 'duplicates' ? (dataQualitySummary.possibleDuplicates > 0 ? 'Duplicate flags are reported in uploaded batches. Open Bulk Review to compare them.' : 'No duplicate flags in the loaded records.') : view.id === 'catalog' ? 'No catalog versions awaiting review.' : 'No batch issues in the loaded records.'}</span></div>
                                                    )}
                                                    <div className="border-t border-[#DDE4DB] bg-[#F4F5F0] px-3 py-2.5 text-[12px] text-[#536858] sm:px-6 sm:py-3 sm:text-[13px]"><span className="sm:hidden">{list.length > 0 ? `${list.length} records · Open for full list` : 'Review in linked workspace'}</span><span className="hidden sm:inline">{list.length > 0 ? `Showing ${list.length} records. Open the workspace for the full list.` : 'Review actions stay in the linked workspace.'}</span></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>
                        </main>
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
                      <div className="-mx-2.5 mt-3 min-w-0 bg-[#F7F6F2] sm:mx-0 sm:mt-6">
                        <section aria-labelledby="safety-overview-title" className="border-b border-[#D7DDCF]">
                          <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                            <div className="bg-[#C56C42] px-4 py-5 text-[#202421] sm:px-7 sm:py-7">
                              <p className="text-[12px] font-bold uppercase tracking-[0.07em]">Safety workspace</p>
                              <h2 id="safety-overview-title" className="mt-1.5 text-[23px] font-bold leading-[1.18] tracking-tight sm:text-[29px]">Reports. Cases. Decisions.</h2>
                            </div>
                            <div className="grid grid-cols-3 bg-[#D7DDCF]" aria-label="Safety queues">
                              {[
                                ['Review cases', trustSafetyQueueState.reviews.error ? '—' : trustSafetyQueueState.reviews.total],
                                ['Incidents', trustSafetyQueueState.incidents.error ? '—' : trustSafetyQueueState.incidents.total],
                                ['Support', trustSafetyQueueState.support.error ? '—' : trustSafetyQueueState.support.total],
                              ].map(([label, value], index) => (
                                <div key={label} className={`flex min-w-0 flex-col justify-center px-2 py-4 text-center sm:px-4 ${index ? 'border-l border-[#BDC6B8]' : ''}`}>
                                  <strong className="text-[24px] font-bold leading-none text-[#173F35] sm:text-[34px]">{value}</strong>
                                  <span className="mt-1.5 text-[12px] font-semibold leading-4 text-[#202421] sm:text-[13px]">{label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>

                        <nav aria-label="Safety review workspaces" className="grid grid-cols-3 bg-[#202421] px-1.5 pt-1.5 sm:flex sm:gap-1.5 sm:px-2.5 sm:pt-2.5">
                          {[
                            ['reports', 'Listing reports', 'Reports'],
                            ['cases', 'Cases & support', 'Cases'],
                            ['status', 'Platform status', 'Status'],
                          ].map(([value, desktopLabel, mobileLabel]) => (
                            <button key={value} type="button" onClick={() => setTrustSafetyView(value)} aria-current={trustSafetyView === value ? 'page' : undefined}
                              className={`focus-ring min-w-0 border-b-[3px] px-2 py-3 text-center text-[13px] font-bold leading-4 transition-colors sm:min-w-[165px] sm:px-5 sm:py-3.5 sm:text-[15px] ${trustSafetyView === value ? 'border-[#C56C42] bg-[#F7F6F2] text-[#173F35]' : 'border-transparent text-[#F7F6F2] hover:bg-[#173F35]'}`}>
                              <span className="sm:hidden">{mobileLabel}</span><span className="hidden sm:inline">{desktopLabel}</span>
                            </button>
                          ))}
                        </nav>

                        <section className={trustSafetyView === 'reports' ? 'block' : 'hidden'} aria-labelledby="safety-reports-heading">
                          <div className="border-b border-[#D7DDCF] px-4 py-4 sm:px-6 sm:py-5">
                            <h3 id="safety-reports-heading" className="text-[20px] font-bold text-[#202421] sm:text-[24px]">Listing reports</h3>
                          </div>
                          <AdminDsaReportsPanel canDecide={isRootSuperAdmin || hasAdminPermission('trust_safety.mutate')} />
                        </section>

                        <section className={trustSafetyView === 'cases' ? 'block' : 'hidden'} aria-labelledby="safety-cases-heading">
                          <div className="border-b border-[#D7DDCF] px-4 py-4 sm:px-6 sm:py-5">
                            <h3 id="safety-cases-heading" className="text-[20px] font-bold text-[#202421] sm:text-[24px]">Cases &amp; support</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 border-b border-[#D7DDCF] px-3 py-3 sm:px-6" aria-label="Case scope">
                            <button type="button" aria-pressed={trustSafetyScope === 'all'}
                              onClick={() => { setTrustSafetyScope('all'); setSelectedReviewCase(null); setSelectedIncident(null); setSelectedSupportCase(null); }}
                              className={`focus-ring px-3 py-2 text-[13px] font-bold ${trustSafetyScope === 'all' ? 'bg-[#173F35] text-[#F7F6F2]' : 'border border-[#D7DDCF] text-[#173F35]'}`}>All accessible</button>
                            <button type="button" aria-pressed={trustSafetyScope === 'trust_safety'}
                              onClick={() => { setTrustSafetyScope('trust_safety'); setSelectedReviewCase(null); setSelectedIncident(null); setSelectedSupportCase(null); }}
                              className={`focus-ring px-3 py-2 text-[13px] font-bold ${trustSafetyScope === 'trust_safety' ? 'bg-[#173F35] text-[#F7F6F2]' : 'border border-[#D7DDCF] text-[#173F35]'}`}>Safety only</button>
                          </div>
                          <div className="grid grid-cols-3 border-b border-[#D7DDCF] bg-[#D7DDCF] p-1.5" aria-label="Case categories">
                            {[
                              ['reviews', 'Review cases', trustSafetyQueueState.reviews.total, trustSafetyQueueState.reviews.error],
                              ['incidents', 'Incidents', trustSafetyQueueState.incidents.total, trustSafetyQueueState.incidents.error],
                              ['support', 'Support', trustSafetyQueueState.support.total, trustSafetyQueueState.support.error],
                            ].map(([value, label, count, failed]) => (
                              <button key={value} type="button" aria-pressed={trustSafetyActiveQueue === value} onClick={() => setTrustSafetyActiveQueue(value)}
                                className={`focus-ring flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[12px] font-bold leading-4 sm:flex-row sm:justify-center sm:gap-3 sm:text-sm ${trustSafetyActiveQueue === value ? 'bg-[#173F35] text-[#F7F6F2]' : 'bg-[#F7F6F2] text-[#202421]'}`}>
                                <span>{label}</span><span className="tabular-nums">{failed ? '—' : count}</span>
                              </button>
                            ))}
                          </div>
                          <div className={trustSafetyActiveQueue === 'reviews' ? 'block' : 'hidden'}>
                            <TrustSafetyWorkQueue title="Review cases" subtitle="Reports needing a decision"
                              icon={FileWarning} tone="clay" items={reviewCases}
                              total={trustSafetyQueueState.reviews.total} error={trustSafetyQueueState.reviews.error}
                              selectedId={selectedReviewCase?.id}
                              onSelect={(item) => { setSelectedReviewCase(item); setSelectedIncident(null); setSelectedSupportCase(null); }}
                              onMore={() => loadMoreTrustSafety('reviews')} loadingMore={trustSafetyMore === 'reviews'} />
                          </div>
                          <div className={trustSafetyActiveQueue === 'incidents' ? 'block' : 'hidden'}>
                            <TrustSafetyWorkQueue title="Incidents" subtitle="Safety issues to investigate"
                              icon={ShieldAlert} tone="sage" items={incidents}
                              total={trustSafetyQueueState.incidents.total} error={trustSafetyQueueState.incidents.error}
                              selectedId={selectedIncident?.id}
                              onSelect={(item) => { setSelectedIncident(item); setSelectedReviewCase(null); setSelectedSupportCase(null); }}
                              onMore={() => loadMoreTrustSafety('incidents')} loadingMore={trustSafetyMore === 'incidents'} />
                          </div>
                          <div className={trustSafetyActiveQueue === 'support' ? 'block' : 'hidden'}>
                            <TrustSafetyWorkQueue title="Support cases" subtitle="Requests needing a reply"
                              icon={UsersRound} tone="forest" items={supportCases}
                              total={trustSafetyQueueState.support.total} error={trustSafetyQueueState.support.error}
                              selectedId={selectedSupportCase?.id}
                              onSelect={(item) => { setSelectedSupportCase(item); setSelectedReviewCase(null); setSelectedIncident(null); }}
                              onMore={() => loadMoreTrustSafety('support')} loadingMore={trustSafetyMore === 'support'} />
                          </div>
                        </section>

                        <section className={trustSafetyView === 'status' ? 'block' : 'hidden'} aria-labelledby="safety-platform-title">
                          <div className="border-b border-[#D7DDCF] px-4 py-4 sm:px-6 sm:py-5">
                            <h3 id="safety-platform-title" className="text-[20px] font-bold text-[#202421] sm:text-[24px]">Platform status</h3>
                          </div>
                          {commandCenterError ? (
                            <p role="alert" className="border-l-4 border-[#C56C42] px-4 py-4 text-sm text-[#202421]">Status unavailable: {commandCenterError}. Try Refresh.</p>
                          ) : metricEntries.length ? (
                            <div className="grid grid-cols-2 gap-px bg-[#D7DDCF] sm:grid-cols-4">
                              {metricEntries.map(([label, value, MetricIcon]) => (
                                <div key={label} className="flex min-w-0 items-center justify-between gap-2 bg-[#F7F6F2] px-4 py-4 sm:px-5 sm:py-5">
                                  <div className="min-w-0">
                                    <p className="text-[25px] font-bold leading-none text-[#173F35] sm:text-[31px]">{value}</p>
                                    <p className="mt-1.5 text-[13px] font-semibold leading-5 text-[#202421]">{label}</p>
                                  </div>
                                  <MetricIcon size={18} className="shrink-0 text-[#C56C42]" aria-hidden="true" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-4 py-4 text-sm text-[#202421]">No status data available for this role.</p>
                          )}
                          <details className="border-t border-[#D7DDCF] px-4 py-4 sm:px-6">
                            <summary className="focus-ring cursor-pointer text-[14px] font-bold text-[#173F35]">Safety decision rules</summary>
                            <div className="mt-3 grid gap-3 text-[14px] leading-6 text-[#202421] sm:grid-cols-2">
                              <p className="border-l-[3px] border-[#C56C42] pl-3">Unknown allergen information must never be treated as safe.</p>
                              <p className="border-l-[3px] border-[#173F35] pl-3">Changes require the right permission, evidence and a recorded reason. Use EPANTRY rather than editing database records.</p>
                            </div>
                          </details>
                        </section>
                      </div>
                    ) : null}

                    {config.domain &&
                    section !== 'dataQuality' &&
                    section !== 'recipeReview' && section !== 'trustSafety' ? (
                        <div id={section === 'policy' ? 'policy-related-queues' : undefined} className={`mt-5 grid gap-5 xl:grid-cols-3 ${section === 'policy' && !reviewCases.length && !incidents.length && !supportCases.length ? 'policy-queues-empty' : ''}`}>
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
                        <section className={section === 'trustSafety' ? '-mx-2.5 mt-0 border-t border-stone-200 bg-white px-3 py-4 shadow-none sm:mx-0 sm:mt-5 sm:rounded-[24px] sm:border sm:p-5 sm:shadow-sm' : 'mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm'}>
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
                        <section className={section === 'trustSafety' ? '-mx-2.5 mt-0 border-t border-stone-200 bg-white px-3 py-4 shadow-none sm:mx-0 sm:mt-5 sm:rounded-[24px] sm:border sm:p-5 sm:shadow-sm' : 'mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm'}>
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
                        <section className={section === 'trustSafety' ? '-mx-2.5 mt-0 border-t border-stone-200 bg-white px-3 py-4 shadow-none sm:mx-0 sm:mt-5 sm:rounded-[24px] sm:border sm:p-5 sm:shadow-sm' : 'mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm'}>
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
                        <section className={section === 'trustSafety' ? '-mx-2.5 mt-0 border-t border-stone-200 bg-white px-3 py-4 shadow-none sm:mx-0 sm:mt-5 sm:rounded-[24px] sm:border sm:p-5 sm:shadow-sm' : 'mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm'}>
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
  
  
                    {section !== 'dataQuality' && section !== 'recipeReview' && section !== 'policy' && section !== 'trustSafety' && section !== 'aiQuality' && section !== 'users' ? (
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