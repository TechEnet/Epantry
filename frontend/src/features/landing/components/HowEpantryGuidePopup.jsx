import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpenText,
  Check,
  CookingPot,
  Info,
  ShoppingBasket,
  X,
} from "lucide-react";
import { landingBenefits, landingJourneySteps } from "../content/landingContent";

const GUIDE_SHOWN_KEY = "epantry-home-guide-shown-v1";

// Short customer-friendly prompts rotate on the floating guide as before.
const GUIDE_TRIGGER_LABELS = [
  "EPANTRY guide",
  "From food to table",
  "How it works",
  "Why EPANTRY",
];

const WHY_BENEFITS = [
  ...landingBenefits,
  {
    id: "pantry-planning",
    title: "Pantry-aware planning",
    description:
      "See what you already have in your pantry and what your next meal may still need.",
    icon: ShoppingBasket,
  },
  {
    id: "recipe-to-basket",
    title: "Recipe to basket",
    description:
      "Review a recipe's ingredients and take what you need into shopping.",
    icon: CookingPot,
  },
];

// Keep using the landing page's existing, approved illustration assets.
const STEP_ART_BY_ID = {
  discover: "/exploar/Discover.png",
  understand: "/exploar/understand.png",
  "build-basket": "/exploar/Build your basket.png",
  cook: "/exploar/Buy & Cook.png",
};

const BENEFIT_ART_BY_ID = {
  search: "/exploar/Smart Discovery.png",
  "trusted-data": "/exploar/Trusted Product data.png",
  "food-intelligence": "/exploar/ Food Intelligence.png",
  "pantry-planning": "/exploar/Pantry Aware Planning.png",
  "recipe-to-basket": "/exploar/Recipe to basket.png",
};

// Popup-only styles: do not modify global typography or the rest of the landing page.
const GUIDE_STYLES = String.raw`
  .epg-root {
    --epg-paper: #F7F6F2;
    --epg-forest: #173F35;
    --epg-ink: #202421;
    --epg-sage: #D7DDCF;
    --epg-clay: #C86C42;
    --epg-line: rgba(23, 63, 53, .18);
    --epg-muted: #506057;
    font-family: 'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif;
    color: var(--epg-ink);
  }
  .epg-root *, .epg-root *::before, .epg-root *::after { box-sizing: border-box; }
  .epg-root button, .epg-root a { font-family: inherit; cursor: pointer; }
  .epg-root :is(button, a, [tabindex]):focus-visible {
    outline: 3px solid var(--epg-clay) !important;
    outline-offset: 3px;
  }
  .epg-root p, .epg-root h2, .epg-root h3, .epg-root h4 { margin: 0; }
  .epg-root h2, .epg-root h3, .epg-root h4 {
    font-family: inherit !important;
    font-weight: 600 !important;
    letter-spacing: -.035em !important;
  }
  .epg-trigger {
    position: fixed; z-index: 115; bottom: 23px; left: 24px;
    display: flex; align-items: center; gap: 10px;
    min-height: 49px; max-width: min(88vw, 260px);
    border: 1px solid #173F35; border-radius: 999px;
    padding: 5px 15px 5px 6px; background: #173F35; color: #F7F6F2;
    box-shadow: 0 12px 32px rgba(18, 40, 31, .22);
    font-size: 14px; font-weight: 650;
  }
  .epg-trigger-icon {
    width: 37px; height: 37px; flex: 0 0 37px;
    display: grid; place-items: center; border-radius: 50%;
    background: #F7F6F2; color: #173F35;
  }
  .epg-trigger-arrow { opacity: .85; margin-left: 3px; }
  .epg-trigger-label { display:inline-block; white-space:nowrap; min-width:0; animation:epg-trigger-label-in .35s ease both; }
  @keyframes epg-trigger-label-in {
    from { opacity:0; transform:translateY(5px); }
    to { opacity:1; transform:translateY(0); }
  }
  /* Compact only when a Grocery or Recipes card gallery is ACTUALLY in front
     of the user. Intersection flags alone can stay active when the next hero
     visually overlays a pinned gallery; the button class is viewport-verified. */
  .epg-trigger.epg-trigger--card-compact {
    top:auto !important; left:8px !important; bottom:16px !important;
    transform:none !important; width:46px; height:46px; min-height:46px;
    max-width:46px; justify-content:center; gap:0; padding:0;
    border:0; border-radius:50%; background:transparent; box-shadow:none;
    opacity:1 !important; visibility:visible !important; pointer-events:auto !important;
  }
  .epg-trigger.epg-trigger--card-compact .epg-trigger-icon {
    width:46px; height:46px; flex:0 0 46px; border-radius:50%;
    background:#173F35; color:#F7F6F2;
    box-shadow:0 5px 15px rgba(18,40,31,.2);
  }
  .epg-trigger.epg-trigger--card-compact .epg-trigger-label,
  .epg-trigger.epg-trigger--card-compact .epg-trigger-arrow { display:none; }
  @media (prefers-reduced-motion:reduce) { .epg-trigger-label { animation:none !important; } }
  .epg-overlay {
    position: fixed; inset: 0; z-index: 120;
    display: flex; align-items: center; justify-content: center;
    padding: 14px; background: rgba(14, 31, 26, .58);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .epg-shell {
    position: relative; display: flex; flex-direction: column; min-height: 0;
    width: min(1180px, 98vw); height: min(92svh, 860px);
    overflow: hidden; border: 1px solid rgba(255, 255, 255, .35);
    border-radius: 19px; background: #F7F6F2;
    box-shadow: 0 30px 100px rgba(6, 18, 12, .42);
  }
  .epg-shell--prompt { width: min(430px, 95vw); height: auto; }
  .epg-close {
    width: 45px; height: 45px; flex: 0 0 45px;
    display: grid; place-items: center; padding: 0;
    border: 1px solid rgba(23,63,53,.16); border-radius: 50%;
    background: var(--epg-forest); color: var(--epg-paper);
  }
  .epg-close:hover { background: #235447; }
  .epg-eyebrow {
    display: inline-flex; align-items: center; gap: 9px;
    font-size: 13px; line-height: 21px; font-weight: 700;
    letter-spacing: .09em; text-transform: uppercase;
  }
  .epg-eyebrow::before {
    content: ''; display: block; width: 23px; height: 3px;
    flex: 0 0 23px; background: currentColor; border-radius: 2px;
  }
  /* Initial opt-in remains available on first visit. */
  .epg-intro-prompt { padding: 23px 24px 26px; background: #173F35; color: #F7F6F2; }
  .epg-intro-prompt-top { display: flex; align-items: center; justify-content: space-between; gap: 15px; }
  .epg-intro-prompt .epg-close { background: rgba(255,255,255,.13); border-color: rgba(255,255,255,.25); }
  .epg-prompt-art { margin-top: 19px; border-radius: 13px; background: #D7DDCF; padding: 10px; }
  .epg-prompt-art img { display: block; width: 100%; height: 178px; object-fit: contain; }
  .epg-prompt-title { margin-top: 20px !important; font-size: 34px !important; line-height: 1.15 !important; color: #F7F6F2 !important; }
  .epg-prompt-desc { margin-top: 10px !important; font-size: 16px; line-height: 1.6; color: #E3EBE1; }
  .epg-prompt-actions { display: grid; gap: 10px; padding: 18px 24px 22px; }
  .epg-action { min-height: 47px; display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    padding: 10px 18px; border-radius: 11px; border: 1px solid transparent;
    font-size: 15px; line-height: 21px; font-weight: 650; text-decoration: none; }
  .epg-action--clay { background: #C86C42; color: #fffaf7; }
  .epg-action--clay:hover { background: #B65E37; }
  .epg-action--quiet { background: transparent; color: #173F35; }
  .epg-action--quiet:hover { background: #E8ECE3; }
  /* Clear, fixed header and chapter navigation. */
  .epg-header { flex-shrink: 0; background: #F7F6F2; border-bottom: 1px solid #D7DDCF; }
  .epg-header-main { display: flex; justify-content: space-between; align-items: center;
    gap: 16px; padding: 17px 26px 13px; }
  .epg-header-label { display: flex; align-items: center; gap: 13px; flex-wrap: wrap; }
  .epg-header .epg-eyebrow { color: #173F35; }
  .epg-chapter-count { color: #607268; font-size: 14px; line-height: 20px; font-weight: 500; }
  .epg-title { margin-top: 5px !important; font-size: 30px !important; line-height: 1.2 !important;
    color: #202421 !important; }
  .epg-tabs { display: flex; justify-content: space-between; gap: 10px; padding: 0 26px; }
  .epg-tab-group { display: flex; gap: 19px; }
  .epg-tab { min-height: 45px; padding: 9px 3px 10px; display: flex; align-items: center; gap: 8px;
    color: #526159; background: transparent; border: 0; border-bottom: 3px solid transparent;
    font-size: 15px; line-height: 20px; font-weight: 650; white-space: nowrap; }
  .epg-tab--active { color: #173F35; border-bottom-color: #C86C42; }
  .epg-tab-num { color: #C86C42; font-weight: 750; }
  .epg-scroll-hint { display: flex; align-items: center; gap: 7px;
    font-size: 14px; font-weight: 550; color: #53625A; }
  .epg-scroll-area { min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden;
    overscroll-behavior: contain; background: #F7F6F2;
    scrollbar-color: #94A99A #E9ECE5; scrollbar-width: auto;
    -webkit-overflow-scrolling: touch; touch-action: pan-y; }
  .epg-content { padding: 22px 26px 29px; }
  /* The feature uses Clay as a real surface, not just icon colour. */
  .epg-feature { display: grid; grid-template-columns: minmax(0,1.07fr) minmax(0,.93fr);
    min-height: 285px; overflow: hidden; border-radius: 16px; background: #C86C42; }
  .epg-feature-copy { display: flex; flex-direction: column; justify-content: center;
    padding: 31px 37px 30px; color: #FFF7F0; }
  .epg-feature-eyebrow { color: #FFF1E7; }
  .epg-feature h3 { margin-top: 15px !important; max-width: 470px;
    font-size: clamp(28px, 3vw, 38px) !important; line-height: 1.16 !important;
    color: #FFF9F5 !important; }
  .epg-feature-copy > p:not(.epg-eyebrow) { margin-top: 13px; max-width: 460px;
    color: #FFF3EB; font-size: 16px; line-height: 1.6; }
  .epg-feature-points { display: flex; flex-wrap: wrap; gap: 9px 15px; margin-top: 21px;
    padding-top: 15px; border-top: 1px solid rgba(255,255,255,.36); }
  .epg-feature-points span { display: inline-flex; align-items: center; gap: 6px;
    color: #FFFAF7; font-size: 14px; line-height: 20px; font-weight: 600; }
  .epg-feature-visual { display: grid; place-items: center; min-width: 0;
    padding: 13px 23px; background: #D7DDCF; }
  .epg-feature-visual img { display: block; width: 100%; max-width: 490px;
    height: 266px; object-fit: contain; }
  /* Editorial headings and only four meaningful, image-led step cards. */
  .epg-section-heading { display: flex; justify-content: space-between; align-items: end;
    gap: 15px; margin: 25px 0 16px; }
  .epg-section-heading .epg-eyebrow { color: #B25D38; }
  .epg-section-heading h3 { margin-top: 7px !important;
    font-size: 26px !important; line-height: 1.25 !important; color: #202421 !important; }
  .epg-section-side { max-width: 260px; font-size: 14px; line-height: 1.5; color: #526159; }
  .epg-step-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .epg-step { display: grid; grid-template-columns: minmax(0,1fr) minmax(150px,.77fr);
    min-height: 206px; min-width: 0; overflow: hidden; border-radius: 14px;
    background: #D7DDCF; }
  .epg-step--1 { background: #F0E1D6; }
  .epg-step--2 { background: #E5EADF; }
  .epg-step--3 { background: #173F35; }
  .epg-step-copy { display: flex; flex-direction: column; justify-content: center;
    min-width: 0; padding: 22px 4px 22px 23px; }
  .epg-step-number { font-size: 28px; line-height: 1; font-weight: 700;
    letter-spacing: -.04em; color: #AF572E; }
  .epg-step--3 .epg-step-number { color: #F2AB86; }
  .epg-step h4 { margin-top: 12px !important; font-size: 20px !important;
    line-height: 1.3 !important; color: #173F35 !important; }
  .epg-step--3 h4 { color: #F7F6F2 !important; }
  .epg-step-description { margin-top: 7px !important; color: #43574B;
    font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }
  .epg-step--3 .epg-step-description { color: #E4EEE5; }
  .epg-step-visual { display: flex; align-items: center; justify-content: center;
    min-width: 0; padding: 12px 11px 12px 0; }
  .epg-step-visual img { display: block; width: 100%; height: 178px; object-fit: contain; }
  .epg-section-divider { height: 1px; margin: 31px 0; background: #C7D0C6; }
  /* Chapter two mixes a sage editorial section with restrained benefit rows. */
  .epg-why-intro { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,.74fr);
    overflow: hidden; border-radius: 15px; background: #D7DDCF; }
  .epg-why-copy { display: flex; flex-direction: column; justify-content: center;
    padding: 31px 34px; }
  .epg-why-copy .epg-eyebrow { color: #A6532E; }
  .epg-why-copy h3 { max-width: 515px; margin-top: 15px !important;
    font-size: 34px !important; line-height: 1.2 !important; color: #173F35 !important; }
  .epg-why-copy > p:not(.epg-eyebrow) { margin-top: 12px;
    font-size: 16px; line-height: 1.6; color: #3F5147; }
  .epg-why-visual { display: grid; place-items: center; background: #EFE3D8; padding: 15px 22px; }
  .epg-why-visual img { display: block; max-width: 100%; width: 355px;
    height: 220px; object-fit: contain; }
  .epg-benefits-heading { margin: 25px 0 14px; }
  .epg-benefits-heading h3 { font-size: 25px !important; line-height: 1.3 !important; color: #202421 !important; }
  .epg-benefits { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0 24px; }
  .epg-benefit { display: grid; grid-template-columns: 122px minmax(0,1fr);
    min-width: 0; gap: 16px; padding: 17px 3px; border-bottom: 1px solid #C8D1C7; }
  .epg-benefit:first-child { grid-column: 1 / -1; display: grid;
    grid-template-columns: 230px minmax(0,1fr); gap: 24px;
    border: 0; border-radius: 14px; padding: 15px 20px; margin-bottom: 5px;
    background: #EAEDE5; }
  .epg-benefit-art { display: grid; place-items: center; align-self: center;
    height: 120px; min-width: 0; overflow: hidden; border-radius: 10px;
    background: #E8D9CD; }
  .epg-benefit:first-child .epg-benefit-art { height: 169px; background: #D7DDCF; }
  .epg-benefit:nth-child(3n) .epg-benefit-art { background: #D7DDCF; }
  .epg-benefit-art img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .epg-benefit-copy { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  .epg-benefit h4 { display: flex; align-items: center; gap: 8px;
    font-size: 18px !important; line-height: 1.35 !important; color: #173F35 !important; }
  .epg-benefit h4 svg { flex: 0 0 auto; color: #C86C42; }
  .epg-benefit-description { margin-top: 8px !important; font-size: 15px;
    line-height: 1.6; color: #4D5B52; }
  .epg-start { display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 21px; margin-top: 29px; padding: 25px 27px;
    border-radius: 15px; background: #173F35; color: #F7F6F2; }
  .epg-start h3 { font-size: 24px !important; line-height: 1.25 !important; color: #F7F6F2 !important; }
  .epg-start p { margin-top: 6px !important; font-size: 15px; line-height: 1.5; color: #DCE9DD; }
  .epg-start-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .epg-start .epg-action--clay { background: #C86C42; color: #fff; }
  .epg-start .epg-action--outline { border-color: rgba(255,255,255,.54);
    background: transparent; color: #fff; }
  .epg-start .epg-action--outline:hover { background: rgba(255,255,255,.10); }
  /* Persistent navigation proves that the scrollable guide has more content. */
  .epg-footer { display: flex; flex-shrink: 0; align-items: center;
    justify-content: space-between; gap: 13px; min-height: 75px;
    padding: 12px 26px; border-top: 1px solid #CED7CB;
    background: #EEF0E8; }
  .epg-footer-status { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .epg-footer-icon { width: 39px; height: 39px; flex: 0 0 39px;
    display: grid; place-items: center; border-radius: 50%;
    background: #D7DDCF; color: #173F35; }
  .epg-footer-title { font-size: 15px; line-height: 21px;
    font-weight: 650; color: #173F35; }
  .epg-footer-sub { margin-top: 2px !important; color: #607268;
    font-size: 13px; line-height: 18px; }
  .epg-footer-button { display: inline-flex; align-items: center; justify-content: center;
    gap: 9px; min-height: 45px; padding: 10px 18px;
    border: 0; border-radius: 10px; background: #173F35; color: #fff;
    font-size: 15px; line-height: 20px; font-weight: 650; white-space: nowrap; }
  .epg-footer-button:hover { background: #235447; }
  @media (max-width: 900px) {
    .epg-feature-copy { padding: 25px; }
    .epg-feature-visual img { height: 240px; }
    .epg-step { grid-template-columns: minmax(0,1fr) minmax(115px,.76fr); }
    .epg-step-copy { padding: 18px 1px 18px 18px; }
    .epg-step-visual img { height: 145px; }
    .epg-benefit { grid-template-columns: 105px minmax(0,1fr); gap: 11px; }
  }
  @media (max-width: 700px) {
    .epg-overlay { padding: 0; align-items: stretch; }
    .epg-shell { width: 100%; height: 100svh; max-height: none;
      border-radius: 0; border: 0; }
    .epg-shell--prompt { width: min(430px, 94vw); height: auto;
      margin: auto; border-radius: 17px; }
    .epg-header-main { padding: 13px 16px 11px; }
    .epg-title { font-size: 25px !important; }
    .epg-header-label { gap: 9px; }
    .epg-chapter-count { font-size: 13px; }
    .epg-close { width: 42px; height: 42px; flex-basis: 42px; }
    .epg-tabs { padding: 0 16px; }
    .epg-tab-group { gap: 16px; }
    .epg-tab { font-size: 14px; min-height: 42px; }
    .epg-scroll-hint { display: none; }
    .epg-content { padding: 15px 15px 24px; }
    .epg-feature { grid-template-columns: minmax(0,1fr); }
    .epg-feature-copy { padding: 22px 21px 21px; }
    .epg-feature h3 { margin-top: 10px !important; font-size: 28px !important; }
    .epg-feature-copy > p:not(.epg-eyebrow) { font-size: 15px; margin-top: 8px; }
    .epg-feature-points { margin-top: 14px; padding-top: 11px; }
    .epg-feature-visual { padding: 8px 12px; }
    .epg-feature-visual img { height: 186px; }
    .epg-section-heading { align-items: start; margin: 21px 0 12px; }
    .epg-section-heading h3 { font-size: 23px !important; }
    .epg-section-side { display: none; }
    .epg-step-grid { grid-template-columns: 1fr; gap: 11px; }
    .epg-step { grid-template-columns: minmax(0,1fr) minmax(125px,.65fr);
      min-height: 172px; }
    .epg-step-copy { padding: 17px 2px 17px 18px; }
    .epg-step-number { font-size: 23px; }
    .epg-step h4 { margin-top: 8px !important; font-size: 18px !important; }
    .epg-step-description { font-size: 14px; margin-top: 5px !important; }
    .epg-step-visual img { height: 151px; }
    .epg-section-divider { margin: 23px 0; }
    .epg-why-intro { grid-template-columns: 1fr; }
    .epg-why-copy { padding: 22px 21px; }
    .epg-why-copy h3 { margin-top: 10px !important; font-size: 27px !important; }
    .epg-why-copy > p:not(.epg-eyebrow) { font-size: 15px; margin-top: 9px; }
    .epg-why-visual img { height: 176px; }
    .epg-benefits-heading { margin: 22px 0 11px; }
    .epg-benefits-heading h3 { font-size: 23px !important; }
    .epg-benefits { grid-template-columns: 1fr; }
    .epg-benefit { grid-template-columns: 107px minmax(0,1fr); gap: 13px; padding: 13px 0; }
    .epg-benefit:first-child { grid-column: auto; grid-template-columns: 107px minmax(0,1fr);
      gap: 13px; padding: 13px; }
    .epg-benefit:first-child .epg-benefit-art { height: 110px; }
    .epg-benefit-art { height: 105px; }
    .epg-benefit h4 { font-size: 17px !important; }
    .epg-benefit-description { font-size: 14px; margin-top: 5px !important; }
    .epg-start { margin-top: 22px; padding: 20px; }
    .epg-start h3 { font-size: 22px !important; }
    .epg-footer { padding: 11px 14px; min-height: 67px; }
    .epg-footer-button { padding: 10px 13px; font-size: 14px; }
    .epg-footer-sub { display: none; }
  }
  @media (max-width: 380px) {
    .epg-header .epg-eyebrow { font-size: 12px; }
    .epg-chapter-count { display: none; }
    .epg-tab { font-size: 13px; }
    .epg-step { grid-template-columns: minmax(0,1fr) 120px; }
    .epg-step-copy { padding-left: 14px; }
    .epg-step-visual img { height: 125px; }
    .epg-footer-icon { display: none; }
    .epg-footer-title { font-size: 14px; }
    .epg-footer-button { font-size: 13px; min-height: 43px; padding-inline: 11px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .epg-root *, .epg-root *::before, .epg-root *::after {
      animation: none !important; transition: none !important;
      scroll-behavior: auto !important;
    }
  }
`;

function initialGuideMode() {
  if (typeof window === "undefined") return "closed";
  try {
    return window.localStorage.getItem(GUIDE_SHOWN_KEY) ? "closed" : "prompt";
  } catch {
    return "prompt";
  }
}

export default function HowEpantryGuidePopup() {
  const [mode, setMode] = useState(initialGuideMode);
  const [activeChapter, setActiveChapter] = useState("how");
  const [atEnd, setAtEnd] = useState(false);
  const [guideLabelIndex, setGuideLabelIndex] = useState(0);
  const [isOverFeaturedCards, setIsOverFeaturedCards] = useState(false);
  const guideScrollRef = useRef(null);
  const dialogRef = useRef(null);
  const infoRef = useRef(null);
  const whySectionRef = useRef(null);
  const previouslyOpenRef = useRef(false);
  const open = mode !== "closed";
  const expanded = mode === "expanded";

  useEffect(() => {
    if (open) return undefined;
    const timer = window.setInterval(() => {
      setGuideLabelIndex((current) => (current + 1) % GUIDE_TRIGGER_LABELS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open]);

  // Check the FRONTMOST content, not just IntersectionObserver visibility.
  // Sticky galleries remain intersecting while a following full-screen hero
  // slides over them, so intersection alone makes the Guide compact on heroes.
  useEffect(() => {
    let frameId = null;
    const checkVisibleCards = () => {
      frameId = null;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const samples = [
        [0.5, 0.58],
        [0.25, 0.58],
        [0.75, 0.58],
      ];
      const cardGalleryIsFrontmost = samples.some(([x, y]) => {
        const frontmost = document.elementFromPoint(width * x, height * y);
        return Boolean(frontmost?.closest?.(
          '.ep-landing-grocery-gallery, .ep-recipe-showcase'
        ));
      });
      setIsOverFeaturedCards((current) =>
        current === cardGalleryIsFrontmost ? current : cardGalleryIsFrontmost
      );
    };
    const scheduleCheck = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(checkVisibleCards);
    };

    scheduleCheck();
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('resize', scheduleCheck);
    window.addEventListener('pageshow', scheduleCheck);
    return () => {
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('resize', scheduleCheck);
      window.removeEventListener('pageshow', scheduleCheck);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (mode !== "prompt") return;
    try {
      window.localStorage.setItem(GUIDE_SHOWN_KEY, "1");
    } catch {
      // Preserve the guide even if storage is disabled.
    }
  }, [mode]);

  useEffect(() => {
    if (!open) {
      if (previouslyOpenRef.current) infoRef.current?.focus();
      previouslyOpenRef.current = false;
      return undefined;
    }

    previouslyOpenRef.current = true;
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    const focusedBeforeOpening = document.activeElement;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMode("closed");
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const selector =
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(
        dialogRef.current.querySelectorAll(selector)
      ).filter(
        (node) => node.getClientRects().length && !node.closest('[aria-hidden="true"]')
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.querySelector("[data-guide-close]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      if (focusedBeforeOpening?.isConnected) focusedBeforeOpening.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!expanded) return;
    guideScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setActiveChapter("how");
    setAtEnd(false);
  }, [expanded]);

  const updateGuidePosition = () => {
    const scroller = guideScrollRef.current;
    if (!scroller) return;
    const remaining = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    setAtEnd(remaining <= 16);
    const why = whySectionRef.current;
    if (why) {
      const distance =
        why.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      setActiveChapter(distance <= scroller.clientHeight * .38 ? "why" : "how");
    }
  };

  const goToGuideChapter = (chapter) => {
    const scroller = guideScrollRef.current;
    if (!scroller) return;
    const section = scroller.querySelector(`[data-landing-story="${chapter}"]`);
    if (!section) return;
    const top =
      scroller.scrollTop + section.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top;
    // Always immediate; the user requested no guide scroll animation.
    scroller.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    setActiveChapter(chapter);
    updateGuidePosition();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <style>{GUIDE_STYLES}</style>
      {!open && (
        <div className="epg-root">
          <button
            ref={infoRef}
            type="button"
            onClick={() => setMode("expanded")}
            aria-label="Open EPANTRY guide"
            title="Open EPANTRY guide"
            className={`epg-trigger${isOverFeaturedCards ? ' epg-trigger--card-compact' : ''}`}
          >
            <span className="epg-trigger-icon"><Info size={19} strokeWidth={2} aria-hidden="true" /></span>
            <span key={guideLabelIndex} className="epg-trigger-label" aria-hidden="true">{GUIDE_TRIGGER_LABELS[guideLabelIndex]}</span>
            <ArrowRight size={17} className="epg-trigger-arrow" aria-hidden="true" />
          </button>
        </div>
      )}
      {open && (
        <div
          className="epg-root epg-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMode("closed");
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="epantry-guide-title"
            className={`epg-shell${expanded ? "" : " epg-shell--prompt"}`}
          >
            {!expanded ? (
              <>
                <div className="epg-intro-prompt">
                  <div className="epg-intro-prompt-top">
                    <span className="epg-eyebrow" style={{ color: "#F4D2BF" }}>EPANTRY guide</span>
                    <button
                      data-guide-close type="button" onClick={() => setMode("closed")}
                      aria-label="Close EPANTRY guide" className="epg-close"
                    ><X size={20} aria-hidden="true" /></button>
                  </div>
                  <div className="epg-prompt-art">
                    <img src="/exploar/One food journey.png" alt="Recipes, groceries and pantry ingredients connected in one food journey" />
                  </div>
                  <h2 id="epantry-guide-title" className="epg-prompt-title">A better way to food.</h2>
                  <p className="epg-prompt-desc">Discover, understand, shop and cook. See how EPANTRY brings it together.</p>
                </div>
                <div className="epg-prompt-actions">
                  <button type="button" onClick={() => setMode("expanded")} className="epg-action epg-action--clay">
                    Explore the guide <ArrowRight size={18} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setMode("closed")} className="epg-action epg-action--quiet">Maybe later</button>
                </div>
              </>
            ) : (
              <>
                <header className="epg-header">
                  <div className="epg-header-main">
                    <div>
                      <div className="epg-header-label">
                        <p className="epg-eyebrow">EPANTRY guide</p>
                        <span className="epg-chapter-count">Two chapters, one food journey</span>
                      </div>
                      <h2 id="epantry-guide-title" className="epg-title">Your food journey</h2>
                    </div>
                    <button
                      data-guide-close type="button" onClick={() => setMode("closed")}
                      aria-label="Close EPANTRY guide" className="epg-close"
                    ><X size={21} aria-hidden="true" /></button>
                  </div>
                  <nav className="epg-tabs" aria-label="Guide chapters">
                    <div className="epg-tab-group">
                      <button
                        type="button" onClick={() => goToGuideChapter("how")}
                        aria-current={activeChapter === "how" ? "step" : undefined}
                        className={`epg-tab${activeChapter === "how" ? " epg-tab--active" : ""}`}
                      ><span className="epg-tab-num">01</span> How it works</button>
                      <button
                        type="button" onClick={() => goToGuideChapter("why")}
                        aria-current={activeChapter === "why" ? "step" : undefined}
                        className={`epg-tab${activeChapter === "why" ? " epg-tab--active" : ""}`}
                      ><span className="epg-tab-num">02</span> Why EPANTRY</button>
                    </div>
                    <span className="epg-scroll-hint"><ArrowDown size={17} aria-hidden="true" /> Scroll inside this guide</span>
                  </nav>
                </header>

                <div
                  ref={guideScrollRef} onScroll={updateGuidePosition} tabIndex={0}
                  role="region" aria-label="EPANTRY guide content. Scroll to read both chapters."
                  className="epg-scroll-area"
                >
                  <div className="epg-content">
                    <section data-landing-story="how" aria-labelledby="guide-how-title">
                      <div className="epg-feature">
                        <div className="epg-feature-copy">
                          <p className="epg-eyebrow epg-feature-eyebrow">01 / How it works</p>
                          <h3 id="guide-how-title">A little easier, from food to table.</h3>
                          <p>Find a recipe, understand its ingredients and shop for what you need—in one connected journey.</p>
                          <div className="epg-feature-points" aria-label="Food journey stages">
                            <span><Check size={15} aria-hidden="true" /> Discover</span>
                            <span><Check size={15} aria-hidden="true" /> Understand</span>
                            <span><Check size={15} aria-hidden="true" /> Shop</span>
                            <span><Check size={15} aria-hidden="true" /> Cook</span>
                          </div>
                        </div>
                        <div className="epg-feature-visual">
                          <img
                            src="/exploar/One food journey.png"
                            alt="Illustration of recipes, groceries, pantry and cooking connected"
                            decoding="async"
                          />
                        </div>
                      </div>

                      <div className="epg-section-heading">
                        <div>
                          <p className="epg-eyebrow">The journey</p>
                          <h3>Four simple steps</h3>
                        </div>
                        <p className="epg-section-side">Everything you need, without jumping between different experiences.</p>
                      </div>
                      <div className="epg-step-grid">
                        {landingJourneySteps.map((step, index) => (
                          <article key={step.id} className={`epg-step epg-step--${index}`}>
                            <div className="epg-step-copy">
                              <span className="epg-step-number">{step.step}</span>
                              <h4>{step.title}</h4>
                              <p className="epg-step-description">{step.description}</p>
                            </div>
                            <div className="epg-step-visual">
                              <img
                                src={STEP_ART_BY_ID[step.id]}
                                alt={`${step.title} illustration`}
                                loading="lazy" decoding="async"
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <div className="epg-section-divider" aria-hidden="true" />

                    <section
                      ref={whySectionRef} data-landing-story="why"
                      aria-labelledby="guide-why-title"
                    >
                      <div className="epg-why-intro">
                        <div className="epg-why-copy">
                          <p className="epg-eyebrow">02 / Why EPANTRY</p>
                          <h3 id="guide-why-title">Good food, fewer loose ends.</h3>
                          <p>Recipes, product details, your pantry and shopping work better when they feel connected.</p>
                        </div>
                        <div className="epg-why-visual">
                          <img src="/exploar/One food journey.png" alt="Connected food journey illustration" loading="lazy" decoding="async" />
                        </div>
                      </div>
                      <div className="epg-benefits-heading">
                        <h3>Designed for everyday decisions</h3>
                      </div>
                      <div className="epg-benefits">
                        {WHY_BENEFITS.map((benefit) => {
                          const BenefitIcon = benefit.icon || BookOpenText;
                          return (
                            <article key={benefit.id} className="epg-benefit">
                              <div className="epg-benefit-art">
                                <img src={BENEFIT_ART_BY_ID[benefit.id]} alt={`${benefit.title} illustration`} loading="lazy" decoding="async" />
                              </div>
                              <div className="epg-benefit-copy">
                                <h4><BenefitIcon size={19} strokeWidth={1.8} aria-hidden="true" /> {benefit.title}</h4>
                                <p className="epg-benefit-description">{benefit.description}</p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>

                    <div className="epg-start">
                      <div>
                        <h3>What will you cook next?</h3>
                        <p>Explore recipes or find the groceries you need.</p>
                      </div>
                      <div className="epg-start-actions">
                        <Link to="/recipes" onClick={() => setMode("closed")} className="epg-action epg-action--clay">
                          Explore recipes <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                        <Link to="/grocery" onClick={() => setMode("closed")} className="epg-action epg-action--outline">
                          Explore grocery
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="epg-footer">
                  <div className="epg-footer-status">
                    <span className="epg-footer-icon">
                      {atEnd ? <ArrowUp size={19} aria-hidden="true" /> : <ArrowDown size={19} aria-hidden="true" />}
                    </span>
                    <div>
                      <p className="epg-footer-title">{atEnd ? "You've reached the end" : "Scroll down for more"}</p>
                      <p className="epg-footer-sub">{activeChapter === "how" ? "01 of 02 · How it works" : "02 of 02 · Why EPANTRY"}</p>
                    </div>
                  </div>
                  <button
                    type="button" className="epg-footer-button"
                    onClick={() => goToGuideChapter(activeChapter === "how" ? "why" : "how")}
                  >
                    {activeChapter === "how" ? "Next: Why EPANTRY" : "Back to start"}
                    {activeChapter === "how" ? <ArrowDown size={17} aria-hidden="true" /> : <ArrowUp size={17} aria-hidden="true" />}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </>,
    document.body
  );
}
