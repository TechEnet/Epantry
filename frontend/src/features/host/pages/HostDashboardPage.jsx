import { useCallback, useEffect, useState } from "react";

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
} from "lucide-react";

import { Link } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import { getHostEarningsOverview } from "../../hostOperations/services/hostOperations.service";

import {
  isHostPathAllowed,
  normalizeHostWorkspaceType,
} from "../hostWorkspace.config";

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
/* Host journey: one opening action + an editorial next-step list. */
.ehd-section {margin-top:clamp(26px,2.7vw,40px);min-width:0}
.ehd-section-title {font-size:clamp(27px,2.4vw,35px)!important;line-height:1.18!important;font-weight:800;letter-spacing:-.043em;color:var(--ehd-forest);margin:7px 0 0}
.ehd-flow-head {display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:17px}
.ehd-journey {display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.58fr);gap:17px;min-width:0;align-items:stretch}
.ehd-feature {position:relative;isolation:isolate;display:flex;flex-direction:column;min-width:0;min-height:316px;overflow:hidden;padding:clamp(23px,2.25vw,34px);background:#F4E0D1;border:1px solid #EAC7B3;border-radius:15px;color:var(--ehd-charcoal)!important;transition:border-color .2s,box-shadow .2s,transform .2s}
.ehd-feature::before {content:'';position:absolute;right:-90px;top:-112px;height:280px;width:280px;border:1px solid rgba(159,80,46,.16);border-radius:50%;box-shadow:0 0 0 26px rgba(159,80,46,.045),0 0 0 55px rgba(159,80,46,.035);z-index:-1;pointer-events:none}
.ehd-feature:hover {transform:translateY(-3px);border-color:#C86C42;box-shadow:0 14px 28px rgba(53,46,35,.10)}
.ehd-feature-meta {display:flex;align-items:center;justify-content:space-between;gap:16px}
.ehd-feature-number {font-size:13px;font-weight:850;color:#A45130;letter-spacing:.085em;text-transform:uppercase}
.ehd-feature-icon {width:45px;height:45px;display:grid;place-items:center;background:#FBF5EE;border:1px solid #E8CDBA;border-radius:12px;color:var(--ehd-forest)}
.ehd-feature h3 {font-size:clamp(24px,2vw,31px)!important;line-height:1.16!important;letter-spacing:-.045em;font-weight:800;margin:36px 0 0;color:var(--ehd-forest)!important;max-width:330px}
.ehd-feature p {font-size:15px;line-height:1.57;color:#5A544C;margin:11px 0 24px;max-width:400px;flex:1}
.ehd-feature-cta {display:inline-flex;align-items:center;justify-content:space-between;gap:12px;width:100%;max-width:330px;background:#173F35;color:#fff;border-radius:9px;min-height:46px;padding:10px 15px;font-size:14px;font-weight:800}
.ehd-feature-cta svg {transition:transform .2s;flex:none}
.ehd-feature:hover .ehd-feature-cta svg {transform:translateX(5px)}
.ehd-journey-more {display:flex;flex-direction:column;min-width:0;overflow:hidden;border:1px solid #D8DFD6;background:#FFFEFA;border-radius:15px}
.ehd-journey-row {display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:19px;flex:1;min-height:102px;padding:18px clamp(18px,2vw,30px);color:var(--ehd-charcoal);border-bottom:1px solid #DDE3D9;transition:background .2s,padding-left .2s}
.ehd-journey-row:last-child {border-bottom:0}
.ehd-journey-row:hover {background:#EEF2EA;padding-left:clamp(22px,2.45vw,37px)}
.ehd-row-index {width:44px;height:44px;border-radius:11px;display:grid;place-items:center;background:#E6EEE4;color:#245743;font-size:15px;font-weight:850}
.ehd-journey-row:nth-child(2) .ehd-row-index {background:#FAE8DC;color:#AB5938}
.ehd-journey-row:nth-child(3) .ehd-row-index {background:#EBE8DE;color:#435C4B}
.ehd-row-main {display:block;min-width:0}
.ehd-row-name {display:block;font-size:clamp(17px,1.5vw,21px);font-weight:800;letter-spacing:-.028em;color:#173F35;line-height:1.3}
.ehd-row-description {display:block;font-size:14.5px;color:#607067;line-height:1.48;margin-top:5px;max-width:660px}
.ehd-row-arrow {width:42px;height:42px;border:1px solid #D2DDD2;border-radius:50%;display:grid;place-items:center;color:#173F35;background:#FAFCF8;transition:background .2s,color .2s,transform .2s}
.ehd-journey-row:hover .ehd-row-arrow {background:#173F35;color:white;transform:translateX(3px)}
/* Workspace: three unmistakable selectors, one spacious results panel. */
.ehd-tools {padding:0;margin-top:clamp(30px,3vw,44px);background:transparent;border:0}
.ehd-tools-head {display:flex;align-items:end;justify-content:space-between;gap:15px;margin-bottom:17px;flex-wrap:wrap}
.ehd-tool-count {font-size:13px;font-weight:750;color:#466150;background:#E6EDE3;border-radius:999px;padding:7px 12px;white-space:nowrap}
.ehd-tool-explorer {display:grid;grid-template-columns:minmax(235px,.62fr) minmax(0,1.78fr);min-width:0;min-height:320px;border:1px solid #D6DFD6;border-radius:15px;overflow:hidden;background:#FFFEFB}
.ehd-group-rail {display:flex;flex-direction:column;gap:0;min-width:0;background:#E9EEE6;padding:16px;border-right:1px solid #D6DFD6}
.ehd-group-trigger {appearance:none;font-family:inherit;position:relative;display:flex;align-items:center;gap:15px;width:100%;min-width:0;text-align:left;padding:21px 14px;background:transparent;border:1px solid transparent;border-bottom-color:#D2DDD1;border-radius:0;color:#40574A;cursor:pointer;transition:background .17s,color .17s,border-color .17s}
.ehd-group-trigger:last-child {border-bottom-color:transparent}
.ehd-group-trigger:hover:not([data-active='true']) {background:#F9FAF5;border-color:#CBD9CB;border-radius:10px}
.ehd-group-trigger[data-active='true'] {background:#173F35;color:#FFFDF7;border-color:#173F35;border-radius:10px;box-shadow:0 4px 12px rgba(17,56,41,.11);z-index:1}
.ehd-group-number {flex:none;width:33px;height:33px;display:grid;place-items:center;border-radius:8px;border:1px solid #C9D5C8;font-size:13px;font-weight:850;color:#A45433;background:#F9F8F2}
.ehd-group-trigger[data-active='true'] .ehd-group-number {background:#C86C42;color:white;border-color:#C86C42}
.ehd-group-copy {min-width:0;flex:1}
.ehd-group-label {display:block;font-size:17px;font-weight:800;line-height:1.32;letter-spacing:-.02em}
.ehd-group-caption {display:block;margin-top:3px;color:#68756B;font-size:13.5px;line-height:1.45}
.ehd-group-trigger[data-active='true'] .ehd-group-caption {color:#D5E5DA}
.ehd-group-arrow {flex:none;color:#718F79;transition:transform .18s}
.ehd-group-trigger[data-active='true'] .ehd-group-arrow {color:#F1B092;transform:translateX(3px)}
.ehd-tool-panel {padding:clamp(19px,2.35vw,32px);min-width:0;background:#FFFEFB}
.ehd-tool-panel-inner {min-width:0}
@keyframes ehd-panel-appear {from{opacity:.25;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.ehd-tool-panel-heading {display:flex;align-items:center;gap:14px;padding:0 0 16px;margin-bottom:3px;border-bottom:1px solid #DAE1D8}
.ehd-tool-panel-icon {flex:none;width:46px;height:46px;border-radius:11px;display:grid;place-items:center;background:#F4E4DA;color:#9F4B2B}
.ehd-tool-panel-title {font-size:clamp(22px,1.85vw,28px)!important;line-height:1.19!important;letter-spacing:-.04em;font-weight:800;margin:0;color:#173F35!important}
.ehd-tool-panel-desc {margin:3px 0 0;font-size:14px;line-height:1.4;color:#5C6D61}
.ehd-tool-list {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0}
.ehd-tool {display:flex;min-width:0;min-height:110px;align-items:flex-start;gap:13px;padding:21px 14px 17px;border-bottom:1px solid #E1E6DF;transition:background .17s,box-shadow .17s}
.ehd-tool:nth-child(odd) {border-right:1px solid #E1E6DF}
.ehd-tool:nth-child(3),.ehd-tool:nth-child(4) {border-bottom:0}
.ehd-tool:hover {background:#F6F2EC;box-shadow:inset 0 -3px 0 #C86C42}
.ehd-tool-icon {flex:none;width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:#E9F0E8;color:#173F35}
.ehd-tool-main {min-width:0;flex:1}
.ehd-tool-name {display:block;color:#203F32;font-size:16px;font-weight:800;line-height:1.35}
.ehd-tool-desc {display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:5px;color:#5B6B60;font-size:14px;line-height:1.48}
.ehd-tool-arrow {flex:none;color:#B6623D;transition:transform .18s;margin-top:9px}
.ehd-tool:hover .ehd-tool-arrow {transform:translateX(3px)}
.ehd-tools-mobile {display:none}
@media(max-width:1100px){
  .ehd-journey{grid-template-columns:minmax(0,.95fr) minmax(0,1.35fr)}
  .ehd-tool-explorer{grid-template-columns:minmax(210px,.65fr) minmax(0,1.4fr)}
  .ehd-tool-list{grid-template-columns:1fr}
  .ehd-tool {min-height:0;padding:15px 12px}
  .ehd-tool:nth-child(odd){border-right:0}
  .ehd-tool:nth-child(3){border-bottom:1px solid #E1E6DF}
}
@media(max-width:880px){
  .ehd-intro{grid-template-columns:1fr}
  .ehd-intro-side{border-left:0;border-top:3px solid var(--ehd-clay);padding:24px;display:grid;grid-template-columns:1fr auto;align-items:center}
  .ehd-intro-link{min-width:220px}
  .ehd-earnings-link{grid-template-columns:1fr}
  .ehd-earnings-lead{border-right:0;border-bottom:1px solid #D1DCCE}
  .ehd-journey{grid-template-columns:1fr}
  .ehd-feature{min-height:225px}
  .ehd-feature h3{margin-top:18px}
  .ehd-journey-row{min-height:94px}
}
@media(max-width:760px){
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
  .ehd-section{margin-top:26px}
  .ehd-section-title{font-size:27px!important}
  .ehd-feature{padding:21px;min-height:235px}
  .ehd-feature h3{font-size:25px!important}
  .ehd-feature p{font-size:14.5px}
  .ehd-journey-row{grid-template-columns:36px minmax(0,1fr) 35px;gap:12px;padding:16px 13px;min-height:95px}
  .ehd-journey-row:hover{padding-left:13px}
  .ehd-row-index{width:36px;height:36px}
  .ehd-row-name{font-size:17px}
  .ehd-row-description{font-size:13.5px}
  .ehd-row-arrow{width:34px;height:34px}
  .ehd-tools{margin-top:29px}
  .ehd-tool-explorer{display:none}
  .ehd-tools-mobile{display:grid;gap:10px}
  .ehd-mobile-group{border:1px solid #D4DDD3;border-radius:11px;background:#FFFEFB;overflow:hidden}
  .ehd-mobile-trigger{appearance:none;font-family:inherit;display:flex;align-items:center;gap:13px;width:100%;min-height:67px;padding:14px 16px;text-align:left;border:0;background:#E9EEE7;color:#173F35;cursor:pointer}
  .ehd-mobile-group:nth-child(2) .ehd-mobile-trigger{background:#F4E6DD}
  .ehd-mobile-group:nth-child(3) .ehd-mobile-trigger{background:#E6ECE3}
  .ehd-mobile-trigger[aria-expanded='true']{box-shadow:inset 4px 0 0 #C86C42}
  .ehd-mobile-trigger-icon{width:38px;height:38px;flex:none;border-radius:9px;display:grid;place-items:center;background:#FFFEFB}
  .ehd-mobile-trigger-title{display:block;font-size:17px;font-weight:800;line-height:1.3}
  .ehd-mobile-trigger-meta{display:block;font-size:13px;color:#657468;margin-top:3px}
  .ehd-mobile-trigger svg:last-child{margin-left:auto;flex:none;transition:transform .18s}
  .ehd-mobile-trigger[aria-expanded='true'] svg:last-child{transform:rotate(180deg)}
  .ehd-mobile-panel{padding:2px 15px;animation:ehd-panel-appear .2s ease-out both}
  .ehd-mobile-panel .ehd-tool-list{display:grid;grid-template-columns:1fr;gap:0}
  .ehd-mobile-panel .ehd-tool{padding:16px 2px;min-height:0;border-right:0;border-bottom:1px solid #E1E6DF}
  .ehd-mobile-panel .ehd-tool:last-child{border-bottom:0}
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
    step: "Step 1",
    kicker: "01 / FOUNDATION",
    title: "Set up the business",
    description: "Finish business setup, profile and verification checks.",
    to: "/host/operations-center",
    action: "Open Operations Center",
    icon: Building2,
    className: "border-[#DCE0CF] bg-[#F7F6F2]",
    iconClassName: "bg-[#C86C42] text-[#F7F6F2]",
  },
  {
    step: "Step 2",
    kicker: "02 / CATALOG",
    title: "Build the catalog",
    description: "Prepare products, check their details and publish listings.",
    to: "/host/catalog",
    action: "Open Catalog",
    icon: Boxes,
    className: "border-[#DCE0CF] bg-[#DCE0CF]",
    iconClassName: "bg-[#173F35] text-[#F7F6F2]",
  },
  {
    step: "Step 3",
    kicker: "03 / COMMERCE",
    title: "Sell and fulfill",
    description: "Manage prices, stock, customer orders and delivery.",
    to: "/host/marketplace",
    action: "Open Pricing & Inventory",
    icon: ShoppingBag,
    className: "border-[#DCE0CF] bg-[#DCE0CF]",
    iconClassName: "bg-[#173F35] text-[#F7F6F2]",
  },
  {
    step: "Step 4",
    kicker: "04 / GROWTH",
    title: "Grow and understand",
    description: "Reach new customers and understand performance.",
    to: "/host/campaigns",
    action: "Open Campaigns",
    icon: BarChart3,
    className: "border-[#DCE0CF] bg-[#F7F6F2]",
    iconClassName: "bg-[#C86C42] text-[#F7F6F2]",
  },
];

const quickAccessItems = [
  {
    title: "Business Setup & Readiness",
    description:
      "Complete business setup, KYB, commercial checks and operational readiness.",
    to: "/host/operations-center",
    icon: Store,
  },
  {
    title: "Business Profile",
    description:
      "Review how your business appears to customers and keep core business details up to date.",
    to: "/host/business-profile",
    icon: Building2,
  },
  {
    title: "Catalog",
    description:
      "Add, edit and organize the products you sell, including bulk catalog updates.",
    to: "/host/catalog",
    icon: Boxes,
  },
  {
    title: "Create Listing",
    description:
      "Choose an item type, save your details and send it for review.",
    to: "/host/listings",
    icon: Boxes,
  },
  {
    title: "Pricing & Inventory",
    description:
      "Set selling prices and keep stock availability accurate for customers.",
    to: "/host/marketplace",
    icon: Warehouse,
  },
  {
    title: "Orders",
    description:
      "Review incoming customer orders and manage each order from confirmation onward.",
    to: "/host/orders",
    icon: ShoppingBag,
  },
  {
    title: "Fulfillment",
    description: "Pack, dispatch and track active orders through delivery.",
    to: "/host/fulfillment",
    icon: Truck,
  },
  {
    title: "Finance",
    description:
      "Track earnings, settlement progress and finance-related actions.",
    to: "/host/finance",
    icon: WalletCards,
  },
  {
    title: "Analytics",
    description: "See sales, orders and business performance in one place.",
    to: "/host/analytics",
    icon: BarChart3,
  },
  {
    title: "Business Settings & Team",
    description:
      "Manage business documents, team access and connected integrations.",
    to: "/host/settings",
    icon: Settings,
  },
  {
    title: "Hospitality Operations",
    description:
      "Open hospitality tools when your business uses restaurant or service operations.",
    to: "/host/hospitality",
    icon: LayoutDashboard,
  },
  {
    title: "Creator Studio",
    description:
      "Create professional videos, courses and live sessions for your approved Chef + Restaurant workspace.",
    to: "/host/creator-studio",
    icon: Clapperboard,
  },
];

// The same existing 12 destinations, grouped into three business areas.
// Permission filtering stays on each original route.
const toolGroups = [
  {
    id: "prepare",
    label: "Set up & create",
    description: "Business profile, catalog and listings",
    icon: Building2,
    paths: [
      "/host/operations-center",
      "/host/business-profile",
      "/host/catalog",
      "/host/listings",
    ],
  },
  {
    id: "operate",
    label: "Sell & operate",
    description: "Stock, orders, delivery and finance",
    icon: ShoppingBag,
    paths: [
      "/host/marketplace",
      "/host/orders",
      "/host/fulfillment",
      "/host/finance",
    ],
  },
  {
    id: "grow",
    label: "Manage & grow",
    description: "Insights, team and specialist tools",
    icon: BarChart3,
    paths: [
      "/host/analytics",
      "/host/settings",
      "/host/hospitality",
      "/host/creator-studio",
    ],
  },
];

function ToolLinks({ items }) {
  return (
    <div className="ehd-tool-list">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link className="ehd-tool" key={item.to} to={item.to}>
            <span className="ehd-tool-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="ehd-tool-main">
              <span className="ehd-tool-name">{item.title}</span>
              <span className="ehd-tool-desc">{item.description}</span>
            </span>
            <ArrowRight
              className="ehd-tool-arrow"
              size={17}
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </div>
  );
}

function formatMinorCurrency(amountMinor, currency = "INR") {
  const amount = Number(amountMinor || 0) / 100;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString("en-IN")}`;
  }
}

export default function HostDashboardPage() {
  const { currentUser, hostAccessStatus } = useAuth();

  const hostWorkspaceType = normalizeHostWorkspaceType(currentUser);

  const canViewEarnings = isHostPathAllowed(
    "/host/earnings",
    hostWorkspaceType
  );

  const visibleWorkflowStages = workflowStages.filter((stage) =>
    isHostPathAllowed(stage.to, hostWorkspaceType)
  );

  const visibleQuickAccessItems = quickAccessItems.filter((item) =>
    isHostPathAllowed(item.to, hostWorkspaceType)
  );

  const [activeGroupId, setActiveGroupId] = useState("prepare");
  const [openMobileGroupId, setOpenMobileGroupId] = useState("prepare");

  const visibleToolGroups = toolGroups
    .map((group) => ({
      ...group,
      items: visibleQuickAccessItems.filter((item) =>
        group.paths.includes(item.to)
      ),
    }))
    .filter((group) => group.items.length > 0);
  const selectedGroup =
    visibleToolGroups.find((group) => group.id === activeGroupId) ||
    visibleToolGroups[0];
  const SelectedGroupIcon = selectedGroup?.icon || Building2;

  const [earnings, setEarnings] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earningsError, setEarningsError] = useState("");

  const loadEarnings = useCallback(async () => {
    if (!canViewEarnings) {
      setEarningsLoading(false);
      setEarningsError("");
      return;
    }

    try {
      const result = await getHostEarningsOverview();

      setEarnings(result?.earnings || null);
      setEarningsError("");
    } catch (error) {
      setEarningsError(
        error?.response?.data?.message ||
          error?.message ||
          "Earnings are temporarily unavailable."
      );
    } finally {
      setEarningsLoading(false);
    }
  }, [canViewEarnings]);

  useEffect(() => {
    if (!canViewEarnings) {
      setEarningsLoading(false);
      return undefined;
    }

    loadEarnings();

    const interval = window.setInterval(loadEarnings, 15000);

    window.addEventListener("focus", loadEarnings);

    return () => {
      window.clearInterval(interval);

      window.removeEventListener("focus", loadEarnings);
    };
  }, [canViewEarnings, loadEarnings]);

  const name =
    currentUser?.displayName ||
    currentUser?.name ||
    currentUser?.email ||
    "Host";

  const accessLabel =
    hostAccessStatus === "active" ? "Active Host" : "Host workspace";

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
            <p className="ehd-welcome-desc">
              Your business, listings and orders in one place. Choose what to
              work on next.
            </p>
          </div>
          <div className="ehd-intro-side">
            <div>
              <p className="ehd-side-label">Your starting point</p>
              <h2 className="ehd-side-heading">Keep your business ready.</h2>
              <p className="ehd-side-desc">
                Review business setup and tasks before you start selling.
              </p>
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
                  {earningsLoading
                    ? "Loading…"
                    : formatMinorCurrency(
                        earnings?.totalEarnedMinor,
                        earnings?.currency
                      )}
                </p>
                <p className="ehd-earnings-help">
                  Revenue received from paid customer orders.
                </p>
              </div>
              <div className="ehd-earnings-detail">
                <div className="ehd-earning-stats">
                  <div className="ehd-stat">
                    <p className="ehd-stat-label">Paid</p>
                    <p className="ehd-stat-value">
                      {formatMinorCurrency(
                        earnings?.paidMinor,
                        earnings?.currency
                      )}
                    </p>
                  </div>
                  <div className="ehd-stat">
                    <p className="ehd-stat-label">In settlement</p>
                    <p className="ehd-stat-value">
                      {formatMinorCurrency(
                        earnings?.inSettlementMinor,
                        earnings?.currency
                      )}
                    </p>
                  </div>
                  <div className="ehd-stat">
                    <p className="ehd-stat-label">Awaiting settlement</p>
                    <p className="ehd-stat-value">
                      {formatMinorCurrency(
                        earnings?.awaitingSettlementMinor,
                        earnings?.currency
                      )}
                    </p>
                  </div>
                </div>
                <div className="ehd-earnings-footer">
                  <p>
                    {earningsError ||
                      `${earnings?.capturedOrders || 0} paid orders · ${
                        earnings?.deliveredOrders || 0
                      } delivered`}
                  </p>
                  <span className="ehd-earnings-open">
                    View earnings <ArrowRight size={17} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Link>
          </section>
        ) : null}

        <section
          className="ehd-section ehd-flow"
          aria-labelledby="ehd-flow-title"
        >
          <div className="ehd-flow-head">
            <div>
              <p className="ehd-eyebrow">Recommended flow</p>
              <h2 id="ehd-flow-title" className="ehd-section-title">
                What to do next
              </h2>
            </div>
          </div>
          <div className="ehd-journey">
            {visibleWorkflowStages.slice(0, 1).map((stage) => {
              const Icon = stage.icon;
              return (
                <Link className="ehd-feature" key={stage.step} to={stage.to}>
                  <div className="ehd-feature-meta">
                    <span className="ehd-feature-number">{stage.kicker}</span>
                    <span className="ehd-feature-icon">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                  </div>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                  <span className="ehd-feature-cta">
                    {stage.action}
                    <ArrowRight size={18} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
            <div className="ehd-journey-more">
              {visibleWorkflowStages.slice(1).map((stage) => {
                const Icon = stage.icon;
                return (
                  <Link
                    className="ehd-journey-row"
                    key={stage.step}
                    to={stage.to}
                  >
                    <span className="ehd-row-index">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="ehd-row-main">
                      <span className="ehd-row-name">{stage.title}</span>
                      <span className="ehd-row-description">
                        {stage.description}
                      </span>
                    </span>
                    <span className="ehd-row-arrow">
                      <ArrowRight size={19} aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="ehd-section ehd-tools"
          aria-labelledby="ehd-tools-title"
        >
          <div className="ehd-tools-head">
            <div>
              <p className="ehd-eyebrow">Host workspace</p>
              <h2 id="ehd-tools-title" className="ehd-section-title">
                Your business tools
              </h2>
            </div>
            <span className="ehd-tool-count">
              {visibleQuickAccessItems.length} available tools
            </span>
          </div>

          {selectedGroup && (
            <div className="ehd-tool-explorer">
              <div
                className="ehd-group-rail"
                role="group"
                aria-label="Business tool categories"
              >
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
                    <span className="ehd-group-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="ehd-group-copy">
                      <span className="ehd-group-label">{group.label}</span>
                      <span className="ehd-group-caption">
                        {group.items.length} tools
                      </span>
                    </span>
                    <ArrowRight
                      size={19}
                      className="ehd-group-arrow"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              <div
                id="ehd-desktop-tool-panel"
                className="ehd-tool-panel"
                role="region"
                aria-label={`${selectedGroup.label} tools`}
              >
                <div className="ehd-tool-panel-inner" key={selectedGroup.id}>
                  <div className="ehd-tool-panel-heading">
                    <span className="ehd-tool-panel-icon">
                      <SelectedGroupIcon size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="ehd-tool-panel-title">
                        {selectedGroup.label}
                      </h3>
                      <p className="ehd-tool-panel-desc">
                        {selectedGroup.description}
                      </p>
                    </div>
                  </div>
                  <ToolLinks items={selectedGroup.items} />
                </div>
              </div>
            </div>
          )}

          <div className="ehd-tools-mobile">
            {visibleToolGroups.map((group) => {
              const GroupIcon = group.icon;
              const opened = openMobileGroupId === group.id;
              return (
                <div className="ehd-mobile-group" key={group.id}>
                  <button
                    type="button"
                    className="ehd-mobile-trigger"
                    aria-expanded={opened}
                    aria-controls={`ehd-mobile-panel-${group.id}`}
                    onClick={() => setOpenMobileGroupId(opened ? "" : group.id)}
                  >
                    <span className="ehd-mobile-trigger-icon">
                      <GroupIcon size={20} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="ehd-mobile-trigger-title">
                        {group.label}
                      </span>
                      <span className="ehd-mobile-trigger-meta">
                        {group.items.length} tools
                      </span>
                    </span>
                    <ChevronDown size={20} aria-hidden="true" />
                  </button>
                  {opened && (
                    <div
                      className="ehd-mobile-panel"
                      id={`ehd-mobile-panel-${group.id}`}
                    >
                      <ToolLinks items={group.items} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
