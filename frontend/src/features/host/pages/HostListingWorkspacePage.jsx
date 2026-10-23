import { ArrowRight, BookOpen, Boxes, ChefHat, MapPinned, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../auth/context/AuthContext'
import {
  getHostListingEntryOptions,
  getHostWorkspaceLabel,
} from '../hostWorkspace.config'

// Keep the existing account-based choices and their destinations unchanged.
const unifiedTypes = {
  grocery: 'grocery',
  'brand-recipe': 'brand_recipe',
  'kitchen-recipe': 'kitchen_recipe',
  'ready-made': 'prepared_food',
}

const listingContent = {
  grocery: {
    title: 'Grocery & packaged products',
    description: 'Add groceries or packaged foods, with photos and details customers can trust.',
    action: 'Add product',
    icon: Boxes,
    tone: 'forest',
  },
  'brand-recipe': {
    title: 'Brand recipes',
    description: 'Share your recipe, ingredients and cooking steps in one place.',
    action: 'Add recipe',
    icon: BookOpen,
    tone: 'clay',
  },
  'kitchen-recipe': {
    title: 'Kitchen recipes, drinks & desserts',
    description: 'Showcase dishes, drinks, sweets and bakes from your kitchen.',
    action: 'Add recipe',
    icon: ChefHat,
    tone: 'forest',
  },
  'ready-made': {
    title: 'Ready-to-eat food & menu items',
    description: 'Put prepared food and menu favourites on your storefront.',
    action: 'Add menu item',
    icon: Store,
    tone: 'clay',
  },
  offers: {
    title: 'Prices, stock & delivery areas',
    description: 'Keep prices, available stock and serviceable pincodes up to date.',
    action: 'Manage selling',
    icon: MapPinned,
    tone: 'forest',
  },
}

const creationSteps = [
  { number: '01', label: 'Choose a type' },
  { number: '02', label: 'Add the details' },
  { number: '03', label: 'Send for review' },
]

export default function HostListingWorkspacePage() {
  const { currentUser } = useAuth()
  const options = getHostListingEntryOptions(currentUser)
  const workspaceLabel = getHostWorkspaceLabel(currentUser)
  const visibleWorkspaceLabel = workspaceLabel === 'Legacy Host'
    ? 'Host workspace'
    : `${workspaceLabel} workspace`

  return (
    <main className="hls-page">
      <style>{`
        .hls-page {
          --hls-porcelain: #F7F6F2;
          --hls-forest: #173F35;
          --hls-clay: #C86C42;
          --hls-sage: #D7DDCF;
          --hls-charcoal: #202421;
          width: 100%;
          min-width: 0;
          max-width: none;
          min-height: calc(100svh - 160px);
          margin: 0;
          padding: 14px clamp(14px, 1.65vw, 28px) 18px;
          display: flex;
          background: var(--hls-porcelain);
          color: var(--hls-charcoal);
          font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
        }
        .hls-page *, .hls-page *::before, .hls-page *::after { box-sizing: border-box; }
        .hls-page a { text-decoration: none; }
        .hls-page a:focus-visible { outline: 3px solid var(--hls-clay); outline-offset: 3px; }
        .hls-content { width: 100%; min-width: 0; max-width: none; flex: 1; display: flex; flex-direction: column; }
        .hls-breadcrumb { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 0 0 12px; color: #607066; font-size: 14px; line-height: 1.4; }
        .hls-breadcrumb a { color: var(--hls-forest); font-weight: 750; }
        .hls-breadcrumb a:hover { text-decoration: underline; }

        /* Warm editorial introduction, rather than a heavy dark banner. */
        .hls-intro { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(290px, .75fr); overflow: hidden; border-radius: 12px; min-width: 0; }
        .hls-intro-main { position: relative; min-width: 0; padding: 24px clamp(24px, 2.3vw, 40px) 22px; overflow: hidden; background: #F3DDCF; }
        .hls-intro-main::before { content: ''; position: absolute; right: -40px; bottom: -115px; width: 230px; height: 230px; border: 1px solid rgba(173,81,45,.19); border-radius: 50%; pointer-events: none; }
        .hls-intro-main::after { content: ''; position: absolute; right: -75px; bottom: -140px; width: 270px; height: 270px; border: 1px solid rgba(173,81,45,.13); border-radius: 50%; pointer-events: none; }
        .hls-eyebrow { position: relative; z-index: 1; display: flex; align-items: center; gap: 11px; margin: 0 0 9px; color: #934625; font-size: 14px; font-weight: 800; letter-spacing: .035em; }
        .hls-eyebrow::before { content: ''; display: block; width: 26px; height: 3px; background: var(--hls-clay); border-radius: 4px; }
        .hls-page .hls-intro-title { position: relative; z-index: 1; margin: 0 0 7px; color: var(--hls-forest); font-size: clamp(32px, 2.8vw, 42px) !important; font-weight: 800 !important; line-height: 1.12 !important; letter-spacing: -.045em; }
        .hls-intro-description { position: relative; z-index: 1; margin: 0; max-width: 720px; color: #47584B; font-size: 16px; line-height: 1.52; }
        .hls-intro-aside { position: relative; min-width: 0; display: flex; flex-direction: column; justify-content: center; padding: 20px clamp(22px, 2vw, 35px); background: var(--hls-forest); color: #F7F6F2; }
        .hls-process-title { margin: 0 0 7px; color: #F1BEA5; font-size: 14px; line-height: 1.3; font-weight: 800; }
        .hls-process { padding: 0; margin: 0; list-style: none; }
        .hls-process li { display: flex; gap: 13px; align-items: center; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.20); font-size: 15px; line-height: 1.45; font-weight: 600; color: #EFF1E9; }
        .hls-process li:last-child { border-bottom: 0; }
        .hls-process-index { flex: 0 0 25px; color: #E6A17B; font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }

        /* A single editorial list. Every choice stays vertically stacked. */
        .hls-selection { margin-top: 19px; flex: 1; display: flex; min-height: 0; flex-direction: column; }
        .hls-selection-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; margin-bottom: 11px; }
        .hls-page .hls-section-title { margin: 0 0 3px; color: var(--hls-charcoal); font-size: clamp(25px, 2vw, 30px) !important; line-height: 1.2 !important; font-weight: 800 !important; letter-spacing: -.035em; }
        .hls-section-subtitle { margin: 0; font-size: 15px; line-height: 1.45; color: #617066; }
        .hls-count { display: inline-flex; align-items: baseline; gap: 7px; color: #57695B; font-size: 14px; font-weight: 700; white-space: nowrap; }
        .hls-count strong { font-size: 25px; line-height: 1; font-weight: 800; color: var(--hls-clay); font-variant-numeric: tabular-nums; }
        .hls-list { flex: 1; min-width: 0; display: flex; flex-direction: column; border-top: 2px solid var(--hls-forest); border-bottom: 1px solid #D4DAD0; }
        .hls-item {
          --hls-item-icon: var(--hls-forest);
          --hls-item-icon-bg: var(--hls-sage);
          display: grid;
          grid-template-columns: 48px 66px minmax(0, 1fr) auto;
          gap: clamp(12px, 1.3vw, 20px);
          align-items: center;
          width: 100%;
          min-height: 94px;
          flex: 1 0 auto;
          min-width: 0;
          padding: 14px clamp(18px, 2vw, 32px);
          color: var(--hls-charcoal);
          border-bottom: 1px solid #DEE1D9;
          background: #F7F6F2;
          transition: background-color .16s ease;
        }
        .hls-item:last-child { border-bottom: 0; }
        .hls-item:nth-child(even) { background: #F1F0EB; }
        .hls-item[data-tone='clay'] { --hls-item-icon: #9E4C2C; --hls-item-icon-bg: #F2DCCD; }
        .hls-item:hover, .hls-item:focus-visible { background: #E7EBE2; }
        .hls-item[data-tone='clay']:hover, .hls-item[data-tone='clay']:focus-visible { background: #F8E7DB; }
        .hls-index { align-self: center; font-size: 24px; font-weight: 700; letter-spacing: -.055em; color: #BBC5B6; font-variant-numeric: tabular-nums; }
        .hls-item[data-tone='clay'] .hls-index { color: #DEC4B5; }
        .hls-item-icon { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 14px; background: var(--hls-item-icon-bg); color: var(--hls-item-icon); }
        .hls-item-icon svg { width: 27px; height: 27px; stroke-width: 1.8; }
        .hls-item-copy { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
        .hls-item-title { color: var(--hls-charcoal); font-size: 19px; font-weight: 800; line-height: 1.32; letter-spacing: -.025em; }
        .hls-item-description { color: #5A695E; font-size: 15px; line-height: 1.4; font-weight: 450; }
        .hls-action { display: flex; align-items: center; gap: 16px; min-width: 0; color: var(--hls-forest); font-size: 15px; line-height: 1.35; font-weight: 800; white-space: nowrap; }
        .hls-item[data-tone='clay'] .hls-action { color: #9B4D2C; }
        .hls-action-circle { display: grid; place-items: center; width: 41px; height: 41px; border-radius: 50%; background: var(--hls-forest); color: #FFF9F4; transition: transform .16s ease, background-color .16s ease; }
        .hls-item[data-tone='clay'] .hls-action-circle { background: var(--hls-clay); }
        .hls-action-circle svg { width: 20px; height: 20px; }
        .hls-item:hover .hls-action-circle { transform: translateX(3px); }

        /* Integrated guidance bar closes the layout without empty placeholder sections. */
        .hls-footer { display: grid; grid-template-columns: 1fr 1fr; margin-top: 16px; min-width: 0; border-radius: 10px; overflow: hidden; }
        .hls-footer-part { display: flex; align-items: center; gap: 14px; padding: 15px clamp(17px, 2vw, 30px); min-width: 0; background: var(--hls-sage); }
        .hls-footer-part + .hls-footer-part { background: #F1DCCC; }
        .hls-footer-icon { color: var(--hls-forest); flex: 0 0 auto; }
        .hls-footer-part + .hls-footer-part .hls-footer-icon { color: #A45130; }
        .hls-footer-icon svg { width: 27px; height: 27px; stroke-width: 1.75; }
        .hls-footer-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .hls-footer-title { color: var(--hls-forest); font-weight: 800; font-size: 15px; line-height: 1.3; }
        .hls-footer-part + .hls-footer-part .hls-footer-title { color: #874428; }
        .hls-footer-description { color: #4F5E52; font-size: 14px; line-height: 1.4; }
        .hls-footer-part + .hls-footer-part .hls-footer-description { color: #705042; }

        @media (max-width: 950px) {
          .hls-intro { grid-template-columns: minmax(0, 1.15fr) minmax(235px, .85fr); }
          .hls-intro-main { padding: 24px 25px; }
          .hls-item { grid-template-columns: 34px 58px minmax(0, 1fr) auto; gap: 13px; }
          .hls-item-icon { width: 54px; height: 54px; }
          .hls-action-label { display: none; }
        }
        @media (max-width: 700px) {
          .hls-page { min-height: 0; padding: 13px 12px 25px; }
          .hls-breadcrumb { margin-bottom: 11px; }
          .hls-intro { grid-template-columns: 1fr; }
          .hls-intro-main { padding: 22px 21px 20px; }
          .hls-page .hls-intro-title { font-size: 30px !important; }
          .hls-intro-description { font-size: 15px; }
          .hls-intro-aside { padding: 16px 20px 19px; }
          .hls-process { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          .hls-process li { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 4px 0 8px; border-bottom: 1px solid rgba(255,255,255,.25); font-size: 13px; line-height: 1.35; }
          .hls-process-index { flex: 0 0 auto; }
          .hls-selection { margin-top: 22px; }
          .hls-section-subtitle { font-size: 14px; }
          .hls-page .hls-section-title { font-size: 26px !important; }
          .hls-count { font-size: 12px; }
          .hls-count strong { font-size: 20px; }
          .hls-item { flex: 0 0 auto; min-height: 93px; grid-template-columns: 48px minmax(0, 1fr) 37px; padding: 15px 13px; gap: 12px; }
          .hls-index { display: none; }
          .hls-item-icon { width: 47px; height: 47px; border-radius: 11px; }
          .hls-item-icon svg { width: 23px; height: 23px; }
          .hls-item-title { font-size: 16px; line-height: 1.3; }
          .hls-item-description { font-size: 14px; line-height: 1.42; }
          .hls-action { gap: 0; }
          .hls-action-circle { width: 34px; height: 34px; }
          .hls-action-circle svg { width: 18px; height: 18px; }
          .hls-footer { grid-template-columns: 1fr; margin-top: 18px; }
          .hls-footer-part { padding: 16px 17px; }
        }
        @media (max-width: 360px) {
          .hls-selection-heading { align-items: flex-start; }
          .hls-count { display: none; }
          .hls-item { grid-template-columns: 43px minmax(0, 1fr) 30px; gap: 10px; padding: 13px 10px; }
          .hls-item-icon { width: 42px; height: 42px; }
          .hls-action-circle { width: 30px; height: 30px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hls-page *, .hls-page *::before, .hls-page *::after { transition: none !important; }
        }
      `}</style>

      <div className="hls-content">
        <nav className="hls-breadcrumb" aria-label="Breadcrumb">
          <Link to="/host/operations">Host Dashboard</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Create listing</span>
        </nav>

        <header className="hls-intro">
          <div className="hls-intro-main">
            <p className="hls-eyebrow">Your catalog, your way</p>
            <h1 className="hls-intro-title">Create a listing</h1>
            <p className="hls-intro-description">Choose what you'd like to share. We'll take you to the right form for your products, recipes or menu items.</p>
          </div>
          <div className="hls-intro-aside">
            <p className="hls-process-title">Your next three steps · {visibleWorkspaceLabel}</p>
            <ol className="hls-process">
              {creationSteps.map((step) => (
                <li key={step.number}>
                  <span className="hls-process-index">{step.number}</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </header>

        <section className="hls-selection" aria-labelledby="hls-choice-title">
          <div className="hls-selection-heading">
            <div>
              <h2 id="hls-choice-title" className="hls-section-title">What are you adding?</h2>
              <p className="hls-section-subtitle">Choose an option to open its form.</p>
            </div>
            <span className="hls-count"><strong>{String(options.length).padStart(2, '0')}</strong> available options</span>
          </div>

          <div className="hls-list" aria-label="Available listing types">
            {options.map((option, index) => {
              const details = listingContent[option.id] || {
                title: option.label,
                description: option.description,
                action: 'Continue',
                icon: Boxes,
                tone: 'forest',
              }
              const Icon = details.icon
              const destination = unifiedTypes[option.id]
                ? `/host/listings/new?type=${unifiedTypes[option.id]}`
                : option.to

              return (
                <Link className="hls-item" data-tone={details.tone} key={option.id} to={destination}>
                  <span className="hls-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="hls-item-icon"><Icon aria-hidden="true" /></span>
                  <span className="hls-item-copy">
                    <span className="hls-item-title">{details.title}</span>
                    <span className="hls-item-description">{details.description}</span>
                  </span>
                  <span className="hls-action" aria-hidden="true">
                    <span className="hls-action-label">{details.action}</span>
                    <span className="hls-action-circle"><ArrowRight /></span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="hls-footer" aria-label="Good to know">
          <div className="hls-footer-part">
            <span className="hls-footer-icon"><ShieldCheck aria-hidden="true" /></span>
            <span className="hls-footer-copy">
              <span className="hls-footer-title">Reviewed before publishing</span>
              <span className="hls-footer-description">Super Admin approval is required before a new listing goes live.</span>
            </span>
          </div>
          <div className="hls-footer-part">
            <span className="hls-footer-icon"><MapPinned aria-hidden="true" /></span>
            <span className="hls-footer-copy">
              <span className="hls-footer-title">Delivery is in your hands</span>
              <span className="hls-footer-description">Manage prices, stock and delivery pincodes in your selling tools.</span>
            </span>
          </div>
        </section>
      </div>
    </main>
  )
}
