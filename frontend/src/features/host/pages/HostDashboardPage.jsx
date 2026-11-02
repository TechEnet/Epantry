import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  ArrowRight,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  ChevronDown,
  Clapperboard,
  FileSearch,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  WalletCards,
  Warehouse,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getHostEarningsOverview,
} from '../../hostOperations/services/hostOperations.service'

import {
  isHostPathAllowed,
  normalizeHostWorkspaceType,
} from '../hostWorkspace.config'

const hostDashboardStyles = String.raw`
/* Host Dashboard only: full-width, editorial layout. No global overrides. */
.ehd-page {
  --ehd-forest:#173F35;--ehd-deep:#10352D;--ehd-charcoal:#202421;
  --ehd-clay:#C86C42;--ehd-porcelain:#F7F6F2;--ehd-sage:#DCE0CF;
  --ehd-muted:#536358;--ehd-line:#D1DACE;
  box-sizing:border-box;width:100%;max-width:none;min-width:0;min-height:100%;
  padding:clamp(16px,1.8vw,30px) clamp(14px,2vw,32px) 48px;
  background:var(--ehd-porcelain);color:var(--ehd-charcoal);
  font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif;font-size:16px;line-height:1.5;
}
.ehd-page *, .ehd-page *::before,.ehd-page *::after {box-sizing:border-box}
.ehd-page a {color:inherit;text-decoration:none}
.ehd-page a:focus-visible,.ehd-page button:focus-visible {outline:3px solid var(--ehd-clay);outline-offset:3px}
.ehd-wrap {max-width:none;width:100%;margin:0;min-width:0}
.ehd-eyebrow {display:flex;align-items:center;gap:9px;margin:0;color:#AA5534;font-size:13px;font-weight:800;letter-spacing:.085em;text-transform:uppercase;line-height:1.4}
.ehd-eyebrow::before {content:'';height:2px;width:23px;flex:none;background:currentColor}
.ehd-eyebrow--light {color:#F1BA9F}
.ehd-intro {display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,.82fr);min-height:245px;overflow:hidden;border:1px solid #CED9CC;border-radius:17px;background:#E8EDE4}
.ehd-welcome {position:relative;isolation:isolate;background:linear-gradient(115deg,#10382F 0%,#194B3D 100%);padding:clamp(27px,3.1vw,47px);color:#fff;overflow:hidden;min-width:0}
.ehd-welcome::before {position:absolute;content:'';width:360px;height:360px;right:-160px;top:-170px;border:1px solid #FFFFFF25;border-radius:50%;box-shadow:0 0 0 42px #FFFFFF05,0 0 0 83px #FFFFFF04;z-index:-1;pointer-events:none}
.ehd-welcome-top {display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:19px}
.ehd-status {display:inline-flex;align-items:center;font-size:13px;font-weight:750;color:#E8F3EB;padding:5px 10px;border:1px solid #FFFFFF30;background:#FFFFFF16;border-radius:99px}
.ehd-welcome-label {margin:0 0 5px;color:#D4E2D9;font-size:15px}
.ehd-welcome h1 {margin:0;color:#FFFDF8;font-size:clamp(34px,3.4vw,55px)!important;font-weight:850;letter-spacing:-.05em;line-height:1.11!important;overflow-wrap:anywhere}
.ehd-welcome-desc {max-width:610px;margin:14px 0 0;color:#E4EEE7;font-size:16px;line-height:1.6}
.ehd-intro-side {min-width:0;padding:clamp(24px,2.8vw,40px);display:flex;flex-direction:column;justify-content:space-between;gap:17px;border-left:4px solid var(--ehd-clay);background:#E8ECE3}
.ehd-side-label {margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#A45130}
.ehd-side-heading {font-size:clamp(23px,2.4vw,34px)!important;line-height:1.2!important;font-weight:850;letter-spacing:-.04em;margin:0;color:var(--ehd-forest)}
.ehd-side-desc {font-size:15px;line-height:1.55;color:#526359;margin:9px 0 0;max-width:470px}
.ehd-intro-link {display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:11px 17px;border-radius:8px;background:var(--ehd-clay);color:#fff!important;font-weight:800;font-size:15px;transition:background .2s,transform .2s}
.ehd-intro-link:hover {background:#A94F2B;transform:translateY(-2px)}
.ehd-intro-link svg {flex:none}
/* Earnings: one editorial band, not another giant dark card. */
.ehd-earnings {margin-top:18px;border:1px solid #CED8CE;border-top:3px solid var(--ehd-clay);background:#FCFBF8;overflow:hidden;border-radius:10px}
.ehd-earnings-link {display:grid;grid-template-columns:minmax(270px,.9fr) minmax(0,1.6fr);min-width:0;transition:background .2s}
.ehd-earnings-link:hover {background:#FAF1EA}
.ehd-earnings-lead {padding:22px clamp(20px,2.2vw,32px);border-right:1px solid #D6DED4;min-width:0}
.ehd-earnings-title {display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 6px;color:#A35434;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.075em}
.ehd-live {font-size:13px;font-weight:650;text-transform:none;letter-spacing:0;color:#577163;border-left:1px solid #CDD7CB;padding-left:9px}
.ehd-earnings-value {font-size:clamp(30px,2.9vw,43px);font-weight:850;line-height:1.15;letter-spacing:-.045em;color:var(--ehd-forest);margin:0;overflow-wrap:anywhere}
.ehd-earnings-help {font-size:14px;color:var(--ehd-muted);margin:8px 0 0}
.ehd-earnings-detail {display:flex;flex-direction:column;min-width:0;padding:20px clamp(20px,2vw,30px) 16px;background:#E6ECE1}
.ehd-earning-stats {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));flex:1}
.ehd-stat {min-width:0;padding:7px 17px;border-right:1px solid #C5D3C5}
.ehd-stat:first-child {padding-left:0}
.ehd-stat:last-child {border-right:0;padding-right:0}
.ehd-stat-label {font-size:14px;font-weight:750;color:#4F6354;margin:0}
.ehd-stat-value {font-size:clamp(19px,1.75vw,26px);font-weight:850;letter-spacing:-.03em;color:var(--ehd-forest);margin:6px 0 0;line-height:1.25;overflow-wrap:anywhere}
.ehd-earnings-footer {border-top:1px solid #C5D3C5;margin-top:12px;padding-top:12px;display:flex;gap:16px;align-items:center;justify-content:space-between}
.ehd-earnings-footer p {color:#51675A;font-size:13px;margin:0}
.ehd-earnings-open {display:inline-flex;gap:7px;align-items:center;color:var(--ehd-forest);font-size:14px;font-weight:800;white-space:nowrap}
.ehd-earnings-open svg {transition:transform .2s}
.ehd-earnings-link:hover .ehd-earnings-open svg {transform:translateX(4px)}
/* Recommendation flow: four deliberate commerce-style cards, not a flat timeline. */
.ehd-section {margin-top:clamp(25px,2.7vw,38px);min-width:0}
.ehd-section-heading {display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:17px}
.ehd-section-title {font-size:clamp(27px,2.35vw,35px)!important;line-height:1.18!important;font-weight:850;letter-spacing:-.045em;color:var(--ehd-forest);margin:7px 0 0}
.ehd-section-sub {font-size:15px;color:var(--ehd-muted);margin:6px 0 0;line-height:1.5}
.ehd-flow {background:#ECEFE7;border:1px solid #D3DDCF;border-radius:17px;padding:clamp(20px,2.25vw,34px)}
.ehd-flow-head {display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:19px;flex-wrap:wrap}
.ehd-flow-head .ehd-section-title {margin-top:7px}
.ehd-flow-count {display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #C7D6CA;border-radius:999px;background:#F9FAF5;color:#315246;font-size:14px;font-weight:800;white-space:nowrap}
.ehd-flow-count::before {content:'';width:7px;height:7px;border-radius:50%;background:var(--ehd-clay)}
.ehd-steps {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.ehd-step {position:relative;min-width:0;min-height:252px;display:flex;flex-direction:column;padding:20px clamp(16px,1.45vw,24px) 17px;border:1px solid #D7DDD3;border-top:4px solid var(--ehd-clay);border-radius:12px;background:#FDFBF7;box-shadow:0 4px 13px rgba(22,51,39,.035);transition:transform .22s,box-shadow .22s,border-color .22s,background .22s}
.ehd-step:nth-child(2) {background:#F1F4EE;border-top-color:#426C58}
.ehd-step:nth-child(3) {background:#FAECE3;border-top-color:#C86C42}
.ehd-step:nth-child(4) {background:#E2EAE1;border-top-color:#173F35}
.ehd-step:hover {transform:translateY(-4px);border-color:#B7876B;box-shadow:0 13px 23px rgba(20,49,38,.12)}
.ehd-step:focus-visible {outline:3px solid var(--ehd-clay);outline-offset:3px}
.ehd-step-top {display:flex;align-items:center;justify-content:space-between;gap:11px}
.ehd-step-number {display:inline-flex;align-items:center;min-height:31px;padding:4px 10px;border:1px solid #E0D5CB;border-radius:7px;color:#A14B2A;background:#FFF7F2;font-size:13px;font-weight:850;letter-spacing:.04em}
.ehd-step:nth-child(2) .ehd-step-number,.ehd-step:nth-child(4) .ehd-step-number {color:#1A5542;background:#F9FCF8;border-color:#CBD9CD}
.ehd-step-icon {width:43px;height:43px;flex:none;display:grid;place-items:center;background:#173F35;color:#FDFBF7;border-radius:11px}
.ehd-step:nth-child(3) .ehd-step-icon {background:#B45E38}
.ehd-step-title {font-size:clamp(19px,1.62vw,23px)!important;line-height:1.26!important;font-weight:850;letter-spacing:-.025em;color:var(--ehd-charcoal);margin:22px 0 0}
.ehd-step-desc {font-size:14.5px;color:#4E6156;line-height:1.55;margin:8px 0 17px;flex:1}
.ehd-step-action {display:flex;align-items:center;justify-content:space-between;gap:9px;width:100%;padding-top:13px;border-top:1px solid rgba(61,95,77,.2);font-size:14px;font-weight:850;color:var(--ehd-forest);line-height:1.35}
.ehd-step-action svg {flex:none;width:29px;height:29px;padding:7px;border-radius:50%;background:#E7EDE4;transition:background .2s,color .2s,transform .2s}
.ehd-step:hover .ehd-step-action svg {transform:translateX(3px);background:var(--ehd-forest);color:#fff}
/* Workspace: the left column is unmistakably an interactive category selector. */
.ehd-tools {background:#FDFCF9;border-top:3px solid var(--ehd-clay);border-bottom:1px solid #D3DDD1;padding:clamp(21px,2.5vw,36px);border-radius:9px}
.ehd-tools-head {display:flex;gap:16px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:20px}
.ehd-tool-count {font-size:14px;font-weight:800;color:var(--ehd-forest);background:#E3EBE1;border-radius:7px;padding:7px 12px}
.ehd-tool-explorer {display:grid;grid-template-columns:minmax(275px,.75fr) minmax(0,1.7fr);border:1px solid #CBD7CA;border-radius:15px;overflow:hidden;min-width:0;background:#F5F7F1}
.ehd-group-rail {display:flex;flex-direction:column;gap:9px;padding:20px;background:#E8EDE5;border-right:1px solid #CBD7CA;min-width:0}
.ehd-group-rail-heading {display:flex;align-items:center;justify-content:space-between;gap:9px;margin:0 0 7px;flex-wrap:wrap}
.ehd-group-rail-title {font-size:13px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#315348}
.ehd-group-rail-help {font-size:13px;font-weight:700;color:#A35335}
.ehd-group-trigger {appearance:none;position:relative;font-family:inherit;display:flex;gap:12px;align-items:center;min-width:0;width:100%;text-align:left;border:1px solid #D4DDD3;border-radius:11px;background:#FFFDF9;padding:16px 14px;cursor:pointer;color:#20473B;transition:background .18s,color .18s,border-color .18s,transform .18s,box-shadow .18s}
.ehd-group-trigger:hover:not([data-active='true']) {background:#F9ECE2;border-color:#D49C80;transform:translateX(2px)}
.ehd-group-trigger[data-active='true'] {background:#173F35;color:#FFFDF8;border-color:#173F35;box-shadow:0 6px 14px rgba(20,60,48,.16)}
.ehd-group-trigger[data-active='true']::before {content:'';position:absolute;left:0;top:12px;bottom:12px;width:4px;background:#E39871;border-radius:0 4px 4px 0}
.ehd-group-number {font-size:15px;font-weight:850;flex:none;color:#AA5736;min-width:29px;align-self:flex-start;margin-top:2px}
.ehd-group-trigger[data-active='true'] .ehd-group-number {color:#F4BA98}
.ehd-group-copy {display:block;flex:1;min-width:0}
.ehd-group-label {display:block;font-weight:850;font-size:17px;line-height:1.3}
.ehd-group-caption {display:block;font-size:13.5px;line-height:1.4;margin-top:4px;opacity:.82}
.ehd-group-arrow {flex:none;width:34px;height:34px;padding:8px;border-radius:50%;color:#245243;background:#E5EDE5;transition:transform .18s,background .18s,color .18s}
.ehd-group-trigger[data-active='true'] .ehd-group-arrow {background:var(--ehd-clay);color:#fff;transform:translateX(2px)}
.ehd-tool-panel {min-width:0;padding:clamp(20px,2.3vw,31px);background:linear-gradient(135deg,#FCFCF9 0%,#F4F7F1 100%)}
.ehd-tool-panel-inner {animation:ehd-reveal .25s cubic-bezier(.22,1,.36,1) both}
@keyframes ehd-reveal {from {opacity:.2;transform:translateX(-10px)}to {opacity:1;transform:translateX(0)}}
.ehd-tool-panel-heading {display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:15px;border-bottom:1px solid #D7DFD4}
.ehd-tool-panel-icon {width:49px;height:49px;border-radius:12px;display:grid;place-items:center;background:var(--ehd-forest);color:#fff;flex:none}
.ehd-tool-panel-kicker {display:block;margin:0 0 3px;color:#A95433;font-size:12px;font-weight:850;letter-spacing:.085em;text-transform:uppercase}
.ehd-tool-panel-title {font-size:clamp(19px,1.7vw,24px);line-height:1.25;margin:0;color:var(--ehd-forest);letter-spacing:-.025em;font-weight:850}
.ehd-tool-panel-desc {font-size:14px;color:#596B5E;margin:5px 0 0}
.ehd-tool-list {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ehd-tool {display:flex;gap:12px;align-items:flex-start;min-width:0;min-height:112px;padding:16px;border:1px solid #D9E0D7;border-radius:11px;background:#FFFEFC;box-shadow:0 2px 8px rgba(28,51,38,.025);transition:background .2s,border-color .2s,transform .2s,box-shadow .2s}
.ehd-tool:hover {background:#F9EEE6;border-color:#CE9678;transform:translateY(-2px);box-shadow:0 8px 17px rgba(28,51,38,.085)}
.ehd-tool-icon {flex:none;width:40px;height:40px;display:grid;place-items:center;color:var(--ehd-forest);background:#E1EBE2;border-radius:9px}
.ehd-tool-main {min-width:0;flex:1}
.ehd-tool-name {display:block;font-size:16px;font-weight:850;color:#243E31;line-height:1.35}
.ehd-tool-desc {display:block;font-size:14px;line-height:1.45;margin-top:5px;color:#617166}
.ehd-tool-arrow {flex:none;color:#B45E38;margin-top:7px;transition:transform .2s}
.ehd-tool:hover .ehd-tool-arrow {transform:translateX(4px)}
.ehd-tools-mobile {display:none}
.ehd-tools-mobile-hint {display:none}
@media(max-width:1199px){
  .ehd-intro{grid-template-columns:minmax(0,1.25fr) minmax(270px,.75fr)}
  .ehd-tool-explorer{grid-template-columns:minmax(250px,.75fr) minmax(0,1.4fr)}
  .ehd-tool-list{grid-template-columns:1fr}
  .ehd-tool{min-height:0}
  .ehd-step{min-height:262px}
}
@media(max-width:880px){
  .ehd-intro{grid-template-columns:1fr}
  .ehd-intro-side{border-left:0;border-top:3px solid var(--ehd-clay);padding:24px;display:grid;grid-template-columns:1fr auto;align-items:center}
  .ehd-intro-link{min-width:220px}
  .ehd-earnings-link{grid-template-columns:1fr}
  .ehd-earnings-lead{border-right:0;border-bottom:1px solid #D1DCCE}
  .ehd-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ehd-step{min-height:219px}
}
@media(max-width:700px){
  .ehd-page{padding:13px 12px 31px;font-size:15px}
  .ehd-intro{border-radius:12px}
  .ehd-welcome{padding:24px 20px}
  .ehd-welcome h1{font-size:33px!important}
  .ehd-welcome-top{margin-bottom:14px}
  .ehd-intro-side{display:flex;align-items:stretch;gap:14px;padding:19px 20px}
  .ehd-intro-link{min-width:0}
  .ehd-side-heading{font-size:24px!important}
  .ehd-earnings{margin-top:15px}
  .ehd-earnings-lead{padding:19px 18px}
  .ehd-earnings-detail{padding:16px}
  .ehd-earning-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
  .ehd-stat{padding:5px 8px}
  .ehd-stat:first-child{padding-left:0}
  .ehd-stat-label{font-size:12.5px}
  .ehd-stat-value{font-size:clamp(15px,4vw,21px)}
  .ehd-earnings-footer{align-items:start;flex-wrap:wrap}
  .ehd-section{margin-top:23px}
  .ehd-section-title{font-size:26px!important}
  .ehd-flow{padding:20px 15px}
  .ehd-flow-head{margin-bottom:15px}
  .ehd-flow-count{padding:6px 10px;font-size:13px}
  .ehd-steps{grid-template-columns:1fr;gap:11px}
  .ehd-step{min-height:0;padding:16px;border-radius:10px}
  .ehd-step-title{font-size:19px!important;margin-top:13px}
  .ehd-step-desc{font-size:14px;margin:6px 0 12px}
  .ehd-step-action{padding-top:10px}
  .ehd-tools{padding:20px 16px 22px}
  .ehd-tools-head{margin-bottom:15px}
  .ehd-tools-desktop-hint{display:none}
  .ehd-tools-mobile-hint{display:block}
  .ehd-tool-explorer{display:none}
  .ehd-tools-mobile{display:grid;gap:9px}
  .ehd-mobile-group{border:1px solid #D6DFD1;background:#F9FAF6;border-radius:10px;overflow:hidden}
  .ehd-mobile-trigger{appearance:none;font-family:inherit;display:flex;gap:12px;align-items:center;width:100%;padding:15px 14px;text-align:left;border:0;background:#E7ECE2;color:var(--ehd-forest);cursor:pointer}
  .ehd-mobile-group:nth-child(2) .ehd-mobile-trigger{background:#F4E8E0}
  .ehd-mobile-group:nth-child(3) .ehd-mobile-trigger{background:#EDF0E9}
  .ehd-mobile-trigger[aria-expanded='true']{box-shadow:inset 4px 0 0 var(--ehd-clay)}
  .ehd-mobile-trigger-icon{width:40px;height:40px;border-radius:9px;background:#FDFCF9;display:grid;place-items:center;flex:none}
  .ehd-mobile-trigger-title{font-size:16px;font-weight:850;line-height:1.25}
  .ehd-mobile-trigger-meta{display:block;font-size:13px;color:#617264;margin-top:3px}
  .ehd-mobile-trigger svg:last-child{margin-left:auto;transition:transform .2s}
  .ehd-mobile-trigger[aria-expanded='true'] svg:last-child{transform:rotate(180deg)}
  .ehd-mobile-panel{padding:12px;animation:ehd-reveal .23s ease-out both}
  .ehd-mobile-panel .ehd-tool-list{display:grid;grid-template-columns:1fr;gap:8px}
  .ehd-mobile-panel .ehd-tool{min-height:0;padding:12px;border-radius:9px}
  .ehd-mobile-panel .ehd-tool-name{font-size:15px}
  .ehd-mobile-panel .ehd-tool-desc{font-size:14px}
}
@media(max-width:390px){
  .ehd-earning-stats{grid-template-columns:1fr;gap:6px}
  .ehd-stat,.ehd-stat:first-child{border:0;border-bottom:1px solid #C5D3C5;padding:5px 0 8px}
  .ehd-stat:last-child{border-bottom:0}
  .ehd-stat-value{font-size:19px}
}
@media(prefers-reduced-motion:reduce){
  .ehd-page a,.ehd-page button,.ehd-page svg,.ehd-tool-panel-inner,.ehd-mobile-panel{animation:none!important;transition:none!important}
}
`;

const workflowStages = [
  {
    step: 'Step 1',
    title: 'Set up the business',
    description: 'Finish business setup, profile and verification checks.',
    to: '/host/operations-center',
    action: 'Open Operations Center',
    icon: Building2,
    className: 'border-[#DCE0CF] bg-[#F7F6F2]',
    iconClassName: 'bg-[#C86C42] text-[#F7F6F2]',
  },
  {
    step: 'Step 2',
    title: 'Build the catalog',
    description: 'Prepare products, check their details and publish listings.',
    to: '/host/catalog',
    action: 'Open Catalog',
    icon: Boxes,
    className: 'border-[#DCE0CF] bg-[#DCE0CF]',
    iconClassName: 'bg-[#173F35] text-[#F7F6F2]',
  },
  {
    step: 'Step 3',
    title: 'Sell and fulfill',
    description: 'Manage prices, stock, customer orders and delivery.',
    to: '/host/marketplace',
    action: 'Open Pricing & Inventory',
    icon: ShoppingBag,
    className: 'border-[#DCE0CF] bg-[#DCE0CF]',
    iconClassName: 'bg-[#173F35] text-[#F7F6F2]',
  },
  {
    step: 'Step 4',
    title: 'Grow and understand',
    description: 'Reach new customers and understand performance.',
    to: '/host/campaigns',
    action: 'Open Campaigns',
    icon: BarChart3,
    className: 'border-[#DCE0CF] bg-[#F7F6F2]',
    iconClassName: 'bg-[#C86C42] text-[#F7F6F2]',
  },
]

const quickAccessItems = [
  {
    title: 'Business Setup & Readiness',
    description: 'Complete business setup, KYB, commercial checks and operational readiness.',
    to: '/host/operations-center',
    icon: Store,
  },
  {
    title: 'Business Profile',
    description: 'Review how your business appears to customers and keep core business details up to date.',
    to: '/host/business-profile',
    icon: Building2,
  },
  {
    title: 'Catalog',
    description: 'Add, edit and organize the products you sell, including bulk catalog updates.',
    to: '/host/catalog',
    icon: Boxes,
  },
  {
    title: 'Create Listing',
    description: 'Choose an item type, save your details and send it for review.',
    to: '/host/listings',
    icon: Boxes,
  },
  {
    title: 'Pricing & Inventory',
    description: 'Set selling prices and keep stock availability accurate for customers.',
    to: '/host/marketplace',
    icon: Warehouse,
  },
  {
    title: 'Orders',
    description: 'Review incoming customer orders and manage each order from confirmation onward.',
    to: '/host/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Fulfillment',
    description: 'Pack, dispatch and track active orders through delivery.',
    to: '/host/fulfillment',
    icon: Truck,
  },
  {
    title: 'Finance',
    description: 'Track earnings, settlement progress and finance-related actions.',
    to: '/host/finance',
    icon: WalletCards,
  },
  {
    title: 'Analytics',
    description: 'See sales, orders and business performance in one place.',
    to: '/host/analytics',
    icon: BarChart3,
  },
  {
    title: 'Business Settings & Team',
    description: 'Manage business documents, team access and connected integrations.',
    to: '/host/settings',
    icon: Settings,
  },
  {
    title: 'Hospitality Operations',
    description: 'Open hospitality tools when your business uses restaurant or service operations.',
    to: '/host/hospitality',
    icon: LayoutDashboard,
  },
  {
    title: 'Creator Studio',
    description: 'Create professional videos, courses and live sessions for your approved Chef + Restaurant workspace.',
    to: '/host/creator-studio',
    icon: Clapperboard,
  },
]

// The same existing 12 destinations, grouped into three business areas.
// Permission filtering stays on each original route.
const toolGroups = [
  {
    id: 'prepare',
    label: 'Set up & create',
    description: 'Business profile, catalog and listings',
    icon: Building2,
    paths: ['/host/operations-center', '/host/business-profile', '/host/catalog', '/host/listings'],
  },
  {
    id: 'operate',
    label: 'Sell & operate',
    description: 'Stock, orders, delivery and finance',
    icon: ShoppingBag,
    paths: ['/host/marketplace', '/host/orders', '/host/fulfillment', '/host/finance'],
  },
  {
    id: 'grow',
    label: 'Manage & grow',
    description: 'Insights, team and specialist tools',
    icon: BarChart3,
    paths: ['/host/analytics', '/host/settings', '/host/hospitality', '/host/creator-studio'],
  },
]

function ToolLinks({ items }) {
  return (
    <div className="ehd-tool-list">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link className="ehd-tool" key={item.to} to={item.to}>
            <span className="ehd-tool-icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="ehd-tool-main">
              <span className="ehd-tool-name">{item.title}</span>
              <span className="ehd-tool-desc">{item.description}</span>
            </span>
            <ArrowRight className="ehd-tool-arrow" size={17} aria-hidden="true" />
          </Link>
        )
      })}
    </div>
  )
}

function formatMinorCurrency(
  amountMinor,
  currency = 'INR',
) {
  const amount =
    Number(
      amountMinor ||
        0,
    ) / 100

  try {
    return new Intl.NumberFormat(
      'en-IN',
      {
        style:
          'currency',
        currency:
          currency ||
          'INR',
        maximumFractionDigits:
          2,
      },
    ).format(
      amount,
    )
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

export default function HostDashboardPage() {
  const {
    currentUser,
    hostAccessStatus,
  } = useAuth()


  const hostWorkspaceType =
    normalizeHostWorkspaceType(
      currentUser,
    )

  const canViewEarnings =
    isHostPathAllowed(
      '/host/earnings',
      hostWorkspaceType,
    )

  const visibleWorkflowStages =
    workflowStages.filter((stage) =>
      isHostPathAllowed(
        stage.to,
        hostWorkspaceType,
      ),
    )

  const visibleQuickAccessItems =
    quickAccessItems.filter((item) =>
      isHostPathAllowed(
        item.to,
        hostWorkspaceType,
      ),
    )

  const [activeGroupId, setActiveGroupId] = useState('prepare')
  const [openMobileGroupId, setOpenMobileGroupId] = useState('prepare')

  const visibleToolGroups = toolGroups.map((group) => ({
    ...group,
    items: visibleQuickAccessItems.filter((item) => group.paths.includes(item.to)),
  })).filter((group) => group.items.length > 0)
  const selectedGroup = visibleToolGroups.find((group) => group.id === activeGroupId) || visibleToolGroups[0]
  const SelectedGroupIcon = selectedGroup?.icon || Building2

  const [earnings, setEarnings] = useState(null)
  const [earningsLoading, setEarningsLoading] = useState(true)
  const [earningsError, setEarningsError] = useState('')

  const loadEarnings = useCallback(async () => {
    if (!canViewEarnings) {
      setEarningsLoading(false)
      setEarningsError('')
      return
    }

    try {
      const result =
        await getHostEarningsOverview()

      setEarnings(
        result?.earnings ||
        null,
      )
      setEarningsError('')
    } catch (error) {
      setEarningsError(
        error?.response?.data?.message ||
        error?.message ||
        'Earnings are temporarily unavailable.',
      )
    } finally {
      setEarningsLoading(false)
    }
  }, [canViewEarnings])

  useEffect(() => {
    if (!canViewEarnings) {
      setEarningsLoading(false)
      return undefined
    }

    loadEarnings()

    const interval =
      window.setInterval(
        loadEarnings,
        15000,
      )

    window.addEventListener(
      'focus',
      loadEarnings,
    )

    return () => {
      window.clearInterval(
        interval,
      )

      window.removeEventListener(
        'focus',
        loadEarnings,
      )
    }
  }, [canViewEarnings, loadEarnings])

  const name =
    currentUser?.displayName ||
    currentUser?.name ||
    currentUser?.email ||
    'Host'

  const accessLabel =
    hostAccessStatus === 'active'
      ? 'Active Host'
      : 'Host workspace'

  return (
    <main className="ehd-page" aria-label="Host dashboard">
      <style>{hostDashboardStyles}</style>
      <div className="ehd-wrap">
        <header className="ehd-intro">
          <div className="ehd-welcome">
            <div className="ehd-welcome-top">
              <p className="ehd-eyebrow ehd-eyebrow--light">Host dashboard</p>
              <span className="ehd-status">{accessLabel}</span>
            </div>
            <p className="ehd-welcome-label">Welcome back,</p>
            <h1>{name}</h1>
            <p className="ehd-welcome-desc">Your business, listings and orders in one place. Choose what to work on next.</p>
          </div>
          <div className="ehd-intro-side">
            <div>
              <p className="ehd-side-label">Your starting point</p>
              <h2 className="ehd-side-heading">Keep your business ready.</h2>
              <p className="ehd-side-desc">Review business setup and tasks before you start selling.</p>
            </div>
            <Link className="ehd-intro-link" to="/host/operations-center">
              <span>Open Operations Center</span>
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          </div>
        </header>

        {canViewEarnings ? (
          <section className="ehd-earnings" aria-label="Earnings overview">
            <Link className="ehd-earnings-link" to="/host/earnings">
              <div className="ehd-earnings-lead">
                <p className="ehd-earnings-title">
                  <Banknote size={20} aria-hidden="true" /> Earnings
                  <span className="ehd-live">Refreshes every 15 seconds</span>
                </p>
                <p className="ehd-earnings-value">
                  {earningsLoading ? 'Loading…' : formatMinorCurrency(earnings?.totalEarnedMinor, earnings?.currency)}
                </p>
                <p className="ehd-earnings-help">Revenue received from paid customer orders.</p>
              </div>
              <div className="ehd-earnings-detail">
                <div className="ehd-earning-stats">
                  <div className="ehd-stat">
                    <p className="ehd-stat-label">Paid</p>
                    <p className="ehd-stat-value">{formatMinorCurrency(earnings?.paidMinor, earnings?.currency)}</p>
                  </div>
                  <div className="ehd-stat">
                    <p className="ehd-stat-label">In settlement</p>
                    <p className="ehd-stat-value">{formatMinorCurrency(earnings?.inSettlementMinor, earnings?.currency)}</p>
                  </div>
                  <div className="ehd-stat">
                    <p className="ehd-stat-label">Awaiting settlement</p>
                    <p className="ehd-stat-value">{formatMinorCurrency(earnings?.awaitingSettlementMinor, earnings?.currency)}</p>
                  </div>
                </div>
                <div className="ehd-earnings-footer">
                  <p>{earningsError || `${earnings?.capturedOrders || 0} paid orders · ${earnings?.deliveredOrders || 0} delivered`}</p>
                  <span className="ehd-earnings-open">View earnings <ArrowRight size={17} aria-hidden="true" /></span>
                </div>
              </div>
            </Link>
          </section>
        ) : null}

        <section className="ehd-section ehd-flow" aria-labelledby="ehd-flow-title">
          <div className="ehd-flow-head">
            <div>
              <p className="ehd-eyebrow">Recommended flow</p>
              <h2 id="ehd-flow-title" className="ehd-section-title">What to do next</h2>
              <p className="ehd-section-sub">Four clear stages to run your business.</p>
            </div>
            <span className="ehd-flow-count">{visibleWorkflowStages.length} steps</span>
          </div>
          <div className="ehd-steps">
            {visibleWorkflowStages.map((stage) => {
              const Icon = stage.icon
              return (
                <Link className="ehd-step" key={stage.step} to={stage.to}>
                  <div className="ehd-step-top">
                    <span className="ehd-step-number">{stage.step}</span>
                    <span className="ehd-step-icon"><Icon size={20} aria-hidden="true" /></span>
                  </div>
                  <h3 className="ehd-step-title">{stage.title}</h3>
                  <p className="ehd-step-desc">{stage.description}</p>
                  <span className="ehd-step-action">{stage.action}<ArrowRight size={16} aria-hidden="true" /></span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="ehd-section ehd-tools" aria-labelledby="ehd-tools-title">
          <div className="ehd-tools-head">
            <div>
              <p className="ehd-eyebrow">Host workspace</p>
              <h2 id="ehd-tools-title" className="ehd-section-title">Your business tools</h2>
              <p className="ehd-section-sub ehd-tools-desktop-hint">Select a category on the left to view its tools on the right.</p>
              <p className="ehd-section-sub ehd-tools-mobile-hint">Tap a category to see its tools.</p>
            </div>
            <span className="ehd-tool-count">{visibleQuickAccessItems.length} available tools</span>
          </div>

          {selectedGroup && (
            <div className="ehd-tool-explorer">
              <div className="ehd-group-rail" role="group" aria-label="Business tool groups">
                <div className="ehd-group-rail-heading">
                  <span className="ehd-group-rail-title">01 / Select a category</span>
                  <span className="ehd-group-rail-help">Hover or click</span>
                </div>
                {visibleToolGroups.map((group, index) => (
                  <button
                    type="button"
                    className="ehd-group-trigger"
                    key={group.id}
                    data-active={selectedGroup.id === group.id}
                    aria-pressed={selectedGroup.id === group.id}
                    aria-controls="ehd-desktop-tool-panel"
                    onMouseEnter={() => setActiveGroupId(group.id)}
                    onFocus={() => setActiveGroupId(group.id)}
                    onClick={() => setActiveGroupId(group.id)}
                  >
                    <span className="ehd-group-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="ehd-group-copy">
                      <span className="ehd-group-label">{group.label}</span>
                      <span className="ehd-group-caption">{group.items.length} tools · {group.description}</span>
                    </span>
                    <ArrowRight size={20} className="ehd-group-arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div id="ehd-desktop-tool-panel" className="ehd-tool-panel" role="region" aria-label={`${selectedGroup.label} tools`}>
                <div className="ehd-tool-panel-inner" key={selectedGroup.id}>
                  <div className="ehd-tool-panel-heading">
                    <span className="ehd-tool-panel-icon">
                      <SelectedGroupIcon size={23} aria-hidden="true" />
                    </span>
                    <div>
                      <span className="ehd-tool-panel-kicker">02 / Tools in this category</span>
                      <h3 className="ehd-tool-panel-title">{selectedGroup.label}</h3>
                      <p className="ehd-tool-panel-desc">{selectedGroup.items.length} available tools</p>
                    </div>
                  </div>
                  <ToolLinks items={selectedGroup.items} />
                </div>
              </div>
            </div>
          )}

          <div className="ehd-tools-mobile">
            {visibleToolGroups.map((group) => {
              const GroupIcon = group.icon
              const opened = openMobileGroupId === group.id
              return (
                <div className="ehd-mobile-group" key={group.id}>
                  <button
                    type="button"
                    className="ehd-mobile-trigger"
                    aria-expanded={opened}
                    aria-controls={`ehd-mobile-panel-${group.id}`}
                    onClick={() => setOpenMobileGroupId(opened ? '' : group.id)}
                  >
                    <span className="ehd-mobile-trigger-icon"><GroupIcon size={20} aria-hidden="true" /></span>
                    <span>
                      <span className="ehd-mobile-trigger-title">{group.label}</span>
                      <span className="ehd-mobile-trigger-meta">{group.items.length} tools</span>
                    </span>
                    <ChevronDown size={20} aria-hidden="true" />
                  </button>
                  {opened && (
                    <div className="ehd-mobile-panel" id={`ehd-mobile-panel-${group.id}`}>
                      <ToolLinks items={group.items} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
