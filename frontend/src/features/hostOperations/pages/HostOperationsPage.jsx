import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  KeyRound,
  LoaderCircle,
  MapPinned,
  Megaphone,
  PackageSearch,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  WalletCards,
  Webhook,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link, useSearchParams } from "react-router-dom";

import { listHostBrandAuthorities } from "../../brands/services/brandAuthority.service";

import { listHostOrders } from "../../commerce/services/commerce.service";

import { searchCommunityIngredients } from "../../community/services/community.service";

import {
  createServiceArea,
  listServiceAreas,
  updateServiceArea,
} from "../../marketplace/services/marketplace.service";

import { uploadRecipeImage } from "../../recipes/services/recipe.service";

import {
  addHostTeamMember,
  createHostRecipeListing,
  createHostCampaign,
  createHostCatalogImport,
  createHostOperationalOrganization,
  createHostServiceAccount,
  createHostWebhook,
  getHostDataQuality,
  getHostFinanceSummary,
  getHostCommercialProfile,
  getHostKyb,
  getHostOperationalOrganization,
  getHostOperationalReadiness,
  getHostOperationsErrorMessage,
  getHostRecipeListing,
  listHostRecipeListings,
  listHostCampaigns,
  listHostCatalogImports,
  listHostDocuments,
  listHostOperationsAudit,
  listHostServiceAccounts,
  listHostSettlements,
  listHostTeam,
  listHostWebhooks,
  registerHostDocument,
  requestHostOperationalActivation,
  rotateHostServiceAccountCredential,
  rotateHostWebhookSecret,
  saveHostKyb,
  submitHostCampaign,
  submitHostKyb,
  updateHostOperationalProfile,
  updateHostRecipeListing,
} from "../services/hostOperations.service";

const hostFinanceCss = String.raw`
/* Scoped to Host Finance only. Shared shell, typography and other Host screens untouched. */
.hfin-root { --hfin-paper:#F7F6F2; --hfin-forest:#173F35; --hfin-ink:#202421;
  --hfin-sage:#DCE0CF; --hfin-clay:#C86C42; --hfin-line:#DCE2D9; --hfin-muted:#54635C;
  box-sizing:border-box; min-width:0; width:100%; padding:clamp(22px,2.4vw,36px) clamp(18px,2.7vw,42px) 48px;
  background:var(--hfin-paper); color:var(--hfin-ink);
  font:400 16px/1.6 'Plus Jakarta Sans',Inter,system-ui,sans-serif; }
.hfin-root *, .hfin-root *::before,.hfin-root *::after {box-sizing:border-box;}
.hfin-root :is(button,a) {font-family:inherit;}
.hfin-root :is(button,a):focus-visible {outline:3px solid var(--hfin-clay)!important;outline-offset:3px;}
.hfin-hero {background:transparent;border:0;border-bottom:1px solid var(--hfin-line);padding:0 0 28px;}
.hfin-topline {display:flex;align-items:flex-start;justify-content:space-between;gap:26px;}
.hfin-eyebrow {margin:0;color:#A25336;font-size:13px;font-weight:700;letter-spacing:.045em;
  text-transform:uppercase;display:flex;align-items:center;gap:10px;line-height:1.5;}
.hfin-eyebrow::before {content:'';display:block;width:25px;height:2px;background:var(--hfin-clay);flex:none;}
.hfin-title {margin:11px 0 8px!important;color:var(--hfin-forest)!important;
  font-size:clamp(30px,2.7vw,39px)!important;font-weight:650!important;line-height:1.16!important;letter-spacing:-.045em!important;}
.hfin-description {max-width:590px;margin:0;color:var(--hfin-muted);font-size:16px;line-height:1.55;}
.hfin-refresh {display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;
  flex:none;padding:10px 19px;margin:6px 0 0;border:1px solid var(--hfin-forest);border-radius:9px;
  color:#fff!important;background:var(--hfin-forest);font-size:15px;font-weight:650;line-height:1.25;
  cursor:pointer;transition:background-color .18s;}
.hfin-refresh:hover:not(:disabled){background:#295b4c;}
.hfin-refresh:disabled {opacity:.62;cursor:wait;}
.hfin-content {min-width:0;}
.hfin-section {margin-top:31px;min-width:0;}
.hfin-section-heading {display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:19px;}
.hfin-section-kicker {margin:0 0 6px;font-size:13px;font-weight:700;line-height:1.4;
  letter-spacing:.035em;text-transform:uppercase;color:#A25336;}
.hfin-section-title {margin:0;color:var(--hfin-forest);font-weight:650;letter-spacing:-.035em;font-size:27px;line-height:1.3;}
.hfin-section-description {margin:5px 0 0;color:var(--hfin-muted);font-size:15px;line-height:1.55;}
.hfin-manage {display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;
  flex:none;border-bottom:1px solid #9DB6A5;color:var(--hfin-forest)!important;font-size:14px;
  font-weight:650;text-decoration:none;white-space:nowrap;}
.hfin-manage:hover {border-bottom-color:var(--hfin-forest);}
.hfin-board {display:grid;grid-template-columns:minmax(270px,.76fr) minmax(0,1.4fr);
  border:1px solid var(--hfin-line);border-radius:13px;overflow:hidden;background:#FFFEFC;min-width:0;}
.hfin-lead {min-width:0;padding:27px clamp(20px,2.6vw,37px);background:#E8EDE4;display:flex;
  flex-direction:column;align-items:flex-start;justify-content:space-between;gap:34px;}
.hfin-lead-top {width:40px;height:3px;background:var(--hfin-clay);}
.hfin-lead-label {color:#3C5547;font-size:15px;font-weight:650;line-height:1.4;margin:0 0 10px;}
.hfin-lead-number {display:block;color:var(--hfin-forest);font-size:clamp(52px,6vw,74px);font-weight:650;
  line-height:1;letter-spacing:-.055em;font-variant-numeric:tabular-nums;}
.hfin-lead-description {margin:11px 0 0;color:var(--hfin-muted);font-size:14px;line-height:1.55;}
.hfin-financial {display:flex;min-width:0;flex-direction:column;}
.hfin-metric-row {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));flex:1;}
.hfin-metric {min-width:0;padding:29px clamp(20px,2.25vw,33px) 25px;display:flex;flex-direction:column;
  justify-content:space-between;gap:23px;}
.hfin-metric + .hfin-metric {border-left:1px solid var(--hfin-line);}
.hfin-metric-label {margin:0;color:#40594B;font-size:15px;font-weight:600;line-height:1.5;}
.hfin-metric-number {display:block;font-size:38px;line-height:1.12;letter-spacing:-.045em;
  font-weight:650;color:var(--hfin-forest);font-variant-numeric:tabular-nums;}
.hfin-metric-description {margin:8px 0 0;font-size:14px;line-height:1.5;color:var(--hfin-muted);}
.hfin-paid {display:flex;align-items:center;justify-content:space-between;gap:20px;min-width:0;
  padding:19px clamp(20px,2.25vw,33px);background:var(--hfin-forest);color:#fff;}
.hfin-paid-label {display:block;margin:0;color:#fff;font-size:15px;font-weight:650;line-height:1.35;}
.hfin-paid-description {margin:3px 0 0;color:#CDDED2;font-size:13px;line-height:1.5;}
.hfin-paid-amount {color:#fff;display:block;text-align:right;font-size:clamp(26px,3vw,35px);
  line-height:1.2;letter-spacing:-.035em;white-space:nowrap;font-weight:650;font-variant-numeric:tabular-nums;}
.hfin-note {display:flex;align-items:flex-start;gap:10px;margin:12px 0 0;color:#52665A;
  font-size:14px;line-height:1.55;}
.hfin-note svg {flex:none;margin-top:2px;color:#67816D;}
.hfin-payouts {margin-top:42px;padding-top:30px;border-top:1px solid var(--hfin-line);}
.hfin-payout-ledger {background:#FFFEFC;border:1px solid var(--hfin-line);border-radius:12px;overflow:hidden;}
.hfin-payout-row {display:grid;align-items:center;grid-template-columns:minmax(0,1.5fr) minmax(125px,.75fr) auto;
  gap:20px;padding:19px 22px;min-width:0;}
.hfin-payout-row + .hfin-payout-row {border-top:1px solid var(--hfin-line);}
.hfin-payout-period {display:block;color:var(--hfin-ink);font-size:15px;font-weight:650;line-height:1.5;}
.hfin-payout-meta {margin:3px 0 0;color:var(--hfin-muted);font-size:14px;}
.hfin-payout-amount {color:var(--hfin-forest);font-size:19px;font-weight:650;line-height:1.3;
  font-variant-numeric:tabular-nums;}
.hfin-status {justify-self:end;max-width:100%;border:1px solid #C8D8CC;border-radius:7px;
  background:#EDF1EB;color:#385D4B;padding:7px 11px;font-size:13px;font-weight:650;line-height:1.4;}
.hfin-empty-layout {display:grid;grid-template-columns:minmax(0,1.5fr) minmax(240px,.75fr);gap:0;
  border:1px solid var(--hfin-line);border-radius:12px;overflow:hidden;background:#FFFEFC;}
.hfin-empty {display:flex;align-items:flex-start;gap:17px;padding:32px clamp(20px,3.3vw,44px);min-width:0;}
.hfin-empty-icon {display:grid;place-items:center;flex:none;width:51px;height:51px;border-radius:12px;
  background:#E9EFE8;color:var(--hfin-forest);}
.hfin-empty h3 {margin:0;color:var(--hfin-forest);font-size:19px;font-weight:650;line-height:1.35;}
.hfin-empty p {margin:7px 0 0;color:var(--hfin-muted);font-size:15px;line-height:1.6;max-width:475px;}
.hfin-steps {padding:27px 28px;background:#F0F2EC;border-left:1px solid var(--hfin-line);}
.hfin-steps-title {margin:0 0 15px;color:var(--hfin-forest);font-size:15px;font-weight:650;line-height:1.5;}
.hfin-steps-list {list-style:none;padding:0;margin:0;display:grid;gap:12px;}
.hfin-steps-list li {display:flex;gap:11px;align-items:start;color:#465D50;font-size:14px;line-height:1.45;}
.hfin-step-index {flex:none;display:grid;place-items:center;width:24px;height:24px;
  border:1px solid #CCD9C9;border-radius:7px;background:#fff;color:var(--hfin-forest);font-size:12px;font-weight:700;}
.hfin-error {display:flex;align-items:flex-start;gap:10px;margin-top:15px;
  padding:14px 16px;background:#FFF4ED;border:1px solid #E4C0B3;border-radius:9px;
  color:#93432A;font-size:14px;line-height:1.5;}
.hfin-error svg {flex:none;margin-top:2px;}
@media (max-width:850px){
  .hfin-board{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);}
  .hfin-lead{padding:24px;}
  .hfin-metric{padding:24px 18px;}
  .hfin-empty-layout{grid-template-columns:minmax(0,1fr);}
  .hfin-steps{border-left:0;border-top:1px solid var(--hfin-line);}
  .hfin-steps-list{grid-template-columns:repeat(3,minmax(0,1fr));}
}
@media (max-width:650px){
  .hfin-root{padding:18px 16px 34px;font-size:16px;}
  .hfin-hero{padding-bottom:21px;}
  .hfin-topline{gap:12px;}
  .hfin-eyebrow{font-size:12px;gap:7px;}
  .hfin-eyebrow::before{width:17px;}
  .hfin-title{font-size:29px!important;margin-top:8px!important;}
  .hfin-description{font-size:14px;line-height:1.5;}
  .hfin-refresh{min-height:44px;font-size:14px;padding:10px 12px;gap:6px;margin-top:5px;}
  .hfin-section{margin-top:25px;}
  .hfin-section-heading{align-items:flex-start;gap:8px;margin-bottom:14px;}
  .hfin-section-kicker{font-size:12px;}
  .hfin-section-title{font-size:23px;}
  .hfin-section-description{font-size:14px;}
  .hfin-manage{font-size:13px;gap:5px;white-space:normal;text-align:right;min-height:40px;}
  .hfin-board{grid-template-columns:minmax(0,1fr);}
  .hfin-lead{padding:22px;gap:19px;}
  .hfin-lead-number{font-size:58px;}
  .hfin-lead-description{margin-top:6px;}
  .hfin-metric{padding:20px 17px;gap:12px;}
  .hfin-metric-label{font-size:13px;}
  .hfin-metric-number{font-size:31px;}
  .hfin-metric-description{font-size:13px;margin-top:4px;}
  .hfin-paid{padding:17px;gap:12px;}
  .hfin-paid-amount{font-size:26px;}
  .hfin-note{font-size:13px;}
  .hfin-payouts{margin-top:28px;padding-top:23px;}
  .hfin-empty{padding:22px 17px;gap:12px;}
  .hfin-empty-icon{width:42px;height:42px;}
  .hfin-empty h3{font-size:17px;}
  .hfin-empty p{font-size:14px;}
  .hfin-steps{padding:19px 17px;}
  .hfin-steps-list{grid-template-columns:minmax(0,1fr);gap:10px;}
  .hfin-payout-row{grid-template-columns:minmax(0,1fr) auto;gap:8px 11px;padding:16px;}
  .hfin-payout-amount{grid-column:1;grid-row:2;font-size:18px;}
  .hfin-status{grid-column:2;grid-row:1 / span 2;font-size:12px;}
}
@media (max-width:350px){.hfin-topline{flex-wrap:wrap;}.hfin-refresh{margin-top:0;}.hfin-manage{font-size:12px;}}
@media (prefers-reduced-motion:reduce){.hfin-refresh{transition:none;}}

/* Delivered-orders details: real Host orders, styled as a simple finance ledger. */
.hfin-delivered {margin-top:22px;border:1px solid var(--hfin-line);border-radius:12px;
  overflow:hidden;background:#FFFEFC;min-width:0;}
.hfin-delivered-heading {padding:20px clamp(18px,2.3vw,32px);display:flex;justify-content:space-between;
  align-items:center;gap:16px;border-bottom:1px solid var(--hfin-line);background:#F1F3EE;}
.hfin-delivered-heading h3 {margin:0;color:var(--hfin-forest);font-weight:650;font-size:20px;line-height:1.3;}
.hfin-delivered-heading p {margin:4px 0 0;color:var(--hfin-muted);font-size:14px;line-height:1.45;}
.hfin-delivered-count {flex:none;color:var(--hfin-forest);font-size:14px;font-weight:650;white-space:nowrap;}
.hfin-delivered-row {display:grid;grid-template-columns:minmax(0,1fr) minmax(110px,.38fr) auto;
  gap:20px;align-items:center;padding:17px clamp(18px,2.3vw,32px);min-width:0;
  border-bottom:1px solid #E7EBE5;text-decoration:none!important;color:var(--hfin-ink)!important;
  transition:background .16s;}
.hfin-delivered-row:hover {background:#F7F8F4;}
.hfin-delivered-row:last-child{border-bottom:0;}
.hfin-order-products{display:block;color:var(--hfin-ink);font-size:16px;font-weight:650;
  line-height:1.5;overflow-wrap:anywhere;}
.hfin-order-meta{display:block;color:var(--hfin-muted);font-size:13px;margin-top:4px;line-height:1.5;}
.hfin-order-date{color:var(--hfin-muted);font-size:14px;line-height:1.5;}
.hfin-order-right{display:flex;align-items:center;gap:13px;justify-content:flex-end;}
.hfin-order-amount{font-size:17px;color:var(--hfin-forest);font-weight:650;
  white-space:nowrap;font-variant-numeric:tabular-nums;}
.hfin-order-right svg{flex:none;color:#667F70;}
.hfin-delivered-empty{padding:22px clamp(18px,2.3vw,32px);font-size:15px;
  color:var(--hfin-muted);}
.hfin-delivered-more {display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;min-height:48px;border:0;border-top:1px solid var(--hfin-line);
  color:var(--hfin-forest);background:#F1F4EE;cursor:pointer;font-size:14px;font-weight:650;}
.hfin-delivered-more:hover:not(:disabled){background:#E7EDE4;}
.hfin-delivered-more:disabled{opacity:.6;cursor:wait;}
.hfin-delivered .hfin-error{margin:14px 18px;}
@media(max-width:650px){
  .hfin-delivered{margin-top:17px;}
  .hfin-delivered-heading{padding:17px;gap:10px;align-items:flex-start;}
  .hfin-delivered-heading h3{font-size:19px;}
  .hfin-delivered-heading p{font-size:13px;}
  .hfin-delivered-count{font-size:13px;}
  .hfin-delivered-row{grid-template-columns:minmax(0,1fr) auto;gap:5px 12px;padding:14px 17px;}
  .hfin-order-products{font-size:15px;}
  .hfin-order-meta{font-size:13px;margin-top:4px;}
  .hfin-order-date{grid-column:1;grid-row:2;font-size:13px;}
  .hfin-order-right{grid-column:2;grid-row:1 / span 2;gap:7px;}
  .hfin-order-amount{font-size:15px;}
  .hfin-delivered-empty{padding:18px 17px;}
}
@media(prefers-reduced-motion:reduce){.hfin-delivered-row{transition:none;}}
`;

const hostProductCatalogCss = String.raw`
/* Product Catalog: same Forest / Sage / Porcelain / Clay design language as
   Host Dashboard, Host Business Setup and Host Operations Center. Scoped. */
.hpc-root {
  --hpc-forest:#173F35;
  --hpc-clay:#C86C42;
  --hpc-sage:#E4EAE0;
  --hpc-porcelain:#F7F6F2;
  --hpc-ink:#202421;
  --hpc-muted:#53645B;
  --hpc-line:#D9E1D7;
  width:100%; min-width:0;
  padding:clamp(15px,2.35vw,34px)!important;
  background:var(--hpc-porcelain); color:var(--hpc-ink);
  font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;
  font-size:16px; line-height:1.55;
}
.hpc-root *, .hpc-root *::before, .hpc-root *::after {box-sizing:border-box}
.hpc-root :is(button,input,label) {font-family:inherit}
.hpc-root :is(a,button,label,input):focus-visible {outline:3px solid var(--hpc-clay)!important;outline-offset:3px}

/* One two-tone page introduction, consistent with Host Business Setup. */
.hpc-root .hpc-hero {
  display:grid; grid-template-columns:minmax(0,1.53fr) minmax(275px,.72fr);
  position:relative; isolation:isolate; overflow:hidden;
  min-width:0; padding:0!important; border:0; border-radius:18px;
  background:var(--hpc-forest); box-shadow:0 14px 29px rgba(19,58,45,.10);
}
.hpc-root .hpc-hero > div:first-child {
  position:relative; isolation:isolate; min-width:0; min-height:268px;
  padding:clamp(26px,3vw,42px); gap:20px;
}
.hpc-root .hpc-hero > div:first-child::after {
  content:''; z-index:-1; position:absolute; pointer-events:none;
  width:320px; height:320px; right:-115px; top:-180px;
  border:1px solid rgba(243,250,243,.13); border-radius:50%;
  box-shadow:0 0 0 39px rgba(250,255,248,.025),0 0 0 80px rgba(250,255,248,.017);
}
.hpc-root .hpc-hero-label {
  color:#F2B69A!important; display:flex; align-items:center; gap:9px;
  font-size:13px!important; line-height:1.4!important;
  font-weight:800!important; letter-spacing:.07em; text-transform:uppercase;
}
.hpc-root .hpc-hero-label::before {content:'';width:23px;height:2px;background:currentColor;flex:none}
.hpc-root .hpc-hero-title {
  margin:12px 0 0!important; color:#FFFDF8!important;
  font-size:clamp(30px,3vw,43px)!important; line-height:1.13!important;
  letter-spacing:-.047em!important; font-weight:800!important;
}
.hpc-root .hpc-hero-meta {
  max-width:570px; margin:13px 0 0!important; color:#DBE8DF!important;
  font-size:15px!important; line-height:1.55!important; font-weight:500!important;
}
.hpc-root .hpc-refresh {
  position:relative; z-index:2; display:inline-flex; gap:8px; align-items:center;
  justify-content:center; flex:none; min-height:44px; padding:10px 14px;
  background:#FFFEF9!important; border:1px solid #E4EDE3!important; border-radius:9px;
  color:#173F35!important; font-size:14px!important; font-weight:750!important;
  cursor:pointer; transition:background .18s,transform .18s,border-color .18s;
}
.hpc-root .hpc-refresh:hover:not(:disabled) {background:#F4DCCB!important;border-color:#E0B79F!important;transform:translateY(-1px)}

/* Supporting steps: a genuinely separate Sage surface, no mini-card grid. */
.hpc-root .hpc-steps {
  min-width:0; margin:0; padding:24px clamp(20px,2.2vw,33px);
  display:flex; flex-direction:column; justify-content:center;
  background:var(--hpc-sage); border-left:4px solid var(--hpc-clay);
}
.hpc-root .hpc-step {
  display:flex; align-items:center; gap:13px; min-width:0;
  padding:12px 0!important; border-bottom:1px solid #C9D6CA;
}
.hpc-root .hpc-step:last-child {border-bottom:0}
.hpc-root .hpc-step::before {display:none!important}
.hpc-root .hpc-step-index {
  width:35px; height:35px; flex:none; display:grid; place-items:center;
  color:#173F35; background:#F9FAF5; border:1px solid #C6D5C9;
  border-radius:9px; font-size:13px!important; font-weight:800!important;
}
.hpc-root .hpc-step:first-child .hpc-step-index {background:#173F35;color:white;border-color:#173F35}
.hpc-root .hpc-step-name {
  color:#27473A!important; font-size:15px!important; font-weight:750!important;
  line-height:1.4!important;
}

/* Standard Host section spacing, one purposeful main form + secondary panel. */
.hpc-root .hpc-content {display:grid;gap:29px;margin-top:30px;min-width:0}
.hpc-root .hpc-upload-section {
  display:grid; grid-template-columns:minmax(0,1.68fr) minmax(280px,.72fr);
  gap:21px; align-items:stretch; min-width:0;
}
.hpc-root .hpc-upload-main {
  background:#FFFEFC; min-width:0; padding:clamp(23px,2.5vw,35px);
  border:1px solid #DDE3DA; border-top:3px solid var(--hpc-clay); border-radius:0 0 12px 12px;
}
.hpc-root .hpc-section-head {display:flex;align-items:flex-start;gap:14px;min-width:0}
.hpc-root .hpc-icon-box {
  width:44px;height:44px;flex:none;display:grid;place-items:center;
  background:#E8EFE7;color:#173F35;border-radius:11px;
}
.hpc-root .hpc-kicker {
  color:#B35C38!important;font-size:13px!important;font-weight:800!important;
  line-height:1.4!important;letter-spacing:.06em;text-transform:uppercase;
}
.hpc-root .hpc-section-title {
  margin:7px 0 0!important;color:#173F35!important;
  font-size:clamp(24px,2.1vw,30px)!important;line-height:1.18!important;
  letter-spacing:-.036em!important;font-weight:800!important;
}
.hpc-root .hpc-section-description {
  margin:9px 0 0!important;color:var(--hpc-muted)!important;
  max-width:620px;font-size:15px!important;line-height:1.58!important;
}
.hpc-root .hpc-upload-card {margin-top:25px}
.hpc-root .hpc-dropzone {
  display:flex; align-items:center; gap:16px; min-width:0; min-height:121px;
  padding:19px 20px; border:1px solid #C6D7C9; border-radius:11px;
  background:#ECF2EB; cursor:pointer;
  transition:background .18s,border-color .18s,box-shadow .18s;
}
.hpc-root .hpc-dropzone:hover,.hpc-root .hpc-upload-card:focus-within .hpc-dropzone {
  background:#E2EDE3;border-color:#8DAB94;box-shadow:inset 0 0 0 1px #9CB6A1;
}
.hpc-root .hpc-drop-icon {
  flex:none;width:49px;height:49px;display:grid;place-items:center;
  border-radius:10px;background:#FFFEFB;color:#173F35;border:1px solid #D1DED0;
}
.hpc-root .hpc-drop-copy {min-width:0;flex:1;display:grid;gap:4px}
.hpc-root .hpc-drop-title {font-size:17px!important;font-weight:800!important;color:#173F35!important;line-height:1.35!important;overflow-wrap:anywhere}
.hpc-root .hpc-drop-sub {font-size:14px!important;color:#546B5D!important;line-height:1.5!important}
.hpc-root .hpc-drop-action {
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  min-height:45px;padding:10px 18px;background:#173F35;color:#FFFDF8!important;
  font-size:14px!important;font-weight:800!important;border-radius:9px;
  transition:background .18s;
}
.hpc-root .hpc-dropzone:hover .hpc-drop-action {background:#255D4D}
.hpc-root .hpc-upload-footer {
  margin-top:19px;padding-top:18px;border-top:1px solid #DFE6DC;
  display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;
}
.hpc-root .hpc-file-status {display:flex;align-items:flex-start;gap:11px;min-width:0;flex:1}
.hpc-root .hpc-status-dot {flex:none;width:9px;height:9px;margin-top:9px;border-radius:50%;background:#B6A79B}
.hpc-root .hpc-file-status[data-ready=true] .hpc-status-dot {background:#34835D}
.hpc-root .hpc-file-name {font-size:15px!important;color:#173F35!important;font-weight:750!important;line-height:1.4!important;overflow-wrap:anywhere}
.hpc-root .hpc-file-helper {font-size:13.5px!important;color:#5C6E60!important;margin-top:3px!important;line-height:1.5!important}
.hpc-root .hpc-check-button {
  flex:none;display:inline-flex;align-items:center;justify-content:center;gap:9px;
  background:#C86C42;border:1px solid #C86C42;border-radius:9px;
  min-height:47px;padding:11px 21px;color:#FFFDF8!important;
  font-size:15px!important;font-weight:800!important;cursor:pointer;
  transition:background .18s,border-color .18s;
}
.hpc-root .hpc-check-button:hover:not(:disabled) {background:#B05B37;border-color:#B05B37}
.hpc-root .hpc-check-button:disabled {background:#E5EAE3!important;border-color:#DEE3DC!important;color:#77867B!important;opacity:1!important;cursor:not-allowed}
.hpc-root .hpc-format {
  min-width:0; background:#E4EAE0; padding:clamp(22px,2.35vw,32px);
  border:1px solid #D3DED2; border-top:3px solid #173F35; border-radius:0 0 12px 12px;
}
.hpc-root .hpc-format-head {
  margin:7px 0 8px!important;color:#173F35!important;
  font-size:23px!important;font-weight:800!important;letter-spacing:-.03em!important;line-height:1.25!important;
}
.hpc-root .hpc-format-description {margin:0 0 18px!important;color:#54685B!important;font-size:14.5px!important;line-height:1.52!important}
.hpc-root .hpc-columns {
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px;
  border-top:1px solid #C5D3C7;
}
.hpc-root .hpc-columns code {
  display:block;min-width:0;padding:12px 0;border-bottom:1px solid #C5D3C7;
  color:#22483C!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:13px!important;font-weight:700!important;line-height:1.35!important;
  white-space:normal!important;overflow-wrap:anywhere;
}
.hpc-root .hpc-format-note {
  display:flex;gap:9px;align-items:flex-start;margin:19px 0 0!important;
  color:#566A5D!important;font-size:13.5px!important;line-height:1.53!important;
}

/* Report-like results, echoing the Operations Center status/readiness section. */
.hpc-root .hpc-results {
  min-width:0;background:#EDF2EB;padding:clamp(23px,2.6vw,35px);
  border:1px solid #CFDDCF;border-top:4px solid #173F35;border-radius:16px;
}
.hpc-root .hpc-results-head {
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;
  margin-bottom:21px;padding-bottom:17px;border-bottom:1px solid #D1DDD0;
}
.hpc-root .hpc-results-count {
  display:inline-flex;align-items:center;justify-content:center;
  padding:8px 12px;border-radius:8px;border:1px solid #C5D7C7;
  background:#F8FBF6;color:#173F35!important;font-size:13.5px!important;font-weight:800!important;
}
.hpc-root .hpc-table-head,.hpc-root .hpc-check-row {
  display:grid;grid-template-columns:minmax(225px,2.3fr) repeat(3,minmax(85px,.75fr)) minmax(125px,1.12fr);
  column-gap:12px;align-items:center;min-width:0;
}
.hpc-root .hpc-table-head {
  padding:12px 15px;background:#DBE5DA;border:1px solid #CAD9CA;
  border-radius:8px 8px 0 0;
}
.hpc-root .hpc-table-head span {font-size:13px!important;font-weight:800!important;color:#335144!important;line-height:1.35!important}
.hpc-root .hpc-table-head span:not(:first-child) {text-align:center}
.hpc-root .hpc-check-list {display:block;overflow:hidden;background:#FFFEFC;border:1px solid #D7E1D7;border-top:0;border-radius:0 0 8px 8px}
.hpc-root .hpc-check-row {padding:17px 15px;border-bottom:1px solid #E0E6DE;background:#FFFEFB}
.hpc-root .hpc-check-row:nth-child(even) {background:#F9FAF6}
.hpc-root .hpc-check-row:last-child {border-bottom:0}
.hpc-root .hpc-check-ident {display:flex;align-items:center;gap:11px;min-width:0}
.hpc-root .hpc-check-index {
  flex:none;display:grid;place-items:center;width:38px;height:38px;
  background:#E9F0E8;border-radius:10px;color:#173F35;
}
.hpc-root .hpc-check-name {color:#173F35!important;font-size:16px!important;font-weight:800!important;line-height:1.35!important}
.hpc-root .hpc-check-meta {margin:4px 0 0!important;font-size:13.5px!important;color:#607064!important;line-height:1.4!important}
.hpc-root .hpc-stat {min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px}
.hpc-root .hpc-stat-value {font-size:24px!important;font-weight:800!important;color:#173F35!important;line-height:1.2!important}
.hpc-root .hpc-stat[data-state=review] .hpc-stat-value {color:#A85736!important}
.hpc-root .hpc-stat[data-state=fix] .hpc-stat-value {color:#A74343!important}
.hpc-root .hpc-stat-caption {display:none;color:#53665B!important;font-size:13px!important;line-height:1.4!important}
.hpc-root .hpc-data-score {min-width:0;display:grid;gap:6px;align-content:center}
.hpc-root .hpc-score-number {font-size:15px!important;font-weight:800!important;color:#173F35!important;line-height:1.35!important}
.hpc-root .hpc-quality-track {display:block;overflow:hidden;width:100%;height:6px;background:#E0E6DE;border-radius:99px}
.hpc-root .hpc-quality-fill {display:block;height:100%;background:#C86C42;border-radius:99px}
.hpc-root .hpc-no-results {font-size:15px!important;line-height:1.6!important;color:#56685C!important;padding:24px 0 8px}
.hpc-root .hpc-no-results strong {display:block;color:#173F35!important;font-size:18px!important;margin-bottom:6px!important}

@media(max-width:1120px) {
  .hpc-root .hpc-upload-section {grid-template-columns:minmax(0,1fr) minmax(260px,.72fr);gap:16px}
  .hpc-root .hpc-table-head,.hpc-root .hpc-check-row {grid-template-columns:minmax(190px,2fr) repeat(3,minmax(63px,.67fr)) minmax(105px,1.02fr)}
}
@media(max-width:900px) {
  .hpc-root .hpc-hero {grid-template-columns:1fr}
  .hpc-root .hpc-hero > div:first-child {min-height:0}
  .hpc-root .hpc-steps {border-left:0;border-top:3px solid #C86C42;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:15px 24px}
  .hpc-root .hpc-step {border-bottom:0;padding:8px 0!important;align-items:center}
  .hpc-root .hpc-upload-section {grid-template-columns:1fr}
  .hpc-root .hpc-columns {grid-template-columns:repeat(4,minmax(0,1fr));gap:0 12px}
  .hpc-root .hpc-table-head,.hpc-root .hpc-check-row {grid-template-columns:minmax(170px,2fr) repeat(3,minmax(61px,.66fr)) minmax(102px,1fr)}
}
@media(max-width:720px) {
  .hpc-root {padding:12px 11px 29px!important;font-size:15px}
  .hpc-root .hpc-hero {border-radius:14px}
  .hpc-root .hpc-hero > div:first-child {padding:21px 18px;gap:13px}
  .hpc-root .hpc-hero-title {font-size:29px!important;margin-top:8px!important}
  .hpc-root .hpc-hero-meta {font-size:14px!important;line-height:1.5!important;margin-top:8px!important}
  .hpc-root .hpc-refresh {min-height:40px;padding:8px 10px;font-size:13px!important}
  .hpc-root .hpc-steps {grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px;padding:12px 18px}
  .hpc-root .hpc-step {padding:9px 0!important}
  .hpc-root .hpc-step-index {width:30px;height:30px;font-size:12.5px!important}
  .hpc-root .hpc-step-name {font-size:13.5px!important}
  .hpc-root .hpc-content {margin-top:20px;gap:21px}
  .hpc-root .hpc-upload-main,.hpc-root .hpc-format,.hpc-root .hpc-results {padding:20px 17px}
  .hpc-root .hpc-section-head {gap:10px}
  .hpc-root .hpc-icon-box {width:40px;height:40px}
  .hpc-root .hpc-section-title {font-size:23px!important}
  .hpc-root .hpc-section-description {font-size:14px!important}
  .hpc-root .hpc-upload-card {margin-top:18px}
  .hpc-root .hpc-dropzone {min-height:0;padding:16px;gap:12px;flex-wrap:wrap}
  .hpc-root .hpc-drop-icon {width:42px;height:42px}
  .hpc-root .hpc-drop-title {font-size:16px!important}
  .hpc-root .hpc-drop-action {flex-basis:100%}
  .hpc-root .hpc-upload-footer {align-items:stretch;gap:13px}
  .hpc-root .hpc-check-button {width:100%}
  .hpc-root .hpc-format-head {font-size:22px!important}
  .hpc-root .hpc-columns {grid-template-columns:repeat(2,minmax(0,1fr))}
  .hpc-root .hpc-table-head {display:none}
  .hpc-root .hpc-check-list {border:1px solid #D6E0D5;border-radius:9px}
  .hpc-root .hpc-check-row {grid-template-columns:repeat(3,minmax(0,1fr));gap:13px 8px;padding:17px 14px}
  .hpc-root .hpc-check-ident {grid-column:1/-1}
  .hpc-root .hpc-stat {align-items:flex-start;border-top:1px solid #E1E7DF;padding-top:10px}
  .hpc-root .hpc-stat-caption {display:block}
  .hpc-root .hpc-stat-value {font-size:22px!important}
  .hpc-root .hpc-data-score {grid-column:1/-1;display:flex;align-items:center;gap:12px}
  .hpc-root .hpc-quality-track {width:120px}
}
@media(max-width:390px) {
  .hpc-root .hpc-hero > div:first-child {flex-wrap:wrap}
  .hpc-root .hpc-refresh {margin-left:auto}
  .hpc-root .hpc-step-name {font-size:13px!important}
  .hpc-root .hpc-check-row {gap:10px 6px}
}
/* Product Catalog: compact mobile treatment only. Desktop and tablet stay as-is. */
@media (max-width:640px) {
  .hpc-root {padding:10px 9px 25px!important; font-size:15px}
  .hpc-root .hpc-hero {border-radius:13px;box-shadow:none}
  .hpc-root .hpc-hero > div:first-child {
    position:relative;min-height:0;padding:19px 16px 17px!important;
    gap:0!important;align-items:stretch!important
  }
  .hpc-root .hpc-hero > div:first-child > div:first-child {width:100%;min-width:0}
  .hpc-root .hpc-hero-label {
    margin-right:96px;font-size:12px!important;letter-spacing:.055em;
    line-height:1.35!important;gap:7px
  }
  .hpc-root .hpc-hero-label::before {width:17px}
  .hpc-root .hpc-hero-title {
    margin-top:12px!important;font-size:clamp(24px,7vw,29px)!important;
    line-height:1.12!important;letter-spacing:-.04em!important
  }
  .hpc-root .hpc-hero-meta {margin-top:8px!important;font-size:13px!important;line-height:1.4!important}
  .hpc-root .hpc-refresh {
    position:absolute;top:15px;right:14px;margin:0!important;
    min-height:36px;padding:7px 10px;font-size:12px!important;
    border-radius:8px;white-space:nowrap
  }
  .hpc-root .hpc-steps {
    grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px;
    padding:11px 16px 12px;border-top-width:2px
  }
  .hpc-root .hpc-step {min-height:39px;padding:6px 0!important;gap:9px}
  .hpc-root .hpc-step-index {width:28px;height:28px;border-radius:7px;font-size:12px!important}
  .hpc-root .hpc-step-name {font-size:13px!important;line-height:1.3!important;font-weight:750!important}

  .hpc-root .hpc-content {margin-top:15px;gap:17px}
  .hpc-root .hpc-upload-section {gap:15px}
  .hpc-root .hpc-upload-main,.hpc-root .hpc-format,.hpc-root .hpc-results {padding:18px 15px!important}
  .hpc-root .hpc-upload-main {border-radius:0 0 11px 11px}
  .hpc-root .hpc-section-head {gap:11px;align-items:center}
  .hpc-root .hpc-icon-box {width:36px;height:36px;border-radius:9px}
  .hpc-root .hpc-kicker {font-size:12px!important;letter-spacing:.04em!important}
  .hpc-root .hpc-section-title {font-size:22px!important;line-height:1.18!important;margin-top:4px!important}
  .hpc-root .hpc-section-description {margin-top:7px!important;font-size:14px!important;line-height:1.48!important}
  .hpc-root .hpc-upload-card {margin-top:15px}
  .hpc-root .hpc-dropzone {
    display:grid;grid-template-columns:37px minmax(0,1fr);
    gap:9px 11px;min-height:0;padding:13px 13px 12px;
    border-radius:10px;background:#EDF3EC
  }
  .hpc-root .hpc-drop-icon {width:37px;height:37px;border-radius:9px}
  .hpc-root .hpc-drop-copy {gap:0}
  .hpc-root .hpc-drop-title {font-size:15px!important;line-height:1.35!important}
  .hpc-root .hpc-drop-sub {display:none}
  .hpc-root .hpc-drop-action {
    grid-column:1/-1;flex-basis:auto;width:100%;min-height:40px;
    margin-top:2px;padding:8px 12px;border-radius:8px;
    font-size:14px!important
  }
  .hpc-root .hpc-upload-footer {margin-top:14px;padding-top:13px;gap:12px}
  .hpc-root .hpc-file-status {gap:9px;align-items:center}
  .hpc-root .hpc-status-dot {width:8px;height:8px;margin-top:0}
  .hpc-root .hpc-file-name {font-size:14px!important;line-height:1.3!important}
  .hpc-root .hpc-file-helper {font-size:12.5px!important;line-height:1.4!important;margin-top:2px!important}
  .hpc-root .hpc-check-button {min-height:44px;border-radius:8px;font-size:14px!important}

  .hpc-root .hpc-format {
    border-color:#E2DBD2;border-top-color:#C86C42;
    border-radius:0 0 11px 11px;background:#F5EFE9
  }
  .hpc-root .hpc-format-head {margin:5px 0 5px!important;font-size:20px!important}
  .hpc-root .hpc-format-description {margin:0 0 11px!important;font-size:13.5px!important;line-height:1.45!important}
  .hpc-root .hpc-columns {grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;border-color:#E3D6CB}
  .hpc-root .hpc-columns code {
    padding:10px 0;border-color:#E3D6CB;font-size:12.5px!important;
    line-height:1.3!important
  }
  .hpc-root .hpc-format-note {margin-top:13px!important;font-size:13px!important;line-height:1.4!important}

  .hpc-root .hpc-results {border-radius:11px;background:#EEF2EC;border-top-width:3px}
  .hpc-root .hpc-results-head {gap:9px;margin-bottom:13px;padding-bottom:12px;align-items:end}
  .hpc-root .hpc-results-count {padding:5px 8px;font-size:12px!important;border-radius:7px;white-space:nowrap}
  .hpc-root .hpc-check-list {border:1px solid #D9E1D7;border-radius:9px;background:#FFFEFB}
  .hpc-root .hpc-check-row {
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:10px 9px;padding:15px 12px;background:#FFFEFB
  }
  .hpc-root .hpc-check-row:nth-child(even) {background:#F9FAF7}
  .hpc-root .hpc-check-ident {gap:10px;padding-bottom:11px;border-bottom:1px solid #E4E9E1}
  .hpc-root .hpc-check-index {width:35px;height:35px;border-radius:9px}
  .hpc-root .hpc-check-name {font-size:15px!important;line-height:1.3!important}
  .hpc-root .hpc-check-meta {font-size:12.5px!important;line-height:1.4!important;margin-top:2px!important}
  .hpc-root .hpc-stat {align-items:flex-start;border:0;padding:0;gap:3px}
  .hpc-root .hpc-stat-value {font-size:21px!important;line-height:1.15!important}
  .hpc-root .hpc-stat-caption {font-size:12px!important;line-height:1.3!important}
  .hpc-root .hpc-data-score {
    grid-column:1/-1;display:grid;
    grid-template-columns:auto auto minmax(0,1fr);
    align-items:center;gap:9px;padding-top:10px;border-top:1px solid #E4E9E1
  }
  .hpc-root .hpc-data-score::before {
    content:'Data quality';color:#53665B;font-size:12.5px;font-weight:700;white-space:nowrap
  }
  .hpc-root .hpc-score-number {font-size:13.5px!important;line-height:1.3!important}
  .hpc-root .hpc-quality-track {width:100%;min-width:0;height:6px}
}

@media (max-width:350px) {
  .hpc-root .hpc-columns {grid-template-columns:1fr}
  .hpc-root .hpc-columns code {font-size:13px!important;padding:8px 0;letter-spacing:0}
}

@media(prefers-reduced-motion:reduce) {
  .hpc-root * {transition:none!important}
}
`;

const hostDataQualityCss = String.raw`
/* Host Data Quality only: shared EPANTRY Forest, Sage, Clay and Porcelain system. */
.hdq-root {
  --hdq-forest:#173F35; --hdq-deep:#10352D; --hdq-clay:#C86C42;
  --hdq-sage:#E7EDE4; --hdq-porcelain:#F7F6F2;
  --hdq-ink:#202421; --hdq-muted:#526359; --hdq-line:#D7DED4;
  width:100%;min-width:0;padding:clamp(16px,2.4vw,35px) !important;
  background:var(--hdq-porcelain);color:var(--hdq-ink);
  font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;
  font-size:16px;line-height:1.55;
}
.hdq-root *, .hdq-root *::before, .hdq-root *::after {box-sizing:border-box}
.hdq-root :is(button,a):focus-visible {outline:3px solid var(--hdq-clay)!important;outline-offset:3px}
.hdq-root .hdq-hero {
  background:var(--hdq-forest);color:white;border-top:4px solid var(--hdq-clay);
  border-radius:15px; padding:clamp(22px,2.8vw,37px) clamp(23px,3vw,42px);
  min-width:0;box-shadow:0 12px 25px rgba(15,50,38,.075);
}
.hdq-root .hdq-hero-row {display:flex;align-items:flex-start;justify-content:space-between;gap:20px;min-width:0}
.hdq-root .hdq-eyebrow {
  display:flex;align-items:center;gap:10px;color:#F4BA9C!important;
  font-size:13px!important;font-weight:800!important;letter-spacing:.075em;
  line-height:1.3!important;text-transform:uppercase;margin:0!important;
}
.hdq-root .hdq-eyebrow::before {content:'';width:25px;height:2px;flex:none;background:var(--hdq-clay)}
.hdq-root .hdq-title {margin:10px 0 0!important;color:#FCFDF8!important;
  font-size:clamp(29px,3vw,38px)!important;line-height:1.15!important;font-weight:800!important;letter-spacing:-.045em}
.hdq-root .hdq-description {margin:9px 0 0!important;max-width:650px;
  color:#DCEBE1!important;font-size:16px!important;line-height:1.55!important}
.hdq-root .hdq-refresh {
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  flex:none;min-height:45px;padding:10px 16px;border-radius:9px;
  background:#FFFEFA!important;color:var(--hdq-forest)!important;
  border:1px solid #F3EEE6!important;font-weight:800!important;font-size:14px!important;
  cursor:pointer;transition:background .16s ease,transform .16s ease;
}
.hdq-root .hdq-refresh:hover:not(:disabled) {background:#FBE5D7!important;transform:translateY(-1px)}
.hdq-root .hdq-content {display:grid;gap:25px;margin-top:25px;min-width:0}
.hdq-root .hdq-overview {
  min-width:0;background:#FFFEFB;border:1px solid var(--hdq-line);border-top:3px solid var(--hdq-clay);
  padding:clamp(23px,2.5vw,34px);border-radius:0 0 13px 13px;
}
.hdq-root .hdq-section-kicker {color:#AF5632!important;margin:0!important;font-size:13px!important;
  text-transform:uppercase;letter-spacing:.06em;font-weight:800!important;line-height:1.4}
.hdq-root .hdq-section-heading {color:var(--hdq-forest)!important;font-weight:800!important;
  letter-spacing:-.035em!important;font-size:clamp(23px,2vw,29px)!important;line-height:1.2!important;margin:5px 0 0!important}
.hdq-root .hdq-metrics {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  margin-top:21px;border-top:1px solid var(--hdq-line);border-bottom:1px solid var(--hdq-line)}
.hdq-root .hdq-metric {padding:22px clamp(12px,1.55vw,24px);min-width:0;display:flex;flex-direction:column;gap:7px}
.hdq-root .hdq-metric:first-child {padding-left:0}
.hdq-root .hdq-metric:not(:first-child) {border-left:1px solid var(--hdq-line)}
.hdq-root .hdq-metric-number {font-size:clamp(31px,3vw,41px)!important;
  letter-spacing:-.055em!important;color:var(--hdq-forest)!important;font-weight:800!important;line-height:1!important;font-variant-numeric:tabular-nums}
.hdq-root .hdq-metric:nth-child(3) .hdq-metric-number {color:#AF5A37!important}
.hdq-root .hdq-metric-name {color:#45594D!important;font-size:15px!important;font-weight:700!important;line-height:1.38!important}
.hdq-root .hdq-health {display:grid;grid-template-columns:minmax(250px,.72fr) minmax(0,1.28fr);
  border:1px solid #CEDBD0;overflow:hidden;border-radius:13px;min-width:0}
.hdq-root .hdq-score {background:var(--hdq-forest);padding:clamp(25px,2.7vw,37px);color:#F8F8F1;min-width:0}
.hdq-root .hdq-score-label {color:#D8E7DC!important;font-size:15px!important;font-weight:750!important;line-height:1.4}
.hdq-root .hdq-score-value {display:flex;align-items:baseline;gap:4px;margin-top:17px;
  color:#FFFEFA!important;font-weight:800!important;font-size:clamp(49px,5vw,68px)!important;line-height:1!important;letter-spacing:-.055em!important;font-variant-numeric:tabular-nums}
.hdq-root .hdq-score-value span {color:#C7DDCF!important;font-size:24px!important;letter-spacing:-.03em}
.hdq-root .hdq-score-bar {display:block;overflow:hidden;height:8px;border-radius:99px;
  background:rgba(255,255,255,.2);margin-top:24px}
.hdq-root .hdq-score-bar span {display:block;height:100%;border-radius:99px;background:#E39A74;transition:width .2s ease}
.hdq-root .hdq-score-note {margin:13px 0 0!important;color:#D4E6DA!important;
  font-size:14px!important;line-height:1.5!important}
.hdq-root .hdq-issues-panel {background:#E7EDE4;min-width:0;padding:clamp(23px,2.6vw,35px)}
.hdq-root .hdq-issues-heading {color:var(--hdq-forest)!important;font-size:clamp(21px,1.85vw,26px)!important;
  font-weight:800!important;line-height:1.2!important;margin:0!important;letter-spacing:-.035em}
.hdq-root .hdq-issues-list {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
  gap:0 19px;margin-top:18px;border-top:1px solid #C8D5C7}
.hdq-root .hdq-issue {display:flex;justify-content:space-between;gap:12px;align-items:center;
  min-width:0;padding:14px 0;border-bottom:1px solid #C8D5C7}
.hdq-root .hdq-issue span {font-size:15px!important;color:#334E3E!important;font-weight:650!important;line-height:1.4!important;overflow-wrap:anywhere}
.hdq-root .hdq-issue strong {flex:none;min-width:31px;text-align:center;padding:4px 7px;
  border-radius:7px;background:#F9E5D8;color:#9D4E2C;font-size:14px!important;font-weight:800!important}
.hdq-root .hdq-issues-empty {margin-top:16px;color:var(--hdq-forest)!important;font-size:15px!important}
.hdq-root .hdq-action-bar {display:flex;justify-content:space-between;gap:18px;align-items:center;
  background:#F5EAE1;border:1px solid #ECD4C3;border-left:4px solid var(--hdq-clay);
  border-radius:11px;padding:17px clamp(18px,2.2vw,27px)}
.hdq-root .hdq-action-title {color:var(--hdq-forest)!important;font-size:17px!important;font-weight:800!important;
  line-height:1.4!important;margin:0!important}
.hdq-root .hdq-action-description {color:#536458!important;font-size:14px!important;line-height:1.45!important;margin:3px 0 0!important}
.hdq-root .hdq-cta {display:inline-flex;align-items:center;justify-content:center;gap:9px;
  min-height:47px;border:1px solid var(--hdq-forest);border-radius:9px;
  background:var(--hdq-forest);color:#FFFDF8!important;padding:11px 18px;
  font-size:15px!important;font-weight:800!important;text-decoration:none;white-space:nowrap;
  transition:background .18s ease,transform .18s ease}
.hdq-root .hdq-cta:hover {background:#275F4F;transform:translateY(-1px)}
@media(max-width:950px) {
  .hdq-root .hdq-health {grid-template-columns:minmax(225px,.78fr) minmax(0,1.22fr)}
  .hdq-root .hdq-issues-list {grid-template-columns:1fr}
}
@media(max-width:680px) {
  .hdq-root {padding:13px 12px 29px!important;font-size:15px}
  .hdq-root .hdq-hero {padding:21px 18px;border-radius:12px}
  .hdq-root .hdq-hero-row {gap:13px;align-items:flex-start}
  .hdq-root .hdq-eyebrow {font-size:12.5px!important}
  .hdq-root .hdq-title {font-size:28px!important;margin-top:9px!important}
  .hdq-root .hdq-description {font-size:14px!important;margin-top:7px!important}
  .hdq-root .hdq-refresh {padding:8px 10px;min-height:39px;font-size:13px!important}
  .hdq-root .hdq-refresh svg {width:14px;height:14px}
  .hdq-root .hdq-content {margin-top:20px;gap:20px}
  .hdq-root .hdq-overview {padding:19px 17px}
  .hdq-root .hdq-section-heading {font-size:23px!important}
  .hdq-root .hdq-metrics {grid-template-columns:repeat(2,minmax(0,1fr));margin-top:15px}
  .hdq-root .hdq-metric {padding:16px 9px!important;gap:5px}
  .hdq-root .hdq-metric:nth-child(odd) {padding-left:0!important;border-left:0}
  .hdq-root .hdq-metric:nth-child(even) {padding-left:14px!important;border-left:1px solid var(--hdq-line)}
  .hdq-root .hdq-metric:nth-child(n+3) {border-top:1px solid var(--hdq-line)}
  .hdq-root .hdq-metric-number {font-size:32px!important}
  .hdq-root .hdq-metric-name {font-size:14px!important}
  .hdq-root .hdq-health {grid-template-columns:1fr}
  .hdq-root .hdq-score {padding:23px 20px}
  .hdq-root .hdq-score-value {font-size:53px!important;margin-top:11px}
  .hdq-root .hdq-score-bar {margin-top:15px}
  .hdq-root .hdq-issues-panel {padding:23px 19px}
  .hdq-root .hdq-issues-heading {font-size:22px!important}
  .hdq-root .hdq-issues-list {margin-top:12px}
  .hdq-root .hdq-issue {padding:12px 0}
  .hdq-root .hdq-issue span {font-size:14px!important}
  .hdq-root .hdq-action-bar {flex-direction:column;align-items:stretch;padding:17px 18px;gap:13px}
  .hdq-root .hdq-action-title {font-size:16px!important}
  .hdq-root .hdq-cta {width:100%;min-height:45px;font-size:14px!important}
}
@media(max-width:360px) {
  .hdq-root .hdq-hero-row {flex-wrap:wrap}
  .hdq-root .hdq-refresh {margin-top:2px}
}
@media(prefers-reduced-motion:reduce) {
  .hdq-root .hdq-cta,.hdq-root .hdq-refresh,.hdq-root .hdq-score-bar span {transition:none}
}
`;

const hostOperationsDashboardCss = String.raw`
.hops-root{--hops-forest:#173F35;--hops-clay:#C86C42;--hops-porcelain:#F7F6F2;--hops-sage:#DFE6D9;--hops-ink:#202421;color:var(--hops-ink);background:#F7F6F2;font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif}
.hops-root *, .hops-root *::before, .hops-root *::after{box-sizing:border-box}
.hops-root .hops-hero{position:relative;overflow:hidden;border:0;background:linear-gradient(111deg,#173F35 0%,#12392F 69%,#225647 100%);border-radius:18px;padding:clamp(22px,2.7vw,38px);box-shadow:0 16px 30px rgba(18,57,47,.12)}
.hops-root .hops-hero:after{content:'';position:absolute;right:-74px;top:-148px;width:440px;height:440px;border:1px solid rgba(255,255,255,.13);border-radius:50%;box-shadow:0 0 0 48px rgba(255,255,255,.035),0 0 0 105px rgba(255,255,255,.025);pointer-events:none}
.hops-root .hops-hero h1{font-size:clamp(28px,3vw,42px)!important;line-height:1.12!important;color:#FFFDF8!important;letter-spacing:-.045em;white-space:normal!important}
.hops-root .hops-hero p{color:#D9E8DE!important;font-size:14px!important;line-height:1.55!important}
.hops-root .hops-hero p:first-child{color:#FFB38B!important;font-size:12px!important;letter-spacing:.11em!important}
.hops-root .hops-hero button{position:relative;z-index:1;border:1px solid rgba(255,255,255,.28)!important;background:#FFFDF8!important;color:#173F35!important;min-height:43px;font-size:14px!important;padding:10px 16px!important;border-radius:10px!important;transition:background .2s, transform .2s}
.hops-root .hops-hero button:hover{background:#F5D9C7!important;transform:translateY(-1px)}
.hops-root .hops-body{margin-top:24px!important;display:grid;gap:24px!important}
.hops-root .hops-readiness,.hops-root .hops-profile,.hops-root .hops-delivery,.hops-root .hops-kyb{border-radius:17px!important;box-shadow:none!important;padding:clamp(18px,2.3vw,32px)!important;min-width:0}
.hops-root .hops-readiness{border:1px solid #C6D6CA!important;border-top:4px solid #173F35!important;background:#EDF2EB!important}
.hops-root .hops-profile{border:1px solid #DEE1D9!important;border-top:4px solid #C86C42!important;background:#FFFEFA!important}
.hops-root .hops-delivery{border:1px solid #C7DACC!important;border-top:4px solid #367763!important;background:#E7F0E8!important}
.hops-root .hops-kyb{border:1px solid #DAD0E9!important;border-top:4px solid #8675A7!important;background:#F1EDF7!important}
.hops-root .hops-readiness>div:first-child,.hops-root .hops-profile>div:first-child,.hops-root .hops-delivery>div:first-child,.hops-root .hops-kyb>div:first-child{padding-bottom:14px;border-bottom:1px solid rgba(23,63,53,.14)}
.hops-root .hops-readiness h2,.hops-root .hops-profile h2,.hops-root .hops-delivery h2,.hops-root .hops-kyb h2{font-size:clamp(21px,2vw,27px)!important;line-height:1.2!important;font-weight:800!important;letter-spacing:-.035em;white-space:normal!important;color:#173F35!important}
.hops-root .hops-readiness>div:first-child p,.hops-root .hops-profile>div:first-child p,.hops-root .hops-delivery>div:first-child p,.hops-root .hops-kyb>div:first-child p{font-size:14px!important;line-height:1.5!important;color:#4E6358!important}
.hops-root .hops-profile form,.hops-root .hops-kyb form{column-gap:20px!important;row-gap:17px!important}
.hops-root .hops-profile label>span:first-child,.hops-root .hops-delivery label>span:first-child,.hops-root .hops-kyb label>span:first-child{font-size:13px!important;line-height:1.4!important;font-weight:750!important;color:#38564A!important;letter-spacing:0!important;text-transform:none!important;min-height:0!important}
.hops-root .hops-profile input,.hops-root .hops-profile select,.hops-root .hops-profile textarea,.hops-root .hops-delivery textarea,.hops-root .hops-kyb input,.hops-root .hops-kyb select{height:auto!important;min-height:46px;font-size:15px!important;line-height:1.45!important;padding:11px 13px!important;border:1px solid #C8D1C6!important;border-radius:10px!important;background:#fff!important;color:#202421!important;letter-spacing:0!important;max-width:100%}
.hops-root .hops-profile textarea,.hops-root .hops-kyb textarea,.hops-root .hops-delivery textarea{min-height:84px!important;resize:vertical}
.hops-root .hops-profile button,.hops-root .hops-delivery button,.hops-root .hops-kyb button,.hops-root .hops-readiness button{font-size:14px!important;min-height:44px!important;line-height:1.35!important;white-space:normal!important}
.hops-root .hops-profile button[type=submit],.hops-root .hops-delivery button[type=submit],.hops-root .hops-kyb button[type=submit],.hops-root .hops-readiness button{background:#173F35!important;color:#fff!important;border-color:#173F35!important}
.hops-root .hops-profile button:disabled,.hops-root .hops-delivery button:disabled,.hops-root .hops-kyb button:disabled{opacity:.55;cursor:not-allowed}
.hops-root .hops-check-top{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:22px;margin:18px 0 22px;padding:17px 20px;border-radius:13px;background:#173F35;color:#fff}
.hops-root .hops-check-top strong{display:block;font-size:31px;line-height:1;font-weight:850;letter-spacing:-.04em;color:#fff}
.hops-root .hops-check-top strong small{font-size:16px;color:#BFD4C7}
.hops-root .hops-check-top >div:first-child>span{display:block;margin-top:6px;color:#D4E1D7;font-size:13px}
.hops-root .hops-check-meter{height:8px;overflow:hidden;border-radius:10px;background:rgba(255,255,255,.19)}
.hops-root .hops-check-meter span{display:block;height:100%;margin:0;background:#E7A17B;transition:width .3s ease}
.hops-root .hops-readiness-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 20px}
.hops-root .hops-check-item{display:flex;align-items:center;gap:11px;padding:13px 3px;border-bottom:1px solid #D2DFD2;min-width:0}
.hops-root .hops-check-item span{font-size:14px!important;line-height:1.45!important;font-weight:650;color:#27473A}
.hops-root .hops-check-item[data-passed=false] span{color:#655843}
.hops-root .hops-check-icon{flex-shrink:0;width:27px;height:27px;padding:5px;background:#CFE2D1;color:#236044;border-radius:8px}
.hops-root .hops-check-item[data-passed=false] .hops-check-icon{background:#F4DDCF;color:#B75C36}
.hops-root .hops-coverage-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,.6fr);gap:22px;margin-top:18px}
.hops-root .hops-coverage-form{display:flex;flex-direction:column;gap:12px;min-width:0}
.hops-root .hops-coverage-form button{align-self:flex-start;padding:11px 22px!important;border-radius:10px!important;font-weight:750!important}
.hops-root .hops-coverage-summary{padding:20px;border:1px solid #C7D7C8;background:#F9FBF7;border-radius:13px;min-width:0}
.hops-root .hops-coverage-summary strong{font-size:34px;line-height:1.12;color:#173F35;letter-spacing:-.05em}
.hops-root .hops-coverage-summary p{font-size:14px;line-height:1.5;color:#54665C}
.hops-root .hops-pins{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}
.hops-root .hops-pins span{padding:5px 9px;border-radius:6px;background:#E5EDE2;color:#224E3D;font-size:13px;font-weight:700}
.hops-root .hops-section-error{color:#A3352D!important;font-weight:700;font-size:14px!important;line-height:1.5!important}
.hops-root .hops-kyb p,.hops-root .hops-profile p,.hops-root .hops-readiness p{line-height:1.5}
.hops-root .hops-kyb .text-\[9px\],.hops-root .hops-kyb .text-\[10px\],.hops-root .hops-kyb .text-\[11px\]{font-size:13px!important;line-height:1.45!important}
.hops-root .hops-kyb .text-xs,.hops-root .hops-profile .text-xs{font-size:13px!important}
.hops-root .hops-kyb button:not([type=submit]):not(.bg-emerald-700){border:1px solid #B7B0C9!important;background:#FFFDF9!important;color:#173F35!important}
@media(max-width:900px){.hops-root .hops-readiness-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hops-root .hops-coverage-layout{grid-template-columns:1fr}}
@media(max-width:600px){.hops-root{padding:14px!important}.hops-root .hops-hero{padding:22px 18px!important}.hops-root .hops-hero button{min-height:41px;padding:9px 11px!important}.hops-root .hops-body{gap:20px!important}.hops-root .hops-readiness-grid{grid-template-columns:1fr}.hops-root .hops-check-top{padding:15px;gap:14px}.hops-root .hops-readiness,.hops-root .hops-profile,.hops-root .hops-delivery,.hops-root .hops-kyb{padding:18px 16px!important}.hops-root .hops-profile form,.hops-root .hops-kyb form{gap:13px!important;grid-template-columns:minmax(0,1fr)!important}.hops-root .hops-profile form>.col-span-2,.hops-root .hops-kyb form>.col-span-2{grid-column:1/-1!important}.hops-root .hops-coverage-summary{padding:16px}.hops-root .hops-kyb form>div:not(.grid){min-width:0}}

/* Readable Host operations typography. Scoped to dashboard; other Host pages are untouched. */
.hops-root{font-size:16px;line-height:1.55}
.hops-root .hops-hero p{font-size:15px!important;line-height:1.6!important}
.hops-root .hops-hero p:first-child{font-size:13px!important}
.hops-root .hops-hero button{font-size:15px!important;min-height:46px!important}
.hops-root .hops-readiness h2,.hops-root .hops-profile h2,.hops-root .hops-delivery h2,.hops-root .hops-kyb h2{font-size:clamp(23px,2.15vw,29px)!important;line-height:1.25!important;font-weight:750!important;letter-spacing:-.03em!important}
.hops-root .hops-readiness>div:first-child p,.hops-root .hops-profile>div:first-child p,.hops-root .hops-delivery>div:first-child p,.hops-root .hops-kyb>div:first-child p{font-size:15px!important;line-height:1.55!important}
.hops-root .hops-body :is(.text-\[8px\],.text-\[9px\],.text-\[10px\],.text-\[11px\],.text-\[12px\],.text-xs){font-size:14px!important;line-height:1.5!important;letter-spacing:normal!important}
.hops-root .hops-body .text-sm{font-size:15px!important;line-height:1.5!important}
.hops-root .hops-body h3{font-size:19px!important;line-height:1.3!important;letter-spacing:-.02em}
.hops-root .hops-readiness-grid .hops-check-item span{font-size:15px!important;line-height:1.5!important}
.hops-root .hops-check-top>div:first-child>span{font-size:14px!important}
.hops-root .hops-profile label>span:first-child,.hops-root .hops-delivery label>span:first-child,.hops-root .hops-kyb label>span:first-child{font-size:15px!important;line-height:1.5!important;font-weight:700!important}
.hops-root .hops-profile input,.hops-root .hops-profile select,.hops-root .hops-profile textarea,.hops-root .hops-delivery textarea,.hops-root .hops-kyb input,.hops-root .hops-kyb select{font-size:16px!important;line-height:1.5!important;min-height:48px!important;padding:12px 15px!important}
.hops-root .hops-profile button,.hops-root .hops-delivery button,.hops-root .hops-kyb button,.hops-root .hops-readiness button{font-size:15px!important;min-height:46px!important;font-weight:700!important}
/* Full-width, actual editable PIN input: no narrow native textarea width. */
.hops-root .hops-coverage-layout{grid-template-columns:minmax(0,1.65fr) minmax(290px,.65fr);gap:24px}
.hops-root .hops-coverage-form,.hops-root .hops-coverage-form label{display:block;width:100%;min-width:0;max-width:none}
.hops-root .hops-coverage-form label>span:first-child{display:block}
.hops-root .hops-coverage-form textarea{display:block;width:100%!important;min-width:0!important;max-width:100%!important;min-height:112px!important;resize:vertical!important;white-space:pre-wrap;overflow-wrap:anywhere}
.hops-root .hops-coverage-form button{margin-top:14px}
.hops-root .hops-coverage-summary p{font-size:15px!important;line-height:1.55!important}
.hops-root .hops-pins span{font-size:14px!important}
.hops-root .hops-coverage-note{margin-top:13px;font-size:14px!important;line-height:1.5!important;color:#425D50}
.hops-root :is(button,input,select,textarea):focus-visible{outline:3px solid #C86C42!important;outline-offset:2px}
@media(max-width:900px){.hops-root .hops-coverage-layout{grid-template-columns:minmax(0,1fr);gap:16px}}
@media(max-width:600px){.hops-root{font-size:15px}.hops-root .hops-readiness h2,.hops-root .hops-profile h2,.hops-root .hops-delivery h2,.hops-root .hops-kyb h2{font-size:23px!important}.hops-root .hops-body :is(.text-\[8px\],.text-\[9px\],.text-\[10px\],.text-\[11px\],.text-\[12px\],.text-xs){font-size:13px!important}.hops-root .hops-coverage-form textarea{min-height:120px!important}.hops-root .hops-coverage-form button{width:100%;justify-content:center}}
@media(prefers-reduced-motion:reduce){.hops-root *, .hops-root *::before,.hops-root *::after{transition:none!important}}
`;

const SHARED_DELIVERY_AREA_KEY = "host-default-delivery";

// Active legacy coverage still holds Host PIN codes. Read every page before
// offering those existing values as the new editable business-wide default.
async function loadActiveHostServiceAreas() {
  const serviceAreas = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await listServiceAreas({
      page,
      limit: 100,
      status: "active",
    });
    const rows = Array.isArray(response?.serviceAreas)
      ? response.serviceAreas
      : [];
    serviceAreas.push(...rows);
    const totalPages = Number(
      response?.pagination?.pages || response?.pagination?.totalPages || 0
    );
    if (
      !rows.length ||
      (totalPages > 0 ? page >= totalPages : rows.length < 100)
    ) {
      return { serviceAreas };
    }
  }
  // Do not pretend coverage is complete when an unusually large result truncates.
  throw new Error("Delivery area results exceed the supported page limit.");
}

const inputClass =
  "focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none";

const recipeInputClass =
  "focus-ring w-full rounded-[10px] border border-stone-200 bg-white px-3 py-2 text-[12px] font-semibold text-stone-900 outline-none sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm";

const buttonClass =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50";

const settingsInputClass =
  "focus-ring w-full min-w-0 rounded-[10px] border border-white/90 bg-white/90 px-2.5 py-2 text-[11px] font-semibold text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm";

const settingsButtonClass =
  "focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] bg-[#176a55] px-3 py-2 text-[10px] font-black text-white shadow-[0_5px_14px_rgba(23,106,85,0.14)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm";

function money(amountMinor, currency = "INR") {
  if (amountMinor === null || amountMinor === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",

    currency,

    maximumFractionDigits: 2,
  }).format(Number(amountMinor) / 100);
}

function titleize(value) {
  return String(value || "unknown")
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function readinessLabel(value) {
  return (
    {
      profileComplete: "Business profile complete",
      kybApproved: "KYB approved",
      commercialSetupComplete: "Commercial setup complete",
      documentsPresent: "Business documents added",
      catalogValidated: "Product catalog validated",
      activeOfferPresent: "Active customer offer available",
      pricingConfigured: "Pricing ready",
      inventoryObserved: "Stock availability detected",
      serviceabilityConfigured: "Delivery coverage configured",
    }[value] || titleize(value)
  );
}

function qualityIssueLabel(value) {
  return (
    {
      NO_CANONICAL_PRODUCT_MATCH: "Product match needed",
      NPI_REQUIRED: "Product details need review",
      GTIN_MISSING: "Barcode / GTIN missing",
      INGREDIENT_EVIDENCE_MISSING: "Ingredients need checking",
      ALLERGEN_EVIDENCE_INCOMPLETE: "Allergen details incomplete",
      NUTRITION_INCOMPLETE: "Nutrition details incomplete",
      PROVENANCE_REVIEW_REQUIRED: "Origin details need review",
      NET_QUANTITY_INCOMPLETE: "Pack size incomplete",
      PACK_IMAGE_MISSING: "Pack image missing",
      NOT_RECIPE_ELIGIBLE: "Not ready for Recipes yet",
      INSUFFICIENT_PRODUCT_IDENTITY: "Product identity incomplete",
    }[value] || titleize(value)
  );
}

function Section({
  title,
  description,
  icon: Icon,
  children,
  actions = null,
  tone = "plain",
  className = "",
}) {
  const toneStyles = {
    readiness: {
      section: "border-emerald-300 bg-emerald-100/70",
      icon: "bg-emerald-200 text-emerald-800",
    },
    profile: {
      section: "border-sky-300 bg-sky-100/70",
      icon: "bg-sky-200 text-sky-800",
    },
    delivery: {
      section: "border-cyan-300 bg-cyan-100/70",
      icon: "bg-cyan-200 text-cyan-800",
    },
    kyb: {
      section: "border-violet-300 bg-violet-100/70",
      icon: "bg-violet-200 text-violet-800",
    },
    recipe: {
      section: "border-[#d8e7e2] bg-[#f8fbfa]",
      icon: "bg-[#dcefe7] text-[#276454]",
    },
    finance: {
      section: "border-[#d8e4ec] bg-[#f4f8fb]",
      icon: "bg-[#dcecf6] text-[#2b6078]",
    },
    settingsMint: {
      section: "border-[#d4eadf] bg-[#edf7f2]",
      icon: "bg-[#dcefe7] text-[#276454]",
    },
    settingsBlue: {
      section: "border-[#d6e7f2] bg-[#eef5fa]",
      icon: "bg-[#dcecf6] text-[#315d74]",
    },
    settingsLavender: {
      section: "border-[#e4daf3] bg-[#f4f0fa]",
      icon: "bg-[#e9e1f4] text-[#5d4a73]",
    },
    plain: {
      section: "border-stone-200 bg-white",
      icon: "bg-stone-100 text-stone-700",
    },
  };

  const activeTone = toneStyles[tone] || toneStyles.plain;
  const compactDashboardTone = [
    "readiness",
    "profile",
    "delivery",
    "kyb",
  ].includes(tone);
  const compactRecipeTone = tone === "recipe";
  const compactFinanceTone = tone === "finance";
  const compactSettingsTone = [
    "settingsMint",
    "settingsBlue",
    "settingsLavender",
  ].includes(tone);
  const sectionClass = compactDashboardTone
    ? `rounded-[20px] border ${activeTone.section} p-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[26px] sm:p-6`
    : compactSettingsTone
    ? `rounded-[20px] border ${activeTone.section} p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[24px] sm:p-5`
    : compactRecipeTone || compactFinanceTone
    ? `rounded-[18px] border ${activeTone.section} p-3 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[24px] sm:p-5`
    : `rounded-[26px] border ${activeTone.section} p-5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:p-6`;

  return (
    <section className={`${sectionClass} ${className}`}>
      <div
        className={
          compactDashboardTone ||
          compactRecipeTone ||
          compactFinanceTone ||
          compactSettingsTone
            ? "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
            : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        }
      >
        <div
          className={
            compactDashboardTone ||
            compactRecipeTone ||
            compactFinanceTone ||
            compactSettingsTone
              ? "flex min-w-0 items-start gap-2 sm:gap-3"
              : "flex items-start gap-3"
          }
        >
          <div
            className={
              compactDashboardTone ||
              compactRecipeTone ||
              compactFinanceTone ||
              compactSettingsTone
                ? `grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl ${activeTone.icon}`
                : `grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${activeTone.icon}`
            }
          >
            <Icon
              className={
                compactDashboardTone ||
                compactRecipeTone ||
                compactFinanceTone ||
                compactSettingsTone
                  ? "h-4 w-4 sm:h-[18px] sm:w-[18px]"
                  : "h-[18px] w-[18px]"
              }
            />
          </div>

          <div
            className={
              compactDashboardTone ||
              compactRecipeTone ||
              compactFinanceTone ||
              compactSettingsTone
                ? "min-w-0 flex-1"
                : ""
            }
          >
            <h2
              className={
                compactDashboardTone
                  ? `${
                      [
                        "Commercial profile",
                        "Delivery Areas",
                        "Business verification (KYB)",
                      ].includes(title)
                        ? "text-[12px] leading-[14px]"
                        : "text-[14px] leading-4"
                    } whitespace-nowrap font-black text-stone-950 sm:whitespace-normal sm:text-lg sm:leading-normal`
                  : compactSettingsTone
                  ? "text-[14px] font-black leading-[18px] text-stone-950 sm:text-[17px] sm:leading-5"
                  : compactRecipeTone || compactFinanceTone
                  ? "text-[13px] font-black leading-4 text-stone-950 sm:text-[17px] sm:leading-5"
                  : "text-lg font-black text-stone-950"
              }
            >
              {title}
            </h2>

            {description ? (
              <p
                className={
                  compactDashboardTone
                    ? "mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5"
                    : compactSettingsTone
                    ? "mt-1 max-w-3xl text-[10px] font-semibold leading-[15px] text-stone-600 sm:text-[11px] sm:font-medium sm:leading-4"
                    : compactRecipeTone || compactFinanceTone
                    ? "mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-[11px] sm:font-medium sm:leading-4"
                    : "mt-1 max-w-3xl text-xs leading-5 text-stone-500"
                }
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions}
      </div>

      <div
        className={
          compactSettingsTone
            ? "mt-4 sm:mt-4"
            : compactDashboardTone || compactRecipeTone || compactFinanceTone
            ? "mt-3 sm:mt-4"
            : "mt-5"
        }
      >
        {children}
      </div>
    </section>
  );
}

function Field({ label, children, compactMobile = false }) {
  return (
    <label className="block">
      <span
        className={
          compactMobile
            ? "mb-1 flex min-h-[22px] items-end text-[8px] font-black uppercase leading-[11px] tracking-[0.1em] text-stone-500 sm:mb-1.5 sm:min-h-0 sm:block sm:text-[10px] sm:leading-normal sm:tracking-[0.12em]"
            : "mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-stone-500"
        }
      >
        {label}
      </span>

      {children}
    </label>
  );
}

const RECIPE_UNITS = [
  "mg",
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "piece",
  "slice",
  "clove",
  "bunch",
  "pinch",
];

const RECIPE_ROLES = [
  "main",
  "base",
  "seasoning",
  "garnish",
  "liquid",
  "fat",
  "binder",
  "leavening",
  "sauce",
  "other",
];

const RECIPE_FOOD_NUTRIENTS = [
  { key: "energy", label: "Energy", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbohydrate", label: "Carbohydrate", unit: "g" },
  { key: "total_fat", label: "Total fat", unit: "g" },
  { key: "saturated_fat", label: "Saturated fat", unit: "g" },
  { key: "fiber", label: "Dietary fibre", unit: "g" },
  { key: "total_sugars", label: "Total sugars", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];

const RECIPE_FOOD_ALLERGENS = [
  { key: "milk", label: "Milk" },
  { key: "egg", label: "Egg" },
  { key: "peanuts", label: "Peanuts" },
  { key: "tree_nuts", label: "Tree nuts" },
  { key: "wheat_gluten", label: "Wheat / gluten" },
  { key: "soy", label: "Soy" },
  { key: "sesame", label: "Sesame" },
  { key: "fish", label: "Fish" },
  { key: "shellfish", label: "Shellfish" },
];

function newRecipeFoodIntelligence() {
  return {
    nutrition: Object.fromEntries(
      RECIPE_FOOD_NUTRIENTS.map((field) => [field.key, ""])
    ),
    allergens: Object.fromEntries(
      RECIPE_FOOD_ALLERGENS.map((field) => [field.key, ""])
    ),
    dietaryClassification: "not_declared",
    basis:
      "Per serving. Host declaration from the submitted Recipe formulation.",
    reason:
      "Host-provided Recipe Food Intelligence declaration for Super Admin review.",
  };
}

function newRecipeIngredient() {
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ingredientQuery: "",
    canonicalIngredientId: "",
    ingredientName: "",
    quantity: 1,
    unit: "g",
    role: "main",
    preparationState: "",
  };
}

function newRecipeStep() {
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    instruction: "",
    timerMinutes: "",
  };
}

function newHostRecipeForm() {
  return {
    title: "",
    description: "",
    cuisine: "",
    course: "",
    heroImageUrl: "",
    baseServings: 4,
    preparationTimeMinutes: 10,
    cookingTimeMinutes: 20,
    difficulty: "easy",
    ingredients: [newRecipeIngredient()],
    steps: [newRecipeStep()],
    foodIntelligence: newRecipeFoodIntelligence(),
  };
}

function buildHostFoodIntelligencePayload(form) {
  const source = form.foodIntelligence || newRecipeFoodIntelligence();

  const nutrition = RECIPE_FOOD_NUTRIENTS.map((field) => {
    const raw = source.nutrition?.[field.key];

    if (raw === "" || raw === null || raw === undefined) {
      return null;
    }

    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount < 0) {
      return null;
    }

    return {
      key: field.key,
      amount,
      unit: field.unit,
    };
  }).filter(Boolean);

  const allergens = RECIPE_FOOD_ALLERGENS.map((field) => {
    const relationship = source.allergens?.[field.key] || "";

    return relationship
      ? {
          key: field.key,
          canonicalName: field.label,
          relationship,
        }
      : null;
  }).filter(Boolean);

  const dietaryClassification = source.dietaryClassification || "not_declared";

  const hasDeclaration =
    nutrition.length > 0 ||
    allergens.length > 0 ||
    dietaryClassification !== "not_declared";

  if (!hasDeclaration) {
    return null;
  }

  return {
    jurisdictionCode: "IN",
    nutrition,
    allergens,
    dietaryClassification,
    basis:
      source.basis?.trim() ||
      "Per serving. Host declaration from the submitted Recipe formulation.",
    reason:
      source.reason?.trim() ||
      "Host-provided Recipe Food Intelligence declaration for Super Admin review.",
  };
}

function hostFoodIntelligenceFromDetail(result) {
  const initial = newRecipeFoodIntelligence();
  const snapshot =
    result?.foodIntelligence?.latest ||
    result?.foodIntelligence?.latestApproved ||
    null;
  const declaration = snapshot?.declaration || null;

  if (!declaration) {
    return initial;
  }

  const nutrition = { ...initial.nutrition };
  for (const item of declaration.nutrition || []) {
    if (Object.hasOwn(nutrition, item.key)) {
      nutrition[item.key] = item.amount ?? "";
    }
  }

  const allergens = { ...initial.allergens };
  for (const item of declaration.allergens || []) {
    if (Object.hasOwn(allergens, item.key)) {
      allergens[item.key] = item.relationship || "";
    }
  }

  return {
    nutrition,
    allergens,
    dietaryClassification: declaration.dietaryClassification || "not_declared",
    basis: declaration.basis || initial.basis,
    reason:
      "Host-provided Recipe Food Intelligence declaration for Super Admin review.",
  };
}

function buildHostRecipePayload(form) {
  const foodIntelligence = buildHostFoodIntelligencePayload(form);

  return {
    name: form.title.trim(),
    description: form.description.trim(),
    cuisine: form.cuisine.trim(),
    course: form.course.trim(),
    tags: ["host-recipe"],
    language: "en",
    heroImageUrl: form.heroImageUrl.trim(),
    title: form.title.trim(),
    recipeDescription: form.description.trim(),
    baseServings: Number(form.baseServings),
    servingSizeAmount: null,
    servingSizeUnit: null,
    finishedYieldAmount: null,
    finishedYieldUnit: null,
    scalingMethod: "linear",
    minRecommendedServings: null,
    maxRecommendedServings: null,
    preparationTimeMinutes: Number(form.preparationTimeMinutes || 0),
    cookingTimeMinutes: Number(form.cookingTimeMinutes || 0),
    difficulty: form.difficulty,
    unsafeIncomplete: false,
    unsafeIncompleteReason: "",
    ingredients: form.ingredients.map((ingredient, index) => ({
      lineNumber: index + 1,
      canonicalIngredientId: ingredient.canonicalIngredientId || "",
      proposedIngredientName: ingredient.canonicalIngredientId
        ? ""
        : ingredient.ingredientQuery.trim(),
      quantity: Number(ingredient.quantity),
      unit: ingredient.unit,
      preparationState: ingredient.preparationState.trim(),
      optional: false,
      role: ingredient.role,
      notes: "",
      substitutionGroupKey: "",
      productConstraints: [],
      scalingRule: {
        type: "linear",
        exponent: 1,
        minMultiplier: null,
        maxMultiplier: null,
      },
    })),
    steps: form.steps.map((step, index) => ({
      stepNumber: index + 1,
      instruction: step.instruction.trim(),
      timerSeconds:
        step.timerMinutes === "" || step.timerMinutes === null
          ? null
          : Math.round(Number(step.timerMinutes) * 60),
      temperatureValue: null,
      temperatureUnit: null,
      equipment: [],
      parallelizable: false,
      prepAhead: false,
    })),
    substitutions: [],
    ...(foodIntelligence ? { foodIntelligence } : {}),
  };
}

function hostRecipeFormFromDetail(result) {
  const recipe = result?.recipe || result || {};
  const dish = recipe?.dish || {};
  const version = recipe?.recipeVersion || {};
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients
    : [];
  const steps = Array.isArray(recipe?.steps) ? recipe.steps : [];

  return {
    title: version.title || dish.name || "",
    description: version.description || dish.description || "",
    cuisine: dish.cuisine || "",
    course: dish.course || "",
    heroImageUrl: dish.heroImageUrl || "",
    baseServings: Number(version.baseServings || 4),
    preparationTimeMinutes: Number(version.preparationTimeMinutes || 0),
    cookingTimeMinutes: Number(version.cookingTimeMinutes || 0),
    difficulty: version.difficulty || "easy",
    ingredients: ingredients.length
      ? ingredients.map((ingredient) => {
          const canonicalName =
            ingredient?.canonicalIngredient?.canonicalName || "";

          return {
            ...newRecipeIngredient(),
            ingredientQuery: canonicalName,
            canonicalIngredientId: ingredient.canonicalIngredientId || "",
            ingredientName: canonicalName,
            quantity: Number(ingredient.quantity || 1),
            unit: ingredient.unit || "g",
            role: ingredient.role || "main",
            preparationState: ingredient.preparationState || "",
          };
        })
      : [newRecipeIngredient()],
    steps: steps.length
      ? steps.map((step) => ({
          ...newRecipeStep(),
          instruction: step.instruction || "",
          timerMinutes:
            step.timerSeconds === null || step.timerSeconds === undefined
              ? ""
              : Number(step.timerSeconds) / 60,
        }))
      : [newRecipeStep()],
    foodIntelligence: hostFoodIntelligenceFromDetail(result),
  };
}

function HostRecipeIngredientRow({
  ingredient,
  onChange,
  onRemove,
  canRemove,
}) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [ingredientInputFocused, setIngredientInputFocused] = useState(false);

  useEffect(() => {
    const query = ingredient.ingredientQuery.trim();

    if (
      ingredient.canonicalIngredientId &&
      query === ingredient.ingredientName
    ) {
      setResults([]);
      return undefined;
    }

    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        const result = await searchCommunityIngredients({
          search: query,
          limit: 10,
        });

        if (!cancelled) {
          setResults(result?.ingredients || []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    ingredient.ingredientQuery,
    ingredient.canonicalIngredientId,
    ingredient.ingredientName,
  ]);

  return (
    <div className="rounded-[14px] border border-[#dbe7e2] bg-[#f5f8f7] p-2 sm:rounded-2xl sm:p-3">
      <div className="grid gap-1.5 sm:gap-2 lg:grid-cols-[minmax(0,1.5fr)_110px_110px_140px_minmax(0,1fr)_44px]">
        <div className="relative">
          <input
            className={recipeInputClass}
            value={ingredient.ingredientQuery}
            onFocus={() => setIngredientInputFocused(true)}
            onBlur={() => setIngredientInputFocused(false)}
            onChange={(event) =>
              onChange({
                ingredientQuery: event.target.value,
                canonicalIngredientId: "",
                ingredientName: "",
              })
            }
            placeholder="Search ingredient"
          />

          {ingredient.canonicalIngredientId ? (
            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-700 sm:text-[10px]">
              Ingredient matched
            </p>
          ) : null}

          {searching ? (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white p-2.5 text-[10px] font-semibold text-stone-500 shadow-lg sm:p-3 sm:text-xs">
              Searching ingredients…
            </div>
          ) : results.length ? (
            <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    onChange({
                      canonicalIngredientId: result.id,
                      ingredientName: result.canonicalName,
                      ingredientQuery: result.canonicalName,
                    });
                    setResults([]);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs font-bold hover:bg-emerald-50"
                >
                  {result.canonicalName}
                </button>
              ))}
            </div>
          ) : ingredientInputFocused &&
            ingredient.ingredientQuery.trim().length >= 2 &&
            !ingredient.canonicalIngredientId ? (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-[10px] font-semibold leading-4 text-sky-800 shadow-lg sm:p-3 sm:text-xs">
              EPANTRY could not match this ingredient yet. It will be included
              with the Recipe for review.
            </div>
          ) : null}
        </div>

        <input
          type="number"
          min="0.001"
          step="any"
          className={recipeInputClass}
          value={ingredient.quantity}
          onChange={(event) =>
            onChange({ quantity: Number(event.target.value) })
          }
          placeholder="Qty"
        />

        <select
          className={recipeInputClass}
          value={ingredient.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
        >
          {RECIPE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>

        <select
          className={recipeInputClass}
          value={ingredient.role}
          onChange={(event) => onChange({ role: event.target.value })}
        >
          {RECIPE_ROLES.map((role) => (
            <option key={role} value={role}>
              {titleize(role)}
            </option>
          ))}
        </select>

        <input
          className={recipeInputClass}
          value={ingredient.preparationState}
          onChange={(event) =>
            onChange({ preparationState: event.target.value })
          }
          placeholder="Prep note"
        />

        <button
          type="button"
          disabled={!canRemove}
          onClick={onRemove}
          className="focus-ring min-h-9 rounded-[10px] border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-xl sm:text-sm"
          aria-label="Remove ingredient"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function parseCsv(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].split(",").map((value) => value.trim());

  return rows.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());

    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""])
    );

    return {
      merchantSku: record.merchantSku || "",

      gtin: record.gtin || "",

      packId: record.packId || null,

      displayName: record.displayName || "",

      brandName: record.brandName || "",

      netQuantityText: record.netQuantityText || "",

      priceMinor: record.priceMinor === "" ? null : Number(record.priceMinor),

      inventoryQuantity:
        record.inventoryQuantity === ""
          ? null
          : Number(record.inventoryQuantity),
    };
  });
}

export default function HostOperationsPage({ section = "dashboard" }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedEditRecipeId = String(
    searchParams.get("editRecipe") || ""
  ).trim();

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [organizationData, setOrganizationData] = useState(null);

  const [readiness, setReadiness] = useState(null);

  const [serviceAreas, setServiceAreas] = useState([]);

  const [sharedDeliveryArea, setSharedDeliveryArea] = useState(null);
  const [previousDeliveryPins, setPreviousDeliveryPins] = useState([]);
  const deliveryAreaEditedRef = useRef(false);

  const [sharedDeliveryLoadError, setSharedDeliveryLoadError] = useState("");

  const [quality, setQuality] = useState(null);

  const [imports, setImports] = useState([]);

  const [finance, setFinance] = useState(null);
  const [financeSummaryError, setFinanceSummaryError] = useState("");
  const [financeSettlementsError, setFinanceSettlementsError] = useState("");
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [deliveredOrdersPage, setDeliveredOrdersPage] = useState(1);
  const [deliveredOrdersTotal, setDeliveredOrdersTotal] = useState(0);
  const [deliveredOrdersError, setDeliveredOrdersError] = useState("");
  const [loadingMoreDelivered, setLoadingMoreDelivered] = useState(false);

  const [settlements, setSettlements] = useState([]);

  const [hostRecipes, setHostRecipes] = useState([]);

  const [campaigns, setCampaigns] = useState([]);

  const [documents, setDocuments] = useState([]);

  const [team, setTeam] = useState(null);

  const [serviceAccounts, setServiceAccounts] = useState([]);

  const [webhooks, setWebhooks] = useState([]);

  const [audit, setAudit] = useState([]);

  const [authorities, setAuthorities] = useState([]);

  const [oneTimeSecret, setOneTimeSecret] = useState("");

  const [organizationForm, setOrganizationForm] = useState({
    displayName: "",

    organizationType: "hybrid",
  });

  const [profileForm, setProfileForm] = useState({
    legalEntityName: "",

    businessType: "private_limited",

    jurisdictionCountryCode: "IN",

    line1: "",

    city: "",

    state: "",

    postalCode: "",

    supportEmail: "",

    supportPhone: "",

    settlementCurrency: "INR",

    fulfillmentTypes: ["delivery"],

    cancellationPolicySummary: "",

    returnPolicySummary: "",
  });

  const [savedProfileForm, setSavedProfileForm] = useState(null);

  const [deliveryAreaForm, setDeliveryAreaForm] = useState({
    postalCodes: "",
  });

  const [kybForm, setKybForm] = useState({
    legalEntityName: "",

    businessType: "private_limited",

    jurisdictionCountryCode: "IN",

    taxRegistrationType: "GSTIN",

    taxRegistrationValue: "",

    documentIds: "",
  });

  const [kybStatus, setKybStatus] = useState("");

  const [commercialProfileRequest, setCommercialProfileRequest] =
    useState(null);

  const [documentForm, setDocumentForm] = useState({
    documentType: "food_license",

    label: "",

    providerKey: "private_storage",

    providerAssetId: "",

    originalFileName: "",

    mimeType: "application/pdf",

    bytes: 0,

    checksumSha256: "",
  });

  const [memberForm, setMemberForm] = useState({
    userId: "",

    roleLabel: "Operations Staff",

    permissionKeys: "catalog.read,orders.read",
  });

  const [csvRows, setCsvRows] = useState([]);

  const [csvName, setCsvName] = useState("");

  const [hostRecipeForm, setHostRecipeForm] = useState(newHostRecipeForm);

  const [editingHostRecipeId, setEditingHostRecipeId] = useState("");

  const [loadingHostRecipeId, setLoadingHostRecipeId] = useState("");

  const [recipeImageUploading, setRecipeImageUploading] = useState(false);

  const [campaignForm, setCampaignForm] = useState({
    authorityGrantId: "",

    title: "",

    objective: "awareness",

    commercialDisclosure: "",

    budgetAmountMinor: 0,
  });

  const [serviceAccountForm, setServiceAccountForm] = useState({
    name: "",

    description: "",

    scopes: "catalog.read,orders.read,finance.read",
  });

  const [webhookForm, setWebhookForm] = useState({
    name: "",

    endpointUrl: "",

    eventTypes: "order.status_changed,settlement.paid",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    if (section === "finance") {
      setFinanceSummaryError("");
      setFinanceSettlementsError("");
      setDeliveredOrdersError("");
      setDeliveredOrders([]);
      setDeliveredOrdersPage(1);
      setDeliveredOrdersTotal(0);
    }

    try {
      const org = await getHostOperationalOrganization();

      setOrganizationData(org);

      if (org?.organization?.id) {
        // Finance uses its summary, payout records and filtered delivered orders.
        // Other Host screens keep their existing loading behaviour unchanged.
        if (section === "finance") {
          const [summaryResult, settlementsResult, deliveredResult] =
            await Promise.allSettled([
              getHostFinanceSummary(),
              listHostSettlements({ page: 1, limit: 20 }),
              listHostOrders({ status: "delivered", page: 1, limit: 8 }),
            ]);
          if (
            summaryResult.status === "fulfilled" &&
            summaryResult.value?.summary
          ) {
            setFinance(summaryResult.value.summary);
          } else {
            setFinance(null);
            setFinanceSummaryError(
              summaryResult.status === "rejected"
                ? getHostOperationsErrorMessage(
                    summaryResult.reason,
                    "Could not load earnings summary."
                  )
                : "Earnings summary was not returned by the server."
            );
          }
          if (
            settlementsResult.status === "fulfilled" &&
            Array.isArray(settlementsResult.value?.settlements)
          ) {
            setSettlements(settlementsResult.value.settlements);
          } else {
            setSettlements([]);
            setFinanceSettlementsError(
              settlementsResult.status === "rejected"
                ? getHostOperationsErrorMessage(
                    settlementsResult.reason,
                    "Could not load payout records."
                  )
                : "Payout records were not returned by the server."
            );
          }
          if (
            deliveredResult.status === "fulfilled" &&
            Array.isArray(deliveredResult.value?.orders)
          ) {
            setDeliveredOrders(deliveredResult.value.orders);
            setDeliveredOrdersTotal(
              Number(deliveredResult.value?.pagination?.total) || 0
            );
          } else {
            setDeliveredOrdersError(
              deliveredResult.status === "rejected"
                ? getHostOperationsErrorMessage(
                    deliveredResult.reason,
                    "Could not load delivered order details."
                  )
                : "Delivered orders were not returned by the server."
            );
          }
          return;
        }
        const results = await Promise.allSettled([
          getHostOperationalReadiness(),

          getHostDataQuality(),

          listHostCatalogImports({
            page: 1,
            limit: 20,
          }),

          getHostFinanceSummary(),

          listHostSettlements({
            page: 1,
            limit: 20,
          }),

          listHostRecipeListings(),

          listHostCampaigns(),

          listHostDocuments(),

          listHostTeam(),

          listHostServiceAccounts(),

          listHostWebhooks(),

          listHostOperationsAudit({
            page: 1,
            limit: 25,
          }),

          listHostBrandAuthorities({
            page: 1,
            limit: 100,
            status: "active",
          }),

          getHostKyb(),

          loadActiveHostServiceAreas(),

          getHostCommercialProfile(),

          // Load the one organization-wide coverage record independently of old
          // product-specific areas (which must remain untouched).
          listServiceAreas({
            page: 1,
            limit: 10,
            status: "all",
            search: SHARED_DELIVERY_AREA_KEY,
          }),
        ]);

        const value = (index) =>
          results[index].status === "fulfilled" ? results[index].value : null;

        setReadiness(value(0)?.readiness || null);

        setQuality(value(1)?.summary || null);

        setImports(value(2)?.jobs || []);

        setFinance(value(3)?.summary || null);

        setSettlements(value(4)?.settlements || []);

        setHostRecipes(value(5)?.recipes || []);

        setCampaigns(value(6)?.campaignBriefs || []);

        setDocuments(value(7)?.documents || []);

        setTeam(value(8) || null);

        setServiceAccounts(value(9)?.serviceAccounts || []);

        setWebhooks(value(10)?.webhooks || []);

        setAudit(value(11)?.events || []);

        setAuthorities(value(12)?.authorities || []);

        const activeAreas = value(14)?.serviceAreas || [];
        setServiceAreas(activeAreas);

        const sharedCoverageResult = value(16);
        const exactSharedArea =
          (sharedCoverageResult?.serviceAreas || []).find(
            (area) => area.serviceAreaKey === SHARED_DELIVERY_AREA_KEY
          ) || null;
        const originalPins = [
          ...new Set(
            activeAreas
              .filter(
                (area) =>
                  area.status === "active" &&
                  area.serviceAreaKey !== SHARED_DELIVERY_AREA_KEY &&
                  (area.fulfillmentTypes || []).includes("delivery")
              )
              .flatMap((area) => area.postalCodes || [])
              .map((pin) => String(pin).trim())
              .filter((pin) => /^[1-9][0-9]{5}$/.test(pin))
          ),
        ].sort();
        setPreviousDeliveryPins(originalPins);
        setSharedDeliveryArea(exactSharedArea);
        const coverageError =
          results[14]?.status === "fulfilled" &&
          results[16]?.status === "fulfilled"
            ? ""
            : "Existing delivery coverage could not be loaded completely. Refresh before saving.";
        setSharedDeliveryLoadError(coverageError);
        if (!deliveryAreaEditedRef.current && !coverageError) {
          // An existing business default takes priority. Until one is saved,
          // restore all unique PINs from legacy per-product coverage for editing.
          const pins = exactSharedArea?.postalCodes?.length
            ? exactSharedArea.postalCodes
            : originalPins;
          setDeliveryAreaForm({ postalCodes: pins.join(", ") });
        }

        setCommercialProfileRequest(value(15)?.latestRequest || null);

        const kyb = value(13)?.kyb;

        setKybStatus(kyb?.status || "");

        if (kyb) {
          setKybForm((current) => ({
            ...current,

            legalEntityName: kyb.legalEntityName || "",

            businessType: kyb.businessType || "private_limited",

            jurisdictionCountryCode: kyb.jurisdictionCountryCode || "IN",

            taxRegistrationType:
              kyb.taxRegistration?.registrationType || "GSTIN",

            documentIds: (kyb.documentIds || []).join(","),
          }));
        }

        const profile = org.operationalProfile;

        if (profile) {
          const nextProfileForm = {
            legalEntityName: profile.legalEntityName || "",

            businessType: profile.businessType || "private_limited",

            jurisdictionCountryCode: profile.jurisdictionCountryCode || "IN",

            line1: profile.registeredAddress?.line1 || "",

            city: profile.registeredAddress?.city || "",

            state: profile.registeredAddress?.state || "",

            postalCode: profile.registeredAddress?.postalCode || "",

            supportEmail: profile.supportEmail || "",

            supportPhone: profile.supportPhone || "",

            settlementCurrency: profile.commercial?.settlementCurrency || "INR",

            fulfillmentTypes: profile.commercial?.fulfillmentTypes?.length
              ? profile.commercial.fulfillmentTypes
              : ["delivery"],

            cancellationPolicySummary:
              profile.commercial?.cancellationPolicySummary || "",

            returnPolicySummary: profile.commercial?.returnPolicySummary || "",
          };

          setProfileForm(nextProfileForm);
          setSavedProfileForm(nextProfileForm);
        } else {
          setSavedProfileForm(null);
        }
      }
    } catch (loadError) {
      setError(
        getHostOperationsErrorMessage(
          loadError,
          "Unable to load Host operations workspace."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMoreDeliveredOrders() {
    if (
      section !== "finance" ||
      loading ||
      loadingMoreDelivered ||
      deliveredOrders.length >= deliveredOrdersTotal
    ) {
      return;
    }
    setLoadingMoreDelivered(true);
    setDeliveredOrdersError("");
    try {
      const nextPage = deliveredOrdersPage + 1;
      const response = await listHostOrders({
        status: "delivered",
        page: nextPage,
        limit: 8,
      });
      if (!Array.isArray(response?.orders)) {
        throw new Error("The server did not return delivered orders.");
      }
      const known = new Set(deliveredOrders.map((order) => String(order.id)));
      const additional = response.orders.filter(
        (order) => !known.has(String(order.id))
      );
      setDeliveredOrders((previous) => [...previous, ...additional]);
      setDeliveredOrdersPage(nextPage);
      setDeliveredOrdersTotal(Number(response.pagination?.total) || 0);
    } catch (loadError) {
      setDeliveredOrdersError(
        getHostOperationsErrorMessage(
          loadError,
          "Could not load more delivered orders."
        )
      );
    } finally {
      setLoadingMoreDelivered(false);
    }
  }

  const activeAuthorities = useMemo(
    () => authorities.filter((authority) => authority.status === "active"),
    [authorities]
  );

  const profileHasUnsavedChanges = useMemo(() => {
    if (!savedProfileForm) return true;

    return JSON.stringify(profileForm) !== JSON.stringify(savedProfileForm);
  }, [profileForm, savedProfileForm]);

  const displayedDeliveryPins = sharedDeliveryArea?.postalCodes?.length
    ? sharedDeliveryArea.postalCodes
    : previousDeliveryPins;

  async function run(action, successMessage = "") {
    setBusy(true);
    setError("");
    setNotice("");
    setOneTimeSecret("");

    try {
      const result = await action();

      if (result?.apiKey) {
        setOneTimeSecret(result.apiKey);
      }

      if (result?.signingSecret) {
        setOneTimeSecret(result.signingSecret);
      }

      if (successMessage) {
        setNotice(successMessage);
      }

      await load();

      return result;
    } catch (operationError) {
      setError(getHostOperationsErrorMessage(operationError));

      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startEditHostRecipe(itemOrId) {
    const recipeVersionId =
      typeof itemOrId === "string" ? itemOrId : itemOrId?.id || "";

    if (!recipeVersionId || busy || loadingHostRecipeId) {
      return;
    }

    if (typeof itemOrId === "object" && itemOrId?.canEdit === false) {
      return;
    }

    setLoadingHostRecipeId(recipeVersionId);
    setError("");
    setNotice("");

    try {
      const detail = await getHostRecipeListing(recipeVersionId);

      if (detail?.policy?.hostCanEdit === false) {
        throw new Error("This historical Recipe lifecycle state is read-only.");
      }

      const listingStatus =
        detail?.listing?.status || itemOrId?.status || "draft";

      setHostRecipeForm(hostRecipeFormFromDetail(detail));
      setEditingHostRecipeId(recipeVersionId);
      setNotice(
        listingStatus === "published"
          ? "Published Recipe loaded. Saving will create a new editable version and submit that revision to Super Admin review; the currently published version stays unchanged until approval."
          : "Recipe loaded for editing. Saving will resubmit the updated Recipe to Super Admin review."
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (operationError) {
      setError(getHostOperationsErrorMessage(operationError));
      clearRecipeEditQuery();
    } finally {
      setLoadingHostRecipeId("");
    }
  }

  useEffect(() => {
    if (
      section !== "recipes" ||
      !requestedEditRecipeId ||
      editingHostRecipeId === requestedEditRecipeId ||
      loadingHostRecipeId
    ) {
      return;
    }

    startEditHostRecipe(requestedEditRecipeId);
  }, [
    section,
    requestedEditRecipeId,
    editingHostRecipeId,
    loadingHostRecipeId,
  ]);

  async function handleHostRecipeImageUpload(file) {
    if (!file || recipeImageUploading) {
      return;
    }

    setRecipeImageUploading(true);
    setError("");
    setNotice("");

    try {
      const uploaded = await uploadRecipeImage({
        file,
        scope: "host",
      });

      setHostRecipeForm((current) => ({
        ...current,
        heroImageUrl: uploaded.heroImageUrl,
      }));

      setNotice(
        editingHostRecipeId
          ? "Recipe image uploaded. Save Recipe Changes to attach it to this listing."
          : "Recipe image uploaded. Submit the Recipe to save it with the listing."
      );
    } catch (uploadError) {
      setError(
        getHostOperationsErrorMessage(
          uploadError,
          "Unable to upload Recipe image."
        )
      );
    } finally {
      setRecipeImageUploading(false);
    }
  }

  function clearRecipeEditQuery() {
    if (!requestedEditRecipeId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("editRecipe");
    setSearchParams(nextParams, { replace: true });
  }

  function cancelHostRecipeEdit() {
    setEditingHostRecipeId("");
    setHostRecipeForm(newHostRecipeForm());
    setNotice("");
    clearRecipeEditQuery();
  }

  const pageTitle =
    {
      dashboard: "Host Operations Center",

      catalog: "Product Catalog",

      quality: "Data Quality",

      finance: "Finance",

      recipes: "Recipe Listings",

      campaigns: "S10 · Campaigns",

      settings: "Business settings",
    }[section] || "Host Operations";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] p-6">
        <div className="grid min-h-[560px] place-items-center rounded-[28px] border border-stone-200 bg-white">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      </main>
    );
  }

  if (!organizationData?.organization && section === "settings") {
    return (
      <main className="bg-[#f7f5ef] p-5 sm:p-7">
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Host workspace
          </p>

          <h1 className="mt-2 text-3xl font-black text-stone-950">
            Team & Documents
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Manage the people who help run your business and keep important
            business records together in your Host workspace.
          </p>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Section
            title="Team members"
            description="Add staff members and manage their business access after your Host organization is ready."
            icon={Users}
          >
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
              Team management becomes available after the business workspace is
              initialized. Your existing Host access stays separate from staff
              assignments.
            </div>
          </Section>

          <Section
            title="Business documents"
            description="Keep the records your business may need for verification and day-to-day operations in one place."
            icon={FileCheck2}
          >
            <div className="rounded-2xl bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-900">
              Business registration, tax records, food licences, bank proof and
              authorization documents can be managed here once setup is
              complete.
            </div>
          </Section>
        </div>

        <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-amber-950">
                Complete the business workspace first
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-800">
                Team and document records belong to your Host organization, so
                Business Operations needs to be initialized before these tools
                can be used.
              </p>
            </div>

            <Link
              to="/host/operations-center"
              className="focus-ring inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white"
            >
              Open Business Operations
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!organizationData?.organization) {
    return (
      <main className="bg-[#f7f5ef] p-5 sm:p-7">
        <Section
          title="Initialize Host organization"
          description="Host access already exists through M02. This creates the M05/M16 tenant operating context; it does not create a Seller or Brand login role."
          icon={Building2}
        >
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              run(
                () => createHostOperationalOrganization(organizationForm),
                "Host organization initialized."
              );
            }}
          >
            <Field label="Organization name">
              <input
                required
                className={inputClass}
                value={organizationForm.displayName}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,

                    displayName: event.target.value,
                  }))
                }
              />
            </Field>

            <Field label="Commercial profile">
              <select
                className={inputClass}
                value={organizationForm.organizationType}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,

                    organizationType: event.target.value,
                  }))
                }
              >
                <option value="seller">Seller</option>

                <option value="brand">Brand</option>

                <option value="restaurant">Restaurant</option>

                <option value="chef">Chef</option>

                <option value="b2b">B2B / Hospitality</option>

                <option value="hybrid">Hybrid</option>
              </select>
            </Field>

            <button disabled={busy} className={`${buttonClass} sm:col-span-2`}>
              <Building2 size={16} />
              Initialize organization
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}
        </Section>
      </main>
    );
  }

  const activationState =
    organizationData?.operationalProfile?.activationState ||
    readiness?.activationState ||
    "onboarding";

  return (
    <main
      className={
        section === "dashboard"
          ? "hops-root min-h-screen w-full min-w-0 bg-[#f7f5ef] p-3 sm:p-7"
          : section === "catalog"
          ? "hpc-root bg-[#f7f6f2] p-3 sm:p-7"
          : section === "quality"
          ? "hdq-root"
          : section === "recipes"
          ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
          : section === "finance"
          ? "hfin-root"
          : section === "settings"
          ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
          : "min-h-screen bg-[#f7f5ef] p-5 sm:p-7"
      }
    >
      {section === "dashboard" ? (
        <style>{hostOperationsDashboardCss}</style>
      ) : null}
      {section === "catalog" ? <style>{hostProductCatalogCss}</style> : null}
      {section === "quality" ? <style>{hostDataQualityCss}</style> : null}
      {section === "finance" ? <style>{hostFinanceCss}</style> : null}
      <section
        className={
          section === "catalog"
            ? "hpc-hero"
            : section === "dashboard"
            ? "hops-hero rounded-[20px] border border-emerald-300 bg-emerald-100/75 p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-6"
            : section === "quality"
            ? "hdq-hero"
            : section === "recipes"
            ? "overflow-hidden rounded-[18px] border border-[#d6e7e1] bg-gradient-to-br from-[#e7f3ed] via-[#edf5f3] to-[#e8f1f8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
            : section === "finance"
            ? "hfin-hero"
            : section === "settings"
            ? "overflow-hidden rounded-[18px] border border-[#d6e7e1] bg-gradient-to-br from-[#e7f3ed] via-[#eef5f8] to-[#f0ebf8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
            : "rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
        }
      >
        <div
          className={
            section === "dashboard"
              ? "flex items-start justify-between gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              : section === "catalog"
              ? "flex items-start justify-between gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              : section === "quality"
              ? "hdq-hero-row"
              : section === "recipes"
              ? "flex items-start justify-between gap-2 sm:gap-4"
              : section === "finance"
              ? "hfin-topline"
              : section === "settings"
              ? "flex items-start justify-between gap-2 sm:gap-4"
              : "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          }
        >
          <div
            className={
              section === "dashboard" ||
              section === "catalog" ||
              section === "quality" ||
              section === "recipes" ||
              section === "finance" ||
              section === "settings"
                ? "min-w-0 flex-1"
                : ""
            }
          >
            <p
              className={
                section === "catalog"
                  ? "hpc-hero-label"
                  : section === "dashboard"
                  ? "text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700 sm:text-xs sm:tracking-[0.14em]"
                  : section === "quality"
                  ? "hdq-eyebrow"
                  : section === "recipes"
                  ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                  : section === "finance"
                  ? "hfin-eyebrow"
                  : section === "settings"
                  ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                  : "text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
              }
            >
              {section === "settings"
                ? "Business setup"
                : section === "catalog"
                ? "Product catalog"
                : section === "quality"
                ? "Catalog health"
                : section === "recipes"
                ? "Recipe workspace"
                : section === "finance"
                ? "Host / Finance"
                : "HOST OPERATIONS"}
            </p>

            <h1
              className={
                section === "catalog"
                  ? "hpc-hero-title"
                  : section === "dashboard"
                  ? "mt-1 whitespace-nowrap text-[18px] font-black leading-5 text-stone-950 sm:mt-2 sm:text-3xl sm:leading-normal"
                  : section === "quality"
                  ? "hdq-title"
                  : section === "recipes"
                  ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                  : section === "finance"
                  ? "hfin-title"
                  : section === "settings"
                  ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                  : "mt-2 text-3xl font-black text-stone-950"
              }
            >
              {pageTitle}
            </h1>

            <p
              className={
                section === "catalog"
                  ? "hpc-hero-meta"
                  : section === "dashboard"
                  ? "mt-1 text-[9px] font-semibold leading-3 text-stone-500 sm:mt-2 sm:text-sm sm:font-normal sm:leading-normal"
                  : section === "quality"
                  ? "hdq-description"
                  : section === "recipes"
                  ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                  : section === "finance"
                  ? "hfin-description"
                  : section === "settings"
                  ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                  : "mt-2 text-sm text-stone-500"
              }
            >
              {section === "quality" ? (
                <>Review product completeness and outstanding details.</>
              ) : section === "recipes" ? (
                <>
                  Create a complete Recipe, send it for review, then track its
                  publishing status in Listing History.
                </>
              ) : section === "finance" ? (
                <>
                  A clear view of delivered orders, settlement progress and
                  payments to your business.
                </>
              ) : section === "settings" ? (
                <>
                  Manage business records, team members and connections to other
                  tools in one place.
                </>
              ) : (
                <>
                  {organizationData.organization.displayName} ·{" "}
                  {section === "catalog" ? "Host status" : "Operational state"}:{" "}
                  {titleize(
                    organizationData.operationalProfile?.activationState
                  )}
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className={
              section === "catalog"
                ? "hpc-refresh focus-ring"
                : section === "dashboard"
                ? "focus-ring ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 bg-sky-100 px-2 py-1.5 text-[10px] font-black text-sky-800 sm:ml-0 sm:gap-2 sm:rounded-xl sm:border-stone-200 sm:bg-transparent sm:px-4 sm:py-2.5 sm:text-sm sm:text-stone-950"
                : section === "quality"
                ? "hdq-refresh"
                : section === "recipes"
                ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                : section === "finance"
                ? "hfin-refresh focus-ring"
                : section === "settings"
                ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-black"
            }
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Refresh
          </button>
        </div>

        {section === "recipes" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              [
                "01",
                "Add Recipe basics",
                "Title, servings, timing and image.",
                "bg-[#e7f3ed] border-[#d4eadf]",
              ],
              [
                "02",
                "Build the Recipe",
                "Add ingredients and cooking steps.",
                "bg-[#e8f1f8] border-[#d6e7f2]",
              ],
              [
                "03",
                "Add food details",
                "Fill only nutrition and allergen details you can support.",
                "bg-[#f0ebf8] border-[#e4daf3]",
              ],
              [
                "04",
                "Send for review",
                "Submit, then track approval in Listing History.",
                "bg-[#e7f3ed] border-[#d4eadf]",
              ],
            ].map(([step, label, helper, tone]) => (
              <div
                key={step}
                className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173f35] text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">
                      {label}
                    </p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">
                      {helper}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {section === "settings" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              [
                "01",
                "Save business records",
                "Keep licences and other important records together.",
                "bg-[#e7f3ed] border-[#d4eadf]",
                "",
              ],
              [
                "02",
                "Add your team",
                "Choose who can work on this business.",
                "bg-[#e8f1f8] border-[#d6e7f2]",
                "",
              ],
              [
                "03",
                "Connect other tools",
                "Only if another app needs EPANTRY data or updates.",
                "bg-[#f0ebf8] border-[#e4daf3]",
                "",
              ],
              [
                "04",
                "Back to operations",
                "Return to day-to-day business management.",
                "bg-[#e7f3ed] border-[#d4eadf]",
                "/host/operations-center",
              ],
            ].map(([step, label, helper, tone, to]) => {
              const card = (
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173f35] text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">
                      {label}
                    </p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">
                      {helper}
                    </p>
                  </div>
                </div>
              );

              return to ? (
                <Link
                  key={step}
                  to={to}
                  className={`focus-ring min-w-0 rounded-[16px] border p-3 shadow-[0_5px_14px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(28,25,23,0.07)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </Link>
              ) : (
                <div
                  key={step}
                  className={`min-w-0 rounded-[16px] border p-3 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </div>
              );
            })}
          </div>
        ) : null}

        {section === "catalog" ? (
          <div className="hpc-steps" aria-label="Catalog checking stages">
            {[
              ["01", "Choose CSV"],
              ["02", "Check products"],
              ["03", "Review results"],
              ["04", "Finish listings"],
            ].map(([step, label]) => (
              <div className="hpc-step" key={step}>
                <span className="hpc-step-index">{step}</span>
                <div className="min-w-0">
                  <p className="hpc-step-name">{label}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={17} className="mt-0.5" />

          {error}
        </div>
      ) : null}

      {notice &&
      !(
        activationState === "active" &&
        notice === "Activation review requested."
      ) ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      {oneTimeSecret ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">
            Shown once — copy now
          </p>

          <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs font-bold text-stone-900">
            {oneTimeSecret}
          </code>
        </div>
      ) : null}

      {section === "dashboard" ? (
        <div className="hops-body mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <Section
            title="Operational readiness"
            description="Your business checks, in one view."
            icon={ShieldCheck}
            tone="readiness"
            className="hops-readiness"
          >
            {readiness?.checks ? (
              <>
                <div className="hops-check-top">
                  <div>
                    <strong>
                      {Object.values(readiness.checks).filter(Boolean).length}
                      <small> / {Object.keys(readiness.checks).length}</small>
                    </strong>
                    <span>Readiness checks passed</span>
                  </div>
                  <div
                    className="hops-check-meter"
                    aria-label="Readiness progress"
                  >
                    <span
                      style={{
                        width: `${Math.round(
                          (100 *
                            Object.values(readiness.checks).filter(Boolean)
                              .length) /
                            Math.max(1, Object.keys(readiness.checks).length)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="hops-readiness-grid">
                  {Object.entries(readiness.checks).map(([key, value]) => (
                    <div
                      className="hops-check-item"
                      data-passed={Boolean(value)}
                      key={key}
                    >
                      {value ? (
                        <CheckCircle2
                          className="hops-check-icon"
                          aria-hidden="true"
                        />
                      ) : (
                        <CircleAlert
                          className="hops-check-icon"
                          aria-hidden="true"
                        />
                      )}
                      <span>{readinessLabel(key)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="hops-section-error" role="status">
                Readiness data is unavailable. Refresh to try again.
              </p>
            )}

            {activationState === "active" ? (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-200/60 p-2.5 text-[10px] font-bold leading-4 text-emerald-900 sm:mt-4 sm:gap-2 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                <ShieldCheck className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" />
                <span className="sm:hidden">
                  Your Host business is live and ready. No further launch review
                  is needed.
                </span>
                <span className="hidden sm:inline">
                  Your Host business is live and ready to operate. No further
                  launch review is needed.
                </span>
              </div>
            ) : activationState === "pending_review" ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                <Send size={16} />
                Activation review requested. Awaiting Super Admin decision.
              </div>
            ) : activationState === "suspended" ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                Host operations are suspended. Super Admin review is required
                before commerce can resume.
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || !readiness?.readyForActivationRequest}
                onClick={() =>
                  run(
                    () =>
                      requestHostOperationalActivation(
                        "Host confirms KYB, catalog, inventory, pricing, serviceability and test-order readiness."
                      ),
                    "Activation review requested."
                  )
                }
                className={`${buttonClass} mt-4`}
              >
                <Send size={15} />
                Request go-live review
              </button>
            )}
          </Section>

          <Section
            title="Commercial profile"
            description="The details customers and business partners rely on."
            icon={Building2}
            tone="profile"
            className="hops-profile"
          >
            <form
              className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    updateHostOperationalProfile({
                      legalEntityName: profileForm.legalEntityName,

                      businessType: profileForm.businessType,

                      jurisdictionCountryCode:
                        profileForm.jurisdictionCountryCode,

                      registeredAddress: {
                        line1: profileForm.line1,

                        line2: "",

                        city: profileForm.city,

                        state: profileForm.state,

                        postalCode: profileForm.postalCode,

                        countryCode: profileForm.jurisdictionCountryCode,
                      },

                      supportEmail: profileForm.supportEmail,

                      supportPhone: profileForm.supportPhone,

                      commercial: {
                        settlementCurrency: profileForm.settlementCurrency,

                        fulfillmentTypes: profileForm.fulfillmentTypes,

                        cancellationPolicySummary:
                          profileForm.cancellationPolicySummary,

                        returnPolicySummary: profileForm.returnPolicySummary,
                      },
                    }),
                  "Operational profile saved."
                );
              }}
            >
              <Field compactMobile label="Legal entity">
                <input
                  required
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.legalEntityName}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      legalEntityName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Business type">
                <select
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.businessType}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      businessType: event.target.value,
                    }))
                  }
                >
                  <option value="private_limited">Private limited</option>

                  <option value="proprietorship">Proprietorship</option>

                  <option value="partnership">Partnership</option>

                  <option value="llp">LLP</option>

                  <option value="public_limited">Public limited</option>

                  <option value="other">Other</option>
                </select>
              </Field>

              <Field compactMobile label="Registered address">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.line1}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      line1: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="City">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.city}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      city: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="State">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.state}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      state: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Store / warehouse postal code">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.postalCode}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      postalCode: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="col-span-2 sm:col-span-1">
                <Field compactMobile label="Cancellation policy">
                  <textarea
                    required
                    rows={3}
                    className={`${inputClass} px-2.5 py-2 text-[11px] sm:px-3.5 sm:py-2.5 sm:text-sm`}
                    value={profileForm.cancellationPolicySummary}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,

                        cancellationPolicySummary: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <Field compactMobile label="Return policy">
                  <textarea
                    required
                    rows={3}
                    className={`${inputClass} px-2.5 py-2 text-[11px] sm:px-3.5 sm:py-2.5 sm:text-sm`}
                    value={profileForm.returnPolicySummary}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,

                        returnPolicySummary: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button
                type="submit"
                disabled={busy || !profileHasUnsavedChanges}
                className={`${buttonClass} col-span-2 ${
                  !profileHasUnsavedChanges
                    ? "cursor-not-allowed opacity-45 shadow-none"
                    : ""
                }`}
              >
                <Save size={15} />
                {profileHasUnsavedChanges ? "Save profile" : "Profile saved"}
              </button>
            </form>
          </Section>

          <Section
            title="Business delivery coverage"
            description="One saved coverage area for new Grocery and Recipe listings."
            icon={MapPinned}
            tone="delivery"
            className="hops-delivery"
          >
            <div className="hops-coverage-layout">
              <form
                className="hops-coverage-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (busy || sharedDeliveryLoadError) return;
                  const rawPins = deliveryAreaForm.postalCodes
                    .split(/[\s,;]+/)
                    .map((value) => value.trim())
                    .filter(Boolean);
                  const postalCodes = [...new Set(rawPins)];
                  if (
                    !postalCodes.length ||
                    postalCodes.some((pin) => !/^[1-9][0-9]{5}$/.test(pin))
                  ) {
                    setError(
                      "Enter valid six-digit Indian delivery PIN codes."
                    );
                    return;
                  }
                  const payload = {
                    name: "Business delivery coverage",
                    inventoryNodeId: null,
                    postalCodes,
                    fulfillmentTypes: ["delivery"],
                  };
                  run(
                    async () => {
                      const result = sharedDeliveryArea
                        ? await updateServiceArea(sharedDeliveryArea.id, {
                            ...payload,
                            status: "active",
                          })
                        : await createServiceArea({
                            ...payload,
                            serviceAreaKey: SHARED_DELIVERY_AREA_KEY,
                          });
                      // Only clear the edit flag after the API confirms a save.
                      deliveryAreaEditedRef.current = false;
                      return result;
                    },
                    sharedDeliveryArea
                      ? "Business coverage updated."
                      : "Business coverage saved."
                  );
                }}
              >
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-bold">
                    Delivery PIN codes
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={deliveryAreaForm.postalCodes}
                    onChange={(event) => {
                      deliveryAreaEditedRef.current = true;
                      setDeliveryAreaForm({ postalCodes: event.target.value });
                    }}
                    className="hops-coverage-pins-input"
                    placeholder="110001, 110002, 110003"
                    aria-label="Business delivery PIN codes"
                  />
                </label>
                {sharedDeliveryLoadError ? (
                  <p role="alert" className="hops-section-error">
                    {sharedDeliveryLoadError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || Boolean(sharedDeliveryLoadError)}
                  className={buttonClass}
                >
                  <Save size={17} />{" "}
                  {sharedDeliveryArea
                    ? "Update delivery coverage"
                    : "Save delivery coverage"}
                </button>
              </form>
              <aside className="hops-coverage-summary" aria-live="polite">
                <strong>{displayedDeliveryPins.length}</strong>
                <p>
                  {sharedDeliveryArea
                    ? "Saved business PIN codes"
                    : "Existing delivery PIN codes"}
                </p>
                <div className="hops-pins">
                  {displayedDeliveryPins.slice(0, 12).map((pin) => (
                    <span key={pin}>{pin}</span>
                  ))}
                  {displayedDeliveryPins.length > 12 ? (
                    <span>+{displayedDeliveryPins.length - 12} more</span>
                  ) : null}
                </div>
                {!sharedDeliveryArea &&
                !sharedDeliveryLoadError &&
                displayedDeliveryPins.length ? (
                  <p className="hops-coverage-note">
                    Previous delivery PINs are restored in the form. Save to
                    make them the business default.
                  </p>
                ) : null}
                {!sharedDeliveryArea &&
                !sharedDeliveryLoadError &&
                !displayedDeliveryPins.length ? (
                  <p className="hops-coverage-note">
                    No delivery PIN codes have been saved yet.
                  </p>
                ) : null}
              </aside>
            </div>
          </Section>

          <Section
            title="Business verification (KYB)"
            description="Business identity and tax details for approval."
            icon={FileCheck2}
            tone="kyb"
            className="hops-kyb"
          >
            {kybStatus ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-3.5 py-3">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-xs sm:tracking-[0.12em]">
                  Current KYB status
                </span>

                <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-stone-800 shadow-sm sm:px-2.5 sm:text-xs">
                  {titleize(kybStatus)}
                </span>

                {kybStatus === "draft" ? (
                  <span className="text-xs font-semibold text-amber-700">
                    Draft is saved, but it will not appear in the Super Admin
                    governance queue until Submit succeeds.
                  </span>
                ) : kybStatus === "submitted" ? (
                  <span className="text-xs font-semibold text-emerald-700">
                    Submitted successfully. This case is now eligible for Super
                    Admin review.
                  </span>
                ) : null}
              </div>
            ) : null}

            {notice === "KYB draft saved." ? (
              commercialProfileRequest?.status === "declared" ? (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-black text-emerald-950">
                    Business Profile is already complete. Submit KYB next.
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                    Your commercial profile has already been saved and Super
                    Admin was notified. Click Submit below to send this KYB for
                    governance review. After submission, wait for Super Admin
                    approval.
                  </p>
                </div>
              ) : (
                <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-sky-950">
                        KYB saved. Complete your Business Profile next.
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-sky-800">
                        Open Business Profile, complete that step and notify
                        Super Admin. Then return here and Submit KYB. After
                        submission, wait for Super Admin review.
                      </p>
                    </div>

                    <Link
                      to="/host/business-profile"
                      className="focus-ring inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white hover:bg-sky-800"
                    >
                      Open Business Profile
                    </Link>
                  </div>
                </div>
              )
            ) : null}

            <form
              className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    saveHostKyb({
                      ...kybForm,

                      documentIds: kybForm.documentIds
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "KYB draft saved."
                );
              }}
            >
              <Field compactMobile label="Legal entity">
                <input
                  required
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={kybForm.legalEntityName}
                  onChange={(event) =>
                    setKybForm((current) => ({
                      ...current,

                      legalEntityName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Tax registration">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={kybForm.taxRegistrationValue}
                  onChange={(event) =>
                    setKybForm((current) => ({
                      ...current,

                      taxRegistrationValue: event.target.value,
                    }))
                  }
                  placeholder="Value is never returned after save"
                />
              </Field>

              <Field compactMobile label="Evidence document IDs">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={kybForm.documentIds}
                  onChange={(event) =>
                    setKybForm((current) => ({
                      ...current,

                      documentIds: event.target.value,
                    }))
                  }
                  placeholder="comma-separated document IDs"
                />
              </Field>

              <div className="grid grid-cols-2 items-end gap-1.5 sm:flex sm:gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className={`${buttonClass} h-9 w-full gap-1 px-1.5 py-0 text-[9px] sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm`}
                >
                  <Save className="h-3.5 w-3.5 sm:h-[15px] sm:w-[15px]" />
                  Save KYB
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await saveHostKyb({
                        ...kybForm,

                        documentIds: kybForm.documentIds
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      });

                      return submitHostKyb();
                    }, "KYB submitted for governance review.")
                  }
                  className="focus-ring h-9 w-full rounded-xl border border-stone-300 px-1.5 py-0 text-[9px] font-black sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Submit
                </button>
              </div>
            </form>
          </Section>
        </div>
      ) : null}

      {section === "catalog" ? (
        <div className="hpc-content">
          <section
            className="hpc-upload-section"
            aria-labelledby="hpc-upload-heading"
          >
            <div className="hpc-upload-main">
              <div className="hpc-section-head">
                <span className="hpc-icon-box" aria-hidden="true">
                  <Upload size={21} />
                </span>
                <div className="min-w-0">
                  <p className="hpc-kicker">01 / CSV upload</p>
                  <h2 id="hpc-upload-heading" className="hpc-section-title">
                    Check your product file
                  </h2>
                  <p className="hpc-section-description">
                    Upload your CSV to match products with EPANTRY.
                  </p>
                </div>
              </div>

              <div className="hpc-upload-card">
                <input
                  id="host-catalog-csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setCsvName(file.name);
                    setCsvRows(parseCsv(await file.text()));
                  }}
                  className="sr-only"
                />
                <label
                  htmlFor="host-catalog-csv-input"
                  className="hpc-dropzone focus-ring"
                >
                  <span className="hpc-drop-icon" aria-hidden="true">
                    <Upload size={24} />
                  </span>
                  <span className="hpc-drop-copy">
                    <span className="hpc-drop-title">
                      {csvRows.length
                        ? "Choose a different CSV"
                        : "Select a CSV file"}
                    </span>
                    <span className="hpc-drop-sub">
                      Your product data stays in review until you check it.
                    </span>
                  </span>
                  <span className="hpc-drop-action" aria-hidden="true">
                    Browse CSV
                  </span>
                </label>
              </div>

              <div className="hpc-upload-footer">
                <div
                  className="hpc-file-status"
                  data-ready={Boolean(csvRows.length)}
                  aria-live="polite"
                >
                  <span className="hpc-status-dot" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="hpc-file-name">
                      {csvRows.length ? csvName : "No file selected"}
                    </p>
                    <p className="hpc-file-helper">
                      {csvRows.length
                        ? `${csvRows.length} products ready for checking`
                        : "CSV files only"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !csvRows.length}
                  onClick={() =>
                    run(
                      () =>
                        createHostCatalogImport({
                          sourceType: "csv_normalized",
                          rows: csvRows,
                        }),
                      "Catalog checked. Review the results below before continuing your listings."
                    )
                  }
                  className="hpc-check-button focus-ring"
                >
                  <PackageSearch size={18} aria-hidden="true" /> Check products
                </button>
              </div>
            </div>

            <aside className="hpc-format" aria-label="CSV column format">
              <p className="hpc-kicker">File reference</p>
              <h3 className="hpc-format-head">CSV columns</h3>
              <p className="hpc-format-description">
                Use these exact column names in your file.
              </p>
              <div className="hpc-columns">
                {[
                  "merchantSku",
                  "gtin",
                  "packId",
                  "displayName",
                  "brandName",
                  "netQuantityText",
                  "priceMinor",
                  "inventoryQuantity",
                ].map((header) => (
                  <code key={header}>{header}</code>
                ))}
              </div>
              <p className="hpc-format-note">
                <CircleAlert
                  size={17}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                Checking a CSV does not publish products.
              </p>
            </aside>
          </section>

          <section
            className="hpc-results"
            aria-labelledby="hpc-results-heading"
          >
            <div className="hpc-results-head">
              <div>
                <p className="hpc-kicker">02 / Results</p>
                <h2 id="hpc-results-heading" className="hpc-section-title">
                  Previous catalog checks
                </h2>
              </div>
              <span className="hpc-results-count">
                {imports.length} {imports.length === 1 ? "check" : "checks"}
              </span>
            </div>
            {imports.length ? (
              <>
                <div className="hpc-table-head" aria-hidden="true">
                  <span>File check</span>
                  <span>Matched</span>
                  <span>Needs review</span>
                  <span>Needs fixing</span>
                  <span>Data quality</span>
                </div>
                <div
                  className="hpc-check-list"
                  aria-label="Catalog check results"
                >
                  {imports.map((job, index) => (
                    <div className="hpc-check-row" key={job.id}>
                      <div className="hpc-check-ident">
                        <span className="hpc-check-index" aria-hidden="true">
                          <FileCheck2 size={19} />
                        </span>
                        <div className="min-w-0">
                          <p className="hpc-check-name">
                            CSV check{" "}
                            {String(imports.length - index).padStart(2, "0")}
                          </p>
                          <p className="hpc-check-meta">
                            {job.rowCount} products checked
                          </p>
                        </div>
                      </div>
                      <div className="hpc-stat" data-state="matched">
                        <strong className="hpc-stat-value">
                          {job.matchedCount}
                        </strong>
                        <span className="hpc-stat-caption">Matched</span>
                      </div>
                      <div className="hpc-stat" data-state="review">
                        <strong className="hpc-stat-value">
                          {job.npiRequiredCount}
                        </strong>
                        <span className="hpc-stat-caption">Needs review</span>
                      </div>
                      <div className="hpc-stat" data-state="fix">
                        <strong className="hpc-stat-value">
                          {job.invalidCount}
                        </strong>
                        <span className="hpc-stat-caption">Needs fixing</span>
                      </div>
                      <div
                        className="hpc-data-score"
                        aria-label={`Data quality ${job.averageDataQualityScore} out of 100`}
                      >
                        <strong className="hpc-score-number">
                          {job.averageDataQualityScore}/100
                        </strong>
                        <span className="hpc-quality-track" aria-hidden="true">
                          <span
                            className="hpc-quality-fill"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  Number(job.averageDataQualityScore) || 0
                                )
                              )}%`,
                            }}
                          />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="hpc-no-results" role="status">
                <strong>No checks yet</strong>
                Your CSV check results will appear here.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {section === "quality" ? (
        <div className="hdq-content">
          <section
            className="hdq-overview"
            aria-labelledby="hdq-overview-title"
          >
            <p className="hdq-section-kicker">01 / Overview</p>
            <h2 className="hdq-section-heading" id="hdq-overview-title">
              Catalog overview
            </h2>
            <div
              className="hdq-metrics"
              aria-label="Product catalog quality summary"
            >
              {[
                ["Products checked", quality?.productsObserved ?? 0],
                ["Ready matches", quality?.canonicalMatches ?? 0],
                ["Need details", quality?.npiRequired ?? 0],
                ["Recipe-ready", quality?.recipeEligible ?? 0],
              ].map(([label, value]) => (
                <div className="hdq-metric" key={label}>
                  <strong className="hdq-metric-number">{value}</strong>
                  <span className="hdq-metric-name">{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="hdq-health"
            aria-label="Catalog completeness and issues"
          >
            <div className="hdq-score">
              <p className="hdq-score-label">Catalog completeness</p>
              <div className="hdq-score-value">
                {quality?.averageDataQualityScore ?? 0}
                <span>/100</span>
              </div>
              <div
                className="hdq-score-bar"
                role="progressbar"
                aria-label="Catalog completeness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.max(
                  0,
                  Math.min(100, Number(quality?.averageDataQualityScore) || 0)
                )}
              >
                <span
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        Number(quality?.averageDataQualityScore) || 0
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="hdq-score-note">
                Average score across checked products.
              </p>
            </div>
            <div className="hdq-issues-panel">
              <h2 className="hdq-issues-heading">Information to review</h2>
              {Object.keys(quality?.issueCounts || {}).length ? (
                <div className="hdq-issues-list">
                  {Object.entries(quality?.issueCounts || {}).map(
                    ([key, value]) => (
                      <div className="hdq-issue" key={key}>
                        <span>{qualityIssueLabel(key)}</span>
                        <strong aria-label={`${value} products`}>
                          {value}
                        </strong>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="hdq-issues-empty">
                  No product-detail issues are showing right now.
                </p>
              )}
            </div>
          </section>

          <div className="hdq-action-bar">
            <div>
              <p className="hdq-action-title">
                Complete missing product details
              </p>
              <p className="hdq-action-description">
                Update listings, then refresh your catalog scores.
              </p>
            </div>
            <Link to="/host/listings/new" className="hdq-cta focus-ring">
              <PackageSearch size={18} aria-hidden="true" />
              Open Listing Studio
            </Link>
          </div>
        </div>
      ) : null}

      {section === "finance" ? (
        <div className="hfin-content">
          <section
            className="hfin-section"
            aria-labelledby="hfin-overview-heading"
          >
            <header className="hfin-section-heading">
              <div>
                <p className="hfin-section-kicker">01 / Current position</p>
                <h2 id="hfin-overview-heading" className="hfin-section-title">
                  Earnings overview
                </h2>
                <p className="hfin-section-description">
                  Know what's been delivered, what's waiting, and what's been
                  paid.
                </p>
              </div>
              <Link className="hfin-manage focus-ring" to="/host/orders">
                Manage orders <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </header>
            {financeSummaryError ? (
              <div className="hfin-error" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{financeSummaryError} Use Refresh to try again.</span>
              </div>
            ) : null}
            <div className="hfin-board" aria-label="Host earnings summary">
              <div className="hfin-lead">
                <span className="hfin-lead-top" aria-hidden="true" />
                <div>
                  <p className="hfin-lead-label">Delivered orders</p>
                  <strong className="hfin-lead-number">
                    {finance ? finance.deliveredOrders ?? 0 : "—"}
                  </strong>
                  <p className="hfin-lead-description">
                    Orders delivered to your customers
                  </p>
                </div>
              </div>
              <div className="hfin-financial">
                <div className="hfin-metric-row">
                  <div className="hfin-metric">
                    <p className="hfin-metric-label">Awaiting settlement</p>
                    <div>
                      <strong className="hfin-metric-number">
                        {finance ? finance.unsettledDeliveredOrders ?? 0 : "—"}
                      </strong>
                      <p className="hfin-metric-description">
                        Delivered, not yet settled
                      </p>
                    </div>
                  </div>
                  <div className="hfin-metric">
                    <p className="hfin-metric-label">Payouts in progress</p>
                    <div>
                      <strong className="hfin-metric-number">
                        {finance ? finance.pendingSettlements ?? 0 : "—"}
                      </strong>
                      <p className="hfin-metric-description">
                        Settlements awaiting completion
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hfin-paid">
                  <div>
                    <strong className="hfin-paid-label">Paid to you</strong>
                    <p className="hfin-paid-description">
                      Total completed payouts
                    </p>
                  </div>
                  <strong className="hfin-paid-amount">
                    {finance ? money(finance.paidNetMinor ?? 0) : "—"}
                  </strong>
                </div>
              </div>
            </div>
            <div
              className="hfin-delivered"
              aria-labelledby="hfin-delivered-heading"
              aria-busy={loadingMoreDelivered}
            >
              <div className="hfin-delivered-heading">
                <div>
                  <h3 id="hfin-delivered-heading">Delivered items</h3>
                  <p>See which products were delivered in each order.</p>
                </div>
                <span className="hfin-delivered-count">
                  {finance ? `${finance.deliveredOrders ?? 0} delivered` : "—"}
                </span>
              </div>
              {deliveredOrdersError ? (
                <div className="hfin-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true" />
                  <span>{deliveredOrdersError} Use Refresh to try again.</span>
                </div>
              ) : null}
              {deliveredOrders.length ? (
                <div role="list" aria-label="Delivered order details">
                  {deliveredOrders.map((order) => {
                    const names = (
                      Array.isArray(order.itemNames) ? order.itemNames : []
                    )
                      .map((name) => String(name || "").trim())
                      .filter(Boolean);
                    const orderDate = order.createdAt
                      ? new Date(order.createdAt)
                      : null;
                    const placedOn =
                      orderDate && !Number.isNaN(orderDate.getTime())
                        ? orderDate.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date unavailable";
                    return (
                      <Link
                        className="hfin-delivered-row focus-ring"
                        role="listitem"
                        key={order.id}
                        to={`/host/orders/${order.id}`}
                        aria-label={`Open delivered order ${String(
                          order.id || ""
                        ).slice(-8)}: ${
                          names.join(", ") || "Items unavailable"
                        }`}
                      >
                        <span>
                          <strong className="hfin-order-products">
                            {names.length
                              ? names.join(" · ")
                              : "Product names unavailable"}
                          </strong>
                          <span className="hfin-order-meta">
                            Order #
                            {String(order.id || "")
                              .slice(-8)
                              .toUpperCase()}{" "}
                            · {order.itemCount || names.length}{" "}
                            {Number(order.itemCount || names.length) === 1
                              ? "item"
                              : "items"}
                          </span>
                        </span>
                        <span className="hfin-order-date">
                          Placed {placedOn}
                        </span>
                        <span className="hfin-order-right">
                          <strong className="hfin-order-amount">
                            {money(
                              order.commercialSnapshot?.itemSubtotalMinor,
                              order.commercialSnapshot?.currency || "INR"
                            )}
                          </strong>
                          <ArrowRight size={17} aria-hidden="true" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : !deliveredOrdersError ? (
                <p className="hfin-delivered-empty">
                  {finance?.deliveredOrders === 0
                    ? "No delivered orders yet."
                    : "Delivered order details are not available yet."}
                </p>
              ) : null}
              {deliveredOrders.length < deliveredOrdersTotal ? (
                <button
                  type="button"
                  className="hfin-delivered-more"
                  onClick={loadMoreDeliveredOrders}
                  disabled={loadingMoreDelivered || loading}
                >
                  {loadingMoreDelivered ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight size={17} aria-hidden="true" />
                  )}
                  {loadingMoreDelivered
                    ? "Loading orders…"
                    : "Show next 8 delivered orders"}
                </button>
              ) : null}
            </div>
            {finance?.policy?.automaticPayoutExecution === false ? (
              <p className="hfin-note" role="note">
                <CircleAlert size={17} aria-hidden="true" />
                <span>
                  Payouts are recorded through settlements; automatic payout
                  execution is not enabled.
                </span>
              </p>
            ) : null}
          </section>

          <section
            className="hfin-section hfin-payouts"
            aria-labelledby="hfin-payouts-heading"
          >
            <header className="hfin-section-heading">
              <div>
                <p className="hfin-section-kicker">02 / Settlement records</p>
                <h2 id="hfin-payouts-heading" className="hfin-section-title">
                  Payout history
                </h2>
                <p className="hfin-section-description">
                  Recorded settlement periods and payment status.
                </p>
              </div>
            </header>
            {financeSettlementsError ? (
              <div className="hfin-error" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{financeSettlementsError} Use Refresh to try again.</span>
              </div>
            ) : settlements.length ? (
              <div
                className="hfin-payout-ledger"
                role="list"
                aria-label="Recorded payout periods"
              >
                {settlements.map((settlement) => (
                  <div
                    className="hfin-payout-row"
                    role="listitem"
                    key={settlement.id}
                  >
                    <div>
                      <strong className="hfin-payout-period">
                        {new Date(settlement.periodStart).toLocaleDateString()}{" "}
                        – {new Date(settlement.periodEnd).toLocaleDateString()}
                      </strong>
                      <p className="hfin-payout-meta">
                        {settlement.lineCount} entries
                      </p>
                    </div>
                    <strong className="hfin-payout-amount">
                      {money(
                        settlement.totals?.netPayableMinor,
                        settlement.currency
                      )}
                    </strong>
                    <span className="hfin-status">
                      {titleize(settlement.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="hfin-empty-layout">
                <div className="hfin-empty">
                  <span className="hfin-empty-icon">
                    <WalletCards size={25} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>No payouts recorded yet</h3>
                    <p>
                      When a settlement is created for delivered orders, its
                      period, amount and status will appear here.
                    </p>
                  </div>
                </div>
                <div className="hfin-steps">
                  <p className="hfin-steps-title">How payouts progress</p>
                  <ol className="hfin-steps-list">
                    <li>
                      <span className="hfin-step-index">01</span>
                      <span>Orders are delivered</span>
                    </li>
                    <li>
                      <span className="hfin-step-index">02</span>
                      <span>Settlement is approved</span>
                    </li>
                    <li>
                      <span className="hfin-step-index">03</span>
                      <span>Payment is recorded</span>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {section === "recipes" ? (
        <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <Section
            title={editingHostRecipeId ? "Edit Recipe" : "Add a Recipe"}
            description={
              editingHostRecipeId
                ? "Update the Recipe below. If it is already live, your changes are sent as a new version for review while the published version stays unchanged."
                : "Add the Recipe details below. After submission, Super Admin reviews it before it can appear publicly. You can track the result in Listing History."
            }
            icon={BookOpen}
            tone="recipe"
            actions={
              editingHostRecipeId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelHostRecipeEdit}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-[10px] border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-black text-stone-700 disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs"
                >
                  <X size={14} aria-hidden="true" />
                  Cancel edit
                </button>
              ) : (
                <span className="rounded-full border border-[#d8d0ec] bg-[#f0ebf8] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#5f4b82] sm:px-3 sm:text-[10px] sm:tracking-[0.1em]">
                  Review required before publishing
                </span>
              )
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <Field compactMobile label="Recipe title">
                <input
                  className={recipeInputClass}
                  value={hostRecipeForm.title}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Example: Jeera Rice"
                />
              </Field>

              <Field compactMobile label="Base servings">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className={recipeInputClass}
                  value={hostRecipeForm.baseServings}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      baseServings: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Cuisine">
                <input
                  className={recipeInputClass}
                  value={hostRecipeForm.cuisine}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      cuisine: event.target.value,
                    }))
                  }
                  placeholder="Indian"
                />
              </Field>

              <Field compactMobile label="Course">
                <input
                  className={recipeInputClass}
                  value={hostRecipeForm.course}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      course: event.target.value,
                    }))
                  }
                  placeholder="Main Course"
                />
              </Field>

              <Field compactMobile label="Preparation minutes">
                <input
                  type="number"
                  min="0"
                  className={recipeInputClass}
                  value={hostRecipeForm.preparationTimeMinutes}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      preparationTimeMinutes: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Cooking minutes">
                <input
                  type="number"
                  min="0"
                  className={recipeInputClass}
                  value={hostRecipeForm.cookingTimeMinutes}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      cookingTimeMinutes: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Difficulty">
                <select
                  className={recipeInputClass}
                  value={hostRecipeForm.difficulty}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      difficulty: event.target.value,
                    }))
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field compactMobile label="Description">
                  <textarea
                    rows={3}
                    className={recipeInputClass}
                    value={hostRecipeForm.description}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Briefly describe the Recipe and how it is served."
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field compactMobile label="Recipe image">
                  <div className="rounded-[14px] border border-dashed border-[#cedfd9] bg-[#f3f8f6] p-2.5 sm:rounded-2xl sm:p-4">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                      {hostRecipeForm.heroImageUrl ? (
                        <img
                          src={hostRecipeForm.heroImageUrl}
                          alt="Recipe preview"
                          className="h-20 w-full rounded-[12px] object-cover sm:h-28 sm:w-44 sm:rounded-2xl"
                        />
                      ) : (
                        <div className="grid h-20 w-full place-items-center rounded-[12px] border border-stone-200 bg-white text-[10px] font-bold text-stone-400 sm:h-28 sm:w-44 sm:rounded-2xl sm:text-xs">
                          No image selected
                        </div>
                      )}

                      <div className="flex-1">
                        <p className="text-[9px] font-semibold leading-[13px] text-stone-500 sm:text-xs sm:font-normal sm:leading-5">
                          Add a clear Recipe photo (JPEG, PNG or WebP, up to 8
                          MB). You can replace it later while editing.
                        </p>

                        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                          <label className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-black text-emerald-800 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs">
                            {recipeImageUploading ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Upload size={14} aria-hidden="true" />
                            )}
                            {hostRecipeForm.heroImageUrl
                              ? "Replace image"
                              : "Upload image"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              disabled={busy || recipeImageUploading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) {
                                  handleHostRecipeImageUpload(file);
                                }
                              }}
                            />
                          </label>

                          {hostRecipeForm.heroImageUrl ? (
                            <button
                              type="button"
                              disabled={busy || recipeImageUploading}
                              onClick={() =>
                                setHostRecipeForm((current) => ({
                                  ...current,
                                  heroImageUrl: "",
                                }))
                              }
                              className="focus-ring rounded-[10px] border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] font-black text-rose-700 disabled:opacity-50 sm:rounded-xl sm:px-3 sm:text-xs"
                            >
                              Remove image
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </Field>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 sm:mt-6 sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-[12px] font-black text-stone-950 sm:text-sm">
                  Ingredients
                </h3>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5">
                  Search each ingredient by name. If EPANTRY cannot find it,
                  your entry is included for review.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHostRecipeForm((current) => ({
                    ...current,
                    ingredients: [
                      ...current.ingredients,
                      newRecipeIngredient(),
                    ],
                  }))
                }
                className="focus-ring shrink-0 rounded-[10px] border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-black text-stone-700 sm:rounded-xl sm:px-3 sm:text-xs"
              >
                + Ingredient
              </button>
            </div>

            <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
              {hostRecipeForm.ingredients.map((ingredient, index) => (
                <HostRecipeIngredientRow
                  key={ingredient.rowId}
                  ingredient={ingredient}
                  canRemove={hostRecipeForm.ingredients.length > 1}
                  onChange={(patch) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      ingredients: current.ingredients.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, ...patch } : item
                      ),
                    }))
                  }
                  onRemove={() =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      ingredients: current.ingredients.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    }))
                  }
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 sm:mt-6 sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-[12px] font-black text-stone-950 sm:text-sm">
                  Cooking steps
                </h3>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5">
                  Add each step in the order the customer should follow.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHostRecipeForm((current) => ({
                    ...current,
                    steps: [...current.steps, newRecipeStep()],
                  }))
                }
                className="focus-ring shrink-0 rounded-[10px] border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-black text-stone-700 sm:rounded-xl sm:px-3 sm:text-xs"
              >
                + Step
              </button>
            </div>

            <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
              {hostRecipeForm.steps.map((step, index) => (
                <div
                  key={step.rowId}
                  className="grid gap-1.5 rounded-[14px] border border-[#dbe7e2] bg-[#f5f8f7] p-2 sm:grid-cols-[44px_minmax(0,1fr)_130px_44px] sm:gap-2 sm:rounded-2xl sm:p-3"
                >
                  <div className="grid h-9 place-items-center rounded-[10px] bg-[#173f35] text-[10px] font-black text-white sm:h-10 sm:rounded-xl sm:text-xs">
                    {index + 1}
                  </div>

                  <input
                    className={recipeInputClass}
                    value={step.instruction}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        steps: current.steps.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, instruction: event.target.value }
                            : item
                        ),
                      }))
                    }
                    placeholder="Describe this step"
                  />

                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={recipeInputClass}
                    value={step.timerMinutes}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        steps: current.steps.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, timerMinutes: event.target.value }
                            : item
                        ),
                      }))
                    }
                    placeholder="Minutes"
                  />

                  <button
                    type="button"
                    disabled={hostRecipeForm.steps.length <= 1}
                    onClick={() =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        steps: current.steps.filter(
                          (_, itemIndex) => itemIndex !== index
                        ),
                      }))
                    }
                    className="focus-ring min-h-9 rounded-[10px] border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-10 sm:rounded-xl sm:text-sm"
                    aria-label="Remove step"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[16px] border border-[#d6e7f2] bg-[#edf4f8] p-3 sm:mt-6 sm:rounded-2xl sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#356b7f] sm:text-[10px]">
                    Recipe food details
                  </p>
                  <h3 className="mt-0.5 text-[12px] font-black text-stone-950 sm:mt-1 sm:text-sm">
                    Nutrition, allergens & dietary information
                  </h3>
                  <p className="mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-600 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5">
                    Add only information you can support from your Recipe or
                    source records. Leave anything you cannot confirm blank;
                    these details are reviewed before publishing.
                  </p>
                </div>

                <span className="inline-flex shrink-0 rounded-full border border-[#d8d0ec] bg-[#f0ebf8] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#5f4b82] sm:px-3 sm:text-[10px]">
                  Checked before publishing
                </span>
              </div>

              <div className="mt-3 sm:mt-5">
                <p className="text-[10px] font-black text-stone-800 sm:text-xs">
                  Nutrition per serving
                </p>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-[11px] sm:font-normal sm:leading-5">
                  Add only values you know. Leave unknown fields blank.
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-4">
                  {RECIPE_FOOD_NUTRIENTS.map((field) => (
                    <label
                      key={field.key}
                      className="rounded-[12px] border border-stone-200 bg-white p-2 text-[10px] font-black text-stone-700 sm:rounded-2xl sm:p-3 sm:text-xs"
                    >
                      {field.label}

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={
                            hostRecipeForm.foodIntelligence?.nutrition?.[
                              field.key
                            ] ?? ""
                          }
                          onChange={(event) =>
                            setHostRecipeForm((current) => ({
                              ...current,
                              foodIntelligence: {
                                ...current.foodIntelligence,
                                nutrition: {
                                  ...current.foodIntelligence.nutrition,
                                  [field.key]: event.target.value,
                                },
                              },
                            }))
                          }
                          placeholder="Unknown"
                          className="focus-ring h-9 min-w-0 flex-1 rounded-[10px] border border-stone-200 px-2.5 text-[11px] outline-none sm:h-10 sm:rounded-xl sm:px-3 sm:text-sm"
                        />

                        <span className="text-[9px] font-black text-stone-500 sm:text-[11px]">
                          {field.unit}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-3 sm:mt-5">
                <p className="text-[10px] font-black text-stone-800 sm:text-xs">
                  Allergen information
                </p>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-[11px] sm:font-normal sm:leading-5">
                  Choose an option only when your Recipe or source records
                  support it. Blank means not declared.
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-3">
                  {RECIPE_FOOD_ALLERGENS.map((field) => (
                    <label
                      key={field.key}
                      className="rounded-[12px] border border-stone-200 bg-white p-2 text-[10px] font-black text-stone-700 sm:rounded-2xl sm:p-3 sm:text-xs"
                    >
                      {field.label}

                      <select
                        value={
                          hostRecipeForm.foodIntelligence?.allergens?.[
                            field.key
                          ] ?? ""
                        }
                        onChange={(event) =>
                          setHostRecipeForm((current) => ({
                            ...current,
                            foodIntelligence: {
                              ...current.foodIntelligence,
                              allergens: {
                                ...current.foodIntelligence.allergens,
                                [field.key]: event.target.value,
                              },
                            },
                          }))
                        }
                        className={`${recipeInputClass} mt-2`}
                      >
                        <option value="">Not declared</option>
                        <option value="contains">Contains</option>
                        <option value="may_contain">May contain</option>
                        <option value="cross_contact">Cross-contact</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:mt-5 sm:gap-4 md:grid-cols-2">
                <Field compactMobile label="Dietary type">
                  <select
                    className={recipeInputClass}
                    value={
                      hostRecipeForm.foodIntelligence?.dietaryClassification ||
                      "not_declared"
                    }
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        foodIntelligence: {
                          ...current.foodIntelligence,
                          dietaryClassification: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="not_declared">Not declared</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggitarian">Eggitarian</option>
                    <option value="non_vegetarian">Non-vegetarian</option>
                  </select>
                </Field>

                <Field compactMobile label="Source / basis">
                  <input
                    className={recipeInputClass}
                    value={hostRecipeForm.foodIntelligence?.basis || ""}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        foodIntelligence: {
                          ...current.foodIntelligence,
                          basis: event.target.value,
                        },
                      }))
                    }
                    placeholder="Example: per serving / Recipe record"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field compactMobile label="Source note">
                    <textarea
                      className={recipeInputClass}
                      rows={3}
                      value={hostRecipeForm.foodIntelligence?.reason || ""}
                      onChange={(event) =>
                        setHostRecipeForm((current) => ({
                          ...current,
                          foodIntelligence: {
                            ...current.foodIntelligence,
                            reason: event.target.value,
                          },
                        }))
                      }
                      placeholder="Briefly note where these values came from."
                    />
                  </Field>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                recipeImageUploading ||
                !hostRecipeForm.title.trim() ||
                hostRecipeForm.baseServings < 1 ||
                hostRecipeForm.ingredients.some(
                  (ingredient) =>
                    (!ingredient.canonicalIngredientId &&
                      !ingredient.ingredientQuery.trim()) ||
                    !(Number(ingredient.quantity) > 0)
                ) ||
                hostRecipeForm.steps.some((step) => !step.instruction.trim())
              }
              onClick={async () => {
                const payload = buildHostRecipePayload(hostRecipeForm);

                const result = await run(
                  () =>
                    editingHostRecipeId
                      ? updateHostRecipeListing(editingHostRecipeId, payload)
                      : createHostRecipeListing(payload),
                  editingHostRecipeId
                    ? "Recipe updated and sent for review."
                    : "Recipe submitted for review."
                );

                if (result) {
                  setEditingHostRecipeId("");
                  setHostRecipeForm(newHostRecipeForm());
                  clearRecipeEditQuery();
                }
              }}
              className={`${buttonClass} mt-3 w-full text-[11px] sm:mt-5 sm:w-auto sm:text-sm`}
            >
              {editingHostRecipeId ? <Save size={15} /> : <Send size={15} />}
              {editingHostRecipeId
                ? "Save Recipe Changes"
                : "Submit Recipe for Review"}
            </button>
          </Section>
        </div>
      ) : null}

      {section === "campaigns" ? (
        <div className="mt-5 space-y-5">
          <Section
            title="Campaign brief"
            description="S10 remains a P2 retail-media seam. M16 records disclosed briefs but does not implement auction, paid ranking, ROAS attribution or ad serving."
            icon={Megaphone}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand authority (optional)">
                <select
                  className={inputClass}
                  value={campaignForm.authorityGrantId}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      authorityGrantId: event.target.value,
                    }))
                  }
                >
                  <option value="">Generic / organization brief</option>

                  {activeAuthorities.map((authority) => (
                    <option key={authority.id} value={authority.id}>
                      {authority.brandId}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Title">
                <input
                  className={inputClass}
                  value={campaignForm.title}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      title: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Objective">
                <select
                  className={inputClass}
                  value={campaignForm.objective}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      objective: event.target.value,
                    }))
                  }
                >
                  <option value="awareness">Awareness</option>

                  <option value="consideration">Consideration</option>

                  <option value="conversion">Conversion</option>

                  <option value="sampling">Sampling</option>

                  <option value="promotion">Promotion</option>
                </select>
              </Field>

              <Field label="Budget minor units">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={campaignForm.budgetAmountMinor}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      budgetAmountMinor: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field label="Commercial disclosure">
                <textarea
                  rows={3}
                  className={inputClass}
                  value={campaignForm.commercialDisclosure}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      commercialDisclosure: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !campaignForm.title ||
                campaignForm.commercialDisclosure.length < 5
              }
              onClick={() => {
                const authority = activeAuthorities.find(
                  (item) => item.id === campaignForm.authorityGrantId
                );

                return run(
                  () =>
                    createHostCampaign({
                      brandId: authority?.brandId || null,

                      authorityGrantId: authority?.id || null,

                      title: campaignForm.title,

                      objective: campaignForm.objective,

                      marketCodes: ["IN"],

                      requestedPlacements: [],

                      startsAt: null,

                      endsAt: null,

                      budgetAmountMinor: campaignForm.budgetAmountMinor,

                      currency: "INR",

                      promotedEntityType: authority ? "brand" : "generic",

                      promotedEntityId: authority?.brandId || "",

                      commercialDisclosure: campaignForm.commercialDisclosure,
                    }),
                  "Campaign brief created."
                );
              }}
              className={`${buttonClass} mt-4`}
            >
              <Megaphone size={15} />
              Create brief
            </button>
          </Section>

          <Section title="Campaign briefs" icon={Megaphone}>
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4"
                >
                  <div>
                    <p className="text-sm font-black">{campaign.title}</p>

                    <p className="mt-1 text-xs text-stone-500">
                      {titleize(campaign.status)} · {campaign.objective}
                    </p>
                  </div>

                  {campaign.status === "draft" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => submitHostCampaign(campaign.id),
                          "Campaign brief submitted to future-media review."
                        )
                      }
                      className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                    >
                      Submit
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      {section === "settings" ? (
        <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2">
          <Section
            title="Business records"
            description="Save licences, registration, bank proof and other records your business may need."
            icon={FileCheck2}
            tone="settingsMint"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () => registerHostDocument(documentForm),
                  "Business document saved."
                );
              }}
            >
              <Field label="Document type" compactMobile>
                <select
                  className={settingsInputClass}
                  value={documentForm.documentType}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      documentType: event.target.value,
                    }))
                  }
                >
                  {[
                    "incorporation",
                    "tax_registration",
                    "food_license",
                    "bank_proof",
                    "authorization_letter",
                    "identity",
                    "address",
                    "other",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {titleize(value)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Document name" compactMobile>
                <input
                  required
                  placeholder="e.g. Delhi Food Licence"
                  className={settingsInputClass}
                  value={documentForm.label}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      label: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Where this file is saved (optional)" compactMobile>
                <input
                  placeholder="Add the saved-file reference if you have one"
                  className={settingsInputClass}
                  value={documentForm.providerAssetId}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      providerAssetId: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="File verification code (optional)" compactMobile>
                <input
                  placeholder="Only if your storage system provides one"
                  className={settingsInputClass}
                  value={documentForm.checksumSha256}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      checksumSha256: event.target.value,
                    }))
                  }
                />
              </Field>

              <button
                disabled={busy}
                className={`${settingsButtonClass} sm:col-span-2`}
              >
                <Save size={14} />
                Save document
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {documents.length ? (
                documents.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-[12px] border border-white/80 bg-white/80 px-3 py-2 text-[10px] font-semibold text-stone-700 sm:rounded-xl sm:text-xs"
                  >
                    <span className="font-black text-stone-950">
                      {document.label}
                    </span>
                    <span className="text-stone-500">
                      {" "}
                      · {titleize(document.status)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No business documents saved yet.
                </p>
              )}
            </div>
          </Section>

          <Section
            title="Team members"
            description="Add people who already have Host access and choose what they are allowed to work on."
            icon={Users}
            tone="settingsBlue"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-3 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    addHostTeamMember({
                      userId: memberForm.userId,

                      roleLabel: memberForm.roleLabel,

                      permissionKeys: memberForm.permissionKeys
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "Team member added."
                );
              }}
            >
              <Field label="Host account ID" compactMobile>
                <input
                  required
                  placeholder="Active Host user"
                  className={settingsInputClass}
                  value={memberForm.userId}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,

                      userId: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Role in your team" compactMobile>
                <input
                  placeholder="e.g. Operations Staff"
                  className={settingsInputClass}
                  value={memberForm.roleLabel}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,

                      roleLabel: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="sm:col-span-1">
                <Field label="What they can access" compactMobile>
                  <input
                    placeholder="Example: orders.read, catalog.read"
                    className={settingsInputClass}
                    value={memberForm.permissionKeys}
                    onChange={(event) =>
                      setMemberForm((current) => ({
                        ...current,

                        permissionKeys: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button
                disabled={busy}
                className={`${settingsButtonClass} sm:col-span-3`}
              >
                <UserPlus size={14} />
                Add team member
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {team?.members?.length ? (
                team.members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-[12px] border border-white/80 bg-white/80 px-3 py-2 sm:rounded-xl"
                  >
                    <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                      {member.roleLabel || "Team member"}
                    </p>
                    <p className="mt-0.5 text-[9px] font-semibold leading-3 text-stone-500 sm:text-[11px] sm:leading-4">
                      {titleize(member.status)} ·{" "}
                      {(member.permissionKeys || []).join(", ") ||
                        "No extra permissions"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No team members added yet.
                </p>
              )}
            </div>
          </Section>

          <Section
            title="Connect another app"
            description="Use this only when your warehouse, accounting or internal app needs secure access to EPANTRY."
            icon={KeyRound}
            tone="settingsLavender"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    createHostServiceAccount({
                      name: serviceAccountForm.name,

                      description: serviceAccountForm.description,

                      scopes: serviceAccountForm.scopes
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "App access created."
                );
              }}
            >
              <Field label="App name" compactMobile>
                <input
                  required
                  placeholder="e.g. Warehouse app"
                  className={settingsInputClass}
                  value={serviceAccountForm.name}
                  onChange={(event) =>
                    setServiceAccountForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="What this app can access" compactMobile>
                <input
                  placeholder="catalog.read, orders.read"
                  className={settingsInputClass}
                  value={serviceAccountForm.scopes}
                  onChange={(event) =>
                    setServiceAccountForm((current) => ({
                      ...current,

                      scopes: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Why are you connecting it?" compactMobile>
                  <input
                    placeholder="Short description"
                    className={settingsInputClass}
                    value={serviceAccountForm.description}
                    onChange={(event) =>
                      setServiceAccountForm((current) => ({
                        ...current,

                        description: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button
                disabled={busy}
                className={`${settingsButtonClass} sm:col-span-2`}
              >
                <KeyRound size={14} />
                Connect app
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {serviceAccounts.length ? (
                serviceAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex min-w-0 flex-col items-stretch gap-2 rounded-[14px] border border-white/80 bg-white/85 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:py-2"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-[11px] font-black text-stone-950 sm:truncate sm:text-xs">
                        {account.name}
                      </p>
                      <p className="mt-1 break-words text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-0.5 sm:truncate sm:text-[11px] sm:leading-normal">
                        {titleize(account.status)} ·{" "}
                        {(account.scopes || []).join(", ") || "No permissions"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => rotateHostServiceAccountCredential(account.id),
                          "New app security key created."
                        )
                      }
                      className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#d9cfeb] bg-white/95 px-3 py-2 text-[10px] font-black text-[#5d4a73] sm:w-auto sm:rounded-xl sm:text-xs"
                    >
                      <RotateCw size={12} />
                      Create new key
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No apps connected yet.
                </p>
              )}
            </div>
          </Section>

          <Section
            title="Send updates to another system"
            description="Use this when another system should automatically receive order or business updates from EPANTRY."
            icon={Webhook}
            tone="settingsBlue"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    createHostWebhook({
                      name: webhookForm.name,

                      endpointUrl: webhookForm.endpointUrl,

                      eventTypes: webhookForm.eventTypes
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "Automatic update connection created."
                );
              }}
            >
              <Field label="Update connection name" compactMobile>
                <input
                  required
                  placeholder="e.g. Order updates"
                  className={settingsInputClass}
                  value={webhookForm.name}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Where should updates go? (URL)" compactMobile>
                <input
                  required
                  placeholder="https://..."
                  className={settingsInputClass}
                  value={webhookForm.endpointUrl}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,

                      endpointUrl: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Which updates should be sent?" compactMobile>
                  <input
                    placeholder="Comma-separated event names"
                    className={settingsInputClass}
                    value={webhookForm.eventTypes}
                    onChange={(event) =>
                      setWebhookForm((current) => ({
                        ...current,

                        eventTypes: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button
                disabled={busy}
                className={`${settingsButtonClass} sm:col-span-2`}
              >
                <Webhook size={14} />
                Start sending updates
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {webhooks.length ? (
                webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="flex min-w-0 flex-col items-stretch gap-2 rounded-[14px] border border-white/80 bg-white/85 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:py-2"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-[11px] font-black text-stone-950 sm:truncate sm:text-xs">
                        {webhook.name}
                      </p>
                      <p className="mt-1 break-all text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-0.5 sm:truncate sm:text-[11px] sm:leading-normal">
                        {webhook.endpointUrl}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => rotateHostWebhookSecret(webhook.id),
                          "Update connection security key reset."
                        )
                      }
                      className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#cfe1eb] bg-white/95 px-3 py-2 text-[10px] font-black text-[#315d74] sm:w-auto sm:rounded-xl sm:text-xs"
                    >
                      <RotateCw size={12} />
                      Reset security key
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No update connections added yet.
                </p>
              )}
            </div>
          </Section>

          <div className="xl:col-span-2">
            <Section
              title="Recent changes"
              description="See recent changes to business records, team members and connected tools."
              icon={ShieldCheck}
              tone="settingsMint"
            >
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {audit.length ? (
                  audit.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-[12px] border border-white/80 bg-white/80 px-3 py-2 sm:rounded-xl"
                    >
                      <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                        {titleize(event.action)}
                      </p>

                      <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[11px]">
                        {titleize(event.entityType)} ·{" "}
                        {new Date(event.occurredAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:col-span-2 sm:text-xs xl:col-span-3">
                    No recent changes recorded yet.
                  </p>
                )}
              </div>
            </Section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
