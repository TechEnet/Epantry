import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UploadCloud,
  ArrowUpRight,
  Package,
  Search,
} from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";

import {
  listHospitalityOutlets,
  listHospitalityMenus,
} from "../../hospitality/services/hospitality.service";
import {
  listServiceAreas,
  listInventoryNodes,
  createInventoryNode,
  createHostOffer,
  updateHostOffer,
  createHostPriceRule,
  createInventorySnapshots,
  createServiceArea,
  getHostOfferReadiness,
  getHostEffectivePrice,
  getHostCurrentInventory,
  getPublicPackOffers,
  activateHostOffer,
} from "../../marketplace/services/marketplace.service";
import { listHostNpiDrafts } from "../../universalProduct/services/universalProduct.service";
import {
  listHostRecipeListingHistory,
  listHostBrandRecipeSubmissions,
} from "../../hostOperations/services/hostOperations.service";
import { normalizeHostWorkspaceType } from "../hostWorkspace.config";
import { listHospitalityRestaurantRecipes } from "../../hospitality/services/hospitality.service";
import {
  parseHostBulkWorkbook,
  ingestWorkbookImages,
} from "../utils/hostBulkWorkbook";
import { previewHostBulkZip, ingestHostBulkZipMedia } from "../utils/hostBulkZipMedia";
import {
  createHostListingPacket,
  deleteHostListingPacket,
  getHostListingPacket,
  importHostListingPackets,
  searchHostListingIngredients,
  resubmitApprovedHostListingForSelling,
  listHostListingPackets,
  listHostApprovedBrands,
  checkHostListingBarcode,
  searchHostPublishedProducts,
  getHostListingSellingReadiness,
  submitHostListingPacket,
  submitHostListingSectionRevision,
  updateHostListingPacket,
  uploadHostListingImage,
  uploadHostListingVideo,
  importHostListingRemoteImage,
} from "../services/hostUnifiedListing.service";

// Existing approved records keep their original governance and identifiers.
// Management tools are mounted inside the one Host Listing Studio route until
// their legacy records are safely migrated; no existing records are deleted.
const LegacyListingManager = lazy(() =>
  import("../components/LegacyListingManager")
);
const ProductEvidenceWorkspace = lazy(() =>
  import("../../universalProduct/pages/HostNpiPage")
);
const BrandRecipeHistoryWorkspace = lazy(() =>
  import("../../hostOperations/pages/HostOperationsPage")
);
const KitchenRecipeHistoryWorkspace = lazy(() =>
  import("../../hospitality/pages/RestaurantRecipesPage")
);
const SellingHistoryWorkspace = lazy(() =>
  import("../../listingHistory/pages/HostListingHistoryPage")
);

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
/* EPANTRY_BULK_V4_READY */
/* EPANTRY Bulk Studio v2 — isolated to Bulk tab. */
.uel-bulk-redesign {--bx:#B76147;--bt:#F0D8CC;--bd:#203E35;--bm:#5C6A61;--bl:#E0E3D9;min-width:0;margin-top:22px}
.uel-bulk-redesign *, .uel-bulk-redesign *::before,.uel-bulk-redesign *::after{box-sizing:border-box}
.uel-bulk-redesign h2,.uel-bulk-redesign h3,.uel-bulk-redesign h4{margin:0!important;letter-spacing:-.035em!important;line-height:1.2!important}
.uel-bulk-redesign p{margin:0!important;line-height:1.55!important;font-size:15px!important}
.uel-bulk-kicker{font-size:12px!important;letter-spacing:.13em!important;text-transform:uppercase;font-weight:850!important;color:var(--bx)!important}
.uel-bulk-intro{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:end;border-bottom:1px solid #CCD3C9;padding:6px 3px 22px}
.uel-bulk-intro h2{font-size:clamp(27px,2.7vw,42px)!important;font-weight:850!important;color:var(--bd)!important;margin:7px 0 9px!important}
.uel-bulk-intro p{max-width:670px;color:#56655C!important}
.uel-bulk-limit{display:flex;align-items:center;gap:10px;border:1px solid #D9BDAF;background:#F8E9DF;padding:12px 16px;border-radius:11px;color:#753E30;white-space:nowrap;font-size:13px;font-weight:750}
.uel-bulk-limit strong{font-size:24px;line-height:1;color:#AB573D}
.uel-bulk-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;background:#E9EDE6;border:1px solid #D0DAD0;border-radius:13px;margin:20px 0 22px;overflow:hidden}
.uel-bulk-steps > div{display:flex;align-items:center;gap:11px;padding:15px 17px;border-right:1px solid #D0DAD0;min-width:0;color:#426155}
.uel-bulk-steps > div:last-child{border-right:0}
.uel-bulk-steps b{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;font-size:13px;border:1px solid #B3C5B7;background:#FBFCF9;color:#1E493B}
.uel-bulk-steps span{min-width:0;font-weight:760;font-size:14px;line-height:1.35}
.uel-bulk-steps .is-active{background:#23483B;color:#fff}
.uel-bulk-steps .is-active b{background:#F2D8CA;border-color:#F2D8CA;color:#7D3D2B}
.uel-bulk-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,290px);gap:23px;align-items:start;min-width:0}
.uel-bulk-content{background:#FFFEFC;border:1px solid #D9DED5;border-radius:17px;padding:clamp(19px,2.2vw,30px);min-width:0;box-shadow:0 7px 28px rgba(20,47,36,.035)}
.uel-bulk-part-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:19px;min-width:0}
.uel-bulk-part-number{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:9px;background:#F4DBCF;color:#9E4E33;font-size:14px;font-weight:900}
.uel-bulk-part-head h3{font-size:clamp(20px,2vw,25px)!important;font-weight:850!important;color:#203B32!important}
.uel-bulk-part-head p{font-size:13px!important;color:#6D786F!important;margin-top:5px!important}
.uel-bulk-template-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;min-width:0}
.uel-bulk-redesign a.uel-bulk-template-link{display:flex;align-items:center;gap:12px;min-width:0;border:1px solid #D8E0D7;background:#F9FAF7;padding:13px 14px;border-radius:11px;text-decoration:none;color:#173F35!important;min-height:73px;transition:background .18s,border-color .18s,transform .18s}
.uel-bulk-redesign a.uel-bulk-template-link:hover{background:#FCE9DE;border-color:#CF9476;transform:translateY(-1px)}
.uel-bulk-template-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;background:#E5ECE4;border-radius:10px;color:#234E40}
.uel-bulk-template-info{min-width:0;flex:1}
.uel-bulk-template-info strong{font-size:14px!important;line-height:1.3;display:block;overflow-wrap:anywhere}
.uel-bulk-template-info small{display:block;font-size:12px;line-height:1.4;color:#637267;margin-top:3px}
.uel-bulk-template-download{flex:none;color:#9E583E}
.uel-bulk-divider{height:1px;background:#DDE3DA;margin:27px 0 24px}
.uel-bulk-methods{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px}
.uel-page .uel-bulk-method{display:flex;align-items:flex-start;gap:12px;text-align:left;cursor:pointer;border:1.5px solid #D7DED4!important;border-radius:12px;background:#FBFBF8!important;padding:15px!important;color:#1E3D32!important;min-width:0;min-height:82px}
.uel-page .uel-bulk-method[data-selected='true']{border-color:#B76147!important;background:#FAEBE3!important;box-shadow:inset 4px 0 0 #B76147}
.uel-bulk-method strong{display:block;font-size:15px!important;line-height:1.25}
.uel-bulk-method small{display:block;margin-top:5px;color:#617268;font-size:12px;line-height:1.4}
.uel-bulk-method-icon{display:grid;place-items:center;width:29px;height:29px;flex:none;color:#A75B42}
.uel-bulk-dropzone{position:relative;display:flex;align-items:center;gap:16px;background:#F6F6F1;border:1.8px dashed #C9D2C5;padding:21px 20px;border-radius:13px;min-width:0}
.uel-bulk-dropzone:focus-within{border-color:#B76147;box-shadow:0 0 0 3px #B7614720}
.uel-bulk-drop-icon{background:#E4EADF;color:#1E4839;padding:12px;border-radius:12px;flex:none}
.uel-bulk-dropzone label{flex:1;min-width:0;display:block;font-weight:800;color:#183C31;font-size:15px;cursor:pointer}
.uel-bulk-dropzone label span{display:block;font-weight:500;font-size:13px;color:#627066;margin:5px 0 10px}
.uel-bulk-dropzone input[type=file]{display:block!important;max-width:100%;width:100%;font-size:13px;color:#52675A;cursor:pointer}
.uel-bulk-dropzone input[type=file]::file-selector-button{border:1px solid #173F35;background:#173F35;color:white;padding:9px 13px;margin-right:10px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer}
.uel-bulk-selected{margin-top:14px;padding:11px 13px;border-left:3px solid #B76147;background:#F9EDE5;color:#4C413B;display:flex;align-items:center;gap:8px;font-size:13px;overflow-wrap:anywhere}
.uel-bulk-note{font-size:13px!important;color:#647168!important;margin-top:10px!important}
.uel-bulk-preview{margin-top:22px;border:1px solid #D5DED4;border-radius:13px;background:#FBFCF8;overflow:hidden}
.uel-bulk-preview-head{padding:17px 20px;background:#E5EDE5;display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap}
.uel-bulk-preview-head h3{font-size:20px!important;color:#193F33!important;font-weight:850!important}
.uel-bulk-preview-count{color:#345849;font-size:13px;font-weight:800}
.uel-bulk-list-preview{max-height:290px;overflow:auto;padding:0 19px}
.uel-bulk-preview-row{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #E1E8DE;min-width:0;align-items:center}
.uel-bulk-preview-row:last-child{border-bottom:0}
.uel-bulk-preview-row strong{font-size:14px;color:#24372D;display:block;overflow-wrap:anywhere}
.uel-bulk-preview-row span,.uel-bulk-preview-row small{font-size:12px;color:#657266;line-height:1.45}
.uel-bulk-warning{margin:10px 18px 0;background:#F9ECE2;border-left:3px solid #C16B45;padding:13px 15px;color:#6A3F2E;border-radius:5px}
.uel-bulk-warning strong{font-size:14px}
.uel-bulk-warning ul{font-size:13px;line-height:1.6;list-style:disc;padding-left:20px;margin-top:5px}
.uel-bulk-progress{margin:12px 18px;background:#E8F0E8;padding:12px 14px;color:#164638;font-weight:800;font-size:14px}
.uel-bulk-preview-foot{padding:16px 18px;background:#F3F6F1;border-top:1px solid #DFE6DB;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.uel-bulk-preview-foot p{font-size:12px!important;color:#5B6C60;max-width:430px}
.uel-page .uel-bulk-submit{display:inline-flex;justify-content:center;align-items:center;gap:9px;padding:12px 18px!important;border:1px solid #173F35!important;background:#173F35!important;color:#fff!important;border-radius:9px!important;font-size:14px!important;font-weight:800!important;min-height:46px}
.uel-page .uel-bulk-submit:hover:not(:disabled){background:#28614E!important}
.uel-bulk-aside{display:flex;flex-direction:column;gap:13px;min-width:0}
.uel-bulk-side-panel{border:1px solid #DBE0D7;border-radius:12px;background:#F0F2EC;padding:19px 19px 18px}
.uel-bulk-side-panel h3{font-size:18px!important;color:#1E4035!important;font-weight:800!important;display:flex;align-items:center;gap:8px;margin-bottom:12px!important}
.uel-bulk-side-panel p{color:#586A5D;font-size:13px!important;line-height:1.55!important}
.uel-bulk-side-panel p+p{margin-top:10px!important}
.uel-bulk-side-panel strong{color:#25483A}
.uel-bulk-side-panel ol{list-style:none;margin:0;padding:0}
.uel-bulk-side-panel li{display:grid;grid-template-columns:22px 1fr;gap:8px;border-top:1px solid #D4DCD1;padding:11px 0;color:#506254;font-size:13px;line-height:1.5}
.uel-bulk-side-panel li:first-child{border-top:0}
.uel-bulk-side-panel li b{display:grid;place-items:center;background:#E9D6C9;color:#96543C;width:21px;height:21px;border-radius:50%;font-size:11px}
.uel-bulk-side-panel.is-clay{background:#F3DDD1;border-color:#E6C8B7}
.uel-bulk-side-panel pre{font-size:12px!important;line-height:1.6!important;white-space:pre-wrap;word-break:break-word;color:#274638;background:rgba(255,255,255,.55);padding:12px;border:1px solid #E6CBC0;border-radius:7px;margin:10px 0 0}
.uel-page .uel-bulk-advanced{margin-top:21px;border:1px solid #D9E1D7;background:#FCFDF9;border-radius:11px;padding:0!important;overflow:hidden}
.uel-page .uel-bulk-advanced summary{padding:15px 19px!important;font-size:14px!important;cursor:pointer;font-weight:800!important;color:#1F483B}
.uel-page .uel-bulk-advanced[open]>:not(summary){margin-left:19px;margin-right:19px}
.uel-page .uel-bulk-advanced[open]>:last-child{margin-bottom:18px}
.uel-page:has(.uel-bulk-redesign) .uel-hero{box-shadow:none;border:1px solid #D3DCD2}
.uel-page:has(.uel-bulk-redesign) .uel-hero-main{padding:clamp(24px,2.6vw,38px)}
.uel-page:has(.uel-bulk-redesign) .uel-hero-side{padding:clamp(20px,2.4vw,31px)}
.uel-page:has(.uel-bulk-redesign) .uel-mode-bar{border-bottom:0;margin-top:24px;padding-bottom:0}
@media(max-width:1120px){.uel-bulk-workspace{grid-template-columns:minmax(0,1fr) 250px;gap:15px}.uel-bulk-side-panel{padding:15px}.uel-bulk-content{padding:20px}}
@media(max-width:900px){.uel-bulk-workspace{grid-template-columns:1fr}.uel-bulk-aside{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.uel-bulk-side-panel:last-child{grid-column:1/-1}.uel-bulk-intro{grid-template-columns:1fr}.uel-bulk-limit{justify-self:start}}
@media(max-width:640px){.uel-bulk-redesign{margin-top:14px}.uel-bulk-intro{padding:0 0 16px}.uel-bulk-intro h2{font-size:29px!important}.uel-bulk-steps{grid-template-columns:1fr 1fr 1fr;margin:14px 0}.uel-bulk-steps > div{padding:10px 8px;flex-direction:column;gap:5px;text-align:center}.uel-bulk-steps b{width:26px;height:26px}.uel-bulk-steps span{font-size:11px}.uel-bulk-content{padding:15px;border-radius:10px}.uel-bulk-part-head{gap:9px}.uel-bulk-template-grid{grid-template-columns:1fr}.uel-bulk-methods{grid-template-columns:1fr 1fr;gap:7px}.uel-page .uel-bulk-method{padding:11px!important;min-height:90px;gap:7px}.uel-bulk-method-icon{width:18px}.uel-bulk-method strong{font-size:13px!important}.uel-bulk-method small{font-size:11px}.uel-bulk-dropzone{padding:15px;gap:10px;align-items:flex-start}.uel-bulk-drop-icon{padding:7px}.uel-bulk-aside{display:flex}.uel-bulk-preview-foot{align-items:stretch;flex-direction:column}.uel-page .uel-bulk-submit{width:100%}.uel-bulk-preview-row{align-items:flex-start;flex-direction:column;gap:5px}}
/* EPANTRY BULK STUDIO V4 - Scoped redesign. Clay communicates page identity,
   warm white for content, forest green only for action or success. The three
   progress cells always share the same surface; state is conveyed by borders. */
.uel-page:has(.uel-bulk-redesign){background:#F8F6F2!important}
.uel-page:has(.uel-bulk-redesign) .uel-hero{display:none!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-bar{margin:12px 0 20px!important;padding:0 0 16px!important;border-bottom:1px solid #E5DED7!important}
.uel-bulk-redesign{--bx:#B65F45;--bt:#F6E7DE;--bd:#193C31;--bm:#64655F;--bl:#E6DED5;--bpaper:#FFFEFC;max-width:none!important;margin:0 0 25px!important;color:#2C302C!important;min-width:0}
.uel-bulk-redesign p{font-size:14px!important;line-height:1.55!important}
.uel-bulk-redesign h2,.uel-bulk-redesign h3,.uel-bulk-redesign h4{letter-spacing:-.04em!important}
.uel-bulk-banner{background:#C77558!important;color:#FFF9F5!important;border-radius:14px;border:1px solid #B5674C;padding:clamp(22px,3vw,38px);display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,225px);gap:35px;align-items:center;position:relative;overflow:hidden}
.uel-bulk-banner::after{content:'';position:absolute;border:1px solid #FFFFFF3A;border-radius:100%;height:310px;width:310px;right:-170px;bottom:-220px;pointer-events:none}
.uel-bulk-banner .uel-bulk-kicker{font-size:12px!important;letter-spacing:.16em!important;text-transform:uppercase;color:#FFF1E9!important;font-weight:850!important;margin:0 0 13px!important}
.uel-bulk-banner h2{font-size:clamp(31px,3.3vw,48px)!important;line-height:1.05!important;max-width:660px;font-weight:850!important;color:#FFFDF9!important;margin:0 0 12px!important}
.uel-bulk-banner p{font-size:16px!important;color:#FFF5F0!important;max-width:590px!important;line-height:1.56!important}
.uel-bulk-banner-meta{border-left:1px solid #FFFFFF69;padding-left:24px;display:flex;flex-direction:column;gap:3px}
.uel-bulk-banner-meta strong{font-size:clamp(44px,5vw,61px);line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.065em;color:#FFFDF9}
.uel-bulk-banner-meta span{font-size:13px;font-weight:800;color:#FFF5EF}
.uel-bulk-banner-meta small{font-size:12px;line-height:1.45;color:#FBE5D9;margin-top:7px}
/* ONE uniform row. Only underlined state/number distinguishes progress. */
.uel-bulk-steps{margin:19px 0 22px!important;background:#FFFEFC!important;border:1px solid #E5DDD5!important;box-shadow:none!important;border-radius:10px!important;overflow:hidden!important}
.uel-bulk-steps>div{background:#FFFEFC!important;color:#4F554F!important;min-width:0;min-height:68px;padding:14px 17px!important;border-right:1px solid #E5DDD5!important;border-bottom:3px solid transparent!important;gap:12px!important}
.uel-bulk-steps>div:last-child{border-right:0!important}
.uel-bulk-steps>div b{background:#F5F1EC!important;color:#68645E!important;border:1px solid #D9D1C8!important;width:30px!important;height:30px!important;border-radius:50%!important;box-shadow:none!important}
.uel-bulk-steps>div.is-active{border-bottom-color:#B65F45!important;background:#FFFEFC!important;color:#283B31!important}
.uel-bulk-steps>div.is-active b{color:#B65F45!important;background:#FAEDE4!important;border-color:#D5A38E!important}
.uel-bulk-steps>div.is-complete{border-bottom-color:#B8C7BA!important;color:#334C3E!important}
.uel-bulk-steps>div.is-complete b{background:#EEF3EC!important;color:#365D49!important;border-color:#BDD0C0!important}
.uel-bulk-steps span{font-size:14px!important;font-weight:730!important}
.uel-bulk-workspace{grid-template-columns:minmax(0,1fr) minmax(214px,250px)!important;gap:18px!important;align-items:start!important}
.uel-bulk-content{background:#FFFEFC!important;border:1px solid #E6DED5!important;border-radius:11px!important;box-shadow:none!important;padding:clamp(19px,2.4vw,33px)!important}
.uel-bulk-part-head{align-items:flex-start!important;gap:12px!important;margin-bottom:15px!important}
.uel-bulk-part-number{background:#F4E5DC!important;color:#A5553D!important;min-width:35px;width:35px!important;height:35px!important;border-radius:7px!important;border:none!important;padding:0!important;font-size:13px!important}
.uel-bulk-part-head h3{font-size:clamp(21px,2vw,26px)!important;line-height:1.17!important;color:#232D28!important;font-weight:820!important}
.uel-bulk-part-head p{color:#656C64!important;font-size:13px!important;margin-top:7px!important}
.uel-bulk-template-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 20px!important}
.uel-bulk-redesign a.uel-bulk-template-link{display:flex!important;align-items:center!important;border:0!important;border-bottom:1px solid #E9E4DD!important;padding:13px 4px!important;min-height:68px!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transition:background .16s!important}
.uel-bulk-redesign a.uel-bulk-template-link:hover{background:#FFF4ED!important;transform:none!important}
.uel-bulk-template-icon{background:#F8EEE8!important;color:#A45842!important;border-radius:8px!important;width:39px!important;height:39px!important}
.uel-bulk-template-info strong{color:#27362F!important;font-size:14px!important;font-weight:780!important}
.uel-bulk-template-info small{color:#75776F!important;font-size:12px!important}
.uel-bulk-template-download{color:#A85B45!important}
.uel-bulk-divider{margin:27px 0 27px!important;background:#E5DED7!important;height:1px!important}
.uel-bulk-methods{gap:12px!important;margin-bottom:16px!important}
.uel-page .uel-bulk-method{background:#FFFDFC!important;color:#293930!important;border-radius:9px!important;border:1px solid #DAD5CE!important;padding:16px!important;box-shadow:none!important;min-height:90px!important}
.uel-page .uel-bulk-method[data-selected='true']{background:#FFFDFC!important;border:2px solid #B96D52!important;box-shadow:inset 0 -3px 0 #B96D52!important}
.uel-bulk-method strong{font-size:15px!important;color:#29352F!important}
.uel-bulk-method small{font-size:12px!important;color:#74746C!important}
.uel-bulk-method-icon{color:#A95843!important}
.uel-bulk-dropzone{background:#FAF7F3!important;border:1.5px dashed #BEAC9D!important;border-radius:10px!important;padding:19px 20px!important}
.uel-bulk-drop-icon{background:#F2E5DB!important;color:#AB5B45!important;border-radius:8px!important}
.uel-bulk-dropzone label{font-size:15px!important;color:#29372F!important}
.uel-bulk-dropzone label span{font-size:12px!important;color:#6C7169!important}
.uel-bulk-dropzone input[type=file]::file-selector-button{background:#193C31!important;border-color:#193C31!important;color:#FFF!important}
.uel-bulk-selected{border-left:3px solid #2D7450!important;background:#E9F2EB!important;color:#244636!important}
.uel-bulk-note{color:#64675F!important;font-size:13px!important;margin-top:12px!important}
.uel-bulk-aside{background:#F4F1EC!important;border:1px solid #E6DED5!important;border-radius:10px!important;padding:0 17px!important;gap:0!important;box-shadow:none!important}
.uel-bulk-side-panel{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:18px 0!important}
.uel-bulk-side-panel+.uel-bulk-side-panel{border-top:1px solid #DED5CA!important}
.uel-bulk-side-panel h3{font-size:16px!important;line-height:1.3!important;color:#283D32!important;margin-bottom:10px!important}
.uel-bulk-side-panel li{font-size:12px!important;color:#616960!important;padding:10px 0!important;border-color:#E0D8CE!important}
.uel-bulk-side-panel li b{color:#9C543D!important;background:#F0DED2!important}
.uel-bulk-side-panel p{color:#656860!important;font-size:12px!important}
.uel-bulk-side-panel strong{color:#324E3B!important}
.uel-bulk-preview{margin-top:24px!important;border:1px solid #D5DED4!important;border-radius:9px!important;background:#FFFDF9!important}
.uel-bulk-preview-head{background:#F3F6F1!important;border-bottom:1px solid #DCE5DB!important}
.uel-bulk-preview-head h3{color:#27372C!important}
.uel-bulk-preview-count{color:#23523B!important}
.uel-bulk-list-preview{max-height:320px!important}
.uel-bulk-preview-row{border-color:#ECE8E1!important}
.uel-bulk-warning{background:#FFF2E7!important;border-left-color:#B96D52!important}
.uel-bulk-progress{background:#E9F2EB!important;color:#194C31!important}
.uel-bulk-preview-foot{background:#FCFAF6!important;border-color:#E8E3DA!important}
.uel-page .uel-bulk-submit{background:#173E32!important;border-color:#173E32!important;color:#FFF!important;box-shadow:none!important}
.uel-page .uel-bulk-advanced{border:1px solid #E6DED5!important;background:#FFFEFC!important;border-radius:9px!important;box-shadow:none!important;margin-top:19px!important}
.uel-page .uel-bulk-advanced summary{color:#39483E!important}
/* Full-width media guide with readable folder trees, not squeezed in a sidebar. */
.uel-bulk-folder-guide{margin-top:22px!important;padding:clamp(19px,2.4vw,32px)!important;background:#FFFEFC!important;border:1px solid #E6DED5!important;border-radius:11px!important;box-shadow:none!important}
.uel-bulk-folder-head{display:flex;align-items:start;justify-content:space-between;gap:15px;border-bottom:1px solid #E5DED7;padding-bottom:18px;margin-bottom:18px;flex-wrap:wrap}
.uel-bulk-folder-head h3{font-size:clamp(22px,2.2vw,28px)!important;color:#27382F!important;font-weight:850!important;margin:0 0 7px!important}
.uel-bulk-folder-head p{color:#656960!important;max-width:710px!important;font-size:14px!important}
.uel-bulk-folder-guide-tag{border:1px solid #D7B3A1!important;background:#F7E9E0!important;color:#99543C!important;padding:7px 11px!important;border-radius:6px!important;font-weight:780!important;font-size:12px!important;display:inline-block!important}
.uel-bulk-folder-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;min-width:0}
.uel-bulk-folder-col{border:1px solid #E1D8CE;border-radius:9px;min-width:0;background:#FAF7F2;overflow:hidden}
.uel-bulk-folder-col-head{display:flex;align-items:center;gap:8px;padding:14px 16px;color:#253E31;border-bottom:1px solid #E1D8CE;font-size:15px;font-weight:800}
.uel-bulk-folder-col pre{padding:17px 18px!important;margin:0!important;background:#F8F5F0!important;color:#243D31!important;white-space:pre-wrap;overflow-wrap:anywhere;font:500 13px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace!important}
.uel-bulk-folder-col p{font-size:13px!important;color:#696D65!important;padding:13px 16px 15px!important;border-top:1px solid #E5DED6!important}
.uel-bulk-folder-rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}
.uel-bulk-folder-rule{padding:12px 0!important;border-top:2px solid #E6D1C3!important;min-width:0}
.uel-bulk-folder-rule strong{display:block;color:#99523E!important;font-size:12px!important;margin-bottom:6px!important;text-transform:uppercase;letter-spacing:.06em}
.uel-bulk-folder-rule p{font-size:13px!important;color:#667169!important}
.uel-bulk-folder-rule code{font-size:12px;color:#294F3B}
@media(max-width:1100px){.uel-bulk-workspace{grid-template-columns:minmax(0,1fr) minmax(190px,220px)!important;gap:13px!important}.uel-bulk-content{padding:22px!important}.uel-bulk-methods{grid-template-columns:1fr!important}}
@media(max-width:920px){.uel-bulk-workspace{grid-template-columns:1fr!important}.uel-bulk-aside{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 20px!important}.uel-bulk-side-panel+.uel-bulk-side-panel{border-top:none!important;border-left:1px solid #DED5CA!important;padding-left:20px!important}.uel-bulk-methods{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:670px){.uel-bulk-banner{grid-template-columns:1fr!important;gap:15px!important;padding:23px 18px!important}.uel-bulk-banner-meta{border-left:0!important;border-top:1px solid #FFFFFF60!important;padding:13px 0 0!important;display:grid!important;grid-template-columns:auto 1fr!important;gap:5px 12px!important;align-items:center!important}.uel-bulk-banner-meta strong{font-size:38px!important}.uel-bulk-banner-meta small{grid-column:1/-1!important;margin:0!important}.uel-bulk-steps>div{padding:11px 7px!important;min-height:75px!important;flex-direction:column!important;text-align:center!important;gap:6px!important}.uel-bulk-steps span{font-size:11px!important}.uel-bulk-template-grid,.uel-bulk-folder-grid{grid-template-columns:1fr!important}.uel-bulk-methods{grid-template-columns:1fr!important}.uel-bulk-aside{display:block!important}.uel-bulk-side-panel+.uel-bulk-side-panel{border-left:0!important;border-top:1px solid #DED5CA!important;padding-left:0!important}.uel-bulk-content{padding:18px!important}.uel-bulk-folder-rules{grid-template-columns:1fr!important;gap:7px!important}.uel-bulk-dropzone{align-items:flex-start!important;gap:11px!important}.uel-bulk-preview-foot{flex-direction:column!important;align-items:stretch!important}.uel-page .uel-bulk-submit{width:100%!important}}
/* EPANTRY_BULK_V5_INK_STUDIO -- contained exclusively in Bulk Listing mode.
   Visual rule: paper and slate everywhere; blue = current action, green = success,
   amber = warning only. No decorative alternating step colours. */
.uel-page:has(.uel-bulk-redesign){background:#F5F6F5!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-bar{margin:8px 0 17px!important;border-bottom:1px solid #DBE1E2!important;padding:0 0 14px!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-text h2{color:#203440!important;font-size:clamp(17px,1.7vw,21px)!important;font-weight:800!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-text p{color:#61717A!important}
.uel-bulk-redesign{--bx:#527C92!important;--bt:#EBF1F4!important;--bd:#213541!important;--bm:#5D707A!important;--bl:#DCE3E5!important;--bpaper:#FFFFFF!important;color:#1F313C!important;margin:0 0 25px!important;min-width:0}
.uel-bulk-redesign p{color:#5E6C72!important;font-size:14px!important;line-height:1.55!important}
.uel-bulk-redesign h2,.uel-bulk-redesign h3,.uel-bulk-redesign h4{letter-spacing:-.035em!important}
/* Light editorial heading, not a full-bleed marketing-coloured banner. */
.uel-bulk-banner{background:#FCFDFD!important;border:1px solid #DBE4E6!important;border-top:4px solid #527C92!important;border-radius:13px!important;box-shadow:none!important;color:#203440!important;padding:clamp(21px,2.7vw,36px)!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(170px,225px)!important;gap:clamp(15px,3.4vw,42px)!important;align-items:center!important;overflow:hidden!important}
.uel-bulk-banner::after{display:none!important}
.uel-bulk-banner .uel-bulk-kicker{color:#497386!important;text-transform:uppercase!important;letter-spacing:.15em!important;font-size:11px!important;font-weight:900!important;margin:0 0 9px!important}
.uel-bulk-banner h2{font-size:clamp(31px,3.3vw,47px)!important;line-height:1.06!important;color:#203440!important;margin:0 0 11px!important;font-weight:860!important;max-width:660px!important}
.uel-bulk-banner p{color:#63747C!important;font-size:15px!important;max-width:520px!important;line-height:1.5!important}
.uel-bulk-banner-meta{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px!important;border:0!important;border-radius:12px!important;padding:18px 22px!important;background:#233E4B!important;min-height:135px!important;justify-content:center!important}
.uel-bulk-banner-meta strong{font-size:clamp(43px,4.8vw,62px)!important;line-height:.98!important;color:#F8FCFD!important;font-weight:860!important;letter-spacing:-.06em!important}
.uel-bulk-banner-meta span{color:#EAF2F4!important;font-size:14px!important;font-weight:780!important}
.uel-bulk-banner-meta small{color:#C1D0D7!important;font-size:12px!important;line-height:1.4!important;margin-top:5px!important}
/* One and the same paper surface for the entire step row; only bottom stroke changes state. */
.uel-bulk-steps{margin:15px 0 22px!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;background:#FDFEFE!important;border:1px solid #DCE4E6!important;border-radius:11px!important;box-shadow:none!important;overflow:hidden!important}
.uel-bulk-steps>div,.uel-bulk-steps>div.is-active,.uel-bulk-steps>div.is-complete{background:#FDFEFE!important;color:#5B6C73!important;border-right:1px solid #DEE5E6!important;border-bottom:3px solid transparent!important;min-width:0!important;min-height:66px!important;padding:13px 17px!important;gap:12px!important}
.uel-bulk-steps>div:last-child{border-right:0!important}
.uel-bulk-steps>div.is-active{border-bottom-color:#527C92!important;color:#203D4D!important}
.uel-bulk-steps>div.is-complete{border-bottom-color:#B9C9CE!important;color:#47606C!important}
.uel-bulk-steps>div b,.uel-bulk-steps>div.is-active b,.uel-bulk-steps>div.is-complete b{background:#F0F4F5!important;border:1px solid #D4E0E3!important;color:#526E7C!important;width:31px!important;height:31px!important;border-radius:7px!important;box-shadow:none!important;font-weight:850!important}
.uel-bulk-steps>div.is-active b{background:#E5EFF3!important;color:#255B72!important;border-color:#94B5C2!important}
.uel-bulk-steps span{font-size:14px!important;font-weight:750!important;letter-spacing:0!important}
/* Expand the actual form to the full available host workspace width. */
.uel-bulk-workspace{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:15px!important;align-items:start!important;min-width:0!important}
.uel-bulk-content{display:grid!important;gap:17px!important;padding:0!important;background:transparent!important;border:none!important;border-radius:0!important;box-shadow:none!important;min-width:0!important}
.uel-bulk-content>section[aria-label="Excel templates"],.uel-bulk-content>section[aria-label="Upload Excel or ZIP"]{background:#FFFFFF!important;border:1px solid #DBE4E6!important;border-radius:12px!important;padding:clamp(19px,2.5vw,29px)!important;box-shadow:none!important}
.uel-bulk-divider{display:none!important}
.uel-bulk-part-head{margin:0 0 18px!important;align-items:center!important;gap:13px!important}
.uel-bulk-part-number{display:grid!important;place-items:center!important;background:#EAF0F2!important;border:1px solid #CBD9DF!important;color:#476D7F!important;border-radius:7px!important;min-width:38px!important;width:38px!important;height:38px!important;font-size:13px!important;font-weight:860!important}
.uel-bulk-part-head h3{font-size:clamp(21px,2vw,26px)!important;line-height:1.15!important;color:#203440!important;font-weight:820!important}
.uel-bulk-part-head p{font-size:13px!important;color:#66767E!important;margin-top:5px!important}
.uel-bulk-template-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 22px!important}
.uel-bulk-redesign a.uel-bulk-template-link{background:transparent!important;box-shadow:none!important;min-width:0!important;display:flex!important;align-items:center!important;gap:12px!important;min-height:68px!important;padding:13px 7px!important;border:0!important;border-bottom:1px solid #E5ECEE!important;border-radius:0!important;color:#29424E!important;transition:background-color .15s!important;transform:none!important}
.uel-bulk-redesign a.uel-bulk-template-link:hover,.uel-bulk-redesign a.uel-bulk-template-link:focus-visible{background:#F1F6F8!important;transform:none!important;outline-offset:0!important}
.uel-bulk-template-icon{background:#EFF4F6!important;border:1px solid #E2EBEE!important;color:#4B7184!important;border-radius:8px!important;width:40px!important;height:40px!important}
.uel-bulk-template-info strong{color:#273F4C!important;font-size:14px!important;line-height:1.4!important}
.uel-bulk-template-info small{color:#72828A!important;font-size:12px!important}
.uel-bulk-template-download{color:#5B8090!important}
.uel-bulk-methods{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:13px!important;margin:0 0 17px!important}
.uel-page .uel-bulk-method{position:relative!important;min-height:92px!important;padding:16px 20px!important;display:flex!important;align-items:center!important;gap:15px!important;background:#FBFCFC!important;border:1.5px solid #DAE4E7!important;border-radius:9px!important;box-shadow:none!important;text-align:left!important;color:#2A414C!important}
.uel-page .uel-bulk-method[data-selected='true']{background:#EEF5F8!important;border:1.5px solid #6F9FB3!important;box-shadow:inset 4px 0 0 #527C92!important}
.uel-bulk-method-icon{background:#EFF4F6!important;border-radius:8px!important;width:42px!important;height:42px!important;display:grid!important;place-items:center!important;color:#476F84!important}
.uel-bulk-method strong{font-size:15px!important;color:#233B47!important;line-height:1.3!important}
.uel-bulk-method small{font-size:12px!important;color:#708089!important;line-height:1.4!important}
.uel-bulk-dropzone{background:#F3F7F8!important;border:1.5px dashed #8EABB8!important;border-radius:10px!important;padding:22px!important;box-shadow:none!important}
.uel-bulk-dropzone:focus-within{border-color:#376A83!important;box-shadow:0 0 0 3px #A7CBD940!important}
.uel-bulk-drop-icon{background:#E3EEF2!important;color:#3A697E!important;border-radius:10px!important}
.uel-bulk-dropzone label{color:#243E4A!important;font-size:15px!important}
.uel-bulk-dropzone label span{color:#6D808A!important;font-size:13px!important}
.uel-bulk-dropzone input[type=file]{color:#344D58!important}
.uel-bulk-dropzone input[type=file]::file-selector-button{background:#254653!important;border:1px solid #254653!important;color:white!important;border-radius:7px!important}
.uel-bulk-selected{background:#E9F4EF!important;color:#255A41!important;border-left:3px solid #3D9067!important}
.uel-bulk-note{color:#64777F!important;font-size:13px!important;margin-top:13px!important}
.uel-bulk-aside{display:grid!important;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)!important;gap:16px!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}
.uel-bulk-side-panel{border:1px solid #DCE4E6!important;border-radius:10px!important;background:#FAFCFC!important;box-shadow:none!important;padding:19px 22px!important;min-width:0!important}
.uel-bulk-side-panel+.uel-bulk-side-panel{border:1px solid #DCE4E6!important;padding-left:22px!important}
.uel-bulk-side-panel h3{font-size:17px!important;color:#203C49!important;font-weight:800!important;margin-bottom:12px!important;gap:8px!important}
.uel-bulk-side-panel p{color:#657780!important;font-size:13px!important}
.uel-bulk-side-panel strong{color:#2A4755!important}
.uel-bulk-side-panel ol{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;list-style:none!important;margin:0!important;padding:0!important}
.uel-bulk-side-panel li{display:flex!important;gap:9px!important;align-items:flex-start!important;border:0!important;padding:0!important;color:#5C707A!important;font-size:12px!important;line-height:1.5!important}
.uel-bulk-side-panel li b{display:grid!important;place-items:center!important;width:22px!important;height:22px!important;min-width:22px!important;background:#E7EFF2!important;color:#476F82!important;border-radius:5px!important;font-size:11px!important}
.uel-bulk-side-panel p+p{margin-top:9px!important}
/* Review uses the same restrained palette. Warnings are amber only when needed. */
.uel-bulk-preview{margin-top:0!important;background:#FFF!important;border:1px solid #D9E3E7!important;border-radius:11px!important;box-shadow:none!important}
.uel-bulk-preview-head{background:#F1F6F8!important;border-bottom:1px solid #DCE6EA!important}
.uel-bulk-preview-head h3{color:#244150!important}
.uel-bulk-preview-count{color:#346F87!important}
.uel-bulk-list-preview{max-height:350px!important}
.uel-bulk-preview-row{border-color:#E6ECEE!important}
.uel-bulk-warning{background:#FFF5E4!important;border-left-color:#C28B43!important;color:#7E5428!important}
.uel-bulk-progress{background:#E8F3ED!important;color:#225940!important}
.uel-bulk-preview-foot{background:#F7FAFB!important;border-color:#DEE9EB!important}
.uel-page .uel-bulk-submit{background:#234855!important;border-color:#234855!important;color:#FFFFFF!important;border-radius:8px!important;box-shadow:none!important}
.uel-page .uel-bulk-submit:hover:not(:disabled){background:#34687B!important}
/* Distinctive file-system documentation rather than a stack of generic cards. */
.uel-bulk-folder-guide{margin-top:19px!important;background:#FFFFFF!important;border:1px solid #D9E3E6!important;border-radius:12px!important;box-shadow:none!important;padding:clamp(19px,2.5vw,29px)!important;min-width:0!important}
.uel-bulk-folder-head{display:flex!important;flex-wrap:wrap!important;justify-content:space-between!important;align-items:center!important;gap:17px!important;padding-bottom:17px!important;margin-bottom:19px!important;border-bottom:1px solid #E0E7EA!important}
.uel-bulk-folder-head h3{color:#203845!important;font-size:clamp(22px,2.2vw,29px)!important;font-weight:850!important;margin-bottom:6px!important}
.uel-bulk-folder-head p{color:#667B83!important;max-width:650px!important;font-size:13px!important}
.uel-bulk-folder-guide-tag{background:#EAF2F5!important;color:#3B7187!important;border:1px solid #C7DBE2!important;border-radius:6px!important;padding:9px 11px!important;font-size:12px!important;font-weight:780!important}
.uel-bulk-folder-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:15px!important;min-width:0!important}
.uel-bulk-folder-col{min-width:0!important;overflow:hidden!important;background:#F8FAFA!important;border:1px solid #DBE4E7!important;border-radius:11px!important}
.uel-bulk-folder-col-head{display:flex!important;align-items:center!important;gap:10px!important;font-size:14px!important;font-weight:800!important;color:#253F4B!important;padding:14px 16px!important;border-bottom:1px solid #E0E8EA!important;background:#F6F9FA!important}
.uel-bulk-folder-col pre{margin:0!important;padding:18px 20px!important;min-height:245px!important;background:#192E3A!important;border:0!important;border-radius:0!important;color:#E6F3F8!important;font-size:clamp(11px,1.05vw,13px)!important;line-height:1.72!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:pre!important;overflow-x:auto!important}
.uel-bulk-folder-col>p{background:#F8FAFA!important;padding:14px 17px!important;font-size:13px!important;color:#60747D!important}
.uel-bulk-folder-col>p strong{color:#28546A!important}
.uel-bulk-folder-rules{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:15px!important;margin-top:20px!important;background:transparent!important;border-top:1px solid #E0E8EA!important;padding-top:19px!important}
.uel-bulk-folder-rule{background:transparent!important;border:0!important;padding:0 5px!important}
.uel-bulk-folder-rule strong{font-size:12px!important;color:#346C81!important;text-transform:uppercase!important;letter-spacing:.055em!important}
.uel-bulk-folder-rule p{font-size:12px!important;color:#667981!important;margin-top:6px!important;line-height:1.55!important}
.uel-bulk-folder-rule code{color:#244F60!important;background:#EEF4F5!important;padding:2px 4px!important;border-radius:4px!important}
.uel-page .uel-bulk-advanced{background:#FAFCFC!important;border:1px solid #DFE7E8!important;border-radius:9px!important;margin-top:15px!important;box-shadow:none!important}
.uel-page .uel-bulk-advanced summary{color:#3A5A68!important}
@media(max-width:1050px){.uel-bulk-workspace{grid-template-columns:1fr!important}.uel-bulk-aside{grid-template-columns:1fr 1fr!important}.uel-bulk-side-panel ol{grid-template-columns:1fr!important}.uel-bulk-side-panel li{padding:4px 0!important}}
@media(max-width:740px){.uel-bulk-banner{grid-template-columns:1fr!important;padding:24px 20px!important}.uel-bulk-banner-meta{min-height:0!important;padding:13px 16px!important;display:grid!important;grid-template-columns:auto 1fr!important;align-items:center!important;gap:2px 14px!important}.uel-bulk-banner-meta strong{font-size:39px!important;grid-row:span 2!important}.uel-bulk-banner-meta small{grid-column:2!important;margin:0!important}.uel-bulk-steps>div{flex-direction:column!important;gap:5px!important;padding:11px 5px!important;min-height:77px!important;text-align:center!important}.uel-bulk-steps span{font-size:11px!important}.uel-bulk-template-grid{grid-template-columns:1fr!important}.uel-bulk-methods{grid-template-columns:1fr!important}.uel-bulk-aside{grid-template-columns:1fr!important}.uel-bulk-side-panel ol{grid-template-columns:repeat(3,minmax(0,1fr))!important}.uel-bulk-folder-grid,.uel-bulk-folder-rules{grid-template-columns:1fr!important}.uel-bulk-folder-col pre{min-height:0!important}.uel-bulk-content>section[aria-label="Excel templates"],.uel-bulk-content>section[aria-label="Upload Excel or ZIP"]{padding:18px!important}}
@media(max-width:470px){.uel-bulk-side-panel ol{grid-template-columns:1fr!important}.uel-bulk-dropzone{align-items:flex-start!important}.uel-bulk-banner h2{font-size:30px!important}.uel-bulk-folder-head{align-items:flex-start!important}.uel-bulk-steps>div b{width:27px!important;height:27px!important}.uel-bulk-steps span{font-size:10px!important}}
@media(prefers-reduced-motion:reduce){.uel-bulk-redesign a,.uel-bulk-redesign button{transition:none!important}}

/* EPANTRY_BULK_V5_EDITORIAL_SECTIONS: section-first redesign.
   No marketing-banner blocks, template cards, stacked instruction cards, or random alternating colours.
   Ink: structure/typography. Clay: subtle editorial accent. Blue: actions/active. Green: real success only. */
.uel-page:has(.uel-bulk-redesign){background:#F7F6F2!important;color:#202D38!important}
.uel-page:has(.uel-bulk-redesign) .uel-shell{max-width:none!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-bar{margin:10px 0 0!important;padding-bottom:19px!important;border-bottom:1px solid #CBD1D2!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-text h2{color:#202D38!important}
.uel-page:has(.uel-bulk-redesign) .uel-tabs{background:transparent!important;border:1px solid #C9CFD0!important;border-radius:3px!important;padding:3px!important}
.uel-page:has(.uel-bulk-redesign) .uel-tab{border-radius:2px!important;box-shadow:none!important;color:#324352!important}
.uel-page:has(.uel-bulk-redesign) .uel-tab[data-active='true']{background:#253E58!important;color:#fff!important}
.uel-bulk-redesign{--bx:#375F87!important;--bt:#EEF2F4!important;--bd:#202D38!important;--bm:#616D75!important;--bl:#D3D7D8!important;--bpaper:#F7F6F2!important;padding:0!important;margin:0!important;background:transparent!important;color:#202D38!important}
.uel-bulk-redesign p{color:#657077!important;font-size:15px!important;line-height:1.58!important}
.uel-bulk-banner{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(160px,255px)!important;gap:38px!important;align-items:end!important;padding:clamp(28px,4.5vw,58px) 0 clamp(25px,3vw,39px)!important;background:transparent!important;border:0!important;border-bottom:1px solid #9BA8AA!important;border-top:0!important;border-radius:0!important;box-shadow:none!important;color:#202D38!important}
.uel-bulk-banner::after{display:none!important}
.uel-bulk-banner .uel-bulk-kicker{color:#AD6B50!important;font-size:12px!important;letter-spacing:.19em!important;font-weight:850!important;margin-bottom:18px!important}
.uel-bulk-banner h2{color:#1C2D39!important;font-size:clamp(38px,4.6vw,63px)!important;line-height:1.02!important;letter-spacing:-.052em!important;font-weight:860!important;margin-bottom:14px!important;max-width:680px!important}
.uel-bulk-banner p{font-size:16px!important;color:#627078!important;max-width:650px!important;line-height:1.55!important}
.uel-bulk-banner-meta{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;min-height:0!important;align-items:flex-start!important;border:0!important;border-left:1px solid #B8C1C3!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:4px 0 4px clamp(18px,3vw,32px)!important;gap:4px!important}
.uel-bulk-banner-meta strong{font-size:clamp(64px,7.2vw,93px)!important;letter-spacing:-.072em!important;color:#25435C!important;font-weight:800!important;line-height:.88!important}
.uel-bulk-banner-meta span{color:#2B4252!important;font-size:15px!important;font-weight:800!important}
.uel-bulk-banner-meta small{font-size:12px!important;color:#738087!important;line-height:1.55!important;margin-top:7px!important}
.uel-bulk-steps{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important;margin:0 0 21px!important;padding:0!important;border:0!important;border-radius:0!important;border-bottom:1px solid #BEC9CB!important;background:transparent!important;box-shadow:none!important}
.uel-bulk-steps>div,.uel-bulk-steps>div.is-active,.uel-bulk-steps>div.is-complete{min-height:76px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;flex-direction:row!important;background:transparent!important;border:0!important;border-bottom:3px solid transparent!important;border-radius:0!important;padding:22px 13px 17px!important;gap:13px!important;color:#6B7780!important;box-shadow:none!important}
.uel-bulk-steps>div+div{border-left:1px solid #E0E2E0!important}
.uel-bulk-steps>div.is-active{border-bottom-color:#365D89!important;color:#253E58!important}
.uel-bulk-steps>div.is-complete{border-bottom-color:#CAD2D4!important;color:#52616A!important}
.uel-bulk-steps>div b,.uel-bulk-steps>div.is-complete b,.uel-bulk-steps>div.is-active b{background:transparent!important;border:0!important;border-radius:0!important;padding:0!important;width:auto!important;min-width:0!important;height:auto!important;font-size:14px!important;color:#B8795E!important;font-weight:800!important}
.uel-bulk-steps>div.is-active b{color:#315F8B!important}
.uel-bulk-steps span{font-size:15px!important;line-height:1.2!important;font-weight:750!important}
.uel-bulk-workspace{display:block!important;padding:0!important;margin:0!important;grid-template-columns:1fr!important;background:transparent!important;border:0!important}
.uel-bulk-content{display:block!important;padding:0!important;gap:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.uel-bulk-content>section[aria-label="Excel templates"],.uel-bulk-content>section[aria-label="Upload Excel or ZIP"]{background:transparent!important;padding:clamp(25px,3.5vw,40px) 0!important;border:0!important;border-bottom:1px solid #C9D0D0!important;border-radius:0!important;box-shadow:none!important;margin:0!important}
.uel-bulk-divider{display:none!important}
.uel-bulk-part-head{display:flex!important;gap:22px!important;align-items:flex-start!important;margin:0 0 22px!important}
.uel-bulk-part-number{display:inline-block!important;background:transparent!important;border:0!important;border-radius:0!important;min-width:50px!important;width:50px!important;height:auto!important;font-size:22px!important;line-height:1.15!important;font-weight:800!important;color:#B5795F!important}
.uel-bulk-part-head h3{font-size:clamp(23px,2.5vw,33px)!important;color:#1F323F!important;font-weight:820!important;line-height:1.15!important}
.uel-bulk-part-head p{font-size:14px!important;color:#6A747A!important;margin-top:8px!important;max-width:670px!important}
.uel-bulk-template-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 34px!important;margin-left:72px!important}
.uel-bulk-redesign a.uel-bulk-template-link{background:transparent!important;border:0!important;border-bottom:1px solid #D9DDDB!important;border-radius:0!important;box-shadow:none!important;padding:15px 6px 15px 1px!important;min-height:77px!important;transform:none!important;gap:14px!important;color:#293D4A!important}
.uel-bulk-redesign a.uel-bulk-template-link:hover{background:transparent!important;border-bottom-color:#456E92!important;transform:none!important}
.uel-bulk-redesign a.uel-bulk-template-link:focus-visible{outline:2px solid #365F8A!important;outline-offset:3px!important}
.uel-bulk-template-icon{background:transparent!important;border:0!important;border-radius:0!important;color:#52778C!important;width:35px!important;height:35px!important}
.uel-bulk-template-info strong{font-size:15px!important;color:#263E4C!important;font-weight:780!important}
.uel-bulk-template-info small{font-size:12px!important;color:#758188!important}
.uel-bulk-template-download{color:#A66D54!important}
.uel-bulk-methods{margin:0 0 25px 72px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:24px!important}
.uel-page .uel-bulk-method,.uel-page .uel-bulk-method[data-selected='true']{background:transparent!important;border:0!important;border-bottom:2px solid #CED6D7!important;border-radius:0!important;box-shadow:none!important;min-height:83px!important;padding:12px 10px 16px 0!important;text-align:left!important;display:flex!important;align-items:center!important;gap:15px!important;color:#2A414F!important}
.uel-page .uel-bulk-method[data-selected='true']{border-bottom-color:#375F87!important;background:transparent!important;box-shadow:none!important}
.uel-page .uel-bulk-method:hover:not(:disabled){border-bottom-color:#6A8CAA!important}
.uel-bulk-method-icon{background:transparent!important;border:0!important;color:#607E91!important;width:37px!important;height:37px!important;border-radius:0!important}
.uel-bulk-method[data-selected='true'] .uel-bulk-method-icon{color:#315F88!important}
.uel-bulk-method strong{font-size:16px!important;color:#243B49!important;font-weight:780!important}
.uel-bulk-method small{font-size:13px!important;color:#728087!important}
.uel-bulk-dropzone{display:flex!important;align-items:center!important;gap:18px!important;margin:0 0 0 72px!important;padding:24px 26px!important;background:transparent!important;border:1.5px dashed #A9B8BE!important;border-radius:2px!important;box-shadow:none!important}
.uel-bulk-dropzone:focus-within{border-color:#315F88!important;box-shadow:0 0 0 3px #DCE6EB!important}
.uel-bulk-drop-icon{background:transparent!important;border:0!important;color:#436D87!important;width:36px!important;height:36px!important;border-radius:0!important}
.uel-bulk-dropzone label{color:#2C404D!important;font-size:16px!important;font-weight:760!important}
.uel-bulk-dropzone label span{color:#69777E!important;font-size:13px!important}
.uel-bulk-dropzone input[type=file]::file-selector-button{background:#294E6C!important;border-color:#294E6C!important;color:#fff!important;border-radius:3px!important;padding:8px 14px!important}
.uel-bulk-selected,.uel-bulk-progress{margin:12px 0 0 72px!important;background:#EAF3ED!important;border:0!important;border-left:3px solid #46836A!important;border-radius:0!important;color:#255E45!important;padding:11px 14px!important}
.uel-bulk-note{margin:15px 0 0 72px!important;color:#687780!important;font-size:13px!important}
.uel-bulk-aside{display:grid!important;grid-template-columns:1.2fr 1fr!important;gap:30px!important;align-items:start!important;margin:0!important;padding:23px 0 26px!important;border:0!important;border-bottom:1px solid #C9D0D0!important;background:transparent!important;border-radius:0!important;box-shadow:none!important}
.uel-bulk-side-panel,.uel-bulk-side-panel+.uel-bulk-side-panel{border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;padding:0!important;min-width:0!important}
.uel-bulk-side-panel h3{font-size:17px!important;font-weight:800!important;color:#263F4D!important;margin:0 0 16px!important}
.uel-bulk-side-panel ol{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:22px!important;padding:0!important;margin:0!important}
.uel-bulk-side-panel li{display:flex!important;align-items:start!important;gap:10px!important;min-width:0!important;padding:0!important;border:0!important;color:#617078!important;font-size:13px!important}
.uel-bulk-side-panel li b{background:transparent!important;color:#AE795E!important;width:auto!important;min-width:0!important;height:auto!important;border-radius:0!important;font-size:15px!important}
.uel-bulk-side-panel strong{color:#344F5D!important}
.uel-bulk-side-panel p{font-size:13px!important;color:#67767F!important}
.uel-bulk-side-panel p+p{margin-top:7px!important}
.uel-bulk-preview{margin:26px 0 0 72px!important;border:0!important;border-top:1px solid #9AAEB6!important;border-bottom:1px solid #BFCACD!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.uel-bulk-preview-head,.uel-bulk-preview-foot{padding:22px 0!important;background:transparent!important;border-bottom:1px solid #DBDFDE!important;border-radius:0!important}
.uel-bulk-preview-head h3{font-size:24px!important;color:#243A48!important}
.uel-bulk-preview-count{color:#365C79!important}
.uel-bulk-list-preview{max-height:360px!important}
.uel-bulk-preview-row{border-bottom:1px solid #DEE3E1!important;padding:12px 0!important}
.uel-bulk-preview-foot{border:0!important;border-top:1px solid #D6DFE0!important}
.uel-page .uel-bulk-submit{background:#2C506D!important;color:#fff!important;border:0!important;border-radius:3px!important;min-height:46px!important;box-shadow:none!important}
.uel-page .uel-bulk-submit:hover:not(:disabled){background:#1E405C!important}
.uel-bulk-warning{background:#FCF1DE!important;border-left:3px solid #C29A55!important;color:#806132!important;border-radius:0!important;margin-top:12px!important}
.uel-bulk-folder-guide{background:transparent!important;border:0!important;border-top:1px solid #9AA6AA!important;border-bottom:1px solid #CAD2D2!important;border-radius:0!important;box-shadow:none!important;padding:clamp(27px,3.5vw,43px) 0!important;margin:0!important}
.uel-bulk-folder-head{border:0!important;border-bottom:1px solid #CAD2D2!important;padding:0 0 23px!important;margin:0 0 25px!important;align-items:start!important}
.uel-bulk-folder-head h3{font-size:clamp(26px,3vw,39px)!important;line-height:1.13!important;color:#213543!important;letter-spacing:-.05em!important;font-weight:800!important}
.uel-bulk-folder-head .uel-bulk-kicker{color:#AD7157!important;font-size:12px!important;letter-spacing:.16em!important;margin:0 0 10px!important}
.uel-bulk-folder-head p{max-width:790px!important;font-size:14px!important;color:#63717B!important}
.uel-bulk-folder-guide-tag{background:transparent!important;border:0!important;border-left:2px solid #B57F65!important;color:#866047!important;padding:8px 0 8px 13px!important;border-radius:0!important;font-weight:760!important;font-size:12px!important}
.uel-bulk-folder-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:35px!important}
.uel-bulk-folder-col{border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;overflow:hidden!important}
.uel-bulk-folder-col-head{background:transparent!important;border:0!important;border-bottom:1px solid #C8D3D5!important;color:#284352!important;border-radius:0!important;padding:0 0 15px!important;font-size:17px!important;font-weight:780!important}
.uel-bulk-folder-col pre{min-height:240px!important;margin:0!important;padding:22px 24px!important;border:0!important;background:#EDF0F1!important;color:#304657!important;font-size:clamp(12px,1.15vw,14px)!important;line-height:1.7!important;border-radius:0!important;overflow-x:auto!important;box-shadow:none!important}
.uel-bulk-folder-col>p{padding:17px 0 0!important;border:0!important;background:transparent!important;font-size:13px!important;color:#65737C!important}
.uel-bulk-folder-col>p strong{color:#29485E!important}
.uel-bulk-folder-rules{margin:27px 0 0!important;padding:23px 0 0!important;border-top:1px solid #CAD2D2!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:28px!important}
.uel-bulk-folder-rule{background:transparent!important;border:0!important;padding:0!important}
.uel-bulk-folder-rule strong{color:#AF7559!important;font-size:12px!important;letter-spacing:.12em!important}
.uel-bulk-folder-rule p{font-size:13px!important;color:#68767F!important;margin-top:9px!important}
.uel-bulk-folder-rule code{color:#244E6C!important;background:#E9EEF1!important;border-radius:2px!important}
.uel-page .uel-bulk-advanced{background:transparent!important;border:0!important;border-bottom:1px solid #D2D9D9!important;border-radius:0!important;padding:12px 0 18px!important;margin:0!important;box-shadow:none!important}
.uel-page .uel-bulk-advanced summary{color:#355B77!important}
/* Saved listing area now reads as a catalogue table, not another white card. */
.uel-page:has(.uel-bulk-redesign) .uel-history{margin-top:35px!important;border:0!important;border-top:2px solid #27475E!important;border-bottom:1px solid #CED4D2!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:27px 0!important}
.uel-page:has(.uel-bulk-redesign) .uel-history h2{color:#213847!important}
.uel-page:has(.uel-bulk-redesign) .uel-history-count{border-left:2px solid #B67A60!important;background:transparent!important;color:#314D5E!important;border-radius:0!important}
.uel-page:has(.uel-bulk-redesign) .uel-history-filters{border-color:#CFD6D6!important}
.uel-page:has(.uel-bulk-redesign) .uel-history-filter{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#4E6270!important}
.uel-page:has(.uel-bulk-redesign) .uel-history-filter[data-active='true']{background:#274A65!important;border-radius:2px!important;color:#fff!important;border-color:#274A65!important}
.uel-page:has(.uel-bulk-redesign) .uel-history .uel-eyebrow{color:#AD725B!important}
@media(max-width:1050px){.uel-bulk-template-grid,.uel-bulk-methods,.uel-bulk-dropzone,.uel-bulk-note,.uel-bulk-selected,.uel-bulk-preview{margin-left:0!important}.uel-bulk-aside{grid-template-columns:1fr!important;gap:22px!important}.uel-bulk-side-panel ol{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
@media(max-width:760px){.uel-bulk-banner{grid-template-columns:1fr!important;gap:16px!important;padding:32px 0 22px!important}.uel-bulk-banner-meta{border-left:0!important;border-top:1px solid #D0D5D5!important;padding:12px 0 0!important;display:grid!important;grid-template-columns:auto 1fr!important;gap:2px 16px!important}.uel-bulk-banner-meta strong{font-size:48px!important;grid-row:span 2!important}.uel-bulk-banner-meta small{grid-column:2!important}.uel-bulk-steps>div{gap:5px!important;padding:16px 6px!important;flex-direction:column!important;text-align:center!important;min-height:72px!important}.uel-bulk-steps span{font-size:11px!important}.uel-bulk-template-grid,.uel-bulk-methods,.uel-bulk-folder-grid,.uel-bulk-folder-rules{grid-template-columns:1fr!important}.uel-bulk-methods{gap:8px!important}.uel-bulk-side-panel ol{grid-template-columns:1fr!important;gap:8px!important}.uel-bulk-folder-col pre{min-height:0!important}.uel-bulk-part-head{gap:10px!important}.uel-bulk-part-number{width:38px!important;min-width:38px!important;font-size:18px!important}.uel-bulk-content>section[aria-label="Excel templates"],.uel-bulk-content>section[aria-label="Upload Excel or ZIP"]{padding:25px 0!important}.uel-bulk-dropzone{padding:16px 12px!important;align-items:flex-start!important}}

/* EPANTRY_BULK_V6_NAV_CLARITY
   Purpose: make the bulk studio feel alive and obvious.
   - clearer Single/Bulk toggle
   - clearer step navigation
   - upload methods look like selectable buttons
   - more colour with meaning
   - section-led layout, not dead flat divs */
.uel-page:has(.uel-bulk-redesign){
  background:
    linear-gradient(180deg,#F8F1E8 0,#F8F1E8 315px,#FFFDF8 315px,#FFFDF8 100%)!important;
  color:#20303C!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-mode-bar{
  margin:16px 0 0!important;
  padding:16px 18px 18px!important;
  background:#FFFDF9!important;
  border:1px solid #E8DED2!important;
  border-radius:18px!important;
  box-shadow:0 8px 24px rgba(46,56,68,.05)!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-mode-text h2{font-size:24px!important;color:#1D3242!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-text p{font-size:15px!important;color:#66737D!important}
.uel-page:has(.uel-bulk-redesign) .uel-tabs{
  background:#EEF3F6!important;
  border:0!important;
  border-radius:15px!important;
  padding:6px!important;
  gap:6px!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-tab{
  min-width:152px!important;
  min-height:48px!important;
  border-radius:11px!important;
  font-size:14px!important;
  font-weight:820!important;
  color:#355064!important;
  background:transparent!important;
  border:1px solid transparent!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-tab:hover{background:#E1EBF0!important;border-color:#C3D5DF!important}
.uel-page:has(.uel-bulk-redesign) .uel-tab[data-active='true']{
  background:#2C577B!important;
  border-color:#2C577B!important;
  color:#fff!important;
  box-shadow:0 8px 18px rgba(44,87,123,.18)!important;
}

.uel-bulk-redesign{
  --v6-blue:#2C577B;
  --v6-blue-soft:#EAF1F6;
  --v6-copper:#C9794E;
  --v6-copper-soft:#FBEEE6;
  --v6-green:#246041;
  --v6-green-soft:#EAF5EE;
  --v6-text:#20303C;
  --v6-muted:#68757F;
  --v6-line:#D9E0E4;
  color:var(--v6-text)!important;
}
.uel-bulk-redesign p{color:var(--v6-muted)!important}

.uel-bulk-banner{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(190px,260px)!important;
  gap:26px!important;
  align-items:stretch!important;
  margin-top:18px!important;
  padding:0 0 22px!important;
  border-bottom:1px solid #D8E0E2!important;
}
.uel-bulk-banner>div:first-child{
  background:linear-gradient(135deg,#FFF5EF 0,#FFFDFC 100%)!important;
  border:1px solid #F0D6C8!important;
  border-radius:24px!important;
  padding:28px 28px 26px!important;
  box-shadow:0 10px 26px rgba(70,54,38,.05)!important;
}
.uel-bulk-banner .uel-bulk-kicker{color:#B56740!important;margin-bottom:14px!important}
.uel-bulk-banner h2{font-size:clamp(42px,4.8vw,68px)!important;line-height:.98!important;color:#1F3443!important;max-width:10ch!important;margin-bottom:12px!important}
.uel-bulk-banner p{font-size:16px!important;line-height:1.6!important;color:#6A7680!important;max-width:60ch!important}
.uel-bulk-banner-meta{
  background:linear-gradient(180deg,#2C577B 0,#234865 100%)!important;
  border:0!important;
  border-radius:24px!important;
  padding:24px 24px 22px!important;
  color:#fff!important;
  box-shadow:0 14px 28px rgba(44,87,123,.18)!important;
  justify-content:space-between!important;
}
.uel-bulk-banner-meta strong{font-size:clamp(62px,7vw,92px)!important;color:#fff!important;letter-spacing:-.08em!important;line-height:.85!important}
.uel-bulk-banner-meta span{color:#DCEBFF!important;font-size:14px!important;letter-spacing:.04em!important;text-transform:uppercase!important;font-weight:800!important}
.uel-bulk-banner-meta small{color:#F4F8FC!important;font-size:12px!important;line-height:1.55!important;margin-top:auto!important}

.uel-bulk-steps{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:14px!important;
  margin:22px 0 26px!important;
  border:0!important;
}
.uel-bulk-steps>div,.uel-bulk-steps>div.is-active,.uel-bulk-steps>div.is-complete{
  min-height:88px!important;
  display:flex!important;
  align-items:center!important;
  gap:14px!important;
  padding:18px 18px!important;
  border:1px solid var(--v6-line)!important;
  border-radius:18px!important;
  background:#FFFDF9!important;
  color:#51606B!important;
  box-shadow:0 6px 18px rgba(30,45,60,.04)!important;
}
.uel-bulk-steps>div b{
  width:38px!important;height:38px!important;display:grid!important;place-items:center!important;
  border-radius:999px!important;background:#EFF3F6!important;color:#32556F!important;
  font-size:13px!important;font-weight:900!important;flex:none!important;
}
.uel-bulk-steps>div span{font-size:14px!important;font-weight:780!important;line-height:1.35!important;color:inherit!important}
.uel-bulk-steps>div.is-active{
  background:linear-gradient(180deg,#315E84 0,#2A5275 100%)!important;
  border-color:#2A5275!important;
  color:#fff!important;
  box-shadow:0 14px 30px rgba(42,82,117,.18)!important;
}
.uel-bulk-steps>div.is-active b{background:rgba(255,255,255,.18)!important;color:#fff!important}
.uel-bulk-steps>div.is-complete{
  background:linear-gradient(180deg,#EEF8F1 0,#E7F3EA 100%)!important;
  border-color:#B8D3C1!important;
  color:#225A3D!important;
}
.uel-bulk-steps>div.is-complete b{background:#D7EDDE!important;color:#225A3D!important}

.uel-bulk-workspace{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(245px,290px)!important;
  gap:30px!important;
  align-items:start!important;
}
.uel-bulk-content,.uel-bulk-aside,.uel-bulk-folder-guide,.uel-history{
  background:transparent!important;
  box-shadow:none!important;
}
.uel-bulk-content>section[aria-label="Excel templates"],
.uel-bulk-content>section[aria-label="Upload Excel or ZIP"],
.uel-bulk-preview{
  background:transparent!important;
  border:0!important;
  border-top:2px solid #DDE4E6!important;
  border-radius:0!important;
  padding:28px 0 0!important;
  margin:0!important;
}
.uel-bulk-divider{display:none!important}
.uel-bulk-part-head{margin-bottom:18px!important;align-items:flex-start!important}
.uel-bulk-part-number{
  width:44px!important;min-width:44px!important;height:44px!important;border-radius:999px!important;
  background:var(--v6-copper-soft)!important;color:var(--v6-copper)!important;border:1px solid #F0C6B1!important;
  display:grid!important;place-items:center!important;font-size:16px!important;font-weight:900!important;
}
.uel-bulk-part-head h3{font-size:32px!important;line-height:1.05!important;color:#1F3344!important;letter-spacing:-.05em!important;margin:0 0 7px!important}
.uel-bulk-part-head p{font-size:15px!important;max-width:62ch!important}

.uel-bulk-template-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:0 26px!important;
  background:transparent!important;
}
.uel-bulk-template-link{
  display:grid!important;
  grid-template-columns:40px minmax(0,1fr) 20px!important;
  align-items:center!important;
  gap:14px!important;
  padding:16px 6px!important;
  background:transparent!important;
  border:0!important;
  border-bottom:1px solid #E0E6E8!important;
  border-radius:0!important;
  color:#233948!important;
}
.uel-bulk-template-link:hover{background:#FAF2EB!important}
.uel-bulk-template-icon{
  width:40px!important;height:40px!important;border-radius:11px!important;
  background:#EEF3F7!important;color:#355B77!important;display:grid!important;place-items:center!important;
}
.uel-bulk-template-info strong{font-size:15px!important;color:#22394A!important}
.uel-bulk-template-info small{font-size:12px!important;color:#75808A!important}
.uel-bulk-template-download{color:#BA6E48!important}

.uel-bulk-methods{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:10px!important;
  margin:0 0 18px!important;
  padding:6px!important;
  background:#EEF3F6!important;
  border-radius:18px!important;
  border:1px solid #D7E0E6!important;
}
.uel-page .uel-bulk-method{
  min-height:96px!important;
  align-items:center!important;
  gap:14px!important;
  padding:18px 18px!important;
  background:transparent!important;
  border:1px solid transparent!important;
  border-radius:14px!important;
  color:#294050!important;
  box-shadow:none!important;
}
.uel-page .uel-bulk-method:hover:not(:disabled){background:#F5F8FA!important;border-color:#CFDCE4!important}
.uel-page .uel-bulk-method[data-selected='true']{
  background:#FFFFFF!important;
  border:1px solid #B7CCDB!important;
  box-shadow:0 10px 22px rgba(52,87,117,.08)!important;
}
.uel-bulk-method-icon{
  width:44px!important;height:44px!important;border-radius:12px!important;
  background:#FFF3EB!important;color:#C9794E!important;display:grid!important;place-items:center!important;
}
.uel-bulk-method[data-selected='true'] .uel-bulk-method-icon{background:#EAF1F6!important;color:#2C577B!important}
.uel-bulk-method strong{font-size:16px!important;font-weight:820!important;color:#203447!important}
.uel-bulk-method small{font-size:12px!important;color:#6F7E89!important;line-height:1.45!important}

.uel-bulk-dropzone{
  display:grid!important;
  grid-template-columns:56px minmax(0,1fr)!important;
  gap:16px!important;
  align-items:start!important;
  padding:22px 20px!important;
  border:2px dashed #BFD0DB!important;
  background:linear-gradient(180deg,#FBFDFF 0,#F6FAFC 100%)!important;
  border-radius:20px!important;
}
.uel-bulk-drop-icon{
  width:56px!important;height:56px!important;border-radius:16px!important;
  background:#EAF1F6!important;color:#2D5A7E!important;display:grid!important;place-items:center!important;
}
.uel-bulk-dropzone label{display:flex!important;flex-direction:column!important;gap:6px!important;font-weight:800!important;color:#22384A!important;cursor:pointer!important}
.uel-bulk-dropzone label span{font-weight:500!important;color:#6F7D87!important;line-height:1.55!important}
.uel-bulk-dropzone input[type=file]{margin-top:10px!important}
.uel-bulk-selected{
  margin-top:14px!important;padding:12px 14px!important;border-radius:14px!important;
  background:#EAF5EE!important;border:1px solid #BFD8C7!important;color:#22593C!important;
}
.uel-bulk-note{margin-top:14px!important;padding:0!important;color:#677580!important;font-size:14px!important}

.uel-bulk-aside{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:18px!important;
  align-content:start!important;
  position:sticky!important;top:92px!important;
}
.uel-bulk-side-panel{
  background:#FFFCF8!important;
  border:1px solid #E8DED1!important;
  border-radius:18px!important;
  padding:18px 18px 16px!important;
  box-shadow:0 8px 20px rgba(49,57,67,.05)!important;
}
.uel-bulk-side-panel h3{
  display:flex!important;align-items:center!important;gap:10px!important;
  font-size:18px!important;color:#1F3646!important;margin-bottom:14px!important;
}
.uel-bulk-side-panel h3 svg{color:#C9794E!important}
.uel-bulk-side-panel ol{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;padding:0!important;margin:0!important;list-style:none!important}
.uel-bulk-side-panel li{
  display:grid!important;grid-template-columns:28px minmax(0,1fr)!important;gap:10px!important;align-items:start!important;
  padding:10px 0!important;border-top:1px solid #EEE6DC!important;
}
.uel-bulk-side-panel li:first-child{border-top:0!important;padding-top:0!important}
.uel-bulk-side-panel li b{
  width:28px!important;height:28px!important;display:grid!important;place-items:center!important;border-radius:999px!important;
  background:#FFF1E8!important;color:#C9794E!important;font-size:12px!important;font-weight:900!important;
}
.uel-bulk-side-panel li span,.uel-bulk-side-panel p{font-size:14px!important;line-height:1.55!important;color:#66737E!important}
.uel-bulk-side-panel p strong{color:#23465F!important}

.uel-bulk-folder-guide{
  margin-top:32px!important;
  padding-top:30px!important;
  border-top:2px solid #DDE5E8!important;
}
.uel-bulk-folder-head{
  display:flex!important;justify-content:space-between!important;gap:18px!important;align-items:flex-end!important;
  padding-bottom:16px!important;border-bottom:1px solid #E2E8EB!important;
}
.uel-bulk-folder-head h3{font-size:36px!important;line-height:1.05!important;color:#1F3546!important;letter-spacing:-.05em!important;margin:0 0 8px!important;max-width:15ch!important}
.uel-bulk-folder-head p{font-size:15px!important;max-width:72ch!important}
.uel-bulk-folder-guide-tag{
  align-self:flex-start!important;background:#FFF2E8!important;color:#B86A44!important;
  border:1px solid #F2CFBB!important;border-radius:999px!important;padding:10px 14px!important;font-size:12px!important;font-weight:800!important;
}
.uel-bulk-folder-grid{
  display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:24px!important;margin-top:22px!important;
}
.uel-bulk-folder-col{
  background:transparent!important;border:0!important;border-radius:0!important;padding:0!important;
}
.uel-bulk-folder-col-head{
  display:flex!important;align-items:center!important;gap:10px!important;
  padding:0 0 12px!important;margin-bottom:14px!important;border-bottom:1px solid #E2E9EB!important;
  color:#233A49!important;font-size:18px!important;font-weight:820!important;
}
.uel-bulk-folder-col-head svg{color:#2D5A7E!important}
.uel-bulk-folder-col pre{
  background:#F6F8FA!important;border:1px solid #DEE6E9!important;border-radius:16px!important;
  padding:18px!important;color:#294051!important;min-height:235px!important;font-size:13px!important;line-height:1.6!important;
}
.uel-bulk-folder-col>p{margin-top:12px!important;font-size:14px!important;line-height:1.58!important;color:#6A7882!important}
.uel-bulk-folder-col>p strong{color:#2D5A7E!important}
.uel-bulk-folder-rules{
  display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px!important;
  margin-top:24px!important;padding-top:18px!important;border-top:1px solid #E2E8EB!important;
}
.uel-bulk-folder-rule{
  background:#FFFDF8!important;border:1px solid #ECE2D6!important;border-radius:16px!important;padding:16px 16px 14px!important;
}
.uel-bulk-folder-rule strong{display:block!important;font-size:12px!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#B96F48!important;margin-bottom:8px!important}
.uel-bulk-folder-rule p{font-size:14px!important;line-height:1.55!important;color:#667580!important}
.uel-bulk-folder-rule code{background:#EEF3F6!important;color:#294E6A!important;padding:2px 6px!important;border-radius:6px!important}

.uel-page .uel-bulk-advanced{
  margin-top:26px!important;padding:14px 16px!important;background:#FBFCFD!important;border:1px solid #DEE5E8!important;border-radius:16px!important;
}
.uel-page .uel-bulk-advanced summary{font-size:14px!important;font-weight:780!important;color:#35546A!important}

.uel-history{
  margin-top:34px!important;
  padding:28px 0 0!important;
  border-top:2px solid #DDE5E8!important;
  border-bottom:0!important;
  background:transparent!important;
}
.uel-history-head{padding-bottom:16px!important;border-bottom:1px solid #E2E8EB!important}
.uel-history h2{font-size:38px!important;line-height:1.02!important;color:#1D3344!important}
.uel-history-count{background:#EEF3F7!important;border-left:4px solid #2C577B!important;color:#244258!important;border-radius:12px!important;padding:10px 14px!important}
.uel-history-filters{padding:16px 0 18px!important;border-top:0!important;border-bottom:1px solid #E2E8EB!important}
.uel-history-filter{border-radius:999px!important;padding:10px 14px!important}
.uel-packet-row{grid-template-columns:minmax(0,1fr) minmax(105px,130px) auto!important;padding:18px 6px!important}
.uel-packet-row:hover{background:#FBFCFD!important}

@media (max-width:1100px){
  .uel-bulk-workspace{grid-template-columns:1fr!important}
  .uel-bulk-aside{position:static!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media (max-width:840px){
  .uel-bulk-template-grid,.uel-bulk-folder-grid,.uel-bulk-folder-rules{grid-template-columns:1fr!important}
  .uel-bulk-methods{grid-template-columns:1fr!important}
  .uel-bulk-banner{grid-template-columns:1fr!important}
  .uel-bulk-banner-meta{min-height:0!important}
  .uel-bulk-aside{grid-template-columns:1fr!important}
}
@media (max-width:640px){
  .uel-page:has(.uel-bulk-redesign){background:linear-gradient(180deg,#F8F1E8 0,#F8F1E8 215px,#FFFDF8 215px,#FFFDF8 100%)!important}
  .uel-page:has(.uel-bulk-redesign) .uel-mode-bar{padding:14px!important;border-radius:16px!important}
  .uel-page:has(.uel-bulk-redesign) .uel-tab{min-width:0!important;flex:1 1 0!important;padding:12px 10px!important}
  .uel-bulk-banner>div:first-child,.uel-bulk-banner-meta{border-radius:18px!important;padding:22px 20px!important}
  .uel-bulk-banner h2{font-size:38px!important;max-width:none!important}
  .uel-bulk-steps{grid-template-columns:1fr!important;gap:10px!important}
  .uel-bulk-steps>div,.uel-bulk-steps>div.is-active,.uel-bulk-steps>div.is-complete{min-height:72px!important;padding:14px 16px!important}
  .uel-bulk-part-head h3{font-size:26px!important}
  .uel-bulk-folder-head{align-items:flex-start!important;flex-direction:column!important}
  .uel-history h2{font-size:30px!important}
  .uel-packet-row{grid-template-columns:1fr!important;gap:10px!important}
}

/* EPANTRY_BULK_V7_CLAY_PALETTE
   Exact approved palette:
   PORCELAIN #F7F6F2 | FOREST #173F35 | CHARCOAL #202421
   SOFT SAGE #D7DDCF | CLAY #C56C42 (dominant)
   Scoped to Bulk Listing only: single listing and the global shell untouched.
*/
.uel-page:has(.uel-bulk-redesign){
 --ep-porcelain:#F7F6F2; --ep-forest:#173F35; --ep-charcoal:#202421;
 --ep-sage:#D7DDCF; --ep-clay:#C56C42;
 --ep-soft-clay:color-mix(in srgb,var(--ep-clay) 13%,var(--ep-porcelain));
 --ep-soft-forest:color-mix(in srgb,var(--ep-forest) 10%,var(--ep-porcelain));
 --ep-quiet:color-mix(in srgb,var(--ep-charcoal) 70%,var(--ep-porcelain));
 --ep-line:color-mix(in srgb,var(--ep-forest) 17%,var(--ep-porcelain));
 color:var(--ep-charcoal)!important;
 background:var(--ep-porcelain)!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-mode-bar{
 background:var(--ep-porcelain)!important;
 border:0!important;border-bottom:1px solid var(--ep-line)!important;
 border-radius:0!important;box-shadow:none!important;
 padding:12px 0 17px!important;margin-top:8px!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-mode-text h2{color:var(--ep-charcoal)!important}
.uel-page:has(.uel-bulk-redesign) .uel-mode-text p{color:var(--ep-quiet)!important}
.uel-page:has(.uel-bulk-redesign) .uel-tabs{
 background:var(--ep-sage)!important;border:0!important;
 border-radius:12px!important;padding:5px!important;gap:5px!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-tab{
 background:transparent!important;border:1px solid transparent!important;
 border-radius:9px!important;color:var(--ep-forest)!important;
 box-shadow:none!important;min-height:46px!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-tab[data-active='true']{
 background:var(--ep-clay)!important;border-color:var(--ep-clay)!important;
 color:var(--ep-porcelain)!important;box-shadow:none!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-tab:hover:not([data-active='true']){
 background:var(--ep-porcelain)!important;border-color:var(--ep-line)!important;
}
/* Hero: single dominant clay surface, supported by forest text and sage detail */
.uel-page .uel-bulk-redesign{
 --bx:var(--ep-clay)!important;--bt:var(--ep-soft-clay)!important;
 --bd:var(--ep-charcoal)!important;--bm:var(--ep-quiet)!important;
 --bl:var(--ep-line)!important;--bpaper:var(--ep-porcelain)!important;
 color:var(--ep-charcoal)!important;
}
.uel-page .uel-bulk-redesign p{color:var(--ep-quiet)!important}
.uel-page .uel-bulk-banner{
 display:grid!important;grid-template-columns:minmax(0,1.5fr) minmax(185px,.5fr)!important;
 gap:0!important;border:0!important;padding:0!important;
 margin:20px 0 0!important;background:transparent!important;box-shadow:none!important;
}
.uel-page .uel-bulk-banner>div:first-child{
 background:var(--ep-clay)!important;border:0!important;border-radius:15px 0 0 15px!important;
 padding:clamp(25px,3.3vw,45px)!important;box-shadow:none!important;
}
.uel-page .uel-bulk-banner .uel-bulk-kicker{
 color:var(--ep-porcelain)!important;letter-spacing:.15em!important;font-weight:850!important;
}
.uel-page .uel-bulk-banner h2{
 color:var(--ep-porcelain)!important;max-width:18ch!important;
 font-size:clamp(38px,4.3vw,60px)!important;line-height:1.04!important;
}
.uel-page .uel-bulk-banner p{color:var(--ep-porcelain)!important;opacity:.95}
.uel-page .uel-bulk-banner-meta{
 display:flex!important;flex-direction:column!important;justify-content:center!important;gap:5px!important;
 margin:0!important;padding:clamp(22px,2.5vw,35px)!important;
 background:var(--ep-forest)!important;border:0!important;border-radius:0 15px 15px 0!important;
 box-shadow:none!important;align-items:flex-start!important;min-height:100%!important;
}
.uel-page .uel-bulk-banner-meta strong{color:var(--ep-porcelain)!important;font-size:clamp(58px,6vw,82px)!important}
.uel-page .uel-bulk-banner-meta span,.uel-page .uel-bulk-banner-meta small{
 color:var(--ep-porcelain)!important;opacity:.95;
}
/* Meaningful state colours. Upcoming remains neutral; active is Clay; complete is Sage. */
.uel-page .uel-bulk-steps{gap:0!important;background:transparent!important;border-bottom:1px solid var(--ep-line)!important;
 margin:20px 0 28px!important;padding:0!important;box-shadow:none!important;}
.uel-page .uel-bulk-steps>div,
.uel-page .uel-bulk-steps>div.is-active,
.uel-page .uel-bulk-steps>div.is-complete{
 display:flex!important;flex-direction:row!important;min-height:73px!important;
 border:0!important;border-bottom:3px solid transparent!important;
 border-radius:0!important;background:var(--ep-porcelain)!important;
 box-shadow:none!important;padding:13px 12px!important;gap:13px!important;
 color:var(--ep-quiet)!important;
}
.uel-page .uel-bulk-steps>div+div{border-left:1px solid var(--ep-line)!important}
.uel-page .uel-bulk-steps>div b,
.uel-page .uel-bulk-steps>div.is-active b,
.uel-page .uel-bulk-steps>div.is-complete b{
 width:34px!important;min-width:34px!important;height:34px!important;
 border-radius:50%!important;background:var(--ep-sage)!important;
 color:var(--ep-forest)!important;display:grid!important;place-items:center!important;
 font-size:13px!important;font-weight:850!important;
}
.uel-page .uel-bulk-steps>div.is-active{
 background:var(--ep-soft-clay)!important;border-bottom-color:var(--ep-clay)!important;
 color:var(--ep-forest)!important;
}
.uel-page .uel-bulk-steps>div.is-active b{background:var(--ep-clay)!important;color:var(--ep-porcelain)!important}
.uel-page .uel-bulk-steps>div.is-complete{
 background:var(--ep-sage)!important;border-bottom-color:var(--ep-forest)!important;
 color:var(--ep-forest)!important;
}
.uel-page .uel-bulk-steps>div.is-complete b{background:var(--ep-forest)!important;color:var(--ep-porcelain)!important}
.uel-page .uel-bulk-steps span{font-size:14px!important;font-weight:760!important;color:inherit!important}
/* Flat sections and legible template downloads */
.uel-page .uel-bulk-content,.uel-page .uel-bulk-workspace{
 background:transparent!important;border:0!important;box-shadow:none!important;
}
.uel-page .uel-bulk-content>section[aria-label="Excel templates"],
.uel-page .uel-bulk-content>section[aria-label="Upload Excel or ZIP"],
.uel-page .uel-bulk-preview{
 background:transparent!important;border:0!important;border-bottom:1px solid var(--ep-line)!important;
 padding:26px 0 31px!important;box-shadow:none!important;border-radius:0!important;
}
.uel-page .uel-bulk-part-number{
 background:var(--ep-soft-clay)!important;color:var(--ep-clay)!important;
 border:0!important;border-radius:50%!important;
 min-width:45px!important;width:45px!important;height:45px!important;
 font-size:16px!important;display:grid!important;place-items:center!important;
}
.uel-page .uel-bulk-part-head h3,.uel-page .uel-bulk-folder-head h3,
.uel-page .uel-bulk-preview-head h3{color:var(--ep-charcoal)!important}
.uel-page .uel-bulk-part-head p,.uel-page .uel-bulk-folder-head p{color:var(--ep-quiet)!important}
.uel-page .uel-bulk-template-grid{gap:0 24px!important}
.uel-page .uel-bulk-redesign a.uel-bulk-template-link{
 border:0!important;border-bottom:1px solid var(--ep-line)!important;
 border-radius:0!important;background:transparent!important;color:var(--ep-charcoal)!important;
}
.uel-page .uel-bulk-redesign a.uel-bulk-template-link:hover{
 background:var(--ep-soft-clay)!important;border-bottom-color:var(--ep-clay)!important;
}
.uel-page .uel-bulk-template-icon{
 border:0!important;background:var(--ep-sage)!important;color:var(--ep-forest)!important;
 width:41px!important;height:41px!important;border-radius:8px!important;
}
.uel-page .uel-bulk-template-info strong{color:var(--ep-charcoal)!important}
.uel-page .uel-bulk-template-info small{color:var(--ep-quiet)!important}
.uel-page .uel-bulk-template-download{color:var(--ep-clay)!important}
/* Mode choice is obviously a selection, rather than a plain underline. */
.uel-page .uel-bulk-methods{
 display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
 gap:10px!important;padding:6px!important;background:var(--ep-sage)!important;
 border:0!important;border-radius:12px!important;
}
.uel-page .uel-bulk-method,
.uel-page .uel-bulk-method[data-selected='true']{
 background:transparent!important;border:1px solid transparent!important;
 border-radius:9px!important;box-shadow:none!important;min-height:84px!important;
 padding:14px 16px!important;color:var(--ep-charcoal)!important;display:flex!important;
}
.uel-page .uel-bulk-method:hover:not(:disabled){background:var(--ep-porcelain)!important;border-color:var(--ep-line)!important}
.uel-page .uel-bulk-method[data-selected='true']{
 background:var(--ep-porcelain)!important;border:2px solid var(--ep-clay)!important;
 box-shadow:inset 4px 0 0 var(--ep-clay)!important;
}
.uel-page .uel-bulk-method-icon{
 background:var(--ep-soft-clay)!important;color:var(--ep-clay)!important;
 width:42px!important;height:42px!important;border-radius:9px!important;
}
.uel-page .uel-bulk-method strong{color:var(--ep-charcoal)!important}
.uel-page .uel-bulk-method small{color:var(--ep-quiet)!important}
/* File picker is the next primary action; maintain keyboard focus contrast. */
.uel-page .uel-bulk-dropzone{
 border:2px dashed var(--ep-clay)!important;border-radius:12px!important;
 background:var(--ep-soft-clay)!important;box-shadow:none!important;padding:20px!important;
}
.uel-page .uel-bulk-drop-icon{
 background:var(--ep-clay)!important;color:var(--ep-porcelain)!important;
 width:48px!important;height:48px!important;border-radius:10px!important;
}
.uel-page .uel-bulk-dropzone label{color:var(--ep-forest)!important}
.uel-page .uel-bulk-dropzone label span{color:var(--ep-quiet)!important}
.uel-page .uel-bulk-dropzone input[type=file]::file-selector-button{
 background:var(--ep-clay)!important;border:1px solid var(--ep-clay)!important;
 color:var(--ep-porcelain)!important;border-radius:7px!important;padding:9px 15px!important;
 font-weight:800!important;cursor:pointer!important;
}
.uel-page .uel-bulk-dropzone input[type=file]::file-selector-button:hover{background:var(--ep-forest)!important;border-color:var(--ep-forest)!important}
.uel-page .uel-bulk-selected,.uel-page .uel-bulk-progress{
 background:var(--ep-soft-forest)!important;border:0!important;border-left:4px solid var(--ep-forest)!important;
 color:var(--ep-forest)!important;border-radius:0!important;
}
.uel-page .uel-bulk-note{color:var(--ep-quiet)!important}
/* Checklist is supportive, not a competing main accent. */
.uel-page .uel-bulk-aside{position:static!important;border-color:var(--ep-line)!important}
.uel-page .uel-bulk-side-panel{
 background:transparent!important;border:0!important;border-radius:0!important;
 padding:0!important;box-shadow:none!important;
}
.uel-page .uel-bulk-side-panel h3{color:var(--ep-forest)!important}
.uel-page .uel-bulk-side-panel h3 svg{color:var(--ep-clay)!important}
.uel-page .uel-bulk-side-panel li{border-top-color:var(--ep-line)!important}
.uel-page .uel-bulk-side-panel li b{
 background:var(--ep-sage)!important;color:var(--ep-forest)!important;
 border-radius:50%!important;
}
.uel-page .uel-bulk-side-panel p,.uel-page .uel-bulk-side-panel li span{color:var(--ep-quiet)!important}
.uel-page .uel-bulk-side-panel p strong{color:var(--ep-forest)!important}
/* ZIP guide remains an editorial section, not two giant cards. */
.uel-page .uel-bulk-folder-guide{
 background:transparent!important;border:0!important;border-top:2px solid var(--ep-clay)!important;
 border-bottom:1px solid var(--ep-line)!important;padding:28px 0!important;margin-top:28px!important;
}
.uel-page .uel-bulk-folder-head,.uel-page .uel-bulk-folder-col-head,
.uel-page .uel-bulk-folder-rules{border-color:var(--ep-line)!important}
.uel-page .uel-bulk-folder-head .uel-bulk-kicker,.uel-page .uel-bulk-folder-rule strong{color:var(--ep-clay)!important}
.uel-page .uel-bulk-folder-guide-tag{
 color:var(--ep-forest)!important;background:var(--ep-sage)!important;
 border:0!important;border-radius:6px!important;padding:9px 12px!important;
}
.uel-page .uel-bulk-folder-col{background:transparent!important;border:0!important;box-shadow:none!important}
.uel-page .uel-bulk-folder-col-head,.uel-page .uel-bulk-folder-col-head svg{color:var(--ep-forest)!important}
.uel-page .uel-bulk-folder-col pre{
 background:var(--ep-sage)!important;color:var(--ep-charcoal)!important;
 border:0!important;border-radius:7px!important;box-shadow:none!important;
}
.uel-page .uel-bulk-folder-col>p,.uel-page .uel-bulk-folder-rule p{color:var(--ep-quiet)!important}
.uel-page .uel-bulk-folder-col>p strong{color:var(--ep-forest)!important}
.uel-page .uel-bulk-folder-rule{background:transparent!important;border:0!important;border-radius:0!important;padding:0!important}
.uel-page .uel-bulk-folder-rule code{
 color:var(--ep-forest)!important;background:var(--ep-sage)!important;
}
.uel-page .uel-bulk-advanced{background:transparent!important;border-color:var(--ep-line)!important}
.uel-page .uel-bulk-advanced summary{color:var(--ep-forest)!important}
/* Preview and draft archive preserve existing data and status semantics. */
.uel-page .uel-bulk-preview-count{color:var(--ep-forest)!important}
.uel-page .uel-bulk-preview-row,.uel-page .uel-bulk-preview-foot{border-color:var(--ep-line)!important}
.uel-page .uel-bulk-submit{
 background:var(--ep-clay)!important;color:var(--ep-porcelain)!important;
 border:1px solid var(--ep-clay)!important;border-radius:9px!important;
}
.uel-page .uel-bulk-submit:hover:not(:disabled){background:var(--ep-forest)!important;border-color:var(--ep-forest)!important}
.uel-page .uel-bulk-warning{
 color:var(--ep-charcoal)!important;background:var(--ep-soft-clay)!important;
 border-left:4px solid var(--ep-clay)!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-history{
 background:transparent!important;border:0!important;border-top:2px solid var(--ep-forest)!important;
 border-bottom:1px solid var(--ep-line)!important;box-shadow:none!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-history h2{color:var(--ep-charcoal)!important}
.uel-page:has(.uel-bulk-redesign) .uel-history .uel-eyebrow{color:var(--ep-clay)!important}
.uel-page:has(.uel-bulk-redesign) .uel-history-count{
 background:var(--ep-sage)!important;color:var(--ep-forest)!important;
 border-left:3px solid var(--ep-clay)!important;border-radius:6px!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-history-filters{border-color:var(--ep-line)!important}
.uel-page:has(.uel-bulk-redesign) .uel-history-filter{
 background:transparent!important;border:1px solid var(--ep-line)!important;
 color:var(--ep-forest)!important;border-radius:7px!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-history-filter[data-active='true']{
 background:var(--ep-clay)!important;border-color:var(--ep-clay)!important;
 color:var(--ep-porcelain)!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-history-filter:hover:not([data-active='true']){
 background:var(--ep-soft-clay)!important;border-color:var(--ep-clay)!important;
}
.uel-page:has(.uel-bulk-redesign) .uel-packet-row{border-bottom-color:var(--ep-line)!important}
.uel-page:has(.uel-bulk-redesign) .uel-packet-row:hover{background:var(--ep-soft-clay)!important}
.uel-page:has(.uel-bulk-redesign) .uel-bulk-redesign :is(button,a,input,summary):focus-visible{
 outline:3px solid var(--ep-forest)!important;outline-offset:3px!important;
}
@media(max-width:840px){
 .uel-page .uel-bulk-banner{grid-template-columns:1fr!important}
 .uel-page .uel-bulk-banner>div:first-child{border-radius:15px 15px 0 0!important}
 .uel-page .uel-bulk-banner-meta{border-radius:0 0 15px 15px!important;padding:20px!important}
}
@media(max-width:700px){
 .uel-page .uel-bulk-steps{gap:0!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}
 .uel-page .uel-bulk-steps>div,.uel-page .uel-bulk-steps>div.is-active,.uel-page .uel-bulk-steps>div.is-complete{
  flex-direction:column!important;min-height:78px!important;gap:6px!important;padding:12px 5px!important;text-align:center!important;
 }
 .uel-page .uel-bulk-steps span{font-size:11px!important}
 .uel-page .uel-bulk-template-grid,.uel-page .uel-bulk-methods,.uel-page .uel-bulk-folder-grid{grid-template-columns:1fr!important}
 .uel-page .uel-bulk-folder-rules{grid-template-columns:1fr!important}
}
/* EPANTRY_BULK_V8_UPLOAD_SECTION — limited to Section 02 only.
   Exact palette: Clay #C56C42 primary; Porcelain #F7F6F2,
   Forest #173F35, Charcoal #202421, Soft Sage #D7DDCF. */
.uel-page .uel-bulk-upload-stage{background:transparent!important;border-bottom:1px solid var(--ep-line,#D2D7CD)!important;padding:27px 0 30px!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-part-head{margin-bottom:22px!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-part-head h3{color:#202421!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-part-head p{font-size:15px!important;color:#59645C!important;max-width:660px!important}
/* Two clearly interactive choices, with a consistent pale surface instead of nested cards */
.uel-page .uel-bulk-upload-stage .uel-bulk-methods{
  display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
  padding:0!important;margin:0 0 0!important;gap:14px!important;
  background:transparent!important;border:0!important;border-radius:0!important;
}
.uel-page .uel-bulk-upload-stage .uel-bulk-method{
  display:grid!important;grid-template-columns:48px minmax(0,1fr) 24px!important;
  gap:14px!important;align-items:center!important;text-align:left!important;
  min-height:104px!important;padding:18px 19px!important;cursor:pointer!important;
  background:#F7F6F2!important;border:1.5px solid #C9D0C5!important;border-radius:12px!important;
  color:#202421!important;box-shadow:none!important;transition:background .15s ease,border-color .15s ease!important;
}
.uel-page .uel-bulk-upload-stage .uel-bulk-method:hover:not(:disabled){background:#EDEFE8!important;border-color:#789486!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-method[data-selected='true']{
  background:#FFFDFC!important;border:2px solid #C56C42!important;
  box-shadow:inset 0 4px 0 #C56C42!important;
}
.uel-page .uel-bulk-upload-stage .uel-bulk-method-icon{
  display:grid!important;place-items:center!important;width:48px!important;height:48px!important;
  border-radius:10px!important;background:#D7DDCF!important;color:#173F35!important;
}
.uel-page .uel-bulk-upload-stage .uel-bulk-method[data-selected='true'] .uel-bulk-method-icon{background:#F5E6DC!important;color:#C56C42!important}
.uel-bulk-choice-body{min-width:0!important;display:flex!important;flex-direction:column!important;gap:5px!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-choice-body strong{font-size:17px!important;font-weight:800!important;color:#202421!important;line-height:1.3!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-choice-body small{font-size:13px!important;line-height:1.4!important;color:#59645C!important}
.uel-bulk-choice-indicator{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;color:#C56C42!important;opacity:0!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-method[data-selected='true'] .uel-bulk-choice-indicator{opacity:1!important}
/* The attach action is one clear horizontal band, NOT another huge dashed container. */
.uel-page .uel-bulk-upload-stage .uel-bulk-upload-line{
  display:grid!important;grid-template-columns:52px minmax(0,1fr) auto!important;
  gap:17px!important;align-items:center!important;
  background:transparent!important;border:0!important;border-top:1px solid #D4DAD0!important;
  border-bottom:1px solid #D4DAD0!important;border-radius:0!important;
  padding:24px 0!important;margin:20px 0 0!important;
}
.uel-bulk-upload-line-icon{display:grid!important;place-items:center!important;width:52px!important;height:52px!important;border-radius:12px!important;background:#D7DDCF!important;color:#173F35!important}
.uel-bulk-upload-line-copy{min-width:0!important}
.uel-bulk-upload-line-copy>strong{display:block!important;font-size:18px!important;font-weight:800!important;color:#173F35!important;line-height:1.3!important}
.uel-bulk-upload-line-copy p{font-size:14px!important;line-height:1.52!important;margin:5px 0 5px!important;color:#59645C!important}
.uel-bulk-upload-line-copy small{font-size:12px!important;color:#68726B!important;line-height:1.4!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-file-action{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;
  position:relative!important;overflow:hidden!important;min-width:157px!important;min-height:49px!important;
  padding:12px 17px!important;border:1px solid #C56C42!important;border-radius:9px!important;
  background:#C56C42!important;color:#F7F6F2!important;font-size:15px!important;font-weight:800!important;
  cursor:pointer!important;box-shadow:none!important;white-space:nowrap!important;
}
.uel-page .uel-bulk-upload-stage .uel-bulk-file-action:hover{background:#AD5833!important;border-color:#AD5833!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-file-action:focus-within{outline:3px solid #173F35!important;outline-offset:3px!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-file-action:has(input:disabled){opacity:.5!important;cursor:not-allowed!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-file-action input[type=file]{
  position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;
  opacity:0!important;cursor:pointer!important;font-size:0!important;margin:0!important;padding:0!important;
}
.uel-page .uel-bulk-upload-stage .uel-bulk-upload-prompt{font-size:13px!important;margin:12px 0 0!important;color:#66716A!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-selected{margin:13px 0 0!important;padding:12px 14px!important;display:flex!important;gap:8px!important;align-items:center!important;border-left:3px solid #173F35!important;background:#EDF2EB!important;color:#173F35!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-note{margin:15px 0 0!important;padding:0!important;font-size:13px!important;line-height:1.55!important;color:#59645C!important}
.uel-page .uel-bulk-upload-stage .uel-bulk-note strong{color:#173F35!important}
@media(max-width:850px){
 .uel-page .uel-bulk-upload-stage .uel-bulk-methods{grid-template-columns:1fr!important;gap:10px!important}
 .uel-page .uel-bulk-upload-stage .uel-bulk-upload-line{grid-template-columns:42px minmax(0,1fr)!important;gap:12px!important}
 .uel-bulk-upload-line-icon{width:42px!important;height:42px!important}
 .uel-page .uel-bulk-upload-stage .uel-bulk-file-action{grid-column:1/-1!important;width:100%!important;margin-top:2px!important}
}
@media(max-width:420px){
 .uel-page .uel-bulk-upload-stage .uel-bulk-method{grid-template-columns:40px minmax(0,1fr) 22px!important;padding:14px!important;min-height:85px!important;gap:10px!important}
 .uel-page .uel-bulk-upload-stage .uel-bulk-method-icon{width:40px!important;height:40px!important}
 .uel-page .uel-bulk-upload-stage .uel-bulk-choice-body strong{font-size:15px!important}
 .uel-page .uel-bulk-upload-stage .uel-bulk-choice-body small{font-size:12px!important}
}

/* EPANTRY BULK UX V10: compact copy, progressive batches and scroll target.
   Palette: #C56C42 / #F7F6F2 / #173F35 / #202421 / #D7DDCF */
.uel-page .uel-bulk-banner h2{max-width:15ch!important}
.uel-page .uel-bulk-list-preview{max-height:410px!important;overflow-y:auto!important;overscroll-behavior:contain!important}
.uel-page .uel-bulk-aside{display:block!important;padding:12px 0!important;border:0!important}
.uel-page .uel-bulk-banner>div:first-child p{max-width:38ch!important}
.uel-page .uel-compact-limits{padding:17px 19px!important;border-top:3px solid #C56C42!important;background:#F2F2ED!important;border-radius:10px!important}
.uel-page .uel-compact-limits h3{margin:0 0 12px!important}
.uel-page .uel-compact-limits p{margin:6px 0!important;font-size:14px!important;line-height:1.5!important}
.uel-page .uel-compact-folder-guide{margin-top:17px!important;padding:0!important;background:transparent!important;border:1px solid #D7DDCF!important;border-radius:12px!important;overflow:hidden!important}
.uel-page .uel-compact-folder-guide .uel-compact-guide-trigger{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:15px!important;padding:17px 21px!important;cursor:pointer!important;list-style:none!important;color:#173F35!important;background:#EEF0E7!important}
.uel-page .uel-compact-guide-trigger::-webkit-details-marker{display:none!important}
.uel-page .uel-compact-guide-trigger>span{display:flex!important;align-items:center!important;gap:10px!important;font-size:16px!important;font-weight:800!important}
.uel-page .uel-compact-guide-trigger small{font-size:13px!important;font-weight:500!important;color:#55645A!important}
.uel-page .uel-compact-guide-trigger>span:last-child{color:#C56C42!important;font-size:13px!important;white-space:nowrap!important}
.uel-page .uel-compact-folder-guide[open] .uel-compact-guide-trigger>span:last-child svg{transform:rotate(180deg)}
.uel-page .uel-compact-guide-body{padding:19px 20px 20px!important}
.uel-page .uel-compact-guide-body .uel-bulk-folder-grid{margin:0!important}
.uel-page .uel-compact-guide-key{font-size:14px!important;margin:12px 0 0!important;padding-top:12px!important;border-top:1px solid #D7DDCF!important}
.uel-page .uel-compact-guide-key code{font-size:13px!important;background:#D7DDCF!important;border-radius:4px!important;padding:2px 5px!important}
.uel-page #epantry-submit-imported-batches{scroll-margin-top:115px!important;outline:0!important;border-top:3px solid #C56C42!important;margin:30px 0 0!important;padding:24px 0 6px!important}
.uel-page .uel-imported-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.uel-page .uel-imported-step{font-size:12px!important;font-weight:850!important;letter-spacing:.1em!important;color:#C56C42!important}
.uel-page .uel-imported-head h3{font-size:clamp(25px,2.8vw,37px)!important;letter-spacing:-.04em!important;line-height:1.1!important;color:#173F35!important;margin:8px 0!important;font-weight:850!important}
.uel-page .uel-imported-head p{font-size:15px!important;color:#59645C!important;margin:0!important}
.uel-page .uel-imported-refresh{min-height:42px!important;display:inline-flex!important;align-items:center!important;gap:8px!important;border:1px solid #BCC8B9!important;background:#F7F6F2!important;color:#173F35!important;border-radius:8px!important;padding:8px 14px!important;font-size:14px!important;font-weight:800!important}
.uel-page .uel-imported-refresh:hover:not(:disabled){background:#D7DDCF!important}
.uel-page .uel-imported-stats{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;margin:20px 0 14px!important;background:#D7DDCF!important;border:1px solid #D2D9CB!important;border-radius:11px!important;overflow:hidden!important}
.uel-page .uel-imported-stats>div{padding:15px 18px!important;display:flex!important;flex-direction:column!important;gap:2px!important;border-right:1px solid #BFCDBA!important;min-width:0!important}
.uel-page .uel-imported-stats>div:last-child{border-right:0!important}
.uel-page .uel-imported-stats strong{font-size:29px!important;line-height:1.1!important;color:#173F35!important;font-variant-numeric:tabular-nums!important}
.uel-page .uel-imported-stats span{font-size:13px!important;color:#435747!important;font-weight:750!important}
.uel-page .uel-imported-range{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 2px;font-size:13px!important;font-weight:750!important;color:#687367!important}
.uel-page .uel-imported-batch-list{border-top:1px solid #D7DDCF!important;border-bottom:1px solid #D7DDCF!important}
.uel-page .uel-imported-batch-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:20px!important;align-items:center!important;padding:16px 6px!important;border-bottom:1px solid #D7DDCF!important;background:transparent!important}
.uel-page .uel-imported-batch-row:last-child{border-bottom:0!important}
.uel-page .uel-imported-batch-row:hover{background:#F1F0E9!important}
.uel-page .uel-imported-batch-main{min-width:0!important}
.uel-page .uel-imported-batch-title{display:flex!important;align-items:center!important;gap:11px!important;flex-wrap:wrap!important}
.uel-page .uel-imported-batch-title strong{color:#202421!important;font-size:16px!important;font-weight:850!important}
.uel-page .uel-imported-pill{border-radius:999px!important;padding:4px 9px!important;font-size:12px!important;font-weight:800!important}
.uel-page .uel-imported-pill.is-ready{background:#F7E8DE!important;color:#9B4D27!important}
.uel-page .uel-imported-pill.is-pending{background:#D7DDCF!important;color:#173F35!important}
.uel-page .uel-imported-pill.is-done{background:#E4EBE0!important;color:#173F35!important}
.uel-page .uel-imported-batch-names{font-size:14px!important;line-height:1.45!important;color:#56635A!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;max-width:100%!important;margin:5px 0 0!important}
.uel-page .uel-imported-batch-main small{display:block!important;color:#6B796E!important;margin-top:5px!important;font-size:12px!important}
.uel-page .uel-imported-send{min-height:44px!important;display:inline-flex!important;gap:8px!important;align-items:center!important;justify-content:center!important;padding:9px 15px!important;border:1px solid #C56C42!important;border-radius:9px!important;background:#C56C42!important;color:#F7F6F2!important;font-size:14px!important;font-weight:850!important;white-space:nowrap!important}
.uel-page .uel-imported-send:hover:not(:disabled){background:#AD5935!important}
.uel-page .uel-imported-send:disabled{background:#D7DDCF!important;border-color:#D7DDCF!important;color:#56645A!important;cursor:not-allowed!important}
.uel-page .uel-imported-pagination{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important;margin:16px 0 8px!important}
.uel-page .uel-imported-pagination>span{font-size:13px!important;font-weight:750!important;color:#56645A!important}
.uel-page .uel-imported-pagination button{min-height:42px!important;border-radius:8px!important;border:1px solid #C5CFC1!important;padding:9px 16px!important;font-size:14px!important;font-weight:850!important;color:#173F35!important;background:#F7F6F2!important}
.uel-page .uel-imported-pagination .uel-imported-page-next{display:flex!important;align-items:center!important;gap:7px!important;border-color:#173F35!important;background:#173F35!important;color:#F7F6F2!important}
.uel-page .uel-imported-pagination .uel-imported-page-next:hover{background:#2A5948!important}
.uel-page .uel-imported-pagination button:disabled{opacity:.45!important;cursor:not-allowed!important}
.uel-page .uel-imported-empty{border-top:1px solid #D7DDCF!important;padding:20px 0!important;margin-top:16px!important;color:#5B6B5E!important;font-size:15px!important}
@media(max-width:767px){
 .uel-page .uel-imported-head h3{font-size:26px!important}
 .uel-page .uel-imported-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
 .uel-page .uel-imported-stats>div:nth-child(2){border-right:0!important}
 .uel-page .uel-imported-stats>div:nth-child(-n+2){border-bottom:1px solid #BFCDBA!important}
 .uel-page .uel-imported-batch-row{grid-template-columns:1fr!important;gap:11px!important}
 .uel-page .uel-imported-send{width:100%!important}
 .uel-page .uel-imported-pagination{display:grid!important;grid-template-columns:1fr auto!important}
 .uel-page .uel-imported-pagination .uel-imported-page-next{grid-column:1/-1!important;justify-content:center!important;width:100%!important}
 .uel-page .uel-compact-guide-trigger{padding:14px 12px!important}
 .uel-page .uel-compact-guide-trigger small{display:none!important}
 .uel-page .uel-compact-guide-body{padding:12px!important}
}

/* EPANTRY BULK UX V11: progressive listing rows and clear post-save actions.
   Clay / Forest / Porcelain / Soft Sage / Charcoal only. */
.uel-page .uel-imported-success{display:flex;align-items:center;gap:12px;padding:15px 18px;margin-top:18px;background:#E9EEE5;border-left:4px solid #173F35;color:#173F35;border-radius:6px;font-size:15px;line-height:1.45}
.uel-page .uel-imported-success svg{flex:none;color:#173F35}
.uel-page .uel-imported-history-link{display:inline-flex;align-items:center;gap:5px;text-decoration:underline;text-underline-offset:3px;color:#173F35;font-size:13px;font-weight:800}
.uel-page .uel-imported-pagination{display:flex!important;justify-content:center!important;gap:12px!important;margin-top:21px!important}
.uel-page .uel-imported-pagination .uel-imported-page-next{display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;min-width:220px!important;background:#C56C42!important;color:#F7F6F2!important;border:1px solid #C56C42!important;padding:12px 20px!important;border-radius:8px!important;font-weight:850!important}
.uel-page .uel-imported-pagination .uel-imported-page-next:hover{background:#A85634!important}
.uel-page #uel-history-title{scroll-margin-top:110px!important}
.uel-page .uel-history{scroll-margin-top:115px!important;padding-top:30px!important}
.uel-page .uel-history-view-more{display:inline-flex;align-items:center;gap:9px;justify-content:center;min-height:44px;padding:10px 18px;border:1px solid #C56C42;border-radius:8px;background:#F7F6F2;color:#A45433;font-size:14px;font-weight:850;cursor:pointer;margin:15px 0 0}
.uel-page .uel-history-view-more:hover{background:#F3E5DC}
.uel-page .uel-history-progress{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:12px 2px 18px;color:#5F685F;font-size:13px;font-weight:700}
.uel-page .uel-history-progress .uel-history-view-more{margin:0;background:#173F35;border-color:#173F35;color:#F7F6F2}
.uel-page .uel-history-progress .uel-history-view-more:hover{background:#285548}
.uel-page .uel-history .uel-packet-list{border-top:1px solid #D7DDCF!important}
.uel-page .uel-history .uel-packet-row{background:transparent!important;border-bottom:1px solid #D7DDCF!important;box-shadow:none!important;padding-top:14px!important;padding-bottom:14px!important}
.uel-page .uel-history .uel-packet-row:hover{background:#F2F1EC!important}
.uel-page .uel-history .uel-history-filters{border-bottom:1px solid #D7DDCF!important}
@media(max-width:767px){
 .uel-page .uel-imported-pagination .uel-imported-page-next{width:100%!important;min-width:0!important}
 .uel-page .uel-history-progress{align-items:stretch;flex-direction:column}
 .uel-page .uel-history-progress .uel-history-view-more{width:100%}
 .uel-page .uel-imported-success{padding:12px!important;font-size:14px!important}
}

`;

const styles = {
  field:
    "uel-input min-w-0 w-full rounded-lg border border-[#CBD4C8] bg-white px-3 py-2.5 text-[15px] text-[#202421] focus:outline-2 focus:outline-offset-1 focus:outline-[#173F35]",
  label: "uel-label block text-sm font-semibold text-[#202421]",
  section: "uel-section border-t border-[#D7DDCF] py-6 sm:py-8",
  button:
    "uel-action rounded-lg bg-[#173F35] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "uel-secondary rounded-lg border border-[#BAC7B8] px-4 py-2.5 text-sm font-semibold text-[#173F35] disabled:opacity-50",
};
const fields = [
  "energyKcal",
  "proteinG",
  "carbohydrateG",
  "fatG",
  "fiberG",
  "sugarG",
  "sodiumMg",
];
const allergenNames = [
  "milk",
  "egg",
  "peanut",
  "tree_nut",
  "soy",
  "wheat",
  "sesame",
  "fish",
  "shellfish",
];
const units = ["g", "kg", "ml", "l", "piece", "tsp", "tbsp", "cup"];
// These are optional packaging/label photo categories, not additional required uploads.
const groceryPhotoRoles = [
  ["front_of_pack", "Front of pack"],
  ["ingredients_panel", "Ingredients panel"],
  ["allergen_statement", "Allergen statement"],
  ["nutrition_panel", "Nutrition panel"],
  ["barcode", "Barcode"],
  ["back_manufacturer_panel", "Back / manufacturer panel"],
  ["certification_mark", "Certification mark"],
];
const groceryPhotoRoleLabels = Object.fromEntries(groceryPhotoRoles);

// The backend keeps category='grocery' for grocery catalog compatibility.
// Its finer customer-facing product category is saved separately as grocerySubcategory.
const categoryOptions = [
  ["grocery", "Grocery"],
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snacks", "Snacks"],
  ["drinks", "Drinks"],
  ["sweets", "Sweets"],
  ["desserts", "Desserts"],
  ["bakery", "Bakery"],
  ["main_course", "Main course"],
  ["side_dish", "Side dish"],
  ["other", "Other food"],
];
const groceryCategories = [
  ["", "Choose a grocery category"],
  ["vegetables", "Vegetables & greens"],
  ["fruits", "Fruits"],
  ["dairy", "Milk, dairy & cheese"],
  ["eggs", "Eggs"],
  ["meat_poultry", "Meat & poultry"],
  ["seafood", "Fish & seafood"],
  ["grains_rice", "Grains, rice & cereals"],
  ["pulses_legumes", "Pulses, beans & lentils"],
  ["spices_condiments", "Spices, sauces & condiments"],
  ["oils_ghee", "Cooking oil & ghee"],
  ["canned_jarred", "Canned & jarred food"],
  ["packaged_snacks", "Packaged snacks"],
  ["packaged_food", "Other packaged food"],
  ["frozen_food", "Frozen food"],
  ["beverages", "Beverages"],
  ["bakery_bread", "Bread & bakery"],
  ["other_grocery", "Other groceries"],
];
const packagingOptions = [
  ["", "Choose packaging"],
  ["loose", "Loose / unpackaged"],
  ["packet", "Packet / pouch"],
  ["can", "Can / tin"],
  ["jar", "Jar"],
  ["bottle", "Bottle"],
  ["box", "Box / carton"],
  ["tray", "Tray"],
  ["other", "Other"],
];
const recipeCategories = [
  ["brunch", "Brunch"],
  ...categoryOptions.filter(([value]) => value !== "grocery"),
];
const dietaryOptions = [
  ["not_declared", "Not declared"],
  ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"],
  ["non_vegetarian", "Non-vegetarian"],
  ["other", "Other / mixed"],
];
const types = [
  {
    value: "grocery",
    label: "Grocery / packaged food",
    allowed: ["b2b", "brand_seller", "hybrid", "legacy"],
  },
  {
    value: "brand_recipe",
    label: "Brand recipe",
    allowed: ["brand_seller", "hybrid", "legacy"],
  },
  {
    value: "kitchen_recipe",
    label: "Kitchen recipe / drinks / sweets",
    allowed: ["b2b", "chef_restaurant", "hybrid", "legacy"],
  },
  {
    value: "prepared_food",
    label: "Ready-made food / menu item",
    allowed: ["b2b", "chef_restaurant", "hybrid", "legacy"],
  },
];
// Each template maps to one existing permitted Host listing type; special food
// categories reuse kitchen_recipe rather than creating parallel databases.
const bulkTemplates = [
  { key: "grocery", label: "Grocery / packaged food", type: "grocery" },
  { key: "brand_recipe", label: "Brand recipe", type: "brand_recipe" },
  { key: "kitchen_recipe", label: "Kitchen recipe", type: "kitchen_recipe" },
  {
    key: "prepared_food",
    label: "Ready-made food / menu",
    type: "prepared_food",
  },
  { key: "drinks", label: "Drinks & beverages", type: "kitchen_recipe" },
  { key: "sweets", label: "Sweets", type: "kitchen_recipe" },
  { key: "desserts", label: "Desserts", type: "kitchen_recipe" },
  { key: "bakery", label: "Bakery", type: "kitchen_recipe" },
];
const historyFilters = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["submitted_for_review", "In review"],
  ["approved", "Approved"],
  ["needs_attention", "Needs attention"],
];
function listingStatusLabel(status) {
  return (
    {
      draft: "Draft",
      submitted_for_review: "In review",
      approved: "Approved",
      rejected: "Not approved",
      changes_requested: "Changes requested",
    }[status] || String(status || "Unknown").replaceAll("_", " ")
  );
}
function listingUpdatedDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
}
const emptyIngredient = () => ({
  name: "",
  canonicalIngredientId: "",
  imageUrl: "",
  quantity: 1,
  unit: "g",
  unitPrice: "",
  priceQuantity: 1,
  priceUnit: "g",
  role: "main",
  preparationState: "",
  scalingRule: "proportional",
  note: "",
});
const emptyStep = () => ({ instruction: "", timerMinutes: "", imageUrl: "" });
// Keep the optional Host barcode field aligned with the backend's GTIN checksum check.
// An absent barcode is allowed; a supplied GTIN must identify an actual label code.
function isValidHostBarcode(value) {
  const digits = String(value ?? "").trim();
  if (!/^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/.test(digits))
    return false;
  let sum = 0;
  for (
    let index = digits.length - 2, multiplier = 3;
    index >= 0;
    index -= 1, multiplier = multiplier === 3 ? 1 : 3
  ) {
    sum += Number(digits[index]) * multiplier;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}
function newPacket(type = "grocery") {
  return {
    type,
    title: "",
    description: "",
    category: type === "grocery" ? "grocery" : "other",
    grocerySubcategory: "",
    packagingType: "",
    images: [],
    imageRoles: [],
    videoUrl: "",
    videoFileName: "",
    brandName: "",
    sku: "",
    countryOfOrigin: "",
    regionOfOrigin: "",
    localRecipeName: "",
    localRecipeLanguage: "",
    englishNameReading: "",
    productFamily: "",
    manufacturerPacker: "",
    unitsPerPack: "",
    servingSize: "",
    catalogProductVersionId: "",
    labelDeclaration: { ingredients: "", allergens: "", claims: "" },
    cuisine: "",
    preparationMinutes: "",
    cookingMinutes: "",
    baseServings: 4,
    difficulty: "not_declared",
    ingredients: [emptyIngredient()],
    steps: [emptyStep()],
    nutrition: { basis: "Per serving", evidenceNote: "" },
    allergens: [],
    dietary: "not_declared",
    shareRecipe: type === "brand_recipe" || type === "kitchen_recipe",
    sellReadyMade: type === "prepared_food",
    selling: {
      listPrice: "",
      salePrice: "",
      stockQuantity: "",
      stockUnit: "piece",
      packQuantity: "",
      packUnit: "piece",
      minimumOrderQuantity: 1,
      maximumOrderQuantity: "",
      barcode: "",
      packagingCost: "",
      labourCost: "",
      outletId: "",
      menuId: "",
    },
    delivery: {
      fulfillment: "delivery",
      postalCodes: [],
      preparationMinutes: "",
      note: "",
    },
    sourceNotes: "",
  };
}
function formatMoney(value) {
  return value === null || value === undefined
    ? "Not available"
    : `Rs ${Number(value).toFixed(2)}`;
}
function estimateCost(ingredient) {
  const mass = { g: 1, kg: 1000 };
  const volume = { ml: 1, l: 1000 };
  const group =
    mass[ingredient.unit] && mass[ingredient.priceUnit]
      ? mass
      : volume[ingredient.unit] && volume[ingredient.priceUnit]
      ? volume
      : null;
  const converted = group
    ? (Number(ingredient.quantity) * group[ingredient.unit]) /
      group[ingredient.priceUnit]
    : ingredient.unit === ingredient.priceUnit
    ? Number(ingredient.quantity)
    : NaN;
  if (
    ingredient.unitPrice === "" ||
    ingredient.unitPrice == null ||
    ingredient.priceQuantity === "" ||
    ingredient.priceQuantity == null ||
    !Number(ingredient.priceQuantity) ||
    !Number.isFinite(converted) ||
    Number(ingredient.unitPrice) < 0
  )
    return null;
  return (
    Math.round(
      (converted / Number(ingredient.priceQuantity)) *
        Number(ingredient.unitPrice) *
        100
    ) / 100
  );
}
function EditorField({ title, children }) {
  return (
    <label className="block min-w-0">
      <span className={`${styles.label} mb-1.5`}>{title}</span>
      {children}
    </label>
  );
}
function IngredientNameInput({ ingredient, onChange, className }) {
  const [matches, setMatches] = useState([]);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    const query = String(ingredient.name || "").trim();
    if (query.length < 2 || ingredient.canonicalIngredientId) {
      setMatches([]);
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const result = await searchHostListingIngredients({
          search: query,
          limit: 6,
        });
        if (alive) {
          setMatches(result?.ingredients || []);
          setSearchError("");
        }
      } catch {
        if (alive) {
          setMatches([]);
          setSearchError(
            "Catalog search is unavailable; enter the name manually for review."
          );
        }
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ingredient.name, ingredient.canonicalIngredientId]);
  return (
    <div className="relative">
      <input
        aria-label="Ingredient name"
        className={className}
        value={ingredient.name || ""}
        onChange={(event) =>
          onChange({ name: event.target.value, canonicalIngredientId: "" })
        }
        placeholder="Search an EPANTRY ingredient"
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#CBD4C8] bg-white shadow-lg">
          {matches.map((match) => (
            <button
              type="button"
              key={match.id}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#EDF1E9]"
              onClick={() => {
                onChange({
                  name: match.canonicalName,
                  canonicalIngredientId: match.id,
                  imageUrl:
                    ingredient.canonicalIngredientId &&
                    ingredient.canonicalIngredientId !== match.id
                      ? match.imageUrl || ""
                      : ingredient.imageUrl || match.imageUrl || "",
                });
                setMatches([]);
              }}
            >
              {match.imageUrl ? (
                <img
                  src={match.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="h-10 w-10 shrink-0 rounded-md bg-[#E8EEE6]"
                  aria-hidden="true"
                />
              )}
              <span>
                <span className="block font-semibold">
                  {match.canonicalName}
                </span>
                {match.imageUrl && (
                  <span className="block text-xs text-[#557366]">
                    EPANTRY photo available · no upload needed
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      {ingredient.canonicalIngredientId && (
        <p className="mt-1 text-xs text-[#173F35]">
          Matched with EPANTRY ingredient
        </p>
      )}
      {searchError && (
        <p className="mt-1 text-xs text-[#9A4F31]">{searchError}</p>
      )}
    </div>
  );
}

// Existing images are referenced by URL, never re-uploaded or copied.
// A Host can always replace or remove the suggested image.
function IngredientPhotoPicker({
  ingredient,
  index,
  uploadImage,
  uploading,
  onChange,
}) {
  const [suggestion, setSuggestion] = useState(null);
  useEffect(() => {
    const name = String(ingredient.name || "").trim();
    if (name.length < 2) {
      setSuggestion(null);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const found = await searchHostListingIngredients({
          search: name,
          limit: 12,
        });
        const match = (found?.ingredients || []).find(
          (entry) =>
            (ingredient.canonicalIngredientId &&
              String(entry.id) === String(ingredient.canonicalIngredientId)) ||
            String(entry.canonicalName || "")
              .trim()
              .toLowerCase() === name.toLowerCase() ||
            (entry.aliases || []).some(
              (alias) =>
                String(alias).trim().toLowerCase() === name.toLowerCase()
            )
        );
        if (active) setSuggestion(match?.imageUrl ? match : null);
      } catch {
        if (active) setSuggestion(null);
      }
    }, 420);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ingredient.name, ingredient.canonicalIngredientId]);
  const existing = suggestion?.imageUrl || "";
  const selected = Boolean(ingredient.imageUrl);
  const usingSuggested =
    selected && Boolean(existing) && ingredient.imageUrl === existing;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {selected && (
        <div className="flex items-center gap-3 rounded-lg border border-[#CBD4C8] bg-white p-2">
          <img
            src={ingredient.imageUrl}
            alt={`${ingredient.name || "Ingredient"} photo`}
            className="h-16 w-16 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
          <span className="text-[13px] font-semibold text-[#173F35]">
            {usingSuggested
              ? "Using EPANTRY photo — no new upload"
              : "Selected ingredient photo"}
          </span>
        </div>
      )}
      {existing && !usingSuggested && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#B9CFBE] bg-[#EDF4EB] p-2">
          <img
            src={existing}
            alt={`${
              ingredient.name || "Ingredient"
            } photo available in EPANTRY`}
            className="h-16 w-16 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#173F35]">
              EPANTRY photo available
            </p>
            <p className="text-[12px] text-[#557366]">
              Use this photo without uploading it again.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-[#56806B] bg-white px-3 py-2 text-[13px] font-semibold text-[#173F35]"
            onClick={() =>
              onChange({
                imageUrl: existing,
                canonicalIngredientId: suggestion.id,
              })
            }
          >
            Use existing photo
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-lg border border-[#A3B5A4] bg-white px-4 py-2 text-[14px] font-semibold text-[#173F35]">
          <ImagePlus size={17} />{" "}
          {selected ? "Upload my own photo" : "Upload photo"}
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={Boolean(uploading)}
            onChange={(event) => {
              uploadImage(event.target.files?.[0], "ingredients", index);
              event.target.value = "";
            }}
          />
        </label>
        {selected && (
          <button
            type="button"
            onClick={() => onChange({ imageUrl: "" })}
            className="min-h-[46px] rounded-lg border border-[#D2B6A5] bg-[#FAF0E9] px-3 py-2 text-[13px] font-semibold text-[#7C4933]"
          >
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}

// This editor uses the existing Marketplace permission and readiness checks.
// An approved Host packet is NOT itself an active offer or a published Pack.
function HostListingSalesSetup({ listingId, readiness, listing, onUpdated }) {
  const [nodes, setNodes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [nodeId, setNodeId] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [postalCodes, setPostalCodes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentOfferId, setCurrentOfferId] = useState("");
  const [offerState, setOfferState] = useState("");
  const [checks, setChecks] = useState(null);
  const [buyerCheck, setBuyerCheck] = useState(null);
  const approvedListing = readiness?.approvedSelling || listing;
  const approved = Boolean(
    readiness?.approved && readiness?.catalogLinked && readiness?.packId
  );
  const packId = readiness?.packId || "";
  const enabled = approved && Boolean(listingId);
  const activeOfferId = currentOfferId || readiness?.offerId || "";
  const fail = (cause) =>
    cause?.response?.data?.message ||
    cause?.message ||
    "Could not update selling details.";

  useEffect(() => {
    setPrice(approvedListing?.selling?.listPrice ?? "");
    setSalePrice(approvedListing?.selling?.salePrice ?? "");
    setQuantity(approvedListing?.selling?.stockQuantity ?? "");
    setPostalCodes((approvedListing?.delivery?.postalCodes || []).join(", "));
    setCurrentOfferId("");
    setOfferState("");
    setChecks(null);
    setBuyerCheck(null);
    setNotice("");
    setError("");
  }, [listingId]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    Promise.all([
      listInventoryNodes({ status: "active", limit: 100 }),
      listServiceAreas({ status: "active", limit: 100 }),
    ])
      .then(([inventory, coverage]) => {
        if (!live) return;
        const nodeRows = inventory?.inventoryNodes || [];
        setNodes(nodeRows);
        setAreas(coverage?.serviceAreas || []);
        setNodeId(
          (current) =>
            current ||
            (nodeRows.length === 1 ? String(nodeRows[0].id || "") : "")
        );
      })
      .catch((cause) => {
        if (live) setError(fail(cause));
      });
    return () => {
      live = false;
    };
  }, [enabled, packId]);

  // Load the REAL active Marketplace price and inventory, not the price/stock
  // originally typed into the approved listing packet. Never silently replace
  // Host-entered values when a brand-new offer is being created.
  useEffect(() => {
    const existingOfferId = readiness?.offerId;
    if (!enabled || !existingOfferId) return undefined;
    let live = true;
    Promise.all([
      getHostEffectivePrice(existingOfferId),
      getHostCurrentInventory(existingOfferId),
    ])
      .then(([effective, inventory]) => {
        if (!live) return;
        const rule = effective?.priceRule;
        if (rule?.listPrice?.amountMinor != null)
          setPrice(String(rule.listPrice.amountMinor / 100));
        if (rule)
          setSalePrice(
            rule.salePrice?.amountMinor == null
              ? ""
              : String(rule.salePrice.amountMinor / 100)
          );
        const rows = inventory?.inventory || [];
        if (rows.length === 1) {
          setNodeId(String(rows[0].inventoryNodeId || ""));
          setQuantity(String(rows[0].availableQuantity ?? ""));
        }
      })
      .catch((cause) => {
        if (live) setError(fail(cause));
      });
    return () => {
      live = false;
    };
  }, [enabled, readiness?.offerId, listingId]);

  async function refreshChecks(id) {
    const result = await getHostOfferReadiness(id);
    setChecks(result?.readiness || result || null);
    return result;
  }

  // The public offer endpoint is the same verified Pack/price/stock/coverage
  // gate Customer Product Detail uses. An active draft is NOT proof of visibility.
  async function checkCustomerVisibility(offerId, pins) {
    const code = pins[0];
    if (!code) {
      setBuyerCheck({
        visible: false,
        message: "Add a service PIN to check customer availability.",
      });
      return false;
    }
    try {
      const mode =
        approvedListing?.delivery?.fulfillment === "pickup"
          ? "pickup"
          : "delivery";
      const result = await getPublicPackOffers({
        packId,
        pincode: code,
        fulfillmentType: mode,
      });
      const publicOffer = (result?.offers || []).find(
        (item) => String(item.id) === String(offerId)
      );
      const message = publicOffer
        ? `Customers in ${code} can see your verified ${mode} offer, subject to checkout checks.`
        : `Your offer is not available to customers in ${code}. Check stock, price, business status and service coverage.`;
      setBuyerCheck({ visible: Boolean(publicOffer), message });
      return Boolean(publicOffer);
    } catch {
      setBuyerCheck({
        visible: false,
        message:
          "Customer visibility could not be verified right now. Please check again.",
      });
      return false;
    }
  }

  async function saveSelling() {
    setError("");
    setNotice("");
    const list = Number(price),
      sale = salePrice === "" ? null : Number(salePrice);
    const stock = quantity.trim() === "" ? NaN : Number(quantity);
    if (
      !Number.isFinite(list) ||
      Math.round(list * 100) < 1 ||
      (sale !== null &&
        (!Number.isFinite(sale) || Math.round(sale * 100) < 1 || sale > list))
    ) {
      setError(
        "Enter a valid list price and a selling price no higher than the list price."
      );
      return;
    }
    if (
      [list, sale].some(
        (value) =>
          value !== null &&
          Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
      )
    ) {
      setError("Enter prices with no more than two decimal places.");
      return;
    }
    if (!Number.isSafeInteger(stock) || stock < 0) {
      setError("Enter available stock as a whole number.");
      return;
    }
    if (!nodeId && !newNodeName.trim()) {
      setError("Select your stock location or enter a new one.");
      return;
    }
    const codes = [
      ...new Set(
        postalCodes
          .split(/[\s,;]+/)
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];
    if (
      !codes.length ||
      codes.some((value) => !/^[1-9][0-9]{5}$/.test(value))
    ) {
      setError("Enter the six-digit pincodes covered by this offer.");
      return;
    }
    setBusy(true);
    try {
      let offerId = activeOfferId;
      // Create is always draft. Marketplace enforces unique Pack and Host ownership.
      if (!offerId) {
        const created = await createHostOffer({
          packId,
          fulfillmentTypes: [
            approvedListing?.delivery?.fulfillment === "pickup"
              ? "pickup"
              : "delivery",
          ],
          minimumOrderQuantity: Math.max(
            1,
            Number(approvedListing?.selling?.minimumOrderQuantity) || 1
          ),
          maximumOrderQuantity: approvedListing?.selling?.maximumOrderQuantity
            ? Number(approvedListing.selling.maximumOrderQuantity)
            : null,
        });
        offerId = String(created?.offer?.id || created?.offer?._id || "");
        if (!offerId)
          throw new Error(
            "The offer was created, but the offer ID could not be read. Refresh before trying again."
          );
        setCurrentOfferId(offerId);
      }
      // Reconcile this approved listing's fulfillment method with its offer.
      // Existing Marketplace ownership and canonical Pack checks are enforced.
      if (activeOfferId) {
        await updateHostOffer(offerId, {
          fulfillmentTypes: [
            approvedListing?.delivery?.fulfillment === "pickup"
              ? "pickup"
              : "delivery",
          ],
        });
      }
      let selectedNodeId = nodeId;
      if (!selectedNodeId) {
        const newNode = await createInventoryNode({
          name: newNodeName.trim(),
          nodeType: "warehouse",
        });
        selectedNodeId = String(
          newNode?.inventoryNode?.id || newNode?.inventoryNode?._id || ""
        );
        if (!selectedNodeId)
          throw new Error(
            "Stock location could not be confirmed. Refresh your stock locations."
          );
        setNodeId(selectedNodeId);
        setNodes((previous) => [
          ...previous,
          { id: selectedNodeId, name: newNodeName.trim(), status: "active" },
        ]);
      }
      // Never reset reserved inventory to zero when updating existing stock.
      // Marketplace snapshots represent total on-hand units and outstanding
      // reservations. Preserve the last reservation quantity at this location.
      const inventory = await getHostCurrentInventory(offerId);
      const previous = (inventory?.inventory || []).find(
        (row) => String(row.inventoryNodeId) === String(selectedNodeId)
      );
      const reservedQuantity = Number(previous?.reservedQuantity || 0);
      if (
        !Number.isSafeInteger(reservedQuantity) ||
        reservedQuantity < 0 ||
        stock < reservedQuantity
      ) {
        throw new Error(
          `On-hand stock cannot be lower than ${reservedQuantity} reserved units. Update your reservations before reducing stock.`
        );
      }
      const listMinor = Math.round(list * 100);
      const saleMinor = sale === null ? null : Math.round(sale * 100);
      await createHostPriceRule(offerId, {
        listPrice: { amountMinor: listMinor, currency: "INR" },
        salePrice:
          saleMinor === null
            ? null
            : { amountMinor: saleMinor, currency: "INR" },
        effectiveFrom: new Date().toISOString(),
        effectiveTo: null,
        source: "manual",
        changeReason: "Host updated the listing selling price",
      });
      await createInventorySnapshots([
        {
          offerId,
          inventoryNodeId: selectedNodeId,
          availableQuantity: stock,
          reservedQuantity,
          sourceType: "manual",
          sourceReference: `listing:${listingId}`,
        },
      ]);
      {
        const fulfillmentType =
          approvedListing?.delivery?.fulfillment === "pickup"
            ? "pickup"
            : "delivery";
        const coverage = areas.find(
          (area) =>
            area.status === "active" &&
            (!area.inventoryNodeId ||
              String(area.inventoryNodeId) === selectedNodeId) &&
            codes.every((code) => (area.postalCodes || []).includes(code)) &&
            (area.fulfillmentTypes || []).includes(fulfillmentType)
        );
        if (!coverage) {
          // Never edit another item's delivery areas or silently widen their coverage.
          const result = await createServiceArea({
            name: `Service for ${listingId.slice(-8)} (${selectedNodeId.slice(
              -6
            )})`,
            inventoryNodeId: selectedNodeId,
            postalCodes: codes,
            fulfillmentTypes: [fulfillmentType],
          });
          if (result?.serviceArea)
            setAreas((previous) => [...previous, result.serviceArea]);
        }
      }
      const latest = await refreshChecks(offerId);
      const isActive =
        offerState === "active" || readiness?.offerStatus === "active";
      if (isActive) await checkCustomerVisibility(offerId, codes);
      else setBuyerCheck(null);
      setNotice(
        isActive
          ? "Selling details saved. Customer availability is checked separately."
          : "Selling details saved. Activate your offer when ready."
      );
      setOfferState(isActive ? "active" : "draft");
      onUpdated?.();
    } catch (cause) {
      setError(
        `${fail(
          cause
        )} Any earlier saved changes remain in your Marketplace record. Check the status before retrying.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function activateSelling() {
    if (!activeOfferId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await activateHostOffer(activeOfferId);
      setOfferState("active");
      await refreshChecks(activeOfferId);
      const codes = [
        ...new Set(
          postalCodes
            .split(/[\s,;]+/)
            .map((value) => value.trim())
            .filter(Boolean)
        ),
      ];
      await checkCustomerVisibility(activeOfferId, codes);
      setNotice(
        "Your offer is active. Customer availability depends on verified stock, price and service coverage."
      );
      onUpdated?.();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!listingId || !readiness?.approved) return null;
  return (
    <section
      className="mb-4 border border-[#CAD8CC] bg-[#F3F5F0] p-4"
      aria-label="Sell this listing"
    >
      <h3 className="text-lg font-semibold text-[#173F35]">
        Price, stock & selling
      </h3>
      {!enabled ? (
        <p className="mt-1 text-sm">
          {readiness?.message ||
            "A published catalog match is required before this item can be sold."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm">
            Manage this product here. Only an active, approved offer can be
            purchased.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <EditorField title="List price (₹)">
              <input
                className={styles.field}
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </EditorField>
            <EditorField title="Selling price (₹, optional)">
              <input
                className={styles.field}
                type="number"
                min="0.01"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </EditorField>
            <EditorField title="Available stock (units)">
              <input
                className={styles.field}
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </EditorField>
            <EditorField title="Stock location">
              <select
                className={styles.field}
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
              >
                <option value="">Add a stock location</option>
                {nodes
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </EditorField>
            {!nodeId && (
              <EditorField title="New stock location name">
                <input
                  className={styles.field}
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="Your store or kitchen"
                />
              </EditorField>
            )}
            <EditorField title="Service pincodes">
              <input
                className={styles.field}
                value={postalCodes}
                onChange={(e) => setPostalCodes(e.target.value)}
                placeholder="110001, 110002"
              />
            </EditorField>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-3 text-sm text-[#173F35]">
              {notice}
            </p>
          )}
          {checks && (
            <p className="mt-3 text-sm">
              {checks?.ready
                ? "Ready to activate."
                : "Some selling checks still need attention."}
            </p>
          )}
          {buyerCheck && (
            <p role="status" className="mt-3 text-sm">
              {buyerCheck.message}
            </p>
          )}
          {activeOfferId &&
            (offerState === "active" ||
              readiness?.offerStatus === "active") && (
              <button
                type="button"
                className={`${styles.secondary} mt-3`}
                disabled={busy}
                onClick={() =>
                  checkCustomerVisibility(activeOfferId, [
                    ...new Set(postalCodes.split(/[\s,;]+/).filter(Boolean)),
                  ])
                }
              >
                Check customer availability
              </button>
            )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={saveSelling}
            >
              {busy ? "Saving…" : "Save selling details"}
            </button>
            {activeOfferId && (
              <button
                type="button"
                className={styles.button}
                disabled={
                  busy ||
                  offerState === "active" ||
                  readiness?.offerStatus === "active"
                }
                onClick={activateSelling}
              >
                Activate selling
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// Legacy product/brand records use paginated endpoints; fetch every returned
// page rather than silently hiding listings after the first 100 records.
async function loadPreviousPages(fetchPage, field) {
  const records = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await fetchPage(page);
    const batch = Array.isArray(response?.[field]) ? response[field] : [];
    records.push(...batch);
    const pages = Number(
      response?.pagination?.pages || response?.pagination?.totalPages || 0
    );
    if (!batch.length || (pages > 0 ? page >= pages : batch.length < 100))
      break;
  }
  return { [field]: records };
}

function PreviouslyListedItems({ workspace }) {
  const [records, setRecords] = useState([]);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pageSize, setPageSize] = useState(8);
  const [pagesVisible, setPagesVisible] = useState(1);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(max-width: 767px)");
    const resize = () => { setPageSize(mq.matches ? 4 : 8); setPagesVisible(1); };
    resize();
    mq.addEventListener?.("change", resize);
    return () => mq.removeEventListener?.("change", resize);
  }, []);
  useEffect(() => {
    let active = true;
    const canProduct = ["b2b", "brand_seller", "hybrid", "legacy"].includes(
      workspace
    );
    const canKitchen = ["b2b", "chef_restaurant", "hybrid", "legacy"].includes(
      workspace
    );
    const canBrand = ["brand_seller", "hybrid", "legacy"].includes(workspace);
    const requests = [
      canProduct
        ? loadPreviousPages(
            (page) => listHostNpiDrafts({ page, limit: 100 }),
            "drafts"
          )
        : Promise.resolve({ drafts: [] }),
      listHostRecipeListingHistory(),
      canBrand
        ? loadPreviousPages(
            (page) => listHostBrandRecipeSubmissions({ page, limit: 100 }),
            "submissions"
          )
        : Promise.resolve({ submissions: [] }),
      canKitchen
        ? listHospitalityRestaurantRecipes()
        : Promise.resolve({ restaurantRecipes: [] }),
    ];
    Promise.allSettled(requests).then((results) => {
      if (!active) return;
      const rows = [];
      if (results[0]?.status === "fulfilled")
        (results[0].value?.drafts || []).forEach((record) =>
          rows.push({
            id: record.id,
            title:
              record.productName ||
              record.canonicalName ||
              record.candidateFields?.displayName?.value ||
              record.name ||
              record.barcode ||
              "Saved product",
            category: "Product",
            status: record.status || record.verificationStatus || "Saved",
            source: "product-evidence",
          })
        );
      if (results[1]?.status === "fulfilled")
        (results[1].value?.recipes || [])
          .filter((record) =>
            ["community", "host"].includes(record.sourceType || "community")
          )
          .forEach((record) =>
            rows.push({
              id: record.id,
              title: record.title || "Saved recipe",
              category: "Recipe",
              status: record.status || "Saved",
              source: "host-recipe",
            })
          );
      if (results[2]?.status === "fulfilled")
        (results[2].value?.submissions || []).forEach((record) =>
          rows.push({
            id: record.id,
            title: record.title || "Brand recipe submission",
            category: "Brand recipe",
            status: record.status || "Submitted",
            source: "brand-recipe",
          })
        );
      if (results[3]?.status === "fulfilled")
        (results[3].value?.restaurantRecipes || []).forEach((record) =>
          rows.push({
            id: record.id || record.recipeVersionId,
            title: record.title || record.name || "Restaurant recipe",
            category: "Kitchen recipe",
            status: record.status || "Saved",
            source: "restaurant-recipe",
          })
        );
      setRecords(rows.filter((row) => row.id));
      setFailed(results.some((result) => result.status === "rejected"));
      setPending(false);
    });
    return () => {
      active = false;
    };
  }, [workspace]);
  if (pending)
    return (
      <p className="mt-3 text-sm text-[#54635B]">Loading previous listings…</p>
    );
  if (!records.length && !failed) return null;
  return (
    <section
      className="mt-5 border-t border-[#CDD9C9] pt-5"
      aria-label="Previously listed items"
    >
      <h3 className="text-lg font-semibold text-[#173F35]">
        Previously listed items
      </h3>
      {failed && (
        <p className="mt-2 text-sm text-[#99622D]">
          Some older listings are temporarily unavailable. No records have been
          changed.
        </p>
      )}
      <div className="mt-3 divide-y divide-[#DFE7DC]">
        {records.slice(0, pageSize * pagesVisible).map((row) => (
          <div
            key={`${row.source}-${row.id}`}
            className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <span className="min-w-0 break-words">
              <strong className="text-[#173F35]">{row.title}</strong>{" "}
              <span className="text-[#6B766C]">· {row.category}</span>
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <span className="capitalize text-[#526353]">
                {String(row.status).replace(/_/g, " ")}
              </span>
              <Link
                to={`/host/listings/new?manage=legacy&source=${
                  row.source
                }&id=${encodeURIComponent(row.id)}`}
                className="font-semibold text-[#173F35] underline underline-offset-4"
              >
                Manage
              </Link>
            </div>
          </div>
        ))}
      </div>
      {records.length > pageSize * pagesVisible && (
        <button
          type="button"
          className="uel-history-view-more"
          onClick={() => setPagesVisible((count) => count + 1)}
        >
          View next {Math.min(pageSize, records.length - pageSize * pagesVisible)} older listings
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function HostUnifiedListingEditor() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const workspace = normalizeHostWorkspaceType(currentUser);
  // Category lists are determined by form.type; role controls authorized listing TYPES only.
  const usesHospitalityOperations =
    workspace === "hybrid" || workspace === "chef_restaurant";
  // Hybrid is intentionally limited to Grocery and Recipe for NEW packets.
  // Preserve editing of previous records while permitting all account-eligible types.
  const allowed = types.filter(
    (item) =>
      item.value !== "prepared_food" &&
      item.allowed.includes(workspace) &&
      (workspace !== "hybrid" ||
        ["grocery", "kitchen_recipe", "brand_recipe", "prepared_food"].includes(
          item.value
        ))
  );
  const visibleTemplates = bulkTemplates.filter((item) =>
    allowed.some((choice) => choice.value === item.type)
  );
  const requestedType = params.get("type");
  const initialType = allowed.some((item) => item.value === requestedType)
    ? requestedType
    : allowed[0]?.value || "grocery";
  const [form, setForm] = useState(() => newPacket(initialType));
  const [editingId, setEditingId] = useState("");
  const [revisingApproved, setRevisingApproved] = useState(false);
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkProgress, setBulkProgress] = useState("");
  const [submittingBulkBatchId, setSubmittingBulkBatchId] = useState("");
  const [bulkBatchPageIndex, setBulkBatchPageIndex] = useState(0);
  const [bulkBatchPageSize, setBulkBatchPageSize] = useState(8);
  const [historyPagesVisible, setHistoryPagesVisible] = useState(1);
  const [lastSavedBulkCount, setLastSavedBulkCount] = useState(0);
  const [completedBulkImportScrollKey, setCompletedBulkImportScrollKey] = useState(0);
  const lastAutoScrollKeyRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(max-width: 767px)");
    const updateBatchPageSize = () => {
      setBulkBatchPageSize(media.matches ? 4 : 8);
      setBulkBatchPageIndex(0);
      setHistoryPagesVisible(1);
    };
    updateBatchPageSize();
    if (media.addEventListener) media.addEventListener("change", updateBatchPageSize);
    else media.addListener(updateBatchPageSize);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", updateBatchPageSize);
      else media.removeListener(updateBatchPageSize);
    };
  }, []);
  const [bulkUploadMode, setBulkUploadMode] = useState("zip");
  const [pincodeText, setPincodeText] = useState("");
  const [savedPostalCodes, setSavedPostalCodes] = useState([]);
  const [selectedGroceryPhotoRole, setSelectedGroceryPhotoRole] =
    useState("front_of_pack");
  const [showOtherAllergen, setShowOtherAllergen] = useState(false);
  const [otherAllergenName, setOtherAllergenName] = useState("");
  const [otherAllergenStatus, setOtherAllergenStatus] = useState("");
  const pincodeEditedRef = useRef(false);
  const skipPendingEditLoadRef = useRef(false);
  const [outlets, setOutlets] = useState([]);
  const [menus, setMenus] = useState([]);
  const [activeTab, setActiveTab] = useState("single");
  useEffect(() => {
    if (!completedBulkImportScrollKey || activeTab !== "bulk") return;
    if (lastAutoScrollKeyRef.current === completedBulkImportScrollKey) return;
    lastAutoScrollKeyRef.current = completedBulkImportScrollKey;
    const section = document.getElementById("epantry-submit-imported-batches");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.focus({ preventScroll: true });
    }
  }, [completedBulkImportScrollKey, activeTab]);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [barcodeMatches, setBarcodeMatches] = useState([]);
  const [barcodeChecked, setBarcodeChecked] = useState("");
  const [barcodeChecking, setBarcodeChecking] = useState(false);
  const [publishedProductMatches, setPublishedProductMatches] = useState([]);
  const [productMatchBusy, setProductMatchBusy] = useState(false);
  const [approvedBrands, setApprovedBrands] = useState([]);
  const [sellingReadiness, setSellingReadiness] = useState(null);
  const [brandLoadError, setBrandLoadError] = useState("");
  const fieldRef = useRef(null);
  const editIdFromUrl = params.get("edit") || "";
  const activeListing = existing.find((item) => item.id === editingId);
  const hasLegacyDeliveryCoverage = Boolean(
    editingId && activeListing && (
      ["submitted_for_review", "approved", "changes_requested", "rejected"].includes(activeListing.status) ||
      (activeListing.status === "draft" && (activeListing.packet?.delivery?.postalCodes || []).some(
        (pin) => !savedPostalCodes.includes(String(pin))
      ))
    )
  );
  useEffect(() => {
    if (!editingId) {
      setSellingReadiness(null);
      return undefined;
    }
    let live = true;
    setSellingReadiness(null);
    getHostListingSellingReadiness(editingId)
      .then((result) => {
        if (live) setSellingReadiness(result?.readiness || null);
      })
      .catch(() => {
        if (live)
          setSellingReadiness({
            message: "Selling status is unavailable. Refresh and try again.",
          });
      });
    return () => {
      live = false;
    };
  }, [editingId, existing]);
  const selectableTypes =
    editingId && !allowed.some((item) => item.value === form.type)
      ? [...allowed, ...types.filter((item) => item.value === form.type)]
      : allowed;
  const locked =
    ["submitted_for_review", "approved", "rejected"].includes(
      activeListing?.status
    ) && !revisingApproved;
  const correctionSection =
    activeListing?.status === "changes_requested"
      ? activeListing?.correctionSection
      : "";
  const importedHostBatches = useMemo(() => {
    const grouped = new Map();
    for (const item of existing) {
      if (!item?.bulkBatchId || !item.id) continue;
      if (!grouped.has(item.bulkBatchId)) {
        grouped.set(item.bulkBatchId, { id: item.bulkBatchId, items: [], newest: 0 });
      }
      const batch = grouped.get(item.bulkBatchId);
      batch.items.push(item);
      batch.newest = Math.max(batch.newest, new Date(item.updatedAt || 0).getTime() || 0);
    }
    return [...grouped.values()].map((batch) => ({
      ...batch,
      ready: batch.items.filter((item) => ['draft', 'changes_requested'].includes(item.status)),
      awaiting: batch.items.filter((item) => item.status === 'submitted_for_review').length,
      approved: batch.items.filter((item) => item.status === 'approved').length,
    })).sort((a, b) => b.newest - a.newest);
  }, [existing]);
  const bulkBatchVisibleCount = (bulkBatchPageIndex + 1) * bulkBatchPageSize;
  const visibleImportedHostBatches = importedHostBatches.slice(0, bulkBatchVisibleCount);
  const remainingBulkBatches = Math.max(0, importedHostBatches.length - bulkBatchVisibleCount);
  const importedBatchReadyCount = importedHostBatches.reduce((sum, batch) => sum + batch.ready.length, 0);
  const importedBatchAwaitingCount = importedHostBatches.reduce((sum, batch) => sum + batch.awaiting, 0);
  const importedBatchApprovedCount = importedHostBatches.reduce((sum, batch) => sum + batch.approved, 0);
  const showNextBulkBatchPage = () => {
    setBulkBatchPageIndex((current) => current + 1);
  };
  const filteredHistory = existing.filter(
    (item) =>
      historyFilter === "all" ||
      (historyFilter === "needs_attention"
        ? ["changes_requested", "rejected"].includes(item.status)
        : item.status === historyFilter)
  );
  const historyVisibleCount = historyPagesVisible * bulkBatchPageSize;
  const visibleHistory = filteredHistory.slice(0, historyVisibleCount);
  const remainingHistory = Math.max(0, filteredHistory.length - historyVisibleCount);
  const historyCount = (filter) =>
    filter === "all"
      ? existing.length
      : existing.filter((item) =>
          filter === "needs_attention"
            ? ["changes_requested", "rejected"].includes(item.status)
            : item.status === filter
        ).length;
  const isRecipe = form.type !== "grocery";
  const canSell =
    form.type === "grocery" ||
    form.type === "prepared_food" ||
    (form.type === "kitchen_recipe" && form.sellReadyMade);
  const costs = useMemo(
    () => (isRecipe ? form.ingredients.map(estimateCost) : []),
    [isRecipe, form.ingredients]
  );
  const customAllergens = (form.allergens || []).filter(
    (item) => !allergenNames.includes(item.key)
  );
  const knownCosts = costs.filter((cost) => cost !== null);
  const costingComplete =
    isRecipe && costs.length > 0 && knownCosts.length === costs.length;
  const ingredientCost = knownCosts.length
    ? knownCosts.reduce((sum, value) => sum + value, 0)
    : null;
  const completeCost = costingComplete
    ? ingredientCost +
      Number(form.selling.packagingCost || 0) +
      Number(form.selling.labourCost || 0)
    : null;
  const errorMessage = (value) =>
    value?.response?.data?.message ||
    value?.message ||
    "Unable to complete this listing action.";

  const load = useCallback(async () => {
    try {
      const response = await listHostListingPackets();
      setExisting(response?.listings || []);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (form.type !== "brand_recipe") return;
    let cancelled = false;
    listHostApprovedBrands()
      .then((result) => {
        if (!cancelled) {
          setApprovedBrands(result?.brands || []);
          setBrandLoadError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApprovedBrands([]);
          setBrandLoadError("Unable to load your approved brands. Try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form.type]);
  useEffect(() => {
    if (!["b2b", "chef_restaurant", "hybrid", "legacy"].includes(workspace))
      return;
    let cancelled = false;
    Promise.allSettled([listHospitalityOutlets(), listHospitalityMenus()]).then(
      ([outletResult, menuResult]) => {
        if (cancelled) return;
        if (outletResult.status === "fulfilled")
          setOutlets(outletResult.value?.outlets || []);
        if (menuResult.status === "fulfilled")
          setMenus(menuResult.value?.menus || []);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [workspace]);
  // Only the business-wide service area supplies NEW listing coverage.
  // Historical listing packets keep their saved delivery PINs unchanged.
  useEffect(() => {
    let cancelled = false;
    const loadSavedDeliveryCoverage = async () => {
      try {
        const result = await listServiceAreas({
          page: 1,
          limit: 10,
          status: "active",
          search: "host-default-delivery",
        });
        if (cancelled) return;
        const shared = (result?.serviceAreas || []).find(
          (area) => area.serviceAreaKey === "host-default-delivery"
        );
        const pins = [...new Set((shared?.postalCodes || []).map(String).filter(
          (value) => /^[1-9][0-9]{5}$/.test(value)
        ))];
        setSavedPostalCodes(pins);
      } catch {
        // Missing or unavailable shared coverage is not replaced with
        // unrelated product-specific areas.
        if (!cancelled) setSavedPostalCodes([]);
      }
    };
    loadSavedDeliveryCoverage();
    return () => {
      cancelled = true;
    };
  }, [workspace]);
  useEffect(() => {
    if (
      !savedPostalCodes.length ||
      params.get("edit") ||
      editingId ||
      pincodeEditedRef.current
    )
      return;
    setForm((current) =>
      current.delivery?.postalCodes?.length
        ? current
        : {
            ...current,
            delivery: {
              ...current.delivery,
              postalCodes: [...savedPostalCodes],
            },
          }
    );
    setPincodeText((current) =>
      current.trim() ? current : savedPostalCodes.join(", ")
    );
  }, [savedPostalCodes, editingId, params]);

  useEffect(() => {
    // Only load a saved listing when the URL's edit ID changes. Editing state
    // is not a dependency: clearing it for 'Start a new listing' must NOT
    // cause the previous approved/submitted listing to load again and lock the form.
    if (!editIdFromUrl) return undefined;
    let cancelled = false;
    skipPendingEditLoadRef.current = false;
    setLoading(true);
    getHostListingPacket(editIdFromUrl)
      .then((data) => {
        if (cancelled || skipPendingEditLoadRef.current) return;
        setForm({
          ...newPacket(data.listing.packet.type),
          ...data.listing.packet,
        });
        pincodeEditedRef.current = true;
        setPincodeText(
          (data.listing.packet.delivery?.postalCodes || []).join(", ")
        );
        setEditingId(data.listing.id);
        setRevisingApproved(false);
        setBarcodeMatches([]);
        setBarcodeChecked("");
        setActiveTab("single");
      })
      .catch((cause) => {
        if (!cancelled && !skipPendingEditLoadRef.current)
          setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled && !skipPendingEditLoadRef.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editIdFromUrl]);
  const patch = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const nested = (key, sub, value) =>
    setForm((current) => ({
      ...current,
      [key]: { ...current[key], [sub]: value },
    }));
  const updateRow = (key, index, patchValue) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, offset) =>
        offset === index ? { ...item, ...patchValue } : item
      ),
    }));
  const removeRow = (key, index) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].filter((_, offset) => offset !== index),
    }));
  async function checkBarcode() {
    const gtin = String(form.selling?.barcode || "").trim();
    setBarcodeMatches([]);
    setBarcodeChecked("");
    if (!gtin) return;
    setBarcodeChecking(true);
    try {
      const result = await checkHostListingBarcode(gtin);
      setBarcodeMatches(result?.matches || []);
      setBarcodeChecked(gtin);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBarcodeChecking(false);
    }
  }
  function startNew(type) {
    // A previously started edit fetch can still be in flight. Ignore its
    // result so it cannot replace the fresh editable form with an old listing.
    skipPendingEditLoadRef.current = true;
    setLoading(false);
    const packet = newPacket(type);
    packet.delivery.postalCodes = [...savedPostalCodes];
    pincodeEditedRef.current = false;
    setShowOtherAllergen(false);
    setOtherAllergenName("");
    setOtherAllergenStatus("");
    setBarcodeMatches([]);
    setBarcodeChecked("");
    setRevisingApproved(false);
    setForm(packet);
    setPincodeText(savedPostalCodes.join(", "));
    setEditingId("");
    setError("");
    setNotice("");
    setParams({ type });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function uploadImage(file, target, index = -1, photoRole = "") {
    if (!file) return;
    setUploading(`${target}-${index}`);
    setError("");
    try {
      const url = await uploadHostListingImage(file);
      if (target === "images") {
        setForm((current) => {
          if (current.images.length >= 12) return current;
          const images = [...current.images, url];
          const role =
            current.type === "grocery" && groceryPhotoRoleLabels[photoRole]
              ? photoRole
              : "";
          return {
            ...current,
            images,
            imageRoles: role
              ? [...(current.imageRoles || []), { url, role }]
              : current.imageRoles || [],
          };
        });
      } else updateRow(target, index, { imageUrl: url });
      setNotice("Image uploaded. Save this listing to keep it.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUploading("");
    }
  }
  async function uploadVideo(file) {
    if (!file) return;
    setUploading("video");
    setError("");
    try {
      const url = await uploadHostListingVideo(file);
      setForm((current) => ({
        ...current,
        videoUrl: url,
        videoFileName: String(file.name || "Recipe video").slice(0, 180),
      }));
      setNotice("Video uploaded. Save this listing to keep it.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUploading("");
    }
  }
  async function save(submit = false) {
    if (busy || locked || uploading) return;
    if (
      submit &&
      workspace === "hybrid" &&
      form.type === "grocery" &&
      !form.grocerySubcategory
    ) {
      setError("Choose a grocery customer category before submitting.");
      document
        .getElementById("listing-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (
      submit &&
      form.type === "grocery" &&
      form.selling?.barcode &&
      !isValidHostBarcode(form.selling.barcode)
    ) {
      setError(
        "Check the barcode on the product label. If the item has no barcode, clear this optional field before submitting."
      );
      document.getElementById("host-listing-barcode")?.focus();
      document
        .getElementById("host-listing-barcode")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = editingId
        ? await updateHostListingPacket(editingId, form)
        : await createHostListingPacket(form);
      const id = result?.listing?.id;
      if (submit) await submitHostListingPacket(id);
      setEditingId(id);
      setParams({ edit: id });
      setNotice(
        submit
          ? "Listing submitted to Super Admin for review. You will be notified after a decision."
          : "Draft saved. You can continue editing here."
      );
      await load();
      if (revisingApproved) setRevisingApproved(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function resendSavedListingForSelling() {
    if (
      busy ||
      uploading ||
      !editingId ||
      activeListing?.status !== "approved" ||
      !canSell ||
      sellingReadiness?.offerStatus === "active"
    )
      return;
    if (
      !window.confirm(
        "Send this already-approved listing for one-step Super Admin selling approval? Your existing ingredients, photos, price, stock and delivery will be reused unchanged."
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await resubmitApprovedHostListingForSelling(editingId);
      await load();
      setNotice(
        "Saved listing sent to Super Admin. One approval will publish the product and enable selling; you do not need to enter the details again."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function requestSavedRecipeSharing() {
    if (
      busy ||
      uploading ||
      !editingId ||
      activeListing?.status !== "approved" ||
      form.type === "grocery" ||
      form.shareRecipe === true
    )
      return;
    const savedIngredients = (form.ingredients || []).filter(
      (item) => String(item?.name || "").trim() && Number(item?.quantity) > 0
    );
    const savedSteps = (form.steps || []).filter((step) =>
      String(step?.instruction || "").trim()
    );
    if (
      !savedIngredients.length ||
      !savedSteps.length ||
      savedIngredients.length !== (form.ingredients || []).length ||
      savedSteps.length !== (form.steps || []).length
    ) {
      setError(
        "Your saved recipe is missing ingredient quantities or cooking steps. Select Edit complete listing to finish them first."
      );
      return;
    }
    if (
      !window.confirm(
        `Share ${savedIngredients.length} saved ingredients and ${savedSteps.length} cooking steps with customers after Super Admin approval? Your currently approved listing stays unchanged until then.`
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // This reuses the normal MFA-protected, Super Admin-governed section revision.
      // No ingredients, steps, photos, pricing, or other saved values are resent.
      const result = await submitHostListingSectionRevision(editingId, {
        shareRecipe: true,
      });
      if (result?.listing?.packet)
        setForm({
          ...newPacket(result.listing.packet.type),
          ...result.listing.packet,
        });
      await load();
      setNotice(
        "Your saved recipe was sent to Super Admin for review. Once approved, ingredients and cooking steps will appear on the customer page. No details need to be entered again."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveSectionRevision() {
    if (busy || uploading || !locked || !editingId) return;
    if (
      activeListing?.status === "approved" &&
      !window.confirm(
        "Your approved listing stays live while Super Admin reviews the updated food facts and selling details. Continue?"
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const sections = {
        nutrition: form.nutrition,
        allergens: form.allergens,
        dietary: form.dietary,
        selling: form.selling,
        delivery: {
          ...form.delivery,
          postalCodes: pincodeText.split(/[\s,;]+/).filter(Boolean),
        },
      };
      const result = await submitHostListingSectionRevision(
        editingId,
        sections
      );
      if (result?.listing?.packet) {
        setForm({
          ...newPacket(result.listing.packet.type),
          ...result.listing.packet,
        });
        setPincodeText(
          (result.listing.packet.delivery?.postalCodes || []).join(", ")
        );
      }
      await load();
      setNotice(
        "Food facts and selling changes sent to Super Admin for review. Other listing information was not changed."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  function addOtherAllergen() {
    const name = otherAllergenName.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase().replace(/\s+/g, "_");
    if (
      name.length < 2 ||
      name.length > 70 ||
      !/^[a-z][a-z0-9_ -]*$/i.test(name)
    ) {
      setError("Enter an allergen name using 2–70 letters, numbers or spaces.");
      return;
    }
    if (!otherAllergenStatus) {
      setError("Choose how this additional allergen relates to the food.");
      return;
    }
    if (
      allergenNames.includes(key) ||
      form.allergens.some((entry) => entry.key === key)
    ) {
      setError(
        "This allergen is already listed. Change its existing declaration instead."
      );
      return;
    }
    if (form.allergens.length >= 20) {
      setError("This listing has reached the allergen limit.");
      return;
    }
    patch("allergens", [
      ...form.allergens,
      { key, relationship: otherAllergenStatus },
    ]);
    setOtherAllergenName("");
    setOtherAllergenStatus("");
    setError("");
    setShowOtherAllergen(false);
  }
  async function deleteListing(item) {
    if (busy || uploading || !item?.id) return;
    const approved = item.status === "approved";
    const message = approved
      ? `Remove "${
          item.title || "this listing"
        }" from your Host Studio and public EPANTRY? It will stop appearing to customers. Super Admin audit history will be retained.`
      : `Remove "${
          item.title || "this listing"
        }" from your Host Studio? The record will be hidden, while any existing review history stays available for audit.`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await deleteHostListingPacket(item.id);
      if (editingId === item.id) startNew(initialType);
      await load();
      setNotice(`"${item.title || "Listing"}" was removed from your listings.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  // Keep backend's existing 25-packet endpoint and its security checks intact.
  // A 100-item workbook is saved in up to four ordered requests.
  async function importBulkPacketsChunked(packets) {
    if (!Array.isArray(packets) || packets.length < 1 || packets.length > 100) {
      throw new Error("Import between 1 and 100 listings at once.");
    }
    const saved = [];
    for (let start = 0; start < packets.length; start += 25) {
      const chunk = packets.slice(start, start + 25);
      setBulkProgress(`Saving drafts ${start + 1}–${start + chunk.length} of ${packets.length}...`);
      try {
        const response = await importHostListingPackets(chunk);
        const created = response?.listings;
        if (!Array.isArray(created) || created.length !== chunk.length) {
          throw new Error("The server did not confirm all drafts in this group.");
        }
        saved.push(...created);
      } catch (cause) {
        const reason = cause?.message || "Unknown server error";
        const failure = new Error(`${saved.length} of ${packets.length} drafts were confirmed saved before the error. Check Your listings & drafts before retrying. ${reason}`);
        failure.savedCount = saved.length;
        throw failure;
      }
    }
    return { listings: saved };
  }
  async function bulkImport() {
    if (busy) return;
    let packets;
    try {
      packets = JSON.parse(bulkText);
      if (!Array.isArray(packets))
        throw new Error("Bulk file must contain an array of listings.");
    } catch (cause) {
      setError(cause.message);
      return;
    }
    if (!packets.length || packets.length > 100) {
      setError("Import between 1 and 100 listings at once.");
      return;
    }
    if (packets.some((packet) => packet?.type === "prepared_food")) {
      setError("Ready-made food listings can no longer be created here.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await importBulkPacketsChunked(packets);
      setNotice(
        `${
          result?.listings?.length || 0
        } draft listings imported. Open each to check and submit.`
      );
      setBulkText("");
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function previewExcel(file) {
    if (!file) return;
    setError("");
    setLastSavedBulkCount(0);
    setNotice("");
    setBulkPreview(null);
    setBulkProgress("");
    setBulkFileName(file.name);
    try {
      const preview = await parseHostBulkWorkbook(
        file,
        allowed.map((type) => type.value)
      );
      setBulkPreview(preview);
      setNotice(
        `${preview.packets.length} listings ready for review. Import creates drafts only, never public listings.`
      );
    } catch (cause) {
      setError(cause?.message || "Unable to read this EPANTRY Excel template.");
    }
  }
  async function previewZip(file) {
    if (!file) return;
    setError("");
    setLastSavedBulkCount(0);
    setNotice("");
    setBulkPreview(null);
    setBulkProgress("");
    setBulkFileName(file.name);
    try {
      const preview = await previewHostBulkZip(
        file,
        allowed.map((type) => type.value),
        parseHostBulkWorkbook
      );
      setBulkPreview(preview);
      setNotice(`${preview.packets.length} listings and ${preview.mediaCount} images ready. Import saves drafts only.`);
    } catch (cause) {
      setError(cause?.message || "Unable to read ZIP. Check its workbook and media/ folder.");
    }
  }
  async function importExcelDrafts() {
    if (busy || !bulkPreview?.packets?.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    setBulkProgress("");
    // Make the failure stage explicit. Media is imported BEFORE any draft-saving call.
    let importStage = "media";
    try {
      const packets = bulkPreview.source === "zip"
        ? await ingestHostBulkZipMedia(
            bulkPreview,
            {
              uploadImage: uploadHostListingImage,
              uploadVideo: uploadHostListingVideo,
              importRemoteImage: importHostListingRemoteImage,
            },
            (done, total) => setBulkProgress(`Uploading ZIP media: ${done} of ${total}`)
          )
        : await ingestWorkbookImages(
        bulkPreview.packets,
        importHostListingRemoteImage,
        (done, total) => {
          setBulkProgress(
            `Importing real images into EPANTRY: ${done} of ${total}`
          );
        }
      );
      importStage = "drafts";
      setBulkProgress("Images verified. Saving approved-format drafts to EPANTRY...");
      const result = await importBulkPacketsChunked(packets);
      setNotice(
        `${
          result?.listings?.length || 0
        } listings saved as drafts. Open each item, verify details and submit for Super Admin review.`
      );
      setBulkPreview(null);
      setBulkFileName("");
      setBulkProgress("");
      await load();
      if (result?.listings?.length) {
        setHistoryFilter("all");
        setHistoryPagesVisible(1);
        setBulkBatchPageIndex(0);
        setLastSavedBulkCount(result.listings.length);
        setCompletedBulkImportScrollKey((key) => key + 1);
      }
    } catch (cause) {
      if (importStage === "media") {
        setError(
          `${errorMessage(cause)} Excel media import stopped before saving any drafts. Fix the specific image's permission or service error shown above, then retry this same Excel workbook.`
        );
      } else {
        setError(
          `${errorMessage(cause)} The draft-saving request may have partially succeeded. Check Your listings & drafts before retrying to avoid duplicates.`
        );
      }
      if (importStage === "drafts" && cause?.savedCount > 0) {
        setBulkPreview(null);
        setBulkFileName("");
        await load();
        setBulkBatchPageIndex(0);
        // On partial failure, keep the error visible rather than scrolling away.
      }
      setBulkProgress("");
    } finally {
      setBusy(false);
    }
  }
  // Explicit Host action: importing Excel/ZIP creates DRAFTS, never admin submissions.
  // Reuse each listing's existing /submit endpoint and its full server-side
  // validation, identity, authorization and notification requirements.
  async function submitImportedHostBatch(batch) {
    if (busy || uploading || !batch?.ready?.length) return;
    const records = [...batch.ready];
    const yes = window.confirm(
      `Send ${records.length} listing${records.length === 1 ? '' : 's'} from this imported batch to Super Admin for review?\n\n` +
      'Every listing is validated individually. Valid listings will be submitted; any invalid draft will remain editable.'
    );
    if (!yes) return;
    setBusy(true);
    setSubmittingBulkBatchId(batch.id);
    setError('');
    setNotice('');
    let completed = 0;
    const failed = [];
    try {
      for (const item of records) {
        try {
          await submitHostListingPacket(item.id);
          completed += 1;
        } catch (cause) {
          failed.push(`${item.title || 'Untitled listing'}: ${errorMessage(cause)}`);
        }
      }
      // Refresh the server's confirmed states even after partial failures.
      await load();
      if (completed) setNotice(`${completed} listing${completed === 1 ? '' : 's'} submitted to Super Admin. Open Admin → Listing approvals → Bulk review → Host batches to review them.`);
      if (failed.length) {
        setError(`${failed.length} listing${failed.length === 1 ? '' : 's'} were NOT submitted and remain editable. ${failed.slice(0, 4).join(' | ')}${failed.length > 4 ? ` | ${failed.length - 4} more: check and correct the remaining drafts.` : ''}`);
      }
    } finally {
      setSubmittingBulkBatchId('');
      setBusy(false);
    }
  }
  async function findPublishedProduct() {
    const search = String(form.title || "").trim();
    if (search.length < 3 || productMatchBusy) return;
    setProductMatchBusy(true);
    setError("");
    try {
      const result = await searchHostPublishedProducts(search);
      setPublishedProductMatches(result?.products || []);
      if (!result?.products?.length)
        setNotice(
          "No approved catalog product matched this name. You can still submit it for review."
        );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProductMatchBusy(false);
    }
  }
  const barcodeValue = String(form.selling?.barcode || "").trim();
  const barcodeValid = !barcodeValue || isValidHostBarcode(barcodeValue);
  const barcodeLengthValid =
    /^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/.test(barcodeValue);
  const field = styles.field;
  const section = styles.section;
  return (
    <main
      ref={fieldRef}
      className="uel-page"
      data-workspace={workspace}
      data-listing-type={form.type}
    >
      <style>{editorialStyles}</style>
      <div className="uel-shell">
        {workspace === "legacy" && (
          <p className="uel-legacy-notice" role="status">
            This account is in the Legacy Host workspace. Hybrid's Grocery /
            Recipe-only creator requires an approved Hybrid workspace
            assignment.
          </p>
        )}
        <header className="uel-hero">
          <div className="uel-hero-main">
            <Link to="/host/listings" className="uel-back">
              <ArrowLeft size={17} /> All listing options
            </Link>
            <div className="uel-studio-tools">
              <p className="uel-eyebrow">EPANTRY · Host studio</p>
              <button
                type="button"
                className="uel-refresh"
                disabled={busy || Boolean(uploading)}
                title="Reload saved Host Studio data. Unsaved edits will be lost."
                onClick={() => {
                  if (
                    window.confirm(
                      "Refresh Host Studio? Any unsaved changes will be lost."
                    )
                  )
                    window.location.reload();
                }}
              >
                <RefreshCw size={16} aria-hidden="true" /> Refresh page
              </button>
            </div>
            <h1 className="uel-hero-title">
              {activeTab === "bulk" ? (<>List more.<br /><em>Work less.</em></>) : (<>Create something<br /><em>worth sharing.</em></>)}
            </h1>
            <p className="uel-hero-description">
              {activeTab === "bulk" ? "One workbook. Every item, image and cooking step in its place." : "Add groceries or recipes with photos, ingredients and listing details."}
            </p>
            <div className="uel-hero-foot">
              <span className="uel-status">
                <span className="uel-status-dot" />
                {editingId
                  ? locked
                    ? "Listing under review"
                    : "Editing an existing listing"
                  : "Your new listing"}
              </span>
              <button
                type="button"
                className="uel-new"
                onClick={() => startNew(initialType)}
              >
                <Plus size={20} strokeWidth={2.7} aria-hidden="true" /> Start a
                new listing
              </button>
            </div>
          </div>
          <aside className="uel-hero-side" aria-label="How publishing works">
            <div>
              <p className="uel-hero-side-kicker">Your path to publishing</p>
              <h2 className="uel-hero-side-title">
                {activeTab === "bulk" ? "Import. Check. Submit." : "From idea to listing, in three clear steps."}
              </h2>
              <div className="uel-hero-step">
                <strong>01</strong>
                <span>{activeTab === "bulk" ? "Download a template" : "Add your item details"}</span>
              </div>
              <div className="uel-hero-step">
                <strong>02</strong>
                <span>{activeTab === "bulk" ? "Upload ZIP or Excel" : "Save and check your draft"}</span>
              </div>
              <div className="uel-hero-step">
                <strong>03</strong>
                <span>{activeTab === "bulk" ? "Review and save drafts" : "Send it to Super Admin"}</span>
              </div>
            </div>
            <p className="uel-hero-approval">
              {activeTab === "bulk" ? "Super Admin approval is required before publishing." : "Your listing is visible to customers only after approval. Marketplace selling rules still apply separately."}
            </p>
          </aside>
        </header>
        {error && (
          <div
            role="alert"
            className="uel-alert border-l-4 border-red-600 bg-red-50 px-4 py-3 text-red-800"
          >
            {error}
          </div>
        )}
        {activeListing?.reviewNote && (
          <div
            role="status"
            className="uel-alert border-l-4 border-[#C86C42] bg-[#F7E7DA] px-4 py-3"
          >
            <strong>Super Admin note:</strong> {activeListing.reviewNote}{" "}
            {correctionSection && (
              <a
                className="ml-2 font-semibold underline"
                href={`#listing-${correctionSection}`}
              >
                Go to {correctionSection}
              </a>
            )}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="uel-alert flex items-center gap-2 border-l-4 border-[#173F35] bg-[#E0ECE1] px-4 py-3 text-[#173F35]"
          >
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}

        <div className="uel-mode-bar">
          <div className="uel-mode-text">
            <h2>{activeTab === "bulk" ? "Bulk listing workspace" : "How would you like to add items?"}</h2>
            <p>
              {activeTab === "bulk" ? "Excel or ZIP. Save drafts, then submit." : "Create one listing, or prepare several using our Excel templates."}
            </p>
          </div>
          <div className="uel-tabs" role="tablist" aria-label="Listing mode">
            <button
              role="tab"
              aria-selected={activeTab === "single"}
              data-active={activeTab === "single"}
              className="uel-tab"
              type="button"
              onClick={() => setActiveTab("single")}
            >
              Single listing
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "bulk"}
              data-active={activeTab === "bulk"}
              className="uel-tab"
              type="button"
              onClick={() => setActiveTab("bulk")}
            >
              Bulk listing
            </button>
          </div>
        </div>
        {activeTab === "single" && (
          <nav className="uel-jumpbar" aria-label="Jump to listing section">
            <span>GO TO</span>
            <a href="#listing-details">
              <b>01</b> Details
            </a>
            <a href="#listing-media">
              <b>02</b> Photos
            </a>
            {isRecipe && (
              <a href="#listing-ingredients">
                <b>03</b> Ingredients
              </a>
            )}
            {isRecipe && (
              <a href="#listing-steps">
                <b>04</b> Steps
              </a>
            )}
            <a href="#listing-nutrition">
              <b>{isRecipe ? "05" : "03"}</b> Food information
            </a>
            {canSell && (
              <a href="#listing-selling">
                <b>{isRecipe ? "06" : "04"}</b> Selling
              </a>
            )}
          </nav>
        )}
        {activeTab === "bulk" ? (
          <section className="uel-bulk-redesign" aria-label="Bulk listing editor">
            <section className="uel-bulk-banner" aria-label="Bulk listing studio">
              <div>
                <p className="uel-bulk-kicker">BULK LISTING / WORKSPACE</p>
                <h2>List more, in one upload.</h2>
                <p>Excel or ZIP. Save up to 100 drafts.</p>
              </div>
              <div className="uel-bulk-banner-meta">
                <strong>100</strong>
                <span>listings per upload</span>
                <small>Submit saved drafts for approval.</small>
              </div>
            </section>
            <nav className="uel-bulk-steps" aria-label="Bulk listing progress">
              <div className={!bulkFileName ? "is-active" : "is-complete"}><b>01</b><span>Template</span></div>
              <div className={bulkFileName && !bulkPreview ? "is-active" : bulkPreview ? "is-complete" : ""}><b>02</b><span>Upload</span></div>
              <div className={bulkPreview ? "is-active" : ""}><b>03</b><span>Save drafts</span></div>
            </nav>
            <section className="uel-bulk-workspace">
              <section className="uel-bulk-content">
                <section aria-label="Excel templates">
                  <div className="uel-bulk-part-head">
                    <span className="uel-bulk-part-number">01</span>
                    <div>
                      <h3>Download a template</h3>
                      <p>Use one listing_key across sheets.</p>
                    </div>
                  </div>
                  <div className="uel-bulk-template-grid">
                    {visibleTemplates.map((item) => (
                      <a
                        key={item.key}
                        className="uel-bulk-template-link"
                        href={`/templates/EPANTRY_Bulk_${item.key}.xlsx`}
                        download
                        aria-label={`Download ${item.label} Excel template`}
                      >
                        <span className="uel-bulk-template-icon"><FileSpreadsheet size={22} /></span>
                        <span className="uel-bulk-template-info">
                          <strong>{item.label}</strong>
                          <small>{item.type === "grocery" ? "Products · price · stock" : "Recipe · ingredients · steps"}</small>
                        </span>
                        <Download size={18} className="uel-bulk-template-download" />
                      </a>
                    ))}
                  </div>
                </section>
                <div className="uel-bulk-divider" />
                <section aria-label="Upload Excel or ZIP" className="uel-bulk-upload-stage">
                  <div className="uel-bulk-part-head">
                    <span className="uel-bulk-part-number">02</span>
                    <div>
                      <h3>Choose how to upload</h3>
                      <p>Select Excel or ZIP.</p>
                    </div>
                  </div>
                  <div className="uel-bulk-methods" role="group" aria-label="Choose your upload format">
                    <button
                      type="button"
                      className="uel-bulk-method"
                      data-selected={bulkUploadMode === "zip"}
                      aria-pressed={bulkUploadMode === "zip"}
                      onClick={() => { setBulkUploadMode("zip"); setBulkPreview(null); setBulkFileName(""); setBulkProgress(""); setError(""); }}
                      disabled={busy}
                    >
                      <span className="uel-bulk-method-icon"><UploadCloud size={23} /></span>
                      <span className="uel-bulk-choice-body">
                        <strong>Excel + media ZIP</strong>
                        <small>Excel + local photos/videos</small>
                      </span>
                      <span className="uel-bulk-choice-indicator" aria-hidden="true"><CheckCircle2 size={20}/></span>
                    </button>
                    <button
                      type="button"
                      className="uel-bulk-method"
                      data-selected={bulkUploadMode === "excel"}
                      aria-pressed={bulkUploadMode === "excel"}
                      onClick={() => { setBulkUploadMode("excel"); setBulkPreview(null); setBulkFileName(""); setBulkProgress(""); setError(""); }}
                      disabled={busy}
                    >
                      <span className="uel-bulk-method-icon"><FileSpreadsheet size={23}/></span>
                      <span className="uel-bulk-choice-body">
                        <strong>Excel only</strong>
                        <small>Excel + public photo links</small>
                      </span>
                      <span className="uel-bulk-choice-indicator" aria-hidden="true"><CheckCircle2 size={20}/></span>
                    </button>
                  </div>
                  {bulkUploadMode === "zip" ? (
                    <section className="uel-bulk-upload-line" aria-label="Select media ZIP file">
                      <span className="uel-bulk-upload-line-icon"><UploadCloud size={24}/></span>
                      <div className="uel-bulk-upload-line-copy">
                        <strong>Attach your ZIP file</strong>
                        <p>Excel workbook + media folder.</p>
                        <small>ZIP format · Maximum 320 MB</small>
                      </div>
                      <label htmlFor="epantry-bulk-zip" className="uel-bulk-file-action">
                        <UploadCloud size={17}/>
                        Choose ZIP
                        <input
                          id="epantry-bulk-zip"
                          type="file"
                          disabled={busy}
                          accept=".zip,application/zip,application/x-zip-compressed"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (file) await previewZip(file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </section>
                  ) : (
                    <section className="uel-bulk-upload-line" aria-label="Select Excel workbook">
                      <span className="uel-bulk-upload-line-icon"><FileSpreadsheet size={24}/></span>
                      <div className="uel-bulk-upload-line-copy">
                        <strong>Attach your Excel workbook</strong>
                        <p>Add public image links in the Photos sheet.</p>
                        <small>XLSX format · Up to 100 listings</small>
                      </div>
                      <label htmlFor="epantry-bulk-excel" className="uel-bulk-file-action">
                        <FileSpreadsheet size={17}/>
                        Choose Excel
                        <input
                          id="epantry-bulk-excel"
                          type="file"
                          disabled={busy}
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (file) await previewExcel(file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </section>
                  )}
                  {bulkFileName ? (
                    <div className="uel-bulk-selected" role="status">
                      <CheckCircle2 size={18}/>
                      <span><strong>Selected file:</strong> {bulkFileName}</span>
                    </div>
                  ) : (
                    <p className="uel-bulk-upload-prompt">Choose a file to preview.</p>
                  )}
                  <p className="uel-bulk-note"><strong>listing_key</strong> must match in every sheet and media folder.</p>
                </section>
                {bulkPreview && (
                  <section className="uel-bulk-preview" aria-label="Import preview">
                    <div className="uel-bulk-preview-head">
                      <div>
                        <p className="uel-bulk-kicker">03 / Confirm your batch</p>
                        <h3>Preview before saving</h3>
                      </div>
                      <span className="uel-bulk-preview-count">
                        {bulkPreview.packets.length} listings · {bulkPreview.source === "zip" ? `${bulkPreview.imageCount} images · ${bulkPreview.videoCount} videos` : `${bulkPreview.mediaCount} images`}
                      </span>
                    </div>
                    <div className="uel-bulk-list-preview">
                      {bulkPreview.packets.map((packet, index) => (
                        <div key={`${packet.sku || packet.title}-${index}`} className="uel-bulk-preview-row">
                          <div>
                            <strong>{String(index + 1).padStart(2,"0")} / {packet.title}</strong>
                            <span>{String(packet.category || "other").replaceAll("_"," ")}</span>
                          </div>
                          <small>{packet.images.length} photos · {packet.ingredients.length} ingredients · {packet.steps.length} steps</small>
                        </div>
                      ))}
                    </div>
                    {bulkPreview.issues.length > 0 && (
                      <div className="uel-bulk-warning" role="status">
                        <strong>{bulkPreview.issues.length} checks to complete before publishing</strong>
                        <ul>
                          {bulkPreview.issues.slice(0,12).map((issue,index) => (
                            <li key={index}>{issue.key}: {issue.message}</li>
                          ))}
                        </ul>
                        {bulkPreview.issues.length > 12 && <p>{bulkPreview.issues.length - 12} more notices. Drafts are still allowed.</p>}
                      </div>
                    )}
                    {bulkProgress && <div className="uel-bulk-progress" role="status">{bulkProgress}</div>}
                    <div className="uel-bulk-preview-foot">
                      <p>Imported items stay drafts until submitted.</p>
                      <button type="button" disabled={busy} onClick={importExcelDrafts} className="uel-bulk-submit">
                        <UploadCloud size={17}/>
                        {busy ? "Importing…" : bulkPreview.source === "zip" ? "Upload media & save drafts" : "Import Excel & save drafts"}
                      </button>
                    </div>
                  </section>
                )}
              </section>
              <aside className="uel-bulk-aside" aria-label="Bulk upload limits">
                <section className="uel-bulk-side-panel uel-compact-limits">
                  <h3><Package size={18}/> Upload limits</h3>
                  <p><strong>100 listings</strong> · 500 photos · 100 recipe videos</p>
                  <p>{bulkUploadMode === "zip" ? "ZIP 320 MB · photos 8 MB · videos 50 MB" : "Photos 8 MB each · public image links required"}</p>
                </section>
              </aside>
            </section>
            {bulkUploadMode === "zip" && (
            <details className="uel-bulk-folder-guide uel-compact-folder-guide" aria-label="ZIP media folder instructions">
              <summary className="uel-compact-guide-trigger">
                <span><Package size={21}/> ZIP folder examples <small>Grocery and recipe media naming</small></span>
                <span>View guide <ChevronDown size={18}/></span>
              </summary>
              <div className="uel-compact-guide-body">
              <div className="uel-bulk-folder-grid">
                <div className="uel-bulk-folder-col">
                  <div className="uel-bulk-folder-col-head"><Package size={18}/> Grocery / photos</div>
                  <pre>{`Grocery_Batch/
├── Grocery_Batch.xlsx
└── media/
    ├── EP-ING-004/
    │   ├── front.webp
    │   └── back.webp
    └── EP-ING-005/
        └── front.webp`}</pre>
                  <p><strong>front.webp</strong> = cover · <strong>back.webp</strong> = label/packaging.</p>
                </div>
                <div className="uel-bulk-folder-col">
                  <div className="uel-bulk-folder-col-head"><FileSpreadsheet size={18}/> Recipe / media and steps</div>
                  <pre>{`Recipe_Batch/
├── Recipe_Batch.xlsx
└── media/
    └── V04/
        ├── front.webp
        ├── video.mp4
        ├── ingredients/
        │   └── 01.webp
        └── steps/
            └── 01.webp`}</pre>
                  <p><strong>video.mp4</strong> = recipe video · numbered photos follow Excel row order.</p>
                </div>
              </div>
                <p className="uel-compact-guide-key"><strong>Match the key:</strong> <code>media/V04/</code> belongs to Excel <code>listing_key = V04</code>.</p>
              </div>
            </details>
            )}
            <details className="uel-bulk-advanced">
              <summary className="cursor-pointer text-sm font-semibold text-[#173F35]">
                Advanced: import existing JSON bulk file (unchanged)
              </summary>

              <input
                type="file"
                accept=".json,application/json"
                className="mt-3 block w-full text-sm"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1000000) {
                    setError("Bulk JSON file must be under 1 MB.");
                    return;
                  }
                  setBulkText(await file.text());
                }}
              />
              <textarea
                rows={5}
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                className={`${field} mt-3 font-mono text-xs`}
                placeholder={
                  '[\n  { "type": "grocery", "title": "Example product", "category": "grocery", "images": [] }\n]'
                }
              />
              <button
                type="button"
                disabled={busy || !bulkText.trim()}
                onClick={bulkImport}
                className={`${styles.secondary} mt-3`}
              >
                Import JSON as drafts
              </button>
            </details>
            <section
              id="epantry-submit-imported-batches"
              tabIndex={-1}
              aria-label="Imported bulk batches awaiting Host submission"
              className="uel-imported-batches-section"
            >
              <div className="uel-imported-head">
                <div>
                  <span className="uel-imported-step">04 / SUBMIT TO SUPER ADMIN</span>
                  <h3>Send your batches for review</h3>
                  <p>Choose a batch to send for approval.</p>
                </div>
                <button type="button" onClick={load} disabled={busy} className="uel-imported-refresh">
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>
              {lastSavedBulkCount > 0 && (
                <div className="uel-imported-success" role="status">
                  <CheckCircle2 size={19} aria-hidden="true" />
                  <span><strong>{lastSavedBulkCount} drafts saved.</strong> Select a batch below to submit for review.</span>
                </div>
              )}
              <div className="uel-imported-stats" aria-label="Imported listing status counts">
                <div><strong>{importedHostBatches.length}</strong><span>Batches</span></div>
                <div><strong>{importedBatchReadyCount}</strong><span>Ready</span></div>
                <div><strong>{importedBatchAwaitingCount}</strong><span>In review</span></div>
                <div><strong>{importedBatchApprovedCount}</strong><span>Approved</span></div>
              </div>
              {importedHostBatches.length ? (
                <>
                  <div className="uel-imported-range" aria-live="polite">
                    <span>Showing {visibleImportedHostBatches.length} of {importedHostBatches.length} batches</span>
                    <a href="#uel-history-title" className="uel-imported-history-link">Your listings <ArrowUpRight size={15} /></a>
                  </div>
                  <div className="uel-imported-batch-list">
                    {visibleImportedHostBatches.map((batch) => (
                      <article key={batch.id} className="uel-imported-batch-row">
                        <div className="uel-imported-batch-main">
                          <div className="uel-imported-batch-title">
                            <strong>{batch.items.length} item{batch.items.length !== 1 ? 's' : ''} in batch</strong>
                            {batch.ready.length > 0 ? <span className="uel-imported-pill is-ready">{batch.ready.length} ready</span> :
                              batch.awaiting > 0 ? <span className="uel-imported-pill is-pending">In review</span> :
                              <span className="uel-imported-pill is-done">Submitted</span>}
                          </div>
                          <p className="uel-imported-batch-names" title={batch.items.map((item) => item.title || 'Untitled').join(', ')}>
                            {batch.items.slice(0, 2).map((item) => item.title || 'Untitled').join(' · ')}{batch.items.length > 2 ? ` · +${batch.items.length - 2} more` : ''}
                          </p>
                          {batch.awaiting > 0 || batch.approved > 0 ? (
                            <small>{batch.awaiting} in review · {batch.approved} approved</small>
                          ) : null}
                        </div>
                        <button type="button"
                          disabled={busy || Boolean(uploading) || !batch.ready.length}
                          onClick={() => submitImportedHostBatch(batch)}
                          className="uel-imported-send"
                        >
                          <Send size={16} />
                          {submittingBulkBatchId === batch.id ? 'Submitting…' : batch.ready.length ? `Submit ${batch.ready.length} items` : 'No drafts to submit'}
                        </button>
                      </article>
                    ))}
                  </div>
                  {remainingBulkBatches > 0 && (
                    <div className="uel-imported-pagination">
                      <button type="button" className="uel-imported-page-next" onClick={showNextBulkBatchPage}>
                        View next {Math.min(bulkBatchPageSize, remainingBulkBatches)} batches <ArrowUpRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="uel-imported-empty">No imported batches yet. Upload Excel or ZIP to create drafts.</p>
              )}
            </section>
          </section>
        ) : (
          <>
            {activeListing?.status === "approved" &&
              form.type !== "grocery" &&
              form.shareRecipe !== true &&
              !revisingApproved && (
                <section
                  className="mb-4 border-l-4 border-[#C86C42] bg-[#FFF3EB] px-4 py-4 sm:px-5"
                  aria-label="Publish saved recipe details"
                >
                  <h3 className="text-lg font-bold text-[#173F35]">
                    Your cooking details are saved, but not shared
                  </h3>
                  <p className="mt-1 text-[15px] leading-6 text-[#34453D]">
                    This approved ready-made listing keeps its ingredient
                    quantities and cooking steps private because{" "}
                    <strong>Share recipe</strong> was off. You do not need to
                    upload or type everything again.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#173F35]">
                    Saved:{" "}
                    {
                      (form.ingredients || []).filter((item) =>
                        String(item?.name || "").trim()
                      ).length
                    }{" "}
                    ingredients ·{" "}
                    {
                      (form.steps || []).filter((step) =>
                        String(step?.instruction || "").trim()
                      ).length
                    }{" "}
                    cooking steps
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className={styles.button}
                      disabled={busy || Boolean(uploading)}
                      onClick={requestSavedRecipeSharing}
                    >
                      Share saved recipe · Send for approval
                    </button>
                    <span className="text-[13px] leading-5 text-[#53635A]">
                      Only Super Admin approval makes these details public. The
                      current approved version stays live meanwhile.
                    </span>
                  </div>
                </section>
              )}
            {activeListing?.status === "approved" && !revisingApproved && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#C86C42] bg-[#FFF0E7] px-4 py-3">
                <p className="text-[15px] font-semibold text-[#173F35]">
                  Need to update this approved listing? Edit the full details
                  and submit them for Super Admin re-approval.
                </p>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Your approved listing will remain available while these edits are reviewed. Continue editing?"
                      )
                    )
                      setRevisingApproved(true);
                  }}
                >
                  Edit complete listing
                </button>
              </div>
            )}
            {revisingApproved && (
              <p
                role="status"
                className="mb-4 border-l-4 border-[#C86C42] bg-[#FFF0E7] p-3 text-[15px] font-semibold text-[#173F35]"
              >
                Your approved listing remains available. New changes appear only
                after Super Admin review.
              </p>
            )}
            <fieldset
              disabled={locked || busy || loading}
              className="uel-form min-w-0 disabled:opacity-85"
            >
              <section id="listing-details" className={section}>
                <h2 className="text-2xl font-bold">
                  <span className="uel-section-number">01</span> / The
                  essentials
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <EditorField title="Listing type">
                    <select
                      value={form.type}
                      className={field}
                      onChange={(event) => startNew(event.target.value)}
                    >
                      {selectableTypes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {workspace === "hybrid" &&
                          item.value === "kitchen_recipe"
                            ? "Recipe"
                            : usesHospitalityOperations &&
                              item.value === "prepared_food"
                            ? "Ready-made food / menu item"
                            : workspace === "chef_restaurant" &&
                              item.value === "kitchen_recipe"
                            ? "Kitchen recipe"
                            : item.label}
                        </option>
                      ))}
                    </select>
                  </EditorField>
                  <EditorField title="Item / recipe name">
                    <input
                      className={field}
                      value={form.title}
                      maxLength={180}
                      onChange={(event) => patch("title", event.target.value)}
                    />
                  </EditorField>
                  {form.type === "grocery" ? (
                    <EditorField title="Customer category · Grocery">
                      <select
                        aria-label="Grocery product category"
                        className={field}
                        value={form.grocerySubcategory || ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            category: "grocery",
                            grocerySubcategory: event.target.value,
                          }))
                        }
                      >
                        {groceryCategories.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </EditorField>
                  ) : (
                    <EditorField title="Customer category · Recipe">
                      <select
                        aria-label="Recipe food category"
                        className={field}
                        value={
                          form.category === "grocery" ? "other" : form.category
                        }
                        onChange={(event) =>
                          patch("category", event.target.value)
                        }
                      >
                        {recipeCategories.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </EditorField>
                  )}
                  {workspace === "hybrid" && form.type === "grocery" && (
                    <EditorField title="How is it packed?">
                      <select
                        className={field}
                        value={form.packagingType || ""}
                        onChange={(event) =>
                          patch("packagingType", event.target.value)
                        }
                      >
                        {packagingOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </EditorField>
                  )}
                  {workspace === "hybrid" && (
                    <EditorField title="Food preference">
                      <select
                        className={field}
                        value={form.dietary || "not_declared"}
                        onChange={(event) =>
                          patch("dietary", event.target.value)
                        }
                      >
                        {dietaryOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </EditorField>
                  )}
                  {form.type === "brand_recipe" ? (
                    <EditorField title="Approved brand">
                      <select
                        className={field}
                        value={form.brandName || ""}
                        onChange={(event) =>
                          patch("brandName", event.target.value)
                        }
                      >
                        <option value="">Choose your approved brand</option>
                        {approvedBrands.map((brand) => (
                          <option key={brand.id} value={brand.name}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                      {brandLoadError && (
                        <p role="alert" className="mt-1 text-sm text-red-700">
                          {brandLoadError}
                        </p>
                      )}
                      {!brandLoadError && approvedBrands.length === 0 && (
                        <p className="mt-1 text-sm text-[#5D665F]">
                          No approved brands available for this business.
                        </p>
                      )}
                    </EditorField>
                  ) : (
                    <EditorField title="Brand name (if applicable)">
                      <input
                        className={field}
                        value={form.brandName || ""}
                        onChange={(event) =>
                          patch("brandName", event.target.value)
                        }
                      />
                    </EditorField>
                  )}
                  <EditorField title="Your SKU (if applicable)">
                    <input
                      className={field}
                      value={form.sku || ""}
                      onChange={(event) => patch("sku", event.target.value)}
                    />
                  </EditorField>
                  <EditorField
                    title={
                      isRecipe
                        ? "Country of origin (Host-declared)"
                        : "Country of origin (as on product label)"
                    }
                  >
                    <input
                      className={field}
                      value={form.countryOfOrigin || ""}
                      maxLength={100}
                      onChange={(event) =>
                        patch("countryOfOrigin", event.target.value)
                      }
                      placeholder="e.g. India"
                    />
                  </EditorField>
                  <EditorField
                    title={
                      isRecipe
                        ? "Region / state of origin (if known)"
                        : "Region / state (optional)"
                    }
                  >
                    <input
                      className={field}
                      value={form.regionOfOrigin || ""}
                      maxLength={100}
                      onChange={(event) =>
                        patch("regionOfOrigin", event.target.value)
                      }
                      placeholder="e.g. Punjab"
                    />
                  </EditorField>
                  {isRecipe && (
                    <>
                      <EditorField title="Recipe name in its local language (optional)">
                        <input
                          className={field}
                          value={form.localRecipeName || ""}
                          maxLength={200}
                          onChange={(event) =>
                            patch("localRecipeName", event.target.value)
                          }
                          placeholder="Use the authentic written name, if known"
                        />
                      </EditorField>
                      <EditorField title="Language of local name (optional)">
                        <input
                          className={field}
                          value={form.localRecipeLanguage || ""}
                          maxLength={80}
                          onChange={(event) =>
                            patch("localRecipeLanguage", event.target.value)
                          }
                          placeholder="e.g. Hindi"
                        />
                      </EditorField>
                      <EditorField title="English pronunciation / reading (optional)">
                        <input
                          className={field}
                          value={form.englishNameReading || ""}
                          maxLength={200}
                          onChange={(event) =>
                            patch("englishNameReading", event.target.value)
                          }
                          placeholder="Use only when documented"
                        />
                      </EditorField>
                    </>
                  )}
                  {form.type === "grocery" && (
                    <>
                      <EditorField title="Product family">
                        <input
                          className={field}
                          maxLength={160}
                          value={form.productFamily || ""}
                          onChange={(event) =>
                            patch("productFamily", event.target.value)
                          }
                          placeholder="e.g. Cooking oil"
                        />
                      </EditorField>
                      <EditorField title="Units in one pack">
                        <input
                          className={field}
                          type="number"
                          min="1"
                          step="1"
                          value={form.unitsPerPack ?? ""}
                          onChange={(event) =>
                            patch("unitsPerPack", event.target.value)
                          }
                          placeholder="e.g. 1"
                        />
                      </EditorField>
                      <EditorField title="Manufacturer / packer (from label)">
                        <input
                          className={field}
                          maxLength={180}
                          value={form.manufacturerPacker || ""}
                          onChange={(event) =>
                            patch("manufacturerPacker", event.target.value)
                          }
                          placeholder="Use actual manufacturer name"
                        />
                      </EditorField>
                      <EditorField title="Serving size (from label)">
                        <input
                          className={field}
                          maxLength={100}
                          value={form.servingSize || ""}
                          onChange={(event) =>
                            patch("servingSize", event.target.value)
                          }
                          placeholder="e.g. 30 g"
                        />
                      </EditorField>
                      <div className="min-w-0">
                        <EditorField title="Barcode / GTIN (from label, optional)">
                          <input
                            id="host-listing-barcode"
                            className={field}
                            type="text"
                            inputMode="numeric"
                            maxLength={14}
                            value={form.selling?.barcode || ""}
                            aria-invalid={
                              Boolean(barcodeValue) && !barcodeValid
                            }
                            aria-describedby="host-listing-barcode-help"
                            onChange={(event) => {
                              nested(
                                "selling",
                                "barcode",
                                event.target.value
                                  .replace(/[^0-9]/g, "")
                                  .slice(0, 14)
                              );
                              patch("catalogProductVersionId", "");
                              setBarcodeMatches([]);
                              setBarcodeChecked("");
                              setError((previous) =>
                                /barcode|GTIN/i.test(previous) ? "" : previous
                              );
                            }}
                            placeholder="Enter the barcode printed on the pack"
                            autoComplete="off"
                          />
                        </EditorField>
                        <p
                          id="host-listing-barcode-help"
                          className={`mt-1 text-sm leading-5 ${
                            !barcodeValid ? "text-red-700" : "text-[#465A4F]"
                          }`}
                        >
                          {!barcodeValue
                            ? "No barcode on this item? Leave this optional field empty."
                            : !barcodeLengthValid
                            ? "Use 8, 12, 13 or 14 digits from the product label, or clear the field if there is no barcode."
                            : !barcodeValid
                            ? "The check digit does not match. Recheck the number on the label, or clear it if there is no barcode."
                            : "Barcode format and check digit are valid."}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              barcodeChecking || !barcodeValue || !barcodeValid
                            }
                            onClick={checkBarcode}
                            className={styles.secondary}
                          >
                            {barcodeChecking
                              ? "Checking..."
                              : "Check existing products"}
                          </button>
                          {barcodeValue && (
                            <button
                              type="button"
                              className={styles.secondary}
                              onClick={() => {
                                nested("selling", "barcode", "");
                                patch("catalogProductVersionId", "");
                                setBarcodeMatches([]);
                                setBarcodeChecked("");
                                setError((previous) =>
                                  /barcode|GTIN/i.test(previous) ? "" : previous
                                );
                              }}
                            >
                              Clear barcode
                            </button>
                          )}
                        </div>
                      </div>
                      {barcodeChecked === form.selling?.barcode && (
                        <div
                          className="min-w-0 rounded-lg border border-[#CBD4C8] bg-white p-3 sm:col-span-2"
                          aria-live="polite"
                        >
                          {barcodeMatches.length ? (
                            <>
                              <p className="mb-2 font-semibold">
                                This barcode is already in EPANTRY. Select the
                                correct product:
                              </p>
                              {barcodeMatches.map((match) => (
                                <label
                                  key={match.id}
                                  className="flex items-start gap-2 py-2"
                                >
                                  <input
                                    type="radio"
                                    name="catalog-match"
                                    checked={
                                      form.catalogProductVersionId === match.id
                                    }
                                    onChange={() =>
                                      patch("catalogProductVersionId", match.id)
                                    }
                                  />
                                  <span>{match.title}</span>
                                </label>
                              ))}
                            </>
                          ) : (
                            <p>
                              No published product uses this barcode yet. Your
                              listing can be reviewed as a new product.
                            </p>
                          )}
                        </div>
                      )}
                      <div className="sm:col-span-2 lg:col-span-3 grid gap-3 sm:grid-cols-2">
                        <EditorField title="Ingredients printed on label (optional)">
                          <textarea
                            rows={2}
                            className={field}
                            value={form.labelDeclaration?.ingredients || ""}
                            onChange={(event) =>
                              nested(
                                "labelDeclaration",
                                "ingredients",
                                event.target.value
                              )
                            }
                            placeholder="Copy the ingredients from the package"
                          />
                        </EditorField>
                        <EditorField title="Allergen statement printed on label (optional)">
                          <textarea
                            rows={2}
                            className={field}
                            value={form.labelDeclaration?.allergens || ""}
                            onChange={(event) =>
                              nested(
                                "labelDeclaration",
                                "allergens",
                                event.target.value
                              )
                            }
                            placeholder="Copy the exact statement from the package"
                          />
                        </EditorField>
                        <EditorField title="Claims printed on label (optional)">
                          <textarea
                            rows={2}
                            className={field}
                            value={form.labelDeclaration?.claims || ""}
                            onChange={(event) =>
                              nested(
                                "labelDeclaration",
                                "claims",
                                event.target.value
                              )
                            }
                            placeholder="Enter only claims visible on the package"
                          />
                        </EditorField>
                      </div>
                    </>
                  )}
                  {isRecipe && (
                    <EditorField title="Cuisine (optional)">
                      <input
                        className={field}
                        maxLength={100}
                        value={form.cuisine || ""}
                        onChange={(event) =>
                          patch("cuisine", event.target.value)
                        }
                        placeholder="e.g. Indian"
                      />
                    </EditorField>
                  )}
                  {isRecipe && (
                    <EditorField title="Preparation time (minutes)">
                      <input
                        className={field}
                        type="number"
                        min="0"
                        step="1"
                        value={form.preparationMinutes ?? ""}
                        onChange={(event) =>
                          patch("preparationMinutes", event.target.value)
                        }
                      />
                    </EditorField>
                  )}
                  {isRecipe && (
                    <EditorField title="Cooking time (minutes)">
                      <input
                        className={field}
                        type="number"
                        min="0"
                        step="1"
                        value={form.cookingMinutes ?? ""}
                        onChange={(event) =>
                          patch("cookingMinutes", event.target.value)
                        }
                      />
                    </EditorField>
                  )}
                  {isRecipe && (
                    <EditorField title="Servings / batch yield">
                      <input
                        type="number"
                        min="1"
                        className={field}
                        value={form.baseServings ?? ""}
                        onChange={(event) =>
                          patch("baseServings", event.target.value)
                        }
                      />
                    </EditorField>
                  )}
                  {isRecipe && (
                    <EditorField title="How difficult is this recipe?">
                      <select
                        aria-label="Recipe difficulty"
                        className={field}
                        value={form.difficulty || "not_declared"}
                        onChange={(event) =>
                          patch("difficulty", event.target.value)
                        }
                      >
                        <option value="not_declared">Not declared</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </EditorField>
                  )}
                </div>
                <EditorField title="Description">
                  <textarea
                    rows={2}
                    maxLength={3000}
                    className={`${field} mt-4`}
                    value={form.description}
                    onChange={(event) =>
                      patch("description", event.target.value)
                    }
                  />
                </EditorField>
                {workspace === "hybrid" && form.type === "kitchen_recipe" && (
                  <fieldset
                    className="uel-hybrid-recipe-choice mt-5"
                    aria-label="Recipe publishing choice"
                  >
                    <legend className="font-bold text-[#173F35]">
                      What would you like to do with this recipe?
                    </legend>
                    <p className="mt-1 text-sm text-[#4A5850]">
                      A recipe can be shared without a price. Choose the second
                      option only if you will prepare and sell the finished
                      food.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={!form.sellReadyMade}
                        className="uel-hybrid-choice"
                        data-selected={!form.sellReadyMade}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            shareRecipe: true,
                            sellReadyMade: false,
                          }))
                        }
                      >
                        <strong>Share recipe only</strong>
                        <span>
                          Ingredients, steps, photos and food information. No
                          selling price or stock required.
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={Boolean(form.sellReadyMade)}
                        className="uel-hybrid-choice"
                        data-selected={Boolean(form.sellReadyMade)}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            shareRecipe: true,
                            sellReadyMade: true,
                          }))
                        }
                      >
                        <strong>Share & sell the finished dish</strong>
                        <span>
                          Add price, stock, delivery coverage and a kitchen
                          outlet for review.
                        </span>
                      </button>
                    </div>
                  </fieldset>
                )}
                {workspace !== "hybrid" &&
                  isRecipe &&
                  ["kitchen_recipe", "prepared_food"].includes(form.type) && (
                    <div className="mt-4 space-y-2">
                      <div className="flex flex-wrap gap-6 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.shareRecipe}
                            onChange={(event) =>
                              patch("shareRecipe", event.target.checked)
                            }
                          />{" "}
                          Share recipe
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.sellReadyMade}
                            disabled={form.type === "prepared_food"}
                            onChange={(event) =>
                              patch("sellReadyMade", event.target.checked)
                            }
                          />{" "}
                          Sell ready-made item
                        </label>
                      </div>
                      {!form.shareRecipe && (
                        <p className="text-sm leading-5 text-[#935130]">
                          Ingredients and cooking steps will be saved for your
                          kitchen but will stay hidden from customers. Enable
                          Share recipe to publish them after approval.
                        </p>
                      )}
                    </div>
                  )}
              </section>
              <section id="listing-media" className={section}>
                <h2 className="text-2xl font-bold">
                  <span className="uel-section-number">02</span> / Show it
                  beautifully {isRecipe ? "— photos & video" : "— photos"}
                </h2>
                <p className="mt-1 text-sm text-[#4A5850]">
                  Show customers what they will get. Add clear, real photos; for
                  recipes, you can also include a cooking video and ingredient
                  photos.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {form.images.map((url, index) => {
                    const role = (form.imageRoles || []).find(
                      (item) => item.url === url
                    )?.role;
                    return (
                      <div key={`${url}-${index}`} className="relative">
                        <img
                          alt={`Listing photo ${index + 1}`}
                          src={url}
                          className="h-24 w-28 rounded-lg object-cover"
                        />
                        {role && (
                          <span className="mt-1 block max-w-28 text-[13px] font-semibold leading-5 text-[#173F35]">
                            {groceryPhotoRoleLabels[role] || ""}
                          </span>
                        )}
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded bg-white p-1"
                          aria-label={`Remove photo ${index + 1}`}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              images: current.images.filter(
                                (_, i) => i !== index
                              ),
                              imageRoles: (current.imageRoles || []).filter(
                                (item) => item.url !== url
                              ),
                            }))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#173F35] px-4 py-3 text-sm font-semibold text-[#173F35]">
                  <ImagePlus size={18} />
                  {uploading.startsWith("images")
                    ? "Uploading..."
                    : "Upload listing photo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={Boolean(uploading) || form.images.length >= 12}
                    onChange={(event) => {
                      uploadImage(event.target.files?.[0], "images");
                      event.target.value = "";
                    }}
                  />
                </label>
                {form.type === "grocery" && (
                  <details className="uel-packaging-details">
                    <summary
                      className="uel-packaging-toggle"
                      aria-label="Expand optional packaging and label photo uploads"
                    >
                      <span className="uel-packaging-symbol">
                        <ImagePlus size={22} aria-hidden="true" />
                      </span>
                      <span className="uel-packaging-caption">
                        <strong>Add packaging & label photos</strong>
                        <small>
                          7 photo types · Click to choose and upload
                        </small>
                      </span>
                      <span className="uel-packaging-optional">OPTIONAL</span>
                      <ChevronDown
                        size={21}
                        className="uel-packaging-arrow"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="uel-packaging-body">
                      <p className="text-[15px] leading-6 text-[#465A4F]">
                        Have photos of the ingredients, nutrition label, barcode
                        or other packaging details? Add only what is relevant.
                        None of these seven photos is required.
                      </p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1">
                          <EditorField title="Packaging photo type">
                            <select
                              aria-label="Optional packaging photo type"
                              className={field}
                              value={selectedGroceryPhotoRole}
                              onChange={(event) =>
                                setSelectedGroceryPhotoRole(event.target.value)
                              }
                            >
                              {groceryPhotoRoles.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </EditorField>
                        </div>
                        <label className="uel-packaging-upload inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-[15px]">
                          <ImagePlus size={18} aria-hidden="true" />
                          {uploading.startsWith("images")
                            ? "Uploading..."
                            : "Upload this photo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            disabled={
                              Boolean(uploading) || form.images.length >= 12
                            }
                            onChange={(event) => {
                              uploadImage(
                                event.target.files?.[0],
                                "images",
                                -1,
                                selectedGroceryPhotoRole
                              );
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <p className="mt-3 text-[14px] text-[#54635B]">
                        {form.images.length}/12 total listing photos uploaded.
                        You can skip all extra packaging photos.
                      </p>
                    </div>
                  </details>
                )}
                {isRecipe && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="min-w-0">
                      <p className="uel-label mb-2 block">
                        Recipe video (optional)
                      </p>
                      {form.videoUrl && form.videoFileName ? (
                        <div className="uel-video-uploaded">
                          <div className="min-w-0">
                            <span className="text-[13px] text-[#557366]">
                              Uploaded from your device
                            </span>
                            <strong className="uel-video-filename">
                              {form.videoFileName}
                            </strong>
                          </div>
                          <a
                            className="uel-video-link"
                            href={form.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Preview video{" "}
                            <ArrowUpRight size={15} className="inline" />
                          </a>
                        </div>
                      ) : (
                        <input
                          aria-label="Recipe video HTTPS link"
                          className={field}
                          type="url"
                          value={form.videoUrl || ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              videoUrl: event.target.value,
                              videoFileName: "",
                            }))
                          }
                          placeholder="Paste an HTTPS video link (optional)"
                        />
                      )}
                      {form.videoUrl && form.videoFileName && (
                        <button
                          type="button"
                          className="mt-2 text-[13px] font-semibold text-[#315A4A] underline underline-offset-2"
                          onClick={() => patch("videoFileName", "")}
                        >
                          Edit video URL manually
                        </button>
                      )}
                    </div>
                    <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#173F35] bg-[#F7F6F2] px-4 py-3 text-[15px] font-semibold text-[#173F35]">
                      <UploadCloud size={18} />
                      {uploading === "video"
                        ? "Uploading..."
                        : form.videoUrl
                        ? "Replace video"
                        : "Upload video (50 MB max)"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="video/mp4,video/webm"
                        disabled={Boolean(uploading)}
                        onChange={(event) => {
                          uploadVideo(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
              </section>
              {isRecipe && (
                <section
                  id="listing-ingredients"
                  className={`${section} uel-ingredient-editor`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">
                      <span className="uel-section-number">03</span> /
                      Ingredients & costing
                    </h2>
                    <button
                      className={styles.secondary}
                      type="button"
                      onClick={() =>
                        patch("ingredients", [
                          ...form.ingredients,
                          emptyIngredient(),
                        ])
                      }
                    >
                      <Plus size={16} className="mr-1 inline" /> Add ingredient
                    </button>
                  </div>
                  <p className="uel-ingredient-intro">
                    List what goes into this recipe. For costs, enter what you
                    paid for the full purchased pack and how much of it you use.
                    We'll calculate the ingredient cost automatically.
                  </p>
                  <div className="uel-ingredient-list">
                    {form.ingredients.map((item, index) => (
                      <div key={index} className="uel-ingredient-row">
                        <div className="uel-ingredient-heading">
                          <h3>
                            Ingredient {String(index + 1).padStart(2, "0")}
                            {item.name ? (
                              <span className="ml-2 text-[14px] font-medium text-[#617565]">
                                · {item.name}
                              </span>
                            ) : null}
                          </h3>
                          <button
                            type="button"
                            className="uel-row-delete"
                            disabled={form.ingredients.length === 1}
                            onClick={() => removeRow("ingredients", index)}
                            aria-label={`Remove ingredient ${index + 1}`}
                          >
                            <Trash2 size={16} /> Remove
                          </button>
                        </div>
                        <div className="uel-ingredient-fields">
                          <div className="uel-span-two">
                            <EditorField title="Ingredient name">
                              <IngredientNameInput
                                className={field}
                                ingredient={item}
                                onChange={(value) =>
                                  updateRow("ingredients", index, value)
                                }
                              />
                            </EditorField>
                          </div>
                          <EditorField title="Quantity used in recipe">
                            <input
                              className={field}
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity ?? ""}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  quantity: event.target.value,
                                })
                              }
                            />
                          </EditorField>
                          <EditorField title="Unit used">
                            <select
                              className={field}
                              value={item.unit}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  unit: event.target.value,
                                })
                              }
                            >
                              {units.map((unit) => (
                                <option key={unit}>{unit}</option>
                              ))}
                            </select>
                          </EditorField>
                          <EditorField title="Price paid for purchased pack (₹)">
                            <input
                              className={field}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice ?? ""}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  unitPrice: event.target.value,
                                })
                              }
                            />
                          </EditorField>
                          <EditorField title="Amount in purchased pack">
                            <input
                              className={field}
                              type="number"
                              min="0"
                              step="any"
                              value={item.priceQuantity ?? ""}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  priceQuantity: event.target.value,
                                })
                              }
                            />
                          </EditorField>
                          <EditorField title="Purchased pack unit">
                            <select
                              className={field}
                              value={item.priceUnit}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  priceUnit: event.target.value,
                                })
                              }
                            >
                              {units.map((unit) => (
                                <option key={unit}>{unit}</option>
                              ))}
                            </select>
                          </EditorField>
                          <div>
                            <EditorField title="Ingredient photo (optional)">
                              <IngredientPhotoPicker
                                ingredient={item}
                                index={index}
                                uploading={uploading}
                                uploadImage={uploadImage}
                                onChange={(value) =>
                                  updateRow("ingredients", index, value)
                                }
                              />
                            </EditorField>
                          </div>
                          <EditorField title="Used as">
                            <select
                              className={field}
                              value={item.role || "main"}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  role: event.target.value,
                                })
                              }
                            >
                              <option value="main">Main ingredient</option>
                              <option value="optional">Optional</option>
                              <option value="garnish">Garnish</option>
                            </select>
                          </EditorField>
                          <EditorField title="Preparation (optional)">
                            <input
                              className={field}
                              maxLength={120}
                              value={item.preparationState || ""}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  preparationState: event.target.value,
                                })
                              }
                              placeholder="e.g. Finely chopped"
                            />
                          </EditorField>
                          <EditorField title="When changing servings">
                            <select
                              className={field}
                              value={item.scalingRule || "proportional"}
                              onChange={(event) =>
                                updateRow("ingredients", index, {
                                  scalingRule: event.target.value,
                                })
                              }
                            >
                              <option value="proportional">
                                Adjust quantity
                              </option>
                              <option value="fixed">Keep quantity fixed</option>
                            </select>
                          </EditorField>
                          <div className="uel-span-full">
                            <EditorField title="Preparation / purchasing note (optional)">
                              <input
                                className={field}
                                value={item.note || ""}
                                onChange={(event) =>
                                  updateRow("ingredients", index, {
                                    note: event.target.value,
                                  })
                                }
                                placeholder="Example: Finely chopped, or purchased from local market"
                              />
                            </EditorField>
                          </div>
                          <div className="uel-span-full uel-ingredient-cost">
                            <span>Estimated cost used in this recipe</span>
                            <strong>{formatMoney(costs[index])}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="uel-cost-total" aria-live="polite">
                    <span>
                      <strong>Ingredient total:</strong>{" "}
                      {formatMoney(ingredientCost)}
                    </span>
                    <span>
                      <strong>Complete cost:</strong>{" "}
                      {formatMoney(completeCost)}
                    </span>
                    <span>
                      <strong>Per serving:</strong>{" "}
                      {completeCost !== null && Number(form.baseServings) > 0
                        ? formatMoney(completeCost / Number(form.baseServings))
                        : "Not available"}
                    </span>
                    <span className="uel-cost-note">
                      {costingComplete
                        ? "All ingredient prices have been entered."
                        : "Add purchased-pack prices and quantities to complete the estimate."}{" "}
                      Estimated from Host-entered prices.
                    </span>
                  </div>
                </section>
              )}
              {isRecipe && (
                <section
                  id="listing-steps"
                  className={`${section} uel-steps-editor`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">
                      <span className="uel-section-number">04</span> / How to
                      make it
                    </h2>
                  </div>
                  <p className="uel-step-intro">
                    Write each action in the order it happens. Add an
                    approximate time only when useful; customers can follow
                    these instructions step by step.
                  </p>
                  <div className="uel-step-list">
                    {form.steps.map((step, index) => (
                      <div key={index} className="uel-step-row">
                        <span
                          className="uel-step-index"
                          aria-label={`Step ${index + 1}`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="uel-step-text">
                          <EditorField title={`Step ${index + 1} · What to do`}>
                            <textarea
                              className={field}
                              rows={2}
                              value={step.instruction || ""}
                              onChange={(event) =>
                                updateRow("steps", index, {
                                  instruction: event.target.value,
                                })
                              }
                              placeholder="Example: Heat oil and add cumin seeds."
                            />
                          </EditorField>
                        </div>
                        <div className="uel-step-time">
                          <EditorField title="Time (minutes, optional)">
                            <input
                              className={field}
                              type="number"
                              min="0"
                              value={step.timerMinutes ?? ""}
                              onChange={(event) =>
                                updateRow("steps", index, {
                                  timerMinutes: event.target.value,
                                })
                              }
                              placeholder="e.g. 5"
                            />
                          </EditorField>
                        </div>
                        <button
                          type="button"
                          className="uel-row-delete uel-step-remove"
                          title={`Remove step ${index + 1}`}
                          aria-label={`Remove step ${index + 1}`}
                          disabled={form.steps.length === 1}
                          onClick={() => removeRow("steps", index)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`${styles.secondary} uel-step-add-bottom`}
                    onClick={() => patch("steps", [...form.steps, emptyStep()])}
                  >
                    <Plus size={17} className="mr-1 inline" /> Add step
                  </button>
                </section>
              )}
            </fieldset>
            <fieldset
              disabled={busy || loading}
              className="uel-form uel-updatable-fields min-w-0 disabled:opacity-85"
            >
              {locked && (
                <p className="uel-revision-note" role="status">
                  <strong>Editing a previously submitted listing:</strong> Only
                  Food facts & allergens and Selling & delivery can be changed
                  here. Saving sends these changes to Super Admin again. Your
                  last approved version remains visible until Super Admin
                  reviews the changes.
                </p>
              )}
              <section
                id="listing-nutrition"
                className={`${section} ${locked ? "uel-locked-section" : ""}`}
              >
                <h2 className="text-2xl font-bold">
                  <span className="uel-section-number">
                    {isRecipe ? "05" : "03"}
                  </span>{" "}
                  / Food facts & allergens
                </h2>
                <p className="mt-2 text-sm text-[#4A5850]">
                  Only enter values you can support with evidence. Leave unknown
                  information undeclared.
                </p>
                {locked && (
                  <span className="uel-editable-marker">
                    Editable · re-approval required
                  </span>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <EditorField title="Nutrition basis">
                    <input
                      className={field}
                      value={form.nutrition?.basis || ""}
                      onChange={(event) =>
                        nested("nutrition", "basis", event.target.value)
                      }
                    />
                  </EditorField>
                  {fields.map((item) => (
                    <EditorField
                      key={item}
                      title={item.replace(/([A-Z])/g, " $1")}
                    >
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={field}
                        value={form.nutrition?.[item] ?? ""}
                        onChange={(event) =>
                          nested("nutrition", item, event.target.value)
                        }
                      />
                    </EditorField>
                  ))}
                  {workspace !== "hybrid" && (
                    <EditorField title="Dietary declaration">
                      <select
                        value={form.dietary}
                        className={field}
                        onChange={(event) =>
                          patch("dietary", event.target.value)
                        }
                      >
                        {[
                          "not_declared",
                          "vegetarian",
                          "vegan",
                          "non_vegetarian",
                          "other",
                        ].map((item) => (
                          <option key={item} value={item}>
                            {item.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </EditorField>
                  )}
                </div>
                <h3 className="mt-5 text-lg font-semibold">
                  Allergen information
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allergenNames.map((key) => (
                    <EditorField key={key} title={key.replaceAll("_", " ")}>
                      <select
                        className={field}
                        value={
                          form.allergens.find((item) => item.key === key)
                            ?.relationship || ""
                        }
                        onChange={(event) =>
                          patch("allergens", [
                            ...form.allergens.filter(
                              (item) => item.key !== key
                            ),
                            ...(event.target.value
                              ? [{ key, relationship: event.target.value }]
                              : []),
                          ])
                        }
                      >
                        <option value="">Not declared</option>
                        <option value="contains">Contains</option>
                        <option value="may_contain">May contain</option>
                        <option value="does_not_contain">
                          Does not contain
                        </option>
                        <option value="unknown">Unknown / not verified</option>
                      </select>
                    </EditorField>
                  ))}
                </div>
                <div className="uel-other-allergen">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[16px] font-bold text-[#173F35]">
                        Another allergen to declare?
                      </h4>
                      <p className="mt-1 text-[14px] text-[#52665A]">
                        Only add one if relevant. Additional allergens are
                        optional.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="uel-other-allergen-button"
                      aria-expanded={showOtherAllergen}
                      onClick={() =>
                        setShowOtherAllergen((current) => !current)
                      }
                    >
                      <Plus size={17} /> Other allergen
                    </button>
                  </div>
                  {customAllergens.length > 0 && (
                    <div className="uel-custom-allergen-list">
                      {customAllergens.map((entry) => (
                        <div
                          className="uel-custom-allergen-item"
                          key={entry.key}
                        >
                          <strong>{entry.key.replaceAll("_", " ")}</strong>
                          <select
                            className={field}
                            aria-label={`Declaration for ${entry.key.replaceAll(
                              "_",
                              " "
                            )}`}
                            value={entry.relationship}
                            onChange={(event) =>
                              patch(
                                "allergens",
                                form.allergens.map((item) =>
                                  item.key === entry.key
                                    ? {
                                        ...item,
                                        relationship: event.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            <option value="contains">Contains</option>
                            <option value="may_contain">May contain</option>
                            <option value="does_not_contain">
                              Does not contain
                            </option>
                            <option value="unknown">
                              Unknown / not verified
                            </option>
                          </select>
                          <button
                            type="button"
                            className="uel-row-delete"
                            onClick={() =>
                              patch(
                                "allergens",
                                form.allergens.filter(
                                  (item) => item.key !== entry.key
                                )
                              )
                            }
                          >
                            <Trash2 size={15} /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showOtherAllergen && (
                    <div className="uel-custom-allergen-row">
                      <EditorField title="Allergen name">
                        <input
                          className={field}
                          value={otherAllergenName}
                          maxLength={70}
                          onChange={(event) =>
                            setOtherAllergenName(event.target.value)
                          }
                          placeholder="e.g. Mustard"
                        />
                      </EditorField>
                      <EditorField title="Declaration">
                        <select
                          className={field}
                          value={otherAllergenStatus}
                          onChange={(event) =>
                            setOtherAllergenStatus(event.target.value)
                          }
                        >
                          <option value="">Choose</option>
                          <option value="contains">Contains</option>
                          <option value="may_contain">May contain</option>
                          <option value="does_not_contain">
                            Does not contain
                          </option>
                          <option value="unknown">
                            Unknown / not verified
                          </option>
                        </select>
                      </EditorField>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={addOtherAllergen}
                      >
                        Add allergen
                      </button>
                    </div>
                  )}
                </div>
                <EditorField title="Evidence / calculation note">
                  <textarea
                    rows={2}
                    className={`${field} mt-4`}
                    value={form.nutrition?.evidenceNote || ""}
                    onChange={(event) =>
                      nested("nutrition", "evidenceNote", event.target.value)
                    }
                  />
                </EditorField>
              </section>
              {canSell && (
                <section
                  id="listing-selling"
                  className={`${section} ${locked ? "uel-locked-section" : ""}`}
                >
                  <span id="listing-delivery" />
                  <h2 className="text-2xl font-bold">
                    <span className="uel-section-number">
                      {isRecipe ? "06" : "04"}
                    </span>{" "}
                    / Selling & delivery
                  </h2>
                  <p className="mt-1 text-sm text-[#4A5850]">
                    Set your pricing, available stock and delivery coverage.
                    These details are reviewed here; your existing selling and
                    delivery settings still control live orders.
                  </p>
                  {locked && (
                    <span className="uel-editable-marker">
                      Editable · re-approval required
                    </span>
                  )}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["listPrice", "List price (Rs)"],
                      ["salePrice", "Selling price (Rs)"],
                      ["stockQuantity", "Available stock"],
                      ["packagingCost", "Packaging cost (Rs)"],
                      ["labourCost", "Preparation / staff cost (₹, optional)"],
                    ].map(([key, title]) => (
                      <EditorField key={key} title={title}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={field}
                          value={form.selling?.[key] ?? ""}
                          onChange={(event) =>
                            nested("selling", key, event.target.value)
                          }
                        />
                      </EditorField>
                    ))}
                    {form.type !== "grocery" && (
                      <div className="sm:col-span-2 lg:col-span-4">
                        <span className={`${styles.label} mb-1.5 block`}>
                          Approved product match (optional)
                        </span>
                        <button
                          type="button"
                          disabled={
                            productMatchBusy || form.title.trim().length < 3
                          }
                          onClick={findPublishedProduct}
                          className={styles.secondary}
                        >
                          {productMatchBusy
                            ? "Searching..."
                            : "Find approved product"}
                        </button>
                        {form.catalogProductVersionId && (
                          <button
                            type="button"
                            className={`${styles.secondary} ml-2`}
                            onClick={() => patch("catalogProductVersionId", "")}
                          >
                            Clear match
                          </button>
                        )}
                        {publishedProductMatches.length > 0 && (
                          <div
                            className="mt-2 border border-[#CAD8CC] p-3"
                            role="group"
                            aria-label="Approved catalog products"
                          >
                            {publishedProductMatches.map((product) => (
                              <label
                                className="flex items-start gap-2 py-1.5"
                                key={product.id}
                              >
                                <input
                                  type="radio"
                                  checked={
                                    form.catalogProductVersionId === product.id
                                  }
                                  onChange={() => {
                                    setForm((current) => ({
                                      ...current,
                                      catalogProductVersionId: product.id,
                                      selling: {
                                        ...current.selling,
                                        packQuantity: product.quantity ?? "",
                                        packUnit: product.unit || "piece",
                                      },
                                    }));
                                  }}
                                />
                                <span>
                                  {product.title} —{" "}
                                  {product.quantity ?? "Quantity not stated"}{" "}
                                  {product.unit}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-sm text-[#4A5850]">
                          Select an existing approved match when available. For
                          a new item, one Super Admin approval will create its
                          product and activate selling.
                        </p>
                      </div>
                    )}
                    <EditorField title="Stock unit">
                      <input
                        className={field}
                        value={form.selling?.stockUnit || "piece"}
                        onChange={(event) =>
                          nested("selling", "stockUnit", event.target.value)
                        }
                      />
                    </EditorField>
                    <EditorField title="Pack / portion quantity">
                      <input
                        className={field}
                        type="number"
                        min="0"
                        step="any"
                        value={form.selling?.packQuantity ?? ""}
                        onChange={(event) =>
                          nested("selling", "packQuantity", event.target.value)
                        }
                      />
                    </EditorField>
                    <EditorField title="Pack / portion unit">
                      <select
                        className={field}
                        value={form.selling?.packUnit || "piece"}
                        onChange={(event) =>
                          nested("selling", "packUnit", event.target.value)
                        }
                      >
                        {units.map((unit) => (
                          <option key={unit}>{unit}</option>
                        ))}
                      </select>
                    </EditorField>
                    <EditorField title="Minimum order quantity">
                      <input
                        className={field}
                        type="number"
                        min="1"
                        step="1"
                        value={form.selling?.minimumOrderQuantity ?? ""}
                        onChange={(event) =>
                          nested(
                            "selling",
                            "minimumOrderQuantity",
                            event.target.value
                          )
                        }
                      />
                    </EditorField>
                    <EditorField title="Maximum order quantity (optional)">
                      <input
                        className={field}
                        type="number"
                        min="1"
                        step="1"
                        value={form.selling?.maximumOrderQuantity ?? ""}
                        onChange={(event) =>
                          nested(
                            "selling",
                            "maximumOrderQuantity",
                            event.target.value
                          )
                        }
                      />
                    </EditorField>

                    {isRecipe && (
                      <EditorField
                        title={
                          canSell
                            ? "Kitchen outlet (required for selling)"
                            : "Kitchen outlet (optional)"
                        }
                      >
                        <select
                          className={field}
                          value={form.selling?.outletId || ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              selling: {
                                ...current.selling,
                                outletId: event.target.value,
                                menuId: "",
                              },
                            }))
                          }
                        >
                          <option value="">
                            Choose an existing kitchen outlet
                          </option>
                          {outlets.map((outlet) => (
                            <option key={outlet.id} value={outlet.id}>
                              {outlet.name || outlet.outletCode}
                            </option>
                          ))}
                        </select>
                      </EditorField>
                    )}
                    {isRecipe && (
                      <EditorField title="Restaurant menu (if available)">
                        <select
                          className={field}
                          value={form.selling?.menuId || ""}
                          onChange={(event) =>
                            nested("selling", "menuId", event.target.value)
                          }
                        >
                          <option value="">No menu selected</option>
                          {menus
                            .filter(
                              (menu) =>
                                !form.selling?.outletId ||
                                menu.outletId === form.selling.outletId
                            )
                            .map((menu) => (
                              <option key={menu.id} value={menu.id}>
                                {menu.name || menu.menuCode}
                              </option>
                            ))}
                        </select>
                      </EditorField>
                    )}
                    {isRecipe && (
                      <EditorField title="Fulfilment">
                        <select
                          className={field}
                          value={form.delivery?.fulfillment || "delivery"}
                          onChange={(event) =>
                            nested(
                              "delivery",
                              "fulfillment",
                              event.target.value
                            )
                          }
                        >
                          <option value="delivery">Delivery</option>
                          <option value="pickup">Pickup</option>
                        </select>
                      </EditorField>
                    )}
                    {isRecipe && (
                      <EditorField title="Preparation time (minutes)">
                        <input
                          type="number"
                          min="0"
                          className={field}
                          value={form.delivery?.preparationMinutes ?? ""}
                          onChange={(event) =>
                            nested(
                              "delivery",
                              "preparationMinutes",
                              event.target.value
                            )
                          }
                        />
                      </EditorField>
                    )}
                  </div>
                  {form.delivery?.fulfillment === "delivery" && (
                  hasLegacyDeliveryCoverage ? (
                    <EditorField title="Delivery pincodes (saved listing)">
                      <textarea
                        rows={2}
                        className={`${field} mt-3`}
                        value={pincodeText}
                        onChange={(event) => {
                          pincodeEditedRef.current = true;
                          setPincodeText(event.target.value);
                          nested(
                            "delivery",
                            "postalCodes",
                            event.target.value.split(/[\s,;]+/).filter(Boolean)
                          );
                        }}
                        placeholder="110001, 110002"
                      />
                    </EditorField>
                  ) : (
                    <div className="mt-3 rounded-xl border border-[#C9D5C9] bg-[#EFF3EC] px-4 py-3 text-[15px] text-[#173F35]">
                      {savedPostalCodes.length
                        ? `Business delivery coverage: ${savedPostalCodes.length} saved PIN codes.`
                        : "Add business delivery coverage in Operations Center before submitting a delivery listing."}
                      <Link className="ml-2 font-semibold underline underline-offset-2" to="/host/operations-center">
                        Manage coverage
                      </Link>
                    </div>
                  )
                )}
                <EditorField title="Delivery / pickup notes">
                    <textarea
                      rows={2}
                      className={`${field} mt-3`}
                      value={form.delivery?.note || ""}
                      onChange={(event) =>
                        nested("delivery", "note", event.target.value)
                      }
                    />
                  </EditorField>
                </section>
              )}
              {editingId && canSell && sellingReadiness && (
                <div
                  className="mb-4 border-l-4 border-[#173F35] bg-[#EEF2EA] p-4"
                  role="status"
                >
                  <p className="font-semibold text-[#173F35]">Selling status</p>
                  <p className="mt-1 text-sm text-[#40544A]">
                    {sellingReadiness.message}
                  </p>
                  {activeListing?.status === "approved" &&
                    sellingReadiness?.offerStatus !== "active" && (
                      <button
                        type="button"
                        disabled={busy || Boolean(uploading)}
                        onClick={resendSavedListingForSelling}
                        className={`${styles.button} mt-3`}
                      >
                        <Send size={17} className="mr-2 inline" />
                        Send saved listing for selling approval
                      </button>
                    )}
                  {sellingReadiness?.offerStatus === "active" && (
                    <p className="mt-2 text-sm font-semibold text-[#245A43]">
                      Customers can order this item using the approved selling
                      details. No extra setup required.
                    </p>
                  )}
                </div>
              )}
              <section className={`${section} uel-review`}>
                <h2 className="text-xl font-bold">Ready for review?</h2>
                <p className="mt-2 text-sm text-[#4A5850]">
                  {locked
                    ? "Food facts, allergens, pricing and delivery are editable. Your other details stay protected; these changes require Super Admin review before publishing."
                    : "Save your progress or submit this complete listing once. Super Admin approval publishes the item and activates its selling details together."}
                </p>
                {locked ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || Boolean(uploading) || activeListing?.status === "submitted_for_review"}
                      onClick={saveSectionRevision}
                      className={styles.button}
                    >
                      {activeListing?.status === "submitted_for_review" ? (
                        <>
                          <CheckCircle2 size={17} className="mr-2 inline" />
                          Submitted for review
                        </>
                      ) : (
                        <>
                          <Send size={17} className="mr-2 inline" />
                          Save changes & send for review
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || Boolean(uploading)}
                      onClick={() => save(false)}
                      className={styles.secondary}
                    >
                      <Save size={17} className="mr-2 inline" />
                      Save full draft
                    </button>
                    <button
                      type="button"
                      disabled={busy || Boolean(uploading)}
                      onClick={() => save(true)}
                      className={styles.button}
                    >
                      <Send size={17} className="mr-2 inline" />
                      Save & submit for review
                    </button>
                  </div>
                )}
              </section>
            </fieldset>
            {editingId &&
              canSell &&
              sellingReadiness?.catalogLinked &&
              sellingReadiness?.offerStatus !== "active" && (
                <HostListingSalesSetup
                  listingId={editingId}
                  listing={activeListing?.packet || form}
                  readiness={sellingReadiness}
                  onUpdated={() => {
                    load();
                    getHostListingSellingReadiness(editingId)
                      .then((data) =>
                        setSellingReadiness(data?.readiness || null)
                      )
                      .catch(() => {});
                  }}
                />
              )}
          </>
        )}
        <section className="uel-history" aria-labelledby="uel-history-title">
          <div className="uel-history-head">
            <div>
              <p className="uel-eyebrow">05 / YOUR LISTINGS</p>
              <h2 id="uel-history-title">Your listings & drafts</h2>
              <p className="mt-2">Edit, review or manage your listings.</p>
            </div>
            <span className="uel-history-count">
              {existing.length} {existing.length === 1 ? "listing" : "listings"}{" "}
              in total
            </span>
          </div>
          <div
            className="uel-history-filters"
            role="group"
            aria-label="Filter saved listings by status"
          >
            {historyFilters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="uel-history-filter"
                data-active={historyFilter === key}
                aria-pressed={historyFilter === key}
                onClick={() => { setHistoryFilter(key); setHistoryPagesVisible(1); }}
              >
                {label} <b>{historyCount(key)}</b>
              </button>
            ))}
          </div>
          <div className="uel-packet-list">
            {filteredHistory.length ? (
              visibleHistory.map((item) => (
                <div key={item.id} className="uel-packet-row">
                  <div className="uel-packet-main">
                    <div className="uel-packet-photo">
                      {item.packet?.images?.[0] ? (
                        <img
                          src={item.packet.images[0]}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <Package
                          size={24}
                          strokeWidth={1.6}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="uel-packet-title">
                        {item.title || "Untitled draft"}
                      </p>
                      <p className="uel-packet-meta">
                        {item.type.replaceAll("_", " ")}
                        {listingUpdatedDate(item.updatedAt)
                          ? ` · Updated ${listingUpdatedDate(item.updatedAt)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <span className="uel-packet-status" data-status={item.status}>
                    {listingStatusLabel(item.status)}
                  </span>
                  <div className="uel-packet-controls">
                    <button
                      type="button"
                      className={`${styles.secondary} uel-packet-action`}
                      onClick={() => {
                        // Reopen in view mode so the original Edit complete listing prompt is shown.
                        setRevisingApproved(false);
                        setParams({ edit: item.id });
                        setActiveTab("single");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      {[
                        "submitted_for_review",
                        "approved",
                        "rejected",
                      ].includes(item.status)
                        ? "View listing"
                        : "Continue editing"}{" "}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="uel-packet-delete"
                      disabled={busy || Boolean(uploading)}
                      aria-label={`Delete ${item.title || "listing"}`}
                      onClick={() => deleteListing(item)}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="uel-history-empty">
                {existing.length
                  ? "No listings match this status."
                  : "No listings yet. Save your first draft to see it here."}
                {existing.length > 0 && (
                  <button
                    type="button"
                    className="ml-3 font-bold underline underline-offset-4 text-[#173F35]"
                    onClick={() => setHistoryFilter("all")}
                  >
                    Show all
                  </button>
                )}
              </div>
            )}
          </div>
          {remainingHistory > 0 && (
            <div className="uel-history-progress" aria-live="polite">
              <span>Showing {visibleHistory.length} of {filteredHistory.length} listings</span>
              <button type="button" className="uel-history-view-more" onClick={() => setHistoryPagesVisible((current) => current + 1)}>
                View next {Math.min(bulkBatchPageSize, remainingHistory)} listings
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          <PreviouslyListedItems workspace={workspace} />
          {["b2b", "brand_seller", "hybrid", "legacy"].includes(workspace) && (
            <Link
              to="/host/listings/new?manage=offers-history"
              className="mt-3 inline-flex text-sm font-semibold text-[#173F35] underline underline-offset-4"
            >
              View earlier selling history
            </Link>
          )}
        </section>
        <p className="uel-hold-note">
          <ClipboardList size={17} className="mt-1 shrink-0" />
          <span>
            Non-food categories, including cosmetics and clothing, are not
            available for listing yet.
          </span>
        </p>
      </div>
    </main>
  );
}

// Restaurant/menu creation has one canonical place. Existing packets (edit=id)
// deliberately remain editable here to preserve existing Host drafts and history.
export default function HostUnifiedListingPage() {
  const { currentUser } = useAuth();
  const [params] = useSearchParams();
  const workspace = normalizeHostWorkspaceType(currentUser);
  const managementView = params.get("manage") || "";
  const canManageProducts = [
    "b2b",
    "brand_seller",
    "hybrid",
    "legacy",
  ].includes(workspace);
  const canManageBrandRecipes = ["brand_seller", "hybrid", "legacy"].includes(
    workspace
  );
  const canManageKitchenRecipes = [
    "chef_restaurant",
    "hybrid",
    "b2b",
    "legacy",
  ].includes(workspace);
  const legacySource = params.get("source") || "";
  const legacyPermitted =
    legacySource === "product-evidence"
      ? canManageProducts
      : legacySource === "brand-recipe"
      ? canManageBrandRecipes
      : legacySource === "restaurant-recipe"
      ? canManageKitchenRecipes
      : legacySource === "host-recipe"
      ? true
      : false;
  const management =
    managementView === "legacy" && legacyPermitted ? (
      <LegacyListingManager />
    ) : managementView === "product-evidence" && canManageProducts ? (
      <ProductEvidenceWorkspace />
    ) : managementView === "brand-recipes" && canManageBrandRecipes ? (
      <BrandRecipeHistoryWorkspace section="recipes" />
    ) : managementView === "kitchen-recipes" && canManageKitchenRecipes ? (
      <KitchenRecipeHistoryWorkspace />
    ) : managementView === "offers-history" && canManageProducts ? (
      <SellingHistoryWorkspace />
    ) : null;
  if (managementView) {
    if (!management) return <Navigate to="/host/listings/new" replace />;
    return (
      <div className="min-w-0 w-full">
        <div className="px-4 pt-5 sm:px-7">
          <Link
            to="/host/listings/new"
            className="inline-flex items-center gap-2 text-base font-semibold text-[#173F35]"
          >
            <ArrowLeft size={18} /> Back to Listing Studio
          </Link>
        </div>
        <Suspense
          fallback={
            <p className="p-6 text-base" role="status">
              Loading your listings…
            </p>
          }
        >
          {management}
        </Suspense>
      </div>
    );
  }
  return <HostUnifiedListingEditor />;
}
