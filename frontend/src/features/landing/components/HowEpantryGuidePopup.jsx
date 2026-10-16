import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Info, Sparkles, X } from "lucide-react";

import HowItWorksSection from "./HowItWorksSection";

const GUIDE_SHOWN_KEY = "epantry-home-guide-shown-v1";
const INFO_PHRASES = [
  "How it works",
  "Why EPANTRY?",
  "From food to table",
  "Explore the guide",
];

function initialGuideMode() {
  if (typeof window === "undefined") return "closed";
  try {
    return window.localStorage.getItem(GUIDE_SHOWN_KEY) ? "closed" : "prompt";
  } catch {
    return "prompt";
  }
}

function useInfoTyping(active) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [letterCount, setLetterCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) return undefined;

    const phrase = INFO_PHRASES[phraseIndex];
    let delay;
    if (!deleting && letterCount < phrase.length) delay = 65;
    else if (!deleting) delay = 1650;
    else if (letterCount > 0) delay = 35;
    else delay = 250;

    const timer = window.setTimeout(() => {
      if (!deleting && letterCount < phrase.length)
        setLetterCount((n) => n + 1);
      else if (!deleting) setDeleting(true);
      else if (letterCount > 0) setLetterCount((n) => n - 1);
      else {
        setDeleting(false);
        setPhraseIndex((n) => (n + 1) % INFO_PHRASES.length);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, phraseIndex, letterCount, deleting]);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reducedMotion
    ? INFO_PHRASES[0]
    : INFO_PHRASES[phraseIndex].slice(0, letterCount);
}

export default function HowEpantryGuidePopup() {
  const [mode, setMode] = useState(initialGuideMode);
  const guideScrollRef = useRef(null);
  const dialogRef = useRef(null);
  const infoRef = useRef(null);
  const previouslyOpenRef = useRef(false);
  const progressRef = useRef(null);
  const typedLabel = useInfoTyping(mode === "closed");

  const open = mode !== "closed";
  const expanded = mode === "expanded";

  useEffect(() => {
    if (mode !== "prompt") return;
    try {
      window.localStorage.setItem(GUIDE_SHOWN_KEY, "1");
    } catch {
      // The guide must still work when storage is disabled.
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
        (node) =>
          node.getClientRects().length && !node.closest('[aria-hidden="true"]')
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

  // Keep the original How/Why stories tied to the modal's actual visible
  // scroll viewport, even when the screen size or mobile address bar changes.
  useEffect(() => {
    if (!expanded || !guideScrollRef.current) return undefined;
    const node = guideScrollRef.current;
    let frame = null;
    let oldHeight = 0;

    const sync = () => {
      frame = null;
      const height = node.clientHeight;
      if (!height) return;
      // Avoid continuously writing CSS variables during scrolling; updating
      // section heights while scrolling can cause the Why stage to jump.
      if (Math.abs(height - oldHeight) > 1) {
        oldHeight = height;
        node.style.setProperty("--epantry-guide-stage", `${height}px`);
        node.style.setProperty("--epantry-guide-how", `${height * 4}px`);
        node.style.setProperty("--epantry-guide-why", `${height * 4.5}px`);
      }
      const max = Math.max(node.scrollHeight - height, 0);
      const value = max ? Math.min(1, Math.max(0, node.scrollTop / max)) : 0;
      if (progressRef.current)
        progressRef.current.style.transform = `scaleX(${value})`;
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(sync);
    };
    sync();
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    resize?.observe(node);
    window.addEventListener("resize", schedule);
    node.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      node.removeEventListener("scroll", schedule);
    };
  }, [expanded]);

  useEffect(() => {
    if (expanded) guideScrollRef.current?.focus({ preventScroll: true });
  }, [expanded]);

  const goToGuideChapter = (chapter) => {
    const root = guideScrollRef.current;
    if (!root) return;
    const target = root.querySelector(`[data-landing-story="${chapter}"]`);
    if (!target) return;
    const top =
      root.scrollTop +
      target.getBoundingClientRect().top -
      root.getBoundingClientRect().top;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    root.scrollTo({
      top: Math.max(0, top),
      behavior: reducedMotion ? "instant" : "smooth",
    });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {!open && (
        <button
          ref={infoRef}
          type="button"
          onClick={() => setMode("expanded")}
          aria-label="Open How EPANTRY works guide"
          title="Open How EPANTRY works guide"
          className="focus-ring group fixed bottom-5 left-4 z-[115] inline-flex h-12 max-w-[min(88vw,245px)] items-center gap-2.5 overflow-hidden rounded-full border border-[#173F35] bg-[#173F35] py-1.5 pl-1.5 pr-4 text-[#F7F6F2] shadow-[0_12px_30px_rgba(32,36,33,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:bottom-6 sm:left-6"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F7F6F2] text-[#173F35]">
            <Info size={19} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 whitespace-nowrap text-left text-[13px] font-semibold tracking-[-0.01em]">
            {typedLabel}
            <span
              aria-hidden="true"
              className="ml-px inline-block h-[13px] w-[1px] align-[-2px] bg-[#DCE0CF] motion-reduce:hidden"
            />
          </span>
          <ArrowRight
            size={15}
            className="shrink-0 opacity-65 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      )}
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#202421]/75 p-3 sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMode("closed");
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="epantry-guide-title"
            className={`relative flex min-h-0 max-h-[96svh] flex-col overflow-hidden rounded-[18px] border border-[#DCE0CF] bg-[#F7F6F2] text-[#202421] shadow-[0_30px_95px_rgba(0,0,0,0.34)] ${
              expanded
                ? "h-[min(94svh,930px)] w-[min(96vw,1280px)]"
                : "w-[min(92vw,420px)]"
            }`}
          >
            {!expanded ? (
              <>
                <div className="relative overflow-hidden bg-[#173F35] px-6 pb-7 pt-6 text-[#F7F6F2] sm:px-8 sm:pb-8 sm:pt-7">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border border-[#DCE0CF]/20"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full border border-[#DCE0CF]/25"
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#DCE0CF]">
                      <Sparkles size={15} aria-hidden="true" /> EPANTRY guide
                    </span>
                    <button
                      data-guide-close
                      type="button"
                      onClick={() => setMode("closed")}
                      aria-label="Close EPANTRY guide"
                      className="focus-ring grid size-9 shrink-0 place-items-center rounded-full bg-[#F7F6F2] text-[#173F35] transition-colors hover:bg-[#DCE0CF]"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <h2
                    id="epantry-guide-title"
                    className="relative mt-7 max-w-[330px] text-[clamp(30px,7vw,42px)] font-semibold leading-[1.06] tracking-[-0.045em] text-[#F7F6F2]"
                  >
                    Food, made simple.
                  </h2>
                  <p className="relative mt-3 max-w-[280px] text-[15px] leading-6 text-[#DCE0CF]">
                    See how EPANTRY connects it all.
                  </p>
                </div>
                <div className="px-6 pb-6 pt-5 sm:px-8 sm:pb-7">
                  <p className="mb-5 text-[13px] font-semibold tracking-[0.04em] text-[#173F35]">
                    Discover <span className="mx-1.5 text-[#C86C42]">•</span>{" "}
                    Plan <span className="mx-1.5 text-[#C86C42]">•</span> Cook
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode("expanded")}
                    className="focus-ring group flex min-h-12 w-full items-center justify-between rounded-xl bg-[#173F35] px-5 py-3 text-[15px] font-semibold text-[#F7F6F2] transition-colors hover:bg-[#202421]"
                  >
                    Show me{" "}
                    <ArrowRight
                      size={19}
                      className="transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("closed")}
                    className="focus-ring mt-3 min-h-10 w-full rounded-lg text-[14px] font-medium text-[#173F35] hover:underline"
                  >
                    Maybe later
                  </button>
                </div>
              </>
            ) : (
              <>
                <header className="relative z-20 shrink-0 border-b border-[#DCE0CF] bg-[#F7F6F2] px-4 py-3 text-[#202421] sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#173F35]">
                        EPANTRY guide
                      </span>
                      <h2
                        id="epantry-guide-title"
                        className="truncate text-[18px] font-semibold leading-6 tracking-[-0.02em] text-[#202421] sm:text-[20px]"
                      >
                        Your food journey
                      </h2>
                    </div>
                    <button
                      data-guide-close
                      type="button"
                      onClick={() => setMode("closed")}
                      aria-label="Close EPANTRY guide"
                      className="focus-ring grid size-9 shrink-0 place-items-center rounded-full bg-[#173F35] text-[#F7F6F2] hover:bg-[#202421]"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div
                    className="mt-2 flex items-center gap-2"
                    aria-label="Guide chapters"
                  >
                    <button
                      type="button"
                      onClick={() => goToGuideChapter("how")}
                      className="focus-ring rounded-full border border-[#DCE0CF] bg-[#DCE0CF] px-3 py-1.5 text-[12px] font-semibold text-[#173F35] hover:bg-[#F7F6F2] sm:px-4 sm:text-[13px]"
                    >
                      How it works
                    </button>
                    <button
                      type="button"
                      onClick={() => goToGuideChapter("why")}
                      className="focus-ring rounded-full border border-[#DCE0CF] px-3 py-1.5 text-[12px] font-semibold text-[#173F35] hover:bg-[#DCE0CF] sm:px-4 sm:text-[13px]"
                    >
                      Why EPANTRY
                    </button>
                  </div>
                </header>
                <div
                  ref={guideScrollRef}
                  tabIndex={0}
                  aria-label="How and Why EPANTRY works. Scroll to explore."
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                  style={{
                    "--epantry-guide-stage": "75svh",
                    "--epantry-guide-how": "300svh",
                    "--epantry-guide-why": "337.5svh",
                    scrollBehavior: "auto",
                    overscrollBehaviorY: "contain",
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-y",
                  }}
                >
                  <HowItWorksSection embedded scrollRootRef={guideScrollRef} />
                </div>
                <div
                  aria-hidden="true"
                  className="relative h-[3px] shrink-0 bg-[#DCE0CF]"
                >
                  <span
                    ref={progressRef}
                    className="absolute inset-0 origin-left"
                    style={{
                      backgroundColor: "#C86C42",
                      transform: "scaleX(0)",
                    }}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>,
    document.body
  );
}
