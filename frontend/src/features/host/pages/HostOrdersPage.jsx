import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  ArrowRight,
  RefreshCw,
  Save,
  X,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import { getCatalogProducts } from '../../grocery/services/catalog.service'
import { listHostListingPackets } from '../services/hostUnifiedListing.service'

import {
  getCommerceErrorMessage,
  getHostCommercePolicy,
  getHostOrder,
  listHostOrders,
  saveHostCommercePolicy,
} from '../../commerce/services/commerce.service'

const orderStyles = String.raw`
/* Scoped to Host Orders. Navbar, sidebar and global components are unchanged. */
.eho-page{--eho-forest:#173F35;--eho-deep:#12382F;--eho-clay:#C56B45;--eho-clay-dark:#A85030;--eho-charcoal:#252A26;--eho-sage:#DEE5D9;--eho-porcelain:#F8F7F3;--eho-border:#D8DFD5;--eho-muted:#58675F;width:100%;min-width:0;background:var(--eho-porcelain);color:var(--eho-charcoal);font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.5;padding:clamp(15px,2.25vw,34px) clamp(13px,2.3vw,36px) clamp(35px,4vw,66px)}
.eho-page *,.eho-page *::before,.eho-page *::after{box-sizing:border-box}
.eho-page :is(button,input,textarea,a){font-family:inherit}
.eho-page :is(button,input,textarea,a):focus-visible{outline:3px solid var(--eho-clay)!important;outline-offset:3px}
.eho-top{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,.7fr);background:var(--eho-deep);overflow:hidden;border-radius:17px 17px 0 0;min-width:0}
.eho-top-main{position:relative;isolation:isolate;min-width:0;padding:clamp(26px,3.4vw,49px);background:linear-gradient(112deg,#143E34,#17473A);overflow:hidden}
.eho-top-main::after{position:absolute;z-index:-1;content:'';right:-150px;bottom:-235px;width:510px;height:510px;border-radius:50%;border:1px solid rgba(237,248,230,.12);box-shadow:0 0 0 31px rgba(237,248,230,.035),0 0 0 73px rgba(237,248,230,.02)}
.eho-kicker{display:flex;align-items:center;gap:12px;margin:0 0 13px;color:#F8C5A7;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:850;line-height:1.3}
.eho-kicker::before{content:'';width:23px;height:2px;background:#E69D78;flex:none}
.eho-top h1{font-size:clamp(41px,4.1vw,61px)!important;letter-spacing:-.06em!important;font-weight:820!important;line-height:1.02!important;color:#FEFDF9!important;margin:0}
.eho-top h1 em{color:#EDAA87;font-style:normal}
.eho-top-lead{max-width:580px;color:#E2E9E1;font-size:16px;line-height:1.65;margin:16px 0 0}
.eho-top-actions{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-top:27px}
.eho-primary-link{min-height:42px;padding:10px 16px;display:inline-flex;align-items:center;gap:9px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;transition:background .18s,color .18s,transform .18s}
.eho-primary-link{background:#F5D3BB;color:#173F35;border:1px solid #F5D3BB}
.eho-primary-link:hover{background:white;color:#173F35;transform:translateY(-1px)}
.eho-top-aside{min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:25px;padding:clamp(25px,3vw,39px);background:#E4E9DF;border-left:4px solid var(--eho-clay)}
.eho-aside-eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#B35735;font-weight:850}
.eho-aside-label{font-size:15px;font-weight:700;color:#3A574A;margin:12px 0 5px}
.eho-aside-count{font-size:clamp(45px,4vw,61px);font-weight:850;line-height:1;letter-spacing:-.065em;color:var(--eho-forest)}
.eho-aside-foot{padding-top:14px;border-top:1px solid #CAD5C7;display:flex;justify-content:space-between;align-items:center;gap:15px}
.eho-aside-foot span{font-size:13px;color:#516457;font-weight:650}
.eho-refresh{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #B8C8BB;background:#F8FAF6;padding:9px 13px;border-radius:8px;color:#173F35;font-size:14px;font-weight:750;min-height:40px;cursor:pointer;white-space:nowrap}
.eho-refresh:hover:not(:disabled){background:#D6E5D9;border-color:#779F85}.eho-refresh:disabled{opacity:.55;cursor:not-allowed}
.eho-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #DCE2D8;border-top:0;background:#FFFEFB;border-radius:0 0 13px 13px;overflow:hidden}
.eho-stat{position:relative;display:flex;align-items:center;gap:15px;min-width:0;padding:20px clamp(15px,2.4vw,33px);border-right:1px solid #DDE3D9;color:var(--eho-forest);text-decoration:none;transition:background .18s}
.eho-stat:last-child{border-right:none}.eho-stat:hover{background:#E8EFE7}.eho-stat[data-tone='clay']{background:#F8EAE1}.eho-stat[data-tone='clay']:hover{background:#F5DDD0}
.eho-stat-num{font-size:clamp(29px,3vw,39px);font-weight:830;line-height:1.1;letter-spacing:-.045em;font-variant-numeric:tabular-nums;color:var(--eho-forest)}
.eho-stat[data-tone='clay'] .eho-stat-num{color:#B15A36}
.eho-stat-text{min-width:0;display:flex;flex-direction:column;gap:3px}.eho-stat-text strong{font-size:15px;line-height:1.3;font-weight:790}.eho-stat-text small{font-size:12px;color:#58695D;line-height:1.4}.eho-stat-arrow{margin-left:auto;flex:none;color:#7C8F83}
.eho-feedback{margin-top:18px;padding:13px 17px;border-left:4px solid #BA573C;background:#F8E5DE;color:#793D2D;border-radius:5px;font-size:14px;font-weight:700}.eho-feedback[data-type='success']{background:#E2EEE2;border-color:#347A55;color:#173F35}
.eho-orders{display:flex;flex-direction:column;gap:32px;margin-top:clamp(25px,3.3vw,42px)}
.eho-section{min-width:0;display:grid;grid-template-columns:minmax(225px,.36fr) minmax(0,1fr);background:#FFFEFB;overflow:hidden;border:1px solid #DDE3D9;border-top:3px solid #C56B45;border-radius:11px}
.eho-section[data-tone='progress']{border-top-color:#4D786A;background:#FCFDFB}
.eho-section[data-tone='completed']{border-top-color:#A9B5A3;background:#FBFBF7}
.eho-section-intro{padding:clamp(22px,2.35vw,33px);background:#F8EAE1;border-right:1px solid #E4D7CF;display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.eho-section[data-tone='progress'] .eho-section-intro{background:#E5EEE8;border-color:#D5E2D8}
.eho-section[data-tone='completed'] .eho-section-intro{background:#ECF0E9;border-color:#D9E0D8}
.eho-section-number{font-size:12px;line-height:1.3;color:#A85335;letter-spacing:.095em;text-transform:uppercase;font-weight:850}
.eho-section[data-tone='progress'] .eho-section-number{color:#426C58}.eho-section[data-tone='completed'] .eho-section-number{color:#627565}
.eho-section-title{margin:13px 0 0;font-size:clamp(27px,2.55vw,35px)!important;line-height:1.13!important;letter-spacing:-.05em!important;font-weight:820!important;color:var(--eho-forest)!important}
.eho-section-sub{font-size:15px;line-height:1.6;color:#53645A;margin:12px 0 0;max-width:260px}
.eho-big-count{margin-top:auto;padding-top:30px;display:flex;gap:10px;align-items:center;color:var(--eho-forest)}.eho-big-count strong{font-size:30px;line-height:1;font-weight:850;font-variant-numeric:tabular-nums}.eho-big-count span{font-size:13px;color:#58665C;font-weight:600}
.eho-section-list{min-width:0;padding:9px clamp(16px,2.4vw,35px) 10px;background:#FFFEFB}
.eho-order-row{display:grid;grid-template-columns:74px minmax(0,1fr) auto;align-items:center;gap:16px;min-height:126px;padding:18px 5px 18px 0;color:var(--eho-charcoal);text-decoration:none;border-bottom:1px solid #E2E7E0;position:relative;transition:background-color .17s,transform .17s}
/* The list itself scrolls after four real rows; the section heading stays visible. */
.eho-list-viewport{position:relative;min-width:0}
.eho-list-viewport[data-scroll='true']{overflow-y:auto;overscroll-behavior-y:auto;max-height:504px;scrollbar-width:thin;scrollbar-color:#8DA99A #F1F4EE;scrollbar-gutter:stable}
.eho-list-viewport[data-scroll='true']::-webkit-scrollbar{width:7px}
.eho-list-viewport[data-scroll='true']::-webkit-scrollbar-track{background:#F1F4EE}
.eho-list-viewport[data-scroll='true']::-webkit-scrollbar-thumb{background:#9EB8A9;border-radius:8px}
.eho-list-viewport>.eho-order-row:last-child{border-bottom:0}
.eho-order-row:hover,.eho-order-row:focus-visible{background:#F3F6F0}
.eho-photo{position:relative;display:block;flex:none;width:74px;height:78px;overflow:hidden;border:1px solid #E0E5DE;border-radius:9px;background:#EEF1EA}
.eho-photo img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}.eho-order-row:hover .eho-photo img{transform:scale(1.06)}
.eho-photo-empty{width:100%;height:100%;display:grid;place-items:center;padding:7px;color:#7C8A7B;font-size:10px;font-weight:750;letter-spacing:.03em;text-align:center;line-height:1.35}
.eho-photo-count{position:absolute;right:2px;bottom:2px;background:#173F35;color:white;border:1px solid #F9F9F5;padding:2px 5px;border-radius:5px;font-size:10px;font-weight:850}
.eho-order-content{min-width:0;display:flex;flex-direction:column;gap:7px}
.eho-order-name{font-size:17px;line-height:1.35;font-weight:820;letter-spacing:-.02em;color:#1F362C;overflow-wrap:anywhere}
.eho-row-reference{color:#7A877C;font-size:12px;line-height:1.35;font-weight:650;letter-spacing:.02em}
.eho-order-meta-line{display:contents}
.eho-order-content>.eho-order-bottom{order:1}
.eho-order-meta-line>.eho-status{order:2}
.eho-order-bottom{display:flex;flex-wrap:wrap;align-items:center;gap:5px 14px;color:#637168;font-size:13px}
.eho-status{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:4px 9px;border-radius:999px;font-size:11px;line-height:1.4;letter-spacing:.01em;font-weight:800;background:#E7ECE7;color:#476254}
.eho-status::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.eho-status[data-tone='new']{background:#F8DFD2;color:#A94D30}.eho-status[data-tone='progress']{background:#DCEAEF;color:#326275}.eho-status[data-tone='done']{background:#E0EEE1;color:#35634A}
.eho-order-side{display:flex;align-items:flex-end;flex-direction:column;justify-content:center;gap:12px;text-align:right;min-width:80px}
.eho-order-total{font-size:16px;line-height:1.3;color:var(--eho-forest);font-weight:820;white-space:nowrap}
.eho-order-open{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:750;color:#9D5437;white-space:nowrap;transition:gap .17s}
.eho-order-row:hover .eho-order-open{gap:9px}
.eho-empty{color:#637268;font-size:15px;line-height:1.55;margin:0;padding:43px 0}
.eho-view-all{display:inline-flex;justify-content:center;align-items:center;gap:9px;margin:13px 0 5px;color:#173F35;background:#F5F7F1;border:1px solid #C8D7CC;border-radius:8px;padding:10px 15px;font-weight:750;font-size:14px;cursor:pointer}.eho-view-all:hover{background:#E0EADF;border-color:#95B59C}
.eho-view-wrap{display:flex;justify-content:flex-end}
.eho-mobile-hidden{display:contents}
.eho-modal-backdrop{position:fixed;inset:0;z-index:180;display:grid;place-items:center;background:rgba(16,32,24,.59);backdrop-filter:blur(7px);padding:clamp(10px,2.5vw,24px)}
.eho-modal{display:flex;flex-direction:column;max-height:88dvh;width:min(100%,950px);border-radius:14px;overflow:hidden;background:#FAFAF6;box-shadow:0 28px 90px rgba(7,17,12,.29)}
.eho-modal-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 27px;border-bottom:1px solid #D7E0D5;background:#E5EDE5}
.eho-modal-header h2{color:#173F35;font-size:26px;line-height:1.2;letter-spacing:-.04em;font-weight:820;margin:5px 0 0}
.eho-modal-close{height:42px;width:42px;display:grid;place-items:center;background:#FFFEFB;border:1px solid #C6D5C8;color:#173F35;border-radius:8px;cursor:pointer}.eho-modal-close:hover{background:#F6E7DF}
.eho-modal-list{padding:5px clamp(15px,2vw,28px) 24px;overflow-y:auto;min-height:0}.eho-modal-list .eho-order-row:last-child{border-bottom:0}
.eho-checkout{min-width:0;margin-top:clamp(28px,3.4vw,44px);border-top:3px solid var(--eho-forest);background:#EBF0EA;border-radius:10px 10px 0 0;overflow:hidden;display:grid;grid-template-columns:minmax(250px,.37fr) minmax(0,1fr)}
.eho-checkout-intro{min-width:0;padding:clamp(23px,2.5vw,36px);background:#E0E7DD;border-right:1px solid #CCD8CB}
.eho-checkout-intro h2{font-size:clamp(26px,2.4vw,34px);font-weight:820;letter-spacing:-.048em;line-height:1.16;color:#173F35;margin:13px 0 12px}
.eho-checkout-intro p{color:#56685D;font-size:15px;line-height:1.65;margin:0}
.eho-checkout-form{min-width:0;padding:clamp(22px,2.5vw,35px);background:#F2F4EF}
.eho-form-grid{display:grid;grid-template-columns:.7fr 1fr 1fr;gap:15px}
.eho-form-texts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin-top:22px;padding-top:22px;border-top:1px solid #D5DED5}
.eho-field{display:block;color:#30483A;font-size:14px;font-weight:750;min-width:0;line-height:1.4}
.eho-field :is(input,textarea){display:block;margin-top:9px;width:100%;min-width:0;border:1px solid #C6D1C5;background:#FFFEFC;color:#202421;border-radius:8px;padding:12px 13px;font-size:16px;font-weight:500;line-height:1.45;outline:none}
.eho-field input{min-height:49px}.eho-field textarea{min-height:110px;resize:vertical}
.eho-field :is(input,textarea):focus{border-color:#C56B45;box-shadow:0 0 0 3px rgba(197,107,69,.14)}
.eho-form-help{margin:10px 0 0;color:#607064;font-size:13px}
.eho-form-footer{display:flex;align-items:center;justify-content:flex-end;margin-top:21px;padding-top:19px;border-top:1px solid #D5DED5}
.eho-save{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;border:1px solid #C56B45;border-radius:8px;background:#C56B45;color:#FFFDF8;padding:12px 19px;font-weight:800;font-size:14px;cursor:pointer;transition:background .18s}
.eho-save:hover:not(:disabled){background:#AF5534;border-color:#AF5534}.eho-save:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:1100px){.eho-section{grid-template-columns:260px minmax(0,1fr)}.eho-checkout{grid-template-columns:1fr}.eho-checkout-intro{border-right:0;border-bottom:1px solid #CDD8CD}.eho-form-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:860px){.eho-top{grid-template-columns:1fr}.eho-top-aside{border-left:0;border-top:3px solid #C56B45;flex-direction:row;align-items:center;padding:21px 26px}.eho-aside-count{font-size:36px}.eho-aside-foot{border:0;padding:0}.eho-aside-foot span{display:none}.eho-section{grid-template-columns:1fr}.eho-section-intro{border-right:0;border-bottom:1px solid #D8E0D5;padding:22px 26px}.eho-section-sub{max-width:none}.eho-big-count{padding-top:12px}.eho-section-list{padding:4px 25px}.eho-section-title{margin-top:7px}}
@media(max-width:640px){.eho-page{padding:12px 11px 34px}.eho-top{border-radius:13px 13px 0 0}.eho-top-main{padding:22px 21px 24px}.eho-top h1{font-size:38px!important}.eho-kicker{font-size:11px;margin-bottom:11px}.eho-top-lead{font-size:14px;line-height:1.55;margin-top:10px}.eho-top-actions{margin-top:19px;gap:8px}.eho-primary-link{font-size:13px;padding:9px 12px;min-height:40px}.eho-top-aside{padding:13px 19px;gap:10px}.eho-aside-eyebrow{font-size:10px}.eho-aside-label{font-size:12px;margin:5px 0 0}.eho-aside-count{font-size:31px}.eho-refresh{font-size:13px;min-height:38px;padding:8px 10px}.eho-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.eho-stat{padding:12px 9px;gap:6px;flex-direction:column;align-items:flex-start}.eho-stat-num{font-size:26px}.eho-stat-text strong{font-size:12px;line-height:1.3}.eho-stat-text small{display:none}.eho-stat-arrow{position:absolute;top:14px;right:7px;width:12px}.eho-orders{gap:22px;margin-top:22px}.eho-section{border-radius:9px}.eho-section-intro{padding:18px 16px;gap:0}.eho-section-number{font-size:11px}.eho-section-title{font-size:26px!important;margin:7px 0 0}.eho-section-sub{font-size:14px;line-height:1.5;margin-top:5px}.eho-big-count{padding-top:5px}.eho-big-count strong{font-size:21px}.eho-big-count span{font-size:12px}.eho-section-list{padding:4px 13px}.eho-order-row{grid-template-columns:59px minmax(0,1fr);gap:11px;padding:14px 0;min-height:102px}.eho-photo{width:59px;height:64px}.eho-order-content{gap:5px}.eho-order-name{font-size:15px;line-height:1.32}.eho-row-reference{font-size:11px}.eho-order-bottom{font-size:12px;gap:3px 10px}.eho-order-side{grid-column:2;align-items:center;justify-content:space-between;flex-direction:row;gap:9px;min-width:0;text-align:left}.eho-order-total{font-size:14px}.eho-order-open{font-size:11px}.eho-status{font-size:10px;padding:3px 7px}.eho-list-viewport[data-scroll='true']{max-height:604px}.eho-view-all{font-size:13px}.eho-empty{padding:22px 0;font-size:14px}.eho-modal-header{padding:17px}.eho-modal-header h2{font-size:23px}.eho-modal-list{padding:2px 14px 20px}.eho-checkout{margin-top:26px}.eho-checkout-intro{padding:19px}.eho-checkout-intro h2{font-size:24px;margin:9px 0}.eho-checkout-intro p{font-size:14px}.eho-checkout-form{padding:18px}.eho-form-grid{grid-template-columns:1fr 1fr;gap:14px}.eho-form-grid .eho-field:first-child{grid-column:1/-1}.eho-form-texts{grid-template-columns:1fr;gap:14px;margin-top:17px;padding-top:17px}.eho-field{font-size:13px}.eho-field :is(input,textarea){font-size:15px;min-height:46px;padding:11px 12px}.eho-form-footer{margin-top:18px}.eho-save{width:100%}}
@media(max-width:350px){.eho-page{padding-inline:8px}.eho-top-actions{flex-direction:column;align-items:stretch}.eho-top-actions a{justify-content:center}.eho-top-aside{align-items:flex-start}.eho-form-grid{grid-template-columns:1fr}.eho-form-grid .eho-field:first-child{grid-column:auto}}

/* Mobile-only refinement: desktop, data, order actions and scroll handoff stay intact. */
.eho-mobile-copy{display:none}
@media(max-width:640px){
  .eho-page{padding:11px 9px 29px;font-size:15px}
  .eho-desktop-copy{display:none}
  .eho-mobile-copy{display:inline}
  .eho-top{border-radius:12px 12px 0 0}
  .eho-top-main{padding:19px 16px 18px}
  .eho-kicker{font-size:11px;letter-spacing:.075em;margin-bottom:8px}
  .eho-top h1{font-size:32px!important;letter-spacing:-.04em!important}
  .eho-top-lead{margin-top:8px;font-size:14px;line-height:1.45}
  .eho-top-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:15px}
  .eho-primary-link{justify-content:center;min-width:0;gap:5px;padding:10px 6px;min-height:43px;font-size:12.5px;line-height:1.25;text-align:center}
  .eho-primary-link svg{width:15px;flex:none}
  .eho-top-aside{padding:12px 16px;flex-direction:row;align-items:center;gap:10px}
  .eho-aside-eyebrow,.eho-aside-foot>span{display:none}
  .eho-aside-label{font-size:13px;line-height:1.3;margin:0 0 2px;color:#3D5749}
  .eho-aside-count{font-size:29px;line-height:1}
  .eho-refresh{font-size:13px;min-height:38px;padding:8px 10px}
  .eho-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
  .eho-stat{padding:12px 9px 11px;gap:3px;min-height:79px}
  .eho-stat-num{font-size:27px;line-height:1}
  .eho-stat-text strong{font-size:12.5px;line-height:1.3}
  .eho-stat-arrow{width:13px;right:6px;top:9px}
  .eho-orders{margin-top:19px;gap:22px}
  .eho-section{border-radius:11px;background:#FFFEFB}
  .eho-section-intro{padding:15px 14px 13px;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;align-items:center;gap:5px 12px}
  .eho-section-number{grid-column:1/-1;font-size:11px;letter-spacing:.06em}
  .eho-section-title{grid-column:1;grid-row:2;margin:0;font-size:23px!important;line-height:1.18!important}
  .eho-section-sub{display:none}
  .eho-big-count{grid-column:2;grid-row:2;align-self:center;margin:0;padding:6px 9px;gap:5px;border:1px solid #D8DED3;border-radius:8px;background:rgba(255,255,255,.67)}
  .eho-big-count strong{font-size:19px;line-height:1.1}
  .eho-big-count span{font-size:12px}
  .eho-section-list{padding:1px 12px 10px}
  .eho-order-row{grid-template-columns:54px minmax(0,1fr);grid-template-rows:auto auto;align-items:start;column-gap:10px;row-gap:4px;min-height:0;padding:13px 0 12px}
  .eho-photo{grid-column:1;grid-row:1/span 2;width:54px;height:60px;align-self:start;border-radius:8px}
  .eho-order-content{grid-column:2;grid-row:1;gap:5px}
  .eho-order-name{font-size:15.5px;line-height:1.32;letter-spacing:-.015em}
  .eho-order-meta-line{display:flex;align-items:center;flex-wrap:wrap;gap:4px 7px}
  .eho-reference-prefix{display:none}
  .eho-row-reference{font-size:12.5px;line-height:1.35;letter-spacing:0;white-space:nowrap}
  .eho-status{font-size:11px;line-height:1.3;padding:3px 7px;letter-spacing:0}
  .eho-order-bottom{font-size:12.5px;line-height:1.35;gap:3px 9px;color:#617067}
  .eho-order-side{grid-column:2;grid-row:2;display:flex;justify-content:space-between;align-items:center;flex-direction:row;gap:8px;min-width:0;margin-top:3px;padding-top:8px;border-top:1px solid #E5E9E1;text-align:left}
  .eho-order-total{font-size:15px;line-height:1.25;white-space:nowrap}
  .eho-order-open{font-size:12.5px;gap:4px;white-space:nowrap;color:#A65031}
  .eho-order-open svg{width:14px}
  .eho-list-viewport[data-scroll='true']{overscroll-behavior-y:auto;scrollbar-gutter:auto;-webkit-overflow-scrolling:touch}
  .eho-view-wrap{padding-top:3px}
  .eho-view-all{min-height:40px;margin:8px 0 3px;padding:9px 13px;font-size:13px}
  .eho-modal{width:100%;max-height:88dvh;border-radius:12px}
  .eho-modal-header{padding:15px 16px}.eho-modal-header h2{font-size:22px}
  .eho-modal-list{padding:3px 13px 17px}
  .eho-checkout{margin-top:25px;border-radius:11px 11px 0 0}
  .eho-checkout-intro{padding:17px 15px 14px}
  .eho-checkout-intro h2{font-size:23px;margin:5px 0 0}
  .eho-checkout-intro p{font-size:13.5px;line-height:1.45;margin-top:6px}
  .eho-checkout-form{padding:17px 14px 18px}
  .eho-form-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
  .eho-form-grid .eho-field:first-child{grid-column:1/-1}
  .eho-field{font-size:13px;line-height:1.35;font-weight:750}
  .eho-field :is(input,textarea){font-size:15px;line-height:1.4;margin-top:7px;padding:11px 12px}
  .eho-field input{min-height:45px}
  .eho-field textarea{min-height:92px}
  .eho-form-help{margin-top:7px;font-size:12.5px}
  .eho-form-texts{grid-template-columns:1fr;gap:14px;padding-top:15px;margin-top:15px}
  .eho-form-footer{margin-top:16px;padding-top:15px}
  .eho-save{min-height:46px;font-size:14px}
}
@media(max-width:360px){
  .eho-page{padding-inline:8px}
  .eho-top-actions{grid-template-columns:1fr 1fr}
  .eho-section-list{padding-inline:10px}
  .eho-order-row{grid-template-columns:49px minmax(0,1fr);column-gap:9px}
  .eho-photo{width:49px;height:57px}
  .eho-order-name{font-size:15px}
  .eho-order-open{font-size:12px}
  .eho-form-grid{grid-template-columns:1fr}
  .eho-form-grid .eho-field:first-child{grid-column:auto}
}
@media(prefers-reduced-motion:reduce){.eho-page :is(a,button,img){transition:none!important}}
`;

const NEW_STATUSES = new Set([
  'confirmed',
])

const COMPLETED_STATUSES = new Set([
  'delivered',
  'returned',
  'refunded',
  'rejected',
  'seller_cancelled',
])

function label(
  value,
) {
  return String(
    value ||
      'unknown',
  )
    .split(
      '_',
    )
    .map(
      (
        token,
      ) =>
        `${token
          .charAt(
            0,
          )
          .toUpperCase()}${token.slice(
          1,
        )}`,
    )
    .join(
      ' ',
    )
}

function shortOrderId(
  value,
) {
  return String(
    value ||
      '',
  )
    .slice(
      -8,
    )
    .toUpperCase()
}

function orderDisplayName(
  order,
) {
  const names =
    (
      order?.itemNames ||
      []
    )
      .map(
        (
          value,
        ) =>
          String(
            value ||
              '',
          ).trim(),
      )
      .filter(
        Boolean,
      )

  if (
    names.length ===
    0
  ) {
    return `Order ${shortOrderId(
      order?.id,
    )}`
  }

  if (
    names.length ===
    1
  ) {
    return names[0]
  }

  return `${names[0]} + ${
    names.length -
    1
  } more`
}

function formatDateTime(
  value,
) {
  if (
    !value
  ) {
    return 'Time unavailable'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Time unavailable'
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day:
        '2-digit',
      month:
        'short',
      hour:
        '2-digit',
      minute:
        '2-digit',
    },
  ).format(
    date,
  )
}

function moneyFromMinor(
  value,
  currency =
    'INR',
) {
  const amount =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      amount,
    )
  ) {
    return null
  }

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
    amount /
      100,
  )
}

function normalizeProductTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeProductImageUrl(value) {
  const raw = String(value || '').trim()
  return (/^https?:\/\//i.test(raw) || /^\/(?!\/)/.test(raw)) ? raw : ''
}

function pictureFromProduct(item) {
  return safeProductImageUrl(
    item?.image?.url || item?.imageUrl || item?.thumbnailUrl ||
    item?.images?.[0]?.url || item?.images?.[0] ||
    item?.packet?.images?.[0]?.url || item?.packet?.images?.[0] ||
    item?.packet?.imageUrl,
  )
}

function OrderPhoto({ imageUrl, name, count, eager = false }) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [imageUrl])
  return (
    <span className="eho-photo" aria-label={`${name} product photo`}>
      {imageUrl && !imageFailed ? (
        <img src={imageUrl} alt={name} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setImageFailed(true)} />
      ) : (
        <span className="eho-photo-empty">Photo<br />unavailable</span>
      )}
      {count > 1 && <span className="eho-photo-count">+{count - 1}</span>}
    </span>
  )
}

function OrderRow({ order, itemImages, eager = false }) {
  const total = moneyFromMinor(
    order?.commercialSnapshot?.totalLandedCostMinor ??
      order?.commercialSnapshot?.itemSubtotalMinor,
    order?.commercialSnapshot?.currency || 'INR',
  )
  const names = Array.isArray(order?.itemNames) ? order.itemNames : []
  const primaryName = names.find((name) => String(name || '').trim()) || orderDisplayName(order)
  const fromOrder = pictureFromProduct(order) || safeProductImageUrl(order?.itemImages?.[0])
  const imageUrl = fromOrder || itemImages[normalizeProductTitle(primaryName)] || ''
  const tone = order.status === 'confirmed'
    ? 'new'
    : COMPLETED_STATUSES.has(order.status) ? 'done' : 'progress'
  const badge = order.status === 'confirmed' ? 'New order' : label(order.status)
  return (
    <Link className="eho-order-row" to={`/host/orders/${order.id}`} aria-label={`Open ${orderDisplayName(order)} order ${shortOrderId(order.id)}`}>
      <OrderPhoto name={primaryName} imageUrl={imageUrl} count={order.itemCount || names.length || 1} eager={eager} />
      <span className="eho-order-content">
        <strong className="eho-order-name">{orderDisplayName(order)}</strong>
        <span className="eho-order-meta-line">
          <span className="eho-row-reference"><span className="eho-reference-prefix">Order </span>#{shortOrderId(order.id)}</span>
          <span className="eho-status" data-tone={tone}>{badge}</span>
        </span>
        <span className="eho-order-bottom">
          <span>{order.itemCount || 0} {order.itemCount === 1 ? 'item' : 'items'}</span>
          <span>{formatDateTime(order.createdAt)}</span>
        </span>
      </span>
      <span className="eho-order-side">
        {total && <strong className="eho-order-total">{total}</strong>}
        <span className="eho-order-open"><span className="eho-desktop-copy">View order</span><span className="eho-mobile-copy">Open order</span> <ArrowRight size={16} aria-hidden="true" /></span>
      </span>
    </Link>
  )
}

function OrderSection({ title, sectionId, description, orders, emptyText, tone, index, itemImages }) {
  const [showAll, setShowAll] = useState(false)
  const viewportRef = useRef(null)
  const [visibleHeight, setVisibleHeight] = useState(null)
  const needsScroll = orders.length > 4

  // Measure actual row heights instead of guessing: exactly four complete
  // orders fit on both narrow phones and wide desktop layouts.
  useEffect(() => {
    if (!needsScroll) return undefined
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const rows = Array.from(viewport.children).slice(0, 4)
    const measure = () => {
      const fourth = rows[3]
      if (fourth) {
        const height = Math.ceil(fourth.offsetTop + fourth.offsetHeight)
        setVisibleHeight((previous) => previous === height ? previous : height)
      }
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    rows.forEach((row) => observer?.observe(row))
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [needsScroll, orders])

  return (
    <>
      <section id={sectionId} className="eho-section" data-tone={tone} aria-label={title}>
        <div className="eho-section-intro">
          <span className="eho-section-number">{index} / {tone === 'new' ? 'TO REVIEW' : tone === 'progress' ? 'ACTIVE ORDERS' : 'ORDER RECORDS'}</span>
          <h2 className="eho-section-title">{title}</h2>
          <p className="eho-section-sub">{description}</p>
          <div className="eho-big-count"><strong>{orders.length}</strong><span>{orders.length === 1 ? 'order' : 'orders'}</span></div>
        </div>
        <div className="eho-section-list">
          {orders.length === 0 ? <p className="eho-empty">{emptyText}</p> : (
            <div
              ref={viewportRef}
              className="eho-list-viewport"
              data-scroll={needsScroll}
              style={needsScroll && visibleHeight !== null ? { maxHeight: visibleHeight } : undefined}
              tabIndex={needsScroll ? 0 : undefined}
              role={needsScroll ? 'region' : undefined}
              aria-label={needsScroll ? `Scroll through ${orders.length} ${title.toLowerCase()}` : undefined}
            >
              {orders.map((order, rowIndex) => (
                <OrderRow order={order} itemImages={itemImages} eager={index === '01' && rowIndex < 4} key={order.id} />
              ))}
            </div>
          )}
          {needsScroll && (
            <div className="eho-view-wrap">
              <button type="button" className="eho-view-all" onClick={() => setShowAll(true)}>
                View all {orders.length} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </section>
      {showAll && (
        <div className="eho-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAll(false) }}>
          <div className="eho-modal" role="dialog" aria-modal="true" aria-label={`All ${title}`}>
            <div className="eho-modal-header">
              <div><span className="eho-section-number">HOST / ORDERS</span><h2>{title} ({orders.length})</h2></div>
              <button type="button" className="eho-modal-close" onClick={() => setShowAll(false)} aria-label="Close order list"><X size={21} /></button>
            </div>
            <div className="eho-modal-list">{orders.map((order) => <OrderRow order={order} itemImages={itemImages} key={order.id} />)}</div>
          </div>
        </div>
      )}
    </>
  )
}

export default function HostOrdersPage() {
  const [
    orders,
    setOrders,
  ] =
    useState(
      [],
    )

  const [itemImages, setItemImages] = useState({})

  const [
    policy,
    setPolicy,
  ] =
    useState({
      currency:
        'INR',

      deliveryFeeMinor:
        0,

      freeDeliveryThresholdMinor:
        '',

      cancellationPolicySummary:
        '',

      returnPolicySummary:
        '',
    })

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    success,
    setSuccess,
  ] =
    useState(
      '',
    )

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const [
            firstOrderResult,
            policyResult,
          ] =
            await Promise.all([
              listHostOrders({
                page:
                  1,

                limit:
                  50,
              }),

              getHostCommercePolicy(),
            ])

          const allOrders = [
            ...(firstOrderResult?.orders || []),
          ]

          const orderPages =
            Math.max(
              1,
              Number(
                firstOrderResult?.pagination?.pages,
              ) || 1,
            )

          for (
            let pageNumber = 2;
            pageNumber <= orderPages;
            pageNumber += 1
          ) {
            const nextOrderResult =
              await listHostOrders({
                page:
                  pageNumber,

                limit:
                  50,
              })

            allOrders.push(
              ...(nextOrderResult?.orders || []),
            )
          }

          setOrders(
            allOrders,
          )

          if (
            policyResult?.policy
          ) {
            setPolicy({
              currency:
                policyResult
                  .policy
                  .currency ||
                'INR',

              deliveryFeeMinor:
                policyResult
                  .policy
                  .deliveryFeeMinor ??
                0,

              freeDeliveryThresholdMinor:
                policyResult
                  .policy
                  .freeDeliveryThresholdMinor ??
                '',

              cancellationPolicySummary:
                policyResult
                  .policy
                  .cancellationPolicySummary ||
                '',

              returnPolicySummary:
                policyResult
                  .policy
                  .returnPolicySummary ||
                '',
            })
          }
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load Host Orders.',
            ),
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  // Match only photos from the actual EPANTRY catalog/approved Host listings.
  // Publish each successful response immediately: do not hold every photo
  // behind several slow, sequential catalog pages or unrelated failed calls.
  useEffect(() => {
    const wanted = new Set(
      orders.flatMap((order) => (Array.isArray(order?.itemNames) ? order.itemNames : [])
        .map(normalizeProductTitle).filter(Boolean)),
    )
    if (!wanted.size) return undefined

    let active = true
    const matched = new Map(
      Object.entries(itemImages).filter(([key, url]) => wanted.has(key) && safeProductImageUrl(url)),
    )
    const imageByVersion = new Map()
    const exampleByName = new Map()
    const searchTextByName = new Map()
    orders.forEach((order) => {
      (Array.isArray(order?.itemNames) ? order.itemNames : []).forEach((name) => {
        const key = normalizeProductTitle(name)
        if (key && !exampleByName.has(key)) exampleByName.set(key, order.id)
        if (key && !searchTextByName.has(key)) searchTextByName.set(key, String(name).trim())
      })
    })
    // Keep existing images on an ordinary Refresh; only add verified matches.
    const publish = (rows) => {
      const updated = {}
      rows.forEach(({ name, image, versionId }) => {
        const key = normalizeProductTitle(name)
        const url = safeProductImageUrl(image)
        if (versionId && url) imageByVersion.set(String(versionId), url)
        if (wanted.has(key) && url && !matched.has(key)) {
          matched.set(key, url)
          updated[key] = url
        }
      })
      if (active && Object.keys(updated).length) {
        setItemImages((previous) => ({ ...previous, ...updated }))
      }
    }
    const applyCatalog = (products) => {
      publish((Array.isArray(products) ? products : []).map((product) => ({
        name: product?.displayName || product?.title || product?.name,
        image: pictureFromProduct(product),
        versionId: product?.productVersionId || product?.id,
      })))
    }

    const hostTask = listHostListingPackets()
      .then((response) => publish((response?.listings || [])
        .filter((listing) => listing?.status === 'approved')
        .map((listing) => ({
          name: listing?.title || listing?.packet?.title,
          image: pictureFromProduct(listing),
          versionId: listing?.packet?.catalogProductVersionId,
        }))))
      .catch(() => {})

    let catalogPages = 1
    const catalogTask = getCatalogProducts({ page: 1, limit: 100 })
      .then((response) => {
        applyCatalog(response?.products)
        catalogPages = Math.min(8, Math.max(1, Number(response?.pagination?.pages || 1)))
      })
      .catch(() => {})

    const resolveRemaining = async () => {
      await Promise.allSettled([hostTask, catalogTask])
      if (!active || matched.size === wanted.size) return

      // Search by the actual order item name (not a guessed image). Queries
      // run together and each result updates the screen as soon as it arrives.
      const unresolved = [...wanted].filter((name) => !matched.has(name)).slice(0, 24)
      for (let i = 0; i < unresolved.length && active; i += 6) {
        const batch = unresolved.slice(i, i + 6)
        await Promise.allSettled(batch.map(async (key) => {
          const result = await getCatalogProducts({
            search: searchTextByName.get(key) || key,
            page: 1,
            limit: 20,
          })
          applyCatalog(result?.products)
        }))
      }

      // The catalog may not search historic titles; browse a few extra pages
      // concurrently and use only exact normalized product-title matches.
      if (active && matched.size < wanted.size && catalogPages > 1) {
        await Promise.allSettled(
          Array.from({ length: catalogPages - 1 }, (_, offset) =>
            getCatalogProducts({ page: offset + 2, limit: 100 })
              .then((result) => applyCatalog(result?.products)),
          ),
        )
      }

      // Fallback: where an order title differs, verify the canonical version ID.
      const missing = [...wanted].filter((key) => !matched.has(key))
      const ids = [...new Set(missing.map((key) => exampleByName.get(key)).filter(Boolean))].slice(0, 12)
      if (active && imageByVersion.size && ids.length) {
        await Promise.allSettled(ids.map(async (id) => {
          const result = await getHostOrder(id)
          publish((result?.order?.items || []).map((item) => ({
            name: item?.displayName,
            image: pictureFromProduct(item) || imageByVersion.get(String(item?.productVersionId || '')),
            versionId: item?.productVersionId,
          })))
        }))
      }
    }
    resolveRemaining().catch(() => {})
    return () => { active = false }
  }, [orders])

  const groupedOrders =
    useMemo(
      () => {
        const next = {
          newOrders:
            [],
          inProgress:
            [],
          completed:
            [],
        }

        orders.forEach(
          (
            order,
          ) => {
            if (
              NEW_STATUSES.has(
                order.status,
              )
            ) {
              next.newOrders.push(
                order,
              )
              return
            }

            if (
              COMPLETED_STATUSES.has(
                order.status,
              )
            ) {
              next.completed.push(
                order,
              )
              return
            }

            next.inProgress.push(
              order,
            )
          },
        )

        return next
      },
      [
        orders,
      ],
    )

  async function handlePolicySave(
    event,
  ) {
    event.preventDefault()

    setSaving(
      true,
    )

    setError(
      '',
    )

    setSuccess(
      '',
    )

    try {
      await saveHostCommercePolicy({
        currency:
          policy.currency,

        deliveryFeeMinor:
          Number(
            policy.deliveryFeeMinor,
          ),

        freeDeliveryThresholdMinor:
          policy.freeDeliveryThresholdMinor ===
          ''
            ? null
            : Number(
                policy.freeDeliveryThresholdMinor,
              ),

        cancellationPolicySummary:
          policy
            .cancellationPolicySummary,

        returnPolicySummary:
          policy
            .returnPolicySummary,
      })

      setSuccess(
        'Checkout settings saved.',
      )
    } catch (
      saveError
    ) {
      setError(
        getCommerceErrorMessage(
          saveError,
          'Unable to save checkout settings.',
        ),
      )
    } finally {
      setSaving(
        false,
      )
    }
  }

  return (
    <main className="eho-page">
      <style>{orderStyles}</style>
      <header>
        <div className="eho-top">
          <div className="eho-top-main">
            <p className="eho-kicker">EPANTRY / HOST WORKSPACE</p>
            <h1>Your orders<em>.</em></h1>
            <p className="eho-top-lead"><span className="eho-desktop-copy">From new requests to completed deliveries, everything you need to manage customer orders.</span><span className="eho-mobile-copy">Review, prepare and track orders.</span></p>
            <div className="eho-top-actions">
              <a className="eho-primary-link" href="#new-orders">Review new orders <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
          </div>
          <div className="eho-top-aside">
            <div>
              <span className="eho-aside-eyebrow">YOUR ORDER DESK</span>
              <p className="eho-aside-label"><span className="eho-desktop-copy">Waiting for review</span><span className="eho-mobile-copy">Need review</span></p>
              <div className="eho-aside-count" aria-live="polite">{groupedOrders.newOrders.length}</div>
            </div>
            <div className="eho-aside-foot">
              <span>Latest saved order data</span>
              <button type="button" className="eho-refresh" onClick={load} disabled={loading}>
                <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
        <nav className="eho-stats" aria-label="Jump to order status">
          <a href="#new-orders" className="eho-stat" data-tone="clay">
            <strong className="eho-stat-num">{groupedOrders.newOrders.length}</strong>
            <span className="eho-stat-text"><strong>New orders</strong><small>Need your review</small></span>
            <ArrowRight className="eho-stat-arrow" size={18} aria-hidden="true" />
          </a>
          <a href="#active-orders" className="eho-stat">
            <strong className="eho-stat-num">{groupedOrders.inProgress.length}</strong>
            <span className="eho-stat-text"><strong>In progress</strong><small>Being prepared or delivered</small></span>
            <ArrowRight className="eho-stat-arrow" size={18} aria-hidden="true" />
          </a>
          <a href="#completed-orders" className="eho-stat">
            <strong className="eho-stat-num">{groupedOrders.completed.length}</strong>
            <span className="eho-stat-text"><strong>Completed</strong><small>Closed order history</small></span>
            <ArrowRight className="eho-stat-arrow" size={18} aria-hidden="true" />
          </a>
        </nav>
      </header>
      {error && <div className="eho-feedback" role="alert">{error}</div>}
      {success && <div className="eho-feedback" data-type="success" role="status">{success}</div>}
      <div className="eho-orders">
        {loading ? (
          <p role="status" className="eho-section eho-empty">Loading orders…</p>
        ) : orders.length === 0 ? (
          <section id="new-orders" className="eho-section" data-tone="completed">
            <div className="eho-section-intro"><span className="eho-section-number">ORDER DESK</span><h2 className="eho-section-title">No orders yet</h2></div>
            <div className="eho-section-list"><p className="eho-empty">Customer orders will appear here when they arrive.</p></div>
          </section>
        ) : (
          <>
            <OrderSection index="01" sectionId="new-orders" title="New orders" description="Customer orders ready for your attention." orders={groupedOrders.newOrders} emptyText="No new orders are waiting." tone="new" itemImages={itemImages} />
            <OrderSection index="02" sectionId="active-orders" title="In progress" description="Follow orders through preparation and dispatch." orders={groupedOrders.inProgress} emptyText="No orders are in progress." tone="progress" itemImages={itemImages} />
            <OrderSection index="03" sectionId="completed-orders" title="Completed" description="Delivered and closed orders at a glance." orders={groupedOrders.completed} emptyText="No completed orders yet." tone="completed" itemImages={itemImages} />
          </>
        )}
      </div>
      <form onSubmit={handlePolicySave} className="eho-checkout">
        <div className="eho-checkout-intro">
          <span className="eho-section-number">04 / CHECKOUT</span>
          <h2><span className="eho-desktop-copy">Delivery &amp; customer policies</span><span className="eho-mobile-copy">Checkout settings</span></h2>
          <p><span className="eho-desktop-copy">Manage the delivery fee and policy messages shown to customers at checkout.</span><span className="eho-mobile-copy">Set delivery charges and checkout policies.</span></p>
        </div>
        <div className="eho-checkout-form">
          <div className="eho-form-grid">
            <label className="eho-field">Currency
              <input value={policy.currency} maxLength="3" onChange={(event) => setPolicy((current) => ({...current, currency: event.target.value.toUpperCase()}))} />
            </label>
            <label className="eho-field"><span className="eho-desktop-copy">Delivery fee (minor units)</span><span className="eho-mobile-copy">Delivery fee</span>
              <input type="number" min="0" step="1" value={policy.deliveryFeeMinor} onChange={(event) => setPolicy((current) => ({...current, deliveryFeeMinor: event.target.value}))} />
            </label>
            <label className="eho-field"><span className="eho-desktop-copy">Free delivery from (minor units)</span><span className="eho-mobile-copy">Free delivery above</span>
              <input type="number" min="0" step="1" value={policy.freeDeliveryThresholdMinor} onChange={(event) => setPolicy((current) => ({...current, freeDeliveryThresholdMinor: event.target.value}))} />
            </label>
          </div>
          <p className="eho-form-help"><span className="eho-desktop-copy">For INR, 100 minor units = ₹1.</span><span className="eho-mobile-copy">INR: 100 units = ₹1.</span></p>
          <div className="eho-form-texts">
            <label className="eho-field">Cancellation message
              <textarea rows="3" value={policy.cancellationPolicySummary} onChange={(event) => setPolicy((current) => ({...current, cancellationPolicySummary: event.target.value}))} />
            </label>
            <label className="eho-field">Return message
              <textarea rows="3" value={policy.returnPolicySummary} onChange={(event) => setPolicy((current) => ({...current, returnPolicySummary: event.target.value}))} />
            </label>
          </div>
          <div className="eho-form-footer"><button type="submit" disabled={saving} className="eho-save"><Save size={17} aria-hidden="true" />{saving ? 'Saving…' : 'Save checkout settings'}</button></div>
        </div>
      </form>
    </main>
  )
}
