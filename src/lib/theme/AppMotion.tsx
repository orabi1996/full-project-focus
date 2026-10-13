import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

/** Shared progressive enhancement: content remains usable before GSAP loads. */
export function AppMotion() {
  const pathname = useLocation({ select: (location) => location.pathname });

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import("gsap").then(({ gsap }) => {
      if (disposed) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", (context) => {
        const seen = new WeakSet<Element>();
        let frame = 0;
        context.add("reveal", () => {
          const candidates = document.querySelectorAll(
            'main h1, main h2, main [data-slot="card"], main .madarx-kpi-card, main .classera-kpi-card, main [role="tabpanel"][data-state="active"], form, [role="dialog"] > :not(button)',
          );
          const fresh = Array.from(candidates).filter((element) => {
            if (seen.has(element) || element.closest('[data-motion="off"]')) return false;
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;
            seen.add(element);
            return rect.bottom > 0 && rect.top < window.innerHeight;
          });
          // Animate only outermost candidates, avoiding doubled nested movement.
          const targets = fresh.filter((element) => !fresh.some(
            (parent) => parent !== element && parent.contains(element),
          )).slice(0, 16);
          if (targets.length) {
            gsap.fromTo(targets, { y: 10, opacity: 0.92 }, {
              y: 0, opacity: 1, duration: 0.32,
              stagger: { each: 0.025, amount: 0.15 },
              ease: "power2.out", clearProps: "transform,opacity",
            });
          }
        });
        const reveal = () => context.reveal();
        const schedule = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(reveal);
        };
        schedule();
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, {
          childList: true, subtree: true, attributes: true,
          attributeFilter: ["data-state", "hidden"],
        });
        return () => {
          observer.disconnect();
          cancelAnimationFrame(frame);
        };
      });
      cleanup = () => media.revert();
    }).catch(() => {
      // Motion is optional; a failed chunk must never block a business screen.
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [pathname]);

  return null;
}