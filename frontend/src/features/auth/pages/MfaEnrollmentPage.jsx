import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Check,
  CircleAlert,
  Clipboard,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  UserRoundCog,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../context/AuthContext'

import { useAdmin } from '../../admin/context/AdminContext'

import {
  cancelTotpEnrollment,
  completeTotpEnrollment,
  getMfaEnrollmentErrorMessage,
  getMfaStatus,
  startTotpEnrollment,
} from '../services/mfa.service'

function getPolicyLabel(
  mode,
) {
  switch (
    mode
  ) {
    case 'required':
      return 'Required'

    case 'recommended':
      return 'Recommended'

    default:
      return 'Optional'
  }
}


const MFA_PAGE_STYLE = `
/* MFA-only full viewport. The HostShell's outer node is a DIV (not MAIN),
   so the earlier > main selector never matched. This is scoped to this route. */
  #root .app-frame:has(#ep-mfa-enrollment) { height: 100svh !important; min-height: 100svh !important; overflow: hidden !important; }
  #root .app-frame:has(#ep-mfa-enrollment) > footer { display: none !important; }
  #root .app-frame:has(#ep-mfa-enrollment) > .app-content { flex: 1 1 0 !important; min-height: 0 !important; overflow: hidden !important; display: flex !important; }
  /* Actual AccountSecurityWorkspacePresentation children: HostShell uses DIV;
     AdminShell may use MAIN. Never change either shared component. */
  #root .app-frame:has(#ep-mfa-enrollment) > .app-content > :is(div, main):has(#ep-mfa-enrollment) {
    display: flex !important;
    flex: 1 1 0 !important;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  #root .app-frame:has(#ep-mfa-enrollment) .page-shell:has(> div > .grid > aside) {
    display: flex !important;
    flex: 1 1 0 !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  #root .app-frame:has(#ep-mfa-enrollment) .page-shell:has(> div > .grid > aside) > div {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    border-radius: 0;
    overflow: hidden;
  }
  #root .app-frame:has(#ep-mfa-enrollment) .page-shell:has(> div > .grid > aside) > div > .grid {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0 !important;
    height: 100%;
  }
  #root .app-frame:has(#ep-mfa-enrollment) .page-shell:has(> div > .grid > aside) > div > .grid > section {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  #root .app-frame:has(#ep-mfa-enrollment) .epantry-workspace-canvas {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  #root .app-frame:has(#ep-mfa-enrollment) .epantry-workspace-canvas > header { display: none !important; }
  #root .app-frame:has(#ep-mfa-enrollment) .epantry-workspace-canvas > div { flex: 1; min-height: 0; padding: 0 !important; overflow: hidden; }
  @media (min-width: 1024px) {
    /* Preserve the approved 75% visual density on this page while matching
       the workspace's FULL visible width. Other workspace zoom stays 0.75. */
    #root .app-frame:has(#ep-mfa-enrollment) .epantry-workspace-canvas {
      zoom: 1 !important;
      width: 133.333333% !important;
      min-width: 133.333333% !important;
      max-width: none !important;
      height: 133.333333% !important;
      flex: 0 0 auto !important;
      transform: scale(0.75);
      transform-origin: top left;
    }
  }
  #ep-mfa-enrollment, #ep-mfa-enrollment * { box-sizing: border-box; }
  #ep-mfa-enrollment { width: 100%; min-width: 0; margin: 0; padding: clamp(16px,2.4vw,32px); background: #F7F6F2; color: #202421; }
  #ep-mfa-enrollment .mfa-layout { width: 100%; min-width: 0; max-width: none; margin: 0 auto; }
  #ep-mfa-enrollment .mfa-hero { display: flex; justify-content: space-between; align-items: stretch; gap: 24px; padding: 0; background: #F8E7DC; border: 1px solid #E8D3C5; border-top: 3px solid #C86C42; border-radius: 16px; overflow: hidden; }
  #ep-mfa-enrollment .mfa-hero-main { min-width: 0; padding: 28px 34px 30px; }
  #ep-mfa-enrollment .mfa-eyebrow { display: flex; align-items: center; gap: 9px; color: #895039; font-size: 12px; line-height: 18px; letter-spacing: .045em; font-weight: 700; text-transform: uppercase; }
  #ep-mfa-enrollment .mfa-eyebrow-mark { width: 28px; height: 28px; display: inline-grid; place-items: center; border: 1px solid #DEB99F; border-radius: 9px; background: #FFF9F4; color: #984C31; }
  #root #ep-mfa-enrollment h1 { margin: 13px 0 8px; font-size: clamp(29px,2.9vw,38px) !important; line-height: 1.18 !important; letter-spacing: -.035em; font-weight: 700; color: #173F35 !important; }
  #root #ep-mfa-enrollment h2 { margin: 0; font-size: clamp(21px,2.1vw,25px) !important; line-height: 1.28 !important; letter-spacing: -.024em; font-weight: 700; color: #173F35 !important; }
  #root #ep-mfa-enrollment h3 { margin: 0; font-size: 18px !important; line-height: 1.35 !important; font-weight: 700; color: #173F35 !important; }
  #ep-mfa-enrollment .mfa-hero-copy { margin: 0; max-width: 590px; color: #60574F; font-size: 15px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-hero-side { flex: 0 0 280px; min-width: 0; display: flex; align-items: center; gap: 15px; padding: 26px 24px; background: #E6EBDD; border-left: 1px solid #D6D9CD; color: #173F35; }
  #ep-mfa-enrollment .mfa-side-icon { width: 51px; height: 51px; flex: 0 0 51px; display: grid; place-items: center; background: #FFFDF8; border: 1px solid #CCD7C8; border-radius: 50%; color: #173F35; }
  #ep-mfa-enrollment .mfa-side-title { font-size: 17px; font-weight: 700; line-height: 1.3; }
  #ep-mfa-enrollment .mfa-side-detail { margin-top: 4px; color: #52665A; font-size: 13px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-security-grid { display: grid; grid-template-columns: minmax(235px,.58fr) minmax(0,1.6fr); margin-top: 18px; border: 1px solid #D8E1D6; border-radius: 16px; overflow: hidden; background: #FFFEFC; }
  #ep-mfa-enrollment .mfa-status-feature { padding: 30px; background: #173F35; color: #F7F6F2; display: flex; flex-direction: column; align-items: flex-start; min-height: 275px; }
  #ep-mfa-enrollment .mfa-feature-icon { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: #E3EBDF; color: #173F35; }
  #ep-mfa-enrollment .mfa-feature-caption { font-size: 12px; line-height: 1.45; font-weight: 700; text-transform: uppercase; letter-spacing: .055em; color: #BBD0C4; margin-top: auto; padding-top: 24px; }
  #ep-mfa-enrollment .mfa-feature-title { margin-top: 4px; font-size: clamp(30px,3.1vw,42px); line-height: 1.15; font-weight: 700; letter-spacing: -.035em; }
  #ep-mfa-enrollment .mfa-feature-text { color: #D5E5DB; font-size: 14px; line-height: 1.55; margin-top: 9px; max-width: 310px; }
  #ep-mfa-enrollment .mfa-security-info { min-width: 0; display: flex; flex-direction: column; }
  #ep-mfa-enrollment .mfa-overview-head { padding: 22px 28px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  #ep-mfa-enrollment .mfa-overview-head p { color: #64746A; margin: 5px 0 0; font-size: 13px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 8px; background: #E1EFE5; color: #205A41; font-size: 13px; line-height: 1.3; font-weight: 700; white-space: nowrap; }
  #ep-mfa-enrollment .mfa-metric-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); border-top: 1px solid #E8ECE5; border-bottom: 1px solid #E8ECE5; flex: 1; }
  #ep-mfa-enrollment .mfa-metric { min-width: 0; padding: 20px 23px 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; }
  #ep-mfa-enrollment .mfa-metric + .mfa-metric { border-left: 1px solid #E8ECE5; }
  #ep-mfa-enrollment .mfa-metric-label { color: #58665D; font-size: 13px; line-height: 1.45; font-weight: 600; }
  #ep-mfa-enrollment .mfa-metric-value { color: #173F35; font-size: clamp(20px,2.2vw,27px); line-height: 1.2; font-weight: 700; letter-spacing: -.025em; overflow-wrap: anywhere; }
  #ep-mfa-enrollment .mfa-security-footer { display: flex; justify-content: space-between; gap: 18px; align-items: center; flex-wrap: wrap; padding: 15px 24px; background: #F5F6F1; }
  #ep-mfa-enrollment .mfa-account { color: #596B61; font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; min-width: 0; }
  #ep-mfa-enrollment .mfa-advice { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 17px 23px; margin-top: 16px; border: 1px solid #D7E4E9; border-radius: 13px; background: #E8F1F3; }
  #ep-mfa-enrollment .mfa-advice-message { display: flex; align-items: flex-start; gap: 11px; color: #31576A; font-size: 14px; line-height: 1.5; }
  #ep-mfa-enrollment .mfa-advice-message svg { flex: 0 0 auto; margin-top: 2px; }
  #ep-mfa-enrollment .mfa-advice-message strong { color: #21495B; }
  #ep-mfa-enrollment .mfa-advice-small { font-size: 13px; color: #4A6B78; }
  #ep-mfa-enrollment .mfa-primary, #ep-mfa-enrollment .mfa-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: 10px; padding: 9px 17px; font-size: 14px; line-height: 1.35; font-weight: 700; text-decoration: none; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
  #ep-mfa-enrollment .mfa-primary { background: #173F35; color: #FFF; border: 1px solid #173F35; }
  #ep-mfa-enrollment .mfa-primary:hover { background: #28614E; color: #FFF; }
  #ep-mfa-enrollment .mfa-secondary { background: #FFFEFC; color: #173F35; border: 1px solid #B8CCBE; }
  #ep-mfa-enrollment .mfa-secondary:hover { background: #E8F0E5; }
  #ep-mfa-enrollment button:disabled { opacity: .58; cursor: not-allowed; }
  #ep-mfa-enrollment :is(button,a,input):focus-visible { outline: 3px solid #C86C42; outline-offset: 3px; }
  #ep-mfa-enrollment .mfa-panel { min-width: 0; background: #FFFEFC; border: 1px solid #DAE2D8; border-radius: 16px; overflow: hidden; }
  #ep-mfa-enrollment .mfa-content { display: grid; grid-template-columns: minmax(0,1.65fr) minmax(250px,.7fr); align-items: start; gap: 18px; margin-top: 18px; }
  #ep-mfa-enrollment .mfa-panel-header { display: flex; align-items: center; gap: 12px; padding: 20px 24px; background: #E9F0EA; border-bottom: 1px solid #DCE5DC; }
  #ep-mfa-enrollment .mfa-mini-icon { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; background: #DCE8DA; color: #173F35; }
  #ep-mfa-enrollment .mfa-panel-content { padding: 3px 24px; }
  #ep-mfa-enrollment .mfa-status-row { padding: 16px 0; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 14px; border-bottom: 1px solid #E9ECE6; }
  #ep-mfa-enrollment .mfa-status-row:last-child { border-bottom: none; }
  #ep-mfa-enrollment .mfa-label { color: #344F40; font-size: 15px; font-weight: 600; line-height: 1.4; }
  #ep-mfa-enrollment .mfa-value { color: #173F35; font-size: 16px; line-height: 1.4; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
  #ep-mfa-enrollment .mfa-subtext { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: #64776A; }
  #ep-mfa-enrollment .mfa-bottom { padding: 15px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; background: #F4F6F1; border-top: 1px solid #E3E9E0; }
  #ep-mfa-enrollment .mfa-help { min-width: 0; background: #FBE9DD; border: 1px solid #ECD3C4; border-radius: 16px; padding: 22px; color: #674B3D; }
  #ep-mfa-enrollment .mfa-help p { font-size: 14px; line-height: 1.55; margin: 9px 0 0; color: #654F42; }
  #ep-mfa-enrollment .mfa-help ul { padding-left: 19px; margin: 13px 0 0; font-size: 14px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-form-layout { margin-top: 18px; display: grid; grid-template-columns: minmax(0,.8fr) minmax(0,1.2fr); overflow: hidden; border: 1px solid #D6E1E3; border-radius: 16px; background: #FFFEFC; }
  #ep-mfa-enrollment .mfa-form-story { background: #E7F0F3; padding: 28px; border-right: 1px solid #D7E5EA; }
  #ep-mfa-enrollment .mfa-form-story p { margin: 11px 0 0; color: #546F79; font-size: 14px; line-height: 1.6; }
  #ep-mfa-enrollment .mfa-form-story .mfa-step { margin: 0 0 13px; color: #346779; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; font-weight: 700; }
  #ep-mfa-enrollment .mfa-form-main { min-width: 0; padding: 28px; }
  #ep-mfa-enrollment .mfa-step-label { margin-bottom: 8px; color: #A5563D; font-size: 13px; font-weight: 700; }
  #ep-mfa-enrollment .mfa-form-help { margin: 9px 0 0; color: #65756A; font-size: 14px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-input-label { display: block; font-size: 14px; font-weight: 700; color: #173F35; margin-bottom: 8px; }
  #ep-mfa-enrollment .mfa-input { width: 100%; min-height: 49px; padding: 11px 14px; border: 1px solid #BFD0C3; border-radius: 10px; background: #FFF; font-size: 15px; color: #202421; }
  #ep-mfa-enrollment .mfa-input:focus { border-color: #173F35; }
  #ep-mfa-enrollment .mfa-form-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 19px; }
  #ep-mfa-enrollment .mfa-alert { border: 1px solid #E7B5A3; border-radius: 10px; background: #FFF1E8; color: #893C28; padding: 12px 14px; margin: 15px 0; font-size: 14px; line-height: 1.5; }
  #ep-mfa-enrollment .mfa-note { margin-top: 20px; border: 1px solid #D9E6D7; border-radius: 11px; padding: 14px 16px; background: #EAF2E7; color: #385841; font-size: 14px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-setup-columns { display: grid; grid-template-columns: minmax(220px,.75fr) minmax(0,1.25fr); gap: 24px; padding: 24px; }
  #ep-mfa-enrollment .mfa-qr { padding: 20px; border: 1px solid #D5DECE; border-radius: 13px; background: #FFF; }
  #ep-mfa-enrollment .mfa-qr img { display: block; width: 100%; max-width: 244px; height: auto; margin: auto; }
  #ep-mfa-enrollment .mfa-setup-details { padding: 18px; margin-bottom: 18px; background: #E8F0F3; border: 1px solid #D8E5E9; border-radius: 12px; }
  #ep-mfa-enrollment .mfa-secret { display: flex; align-items: stretch; gap: 8px; margin-top: 12px; }
  #ep-mfa-enrollment .mfa-secret code { flex: 1; min-width: 0; overflow-wrap: anywhere; border: 1px solid #CCDCD6; background: #FFF; border-radius: 10px; padding: 11px; font-size: 14px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-code { letter-spacing: .2em; font-size: 23px; font-weight: 700; text-align: center; }
  #ep-mfa-enrollment .mfa-loading { min-height: 160px; display: flex; align-items: center; gap: 12px; padding: 30px; color: #173F35; font-size: 15px; font-weight: 600; }
  @media (max-width: 980px) {
    #ep-mfa-enrollment .mfa-hero-side { flex-basis: 225px; }
    #ep-mfa-enrollment .mfa-security-grid { grid-template-columns: minmax(210px,.65fr) minmax(0,1.35fr); }
    #ep-mfa-enrollment .mfa-status-feature { padding: 24px; }
    #ep-mfa-enrollment .mfa-metric { padding: 18px 14px; }
    #ep-mfa-enrollment .mfa-content { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    #ep-mfa-enrollment .mfa-hero { flex-direction: column; gap: 0; }
    #ep-mfa-enrollment .mfa-hero-main { padding: 24px 22px; }
    #ep-mfa-enrollment .mfa-hero-side { flex: 0 0 auto; border-left: 0; border-top: 1px solid #D6D9CD; padding: 14px 22px; }
    #ep-mfa-enrollment .mfa-side-icon { width: 36px; height: 36px; flex-basis: 36px; }
    #ep-mfa-enrollment .mfa-security-grid { grid-template-columns: 1fr; }
    #ep-mfa-enrollment .mfa-status-feature { min-height: auto; display: grid; grid-template-columns: 47px 1fr; align-items: center; column-gap: 15px; padding: 20px; }
    #ep-mfa-enrollment .mfa-feature-icon { width: 47px; height: 47px; grid-row: span 3; border-radius: 12px; }
    #ep-mfa-enrollment .mfa-feature-caption { margin: 0; padding: 0; }
    #ep-mfa-enrollment .mfa-feature-title { font-size: 27px; }
    #ep-mfa-enrollment .mfa-feature-text { margin-top: 2px; }
    #ep-mfa-enrollment .mfa-metric-grid { grid-template-columns: 1fr; }
    #ep-mfa-enrollment .mfa-metric { padding: 13px 18px; flex-direction: row; align-items: center; gap: 12px; }
    #ep-mfa-enrollment .mfa-metric + .mfa-metric { border-left: 0; border-top: 1px solid #E8ECE5; }
    #ep-mfa-enrollment .mfa-metric-value { text-align: right; font-size: 19px; }
    #ep-mfa-enrollment .mfa-form-layout { grid-template-columns: 1fr; }
    #ep-mfa-enrollment .mfa-form-story { padding: 22px; border-right: 0; border-bottom: 1px solid #D7E5EA; }
    #ep-mfa-enrollment .mfa-setup-columns { grid-template-columns: 1fr; }
  }
  @media (max-width: 540px) {
    #ep-mfa-enrollment { padding: 12px 10px 24px; }
    #ep-mfa-enrollment .mfa-hero-main { padding: 20px 18px; }
    #root #ep-mfa-enrollment h1 { font-size: 27px !important; }
    #ep-mfa-enrollment .mfa-hero-side { padding: 13px 18px; }
    #ep-mfa-enrollment .mfa-side-title { font-size: 15px; }
    #ep-mfa-enrollment .mfa-side-detail { font-size: 12.5px; }
    #ep-mfa-enrollment .mfa-overview-head { padding: 17px 18px; }
    #ep-mfa-enrollment .mfa-advice { padding: 15px 17px; }
    #ep-mfa-enrollment .mfa-security-footer { align-items: stretch; }
    #ep-mfa-enrollment .mfa-security-footer .mfa-primary { width: 100%; }
    #ep-mfa-enrollment .mfa-panel-header, #ep-mfa-enrollment .mfa-bottom { padding: 16px 18px; }
    #ep-mfa-enrollment .mfa-panel-content { padding: 0 18px; }
    #ep-mfa-enrollment .mfa-form-main { padding: 21px 18px; }
    #ep-mfa-enrollment .mfa-setup-columns { padding: 17px; }
    #ep-mfa-enrollment .mfa-form-actions .mfa-primary { width: 100%; }
  }
  /* Enrolled MFA: full-height security desk, route-scoped and using senior's palette. */
  #ep-mfa-enrollment { height: 100%; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; }
  #ep-mfa-enrollment:has(.mfa-live-page) { display: flex; flex-direction: column; padding: clamp(15px, 2vw, 28px) !important; }
  #ep-mfa-enrollment:has(.mfa-live-page) .mfa-layout { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  #ep-mfa-enrollment .mfa-live-page { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 17px; flex: 1; min-height: 0; }
  #ep-mfa-enrollment .mfa-live-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 19px 4px 20px; border-bottom: 1px solid #D7DDCF; }
  #ep-mfa-enrollment .mfa-live-eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #9B4C2F; text-transform: uppercase; font-size: 12px; line-height: 1.4; letter-spacing: .075em; font-weight: 750; }
  #root #ep-mfa-enrollment .mfa-live-header h1 { margin: 7px 0 0; color: #202421 !important; font-size: clamp(28px, 2.7vw, 37px) !important; line-height: 1.16 !important; letter-spacing: -.035em; font-weight: 750; }
  #ep-mfa-enrollment .mfa-live-header p { margin: 5px 0 0; font-size: 14px; line-height: 1.45; color: #56675C; }
  #ep-mfa-enrollment .mfa-live-confirmed { display: inline-flex; align-items: center; gap: 9px; flex: 0 0 auto; border: 1px solid #BCC9B7; background: #D7DDCF; color: #173F35; padding: 11px 16px; font-size: 13px; font-weight: 750; }
  #ep-mfa-enrollment .mfa-live-grid { display: grid; grid-template-columns: minmax(0, 1.07fr) minmax(290px, .93fr); gap: 17px; min-height: 0; }
  #ep-mfa-enrollment .mfa-live-security { min-width: 0; display: grid; grid-template-rows: minmax(200px, .90fr) minmax(230px, 1.1fr); min-height: 0; border: 1px solid #D7DDCF; }
  #ep-mfa-enrollment .mfa-live-protected { position: relative; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 20px; padding: clamp(22px, 2.4vw, 34px); background: #173F35; color: #F7F6F2; }
  #ep-mfa-enrollment .mfa-live-protected:after { content: ''; position: absolute; right: -110px; top: -125px; width: 315px; height: 315px; border: 1px solid rgba(247,246,242,.13); border-radius: 50%; box-shadow: 0 0 0 38px rgba(247,246,242,.045), 0 0 0 86px rgba(247,246,242,.025); pointer-events: none; }
  #ep-mfa-enrollment .mfa-live-status-mark { position: relative; z-index: 1; display: inline-flex; gap: 9px; align-items: center; font-size: 12px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; color: #D7DDCF; }
  #ep-mfa-enrollment .mfa-live-status-mark svg { color: #F7F6F2; }
  #ep-mfa-enrollment .mfa-live-status-content { position: relative; z-index: 1; }
  #root #ep-mfa-enrollment .mfa-live-protected h2 { max-width: 550px; margin: 0 0 8px; font-size: clamp(27px, 3vw, 43px) !important; line-height: 1.1 !important; letter-spacing: -.035em; color: #F7F6F2 !important; }
  #ep-mfa-enrollment .mfa-live-protected p { max-width: 500px; margin: 0; color: #D7DDCF; font-size: 14px; line-height: 1.5; }
  #ep-mfa-enrollment .mfa-live-protection-line { position: relative; z-index: 1; display: flex; align-items: center; gap: 9px; color: #F7F6F2; font-weight: 650; font-size: 13px; }
  #ep-mfa-enrollment .mfa-live-protection-line svg { color: #F0B38F; }
  #ep-mfa-enrollment .mfa-live-facts { min-width: 0; display: flex; flex-direction: column; background: #F7F6F2; }
  #ep-mfa-enrollment .mfa-live-facts-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 19px 24px 14px; }
  #root #ep-mfa-enrollment .mfa-live-facts-header h3 { margin: 0; color: #202421 !important; font-size: 19px !important; line-height: 1.25 !important; }
  #ep-mfa-enrollment .mfa-live-facts-header span { color: #58685E; font-size: 12px; }
  #ep-mfa-enrollment .mfa-live-facts-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: #D7DDCF; }
  #ep-mfa-enrollment .mfa-live-fact { min-width: 0; padding: 17px 20px; }
  #ep-mfa-enrollment .mfa-live-fact + .mfa-live-fact { border-left: 1px solid rgba(23,63,53,.14); }
  #ep-mfa-enrollment .mfa-live-fact span { display: block; color: #4E6256; font-size: 12px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-live-fact strong { display: block; margin-top: 7px; color: #173F35; font-size: clamp(18px, 1.8vw, 24px); line-height: 1.2; overflow-wrap: anywhere; }
  #ep-mfa-enrollment .mfa-live-account { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: auto; padding: 16px 24px; }
  #ep-mfa-enrollment .mfa-live-account-label { font-size: 11px; font-weight: 750; letter-spacing: .065em; text-transform: uppercase; color: #617064; }
  #ep-mfa-enrollment .mfa-live-email { margin-top: 4px; color: #173F35; font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
  #ep-mfa-enrollment .mfa-live-refresh { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #B5C2B3; background: transparent; color: #173F35; padding: 9px 13px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  #ep-mfa-enrollment .mfa-live-refresh:hover { background: #D7DDCF; }
  #ep-mfa-enrollment .mfa-live-tools { min-width: 0; display: flex; flex-direction: column; border: 1px solid #D7DDCF; background: #F7F6F2; }
  #ep-mfa-enrollment .mfa-live-tools-header { padding: 22px 25px 20px; border-left: 5px solid #C56C42; border-bottom: 1px solid #D7DDCF; }
  #ep-mfa-enrollment .mfa-live-tools-eyebrow { color: #A65334; font-size: 11px; font-weight: 750; letter-spacing: .075em; text-transform: uppercase; }
  #root #ep-mfa-enrollment .mfa-live-tools-header h2 { margin: 8px 0 5px; color: #202421 !important; font-size: clamp(21px, 2vw, 27px) !important; line-height: 1.2 !important; }
  #ep-mfa-enrollment .mfa-live-tools-header p { margin: 0; font-size: 13px; line-height: 1.45; color: #607164; }
  #ep-mfa-enrollment .mfa-live-links { display: flex; flex-direction: column; padding: 0 24px; }
  #ep-mfa-enrollment .mfa-live-link { display: flex; align-items: center; gap: 13px; padding: clamp(12px, 1.55vh, 17px) 0; text-decoration: none; color: #173F35; border-bottom: 1px solid #D7DDCF; min-width: 0; }
  #ep-mfa-enrollment .mfa-live-link:hover { color: #A75334; padding-left: 4px; background: rgba(215,221,207,.23); }
  #ep-mfa-enrollment .mfa-live-link-icon { display: grid; place-items: center; flex: 0 0 39px; width: 39px; height: 39px; background: #D7DDCF; color: #173F35; }
  #ep-mfa-enrollment .mfa-live-link-text { flex: 1; min-width: 0; }
  #ep-mfa-enrollment .mfa-live-link-text strong { display: block; color: inherit; font-size: 14px; line-height: 1.3; }
  #ep-mfa-enrollment .mfa-live-link-text small { display: block; margin-top: 3px; font-size: 12px; line-height: 1.35; color: #617064; }
  #ep-mfa-enrollment .mfa-live-link > svg:last-child { flex: 0 0 auto; }
  #ep-mfa-enrollment .mfa-live-tools-note { display: flex; align-items: flex-start; gap: 10px; margin-top: auto; padding: 17px 24px; color: #173F35; background: #D7DDCF; font-size: 13px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-live-tools-note svg { flex: 0 0 auto; margin-top: 1px; }
  #ep-mfa-enrollment .mfa-live-bottom { display: flex; justify-content: space-between; align-items: center; gap: 15px; border-top: 1px solid #D7DDCF; padding: 8px 4px 0; font-size: 12px; color: #526458; }
  #ep-mfa-enrollment .mfa-live-back { display: inline-flex; align-items: center; gap: 7px; color: #173F35; text-decoration: none; font-weight: 750; white-space: nowrap; }
  #ep-mfa-enrollment .mfa-live-back:hover { color: #A65334; }
  #ep-mfa-enrollment :is(a,button):focus-visible { outline: 3px solid #C56C42; outline-offset: 3px; }
  @media (max-width: 920px) {
    #ep-mfa-enrollment .mfa-live-page { display: flex; flex-direction: column; min-height: 0; }
    #ep-mfa-enrollment .mfa-live-grid { grid-template-columns: 1fr; min-height: auto; }
    #ep-mfa-enrollment .mfa-live-security { grid-template-rows: auto auto; }
    #ep-mfa-enrollment .mfa-live-protected { min-height: 205px; }
  }
  @media (max-width: 540px) {
    #ep-mfa-enrollment:has(.mfa-live-page) { padding: 12px 10px 20px !important; }
    #ep-mfa-enrollment .mfa-live-page { gap: 13px; }
    #ep-mfa-enrollment .mfa-live-header { padding: 10px 3px 14px; gap: 12px; align-items: flex-start; }
    #root #ep-mfa-enrollment .mfa-live-header h1 { font-size: 26px !important; }
    #ep-mfa-enrollment .mfa-live-header p { font-size: 12px; }
    #ep-mfa-enrollment .mfa-live-confirmed { padding: 7px 9px; font-size: 11px; }
    #ep-mfa-enrollment .mfa-live-grid { gap: 12px; }
    #ep-mfa-enrollment .mfa-live-protected { padding: 23px 18px; min-height: 193px; }
    #root #ep-mfa-enrollment .mfa-live-protected h2 { font-size: 30px !important; }
    #ep-mfa-enrollment .mfa-live-facts-header { padding: 16px 15px 12px; }
    #ep-mfa-enrollment .mfa-live-fact { padding: 15px 10px; }
    #ep-mfa-enrollment .mfa-live-fact strong { font-size: 17px; }
    #ep-mfa-enrollment .mfa-live-account { align-items: flex-start; padding: 16px 14px; flex-wrap: wrap; }
    #ep-mfa-enrollment .mfa-live-tools-header { padding: 17px 15px; }
    #ep-mfa-enrollment .mfa-live-links { padding: 0 15px; }
    #ep-mfa-enrollment .mfa-live-link { padding: 12px 0; }
    #ep-mfa-enrollment .mfa-live-tools-note { padding: 13px 15px; }
    #ep-mfa-enrollment .mfa-live-bottom { flex-wrap: wrap; }
  }
  @media (prefers-reduced-motion: reduce) { #ep-mfa-enrollment .mfa-live-link { transition: none !important; } }

`

function MfaFrame({children}) {
  return (
    <main id="ep-mfa-enrollment">
      <style>{MFA_PAGE_STYLE}</style>
      <div className="mfa-layout">{children}</div>
    </main>
  )
}

function MfaHero({title, description, active=false}) {
  return (
    <header className="mfa-hero">
      <div className="mfa-hero-main">
        <div className="mfa-eyebrow"><span className="mfa-eyebrow-mark"><ShieldCheck size={17} aria-hidden="true" /></span> Account / Security</div>
        <h1>{title}</h1>
        <p className="mfa-hero-copy">{description}</p>
      </div>
      <div className="mfa-hero-side">
        <span className="mfa-side-icon">{active ? <CheckCircle2 size={22} aria-hidden="true" /> : <LockKeyhole size={21} aria-hidden="true" />}</span>
        <div>
          <div className="mfa-side-title">{active ? 'MFA is active' : 'Two-step protection'}</div>
          <div className="mfa-side-detail">{active ? 'An extra sign-in check is ready.' : 'Secure your account with an authenticator.'}</div>
        </div>
      </div>
    </header>
  )
}

export default function MfaEnrollmentPage() {
  const {
    user,
    activeMode,
  } = useAuth()

  const { hasAdminAccess, hasAdminPermission, isRootSuperAdmin } = useAdmin()

  const [
    mfaStatus,
    setMfaStatus,
  ] = useState(null)

  const [
    isLoadingStatus,
    setIsLoadingStatus,
  ] = useState(true)

  const [
    statusError,
    setStatusError,
  ] = useState('')

  const [
    stage,
    setStage,
  ] = useState(
    'reauth',
  )

  const [
    password,
    setPassword,
  ] = useState('')

  const [
    setup,
    setSetup,
  ] = useState(null)

  const [
    verificationCode,
    setVerificationCode,
  ] = useState('')

  const [
    isStarting,
    setIsStarting,
  ] = useState(false)

  const [
    isCompleting,
    setIsCompleting,
  ] = useState(false)

  const [
    actionError,
    setActionError,
  ] = useState('')

  const [
    copiedSecret,
    setCopiedSecret,
  ] = useState(false)

  const [
    sessionRefreshed,
    setSessionRefreshed,
  ] = useState(true)

  /*
  |--------------------------------------------------------------------------
  | Load Authoritative MFA Status
  |--------------------------------------------------------------------------
  */

  const loadStatus =
    useCallback(
      async () => {
        setIsLoadingStatus(
          true,
        )

        setStatusError('')

        try {
          const status =
            await getMfaStatus()

          setMfaStatus(
            status,
          )
        } catch (error) {
          setStatusError(
            error?.message ||
              'Unable to load MFA status.',
          )
        } finally {
          setIsLoadingStatus(
            false,
          )
        }
      },
      [],
    )

  useEffect(() => {
    loadStatus()

    return () => {
      void cancelTotpEnrollment()
    }
  }, [
    loadStatus,
  ])

  /*
  |--------------------------------------------------------------------------
  | Begin Setup
  |--------------------------------------------------------------------------
  */

  const handleStartEnrollment =
    async (
      event,
    ) => {
      event.preventDefault()

      if (!password) {
        setActionError(
          'Enter your current password to continue.',
        )

        return
      }

      setIsStarting(true)
      setActionError('')

      try {
        const enrollmentSetup =
          await startTotpEnrollment({
            email:
              user?.email,

            password,
          })

        setSetup(
          enrollmentSetup,
        )

        setPassword('')

        setVerificationCode('')

        setStage(
          'setup',
        )
      } catch (error) {
        setActionError(
          getMfaEnrollmentErrorMessage(
            error,
          ),
        )
      } finally {
        setIsStarting(false)
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Complete Setup
  |--------------------------------------------------------------------------
  */

  const handleCompleteEnrollment =
    async (
      event,
    ) => {
      event.preventDefault()

      const normalizedCode =
        verificationCode
          .replace(
            /\D/g,
            '',
          )

      const codeLength =
        setup?.codeLength ||
        6

      if (
        normalizedCode.length !==
        codeLength
      ) {
        setActionError(
          `Enter the ${codeLength}-digit code from your authenticator app.`,
        )

        return
      }

      setIsCompleting(true)
      setActionError('')

      try {
        const result =
          await completeTotpEnrollment({
            verificationCode:
              normalizedCode,

            displayName:
              'EPANTRY Authenticator',
          })

        setSessionRefreshed(
          result.sessionRefreshed,
        )

        setStage(
          'success',
        )

        /*
        |--------------------------------------------------------------------------
        | Refresh Backend View
        |--------------------------------------------------------------------------
        */

        try {
          const updatedStatus =
            await getMfaStatus()

          setMfaStatus(
            updatedStatus,
          )
        } catch {
          /*
          |--------------------------------------------------------------------------
          | Enrollment is already complete in Firebase.
          |--------------------------------------------------------------------------
          */
        }
      } catch (error) {
        setActionError(
          getMfaEnrollmentErrorMessage(
            error,
          ),
        )
      } finally {
        setIsCompleting(false)
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Cancel Setup
  |--------------------------------------------------------------------------
  */

  const handleCancelSetup =
    async () => {
      await cancelTotpEnrollment()

      setSetup(null)

      setVerificationCode('')

      setActionError('')

      setStage(
        'reauth',
      )
    }

  /*
  |--------------------------------------------------------------------------
  | Copy Secret
  |--------------------------------------------------------------------------
  */

  const handleCopySecret =
    async () => {
      if (
        !setup?.secretKey
      ) {
        return
      }

      try {
        await navigator.clipboard.writeText(
          setup.secretKey,
        )

        setCopiedSecret(true)

        window.setTimeout(
          () => {
            setCopiedSecret(false)
          },
          2000,
        )
      } catch {
        setActionError(
          'Unable to copy automatically. Select and copy the setup key manually.',
        )
      }
    }

  const policy = mfaStatus?.policy
  const returnPath = hasAdminAccess ? '/admin' : activeMode === 'host' ? '/host/profile' : '/'
  const returnLabel = hasAdminAccess ? 'Admin overview' : activeMode === 'host' ? 'Back to Host profile' : 'Back to EPANTRY'

  if (isLoadingStatus) {
    return <MfaFrame><div className="mfa-panel mfa-loading" role="status"><LoaderCircle className="animate-spin" size={22} /> Loading your security settings…</div></MfaFrame>
  }

  if (statusError) {
    return (
      <MfaFrame>
        <MfaHero title="Security settings" description="We couldn't check your account protection right now." />
        <section className="mfa-panel" style={{marginTop:20,padding:26}}>
          <div className="mfa-alert" role="alert"><CircleAlert size={18} aria-hidden="true" /> {statusError}</div>
          <button type="button" className="mfa-primary" onClick={loadStatus}><RefreshCw size={17} /> Try again</button>
        </section>
      </MfaFrame>
    )
  }

  if (mfaStatus?.enrolled && stage !== 'success') {
    return (
      <MfaFrame>
        <div className="mfa-live-page">
          <header className="mfa-live-header">
            <div>
              <div className="mfa-live-eyebrow"><ShieldCheck size={15} aria-hidden="true" /> Account security</div>
              <h1>Sign-in security</h1>
              <p>Manage the protection on your EPANTRY account.</p>
            </div>
            <span className="mfa-live-confirmed"><CheckCircle2 size={18} aria-hidden="true" /> MFA enabled</span>
          </header>

          <div className="mfa-live-grid">
            <section className="mfa-live-security" aria-label="Account protection details">
              <div className="mfa-live-protected">
                <span className="mfa-live-status-mark"><ShieldCheck size={19} aria-hidden="true" /> Protection / Active</span>
                <div className="mfa-live-status-content">
                  <h2>Your account is protected.</h2>
                  <p>{mfaStatus.totpEnrolled ? 'Your authenticator is ready for sign-in verification.' : 'Your account has an active additional sign-in check.'}</p>
                </div>
                <span className="mfa-live-protection-line"><CheckCircle2 size={17} aria-hidden="true" /> Extra sign-in verification is active</span>
              </div>
              <div className="mfa-live-facts">
                <div className="mfa-live-facts-header"><h3>Security details</h3><span>Current account status</span></div>
                <div className="mfa-live-facts-grid">
                  <div className="mfa-live-fact"><span>Authenticator</span><strong>{mfaStatus.totpEnrolled ? 'Enabled' : 'Not enrolled'}</strong></div>
                  <div className="mfa-live-fact"><span>Security factors</span><strong>{mfaStatus.factorCount}</strong></div>
                  <div className="mfa-live-fact"><span>Account policy</span><strong>{getPolicyLabel(policy?.mode)}</strong></div>
                </div>
                <div className="mfa-live-account">
                  <div><span className="mfa-live-account-label">Signed-in account</span><div className="mfa-live-email">{user?.email || 'Signed-in account'}</div></div>
                  <button type="button" className="mfa-live-refresh" onClick={loadStatus}><RefreshCw size={15} aria-hidden="true" /> Check status</button>
                </div>
              </div>
            </section>

            <aside className="mfa-live-tools" aria-label={hasAdminAccess ? 'Super Admin shortcuts' : 'Workspace shortcut'}>
              <div className="mfa-live-tools-header">
                <span className="mfa-live-tools-eyebrow">{hasAdminAccess ? '02 / Super Admin workspace' : '02 / Your workspace'}</span>
                <h2>{hasAdminAccess ? 'Quick access' : 'Return to your workspace'}</h2>
                <p>{hasAdminAccess ? 'Open your admin tools directly.' : 'Continue where you left off.'}</p>
              </div>
              <nav className="mfa-live-links" aria-label="Security page navigation">
                {hasAdminAccess ? (
                  <Link className="mfa-live-link" to="/admin"><span className="mfa-live-link-icon"><LayoutDashboard size={19} aria-hidden="true" /></span><span className="mfa-live-link-text"><strong>Admin overview</strong><small>Dashboard and priorities</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
                ) : null}
                {hasAdminAccess && hasAdminPermission('admin.audit.read') ? (
                  <Link className="mfa-live-link" to="/admin/audit"><span className="mfa-live-link-icon"><ScrollText size={19} aria-hidden="true" /></span><span className="mfa-live-link-text"><strong>Admin activity history</strong><small>Recorded changes and decisions</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
                ) : null}
                {hasAdminAccess && isRootSuperAdmin ? (
                  <Link className="mfa-live-link" to="/admin/roles"><span className="mfa-live-link-icon"><UserRoundCog size={19} aria-hidden="true" /></span><span className="mfa-live-link-text"><strong>Admin roles & permissions</strong><small>Manage team access</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
                ) : null}
                {hasAdminAccess && hasAdminPermission('trust_safety.read') ? (
                  <Link className="mfa-live-link" to="/admin/trust-safety"><span className="mfa-live-link-icon"><ShieldCheck size={19} aria-hidden="true" /></span><span className="mfa-live-link-text"><strong>Trust, safety & claims</strong><small>Cases and safety reviews</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
                ) : null}
                {hasAdminAccess && hasAdminPermission('admin.dashboard.read') ? (
                  <Link className="mfa-live-link" to="/admin/policy"><span className="mfa-live-link-icon"><KeyRound size={19} aria-hidden="true" /></span><span className="mfa-live-link-text"><strong>Food rules & feature access</strong><small>Platform controls</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
                ) : null}
                {!hasAdminAccess ? (
                  <Link className="mfa-live-link" to={returnPath}><span className="mfa-live-link-icon"><ArrowLeft size={19} aria-hidden="true" /></span><span className="mfa-live-link-text"><strong>{returnLabel}</strong></span><ArrowRight size={17} aria-hidden="true" /></Link>
                ) : null}
              </nav>
              <div className="mfa-live-tools-note"><Info size={17} aria-hidden="true" /><span>Your authenticator may be requested before sensitive changes.</span></div>
            </aside>
          </div>

          <div className="mfa-live-bottom">
            <span>Security is enabled for this account.</span>
            <Link to={returnPath} className="mfa-live-back">{returnLabel} <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </MfaFrame>
    )
  }

  if (stage === 'success') {
    return (
      <MfaFrame>
        <MfaHero title="Authenticator connected" description="Multi-factor authentication is now enabled for your EPANTRY account." active />
        <div className="mfa-content">
          <section className="mfa-panel" style={{padding:26}}>
            <div className="mfa-chip"><Check size={16}/> Setup complete</div>
            <h2 style={{marginTop:18}}>You're all set</h2>
            <p className="mfa-form-help">Your authenticator app will generate the security codes required when you sign in.</p>
            {!sessionRefreshed && <div className="mfa-alert" role="alert">MFA is enabled, but your EPANTRY session could not be refreshed. You may need to sign in again.</div>}
            <div className="mfa-form-actions"><Link to={returnPath} className="mfa-primary"><ArrowRight size={17}/> {returnLabel}</Link></div>
          </section>
          <aside className="mfa-help"><h3>Keep the app installed</h3><p>Don't delete the EPANTRY entry from your authenticator app. You'll need its rotating codes at future sign-ins.</p></aside>
        </div>
      </MfaFrame>
    )
  }

  return (
    <MfaFrame>
      <MfaHero title="Set up account security" description="Add a second sign-in check to protect your EPANTRY account." />
      <section className="mfa-panel" style={{marginTop:18}} aria-label="Account and policy">
        <div className="mfa-panel-content">
          <div className="mfa-status-row"><span className="mfa-label">Account</span><span className="mfa-value" style={{fontSize:14}}>{user?.email || 'Signed in'}</span></div>
          <div className="mfa-status-row"><span className="mfa-label">Account policy</span><span className="mfa-chip">{getPolicyLabel(policy?.mode)}</span></div>
        </div>
      </section>
      {policy?.reason && <div className="mfa-note" role="note">{policy.reason}</div>}
      {!policy?.enrollmentAllowed ? (
        <section className="mfa-panel" style={{marginTop:18,padding:26}}>
          <div className="mfa-mini-icon"><CircleAlert size={20}/></div>
          <h2 style={{marginTop:14}}>Authenticator setup unavailable</h2>
          <p className="mfa-form-help">Your account currently isn't eligible for enrollment. Please check your account status.</p>
          <div className="mfa-form-actions"><Link to={returnPath} className="mfa-secondary"><ArrowLeft size={17}/> {returnLabel}</Link></div>
        </section>
      ) : stage === 'reauth' ? (
        <section className="mfa-form-layout" style={{marginTop:18}} aria-label="Verify your identity">
          <div className="mfa-form-story">
            <p className="mfa-step">01 / Verify identity</p>
            <h2>First, confirm it's you</h2>
            <p>Enter your current password. This protects your account before the authenticator key is created.</p>
            <div className="mfa-note"><LockKeyhole size={18} aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginRight:7}} /> Your password goes to Firebase Authentication—not the EPANTRY database.</div>
          </div>
          <div className="mfa-form-main">
            <div className="mfa-step-label">Step 1 of 2</div>
            <h2>Verify your password</h2>
            <p className="mfa-form-help">Use the password for your signed-in account.</p>
            {actionError && <div className="mfa-alert" role="alert">{actionError}</div>}
            <form onSubmit={handleStartEnrollment} style={{marginTop:22}}>
              <label htmlFor="mfa-password" className="mfa-input-label">Current password</label>
              <input id="mfa-password" type="password" autoComplete="current-password" value={password} onChange={event=>{setPassword(event.target.value);setActionError('')}} className="mfa-input" placeholder="Enter your password" required />
              <div className="mfa-form-actions">
                <button type="submit" disabled={isStarting} className="mfa-primary">{isStarting?<><LoaderCircle size={17} className="animate-spin"/> Verifying…</>:<><KeyRound size={17}/> Continue to setup <ArrowRight size={16}/></>}</button>
              </div>
            </form>
          </div>
        </section>
      ) : (
        <section className="mfa-panel" style={{marginTop:18}} aria-label="Authenticator setup">
          <header className="mfa-panel-header"><span className="mfa-mini-icon"><Smartphone size={20}/></span><div><div className="mfa-step-label">Step 2 of 2</div><h2>Connect your authenticator</h2><p className="mfa-subtext">Scan the QR code, then confirm the 6-digit code.</p></div></header>
          <div className="mfa-setup-columns">
            <div>
              <div className="mfa-qr">{setup?.qrCodeDataUrl && <img src={setup.qrCodeDataUrl} alt="Authenticator setup QR code" />}</div>
              {setup?.qrCodeUri && <a className="mfa-secondary" style={{marginTop:12,width:'100%'}} href={setup.qrCodeUri}><Smartphone size={16}/> Open authenticator app</a>}
            </div>
            <div>
              <div className="mfa-setup-details">
                <h3>Can't scan the QR?</h3>
                <p className="mfa-form-help">Add EPANTRY manually using this setup key.</p>
                <div className="mfa-secret"><code>{setup?.secretKey}</code><button type="button" className="mfa-secondary" onClick={handleCopySecret} aria-label="Copy authenticator setup key">{copiedSecret?<Check size={18}/>:<Clipboard size={18}/>}</button></div>
                <p className="mfa-subtext" style={{marginTop:9}}>Issuer: {setup?.issuer || 'EPANTRY'} · New code every {setup?.codeIntervalSeconds || 30}s</p>
              </div>
              {actionError && <div className="mfa-alert" role="alert">{actionError}</div>}
              <form onSubmit={handleCompleteEnrollment}>
                <label htmlFor="mfa-code" className="mfa-input-label">Authenticator code</label>
                <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={setup?.codeLength || 6} value={verificationCode} onChange={event=>{setVerificationCode(event.target.value.replace(/\D/g,'').slice(0,setup?.codeLength||6));setActionError('')}} className="mfa-input mfa-code" placeholder="000000" required />
                <div className="mfa-form-actions"><button type="submit" disabled={isCompleting} className="mfa-primary">{isCompleting?<><LoaderCircle size={17} className="animate-spin"/> Enabling…</>:<><ShieldCheck size={17}/> Verify and enable</>}</button><button type="button" disabled={isCompleting} className="mfa-secondary" onClick={handleCancelSetup}>Cancel setup</button></div>
              </form>
            </div>
          </div>
        </section>
      )}
    </MfaFrame>
  )
}
