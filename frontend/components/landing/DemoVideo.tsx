"use client";

/**
 * Hover-follow play cursor + expand-to-fullscreen video.
 * Interaction pattern adapted from Skiper UI (skiper67).
 */

import { AnimatePresence, motion, useSpring } from "framer-motion";
import { Play, Plus } from "lucide-react";
import { useEffect, useId, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { LINKS } from "@/lib/links";

const YT_ID =
  LINKS.demoVideo.match(
    /(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/,
  )?.[1] ?? "QTJv78KeQqM";

const PREVIEW_SRC = `https://www.youtube.com/embed/${YT_ID}?autoplay=1&mute=1&controls=0&loop=1&playlist=${YT_ID}&modestbranding=1&playsinline=1&rel=0&showinfo=0`;
const FULL_SRC = `https://www.youtube.com/embed/${YT_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

export function DemoVideo() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  const spring = { mass: 0.1 };
  const x = useSpring(0, spring);
  const y = useSpring(0, spring);
  const opacity = useSpring(0, spring);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    opacity.set(1);
    const bounds = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - bounds.left);
    y.set(e.clientY - bounds.top);
  };

  return (
    <section className="gutter border-b border-ink/10 bg-paper py-[72px] md:py-[96px]">
      <div className="mx-auto flex max-w-[920px] flex-col items-center text-center">
        <p className="tag text-ink">Watch</p>
        <h2 className="t-40 mt-4">See Ghost Gas</h2>
        <p className="t-16 mt-3 max-w-[42ch] font-normal text-ink/60">
          Click the preview to open the full demo.
        </p>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={titleId}
          onPointerMove={onMove}
          onPointerLeave={() => opacity.set(0)}
          onClick={() => setOpen(true)}
          className="group relative mt-10 aspect-video w-full cursor-none overflow-hidden bg-night text-left outline-none ring-ink/20 focus-visible:ring-2"
        >
          <motion.div
            style={{ x, y, opacity }}
            className="pointer-events-none absolute left-0 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 bg-ink px-3 py-2 text-[13px] tracking-[-0.01em] text-cream"
          >
            <Play className="size-3.5 fill-cream" aria-hidden />
            Play
          </motion.div>

          <iframe
            src={PREVIEW_SRC}
            title="Ghost Gas demo preview"
            className="pointer-events-none h-[115%] w-[115%] -translate-x-[6%] -translate-y-[6%] scale-[1.02] border-0"
            allow="autoplay; encrypted-media"
            loading="lazy"
          />

          <span className="pointer-events-none absolute inset-0 bg-night/10 transition-colors group-hover:bg-transparent" />
        </button>
      </div>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6"
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-night/90 backdrop-blur-md"
                    onClick={() => setOpen(false)}
                  />

                  <motion.div
                    initial={{
                      clipPath: "inset(42% 38% 42% 38%)",
                      opacity: 0,
                    }}
                    animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
                    exit={{
                      clipPath: "inset(42% 38% 42% 38%)",
                      opacity: 0,
                      transition: {
                        duration: 0.85,
                        type: "spring",
                        stiffness: 100,
                        damping: 20,
                        opacity: { duration: 0.2, delay: 0.55 },
                      },
                    }}
                    transition={{
                      duration: 0.85,
                      type: "spring",
                      stiffness: 100,
                      damping: 20,
                    }}
                    className="relative z-10 aspect-video w-full max-w-[1280px] overflow-hidden bg-night shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                  >
                    <h2 id={titleId} className="sr-only">
                      Ghost Gas demo video
                    </h2>
                    <iframe
                      src={FULL_SRC}
                      title="Ghost Gas demo"
                      className="h-full w-full border-0"
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                    <button
                      type="button"
                      aria-label="Close video"
                      onClick={() => setOpen(false)}
                      className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center bg-ink/80 text-cream transition-colors hover:bg-ink"
                    >
                      <Plus className="size-5 rotate-45" aria-hidden />
                    </button>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </section>
  );
}
