import { useEffect, useRef, useState } from "react";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { Link } from "react-router-dom";

import {
  motion,
  useReducedMotion,
  useScroll,
  useMotionValue,
  useTransform,
} from "motion/react";

// import ClosingCtaSection from '../components/ClosingCtaSection' // Temporarily hidden; keep component for future re-enable

import FeaturedContentSection from "../components/FeaturedContentSection";

import HeroSection from "../components/HeroSection";

import HowEpantryGuidePopup from "../components/HowEpantryGuidePopup";

import { landingCategories } from "../content/landingContent";

import SponsoredCampaignSlot from "../../retailMedia/components/SponsoredCampaignSlot";

const EXPERIENCE_CARD_IMAGES = {
  grocery: "/exploar/Exploar_G.png",
  brands: "/exploar/Exploar_B.png",
  recipes: "/exploar/Exploar_R.png",
};

const EXPERIENCE_BACKDROP_ROWS = [
  {
    id: "row-01",
    top: "-8%",
    direction: "left",
    duration: 28,
    cardWidth: "clamp(82px, 8.8vw, 142px)",
    opacity: 0.58,
    sequence: ["grocery", "brands", "recipes", "grocery", "brands", "recipes"],
  },
  {
    id: "row-02",
    top: "38%",
    direction: "right",
    duration: 32,
    cardWidth: "clamp(76px, 8.2vw, 132px)",
    opacity: 0.46,
    sequence: ["recipes", "grocery", "brands", "recipes", "grocery", "brands"],
  },
  {
    id: "row-03",
    top: "82%",
    direction: "left",
    duration: 30,
    cardWidth: "clamp(80px, 8.5vw, 138px)",
    opacity: 0.52,
    sequence: ["brands", "recipes", "grocery", "brands", "recipes", "grocery"],
  },
];

export default function LandingPage() {
  // EPANTRY MOBILE NATIVE SCROLL - PERF FIX
  // Leave vertical touch gestures to the browser on phones. The former
  // preventDefault + scripted scrollTo snap conflicted with momentum scrolling
  // and the pinned Featured sections, making the page visibly jerk.
  // Explore's motion progress and gallery reveal still follow native scroll.

  const experienceSectionRef = useRef(null);

  const featuredEntranceRef = useRef(null);

  const shouldReduceMotion = useReducedMotion();

  const experienceCarouselRef = useRef(null);

  const [isSmallViewport, setIsSmallViewport] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false
  );

  const [isExperienceGalleryVisible, setIsExperienceGalleryVisible] = useState(false);

  const [mobileCardIndex, setMobileCardIndex] = useState(0);

  const experienceScrollProgress = useMotionValue(0);

  // Follow the scroll exactly, with a smooth easing curve and no lagging
  // spring. Both planes share this progress so they cannot drift apart.
  const { scrollYProgress: featuredEntranceProgress } = useScroll({
    target: featuredEntranceRef,
    offset: ["start end", "start start"],
  });

  const featuredDepthProgress = useTransform(
    featuredEntranceProgress,
    (progress) => {
      const clamped = Math.min(Math.max(progress, 0), 1);

      return clamped * clamped * (3 - 2 * clamped);
    }
  );

  // The outgoing Explore scene retreats on a separate visual plane.
  // Its sticky container and all existing interactive elements stay put.
  const exploreSceneScale = useTransform(
    featuredDepthProgress,
    [0, 0.5, 1],
    shouldReduceMotion || isSmallViewport ? [1, 1, 1] : [1, 0.955, 0.91]
  );

  const exploreSceneRotateX = useTransform(
    featuredDepthProgress,
    [0, 1],
    shouldReduceMotion || isSmallViewport ? [0, 0] : [0, -3]
  );

  const exploreSceneY = useTransform(
    featuredDepthProgress,
    [0, 1],
    shouldReduceMotion || isSmallViewport ? [0, 0] : [0, -18]
  );

  const exploreDefocusOpacity = useTransform(
    featuredDepthProgress,
    [0, 0.2, 0.7, 1],
    shouldReduceMotion || isSmallViewport ? [0, 0, 0, 0] : [0, 0, 0.82, 1]
  );

  // The incoming Grocery sheet grows into the viewport instead of
  // rotating the sticky element (which can cause scroll judder).
  const groceryEntranceScale = useTransform(
    featuredDepthProgress,
    [0, 0.55, 1],
    shouldReduceMotion || isSmallViewport ? [1, 1, 1] : [0.9, 0.96, 1]
  );

  const groceryEntranceLift = useTransform(
    featuredDepthProgress,
    [0, 1],
    shouldReduceMotion || isSmallViewport ? [0, 0] : [16, 0]
  );

  const groceryEdgeOpacity = useTransform(
    featuredDepthProgress,
    [0, 0.22, 0.7, 1],
    shouldReduceMotion || isSmallViewport ? [0, 0, 0, 0] : [0.65, 0.85, 0.3, 0]
  );

  // Finish the desktop backdrop lift before the gallery entrance.
  // It stays stationary while the cards remain on screen, instead of
  // moving upward on its own during the gallery's scroll hold.
  const backdropVerticalY = useTransform(
    experienceScrollProgress,
    [0, 0.24, 1],
    shouldReduceMotion || isSmallViewport
      ? ["0svh", "0svh", "0svh"]
      : ["0svh", "-18svh", "-18svh"]
  );

  // Mobile uses horizontal parallax rather than the desktop vertical drift.
  const backdropHorizontalX = useTransform(
    experienceScrollProgress,
    [0, 1],
    ["0vw", "0vw"]
  );

  const backdropDepthScale = useTransform(
    experienceScrollProgress,
    [0, 0.5, 1],
    shouldReduceMotion || isSmallViewport ? [1, 1, 1] : [1.025, 1, 1.035]
  );

  const backdropDepthRotateX = useTransform(
    experienceScrollProgress,
    [0, 0.5, 1],
    shouldReduceMotion || isSmallViewport ? [0, 0, 0] : [0.8, -0.65, 0.9]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frame = null;
    const syncExperienceProgress = () => {
      frame = null;
      const target = experienceSectionRef.current;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const stickyHeight =
        target.querySelector("[data-landing-sticky]")?.getBoundingClientRect()
          .height || window.innerHeight;
      // Keep the original 90svh Explore card-animation timeline. The extra
      // 100svh holds the scene while the Grocery hero passes in front of it.
      const travel = Math.max(rect.height - stickyHeight * 2, 1);
      const next = Math.min(Math.max(-rect.top / travel, 0), 1);
      if (Math.abs(next - experienceScrollProgress.get()) > 0.0001) {
        experienceScrollProgress.set(next);
      }
    };
    const schedule = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(syncExperienceProgress);
      }
    };

    syncExperienceProgress();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
    };
  }, [experienceScrollProgress]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const onChange = (event) => setIsSmallViewport(event.matches);
    setIsSmallViewport(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", onChange);
    return () => mediaQuery.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const updateGallery = (progress) => {
      // A small mobile-only hysteresis stops repeated enter/exit animations
      // when a finger hovers around the gallery reveal threshold.
      setIsExperienceGalleryVisible((current) => {
        const visible = isSmallViewport
          ? (current ? progress >= 0.18 : progress >= 0.23)
          : progress >= 0.24;
        return current === visible ? current : visible;
      });
    };
    updateGallery(experienceScrollProgress.get());
    return experienceScrollProgress.on("change", updateGallery);
  }, [experienceScrollProgress, isSmallViewport]);

  const getCardScrollStep = () => {
    const track = experienceCarouselRef.current;
    const card = track?.querySelector("[data-experience-card]");
    if (!track || !card) return 0;
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 12;
    return card.offsetWidth + gap;
  };

  const onExperienceCarouselScroll = () => {
    const track = experienceCarouselRef.current;
    const step = getCardScrollStep();
    if (!track || step <= 0) return;
    const index = Math.max(0, Math.min(landingCategories.length - 1, Math.round(track.scrollLeft / step)));
    setMobileCardIndex((current) => current === index ? current : index);
  };

  const scrollExperienceCard = (direction) => {
    const track = experienceCarouselRef.current;
    const step = getCardScrollStep();
    if (!track || step <= 0) return;
    const index = Math.max(0, Math.min(landingCategories.length - 1, Math.round(track.scrollLeft / step) + direction));
    track.scrollTo({
      left: Math.min(index * step, track.scrollWidth - track.clientWidth),
      behavior: shouldReduceMotion ? "instant" : "smooth",
    });
  };

  return (
    <main className="overflow-x-clip">
      {/* =============================================================
          HERO
      ============================================================= */}

      <div className="relative">
        <HeroSection />

        <SponsoredCampaignSlot
          placement="home"
          slotKey="hero"
          overlay
          previewLabel="Hero section"
        />
      </div>

      {/* =============================================================
          START YOUR FOOD JOURNEY
      ============================================================= */}

      {/* <ClosingCtaSection /> */}

      {/* =============================================================
          EXPLORE EPANTRY
      ============================================================= */}

      {isSmallViewport && (
        <style>{`
          @media (max-width: 767px) {
            @keyframes epantry-mobile-gallery-left {
              from { transform: translate3d(0, 0, 0); }
              to { transform: translate3d(-33.333333%, 0, 0); }
            }
            @keyframes epantry-mobile-gallery-right {
              from { transform: translate3d(-33.333333%, 0, 0); }
              to { transform: translate3d(0, 0, 0); }
            }
            .epantry-mobile-gallery-left {
              animation: epantry-mobile-gallery-left 23s linear infinite;
            }
            .epantry-mobile-gallery-right {
              animation: epantry-mobile-gallery-right 25s linear infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .epantry-mobile-gallery-left, .epantry-mobile-gallery-right { animation: none; }
            }
          }
        `}</style>
      )}
      <div
        data-landing-story="explore"
        data-landing-stops="0.007,0.37"
        ref={experienceSectionRef}
        className="relative z-10 h-[290svh] w-full bg-[#1A1A1A] sm:h-[290svh]"
      >
        <section
          data-landing-sticky
          className="sticky top-0 h-[100svh] sm:h-[100svh] w-full overflow-hidden bg-[#1A1A1A] text-white [perspective:1400px]"
        >
          <SponsoredCampaignSlot
            placement="home"
            slotKey="explore_epantry"
            overlay
            previewLabel="Explore EPANTRY"
          />

          <motion.div
            className="absolute inset-0 [transform-style:flat] [backface-visibility:hidden]"
            style={{
              scale: exploreSceneScale,
              rotateX: exploreSceneRotateX,
              y: exploreSceneY,
              transformOrigin: "50% 45%",
            }}
          >
            {/* Dark gallery background */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.055),transparent_32%),radial-gradient(circle_at_18%_72%,rgba(22,101,52,0.11),transparent_27%),radial-gradient(circle_at_82%_28%,rgba(37,99,235,0.08),transparent_26%),#1A1A1A]"
            />

            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:72px_72px]"
            />

            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.018)_38%,rgba(0,0,0,0.72)_100%)]"
            />

            {/* Keep perspective local to the backdrop, not the foreground cards. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ perspective: "none" }}
            >
              {/* Continuous background rows: vertical depth on desktop, horizontal depth on mobile. */}
              <motion.div
                style={{
                  y: backdropVerticalY,
                  x: backdropHorizontalX,
                  scale: backdropDepthScale,
                  rotateX: backdropDepthRotateX,
                  // Positive Y-rotation sends the right edge away from the viewer
                  // and brings the left edge closer as tiles travel right-to-left.
                  rotateY: 0,
                  transformOrigin: "50% 50%",
                }}
                className={isSmallViewport
                  ? "absolute -inset-x-[24%] inset-y-0 [transform-style:flat] [will-change:transform]"
                  : "absolute -inset-x-[8%] -inset-y-[14%] [transform-style:flat] sm:[transform-style:preserve-3d] sm:[will-change:transform]"}
              >
                {EXPERIENCE_BACKDROP_ROWS.map((row, rowIndex) => (
                  <ExperienceBackdropRow
                    key={row.id}
                    row={row}
                    rowIndex={rowIndex}
                    lowPower={isSmallViewport}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                ))}
              </motion.div>
            </div>

            {/* On mobile, new tiles enter faint and distant on the right;
                tiles travelling left remain clearer and nearer. */}
            {isSmallViewport && !shouldReduceMotion && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#1A1A1A]/55"
              />
            )}

            {/* Intro stage */}
            <motion.div
              animate={{
                opacity: isExperienceGalleryVisible ? 0 : 1,
                y: isExperienceGalleryVisible ? -24 : 0,
                scale: isExperienceGalleryVisible ? 0.98 : 1,
              }}
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-5 text-center sm:px-8"
            >
              <div className="max-w-[760px]">
                <p className="text-xs font-black uppercase tracking-[0.32em] text-white/50 sm:text-sm">
                  Explore EPANTRY
                </p>

                <h2 className="mt-5 text-[clamp(40px,7vw,92px)] font-black leading-[0.9] tracking-[-0.055em] text-white">
                  Three experiences.
                  <span className="mt-1 block text-white/42">
                    One connected food platform.
                  </span>
                </h2>

                <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-6 text-white/48 sm:text-base sm:leading-7">
                  Scroll to explore Grocery, Brands and Recipes together.
                </p>

                <div className="mx-auto mt-8 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/45 backdrop-blur-md sm:text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                  Scroll to explore
                </div>
              </div>
            </motion.div>

            {/* Reference motion: overlapping upward card entrances, without long stagger gaps. */}
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <div
                ref={experienceCarouselRef}
                onScroll={onExperienceCarouselScroll}
                aria-label="Explore grocery, brands and recipes"
                className="flex h-full w-full items-center gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-[7vw] py-5 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center md:gap-4 md:overflow-x-visible md:overflow-y-visible md:px-8 md:py-8 md:snap-none lg:gap-5 lg:px-10"
                style={{
                  WebkitOverflowScrolling: "touch",
                  pointerEvents: isExperienceGalleryVisible ? "auto" : "none",
                }}
              >
                {landingCategories.map((category, index) => (
                  <motion.div
                    key={category.id}
                    data-experience-card
                    aria-hidden={!isExperienceGalleryVisible}
                    initial={false}
                    animate={{
                      opacity: isExperienceGalleryVisible ? 1 : 0,
                      // Slide each card up from below the viewport at its original size.
                      // On phones, let cards clearly rise into the scene
                      // (as on desktop); use only a composited translate.
                      y: isExperienceGalleryVisible || shouldReduceMotion
                        ? "0svh"
                        : (isSmallViewport ? "62svh" : "85svh"),
                    }}
                    transition={{
                      // The video shows overlapping entrances: each starts while
                      // the previous card is still rising; all settle in ~0.9s.
                      y: {
                        type: "tween",
                        duration: shouldReduceMotion ? 0 : (isSmallViewport ? 0.64 : 0.52),
                        delay: shouldReduceMotion || !isExperienceGalleryVisible ? 0 : index * (isSmallViewport ? 0.10 : 0.18),
                        ease: [0.2, 0.8, 0.3, 1],
                      },
                      opacity: { duration: 0 },
                    }}
                    className="relative h-[min(55svh,460px)] min-h-[320px] w-[64vw] max-w-[270px] shrink-0 snap-start md:h-[min(67svh,600px)] md:min-h-[390px] md:w-[29vw] md:max-w-[370px] lg:h-[min(72svh,670px)] lg:w-[28vw] lg:max-w-[410px]"
                  >
                    <Link
                      to={category.path}
                      tabIndex={isExperienceGalleryVisible ? 0 : -1}
                      className={`focus-ring group relative block h-full w-full overflow-hidden rounded-[14px] bg-[#111111] outline-none transition-transform duration-500 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-white sm:rounded-[16px] ${isSmallViewport ? "shadow-[0_12px_32px_rgba(0,0,0,0.25)]" : "shadow-[0_34px_95px_rgba(0,0,0,0.44),0_8px_22px_rgba(0,0,0,0.20)]"}`}
                    >
                      <ExperienceCardFront category={category} />
                    </Link>

                    {/* Keep the existing subtle floor reflection on desktop. */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-[6%] right-[6%] top-[calc(100%+10px)] hidden h-[16%] overflow-hidden opacity-[0.10] [mask-image:linear-gradient(to_bottom,black,transparent)] md:block"
                    >
                      <img
                        src={EXPERIENCE_CARD_IMAGES[category.id]}
                        alt=""
                        className="h-full w-full origin-top scale-y-[-1] rounded-[16px] object-cover blur-[1px]"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Mobile gallery uses horizontal swipe plus accessible arrow controls. */}
              {isSmallViewport && isExperienceGalleryVisible && (
                <div className="pointer-events-none absolute inset-x-2 top-1/2 z-40 flex -translate-y-1/2 justify-between">
                  <button
                    type="button"
                    aria-label="Previous experience"
                    disabled={mobileCardIndex === 0}
                    onClick={() => scrollExperienceCard(-1)}
                    className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-md disabled:invisible"
                  >
                    <ArrowLeft size={19} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next experience"
                    disabled={mobileCardIndex >= landingCategories.length - 1}
                    onClick={() => scrollExperienceCard(1)}
                    className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-md disabled:invisible"
                  >
                    <ArrowRight size={19} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

          </motion.div>

          {/* Static translucent glass behind the incoming Grocery surface.
              Only its opacity changes; no expensive animated blur radius. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-50 bg-[#080808]/30 sm:backdrop-blur-[5px]"
            style={{
              opacity: exploreDefocusOpacity,
            }}
          />
        </section>
      </div>

      {/* =============================================================
          FEATURED SECTIONS
      ============================================================= */}

      {/* Grocery begins during Explore's final sticky viewport. Its hero
          slides over Explore, while the product gallery follows normally. */}
      <div
        ref={featuredEntranceRef}
        className="relative z-30 -mt-[100svh]"
      >
        <FeaturedContentSection
          groceryEntranceEdgeOpacity={groceryEdgeOpacity}
          groceryEntranceScale={groceryEntranceScale}
          groceryEntranceLift={groceryEntranceLift}
        />

        <SponsoredCampaignSlot
          placement="home"
          slotKey="featured_content"
          overlay
          previewLabel="Featured content"
        />
      </div>

      {/* Guided introduction opens in a popup; Brand names now lead directly to Footer. */}
      <HowEpantryGuidePopup />
    </main>
  );
}

function ExperienceBackdropRow({
  row,
  rowIndex,
  shouldReduceMotion,
  lowPower = false,
}) {
  // Three identical groups let mobile backdrop rows move seamlessly
  // using cheap 2D CSS transforms; desktop behaviour is unchanged.
  const repeatedGroups = ["copy-a", "copy-b", "copy-c"];
  const sequence = lowPower ? row.sequence.slice(0, 3) : row.sequence;

  const startsLeft = lowPower || row.direction === "left";

  return (
    <div
      className={lowPower ? "absolute left-0 right-0 overflow-visible [transform-style:flat]" : "absolute left-0 right-0 overflow-visible [transform-style:preserve-3d]"}
      style={{
        // On phones, the image rows retain depth while moving horizontally.
        top: lowPower ? ["9%", "40%", "71%"][rowIndex] : row.top,
        opacity: row.opacity,
      }}
    >
      <motion.div
        animate={
          shouldReduceMotion || lowPower
            ? undefined
            : {
                x: startsLeft ? ["0%", "-33.333333%"] : ["-33.333333%", "0%"],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: row.duration,
                ease: "linear",
                repeat: Infinity,
              }
        }
        className={`flex w-max items-center [will-change:transform] ${
          lowPower && !shouldReduceMotion
            ? startsLeft
              ? "epantry-mobile-gallery-left"
              : "epantry-mobile-gallery-right"
            : ""
        }`}
      >
        {repeatedGroups.map((groupId) => (
          <div
            key={`${row.id}-${groupId}`}
            className="flex shrink-0 items-center gap-[clamp(46px,7vw,112px)] pr-[clamp(46px,7vw,112px)]"
          >
            {sequence.map((categoryId, itemIndex) => (
              <ExperienceBackdropTile
                key={`${row.id}-${groupId}-${categoryId}-${itemIndex}`}
                categoryId={categoryId}
                rowIndex={rowIndex}
                itemIndex={itemIndex}
                width={row.cardWidth}
                direction={row.direction}
                lowPower={lowPower}
              />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function ExperienceBackdropTile({
  categoryId,
  rowIndex,
  itemIndex,
  width,
  direction,
  lowPower = false,
}) {
  const imageSrc = EXPERIENCE_CARD_IMAGES[categoryId];

  const alternatingTilt =
    ((rowIndex + itemIndex) % 2 === 0 ? -1 : 1) * (3.5 + (itemIndex % 3) * 1.2);

  const depthOffset = ((itemIndex % 3) - 1) * 16;

  return (
    <div
      className={`relative aspect-[4/5] shrink-0 overflow-hidden rounded-[9px] border border-white/[0.07] bg-white/[0.025] shadow-[0_18px_52px_rgba(0,0,0,0.48)] sm:rounded-[11px] ${lowPower ? "[transform-style:flat]" : "[transform-style:preserve-3d]"}`}
      style={{
        width,
        transform: `${lowPower ? "" : `translateZ(${depthOffset}px) `}rotateZ(${
          direction === "left" ? alternatingTilt : -alternatingTilt
        }deg)`,
      }}
    >
      <img
        src={imageSrc}
        alt=""
        className={
          lowPower
            ? "h-full w-full object-cover"
            : "h-full w-full object-cover brightness-[0.50] saturate-[0.72] contrast-[1.04]"
        }
      />

      <div className={`absolute inset-0 ${lowPower ? "bg-black/55" : "bg-black/10"}`} />

      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/42 to-transparent" />
    </div>
  );
}

function ExperienceCardFront({ category }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#111111]">
      <img
        src={EXPERIENCE_CARD_IMAGES[category.id]}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_30%,rgba(0,0,0,0.12)_55%,rgba(0,0,0,0.79)_100%)]"
      />
      <div className="absolute inset-x-0 bottom-0 px-5 pb-7 text-center sm:px-6 sm:pb-9">
        <h3 className="inline-flex items-center justify-center gap-2 text-[clamp(24px,3.3vw,40px)] font-bold leading-[1.06] tracking-[-0.035em] text-white drop-shadow-lg">
          {category.title}
          <motion.span
            aria-hidden="true"
            className="relative top-[3px] inline-flex shrink-0 items-center sm:top-[4px]"
            animate={reduceMotion ? undefined : { x: [0, 5, 0] }}
            transition={reduceMotion ? undefined : { duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowRight size={20} />
          </motion.span>
        </h3>
      </div>
    </div>
  );
}

