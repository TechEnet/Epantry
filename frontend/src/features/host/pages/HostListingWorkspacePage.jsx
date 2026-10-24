import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Boxes, ChefHat, MapPinned, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../auth/context/AuthContext'
import { getHostListingEntryOptions, getHostWorkspaceLabel, normalizeHostWorkspaceType } from '../hostWorkspace.config'

// Keep account-specific options and the original listing routes unchanged.
const unifiedTypes = {
  grocery: 'grocery',
  'brand-recipe': 'brand_recipe',
  'kitchen-recipe': 'kitchen_recipe',
  'ready-made': 'prepared_food',
  'hybrid-recipe': 'kitchen_recipe',
}

const listingDetails = {
  'hybrid-recipe': {
    title: 'Recipe',
    description: 'Share breakfast, lunch, snacks, drinks, sweets and more. Choose whether to share the recipe or also sell the finished food.',
    action: 'Create recipe',
    icon: ChefHat,
  },
  grocery: {
    title: 'Grocery & packaged products',
    description: 'Add everyday food, packaged goods, photos and product details.',
    action: 'Add product',
    icon: Boxes,
  },
  'brand-recipe': {
    title: 'Brand recipes',
    description: 'Share your recipes, ingredients and cooking instructions.',
    action: 'Add recipe',
    icon: BookOpen,
  },
  'kitchen-recipe': {
    title: 'Kitchen recipes, drinks & desserts',
    description: 'Share dishes, drinks, sweets or baked favourites from your kitchen.',
    action: 'Add recipe',
    icon: ChefHat,
  },
  'ready-made': {
    title: 'Ready-to-eat food & menu items',
    description: 'List cooked meals and menu items ready for customers to order.',
    action: 'Add menu item',
    icon: Store,
  },
  offers: {
    title: 'Prices, stock & delivery areas',
    description: 'Manage your selling prices, available stock and delivery pincodes.',
    action: 'Manage selling',
    icon: MapPinned,
  },
}

const steps = [
  { number: '01', title: 'Choose', detail: 'Pick what you want to list' },
  { number: '02', title: 'Create', detail: 'Add photos and food details' },
  { number: '03', title: 'Review', detail: 'Send for approval' },
]

export default function HostListingWorkspacePage() {
  const { currentUser } = useAuth()
  const workspaceType = normalizeHostWorkspaceType(currentUser)
  // Only Hybrid uses the two-choice unified creator. Other Host entry registries
  // remain account-scoped (B2B, Brand/Seller and Chef/Restaurant Hospitality).
  const options = workspaceType === 'hybrid'
    ? [
        { id: 'grocery', label: 'Grocery & packaged products', to: '/host/listings/new?type=grocery' },
        { id: 'hybrid-recipe', label: 'Recipe', to: '/host/listings/new?type=kitchen_recipe' },
      ]
    : getHostListingEntryOptions(currentUser)
  const workspaceLabel = getHostWorkspaceLabel(currentUser)
  // A missing workspace type is a legacy account, not an authorized Hybrid account.
  // Do not silently grant Hybrid permissions to B2B/Brand/Chef accounts.
  const pageRef = useRef(null)
  const [availableHeight, setAvailableHeight] = useState(null)

  // The authenticated workspace canvas uses CSS zoom: .75 on desktop.
  // getBoundingClientRect() is already zoomed, but CSS height is measured in
  // pre-zoom units. Account for that scale so the stage really fills the
  // visible viewport below the existing navbar, without changing shell zoom.
  useLayoutEffect(() => {
    let frameId = null

    const measure = () => {
      const page = pageRef.current
      if (!page) return

      const rect = page.getBoundingClientRect()
      const layoutHeight = page.offsetHeight
      const measuredScale = layoutHeight > 0 ? rect.height / layoutHeight : 1
      const scale = Number.isFinite(measuredScale) && measuredScale > 0
        ? measuredScale
        : 1
      const remaining = Math.max(0, window.innerHeight - rect.top - 8)
      const height = Math.ceil(remaining / scale)
      setAvailableHeight((previous) => previous === height ? previous : height)
    }

    const onResize = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  // Hybrid-only presentation: two editorial choices. All other account workspaces
  // keep their existing rendered markup, routes and permission-scoped options.
  if (workspaceType === 'hybrid') {
    const groceryOption = options.find((option) => option.id === 'grocery')
    const recipeOption = options.find((option) => option.id === 'hybrid-recipe')

    return (
      <main
        ref={pageRef}
        className="hls-hyb"
        style={availableHeight !== null ? { '--hls-viewport-space': `${availableHeight}px` } : undefined}
      >
        <style>{`
          .hls-hyb {
            --hyb-forest: #173F35; --hyb-forest-dark: #10352C;
            --hyb-clay: #C86C42; --hyb-charcoal: #202421;
            --hyb-sage: #D7DDCF; --hyb-porcelain: #F7F6F2;
            box-sizing: border-box; width: 100%; min-width: 0;
            height: max(710px, var(--hls-viewport-space, calc(100svh - 74px)));
            margin: 0; padding: 13px clamp(14px,1.6vw,28px) 15px;
            display: flex; flex-direction: column;
            background: var(--hyb-porcelain); color: var(--hyb-charcoal);
            font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
          }
          .hls-hyb *, .hls-hyb *::before, .hls-hyb *::after { box-sizing: border-box; }
          .hls-hyb a { text-decoration: none; }
          .hls-hyb a:focus-visible { outline: 3px solid var(--hyb-clay); outline-offset: 4px; }
          .hls-hyb-breadcrumb {
            display: flex; align-items: center; gap: 11px; margin: 0 0 11px 2px;
            font-size: 15px; line-height: 1.4; color: #66756B; flex: 0 0 auto;
          }
          .hls-hyb-breadcrumb a { color: var(--hyb-forest); font-weight: 750; }
          .hls-hyb-breadcrumb a:hover { text-decoration: underline; }
          .hls-hyb-frame {
            flex: 1 1 auto; min-height: 0; min-width: 0;
            display: grid; grid-template-rows: auto auto minmax(0,1fr) auto;
            background: #F9F8F4; border: 1px solid #E0E4DA;
            border-radius: 13px; overflow: hidden;
          }
          /* Horizontal masthead replaces the oversized full-height forest column. */
          .hls-hyb-masthead {
            display: grid; grid-template-columns: minmax(0,1.1fr) minmax(370px,.8fr);
            align-items: center; gap: clamp(20px,3vw,58px);
            padding: clamp(25px,2.5vw,38px) clamp(26px,3.2vw,52px);
            background: var(--hyb-forest); position: relative; isolation: isolate;
            color: var(--hyb-porcelain); overflow: hidden;
          }
          .hls-hyb-masthead::after {
            content: ''; position: absolute; z-index: -1;
            width: 270px; height: 270px; border-radius: 50%; right: 32%; top: -180px;
            border: 1px solid rgba(215,221,207,.14);
            box-shadow: 0 0 0 37px rgba(215,221,207,.035), 0 0 0 76px rgba(215,221,207,.025);
            pointer-events: none;
          }
          .hls-hyb-kicker {
            margin: 0 0 11px; color: #F0B79D;
            font-size: 14px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
            display: inline-flex; align-items: center; gap: 10px;
          }
          .hls-hyb-kicker::before { content: ''; display: inline-block; width: 23px; height: 3px; background: var(--hyb-clay); }
          .hls-hyb .hls-hyb-title {
            margin: 0; color: var(--hyb-porcelain);
            font-size: clamp(36px,3.1vw,53px) !important; line-height: 1.11 !important;
            font-weight: 800 !important; letter-spacing: -.055em;
          }
          .hls-hyb-title span { color: #E9A181; }
          .hls-hyb-intro {
            margin: 10px 0 0; max-width: 670px;
            font-size: 18px; line-height: 1.56; color: #E4EAE4;
          }
          .hls-hyb-timeline { min-width: 0; }
          .hls-hyb-timeline-title {
            color: #F0B79D; font-size: 14px; font-weight: 800;
            text-transform: uppercase; letter-spacing: .07em; margin: 0 0 17px;
          }
          .hls-hyb-timeline-list {
            display: grid; grid-template-columns: repeat(3,minmax(0,1fr));
            gap: 16px; padding: 0; margin: 0; list-style: none;
          }
          .hls-hyb-timeline-list li { border-top: 2px solid rgba(247,246,242,.33); padding-top: 12px; min-width: 0; }
          .hls-hyb-timeline-list li:first-child { border-top-color: #E6A081; }
          .hls-hyb-timeline-no { display: block; font-size: 18px; font-weight: 800; color: #F0B79D; margin-bottom: 5px; }
          .hls-hyb-timeline-label { display: block; font-size: 17px; font-weight: 750; color: #F7F6F2; line-height: 1.3; }
          .hls-hyb-section-bar {
            display: flex; justify-content: space-between; align-items: center;
            gap: 16px; padding: 19px clamp(26px,3.2vw,52px) 15px;
            background: #F9F8F4;
          }
          .hls-hyb-section-kicker { margin: 0 0 3px; font-size: 13px; font-weight: 800; letter-spacing: .1em; color: #B65D38; text-transform: uppercase; }
          .hls-hyb .hls-hyb-section-title {
            font-size: clamp(24px,2vw,32px) !important; line-height: 1.19 !important;
            margin: 0; color: var(--hyb-charcoal); letter-spacing: -.045em; font-weight: 800 !important;
          }
          .hls-hyb-section-count {
            display: flex; align-items: baseline; gap: 8px; flex-shrink: 0;
            color: #617466; font-size: 14px; font-weight: 700;
          }
          .hls-hyb-section-count strong { color: var(--hyb-clay); font-size: 31px; font-weight: 800; line-height: 1; }
          .hls-hyb-choices {
            display: grid; grid-template-rows: repeat(2,minmax(0,1fr));
            gap: clamp(10px,1.3vw,17px); min-height: 0;
            margin: 0 clamp(15px,2vw,31px) clamp(15px,1.7vw,25px);
          }
          .hls-hyb-choice {
            display: grid; grid-template-columns: minmax(175px,26%) minmax(0,1fr);
            min-height: 0; color: var(--hyb-charcoal);
            overflow: hidden; background: #EBF0E8;
            border: 1px solid #D4DFD2; border-radius: 10px;
            transition: box-shadow .18s ease, border-color .18s ease, transform .18s ease;
          }
          .hls-hyb-choice:hover, .hls-hyb-choice:focus-visible {
            box-shadow: 0 11px 32px rgba(23,63,53,.12); transform: translateY(-2px);
            border-color: #9AAF9E;
          }
          .hls-hyb-choice[data-type="recipe"] { background: #FAEDE5; border-color: #EDD6C8; }
          .hls-hyb-choice[data-type="recipe"]:hover, .hls-hyb-choice[data-type="recipe"]:focus-visible { border-color: #D9A88C; }
          .hls-hyb-choice-visual {
            position: relative; isolation: isolate; overflow: hidden;
            display: flex; flex-direction: column; justify-content: space-between;
            padding: clamp(18px,2.2vw,33px); color: #F7F6F2;
            background: var(--hyb-forest);
          }
          .hls-hyb-choice[data-type="recipe"] .hls-hyb-choice-visual { background: #A65132; }
          .hls-hyb-choice-visual::after {
            content: ''; position: absolute; z-index: -1;
            width: 230px; height: 230px; right: -110px; bottom: -110px;
            border: 1px solid rgba(255,255,255,.23); border-radius: 50%;
            box-shadow: 0 0 0 30px rgba(255,255,255,.035), 0 0 0 60px rgba(255,255,255,.025);
          }
          .hls-hyb-choice-number {
            color: rgba(255,255,255,.65); font-size: 16px; font-weight: 800;
            letter-spacing: .14em;
          }
          .hls-hyb-choice-illustration { display: flex; align-items: flex-end; gap: 16px; }
          .hls-hyb-choice-symbol {
            width: clamp(67px,6vw,100px); height: clamp(67px,6vw,100px);
            display: grid; place-items: center; border-radius: 16px;
            background: rgba(215,221,207,.16); border: 1px solid rgba(255,255,255,.22);
          }
          .hls-hyb-choice-symbol svg { width: 49%; height: 49%; stroke-width: 1.6; }
          .hls-hyb-choice-art-label {
            font-size: 13px; font-weight: 800; line-height: 1.45; max-width: 115px;
            text-transform: uppercase; letter-spacing: .11em; color: rgba(255,255,255,.88);
          }
          .hls-hyb-choice-body {
            display: grid; grid-template-columns: minmax(0,1fr) auto;
            align-items: center; gap: 20px;
            padding: clamp(18px,2.3vw,35px) clamp(22px,3.1vw,50px);
            min-height: 0;
          }
          .hls-hyb-choice-text { min-width: 0; }
          .hls-hyb-choice-eyebrow {
            display: block; margin: 0 0 8px; font-size: 13px;
            color: #3F715B; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
          }
          .hls-hyb-choice[data-type="recipe"] .hls-hyb-choice-eyebrow { color: #B45130; }
          .hls-hyb .hls-hyb-choice-title {
            display: block; margin: 0; max-width: 600px;
            font-size: clamp(24px,2.35vw,37px) !important;
            font-weight: 800 !important; line-height: 1.2 !important;
            letter-spacing: -.04em; color: var(--hyb-charcoal);
          }
          .hls-hyb-choice-description {
            display: block; margin-top: 11px; max-width: 730px;
            font-size: clamp(16px,1.25vw,19px); line-height: 1.55; color: #4B6053;
          }
          .hls-hyb-choice[data-type="recipe"] .hls-hyb-choice-description { color: #70594C; }
          .hls-hyb-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
          .hls-hyb-tags span {
            display: inline-block; padding: 7px 11px; border: 1px solid #C7D5C6;
            border-radius: 5px; color: #345F4C; font-size: 14px; font-weight: 700;
            background: rgba(255,255,255,.45); line-height: 1.25;
          }
          .hls-hyb-choice[data-type="recipe"] .hls-hyb-tags span { color: #8C482C; border-color: #E7C5B4; }
          .hls-hyb-choice-cta {
            display: inline-flex; align-items: center; justify-content: center; gap: 10px;
            align-self: end; white-space: nowrap;
            color: #FFF; background: var(--hyb-forest); border-radius: 7px;
            padding: 13px 18px; font-size: 17px; font-weight: 800;
            line-height: 1.25; min-height: 49px;
          }
          .hls-hyb-choice[data-type="recipe"] .hls-hyb-choice-cta { background: var(--hyb-clay); }
          .hls-hyb-choice-cta svg { width: 19px; height: 19px; stroke-width: 2; }
          .hls-hyb-note-bar {
            display: grid; grid-template-columns: repeat(2,minmax(0,1fr));
            gap: 0; flex: 0 0 auto; min-width: 0;
            background: #DBE3D7; border-top: 1px solid #CBD7C8;
          }
          .hls-hyb-note {
            display: flex; align-items: center; gap: 15px;
            min-width: 0; padding: 15px clamp(21px,2.65vw,43px);
          }
          .hls-hyb-note + .hls-hyb-note { border-left: 1px solid #BFD0BE; }
          .hls-hyb-note > svg { width: 28px; height: 28px; stroke-width: 1.7; flex: 0 0 28px; color: var(--hyb-forest); }
          .hls-hyb-note strong { display: block; color: var(--hyb-forest); font-size: 16px; font-weight: 800; line-height: 1.3; }
          .hls-hyb-note span { display: block; margin-top: 2px; color: #4E6557; font-size: 15px; line-height: 1.4; }
          @media (max-width: 1260px) and (min-width: 861px) {
            .hls-hyb-masthead { grid-template-columns: minmax(0,1fr) minmax(285px,.7fr); }
            .hls-hyb-choice { grid-template-columns: minmax(140px,22%) minmax(0,1fr); }
            .hls-hyb-choice-body { grid-template-columns: minmax(0,1fr); gap: 8px; }
            .hls-hyb-choice-cta { justify-self: start; align-self: auto; min-height: 41px; padding: 9px 14px; }
            .hls-hyb-tags { margin-top: 10px; }
          }
          @media (max-width: 860px) {
            .hls-hyb { height: auto; min-height: 0; padding: 10px 10px 17px; }
            .hls-hyb-frame { display: flex; flex-direction: column; overflow: visible; }
            .hls-hyb-masthead { grid-template-columns: 1fr; gap: 19px; padding: 25px 22px 23px; }
            .hls-hyb .hls-hyb-title { font-size: 35px !important; }
            .hls-hyb-intro { font-size: 16px; line-height: 1.5; }
            .hls-hyb-timeline-title { margin-bottom: 10px; }
            .hls-hyb-timeline-list { gap: 9px; }
            .hls-hyb-timeline-list li { padding-top: 8px; }
            .hls-hyb-timeline-no { font-size: 15px; margin-bottom: 2px; }
            .hls-hyb-timeline-label { font-size: 14px; }
            .hls-hyb-section-bar { padding: 20px 19px 15px; }
            .hls-hyb .hls-hyb-section-title { font-size: 26px !important; }
            .hls-hyb-choices { margin: 0 12px 13px; gap: 12px; grid-template-rows: none; }
            .hls-hyb-choice { grid-template-columns: 1fr; }
            .hls-hyb-choice-visual {
              flex-direction: row; align-items: center; padding: 12px 18px;
              gap: 13px; min-height: 65px;
            }
            .hls-hyb-choice-number { font-size: 15px; }
            .hls-hyb-choice-illustration { align-items: center; gap: 10px; margin-left: auto; }
            .hls-hyb-choice-symbol { height: 39px; width: 39px; border-radius: 9px; }
            .hls-hyb-choice-art-label { font-size: 11px; max-width: none; }
            .hls-hyb-choice-body { display: block; padding: 17px 18px 19px; }
            .hls-hyb .hls-hyb-choice-title { font-size: 24px !important; }
            .hls-hyb-choice-description { font-size: 15px; margin-top: 7px; }
            .hls-hyb-tags { margin-top: 12px; gap: 6px; }
            .hls-hyb-tags span { font-size: 12px; padding: 6px 8px; }
            .hls-hyb-choice-cta { margin-top: 16px; font-size: 15px; min-height: 41px; padding: 11px 13px; }
            .hls-hyb-note-bar { grid-template-columns: 1fr; }
            .hls-hyb-note { padding: 15px 18px; }
            .hls-hyb-note + .hls-hyb-note { border-left: none; border-top: 1px solid #BFD0BE; }
            .hls-hyb-note strong { font-size: 15px; }
            .hls-hyb-note span { font-size: 14px; }
          }
          @media (max-width: 380px) {
            .hls-hyb { padding-left: 6px; padding-right: 6px; }
            .hls-hyb-section-count { display: none; }
            .hls-hyb-choice-art-label { display: none; }
          }
          @media (prefers-reduced-motion: reduce) {
            .hls-hyb * { transition: none !important; }
          }
        `}</style>

        <nav className="hls-hyb-breadcrumb" aria-label="Breadcrumb">
          <Link to="/host/operations">Host Dashboard</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Create listing</span>
        </nav>

        <div className="hls-hyb-frame" data-workspace="hybrid" data-option-count="2">
          <header className="hls-hyb-masthead">
            <div>
              <p className="hls-hyb-kicker">Hybrid host · Listing studio</p>
              <h1 className="hls-hyb-title">Create something worth sharing<span>.</span></h1>
              <p className="hls-hyb-intro">Add a grocery product or publish a recipe. Pick a path and we'll show you the right details.</p>
            </div>
            <div className="hls-hyb-timeline" aria-label="Three steps to publish">
              <p className="hls-hyb-timeline-title">Your publishing journey</p>
              <ol className="hls-hyb-timeline-list">
                <li><span className="hls-hyb-timeline-no">01</span><span className="hls-hyb-timeline-label">Choose type</span></li>
                <li><span className="hls-hyb-timeline-no">02</span><span className="hls-hyb-timeline-label">Add details</span></li>
                <li><span className="hls-hyb-timeline-no">03</span><span className="hls-hyb-timeline-label">Request review</span></li>
              </ol>
            </div>
          </header>

          <div className="hls-hyb-section-bar">
            <div>
              <p className="hls-hyb-section-kicker">Choose a format</p>
              <h2 className="hls-hyb-section-title" id="hls-hyb-choice-heading">What would you like to list?</h2>
            </div>
            <div className="hls-hyb-section-count" aria-label="Two listing options"><strong>02</strong> options</div>
          </div>

          <section className="hls-hyb-choices" aria-labelledby="hls-hyb-choice-heading">
            <Link className="hls-hyb-choice" data-type="grocery" to={groceryOption.to}>
              <div className="hls-hyb-choice-visual" aria-hidden="true">
                <span className="hls-hyb-choice-number">01 / 02</span>
                <div className="hls-hyb-choice-illustration">
                  <span className="hls-hyb-choice-symbol"><Boxes /></span>
                  <span className="hls-hyb-choice-art-label">Fresh to pantry</span>
                </div>
              </div>
              <div className="hls-hyb-choice-body">
                <div className="hls-hyb-choice-text">
                  <span className="hls-hyb-choice-eyebrow">For products</span>
                  <h3 className="hls-hyb-choice-title">Grocery &amp; packaged products</h3>
                  <span className="hls-hyb-choice-description">List fresh produce, grocery essentials or packaged food with product details, photos and selling information.</span>
                  <div className="hls-hyb-tags" aria-hidden="true">
                    <span>Fruit &amp; vegetables</span><span>Pantry &amp; packaged</span><span>Veg / Non-veg</span>
                  </div>
                </div>
                <span className="hls-hyb-choice-cta">Add grocery product <ArrowUpRight aria-hidden="true" /></span>
              </div>
            </Link>

            <Link className="hls-hyb-choice" data-type="recipe" to={recipeOption.to}>
              <div className="hls-hyb-choice-visual" aria-hidden="true">
                <span className="hls-hyb-choice-number">02 / 02</span>
                <div className="hls-hyb-choice-illustration">
                  <span className="hls-hyb-choice-symbol"><ChefHat /></span>
                  <span className="hls-hyb-choice-art-label">Cook &amp; create</span>
                </div>
              </div>
              <div className="hls-hyb-choice-body">
                <div className="hls-hyb-choice-text">
                  <span className="hls-hyb-choice-eyebrow">For recipes</span>
                  <h3 className="hls-hyb-choice-title">Recipes, drinks &amp; sweets</h3>
                  <span className="hls-hyb-choice-description">Share a recipe with cooking steps, or offer the finished food for sale. Choose your category in the next form.</span>
                  <div className="hls-hyb-tags" aria-hidden="true">
                    <span>Breakfast to dinner</span><span>Drinks &amp; desserts</span><span>Share or sell</span>
                  </div>
                </div>
                <span className="hls-hyb-choice-cta">Create recipe <ArrowUpRight aria-hidden="true" /></span>
              </div>
            </Link>
          </section>

          <aside className="hls-hyb-note-bar" aria-label="Before you publish">
            <div className="hls-hyb-note">
              <ShieldCheck aria-hidden="true" />
              <div><strong>Reviewed before it goes live</strong><span>Super Admin checks new listings before they reach customers.</span></div>
            </div>
            <div className="hls-hyb-note">
              <MapPinned aria-hidden="true" />
              <div><strong>Selling is your choice</strong><span>For recipes, add prices and delivery details only when selling the finished dish.</span></div>
            </div>
          </aside>
        </div>
      </main>
    )
  }

  return (
    <main
      ref={pageRef}
      className="hls-vs"
      style={availableHeight !== null ? { '--hls-viewport-space': `${availableHeight}px` } : undefined}
    >
      <style>{`
        .hls-vs {
          --hls-forest: #173F35;
          --hls-forest-deep: #10342B;
          --hls-clay: #C86C42;
          --hls-sage: #D7DDCF;
          --hls-porcelain: #F7F6F2;
          --hls-charcoal: #202421;
          box-sizing: border-box;
          width: 100%; min-width: 0; max-width: none;
          height: max(650px, var(--hls-viewport-space, calc(100svh - 72px)));
          margin: 0; padding: 12px clamp(12px, 1.45vw, 24px) 13px;
          display: flex; flex-direction: column; overflow: visible;
          background: var(--hls-porcelain); color: var(--hls-charcoal);
          font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
        }
        .hls-vs *, .hls-vs *::before, .hls-vs *::after { box-sizing: border-box; }
        .hls-vs a { text-decoration: none; }
        .hls-vs a:focus-visible { outline: 3px solid var(--hls-clay); outline-offset: -3px; }
        .hls-vs-breadcrumb {
          display: flex; align-items: center; gap: 10px;
          flex: 0 0 auto; margin: 0 0 10px 3px;
          color: #66766A; font-size: 14px; line-height: 1.45;
        }
        .hls-vs-breadcrumb a { color: var(--hls-forest); font-weight: 700; }
        .hls-vs-breadcrumb a:hover { text-decoration: underline; }
        .hls-vs-stage {
          display: grid;
          grid-template-columns: minmax(288px, .36fr) minmax(0, 1fr);
          flex: 1 1 auto; min-height: 0; min-width: 0;
          background: #FCFBF8;
          border: 1px solid #DFE3D9;
          border-radius: 16px;
          box-shadow: 0 10px 36px rgba(19, 46, 37, .045);
          overflow: hidden;
        }
        /* Editorial left panel. It occupies real page height, not a short banner. */
        .hls-vs-intro {
          display: flex; flex-direction: column; min-height: 0;
          position: relative; isolation: isolate; overflow: hidden;
          padding: clamp(25px, 3vw, 48px);
          color: #F7F6F2; background: var(--hls-forest);
        }
        .hls-vs-intro::before {
          content: ''; position: absolute; z-index: -1; pointer-events: none;
          width: 340px; height: 340px; border: 1px solid rgba(215,221,207,.14);
          border-radius: 50%; right: -188px; top: 19%;
          box-shadow: 0 0 0 44px rgba(215,221,207,.025), 0 0 0 92px rgba(215,221,207,.025);
        }
        .hls-vs-intro::after {
          content: ''; position: absolute; left: clamp(25px, 3vw, 48px);
          top: clamp(25px, 3vw, 48px); width: 46px; height: 3px;
          border-radius: 999px; background: var(--hls-clay);
        }
        .hls-vs-eyebrow {
          margin: 21px 0 clamp(19px, 3vh, 38px);
          color: #E4B199; text-transform: uppercase;
          letter-spacing: .12em; font-size: 12px; font-weight: 800;
        }
        .hls-vs .hls-vs-title {
          margin: 0; max-width: 350px; color: #F7F6F2;
          font-size: clamp(36px, 3.15vw, 55px) !important;
          line-height: 1.09 !important; letter-spacing: -.057em;
          font-weight: 800 !important;
        }
        .hls-vs-title-dot { color: #E6A181; }
        .hls-vs-intro-copy {
          max-width: 340px; margin: 18px 0 24px;
          font-size: 16px; line-height: 1.68; color: #E1E9E1;
        }
        .hls-vs-progress {
          margin-top: auto; padding-top: 23px;
          border-top: 1px solid rgba(255,255,255,.23);
        }
        .hls-vs-progress-caption {
          margin: 0 0 19px; font-size: 13px; font-weight: 750;
          letter-spacing: .025em; color: #E5AE91;
        }
        .hls-vs-progress-steps { margin: 0; padding: 0; list-style: none; }
        .hls-vs-progress-step {
          display: grid; grid-template-columns: 33px minmax(0,1fr); gap: 11px;
          position: relative; padding: 0 0 19px;
        }
        .hls-vs-progress-step:last-child { padding-bottom: 0; }
        .hls-vs-progress-step:not(:last-child)::after {
          content: ''; position: absolute; left: 14px; top: 30px; bottom: 6px;
          border-left: 1px solid rgba(255,255,255,.28);
        }
        .hls-vs-progress-number {
          display: grid; place-items: center; width: 30px; height: 30px;
          border: 1px solid rgba(255,255,255,.28); border-radius: 50%;
          color: #F4B494; font-size: 12px; font-weight: 800;
        }
        .hls-vs-progress-title { display: block; font-weight: 750; font-size: 16px; line-height: 1.35; color: #FCFAF7; }
        .hls-vs-progress-detail { display: block; margin-top: 3px; font-size: 13px; line-height: 1.45; color: #C8D9D0; }

        /* One vertical listing directory on the right. */
        .hls-vs-directory {
          display: flex; flex-direction: column; min-width: 0; min-height: 0;
          background: #FCFBF8;
        }
        .hls-vs-directory-heading {
          flex: 0 0 auto; padding: clamp(20px, 2.55vw, 34px) clamp(22px, 2.6vw, 44px) 19px;
          border-bottom: 1px solid #DDE2D7;
        }
        .hls-vs-section-eyebrow {
          display: flex; align-items: center; gap: 9px;
          margin: 0 0 9px; color: #A85030;
          font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .10em;
        }
        .hls-vs-section-eyebrow::before { content: ''; width: 19px; height: 2px; background: var(--hls-clay); }
        .hls-vs-section-heading-row { display: flex; align-items: end; justify-content: space-between; gap: 12px; }
        .hls-vs .hls-vs-section-title {
          margin: 0; color: var(--hls-charcoal);
          font-size: clamp(27px, 2.35vw, 37px) !important;
          letter-spacing: -.045em; line-height: 1.13 !important;
          font-weight: 800 !important;
        }
        .hls-vs-section-description { margin: 9px 0 0; color: #506359; font-size: 15px; line-height: 1.45; }
        .hls-vs-legacy-note { margin: 12px 0 0; padding: 10px 13px; border-left: 3px solid var(--hls-clay); border-radius: 6px; background: #F9EEE7; color: #763B25; font-size: 14px; line-height: 1.45; }
        .hls-vs-count { flex-shrink: 0; color: #58685D; font-size: 13px; font-weight: 700; white-space: nowrap; padding-bottom: 2px; }
        .hls-vs-count strong { color: var(--hls-clay); font-size: 21px; font-weight: 800; margin-right: 4px; }
        .hls-vs-options {
          display: grid; min-height: 0; flex: 1 1 auto;
          grid-auto-flow: row;
          background: #FCFBF8;
          overflow-y: auto; scrollbar-width: thin;
        }
        .hls-vs-option {
          display: grid;
          grid-template-columns: 43px 67px minmax(0,1fr) auto;
          align-items: center; gap: clamp(11px, 1.5vw, 22px);
          min-height: 94px; padding: 13px clamp(18px, 2.6vw, 44px);
          border-bottom: 1px solid #E0E4DC;
          position: relative; color: var(--hls-charcoal);
          transition: background .15s ease;
        }
        .hls-vs-option:last-child { border-bottom: 0; }
        .hls-vs-option:hover, .hls-vs-option:focus-visible { background: #F0F2EC; }
        .hls-vs-option::before {
          content: ''; position: absolute; top: 0; left: 0; bottom: 0;
          width: 0; background: var(--hls-clay); transition: width .15s ease;
        }
        .hls-vs-option:hover::before, .hls-vs-option:focus-visible::before { width: 4px; }
        .hls-vs-option-number { font-weight: 800; font-size: clamp(25px, 2.5vw, 35px); letter-spacing: -.07em; color: #A9B7AA; line-height: 1; }
        .hls-vs-option-icon {
          width: 64px; height: 64px; display: grid; place-items: center;
          border-radius: 12px; background: #E5EAE1;
          border: 1px solid #D7DED2; color: var(--hls-forest);
        }
        .hls-vs-option:nth-child(2n) .hls-vs-option-icon { background: #F3E2D8; border-color: #EBD4C6; color: #B35A36; }
        .hls-vs-option-icon svg { width: 27px; height: 27px; stroke-width: 1.75; }
        .hls-vs-option-copy { min-width: 0; }
        .hls-vs-option-title { display: block; font-size: clamp(17px, 1.3vw, 20px); font-weight: 800; letter-spacing: -.02em; line-height: 1.36; }
        .hls-vs-option-description { display: block; margin-top: 7px; font-size: 14px; line-height: 1.5; color: #516257; }
        .hls-vs-option-action {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          border-radius: 999px; padding: 0 17px; min-height: 43px;
          border: 1px solid #CAD3C8; color: var(--hls-forest);
          white-space: nowrap; font-size: 14px; font-weight: 800;
          transition: color .15s ease, background .15s ease;
        }
        .hls-vs-option-action svg { width: 17px; height: 17px; }
        .hls-vs-option:hover .hls-vs-option-action, .hls-vs-option:focus-visible .hls-vs-option-action {
          background: var(--hls-forest); color: #FFF; border-color: var(--hls-forest);
        }

        /* Both informational messages have exactly the same neutral surface. */
        .hls-vs-notes {
          display: grid; grid-template-columns: repeat(2,minmax(0,1fr));
          min-width: 0; flex: 0 0 auto; background: #E4E9E0;
          border-top: 1px solid #CDD7CD;
        }
        .hls-vs-note {
          display: flex; align-items: center; gap: 11px;
          min-width: 0; padding: 14px clamp(16px, 2vw, 32px);
        }
        .hls-vs-note + .hls-vs-note { border-left: 1px solid #C8D4C8; }
        .hls-vs-note-icon { display: grid; flex: 0 0 30px; place-items: center; color: var(--hls-forest); }
        .hls-vs-note-icon svg { width: 25px; height: 25px; stroke-width: 1.75; }
        .hls-vs-note-copy { min-width: 0; }
        .hls-vs-note-title { display: block; color: var(--hls-forest); font-size: 14px; font-weight: 800; line-height: 1.35; }
        .hls-vs-note-description { display: block; margin-top: 4px; color: #526458; font-size: 13px; line-height: 1.48; }

        @media (max-width: 1060px) and (min-width: 801px) {
          .hls-vs-stage { grid-template-columns: minmax(245px, .34fr) minmax(0,1fr); }
          .hls-vs-intro { padding: 26px; }
          .hls-vs-option { grid-template-columns: 29px 50px minmax(0,1fr) 42px; gap: 12px; padding-left: 18px; padding-right: 18px; }
          .hls-vs-option-icon { width: 50px; height: 50px; }
          .hls-vs-option-action { padding: 0; width: 42px; }
          .hls-vs-option-action-label { display: none; }
          .hls-vs-count { display: none; }
        }
        @media (max-width: 800px) {
          .hls-vs { height: auto; min-height: 0; padding: 12px 12px 20px; }
          .hls-vs-stage { display: flex; flex-direction: column; min-height: 0; overflow: visible; }
          .hls-vs-intro { padding: 26px 24px 25px; }
          .hls-vs-intro::after { left: 24px; top: 26px; }
          .hls-vs-eyebrow { margin: 19px 0 12px; }
          .hls-vs .hls-vs-title { font-size: 34px !important; }
          .hls-vs-intro-copy { margin: 10px 0 16px; font-size: 15px; line-height: 1.55; }
          .hls-vs-progress { padding-top: 13px; }
          .hls-vs-progress-caption { margin-bottom: 10px; }
          .hls-vs-progress-steps { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
          .hls-vs-progress-step { grid-template-columns: 1fr; gap: 5px; padding-bottom: 0; }
          .hls-vs-progress-step::after { display: none; }
          .hls-vs-progress-number { width: 28px; height: 28px; }
          .hls-vs-progress-title { font-size: 14px; }
          .hls-vs-progress-detail { display: none; }
          .hls-vs-directory-heading { padding: 23px 22px 20px; }
          .hls-vs-count { display: none; }
          .hls-vs-options { display: flex; flex-direction: column; overflow: visible; }
          .hls-vs-option { grid-template-columns: 49px minmax(0,1fr) 42px; gap: 13px; min-height: 104px; padding: 15px 18px; }
          .hls-vs-option-number { display: none; }
          .hls-vs-option-icon { width: 47px; height: 47px; }
          .hls-vs-option-icon svg { width: 23px; height: 23px; }
          .hls-vs-option-title { font-size: 17px; }
          .hls-vs-option-description { font-size: 14px; margin-top: 4px; }
          .hls-vs-option-action { width: 40px; min-height: 40px; padding: 0; }
          .hls-vs-option-action-label { display: none; }
          .hls-vs-notes { grid-template-columns: 1fr; }
          .hls-vs-note + .hls-vs-note { border-left: 0; border-top: 1px solid #C8D4C8; }
          .hls-vs-note { padding: 15px 18px; }
        }
        @media (max-width: 370px) {
          .hls-vs { padding-left: 8px; padding-right: 8px; }
          .hls-vs-intro { padding-left: 19px; padding-right: 19px; }
          .hls-vs-intro::after { left: 19px; }
          .hls-vs-option { grid-template-columns: 42px minmax(0,1fr) 34px; gap: 10px; padding: 14px 11px; }
          .hls-vs-option-icon { width: 41px; height: 41px; }
          .hls-vs-option-action { width: 34px; min-height: 34px; }
          .hls-vs-directory-heading { padding-left: 14px; padding-right: 14px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hls-vs *, .hls-vs *::before, .hls-vs *::after { transition: none !important; }
        }
      `}</style>

      <nav className="hls-vs-breadcrumb" aria-label="Breadcrumb">
        <Link to="/host/operations">Host Dashboard</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Create listing</span>
      </nav>

      <div className="hls-vs-stage" data-workspace={workspaceType} data-option-count={options.length}>
        <header className="hls-vs-intro">
          <p className="hls-vs-eyebrow">{workspaceLabel === 'Legacy Host' ? 'Your host studio' : `${workspaceLabel} studio`}</p>
          <h1 className="hls-vs-title">Create a<br />listing<span className="hls-vs-title-dot">.</span></h1>
          <p className="hls-vs-intro-copy">{workspaceType === 'hybrid' ? 'Choose groceries or recipes. Each form adapts to what you want to list or sell.' : "Add something new to EPANTRY. Choose the right listing type and we'll take you straight to its form."}</p>
          <div className="hls-vs-progress" aria-label="Three steps to publish">
            <p className="hls-vs-progress-caption">YOUR NEXT THREE STEPS</p>
            <ol className="hls-vs-progress-steps">
              {steps.map((step) => (
                <li className="hls-vs-progress-step" key={step.number}>
                  <span className="hls-vs-progress-number">{step.number}</span>
                  <span>
                    <span className="hls-vs-progress-title">{step.title}</span>
                    <span className="hls-vs-progress-detail">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </header>

        <section className="hls-vs-directory" aria-labelledby="hls-vs-section-heading">
          <div className="hls-vs-directory-heading">
            <p className="hls-vs-section-eyebrow">Your catalog starts here</p>
            <div className="hls-vs-section-heading-row">
              <h2 className="hls-vs-section-title" id="hls-vs-section-heading">What are you adding?</h2>
              <span className="hls-vs-count"><strong>{String(options.length).padStart(2, '0')}</strong> choices</span>
            </div>
            <p className="hls-vs-section-description">Choose one option to open its form.</p>
          {workspaceType === 'legacy' && <p className="hls-vs-legacy-note" role="status">This account is still classified as Legacy Host. The two-option Grocery / Recipe studio is available after the account is assigned the Hybrid workspace by Super Admin.</p>}
          </div>

          <div
            className="hls-vs-options"
            aria-label="Available listing types"
            style={{ gridTemplateRows: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}
          >
            {options.map((option, index) => {
              const details = listingDetails[option.id] || {
                title: option.label,
                description: option.description,
                action: 'Continue',
                icon: Boxes,
              }
              const isChefRestaurant = workspaceType === 'chef_restaurant'
              const isHybrid = workspaceType === 'hybrid'
              const isRestaurantMenu = option.id === 'ready-made' && (isHybrid || isChefRestaurant)
              const isChefKitchenRecipe = option.id === 'kitchen-recipe' && isChefRestaurant
              const displayDetails = isRestaurantMenu
                ? {
                    ...details,
                    title: 'Restaurant & menu listings',
                    description: 'Create restaurant dishes and manage menus in Hospitality Operations.',
                    action: 'Open Hospitality',
                  }
                : isChefKitchenRecipe
                  ? {
                      ...details,
                      description: 'Create and manage kitchen recipes in Hospitality Operations.',
                      action: 'Open Hospitality',
                    }
                  : details
              const Icon = displayDetails.icon
              // Hybrid restaurant/menu entry goes to the requested Recipes screen.
              // Chef/Restaurant users use their dedicated Hospitality Operations workspace.
              // All other entries keep their existing unified/marketplace destination.
              const target = isRestaurantMenu
                ? (isChefRestaurant ? '/host/hospitality/menus' : '/host/hospitality/recipes')
                : isChefKitchenRecipe
                  ? '/host/hospitality/recipes'
                  : unifiedTypes[option.id]
                    ? `/host/listings/new?type=${unifiedTypes[option.id]}`
                    : option.to

              return (
                <Link to={target} className="hls-vs-option" key={option.id}>
                  <span className="hls-vs-option-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="hls-vs-option-icon"><Icon aria-hidden="true" /></span>
                  <span className="hls-vs-option-copy">
                    <span className="hls-vs-option-title">{displayDetails.title}</span>
                    <span className="hls-vs-option-description">{displayDetails.description}</span>
                  </span>
                  <span className="hls-vs-option-action" aria-hidden="true">
                    <span className="hls-vs-option-action-label">{displayDetails.action}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </span>
                </Link>
              )
            })}
          </div>

          <aside className="hls-vs-notes" aria-label="Before you publish">
            <div className="hls-vs-note">
              <span className="hls-vs-note-icon"><ShieldCheck aria-hidden="true" /></span>
              <span className="hls-vs-note-copy">
                <span className="hls-vs-note-title">Reviewed before publishing</span>
                <span className="hls-vs-note-description">Super Admin approval is required for new listings.</span>
              </span>
            </div>
            <div className="hls-vs-note">
              <span className="hls-vs-note-icon"><MapPinned aria-hidden="true" /></span>
              <span className="hls-vs-note-copy">
                <span className="hls-vs-note-title">Delivery is in your hands</span>
                <span className="hls-vs-note-description">Manage prices, stock and delivery pincodes in selling tools.</span>
              </span>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
