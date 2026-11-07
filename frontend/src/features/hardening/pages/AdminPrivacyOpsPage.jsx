import { ClipboardCheck, FileClock, RefreshCw, Scale, AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import AdminShell from '../../admin/components/AdminShell'
import MediaPrivacyReviewQueue from '../components/MediaPrivacyReviewQueue'
import {
  createRegulatoryProfile,
  createRetentionPolicy,
  getHardeningErrorMessage,
  listPrivacyRequests,
  listRegulatoryProfiles,
  listRetentionPolicies,
  transitionRegulatoryProfile,
  transitionRetentionPolicy,
  updatePrivacyRequest,
} from '../services/hardening.service'

const inputClass = 'pp-input focus-ring min-w-0 w-full'
const buttonClass = 'pp-button pp-button-primary focus-ring'
const secondaryButton = 'pp-button pp-button-secondary focus-ring'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function titleize(value) {
  return String(value || '').split('_').filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
}

function SectionLoading({ loading, error, empty, children }) {
  if (loading) return <p className="pp-muted py-4">Loading records…</p>
  if (error) return (
    <div role="alert" className="pp-notice pp-error my-3 flex min-w-0 items-start gap-2">
      <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 break-words">Could not load this section. {error}</p>
    </div>
  )
  if (!children || (Array.isArray(children) && children.length === 0)) return <p className="pp-muted px-3 py-4">{empty}</p>
  return children
}

function LifecycleButtons({ record, onAction, busy }) {
  const action = record.status === 'draft' ? 'submit' : record.status === 'in_review' ? 'approve' : record.status === 'approved' ? 'activate' : null
  if (!action) return <span className="text-sm text-stone-500">No action needed</span>
  return (
    <button type="button" disabled={busy} onClick={() => onAction(record, action)} className={secondaryButton}>
      {action === 'submit' ? 'Send for review' : action === 'approve' ? 'Approve' : 'Make active'}
    </button>
  )
}

function Field({ label, children, span = false }) {
  return (
    <label className={`pp-field ${span ? 'pp-field-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

const privacyPageCSS = String.raw`
.privacy-page{--pp-forest:#173F35;--pp-clay:#C86C42;--pp-paper:#F7F6F2;--pp-sage:#DCE0CF;--pp-peach:#F5E3D8;--pp-border:#DFE2D9;--pp-ink:#24322D;color:var(--pp-ink);width:100%;min-width:0;padding:0 0 16px;font-size:15px}
.privacy-page *{box-sizing:border-box}
.privacy-page .pp-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(310px,.65fr);border:1px solid #E7DDD4;border-top:3px solid var(--pp-clay);border-radius:12px;overflow:hidden;background:#FFFEFB!important;margin-bottom:25px}
.privacy-page .pp-intro-lead{padding:25px 30px;background:#173F35!important;color:#F7F6F2!important}
.privacy-page .pp-kicker{display:block;color:#BB5E36!important;font-size:12px!important;font-weight:800!important;line-height:1.4!important;letter-spacing:.025em!important;text-transform:uppercase}
.privacy-page .pp-intro-lead h2{margin:8px 0 6px!important;color:#F7F6F2!important;font-size:26px!important;font-weight:800!important;line-height:1.23!important;letter-spacing:-.025em}
.privacy-page .pp-intro-lead .pp-kicker{color:#DCE0CF!important}
.privacy-page .pp-intro-lead p{margin:0!important;color:#DCE0CF!important;font-size:15px!important;line-height:1.5!important;max-width:650px}
.privacy-page .pp-intro-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:#E7ECE3!important}
.privacy-page .pp-intro-count{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px 10px;border-left:1px solid #D5DDD1}
.privacy-page .pp-intro-count strong{font-size:32px!important;color:var(--pp-forest)!important;font-weight:800!important;line-height:1!important}
.privacy-page .pp-intro-count span{font-size:13px!important;color:#536459!important;font-weight:700!important}
.privacy-page .pp-section{min-width:0;margin-top:34px}
.privacy-page .pp-section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;margin-bottom:15px;padding-bottom:12px;border-bottom:1px solid #DFE2D9}
.privacy-page .pp-section-title{margin:5px 0 0!important;color:var(--pp-forest)!important;font-size:25px!important;font-weight:800!important;line-height:1.25!important;letter-spacing:-.027em}
.privacy-page .pp-support,.privacy-page .pp-muted{color:#5B6A61!important;font-size:13px!important;line-height:1.45!important}
.privacy-page .pp-tag-count{font-size:13px!important;font-weight:750!important;color:#173F35!important;background:#E7ECE3!important;padding:7px 11px;border-radius:6px;white-space:nowrap}
.privacy-page .pp-row-title{color:var(--pp-forest)!important;font-size:15px!important;font-weight:750!important;line-height:1.35!important}
.privacy-page .pp-pane-title{color:var(--pp-forest)!important;font-size:18px!important;font-weight:800!important;line-height:1.3!important;margin:0 0 14px!important;display:flex;align-items:center;justify-content:space-between;gap:8px}
.privacy-page .pp-notice{display:flex;align-items:center;gap:8px;padding:12px 15px;border-radius:7px;background:#E8EFE5!important;color:var(--pp-forest)!important;font-size:14px!important;margin:12px 0}
.privacy-page .pp-notice.pp-error{background:#FFF0EC!important;color:#A53A30!important;border:1px solid #E8B4A8}
.privacy-page .pp-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:9px 14px;border-radius:7px!important;font-size:14px!important;font-weight:750!important;line-height:1.25!important;cursor:pointer;transition:background .18s ease,transform .18s ease;border:1px solid #CBD7CC}
.privacy-page .pp-button:disabled{cursor:not-allowed;opacity:.55;transform:none}
.privacy-page .pp-button:not(:disabled):hover{transform:translateY(-1px)}
.privacy-page .pp-button-primary{background:var(--pp-forest)!important;color:#fff!important;border-color:var(--pp-forest)!important}
.privacy-page .pp-button-secondary{background:#fff!important;color:var(--pp-forest)!important;border-color:#CCD6CB!important}
.privacy-page .pp-button:focus-visible,.privacy-page .pp-request:focus-visible,.privacy-page .pp-review-row:focus-visible{outline:3px solid #C86C42!important;outline-offset:2px}
.privacy-page .pp-field{display:flex;flex-direction:column;gap:7px;min-width:0;color:var(--pp-forest)!important;font-size:13px!important;font-weight:750!important}
.privacy-page .pp-input{width:100%;min-width:0;background:#fff!important;border:1px solid #D6DDD4!important;border-radius:7px!important;padding:11px 12px;color:#293A32!important;font-size:14px!important;line-height:1.35!important;min-height:42px}
.privacy-page textarea.pp-input{min-height:82px;resize:vertical}
.privacy-page .pp-input:focus{outline:2px solid #C86C42!important;outline-offset:1px}
.privacy-page .pp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.privacy-page .pp-field-wide{grid-column:1/-1}
.privacy-page .pp-customer{margin-top:35px}
.privacy-page .pp-split{display:grid;grid-template-columns:minmax(0,.98fr) minmax(0,1.02fr);background:#fff!important;border:1px solid #E1E4DA;border-radius:12px;overflow:hidden}
.privacy-page .pp-split-side{min-width:0;padding:24px;background:#fff!important}
.privacy-page .pp-split-side+.pp-split-side{border-left:1px solid #E3E5DE;background:#F0F5F7!important}
.privacy-page .pp-request-list,.privacy-page .pp-saved-list{border-top:1px solid #E5E9E3}
.privacy-page .pp-request{border:0;border-bottom:1px solid #E5E9E3;background:#fff!important;padding:16px 12px;display:flex;align-items:center;justify-content:space-between;gap:15px;width:100%;text-align:left;cursor:pointer}
.privacy-page .pp-request:hover{background:#F3F6F0!important}
.privacy-page .pp-request[aria-pressed='true']{background:#E6EEE6!important;box-shadow:inset 4px 0 0 #173F35}
.privacy-page .pp-status{flex-shrink:0;display:inline-flex;align-items:center;font-size:12px!important;font-weight:750!important;color:#7F4934!important;background:#F6E9DF!important;border-radius:5px;padding:5px 8px}
.privacy-page .pp-selected-request{background:#fff!important;border-left:3px solid #173F35;padding:14px 16px;margin-bottom:18px;border-radius:0 6px 6px 0}
.privacy-page .pp-legal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}
.privacy-page .pp-policy{border:1px solid #E1E5DC;border-radius:12px;overflow:hidden;background:#fff!important;min-width:0}
.privacy-page .pp-policy-head{padding:20px 22px;background:#E8EFE4!important;border-bottom:1px solid #DBE3D5}
.privacy-page .pp-policy-head.lilac{background:#F0EAF4!important}
.privacy-page .pp-policy-head .pp-pane-title{margin:5px 0 5px!important}
.privacy-page .pp-policy-body{padding:21px 22px;min-width:0;background:#FFFEFB!important}
.privacy-page .pp-list-head{font-weight:800!important;color:var(--pp-forest)!important;font-size:15px!important;border-top:1px solid #E5E7E2;padding-top:20px;margin:21px 0 10px}
.privacy-page .pp-saved-row{padding:13px 4px;border-bottom:1px solid #E5E7E2;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.privacy-page .pp-footnote{padding-top:13px;margin-top:26px;border-top:1px solid #E1E5DD;color:#69766D!important;font-size:13px!important}
/* Image reviews: editorial list and photo-led decision panel */
.privacy-page .pp-image-workspace{border:1px solid #E3E5DB;border-radius:12px;background:#FFFEFB!important;overflow:hidden}
.privacy-page .pp-image-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 20px;background:#E7ECE3!important;border-bottom:1px solid #CEDBCF}
.privacy-page .pp-image-toolbar strong{color:var(--pp-forest)!important;font-size:17px!important;font-weight:800!important}
.privacy-page .pp-queue-number{display:inline-block;color:#52695B!important;margin-left:9px;font-size:13px!important;font-weight:650!important}
.privacy-page .pp-image-actions{display:flex;align-items:center;gap:9px}
.privacy-page .pp-select-wrap{display:flex;align-items:center;position:relative}
.privacy-page .pp-select-wrap select{appearance:none;min-height:38px;min-width:140px;padding:9px 34px 9px 12px;border:1px solid #CBD9CD!important;border-radius:7px!important;background:#fff!important;color:var(--pp-forest)!important;font-size:14px!important;font-weight:700!important}
.privacy-page .pp-select-wrap svg{position:absolute;right:10px;pointer-events:none;color:#173F35}
.privacy-page .pp-review-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.88fr);min-width:0;align-items:stretch}
/* The photo queue fills the height of the review detail; its rows do not stretch the whole page. */
.privacy-page .pp-review-browser-column{position:relative;min-width:0;min-height:0;align-self:stretch;background:#fff!important}
.privacy-page .pp-review-browser{position:absolute;inset:0;width:100%;height:100%;min-width:0;min-height:0;max-height:none;overflow-y:auto;overscroll-behavior:auto;background:#fff!important;scrollbar-width:thin;scrollbar-color:#AABDB0 #F4F6F1}
.privacy-page .pp-review-browser:focus-visible{outline:2px solid #173F35!important;outline-offset:-2px}
.privacy-page .pp-review-browser::-webkit-scrollbar{width:9px}
.privacy-page .pp-review-browser::-webkit-scrollbar-thumb{background:#B3C3B5;border-radius:9px;border:2px solid #F4F6F1}
.privacy-page .pp-review-browser::-webkit-scrollbar-track{background:#F4F6F1}
.privacy-page .pp-queue-loading{padding:14px 18px;background:#F1F5EE!important;color:#173F35!important;font-size:14px!important}
.privacy-page .pp-review-row{width:100%;min-width:0;display:flex;gap:14px;align-items:center;text-align:left;border:0;border-bottom:1px solid #E6E8E0!important;padding:15px 18px;background:#fff!important;color:var(--pp-ink)!important;cursor:pointer}
.privacy-page .pp-review-row:hover{background:#F3F6F0!important}
.privacy-page .pp-review-row.is-selected{background:#EAF1E8!important;box-shadow:inset 4px 0 0 #173F35}
.privacy-page .pp-image-frame{width:92px;height:82px;flex:0 0 92px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#EDEFE8!important;border:1px solid #E0E3DB;border-radius:7px}
.privacy-page .pp-image-frame img{width:100%;height:100%;object-fit:contain;display:block}
.privacy-page .pp-image-frame-large{width:100%;height:260px;flex:initial;border-radius:8px;background:#F1F0EB!important}
.privacy-page .pp-image-missing{color:#68756B!important;display:flex;gap:5px;align-items:center;justify-content:center;flex-direction:column;font-size:11px!important;text-align:center;padding:4px}
.privacy-page .pp-image-frame-large .pp-image-missing{font-size:14px!important}
.privacy-page .pp-review-row-text{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}
.privacy-page .pp-review-item-name{color:var(--pp-forest)!important;font-size:16px!important;font-weight:800!important;line-height:1.25!important;overflow-wrap:anywhere}
.privacy-page .pp-review-host{color:#485E52!important;font-size:14px!important;font-weight:650!important;line-height:1.25!important;overflow-wrap:anywhere}
.privacy-page .pp-review-image-type{color:#6C746C!important;font-size:12.5px!important;line-height:1.3!important}
.privacy-page .pp-review-marker{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:50%;background:#F0F1E9!important;color:#778177!important}
.privacy-page .pp-review-marker.is-selected{background:#DCE0CF!important;color:#173F35!important}
.privacy-page .pp-review-detail{min-width:0;background:#F7F8F4!important;border-left:1px solid #DBE3D9;padding:22px 23px;align-self:stretch}
.privacy-page .pp-detail-heading{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:13px}
.privacy-page .pp-detail-meta h3{margin:15px 0 7px!important;color:var(--pp-forest)!important;font-size:22px!important;line-height:1.2!important;font-weight:800!important;overflow-wrap:anywhere}
.privacy-page .pp-detail-meta p{margin:4px 0;color:#5A6961!important;font-size:14px!important;line-height:1.45!important}
.privacy-page .pp-detail-meta strong{color:var(--pp-forest)!important}
.privacy-page .pp-meta-separator{margin:0 6px;color:#BCAC9B!important}
.privacy-page .pp-detail-meta .pp-risk-reasons{color:#9D4E32!important;margin:10px 0 4px!important;font-weight:700!important}
.privacy-page .pp-original-link{display:inline-flex;align-items:center;gap:8px;color:#925132!important;border-bottom:1px solid #C86C42;font-size:14px!important;font-weight:750!important;margin-top:10px;text-decoration:none}
.privacy-page .pp-decision-block{margin-top:22px;padding-top:17px;border-top:1px solid #E1DDD5;display:grid;gap:13px}
.privacy-page .pp-decision-block h4{color:var(--pp-forest)!important;font-size:18px!important;font-weight:800!important;margin:0!important}
.privacy-page .pp-decision-save{width:100%;min-height:44px}
.privacy-page .pp-completed-decision{margin-top:17px;background:#E4EFE4!important;color:var(--pp-forest)!important;padding:13px;border-radius:7px;display:flex;align-items:center;gap:8px;font-size:14px!important;font-weight:750!important}
.privacy-page .pp-image-empty{padding:28px 22px;color:#617168!important;font-size:15px!important}
.privacy-page .pp-retry-inline{color:#9A4C32!important;text-decoration:underline;font-weight:750!important;margin-left:10px}
.privacy-page .pp-review-success{margin:0!important;border-radius:0!important}
@media(max-width:1080px){.privacy-page .pp-legal-grid{grid-template-columns:1fr}.privacy-page .pp-review-layout{grid-template-columns:minmax(0,1fr) minmax(300px,.95fr)}}
@media(max-width:780px){.privacy-page .pp-intro{grid-template-columns:1fr}.privacy-page .pp-intro-count{padding:15px 8px}.privacy-page .pp-review-layout{grid-template-columns:1fr}.privacy-page .pp-review-detail{border-left:0;border-top:1px solid #E4E0D8}.privacy-page .pp-review-browser-column{height:390px;align-self:auto}.privacy-page .pp-review-browser{height:100%;max-height:none;overflow-y:auto}.privacy-page .pp-split{grid-template-columns:1fr}.privacy-page .pp-split-side+.pp-split-side{border-left:0;border-top:1px solid #E4E3DD}}
@media(max-width:600px){.privacy-page .pp-section{margin-top:25px}.privacy-page .pp-section-title{font-size:21px!important}.privacy-page .pp-intro-lead{padding:19px 19px}.privacy-page .pp-intro-lead h2{font-size:23px!important}.privacy-page .pp-intro-count strong{font-size:26px!important}.privacy-page .pp-intro-count span{font-size:12px!important}.privacy-page .pp-section-head{align-items:flex-start}.privacy-page .pp-image-toolbar{padding:13px 14px;flex-wrap:wrap}.privacy-page .pp-image-actions{width:100%}.privacy-page .pp-select-wrap{flex:1}.privacy-page .pp-select-wrap select{width:100%}.privacy-page .pp-review-row{gap:11px;padding:12px}.privacy-page .pp-image-frame{width:78px;height:74px;flex-basis:78px}.privacy-page .pp-image-frame-large{height:220px;width:100%;flex-basis:auto}.privacy-page .pp-review-item-name{font-size:15px!important}.privacy-page .pp-review-detail{padding:16px}.privacy-page .pp-detail-meta h3{font-size:20px!important}.privacy-page .pp-split-side,.privacy-page .pp-policy-body{padding:17px}.privacy-page .pp-policy-head{padding:16px 17px}.privacy-page .pp-form-grid{grid-template-columns:1fr;gap:13px}.privacy-page .pp-saved-row{flex-direction:column;gap:7px}.privacy-page .pp-review-browser-column{height:340px}}


/* Mobile-only refinement: preserve established palette and all review workflows. */
@media (max-width: 767px) {
  .privacy-page { min-width: 0; width: 100%; padding-bottom: 6px; font-size: 15px; }
  .privacy-page .pp-intro { margin-bottom: 16px; border-radius: 10px; }
  .privacy-page .pp-intro-lead { padding: 16px 17px!important; }
  .privacy-page .pp-intro-lead .pp-kicker { font-size: 11px!important; }
  .privacy-page .pp-intro-lead h2 { font-size: 22px!important; line-height: 1.15!important; margin: 5px 0 6px!important; }
  .privacy-page .pp-intro-lead p { font-size: 13px!important; line-height: 1.4!important; }
  .privacy-page .pp-intro-count { padding: 11px 5px!important; gap: 4px; }
  .privacy-page .pp-intro-count strong { font-size: 25px!important; }
  .privacy-page .pp-intro-count span { font-size: 12px!important; text-align: center; }
  .privacy-page .pp-section, .privacy-page .pp-customer { margin-top: 20px!important; }
  .privacy-page .pp-section-head { align-items: flex-end; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; }
  .privacy-page .pp-section-title { font-size: 21px!important; line-height: 1.18!important; margin-top: 3px!important; }
  .privacy-page .pp-kicker { font-size: 11px!important; }
  .privacy-page .pp-tag-count { padding: 5px 8px; font-size: 11px!important; }
  .privacy-page .pp-image-workspace, .privacy-page .pp-split, .privacy-page .pp-policy { border-radius: 10px; }
  .privacy-page .pp-image-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 10px 11px!important; }
  .privacy-page .pp-image-toolbar strong { font-size: 15px!important; }
  .privacy-page .pp-queue-number { display: block; margin-left: 0; margin-top: 2px; font-size: 11px!important; }
  .privacy-page .pp-image-actions { width: auto!important; min-width: 0; gap: 7px; justify-self: end; }
  .privacy-page .pp-select-wrap { flex: none!important; }
  .privacy-page .pp-select-wrap select { min-width: 90px!important; width: 100px!important; min-height: 40px; padding: 8px 27px 8px 10px; font-size: 13px!important; }
  .privacy-page .pp-image-actions .pp-button { min-width: 41px; width: 41px; height: 41px; min-height: 41px; padding: 0; }
  .privacy-page .pp-image-actions .pp-button span { display: none; }
  .privacy-page .pp-review-browser-column { height: 270px!important; min-height: 270px; }
  .privacy-page .pp-review-browser { inset: 0; height: 100%!important; overflow-y: auto!important; overscroll-behavior-y: auto; -webkit-overflow-scrolling: touch; }
  .privacy-page .pp-review-row { min-height: 69px; gap: 10px; padding: 9px 10px!important; }
  .privacy-page .pp-image-frame:not(.pp-image-frame-large) { width: 60px; height: 60px; flex: 0 0 60px; }
  .privacy-page .pp-review-row-text { gap: 2px; }
  .privacy-page .pp-review-item-name { font-size: 14px!important; line-height: 1.18!important; }
  .privacy-page .pp-review-host { font-size: 12.5px!important; }
  .privacy-page .pp-review-image-type { font-size: 11.5px!important; line-height: 1.25!important; }
  .privacy-page .pp-review-marker { width: 27px; height: 27px; flex-basis: 27px; }
  .privacy-page .pp-review-detail { padding: 13px 14px!important; }
  .privacy-page .pp-detail-heading { margin-bottom: 9px; }
  .privacy-page .pp-image-frame-large { width: 100%; height: 177px!important; flex-basis: auto; }
  .privacy-page .pp-detail-meta h3 { font-size: 19px!important; margin: 11px 0 5px!important; }
  .privacy-page .pp-detail-meta p { margin: 3px 0; font-size: 13px!important; }
  .privacy-page .pp-original-link { font-size: 13px!important; margin-top: 7px; }
  .privacy-page .pp-decision-block { margin-top: 13px; padding-top: 12px; gap: 10px; }
  .privacy-page .pp-decision-block h4 { font-size: 17px!important; }
  .privacy-page .pp-field { gap: 5px; font-size: 13px!important; }
  .privacy-page .pp-input { min-width: 0; max-width: 100%; min-height: 44px; padding: 9px 10px; font-size: 16px!important; }
  .privacy-page textarea.pp-input { min-height: 66px; }
  .privacy-page .pp-decision-save { min-height: 46px; }
  .privacy-page .pp-split { grid-template-columns: 1fr; }
  .privacy-page .pp-split-side { padding: 13px 14px!important; }
  .privacy-page .pp-split-side + .pp-split-side { border-left: 0; border-top: 1px solid #E4E3DD; }
  .privacy-page .pp-pane-title { font-size: 17px!important; margin-bottom: 9px!important; }
  .privacy-page .pp-request { padding: 11px 7px; gap: 8px; }
  .privacy-page .pp-request .pp-muted { font-size: 12px!important; line-height: 1.3!important; }
  .privacy-page .pp-status { font-size: 11px!important; padding: 4px 6px; }
  .privacy-page .pp-selected-request { padding: 11px 12px; margin-bottom: 12px; }
  .privacy-page .pp-policy-head { padding: 12px 14px!important; }
  .privacy-page .pp-policy-head .pp-pane-title { font-size: 17px!important; margin-bottom: 0!important; }
  .privacy-page .pp-policy-body { padding: 14px!important; }
  .privacy-page .pp-legal-grid { grid-template-columns: 1fr; gap: 14px; }
  .privacy-page .pp-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr))!important; gap: 11px 10px!important; }
  .privacy-page .pp-field-wide, .privacy-page .pp-form-grid > button[type='submit'] { grid-column: 1 / -1; }
  .privacy-page .pp-form-grid > button[type='submit'] { width: 100%; min-height: 44px; }
  .privacy-page .pp-form-grid input[type='date'] { width: 100%; min-width: 0; }
  .privacy-page .pp-list-head { padding-top: 12px; margin: 15px 0 8px; font-size: 14px!important; }
  .privacy-page .pp-saved-row { padding: 10px 0; gap: 7px; }
  .privacy-page .pp-button { min-height: 43px; }
  .privacy-page .pp-support, .privacy-page .pp-muted { font-size: 12.5px!important; }
  .privacy-page .pp-footnote { margin-top: 16px; padding-top: 9px; font-size: 12px!important; }
}
@media (max-width: 355px) {
  .privacy-page .pp-form-grid { grid-template-columns: 1fr!important; }
  .privacy-page .pp-image-toolbar { grid-template-columns: 1fr; }
  .privacy-page .pp-image-actions { width: 100%!important; justify-self: stretch; }
  .privacy-page .pp-select-wrap { flex: 1!important; }
  .privacy-page .pp-select-wrap select { width: 100%!important; }
  .privacy-page .pp-image-frame:not(.pp-image-frame-large) { width: 55px; height: 55px; flex-basis: 55px; }
}

`

export default function AdminPrivacyOpsPage() {
  const [privacyRequests, setPrivacyRequests] = useState([])
  const [retentionPolicies, setRetentionPolicies] = useState([])
  const [regulatoryProfiles, setRegulatoryProfiles] = useState([])
  const [loadState, setLoadState] = useState({ privacy: 'loading', retention: 'loading', regulatory: 'loading' })
  const [loadErrors, setLoadErrors] = useState({ privacy: '', retention: '', regulatory: '' })
  const [selectedPrivacyId, setSelectedPrivacyId] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState('in_review')
  const [blockedReasonCode, setBlockedReasonCode] = useState('')
  const [exportArtifactStatus, setExportArtifactStatus] = useState('not_generated')
  const [workflowReason, setWorkflowReason] = useState('Reviewed customer privacy request.')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [showAllRequests, setShowAllRequests] = useState(false)
  const [showAllRetention, setShowAllRetention] = useState(false)
  const [showAllRegulatory, setShowAllRegulatory] = useState(false)
  const [retentionForm, setRetentionForm] = useState({
    policyKey: '', dataClass: '', purpose: '', retentionDays: '365', dispositionAction: 'delete',
    effectiveFrom: new Date().toISOString().slice(0, 10), evidenceRef: '',
    reason: 'Create a new data retention policy draft.',
  })
  const [regulatoryForm, setRegulatoryForm] = useState({
    profileKey: '', jurisdiction: 'IN', operatorApplicability: 'platform_operator',
    effectiveFrom: new Date().toISOString().slice(0, 10), methodologyVersion: 'v1', evidenceRef: '',
    reason: 'Create a new regulatory profile draft.',
  })

  const selectedPrivacy = useMemo(() => privacyRequests.find((item) => item.id === selectedPrivacyId) || null, [privacyRequests, selectedPrivacyId])

  const load = useCallback(async () => {
    setLoadState({ privacy: 'loading', retention: 'loading', regulatory: 'loading' })
    setLoadErrors({ privacy: '', retention: '', regulatory: '' })
    const jobs = [
      ['privacy', () => listPrivacyRequests({ limit: 200 }), 'privacyRequests', setPrivacyRequests],
      ['retention', listRetentionPolicies, 'policies', setRetentionPolicies],
      ['regulatory', listRegulatoryProfiles, 'profiles', setRegulatoryProfiles],
    ]
    // Each queue loads independently, so one failed API cannot hide the other queues.
    await Promise.all(jobs.map(async ([key, fetcher, field, setter]) => {
      try {
        const response = await fetcher()
        if (!Array.isArray(response?.[field])) throw new Error('Unexpected response from the server.')
        setter(response[field])
        setLoadState((current) => ({ ...current, [key]: 'ready' }))
      } catch (requestError) {
        setLoadErrors((current) => ({ ...current, [key]: getHardeningErrorMessage(requestError, 'Please try Refresh.') }))
        setLoadState((current) => ({ ...current, [key]: 'error' }))
      }
    }))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selectedPrivacy) return
    setWorkflowStatus(selectedPrivacy.status === 'submitted' ? 'in_review' : selectedPrivacy.status)
    setBlockedReasonCode(selectedPrivacy.blockedReasonCode || '')
    setExportArtifactStatus(selectedPrivacy.exportArtifactStatus || 'not_generated')
  }, [selectedPrivacy])

  async function savePrivacyWorkflow() {
    if (!selectedPrivacy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await updatePrivacyRequest(selectedPrivacy.id, {
        status: workflowStatus, blockedReasonCode, exportArtifactStatus, reason: workflowReason,
      })
      setNotice('Privacy request updated. The decision has been recorded.')
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, 'Unable to update this request.'))
    } finally { setBusy(false) }
  }

  async function runLifecycle(kind, record, action) {
    setBusy(true); setError(''); setNotice('')
    try {
      const reason = `Admin ${action} action for ${kind}.`
      if (kind === 'retention policy') await transitionRetentionPolicy(record.id, action, reason)
      else await transitionRegulatoryProfile(record.id, action, reason)
      setNotice(`${titleize(action)} completed for ${kind}.`)
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, `Unable to ${action} ${kind}.`))
    } finally { setBusy(false) }
  }

  async function submitRetentionVersion(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await createRetentionPolicy({
        policyKey: retentionForm.policyKey, dataClass: retentionForm.dataClass,
        purpose: retentionForm.purpose,
        retentionDays: retentionForm.dispositionAction === 'retain' ? null : Number(retentionForm.retentionDays),
        dispositionAction: retentionForm.dispositionAction, immutableRecordClass: false,
        applicability: ['platform_operator'], effectiveFrom: new Date(retentionForm.effectiveFrom).toISOString(),
        effectiveTo: null,
        evidenceRefs: [{ referenceType: 'policy_source', reference: retentionForm.evidenceRef, note: 'Retention policy evidence source.' }],
        reason: retentionForm.reason,
      })
      setNotice('Retention policy draft created.')
      setRetentionForm((value) => ({ ...value, policyKey: '', dataClass: '', purpose: '', evidenceRef: '' }))
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, 'Unable to create the retention policy.'))
    } finally { setBusy(false) }
  }

  async function submitRegulatoryVersion(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await createRegulatoryProfile({
        profileKey: regulatoryForm.profileKey, jurisdiction: regulatoryForm.jurisdiction,
        operatorApplicability: [regulatoryForm.operatorApplicability],
        effectiveFrom: new Date(regulatoryForm.effectiveFrom).toISOString(), effectiveTo: null,
        requiredFields: [], calculationMethodologyVersion: regulatoryForm.methodologyVersion,
        presentationRules: {},
        evidenceRefs: [{ referenceType: 'regulatory_source', reference: regulatoryForm.evidenceRef, note: 'Regulatory profile source.' }],
        reason: regulatoryForm.reason,
      })
      setNotice('Regulatory profile draft created.')
      setRegulatoryForm((value) => ({ ...value, profileKey: '', evidenceRef: '' }))
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, 'Unable to create the regulatory profile.'))
    } finally { setBusy(false) }
  }

  const requestItems = showAllRequests ? privacyRequests : privacyRequests.slice(0, 6)
  const retentionItems = showAllRetention ? retentionPolicies : retentionPolicies.slice(0, 6)
  const regulatoryItems = showAllRegulatory ? regulatoryProfiles : regulatoryProfiles.slice(0, 6)
  const statusLabel = (status) => status === 'in_review' ? 'In review' : titleize(status)

  return (
    <AdminShell
      title="Image Privacy & Safety Review"
      mobileStackHeader
      description="Image reviews, customer requests and data policies."
      actions={<button type="button" onClick={load} disabled={Object.values(loadState).some((value) => value === 'loading')} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#CED9CD] bg-[#F7F6F2] px-4 py-2 text-sm font-bold text-[#173F35] disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" /> Refresh</button>}
    >
      <div className="privacy-page">
        <style>{privacyPageCSS}</style>
        <section className="pp-intro" aria-label="Privacy workspace overview">
          <div className="pp-intro-lead">
            <span className="pp-kicker">Privacy & safety workspace</span>
            <h2>Images first. Privacy always.</h2>
            <p>Review image evidence, respond to customers and manage privacy rules.</p>
          </div>
          <div className="pp-intro-counts" aria-label="Record counts">
            {[
              ['Requests', privacyRequests.length, loadState.privacy],
              ['Policies', retentionPolicies.length, loadState.retention],
              ['Legal profiles', regulatoryProfiles.length, loadState.regulatory],
            ].map(([label, count, state]) => (
              <div className="pp-intro-count" key={label}>
                <strong aria-label={`${label}: ${state === 'error' ? 'Unavailable' : count}`}>{state === 'error' ? '—' : state === 'loading' ? '…' : count}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {error || notice ? <div role={error ? 'alert' : 'status'} aria-live="polite" className={`pp-notice ${error ? 'pp-error' : ''}`}>{error || notice}</div> : null}

        <section className="pp-section" aria-labelledby="pp-image-heading">
          <header className="pp-section-head">
            <div><span className="pp-kicker">01 / Image checks</span><h2 id="pp-image-heading" className="pp-section-title">Review flagged images</h2></div>
          </header>
          <MediaPrivacyReviewQueue />
        </section>

        <section className="pp-section pp-customer" aria-labelledby="pp-request-heading">
          <header className="pp-section-head">
            <div><span className="pp-kicker">02 / Customer requests</span><h2 id="pp-request-heading" className="pp-section-title">Customer requests</h2></div>
            {loadState.privacy === 'ready' ? <span className="pp-tag-count">{privacyRequests.length} requests</span> : null}
          </header>
          <div className="pp-split">
            <div className="pp-split-side">
              <h3 className="pp-pane-title">Request queue</h3>
              <div className="pp-request-list">
                <SectionLoading loading={loadState.privacy === 'loading'} error={loadErrors.privacy} empty="No customer privacy requests yet.">
                  {requestItems.map((request) => (
                    <button key={request.id} type="button" className="pp-request" onClick={() => setSelectedPrivacyId(request.id)} aria-pressed={selectedPrivacyId === request.id}>
                      <span className="min-w-0 flex-1">
                        <span className="pp-row-title block">{titleize(request.requestType)}</span>
                        <span className="pp-muted mt-1 block break-all">{request.user?.email || request.userId || 'Customer'} · {formatDate(request.requestedAt)}</span>
                        <span className="pp-muted mt-0.5 block">Retention checks: {request.retentionEvaluation?.length || 0}</span>
                      </span>
                      <span className="pp-status">{statusLabel(request.status)}</span>
                    </button>
                  ))}
                </SectionLoading>
              </div>
              {privacyRequests.length > 6 ? <button type="button" className={`${secondaryButton} mt-3`} onClick={() => setShowAllRequests((value) => !value)}>{showAllRequests ? 'Show fewer' : `View all ${privacyRequests.length}`}</button> : null}
              {privacyRequests.length >= 200 ? <p className="pp-muted mt-2">Showing the 200 latest requests.</p> : null}
            </div>
            <div className="pp-split-side">
              <h3 className="pp-pane-title">Review & decide <ClipboardCheck size={19} aria-hidden="true" /></h3>
              {selectedPrivacy ? <div className="min-w-0">
                <div className="pp-selected-request">
                  <p className="pp-row-title">{titleize(selectedPrivacy.requestType)}</p>
                  <p className="pp-muted mt-1 break-all">{selectedPrivacy.user?.email || selectedPrivacy.userId}</p>
                  <p className="pp-muted mt-1">Submitted {formatDate(selectedPrivacy.requestedAt)} · Retention checks: {selectedPrivacy.retentionEvaluation?.length || 0}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Request status"><select className={inputClass} value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value)}>{['submitted','in_review','blocked','processing','completed','rejected','cancelled'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></Field>
                  <Field label="Data export"><select className={inputClass} value={exportArtifactStatus} onChange={(event) => setExportArtifactStatus(event.target.value)}>{['not_generated','available','expired'].map((value) => <option key={value} value={value}>{titleize(value)}</option>)}</select></Field>
                  <Field label="Reason if blocked" span><input className={inputClass} value={blockedReasonCode} onChange={(event) => setBlockedReasonCode(event.target.value)} placeholder="Reason code, if applicable" /></Field>
                  <Field label="Decision note" span><textarea className={inputClass} rows={3} value={workflowReason} onChange={(event) => setWorkflowReason(event.target.value)} /></Field>
                </div>
                <button type="button" disabled={busy} onClick={savePrivacyWorkflow} className={`${buttonClass} mt-4`}>Save decision</button>
              </div> : <p className="pp-muted rounded-lg border border-[#D9E5EA] bg-white p-4">Select a request to review.</p>}
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="pp-rules-heading">
          <header className="pp-section-head">
            <div><span className="pp-kicker">03 / Governance rules</span><h2 id="pp-rules-heading" className="pp-section-title">Data retention & legal</h2></div>
          </header>
          <div className="pp-legal-grid">
            <section className="pp-policy" aria-label="Data retention policies">
              <div className="pp-policy-head">
                <p className="pp-kicker">Data retention</p>
                <h3 className="pp-pane-title">Retention policies <FileClock size={21} aria-hidden="true" /></h3>
                
              </div>
              <div className="pp-policy-body">
                <form className="pp-form-grid" onSubmit={submitRetentionVersion}>
                  <Field label="Policy key"><input required className={inputClass} value={retentionForm.policyKey} onChange={(event) => setRetentionForm((value) => ({...value,policyKey:event.target.value}))} placeholder="e.g. customer-records" /></Field>
                  <Field label="Data category"><input required className={inputClass} value={retentionForm.dataClass} onChange={(event) => setRetentionForm((value) => ({...value,dataClass:event.target.value}))} placeholder="e.g. order records" /></Field>
                  <Field label="Retention purpose" span><input required minLength={10} className={inputClass} value={retentionForm.purpose} onChange={(event) => setRetentionForm((value) => ({...value,purpose:event.target.value}))} placeholder="Why this data is kept" /></Field>
                  <Field label="Keep for (days)"><input className={inputClass} type="number" min="0" disabled={retentionForm.dispositionAction === 'retain'} value={retentionForm.retentionDays} onChange={(event) => setRetentionForm((value) => ({...value,retentionDays:event.target.value}))} /></Field>
                  <Field label="After retention"><select className={inputClass} value={retentionForm.dispositionAction} onChange={(event) => setRetentionForm((value) => ({...value,dispositionAction:event.target.value}))}>{['delete','anonymize','restrict','retain'].map((value) => <option key={value} value={value}>{titleize(value)}</option>)}</select></Field>
                  <Field label="Start date"><input required className={inputClass} type="date" value={retentionForm.effectiveFrom} onChange={(event) => setRetentionForm((value) => ({...value,effectiveFrom:event.target.value}))} /></Field>
                  <Field label="Evidence reference"><input required className={inputClass} value={retentionForm.evidenceRef} onChange={(event) => setRetentionForm((value) => ({...value,evidenceRef:event.target.value}))} placeholder="Policy source" /></Field>
                  <Field label="Reason for creating" span><textarea required className={inputClass} rows={2} value={retentionForm.reason} onChange={(event) => setRetentionForm((value) => ({...value,reason:event.target.value}))} /></Field>
                  <button type="submit" disabled={busy} className={buttonClass}>Save retention draft</button>
                </form>
                <div className="pp-list-head">Saved retention rules {loadState.retention === 'ready' ? <span className="pp-muted">({retentionPolicies.length})</span> : null}</div>
                <div className="pp-saved-list">
                  <SectionLoading loading={loadState.retention === 'loading'} error={loadErrors.retention} empty="No retention policies yet.">
                    {retentionItems.map((policy) => <article key={policy.id} className="pp-saved-row">
                      <div className="min-w-0"><p className="pp-row-title break-words">{policy.policyKey} · v{policy.versionNumber}</p><p className="pp-muted mt-1 break-words">{policy.dataClass} · {titleize(policy.status)} · {formatDate(policy.effectiveFrom)}</p></div>
                      <LifecycleButtons record={policy} busy={busy} onAction={(record, action) => runLifecycle('retention policy',record,action)} />
                    </article>)}
                  </SectionLoading>
                </div>
                {retentionPolicies.length > 6 ? <button type="button" className={`${secondaryButton} mt-3`} onClick={() => setShowAllRetention((value) => !value)}>{showAllRetention ? 'Show fewer' : `View all ${retentionPolicies.length}`}</button> : null}
              </div>
            </section>

            <section className="pp-policy" aria-label="Legal requirements">
              <div className="pp-policy-head lilac">
                <p className="pp-kicker">Legal compliance</p>
                <h3 className="pp-pane-title">Regulatory profiles <Scale size={21} aria-hidden="true" /></h3>
                
              </div>
              <div className="pp-policy-body">
                <form className="pp-form-grid" onSubmit={submitRegulatoryVersion}>
                  <Field label="Profile key"><input required className={inputClass} value={regulatoryForm.profileKey} onChange={(event) => setRegulatoryForm((value) => ({...value,profileKey:event.target.value}))} placeholder="e.g. india-platform" /></Field>
                  <Field label="Country / region"><input required className={inputClass} value={regulatoryForm.jurisdiction} onChange={(event) => setRegulatoryForm((value) => ({...value,jurisdiction:event.target.value}))} placeholder="IN" /></Field>
                  <Field label="Applies to"><select className={inputClass} value={regulatoryForm.operatorApplicability} onChange={(event) => setRegulatoryForm((value) => ({...value,operatorApplicability:event.target.value}))}>{['consumer_service','marketplace_operator','brand_content_operator','hospitality_operator','platform_operator'].map((value) => <option key={value} value={value}>{titleize(value)}</option>)}</select></Field>
                  <Field label="Start date"><input required className={inputClass} type="date" value={regulatoryForm.effectiveFrom} onChange={(event) => setRegulatoryForm((value) => ({...value,effectiveFrom:event.target.value}))} /></Field>
                  <Field label="Method / version"><input required className={inputClass} value={regulatoryForm.methodologyVersion} onChange={(event) => setRegulatoryForm((value) => ({...value,methodologyVersion:event.target.value}))} placeholder="v1" /></Field>
                  <Field label="Legal evidence"><input required className={inputClass} value={regulatoryForm.evidenceRef} onChange={(event) => setRegulatoryForm((value) => ({...value,evidenceRef:event.target.value}))} placeholder="Regulation or document" /></Field>
                  <Field label="Reason for creating" span><textarea required rows={2} className={inputClass} value={regulatoryForm.reason} onChange={(event) => setRegulatoryForm((value) => ({...value,reason:event.target.value}))} /></Field>
                  <button type="submit" disabled={busy} className={buttonClass}>Save legal draft</button>
                </form>
                <div className="pp-list-head">Saved legal profiles {loadState.regulatory === 'ready' ? <span className="pp-muted">({regulatoryProfiles.length})</span> : null}</div>
                <div className="pp-saved-list">
                  <SectionLoading loading={loadState.regulatory === 'loading'} error={loadErrors.regulatory} empty="No legal profiles yet.">
                    {regulatoryItems.map((profile) => <article key={profile.id} className="pp-saved-row">
                      <div className="min-w-0"><p className="pp-row-title break-words">{profile.profileKey} · v{profile.versionNumber}</p><p className="pp-muted mt-1 break-words">{profile.jurisdiction} · {profile.calculationMethodologyVersion} · {titleize(profile.status)}</p><p className="pp-muted break-words">Applies to: {(profile.operatorApplicability || []).map(titleize).join(', ') || '—'} · {formatDate(profile.effectiveFrom)}</p></div>
                      <LifecycleButtons record={profile} busy={busy} onAction={(record, action) => runLifecycle('regulatory profile',record,action)} />
                    </article>)}
                  </SectionLoading>
                </div>
                {regulatoryProfiles.length > 6 ? <button type="button" className={`${secondaryButton} mt-3`} onClick={() => setShowAllRegulatory((value) => !value)}>{showAllRegulatory ? 'Show fewer' : `View all ${regulatoryProfiles.length}`}</button> : null}
              </div>
            </section>
          </div>
        </section>
        <p className="pp-footnote">Image privacy decisions are separate from listing approvals.</p>
      </div>
    </AdminShell>
  )
}
