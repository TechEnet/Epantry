import {
  BadgeCheck,
  FileCheck2,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import {
  createHostBrandClaim,
  createHostBrandIdentityCheck,
  createHostBrandOverride,
  getBrandWorld,
  listBrandWorlds,
  listHostBrandAuthorities,
  listHostBrandClaims,
  listHostBrandIdentityChecks,
  listHostBrandOverrides,
  submitHostBrandOverride,
} from "../services/brandAuthority.service";

const CLAIM_TYPES = ["owner", "licensee", "distributor"];

const IDENTITY_TYPES = [
  "trademark",
  "corporate_domain",
  "authorization_letter",
  "gs1_company_identity",
  "manufacturer_document",
  "packaging_label",
  "other",
];

const OVERRIDE_FIELDS = [
  "display_name",
  "description",
  "pack_images",
  "ingredient_declaration",
  "allergens",
  "nutrition",
  "dietary_flags",
  "certifications",
  "claims",
  "manufacturer",
  "importer",
  "country_of_origin",
  "net_quantity",
  "preparation_instructions",
  "storage_instructions",
  "category_attributes",
  "packaging",
];

const CRITICAL_FIELDS = new Set([
  "ingredient_declaration",
  "allergens",
  "nutrition",
  "dietary_flags",
  "certifications",
  "claims",
  "net_quantity",
]);

function parseCsv(value) {
  return [
    ...new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete this brand request."
  );
}

function StatusPill({ value }) {
  return (
    <span className="eba-status-pill" data-status={String(value || "unknown").toLowerCase()}>
      {String(value || "unknown").replaceAll("_", " ")}
    </span>
  );
}

const hostBrandStyles = String.raw`
/* EPANTRY brand-management page only. All global UI stays unchanged. */
.eba-page{--eba-forest:#173f35;--eba-deep:#10372d;--eba-clay:#c66c45;--eba-sage:#e5ece3;--eba-porcelain:#f7f6f2;--eba-ink:#242b27;--eba-muted:#52635a;background:var(--eba-porcelain);color:var(--eba-ink);font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.56;min-width:0;padding-bottom:42px}
.eba-page *, .eba-page *::before,.eba-page *::after{box-sizing:border-box}
.eba-page button,.eba-page input,.eba-page select,.eba-page textarea{font:inherit}
.eba-page button,.eba-page a{transition:background-color .17s ease,border-color .17s ease,color .17s ease,transform .17s ease}
.eba-page button:focus-visible,.eba-page a:focus-visible,.eba-page input:focus-visible,.eba-page select:focus-visible,.eba-page textarea:focus-visible{outline:3px solid var(--eba-clay);outline-offset:3px}
.eba-container{display:grid;gap:27px;padding-top:16px}
.eba-top{border:1px solid #d6dfd2;border-radius:16px;overflow:hidden;background:var(--eba-sage)}
.eba-header{display:grid;grid-template-columns:minmax(0,1.28fr) minmax(290px,.72fr)}
.eba-header-main{padding:30px clamp(25px,3vw,46px) 34px;background:var(--eba-forest);color:#fff;min-width:0}
.eba-eyebrow{margin:0 0 10px;color:#a75031;font-weight:800;font-size:13px;line-height:1.4;letter-spacing:.055em;text-transform:uppercase}
.eba-header-main .eba-eyebrow{color:#f2b593}
.eba-eyebrow::before{content:'';display:inline-block;width:21px;height:2px;margin-right:10px;background:currentColor;vertical-align:middle}
.eba-header h1{margin:0!important;color:#fcfaf4!important;font-size:clamp(30px,2.8vw,40px)!important;line-height:1.13!important;letter-spacing:-.045em;font-weight:800}
.eba-header-lead{max-width:680px;margin:13px 0 0;color:#e2eee8;font-size:16px;line-height:1.6}
.eba-header-side{display:flex;flex-direction:column;justify-content:space-between;gap:17px;padding:25px 28px;background:#e4ece2;border-left:3px solid var(--eba-clay);min-width:0}
.eba-side-label{font-size:13px;font-weight:800;color:#a65233;text-transform:uppercase;letter-spacing:.055em;margin:0 0 9px}
.eba-next-status{font-size:24px!important;line-height:1.2!important;letter-spacing:-.03em;color:var(--eba-forest);font-weight:800;margin:0}
.eba-header-side p.eba-side-help{margin:9px 0 0;font-size:15px;line-height:1.5;color:#3b574a}
.eba-side-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:17px}
.eba-next-link{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border:1px solid var(--eba-clay);border-radius:9px;background:var(--eba-clay);color:#fff!important;text-decoration:none;font-size:14px;font-weight:800;min-height:44px}
.eba-next-link:hover{background:#a65333;border-color:#a65333;transform:translateY(-1px)}
.eba-support-links{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.eba-link,.eba-button-ghost{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 12px;border:1px solid #b9cbbd;border-radius:8px;background:#f9fbf7;color:var(--eba-forest);font-size:13px;font-weight:750;text-decoration:none;min-height:40px;cursor:pointer}
.eba-link:hover,.eba-button-ghost:hover{background:#fff4eb;border-color:#dba78c}
.eba-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid #cbd7cb;background:#eef2ea}
.eba-flow-item{min-width:0;text-decoration:none;display:flex;align-items:center;gap:11px;padding:16px 17px;border-right:1px solid #d2ddd0;color:var(--eba-forest)}
.eba-flow-item:last-child{border-right:0}
.eba-flow-item:hover{background:#f7efe8}
.eba-flow-number{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:8px;background:#fffdfa;border:1px solid #cadacd;color:#a85132;font-size:14px;font-weight:850}
.eba-flow-item b{display:block;font-size:15px;line-height:1.33;font-weight:800}
.eba-flow-item small{display:block;color:#647269;font-size:13px;line-height:1.45;margin-top:2px}
.eba-notice{border-left:4px solid #bf6542;background:#fbebe2;color:#7e3625;border-radius:8px;padding:14px 17px;font-size:15px;font-weight:650}
.eba-notice[data-kind='success']{border-left-color:#1e674c;background:#e1eee3;color:#164c37}
.eba-loading{background:#e6ede3;border-radius:12px;padding:26px;font-size:16px;color:var(--eba-forest)}
.eba-stage{scroll-margin-top:88px;display:grid;grid-template-columns:minmax(220px,.34fr) minmax(0,.66fr);border:1px solid #dae1d6;border-top:3px solid var(--eba-forest);border-radius:11px;overflow:hidden;background:#fffdfa;min-width:0}
.eba-stage[data-tone='sage']{background:#eef2ec;border-top-color:var(--eba-clay)}
.eba-stage[data-tone='peach']{background:#fbf0e9;border-top-color:var(--eba-clay)}
.eba-stage-intro{padding:30px 28px 25px;border-right:1px solid #dfe6dc;min-width:0}
.eba-stage[data-tone='sage'] .eba-stage-intro{background:#e0e9de}
.eba-stage[data-tone='peach'] .eba-stage-intro{background:#f5e7dc}
.eba-stage-intro h2,.eba-approval-header h2{margin:0;color:var(--eba-forest);font-size:clamp(24px,2.05vw,29px);font-weight:800;line-height:1.22;letter-spacing:-.035em}
.eba-stage-intro p.eba-stage-descr{color:#4b5f52;font-size:16px;line-height:1.55;margin:12px 0 0;max-width:340px}
.eba-stage-hint{margin-top:23px;padding-top:16px;border-top:1px solid #cfdbcf;color:#41604f;font-size:14px;line-height:1.5}
.eba-stage-hint b{display:block;color:var(--eba-forest);font-size:14px;margin-bottom:5px}
.eba-stage-body{padding:28px clamp(22px,2.4vw,35px);min-width:0}
.eba-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 19px;min-width:0}
.eba-field{display:flex;flex-direction:column;gap:7px;min-width:0}
.eba-field>span{font-size:15px;line-height:1.35;font-weight:750;color:#33483a}
.eba-field input,.eba-field select,.eba-field textarea{display:block;width:100%;min-width:0;min-height:48px;background:#fff!important;color:#222b26!important;border:1px solid #c7d3c7;border-radius:9px;padding:11px 13px;font-size:15px!important;line-height:1.5!important;box-shadow:0 1px 0 rgba(21,53,36,.03)}
.eba-field textarea{min-height:90px;resize:vertical}
.eba-field input::placeholder,.eba-field textarea::placeholder{color:#788479}
.eba-field input:focus,.eba-field select:focus,.eba-field textarea:focus{border-color:var(--eba-clay)}
.eba-span-2{grid-column:1/-1}
.eba-form-actions{display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin-top:21px}
.eba-primary,.eba-clay-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:11px 20px;border-radius:9px;background:var(--eba-forest);color:#fff!important;border:1px solid var(--eba-forest);font-size:15px;font-weight:800;cursor:pointer;text-align:center}
.eba-primary:hover:not(:disabled){background:#25604e;border-color:#25604e}
.eba-clay-button{background:var(--eba-clay);border-color:var(--eba-clay)}
.eba-clay-button:hover:not(:disabled){background:#af5735;border-color:#af5735}
.eba-page button:disabled{opacity:.58;cursor:not-allowed}
.eba-form-foot{font-size:14px;color:#52685a;line-height:1.5}
.eba-history-inline{margin-top:24px;border-top:1px solid #dde5da;padding-top:17px}
.eba-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.eba-history-head h3{font-size:17px;line-height:1.3;color:var(--eba-forest);font-weight:800;margin:0}
.eba-mini-tag{font-size:13px;font-weight:800;color:var(--eba-forest);background:#e3ede4;border-radius:7px;padding:6px 9px;white-space:nowrap}
.eba-list{display:grid;gap:0;border-top:1px solid #d6e2d7;margin-top:12px}
.eba-list-row{padding:13px 0;border-bottom:1px solid #d8e3d8;min-width:0}
.eba-list-row:last-child{border-bottom:0}
.eba-row-main{display:flex;align-items:center;justify-content:space-between;gap:11px;flex-wrap:wrap}
.eba-row-main strong{font-size:16px;color:var(--eba-forest);font-weight:800;text-transform:capitalize;line-height:1.4}
.eba-row-meta{display:grid;gap:4px;margin-top:6px;font-size:14px;color:#53655a;line-height:1.5;overflow-wrap:anywhere}
.eba-empty{padding:15px 0 4px;color:#5b6c60;font-size:15px;line-height:1.5;margin:0}
.eba-status-pill{display:inline-flex;max-width:100%;padding:5px 10px;border-radius:100px;border:1px solid #bccdbc;background:#e5f1e7;color:#28583e;font-size:13px;font-weight:750;line-height:1.35;text-transform:capitalize}
.eba-status-pill[data-status='pending'],.eba-status-pill[data-status='submitted'],.eba-status-pill[data-status='under_review'],.eba-status-pill[data-status='requested']{background:#fff1df;border-color:#e5ccb1;color:#874d2e}
.eba-status-pill[data-status='rejected'],.eba-status-pill[data-status='revoked']{background:#fae7e5;border-color:#e7b5b0;color:#9b3939}
.eba-status-pill[data-status='draft']{background:#edf0f1;border-color:#d2dadd;color:#4c5e67}
.eba-approval{scroll-margin-top:88px;background:#e6eee5;border:1px solid #c9d8c8;border-top:4px solid var(--eba-clay);border-radius:12px;overflow:hidden}
.eba-approval-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:30px 30px 24px;border-bottom:1px solid #cbdccd}
.eba-approval-header p.eba-approval-lead{margin:10px 0 0;color:#3f5a49;font-size:16px;line-height:1.55;max-width:840px}
.eba-approval-total{white-space:nowrap;background:var(--eba-forest);color:#fff;border-radius:8px;padding:9px 13px;font-size:14px;font-weight:750}
.eba-approval-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.eba-approval-col{padding:24px 30px 29px;min-width:0}
.eba-approval-col + .eba-approval-col{border-left:1px solid #cddccd;background:#f6f8f3}
.eba-approval-col h3{font-size:20px;letter-spacing:-.02em;color:var(--eba-forest);font-weight:800;margin:0}
.eba-approval-col p.eba-approval-sub{font-size:14px;color:#526758;margin:5px 0 0}
.eba-approval-col .eba-empty{border-top:1px solid #cbd9ca;margin-top:15px}
.eba-lock{padding:25px 25px;border:1px solid #dacfc5;background:#fffaf6;border-left:4px solid var(--eba-clay);border-radius:10px;display:flex;gap:15px;align-items:flex-start;color:var(--eba-forest)}
.eba-lock strong{font-size:18px;color:var(--eba-forest);display:block;line-height:1.3}
.eba-lock p{margin:6px 0 13px;color:#4b6051;font-size:15px;line-height:1.6}
.eba-inline-link{display:inline-flex;align-items:center;gap:7px;color:var(--eba-forest);font-weight:800;font-size:14px;text-decoration:underline;text-underline-offset:4px}
.eba-inline-link:hover{color:#a94e2e}
.eba-request-actions{margin-top:11px}
.eba-request-actions button{min-height:40px;padding:9px 13px;border:1px solid var(--eba-forest);background:var(--eba-forest);color:#fff;border-radius:8px;font-size:14px;font-weight:750;display:inline-flex;gap:7px;align-items:center;cursor:pointer}
.eba-request-actions button:hover:not(:disabled){background:#285e4c}
.eba-product-history{margin-top:22px;border-top:1px solid #daccbf;padding-top:18px}
.eba-product-history h3{font-size:19px;color:var(--eba-forest);margin:0;line-height:1.3;font-weight:800}
@media(max-width:1000px){.eba-header{grid-template-columns:1fr}.eba-header-side{border-left:0;border-top:3px solid var(--eba-clay);flex-direction:row;align-items:center}.eba-flow-item{padding:13px}.eba-stage{grid-template-columns:minmax(210px,.36fr) minmax(0,.64fr)}.eba-stage-intro{padding:25px 20px}.eba-stage-body{padding:24px 21px}}
@media(max-width:760px){.eba-header-side{display:block}.eba-stage{grid-template-columns:1fr}.eba-stage-intro{padding:20px 21px 17px;border-right:0;border-bottom:1px solid #d7e0d4}.eba-stage-intro p.eba-stage-descr{max-width:none}.eba-stage-hint{margin-top:12px;padding-top:11px}.eba-stage-body{padding:22px 20px}.eba-approval-grid{grid-template-columns:1fr}.eba-approval-col + .eba-approval-col{border-left:0;border-top:1px solid #cbd9ca}.eba-approval-col{padding:22px 21px}}
@media(max-width:600px){.eba-page{font-size:15px;padding-bottom:28px}.eba-container{gap:21px;padding-top:11px}.eba-top{border-radius:12px}.eba-header-main{padding:23px 20px}.eba-header h1{font-size:29px!important}.eba-header-lead{font-size:15px;line-height:1.52}.eba-header-side{padding:18px 20px}.eba-next-status{font-size:22px!important}.eba-header-side p.eba-side-help{font-size:14px}.eba-side-actions{margin-top:12px}.eba-next-link{width:100%}.eba-support-links{width:100%}.eba-support-links>*{flex:1}.eba-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.eba-flow-item{padding:12px 12px;gap:9px;border-bottom:1px solid #d1ddd0}.eba-flow-item:nth-child(even){border-right:0}.eba-flow-number{width:29px;height:29px;font-size:12px}.eba-flow-item b{font-size:14px}.eba-flow-item small{font-size:12.5px}.eba-stage-intro{padding:19px 18px 15px}.eba-stage-intro h2,.eba-approval-header h2{font-size:23px}.eba-stage-intro p.eba-stage-descr{font-size:15px;margin-top:8px}.eba-stage-body{padding:18px}.eba-fields{grid-template-columns:1fr;gap:13px}.eba-span-2{grid-column:auto}.eba-field>span{font-size:14px}.eba-field input,.eba-field select,.eba-field textarea{min-height:47px;font-size:15px!important;padding:10px 12px}.eba-form-actions{margin-top:17px}.eba-primary,.eba-clay-button{width:100%;font-size:14px}.eba-approval-header{padding:20px 18px 17px;display:block}.eba-approval-header p.eba-approval-lead{font-size:15px}.eba-approval-total{display:inline-flex;margin-top:13px}.eba-approval-col{padding:20px 18px}.eba-approval-col h3{font-size:18px}.eba-lock{padding:18px 15px;gap:10px}.eba-row-meta{font-size:13.5px}.eba-history-inline{margin-top:18px}.eba-product-history{margin-top:18px}.eba-flow-item:nth-child(n+3){border-bottom:0}}
/* Mobile-only: a guided workflow rather than stacked desktop panels. */
@media (max-width:600px){
  .eba-page{font-size:15px;line-height:1.52;padding-bottom:28px}
  .eba-container{gap:18px;padding-top:9px}
  .eba-top{border-radius:11px;border-color:#d5ded3;background:#e8efe6}
  .eba-header-main{padding:22px 19px 21px}
  .eba-header-main .eba-eyebrow{margin-bottom:9px;font-size:12.5px;letter-spacing:.035em}
  .eba-header h1{font-size:27px!important;line-height:1.12!important;letter-spacing:-.035em}
  .eba-header-lead{margin-top:9px;font-size:14.5px;line-height:1.52}
  .eba-header-side{padding:17px 19px 16px;gap:10px;border-top:2px solid var(--eba-clay)}
  .eba-side-label{margin-bottom:4px;font-size:12.5px}
  .eba-next-status{font-size:20px!important;line-height:1.24!important}
  .eba-header-side p.eba-side-help{font-size:14px;line-height:1.45;margin-top:6px}
  .eba-side-actions{margin-top:12px}
  .eba-next-link{width:100%;min-height:44px;font-size:14px;padding:10px 13px}
  .eba-support-links{width:100%;gap:8px}
  .eba-support-links>*{flex:1;min-width:0;min-height:42px;font-size:13px;padding:9px 7px}
  .eba-flow{grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid #d0ddd0;background:#edf2eb}
  .eba-flow-item{min-height:62px;padding:10px 10px;gap:9px;border-bottom:1px solid #d4dfd1}
  .eba-flow-item:nth-child(even){border-right:0}
  .eba-flow-item:nth-child(n+3){border-bottom:0}
  .eba-flow-number{width:28px;height:28px;border-radius:7px;font-size:12.5px}
  .eba-flow-item b{font-size:13.5px;line-height:1.25}
  .eba-flow-item small{font-size:12.5px;line-height:1.35;margin-top:2px}
  .eba-notice{padding:12px 14px;font-size:14px}
  .eba-loading{padding:20px 16px;font-size:15px}
  .eba-stage{display:block;border:1px solid #d7dfd3;border-top:3px solid var(--eba-forest);border-radius:10px;background:#fffdfa;overflow:hidden}
  .eba-stage[data-tone='sage']{border-top-color:var(--eba-clay);background:#fffdfa}
  .eba-stage[data-tone='peach']{border-top-color:var(--eba-clay);background:#fffdfa}
  .eba-stage-intro{padding:17px 16px 14px;border:0;border-bottom:1px solid #dbe2d8;background:#edf1e9}
  .eba-stage[data-tone='sage'] .eba-stage-intro{background:#e5ede3}
  .eba-stage[data-tone='peach'] .eba-stage-intro{background:#f6eae0}
  .eba-stage-intro .eba-eyebrow,.eba-approval-header .eba-eyebrow{font-size:12.5px;letter-spacing:.025em;margin:0 0 7px}
  .eba-stage-intro h2,.eba-approval-header h2{font-size:21px!important;line-height:1.23!important;letter-spacing:-.025em}
  .eba-stage-intro p.eba-stage-descr{font-size:14px;line-height:1.45;margin:7px 0 0;max-width:none}
  .eba-stage-hint{font-size:13px;line-height:1.42;margin-top:11px;padding-top:9px;border-top:1px solid #d1dbcf}
  .eba-stage-hint b{font-size:13px;margin-bottom:3px}
  .eba-stage-body{padding:16px 15px 17px;background:#fffdfa}
  .eba-fields{display:grid;grid-template-columns:1fr;gap:12px}
  .eba-span-2{grid-column:auto}
  .eba-field{gap:5px}
  .eba-field>span{font-size:13.5px;line-height:1.4;font-weight:750;letter-spacing:0;color:#31483b}
  .eba-field input,.eba-field select,.eba-field textarea{min-height:45px;padding:10px 11px;font-size:15px!important;line-height:1.45!important;border-radius:8px;border-color:#c5d1c6;background:#fff!important;max-width:100%}
  .eba-field textarea{min-height:77px}
  .eba-form-actions{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin-top:14px}
  .eba-primary,.eba-clay-button{width:100%;min-height:46px;font-size:14.5px;border-radius:8px;padding:10px 14px}
  .eba-form-foot{font-size:13px;line-height:1.4;margin:0}
  .eba-history-inline{padding-top:13px;margin-top:16px}
  .eba-history-head{gap:8px;align-items:center}
  .eba-history-head h3{font-size:17px;line-height:1.3}
  .eba-mini-tag{font-size:12.5px;padding:5px 8px}
  .eba-list{margin-top:9px}
  .eba-list-row{padding:11px 0}
  .eba-row-main strong{font-size:15px}
  .eba-row-meta{font-size:13.5px;line-height:1.4;gap:3px}
  .eba-empty{font-size:14px;line-height:1.45;padding:10px 0 2px}
  .eba-status-pill{font-size:12.5px;padding:4px 9px}
  .eba-approval{display:block;border-radius:10px;border:1px solid #c6d8cb;border-top:4px solid var(--eba-clay);overflow:hidden;background:#e7efe6}
  .eba-approval-header{display:block;padding:19px 16px 16px;background:#173f35;border-bottom:0}
  .eba-approval-header .eba-eyebrow{color:#f3b58d}
  .eba-approval-header h2{color:#fff!important;font-size:23px!important}
  .eba-approval-header p.eba-approval-lead{font-size:14px;line-height:1.46;color:#dfebe1;margin-top:7px}
  .eba-approval-total{display:inline-flex;margin-top:11px;background:#e6eee5;color:#173f35;border:1px solid #cbdacc;font-size:13px;padding:6px 10px}
  .eba-approval-grid{display:block}
  .eba-approval-col{padding:17px 16px 18px;background:#e7efe6}
  .eba-approval-col + .eba-approval-col{padding-top:17px;border:0;border-top:1px solid #cbd9ca;background:#f8f8f4}
  .eba-approval-col h3{font-size:18px;line-height:1.3}
  .eba-approval-col p.eba-approval-sub{font-size:13.5px;line-height:1.45;margin-top:4px}
  .eba-approval-col .eba-empty{margin-top:9px;border-top:1px solid #cfdbce}
  .eba-lock{padding:6px 0 6px 12px;gap:10px;border:0;border-left:3px solid var(--eba-clay);border-radius:0;background:transparent}
  .eba-lock strong{font-size:16px;line-height:1.35}
  .eba-lock p{font-size:14px;line-height:1.47;margin:6px 0 10px}
  .eba-inline-link{font-size:13.5px}
  .eba-product-history{margin-top:15px;padding-top:15px}
  .eba-product-history h3{font-size:17px}
  .eba-request-actions button{min-height:43px;font-size:14px}
}
@media(max-width:360px){
  .eba-header-main{padding-inline:16px}
  .eba-header-side{padding-inline:16px}
  .eba-stage-intro{padding-inline:14px}
  .eba-stage-body{padding-inline:13px}
  .eba-approval-header,.eba-approval-col{padding-inline:14px}
  .eba-flow-item{padding-inline:7px;gap:6px}
  .eba-flow-item b{font-size:13px}
}

/* Phone copy: original desktop copy remains unchanged and visible above 600px. */
.eba-mobile-copy,.eba-mobile-note{display:none}
@media(max-width:600px){
  .eba-desktop-copy{display:none!important}
  .eba-mobile-copy{display:inline!important}
  .eba-mobile-note{display:block;color:#375744;font-size:13.5px;line-height:1.45;font-weight:700;margin-top:2px}
  .eba-page{font-size:15px;line-height:1.46}
  .eba-container{gap:15px}
  .eba-header-main{padding:19px 17px 19px}
  .eba-header h1{font-size:26px!important;line-height:1.1!important}
  .eba-header-lead{font-size:14px;line-height:1.45;margin-top:8px}
  .eba-header-side{padding:15px 17px 15px}
  .eba-side-label{font-size:12.5px}
  .eba-next-status{font-size:19px!important;line-height:1.25!important}
  .eba-header-side .eba-side-help{display:none}
  .eba-side-actions{margin-top:11px}
  .eba-flow{grid-template-columns:repeat(4,minmax(0,1fr));gap:0}
  .eba-flow-item{min-width:0;flex-direction:column;justify-content:center;text-align:center;gap:5px;padding:11px 4px;min-height:68px;border-bottom:0;border-right:1px solid #d2ddd0}
  .eba-flow-number{width:27px;height:27px;font-size:12px}
  .eba-flow-item b{font-size:12px;line-height:1.25;overflow-wrap:break-word}
  .eba-flow-item small{display:none}
  .eba-stage-intro{padding:16px 15px 13px}
  .eba-stage-intro h2{font-size:21px!important;line-height:1.2!important}
  .eba-stage-intro .eba-stage-descr,.eba-stage-intro .eba-stage-hint{display:none}
  .eba-stage-body{padding:15px 14px 17px}
  .eba-fields{gap:12px}
  .eba-field>span{font-size:14px;line-height:1.3}
  .eba-field input,.eba-field select,.eba-field textarea{font-size:15px!important;min-height:46px}
  .eba-field textarea{min-height:76px}
  .eba-form-actions{margin-top:15px}
  .eba-form-foot{font-size:13.5px;line-height:1.4}
  .eba-approval-header{padding:17px 15px 15px}
  .eba-approval-header h2{font-size:22px!important}
  .eba-approval-header .eba-approval-lead{display:none}
  .eba-approval-total{font-size:13px;margin-top:9px}
  .eba-approval-col{padding:16px 15px}
  .eba-approval-col + .eba-approval-col{padding-top:16px}
  .eba-approval-col h3{font-size:17px}
  .eba-approval-col .eba-approval-sub{display:none}
  .eba-lock{padding:7px 0 7px 11px}
  .eba-lock strong{font-size:16px}
  .eba-lock p{font-size:14px;margin:6px 0 10px}
  .eba-product-history{margin-top:16px}
  .eba-product-history h3{font-size:17px}
  .eba-row-main strong{font-size:15px}
  .eba-list-row{padding:11px 0}
  .eba-status-pill{font-size:13px}
}
@media(max-width:360px){
  .eba-flow-item{padding-inline:2px}
  .eba-flow-item b{font-size:11.5px}
}

@media(prefers-reduced-motion:reduce){.eba-page button,.eba-page a{transition:none!important}}

`;

export default function HostBrandAuthorityPage() {
  const [brands, setBrands] = useState([]);

  const [checks, setChecks] = useState([]);

  const [claims, setClaims] = useState([]);

  const [authorities, setAuthorities] = useState([]);

  const [proposals, setProposals] = useState([]);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState(null);

  const [success, setSuccess] = useState(null);

  const [identityForm, setIdentityForm] = useState({
    brandId: "",

    checkType: "trademark",

    evidenceReference: "",

    evidenceSummary: "",

    sourceAuthority: "",
  });

  const [claimForm, setClaimForm] = useState({
    brandId: "",

    claimType: "owner",

    markets: "IN",

    evidenceCheckId: "",

    statement: "",
  });

  const [overrideForm, setOverrideForm] = useState({
    authorityGrantId: "",

    packId: "",

    markets: "IN",

    fieldKey: "description",

    proposedValue: "",

    changeReason: "",

    evidenceCheckId: "",
  });

  const [authorityBrandWorld, setAuthorityBrandWorld] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);

    setError(null);

    try {
      const [
        brandResult,
        checkResult,
        claimResult,
        authorityResult,
        proposalResult,
      ] = await Promise.all([
        listBrandWorlds({
          limit: 100,
        }),

        listHostBrandIdentityChecks({
          limit: 100,

          status: "all",
        }),

        listHostBrandClaims({
          limit: 100,

          status: "all",
        }),

        listHostBrandAuthorities({
          limit: 100,

          status: "all",
        }),

        listHostBrandOverrides({
          limit: 100,

          status: "all",
        }),
      ]);

      setBrands(brandResult?.brands || []);

      setChecks(checkResult?.identityChecks || []);

      setClaims(claimResult?.claims || []);

      setAuthorities(authorityResult?.authorities || []);

      setProposals(proposalResult?.proposals || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const authority = authorities.find(
      (item) => item.id === overrideForm.authorityGrantId
    );

    if (!authority) {
      setAuthorityBrandWorld(null);

      return;
    }

    let active = true;

    getBrandWorld(authority.brandId)
      .then((result) => {
        if (active) {
          setAuthorityBrandWorld(result);
        }
      })
      .catch(() => {
        if (active) {
          setAuthorityBrandWorld(null);
        }
      });

    setOverrideForm((current) => ({
      ...current,

      markets: authority.marketCodes?.join(", ") || current.markets,
    }));

    return () => {
      active = false;
    };
  }, [authorities, overrideForm.authorityGrantId]);

  const availableProducts = useMemo(
    () =>
      (authorityBrandWorld?.productFamilies || []).flatMap(
        (family) => family.products || []
      ),
    [authorityBrandWorld]
  );

  const selectedProduct =
    availableProducts.find(
      (product) => product.packId === overrideForm.packId
    ) || null;

  const selectedAuthority =
    authorities.find(
      (authority) => authority.id === overrideForm.authorityGrantId
    ) || null;

  const claimEvidenceOptions = checks.filter(
    (check) => check.brandId === claimForm.brandId
  );

  const overrideEvidenceOptions = checks.filter(
    (check) =>
      check.brandId === selectedAuthority?.brandId &&
      check.status === "verified"
  );

  async function execute(operation, message) {
    if (busy) {
      return;
    }

    setBusy(true);

    setError(null);

    setSuccess(null);

    try {
      await operation();

      setSuccess(message);

      await loadAll();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  function submitIdentity(event) {
    event.preventDefault();

    execute(
      () =>
        createHostBrandIdentityCheck(identityForm.brandId, {
          checkType: identityForm.checkType,

          evidenceReference: identityForm.evidenceReference,

          evidenceSummary: identityForm.evidenceSummary,

          sourceAuthority: identityForm.sourceAuthority,
        }),
      "Brand proof submitted for review."
    );
  }

  function submitClaim(event) {
    event.preventDefault();

    execute(
      () =>
        createHostBrandClaim(claimForm.brandId, {
          claimType: claimForm.claimType,

          requestedMarketCodes: parseCsv(claimForm.markets),

          evidenceCheckIds: [claimForm.evidenceCheckId].filter(Boolean),

          statement: claimForm.statement,
        }),
      "Brand access request submitted for review."
    );
  }

  function submitOverrideDraft(event) {
    event.preventDefault();

    if (!selectedProduct) {
      setError("Choose a product before saving this update.");

      return;
    }

    const critical = CRITICAL_FIELDS.has(overrideForm.fieldKey);

    execute(
      () =>
        createHostBrandOverride({
          authorityGrantId: overrideForm.authorityGrantId,

          productFamilyId: selectedProduct.productFamilyId,

          productVariantId: selectedProduct.productVariantId,

          packId: selectedProduct.packId,

          baseProductVersionId: selectedProduct.currentVersion?.id,

          marketCodes: parseCsv(overrideForm.markets),

          fieldChanges: [
            {
              fieldKey: overrideForm.fieldKey,

              proposedValue: overrideForm.proposedValue,

              changeReason: overrideForm.changeReason,

              evidenceCheckIds:
                critical && overrideForm.evidenceCheckId
                  ? [overrideForm.evidenceCheckId]
                  : [],
            },
          ],
        }),
      "Product update draft saved."
    );
  }

  const activeBrandAccess = authorities.filter((authority) => authority.status === "active");
  const brandNextStep = activeBrandAccess.length
    ? { title: "You have approved brand access", detail: "You can suggest updates to products covered by your permission.", action: "Update a brand product", href: "#brand-products" }
    : claims.length
    ? { title: "Check your approval status", detail: "Your access requests are listed below with their current decisions.", action: "View access requests", href: "#brand-approvals" }
    : checks.length
    ? { title: "Now request brand access", detail: "Choose the proof you submitted and tell us your role with the brand.", action: "Request brand access", href: "#brand-request" }
    : { title: "Start with brand proof", detail: "First show your connection to the brand. Then you can ask for permission.", action: "Submit brand proof", href: "#brand-proof" };

  return (
    <main className="eba-page">
      <style>{hostBrandStyles}</style>
      <div className="page-shell eba-container">
        <header className="eba-top">
          <div className="eba-header">
            <div className="eba-header-main">
              <p className="eba-eyebrow">Host / Brand management</p>
              <h1><span className="eba-desktop-copy">Brand access &amp; approvals</span><span className="eba-mobile-copy">Manage your brand</span></h1>
              <p className="eba-header-lead">
                <span className="eba-desktop-copy">Show your connection to a brand, get permission to manage it, then send product changes for review.</span><span className="eba-mobile-copy">Verify your brand, request access and manage products.</span>
              </p>
            </div>
            <aside className="eba-header-side" aria-label="Your next brand management step">
              <div>
                <p className="eba-side-label">Your next step</p>
                <h2 className="eba-next-status">{brandNextStep.title}</h2>
                <p className="eba-side-help">{brandNextStep.detail}</p>
                <div className="eba-side-actions">
                  <a href={brandNextStep.href} className="eba-next-link">
                    {brandNextStep.action} <Send size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
              <div className="eba-support-links">
                <button type="button" onClick={loadAll} className="eba-button-ghost" disabled={loading}>
                  <RefreshCw size={16} aria-hidden="true" /> Refresh status
                </button>
                <Link to="/host/marketplace" className="eba-link">
                  <Store size={16} aria-hidden="true" /> Pricing &amp; Stock
                </Link>
              </div>
            </aside>
          </div>
          <nav className="eba-flow" aria-label="Brand access steps">
            <a className="eba-flow-item" href="#brand-proof">
              <span className="eba-flow-number">01</span><span><b>Show proof</b><small>Confirm your connection</small></span>
            </a>
            <a className="eba-flow-item" href="#brand-request">
              <span className="eba-flow-number">02</span><span><b>Request access</b><small>Choose brand and role</small></span>
            </a>
            <a className="eba-flow-item" href="#brand-approvals">
              <span className="eba-flow-number">03</span><span><b>Check approval</b><small>See Super Admin's decision</small></span>
            </a>
            <a className="eba-flow-item" href="#brand-products">
              <span className="eba-flow-number">04</span><span><b>Update products</b><small>After access is granted</small></span>
            </a>
          </nav>
        </header>

        {error && <div role="alert" className="eba-notice">{error}</div>}
        {success && <div role="status" className="eba-notice" data-kind="success">{success}</div>}

        {loading ? (
          <div role="status" className="eba-loading">Loading your brand requests and permissions...</div>
        ) : (
          <>
            <section id="brand-proof" className="eba-stage" aria-labelledby="brand-proof-heading">
              <div className="eba-stage-intro">
                <p className="eba-eyebrow">Step 01 / Brand proof</p>
                <h2 id="brand-proof-heading"><span className="eba-desktop-copy">First, show your connection to the brand</span><span className="eba-mobile-copy">Verify your brand</span></h2>
                <p className="eba-stage-descr">Select the brand and provide a document link or reference that shows your relationship.</p>
                <div className="eba-stage-hint">
                  <b>What happens after this?</b>
                  Your proof will appear below. Use it when requesting brand access in Step 2.
                </div>
              </div>
              <div className="eba-stage-body">
                <form onSubmit={submitIdentity} className="eba-fields">
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">Which brand do you represent?</span><span className="eba-mobile-copy">Brand</span></span>
                    <select required value={identityForm.brandId}
                      onChange={(event) => setIdentityForm({ ...identityForm, brandId: event.target.value })}>
                      <option value="">Select a brand</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>{brand.displayName || brand.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">What kind of proof do you have?</span><span className="eba-mobile-copy">Proof type</span></span>
                    <select value={identityForm.checkType}
                      onChange={(event) => setIdentityForm({ ...identityForm, checkType: event.target.value })}>
                      {IDENTITY_TYPES.map((type) => (
                        <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </label>
                  <label className="eba-field eba-span-2">
                    <span>Document link or reference</span>
                    <input required value={identityForm.evidenceReference}
                      onChange={(event) => setIdentityForm({ ...identityForm, evidenceReference: event.target.value })}
                      placeholder="Paste a document link or its reference number" />
                  </label>
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">Who issued this document? (optional)</span><span className="eba-mobile-copy">Issued by (optional)</span></span>
                    <input value={identityForm.sourceAuthority}
                      onChange={(event) => setIdentityForm({ ...identityForm, sourceAuthority: event.target.value })}
                      placeholder="Company or issuing authority" />
                  </label>
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">What does it confirm? (optional)</span><span className="eba-mobile-copy">Details (optional)</span></span>
                    <textarea rows={2} value={identityForm.evidenceSummary}
                      onChange={(event) => setIdentityForm({ ...identityForm, evidenceSummary: event.target.value })}
                      placeholder="Briefly explain your connection" />
                  </label>
                  <div className="eba-form-actions eba-span-2">
                    <button type="submit" disabled={busy} className="eba-primary">
                      {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                      <ShieldCheck size={16} aria-hidden="true" /> Submit brand proof
                    </button>
                  </div>
                </form>
                <div className="eba-history-inline">
                  <div className="eba-history-head">
                    <h3>Your submitted proof</h3><span className="eba-mini-tag">{checks.length} on file</span>
                  </div>
                  {checks.length ? (
                    <div className="eba-list">
                      {checks.map((check) => (
                        <div key={check.id} className="eba-list-row">
                          <div className="eba-row-main">
                            <strong>{String(check.checkType || "Brand document").replaceAll("_", " ")}</strong>
                            <StatusPill value={check.status} />
                          </div>
                          <div className="eba-row-meta">
                            <span>{brands.find((brand) => brand.id === check.brandId)?.displayName || brands.find((brand) => brand.id === check.brandId)?.name || "Brand proof"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="eba-empty">No proof submitted yet. Complete the form above to begin.</p>
                  )}
                </div>
              </div>
            </section>

            <section id="brand-request" className="eba-stage" data-tone="sage" aria-labelledby="brand-request-heading">
              <div className="eba-stage-intro">
                <p className="eba-eyebrow">Step 02 / Brand access</p>
                <h2 id="brand-request-heading"><span className="eba-desktop-copy">Next, request permission</span><span className="eba-mobile-copy">Request brand access</span></h2>
                <p className="eba-stage-descr">Tell EPANTRY whether you own, license or distribute the brand, and where you need access.</p>
                <div className="eba-stage-hint">
                  <b>Use the proof from Step 1</b>
                  {checks.length
                    ? "Choose the same brand and select its submitted proof in this form."
                    : "Submit brand proof first. It will then be available to select here."}
                </div>
              </div>
              <div className="eba-stage-body">
                <form onSubmit={submitClaim} className="eba-fields">
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">Which brand do you need access to?</span><span className="eba-mobile-copy">Brand</span></span>
                    <select required value={claimForm.brandId}
                      onChange={(event) => setClaimForm({ ...claimForm, brandId: event.target.value, evidenceCheckId: "" })}>
                      <option value="">Select a brand</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>{brand.displayName || brand.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">Your role with the brand</span><span className="eba-mobile-copy">Your role</span></span>
                    <select value={claimForm.claimType}
                      onChange={(event) => setClaimForm({ ...claimForm, claimType: event.target.value })}>
                      {CLAIM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type === "owner" ? "Brand owner" : type === "licensee" ? "Licensed partner" : "Authorized distributor"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">Countries where you need access (codes)</span><span className="eba-mobile-copy">Market codes</span></span>
                    <input required value={claimForm.markets}
                      onChange={(event) => setClaimForm({ ...claimForm, markets: event.target.value })}
                      placeholder="IN, US" />
                  </label>
                  <label className="eba-field">
                    <span><span className="eba-desktop-copy">Select your submitted brand proof</span><span className="eba-mobile-copy">Brand proof</span></span>
                    <select required value={claimForm.evidenceCheckId}
                      onChange={(event) => setClaimForm({ ...claimForm, evidenceCheckId: event.target.value })}>
                      <option value="">Choose proof for this brand</option>
                      {claimEvidenceOptions.map((check) => (
                        <option key={check.id} value={check.id}>
                          {String(check.checkType || "Proof").replaceAll("_", " ")} · {String(check.status || "submitted").replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="eba-field eba-span-2">
                    <span><span className="eba-desktop-copy">Anything Super Admin should know? (optional)</span><span className="eba-mobile-copy">Note (optional)</span></span>
                    <textarea rows={2} value={claimForm.statement}
                      onChange={(event) => setClaimForm({ ...claimForm, statement: event.target.value })}
                      placeholder="Add a short note if needed" />
                  </label>
                  <div className="eba-form-actions eba-span-2">
                    <button type="submit" disabled={busy} className="eba-clay-button">
                      <Send size={16} aria-hidden="true" /> Send access request
                    </button>
                    <span className="eba-form-foot">Follow your request in Step 3.</span>
                  </div>
                </form>
              </div>
            </section>

            <section id="brand-approvals" className="eba-approval" aria-labelledby="brand-approvals-heading">
              <div className="eba-approval-header">
                <div>
                  <p className="eba-eyebrow">Step 03 / Super Admin decision</p>
                  <h2 id="brand-approvals-heading"><span className="eba-desktop-copy">Your brand access &amp; approvals</span><span className="eba-mobile-copy">Your approvals</span></h2>
                  <p className="eba-approval-lead">Check your requests on the left. Approved access appears on the right and lets you manage eligible brand products.</p>
                </div>
                <span className="eba-approval-total">{activeBrandAccess.length} active {activeBrandAccess.length === 1 ? "permission" : "permissions"}</span>
              </div>
              <div className="eba-approval-grid">
                <div className="eba-approval-col">
                  <h3>Access requests</h3>
                  <p className="eba-approval-sub">Super Admin reviews the brand relationship you submitted.</p>
                  {claims.length ? (
                    <div className="eba-list">
                      {claims.map((claim) => (
                        <div key={claim.id} className="eba-list-row">
                          <div className="eba-row-main">
                            <strong>{brands.find((brand) => brand.id === claim.brandId)?.displayName || brands.find((brand) => brand.id === claim.brandId)?.name || "Brand request"}</strong>
                            <StatusPill value={claim.status} />
                          </div>
                          <div className="eba-row-meta">
                            <span>Requested as: {claim.claimType === "owner" ? "Brand owner" : claim.claimType === "licensee" ? "Licensed partner" : "Authorized distributor"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="eba-empty">No access request yet. Submit Step 2 after adding your proof.</p>
                  )}
                </div>
                <div className="eba-approval-col">
                  <h3>Approved brand permissions</h3>
                  <p className="eba-approval-sub">Only active permissions let you submit product changes.</p>
                  {authorities.length ? (
                    <div className="eba-list">
                      {authorities.map((authority) => (
                        <div key={authority.id} className="eba-list-row">
                          <div className="eba-row-main">
                            <strong>{brands.find((brand) => brand.id === authority.brandId)?.displayName || brands.find((brand) => brand.id === authority.brandId)?.name || "Brand permission"}</strong>
                            <StatusPill value={authority.status} />
                          </div>
                          <div className="eba-row-meta">
                            <span>Role: {String(authority.authorityType || "Brand access").replaceAll("_", " ")}</span>
                            <span>Markets: {authority.marketCodes?.join(", ") || "Not listed"}</span>
                            <span>Allowed work: {authority.scopes?.map((scope) => String(scope).replaceAll("_", " ")).join(", ") || "Not listed"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="eba-empty">No brand access approved yet. Once approved, your permission will appear here.</p>
                  )}
                </div>
              </div>
            </section>

            <section id="brand-products" className="eba-stage" data-tone="peach" aria-labelledby="brand-products-heading">
              <div className="eba-stage-intro">
                <p className="eba-eyebrow">Step 04 / Product changes</p>
                <h2 id="brand-products-heading"><span className="eba-desktop-copy">Update an approved brand product</span><span className="eba-mobile-copy">Update brand products</span></h2>
                <p className="eba-stage-descr">After access is granted, suggest corrections to approved product information.</p>
                <div className="eba-stage-hint">
                  <b>Saving is not submitting.</b>
                  Save the change as a draft first. Then use “Send for review” below so Super Admin can decide.
                </div>
                <p className="eba-mobile-note">Save draft first. Then send it for approval.</p>
              </div>
              <div className="eba-stage-body">
                {activeBrandAccess.length ? (
                  <form onSubmit={submitOverrideDraft}>
                    <div className="eba-fields">
                      <label className="eba-field">
                        <span><span className="eba-desktop-copy">Your approved brand permission</span><span className="eba-mobile-copy">Approved access</span></span>
                        <select required value={overrideForm.authorityGrantId}
                          onChange={(event) => setOverrideForm({ ...overrideForm, authorityGrantId: event.target.value, packId: "" })}>
                          <option value="">Choose approved access</option>
                          {activeBrandAccess.map((authority) => (
                            <option key={authority.id} value={authority.id}>
                              {brands.find((brand) => brand.id === authority.brandId)?.displayName || brands.find((brand) => brand.id === authority.brandId)?.name || authority.brandId} · {String(authority.authorityType || "access").replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="eba-field">
                        <span><span className="eba-desktop-copy">Product you want to update</span><span className="eba-mobile-copy">Product</span></span>
                        <select required value={overrideForm.packId}
                          onChange={(event) => setOverrideForm({ ...overrideForm, packId: event.target.value })}>
                          <option value="">Choose an approved product</option>
                          {availableProducts.map((product) => (
                            <option key={product.packId} value={product.packId}>
                              {product.currentVersion?.displayName || product.familyName} · {product.packName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="eba-field">
                        <span><span className="eba-desktop-copy">What information needs changing?</span><span className="eba-mobile-copy">Field to update</span></span>
                        <select value={overrideForm.fieldKey}
                          onChange={(event) => setOverrideForm({ ...overrideForm, fieldKey: event.target.value })}>
                          {OVERRIDE_FIELDS.map((field) => (
                            <option key={field} value={field}>{field.replaceAll("_", " ")}</option>
                          ))}
                        </select>
                      </label>
                      <label className="eba-field">
                        <span>Market codes</span>
                        <input required value={overrideForm.markets}
                          onChange={(event) => setOverrideForm({ ...overrideForm, markets: event.target.value })}
                          placeholder="IN, US" />
                      </label>
                      <label className="eba-field eba-span-2">
                        <span><span className="eba-desktop-copy">Correct product information</span><span className="eba-mobile-copy">New information</span></span>
                        <textarea required value={overrideForm.proposedValue} rows={3}
                          onChange={(event) => setOverrideForm({ ...overrideForm, proposedValue: event.target.value })}
                          placeholder="Enter the correct product detail" />
                      </label>
                      <label className="eba-field eba-span-2">
                        <span><span className="eba-desktop-copy">Why is this change needed?</span><span className="eba-mobile-copy">Reason for change</span></span>
                        <textarea required value={overrideForm.changeReason} rows={2}
                          onChange={(event) => setOverrideForm({ ...overrideForm, changeReason: event.target.value })}
                          placeholder="Explain the correction" />
                      </label>
                      {CRITICAL_FIELDS.has(overrideForm.fieldKey) && (
                        <label className="eba-field eba-span-2">
                          <span><span className="eba-desktop-copy">Verified proof for this correction</span><span className="eba-mobile-copy">Verified proof</span></span>
                          <select required value={overrideForm.evidenceCheckId}
                            onChange={(event) => setOverrideForm({ ...overrideForm, evidenceCheckId: event.target.value })}>
                            <option value="">Choose verified proof</option>
                            {overrideEvidenceOptions.map((check) => (
                              <option key={check.id} value={check.id}>
                                {String(check.checkType || "Proof").replaceAll("_", " ")} · {check.evidenceReference}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="eba-form-actions">
                      <button type="submit" disabled={busy} className="eba-primary">
                        <FileCheck2 size={16} aria-hidden="true" /> Save product update draft
                      </button>
                      <span className="eba-form-foot"><span className="eba-desktop-copy">To request approval, submit your saved draft below.</span><span className="eba-mobile-copy">Then use Send for review below.</span></span>
                    </div>
                  </form>
                ) : (
                  <div className="eba-lock" role="status">
                    <ShieldCheck size={23} aria-hidden="true" />
                    <div>
                      <strong><span className="eba-desktop-copy">Product updates become available after approval</span><span className="eba-mobile-copy">Approval required</span></strong>
                      <p><span className="eba-desktop-copy">Complete Steps 1 and 2 first. Super Admin must grant active brand access before you can choose a product here.</span><span className="eba-mobile-copy">Get brand access approved in Step 3 to update products.</span></p>
                      <a className="eba-inline-link" href="#brand-approvals"><span className="eba-desktop-copy">Check your access status</span><span className="eba-mobile-copy">View approval status</span></a>
                    </div>
                  </div>
                )}
                <div className="eba-product-history">
                  <div className="eba-history-head">
                    <h3>Product update requests</h3>
                    <span className="eba-mini-tag">{proposals.length} {proposals.length === 1 ? "request" : "requests"}</span>
                  </div>
                  {proposals.length ? (
                    <div className="eba-list">
                      {proposals.map((proposal) => (
                        <div key={proposal.id} className="eba-list-row">
                          <div className="eba-row-main">
                            <strong>{proposal.fieldChanges?.[0]?.fieldKey?.replaceAll("_", " ") || "Product detail update"}</strong>
                            <StatusPill value={proposal.status} />
                          </div>
                          {proposal.status === "draft" && (
                            <div className="eba-request-actions">
                              <button type="button" disabled={busy}
                                onClick={() => execute(() => submitHostBrandOverride(proposal.id), "Product update sent for review.")}>
                                <Send size={15} aria-hidden="true" /> Send for review
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="eba-empty">No product updates submitted yet.</p>}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
