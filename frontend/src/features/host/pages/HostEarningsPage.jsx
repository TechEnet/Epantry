import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Clock3, RefreshCw, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getCatalogProducts } from '../../grocery/services/catalog.service'
import { listHostListingPackets } from '../services/hostUnifiedListing.service'
import {
  getHostEarningsOverview,
  getHostOperationsErrorMessage,
} from '../../hostOperations/services/hostOperations.service'

const earningsStyles = String.raw`
/* Earnings workspace: senior Balanced Japandi. Exclusively scoped to .hee-page. */
.hee-page {
  --hee-paper: #F7F6F2;
  --hee-surface: #FFFEFC;
  --hee-forest: #173F35;
  --hee-charcoal: #202421;
  --hee-sage: #DCE0CF;
  --hee-clay: #C86C42;
  --hee-muted: #59655F;
  --hee-rule: #DBDED7;
  box-sizing: border-box;
  width: 100%; min-width: 0;
  padding: 32px clamp(18px, 3vw, 44px) 58px;
  background: var(--hee-paper);
  color: var(--hee-charcoal);
  font: 400 16px/1.6 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
}
.hee-page *, .hee-page *::before, .hee-page *::after { box-sizing: border-box; }
.hee-page :is(a, button) { font-family: inherit; }
.hee-page :is(a, button):focus-visible { outline: 3px solid var(--hee-clay); outline-offset: 4px; }
.hee-intro { display: flex; justify-content: space-between; align-items: flex-end; gap: 28px; padding-bottom: 28px; border-bottom: 1px solid var(--hee-rule); }
.hee-intro-content { min-width: 0; }
.hee-kicker, .hee-eyebrow { display: inline-flex; align-items: center; gap: 10px; color: #995237; font-size: 13px; font-weight: 700; line-height: 1.5; letter-spacing: .045em; text-transform: uppercase; }
.hee-kicker::before { display: block; width: 24px; height: 2px; background: var(--hee-clay); content: ''; }
.hee-intro h1 { margin: 11px 0 4px!important; color: var(--hee-forest)!important; font-size: clamp(30px, 3.2vw, 38px)!important; font-weight: 650!important; letter-spacing: -.045em!important; line-height: 1.24!important; }
.hee-intro p { margin: 0; max-width: 640px; color: var(--hee-muted); font-size: 16px; line-height: 1.55; }
.hee-control { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 7px; flex: 0 0 auto; }
.hee-refresh { display: inline-flex; align-items: center; justify-content: center; gap: 11px; min-height: 48px; min-width: 133px; padding: 11px 20px; border: 1px solid var(--hee-forest); border-radius: 11px; background: var(--hee-forest); color: #FFF; font-size: 15px; line-height: 1.2; font-weight: 650; cursor: pointer; transition: background-color .18s, transform .18s; }
.hee-refresh:hover:not(:disabled) { background: #285A49; transform: translateY(-1px); }
.hee-refresh:disabled { opacity: .68; cursor: wait; transform: none; }
.hee-updated { max-width: 270px; font-size: 13px; line-height: 1.5; color: var(--hee-muted); text-align: right; }
.hee-overview { display: grid; grid-template-columns: minmax(265px, 1.05fr) minmax(0, 1.6fr); min-width: 0; margin-top: 27px; border: 1px solid var(--hee-rule); border-radius: 14px; overflow: hidden; background: var(--hee-surface); }
.hee-total { min-width: 0; padding: 33px clamp(24px, 2.7vw, 38px) 32px; background: #EEF0E7; border-right: 1px solid var(--hee-rule); }
.hee-overline { color: var(--hee-forest); font-size: 15px; font-weight: 650; line-height: 1.45; }
.hee-total-number { display: block; margin: 11px 0 6px; color: var(--hee-forest); font-size: clamp(39px, 4.4vw, 54px); font-weight: 650; letter-spacing: -.057em; line-height: 1.14; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hee-total-caption { display: block; max-width: 340px; color: #506157; font-size: 14px; line-height: 1.55; }
.hee-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); min-width: 0; }
.hee-kpi { display: flex; flex-direction: column; justify-content: space-between; gap: 21px; min-width: 0; padding: 32px 22px 30px; }
.hee-kpi + .hee-kpi { border-left: 1px solid var(--hee-rule); }
.hee-kpi-title { display: flex; flex-direction: column; gap: 8px; color: var(--hee-charcoal); font-size: 14px; font-weight: 650; line-height: 1.35; }
.hee-kpi-icon { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 9px; color: #35614B; background: #E7EEE7; }
.hee-kpi[data-kind='await'] .hee-kpi-icon { color: #A75239; background: #F6E6DD; }
.hee-kpi-bottom { display: block; min-width: 0; }
.hee-kpi-number { display: block; color: var(--hee-forest); font-size: clamp(21px, 2vw, 28px); font-weight: 650; line-height: 1.25; letter-spacing: -.045em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hee-kpi[data-kind='await'] .hee-kpi-number { color: #945039; }
.hee-kpi-note { display: block; margin-top: 4px; color: var(--hee-muted); font-size: 13px; line-height: 1.5; }
.hee-error { margin-top: 18px; padding: 13px 17px; border-left: 3px solid #A8443F; background: #F8E7E3; color: #8B3832; font-size: 14px; }
.hee-sales { margin-top: 43px; min-width: 0; }
.hee-section-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px; padding-bottom: 19px; }
.hee-section-header h2, .hee-payout-title h2 { margin: 5px 0 2px!important; color: var(--hee-forest)!important; font-size: clamp(25px, 2.5vw, 30px)!important; font-weight: 650!important; line-height: 1.3!important; letter-spacing: -.037em!important; }
.hee-section-sub { margin: 0; color: var(--hee-muted); font-size: 15px; line-height: 1.55; }
.hee-section-actions { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding-bottom: 2px; }
.hee-count { color: var(--hee-muted); font-size: 14px; font-weight: 600; }
.hee-plain-link { display: inline-flex; align-items: center; gap: 8px; width: fit-content; padding: 4px 0; border-bottom: 1px solid #92A99B; color: var(--hee-forest); text-decoration: none; font-size: 14px; font-weight: 700; transition: color .18s, border-color .18s; }
.hee-plain-link:hover { color: #995237; border-color: var(--hee-clay); }
.hee-ledger { min-width: 0; background: var(--hee-surface); border-top: 2px solid var(--hee-forest); border-bottom: 1px solid var(--hee-rule); }
.hee-ledger-head, .hee-order { display: grid; grid-template-columns: minmax(0, 2fr) minmax(160px, 1.15fr) minmax(155px, .95fr) minmax(120px, .8fr); align-items: center; gap: 18px; }
.hee-ledger-head { min-height: 45px; padding: 10px 24px; background: #EFF1EA; border-bottom: 1px solid var(--hee-rule); color: #536157; font-size: 13px; font-weight: 650; }
.hee-ledger-head span:last-child { text-align: right; }
.hee-order { min-height: 85px; padding: 13px 24px; color: inherit; text-decoration: none; border-bottom: 1px solid #E9EAE5; transition: background-color .18s; }
.hee-order:last-child { border-bottom: 0; }
.hee-order:hover { background: #F4F5F0; }
.hee-order:hover .hee-visit { transform: translateX(3px); }
.hee-ledger-product { display: flex; align-items: center; gap: 14px; min-width: 0; }
.hee-photo { position: relative; display: block; flex: 0 0 58px; width: 58px; height: 58px; border: 1px solid #E8EAE3; border-radius: 9px; overflow: hidden; background: #F0F1EB; }
.hee-photo img { display: block; width: 100%; height: 100%; object-fit: contain; background: #FBFBF9; }
.hee-photo-blank { display: grid; place-items: center; height: 100%; padding: 4px; color: var(--hee-muted); text-align: center; font-size: 11px; line-height: 1.25; }
.hee-photo-number { position: absolute; right: 2px; bottom: 2px; padding: 1px 5px; border-radius: 4px; background: var(--hee-forest); color: #FFF; font-size: 11px; font-weight: 700; line-height: 1.45; }
.hee-product-name { display: block; color: var(--hee-charcoal); font-size: 15px; font-weight: 650; line-height: 1.45; overflow-wrap: anywhere; }
.hee-mobile-order-meta { display: none; }
.hee-order-reference { min-width: 0; }
.hee-order-id { display: block; color: var(--hee-charcoal); font-size: 14px; font-weight: 600; line-height: 1.35; }
.hee-order-date { display: block; margin-top: 4px; color: var(--hee-muted); font-size: 13px; line-height: 1.5; }
.hee-order-state { min-width: 0; }
.hee-badge { display: inline-flex; align-items: center; max-width: 100%; padding: 5px 9px; border-radius: 6px; background: #E8F0E8; color: #2B6245; font-size: 12px; font-weight: 650; line-height: 1.35; white-space: normal; }
.hee-badge[data-status='awaiting_settlement'] { background: #F7E8DF; color: #974F36; }
.hee-badge[data-status='not_yet_settleable'] { background: #E5EDF0; color: #356B78; }
.hee-badge[data-status='pending_approval'] { background: #EEE9F4; color: #65517D; }
.hee-badge[data-status='rejected'], .hee-badge[data-status='void'] { background: #F7E4E3; color: #9D433C; }
.hee-order-money { display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-width: 0; }
.hee-order-price { color: var(--hee-forest); font-size: 17px; font-weight: 700; line-height: 1.3; font-variant-numeric: tabular-nums; letter-spacing: -.035em; overflow-wrap: anywhere; text-align: right; }
.hee-visit { display: inline-flex; align-items: center; justify-content: center; color: var(--hee-forest); transition: transform .18s; }
.hee-mobile-status { display: none; }
.hee-empty-sales { padding: 34px 24px; color: var(--hee-muted); font-size: 15px; }
.hee-more-sales { display: flex; align-items: center; justify-content: center; padding-top: 17px; }
.hee-more-button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; padding: 10px 23px; border: 1px solid #A7B8AA; border-radius: 9px; background: var(--hee-surface); color: var(--hee-forest); font-size: 15px; line-height: 1.4; font-weight: 650; cursor: pointer; transition: background-color .18s, border-color .18s; }
.hee-more-button:hover:not(:disabled) { background: #E7EDE5; border-color: var(--hee-forest); }
.hee-more-button:disabled { opacity: .65; cursor: wait; }
.hee-more-error { margin: 12px 0 0; color: #8B3832; font-size: 14px; text-align: center; }
.hee-sales-foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 13px 1px 0; }
.hee-sales-foot p { margin: 0; font-size: 14px; color: var(--hee-muted); }
.hee-payouts { display: grid; grid-template-columns: minmax(240px, .8fr) minmax(0, 1.5fr); gap: 26px; min-width: 0; margin-top: 44px; padding-top: 32px; border-top: 1px solid var(--hee-rule); }
.hee-payout-title { display: flex; align-items: flex-start; flex-direction: column; min-width: 0; }
.hee-payout-title .hee-section-sub { margin: 2px 0 17px; }
.hee-payout-body { min-width: 0; padding-left: 28px; border-left: 1px solid var(--hee-rule); }
.hee-payout-row { display: flex; align-items: center; justify-content: space-between; gap: 22px; min-height: 75px; padding: 13px 0; border-bottom: 1px solid var(--hee-rule); }
.hee-payout-row:last-child { border-bottom: 0; }
.hee-payout-value { display: block; color: var(--hee-forest); font-size: 22px; line-height: 1.25; font-weight: 650; font-variant-numeric: tabular-nums; }
.hee-payout-meta { display: block; margin-top: 4px; color: var(--hee-muted); font-size: 13px; line-height: 1.5; }
.hee-payout-empty { display: flex; align-items: center; gap: 17px; min-height: 118px; padding: 23px 25px; background: #EDF0E8; border-radius: 11px; }
.hee-payout-empty-icon { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; border: 1px solid #D5DED3; border-radius: 10px; background: #FFFEFC; color: var(--hee-forest); }
.hee-payout-empty strong { display: block; color: var(--hee-forest); font-size: 16px; line-height: 1.45; font-weight: 650; }
.hee-payout-empty p { margin: 3px 0 0; color: var(--hee-muted); font-size: 14px; line-height: 1.55; }
@media (max-width: 1130px) {
  .hee-overview { grid-template-columns: minmax(250px, .9fr) minmax(0, 1.6fr); }
  .hee-kpi { padding: 26px 15px; }
  .hee-ledger-head, .hee-order { gap: 13px; grid-template-columns: minmax(0, 1.8fr) minmax(135px, 1fr) minmax(125px, .95fr) minmax(100px, .7fr); }
  .hee-ledger-head { padding: 10px 16px; }
  .hee-order { padding: 13px 16px; }
  .hee-order-money { gap: 7px; }
}
@media (max-width: 900px) {
  .hee-overview { grid-template-columns: 1fr; }
  .hee-total { border-right: 0; border-bottom: 1px solid var(--hee-rule); padding: 27px 30px; }
  .hee-kpi { padding: 22px 24px; }
  .hee-ledger-head, .hee-order { grid-template-columns: minmax(0, 1.8fr) minmax(130px, 1fr) minmax(115px, .9fr) minmax(95px, .7fr); gap: 10px; }
  .hee-order { padding: 12px 14px; }
  .hee-ledger-head { padding: 10px 14px; }
}
@media (max-width: 740px) {
  /* Mobile-only: compact page flow without hiding finance or order information. */
  .hee-page { padding: 20px 16px 30px; }
  .hee-intro { align-items: flex-start; gap: 14px; padding-bottom: 18px; }
  .hee-intro h1 { font-size: 29px!important; }
  .hee-intro p { font-size: 15px; }
  .hee-refresh { min-width: 110px; padding: 10px 14px; }
  .hee-updated { max-width: 180px; }
  .hee-sales { margin-top: 28px; }
  .hee-section-header { gap: 10px; padding-bottom: 13px; }
  .hee-section-sub { font-size: 14px; line-height: 1.45; }
  .hee-section-actions { gap: 14px; }
  .hee-ledger-head { display: none; }
  .hee-order {
    grid-template-columns: minmax(0, 1fr) minmax(98px, max-content);
    grid-template-areas: 'product amount' 'reference amount';
    column-gap: 10px; row-gap: 3px;
    min-height: 76px; padding: 11px 14px;
  }
  .hee-ledger-product { grid-area: product; min-width: 0; }
  .hee-order-reference { display: block; grid-area: reference; padding-left: 72px; min-width: 0; }
  .hee-order-state, .hee-mobile-order-meta { display: none; }
  .hee-order-id { font-size: 12.5px; }
  .hee-order-date { margin-top: 1px; font-size: 12px; line-height: 1.35; }
  .hee-order-money { grid-area: amount; flex-direction: column; align-items: flex-end; align-self: center; gap: 5px; min-width: 0; }
  .hee-order-price { font-size: 15px; }
  .hee-mobile-status { display: block; text-align: right; }
  .hee-order-money .hee-visit { display: none; }
  .hee-more-sales { padding-top: 12px; }
  .hee-more-button { min-height: 44px; }
  .hee-sales-foot { flex-wrap: nowrap; align-items: center; gap: 8px; padding-top: 11px; }
  .hee-sales-foot p { min-width: 0; font-size: 13px; line-height: 1.4; }
  .hee-sales-foot .hee-plain-link { flex: 0 0 auto; }
  .hee-payouts { grid-template-columns: 1fr; gap: 12px; margin-top: 19px; padding-top: 18px; }
  .hee-payout-title .hee-section-sub { margin: 1px 0 7px; }
  .hee-payout-title h2 { margin: 2px 0!important; }
  .hee-payout-body { padding-left: 0; border-left: 0; }
  .hee-payout-row { min-height: 65px; padding: 10px 0; }
  .hee-payout-empty { min-height: 0; gap: 12px; padding: 13px 14px; border-radius: 10px; }
  .hee-payout-empty-icon { flex-basis: 38px; width: 38px; height: 38px; border-radius: 9px; }
  .hee-payout-empty strong { font-size: 15px; line-height: 1.4; }
  .hee-payout-empty p { margin-top: 2px; font-size: 13.5px; line-height: 1.45; }
}
@media (max-width: 520px) {
  .hee-page { padding: 16px 12px 25px; }
  .hee-intro { flex-direction: column; gap: 11px; padding-bottom: 15px; }
  .hee-control { width: 100%; flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; }
  .hee-kicker, .hee-eyebrow { font-size: 12.5px; }
  .hee-intro h1 { margin: 7px 0 3px!important; font-size: 27px!important; }
  .hee-intro p { font-size: 14px; line-height: 1.45; }
  .hee-refresh { min-height: 44px; min-width: 100px; padding: 9px 11px; font-size: 14px; gap: 7px; }
  .hee-updated { font-size: 12.5px; max-width: 210px; }
  .hee-overview { margin-top: 17px; border-radius: 11px; }
  .hee-total { padding: 18px 17px; }
  .hee-total-number { margin: 5px 0 4px; font-size: clamp(36px, 10vw, 43px); }
  .hee-total-caption { font-size: 13.5px; }
  .hee-kpis { grid-template-columns: 1fr; }
  .hee-kpi { flex-direction: row; align-items: center; gap: 10px; padding: 11px 16px; }
  .hee-kpi + .hee-kpi { border-left: 0; border-top: 1px solid var(--hee-rule); }
  .hee-kpi-title { flex-direction: row; align-items: center; gap: 9px; font-size: 13px; }
  .hee-kpi-icon { width: 29px; height: 29px; flex: none; }
  .hee-kpi-bottom { text-align: right; }
  .hee-kpi-number { font-size: 20px; }
  .hee-kpi-note { font-size: 12px; line-height: 1.35; }
  .hee-sales { margin-top: 24px; }
  .hee-section-header h2, .hee-payout-title h2 { font-size: 23px!important; }
  .hee-section-actions { gap: 12px; }
  .hee-count { font-size: 13px; }
  .hee-photo { flex-basis: 46px; width: 46px; height: 48px; }
  .hee-ledger-product { gap: 9px; }
  .hee-product-name { font-size: 13.5px; line-height: 1.35; }
  .hee-order { grid-template-columns: minmax(0, 1fr) minmax(92px, max-content); column-gap: 8px; row-gap: 1px; padding: 10px 10px; }
  .hee-order-reference { padding-left: 55px; }
  .hee-order-id { font-size: 12px; }
  .hee-order-date { font-size: 11.5px; }
  .hee-order-price { font-size: 14px; }
  .hee-badge { font-size: 11px; padding: 4px 6px; }
  .hee-more-button { min-height: 44px; }
  .hee-sales-foot p { font-size: 12.5px; }
  .hee-sales-foot .hee-plain-link { font-size: 13px; gap: 6px; }
  .hee-payouts { margin-top: 16px; padding-top: 17px; gap: 11px; }
  .hee-payout-title .hee-section-sub { margin: 1px 0 5px; }
  .hee-payout-title .hee-plain-link { font-size: 14px; }
  .hee-payout-empty { gap: 11px; padding: 12px; background: #EDF0E8; }
  .hee-payout-empty-icon { flex-basis: 36px; width: 36px; height: 36px; }
  .hee-payout-empty strong { font-size: 14.5px; }
  .hee-payout-empty p { font-size: 13px; }
}
@media (max-width: 370px) {
  .hee-page { padding-right: 10px; padding-left: 10px; }
  .hee-control { align-items: center; }
  .hee-updated { max-width: 174px; font-size: 12px; }
  .hee-kpi-title { gap: 6px; font-size: 12.5px; }
  .hee-kpi { padding: 10px 12px; }
  .hee-kpi-number { font-size: 18px; }
  .hee-photo { flex-basis: 42px; width: 42px; height: 44px; }
  .hee-order { grid-template-columns: minmax(0, 1fr) minmax(86px, max-content); column-gap: 6px; }
  .hee-order-reference { padding-left: 50px; }
  .hee-badge { font-size: 10.5px; }
  .hee-sales-foot p { font-size: 12px; }
  .hee-sales-foot .hee-plain-link { font-size: 12.5px; }
}
@media (prefers-reduced-motion: reduce) { .hee-page :is(a, button), .hee-visit { transition: none!important; } }
`
function currencyMinor(value, currency = 'INR') {
  const amount = Number(value || 0) / 100
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function shortOrderId(value) {
  return String(value || '').slice(-8).toUpperCase() || '—'
}

function cleanProductName(value) {
  const raw = String(value || '').trim()
  return raw && !/^order\s+[a-z0-9]{5,}$/i.test(raw) ? raw : ''
}

function normalizeTitle(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function safeImageUrl(value) {
  const text = String(value || '').trim()
  return /^https?:\/\//i.test(text) || /^\/(?!\/)/.test(text) ? text : ''
}

function pickImage(value) {
  return safeImageUrl(value?.image?.url || value?.imageUrl || value?.thumbnailUrl ||
    value?.images?.[0]?.url || value?.images?.[0] ||
    value?.packet?.images?.[0]?.url || value?.packet?.images?.[0] ||
    value?.packet?.imageUrl)
}

const STATUS = {
  not_yet_settleable: 'Payment captured',
  awaiting_settlement: 'Awaiting settlement',
  pending_approval: 'Under review',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
  void: 'Void',
}

function Status({ status }) {
  return <span className="hee-badge" data-status={status || 'not_yet_settleable'}>
    {STATUS[status] || String(status || 'Payment captured').replace(/_/g, ' ')}
  </span>
}

function ProductPhoto({ src, name, count }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <span className="hee-photo">
    {src && !failed ? (
      <img src={src} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    ) : <span className="hee-photo-blank">Photo<br />unavailable</span>}
    {count > 1 ? <span className="hee-photo-number">+{count - 1}</span> : null}
  </span>
}

function OrderSale({ order, images, currency }) {
  const previews = Array.isArray(order.itemPreviews) ? order.itemPreviews : []
  const names = Array.isArray(order.itemNames) ? order.itemNames.filter(cleanProductName) : []
  const first = previews.find((item) => cleanProductName(item?.name)) || previews[0] || {}
  const name = cleanProductName(first.name) || cleanProductName(names[0]) || 'Product name unavailable'
  const count = Number(order.itemCount || names.length || previews.length || 1)
  const title = count > 1 ? `${name} + ${count - 1} more` : name
  const image = safeImageUrl(first.imageUrl) ||
    images[`v:${first.productVersionId}`] || images[`n:${normalizeTitle(name)}`] || ''
  const priceMinor = order.netPayableMinor ?? order.grossMinor
  const orderId = `#${shortOrderId(order.sellerOrderId)}`
  const when = dateTime(order.updatedAt || order.createdAt)

  return <Link className="hee-order" to={`/host/orders/${order.sellerOrderId}`}
    aria-label={`View ${title}, order ${shortOrderId(order.sellerOrderId)}`}>
    <span className="hee-ledger-product">
      <ProductPhoto src={image} name={name} count={count} />
      <span className="hee-order-information">
        <strong className="hee-product-name">{title}</strong>
        <span className="hee-mobile-order-meta">{orderId} · {when}</span>
      </span>
    </span>
    <span className="hee-order-reference">
      <strong className="hee-order-id">{orderId}</strong>
      <span className="hee-order-date">{when}</span>
    </span>
    <span className="hee-order-state"><Status status={order.settlementStatus} /></span>
    <span className="hee-order-money">
      <strong className="hee-order-price">{currencyMinor(priceMinor, order.currency || currency)}</strong>
      <span className="hee-mobile-status"><Status status={order.settlementStatus} /></span>
      <span className="hee-visit" aria-hidden="true"><ArrowRight size={17} /></span>
    </span>
  </Link>
}

export default function HostEarningsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState({})
  const [salesPage, setSalesPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const [exhaustedSales, setExhaustedSales] = useState(false)
  const initialFetchStarted = useRef(false)
  const moreInFlight = useRef(false)

  // Fetch once on page entry; later requests require a Refresh or View all click.
  const load = useCallback(async () => {
    if (moreInFlight.current) return
    setLoading(true)
    try {
      const result = await getHostEarningsOverview({ page: 1, limit: 8 })
      if (!result) throw new Error('No earnings information was returned.')
      setData(result)
      setSalesPage(1)
      setExhaustedSales(false)
      setMoreError('')
      setHasLoaded(true)
      setError('')
    } catch (loadError) {
      setError(getHostOperationsErrorMessage(loadError, 'Unable to load earnings.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Prevent duplicate mount requests from React StrictMode effect replay in development.
    if (initialFetchStarted.current) return
    initialFetchStarted.current = true
    void load()
  }, [load])

  const earnings = data?.earnings || {}
  const currency = earnings.currency || 'INR'
  const recentOrders = Array.isArray(data?.recentOrders) ? data.recentOrders : []
  const recentSettlements = Array.isArray(data?.recentSettlements) ? data.recentSettlements : []
  const ready = Boolean(hasLoaded && data)
  const totalPaidOrders = Number(earnings.capturedOrders || 0)
  const hasMoreSales = ready && !exhaustedSales && recentOrders.length < totalPaidOrders

  const loadMoreSales = useCallback(async () => {
    if (loading || moreInFlight.current || !hasMoreSales) return
    moreInFlight.current = true
    setLoadingMore(true)
    setMoreError('')
    try {
      const nextPage = salesPage + 1
      const result = await getHostEarningsOverview({ page: nextPage, limit: 8 })
      if (!Array.isArray(result?.recentOrders)) throw new Error('Unable to load more sales.')
      const nextOrders = result.recentOrders
      if (!nextOrders.length || nextOrders.length < 8) setExhaustedSales(true)
      setData((current) => {
        if (!current) return current
        const knownIds = new Set((current.recentOrders || []).map((order) => order.sellerOrderId))
        const unique = nextOrders.filter((order) => !knownIds.has(order.sellerOrderId))
        return { ...current, recentOrders: [...(current.recentOrders || []), ...unique] }
      })
      setSalesPage(nextPage)
    } catch (loadError) {
      setMoreError(getHostOperationsErrorMessage(loadError, 'Unable to load more sales. Please retry.'))
    } finally {
      moreInFlight.current = false
      setLoadingMore(false)
    }
  }, [loading, hasMoreSales, salesPage])

  const imageLookupKey = useMemo(() => recentOrders.map((order) =>
    (order.itemPreviews || []).map((item) => `${item.productVersionId || ''}:${item.name || ''}`).join('|') ||
    (order.itemNames || []).join('|'),
  ).join('||'), [recentOrders])

  // Only after a user-triggered data load, fall back to existing EPANTRY catalog imagery.
  useEffect(() => {
    if (!imageLookupKey) return undefined
    let active = true
    const wantedNames = new Set()
    const wantedVersions = new Set()
    recentOrders.forEach((order) => {
      if (Array.isArray(order.itemPreviews) && order.itemPreviews.length) {
        order.itemPreviews.forEach((item) => {
          // Prefer the photo already supplied by Earnings; do not fetch it again.
          if (safeImageUrl(item?.imageUrl)) return
          if (normalizeTitle(item?.name)) wantedNames.add(normalizeTitle(item.name))
          if (item?.productVersionId) wantedVersions.add(String(item.productVersionId))
        })
      } else {
        ;(order.itemNames || []).forEach((name) => {
          if (normalizeTitle(name)) wantedNames.add(normalizeTitle(name))
        })
      }
    })
    if (!wantedNames.size && !wantedVersions.size) return undefined

    const foundKeys = new Set()
    const publish = (items) => {
      const found = {}
      items.forEach(({ name, image, versionId }) => {
        const url = safeImageUrl(image)
        const key = normalizeTitle(name)
        if (!url) return
        if (key && wantedNames.has(key)) {
          found[`n:${key}`] = url
          foundKeys.add(`n:${key}`)
        }
        if (versionId && wantedVersions.has(String(versionId))) {
          found[`v:${versionId}`] = url
          foundKeys.add(`v:${versionId}`)
        }
      })
      if (active && Object.keys(found).length) {
        setImages((current) => ({ ...current, ...found }))
      }
    }
    const applyCatalog = (products) => publish((Array.isArray(products) ? products : []).map((product) => ({
      name: product?.displayName || product?.title || product?.name,
      image: pickImage(product),
      versionId: product?.productVersionId || product?.id,
    })))
    const hostTask = listHostListingPackets().then((result) => publish((result?.listings || [])
      .filter((listing) => listing?.status === 'approved')
      .map((listing) => ({
        name: listing?.title || listing?.packet?.title,
        image: pickImage(listing),
        versionId: listing?.packet?.catalogProductVersionId,
      })))).catch(() => {})
    const catalogTask = getCatalogProducts({ page: 1, limit: 100 })
      .then((result) => applyCatalog(result?.products)).catch(() => {})

    Promise.allSettled([hostTask, catalogTask]).then(async () => {
      if (!active) return
      const names = [...wantedNames].filter((name) => !foundKeys.has(`n:${name}`)).slice(0, 12)
      for (let index = 0; index < names.length && active; index += 6) {
        await Promise.allSettled(names.slice(index, index + 6).map(async (name) => {
          const result = await getCatalogProducts({ search: name, page: 1, limit: 15 })
          applyCatalog(result?.products)
        }))
      }
    }).catch(() => {})

    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageLookupKey])

  return <main className="hee-page">
    <style>{earningsStyles}</style>

    <header className="hee-intro">
      <div className="hee-intro-content">
        <span className="hee-kicker">Host / Finance</span>
        <h1>Your earnings</h1>
        <p>Sales, payments and payouts for your business, all in one place.</p>
      </div>
      <div className="hee-control">
        <button type="button" className="hee-refresh" onClick={load} disabled={loading}
          aria-label={loading ? 'Refreshing earnings' : 'Refresh earnings data'}>
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <span className="hee-updated" aria-live="polite">
          {loading && !ready ? 'Loading earnings…' : ready
            ? `Updated ${dateTime(earnings.refreshedAt)}`
            : error ? 'Unable to load earnings. Use Refresh to retry.'
              : 'Select Refresh to load your earnings'}
        </span>
      </div>
    </header>

    <section className="hee-overview" aria-label="Earnings overview" aria-busy={loading}>
      <div className="hee-total">
        <span className="hee-overline">Total captured revenue</span>
        <strong className="hee-total-number">{ready ? currencyMinor(earnings.totalEarnedMinor, currency) : '—'}</strong>
        <span className="hee-total-caption">Received from successful customer payments</span>
      </div>
      <div className="hee-kpis">
        <div className="hee-kpi" data-kind="paid">
          <span className="hee-kpi-title"><span className="hee-kpi-icon"><Check size={17} aria-hidden="true" /></span>Paid to you</span>
          <span className="hee-kpi-bottom">
            <strong className="hee-kpi-number">{ready ? currencyMinor(earnings.paidMinor, currency) : '—'}</strong>
            <span className="hee-kpi-note">Completed payouts</span>
          </span>
        </div>
        <div className="hee-kpi" data-kind="process">
          <span className="hee-kpi-title"><span className="hee-kpi-icon"><WalletCards size={17} aria-hidden="true" /></span>In settlement</span>
          <span className="hee-kpi-bottom">
            <strong className="hee-kpi-number">{ready ? currencyMinor(earnings.inSettlementMinor, currency) : '—'}</strong>
            <span className="hee-kpi-note">Under review or approved</span>
          </span>
        </div>
        <div className="hee-kpi" data-kind="await">
          <span className="hee-kpi-title"><span className="hee-kpi-icon"><Clock3 size={17} aria-hidden="true" /></span>Awaiting settlement</span>
          <span className="hee-kpi-bottom">
            <strong className="hee-kpi-number">{ready ? currencyMinor(earnings.awaitingSettlementMinor, currency) : '—'}</strong>
            <span className="hee-kpi-note">Delivered, not settled yet</span>
          </span>
        </div>
      </div>
    </section>

    {error ? <div className="hee-error" role="alert">{error}</div> : null}

    <section className="hee-sales" aria-labelledby="hee-sales-heading">
      <div className="hee-section-header">
        <div>
          <span className="hee-eyebrow">01 / Sales</span>
          <h2 id="hee-sales-heading">Recent sales</h2>
          <p className="hee-section-sub">Your latest paid orders and products.</p>
        </div>
        <div className="hee-section-actions">
          <span className="hee-count">{ready ? totalPaidOrders : '—'} paid orders</span>
          <Link className="hee-plain-link" to="/host/orders">All orders <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="hee-ledger">
        <div className="hee-ledger-head" aria-hidden="true">
          <span>Product</span><span>Order &amp; date</span><span>Payment status</span><span>Amount</span>
        </div>
        {recentOrders.length ? recentOrders.map((order) => (
          <OrderSale key={order.sellerOrderId} order={order} images={images} currency={currency} />
        )) : <div className="hee-empty-sales">{loading && !ready
          ? 'Loading recent sales…'
          : ready ? 'No paid orders yet.'
            : error ? 'Unable to load sales. Select Refresh to retry.'
              : 'Loading recent sales…'}</div>}
      </div>
      {hasMoreSales ? <div className="hee-more-sales">
        <button type="button" className="hee-more-button" onClick={loadMoreSales}
          disabled={loading || loadingMore} aria-label={`View next ${Math.min(8, totalPaidOrders - recentOrders.length)} sales`}>
          {loadingMore ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : null}
          {loadingMore ? 'Loading…' : 'View all'}
          {!loadingMore ? <ArrowRight size={17} aria-hidden="true" /> : null}
        </button>
      </div> : null}
      {moreError ? <p className="hee-more-error" role="alert">{moreError}</p> : null}
      <div className="hee-sales-foot">
        <p>{ready ? `Showing ${recentOrders.length} of ${totalPaidOrders} paid ${totalPaidOrders === 1 ? 'order' : 'orders'}`
          : error ? 'Sales could not be loaded.' : 'Loading sales…'}</p>
        <Link className="hee-plain-link" to="/host/orders">Manage orders <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>

    <section className="hee-payouts" aria-labelledby="hee-payout-heading">
      <div className="hee-payout-title">
        <span className="hee-eyebrow">02 / Payouts</span>
        <h2 id="hee-payout-heading">Settlements</h2>
        <p className="hee-section-sub">Payments sent or being processed.</p>
      </div>
      <div className="hee-payout-body">
        {recentSettlements.length ? recentSettlements.map((settlement) => (
          <div className="hee-payout-row" key={settlement.id}>
            <div>
              <strong className="hee-payout-value">{currencyMinor(settlement.totals?.netPayableMinor, settlement.currency || currency)}</strong>
              <span className="hee-payout-meta">{settlement.lineCount || 0} {settlement.lineCount === 1 ? 'order' : 'orders'} · {dateTime(settlement.periodStart)} – {dateTime(settlement.periodEnd)}</span>
            </div>
            <Status status={settlement.status} />
          </div>
        )) : <div className="hee-payout-empty">
          <span className="hee-payout-empty-icon"><WalletCards size={21} aria-hidden="true" /></span>
          <div>
            <strong>{loading && !ready ? 'Loading settlements…' : ready ? 'No settlements yet'
              : error ? 'Unable to load settlements' : 'Settlement history'}</strong>
            <p>{loading && !ready ? 'Checking payout records.' : ready
              ? 'Payout records will appear here when they are created.'
              : error ? 'Select Refresh to try again.' : 'Loading payout records…'}</p>
          </div>
        </div>}
      </div>
    </section>
  </main>
}
