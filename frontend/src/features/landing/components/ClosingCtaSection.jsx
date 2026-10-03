import { useEffect, useRef, useState } from "react";

import { ArrowRight, CookingPot, ShoppingBasket } from "lucide-react";

import { Link } from "react-router-dom";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

const FOOD_JOURNEY_BANNERS = [
  "/banners/1.png",
  "/banners/2.png",
  "/banners/3.png",
  "/banners/4.png",
];

export default function ClosingCtaSection() {
  const sectionRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageStageActive, setImageStageActive] = useState(false);
  const [introRemoved, setIntroRemoved] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Intro text stays stable first, then leaves only while the image expands.
  const introOpacity = useTransform(
    scrollYProgress,
    [0, 0.28, 0.48, 0.58],
    [1, 1, 0.76, 0]
  );

  const introScale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.58],
    shouldReduceMotion ? [1, 1, 1] : [1, 1, 0.97]
  );

  // IMPORTANT: there is deliberately NO opacity animation on the image.
  // It grows from the centre at full image opacity, eliminating white wash.
  const imageScale = useTransform(
    scrollYProgress,
    [0.26, 0.62],
    shouldReduceMotion ? [1, 1] : [0.16, 1]
  );

  const imageRadius = useTransform(
    scrollYProgress,
    [0.26, 0.52, 0.62],
    ["30px", "20px", "0px"]
  );

  // Final copy arrives only after the image has become the main visual.
  const contentOpacity = useTransform(scrollYProgress, [0.64, 0.73], [0, 1]);

  const contentY = useTransform(
    scrollYProgress,
    [0.64, 0.73],
    shouldReduceMotion ? [0, 0] : [24, 0]
  );

  useEffect(() => {
    const updateStage = (value) => {
      const nextImageStageActive = value >= 0.26;
      const nextIntroRemoved = value >= 0.59;

      setImageStageActive((current) =>
        current === nextImageStageActive ? current : nextImageStageActive
      );

      setIntroRemoved((current) =>
        current === nextIntroRemoved ? current : nextIntroRemoved
      );
    };

    updateStage(scrollYProgress.get());

    return scrollYProgress.on("change", updateStage);
  }, [scrollYProgress]);

  // Once the image stage exists, switch the clean source image every 3 seconds.
  useEffect(() => {
    if (!imageStageActive || shouldReduceMotion) {
      setActiveImageIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveImageIndex(
        (currentIndex) => (currentIndex + 1) % FOOD_JOURNEY_BANNERS.length
      );
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [imageStageActive, shouldReduceMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative h-[180svh] w-full bg-[#050505]"
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#050505] text-white">
        {!introRemoved ? (
          <motion.div
            style={{
              opacity: introOpacity,
              scale: introScale,
            }}
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-5 text-center sm:px-8"
          >
            <div className="max-w-[1100px]">
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-white/48 sm:text-xs">
                Start your food journey
              </p>

              <h2 className="mt-4 text-[clamp(42px,7.4vw,112px)] font-medium uppercase leading-[0.86] tracking-[-0.058em] text-white">
                with EPANTRY
              </h2>
            </div>
          </motion.div>
        ) : null}

        {imageStageActive ? (
          <motion.div
            style={{
              scale: imageScale,
              borderRadius: imageRadius,
            }}
            className="absolute bottom-0 left-0 right-0 top-[64px] z-20 origin-center overflow-hidden bg-[#050505] md:top-[76px] xl:top-[72px]"
          >
            <img
              key={`journey-banner-${activeImageIndex}`}
              src={FOOD_JOURNEY_BANNERS[activeImageIndex]}
              alt=""
              aria-hidden="true"
              draggable="false"
              className="absolute inset-0 block h-full w-full object-cover opacity-100"
              style={{
                opacity: 1,
                filter: "none",
                mixBlendMode: "normal",
                WebkitFilter: "none",
              }}
            />

            <motion.div
              style={{
                opacity: contentOpacity,
                y: contentY,
              }}
              className="absolute inset-0 z-10 flex items-end justify-end p-5 sm:p-8 lg:p-[6vw]"
            >
              <div className="w-full max-w-[680px] rounded-[24px] border border-white/20 bg-white/[0.12] p-5 text-right text-white shadow-[0_22px_70px_rgba(0,0,0,0.26)] backdrop-blur-[12px] sm:rounded-[28px] sm:p-7 lg:p-8 [text-shadow:0_2px_18px_rgba(0,0,0,0.78),0_1px_4px_rgba(0,0,0,0.9)]">
                <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-[2px] sm:text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  Start your food journey
                </div>

                <h2 className="ml-auto mt-4 max-w-[640px] text-[clamp(30px,5vw,72px)] font-black leading-[0.93] tracking-[-0.052em]">
                  Discover food with more context, confidence and convenience.
                </h2>

                <p className="ml-auto mt-4 max-w-[560px] text-sm font-medium leading-6 text-white sm:text-base sm:leading-7">
                  Explore groceries, trusted brands and recipes in one connected
                  EPANTRY experience.
                </p>

                <div className="mt-5 flex flex-wrap justify-end gap-2.5 sm:mt-6 sm:gap-3">
                  <Link
                    to="/grocery"
                    className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-[#14532D] transition-transform duration-300 hover:-translate-y-0.5 sm:px-5 sm:py-3 sm:text-sm"
                  >
                    <ShoppingBasket size={16} aria-hidden="true" />
                    Explore Grocery
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>

                  <Link
                    to="/recipes"
                    className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/35 bg-black/35 px-4 py-2.5 text-xs font-black text-white transition-transform duration-300 hover:-translate-y-0.5 sm:px-5 sm:py-3 sm:text-sm"
                  >
                    <CookingPot size={16} aria-hidden="true" />
                    Discover Recipes
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
