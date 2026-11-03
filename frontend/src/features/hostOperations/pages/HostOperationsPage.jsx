import {
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

const hostProductCatalogCss = String.raw`
/* Host Product Catalog: scoped editorial design. Other Host pages unaffected. */
.hpc-root{--hpc-forest:#173F35;--hpc-deep:#10352D;--hpc-clay:#C86C42;--hpc-ink:#202421;--hpc-sage:#E6EDE4;--hpc-porcelain:#F7F6F2;min-width:0;width:100%;color:var(--hpc-ink);background:var(--hpc-porcelain);font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.55}
.hpc-root *,.hpc-root *::before,.hpc-root *::after{box-sizing:border-box}
.hpc-root .hpc-hero{position:relative;isolation:isolate;overflow:hidden;min-width:0;background:linear-gradient(110deg,#173F35 0%,#163F34 67%,#255647 100%);color:#FDFBF6;border:0;border-radius:17px 17px 0 0;padding:clamp(22px,2.3vw,34px)!important;box-shadow:none}
.hpc-root .hpc-hero:after{content:'';position:absolute;z-index:-1;right:-8%;top:-110%;width:39%;min-width:250px;aspect-ratio:1;border:1px solid rgba(255,255,255,.14);border-radius:50%;box-shadow:0 0 0 50px rgba(255,255,255,.028),0 0 0 95px rgba(255,255,255,.02);pointer-events:none}
.hpc-root .hpc-hero-label{color:#F5B393!important;letter-spacing:.12em!important;text-transform:uppercase;font-size:13px!important;line-height:1.3!important;font-weight:800!important}
.hpc-root .hpc-hero-title{color:#FCFAF5!important;font-size:clamp(29px,3vw,43px)!important;line-height:1.12!important;letter-spacing:-.045em!important;font-weight:800!important;margin:7px 0 0!important}
.hpc-root .hpc-hero-meta{font-size:14px!important;line-height:1.55!important;color:#DCE9DE!important;margin-top:10px!important;font-weight:500!important}
.hpc-root .hpc-refresh{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;justify-content:center;min-height:43px;padding:9px 15px;background:#FBFAF5!important;border:1px solid #FBFAF5!important;color:#173F35!important;font-size:14px!important;font-weight:750!important;border-radius:9px;cursor:pointer}
.hpc-root .hpc-refresh:hover{background:#F1D9C9!important;border-color:#F1D9C9!important}
.hpc-root .hpc-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin-top:22px;border-top:1px solid rgba(251,250,245,.24);padding-top:17px}
.hpc-root .hpc-step{min-width:0;display:flex;align-items:flex-start;gap:11px;padding:0 15px 0 16px;border-left:1px solid rgba(255,255,255,.19)}
.hpc-root .hpc-step:first-child{border-left:0;padding-left:0}
.hpc-root .hpc-step-index{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#E8A17B;color:#173F35;font-size:13px;font-weight:850}
.hpc-root .hpc-step-name{font-size:15px!important;line-height:1.3!important;font-weight:750!important;color:#FFFDF7!important}
.hpc-root .hpc-step-detail{font-size:13px!important;line-height:1.35!important;color:#D8E7DD!important;margin-top:4px!important}
.hpc-root .hpc-content{margin-top:0;display:grid;gap:26px}
.hpc-root .hpc-upload-section{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(285px,.65fr);border:1px solid #D9E4D8;border-top:4px solid #C86C42;background:#EEF2EB;min-width:0}
.hpc-root .hpc-upload-main{min-width:0;padding:clamp(20px,2.25vw,33px)}
.hpc-root .hpc-section-head{display:flex;align-items:flex-start;gap:13px;min-width:0}
.hpc-root .hpc-icon-box{flex:none;display:grid;place-items:center;width:44px;height:44px;background:#173F35;color:white;border-radius:11px}
.hpc-root .hpc-kicker{font-size:13px!important;line-height:1.35!important;font-weight:800!important;text-transform:uppercase;letter-spacing:.09em!important;color:#AF5632!important}
.hpc-root .hpc-section-title{font-size:clamp(23px,2.1vw,29px)!important;line-height:1.2!important;letter-spacing:-.035em!important;color:#173F35!important;font-weight:800!important;margin:4px 0 0!important}
.hpc-root .hpc-section-description{font-size:15px!important;line-height:1.55!important;color:#4E6256!important;margin-top:8px!important;max-width:650px}
.hpc-root .hpc-dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:177px;margin-top:23px;border:2px dashed #91B4A1;background:#FFFEFA;color:#173F35;border-radius:13px;padding:24px;text-align:center;cursor:pointer;transition:border-color .2s,background-color .2s,transform .2s}
.hpc-root .hpc-dropzone:hover,.hpc-root .hpc-dropzone:focus-within{background:#F8EDE6;border-color:#C86C42}
.hpc-root .hpc-drop-icon{display:grid;place-items:center;width:48px;height:48px;background:#DDEADF;color:#173F35;border-radius:12px}
.hpc-root .hpc-drop-title{font-size:17px!important;line-height:1.35!important;font-weight:800!important;color:#173F35!important}
.hpc-root .hpc-drop-sub{font-size:14px!important;line-height:1.5!important;color:#536D5F!important}
.hpc-root .hpc-upload-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:15px;margin-top:18px}
.hpc-root .hpc-file-status{min-width:0;flex:1;display:flex;align-items:center;gap:12px}
.hpc-root .hpc-status-dot{flex:none;width:11px;height:11px;background:#CF8F70;border-radius:50%}
.hpc-root .hpc-file-status[data-ready=true] .hpc-status-dot{background:#317A55}
.hpc-root .hpc-file-name{font-size:15px!important;line-height:1.35!important;font-weight:750!important;color:#203F33!important;overflow-wrap:anywhere}
.hpc-root .hpc-file-helper{font-size:13px!important;line-height:1.45!important;color:#52675B!important;margin-top:2px!important}
.hpc-root .hpc-check-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:12px 22px;border:1px solid #173F35;background:#173F35;color:#fff;border-radius:10px;font-size:15px!important;font-weight:750!important;cursor:pointer;transition:background .2s,transform .2s}
.hpc-root .hpc-check-button:hover:not(:disabled){background:#255D4C;transform:translateY(-1px)}
.hpc-root .hpc-check-button:disabled{cursor:not-allowed;background:#D3DCD1!important;color:#65786B!important;border-color:#D3DCD1!important;opacity:1!important}
.hpc-root .hpc-format{min-width:0;padding:clamp(20px,2.1vw,30px);background:#F6E8DF;border-left:1px solid #E1CEBF}
.hpc-root .hpc-format-head{font-size:20px!important;line-height:1.3!important;color:#173F35!important;font-weight:800!important;margin:5px 0 15px!important;letter-spacing:-.02em!important}
.hpc-root .hpc-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:12px;row-gap:0;border-top:1px solid #D6BEAE}
.hpc-root .hpc-columns code{display:block;min-width:0;padding:11px 0;border-bottom:1px solid #D6BEAE;font-size:13px!important;font-weight:700!important;color:#244A3A!important;white-space:normal!important;overflow-wrap:anywhere}
.hpc-root .hpc-format-note{display:flex;gap:9px;margin-top:20px;padding-top:13px;border-top:2px solid #C86C42;font-size:14px!important;line-height:1.5!important;color:#5F4839!important}
.hpc-root .hpc-results{min-width:0;border-top:3px solid #173F35;background:#FFFEFA;padding:clamp(20px,2.4vw,34px);border-bottom:1px solid #D6DED2}
.hpc-root .hpc-results-head{display:flex;justify-content:space-between;align-items:end;gap:14px;flex-wrap:wrap;padding-bottom:17px;border-bottom:1px solid #D8E2D7}
.hpc-root .hpc-results-count{font-size:14px!important;font-weight:800!important;color:#173F35!important;padding:7px 12px;border-radius:7px;background:#E4ECE1}
.hpc-root .hpc-check-list{display:grid;gap:0}
.hpc-root .hpc-check-row{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px 26px;align-items:center;padding:22px 0;border-bottom:1px solid #DFE5DA}
.hpc-root .hpc-check-row:last-child{border-bottom:0}
.hpc-root .hpc-check-name{font-size:17px!important;font-weight:800!important;line-height:1.35!important;color:#173F35!important}
.hpc-root .hpc-check-meta{font-size:14px!important;line-height:1.5!important;color:#5C6E63!important;margin-top:6px!important}
.hpc-root .hpc-data-score{display:inline-block;margin-top:12px;padding:5px 10px;border-left:3px solid #C86C42;background:#F6E7DE;color:#86442B;font-size:13px!important;font-weight:750!important}
.hpc-root .hpc-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;background:#E8EEE6;border:1px solid #D1DFD0;border-radius:10px;min-width:0;overflow:hidden}
.hpc-root .hpc-stat{min-width:0;padding:15px 11px;text-align:center;border-left:1px solid #CCD8CC}
.hpc-root .hpc-stat:first-child{border-left:0}
.hpc-root .hpc-stat-value{font-size:27px!important;line-height:1.1!important;font-weight:850!important;color:#173F35!important}
.hpc-root .hpc-stat-caption{font-size:13px!important;line-height:1.3!important;font-weight:700!important;color:#425C4E!important;margin-top:6px!important}
.hpc-root .hpc-stat[data-state=review]{background:#FAEEE6}
.hpc-root .hpc-stat[data-state=review] .hpc-stat-value{color:#A85736!important}
.hpc-root .hpc-stat[data-state=fix]{background:#F9EEEE}
.hpc-root .hpc-stat[data-state=fix] .hpc-stat-value{color:#AD4A40!important}
.hpc-root .hpc-no-results{padding:39px 16px;text-align:center;color:#50675A;font-size:15px!important;line-height:1.6!important}
.hpc-root .hpc-no-results strong{display:block;font-size:18px!important;color:#173F35!important;margin-bottom:5px}
.hpc-root :is(a,button,label,input):focus-visible{outline:3px solid #C86C42!important;outline-offset:3px}
@media(max-width:1000px){.hpc-root .hpc-upload-section{grid-template-columns:minmax(0,1fr)}.hpc-root .hpc-format{border-left:0;border-top:1px solid #DFCBBB}.hpc-root .hpc-check-row{grid-template-columns:1fr}}
@media(max-width:700px){.hpc-root{padding:12px!important;font-size:15px}.hpc-root .hpc-hero{padding:22px 17px!important;border-radius:13px 13px 0 0}.hpc-root .hpc-hero-title{font-size:28px!important}.hpc-root .hpc-hero-meta{font-size:13px!important}.hpc-root .hpc-steps{grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 0;padding-top:14px;margin-top:18px}.hpc-root .hpc-step{padding:0 8px;gap:7px}.hpc-root .hpc-step:nth-child(odd){padding-left:0;border-left:0}.hpc-root .hpc-step-name{font-size:13px!important}.hpc-root .hpc-step-detail{font-size:12.5px!important}.hpc-root .hpc-step-index{width:25px;height:25px;font-size:12px}.hpc-root .hpc-content{gap:19px}.hpc-root .hpc-upload-main,.hpc-root .hpc-format,.hpc-root .hpc-results{padding:19px 16px}.hpc-root .hpc-icon-box{width:39px;height:39px}.hpc-root .hpc-section-title{font-size:23px!important}.hpc-root .hpc-section-description{font-size:14px!important}.hpc-root .hpc-dropzone{min-height:145px;padding:16px;margin-top:17px}.hpc-root .hpc-upload-footer{align-items:stretch}.hpc-root .hpc-check-button{width:100%}.hpc-root .hpc-check-row{padding:17px 0}.hpc-root .hpc-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.hpc-root .hpc-stat{padding:13px 5px}.hpc-root .hpc-stat-value{font-size:23px!important}.hpc-root .hpc-stat-caption{font-size:12.5px!important}}
@media(max-width:380px){.hpc-root .hpc-columns{grid-template-columns:1fr}.hpc-root .hpc-steps{column-gap:5px}.hpc-root .hpc-hero-label{font-size:12px!important}.hpc-root .hpc-refresh{padding:8px 10px;font-size:13px!important}}
@media(prefers-reduced-motion:reduce){.hpc-root *{transition:none!important}}
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
    const response = await listServiceAreas({ page, limit: 100, status: "active" });
    const rows = Array.isArray(response?.serviceAreas) ? response.serviceAreas : [];
    serviceAreas.push(...rows);
    const totalPages = Number(response?.pagination?.pages || response?.pagination?.totalPages || 0);
    if (!rows.length || (totalPages > 0 ? page >= totalPages : rows.length < 100)) {
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
  const compactDashboardTone = ["readiness", "profile", "delivery", "kyb"].includes(tone);
  const compactRecipeTone = tone === "recipe";
  const compactFinanceTone = tone === "finance";
  const compactSettingsTone = ["settingsMint", "settingsBlue", "settingsLavender"].includes(tone);
  const sectionClass = compactDashboardTone
    ? `rounded-[20px] border ${activeTone.section} p-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[26px] sm:p-6`
    : compactSettingsTone
      ? `rounded-[20px] border ${activeTone.section} p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[24px] sm:p-5`
      : compactRecipeTone || compactFinanceTone
        ? `rounded-[18px] border ${activeTone.section} p-3 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[24px] sm:p-5`
        : `rounded-[26px] border ${activeTone.section} p-5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:p-6`;

  return (
    <section className={`${sectionClass} ${className}`}>
      <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3" : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"}>
        <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "flex min-w-0 items-start gap-2 sm:gap-3" : "flex items-start gap-3"}>
          <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone
            ? `grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl ${activeTone.icon}`
            : `grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${activeTone.icon}`}>
            <Icon className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "h-4 w-4 sm:h-[18px] sm:w-[18px]" : "h-[18px] w-[18px]"} />
          </div>

          <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "min-w-0 flex-1" : ""}>
            <h2 className={compactDashboardTone
              ? `${["Commercial profile", "Delivery Areas", "Business verification (KYB)"].includes(title) ? "text-[12px] leading-[14px]" : "text-[14px] leading-4"} whitespace-nowrap font-black text-stone-950 sm:whitespace-normal sm:text-lg sm:leading-normal`
              : compactSettingsTone
                ? "text-[14px] font-black leading-[18px] text-stone-950 sm:text-[17px] sm:leading-5"
                : compactRecipeTone || compactFinanceTone
                  ? "text-[13px] font-black leading-4 text-stone-950 sm:text-[17px] sm:leading-5"
                : "text-lg font-black text-stone-950"}>{title}</h2>

            {description ? (
              <p className={compactDashboardTone
                ? "mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5"
                : compactSettingsTone
                  ? "mt-1 max-w-3xl text-[10px] font-semibold leading-[15px] text-stone-600 sm:text-[11px] sm:font-medium sm:leading-4"
                  : compactRecipeTone || compactFinanceTone
                    ? "mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-[11px] sm:font-medium sm:leading-4"
                  : "mt-1 max-w-3xl text-xs leading-5 text-stone-500"}>
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions}
      </div>

      <div className={compactSettingsTone ? "mt-4 sm:mt-4" : compactDashboardTone || compactRecipeTone || compactFinanceTone ? "mt-3 sm:mt-4" : "mt-5"}>{children}</div>
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
    basis: "Per serving. Host declaration from the submitted Recipe formulation.",
    reason: "Host-provided Recipe Food Intelligence declaration for Super Admin review.",
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

  const dietaryClassification =
    source.dietaryClassification || "not_declared";

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
    dietaryClassification:
      declaration.dietaryClassification || "not_declared",
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
              EPANTRY could not match this ingredient yet. It will be included with the Recipe for review.
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

  const [commercialProfileRequest, setCommercialProfileRequest] = useState(null);

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

  const [hostRecipeForm, setHostRecipeForm] = useState(
    newHostRecipeForm
  );

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

    try {
      const org = await getHostOperationalOrganization();

      setOrganizationData(org);

      if (org?.organization?.id) {
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
        const exactSharedArea = (sharedCoverageResult?.serviceAreas || []).find(
          (area) => area.serviceAreaKey === SHARED_DELIVERY_AREA_KEY
        ) || null;
        const originalPins = [...new Set(
          activeAreas
            .filter((area) =>
              area.status === "active" &&
              area.serviceAreaKey !== SHARED_DELIVERY_AREA_KEY &&
              (area.fulfillmentTypes || []).includes("delivery")
            )
            .flatMap((area) => area.postalCodes || [])
            .map((pin) => String(pin).trim())
            .filter((pin) => /^[1-9][0-9]{5}$/.test(pin))
        )].sort();
        setPreviousDeliveryPins(originalPins);
        setSharedDeliveryArea(exactSharedArea);
        const coverageError = results[14]?.status === "fulfilled" && results[16]?.status === "fulfilled"
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      typeof itemOrId === "string"
        ? itemOrId
        : itemOrId?.id || "";

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
        throw new Error(
          "This historical Recipe lifecycle state is read-only."
        );
      }

      const listingStatus =
        detail?.listing?.status ||
        itemOrId?.status ||
        "draft";

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
            Manage the people who help run your business and keep important business records together in your Host workspace.
          </p>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Section
            title="Team members"
            description="Add staff members and manage their business access after your Host organization is ready."
            icon={Users}
          >
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
              Team management becomes available after the business workspace is initialized. Your existing Host access stays separate from staff assignments.
            </div>
          </Section>

          <Section
            title="Business documents"
            description="Keep the records your business may need for verification and day-to-day operations in one place."
            icon={FileCheck2}
          >
            <div className="rounded-2xl bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-900">
              Business registration, tax records, food licences, bank proof and authorization documents can be managed here once setup is complete.
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
                Team and document records belong to your Host organization, so Business Operations needs to be initialized before these tools can be used.
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
            ? "hpc-root min-h-screen bg-[#f7f6f2] p-3 sm:p-7"
            : section === "quality"
              ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
              : section === "recipes"
                ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
                : section === "finance"
                  ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
                  : section === "settings"
                    ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
                    : "min-h-screen bg-[#f7f5ef] p-5 sm:p-7"
      }
    >
      {section === "dashboard" ? <style>{hostOperationsDashboardCss}</style> : null}
      {section === "catalog" ? <style>{hostProductCatalogCss}</style> : null}
      <section
        className={
          section === "catalog"
            ? "hpc-hero"
            : section === "dashboard"
              ? "hops-hero rounded-[20px] border border-emerald-300 bg-emerald-100/75 p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-6"
              : section === "quality"
                ? "overflow-hidden rounded-[18px] border border-emerald-100 bg-gradient-to-br from-[#e8f4ee] via-[#edf6f3] to-[#e9f1f7] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
                : section === "recipes"
                  ? "overflow-hidden rounded-[18px] border border-[#d6e7e1] bg-gradient-to-br from-[#e7f3ed] via-[#edf5f3] to-[#e8f1f8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
                  : section === "finance"
                    ? "overflow-hidden rounded-[18px] border border-[#d6e7e1] bg-gradient-to-br from-[#e7f3ed] via-[#edf5f3] to-[#e8f1f8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
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
                  ? "flex items-start justify-between gap-2 sm:gap-4"
                  : section === "recipes"
                    ? "flex items-start justify-between gap-2 sm:gap-4"
                    : section === "finance"
                      ? "flex items-start justify-between gap-2 sm:gap-4"
                      : section === "settings"
                        ? "flex items-start justify-between gap-2 sm:gap-4"
                        : "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          }
        >
          <div
            className={
              section === "dashboard" || section === "catalog" || section === "quality" || section === "recipes" || section === "finance" || section === "settings"
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
                      ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                      : section === "recipes"
                        ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                        : section === "finance"
                          ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
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
                        ? "Earnings & settlements"
                        : "HOST OPERATIONS"}
            </p>

            <h1
              className={
                section === "catalog"
                  ? "hpc-hero-title"
                  : section === "dashboard"
                    ? "mt-1 whitespace-nowrap text-[18px] font-black leading-5 text-stone-950 sm:mt-2 sm:text-3xl sm:leading-normal"
                    : section === "quality"
                      ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                      : section === "recipes"
                        ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                        : section === "finance"
                          ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
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
                      ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                      : section === "recipes"
                        ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                        : section === "finance"
                          ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                          : section === "settings"
                            ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                            : "mt-2 text-sm text-stone-500"
              }
            >
              {section === "quality" ? (
                <>See what is ready, what still needs attention, and exactly where to continue.</>
              ) : section === "recipes" ? (
                <>Create a complete Recipe, send it for review, then track its publishing status in Listing History.</>
              ) : section === "finance" ? (
                <>See delivered-order earnings, money waiting to settle, and payout history in one place.</>
              ) : section === "settings" ? (
                <>Manage business records, team members and connections to other tools in one place.</>
              ) : (
                <>
                  {organizationData.organization.displayName} · {section === "catalog" ? "Host status" : "Operational state"}:{" "}
                  {titleize(organizationData.operationalProfile?.activationState)}
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
                    ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                    : section === "recipes"
                      ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                      : section === "finance"
                        ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                        : section === "settings"
                          ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                          : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-black"
            }
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Refresh
          </button>
        </div>

        {section === "quality" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Check your catalog", "See every product EPANTRY has checked.", "bg-[#e8f1f8] border-[#d6e7f2]"],
              ["02", "Read what needs attention", "Spot missing images, nutrition or safety details.", "bg-[#e7f3ed] border-[#d4eadf]"],
              ["03", "Complete product details", "Open Listing Studio and complete the missing information.", "bg-[#f0ebf8] border-[#e4daf3]"],
              ["04", "Refresh this page", "Come back after updates to see the latest catalog health.", "bg-[#e8f4ee] border-[#d4eadf]"],
            ].map(([step, label, helper, tone]) => (
              <div
                key={step}
                className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
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

        {section === "recipes" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Add Recipe basics", "Title, servings, timing and image.", "bg-[#e7f3ed] border-[#d4eadf]"],
              ["02", "Build the Recipe", "Add ingredients and cooking steps.", "bg-[#e8f1f8] border-[#d6e7f2]"],
              ["03", "Add food details", "Fill only nutrition and allergen details you can support.", "bg-[#f0ebf8] border-[#e4daf3]"],
              ["04", "Send for review", "Submit, then track approval in Listing History.", "bg-[#e7f3ed] border-[#d4eadf]"],
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
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">{label}</p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">{helper}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {section === "finance" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Check delivered sales", "See orders that have reached customers.", "bg-[#e7f3ed] border-[#d4eadf]", ""],
              ["02", "See money waiting", "Know what is delivered but not settled yet.", "bg-[#e8f1f8] border-[#d6e7f2]", ""],
              ["03", "Review payouts", "Track each recorded settlement and amount.", "bg-[#f0ebf8] border-[#e4daf3]", ""],
              ["04", "Manage active orders", "Open Orders for work still in progress.", "bg-[#e7f3ed] border-[#d4eadf]", "/host/orders"],
            ].map(([step, label, helper, tone, to]) => {
              const card = (
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173f35] text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">{label}</p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">{helper}</p>
                  </div>
                </div>
              );

              return to ? (
                <Link
                  key={step}
                  to={to}
                  className={`focus-ring min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(28,25,23,0.07)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </Link>
              ) : (
                <div
                  key={step}
                  className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </div>
              );
            })}
          </div>
        ) : null}

        {section === "settings" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Save business records", "Keep licences and other important records together.", "bg-[#e7f3ed] border-[#d4eadf]", ""],
              ["02", "Add your team", "Choose who can work on this business.", "bg-[#e8f1f8] border-[#d6e7f2]", ""],
              ["03", "Connect other tools", "Only if another app needs EPANTRY data or updates.", "bg-[#f0ebf8] border-[#e4daf3]", ""],
              ["04", "Back to operations", "Return to day-to-day business management.", "bg-[#e7f3ed] border-[#d4eadf]", "/host/operations-center"],
            ].map(([step, label, helper, tone, to]) => {
              const card = (
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173f35] text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">{label}</p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">{helper}</p>
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
              ["01", "Choose CSV", "Select a product file"],
              ["02", "Check products", "Match with EPANTRY"],
              ["03", "Review results", "See match status"],
              ["04", "Finish listings", "Set price and stock"],
            ].map(([step, label, helper]) => (
              <div className="hpc-step" key={step}>
                <span className="hpc-step-index">{step}</span>
                <div className="min-w-0">
                  <p className="hpc-step-name">{label}</p>
                  <p className="hpc-step-detail">{helper}</p>
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
                  <div className="hops-check-meter" aria-label="Readiness progress">
                    <span style={{ width: `${Math.round(100 * Object.values(readiness.checks).filter(Boolean).length / Math.max(1, Object.keys(readiness.checks).length))}%` }} />
                  </div>
                </div>
                <div className="hops-readiness-grid">
                  {Object.entries(readiness.checks).map(([key, value]) => (
                    <div className="hops-check-item" data-passed={Boolean(value)} key={key}>
                      {value
                        ? <CheckCircle2 className="hops-check-icon" aria-hidden="true" />
                        : <CircleAlert className="hops-check-icon" aria-hidden="true" />}
                      <span>{readinessLabel(key)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="hops-section-error" role="status">Readiness data is unavailable. Refresh to try again.</p>
            )}

            {activationState === "active" ? (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-200/60 p-2.5 text-[10px] font-bold leading-4 text-emerald-900 sm:mt-4 sm:gap-2 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                <ShieldCheck className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" />
                <span className="sm:hidden">Your Host business is live and ready. No further launch review is needed.</span>
                <span className="hidden sm:inline">Your Host business is live and ready to operate. No further launch review is needed.</span>
              </div>
            ) : activationState === "pending_review" ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                <Send size={16} />
                Activation review requested. Awaiting Super Admin decision.
              </div>
            ) : activationState === "suspended" ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                Host operations are suspended. Super Admin review is required before commerce can resume.
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
                  if (!postalCodes.length || postalCodes.some((pin) => !/^[1-9][0-9]{5}$/.test(pin))) {
                    setError("Enter valid six-digit Indian delivery PIN codes.");
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
                        ? await updateServiceArea(sharedDeliveryArea.id, { ...payload, status: "active" })
                        : await createServiceArea({ ...payload, serviceAreaKey: SHARED_DELIVERY_AREA_KEY });
                      // Only clear the edit flag after the API confirms a save.
                      deliveryAreaEditedRef.current = false;
                      return result;
                    },
                    sharedDeliveryArea ? "Business coverage updated." : "Business coverage saved."
                  );
                }}
              >
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-bold">Delivery PIN codes</span>
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
                  <p role="alert" className="hops-section-error">{sharedDeliveryLoadError}</p>
                ) : null}
                <button type="submit" disabled={busy || Boolean(sharedDeliveryLoadError)} className={buttonClass}>
                  <Save size={17} /> {sharedDeliveryArea ? "Update delivery coverage" : "Save delivery coverage"}
                </button>
              </form>
              <aside className="hops-coverage-summary" aria-live="polite">
                <strong>{displayedDeliveryPins.length}</strong>
                <p>{sharedDeliveryArea ? "Saved business PIN codes" : "Existing delivery PIN codes"}</p>
                <div className="hops-pins">
                  {displayedDeliveryPins.slice(0, 12).map((pin) => <span key={pin}>{pin}</span>)}
                  {displayedDeliveryPins.length > 12 ? (
                    <span>+{displayedDeliveryPins.length - 12} more</span>
                  ) : null}
                </div>
                {!sharedDeliveryArea && !sharedDeliveryLoadError && displayedDeliveryPins.length ? (
                  <p className="hops-coverage-note">Previous delivery PINs are restored in the form. Save to make them the business default.</p>
                ) : null}
                {!sharedDeliveryArea && !sharedDeliveryLoadError && !displayedDeliveryPins.length ? (
                  <p className="hops-coverage-note">No delivery PIN codes have been saved yet.</p>
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
                    Draft is saved, but it will not appear in the Super Admin governance queue until Submit succeeds.
                  </span>
                ) : kybStatus === "submitted" ? (
                  <span className="text-xs font-semibold text-emerald-700">
                    Submitted successfully. This case is now eligible for Super Admin review.
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
                    Your commercial profile has already been saved and Super Admin was notified. Click Submit below to send this KYB for governance review. After submission, wait for Super Admin approval.
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
                        Open Business Profile, complete that step and notify Super Admin. Then return here and Submit KYB. After submission, wait for Super Admin review.
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
                <button type="submit" disabled={busy} className={`${buttonClass} h-9 w-full gap-1 px-1.5 py-0 text-[9px] sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm`}>
                  <Save className="h-3.5 w-3.5 sm:h-[15px] sm:w-[15px]" />
                  Save KYB
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      async () => {
                        await saveHostKyb({
                          ...kybForm,

                          documentIds: kybForm.documentIds
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        });

                        return submitHostKyb();
                      },
                      "KYB submitted for governance review."
                    )
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
          <section className="hpc-upload-section" aria-labelledby="hpc-upload-heading">
            <div className="hpc-upload-main">
              <div className="hpc-section-head">
                <span className="hpc-icon-box" aria-hidden="true"><Upload size={21} /></span>
                <div className="min-w-0">
                  <p className="hpc-kicker">01 / Product upload</p>
                  <h2 id="hpc-upload-heading" className="hpc-section-title">Upload your product CSV</h2>
                  <p className="hpc-section-description">Check multiple products against the EPANTRY catalog.</p>
                </div>
              </div>

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
              <label htmlFor="host-catalog-csv-input" className="hpc-dropzone focus-ring">
                <span className="hpc-drop-icon" aria-hidden="true"><Upload size={23} /></span>
                <span className="hpc-drop-title">{csvRows.length ? "Choose a different CSV" : "Choose product CSV"}</span>
                <span className="hpc-drop-sub">Select a .csv file from your device</span>
              </label>

              <div className="hpc-upload-footer">
                <div className="hpc-file-status" data-ready={Boolean(csvRows.length)} aria-live="polite">
                  <span className="hpc-status-dot" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="hpc-file-name">{csvRows.length ? csvName : "No file selected"}</p>
                    <p className="hpc-file-helper">
                      {csvRows.length ? `${csvRows.length} products ready to check` : "Choose a CSV to begin"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !csvRows.length}
                  onClick={() =>
                    run(
                      () => createHostCatalogImport({ sourceType: "csv_normalized", rows: csvRows }),
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
              <p className="hpc-kicker">CSV format</p>
              <h3 className="hpc-format-head">Use these column headings</h3>
              <div className="hpc-columns">
                {[
                  "merchantSku", "gtin", "packId", "displayName",
                  "brandName", "netQuantityText", "priceMinor", "inventoryQuantity",
                ].map((header) => <code key={header}>{header}</code>)}
              </div>
              <p className="hpc-format-note">
                <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                Catalog checks do not publish products.
              </p>
            </aside>
          </section>

          <section className="hpc-results" aria-labelledby="hpc-results-heading">
            <div className="hpc-results-head">
              <div>
                <p className="hpc-kicker">02 / Check results</p>
                <h2 id="hpc-results-heading" className="hpc-section-title">Catalog checks</h2>
              </div>
              <span className="hpc-results-count">{imports.length} {imports.length === 1 ? "check" : "checks"}</span>
            </div>
            {imports.length ? (
              <div className="hpc-check-list">
                {imports.map((job) => (
                  <div className="hpc-check-row" key={job.id}>
                    <div className="min-w-0">
                      <p className="hpc-check-name">CSV catalog check</p>
                      <p className="hpc-check-meta">{job.rowCount} products checked</p>
                      <span className="hpc-data-score">Data quality: {job.averageDataQualityScore}/100</span>
                    </div>
                    <div className="hpc-stats" aria-label="Catalog check summary">
                      <div className="hpc-stat" data-state="matched">
                        <strong className="hpc-stat-value">{job.matchedCount}</strong>
                        <p className="hpc-stat-caption">Matched</p>
                      </div>
                      <div className="hpc-stat" data-state="review">
                        <strong className="hpc-stat-value">{job.npiRequiredCount}</strong>
                        <p className="hpc-stat-caption">Needs review</p>
                      </div>
                      <div className="hpc-stat" data-state="fix">
                        <strong className="hpc-stat-value">{job.invalidCount}</strong>
                        <p className="hpc-stat-caption">Needs fixing</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="hpc-no-results" role="status">
                <strong>No checks yet</strong>
                Your completed CSV checks will appear here.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {section === "quality" ? (
        <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
          <section className="rounded-[20px] border border-[#d7e7e0] bg-[#eef6f2] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.05)] sm:rounded-[28px] sm:p-5">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-[#d9ece3] text-[#245c4d] sm:h-10 sm:w-10 sm:rounded-2xl">
                <BadgeCheck className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </div>

              <div className="min-w-0">
                <h2 className="text-[14px] font-black leading-4 text-slate-950 sm:text-lg sm:leading-normal">
                  Your catalog health
                </h2>
                <p className="mt-1 max-w-3xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:text-xs sm:leading-5">
                  Use this page to quickly see which products are ready and which product details should be completed next.
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
              {[
                ["Products checked", quality?.productsObserved || 0, "bg-[#e8f1f8] border-[#d6e7f2]", "text-[#315d74]"],
                ["Ready matches", quality?.canonicalMatches || 0, "bg-[#e7f3ed] border-[#d4eadf]", "text-[#245c4d]"],
                ["Need details", quality?.npiRequired || 0, "bg-[#f0ebf8] border-[#e4daf3]", "text-[#5d4a73]"],
                ["Recipe-ready", quality?.recipeEligible || 0, "bg-[#e8f4ee] border-[#d4eadf]", "text-[#245c4d]"],
              ].map(([label, value, tone, textTone]) => (
                <div
                  key={label}
                  className={`rounded-[14px] border p-2.5 sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  <p className={`text-xl font-black leading-none sm:text-2xl ${textTone}`}>
                    {value}
                  </p>
                  <p className={`mt-1.5 text-[8px] font-black uppercase leading-[10px] tracking-[0.06em] sm:mt-2 sm:text-[10px] sm:leading-normal ${textTone}`}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[16px] border border-[#d8e6ed] bg-[#edf4f8] p-3 sm:mt-4 sm:rounded-[22px] sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#35695b] sm:text-[10px]">
                    Catalog completeness
                  </p>
                  <p className="mt-0.5 text-[18px] font-black leading-5 text-slate-950 sm:mt-1 sm:text-2xl sm:leading-normal">
                    {quality?.averageDataQualityScore || 0}/100
                  </p>
                </div>
                <p className="max-w-[210px] text-right text-[8px] font-semibold leading-[11px] text-slate-600 sm:max-w-sm sm:text-[11px] sm:leading-4">
                  Higher completeness means more product information is ready for catalog and recipe use.
                </p>
              </div>

              {Object.keys(quality?.issueCounts || {}).length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                  {Object.entries(quality?.issueCounts || {}).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-[#dbe7e2] bg-white/85 px-2 py-1 text-[8px] font-black leading-3 text-[#46635b] sm:px-3 sm:text-[10px]"
                    >
                      {qualityIssueLabel(key)} · {value}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 rounded-xl bg-white/70 px-3 py-2 text-[9px] font-bold text-emerald-800 sm:mt-3 sm:text-xs">
                  No product-detail issues are showing right now.
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 rounded-[16px] border border-[#d4eadf] bg-[#e8f4ee] p-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[22px] sm:p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-[#173f35] sm:text-sm">
                  Next step: complete the flagged product details
                </p>
                <p className="mt-0.5 text-[8px] font-semibold leading-[11px] text-slate-700/70 sm:mt-1 sm:text-[11px] sm:leading-4">
                  Open Listing Studio to review and complete product details, then return here and refresh.
                </p>
              </div>

              <Link
                to="/host/listings/new"
                className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[11px] bg-[#17624f] px-3 py-2 text-[9px] font-black text-white shadow-sm transition hover:bg-[#124e3f] sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
              >
                <PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Open Listing Studio
              </Link>
            </div>
          </section>
        </div>
      ) : null}

      {section === "finance" ? (
        <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <Section
            title="Earnings overview"
            description="A quick view of delivered orders, money still waiting to settle, and what has already been paid."
            icon={WalletCards}
            tone="finance"
          >
            <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
              {[
                ["Delivered orders", finance?.deliveredOrders || 0, "bg-white/85 border-[#dce7e3]"],
                ["Awaiting settlement", finance?.unsettledDeliveredOrders || 0, "bg-[#e7f3ed] border-[#d4eadf]"],
                ["Payouts in progress", finance?.pendingSettlements || 0, "bg-[#f0ebf8] border-[#e4daf3]"],
                ["Paid to you", money(finance?.paidNetMinor || 0), "bg-[#e8f1f8] border-[#d6e7f2]"],
              ].map(([label, value, tone]) => (
                <div
                  key={label}
                  className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.03)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  <p className="text-[18px] font-black leading-5 text-stone-950 sm:text-xl">{value}</p>
                  <p className="mt-1 text-[8px] font-black uppercase leading-[11px] tracking-[0.06em] text-stone-500 sm:text-[10px] sm:leading-4">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[14px] border border-[#d6e7e1] bg-[#e7f3ed] px-3 py-2.5 sm:mt-4 sm:rounded-[18px] sm:px-4 sm:py-3">
              <p className="text-[9px] font-semibold leading-[13px] text-[#35564d] sm:text-xs sm:leading-5">
                For now, EPANTRY shows the merchandise amount from delivered orders. Any future platform fees or tax deductions will appear here once they are configured.
              </p>
            </div>
          </Section>

          <Section
            title="Payout history"
            description="See each recorded settlement period and the amount prepared or paid for your business."
            icon={WalletCards}
            tone="finance"
          >
            <div className="space-y-2 sm:space-y-3">
              {settlements.length ? (
                settlements.map((settlement) => (
                  <div
                    key={settlement.id}
                    className="rounded-[14px] border border-[#dde6e3] bg-white/90 p-3 shadow-[0_4px_12px_rgba(28,25,23,0.025)] sm:rounded-[18px] sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black leading-4 text-stone-950 sm:text-sm">
                          {new Date(settlement.periodStart).toLocaleDateString()} – {new Date(settlement.periodEnd).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-[9px] font-semibold leading-[13px] text-stone-500 sm:text-xs sm:leading-5">
                          {settlement.lineCount} entries · Amount {money(settlement.totals?.netPayableMinor, settlement.currency)}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-[#e7f3ed] px-2 py-1 text-[8px] font-black text-[#276454] sm:px-2.5 sm:text-[10px]">
                        {titleize(settlement.status)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[14px] border border-[#d8e4ec] bg-[#e8f1f8] px-3 py-3 sm:rounded-[18px] sm:px-4 sm:py-4">
                  <p className="text-[10px] font-black text-[#2b6078] sm:text-sm">No payouts recorded yet</p>
                  <p className="mt-1 text-[9px] font-semibold leading-[13px] text-slate-600 sm:text-xs sm:leading-5">
                    After delivered orders are grouped into a settlement, the payout period and amount will appear here.
                  </p>
                </div>
              )}
            </div>
          </Section>
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
                          Add a clear Recipe photo (JPEG, PNG or WebP, up to 8 MB). You can replace it later while editing.
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
                  Search each ingredient by name. If EPANTRY cannot find it, your entry is included for review.
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
                    Add only information you can support from your Recipe or source records. Leave anything you cannot confirm blank; these details are reviewed before publishing.
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
                  Choose an option only when your Recipe or source records support it. Blank means not declared.
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
                      hostRecipeForm.foodIntelligence
                        ?.dietaryClassification || "not_declared"
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
                    (
                      !ingredient.canonicalIngredientId &&
                      !ingredient.ingredientQuery.trim()
                    ) ||
                    !(Number(ingredient.quantity) > 0)
                ) ||
                hostRecipeForm.steps.some(
                  (step) => !step.instruction.trim()
                )
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
              {editingHostRecipeId ? (
                <Save size={15} />
              ) : (
                <Send size={15} />
              )}
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
                    <span className="font-black text-stone-950">{document.label}</span>
                    <span className="text-stone-500"> · {titleize(document.status)}</span>
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
                      {titleize(member.status)} · {(member.permissionKeys || []).join(", ") || "No extra permissions"}
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

              <button disabled={busy} className={`${settingsButtonClass} sm:col-span-2`}>
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
                      <p className="break-words text-[11px] font-black text-stone-950 sm:truncate sm:text-xs">{account.name}</p>
                      <p className="mt-1 break-words text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-0.5 sm:truncate sm:text-[11px] sm:leading-normal">
                        {titleize(account.status)} · {(account.scopes || []).join(", ") || "No permissions"}
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

              <button disabled={busy} className={`${settingsButtonClass} sm:col-span-2`}>
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
                      <p className="break-words text-[11px] font-black text-stone-950 sm:truncate sm:text-xs">{webhook.name}</p>
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
                      <p className="text-[10px] font-black text-stone-950 sm:text-xs">{titleize(event.action)}</p>

                      <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[11px]">
                        {titleize(event.entityType)} · {new Date(event.occurredAt).toLocaleString()}
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
