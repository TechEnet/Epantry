import {
  ArrowRight,
  BarChart3,
  Beaker,
  BellRing,
  CheckCircle2,
  Clock3,
  MapPinned,
  RefreshCw,
  Search,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import AdminShell from "../../admin/components/AdminShell";
import { useAdmin } from "../../admin/context/AdminContext";
import {
  getAdminSearchDemand,
  getAdminGovernanceErrorMessage,
} from "../../adminGovernance/services/adminGovernance.service";
import {
  changeExperimentStatus,
  createExperimentDefinition,
  getAdminAnalyticsDashboard,
  getAnalyticsErrorMessage,
  listExperimentDefinitions,
} from "../services/analytics.service";

/*
 * EPANTRY Analytics & Customer Demand
 * All presentation styles are scoped to this page. This intentionally avoids
 * legacy global hexadecimal utility overrides that invert light backgrounds.
 * Data, permission checks and experiment actions still use existing services.
 */
const pageStyles = `
/* EPANTRY admin analytics - page-scoped palette and section layout */
.ei-page {
  --ei-green:#173F35; --ei-ink:#202421; --ei-muted:#58645D;
  --ei-stone:#F7F6F2; --ei-sage:#DCE0CF; --ei-clay:#C86C42;
  width:100%;min-width:0;display:flex;flex-direction:column;gap:30px;
  padding:0 0 22px;color:var(--ei-ink);font-size:16px;
}
.ei-page * {box-sizing:border-box}
.ei-page button {cursor:pointer}
.ei-page button:disabled {cursor:not-allowed;opacity:.58}
.ei-page :is(button,input,select,textarea):focus-visible {outline:2px solid #173F35;outline-offset:3px}
.ei-page p,.ei-page h2,.ei-page h3 {margin:0}
.ei-page h2 {font-size:26px!important;line-height:1.22!important;font-weight:750!important;letter-spacing:-.035em!important;color:#173F35!important}
.ei-hero {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:222px;border:1px solid #D8E1D5;border-radius:15px;overflow:hidden;background:#F7F6F2!important}
.ei-hero-lead {min-width:0;position:relative;display:flex;flex-direction:column;justify-content:center;padding:30px 34px;background:#173F35!important;color:#F7F6F2!important}
.ei-eyebrow {display:flex;align-items:center;gap:10px;font-size:12px;font-weight:800;letter-spacing:.075em;text-transform:uppercase}
.ei-hero-lead .ei-eyebrow {color:#DCE0CF!important}
.ei-eyebrow:before {content:"";height:2px;width:20px;background:#C86C42;flex-shrink:0}
.ei-hero h2 {font-size:clamp(30px,2.65vw,38px)!important;max-width:500px;line-height:1.14!important;color:#F7F6F2!important;margin:15px 0 10px;font-weight:700!important}
.ei-hero-lead > p:last-child {font-size:16px;line-height:1.55;color:#DDE9DF!important}
.ei-hero-nav {background:#E8EDE5!important;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:22px 24px;align-content:center;gap:0}
.ei-nav-item {border:0;border-bottom:1px solid #C9D5CB;background:transparent!important;min-width:0;display:flex;align-items:center;gap:13px;text-align:left;padding:20px 12px;color:#173F35!important;transition:background .16s ease}
.ei-nav-item:nth-last-child(-n + 2) {border-bottom:0}
.ei-nav-item:hover,.ei-nav-item:focus-visible {background:#DCE0CF!important}
.ei-nav-num {font-size:14px;line-height:1.2;font-weight:800;color:#C86C42!important;flex:0 0 auto}
.ei-nav-title {flex:1;min-width:0;font-size:16px;font-weight:700;line-height:1.35;color:#173F35!important}
.ei-nav-item svg {flex-shrink:0;color:#3E6354}
/* Each work area is a substantial horizontal section - not a row of small cards. */
.ei-section {scroll-margin-top:96px;min-width:0;overflow:hidden;background:#FCFBF8!important;border:1px solid #D9E1D8;border-radius:15px}
.ei-section-head {margin:0!important;min-height:108px;display:flex;align-items:center;justify-content:space-between;gap:22px;padding:23px 28px;border-bottom:1px solid #D7E4D7;background:#E9F1E9!important}
.ei-section-heading {min-width:0}
.ei-section-heading .ei-index {color:#C86C42!important;font-size:13px;font-weight:800;line-height:1.4;letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px!important}
.ei-section-heading > p:last-child:not(.ei-index) {margin-top:7px!important;color:#55635A!important;font-size:15px;line-height:1.5}
.ei-section-body {min-width:0;padding:24px 28px 28px;background:#FCFBF8!important}
.ei-section-with-clay {border-color:#E7D6C7}
.ei-section-with-clay > .ei-section-head {background:#F7EADF!important;border-bottom-color:#E8D8CA}
.ei-section-with-sage {border-color:#DDD4E8}
.ei-section-with-sage > .ei-section-head {background:#F0ECF6!important;border-bottom-color:#DDD4E8}
.ei-section-with-sage > .ei-section-head h2 {color:#4D3C62!important}
.ei-count-pill {font-size:14px;line-height:1.2;font-weight:750;flex-shrink:0;padding:8px 13px;border-radius:40px;color:#173F35!important;background:#FCFBF8!important;border:1px solid #CFDAD0;white-space:nowrap}
/* Activity metrics */
.ei-stat-grid {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#F2F6F0!important;border:1px solid #D8E2D8;border-radius:10px;overflow:hidden}
.ei-stat {min-width:0;min-height:134px;background:transparent!important;border-right:1px solid #D7E2D7;padding:22px 23px}
.ei-stat:first-child {background:#DCE0CF!important}
.ei-stat:last-child {border-right:0}
.ei-stat-label {display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:15px;font-weight:750;line-height:1.35;color:#315747!important}
.ei-stat-label svg {color:#406E59;flex-shrink:0}
.ei-stat-value {margin-top:14px!important;font-size:38px;letter-spacing:-.04em;font-weight:750;line-height:1.1;color:#173F35!important;overflow-wrap:anywhere}
.ei-stat-meta {font-size:14px;color:#57665C!important;margin-top:6px!important}
.ei-signals {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:#F5F6F0!important;border:1px solid #DDE5D9;border-radius:10px;overflow:hidden;margin-top:16px;scroll-margin-top:96px}
.ei-signal {min-width:0;min-height:95px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 22px;border-right:1px solid #DDE5D9}
.ei-signal:last-child {border-right:0}
.ei-signal-title {font-size:15px;line-height:1.4;font-weight:750;color:#315747!important}
.ei-signal-note {font-size:13px;line-height:1.45;color:#647269!important;margin-top:4px!important}
.ei-signal-number {font-size:29px;line-height:1;font-weight:750;color:#173F35!important;white-space:nowrap}
/* Demand: restore the original blue feature with LEFT vertical navigation + RIGHT results */
.ei-section#customer-demand {border-color:#CEDFE9}
.ei-section#customer-demand > .ei-section-head {background:#E4F1F8!important;border-bottom-color:#D2E4EC}
.ei-section#customer-demand > .ei-section-head h2 {color:#20516C!important}
.ei-section#customer-demand > .ei-section-head .ei-index {color:#2D6683!important}
.ei-section#customer-demand > .ei-section-body {background:#FBFCFC!important}
.ei-demand-overview {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#F0F8FB!important;border:1px solid #D1E2EB;border-radius:10px;overflow:hidden}
.ei-demand-overview .ei-stat {min-height:124px;background:transparent!important;border-right-color:#D3E4ED}
.ei-demand-overview .ei-stat:first-child {background:#DEEDF4!important}
.ei-demand-overview .ei-stat:last-child {border-right:0}
.ei-demand-overview .ei-stat-label,.ei-demand-overview .ei-stat-label svg {color:#285D77!important}
.ei-demand-overview .ei-stat-value {color:#234D67!important;font-size:26px;line-height:1.2;overflow-wrap:anywhere}
.ei-demand-freshness {display:flex;align-items:center;flex-wrap:wrap;gap:9px 20px;padding:13px 3px 0;color:#315B70!important;font-size:14px;line-height:1.4}
.ei-demand-freshness span {display:inline-flex;align-items:center;gap:6px;min-width:0}
.ei-demand-freshness strong {color:#21546B!important;font-weight:750}
.ei-demand-freshness button {margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:7px 12px;border-radius:7px;border:1px solid #C7DCE7;background:#fff!important;color:#23536B!important;font-size:13px;font-weight:750}
.ei-demand-freshness button:hover:not(:disabled) {background:#E8F2F8!important}
.ei-demand-freshness button:disabled {opacity:.6}
.ei-demand-browser {display:grid;grid-template-columns:256px minmax(0,1fr);align-items:stretch;gap:16px;margin-top:20px;min-width:0}
.ei-demand-switcher {min-width:0;display:flex;flex-direction:column;gap:10px;padding:16px;background:#E8F2F8!important;border:1px solid #D5E4EC;border-radius:12px;overflow:visible;margin:0}
.ei-tab {display:flex;align-items:center;gap:12px;min-width:0;min-height:58px;padding:12px 14px;border:1px solid transparent;border-radius:9px;text-align:left;color:#315B70!important;background:#F9FCFD!important;font-size:15px;font-weight:750;line-height:1.3;transition:background .15s ease}
.ei-tab span:nth-child(2) {flex:1;min-width:0}
.ei-tab[aria-selected=true] {background:#245D78!important;color:#fff!important;border-color:#245D78}
.ei-tab:hover:not([aria-selected=true]) {background:#DAEAF2!important}
.ei-tab-count {border-radius:20px;background:#DDEBF2!important;color:#27586F!important;min-width:23px;padding:3px 7px;text-align:center;font-size:12px;line-height:1.3;font-weight:750;flex-shrink:0}
.ei-tab[aria-selected=true] .ei-tab-count {background:#F7FBFC!important;color:#245D78!important}
.ei-demand-panel {min-width:0;overflow:hidden;display:flex;flex-direction:column;background:#FFF!important;border:1px solid #D5E5EB;border-radius:12px}
.ei-demand-panel-head {display:flex;align-items:center;justify-content:space-between;gap:15px;min-height:60px;background:#F4F9FB!important;border-bottom:1px solid #DCE9EE;padding:15px 20px}
.ei-demand-panel-head h3 {font-size:20px!important;font-weight:750!important;line-height:1.2!important;color:#225772!important}
.ei-demand-panel-head span {font-size:13px;color:#567589!important;font-weight:650;white-space:nowrap}
.ei-results {background:#fff!important;padding:0 20px;min-width:0;min-height:240px;max-height:386px;overflow:auto}
.ei-result {min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:15px;border-bottom:1px solid #E6EBEA;padding:16px 0}
.ei-result:last-child {border-bottom:0}
.ei-result-name {font-size:16px;font-weight:700;line-height:1.35;color:#203F33!important;overflow-wrap:anywhere}
.ei-result-meta {font-size:14px;line-height:1.4;color:#65756B!important;margin-top:4px!important;overflow-wrap:anywhere}
.ei-result-count {font-size:17px;line-height:1.35;font-weight:750;white-space:nowrap;color:#205A74!important}
.ei-empty {font-size:15px;line-height:1.5;color:#63736B!important;padding:28px 12px}
/* Experiments form */
.ei-editor {display:grid;grid-template-columns:252px minmax(0,1fr);border:1px solid #E5D6C9;border-radius:11px;overflow:hidden;background:#FEFCFA!important;min-width:0}
.ei-editor-side {padding:30px 25px;background:#F4E0D4!important;border-right:1px solid #E8D7C9}
.ei-editor-side .ei-symbol {display:grid;place-items:center;width:48px;height:48px;margin-bottom:18px;background:#FFFAF5!important;color:#A85838!important;border-radius:11px}
.ei-editor-side strong {display:block;font-size:20px;line-height:1.3;font-weight:750;color:#173F35!important}
.ei-editor-side p {font-size:15px;line-height:1.55;color:#685C54!important;margin-top:9px!important}
.ei-fields {min-width:0;padding:26px 28px 27px;background:#FEFCFA!important}
.ei-form-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:19px 22px}
.ei-field {display:block;min-width:0}
.ei-field span {display:block;margin-bottom:8px;font-size:15px;font-weight:700;line-height:1.3;color:#355847!important}
.ei-field-wide {grid-column:1/-1}
.ei-input {display:block;min-width:0;width:100%;min-height:48px;padding:11px 13px;background:#fff!important;border:1px solid #D8DED6!important;color:#202421!important;border-radius:7px!important;font:inherit;font-size:15px!important;line-height:1.45}
.ei-input::placeholder {color:#89918B!important}
.ei-textarea {min-height:108px;resize:vertical}
.ei-form-actions {display:flex;justify-content:flex-end;margin-top:21px}
.ei-primary,.ei-secondary {min-height:45px;display:inline-flex;align-items:center;justify-content:center;gap:9px;font-size:15px;font-weight:700;border-radius:7px;transition:background .15s ease,transform .15s ease}
.ei-primary {padding:10px 22px;background:#173F35!important;border:1px solid #173F35!important;color:#fff!important}
.ei-primary:hover:not(:disabled) {background:#285847!important;transform:translateY(-1px)}
.ei-secondary {padding:10px 16px;background:#F7F6F2!important;border:1px solid #CAD5CA;color:#173F35!important}
.ei-secondary:hover:not(:disabled) {background:#E9EEE7!important}
.ei-warning {background:#FFF2DC!important;border-color:#E8D1AA!important;color:#784E26!important}
/* Experiment management */
.ei-test-list {overflow:hidden;background:#FDFCFE!important;border:1px solid #E2DCE9;border-radius:10px}
.ei-test {display:flex;align-items:center;justify-content:space-between;gap:20px;padding:21px 24px;border-bottom:1px solid #E6E0EC}
.ei-test:last-child {border-bottom:0}
.ei-test-name {font-size:17px;font-weight:750;line-height:1.35;color:#173F35!important}
.ei-test-meta {font-size:14px;color:#667067!important;line-height:1.5;margin-top:5px!important;overflow-wrap:anywhere}
.ei-status {display:inline-flex;margin-left:10px;padding:4px 9px;border-radius:20px;font-size:12px;font-weight:750;background:#EFEAF6!important;color:#604C74!important;border:1px solid #E1D7EC;vertical-align:middle}
.ei-test-actions {display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}
.ei-manage-empty {display:flex;align-items:center;gap:12px;min-height:104px;padding:25px 26px;color:#5D665F!important;font-size:16px}
.ei-manage-empty svg {color:#604C74}
.ei-alert {border-left:3px solid #C86C42;padding:14px 16px;margin-bottom:18px;background:#FFF0E8!important;color:#72452D!important;font-size:15px;line-height:1.5}
.ei-success {border-left-color:#173F35;background:#EAF3E9!important;color:#173F35!important}
.ei-quick-error {background:#FCEAE6!important;border-left:3px solid #B64A3F;color:#8C342A!important;padding:15px 17px;font-size:15px;line-height:1.5}
@media(max-width:1050px) {
  .ei-hero {grid-template-columns:minmax(0,1fr)}
  .ei-hero-nav {padding:12px 20px}
  .ei-editor {grid-template-columns:220px minmax(0,1fr)}
  .ei-demand-browser {grid-template-columns:220px minmax(0,1fr)}
}
@media(max-width:700px) {
  .ei-page {gap:22px}
  .ei-hero {min-height:0}
  .ei-hero-lead {padding:23px 21px}
  .ei-hero h2 {font-size:29px!important;margin:9px 0 8px}
  .ei-hero-lead > p:last-child {font-size:15px}
  .ei-hero-nav {padding:5px 12px}
  .ei-nav-item {gap:9px;padding:14px 8px}
  .ei-nav-title {font-size:14px}
  .ei-section-head {min-height:0;padding:19px 20px;gap:12px;align-items:flex-start}
  .ei-section-heading .ei-index {font-size:12px}
  .ei-page h2 {font-size:23px!important}
  .ei-section-body {padding:18px 19px 21px}
  .ei-stat-grid,.ei-demand-overview {grid-template-columns:repeat(2,minmax(0,1fr))}
  .ei-stat,.ei-demand-overview .ei-stat {min-height:118px;padding:17px 18px;border-bottom:1px solid #D5E1D8}
  .ei-stat:nth-child(2n) {border-right:0}
  .ei-stat:nth-last-child(-n+2) {border-bottom:0}
  .ei-stat-value {font-size:32px}
  .ei-demand-overview .ei-stat-value {font-size:23px}
  .ei-signals {grid-template-columns:1fr}
  .ei-signal {min-height:72px;padding:16px 18px;border-right:0;border-bottom:1px solid #DDE5D9}
  .ei-signal:last-child {border-bottom:0}
  .ei-signal-number {font-size:27px}
  .ei-demand-freshness {font-size:13px;gap:9px 14px}
  .ei-demand-freshness button {margin-left:0}
  .ei-demand-browser {grid-template-columns:minmax(0,1fr);gap:12px;margin-top:15px}
  .ei-demand-switcher {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:10px}
  .ei-tab {font-size:14px;min-height:50px;padding:10px}
  .ei-demand-panel-head {padding:13px 15px}
  .ei-demand-panel-head h3 {font-size:18px!important}
  .ei-results {min-height:155px;max-height:315px;padding:0 14px}
  .ei-editor {grid-template-columns:minmax(0,1fr)}
  .ei-editor-side {border-right:0;border-bottom:1px solid #E8D7C9;padding:18px 21px}
  .ei-editor-side .ei-symbol {width:38px;height:38px;margin-bottom:9px}
  .ei-editor-side strong {font-size:18px}
  .ei-editor-side p {display:none}
  .ei-fields {padding:19px}
  .ei-form-grid {gap:14px}
  .ei-field span {font-size:14px}
  .ei-test {flex-direction:column;align-items:flex-start;gap:12px;padding:17px}
  .ei-test-actions {justify-content:flex-start}
  .ei-primary {width:100%}
  .ei-manage-empty {min-height:74px;padding:20px;font-size:15px}
}
@media(max-width:440px) {
  .ei-hero-nav {grid-template-columns:repeat(2,minmax(0,1fr))}
  .ei-nav-title {font-size:13px}
  .ei-form-grid {grid-template-columns:minmax(0,1fr)}
  .ei-section-head {flex-wrap:wrap}
  .ei-count-pill {font-size:12px;padding:6px 10px}
}
@media(prefers-reduced-motion:reduce) {.ei-page * {transition:none!important;scroll-behavior:auto!important}}
`;

const statusLabels = { draft: "Draft", active: "Running", paused: "Paused", ended: "Finished" };
const formatPercent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

function searchArea(row) {
  const parts = [row?.city, row?.state, row?.postcode].filter(Boolean);
  return parts.length ? parts.join(", ") : "Area not available";
}
function searchTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function goToSection(id) {
  if (typeof document !== "undefined") document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function Section({ id, index, eyebrow, title, children, aside, description, extraClass = "" }) {
  return (
    <section id={id} className={`ei-section ${extraClass}`}>
      <div className="ei-section-head">
        <div className="ei-section-heading">
          <p className="ei-index">{index} / {eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {aside || null}
      </div>
      <div className="ei-section-body">{children}</div>
    </section>
  );
}
function Metric({ label, value, icon: Icon, note }) {
  return (
    <div className="ei-stat">
      <p className="ei-stat-label"><span>{label}</span>{Icon ? <Icon size={17} aria-hidden="true"/> : null}</p>
      <p className="ei-stat-value">{value ?? "-"}</p>
      {note ? <p className="ei-stat-meta">{note}</p> : null}
    </div>
  );
}
function MiniMetric({ label, value, note }) {
  return <div className="ei-signal"><div><p className="ei-signal-title">{label}</p>{note ? <p className="ei-signal-note">{note}</p> : null}</div><strong className="ei-signal-number">{value}</strong></div>;
}
function ResultLine({ title, subtitle, count }) {
  return (
    <div className="ei-result">
      <div style={{ minWidth: 0 }}><p className="ei-result-name">{title}</p>{subtitle ? <p className="ei-result-meta">{subtitle}</p> : null}</div>
      {count !== undefined && count !== null ? <span className="ei-result-count">{count}</span> : null}
    </div>
  );
}
function Field({ label, children, wide = false }) {
  return <label className={`ei-field ${wide ? "ei-field-wide" : ""}`}><span>{label}</span>{children}</label>;
}
function ExperimentRow({ experiment, busy, isRootSuperAdmin, run }) {
  const request = (action, reason, message) => run(
    () => changeExperimentStatus(experiment.id, action, reason), message
  );
  return (
    <div className="ei-test">
      <div style={{ minWidth: 0 }}>
        <p className="ei-test-name">{experiment.name}<span className="ei-status">{statusLabels[experiment.status] || experiment.status}</span></p>
        <p className="ei-test-meta">{experiment.experimentKey} · Version {experiment.versionNumber}</p>
        <p className="ei-test-meta">Success measure: {experiment.primaryUtilityMetricKey}</p>
      </div>
      {isRootSuperAdmin ? (
        <div className="ei-test-actions">
          {["draft", "paused"].includes(experiment.status) ? (
            <button type="button" className="ei-secondary" disabled={busy}
              onClick={() => request("activate", "Root Super Admin activated bounded experiment after feature-flag review.", "Experiment activated.")}>Start</button>
          ) : null}
          {experiment.status === "active" ? (
            <button type="button" className="ei-secondary ei-warning" disabled={busy}
              onClick={() => request("pause", "Experiment paused for operational review.", "Experiment paused.")}>Pause</button>
          ) : null}
          {experiment.status !== "ended" ? (
            <button type="button" className="ei-secondary" disabled={busy}
              onClick={() => request("end", "Experiment ended; assignments remain historical.", "Experiment ended.")}>Finish</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminAnalyticsPage({ embedded = false, activeView = "demand", reportDays = 30, refreshToken = 0 }) {
  const { isRootSuperAdmin, hasAdminPermission } = useAdmin();
  const location = useLocation();
  const canReadAnalytics = ["admin.dashboard.read", "admin.audit.read", "marketplace.read", "trust_safety.read"].some((permission) => hasAdminPermission(permission));
  const canReadDemand = ["admin.dashboard.read", "marketplace.read", "catalog.read"].some((permission) => hasAdminPermission(permission));
  const canReadExperiments = ["admin.dashboard.read", "admin.audit.read"].some((permission) => hasAdminPermission(permission));
  const [days, setDays] = useState(reportDays);
  useEffect(() => { if (embedded) setDays(reportDays); }, [embedded, reportDays]);
  const [activeDemandView, setActiveDemandView] = useState("popular");
  const [demand, setDemand] = useState(null);
  const [demandError, setDemandError] = useState("");
  const [demandRefreshing, setDemandRefreshing] = useState(false);
  const demandRequestSequence = useRef(0);
  const [dashboard, setDashboard] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    experimentKey: "", name: "", description: "", surfaceType: "workflow_effort",
    surfaceKey: "", featureFlagKey: "", primaryUtilityMetricKey: "workflow.effort_reduction_rate",
    reason: "Experiment created for bounded utility measurement.",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setDemandRefreshing(false);
    setError("");
    setDemandError("");
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const demandRequestId = ++demandRequestSequence.current;
    const results = await Promise.allSettled([
      canReadAnalytics ? getAdminAnalyticsDashboard({ start, end }) : Promise.resolve(null),
      canReadExperiments ? listExperimentDefinitions() : Promise.resolve(null),
      canReadDemand ? getAdminSearchDemand({ days, limit: 50 }) : Promise.resolve(null),
    ]);
    if (results[0].status === "fulfilled") setDashboard(results[0].value);
    else { setDashboard(null); setError(getAnalyticsErrorMessage(results[0].reason, "Unable to load customer analytics.")); }
    if (results[1].status === "fulfilled") setExperiments(results[1].value?.experiments || []);
    else { setExperiments([]); setError((current) => current || getAnalyticsErrorMessage(results[1].reason, "Unable to load experiments.")); }
    if (demandRequestId === demandRequestSequence.current) {
      if (results[2].status === "fulfilled") setDemand(results[2].value);
      else { setDemand(null); setDemandError(getAdminGovernanceErrorMessage(results[2].reason, "Unable to load customer search demand.")); }
    }
    setLoading(false);
  }, [days, canReadAnalytics, canReadDemand, canReadExperiments]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (embedded && refreshToken > 0) void load(); }, [refreshToken]);
  const refreshDemand = useCallback(async () => {
    if (!canReadDemand) return;
    const requestId = ++demandRequestSequence.current;
    setDemandRefreshing(true);
    try {
      const latest = await getAdminSearchDemand({ days, limit: 50 });
      if (requestId === demandRequestSequence.current) {
        setDemand(latest);
        setDemandError("");
      }
    } catch (requestError) {
      if (requestId === demandRequestSequence.current) {
        setDemandError(getAdminGovernanceErrorMessage(requestError, "Unable to refresh customer search demand."));
      }
    } finally {
      if (requestId === demandRequestSequence.current) setDemandRefreshing(false);
    }
  }, [days, canReadDemand]);

  // Keep demand fresh when the admin comes back to the tab, and while this
  // page remains open. Refresh only the demand endpoint, not experiment data.
  useEffect(() => {
    if (!canReadDemand || typeof document === "undefined") return undefined;
    const onReturn = () => {
      if (document.visibilityState === "visible") void refreshDemand();
    };
    document.addEventListener("visibilitychange", onReturn);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshDemand();
    }, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.clearInterval(interval);
    };
  }, [canReadDemand, refreshDemand]);


  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const frame = window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, canReadDemand, canReadAnalytics]);

  async function run(action, message) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); await load(); }
    catch (requestError) { setError(getAnalyticsErrorMessage(requestError)); }
    finally { setBusy(false); }
  }

  const sections = useMemo(() => [
    ...(canReadAnalytics ? [{ id: "activity-overview", name: "Customer activity" }] : []),
    ...(canReadDemand ? [{ id: "customer-demand", name: "Search demand" }] : []),
    ...(isRootSuperAdmin ? [{ id: "create-experiment", name: "Create a test" }] : []),
    ...(canReadExperiments ? [{ id: "experiments", name: "Manage tests" }] : []),
  ], [canReadAnalytics, canReadDemand, canReadExperiments, isRootSuperAdmin]);
  const funnel = dashboard?.funnel;
  const counts = funnel?.counts || {};
  const demandTabs = [
    { id: "popular", label: "Popular searches", Icon: Search, count: demand?.topQueries?.length || 0 },
    { id: "locations", label: "Top locations", Icon: MapPinned, count: demand?.topAreas?.length || 0 },
    { id: "by-area", label: "By location", Icon: BarChart3, count: demand?.queryByArea?.length || 0 },
    { id: "recent", label: "Recent searches", Icon: Clock3, count: demand?.recent?.length || 0 },
  ];
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const content = (
    <>
      <style>{pageStyles}</style>
      <div className="ei-page">
        {error ? <div className="ei-quick-error" role="alert">{error}</div> : null}
        {notice ? <div className="ei-alert ei-success" role="status">{notice}</div> : null}

        {activeView === "demand" && canReadAnalytics ? (
          <Section id="activity-overview" index="A" eyebrow="Activity" title="Customer activity" description="Operational journey data; separate from consented website tracking.">
            {loading && dashboard === null && !error ? <p className="ei-empty">Loading customer activity...</p> : null}
            {dashboard && !funnel ? <div className="ei-alert">Activity funnel is not available for this permission level.</div> : null}
            {funnel ? (
              <>
                <div className="ei-stat-grid">
                  <Metric label="Funnel searches" value={counts.search ?? 0} icon={Search}/>
                  <Metric label="Recipe choices" value={counts.recipe ?? 0} icon={Sparkles}/>
                  <Metric label="Baskets" value={counts.basket ?? 0} icon={ShoppingBasket}/>
                  <Metric label="Workflow orders" value={counts.orders ?? 0} icon={CheckCircle2}/>
                </div>
                <div id="quality-overview" className="ei-signals" style={{scrollMarginTop:96}}>
                  <MiniMetric label="Recipe to needs" value={formatPercent(funnel.rates?.recipeToRequirements)} note={`Needs to basket: ${formatPercent(funnel.rates?.requirementsToBasket)}`}/>
                  <MiniMetric label="Search success" value={dashboard?.searchQuality?.queries ? formatPercent(1 - Number(dashboard?.searchQuality?.zeroResultRate || 0)) : "-"} note={dashboard?.searchQuality?.queries ? "Searches with results" : "No searches recorded"}/>
                  <MiniMetric label="Notification actions" value={formatPercent(dashboard?.notificationUtility?.actionRate)}/>
                </div>
              </>
            ) : null}
          </Section>
        ) : null}

        {activeView === "demand" && canReadDemand ? (
          <Section id="customer-demand" index="B" eyebrow="Demand" title="What customers search"
            aside={<span className="ei-count-pill">Last {days} days</span>} extraClass="ei-section-with-sage">
            {demandError ? <div role="alert" className="ei-quick-error">{demandError} <button type="button" className="ei-secondary" style={{marginLeft:12}} onClick={load}>Try again</button></div> : null}
            {loading && demand === null && !demandError ? <p className="ei-empty">Loading search demand...</p> : null}
            {demand ? (
              <>
                <div className="ei-demand-overview">
                  <Metric label="Searches" value={demand.totalSearches ?? 0} icon={Search}/>
                  <Metric label="Customers" value={demand.uniqueCustomers ?? 0} icon={UsersRound}/>
                  <Metric label="Top search" value={demand.topQuery?.query || "-"} icon={TrendingUp}/>
                  <Metric label="Top location" value={demand.topArea ? searchArea(demand.topArea) : "Not captured"} icon={MapPinned}/>
                </div>
                <div className="ei-demand-freshness" role="status" aria-live="polite">
                  <span><Clock3 size={16} aria-hidden="true"/> Latest search: <strong>{demand.latestSearchAt ? searchTime(demand.latestSearchAt) : "None in this period"}</strong></span>
                  <span>Last 24h: <strong>{demand.searchesLast24Hours ?? 0}</strong></span>
                  <span>Signed-in customer searches only</span>
                  {Number(demand.searchesWithoutLocation || 0) > 0 ? (
                    <span>{demand.searchesWithoutLocation} searches without a saved location</span>
                  ) : null}
                  <button type="button" disabled={demandRefreshing || loading} onClick={refreshDemand}>
                    <RefreshCw size={15} className={demandRefreshing ? "animate-spin" : ""} aria-hidden="true"/>
                    {demandRefreshing ? "Updating..." : "Refresh demand"}
                  </button>
                </div>
                <div className="ei-demand-browser">
                <div role="tablist" aria-label="Customer demand views" className="ei-demand-switcher">
                  {demandTabs.map(({id,label,Icon,count}) => (
                    <button type="button" key={id} role="tab" aria-selected={activeDemandView === id}
                      aria-controls="customer-demand-data-view" onClick={() => setActiveDemandView(id)}
                      onPointerEnter={(event) => {if(event.pointerType === "mouse" || event.pointerType === "pen") setActiveDemandView(id);}}
                      className="ei-tab">
                      <Icon size={18} aria-hidden="true"/><span>{label}</span><span className="ei-tab-count">{count}</span>
                    </button>
                  ))}
                </div>
                <div className="ei-demand-panel">
                  <div className="ei-demand-panel-head">
                    <h3>{demandTabs.find((view) => view.id === activeDemandView)?.label || "Popular searches"}</h3>
                    <span>Last {days} days</span>
                  </div>
                <div id="customer-demand-data-view" role="tabpanel" aria-live="polite" tabIndex={0} className="ei-results">
                  {activeDemandView === "popular" ? (
                    demand.topQueries?.length ? demand.topQueries.map((row, index) => (
                      <ResultLine key={`${row.query}-${index}`} title={row.query} subtitle={`${row.uniqueCustomers} customer${row.uniqueCustomers === 1 ? "" : "s"}`} count={row.searches}/>
                    )) : <p className="ei-empty">No searches in this period.</p>
                  ) : null}
                  {activeDemandView === "locations" ? (
                    demand.topAreas?.length ? demand.topAreas.map((row,index) => (
                      <ResultLine key={`${searchArea(row)}-${index}`} title={searchArea(row)} subtitle={`${row.uniqueCustomers} customer${row.uniqueCustomers === 1 ? "" : "s"}`} count={row.searches}/>
                    )) : <p className="ei-empty">{demand.totalSearches ? "Searches were recorded, but their locations were not available." : "No locations recorded."}</p>
                  ) : null}
                  {activeDemandView === "by-area" ? (
                    demand.queryByArea?.length ? demand.queryByArea.map((row,index) => (
                      <ResultLine key={`${row.query}-${searchArea(row)}-${index}`} title={row.query} subtitle={searchArea(row)} count={row.searches}/>
                    )) : <p className="ei-empty">{demand.totalSearches ? "No searches with a recorded location yet." : "No location-specific searches."}</p>
                  ) : null}
                  {activeDemandView === "recent" ? (
                    demand.recent?.length ? demand.recent.map((row,index) => (
                      <ResultLine key={row.id || index} title={row.query} subtitle={`${searchArea(row.area)} · ${row.surface}`} count={searchTime(row.occurredAt)}/>
                    )) : <p className="ei-empty">No recent searches.</p>
                  ) : null}
                </div>
                </div>
                </div>
              </>
            ) : null}
          </Section>
        ) : null}

        {activeView === "experiments" && isRootSuperAdmin ? (
          <Section id="create-experiment" index="A" eyebrow="Experiments" title="Create a controlled test" extraClass="ei-section-with-clay">
            <div className="ei-editor">
              <div className="ei-editor-side"><span className="ei-symbol"><Beaker size={21} aria-hidden="true"/></span><strong>Test setup</strong><p>Create a draft with a goal and a success measure.</p></div>
              <div className="ei-fields">
                <div className="ei-form-grid">
                  <Field label="Test ID"><input className="ei-input" placeholder="checkout-layout-test" value={form.experimentKey} onChange={(e) => updateForm("experimentKey",e.target.value)}/></Field>
                  <Field label="Test name"><input className="ei-input" placeholder="Short, readable name" value={form.name} onChange={(e) => updateForm("name",e.target.value)}/></Field>
                  <Field label="Where it runs"><input className="ei-input" placeholder="checkout, search, recipe..." value={form.surfaceKey} onChange={(e) => updateForm("surfaceKey",e.target.value)}/></Field>
                  <Field label="Feature control key"><input className="ei-input" placeholder="Feature flag key" value={form.featureFlagKey} onChange={(e) => updateForm("featureFlagKey",e.target.value)}/></Field>
                  <Field label="Test type"><select className="ei-input" value={form.surfaceType} onChange={(e) => updateForm("surfaceType",e.target.value)}>
                    <option value="presentation">Page presentation</option><option value="workflow_effort">Workflow effort</option><option value="notification_utility">Notification usefulness</option><option value="recommendation_utility">Recommendation usefulness</option>
                  </select></Field>
                  <Field label="Success measure"><input className="ei-input" placeholder="Metric used to judge success" value={form.primaryUtilityMetricKey} onChange={(e) => updateForm("primaryUtilityMetricKey",e.target.value)}/></Field>
                  <Field wide label="Expected improvement"><textarea className="ei-input ei-textarea" placeholder="What customer problem will this test address?" value={form.description} onChange={(e) => updateForm("description",e.target.value)}/></Field>
                </div>
                <div className="ei-form-actions"><button type="button" className="ei-primary" disabled={busy || !form.experimentKey.trim() || !form.name.trim() || !form.description.trim() || !form.featureFlagKey.trim()}
                  onClick={() => run(() => createExperimentDefinition({
                    experimentKey:form.experimentKey.trim(), name:form.name.trim(), description:form.description.trim(),
                    surfaceType:form.surfaceType, surfaceKey:form.surfaceKey.trim() || form.experimentKey.trim(),
                    featureFlagKey:form.featureFlagKey.trim(), eligibleActorTypes:["customer","host"], allocationBasisPoints:10000,
                    variants:[{key:"control",label:"Control",weightBasisPoints:5000,isControl:true},{key:"treatment",label:"Treatment",weightBasisPoints:5000,isControl:false}],
                    primaryUtilityMetricKey:form.primaryUtilityMetricKey.trim(), guardrailMetricKeys:["trust.correction_rate"], holdoutRequired:true, reason:form.reason,
                  }), "Experiment created as a draft.")}>Save test as draft <ArrowRight size={16} aria-hidden="true"/></button></div>
              </div>
            </div>
          </Section>
        ) : null}

        {activeView === "experiments" && canReadExperiments ? (
          <Section id="experiments" index="B" eyebrow="Experiments" title="Manage tests" extraClass="ei-section-with-sage"
            aside={<span className="ei-count-pill">{experiments.length} total</span>}>
            <div className="ei-test-list">
              {experiments.length ? experiments.map((experiment) => (
                <ExperimentRow key={experiment.id} experiment={experiment} busy={busy} isRootSuperAdmin={isRootSuperAdmin} run={run}/>
              )) : <div className="ei-manage-empty"><Beaker size={21} aria-hidden="true"/><span>{loading ? "Loading experiments..." : "No experiments yet."}</span></div>}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
  if (embedded) return content;
  return (
    <AdminShell flushTop title="Analytics & Customer Demand" description="" showWorkspaceBadge={false} mobileStackHeader
      actions={<button type="button" onClick={load} disabled={loading || busy}>Refresh</button>}>
      {content}
    </AdminShell>
  );
}
