import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useLandingFeaturedQuery } from '../hooks/useLandingFeaturedQuery'

export default function FeaturedContentSection() {
  const navigate = useNavigate()
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all')
  const { data, isLoading, isError, error } = useLandingFeaturedQuery()

  if (isLoading) return <FeaturedLoading />
  if (isError) {
    return (
      <section className="flex min-h-[100svh] items-center bg-[#F7F6F2]">
        <div className="page-shell">
          <div className="rounded-xl border border-[#C86C42] bg-[#F7F6F2] p-8 text-center">
            <p className="font-semibold text-[#202421]">Featured content could not be loaded.</p>
            <p className="mt-2 text-sm text-[#173F35]">{error?.message || 'Please try again later.'}</p>
          </div>
        </div>
      </section>
    )
  }

  const grocery = data?.grocery || []
  const recipes = data?.recipes || []
  const brands = data?.brands || []
  const brandFilterGroups = buildBrandFilterGroups(brands)
  const visibleBrands = getVisibleBrands({ brands, brandFilterGroups, selectedBrandFilter })

  // Preserve the existing Featured Grocery action until cart checkout is entered
  // from the full product page. Do not invent a cart state on the landing page.
  const handleAddToCart = (product) => {
    const path = product?.path || (product?.slug
      ? `/grocery/product/${encodeURIComponent(product.slug)}` : '/grocery')
    navigate(path)
  }

  return (
    <>
      <FeaturedGroceryScrollStory products={grocery} onAddToCart={handleAddToCart} />
      <FeaturedDiscoverySection kind="recipes" items={recipes} />
      <FeaturedDiscoverySection
        kind="brands"
        items={visibleBrands}
        groups={brandFilterGroups}
        selectedFilter={selectedBrandFilter}
        onSelectFilter={setSelectedBrandFilter}
      />
    </>
  )
}

/*
|--------------------------------------------------------------------------
| Featured Grocery - photography-led hero + editorial product gallery
|--------------------------------------------------------------------------
| Uses the Grocery page's existing hero and real published product records.
| The 100svh hero covers Explore; the 100svh gallery follows in normal flow.
| No sample products, new cart logic, or extra API calls.
|
*/

const GROCERY_COLORS = {
  porcelain: '#F7F6F2',
  forest: '#173F35',
  charcoal: '#202421',
  sage: '#DCE0CF',
  clay: '#C86C42',
}

function FeaturedGroceryScrollStory({ products, onAddToCart }) {
  const items = Array.isArray(products) ? products.slice(0, 8) : []
  const grocerySectionRef = useRef(null)
  const groceryHeroRef = useRef(null)

  // Keep the floating guide from covering the first-column product actions.
  // It returns automatically once the Grocery gallery is out of view.
  useEffect(() => {
    const gallery = grocerySectionRef.current?.querySelector('.ep-landing-grocery-gallery')
    if (!gallery || typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(([entry]) => {
      document.body.classList.toggle(
        'epantry-reading-grocery-gallery',
        entry.isIntersecting && entry.intersectionRatio > 0.2,
      )
    }, { threshold: [0, 0.2, 0.5], rootMargin: '-12% 0px -12% 0px' })

    observer.observe(gallery)
    return () => {
      observer.disconnect()
      document.body.classList.remove('epantry-reading-grocery-gallery')
    }
  }, [])

  // Keep guided mobile scroll stops aligned to the fixed-height hero and gallery.
  useEffect(() => {
    const section = grocerySectionRef.current
    const hero = groceryHeroRef.current
    if (!section || !hero) return undefined

    const updateGalleryStop = () => {
      const sectionHeight = section.getBoundingClientRect().height
      const gallery = section.querySelector('.ep-landing-grocery-gallery')
      const galleryTop = gallery ? gallery.getBoundingClientRect().top - section.getBoundingClientRect().top : hero.getBoundingClientRect().height
      const storyTravel = Math.max(sectionHeight - hero.getBoundingClientRect().height, 1)
      if (storyTravel > 0) {
        // The extra covered viewport is not a Grocery mobile swipe stop.
        section.dataset.landingStops = `0,${Math.max(0,Math.min(galleryTop / storyTravel, 1)).toFixed(5)}`
      }
    }
    updateGalleryStop()
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateGalleryStop)
      : null
    resizeObserver?.observe(section)
    resizeObserver?.observe(hero)
    window.addEventListener('resize', updateGalleryStop)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateGalleryStop)
    }
  }, [items.length])

  return (
    <section
      ref={grocerySectionRef}
      data-landing-story="grocery"
      data-landing-stops="0,0.6"
      data-landing-static="true"
      aria-label="Featured grocery discovery"
      className="relative"
    >
      <style>{`
        /* Guide remains visible; edge-docking is styled in the Guide component. */
        .ep-landing-grocery-hero,
        .ep-landing-grocery-gallery {
          position: relative;
          width: 100%;
          isolation: isolate;
        }
        .ep-landing-grocery-hero {
          position: relative;
          z-index: 1;
          height: 100svh;
          min-height: 0;
          overflow: hidden;
        }
        .ep-landing-grocery-hero {
          display: flex;
          align-items: center;
          background: ${GROCERY_COLORS.porcelain} !important;
          color: ${GROCERY_COLORS.charcoal} !important;
        }
        .ep-landing-grocery-hero__image {
          position: absolute;
          inset: 0;
          z-index: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 62% center;
        }
        .ep-landing-grocery-hero__content {
          position: relative;
          z-index: 2;
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          padding: clamp(22px,5vw,82px);
        }
        .ep-landing-grocery-hero__panel {
          width: min(520px,49vw);
          padding: clamp(24px,3.5vw,48px);
          background: ${GROCERY_COLORS.porcelain} !important;
          border-left: 5px solid ${GROCERY_COLORS.forest};
          color: ${GROCERY_COLORS.charcoal} !important;
          box-shadow: 0 14px 36px rgba(32,36,33,.15);
        }
        .ep-landing-grocery-hero__eyebrow {
          margin: 0 0 16px;
          color: ${GROCERY_COLORS.forest} !important;
          font-size: 14px !important;
          font-weight: 700;
          letter-spacing: .07em;
          line-height: 1.4;
          text-transform: uppercase;
        }
        .ep-landing-grocery-hero__eyebrow span {
          color: ${GROCERY_COLORS.forest} !important;
          background: none !important;
          -webkit-text-fill-color: ${GROCERY_COLORS.forest} !important;
          filter: none;
        }
        .ep-landing-grocery-hero__title {
          margin: 0;
          color: ${GROCERY_COLORS.charcoal} !important;
          font-size: clamp(44px,5.4vw,82px) !important;
          font-weight: 700 !important;
          line-height: 1.02 !important;
          letter-spacing: -.055em;
          overflow-wrap: normal;
          background: none !important;
          -webkit-text-fill-color: ${GROCERY_COLORS.charcoal} !important;
          filter: none;
        }
        .ep-landing-grocery-hero__title span {
          display: block;
          color: ${GROCERY_COLORS.forest} !important;
          background: none !important;
          -webkit-text-fill-color: ${GROCERY_COLORS.forest} !important;
          filter: none;
        }
        .ep-landing-grocery-hero__subline {
          margin: 20px 0 0;
          padding: 0;
          border: 0;
          color: ${GROCERY_COLORS.charcoal} !important;
          font-size: 17px !important;
          font-weight: 600;
          line-height: 1.55;
          background: none !important;
          -webkit-text-fill-color: ${GROCERY_COLORS.charcoal} !important;
          filter: none;
        }
        /* EPANTRY: centered grocery scroll cue */
        .ep-landing-grocery-hero__scroll {
          position: absolute;
          left: 50%;
          right: auto;
          bottom: clamp(28px,5vw,70px);
          z-index: 2;
          display: grid;
          width: 64px;
          height: 64px;
          place-items: center;
          transform: translateX(-50%);
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent !important;
          color: #F7F6F2 !important;
          pointer-events: none;
        }
        .ep-landing-grocery-hero__scroll-icon {
          display: grid;
          width: 64px;
          height: 64px;
          place-items: center;
          border: 0;
          border-radius: 0;
          background: transparent !important;
          color: #F7F6F2 !important;
          animation: epantry-grocery-scroll-down 1.8s ease-in-out infinite;
          filter: drop-shadow(0 2px 3px rgba(15, 35, 29, .9)) drop-shadow(0 0 6px rgba(15, 35, 29, .55));
        }
        .ep-landing-grocery-hero__scroll-icon svg {
          width: 46px;
          height: 46px;
          transform: rotate(90deg);
        }
        @keyframes epantry-grocery-scroll-down {
          0%,100% { transform: translateY(-5px); opacity: .85; }
          50% { transform: translateY(8px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ep-landing-grocery-hero__scroll-icon { animation: none !important; }
        }
        .ep-landing-grocery-gallery {
          position: sticky;
          top: 0;
          box-sizing: border-box;
          display: grid;
          height: 100svh;
          min-height: 0;
          overflow: hidden;
          grid-template-rows: auto minmax(0,1fr);
          gap: clamp(10px,1.4svh,16px);
          padding: clamp(75px,9svh,94px) clamp(18px,4vw,72px) clamp(12px,2svh,22px);
          z-index: 3;
          margin-top: 0;
          border-radius: 0;
          box-shadow: none;
          background: ${GROCERY_COLORS.sage} !important;
          color: ${GROCERY_COLORS.charcoal} !important;
        }
        /* Let visitors read Grocery before the next hero slides in,
           with a slightly shorter hold than the earlier 210svh. */
        .ep-landing-grocery-exit-hold {
          position: relative;
          height: 185svh;
          pointer-events: none;
        }
        .ep-landing-grocery-gallery__header {
          display: flex;
          flex: 0 0 auto;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
        }
        .ep-landing-grocery-gallery__eyebrow {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 5px;
          color: ${GROCERY_COLORS.forest} !important;
          font-size: 14px;
          font-weight: 600;
          line-height: 20px;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .ep-landing-grocery-gallery__eyebrow::before {
          width: 19px;
          height: 2px;
          flex-shrink: 0;
          background: ${GROCERY_COLORS.clay};
          content: '';
        }
        .ep-landing-grocery-gallery__heading {
          margin: 0;
          color: ${GROCERY_COLORS.charcoal} !important;
          font-size: clamp(30px,3.5vw,50px) !important;
          font-weight: 600;
          line-height: 1.12 !important;
          letter-spacing: -.047em;
          text-wrap: balance;
        }
        .ep-landing-grocery-gallery__link {
          display: inline-flex;
          min-height: 48px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 10px 16px 10px 20px;
          border: 1px solid ${GROCERY_COLORS.forest};
          border-radius: 100px;
          background: ${GROCERY_COLORS.forest} !important;
          color: ${GROCERY_COLORS.porcelain} !important;
          font-size: 15px;
          font-weight: 600;
          line-height: 20px;
          text-decoration: none;
          transition: transform 220ms ease, background-color 220ms ease;
        }
        .ep-landing-grocery-gallery__link svg { flex-shrink: 0; }
        .ep-landing-grocery-gallery__link:hover { transform: translateY(-2px); }
        .ep-landing-grocery-gallery__grid {
          display: grid;
          min-height: 0;
          overflow: hidden;
          grid-template-columns: repeat(4,minmax(0,1fr));
          grid-template-rows: repeat(2,minmax(0,1fr));
          align-items: stretch;
          gap: clamp(10px,1.3svh,16px) clamp(12px,1.6vw,22px);
        }
        .ep-landing-grocery-card {
          box-sizing: border-box;
          display: flex;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          flex-direction: column;
          border: 1px solid rgba(23,63,53,.16);
          border-radius: 16px;
          background: ${GROCERY_COLORS.porcelain} !important;
          color: ${GROCERY_COLORS.charcoal} !important;
          transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
        }
        .ep-landing-grocery-card:hover {
          transform: translateY(-4px);
          border-color: ${GROCERY_COLORS.forest};
          box-shadow: 0 12px 24px rgba(32,36,33,.10);
        }
        .ep-landing-grocery-card__main {
          display: flex;
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
          flex-direction: column;
          color: ${GROCERY_COLORS.charcoal} !important;
          text-decoration: none;
        }
        .ep-landing-grocery-card__image-wrap {
          position: relative;
          display: grid;
          width: 100%;
          height: auto;
          min-height: 0;
          flex: 1 1 auto;
          place-items: center;
          overflow: hidden;
          border: 0;
          border-bottom: 1px solid rgba(23,63,53,.12);
          border-radius: 0;
          background: ${GROCERY_COLORS.porcelain} !important;
        }
        .ep-landing-grocery-card__image {
          display: block;
          width: calc(100% - 32px);
          height: calc(100% - 28px);
          max-width: 100%;
          max-height: 100%;
          min-height: 0;
          padding: 0;
          object-fit: contain;
          object-position: center;
          transform: none !important;
        }
        .ep-landing-grocery-card__no-image {
          display: grid;
          width: 100%;
          height: 100%;
          place-items: center;
          color: ${GROCERY_COLORS.forest} !important;
          font-size: 16px;
          font-weight: 600;
        }
        .ep-landing-grocery-card__text {
          display: flex;
          min-height: 0;
          flex: 0 0 auto;
          flex-direction: column;
          gap: clamp(1px,.35svh,5px);
          padding: clamp(7px,.75svh,12px) 14px clamp(3px,.5svh,7px);
        }
        .ep-landing-grocery-card__category {
          display: block;
          overflow: hidden;
          color: ${GROCERY_COLORS.forest} !important;
          font-size: 13px;
          font-weight: 750;
          line-height: 19px;
          letter-spacing: .02em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ep-landing-grocery-card__name {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          color: ${GROCERY_COLORS.charcoal} !important;
          font-size: clamp(16px,1.35vw,19px);
          font-weight: 750;
          line-height: 1.3;
          letter-spacing: -.02em;
        }
        .ep-landing-grocery-card__extra {
          display: block;
          overflow: hidden;
          color: ${GROCERY_COLORS.forest} !important;
          font-size: 13px;
          line-height: 19px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ep-landing-grocery-card__action {
          display: flex;
          min-height: 44px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 0 14px clamp(3px,.5svh,7px);
          padding: 3px 0 0;
          border: 0;
          border-top: 1px solid rgba(23,63,53,.23);
          border-radius: 0;
          background: transparent !important;
          color: ${GROCERY_COLORS.forest} !important;
          font-size: 15px;
          font-weight: 750;
          line-height: 20px;
          text-align: left;
          cursor: pointer;
        }
        .ep-landing-grocery-card__action-icon {
          display: grid;
          width: clamp(27px,3.6svh,36px);
          height: clamp(27px,3.6svh,36px);
          flex-shrink: 0;
          place-items: center;
          border-radius: 50%;
          background: ${GROCERY_COLORS.forest} !important;
          color: ${GROCERY_COLORS.porcelain} !important;
          transition: transform 220ms ease;
        }
        .ep-landing-grocery-card__action:hover .ep-landing-grocery-card__action-icon {
          transform: translateX(3px);
        }
        .ep-landing-grocery-gallery :is(a,button):focus-visible {
          outline: 3px solid ${GROCERY_COLORS.clay};
          outline-offset: 2px;
        }
        .ep-landing-grocery-gallery__empty {
          display: flex;
          min-width: 0;
          min-height: 0;
          grid-column: 1 / -1;
          grid-row: 1 / -1;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 24px;
          color: ${GROCERY_COLORS.charcoal};
          text-align: center;
        }
        .ep-landing-grocery-gallery__empty a { color: ${GROCERY_COLORS.forest}; }
        @media (max-width:767px) {
          /* Natural touch scrolling; a modest reading hold on phones. */
          .ep-landing-grocery-exit-hold { height: 135svh; }
          .ep-landing-grocery-hero__image { object-position: 68% center; }
          .ep-landing-grocery-hero__content { align-items: flex-end; padding: 20px 18px 105px; }
          .ep-landing-grocery-hero__panel { width: min(100%,470px); padding: 22px; }
          .ep-landing-grocery-hero__eyebrow { margin-bottom: 10px; font-size: 12px !important; }
          .ep-landing-grocery-hero__title { font-size: clamp(43px,11vw,60px) !important; }
          .ep-landing-grocery-hero__subline { margin-top: 13px; font-size: 15px !important; }
          .ep-landing-grocery-hero__scroll { left: 50%; right: auto; bottom: 28px; }
          .ep-landing-grocery-hero__scroll-icon { width: 52px; height: 52px; }
          .ep-landing-grocery-hero__scroll-icon svg { width: 40px; height: 40px; }
          .ep-landing-grocery-gallery {
            gap: clamp(7px,1svh,12px);
            padding: clamp(62px,8.5svh,78px) 12px clamp(9px,1.5svh,17px);
            border-radius: 0;
          }
          .ep-landing-grocery-gallery__header { align-items: center; gap: 7px; }
          .ep-landing-grocery-gallery__eyebrow { font-size: 12px; line-height: 16px; }
          .ep-landing-grocery-gallery__heading { font-size: clamp(24px,6.4vw,32px) !important; }
          .ep-landing-grocery-gallery__link {
            min-height: 44px;
            padding: 8px 10px;
            gap: 5px;
            font-size: 12px;
            white-space: nowrap;
          }
          .ep-landing-grocery-gallery__link svg { width: 15px; }
          .ep-landing-grocery-gallery__grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
            grid-template-rows: repeat(2,minmax(0,1fr));
            gap: clamp(7px,1.1svh,11px) 9px;
          }
          .ep-landing-grocery-card:nth-child(n+5) { display: none; }
          .ep-landing-grocery-card { border-radius: 12px; }
          .ep-landing-grocery-card__image-wrap { height: auto; min-height: 0; flex: 1 1 auto; }
          .ep-landing-grocery-card__category { font-size: 12px; line-height: 17px; }
          .ep-landing-grocery-card__text { padding: clamp(5px,.7svh,9px) 9px 2px; gap: 2px; }
          .ep-landing-grocery-card__name { font-size: 14px; line-height: 18px; }
          .ep-landing-grocery-card__extra { font-size: 12px; line-height: 16px; }
          .ep-landing-grocery-card__action { min-height: 44px; margin: 0 9px 3px; font-size: 13px; }
          .ep-landing-grocery-card__action-icon { width: 29px; height: 29px; }
          .ep-landing-grocery-card__action-icon svg { width: 16px; }
        }
        @media (max-width:380px) {
          .ep-landing-grocery-gallery { padding: clamp(61px,8.5svh,76px) 9px 8px; gap: 6px; }
          .ep-landing-grocery-gallery__heading { font-size: 22px !important; }
          .ep-landing-grocery-gallery__grid { gap: 8px; }
          .ep-landing-grocery-card__text { padding-top: 8px; }
        }
        @media (max-height:760px) {
          .ep-landing-grocery-gallery { gap: 7px; padding-top: 65px; padding-bottom: 8px; }
          .ep-landing-grocery-gallery__heading { font-size: clamp(22px,2.7vw,35px) !important; }
          .ep-landing-grocery-gallery__eyebrow { margin-bottom: 1px; }
          .ep-landing-grocery-gallery__link { min-height: 40px; padding-top: 6px; padding-bottom: 6px; }
          .ep-landing-grocery-gallery__grid { gap: 7px 10px; }
          .ep-landing-grocery-card__text { padding-top: 5px; padding-bottom: 1px; gap: 1px; }
          .ep-landing-grocery-card__name { font-size: 14px; line-height: 1.2; }
          .ep-landing-grocery-card__action { min-height: 44px; }
        }
        @media (max-width:767px) and (max-height:740px) {
          .ep-landing-grocery-gallery { padding-top: 58px; }
          .ep-landing-grocery-gallery__heading { font-size: 23px !important; }
          .ep-landing-grocery-gallery__link { min-height: 38px; }
          .ep-landing-grocery-card__category { line-height: 15px; }
          .ep-landing-grocery-card__extra { line-height: 15px; }
          .ep-landing-grocery-card__action { min-height: 44px; }
        }
        @media (prefers-reduced-motion:reduce) {
          .ep-landing-grocery-card,
          .ep-landing-grocery-card__image,
          .ep-landing-grocery-card__action-icon,
          .ep-landing-grocery-gallery__link { transition: none; }
        }
      `}</style>

      <div ref={groceryHeroRef} className="ep-landing-grocery-hero">
        <img
          className="ep-landing-grocery-hero__image"
          src="/hero/grocery.png"
          alt=""
          loading="lazy"
          decoding="async"
        />
        <div className="ep-landing-grocery-hero__content">
          <div className="ep-landing-grocery-hero__panel">
            <p className="ep-landing-grocery-hero__eyebrow"><span>Good food starts here</span></p>
            <h2 className="ep-landing-grocery-hero__title">Featured <span>Grocery</span></h2>
            <p className="ep-landing-grocery-hero__subline">Fresh finds and everyday favourites, all in one place.</p>
          </div>
        </div>
        <div className="ep-landing-grocery-hero__scroll" aria-hidden="true">
          <span className="ep-landing-grocery-hero__scroll-icon"><ArrowRight size={46} strokeWidth={2.2} /></span>
        </div>
      </div>

      <div
        id="ep-landing-grocery-gallery"
        className="ep-landing-grocery-gallery"
        aria-labelledby="ep-landing-grocery-title"
      >
        <div className="ep-landing-grocery-gallery__header">
          <div>
            <span className="ep-landing-grocery-gallery__eyebrow">Featured grocery</span>
            <h2 id="ep-landing-grocery-title" className="ep-landing-grocery-gallery__heading">Find something good.</h2>
          </div>
          <Link className="ep-landing-grocery-gallery__link" to="/grocery">
            Explore Grocery <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>

        <div className="ep-landing-grocery-gallery__grid">
          {items.length === 0 ? (
            <div className="ep-landing-grocery-gallery__empty">
              <p>Published grocery products will appear here when available.</p>
              <Link to="/grocery">Browse Grocery <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          ) : (
            items.map((product, index) => {
              const productPath = product?.path || (
                product?.slug ? `/grocery/product/${encodeURIComponent(product.slug)}` : '/grocery'
              )
              const pack = [
                product?.quantity != null ? String(product.quantity) : '',
                product?.unit || '',
              ].filter(Boolean).join(' ')
              const detail = [product?.brand, pack].filter(Boolean).join(' / ')
              return (
                <article
                  key={product?.id || product?.slug || `grocery-${index}`}
                  className="ep-landing-grocery-card"
                >
                  <Link
                    to={productPath}
                    className="ep-landing-grocery-card__main"
                    aria-label={`View ${product?.name || 'grocery product'}`}
                  >
                    <div className="ep-landing-grocery-card__image-wrap">
                      {product?.image ? (
                        <img
                          className="ep-landing-grocery-card__image"
                          src={product.image}
                          alt={product?.name || 'Grocery product'}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="ep-landing-grocery-card__no-image">EPANTRY</span>
                      )}
                    </div>
                    <div className="ep-landing-grocery-card__text">
                      <span className="ep-landing-grocery-card__category">
                        {product?.subCategory || 'Grocery'}
                      </span>
                      <span className="ep-landing-grocery-card__name">{product?.name || 'Grocery product'}</span>
                      {detail ? <span className="ep-landing-grocery-card__extra">{detail}</span> : null}
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="ep-landing-grocery-card__action"
                    onClick={() => onAddToCart(product)}
                    aria-label={`Add ${product?.name || 'product'} to cart`}
                  >
                    <span>Add to cart</span>
                    <span className="ep-landing-grocery-card__action-icon">
                      <ArrowRight size={17} aria-hidden="true" />
                    </span>
                  </button>
                </article>
              )
            })
          )}
        </div>
      </div>
      <div className="ep-landing-grocery-exit-hold" aria-hidden="true" />
    </section>
  )
}

/*
|--------------------------------------------------------------------------
| Featured Recipes and Featured Brands: same approved Grocery visual system.
| Hero images come from their EXISTING pages, never fabricated.
| Existing navigation, brand-range filters and real API data are preserved.
|--------------------------------------------------------------------------
*/

const FEATURED_DISCOVERY_CONFIG = {
  recipes: {
    hero: '/hero/recipe.png',
    title: 'Recipes',
    label: 'Made to be shared',
    description: 'Find a dish you love and make it your own.',
    eyebrow: 'Featured recipes',
    galleryTitle: 'Something worth cooking.',
    explore: 'Explore Recipes',
    path: '/recipes',
    empty: 'Published recipes will appear here when available.',
  },
  brands: {
    hero: '/hero/brand.png',
    title: 'Brands',
    label: 'Discover the makers',
    description: 'Explore the food brands behind your favourites.',
    eyebrow: 'Featured brands',
    galleryTitle: 'Meet the makers.',
    explore: 'Explore Brands',
    path: '/brands',
    empty: 'Active food brands will appear here when available.',
  },
}

/*
 * Two distinct landing experiences reuse the existing featured API.
 * Recipes: full-height, image-led 8/4 grid; Brands: restored typographic
 * left/right motion wall instead of cards. The Grocery section is unchanged.
 */
function FeaturedDiscoverySection({
  kind,
  items,
  groups = [],
  selectedFilter = 'all',
  onSelectFilter,
}) {
  const config = FEATURED_DISCOVERY_CONFIG[kind]
  const sectionRef = useRef(null)
  const heroRef = useRef(null)
  const displayItems = Array.isArray(items) ? (kind === 'recipes' ? items.slice(0, 8) : items) : []

  // Keep the Guide accessible without covering links inside either gallery.
  // The guide itself switches to a slim edge-tab while any gallery is visible.
  useEffect(() => {
    const gallery = sectionRef.current?.querySelector(kind === 'recipes' ? '.ep-recipe-showcase' : '.ep-brand-motion')
    const flag = `epantry-reading-${kind}-gallery`
    if (!gallery || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      document.body.classList.toggle(flag, entry.isIntersecting && entry.intersectionRatio > 0.2)
    }, { threshold: [0, 0.2, 0.5], rootMargin: '-12% 0px -12% 0px' })
    observer.observe(gallery)
    return () => {
      observer.disconnect()
      document.body.classList.remove(flag)
    }
  }, [kind])

  useEffect(() => {
    const section = sectionRef.current
    const hero = heroRef.current
    if (!section || !hero) return undefined
    const update = () => {
      const total = section.getBoundingClientRect().height
      const gallery = section.querySelector(kind === 'recipes' ? '.ep-recipe-showcase' : '.ep-brand-motion')
      const first = gallery ? gallery.getBoundingClientRect().top - section.getBoundingClientRect().top : hero.getBoundingClientRect().height
      if (total > 0) {
        // Recipes' final viewport is only a visual hold while the Brands hero
        // slides over it, not a separately navigable mobile story stop.
        const travel = kind === 'recipes'
          ? Math.max(total - hero.getBoundingClientRect().height, 1)
          : total
        section.dataset.landingStops = `0,${Math.max(0,Math.min(first / travel, 1)).toFixed(5)}`
      }
    }
    update()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(section)
    observer?.observe(hero)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [kind, displayItems.length, selectedFilter])

  return (
    <section
      ref={sectionRef}
      className={`ep-featured-story ep-featured-story--${kind}`}
      data-landing-story={kind}
      data-landing-stops="0,0.5"
      data-landing-static="true"
      aria-label={`Featured ${kind} discovery`}
    >
      <style>{`
        .ep-featured-story { position:relative; isolation:isolate; }
        /* Recipes hero is a full-screen sheet sliding over the pinned
           Grocery gallery; its own gallery comes next in normal flow. */
        .ep-featured-story--recipes { margin-top:-100svh; z-index:4; }
        .ep-featured-story--recipes .ep-featured-photo { position:relative; }
        .ep-featured-story--recipes .ep-recipe-showcase {
          position:sticky; top:0;
          margin-top:0; border-radius:0; box-shadow:none;
        }
        /* Same reading comfort as Grocery, with a modest 185svh exit hold.
           Brands' existing scroll layout is untouched. */
        .ep-featured-story--recipes .ep-recipe-exit-hold {
          position:relative; height:185svh; pointer-events:none;
        }
        .ep-featured-story--brands { margin-top:-100svh; z-index:5; }
        .ep-featured-story--brands .ep-featured-photo { position:relative; }
        .ep-featured-story--brands .ep-brand-motion {
          margin-top:0; border-radius:0; box-shadow:none;
        }
        .ep-featured-story * { box-sizing:border-box; }
        .ep-featured-photo {
          position:sticky; top:0; z-index:1; height:100svh; overflow:hidden;
          background:#F7F6F2 !important;
        }
        .ep-featured-photo__img {
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:cover; object-position:center; z-index:0;
        }
        .ep-featured-story--brands .ep-featured-photo__img { object-position:66% center; }
        .ep-featured-photo__content {
          position:relative; z-index:2; height:100%; display:flex; align-items:center;
          padding:clamp(22px,5vw,82px);
        }
        .ep-featured-photo__panel {
          width:min(520px,49vw); padding:clamp(24px,3.5vw,48px);
          background:#F7F6F2 !important;
          border-left:5px solid #173F35;
          color:#202421 !important;
          box-shadow:0 14px 36px rgba(32,36,33,.15);
        }
        .ep-featured-photo__eyebrow {
          margin:0 0 16px; color:#173F35 !important;
          font-size:14px !important; font-weight:700; letter-spacing:.07em;
          line-height:1.4; text-transform:uppercase;
        }
        .ep-featured-photo__heading {
          margin:0; color:#202421 !important;
          font-size:clamp(44px,5.4vw,82px) !important;
          font-weight:700 !important; line-height:1.02 !important;
          letter-spacing:-.055em; overflow-wrap:normal;
        }
        .ep-featured-photo__heading span { display:block; color:#173F35 !important; }
        .ep-featured-photo__description {
          margin:20px 0 0; color:#202421 !important; font-size:17px !important;
          font-weight:600; line-height:1.55;
        }
        /* Recipes + Brands hero: centered, ivory, borderless downward arrow. */
        .ep-featured-photo__cue {
          position:absolute; left:50%; right:auto; bottom:clamp(28px,5vw,70px); z-index:2;
          display:grid; width:64px; height:64px; place-items:center;
          transform:translateX(-50%); padding:0; border:0; border-radius:0;
          background:transparent !important; color:#F7F6F2 !important;
          pointer-events:none;
        }
        .ep-featured-photo__cue-icon {
          display:grid; width:64px; height:64px; place-items:center;
          color:#F7F6F2 !important;
          animation:epantry-discovery-cue 1.8s ease-in-out infinite;
          filter:drop-shadow(0 2px 3px rgba(15,35,29,.9)) drop-shadow(0 0 6px rgba(15,35,29,.55));
        }
        .ep-featured-photo__cue-icon svg { width:46px; height:46px; transform:rotate(90deg); }
        @keyframes epantry-discovery-cue {
          0%,100% { transform:translateY(-5px); opacity:.85; }
          50% { transform:translateY(8px); opacity:1; }
        }
        @media (prefers-reduced-motion:reduce) {
          .ep-featured-photo__cue-icon { animation:none !important; }
        }
        .ep-recipe-showcase {
          position:relative; z-index:3;
          margin-top:0;
          height:100svh; min-height:0; display:flex; flex-direction:column;
          gap:clamp(14px,2svh,22px); padding:clamp(76px,9svh,94px) clamp(16px,4vw,70px) clamp(12px,2svh,22px);
          border-radius:24px 24px 0 0;
          box-shadow:0 -8px 28px rgba(32,36,33,.10);
          background:#DCE0CF !important; color:#202421 !important;
        }
        .ep-recipe-showcase__head {
          flex:0 0 auto; display:flex; align-items:end; justify-content:space-between;
          gap:16px;
        }
        .ep-recipe-showcase__label {
          margin:0 0 4px; color:#173F35 !important;
          font-size:13px !important; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
        }
        .ep-recipe-showcase__title {
          margin:0; color:#202421 !important; font-size:clamp(26px,3vw,44px) !important;
          font-weight:700 !important; line-height:1.1 !important;
        }
        .ep-recipe-showcase__explore {
          flex-shrink:0; display:inline-flex; align-items:center; gap:8px;
          background:#173F35 !important; color:#F7F6F2 !important;
          padding:12px 17px; min-height:44px; border-radius:999px;
          text-decoration:none; font-size:14px; font-weight:700;
        }
        .ep-recipe-showcase__grid {
          min-height:0; flex:1 1 auto; display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          grid-template-rows:repeat(2,minmax(0,1fr)); gap:clamp(10px,1.45vw,20px);
        }
        .ep-recipe-tile {
          position:relative; min-width:0; min-height:0; display:flex;
          flex-direction:column; overflow:hidden; border-radius:14px;
          background:#F7F6F2 !important; border:1px solid #173F35;
          color:#202421 !important; text-decoration:none;
          transition:transform .22s ease,box-shadow .22s ease;
        }
        .ep-recipe-tile:hover { transform:translateY(-3px); box-shadow:0 8px 20px rgba(32,36,33,.13); }
        .ep-recipe-tile__image {
          display:block; flex:1 1 auto; min-height:0; overflow:hidden;
          background:#F7F6F2 !important;
        }
        .ep-recipe-tile__image img {
          display:block; width:100%; height:100%; object-fit:cover; object-position:center;
        }
        .ep-recipe-tile__fallback {
          display:grid; place-items:center; height:100%; padding:12px; color:#173F35 !important;
          font-size:14px; text-align:center;
        }
        .ep-recipe-tile__details {
          min-width:0; flex:0 0 auto; display:flex; align-items:center; justify-content:space-between;
          gap:7px; padding:10px 12px; background:#F7F6F2 !important;
        }
        .ep-recipe-tile__details > span:first-child { display:block; min-width:0; }
        .ep-recipe-tile__type {
          display:block; margin-bottom:3px; color:#173F35 !important;
          font-size:12px; font-weight:700; line-height:1.2;
          white-space:nowrap; text-overflow:ellipsis; overflow:hidden;
        }
        .ep-recipe-tile__name {
          display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2;
          color:#202421 !important; font-size:15px; font-weight:700; line-height:1.25;
        }
        .ep-recipe-tile__arrow {
          flex:0 0 auto; width:30px; height:30px; display:grid; place-items:center;
          border-radius:100%; color:#F7F6F2 !important; background:#173F35 !important;
        }
        .ep-recipe-showcase__empty {
          grid-column:1/-1; display:grid; place-content:center; gap:10px;
          text-align:center; color:#202421 !important;
        }
        .ep-recipe-showcase__empty a { color:#173F35 !important; }
        .ep-brand-motion {
          position:relative; z-index:3; isolation:isolate;
          margin-top:0;
          height:100svh; min-height:0;
          overflow:hidden; background:#F7F6F2 !important; color:#202421 !important;
          border-radius:24px 24px 0 0;
          box-shadow:0 -8px 28px rgba(32,36,33,.10);
        }
        .ep-brand-motion__mobile-row { display:none; }
        .ep-brand-motion__head {
          position:absolute; z-index:2; top:clamp(74px,10svh,118px);
          left:0; right:0; display:flex; align-items:end; justify-content:space-between; gap:14px;
          padding:0 clamp(18px,5vw,80px);
        }
        .ep-brand-motion__head h2 {
          margin:0; color:#202421 !important;
          font-size:clamp(30px,4.3vw,64px) !important; font-weight:700;
          letter-spacing:-.045em; line-height:1.05 !important;
        }
        .ep-brand-motion__head p {
          margin:0 0 7px; color:#173F35 !important; font-size:14px; font-weight:700;
          letter-spacing:.06em; text-transform:uppercase;
        }
        .ep-brand-motion__actions {
          flex:0 0 auto; display:flex; align-items:center; justify-content:flex-end; gap:10px;
          min-width:0;
        }
        .ep-brand-motion__all {
          display:inline-flex; flex:0 0 auto; align-items:center; gap:8px;
          min-height:44px; border:1px solid #173F35; border-radius:99px;
          padding:9px 15px; background:#173F35 !important; color:#F7F6F2 !important;
          font-size:14px; font-weight:700; text-decoration:none;
        }
        .ep-brand-motion__filters {
          display:flex; align-items:center; gap:8px; min-width:0;
          overflow-x:auto; scrollbar-width:none;
        }
        .ep-brand-motion__filters::-webkit-scrollbar { display:none; }
        .ep-brand-motion__filters button {
          flex:0 0 auto; min-height:40px; border:1px solid #173F35;
          border-radius:99px; padding:8px 16px;
          background:#F7F6F2 !important; color:#173F35 !important;
          font-size:13px; font-weight:700; cursor:pointer;
        }
        .ep-brand-motion__filters button[aria-pressed="true"] {
          background:#173F35 !important; color:#F7F6F2 !important;
        }
        .ep-brand-motion__row {
          position:absolute; left:0; right:0;
          width:100%; min-height:0; overflow:hidden;
          -webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);
          mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);
        }
        .ep-brand-motion__row--first { top:34svh; }
        .ep-brand-motion__row--sage { top:68svh; }
        .ep-brand-motion__mobile-row { position:absolute; top:70svh; left:0; right:0; }
        .ep-brand-motion__mobile-row .ep-brand-motion__row { position:relative; top:auto; }
        .ep-brand-motion__track { display:flex; width:max-content; will-change:transform; }
        .ep-brand-motion__sequence { flex:0 0 auto; display:flex; align-items:center; gap:28px; padding-right:28px; }
        .ep-brand-motion__name {
          display:flex; flex:0 0 auto; width:clamp(195px,22vw,380px);
          min-height:110px; align-items:center; justify-content:center;
          gap:6px; flex-direction:column; text-decoration:none;
          color:#202421 !important;
        }
        .ep-brand-motion__name strong {
          color:#173F35 !important; font-size:clamp(24px,3vw,48px);
          font-weight:700; line-height:1.07; letter-spacing:-.04em;
          white-space:normal; text-align:center;
        }
        .ep-brand-motion__name small { color:#202421 !important; font-size:13px; }
        .ep-brand-motion__name:hover strong { color:#C86C42 !important; }
        .ep-brand-motion__row--sage {
          padding:15px 0; background:transparent !important;
        }
        @keyframes ep-featured-brand-left {
          from { transform:translate3d(0,0,0); } to { transform:translate3d(-50%,0,0); }
        }
        @keyframes ep-featured-brand-right {
          from { transform:translate3d(-50%,0,0); } to { transform:translate3d(0,0,0); }
        }
        .ep-featured-story :is(a,button):focus-visible {
          outline:3px solid #C86C42; outline-offset:3px;
        }
        @media (max-width:1023px) {
          .ep-brand-motion__head { flex-direction:column; align-items:flex-start; gap:10px; }
          .ep-brand-motion__actions { width:100%; justify-content:flex-end; }
        }
        @media (max-width:767px) {
          .ep-featured-photo__content { align-items:flex-end; padding:20px 18px 105px; }
          .ep-featured-photo__panel { width:min(100%,470px); padding:22px; }
          .ep-featured-photo__eyebrow { font-size:12px !important; margin-bottom:10px; }
          .ep-featured-photo__heading { font-size:clamp(43px,11vw,60px) !important; }
          .ep-featured-photo__description { font-size:15px !important; margin-top:13px; }
          .ep-featured-story--recipes .ep-recipe-exit-hold { height:135svh; }
          .ep-featured-photo__cue { left:50%; right:auto; bottom:28px; }
          .ep-featured-photo__cue,.ep-featured-photo__cue-icon { width:52px; height:52px; }
          .ep-featured-photo__cue-icon svg { width:40px; height:40px; }
          .ep-recipe-showcase { padding:clamp(66px,9svh,80px) 12px 15px; gap:12px; border-radius:18px 18px 0 0; }
          .ep-recipe-showcase__title { font-size:25px !important; }
          .ep-recipe-showcase__label { font-size:12px !important; }
          .ep-recipe-showcase__explore { min-height:42px; padding:9px 10px; font-size:12px; gap:4px; }
          .ep-recipe-showcase__grid {
            grid-template-columns:repeat(2,minmax(0,1fr));
            grid-template-rows:repeat(2,minmax(0,1fr)); gap:10px;
          }
          .ep-recipe-tile:nth-child(n+5) { display:none; }
          .ep-recipe-tile__details { padding:7px 8px; }
          .ep-recipe-tile__type { font-size:11px; }
          .ep-recipe-tile__name { font-size:13px; }
          .ep-recipe-tile__arrow { width:26px; height:26px; }
          .ep-brand-motion__mobile-row { display:block; }
          .ep-brand-motion { border-radius:18px 18px 0 0; }
          .ep-brand-motion__head { top:clamp(30px,6svh,66px); }
          .ep-brand-motion__actions { gap:7px; }
          .ep-brand-motion__filters { gap:6px; }
          .ep-brand-motion__filters button { min-height:38px; padding:7px 11px; font-size:12px; }
          .ep-brand-motion__all { min-height:38px; padding:7px 11px; font-size:12px; }
          .ep-brand-motion__row--first { top:25svh; }
          .ep-brand-motion__row--sage { top:47svh; }
          .ep-brand-motion__head h2 { font-size:32px !important; }
          .ep-brand-motion__name { width:clamp(150px,52vw,240px); min-height:90px; }
          .ep-brand-motion__name strong { font-size:clamp(22px,6.1vw,32px); }
          .ep-brand-motion__row { padding:12px 0; }
          .ep-brand-motion__name small { font-size:12px; }

          /* Mobile-only: keep the original moving brand rows intact.
             Align only the filters and Explore Brands action below the heading. */
          .ep-featured-story--brands .ep-brand-motion__head {
            align-items:flex-start;
          }
          .ep-featured-story--brands .ep-brand-motion__actions {
            width:100%; min-width:0;
            display:flex; flex-wrap:nowrap;
            align-items:center; justify-content:space-between;
            gap:8px;
          }
          .ep-featured-story--brands .ep-brand-motion__filters {
            display:flex; flex:0 1 auto; min-width:0; gap:6px;
            overflow-x:auto; scrollbar-width:none;
          }
          .ep-featured-story--brands .ep-brand-motion__all {
            margin-left:auto; flex:0 0 auto; white-space:nowrap;
            padding:8px 10px; min-height:38px;
            font-size:12px !important;
          }
        }
        /* Match the approved Grocery single-viewport gallery at all heights. */
        @media (prefers-reduced-motion:reduce) {
          .ep-recipe-tile { transition:none; }
          .ep-brand-motion__track { animation:none !important; transform:none !important; }
        }
      `}</style>
      <div className="ep-featured-photo" ref={heroRef}>
        <img className="ep-featured-photo__img" src={config.hero} alt="" loading="lazy" decoding="async" />
        <div className="ep-featured-photo__content">
          <div className="ep-featured-photo__panel">
            <p className="ep-featured-photo__eyebrow">{config.label}</p>
            <h2 className="ep-featured-photo__heading">Featured <span>{config.title}</span></h2>
            <p className="ep-featured-photo__description">{config.description}</p>
          </div>
        </div>
        <div className="ep-featured-photo__cue" aria-hidden="true">
          <span className="ep-featured-photo__cue-icon"><ArrowRight size={46} strokeWidth={2.2} /></span>
        </div>
      </div>
      {kind === 'recipes' ? (
        <>
        <div className="ep-recipe-showcase" aria-labelledby="ep-featured-recipes-title">
          <div className="ep-recipe-showcase__head">
            <div>
              <p className="ep-recipe-showcase__label">Featured recipes</p>
              <h2 id="ep-featured-recipes-title" className="ep-recipe-showcase__title">Find your next favourite.</h2>
            </div>
            <Link className="ep-recipe-showcase__explore" to="/recipes">Explore Recipes <ArrowRight size={16} /></Link>
          </div>
          <div className="ep-recipe-showcase__grid">
            {displayItems.length === 0 ? (
              <div className="ep-recipe-showcase__empty">
                <p>{config.empty}</p>
                <Link to="/recipes">Browse recipes <ArrowRight size={16} /></Link>
              </div>
            ) : displayItems.map((recipe, index) => {
              const path = recipe?.path || (recipe?.slug ? `/recipes/${encodeURIComponent(recipe.slug)}` : '/recipes')
              return (
                <Link key={recipe?.id || recipe?.slug || index} className="ep-recipe-tile" to={path} aria-label={`View ${recipe?.name || 'recipe'}`}>
                  <div className="ep-recipe-tile__image">
                    {recipe?.image ? (
                      <img src={recipe.image} alt={recipe?.name || 'Recipe'} loading="lazy" decoding="async" />
                    ) : (
                      <span className="ep-recipe-tile__fallback">Recipe photo coming soon</span>
                    )}
                  </div>
                  <div className="ep-recipe-tile__details">
                    <span>
                      <span className="ep-recipe-tile__type">{recipe?.cuisine || recipe?.dietaryType || 'Recipe'}</span>
                      <span className="ep-recipe-tile__name">{recipe?.name || 'Recipe'}</span>
                    </span>
                    <span className="ep-recipe-tile__arrow"><ArrowRight size={16} /></span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="ep-recipe-exit-hold" aria-hidden="true" />
        </>
      ) : (
        <FeaturedBrandNamesWall
          brands={displayItems}
          groups={groups}
          selectedFilter={selectedFilter}
          onSelectFilter={onSelectFilter}
        />
      )}
    </section>
  )
}

function FeaturedBrandNamesWall({ brands, groups, selectedFilter, onSelectFilter }) {
  const list = Array.isArray(brands) ? brands : []
  const alternate = list.length > 1 ? [...list.slice(Math.ceil(list.length / 2)), ...list.slice(0, Math.ceil(list.length / 2))] : list
  const third = list.length > 1 ? [...list.slice(1), list[0]] : list
  return (
    <div className="ep-brand-motion" aria-labelledby="ep-featured-brands-title">
      <div className="ep-brand-motion__head">
        <div>
          <p>Featured brands</p>
          <h2 id="ep-featured-brands-title">Meet the makers.</h2>
        </div>
        <div className="ep-brand-motion__actions">
          {onSelectFilter && groups.length > 0 ? (
            <div className="ep-brand-motion__filters" aria-label="Filter brands by name range">
              <button type="button" aria-pressed={selectedFilter === 'all'} onClick={() => onSelectFilter('all')}>All</button>
              {groups.map(group => (
                <button key={group.id} type="button" aria-pressed={selectedFilter === group.id} onClick={() => onSelectFilter(group.id)}>{group.label}</button>
              ))}
            </div>
          ) : null}
          <Link className="ep-brand-motion__all" to="/brands">Explore Brands <ArrowRight size={17} /></Link>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="ep-recipe-showcase__empty">Active food brands will appear here when available.</p>
      ) : (
        <>
          <FeaturedBrandMovingRow brands={list} direction="left" duration={26} rowClass="ep-brand-motion__row--first" />
          <FeaturedBrandMovingRow brands={alternate} direction="right" duration={29} sage />
          <div className="ep-brand-motion__mobile-row"><FeaturedBrandMovingRow brands={third} direction="left" duration={26} /></div>
        </>
      )}
    </div>
  )
}

function FeaturedBrandMovingRow({ brands, direction, duration, sage = false, rowClass = '' }) {
  const [isPaused, setIsPaused] = useState(false)
  // Exactly TWO identical copies, as in the original 26s/29s brand motion.
  // Tripling the sequence made the same animation duration feel too fast.
  const series = brands
  // Repeated *identical* sequences keep the -50% seamless even with few brands.
  const renderNames = (isDuplicate = false) => series.map((brand, index) => (
    isDuplicate ? (
      <span key={`duplicate-${direction}-${index}`} className="ep-brand-motion__name">
        <strong>{brand?.name || 'Brand'}</strong>
        <small>{formatBrandProductCount(brand?.productCount)}</small>
      </span>
    ) : (
      <Link
        key={`${direction}-${brand?.id || brand?.slug || brand?.name}-${index}`}
        className="ep-brand-motion__name"
        to={getFeaturedBrandPath(brand)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <strong>{brand?.name || 'Brand'}</strong>
        <small>{formatBrandProductCount(brand?.productCount)}</small>
      </Link>
    )
  ))
  return (
    <div className={`ep-brand-motion__row${sage ? ' ep-brand-motion__row--sage' : ''}${rowClass ? ` ${rowClass}` : ''}`}>
      <div
        className="ep-brand-motion__track"
        style={{animation:`ep-featured-brand-${direction} ${duration}s linear infinite`, animationPlayState:isPaused?'paused':'running'}}
      >
        <div className="ep-brand-motion__sequence">{renderNames()}</div>
        <div className="ep-brand-motion__sequence" aria-hidden="true">{renderNames(true)}</div>
      </div>
    </div>
  )
}

const FEATURED_BRAND_LIMIT =
  15

function getBrandInitial(
  brand,
) {
  const initial =
    String(
      brand?.name ||
        '',
    )
      .trim()
      .charAt(0)
      .toUpperCase()

  return /^[A-Z]$/.test(
    initial,
  )
    ? initial
    : '#'
}

function sortBrandsAlphabetically(
  brands,
) {
  return [
    ...(Array.isArray(
      brands,
    )
      ? brands
      : []),
  ].sort(
    (left, right) =>
      String(
        left?.name ||
          '',
      ).localeCompare(
        String(
          right?.name ||
            '',
        ),
        undefined,
        {
          sensitivity:
            'base',
        },
      ),
  )
}

function buildBrandFilterGroups(
  brands,
) {
  const sortedBrands =
    sortBrandsAlphabetically(
      brands,
    )

  const buckets =
    new Map()

  for (
    const brand of
    sortedBrands
  ) {
    const initial =
      getBrandInitial(
        brand,
      )

    const current =
      buckets.get(
        initial,
      ) || []

    current.push(
      brand,
    )

    buckets.set(
      initial,
      current,
    )
  }

  const orderedInitials = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '#',
  ].filter(
    (initial) =>
      buckets.has(
        initial,
      ),
  )

  const groups = []
  let currentGroup = null

  const pushCurrentGroup =
    () => {
      if (
        !currentGroup ||
        currentGroup.brands.length ===
          0
      ) {
        return
      }

      groups.push({
        ...currentGroup,
        id:
          `brand-range-${groups.length}-${currentGroup.start}-${currentGroup.end}`,
        label:
          currentGroup.start ===
          currentGroup.end
            ? currentGroup.start
            : `${currentGroup.start}-${currentGroup.end}`,
      })

      currentGroup = null
    }

  for (
    const initial of
    orderedInitials
  ) {
    const bucketBrands =
      buckets.get(
        initial,
      ) || []

    if (
      bucketBrands.length >
      FEATURED_BRAND_LIMIT
    ) {
      pushCurrentGroup()

      for (
        let offset = 0;
        offset <
        bucketBrands.length;
        offset +=
          FEATURED_BRAND_LIMIT
      ) {
        const chunk =
          bucketBrands.slice(
            offset,
            offset +
              FEATURED_BRAND_LIMIT,
          )

        const chunkIndex =
          Math.floor(
            offset /
              FEATURED_BRAND_LIMIT,
          ) +
          1

        groups.push({
          id:
            `brand-range-${groups.length}-${initial}-${chunkIndex}`,
          label:
            `${initial} · ${chunkIndex}`,
          start:
            initial,
          end:
            initial,
          brands:
            chunk,
        })
      }

      continue
    }

    if (!currentGroup) {
      currentGroup = {
        start:
          initial,
        end:
          initial,
        brands: [
          ...bucketBrands,
        ],
      }

      continue
    }

    if (
      currentGroup.brands.length +
        bucketBrands.length <=
      FEATURED_BRAND_LIMIT
    ) {
      currentGroup.end =
        initial

      currentGroup.brands.push(
        ...bucketBrands,
      )

      continue
    }

    pushCurrentGroup()

    currentGroup = {
      start:
        initial,
      end:
        initial,
      brands: [
        ...bucketBrands,
      ],
    }
  }

  pushCurrentGroup()

  return groups
}

function getVisibleBrands({
  brands,
  brandFilterGroups,
  selectedBrandFilter,
}) {
  if (
    selectedBrandFilter ===
    'all'
  ) {
    return sortBrandsAlphabetically(
      brands,
    ).slice(
      0,
      FEATURED_BRAND_LIMIT,
    )
  }

  const selectedGroup =
    brandFilterGroups.find(
      (group) =>
        group.id ===
        selectedBrandFilter,
    )

  if (!selectedGroup) {
    return sortBrandsAlphabetically(
      brands,
    ).slice(
      0,
      FEATURED_BRAND_LIMIT,
    )
  }

  return selectedGroup.brands.slice(
    0,
    FEATURED_BRAND_LIMIT,
  )
}

function getFeaturedBrandPath(
  brand,
) {
  const brandKey =
    String(
      brand?.slug ||
        brand?.id ||
        brand?._id ||
        '',
    ).trim()

  return brandKey
    ? `/brands/${encodeURIComponent(
        brandKey,
      )}`
    : '/brands'
}

function formatBrandProductCount(
  value,
) {
  const count =
    Number.isFinite(
      Number(value),
    )
      ? Math.max(
          0,
          Number(value),
        )
      : 0

  return `${count} ${
    count === 1
      ? 'product'
      : 'products'
  } listed`
}

function FeaturedLoading() {
  return (
    <section className="min-h-[100svh] bg-white">

      <div className="page-shell py-10">

        <div className="animate-pulse">

          <div className="h-3 w-32 rounded bg-[#E5E7EB]" />

          <div className="mt-4 h-9 max-w-xl rounded bg-[#E5E7EB]" />

          <div className="mt-10 grid gap-5 md:grid-cols-3">

            {[1, 2, 3].map(
              (item) => (
                <div
                  key={item}
                  className="h-[360px] rounded-[28px] bg-[#F8FAF7]"
                />
              ),
            )}

          </div>

        </div>

      </div>

    </section>
  )
}

