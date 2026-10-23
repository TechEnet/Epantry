import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight, RefreshCw, Search, X } from "lucide-react";

import { Link } from "react-router-dom";

import { useAppStore } from "../../../store/app.store";

import AdvancedPantryPanel from "../../advancedExpansion/components/AdvancedPantryPanel";

import { getPantryStatePresentation } from "../components/PantryStateBadge";
import { getCatalogProducts } from "../../grocery/services/catalog.service";

import {
  getPantry,
  getPantryErrorMessage,
  stopTrackingPantryItem,
} from "../services/pantry.service";

const FILTERS = [
  {
    key: "all",

    label: "All",

    states: null,
  },

  {
    key: "confirmed",

    label: "Confirmed",

    states: ["confirmed_available", "replenished_elsewhere"],
  },

  {
    key: "likely",

    label: "Likely",

    states: ["inferred_available"],
  },

  {
    key: "running-low",

    label: "Running low",

    states: ["running_low"],
  },

  {
    key: "uncertain",

    label: "Needs checking",

    states: ["uncertain"],
  },

  {
    key: "out",

    label: "Out",

    states: ["out"],
  },

  {
    key: "not-tracking",

    label: "Not tracking",

    states: ["do_not_track"],
  },
];

function getItemId(item) {
  return item?._id || item?.id || item?.pantryItemId || null;
}

function getItemState(item) {
  return (
    item?.state ||
    item?.currentState ||
    item?.projectedState ||
    item?.projection?.state ||
    "uncertain"
  );
}

function getItemTitle(item) {
  return (
    item?.displayName ||
    item?.name ||
    item?.canonicalIngredient?.canonicalName ||
    item?.canonicalIngredient?.name ||
    item?.ingredient?.canonicalName ||
    item?.ingredient?.name ||
    item?.canonicalPack?.displayName ||
    item?.canonicalPack?.name ||
    item?.pack?.displayName ||
    "Pantry item"
  );
}

function getQuantity(item) {
  return (
    item?.quantity ||
    item?.currentQuantity ||
    item?.projectedQuantity ||
    item?.projection?.quantity ||
    null
  );
}

function formatQuantity(quantity) {
  if (!quantity || quantity.mode === "unknown") {
    return "Quantity not confirmed";
  }

  if (
    quantity.mode === "exact" &&
    quantity.value !== undefined &&
    quantity.value !== null
  ) {
    return `${quantity.value} ${quantity.unit || ""}`.trim();
  }

  if (
    quantity.mode === "range" &&
    quantity.min !== undefined &&
    quantity.max !== undefined
  ) {
    return `${quantity.min}–${quantity.max} ${quantity.unit || ""}`.trim();
  }

  if (quantity.value !== undefined && quantity.value !== null) {
    return `${quantity.value} ${quantity.unit || ""}`.trim();
  }

  return "Quantity not confirmed";
}

function formatDate(value) {
  if (!value) {
    return "No recent timestamp";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No recent timestamp";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(date);
}

function getUpdatedAt(item) {
  return (
    item?.lastObservedAt ||
    item?.lastObservationAt ||
    item?.projection?.observedAt ||
    item?.updatedAt ||
    null
  );
}

// Pantry records do not always carry photos. Use only actual images supplied
// by the Pantry or publicly approved Grocery catalog. Never substitute an
// unrelated product or invent a food photograph.
function getPantryImage(item) {
  const candidates = [
    item?.imageUrl,
    item?.thumbnailUrl,
    item?.photoUrl,
    item?.image?.url,
    item?.image?.src,
    item?.images?.[0]?.url,
    item?.canonicalPack?.imageUrl,
    item?.canonicalPack?.image?.url,
    item?.canonicalIngredient?.imageUrl,
  ];
  return (
    candidates.find(
      (url) => typeof url === "string" && /^(https?:\/\/|\/)/i.test(url.trim())
    ) || null
  );
}

function normalizedFoodName(value) {
  return String(value || "")
    .toLocaleLowerCase("en")
    .replace(
      /\b\d+(?:[.,]\d+)?\s*(?:kg|g|gm|ml|l|litre|liter|pcs|pieces|pack)\b/g,
      ""
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getMatchingCatalogPhoto(item, products) {
  const pantryName = normalizedFoodName(getItemTitle(item));
  const pantryPackId = String(
    item?.canonicalPackId || item?.canonicalPack?.id || ""
  );
  if (!pantryName) return null;
  const match = (products || []).find((product) => {
    if (!product?.image?.url) return false;
    if (pantryPackId && pantryPackId === String(product.packId || ""))
      return true;
    // A family is a canonical food identity; generic search hits or similar
    // products (e.g. onion powder for onion) are not sufficient evidence.
    return (
      normalizedFoodName(product.family?.name) === pantryName ||
      normalizedFoodName(product.displayName) === pantryName
    );
  });
  return match?.image?.url || null;
}

function PantryStatus({ state }) {
  const { label } = getPantryStatePresentation(state);
  const statusClass =
    {
      confirmed_available: "is-positive",
      replenished_elsewhere: "is-positive",
      running_low: "is-caution",
      out: "is-caution",
      inferred_available: "is-info",
      uncertain: "is-uncertain",
      do_not_track: "is-muted",
    }[state] || "is-uncertain";
  return <span className={`pk-status ${statusClass}`}>{label}</span>;
}

// Use only a Pantry image or a matching EPANTRY published catalog image.
// The text fallback is intentionally NOT a simulated product photograph.
function PantryItemVisual({ item, catalogImage = null, small = false }) {
  const title = getItemTitle(item);
  const photo = getPantryImage(item) || catalogImage;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo]);

  return (
    <div
      className={`pk-visual ${photo && !broken ? "pk-visual--photo" : ""} ${
        small ? "pk-visual--small" : ""
      }`}
    >
      {photo && !broken ? (
        <img
          src={photo}
          alt={title}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className="pk-visual__letter"
          aria-label={`No product image available for ${title}`}
        >
          {title.trim().charAt(0) || "P"}
        </span>
      )}
    </div>
  );
}

const PANTRY_STYLES = `
/* Living Pantry — EPANTRY editorial inventory, no shelf or 3D effects. */
.pk-page {--pk-porcelain:#F7F6F2;--pk-forest:#173F35;--pk-charcoal:#202421;--pk-sage:#D7DDCF;--pk-clay:#C56C42;--pk-line:rgba(23,63,53,.15);--pk-muted:#58645B;width:100%;max-width:none;min-width:0;margin:0;color:var(--pk-charcoal);background:var(--pk-porcelain);font:400 16px/1.55 'Plus Jakarta Sans',Inter,system-ui,sans-serif;}
.pk-page.page-shell {width:100%!important;max-width:none!important;margin:0!important;padding:0!important;}
.pk-page *, .pk-page *::before,.pk-page *::after {box-sizing:border-box;}
.pk-page button,.pk-page input {font:inherit;}
.pk-page a {text-decoration:none;}
.pk-page :is(button,a,input):focus-visible {outline:3px solid var(--pk-clay);outline-offset:3px;}
.pk-page button:disabled {opacity:.55;cursor:not-allowed;}
.pk-container {width:100%;max-width:none;margin-inline:0;padding-inline:clamp(18px,2vw,30px);}
.pk-kicker {display:inline-flex;align-items:center;gap:11px;color:var(--pk-forest);font-size:13px;font-weight:700;letter-spacing:.065em;text-transform:uppercase;}
.pk-kicker::before {content:'';display:inline-block;width:24px;height:2px;background:var(--pk-clay);flex:none;}
.pk-page .pk-title {max-width:650px;margin:14px 0 0;font-size:clamp(37px,4.2vw,60px)!important;font-weight:650!important;line-height:1.09!important;letter-spacing:-.05em;color:var(--pk-charcoal);}
.pk-page .pk-title span {color:var(--pk-forest);}
.pk-lead {max-width:580px;margin:17px 0 0;color:#49574E;font-size:16px;line-height:1.65;}
.pk-actions {display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:24px;}
.pk-btn {display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;border:1px solid transparent;border-radius:5px;padding:10px 19px;background:transparent;color:var(--pk-forest);font-size:14px;font-weight:700;line-height:1.3;cursor:pointer;transition:background-color .2s,color .2s,border-color .2s;white-space:normal;text-align:center;}
.pk-btn--main {background:var(--pk-forest);color:var(--pk-porcelain);}
.pk-btn--main:hover {background:#225545;}
.pk-btn--line {border-color:rgba(23,63,53,.25);background:transparent;color:var(--pk-forest);}
.pk-btn--line:hover {background:var(--pk-sage);}
.pk-btn--soft {background:var(--pk-sage);color:var(--pk-forest);}
.pk-btn--soft:hover {background:#c8d2bf;}
.pk-header {border-bottom:1px solid var(--pk-line);background:var(--pk-porcelain);}
.pk-header__grid {display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.82fr);align-items:center;gap:clamp(28px,5vw,100px);padding-block:clamp(36px,4.5vw,66px);}
.pk-overview {min-width:0;display:flex;flex-direction:column;border-top:4px solid var(--pk-forest);background:var(--pk-sage);padding:27px 30px 24px;}
.pk-overview__eyebrow {color:var(--pk-forest);font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
.pk-overview__count {display:flex;align-items:baseline;gap:15px;margin:14px 0 20px;padding-bottom:21px;border-bottom:1px solid rgba(23,63,53,.19);}
.pk-overview__count strong {font-size:clamp(53px,5vw,77px);line-height:1;font-weight:650;letter-spacing:-.055em;color:var(--pk-forest);font-variant-numeric:tabular-nums;}
.pk-overview__count span {color:var(--pk-charcoal);font-size:15px;line-height:1.5;max-width:180px;}
.pk-overview__stats {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
.pk-overview__stat {min-width:0;}
.pk-overview__stat + .pk-overview__stat {border-left:1px solid rgba(23,63,53,.18);padding-left:16px;}
.pk-overview__stat strong {display:block;font-size:27px;line-height:1.25;font-weight:700;color:var(--pk-forest);font-variant-numeric:tabular-nums;}
.pk-overview__stat--warn strong {color:#9e5338;}
.pk-overview__stat span {display:block;font-size:13px;line-height:1.5;color:#4d5d51;}
.pk-workspace {padding-block:clamp(38px,4.5vw,62px) clamp(48px,5vw,75px);background:var(--pk-porcelain);}
.pk-heading {display:flex;align-items:end;justify-content:space-between;gap:22px;margin-bottom:29px;}
.pk-page .pk-heading__title {margin:12px 0 0;font-size:clamp(29px,3vw,42px)!important;line-height:1.18!important;letter-spacing:-.038em;color:var(--pk-charcoal);font-weight:650!important;}
.pk-heading__desc {margin:9px 0 0;color:var(--pk-muted);font-size:15px;line-height:1.65;max-width:660px;}
.pk-toolbar {display:flex;align-items:end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:24px;}
.pk-toolbar__search {display:block;min-width:0;width:min(100%,445px);}
.pk-field-label {display:block;color:var(--pk-forest);font-size:14px;font-weight:700;margin-bottom:9px;}
.pk-search {display:block;position:relative;}
.pk-search svg {position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--pk-forest);pointer-events:none;}
.pk-search input {width:100%;height:51px;padding:11px 14px 11px 48px;border:1px solid rgba(23,63,53,.28);border-radius:5px;background:white;font-size:15px;color:var(--pk-charcoal);}
.pk-search input::placeholder {color:#728077;}
.pk-toolbar__note {color:var(--pk-muted);font-size:14px;margin:0 0 13px;}
.pk-browse {border-top:1px solid var(--pk-line);border-bottom:1px solid var(--pk-line);margin-bottom:25px;}
.pk-browse__heading {display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:15px;}
.pk-browse__heading strong {font-size:14px;font-weight:700;color:var(--pk-forest);}
.pk-browse__heading span {font-size:13px;color:var(--pk-muted);}
.pk-tabs {display:flex;align-items:stretch;gap:clamp(16px,2.1vw,30px);overflow-x:auto;max-width:100%;padding-top:8px;scrollbar-width:thin;scrollbar-color:var(--pk-sage) transparent;}
.pk-tab {flex:none;display:inline-flex;align-items:center;gap:8px;justify-content:center;min-height:50px;border:0;border-bottom:3px solid transparent;padding:10px 0 12px;background:transparent;color:#58665C;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;}
.pk-tab:hover {color:var(--pk-forest);}
.pk-tab[aria-pressed='true'] {border-bottom-color:var(--pk-clay);color:var(--pk-forest);font-weight:750;}
.pk-tab__count {font-size:12px;font-weight:700;color:var(--pk-forest);background:rgba(215,221,207,.75);border-radius:999px;min-width:25px;min-height:24px;padding:3px 6px;display:inline-grid;place-items:center;}
.pk-tab[aria-pressed='true'] .pk-tab__count {background:var(--pk-forest);color:var(--pk-porcelain);}
.pk-list-head {display:grid;grid-template-columns:minmax(230px,2fr) minmax(100px,.9fr) minmax(125px,1fr) minmax(145px,1.2fr) minmax(160px,1.2fr);gap:18px;padding:13px 24px;background:var(--pk-sage);color:var(--pk-forest);font-size:12px;font-weight:700;letter-spacing:.035em;text-transform:uppercase;}
.pk-list {border:1px solid var(--pk-line);border-top:0;background:var(--pk-porcelain);}
.pk-item {display:grid;grid-template-columns:minmax(230px,2fr) minmax(100px,.9fr) minmax(125px,1fr) minmax(145px,1.2fr) minmax(160px,1.2fr);align-items:center;gap:18px;padding:17px 24px;min-height:112px;border-bottom:1px solid var(--pk-line);transition:background-color .16s;}
.pk-item:last-child {border-bottom:0;}
.pk-item:hover {background:rgba(215,221,207,.22);}
.pk-item__main {display:flex;align-items:center;min-width:0;gap:16px;}
.pk-visual {flex:0 0 77px;width:77px;height:78px;display:grid;place-items:center;overflow:hidden;background:var(--pk-sage);border-radius:4px;border:1px solid rgba(23,63,53,.09);}
.pk-visual--photo {background:white;}
.pk-visual img {display:block;width:100%;height:100%;object-fit:contain;}
.pk-visual__letter {max-width:100%;color:var(--pk-forest);font-weight:600;font-size:33px;line-height:1;letter-spacing:-.07em;text-transform:uppercase;}
.pk-visual--small {flex-basis:60px;width:60px;height:61px;}
.pk-visual--small .pk-visual__letter {font-size:27px;}
.pk-item__name-wrap {min-width:0;}
.pk-page .pk-item__name {margin:0;color:var(--pk-charcoal);font-size:18px!important;line-height:1.35!important;font-weight:700!important;overflow-wrap:break-word;}
.pk-item__minor {display:block;font-size:12.5px;color:var(--pk-muted);margin-top:5px;}
.pk-item__quantity {min-width:0;font-weight:700;font-size:15px;color:var(--pk-charcoal);overflow-wrap:break-word;}
.pk-item__time {min-width:0;color:var(--pk-muted);font-size:13px;line-height:1.5;}
.pk-status {display:inline-flex;align-items:center;justify-content:center;max-width:100%;padding:6px 10px;border:1px solid rgba(23,63,53,.2);border-radius:999px;background:var(--pk-sage);color:var(--pk-forest);font-size:12px;line-height:1.35;font-weight:700;overflow-wrap:break-word;text-align:center;}
.pk-status.is-info,.pk-status.is-muted {background:var(--pk-porcelain);color:var(--pk-forest);}
.pk-status.is-caution,.pk-status.is-uncertain {background:rgba(197,108,66,.13);color:#88442c;border-color:rgba(197,108,66,.3);}
.pk-item__actions {display:flex;align-items:center;justify-content:flex-end;gap:13px;flex-wrap:wrap;}
.pk-item__action-link {display:inline-flex;align-items:center;gap:6px;color:var(--pk-forest);font-size:13px;font-weight:750;line-height:1.35;}
.pk-item__action-link:hover {text-decoration:underline;text-underline-offset:3px;}
.pk-item__remove {border:0;padding:6px 0;background:transparent;color:#9a4b2b;font-size:12.5px;font-weight:650;cursor:pointer;}
.pk-item__remove:hover {text-decoration:underline;text-underline-offset:3px;}
.pk-empty {padding:42px 28px;border:1px solid var(--pk-line);background:var(--pk-sage);}
.pk-page .pk-empty__title {margin:0 0 10px;color:var(--pk-forest);font-size:25px!important;font-weight:650!important;}
.pk-empty p {font-size:15px;color:var(--pk-charcoal);margin:0 0 20px;line-height:1.6;}
.pk-bottom-row {display:flex;align-items:center;justify-content:space-between;gap:22px;flex-wrap:wrap;margin-top:23px;}
.pk-bottom-row p {color:var(--pk-muted);font-size:13.5px;line-height:1.6;margin:0;}
.pk-next {background:var(--pk-sage);border-top:1px solid var(--pk-line);}
.pk-next__inner {display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.85fr);gap:clamp(30px,5vw,90px);align-items:center;padding-block:clamp(37px,5vw,60px);}
.pk-page .pk-next__title {font-size:clamp(29px,3vw,41px)!important;font-weight:650!important;line-height:1.2!important;letter-spacing:-.035em;color:var(--pk-forest);margin:12px 0 10px;}
.pk-next__desc {font-size:15px;color:#445347;line-height:1.65;max-width:560px;margin:0;}
.pk-next__links {display:grid;gap:0;border-top:1px solid rgba(23,63,53,.21);}
.pk-next__link {display:flex;align-items:center;justify-content:space-between;gap:15px;padding:18px 0;border-bottom:1px solid rgba(23,63,53,.21);font-size:16px;font-weight:700;color:var(--pk-forest);}
.pk-next__link:hover {color:#9b4f32;}
.pk-mobile-status, .pk-heading__desc--mobile {display:none;}
.pk-overlay {position:fixed;inset:0;z-index:70;background:rgba(32,36,33,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:22px;}
.pk-modal {display:flex;flex-direction:column;max-height:min(87svh,940px);width:min(100%,900px);overflow:hidden;background:var(--pk-porcelain);border-radius:9px;box-shadow:0 30px 90px rgba(15,25,20,.28);}
.pk-modal--confirm {width:min(100%,535px);}
.pk-modal__header {display:flex;justify-content:space-between;align-items:flex-start;gap:22px;flex:none;padding:26px 30px 22px;border-bottom:1px solid var(--pk-line);background:var(--pk-sage);}
.pk-page .pk-modal__title {margin:10px 0 0;font-size:clamp(24px,2.4vw,31px)!important;font-weight:650!important;line-height:1.2!important;color:var(--pk-charcoal);}
.pk-modal__hint {margin:7px 0 0;color:var(--pk-muted);font-size:14px;line-height:1.5;}
.pk-modal__close {flex:none;display:grid;place-items:center;width:43px;height:43px;border:1px solid rgba(23,63,53,.22);border-radius:50%;background:var(--pk-porcelain);color:var(--pk-forest);cursor:pointer;}
.pk-modal__list {flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 30px;}
.pk-modal__item {display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.65fr) auto;align-items:center;gap:18px;padding:15px 0;border-bottom:1px solid var(--pk-line);}
.pk-modal__name-group {display:flex;align-items:center;gap:15px;min-width:0;}
.pk-modal__item-name {font-size:16px!important;font-weight:700!important;margin:0;color:var(--pk-charcoal);line-height:1.35!important;overflow-wrap:break-word;}
.pk-modal__date {font-size:12.5px;color:var(--pk-muted);margin:4px 0 0;}
.pk-modal__quantity {font-size:14px;font-weight:700;color:var(--pk-forest);margin:0 0 8px;}
.pk-modal__actions {display:flex;justify-content:flex-end;align-items:center;gap:9px;flex-wrap:wrap;}
.pk-modal__actions .pk-btn {min-height:40px;padding:8px 12px;font-size:12.5px;}
.pk-modal__footer {display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px 30px;border-top:1px solid var(--pk-line);flex:none;}
.pk-modal__footer span {font-size:13.5px;color:var(--pk-muted);}
.pk-confirm__body {padding:26px 30px 21px;margin:0;color:var(--pk-charcoal);font-size:16px;line-height:1.65;}
.pk-confirm__actions {display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:0 30px 28px;flex-wrap:wrap;}
.pk-confirm__remove {background:var(--pk-clay);color:white;}
.pk-confirm__remove:hover {background:#a95633;}
@media (max-width:1100px) {
 .pk-header__grid {grid-template-columns:minmax(0,1fr) minmax(300px,.85fr);gap:26px;}
 .pk-list-head {grid-template-columns:minmax(200px,1.65fr) minmax(90px,.9fr) minmax(116px,1fr) minmax(120px,1fr) minmax(140px,1fr);gap:10px;padding-inline:16px;}
 .pk-item {grid-template-columns:minmax(200px,1.65fr) minmax(90px,.9fr) minmax(116px,1fr) minmax(120px,1fr) minmax(140px,1fr);gap:10px;padding-inline:16px;}
}
@media (max-width:880px) {
 .pk-header__grid {grid-template-columns:1fr;gap:28px;}
 .pk-overview {max-width:680px;}
 .pk-next__inner {grid-template-columns:1fr;gap:23px;}
 .pk-list-head {display:none;}
 .pk-item {display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:13px 20px;padding:20px;}
 .pk-item__main {grid-column:1 / -1;}
 .pk-item__quantity::before {content:'Quantity';display:block;margin-bottom:3px;color:var(--pk-muted);font-size:12px;font-weight:500;}
 .pk-item__time::before {content:'Updated';display:block;margin-bottom:3px;color:var(--pk-muted);font-size:12px;}
 .pk-item__actions {justify-content:flex-start;grid-column:1 / -1;}
 .pk-list {border-top:1px solid var(--pk-line);}
}
@media (max-width:600px) {
 .pk-container {padding-inline:18px;}
 .pk-header__grid {padding-block:32px 38px;gap:25px;}
 .pk-lead {font-size:15px;}
 .pk-overview {padding:22px 20px;}
 .pk-overview__count {gap:14px;}
 .pk-overview__stats {gap:8px;}
 .pk-overview__stat + .pk-overview__stat {padding-left:9px;}
 .pk-overview__stat strong {font-size:23px;}
 .pk-overview__stat span {font-size:12px;}
 .pk-heading {flex-direction:column;align-items:flex-start;gap:17px;}
 .pk-toolbar {margin-bottom:20px;}
 .pk-toolbar__search {width:100%;}
 .pk-toolbar__note {margin:0;}
 .pk-browse__heading span {display:none;}
 .pk-tabs {gap:20px;}
 .pk-item {padding:17px 14px;gap:14px;}
 .pk-visual {flex-basis:67px;width:67px;height:68px;}
 .pk-item__main {gap:13px;}
 .pk-page .pk-item__name {font-size:17px!important;}
 .pk-bottom-row {align-items:stretch;}
 .pk-bottom-row .pk-btn {width:100%;}
 .pk-overlay {align-items:flex-end;padding:0;}
 .pk-modal {max-height:91svh;width:100%;border-radius:12px 12px 0 0;}
 .pk-modal--confirm {width:calc(100% - 24px);margin:0 12px 12px;border-radius:10px;}
 .pk-modal__header {padding:22px 19px;}
 .pk-modal__list {padding:0 19px;}
 .pk-modal__item {grid-template-columns:minmax(0,1fr);gap:11px;}
 .pk-modal__actions {justify-content:flex-start;}
 .pk-modal__footer {padding:13px 19px;}
 .pk-confirm__body {padding:20px 19px;}
 .pk-confirm__actions {padding:0 19px 21px;}
 /* Mobile-only: two compact primary actions on one line. */
 .pk-actions {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;width:100%;margin-top:18px;}
 .pk-actions .pk-btn {min-width:0;min-height:37px;padding:8px 5px;font-size:clamp(10.5px,2.95vw,12.5px);font-weight:700;line-height:1.25;white-space:nowrap;letter-spacing:-.02em;gap:4px;}
 .pk-actions .pk-btn svg {display:none;}
 /* Save height in the summary without removing any counts. */
 .pk-overview {padding:15px 17px 14px;}
 .pk-overview__eyebrow {font-size:11.5px;line-height:1.4;}
 .pk-overview__count {margin:8px 0 10px;padding-bottom:10px;gap:10px;align-items:center;}
 .pk-overview__count strong {font-size:43px;line-height:1;}
 .pk-overview__count span {max-width:none;font-size:12.5px;line-height:1.35;}
 .pk-overview__stats {gap:7px;}
 .pk-overview__stat + .pk-overview__stat {padding-left:8px;}
 .pk-overview__stat strong {font-size:20px;line-height:1.1;}
 .pk-overview__stat span {font-size:11px;line-height:1.3;margin-top:3px;}
 /* Replace the mobile description only: desktop copy remains unchanged. */
 .pk-heading__desc--desktop {display:none;}
 .pk-heading__desc--mobile {display:inline;}
 .pk-heading__desc {font-size:clamp(12.5px,3.5vw,14px);line-height:1.45;white-space:nowrap;letter-spacing:-.022em;}
 /* Desktop status tabs remain intact, while mobile uses the same filter state in a select. */
 .pk-browse {margin-bottom:17px;padding-bottom:14px;}
 .pk-browse__heading {padding-top:12px;}
 .pk-tabs {display:none;}
 .pk-mobile-status {display:grid;gap:6px;margin-top:9px;}
 .pk-mobile-status label {font-size:12px;font-weight:600;color:var(--pk-muted);}
 .pk-mobile-status select {width:100%;min-height:43px;appearance:auto;border:1px solid rgba(23,63,53,.25);border-radius:7px;background:var(--pk-porcelain);padding:9px 12px;font:650 14px/1.3 'Plus Jakarta Sans',Inter,system-ui,sans-serif;color:var(--pk-forest);cursor:pointer;}
 .pk-mobile-status select:focus-visible {outline:3px solid var(--pk-clay);outline-offset:2px;}
 /* Compact inventory rows with update left and Remove right. */
 .pk-item {grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto auto;gap:8px 10px;padding:12px 13px;min-height:0;}
 .pk-item__main {grid-column:1;grid-row:1;gap:9px;align-self:center;}
 .pk-visual {flex:0 0 49px;width:49px;height:50px;}
 .pk-visual__letter {font-size:25px;}
 .pk-page .pk-item__name {font-size:16px!important;line-height:1.25!important;}
 .pk-item__minor {font-size:11px;margin-top:2px;}
 .pk-item > div:nth-child(3) {grid-column:2;grid-row:1;justify-self:end;align-self:center;max-width:105px;}
 .pk-status {padding:4px 7px;font-size:10.5px;line-height:1.3;}
 .pk-item__quantity {grid-column:1;grid-row:2;font-size:12.5px;align-self:start;}
 .pk-item__quantity::before {font-size:10px;line-height:1.2;margin-bottom:1px;}
 .pk-item__time {grid-column:2;grid-row:2;text-align:right;justify-self:end;font-size:11px;line-height:1.3;}
 .pk-item__time::before {font-size:10px;line-height:1.2;margin-bottom:1px;}
 .pk-item__actions {grid-column:1 / -1;grid-row:3;display:flex;align-items:center;justify-content:space-between;flex-wrap:nowrap;gap:8px;padding-top:9px;border-top:1px solid var(--pk-line);}
 .pk-item__action-link {font-size:12px;}
 .pk-item__remove {margin-left:auto;font-size:12px;text-align:right;}
 /* Centered, self-contained dialog instead of a full-screen bottom sheet. */
 .pk-overlay {align-items:center;justify-content:center;padding:14px;}
 .pk-modal,.pk-modal--confirm {width:100%;max-width:430px;max-height:min(73svh,640px);margin:0;border-radius:13px;box-shadow:0 25px 70px rgba(18,32,26,.34);}
 .pk-modal__header {gap:12px;padding:17px 18px 15px;border-bottom:3px solid var(--pk-clay);background:var(--pk-forest);color:var(--pk-porcelain);}
 .pk-modal__header .pk-kicker {color:var(--pk-sage);font-size:11px;}
 .pk-page .pk-modal__title {font-size:22px!important;line-height:1.22!important;margin-top:8px;color:var(--pk-porcelain)!important;}
 .pk-modal__hint {font-size:12px;line-height:1.45;color:var(--pk-sage);}
 .pk-modal__close {width:35px;height:35px;color:var(--pk-porcelain);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.35);}
 .pk-modal__list {padding:1px 17px;overscroll-behavior:contain;}
 .pk-modal__item {grid-template-columns:minmax(0,1fr);gap:9px;padding:13px 0;}
 .pk-modal__name-group {gap:11px;}
 .pk-modal__name-group .pk-visual {flex-basis:47px;width:47px;height:48px;}
 .pk-modal__item-name {font-size:15px!important;}
 .pk-modal__date {font-size:11px;line-height:1.35;margin-top:2px;}
 .pk-modal__item > div:nth-child(2) {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:7px;}
 .pk-modal__quantity {font-size:13px;margin:0;}
 .pk-modal__actions {display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:nowrap;}
 .pk-modal__actions .pk-btn {min-height:36px;padding:7px 12px;font-size:12px;}
 .pk-modal__actions .pk-btn--line {margin-left:auto;}
 .pk-modal__footer {padding:10px 17px;background:var(--pk-sage);gap:8px;}
 .pk-modal__footer span {font-size:12px;}
 .pk-modal__footer .pk-btn {min-height:34px;padding:7px 12px;font-size:12px;}
 .pk-confirm__body {padding:18px 18px 16px;font-size:14px;line-height:1.55;}
 .pk-confirm__actions {gap:8px;padding:0 18px 18px;flex-wrap:nowrap;}
 .pk-confirm__actions .pk-btn {flex:1;min-width:0;padding:8px 10px;font-size:12px;}

}
@media (prefers-reduced-motion:reduce) {.pk-page *, .pk-page *::before,.pk-page *::after {transition:none!important;animation:none!important;}}
`;

export default function PantryPage() {
  const advancedPantryEnabled = useAppStore(
    (state) => state.featureFlags?.["m21.advanced_pantry"] === true
  );

  const [items, setItems] = useState([]);

  const [selectedFilter, setSelectedFilter] = useState("all");

  const [searchTerm, setSearchTerm] = useState("");
  const [catalogPhotos, setCatalogPhotos] = useState({});
  const checkedCatalogNames = useRef(new Set());

  const [showAllItems, setShowAllItems] = useState(false);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [itemPendingRemoval, setItemPendingRemoval] = useState(null);

  const [removingItemId, setRemovingItemId] = useState(null);

  const loadPantry = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const firstPage = await getPantry({ page: 1, limit: 50 });
      const pageCount = Math.max(1, Number(firstPage.pagination?.pages) || 1);
      const allRecords = [...firstPage.items];
      // The existing API is paginated (50 per page); load remaining records
      // so the redesigned inventory and View All never omit later pages.
      for (let page = 2; page <= pageCount; page += 1) {
        const nextPage = await getPantry({ page, limit: 50 });
        allRecords.push(...nextPage.items);
      }
      setItems(allRecords);
    } catch (loadError) {
      setError(
        getPantryErrorMessage(
          loadError,
          "Unable to load your household Pantry."
        )
      );
    } finally {
      setLoading(false);

      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPantry();
  }, [loadPantry]);

  const selectedFilterDefinition = useMemo(
    () => FILTERS.find((filter) => filter.key === selectedFilter) || FILTERS[0],
    [selectedFilter]
  );

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const state = getItemState(item);
      const matchesFilter = selectedFilterDefinition.states
        ? selectedFilterDefinition.states.includes(state)
        : state !== "do_not_track";
      return (
        matchesFilter &&
        (!term || getItemTitle(item).toLocaleLowerCase().includes(term))
      );
    });
  }, [items, searchTerm, selectedFilterDefinition]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, 9),
    [filteredItems]
  );

  // Match publicly listed Grocery photos by pack identity or exact canonical
  // food name. Public catalog uses privacy-cleared, signed images only.
  // Results are optional and do not affect loading or actions in the Pantry.
  useEffect(() => {
    const photoCandidates = showAllItems ? items : visibleItems;
    const missing = photoCandidates.filter((item) => {
      const name = normalizedFoodName(getItemTitle(item));
      if (
        !name ||
        getPantryImage(item) ||
        checkedCatalogNames.current.has(name)
      )
        return false;
      checkedCatalogNames.current.add(name);
      return true;
    });
    if (!missing.length) return;
    async function findApprovedPhotos() {
      for (const item of missing) {
        const key = normalizedFoodName(getItemTitle(item));
        try {
          const result = await getCatalogProducts({
            search: getItemTitle(item),
            page: 1,
            limit: 24,
            listedOnly: true,
          });
          const photo = getMatchingCatalogPhoto(item, result.products);
          if (photo)
            setCatalogPhotos((previous) => ({ ...previous, [key]: photo }));
        } catch {
          // An unavailable catalog must never hide Pantry inventory or display
          // a potentially unrelated picture.
        }
      }
    }
    findApprovedPhotos();
  }, [visibleItems, items, showAllItems]);

  const pantryCounts = useMemo(() => {
    const active = items.filter(
      (item) => getItemState(item) !== "do_not_track"
    );
    return {
      active: active.length,
      confirmed: active.filter((item) =>
        ["confirmed_available", "replenished_elsewhere"].includes(
          getItemState(item)
        )
      ).length,
      low: active.filter((item) => getItemState(item) === "running_low").length,
      check: active.filter((item) =>
        ["uncertain", "inferred_available"].includes(getItemState(item))
      ).length,
    };
  }, [items]);

  const filterCount = (filter) =>
    items.filter((item) =>
      filter.states
        ? filter.states.includes(getItemState(item))
        : getItemState(item) !== "do_not_track"
    ).length;

  const confirmRemoveFromPantry = useCallback(async () => {
    const itemId = getItemId(itemPendingRemoval);

    if (!itemId) {
      setItemPendingRemoval(null);

      return;
    }

    setRemovingItemId(itemId);

    setError("");

    try {
      const result = await stopTrackingPantryItem(itemId);

      const updatedItem = result?.item || result?.pantryItem || null;

      setItems((currentItems) =>
        currentItems.map((currentItem) => {
          if (getItemId(currentItem) !== itemId) {
            return currentItem;
          }

          return (
            updatedItem || {
              ...currentItem,

              state: "do_not_track",

              trackingPaused: true,

              updatedAt: new Date().toISOString(),
            }
          );
        })
      );

      setItemPendingRemoval(null);
    } catch (removeError) {
      setError(
        getPantryErrorMessage(
          removeError,
          "Unable to remove this item from your active Pantry."
        )
      );
    } finally {
      setRemovingItemId(null);
    }
  }, [itemPendingRemoval]);

  return (
    <main className="page-shell pk-page">
      <style>{PANTRY_STYLES}</style>

      <header className="pk-header" aria-labelledby="pantry-page-heading">
        <div className="pk-container pk-header__grid">
          <div>
            <span className="pk-kicker">Living Pantry</span>
            <h1 id="pantry-page-heading" className="pk-title">
              Your Pantry.
              <br />
              <span>Everything in its place.</span>
            </h1>
            <p className="pk-lead">
              See what you have at home, check what needs attention, and make
              the most of your ingredients.
            </p>
            <div className="pk-actions">
              <Link className="pk-btn pk-btn--main" to="/scan">
                Add or scan an item <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="pk-btn pk-btn--line" to="/cook-today">
                Cook with what I have
              </Link>
            </div>
          </div>
          <aside
            className="pk-overview"
            aria-label="Live household pantry summary"
          >
            <span className="pk-overview__eyebrow">Your kitchen today</span>
            <div className="pk-overview__count">
              <strong>{loading ? "—" : pantryCounts.active}</strong>
              <span>items in your active Pantry</span>
            </div>
            <div className="pk-overview__stats">
              <div className="pk-overview__stat">
                <strong>{loading ? "—" : pantryCounts.confirmed}</strong>
                <span>Confirmed</span>
              </div>
              <div className="pk-overview__stat pk-overview__stat--warn">
                <strong>{loading ? "—" : pantryCounts.low}</strong>
                <span>Running low</span>
              </div>
              <div className="pk-overview__stat">
                <strong>{loading ? "—" : pantryCounts.check}</strong>
                <span>Needs checking</span>
              </div>
            </div>
          </aside>
        </div>
      </header>

      <section
        className="pk-workspace"
        aria-labelledby="pantry-inventory-title"
        id="pantry-food-home"
      >
        <div className="pk-container">
          <div className="pk-heading">
            <div>
              <span className="pk-kicker">Your saved ingredients</span>
              <h2 className="pk-heading__title" id="pantry-inventory-title">
                Food at home
              </h2>
              <p className="pk-heading__desc">
                <span className="pk-heading__desc--desktop">
                  Your inventory, with quantities and status exactly as saved.
                  Update an item whenever something changes.
                </span>
                <span className="pk-heading__desc--mobile">
                  Check quantities and update items.
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadPantry({ refresh: true })}
              disabled={loading || refreshing}
              className="pk-btn pk-btn--line"
            >
              <RefreshCw size={17} aria-hidden="true" />{" "}
              {refreshing ? "Refreshing…" : "Refresh pantry"}
            </button>
          </div>

          <div className="pk-toolbar">
            <label className="pk-toolbar__search">
              <span className="pk-field-label">Find an ingredient</span>
              <span className="pk-search">
                <Search size={19} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search your pantry"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </span>
            </label>
            <p className="pk-toolbar__note" aria-live="polite">
              {loading
                ? "Loading your Pantry…"
                : `${filteredItems.length} ${
                    filteredItems.length === 1 ? "item" : "items"
                  } in this view`}
            </p>
          </div>

          <div
            className="pk-browse"
            role="group"
            aria-label="Browse pantry by status"
          >
            <div className="pk-browse__heading">
              <strong>Browse by status</strong>
              <span>Select a status to filter your ingredients</span>
            </div>
            <div className="pk-tabs">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className="pk-tab"
                  aria-pressed={selectedFilter === filter.key}
                  onClick={() => setSelectedFilter(filter.key)}
                >
                  {filter.label}
                  <span className="pk-tab__count">
                    {loading ? "—" : filterCount(filter)}
                  </span>
                </button>
              ))}
            </div>
            <div className="pk-mobile-status">
              <label htmlFor="pk-mobile-pantry-status">Choose a status</label>
              <select
                id="pk-mobile-pantry-status"
                value={selectedFilter}
                onChange={(event) => setSelectedFilter(event.target.value)}
              >
                {FILTERS.map((filter) => (
                  <option key={filter.key} value={filter.key}>
                    {filter.label} ({loading ? "…" : filterCount(filter)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <div className="pk-empty" role="alert">
              <h3 className="pk-empty__title">
                Couldn't load your latest Pantry information
              </h3>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => loadPantry({ refresh: true })}
                className="pk-btn pk-btn--line"
              >
                Try again
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="pk-empty" aria-busy="true" aria-live="polite">
              <h3 className="pk-empty__title">Checking your Pantry…</h3>
              <p>Loading your saved ingredients and their latest status.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="pk-empty">
              <h3 className="pk-empty__title">
                {searchTerm.trim()
                  ? "No ingredients found"
                  : "No items in this status"}
              </h3>
              <p>
                {searchTerm.trim()
                  ? "Try another name or choose a different status above."
                  : "Select another status or add an item to your Pantry."}
              </p>
              <Link className="pk-btn pk-btn--main" to="/scan">
                Add or scan an item
              </Link>
            </div>
          ) : (
            <div aria-label="Saved pantry ingredients">
              <div className="pk-list-head" aria-hidden="true">
                <span>Ingredient</span>
                <span>Quantity</span>
                <span>Status</span>
                <span>Last updated</span>
                <span style={{ textAlign: "right" }}>Actions</span>
              </div>
              <div className="pk-list">
                {visibleItems.map((item, index) => {
                  const id = getItemId(item);
                  const state = getItemState(item);
                  return (
                    <article
                      className="pk-item"
                      key={id || `${getItemTitle(item)}-${index}`}
                    >
                      <div className="pk-item__main">
                        <PantryItemVisual
                          item={item}
                          catalogImage={
                            catalogPhotos[
                              normalizedFoodName(getItemTitle(item))
                            ]
                          }
                        />
                        <div className="pk-item__name-wrap">
                          <h3 className="pk-item__name">
                            {getItemTitle(item)}
                          </h3>
                          <span className="pk-item__minor">
                            Pantry ingredient
                          </span>
                        </div>
                      </div>
                      <div className="pk-item__quantity">
                        {formatQuantity(getQuantity(item))}
                      </div>
                      <div>
                        <PantryStatus state={state} />
                      </div>
                      <div className="pk-item__time">
                        {formatDate(getUpdatedAt(item))}
                      </div>
                      <div className="pk-item__actions">
                        {id ? (
                          <>
                            <Link
                              className="pk-item__action-link"
                              to={`/pantry/items/${encodeURIComponent(id)}`}
                            >
                              Check &amp; update{" "}
                              <ArrowRight size={15} aria-hidden="true" />
                            </Link>
                            {state !== "do_not_track" ? (
                              <button
                                type="button"
                                className="pk-item__remove"
                                onClick={() => setItemPendingRemoval(item)}
                                disabled={removingItemId === id}
                                aria-label={`Remove ${getItemTitle(
                                  item
                                )} from active Pantry`}
                              >
                                Remove
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="pk-item__time">
                            History unavailable
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="pk-bottom-row">
              <p>
                {filteredItems.length > visibleItems.length
                  ? `Showing ${visibleItems.length} of ${filteredItems.length} matching items.`
                  : `${filteredItems.length} items in this view.`}{" "}
                Your complete saved Pantry also includes items you stopped
                tracking.
              </p>
              <button
                type="button"
                onClick={() => setShowAllItems(true)}
                className="pk-btn pk-btn--main"
              >
                View all {items.length} saved items{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="pk-next" aria-labelledby="pantry-next-title">
        <div className="pk-container pk-next__inner">
          <div>
            <span className="pk-kicker">Make the most of what you have</span>
            <h2 id="pantry-next-title" className="pk-next__title">
              From your pantry to your plate.
            </h2>
            <p className="pk-next__desc">
              Use what's at home first, then plan the next basket around what
              you need.
            </p>
          </div>
          <div className="pk-next__links">
            <Link className="pk-next__link" to="/waste-reduction">
              Use food before it goes to waste{" "}
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <Link className="pk-next__link" to="/next-basket">
              Plan your next shopping basket{" "}
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {advancedPantryEnabled ? <AdvancedPantryPanel /> : null}

      {showAllItems && (
        <div
          className="pk-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAllItems(false);
          }}
        >
          <section
            className="pk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-pantry-items-title"
          >
            <header className="pk-modal__header">
              <div>
                <span className="pk-kicker">Saved ingredients</span>
                <h2 className="pk-modal__title" id="all-pantry-items-title">
                  Your complete Pantry
                </h2>
                <p className="pk-modal__hint">
                  {items.length} saved items, including items you're not
                  currently tracking.
                </p>
              </div>
              <button
                type="button"
                className="pk-modal__close"
                onClick={() => setShowAllItems(false)}
                aria-label="Close all pantry items"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="pk-modal__list">
              {items.length === 0 ? (
                <p className="pk-modal__hint">No saved items yet.</p>
              ) : (
                items.map((item, index) => {
                  const id = getItemId(item);
                  const state = getItemState(item);
                  return (
                    <article
                      key={`all-${id || index}`}
                      className="pk-modal__item"
                    >
                      <div className="pk-modal__name-group">
                        <PantryItemVisual
                          item={item}
                          small
                          catalogImage={
                            catalogPhotos[
                              normalizedFoodName(getItemTitle(item))
                            ]
                          }
                        />
                        <div style={{ minWidth: 0 }}>
                          <h3 className="pk-modal__item-name">
                            {getItemTitle(item)}
                          </h3>
                          <p className="pk-modal__date">
                            Updated {formatDate(getUpdatedAt(item))}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="pk-modal__quantity">
                          {formatQuantity(getQuantity(item))}
                        </p>
                        <PantryStatus state={state} />
                      </div>
                      <div className="pk-modal__actions">
                        {id ? (
                          <>
                            <Link
                              className="pk-btn pk-btn--main"
                              to={`/pantry/items/${encodeURIComponent(id)}`}
                              onClick={() => setShowAllItems(false)}
                            >
                              Check &amp; update
                            </Link>
                            {state !== "do_not_track" ? (
                              <button
                                type="button"
                                className="pk-btn pk-btn--line"
                                onClick={() => setItemPendingRemoval(item)}
                                disabled={removingItemId === id}
                              >
                                Remove
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span>History unavailable</span>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
            <footer className="pk-modal__footer">
              <span>
                {pantryCounts.active} active · {items.length} saved
              </span>
              <button
                type="button"
                onClick={() => setShowAllItems(false)}
                className="pk-btn pk-btn--soft"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}

      {itemPendingRemoval && (
        <div
          className="pk-overlay"
          style={{ zIndex: 80 }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !removingItemId)
              setItemPendingRemoval(null);
          }}
        >
          <section
            className="pk-modal pk-modal--confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-pantry-item-title"
          >
            <header className="pk-modal__header">
              <div>
                <span className="pk-kicker">Pantry item</span>
                <h2 className="pk-modal__title" id="remove-pantry-item-title">
                  Stop tracking {getItemTitle(itemPendingRemoval)}?
                </h2>
              </div>
              <button
                type="button"
                className="pk-modal__close"
                disabled={Boolean(removingItemId)}
                onClick={() => setItemPendingRemoval(null)}
                aria-label="Close remove confirmation"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <p className="pk-confirm__body">
              This food will leave your active Pantry, but it will remain in
              your saved history under Not tracking.
            </p>
            <div className="pk-confirm__actions">
              <button
                type="button"
                className="pk-btn pk-btn--line"
                disabled={Boolean(removingItemId)}
                onClick={() => setItemPendingRemoval(null)}
              >
                Keep item
              </button>
              <button
                type="button"
                className="pk-btn pk-confirm__remove"
                disabled={Boolean(removingItemId)}
                onClick={confirmRemoveFromPantry}
              >
                {removingItemId ? "Removing…" : "Stop tracking"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
