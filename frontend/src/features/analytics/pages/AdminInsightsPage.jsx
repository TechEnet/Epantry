import { useCallback, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight, BarChart3, FlaskConical, RefreshCw, Search, ShoppingBasket,
} from 'lucide-react';

import AdminShell from '../../admin/components/AdminShell';
import { useAdmin } from '../../admin/context/AdminContext';
import AdminAnalyticsPage from './AdminAnalyticsPage';
import AdminWebsiteAnalyticsPage from '../../websiteAnalytics/pages/AdminWebsiteAnalyticsPage';

// Local styles are intentional. Global utility overrides elsewhere in EPANTRY
// can turn light utility backgrounds dark without updating their text colours.
const insightsStyles = `
.ai-insights{--ai-forest:#173F35;--ai-sage:#DCE0CF;--ai-paper:#F7F6F2;--ai-clay:#C86C42;width:100%;min-width:0;color:#202421}
.ai-insights *{box-sizing:border-box}
.ai-insights button{font:inherit;cursor:pointer}
.ai-insights button:focus-visible,.ai-insights summary:focus-visible{outline:3px solid #C86C42;outline-offset:3px}
.ai-insights .ai-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;min-width:0}
.ai-insights .ai-tab{position:relative;display:flex;align-items:center;gap:13px;text-align:left;min-width:0;min-height:100px;padding:17px 16px;border:1px solid #D5DDD2;border-radius:12px;background:#FBFAF7!important;color:#173F35!important;box-shadow:0 1px 1px rgba(18,56,42,.03);transition:background .18s,transform .18s,border-color .18s}
.ai-insights .ai-tab:hover:not([aria-selected='true']){background:#E8EDE4!important;border-color:#B1C5B4;transform:translateY(-2px)}
.ai-insights .ai-tab[aria-selected='true']{background:#173F35!important;color:#F7F6F2!important;border-color:#173F35;box-shadow:0 6px 16px rgba(23,63,53,.13)}
.ai-insights .ai-tab[aria-selected='true']:before{content:'';position:absolute;top:0;bottom:0;left:0;width:4px;border-radius:12px 0 0 12px;background:#C86C42}
.ai-insights .ai-tab-icon{display:grid;place-items:center;flex:none;width:41px;height:41px;border-radius:11px;background:#DCE0CF!important;color:#173F35!important}
.ai-insights .ai-tab[aria-selected='true'] .ai-tab-icon{background:#315F50!important;color:#F7F6F2!important}
.ai-insights .ai-tab-copy{display:block;flex:1;min-width:0}
.ai-insights .ai-tab-label{display:block;font-size:16px;line-height:1.3;font-weight:750;color:inherit!important}
.ai-insights .ai-tab-detail{display:block;margin-top:5px;font-size:13px;line-height:1.3;color:#5E6B60!important;font-weight:500}
.ai-insights .ai-tab[aria-selected='true'] .ai-tab-detail{color:#C8DED0!important}
.ai-insights .ai-tab-arrow{flex:none;color:#315C4C!important;align-self:flex-start}
.ai-insights .ai-tab[aria-selected='true'] .ai-tab-arrow{color:#F7F6F2!important}
.ai-insights .ai-toolbar{display:flex;justify-content:flex-end;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 0 14px;margin-top:10px;border-bottom:1px solid #D4DED4}
.ai-insights .ai-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ai-insights .ai-range-label{font-size:13px;color:#53675B!important;font-weight:600}
.ai-insights .ai-periods{display:flex;align-items:center;gap:3px;padding:3px;background:#E9EFE7!important;border:1px solid #D3DED3;border-radius:9px}
.ai-insights .ai-period{min-height:40px;padding:8px 13px;border:0;border-radius:6px;font-size:14px;font-weight:700;color:#355647!important;background:transparent!important}
.ai-insights .ai-period[aria-pressed='true']{background:#173F35!important;color:#fff!important}
.ai-insights .ai-refresh{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px 16px;background:#F7F6F2!important;color:#173F35!important;border:1px solid #B9CBBB;border-radius:9px;font-size:14px;font-weight:700}
.ai-insights .ai-refresh:hover{background:#E8EEE5!important}
.ai-insights .ai-view{width:100%;min-width:0;margin-top:22px}
.ai-insights .ai-view[hidden]{display:none!important}
.ai-insights .ai-coverage{margin:25px 0 0;padding:15px 0;border-top:1px solid #D4DDD3;color:#4E6255!important;font-size:14px;line-height:1.6}
.ai-insights .ai-coverage summary{display:inline-flex;align-items:center;cursor:pointer;color:#173F35!important;font-weight:700}
.ai-insights .ai-coverage p{max-width:900px;margin:10px 0 0}
.ai-insights .ai-no-access{margin-top:22px;padding:24px;background:#F7F6F2!important;border:1px solid #D7E0D6;border-radius:12px;font-size:16px;color:#465B4F}
@media(max-width:1140px){.ai-insights .ai-tabs{gap:10px}.ai-insights .ai-tab{padding:14px 12px;gap:9px}.ai-insights .ai-tab-icon{width:36px;height:36px}.ai-insights .ai-tab-detail{font-size:12.5px}}
@media(max-width:850px){.ai-insights .ai-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-insights .ai-tab{min-height:88px;padding:13px}.ai-insights .ai-tab-detail{font-size:13px}}
@media(max-width:520px){
/* On mobile the four reports are unmistakably tappable without becoming four tall cards. */
.ai-insights .ai-tabs{gap:8px}
.ai-insights .ai-tab{min-height:58px;align-items:center;flex-wrap:nowrap;gap:9px;padding:10px;border-radius:11px;box-shadow:none}
.ai-insights .ai-tab-icon{width:31px;height:31px;border-radius:8px}
.ai-insights .ai-tab-icon svg{width:17px;height:17px}
.ai-insights .ai-tab-copy{flex-basis:auto}
.ai-insights .ai-tab-label{font-size:14px;line-height:1.25;overflow-wrap:anywhere}
.ai-insights .ai-tab-detail,.ai-insights .ai-tab-arrow{display:none}
.ai-insights .ai-tab[aria-selected='true']{box-shadow:0 3px 9px rgba(23,63,53,.13)}
.ai-insights .ai-toolbar{align-items:center;margin-top:7px;padding:9px 0 10px}
.ai-insights .ai-controls{width:100%;justify-content:space-between;gap:7px;flex-wrap:nowrap}
.ai-insights .ai-range-label{display:none}
.ai-insights .ai-periods{gap:2px;padding:2px;flex:none}
.ai-insights .ai-period{min-height:40px;padding:7px 13px;font-size:14px}
.ai-insights .ai-refresh{min-height:44px;padding:8px 12px;font-size:14px;white-space:nowrap}
.ai-insights .ai-view{margin-top:11px}
.ai-insights .ai-coverage{margin-top:11px;padding-top:11px;font-size:13px;line-height:1.5}
.ai-insights .ai-coverage p{margin-top:7px}
}
@media(prefers-reduced-motion:reduce){.ai-insights .ai-tab{transition:none!important;transform:none!important}}
`;

const TAB_META = {
  overview: { label: 'Overview', detail: 'Traffic & audience', icon: BarChart3 },
  demand: { label: 'Customer demand', detail: 'Searches & locations', icon: Search },
  shopping: { label: 'Shopping insights', detail: 'Products & paid orders', icon: ShoppingBasket },
  experiments: { label: 'Experiments', detail: 'Run & review tests', icon: FlaskConical },
};

export default function AdminInsightsPage() {
  const { isRootSuperAdmin, hasAdminPermission } = useAdmin();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [days, setDays] = useState(30);
  const [refreshToken, setRefreshToken] = useState(0);

  const canReadActivity = ['admin.dashboard.read', 'admin.audit.read', 'marketplace.read', 'trust_safety.read'].some(hasAdminPermission);
  const canReadDemand = ['admin.dashboard.read', 'marketplace.read', 'catalog.read'].some(hasAdminPermission);
  const canReadExperiments = ['admin.dashboard.read', 'admin.audit.read'].some(hasAdminPermission);

  const permittedTabs = useMemo(() => [
    ...(isRootSuperAdmin ? ['overview'] : []),
    ...((canReadActivity || canReadDemand) ? ['demand'] : []),
    ...(isRootSuperAdmin ? ['shopping'] : []),
    ...((canReadExperiments || isRootSuperAdmin) ? ['experiments'] : []),
  ], [isRootSuperAdmin, canReadActivity, canReadDemand, canReadExperiments]);

  const desiredTab = params.get('tab');
  const hashTarget = location.hash.toLowerCase();
  const fallback = (hashTarget.includes('experiment') || hashTarget.includes('create-')) ? 'experiments'
    : (hashTarget.includes('demand') || hashTarget.includes('activity') || hashTarget.includes('quality-')) ? 'demand'
      : permittedTabs[0];
  const activeTab = permittedTabs.includes(desiredTab) ? desiredTab : (permittedTabs.includes(fallback) ? fallback : permittedTabs[0]);

  const chooseTab = useCallback((tab) => {
    if (!permittedTabs.includes(tab)) return;
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set('tab', tab);
      return next;
    });
  }, [setParams, permittedTabs]);

  const handleTabKeyDown = useCallback((event, index) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? permittedTabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + permittedTabs.length) % permittedTabs.length;
    const nextTab = permittedTabs[nextIndex];
    chooseTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`ai-tab-${nextTab}`)?.focus());
  }, [chooseTab, permittedTabs]);

  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);
  const available = Boolean(permittedTabs.length);
  const showPeriod = activeTab !== 'experiments';

  return (
    <AdminShell flushTop title="Analytics & Insights" description="" showWorkspaceBadge={false} mobileStackHeader>
      <style>{insightsStyles}</style>
      <div className="ai-insights pb-6">
        {available ? (
          <>
            <nav className="ai-tabs" role="tablist" aria-label="Analytics reports">
              {permittedTabs.map((tab, index) => {
                const { label, detail, icon: Icon } = TAB_META[tab];
                return (
                  <button type="button" key={tab} id={`ai-tab-${tab}`} role="tab" className="ai-tab"
                    aria-selected={activeTab === tab} aria-controls={tab === 'overview' || tab === 'shopping' ? 'ai-content-website' : 'ai-content-customer'}
                    tabIndex={activeTab === tab ? 0 : -1} onClick={() => chooseTab(tab)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}>
                    <span className="ai-tab-icon"><Icon size={20} aria-hidden="true" /></span>
                    <span className="ai-tab-copy"><span className="ai-tab-label">{label}</span><span className="ai-tab-detail">{detail}</span></span>
                    <ArrowUpRight className="ai-tab-arrow" size={17} aria-hidden="true" />
                  </button>
                );
              })}
            </nav>
            <div className="ai-toolbar">
              <div className="ai-controls">
                {showPeriod && (
                  <><span className="ai-range-label">Period</span>
                  <div className="ai-periods" role="group" aria-label="Reporting period">
                    {[7, 30, 90].map((period) => (
                      <button key={period} type="button" className="ai-period" aria-pressed={days === period}
                        onClick={() => setDays(period)}>{period}d</button>
                    ))}
                  </div></>
                )}
                <button type="button" className="ai-refresh" onClick={refresh} aria-label="Refresh analytics report">
                  <RefreshCw size={16} aria-hidden="true" /> Refresh
                </button>
              </div>
            </div>
            {isRootSuperAdmin && (
              <div id="ai-content-website" role="tabpanel"
                aria-labelledby={`ai-tab-${activeTab === 'shopping' ? 'shopping' : 'overview'}`}
                hidden={activeTab !== 'overview' && activeTab !== 'shopping'} className="ai-view">
                <AdminWebsiteAnalyticsPage embedded activeView={activeTab} reportDays={days} refreshToken={refreshToken} />
              </div>
            )}
            {(canReadActivity || canReadDemand || canReadExperiments || isRootSuperAdmin) && (
              <div id="ai-content-customer" role="tabpanel"
                aria-labelledby={`ai-tab-${activeTab === 'experiments' ? 'experiments' : 'demand'}`}
                hidden={activeTab !== 'demand' && activeTab !== 'experiments'} className="ai-view">
                <AdminAnalyticsPage embedded activeView={activeTab} reportDays={days} refreshToken={refreshToken} />
              </div>
            )}
            <details className="ai-coverage">
              <summary>How these reports are counted</summary>
              <p>Website traffic reflects visitors who allowed Analytics cookies. Customer Demand records signed-in customer searches. Paid orders come from verified payment records. These totals measure different groups and should not be added together.</p>
            </details>
          </>
        ) : (
          <div className="ai-no-access" role="status">Your admin permissions do not include these reports.</div>
        )}
      </div>
    </AdminShell>
  );
}
