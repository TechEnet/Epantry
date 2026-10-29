import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronDown, ClipboardList, Download, FileSpreadsheet, ImagePlus, Plus, RefreshCw, Save, Send, Trash2, UploadCloud, ArrowUpRight, Package, Search } from 'lucide-react'
import { useAuth } from '../../auth/context/AuthContext'

import { listHospitalityOutlets, listHospitalityMenus } from '../../hospitality/services/hospitality.service'
import { listServiceAreas } from '../../marketplace/services/marketplace.service'
import { normalizeHostWorkspaceType } from '../hostWorkspace.config'
import { parseHostBulkWorkbook, ingestWorkbookImages } from '../utils/hostBulkWorkbook'
import {
  createHostListingPacket, deleteHostListingPacket, getHostListingPacket, importHostListingPackets, searchHostListingIngredients,
  listHostListingPackets, listHostApprovedBrands, checkHostListingBarcode, searchHostPublishedProducts, getHostListingSellingReadiness, submitHostListingPacket, submitHostListingSectionRevision, updateHostListingPacket,
  uploadHostListingImage, uploadHostListingVideo, importHostListingRemoteImage,
} from '../services/hostUnifiedListing.service'

const editorialStyles = String.raw`
/* EPANTRY host editor: isolated design. No global host/navbar/footer overrides. */
.uel-page {
  --forest:#173F35; --deep:#10352D; --clay:#C86C42; --sage:#D7DDCF;
  --porcelain:#F7F6F2; --ink:#202421; --muted:#54635B;
  background:var(--porcelain); color:var(--ink);
  font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;
  font-size:17px; line-height:1.55; min-width:0; width:100%;
  padding:clamp(18px,2.3vw,38px) clamp(14px,2.4vw,40px) 46px;
}
.uel-page *, .uel-page *::before, .uel-page *::after {box-sizing:border-box}
.uel-legacy-notice{border-left:4px solid #C86C42;background:#F9EEE7;color:#763B25;border-radius:8px;padding:13px 17px;font-size:15px!important;margin-bottom:14px}

/* Only the Hybrid creator receives these two prominent publish-intent options. */
.uel-hybrid-recipe-choice {border:1px solid #C9D7C6;border-radius:14px;padding:clamp(15px,2vw,23px);background:#F1F3ED;min-width:0}
.uel-hybrid-recipe-choice legend {padding:0 7px;font-size:17px!important;color:#173F35}
.uel-page .uel-hybrid-choice {display:flex;flex-direction:column;text-align:left;gap:7px;padding:17px 20px;border:2px solid #D6DDD1;border-radius:13px;background:#FFFEFC;color:#202421;cursor:pointer;min-width:0}
.uel-page .uel-hybrid-choice[data-selected='true'] {border-color:#C86C42;background:#F9E8DE;box-shadow:inset 4px 0 0 #C86C42}
.uel-page .uel-hybrid-choice strong {font-size:16px!important;color:#173F35}
.uel-page .uel-hybrid-choice span {font-size:14px!important;line-height:1.5!important;color:#4A5C51}
.uel-page .uel-hybrid-choice:hover {border-color:#173F35}

.uel-shell {width:100%;max-width:none;margin:0 auto;min-width:0}
.uel-page a, .uel-page button, .uel-page input, .uel-page textarea, .uel-page select {font-family:inherit}
.uel-page button, .uel-page a {transition:background-color .17s ease,color .17s ease,border-color .17s ease,transform .17s ease}
.uel-page a:focus-visible,.uel-page button:focus-visible,.uel-page input:focus-visible,.uel-page textarea:focus-visible,.uel-page select:focus-visible {outline:3px solid var(--clay)!important;outline-offset:3px}
.uel-hero {display:grid;grid-template-columns:minmax(0,1.42fr) minmax(290px,.58fr);overflow:hidden;border-radius:22px;min-width:0;box-shadow:0 15px 34px rgba(22,45,36,.09)}
.uel-hero-main {position:relative;isolation:isolate;background:var(--forest);color:#F7F6F2;padding:clamp(24px,3.1vw,50px);overflow:hidden;min-width:0}
.uel-hero-main:after{content:'';position:absolute;pointer-events:none;z-index:-1;right:-7%;top:-52%;width:49%;aspect-ratio:1;border:1px solid rgba(230,242,221,.23);border-radius:50%;box-shadow:0 0 0 43px rgba(230,242,221,.035),0 0 0 87px rgba(230,242,221,.025)}
.uel-back {display:inline-flex;gap:9px;align-items:center;color:#E7F0E6!important;font-size:15px!important;font-weight:650!important;text-decoration:none;margin-bottom:25px}
.uel-back:hover {color:#FFC6A7!important;transform:translateX(-2px)}
.uel-eyebrow {display:flex;gap:10px;align-items:center;color:#FFBB98!important;font-size:13px!important;font-weight:800!important;text-transform:uppercase;letter-spacing:.15em;margin:0 0 12px}
.uel-eyebrow::before {content:'';width:25px;height:2px;background:#E78C60;flex:none}
.uel-hero-title {font-size:clamp(36px,3.45vw,59px)!important;line-height:1.09!important;letter-spacing:-.054em;font-weight:800!important;max-width:740px;color:#F8F6F0!important;margin:0!important}
.uel-hero-title em {font-style:normal;color:#F5B69B}
.uel-hero-description {font-size:17px!important;line-height:1.72!important;color:#DCE8DF!important;max-width:700px;margin:17px 0 0!important}
.uel-hero-foot {margin-top:25px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.uel-status {display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.23);padding:9px 12px;border-radius:999px;color:#EEF3EC;font-size:14px;font-weight:650;background:rgba(255,255,255,.08)}
.uel-status-dot {height:7px;width:7px;background:#FFC09B;border-radius:50%}
/* Primary new-listing action must read as a button on the dark hero. */
.uel-new {display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:47px;border:2px solid #FFE0CF!important;color:#10352D!important;background:#FFE0CF!important;box-shadow:0 5px 0 rgba(8,27,23,.22);font-weight:850!important;padding:10px 20px!important;border-radius:11px!important;font-size:16px!important;cursor:pointer}
.uel-new:hover {background:#FFD1B6!important;border-color:#FFD1B6!important;box-shadow:0 7px 0 rgba(8,27,23,.19);transform:translateY(-2px)}
.uel-new:active {transform:translateY(1px);box-shadow:0 2px 0 rgba(8,27,23,.22)}
.uel-studio-tools {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:13px}
.uel-studio-tools .uel-eyebrow {margin:0}
.uel-refresh {display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 13px;border:1px solid rgba(241,248,240,.52);border-radius:9px;background:rgba(250,255,250,.10);color:#F7F6F2;font-size:14px;font-weight:750;cursor:pointer}
.uel-refresh:hover:not(:disabled) {background:#E6F4ED;color:#10352D;border-color:#E6F4ED}
.uel-refresh:disabled {opacity:.6;cursor:not-allowed}
/* Clearly interactive, entirely optional packaging-photo disclosure. */
.uel-page details.uel-packaging-details {border:1.5px solid #A7C7B5!important;padding:0!important;margin-top:22px;border-radius:15px;background:#F6FBF7;overflow:hidden}
.uel-page details.uel-packaging-details[open] {border-color:#6C9B82!important;box-shadow:0 6px 17px rgba(23,63,53,.07)}
.uel-page details.uel-packaging-details > summary.uel-packaging-toggle {list-style:none;display:flex;align-items:center;gap:14px;min-height:88px;width:100%;padding:17px 19px;background:#E6F4ED;cursor:pointer;color:#173F35;user-select:none}
.uel-page details.uel-packaging-details > summary.uel-packaging-toggle::-webkit-details-marker {display:none}
.uel-packaging-toggle:hover {background:#D7EFDF!important}
.uel-packaging-toggle:focus-visible {outline:3px solid #C86C42!important;outline-offset:-4px}
.uel-packaging-symbol {display:grid;place-items:center;flex:none;width:43px;height:43px;border-radius:12px;background:#173F35;color:#fff}
.uel-packaging-caption {min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;text-align:left}
.uel-packaging-caption strong {font-size:17px!important;line-height:1.28;color:#173F35;font-weight:850}
.uel-packaging-caption small {font-size:14px!important;line-height:1.45;color:#476354}
.uel-packaging-optional {flex:none;border:1px solid #9DC5AA;background:#FFFDF9;border-radius:999px;padding:5px 9px;color:#173F35;font-size:11px!important;letter-spacing:.08em;font-weight:850}
.uel-packaging-arrow {flex:none;color:#173F35;transition:transform .2s ease}
.uel-packaging-details[open] .uel-packaging-arrow {transform:rotate(180deg)}
.uel-packaging-body {padding:20px 22px 19px;border-top:1px solid #BCD8C8;background:#FAFCFA}
.uel-page #listing-media label.uel-packaging-upload:has(> input[type=file]) {background:#173F35!important;color:#fff!important;border:1px solid #173F35!important;font-weight:800!important;min-height:48px}
.uel-page #listing-media label.uel-packaging-upload:has(> input[type=file]):hover {background:#235F4E!important;color:#fff!important;border-color:#235F4E!important}

.uel-hero-side {background:#EECDBD;padding:clamp(22px,2.65vw,41px);display:flex;flex-direction:column;justify-content:space-between;gap:18px;min-width:0}
.uel-hero-side-kicker {text-transform:uppercase;font-size:13px!important;font-weight:850!important;letter-spacing:.13em;color:#783821!important;margin:0 0 16px}
.uel-hero-side-title{font-weight:800!important;font-size:25px!important;letter-spacing:-.035em;line-height:1.2!important;color:#173F35!important;margin:0 0 14px}
.uel-hero-step {display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;align-items:center;border-top:1px solid rgba(23,63,53,.22);padding:12px 0;color:#173F35}
.uel-hero-step strong{font-size:19px;color:#B45B35;font-weight:850;letter-spacing:-.05em}
.uel-hero-step span{font-weight:700;font-size:16px;line-height:1.35}
.uel-hero-approval {font-size:13px!important;line-height:1.5!important;color:#5F422F!important;border-top:1px solid rgba(23,63,53,.22);padding-top:13px;margin:0}
.uel-alert {margin-top:18px;border-radius:12px;padding:14px 18px;font-size:15px!important;line-height:1.55!important}
.uel-mode-bar {margin:26px 0 0;display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;align-items:end;border-bottom:1px solid #CAD3C7;padding-bottom:16px}
.uel-mode-text h2{font-size:24px!important;letter-spacing:-.04em;font-weight:800!important;line-height:1.25!important;color:#173F35!important;margin:0!important}
.uel-mode-text p {font-size:15px!important;color:#54635B!important;margin:5px 0 0!important}
.uel-tabs {display:flex;gap:5px;align-items:center;padding:5px;background:#E6E9DF;border-radius:12px}
.uel-tab {border:0!important;border-radius:9px!important;padding:12px 19px!important;font-size:15px!important;font-weight:800!important;background:transparent!important;color:#173F35!important;cursor:pointer;min-width:145px}
.uel-tab[data-active='true']{background:#173F35!important;color:#fff!important;box-shadow:0 5px 11px rgba(23,63,53,.18)}
.uel-tab:not([data-active='true']):hover{background:#D7DDCF!important}
.uel-jumpbar {display:flex;align-items:center;gap:7px;overflow:auto;white-space:nowrap;padding:14px 0 3px;scrollbar-width:thin}
.uel-jumpbar span {color:#66746A;font-size:13px;font-weight:700;margin-right:8px}
.uel-jumpbar a {display:inline-flex;gap:7px;align-items:center;color:#173F35;text-decoration:none;padding:8px 12px;font-size:14px;font-weight:700;border:1px solid #D1D9CD;border-radius:8px;background:#FFFFFF92}
.uel-jumpbar a:hover {background:#EEDBD0;border-color:#D39C80}
.uel-jumpbar a b {color:#B45B35}
.uel-form {border:0;padding:0;margin-top:18px;min-width:0;display:block}
.uel-page .uel-section{scroll-margin-top:90px;position:relative;min-width:0;border:0!important;border-top:3px solid #173F35!important;margin:0 0 20px!important;padding:clamp(20px,2.15vw,34px)!important;background:#fff!important;border-radius:0 0 16px 16px;box-shadow:0 8px 25px rgba(28,44,36,.045)}
.uel-page .uel-section:nth-of-type(2n) {background:#EEF1E9!important}
.uel-page #listing-media {background:#E7EDE2!important;border-top-color:#C86C42!important}
.uel-page #listing-nutrition {background:#F2F0E9!important;border-top-color:#C86C42!important}
.uel-page #listing-selling{background:#E8EEE6!important;border-top-color:#173F35!important}
.uel-page .uel-section > h2, .uel-page .uel-section > div:first-child > h2 {font-size:clamp(25px,2.2vw,35px)!important;line-height:1.15!important;letter-spacing:-.045em!important;font-weight:850!important;color:#173F35!important;margin:0!important}
.uel-page .uel-section-number{color:#B45B35!important;font-variant-numeric:tabular-nums;letter-spacing:-.035em;display:inline-block}
.uel-page .uel-bulk-section .uel-section-number{color:#B45B35!important}
.uel-page .uel-section > p {font-size:16px!important;line-height:1.6!important;color:#4C5B52!important;max-width:1030px;margin-top:10px!important}
.uel-page .uel-section h3 {font-size:21px!important;font-weight:800!important;color:#173F35!important;line-height:1.3!important}
.uel-page .uel-label {font-size:15px!important;font-weight:750!important;letter-spacing:-.01em;line-height:1.45!important;color:#293D33!important;margin-bottom:9px!important}
.uel-page .uel-input, .uel-page select.uel-input, .uel-page input.uel-input, .uel-page textarea.uel-input {font-size:17px!important;line-height:1.45!important;min-height:49px;outline:0;border:1px solid #C6D0C3!important;background:#FFFEFC!important;border-radius:11px!important;color:#202421!important;padding:13px 15px!important;box-shadow:0 1px 0 rgba(17,49,36,.035);max-width:100%}
.uel-page .uel-input:focus {border-color:#C86C42!important;box-shadow:0 0 0 3px rgba(200,108,66,.14)!important}
.uel-page .uel-input::placeholder{color:#7B8B80!important}
.uel-page textarea.uel-input{min-height:80px;resize:vertical}
.uel-page .uel-action, .uel-page .uel-secondary {font-size:15px!important;line-height:1.3!important;min-height:47px;display:inline-flex;justify-content:center;align-items:center;gap:4px;border-radius:10px!important;font-weight:800!important;cursor:pointer;padding:12px 19px!important;white-space:normal;text-align:center}
.uel-page .uel-action {background:#173F35!important;color:#fff!important;border:1px solid #173F35!important}
.uel-page .uel-action:hover:not(:disabled){background:#235F4E!important;transform:translateY(-1px)}
.uel-page .uel-secondary{background:#FFFDF9!important;color:#173F35!important;border:1px solid #BECBBE!important}
.uel-page .uel-secondary:hover:not(:disabled){border-color:#C86C42!important;background:#FBEADF!important;transform:translateY(-1px)}
.uel-page button:disabled,.uel-page input:disabled {cursor:not-allowed;opacity:.6}
.uel-page #listing-media label:has(> input[type=file]),.uel-page #listing-ingredients label:has(> input[type=file]) {font-size:15px!important;align-items:center;border:1.5px dashed #C86C42!important;border-radius:13px!important;color:#173F35!important;background:#FFF7F1!important;padding:14px 18px!important}
.uel-page #listing-media label:has(> input[type=file]):hover,.uel-page #listing-ingredients label:has(> input[type=file]):hover {background:#F7E6DB!important}
.uel-page #listing-media img {height:130px;width:155px;object-fit:cover;border-radius:13px;box-shadow:0 4px 15px #173F351A}
.uel-page #listing-ingredients img{height:54px;width:62px}
.uel-page #listing-ingredients [class*='bg-[#EDF1E9]'] {background:#FBFAF6!important;border:1px solid #D8E1D5;border-left:4px solid #C86C42;border-radius:12px}
.uel-page #listing-ingredients [class*='bg-[#D7DDCF]'] {background:#D7DDCF!important;border-radius:12px}
.uel-page .uel-section.uel-review{border-radius:16px!important;overflow:hidden;background:#173F35!important;color:white!important;border-top:5px solid #C86C42!important;padding:clamp(24px,2.5vw,37px)!important}
.uel-page .uel-review h2 {font-size:28px!important;color:#fff!important}
.uel-page .uel-review p {color:#DFE9E0!important;font-size:16px!important;max-width:1000px}
.uel-page .uel-review .uel-secondary{background:#fff!important;color:#173F35!important}
.uel-page .uel-review .uel-action{background:#C86C42!important;border-color:#C86C42!important;color:#fff!important}
.uel-page .uel-review .uel-action:hover:not(:disabled){background:#B45630!important}
.uel-page .uel-section.uel-review > h2 {color:#FFFFFF!important}
.uel-page .uel-section.uel-review > p {color:#E6F1E9!important}
.uel-page .uel-section.uel-review > p.font-semibold {color:#FFFFFF!important}
/* Host work archive: slim editorial index, not a collection of cards. */
.uel-history{margin-top:32px;background:#FFFDF8;border-top:4px solid #173F35;border-bottom:1px solid #D2DDD0;padding:clamp(20px,2.5vw,35px);min-width:0}
.uel-history-head{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;justify-content:space-between;padding-bottom:18px}
.uel-history .uel-eyebrow{color:#A75130!important}
.uel-history h2{font-size:clamp(27px,2.3vw,35px)!important;line-height:1.12!important;letter-spacing:-.045em!important;font-weight:850!important;color:#173F35!important;margin:0}
.uel-history p{font-size:15px!important;color:#56645A!important}
.uel-history-count{background:#E7EFE7;color:#173F35;border-radius:7px;padding:9px 13px;font-size:14px;font-weight:800;border-left:3px solid #C86C42}
.uel-history-filters{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:13px 0 17px;border-top:1px solid #D7DED3;border-bottom:1px solid #D7DED3}
.uel-history-filter{border:1px solid #D2DBD1;background:transparent;color:#40584A;display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;min-height:41px;font-size:14px;font-weight:750;cursor:pointer}
.uel-history-filter:hover{background:#F0F4ED;border-color:#9DB8A7}
.uel-history-filter[data-active='true']{background:#173F35!important;color:#FFFDF7!important;border-color:#173F35!important}
.uel-history-filter b{font-size:12px;min-width:19px;text-align:center;padding:1px 5px;border-radius:5px;background:rgba(23,63,53,.09);color:inherit}
.uel-history-filter[data-active='true'] b{background:rgba(255,255,255,.18)}
.uel-packet-list{border:0!important;margin-top:0!important}
.uel-packet-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(115px,140px) auto;gap:16px;align-items:center;padding:16px 3px!important;border-bottom:1px solid #E0E6DD;min-width:0}
.uel-packet-row:last-child{border-bottom:0}
.uel-packet-row:hover{background:#F2F5F0}
.uel-packet-main{display:flex;align-items:center;gap:13px;min-width:0}
.uel-packet-photo{flex:none;display:grid;place-items:center;width:56px;height:56px;overflow:hidden;border-radius:8px;background:#E1E9E0;color:#173F35}
.uel-packet-photo img{width:100%;height:100%;object-fit:cover}
.uel-packet-title{font-size:17px!important;color:#173F35!important;font-weight:800!important;line-height:1.3!important;overflow-wrap:anywhere}
.uel-packet-meta{font-size:13px!important;color:#617165!important;margin:4px 0 0!important;line-height:1.45}
.uel-packet-status{justify-self:start;display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:6px 10px;border-radius:6px;font-size:13px!important;font-weight:750;line-height:1.3;color:#184A36;background:#DDEEE2}
.uel-packet-status[data-status='submitted_for_review']{background:#EDF0F4;color:#394B66}
.uel-packet-status[data-status='changes_requested'],.uel-packet-status[data-status='rejected']{background:#F8E6DD;color:#8C472A}
.uel-packet-status[data-status='draft']{background:#F3EDDD;color:#735322}
.uel-packet-action{min-width:136px;white-space:nowrap!important}
.uel-history-empty{padding:25px 2px;color:#53675A;font-size:15px}
.uel-page .uel-updatable-fields{margin-top:0!important}
.uel-revision-note{background:#F9EDE3;border-left:4px solid #C86C42;color:#653A29;padding:13px 16px;margin:0 0 18px;font-size:15px;line-height:1.55}
.uel-page .uel-section.uel-locked-section{position:relative}
.uel-page .uel-section.uel-locked-section .uel-editable-marker{display:inline-flex;margin-top:12px;padding:6px 11px;border:1px solid #B4C8B5;border-radius:8px;font-size:13px;font-weight:800;color:#173F35;background:#E5F1E8}
@media(max-width:680px){
  .uel-history{padding:19px 15px}
  .uel-history-filters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;padding-bottom:13px}
  .uel-history-filter{white-space:nowrap;flex:none}
  .uel-packet-row{grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:14px 1px!important}
  .uel-packet-main{grid-column:1/-1}
  .uel-packet-status{grid-column:1}
  .uel-packet-action{grid-column:2;min-width:0!important;padding:9px 11px!important;font-size:13px!important;min-height:40px!important}
  .uel-packet-photo{height:51px;width:51px}
}
.uel-hold-note {margin:17px 0 0!important;display:flex;align-items:flex-start;gap:9px;font-size:14px!important;color:#536258!important}
.uel-bulk-section{border:0!important;border-top:3px solid #C86C42!important;background:#fff!important;padding:clamp(20px,2.4vw,34px)!important;border-radius:0 0 16px 16px;margin:0 0 18px}
.uel-bulk-section h2{font-size:clamp(25px,2vw,32px)!important;color:#173F35!important;font-weight:850!important;letter-spacing:-.035em!important}
.uel-bulk-section p {font-size:16px!important;line-height:1.65!important}
.uel-template {background:#EFF2E9!important;border:1px solid #C9D4C5!important;border-left:4px solid #C86C42!important;border-radius:11px;padding:16px!important;font-size:16px!important;min-height:75px}
.uel-template:hover{background:#F9E9DC!important;transform:translateY(-1px)}
.uel-bulk-help {background:#DFE7D9!important;border-radius:14px;padding:25px!important;font-size:16px!important;line-height:1.7!important}
.uel-bulk-help h3{font-size:21px!important;color:#173F35!important}
.uel-page details {border-top:1px solid #D7DDCF;padding:20px 0}
.uel-page details > summary {font-size:16px!important}
.uel-page input[type=checkbox] {width:19px;height:19px;accent-color:#C86C42}
.uel-hospitality-link{margin-top:18px;padding:18px 23px;border-left:4px solid #C86C42;background:#E9EEE5;display:flex;gap:16px;align-items:center;justify-content:space-between;border-radius:11px;color:#173F35}
.uel-hospitality-link strong{display:block;font-size:17px;font-weight:800;color:#173F35}
.uel-hospitality-link p{font-size:15px!important;color:#52635A!important;margin:4px 0 0!important}
.uel-hospitality-link a{flex:none;background:#173F35;border:1px solid #173F35;border-radius:9px;padding:11px 17px;color:#fff!important;font-size:15px!important;font-weight:800;text-decoration:none;display:inline-flex;gap:10px;align-items:center}
.uel-hospitality-link a:hover{background:#285C4D}
.uel-hospitality-arrow{transform:rotate(180deg)}
@media (max-width:650px){.uel-hospitality-link{padding:16px;align-items:stretch;flex-direction:column}.uel-hospitality-link a{justify-content:center}}
@media (max-width:900px){
  .uel-hero{grid-template-columns:1fr}
  .uel-hero-side{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
  .uel-hero-approval{align-self:end}
  .uel-page .uel-section{padding:24px!important}
}
@media (max-width:640px){
  .uel-page{padding:15px 12px 32px;font-size:16px}
  .uel-hero{border-radius:15px}
  .uel-hero-main{padding:23px 19px}
  .uel-back{margin-bottom:20px;font-size:14px!important}
  .uel-hero-title{font-size:36px!important}
  .uel-hero-description{font-size:16px!important}
  .uel-hero-side{display:block;padding:20px 19px}
  .uel-hero-side-title{font-size:22px!important}
  .uel-hero-step{grid-template-columns:32px 1fr;padding:8px 0}
  .uel-mode-bar{margin-top:22px;align-items:stretch}
  .uel-mode-text h2{font-size:22px!important}
  .uel-tabs{width:100%}
  .uel-tab{min-width:0;flex:1;padding:11px 12px!important;font-size:14px!important}
  .uel-page .uel-section{padding:18px 16px!important;margin-bottom:14px!important;border-radius:0 0 12px 12px}
  .uel-page .uel-section > h2,.uel-page .uel-section > div:first-child > h2{font-size:25px!important}
  .uel-page .uel-section > p{font-size:15px!important}
  .uel-page .uel-label{font-size:14px!important}
  .uel-page .uel-input,.uel-page input.uel-input,.uel-page select.uel-input,.uel-page textarea.uel-input{font-size:16px!important;min-height:46px;padding:11px 12px!important}
  .uel-page .uel-action,.uel-page .uel-secondary{font-size:14px!important}
  .uel-page #listing-media img{height:96px;width:112px}
  .uel-history {padding:19px 16px}
  .uel-history .uel-eyebrow{color:#AD502E!important}
.uel-history h2{font-size:26px!important}
  .uel-jumpbar{padding-bottom:8px}
  .uel-jumpbar a{font-size:13px;padding:8px 10px}
}

/* Keep the small-screen editor purposeful rather than a full-screen splash. */
@media (max-width:640px){
  .uel-hero-main{padding:19px 18px 21px}
  .uel-back{margin-bottom:14px!important}
  .uel-eyebrow{font-size:12px!important;letter-spacing:.12em;margin-bottom:8px}
  .uel-hero-title{font-size:clamp(31px,9vw,36px)!important;line-height:1.07!important}
  .uel-hero-description{font-size:15px!important;line-height:1.5!important;margin-top:11px!important}
  .uel-hero-foot{margin-top:16px;gap:10px}
  .uel-status{padding:7px 10px;font-size:13px}
  .uel-new{padding:10px 13px!important;font-size:15px!important;min-height:45px}
  .uel-hero-side{padding:16px 18px 17px}
  .uel-studio-tools {gap:9px;align-items:flex-start}
  .uel-refresh {min-height:37px;padding:7px 10px;font-size:13px}
  .uel-page details.uel-packaging-details > summary.uel-packaging-toggle {gap:10px;padding:14px 12px;min-height:82px}
  .uel-packaging-symbol {width:38px;height:38px;border-radius:10px}
  .uel-packaging-caption strong {font-size:16px!important}
  .uel-packaging-caption small {font-size:13px!important}
  .uel-packaging-optional {padding:5px 7px;font-size:10px!important}
  .uel-packaging-body {padding:16px 14px}

  .uel-hero-side-kicker{font-size:12px!important;letter-spacing:.1em;margin:0 0 5px!important}
  .uel-hero-side-title{font-size:19px!important;line-height:1.2!important;margin:0 0 7px!important}
  .uel-hero-step{grid-template-columns:28px 1fr;gap:8px;padding:5px 0!important}
  .uel-hero-step strong{font-size:16px}
  .uel-hero-step span{font-size:14px}
  .uel-hero-approval{font-size:12px!important;line-height:1.45!important;padding-top:7px;margin:7px 0 0!important}
  .uel-mode-bar{margin-top:17px;padding-bottom:12px}
  .uel-page .uel-section>p{margin-top:7px!important}
}


/* Recipe ingredients: readable purchasing groups, not a pile of generic cards. */
.uel-ingredient-intro{margin:10px 0 0!important;color:#4A5E53!important;font-size:15px!important;line-height:1.6!important}
.uel-ingredient-list{margin-top:20px;display:grid;gap:16px}
.uel-ingredient-row{border:1px solid #DAE4D8;border-left:4px solid #C86C42;border-radius:13px;background:#F6F9F5;padding:19px 20px 17px;min-width:0}
.uel-ingredient-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}
.uel-ingredient-heading h3{margin:0!important;font-size:19px!important}
.uel-row-delete{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:7px 10px;border:1px solid #E8CDCA;border-radius:8px;background:#FFF9F7;color:#963F3A;font-size:13px;font-weight:750;cursor:pointer}
.uel-row-delete:hover:not(:disabled){background:#FCE7E2;border-color:#CF8F81}
.uel-row-delete:disabled{opacity:.4;cursor:not-allowed}
.uel-ingredient-fields{display:grid;gap:15px 17px;grid-template-columns:repeat(4,minmax(0,1fr))}
.uel-ingredient-fields .uel-span-two{grid-column:span 2}
.uel-ingredient-fields .uel-span-full{grid-column:1/-1}
.uel-ingredient-photo-line{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.uel-ingredient-photo-line img{width:58px;height:58px;border-radius:9px;object-fit:cover;border:1px solid #D6DED2}
.uel-ingredient-cost{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:7px;padding:13px 14px;background:#E7F0E8;border-radius:9px;color:#173F35;font-size:15px;font-weight:750}
.uel-cost-total{margin-top:18px;padding:17px 20px;background:#DDE7DD;border-radius:11px;display:flex;flex-wrap:wrap;align-items:center;gap:13px 30px;color:#173F35;font-size:15px}
.uel-cost-total strong{font-weight:850}
.uel-cost-note{flex-basis:100%;color:#8F4C2B;font-size:14px;font-weight:700}
/* Sequential instructions: a readable cooking timeline with distinct timer controls. */
.uel-step-intro{margin:9px 0 0!important;color:#4A5E53!important;font-size:15px!important;line-height:1.6!important}
.uel-step-list{display:grid;gap:0;margin-top:20px}
.uel-step-row{display:grid;grid-template-columns:52px minmax(0,1fr) 160px 43px;gap:14px;align-items:start;padding:17px 0;border-top:1px solid #DCE4DB;min-width:0}
.uel-step-row:first-child{border-top:0;padding-top:0}
.uel-step-index{width:45px;height:45px;display:grid;place-items:center;background:#E8EFE4;border-radius:11px;font-size:17px;font-weight:850;color:#AC532E;font-variant-numeric:tabular-nums}
.uel-step-row .uel-label{margin-bottom:7px!important}
.uel-step-row textarea.uel-input{min-height:90px!important}
.uel-step-remove{margin-top:29px;display:grid;place-items:center;width:41px;height:41px}
.uel-step-add-bottom{margin-top:5px!important}
/* Uploaded file names are deliberately shown instead of long Cloudinary URLs. */
.uel-video-uploaded{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:9px;padding:13px 15px;border:1px solid #B9D2BF;border-radius:11px;background:#EAF3E9;color:#173F35;min-width:0}
.uel-video-filename{display:block;max-width:100%;overflow-wrap:anywhere;font-size:15px;font-weight:800}
.uel-video-link{color:#245849;text-decoration:underline;text-underline-offset:3px;font-size:14px;font-weight:750}
/* Custom allergens extend the fixed common list without making extra fields required. */
.uel-other-allergen{margin-top:16px;border:1px solid #D1DCD0;border-radius:12px;background:#F6F9F4;padding:15px 17px}
.uel-other-allergen-button{display:inline-flex;gap:7px;align-items:center;border:1px solid #173F35;border-radius:9px;padding:10px 13px;background:#E9F3EA;color:#173F35;font-size:14px;font-weight:800;cursor:pointer}
.uel-other-allergen-button:hover{background:#D7EAD9}
.uel-custom-allergen-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,200px) auto;align-items:end;gap:11px;margin-top:13px}
.uel-custom-allergen-list{display:grid;gap:10px;margin-top:13px}
.uel-custom-allergen-item{display:flex;flex-wrap:wrap;align-items:center;gap:11px;justify-content:space-between;padding:10px 11px;border-radius:9px;background:white;border:1px solid #DEE7DA}
.uel-custom-allergen-item strong{min-width:110px;color:#173F35;overflow-wrap:anywhere}
.uel-custom-allergen-item select{max-width:240px;flex:1}
.uel-packet-controls{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;min-width:0}
.uel-packet-delete{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #E7B8AF;border-radius:9px;background:#FFF8F5;color:#9E3B32;min-height:43px;padding:9px 12px;font-size:14px;font-weight:800;cursor:pointer}
.uel-packet-delete:hover:not(:disabled){background:#FBE4DF;border-color:#BF6961}
.uel-packet-delete:disabled{cursor:not-allowed;opacity:.55}
@media(max-width:960px){.uel-ingredient-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:680px){
  .uel-ingredient-row{padding:15px 13px;border-radius:10px}
  .uel-ingredient-heading{margin-bottom:13px}
  .uel-ingredient-fields{gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
  .uel-cost-total{padding:15px 13px;gap:10px 18px}
  .uel-step-row{grid-template-columns:36px minmax(0,1fr) 42px;gap:10px;padding:15px 0}
  .uel-step-index{width:34px;height:34px;font-size:14px;border-radius:8px}
  .uel-step-text{grid-column:2}
  .uel-step-time{grid-column:2}
  .uel-step-remove{grid-column:3;grid-row:1;margin-top:0}
  .uel-custom-allergen-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .uel-custom-allergen-row > button{grid-column:1/-1}
  .uel-packet-controls{grid-column:2;flex-wrap:wrap;gap:7px}
  .uel-packet-controls .uel-packet-action{min-width:0!important}
  .uel-packet-delete{padding:8px 10px;min-height:40px;font-size:13px}
}
@media(max-width:400px){.uel-ingredient-fields{grid-template-columns:1fr}.uel-ingredient-fields .uel-span-two{grid-column:1}.uel-custom-allergen-row{grid-template-columns:1fr}}

@media (prefers-reduced-motion:reduce){.uel-page a,.uel-page button{transition:none!important}}
`

const styles = {
  field: 'uel-input min-w-0 w-full rounded-lg border border-[#CBD4C8] bg-white px-3 py-2.5 text-[15px] text-[#202421] focus:outline-2 focus:outline-offset-1 focus:outline-[#173F35]',
  label: 'uel-label block text-sm font-semibold text-[#202421]',
  section: 'uel-section border-t border-[#D7DDCF] py-6 sm:py-8',
  button: 'uel-action rounded-lg bg-[#173F35] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50',
  secondary: 'uel-secondary rounded-lg border border-[#BAC7B8] px-4 py-2.5 text-sm font-semibold text-[#173F35] disabled:opacity-50',
}
const fields = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg']
const allergenNames = ['milk', 'egg', 'peanut', 'tree_nut', 'soy', 'wheat', 'sesame', 'fish', 'shellfish']
const units = ['g', 'kg', 'ml', 'l', 'piece', 'tsp', 'tbsp', 'cup']
// These are optional packaging/label photo categories, not additional required uploads.
const groceryPhotoRoles = [
  ['front_of_pack', 'Front of pack'],
  ['ingredients_panel', 'Ingredients panel'],
  ['allergen_statement', 'Allergen statement'],
  ['nutrition_panel', 'Nutrition panel'],
  ['barcode', 'Barcode'],
  ['back_manufacturer_panel', 'Back / manufacturer panel'],
  ['certification_mark', 'Certification mark'],
]
const groceryPhotoRoleLabels = Object.fromEntries(groceryPhotoRoles)

// The backend keeps category='grocery' for grocery catalog compatibility.
// Its finer customer-facing product category is saved separately as grocerySubcategory.
const categoryOptions = [
  ['grocery', 'Grocery'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'],
  ['snacks', 'Snacks'], ['drinks', 'Drinks'], ['sweets', 'Sweets'], ['desserts', 'Desserts'],
  ['bakery', 'Bakery'], ['main_course', 'Main course'], ['side_dish', 'Side dish'], ['other', 'Other food'],
]
const groceryCategories = [
  ['', 'Choose a grocery category'], ['vegetables', 'Vegetables & greens'],
  ['fruits', 'Fruits'], ['dairy', 'Milk, dairy & cheese'], ['eggs', 'Eggs'],
  ['meat_poultry', 'Meat & poultry'], ['seafood', 'Fish & seafood'],
  ['grains_rice', 'Grains, rice & cereals'], ['pulses_legumes', 'Pulses, beans & lentils'],
  ['spices_condiments', 'Spices, sauces & condiments'], ['oils_ghee', 'Cooking oil & ghee'],
  ['canned_jarred', 'Canned & jarred food'], ['packaged_snacks', 'Packaged snacks'],
  ['packaged_food', 'Other packaged food'], ['frozen_food', 'Frozen food'],
  ['beverages', 'Beverages'], ['bakery_bread', 'Bread & bakery'], ['other_grocery', 'Other groceries'],
]
const packagingOptions = [
  ['', 'Choose packaging'], ['loose', 'Loose / unpackaged'], ['packet', 'Packet / pouch'],
  ['can', 'Can / tin'], ['jar', 'Jar'], ['bottle', 'Bottle'], ['box', 'Box / carton'],
  ['tray', 'Tray'], ['other', 'Other'],
]
const recipeCategories = [['brunch', 'Brunch'], ...categoryOptions.filter(([value]) => value !== 'grocery')]
const dietaryOptions = [
  ['not_declared', 'Not declared'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'],
  ['non_vegetarian', 'Non-vegetarian'], ['other', 'Other / mixed'],
]
const types = [
  { value: 'grocery', label: 'Grocery / packaged food', allowed: ['b2b', 'brand_seller', 'hybrid', 'legacy'] },
  { value: 'brand_recipe', label: 'Brand recipe', allowed: ['brand_seller', 'hybrid', 'legacy'] },
  { value: 'kitchen_recipe', label: 'Kitchen recipe / drinks / sweets', allowed: ['b2b', 'chef_restaurant', 'hybrid', 'legacy'] },
  { value: 'prepared_food', label: 'Ready-made food / menu item', allowed: ['b2b', 'chef_restaurant', 'hybrid', 'legacy'] },
]
// Each template maps to one existing permitted Host listing type; special food
// categories reuse kitchen_recipe rather than creating parallel databases.
const bulkTemplates = [
  { key: 'grocery', label: 'Grocery / packaged food', type: 'grocery' },
  { key: 'brand_recipe', label: 'Brand recipe', type: 'brand_recipe' },
  { key: 'kitchen_recipe', label: 'Kitchen recipe', type: 'kitchen_recipe' },
  { key: 'prepared_food', label: 'Ready-made food / menu', type: 'prepared_food' },
  { key: 'drinks', label: 'Drinks & beverages', type: 'kitchen_recipe' },
  { key: 'sweets', label: 'Sweets', type: 'kitchen_recipe' },
  { key: 'desserts', label: 'Desserts', type: 'kitchen_recipe' },
  { key: 'bakery', label: 'Bakery', type: 'kitchen_recipe' },
]
const historyFilters = [
  ['all', 'All'], ['draft', 'Drafts'], ['submitted_for_review', 'In review'],
  ['approved', 'Approved'], ['needs_attention', 'Needs attention'],
]
function listingStatusLabel(status) {
  return ({ draft: 'Draft', submitted_for_review: 'In review', approved: 'Approved',
    rejected: 'Not approved', changes_requested: 'Changes requested' })[status] || String(status || 'Unknown').replaceAll('_', ' ')
}
function listingUpdatedDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}
const emptyIngredient = () => ({ name: '', canonicalIngredientId: '', imageUrl: '', quantity: 1, unit: 'g', unitPrice: '', priceQuantity: 1, priceUnit: 'g', role: 'main', preparationState: '', scalingRule: 'proportional', note: '' })
const emptyStep = () => ({ instruction: '', timerMinutes: '', imageUrl: '' })
function newPacket(type = 'grocery') {
  return {
    type, title: '', description: '', category: type === 'grocery' ? 'grocery' : 'other', grocerySubcategory: '', packagingType: '', images: [], imageRoles: [], videoUrl: '', videoFileName: '',
    brandName: '', sku: '', countryOfOrigin: '', regionOfOrigin: '', localRecipeName: '', localRecipeLanguage: '', englishNameReading: '',
    productFamily: '', manufacturerPacker: '', unitsPerPack: '', servingSize: '', catalogProductVersionId: '', labelDeclaration: { ingredients: '', allergens: '', claims: '' }, cuisine: '', preparationMinutes: '', cookingMinutes: '', baseServings: 4, difficulty: 'not_declared', ingredients: [emptyIngredient()], steps: [emptyStep()],
    nutrition: { basis: 'Per serving', evidenceNote: '' }, allergens: [], dietary: 'not_declared',
    shareRecipe: type === 'brand_recipe' || type === 'kitchen_recipe', sellReadyMade: type === 'prepared_food',
    selling: { listPrice: '', salePrice: '', stockQuantity: '', stockUnit: 'piece', packQuantity: '', packUnit: 'piece', minimumOrderQuantity: 1, maximumOrderQuantity: '', barcode: '', packagingCost: '', labourCost: '', outletId: '', menuId: '' },
    delivery: { fulfillment: 'delivery', postalCodes: [], preparationMinutes: '', note: '' }, sourceNotes: '',
  }
}
function formatMoney(value) { return value === null || value === undefined ? 'Not available' : `Rs ${Number(value).toFixed(2)}` }
function estimateCost(ingredient) {
  const mass = { g: 1, kg: 1000 }
  const volume = { ml: 1, l: 1000 }
  const group = mass[ingredient.unit] && mass[ingredient.priceUnit] ? mass :
    volume[ingredient.unit] && volume[ingredient.priceUnit] ? volume : null
  const converted = group ? Number(ingredient.quantity) * group[ingredient.unit] / group[ingredient.priceUnit] :
    ingredient.unit === ingredient.priceUnit ? Number(ingredient.quantity) : NaN
  if (ingredient.unitPrice === '' || ingredient.unitPrice == null || ingredient.priceQuantity === '' || ingredient.priceQuantity == null || !Number(ingredient.priceQuantity) ||
      !Number.isFinite(converted) || Number(ingredient.unitPrice) < 0) return null
  return Math.round(converted / Number(ingredient.priceQuantity) * Number(ingredient.unitPrice) * 100) / 100
}
function EditorField({ title, children }) {
  return <label className="block min-w-0"><span className={`${styles.label} mb-1.5`}>{title}</span>{children}</label>
}
function IngredientNameInput({ ingredient, onChange, className }) {
  const [matches, setMatches] = useState([])
  const [searchError, setSearchError] = useState('')
  useEffect(() => {
    const query = String(ingredient.name || '').trim()
    if (query.length < 2 || ingredient.canonicalIngredientId) { setMatches([]); return undefined }
    let alive = true
    const timer = setTimeout(async () => {
      try {
        const result = await searchHostListingIngredients({ search: query, limit: 6 })
        if (alive) { setMatches(result?.ingredients || []); setSearchError('') }
      } catch { if (alive) { setMatches([]); setSearchError('Catalog search is unavailable; enter the name manually for review.') } }
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [ingredient.name, ingredient.canonicalIngredientId])
  return <div className="relative">
    <input aria-label="Ingredient name" className={className} value={ingredient.name || ''} onChange={(event) => onChange({ name: event.target.value, canonicalIngredientId: '' })} placeholder="Search an EPANTRY ingredient" autoComplete="off"/>
    {matches.length > 0 && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#CBD4C8] bg-white shadow-lg">{matches.map((match) => <button type="button" key={match.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#EDF1E9]" onClick={() => { onChange({ name: match.canonicalName, canonicalIngredientId: match.id }); setMatches([]) }}>{match.canonicalName}</button>)}</div>}
    {ingredient.canonicalIngredientId && <p className="mt-1 text-xs text-[#173F35]">Matched with EPANTRY ingredient</p>}
    {searchError && <p className="mt-1 text-xs text-[#9A4F31]">{searchError}</p>}
  </div>
}

function HostUnifiedListingEditor() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const workspace = normalizeHostWorkspaceType(currentUser)
  // Category lists are determined by form.type; role controls authorized listing TYPES only.
  const usesHospitalityOperations = workspace === 'hybrid' || workspace === 'chef_restaurant'
  // Hybrid is intentionally limited to Grocery and Recipe for NEW packets.
  // Preserve editing of previous records while permitting all account-eligible types.
  const allowed = types.filter((item) => item.allowed.includes(workspace) &&
    (workspace !== 'hybrid' || ['grocery', 'kitchen_recipe', 'brand_recipe', 'prepared_food'].includes(item.value)))
  const visibleTemplates = bulkTemplates.filter((item) => allowed.some((choice) => choice.value === item.type))
  const requestedType = params.get('type')
  const initialType = allowed.some((item) => item.value === requestedType) ? requestedType : allowed[0]?.value || 'grocery'
  const [form, setForm] = useState(() => newPacket(initialType))
  const [editingId, setEditingId] = useState('')
  const [revisingApproved, setRevisingApproved] = useState(false)
  const [existing, setExisting] = useState([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkProgress, setBulkProgress] = useState('')
  const [pincodeText, setPincodeText] = useState('')
  const [savedPostalCodes, setSavedPostalCodes] = useState([])
  const [selectedGroceryPhotoRole, setSelectedGroceryPhotoRole] = useState('front_of_pack')
  const [showOtherAllergen, setShowOtherAllergen] = useState(false)
  const [otherAllergenName, setOtherAllergenName] = useState('')
  const [otherAllergenStatus, setOtherAllergenStatus] = useState('')
  const pincodeEditedRef = useRef(false)
  const skipPendingEditLoadRef = useRef(false)
  const [outlets, setOutlets] = useState([])
  const [menus, setMenus] = useState([])
  const [activeTab, setActiveTab] = useState('single')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [barcodeMatches, setBarcodeMatches] = useState([])
  const [barcodeChecked, setBarcodeChecked] = useState('')
  const [barcodeChecking, setBarcodeChecking] = useState(false)
  const [publishedProductMatches, setPublishedProductMatches] = useState([])
  const [productMatchBusy, setProductMatchBusy] = useState(false)
  const [approvedBrands, setApprovedBrands] = useState([])
  const [sellingReadiness, setSellingReadiness] = useState(null)
  const [brandLoadError, setBrandLoadError] = useState('')
  const fieldRef = useRef(null)
  const editIdFromUrl = params.get('edit') || ''
  const activeListing = existing.find((item) => item.id === editingId)
  useEffect(() => {
    if (!editingId) { setSellingReadiness(null); return undefined }
    let live = true
    setSellingReadiness(null)
    getHostListingSellingReadiness(editingId)
      .then((result) => { if (live) setSellingReadiness(result?.readiness || null) })
      .catch(() => { if (live) setSellingReadiness({ message: 'Selling status is unavailable. Refresh and try again.' }) })
    return () => { live = false }
  }, [editingId, existing])
  const selectableTypes = editingId && !allowed.some((item) => item.value === form.type)
    ? [...allowed, ...types.filter((item) => item.value === form.type)]
    : allowed
  const locked = ['submitted_for_review', 'approved', 'rejected'].includes(activeListing?.status) && !revisingApproved
  const correctionSection = activeListing?.status === 'changes_requested' ? activeListing?.correctionSection : ''
  const filteredHistory = existing.filter((item) => historyFilter === 'all' ||
    (historyFilter === 'needs_attention'
      ? ['changes_requested', 'rejected'].includes(item.status)
      : item.status === historyFilter))
  const historyCount = (filter) => filter === 'all' ? existing.length : existing.filter((item) =>
    filter === 'needs_attention' ? ['changes_requested', 'rejected'].includes(item.status) : item.status === filter).length
  const isRecipe = form.type !== 'grocery'
  const canSell = form.type === 'grocery' || form.type === 'prepared_food' || (form.type === 'kitchen_recipe' && form.sellReadyMade)
  const costs = useMemo(() => (isRecipe ? form.ingredients.map(estimateCost) : []), [isRecipe, form.ingredients])
  const customAllergens = (form.allergens || []).filter((item) => !allergenNames.includes(item.key))
  const knownCosts = costs.filter((cost) => cost !== null)
  const costingComplete = isRecipe && costs.length > 0 && knownCosts.length === costs.length
  const ingredientCost = knownCosts.length ? knownCosts.reduce((sum, value) => sum + value, 0) : null
  const completeCost = costingComplete ? ingredientCost + Number(form.selling.packagingCost || 0) + Number(form.selling.labourCost || 0) : null
  const errorMessage = (value) => value?.response?.data?.message || value?.message || 'Unable to complete this listing action.'

  const load = useCallback(async () => {
    try {
      const response = await listHostListingPackets()
      setExisting(response?.listings || [])
    } catch (cause) { setError(errorMessage(cause)) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (form.type !== 'brand_recipe') return
    let cancelled = false
    listHostApprovedBrands().then(result => {
      if (!cancelled) { setApprovedBrands(result?.brands || []); setBrandLoadError('') }
    }).catch(() => {
      if (!cancelled) { setApprovedBrands([]); setBrandLoadError('Unable to load your approved brands. Try again.') }
    })
    return () => { cancelled = true }
  }, [form.type])
  useEffect(() => {
    if (!['b2b', 'chef_restaurant', 'hybrid', 'legacy'].includes(workspace)) return
    let cancelled = false
    Promise.allSettled([listHospitalityOutlets(), listHospitalityMenus()]).then(([outletResult, menuResult]) => {
      if (cancelled) return
      if (outletResult.status === 'fulfilled') setOutlets(outletResult.value?.outlets || [])
      if (menuResult.status === 'fulfilled') setMenus(menuResult.value?.menus || [])
    })
    return () => { cancelled = true }
  }, [workspace])
  // Host Marketplace Service Areas are the saved delivery coverage source.
  // Apply them only to untouched NEW listings; never overwrite a saved draft or manual edit.
  useEffect(() => {
    let cancelled = false
    const loadSavedDeliveryCoverage = async () => {
      try {
        const codes = new Set()
        for (let page = 1; page <= 10 && codes.size < 500; page += 1) {
          const result = await listServiceAreas({ page, limit: 100, status: 'active' })
          if (cancelled) return
          const areas = Array.isArray(result?.serviceAreas) ? result.serviceAreas : []
          areas.forEach((area) => {
            (area.postalCodes || []).forEach((value) => {
              const code = String(value || '').trim()
              if (/^[1-9][0-9]{5}$/.test(code) && codes.size < 500) codes.add(code)
            })
          })
          if (areas.length < 100 || page >= Number(result?.pagination?.totalPages || page)) break
        }
        if (cancelled) return
        setSavedPostalCodes([...codes])
      } catch {
        // Some Host roles do not have a Marketplace Service Area yet.
        // The existing manual pincode entry remains fully usable.
      }
    }
    loadSavedDeliveryCoverage()
    return () => { cancelled = true }
  }, [workspace])
  useEffect(() => {
    if (!savedPostalCodes.length || params.get('edit') || editingId || pincodeEditedRef.current) return
    setForm((current) => current.delivery?.postalCodes?.length
      ? current
      : { ...current, delivery: { ...current.delivery, postalCodes: [...savedPostalCodes] } })
    setPincodeText((current) => current.trim() ? current : savedPostalCodes.join(', '))
  }, [savedPostalCodes, editingId, params])

  useEffect(() => {
    // Only load a saved listing when the URL's edit ID changes. Editing state
    // is not a dependency: clearing it for 'Start a new listing' must NOT
    // cause the previous approved/submitted listing to load again and lock the form.
    if (!editIdFromUrl) return undefined
    let cancelled = false
    skipPendingEditLoadRef.current = false
    setLoading(true)
    getHostListingPacket(editIdFromUrl).then((data) => {
      if (cancelled || skipPendingEditLoadRef.current) return
      setForm({ ...newPacket(data.listing.packet.type), ...data.listing.packet })
      pincodeEditedRef.current = true
      setPincodeText((data.listing.packet.delivery?.postalCodes || []).join(', '))
      setEditingId(data.listing.id)
      setRevisingApproved(false)
      setBarcodeMatches([]); setBarcodeChecked('')
      setActiveTab('single')
    }).catch((cause) => { if (!cancelled && !skipPendingEditLoadRef.current) setError(errorMessage(cause)) })
      .finally(() => { if (!cancelled && !skipPendingEditLoadRef.current) setLoading(false) })
    return () => { cancelled = true }
  }, [editIdFromUrl])
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const nested = (key, sub, value) => setForm((current) => ({ ...current, [key]: { ...current[key], [sub]: value } }))
  const updateRow = (key, index, patchValue) => setForm((current) => ({
    ...current, [key]: current[key].map((item, offset) => offset === index ? { ...item, ...patchValue } : item),
  }))
  const removeRow = (key, index) => setForm((current) => ({ ...current, [key]: current[key].filter((_, offset) => offset !== index) }))
  async function checkBarcode() {
    const gtin = String(form.selling?.barcode || '').trim()
    setBarcodeMatches([]); setBarcodeChecked('')
    if (!gtin) return
    setBarcodeChecking(true)
    try {
      const result = await checkHostListingBarcode(gtin)
      setBarcodeMatches(result?.matches || [])
      setBarcodeChecked(gtin)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBarcodeChecking(false) }
  }
  function startNew(type) {
    // A previously started edit fetch can still be in flight. Ignore its
    // result so it cannot replace the fresh editable form with an old listing.
    skipPendingEditLoadRef.current = true
    setLoading(false)
    const packet = newPacket(type)
    packet.delivery.postalCodes = [...savedPostalCodes]
    pincodeEditedRef.current = false
    setShowOtherAllergen(false); setOtherAllergenName(''); setOtherAllergenStatus(''); setBarcodeMatches([]); setBarcodeChecked('')
    setRevisingApproved(false)
    setForm(packet); setPincodeText(savedPostalCodes.join(', ')); setEditingId(''); setError(''); setNotice('')
    setParams({ type }); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function uploadImage(file, target, index = -1, photoRole = '') {
    if (!file) return
    setUploading(`${target}-${index}`); setError('')
    try {
      const url = await uploadHostListingImage(file)
      if (target === 'images') {
        setForm((current) => {
          if (current.images.length >= 12) return current
          const images = [...current.images, url]
          const role = current.type === 'grocery' && groceryPhotoRoleLabels[photoRole] ? photoRole : ''
          return {
            ...current,
            images,
            imageRoles: role
              ? [...(current.imageRoles || []), { url, role }]
              : (current.imageRoles || []),
          }
        })
      } else updateRow(target, index, { imageUrl: url })
      setNotice('Image uploaded. Save this listing to keep it.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setUploading('') }
  }
  async function uploadVideo(file) {
    if (!file) return
    setUploading('video'); setError('')
    try {
      const url = await uploadHostListingVideo(file)
      setForm((current) => ({ ...current, videoUrl: url, videoFileName: String(file.name || 'Recipe video').slice(0, 180) }))
      setNotice('Video uploaded. Save this listing to keep it.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setUploading('') }
  }
  async function save(submit = false) {
    if (busy || locked || uploading) return
    if (submit && workspace === 'hybrid' && form.type === 'grocery' && !form.grocerySubcategory) {
      setError('Choose a grocery customer category before submitting.')
      document.getElementById('listing-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = editingId ? await updateHostListingPacket(editingId, form) : await createHostListingPacket(form)
      const id = result?.listing?.id
      if (submit) await submitHostListingPacket(id)
      setEditingId(id)
      setParams({ edit: id })
      setNotice(submit ? 'Listing submitted to Super Admin for review. You will be notified after a decision.' : 'Draft saved. You can continue editing here.')
      await load()
      if (revisingApproved) setRevisingApproved(false)
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  async function saveSectionRevision() {
    if (busy || uploading || !locked || !editingId) return
    if (activeListing?.status === 'approved' && !window.confirm(
      'Your approved listing stays live while Super Admin reviews the updated food facts and selling details. Continue?'
    )) return
    setBusy(true); setError(''); setNotice('')
    try {
      const sections = {
        nutrition: form.nutrition, allergens: form.allergens, dietary: form.dietary,
        selling: form.selling,
        delivery: { ...form.delivery, postalCodes: pincodeText.split(/[\s,;]+/).filter(Boolean) },
      }
      const result = await submitHostListingSectionRevision(editingId, sections)
      if (result?.listing?.packet) {
        setForm({ ...newPacket(result.listing.packet.type), ...result.listing.packet })
        setPincodeText((result.listing.packet.delivery?.postalCodes || []).join(', '))
      }
      await load()
      setNotice('Food facts and selling changes sent to Super Admin for review. Other listing information was not changed.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  function addOtherAllergen() {
    const name = otherAllergenName.trim().replace(/\s+/g, ' ')
    const key = name.toLowerCase().replace(/\s+/g, '_')
    if (name.length < 2 || name.length > 70 || !/^[a-z][a-z0-9_ -]*$/i.test(name)) {
      setError('Enter an allergen name using 2–70 letters, numbers or spaces.'); return
    }
    if (!otherAllergenStatus) { setError('Choose how this additional allergen relates to the food.'); return }
    if (allergenNames.includes(key) || form.allergens.some((entry) => entry.key === key)) {
      setError('This allergen is already listed. Change its existing declaration instead.'); return
    }
    if (form.allergens.length >= 20) { setError('This listing has reached the allergen limit.'); return }
    patch('allergens', [...form.allergens, { key, relationship: otherAllergenStatus }])
    setOtherAllergenName(''); setOtherAllergenStatus(''); setError(''); setShowOtherAllergen(false)
  }
  async function deleteListing(item) {
    if (busy || uploading || !item?.id) return
    const approved = item.status === 'approved'
    const message = approved
      ? `Remove "${item.title || 'this listing'}" from your Host Studio and public EPANTRY? It will stop appearing to customers. Super Admin audit history will be retained.`
      : `Remove "${item.title || 'this listing'}" from your Host Studio? The record will be hidden, while any existing review history stays available for audit.`
    if (!window.confirm(message)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await deleteHostListingPacket(item.id)
      if (editingId === item.id) startNew(initialType)
      await load()
      setNotice(`"${item.title || 'Listing'}" was removed from your listings.`)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  async function bulkImport() {
    if (busy) return
    let packets
    try {
      packets = JSON.parse(bulkText)
      if (!Array.isArray(packets)) throw new Error('Bulk file must contain an array of listings.')
    } catch (cause) { setError(cause.message); return }
    if (!packets.length || packets.length > 25) { setError('Import between 1 and 25 listings at once.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await importHostListingPackets(packets)
      setNotice(`${result?.listings?.length || 0} draft listings imported. Open each to check and submit.`)
      setBulkText(''); await load()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  async function previewExcel(file) {
    if (!file) return
    setError(''); setNotice(''); setBulkPreview(null); setBulkProgress('')
    setBulkFileName(file.name)
    try {
      const preview = await parseHostBulkWorkbook(file, allowed.map((type) => type.value))
      setBulkPreview(preview)
      setNotice(`${preview.packets.length} listings ready for review. Import creates drafts only, never public listings.`)
    } catch (cause) { setError(cause?.message || 'Unable to read this EPANTRY Excel template.') }
  }
  async function importExcelDrafts() {
    if (busy || !bulkPreview?.packets?.length) return
    setBusy(true); setError(''); setNotice(''); setBulkProgress('')
    try {
      const packets = await ingestWorkbookImages(bulkPreview.packets, importHostListingRemoteImage, (done, total) => {
        setBulkProgress(`Importing real images into EPANTRY: ${done} of ${total}`)
      })
      setBulkProgress('Saving approved-format drafts to EPANTRY...')
      const result = await importHostListingPackets(packets)
      setNotice(`${result?.listings?.length || 0} listings saved as drafts. Open each item, verify details and submit for Super Admin review.`)
      setBulkPreview(null); setBulkFileName(''); setBulkProgress('')
      await load()
    } catch (cause) {
      setError(`${errorMessage(cause)} Nothing has been added to your draft listings. Check your Excel links or values and retry.`)
      setBulkProgress('')
    } finally { setBusy(false) }
  }
  async function findPublishedProduct() {
    const search = String(form.title || '').trim()
    if (search.length < 3 || productMatchBusy) return
    setProductMatchBusy(true)
    setError('')
    try {
      const result = await searchHostPublishedProducts(search)
      setPublishedProductMatches(result?.products || [])
      if (!result?.products?.length) setNotice('No approved catalog product matched this name. You can still submit it for review.')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setProductMatchBusy(false) }
  }
  const field = styles.field
  const section = styles.section
  return (
    <main ref={fieldRef} className="uel-page" data-workspace={workspace} data-listing-type={form.type}>
      <style>{editorialStyles}</style>
      <div className="uel-shell">
        {workspace === 'legacy' && <p className="uel-legacy-notice" role="status">This account is in the Legacy Host workspace. Hybrid's Grocery / Recipe-only creator requires an approved Hybrid workspace assignment.</p>}
        <header className="uel-hero">
          <div className="uel-hero-main">
            <Link to="/host/listings" className="uel-back"><ArrowLeft size={17}/> All listing options</Link>
            <div className="uel-studio-tools">
              <p className="uel-eyebrow">EPANTRY · Host studio</p>
              <button type="button" className="uel-refresh" disabled={busy || Boolean(uploading)} title="Reload saved Host Studio data. Unsaved edits will be lost." onClick={() => { if (window.confirm('Refresh Host Studio? Any unsaved changes will be lost.')) window.location.reload() }}><RefreshCw size={16} aria-hidden="true"/> Refresh page</button>
            </div>
            <h1 className="uel-hero-title">Create something<br/><em>worth sharing.</em></h1>
            <p className="uel-hero-description">Add groceries, recipes or ready-made food with photos, ingredients and selling details.</p>
            <div className="uel-hero-foot">
              <span className="uel-status"><span className="uel-status-dot"/>{editingId ? (locked ? 'Listing under review' : 'Editing an existing listing') : 'Your new listing'}</span>
              <button type="button" className="uel-new" onClick={() => startNew(initialType)}><Plus size={20} strokeWidth={2.7} aria-hidden="true"/> Start a new listing</button>
            </div>
          </div>
          <aside className="uel-hero-side" aria-label="How publishing works">
            <div>
              <p className="uel-hero-side-kicker">Your path to publishing</p>
              <h2 className="uel-hero-side-title">From idea to listing, in three clear steps.</h2>
              <div className="uel-hero-step"><strong>01</strong><span>Add your item details</span></div>
              <div className="uel-hero-step"><strong>02</strong><span>Save and check your draft</span></div>
              <div className="uel-hero-step"><strong>03</strong><span>Send it to Super Admin</span></div>
            </div>
            <p className="uel-hero-approval">Your listing is visible to customers only after approval. Marketplace selling rules still apply separately.</p>
          </aside>
        </header>
        {error && <div role="alert" className="uel-alert border-l-4 border-red-600 bg-red-50 px-4 py-3 text-red-800">{error}</div>}
        {activeListing?.reviewNote && <div role="status" className="uel-alert border-l-4 border-[#C86C42] bg-[#F7E7DA] px-4 py-3"><strong>Super Admin note:</strong> {activeListing.reviewNote} {correctionSection && <a className="ml-2 font-semibold underline" href={`#listing-${correctionSection}`}>Go to {correctionSection}</a>}</div>}
        {notice && <div role="status" className="uel-alert flex items-center gap-2 border-l-4 border-[#173F35] bg-[#E0ECE1] px-4 py-3 text-[#173F35]"><CheckCircle2 size={18}/>{notice}</div>}

        <div className="uel-mode-bar">
          <div className="uel-mode-text"><h2>How would you like to add items?</h2><p>Create one listing, or prepare several using our Excel templates.</p></div>
          <div className="uel-tabs" role="tablist" aria-label="Listing mode">
            <button role="tab" aria-selected={activeTab === 'single'} data-active={activeTab === 'single'} className="uel-tab" type="button" onClick={() => setActiveTab('single')}>Single listing</button>
            <button role="tab" aria-selected={activeTab === 'bulk'} data-active={activeTab === 'bulk'} className="uel-tab" type="button" onClick={() => setActiveTab('bulk')}>Bulk listing</button>
          </div>
        </div>
        {activeTab === 'single' && <nav className="uel-jumpbar" aria-label="Jump to listing section">
          <span>GO TO</span>
          <a href="#listing-details"><b>01</b> Details</a>
          <a href="#listing-media"><b>02</b> Photos</a>
          {isRecipe && <a href="#listing-ingredients"><b>03</b> Ingredients</a>}
          {isRecipe && <a href="#listing-steps"><b>04</b> Steps</a>}
          <a href="#listing-nutrition"><b>{isRecipe ? '05' : '03'}</b> Food information</a>
          {canSell && <a href="#listing-selling"><b>{isRecipe ? '06' : '04'}</b> Selling</a>}
        </nav>}
        {activeTab === 'bulk' ? (
          <div className="mt-6 space-y-5">
            <section className="uel-bulk-section">
              <h2 className="text-2xl font-bold"><span className="uel-section-number">01</span> / Download your Excel template</h2>
              <p className="mt-2 text-sm text-[#4A5850]">Choose the template for your listing. Grocery uses product details and photos only; recipe and drink templates also include individual ingredients, their photos, preparation steps and costing.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {visibleTemplates.map((item) => (
                  <a key={item.key} href={`/templates/EPANTRY_Bulk_${item.key}.xlsx`} download className="uel-template flex items-center justify-between gap-3 font-semibold text-[#173F35] focus-visible:outline-2 focus-visible:outline-[#C86C42]">
                    <span className="flex items-center gap-2"><FileSpreadsheet size={17}/>{item.label}</span><Download size={16}/>
                  </a>
                ))}
              </div>
            </section>
            <section className="uel-bulk-section grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <h2 className="text-2xl font-bold"><span className="uel-section-number">02</span> / Fill the sheets and upload</h2>
                <p className="mt-2 text-sm leading-6 text-[#4A5850]">Open the Excel file and follow <strong>Start Here</strong>. Give each listing a unique <strong>listing_key</strong>. Use the same key in Photos, Ingredients, Steps and Allergens so every photo and detail attaches to the correct item. The sample sheet is for guidance only.</p>
                <label htmlFor="epantry-bulk-excel" className="mt-4 block text-sm font-semibold">Choose your completed Excel (.xlsx)</label>
                <input id="epantry-bulk-excel" type="file" disabled={busy} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-2 block w-full rounded-lg border border-[#CBD4C8] bg-white p-3 text-sm" onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (file) await previewExcel(file)
                  event.target.value = ''
                }}/>
                {bulkFileName && <p className="mt-2 text-sm text-[#173F35]">Selected: {bulkFileName}</p>}
                {bulkPreview && <div className="mt-5 border border-[#B7C6B8] bg-[#F0F4ED] p-4">
                  <h3 className="font-bold"><span className="uel-section-number">03</span> / Review before importing</h3>
                  <p className="mt-1 text-sm">{bulkPreview.packets.length} draft listings · {bulkPreview.mediaCount} unique images · {bulkPreview.template.replaceAll('_', ' ')} template</p>
                  <div className="mt-3 max-h-72 overflow-auto border-t border-[#CBD4C8]">
                    {bulkPreview.packets.map((packet, index) => <div key={index} className="flex flex-wrap justify-between gap-2 border-b border-[#CBD4C8] py-2 text-sm"><span><strong>{index + 1}. {packet.title}</strong><br/>{packet.category.replaceAll('_', ' ')}</span><span className="text-[#53635B]">{packet.images.length} photos · {packet.ingredients.length} ingredients · {packet.steps.length} steps</span></div>)}
                  </div>
                  {bulkPreview.issues.length > 0 && <div className="mt-3 border-l-4 border-[#C86C42] bg-[#FFF1E8] p-3 text-sm"><strong>Complete these fields before final submission:</strong><ul className="mt-1 list-disc space-y-1 pl-4">{bulkPreview.issues.slice(0, 15).map((issue, index) => <li key={index}>{issue.key}: {issue.message}</li>)}</ul>{bulkPreview.issues.length > 15 && <p>And {bulkPreview.issues.length - 15} more notices. All records will remain drafts.</p>}</div>}
                  {bulkProgress && <p role="status" className="mt-3 text-sm font-semibold text-[#173F35]">{bulkProgress}</p>}
                  <button type="button" disabled={busy} onClick={importExcelDrafts} className={`${styles.button} mt-4`}><UploadCloud size={16} className="mr-2 inline"/>{busy ? 'Importing...' : 'Import images & save draft listings'}</button>
                </div>}
              </div>
              <aside className="uel-bulk-help">
                <h3 className="font-bold">Public Google Drive images</h3>
                <p className="mt-2">Upload each image as a <strong>file</strong> to Google Drive → Share → General access → <strong>Anyone with the link</strong> → Viewer. Paste the copied <strong>file link</strong> into Excel. Folder links and private files will fail.</p>
                <p className="mt-3">During import, EPANTRY attempts to copy each accessible JPG, PNG or WebP into its own Cloudinary storage. The real uploaded photo is then attached to the corresponding item/ingredient, not a random placeholder.</p>
                <p className="mt-3 font-semibold">Up to 25 listings and 120 different images per workbook. Uploaded records remain drafts for review; delivery pincodes, stock and selling prices are never auto-published.</p>
              </aside>
            </section>
            <details className="border-t border-[#D7DDCF] pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#173F35]">Advanced: import existing JSON bulk file (unchanged)</summary>
              <p className="mt-2 text-sm leading-6 text-[#4A5850]">Existing JSON import stays available for automated Host workflows. For normal bulk listing, use the Excel template above.</p>
              <input type="file" accept=".json,application/json" className="mt-3 block w-full text-sm" onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (file.size > 1000000) { setError('Bulk JSON file must be under 1 MB.'); return }
                setBulkText(await file.text())
              }}/>
              <textarea rows={5} value={bulkText} onChange={(event) => setBulkText(event.target.value)} className={`${field} mt-3 font-mono text-xs`} placeholder={'[\n  { "type": "grocery", "title": "Example product", "category": "grocery", "images": [] }\n]'}/>
              <button type="button" disabled={busy || !bulkText.trim()} onClick={bulkImport} className={`${styles.secondary} mt-3`}>Import JSON as drafts</button>
            </details>
          </div>
        ) : (
          <>
          {activeListing?.status === 'approved' && !revisingApproved && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#C86C42] bg-[#FFF0E7] px-4 py-3">
            <p className="text-[15px] font-semibold text-[#173F35]">Need to update this approved listing? Edit the full details and submit them for Super Admin re-approval.</p>
            <button type="button" className={styles.button} onClick={() => { if (window.confirm('Your approved listing will remain available while these edits are reviewed. Continue editing?')) setRevisingApproved(true) }}>Edit complete listing</button>
          </div>}
          {revisingApproved && <p role="status" className="mb-4 border-l-4 border-[#C86C42] bg-[#FFF0E7] p-3 text-[15px] font-semibold text-[#173F35]">Your approved listing remains available. New changes appear only after Super Admin review.</p>}
          <fieldset disabled={locked || busy || loading} className="uel-form min-w-0 disabled:opacity-85">
            <section id="listing-details" className={section}>
              <h2 className="text-2xl font-bold"><span className="uel-section-number">01</span> / The essentials</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <EditorField title="Listing type"><select value={form.type} className={field} onChange={(event) => startNew(event.target.value)}>{selectableTypes.map((item) => <option key={item.value} value={item.value}>{workspace === 'hybrid' && item.value === 'kitchen_recipe' ? 'Recipe' : usesHospitalityOperations && item.value === 'prepared_food'
                  ? 'Ready-made food / menu item' 
                  : workspace === 'chef_restaurant' && item.value === 'kitchen_recipe'
                    ? 'Kitchen recipe'
                    : item.label}</option>)}</select></EditorField>
                <EditorField title="Item / recipe name"><input className={field} value={form.title} maxLength={180} onChange={(event) => patch('title', event.target.value)}/></EditorField>
                {form.type === 'grocery' ? (
                  <EditorField title="Customer category · Grocery"><select aria-label="Grocery product category" className={field} value={form.grocerySubcategory || ''} onChange={(event) => setForm((current) => ({ ...current, category: 'grocery', grocerySubcategory: event.target.value }))}>{groceryCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></EditorField>
                ) : (
                  <EditorField title="Customer category · Recipe"><select aria-label="Recipe food category" className={field} value={form.category === 'grocery' ? 'other' : form.category} onChange={(event) => patch('category', event.target.value)}>{recipeCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></EditorField>
                )}
                {workspace === 'hybrid' && form.type === 'grocery' && <EditorField title="How is it packed?"><select className={field} value={form.packagingType || ''} onChange={(event) => patch('packagingType', event.target.value)}>{packagingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></EditorField>}
                {workspace === 'hybrid' && <EditorField title="Food preference"><select className={field} value={form.dietary || 'not_declared'} onChange={(event) => patch('dietary', event.target.value)}>{dietaryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></EditorField>}
                {form.type === 'brand_recipe' ? (
                  <EditorField title="Approved brand">
                    <select className={field} value={form.brandName || ''} onChange={(event) => patch('brandName', event.target.value)}>
                      <option value="">Choose your approved brand</option>
                      {approvedBrands.map((brand) => <option key={brand.id} value={brand.name}>{brand.name}</option>)}
                    </select>
                    {brandLoadError && <p role="alert" className="mt-1 text-sm text-red-700">{brandLoadError}</p>}
                    {!brandLoadError && approvedBrands.length === 0 && <p className="mt-1 text-sm text-[#5D665F]">No approved brands available for this business.</p>}
                  </EditorField>
                ) : <EditorField title="Brand name (if applicable)"><input className={field} value={form.brandName || ''} onChange={(event) => patch('brandName', event.target.value)}/></EditorField>}
                <EditorField title="Your SKU (if applicable)"><input className={field} value={form.sku || ''} onChange={(event) => patch('sku', event.target.value)}/></EditorField>
                <EditorField title={isRecipe ? 'Country of origin (Host-declared)' : 'Country of origin (as on product label)'}><input className={field} value={form.countryOfOrigin || ''} maxLength={100} onChange={(event) => patch('countryOfOrigin', event.target.value)} placeholder="e.g. India"/></EditorField>
                <EditorField title={isRecipe ? 'Region / state of origin (if known)' : 'Region / state (optional)'}><input className={field} value={form.regionOfOrigin || ''} maxLength={100} onChange={(event) => patch('regionOfOrigin', event.target.value)} placeholder="e.g. Punjab"/></EditorField>
                {isRecipe && <>
                  <EditorField title="Recipe name in its local language (optional)"><input className={field} value={form.localRecipeName || ''} maxLength={200} onChange={(event) => patch('localRecipeName', event.target.value)} placeholder="Use the authentic written name, if known"/></EditorField>
                  <EditorField title="Language of local name (optional)"><input className={field} value={form.localRecipeLanguage || ''} maxLength={80} onChange={(event) => patch('localRecipeLanguage', event.target.value)} placeholder="e.g. Hindi"/></EditorField>
                  <EditorField title="English pronunciation / reading (optional)"><input className={field} value={form.englishNameReading || ''} maxLength={200} onChange={(event) => patch('englishNameReading', event.target.value)} placeholder="Use only when documented"/></EditorField>
                </>}
                {form.type === 'grocery' && <>
                  <EditorField title="Product family"><input className={field} maxLength={160} value={form.productFamily || ''} onChange={(event) => patch('productFamily', event.target.value)} placeholder="e.g. Cooking oil"/></EditorField>
                  <EditorField title="Units in one pack"><input className={field} type="number" min="1" step="1" value={form.unitsPerPack ?? ''} onChange={(event) => patch('unitsPerPack', event.target.value)} placeholder="e.g. 1"/></EditorField>
                  <EditorField title="Manufacturer / packer (from label)"><input className={field} maxLength={180} value={form.manufacturerPacker || ''} onChange={(event) => patch('manufacturerPacker', event.target.value)} placeholder="Use actual manufacturer name"/></EditorField>
                  <EditorField title="Serving size (from label)"><input className={field} maxLength={100} value={form.servingSize || ''} onChange={(event) => patch('servingSize', event.target.value)} placeholder="e.g. 30 g"/></EditorField>
                  <div className="min-w-0"><EditorField title="Barcode / GTIN (from label, optional)"><input className={field} type="text" inputMode="numeric" maxLength={14} value={form.selling?.barcode || ''} onChange={(event) => { nested('selling', 'barcode', event.target.value.replace(/[^0-9]/g, '').slice(0, 14)); patch('catalogProductVersionId', ''); setBarcodeMatches([]); setBarcodeChecked('') }} placeholder="Enter the barcode printed on the pack" autoComplete="off"/></EditorField><button type="button" disabled={barcodeChecking || !form.selling?.barcode} onClick={checkBarcode} className={`${styles.secondary} mt-2`}>{barcodeChecking ? 'Checking...' : 'Check existing products'}</button></div>
                  {barcodeChecked === form.selling?.barcode && <div className="min-w-0 rounded-lg border border-[#CBD4C8] bg-white p-3 sm:col-span-2" aria-live="polite">
                    {barcodeMatches.length ? <><p className="mb-2 font-semibold">This barcode is already in EPANTRY. Select the correct product:</p>{barcodeMatches.map((match) => <label key={match.id} className="flex items-start gap-2 py-2"><input type="radio" name="catalog-match" checked={form.catalogProductVersionId === match.id} onChange={() => patch('catalogProductVersionId', match.id)}/><span>{match.title}</span></label>)}</> : <p>No published product uses this barcode yet. Your listing can be reviewed as a new product.</p>}
                  </div>}
                  <div className="sm:col-span-2 lg:col-span-3 grid gap-3 sm:grid-cols-2"><EditorField title="Ingredients printed on label (optional)"><textarea rows={2} className={field} value={form.labelDeclaration?.ingredients || ''} onChange={(event) => nested('labelDeclaration', 'ingredients', event.target.value)} placeholder="Copy the ingredients from the package"/></EditorField><EditorField title="Allergen statement printed on label (optional)"><textarea rows={2} className={field} value={form.labelDeclaration?.allergens || ''} onChange={(event) => nested('labelDeclaration', 'allergens', event.target.value)} placeholder="Copy the exact statement from the package"/></EditorField><EditorField title="Claims printed on label (optional)"><textarea rows={2} className={field} value={form.labelDeclaration?.claims || ''} onChange={(event) => nested('labelDeclaration', 'claims', event.target.value)} placeholder="Enter only claims visible on the package"/></EditorField></div>
                </>}
                {isRecipe && <EditorField title="Cuisine (optional)"><input className={field} maxLength={100} value={form.cuisine || ''} onChange={(event) => patch('cuisine', event.target.value)} placeholder="e.g. Indian"/></EditorField>}
                {isRecipe && <EditorField title="Preparation time (minutes)"><input className={field} type="number" min="0" step="1" value={form.preparationMinutes ?? ''} onChange={(event) => patch('preparationMinutes', event.target.value)}/></EditorField>}
                {isRecipe && <EditorField title="Cooking time (minutes)"><input className={field} type="number" min="0" step="1" value={form.cookingMinutes ?? ''} onChange={(event) => patch('cookingMinutes', event.target.value)}/></EditorField>}
                {isRecipe && <EditorField title="Servings / batch yield"><input type="number" min="1" className={field} value={form.baseServings ?? ''} onChange={(event) => patch('baseServings', event.target.value)}/></EditorField>}
                {isRecipe && <EditorField title="How difficult is this recipe?"><select aria-label="Recipe difficulty" className={field} value={form.difficulty || 'not_declared'} onChange={(event) => patch('difficulty', event.target.value)}><option value="not_declared">Not declared</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></EditorField>}
              </div>
              <EditorField title="Description"><textarea rows={2} maxLength={3000} className={`${field} mt-4`} value={form.description} onChange={(event) => patch('description', event.target.value)}/></EditorField>
              {workspace === 'hybrid' && form.type === 'kitchen_recipe' && (
                <fieldset className="uel-hybrid-recipe-choice mt-5" aria-label="Recipe publishing choice">
                  <legend className="font-bold text-[#173F35]">What would you like to do with this recipe?</legend>
                  <p className="mt-1 text-sm text-[#4A5850]">A recipe can be shared without a price. Choose the second option only if you will prepare and sell the finished food.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button type="button" aria-pressed={!form.sellReadyMade} className="uel-hybrid-choice" data-selected={!form.sellReadyMade} onClick={() => setForm((current) => ({ ...current, shareRecipe: true, sellReadyMade: false }))}>
                      <strong>Share recipe only</strong><span>Ingredients, steps, photos and food information. No selling price or stock required.</span>
                    </button>
                    <button type="button" aria-pressed={Boolean(form.sellReadyMade)} className="uel-hybrid-choice" data-selected={Boolean(form.sellReadyMade)} onClick={() => setForm((current) => ({ ...current, shareRecipe: true, sellReadyMade: true }))}>
                      <strong>Share & sell the finished dish</strong><span>Add price, stock, delivery coverage and a kitchen outlet for review.</span>
                    </button>
                  </div>
                </fieldset>
              )}
              {workspace !== 'hybrid' && isRecipe && ['kitchen_recipe', 'prepared_food'].includes(form.type) && <div className="mt-4 flex flex-wrap gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.shareRecipe} onChange={(event) => patch('shareRecipe', event.target.checked)}/> Share recipe</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.sellReadyMade} disabled={form.type === 'prepared_food'} onChange={(event) => patch('sellReadyMade', event.target.checked)}/> Sell ready-made item</label></div>}
            </section>
            <section id="listing-media" className={section}>
              <h2 className="text-2xl font-bold"><span className="uel-section-number">02</span> / Show it beautifully {isRecipe ? '— photos & video' : '— photos'}</h2>
              <p className="mt-1 text-sm text-[#4A5850]">Show customers what they will get. Add clear, real photos; for recipes, you can also include a cooking video and ingredient photos.</p>
              <div className="mt-4 flex flex-wrap gap-3">{form.images.map((url, index) => {
                const role = (form.imageRoles || []).find((item) => item.url === url)?.role
                return <div key={`${url}-${index}`} className="relative">
                  <img alt={`Listing photo ${index + 1}`} src={url} className="h-24 w-28 rounded-lg object-cover"/>
                  {role && <span className="mt-1 block max-w-28 text-[13px] font-semibold leading-5 text-[#173F35]">{groceryPhotoRoleLabels[role] || ''}</span>}
                  <button type="button" className="absolute right-1 top-1 rounded bg-white p-1" aria-label={`Remove photo ${index + 1}`} onClick={() => setForm((current) => ({
                    ...current,
                    images: current.images.filter((_, i) => i !== index),
                    imageRoles: (current.imageRoles || []).filter((item) => item.url !== url),
                  }))}><Trash2 size={15}/></button>
                </div>
              })}</div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#173F35] px-4 py-3 text-sm font-semibold text-[#173F35]"><ImagePlus size={18}/>{uploading.startsWith('images') ? 'Uploading...' : 'Upload listing photo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={Boolean(uploading) || form.images.length >= 12} onChange={(event) => { uploadImage(event.target.files?.[0], 'images'); event.target.value = '' }}/></label>
              {form.type === 'grocery' && <details className="uel-packaging-details">
                <summary className="uel-packaging-toggle" aria-label="Expand optional packaging and label photo uploads">
                  <span className="uel-packaging-symbol"><ImagePlus size={22} aria-hidden="true"/></span>
                  <span className="uel-packaging-caption"><strong>Add packaging & label photos</strong><small>7 photo types · Click to choose and upload</small></span>
                  <span className="uel-packaging-optional">OPTIONAL</span>
                  <ChevronDown size={21} className="uel-packaging-arrow" aria-hidden="true"/>
                </summary>
                <div className="uel-packaging-body">
                  <p className="text-[15px] leading-6 text-[#465A4F]">Have photos of the ingredients, nutrition label, barcode or other packaging details? Add only what is relevant. None of these seven photos is required.</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1"><EditorField title="Packaging photo type">
                      <select aria-label="Optional packaging photo type" className={field} value={selectedGroceryPhotoRole} onChange={(event) => setSelectedGroceryPhotoRole(event.target.value)}>
                        {groceryPhotoRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </EditorField></div>
                    <label className="uel-packaging-upload inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-[15px]">
                      <ImagePlus size={18} aria-hidden="true"/>{uploading.startsWith('images') ? 'Uploading...' : 'Upload this photo'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={Boolean(uploading) || form.images.length >= 12} onChange={(event) => { uploadImage(event.target.files?.[0], 'images', -1, selectedGroceryPhotoRole); event.target.value = '' }}/>
                    </label>
                  </div>
                  <p className="mt-3 text-[14px] text-[#54635B]">{form.images.length}/12 total listing photos uploaded. You can skip all extra packaging photos.</p>
                </div>
              </details>}
              {isRecipe && <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="min-w-0">
                  <p className="uel-label mb-2 block">Recipe video (optional)</p>
                  {form.videoUrl && form.videoFileName ? (
                    <div className="uel-video-uploaded">
                      <div className="min-w-0"><span className="text-[13px] text-[#557366]">Uploaded from your device</span><strong className="uel-video-filename">{form.videoFileName}</strong></div>
                      <a className="uel-video-link" href={form.videoUrl} target="_blank" rel="noopener noreferrer">Preview video <ArrowUpRight size={15} className="inline"/></a>
                    </div>
                  ) : <input aria-label="Recipe video HTTPS link" className={field} type="url" value={form.videoUrl || ''} onChange={(event) => setForm((current) => ({ ...current, videoUrl: event.target.value, videoFileName: '' }))} placeholder="Paste an HTTPS video link (optional)"/>}
                  {form.videoUrl && form.videoFileName && <button type="button" className="mt-2 text-[13px] font-semibold text-[#315A4A] underline underline-offset-2" onClick={() => patch('videoFileName', '')}>Edit video URL manually</button>}
                </div>
                <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#173F35] bg-[#F7F6F2] px-4 py-3 text-[15px] font-semibold text-[#173F35]"><UploadCloud size={18}/>{uploading === 'video' ? 'Uploading...' : form.videoUrl ? 'Replace video' : 'Upload video (50 MB max)'}<input className="sr-only" type="file" accept="video/mp4,video/webm" disabled={Boolean(uploading)} onChange={(event) => { uploadVideo(event.target.files?.[0]); event.target.value = '' }}/></label>
              </div>}
            </section>
            {isRecipe && <section id="listing-ingredients" className={`${section} uel-ingredient-editor`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold"><span className="uel-section-number">03</span> / Ingredients & costing</h2>
                <button className={styles.secondary} type="button" onClick={() => patch('ingredients', [...form.ingredients, emptyIngredient()])}><Plus size={16} className="mr-1 inline"/> Add ingredient</button>
              </div>
              <p className="uel-ingredient-intro">List what goes into this recipe. For costs, enter what you paid for the full purchased pack and how much of it you use. We'll calculate the ingredient cost automatically.</p>
              <div className="uel-ingredient-list">{form.ingredients.map((item, index) => <div key={index} className="uel-ingredient-row">
                <div className="uel-ingredient-heading">
                  <h3>Ingredient {String(index + 1).padStart(2, '0')}{item.name ? <span className="ml-2 text-[14px] font-medium text-[#617565]">· {item.name}</span> : null}</h3>
                  <button type="button" className="uel-row-delete" disabled={form.ingredients.length === 1} onClick={() => removeRow('ingredients', index)} aria-label={`Remove ingredient ${index + 1}`}><Trash2 size={16}/> Remove</button>
                </div>
                <div className="uel-ingredient-fields">
                  <div className="uel-span-two"><EditorField title="Ingredient name"><IngredientNameInput className={field} ingredient={item} onChange={(value) => updateRow('ingredients', index, value)}/></EditorField></div>
                  <EditorField title="Quantity used in recipe"><input className={field} type="number" min="0" step="any" value={item.quantity ?? ''} onChange={(event) => updateRow('ingredients', index, { quantity: event.target.value })}/></EditorField>
                  <EditorField title="Unit used"><select className={field} value={item.unit} onChange={(event) => updateRow('ingredients', index, { unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></EditorField>
                  <EditorField title="Price paid for purchased pack (₹)"><input className={field} type="number" min="0" step="0.01" value={item.unitPrice ?? ''} onChange={(event) => updateRow('ingredients', index, { unitPrice: event.target.value })}/></EditorField>
                  <EditorField title="Amount in purchased pack"><input className={field} type="number" min="0" step="any" value={item.priceQuantity ?? ''} onChange={(event) => updateRow('ingredients', index, { priceQuantity: event.target.value })}/></EditorField>
                  <EditorField title="Purchased pack unit"><select className={field} value={item.priceUnit} onChange={(event) => updateRow('ingredients', index, { priceUnit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></EditorField>
                  <div><EditorField title="Ingredient photo (optional)"><div className="uel-ingredient-photo-line">{item.imageUrl && <img src={item.imageUrl} alt={item.name || 'Ingredient'}/>}<label className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-lg border border-[#A3B5A4] bg-white px-4 py-2 text-[14px] font-semibold text-[#173F35]"><ImagePlus size={17}/> {item.imageUrl ? 'Change photo' : 'Upload photo'}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={(event) => { uploadImage(event.target.files?.[0], 'ingredients', index); event.target.value = '' }}/></label></div></EditorField></div>
                  <EditorField title="Used as"><select className={field} value={item.role || 'main'} onChange={(event) => updateRow('ingredients', index, { role: event.target.value })}><option value="main">Main ingredient</option><option value="optional">Optional</option><option value="garnish">Garnish</option></select></EditorField>
                  <EditorField title="Preparation (optional)"><input className={field} maxLength={120} value={item.preparationState || ''} onChange={(event) => updateRow('ingredients', index, { preparationState: event.target.value })} placeholder="e.g. Finely chopped"/></EditorField>
                  <EditorField title="When changing servings"><select className={field} value={item.scalingRule || 'proportional'} onChange={(event) => updateRow('ingredients', index, { scalingRule: event.target.value })}><option value="proportional">Adjust quantity</option><option value="fixed">Keep quantity fixed</option></select></EditorField>
                  <div className="uel-span-full"><EditorField title="Preparation / purchasing note (optional)"><input className={field} value={item.note || ''} onChange={(event) => updateRow('ingredients', index, { note: event.target.value })} placeholder="Example: Finely chopped, or purchased from local market"/></EditorField></div>
                  <div className="uel-span-full uel-ingredient-cost"><span>Estimated cost used in this recipe</span><strong>{formatMoney(costs[index])}</strong></div>
                </div>
              </div>)}</div>
              <div className="uel-cost-total" aria-live="polite"><span><strong>Ingredient total:</strong> {formatMoney(ingredientCost)}</span><span><strong>Complete cost:</strong> {formatMoney(completeCost)}</span><span><strong>Per serving:</strong> {completeCost !== null && Number(form.baseServings) > 0 ? formatMoney(completeCost / Number(form.baseServings)) : 'Not available'}</span><span className="uel-cost-note">{costingComplete ? 'All ingredient prices have been entered.' : 'Add purchased-pack prices and quantities to complete the estimate.'} Estimated from Host-entered prices.</span></div>
            </section>}
            {isRecipe && <section id="listing-steps" className={`${section} uel-steps-editor`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold"><span className="uel-section-number">04</span> / How to make it</h2></div>
              <p className="uel-step-intro">Write each action in the order it happens. Add an approximate time only when useful; customers can follow these instructions step by step.</p>
              <div className="uel-step-list">{form.steps.map((step, index) => <div key={index} className="uel-step-row">
                <span className="uel-step-index" aria-label={`Step ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
                <div className="uel-step-text"><EditorField title={`Step ${index + 1} · What to do`}><textarea className={field} rows={2} value={step.instruction || ''} onChange={(event) => updateRow('steps', index, { instruction: event.target.value })} placeholder="Example: Heat oil and add cumin seeds."/></EditorField></div>
                <div className="uel-step-time"><EditorField title="Time (minutes, optional)"><input className={field} type="number" min="0" value={step.timerMinutes ?? ''} onChange={(event) => updateRow('steps', index, { timerMinutes: event.target.value })} placeholder="e.g. 5"/></EditorField></div>
                <button type="button" className="uel-row-delete uel-step-remove" title={`Remove step ${index + 1}`} aria-label={`Remove step ${index + 1}`} disabled={form.steps.length === 1} onClick={() => removeRow('steps', index)}><Trash2 size={17}/></button>
              </div>)}</div>
              <button type="button" className={`${styles.secondary} uel-step-add-bottom`} onClick={() => patch('steps', [...form.steps, emptyStep()])}><Plus size={17} className="mr-1 inline"/> Add step</button>
            </section>}
          </fieldset>
          <fieldset disabled={busy || loading} className="uel-form uel-updatable-fields min-w-0 disabled:opacity-85">
            {locked && <p className="uel-revision-note" role="status"><strong>Editing a previously submitted listing:</strong> Only Food facts & allergens and Selling & delivery can be changed here. Saving sends these changes to Super Admin again. Your last approved version remains visible until Super Admin reviews the changes.</p>}
            <section id="listing-nutrition" className={`${section} ${locked ? 'uel-locked-section' : ''}`}><h2 className="text-2xl font-bold"><span className="uel-section-number">{isRecipe ? '05' : '03'}</span> / Food facts & allergens</h2>
              <p className="mt-2 text-sm text-[#4A5850]">Only enter values you can support with evidence. Leave unknown information undeclared.</p>
              {locked && <span className="uel-editable-marker">Editable · re-approval required</span>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><EditorField title="Nutrition basis"><input className={field} value={form.nutrition?.basis || ''} onChange={(event) => nested('nutrition', 'basis', event.target.value)}/></EditorField>
                {fields.map((item) => <EditorField key={item} title={item.replace(/([A-Z])/g, ' $1')}><input type="number" min="0" step="any" className={field} value={form.nutrition?.[item] ?? ''} onChange={(event) => nested('nutrition', item, event.target.value)}/></EditorField>)}
                {workspace !== 'hybrid' && <EditorField title="Dietary declaration"><select value={form.dietary} className={field} onChange={(event) => patch('dietary', event.target.value)}>{['not_declared', 'vegetarian', 'vegan', 'non_vegetarian', 'other'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></EditorField>}</div>
              <h3 className="mt-5 text-lg font-semibold">Allergen information</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{allergenNames.map((key) => <EditorField key={key} title={key.replaceAll('_', ' ')}><select className={field} value={form.allergens.find((item) => item.key === key)?.relationship || ''} onChange={(event) => patch('allergens', [...form.allergens.filter((item) => item.key !== key), ...(event.target.value ? [{ key, relationship: event.target.value }] : [])])}><option value="">Not declared</option><option value="contains">Contains</option><option value="may_contain">May contain</option><option value="does_not_contain">Does not contain</option><option value="unknown">Unknown / not verified</option></select></EditorField>)}</div>
              <div className="uel-other-allergen">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h4 className="text-[16px] font-bold text-[#173F35]">Another allergen to declare?</h4><p className="mt-1 text-[14px] text-[#52665A]">Only add one if relevant. Additional allergens are optional.</p></div>
                  <button type="button" className="uel-other-allergen-button" aria-expanded={showOtherAllergen} onClick={() => setShowOtherAllergen((current) => !current)}><Plus size={17}/> Other allergen</button>
                </div>
                {customAllergens.length > 0 && <div className="uel-custom-allergen-list">{customAllergens.map((entry) => <div className="uel-custom-allergen-item" key={entry.key}><strong>{entry.key.replaceAll('_', ' ')}</strong><select className={field} aria-label={`Declaration for ${entry.key.replaceAll('_', ' ')}`} value={entry.relationship} onChange={(event) => patch('allergens', form.allergens.map((item) => item.key === entry.key ? { ...item, relationship: event.target.value } : item))}><option value="contains">Contains</option><option value="may_contain">May contain</option><option value="does_not_contain">Does not contain</option><option value="unknown">Unknown / not verified</option></select><button type="button" className="uel-row-delete" onClick={() => patch('allergens', form.allergens.filter((item) => item.key !== entry.key))}><Trash2 size={15}/> Remove</button></div>)}</div>}
                {showOtherAllergen && <div className="uel-custom-allergen-row"><EditorField title="Allergen name"><input className={field} value={otherAllergenName} maxLength={70} onChange={(event) => setOtherAllergenName(event.target.value)} placeholder="e.g. Mustard"/></EditorField><EditorField title="Declaration"><select className={field} value={otherAllergenStatus} onChange={(event) => setOtherAllergenStatus(event.target.value)}><option value="">Choose</option><option value="contains">Contains</option><option value="may_contain">May contain</option><option value="does_not_contain">Does not contain</option><option value="unknown">Unknown / not verified</option></select></EditorField><button type="button" className={styles.secondary} onClick={addOtherAllergen}>Add allergen</button></div>}
              </div>
              <EditorField title="Evidence / calculation note"><textarea rows={2} className={`${field} mt-4`} value={form.nutrition?.evidenceNote || ''} onChange={(event) => nested('nutrition', 'evidenceNote', event.target.value)}/></EditorField>
            </section>
            {canSell && <section id="listing-selling" className={`${section} ${locked ? 'uel-locked-section' : ''}`}><span id="listing-delivery" /><h2 className="text-2xl font-bold"><span className="uel-section-number">{isRecipe ? '06' : '04'}</span> / Selling & delivery</h2>
              <p className="mt-1 text-sm text-[#4A5850]">Set your pricing, available stock and delivery coverage. These details are reviewed here; your existing selling and delivery settings still control live orders.</p>
              {locked && <span className="uel-editable-marker">Editable · re-approval required</span>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[['listPrice', 'List price (Rs)'], ['salePrice', 'Selling price (Rs)'], ['stockQuantity', 'Available stock'], ['packagingCost', 'Packaging cost (Rs)'], ['labourCost', 'Preparation / staff cost (₹, optional)']].map(([key, title]) => <EditorField key={key} title={title}><input type="number" min="0" step="any" className={field} value={form.selling?.[key] ?? ''} onChange={(event) => nested('selling', key, event.target.value)}/></EditorField>)}
                {form.type !== 'grocery' && <div className="sm:col-span-2 lg:col-span-4">
                  <span className={`${styles.label} mb-1.5 block`}>Approved product match (optional)</span>
                  <button type="button" disabled={productMatchBusy || form.title.trim().length < 3} onClick={findPublishedProduct} className={styles.secondary}>{productMatchBusy ? 'Searching...' : 'Find approved product'}</button>
                  {form.catalogProductVersionId && <button type="button" className={`${styles.secondary} ml-2`} onClick={() => patch('catalogProductVersionId', '')}>Clear match</button>}
                  {publishedProductMatches.length > 0 && <div className="mt-2 border border-[#CAD8CC] p-3" role="group" aria-label="Approved catalog products">
                    {publishedProductMatches.map((product) => <label className="flex items-start gap-2 py-1.5" key={product.id}>
                      <input type="radio" checked={form.catalogProductVersionId === product.id} onChange={() => {
                        setForm((current) => ({ ...current, catalogProductVersionId: product.id,
                          selling: { ...current.selling, packQuantity: product.quantity ?? '', packUnit: product.unit || 'piece' } }))
                      }}/>
                      <span>{product.title} — {product.quantity ?? 'Quantity not stated'} {product.unit}</span>
                    </label>)}
                  </div>}
                  <p className="mt-1 text-sm text-[#4A5850]">Use an exact existing product match for selling. A new item needs catalog approval first.</p>
                </div>}
                <EditorField title="Stock unit"><input className={field} value={form.selling?.stockUnit || 'piece'} onChange={(event) => nested('selling', 'stockUnit', event.target.value)}/></EditorField>
                <EditorField title="Pack / portion quantity"><input className={field} type="number" min="0" step="any" value={form.selling?.packQuantity ?? ''} onChange={(event) => nested('selling', 'packQuantity', event.target.value)}/></EditorField>
                <EditorField title="Pack / portion unit"><select className={field} value={form.selling?.packUnit || 'piece'} onChange={(event) => nested('selling', 'packUnit', event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></EditorField>
                <EditorField title="Minimum order quantity"><input className={field} type="number" min="1" step="1" value={form.selling?.minimumOrderQuantity ?? ''} onChange={(event) => nested('selling', 'minimumOrderQuantity', event.target.value)}/></EditorField>
                <EditorField title="Maximum order quantity (optional)"><input className={field} type="number" min="1" step="1" value={form.selling?.maximumOrderQuantity ?? ''} onChange={(event) => nested('selling', 'maximumOrderQuantity', event.target.value)}/></EditorField>

                {isRecipe && <EditorField title="Restaurant / kitchen outlet (if available)"><select className={field} value={form.selling?.outletId || ''} onChange={(event) => setForm((current) => ({ ...current, selling: { ...current.selling, outletId: event.target.value, menuId: '' } }))}><option value="">Choose an existing kitchen outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name || outlet.outletCode}</option>)}</select></EditorField>}
                {isRecipe && <EditorField title="Restaurant menu (if available)"><select className={field} value={form.selling?.menuId || ''} onChange={(event) => nested('selling', 'menuId', event.target.value)}><option value="">No menu selected</option>{menus.filter((menu) => !form.selling?.outletId || menu.outletId === form.selling.outletId).map((menu) => <option key={menu.id} value={menu.id}>{menu.name || menu.menuCode}</option>)}</select></EditorField>}
                {isRecipe && <EditorField title="Fulfilment"><select className={field} value={form.delivery?.fulfillment || 'delivery'} onChange={(event) => nested('delivery', 'fulfillment', event.target.value)}><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select></EditorField>}
                {isRecipe && <EditorField title="Preparation time (minutes)"><input type="number" min="0" className={field} value={form.delivery?.preparationMinutes ?? ''} onChange={(event) => nested('delivery', 'preparationMinutes', event.target.value)}/></EditorField>}
              </div>
              {form.delivery?.fulfillment === 'delivery' && <EditorField title="Delivery pincodes (comma-separated)"><textarea rows={2} className={`${field} mt-3`} value={pincodeText} onChange={(event) => { pincodeEditedRef.current = true; setPincodeText(event.target.value); nested('delivery', 'postalCodes', event.target.value.split(/[\s,;]+/).filter(Boolean)) }} placeholder="110001, 110002"/>{savedPostalCodes.length > 0 && <span className="mt-1 block text-[13px] leading-5 text-[#54635B]">Your saved active Host delivery areas are prefilled on new listings. You can change the pincodes for this item.</span>}</EditorField>}
              <EditorField title="Delivery / pickup notes"><textarea rows={2} className={`${field} mt-3`} value={form.delivery?.note || ''} onChange={(event) => nested('delivery', 'note', event.target.value)}/></EditorField>
            </section>}
            {editingId && canSell && sellingReadiness && (
              <div className="mb-4 border-l-4 border-[#173F35] bg-[#EEF2EA] p-4" role="status">
                <p className="font-semibold text-[#173F35]">Selling status</p>
                <p className="mt-1 text-sm text-[#40544A]">{sellingReadiness.message}</p>
                {sellingReadiness.marketplacePath && (
                  <Link className={`${styles.secondary} mt-3 inline-flex items-center gap-2`} to={sellingReadiness.marketplacePath}>
                    {sellingReadiness.hasOffer ? 'Manage price & stock' : 'Set up price & stock'} <ArrowUpRight size={16}/>
                  </Link>
                )}
              </div>
            )}
            <section className={`${section} uel-review`}><h2 className="text-xl font-bold">Ready for review?</h2>
              <p className="mt-2 text-sm text-[#4A5850]">{locked ? 'Food facts, allergens, pricing and delivery are editable. Your other details stay protected; these changes require Super Admin review before publishing.' : 'Save your progress whenever you like, or submit your completed listing to Super Admin. Approval does not automatically enable marketplace sales.'}</p>
              {locked ? (
                <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy || Boolean(uploading)} onClick={saveSectionRevision} className={styles.button}><Send size={17} className="mr-2 inline"/>Save changes & send for review</button></div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy || Boolean(uploading)} onClick={() => save(false)} className={styles.secondary}><Save size={17} className="mr-2 inline"/>Save full draft</button><button type="button" disabled={busy || Boolean(uploading)} onClick={() => save(true)} className={styles.button}><Send size={17} className="mr-2 inline"/>Save & submit for review</button></div>
              )}
            </section>
          </fieldset>
          </>
        )}
        <section className="uel-history" aria-labelledby="uel-history-title">
          <div className="uel-history-head">
            <div>
              <p className="uel-eyebrow">Your work, all in one place</p>
              <h2 id="uel-history-title">Your listings & drafts</h2>
              <p className="mt-2">A clear view of everything you've saved, submitted or published.</p>
            </div>
            <span className="uel-history-count">{existing.length} {existing.length === 1 ? 'listing' : 'listings'} in total</span>
          </div>
          <div className="uel-history-filters" role="group" aria-label="Filter saved listings by status">
            {historyFilters.map(([key, label]) => (
              <button key={key} type="button" className="uel-history-filter" data-active={historyFilter === key}
                aria-pressed={historyFilter === key} onClick={() => setHistoryFilter(key)}>
                {label} <b>{historyCount(key)}</b>
              </button>
            ))}
          </div>
          <div className="uel-packet-list">
            {filteredHistory.length ? filteredHistory.map((item) => (
              <div key={item.id} className="uel-packet-row">
                <div className="uel-packet-main">
                  <div className="uel-packet-photo">
                    {item.packet?.images?.[0] ? <img src={item.packet.images[0]} alt="" loading="lazy"/> : <Package size={24} strokeWidth={1.6} aria-hidden="true"/>}
                  </div>
                  <div className="min-w-0">
                    <p className="uel-packet-title">{item.title || 'Untitled draft'}</p>
                    <p className="uel-packet-meta">{item.type.replaceAll('_', ' ')}{listingUpdatedDate(item.updatedAt) ? ` · Updated ${listingUpdatedDate(item.updatedAt)}` : ''}</p>
                  </div>
                </div>
                <span className="uel-packet-status" data-status={item.status}>{listingStatusLabel(item.status)}</span>
                <div className="uel-packet-controls">
                  <button type="button" className={`${styles.secondary} uel-packet-action`} onClick={() => {
                    setParams({ edit: item.id }); setActiveTab('single'); window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}>{['submitted_for_review', 'approved', 'rejected'].includes(item.status) ? 'View listing' : 'Continue editing'} <ArrowUpRight size={16} aria-hidden="true"/></button>
                  <button type="button" className="uel-packet-delete" disabled={busy || Boolean(uploading)} aria-label={`Delete ${item.title || 'listing'}`} onClick={() => deleteListing(item)}><Trash2 size={16} aria-hidden="true"/> Delete</button>
                </div>
              </div>
            )) : <div className="uel-history-empty">
              {existing.length ? 'No listings match this status.' : 'No listings yet. Save your first draft to see it here.'}
              {existing.length > 0 && <button type="button" className="ml-3 font-bold underline underline-offset-4 text-[#173F35]" onClick={() => setHistoryFilter('all')}>Show all</button>}
            </div>}
          </div>
        </section>
        <p className="uel-hold-note"><ClipboardList size={17} className="mt-1 shrink-0"/><span>Non-food categories, including cosmetics and clothing, are not available for listing yet.</span></p>
      </div>
    </main>
  )
}


// Restaurant/menu creation has one canonical place. Existing packets (edit=id)
// deliberately remain editable here to preserve existing Host drafts and history.
export default function HostUnifiedListingPage() {
  const { currentUser } = useAuth()
  const [params] = useSearchParams()
  const workspace = normalizeHostWorkspaceType(currentUser)
  const isEditingExistingPacket = Boolean(params.get('edit'))
  const requestedType = params.get('type')

  return <HostUnifiedListingEditor />
}
