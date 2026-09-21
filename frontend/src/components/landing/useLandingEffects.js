import { useEffect } from "react";

/**
 * The landing page's motion, ported from the approved prototype:
 *
 *  - scroll reveal: every `.rv` inside `root` gains `.is-in` as it enters view
 *  - pointer parallax: the hero scene tilts toward the pointer (fine pointers
 *    only, clamped to +/-5.5deg x 3.5deg, lerped so it eases rather than snaps)
 *  - scroll depth: the hero scene drifts up slower than the page, and the
 *    showcase scene turns a few degrees as it crosses the viewport
 *
 * All of it writes CSS custom properties that the stylesheet composes into
 * `transform`, so nothing here causes layout. Under prefers-reduced-motion
 * the reveals resolve immediately and neither parallax effect runs.
 *
 * Everything is torn down on unmount - the prototype's animation loop ran
 * for the life of the page, which in an SPA would keep running after the
 * visitor has moved on to /login.
 */
export default function useLandingEffects(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups = [];

    // ------------------------------------------------------ scroll reveal --
    const revealables = root.querySelectorAll(".rv");
    if (reduced || !("IntersectionObserver" in window)) {
      revealables.forEach((el) => el.classList.add("is-in"));
    } else {
      const ro = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("is-in");
              ro.unobserve(en.target);
            }
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
      );
      revealables.forEach((el) => ro.observe(el));
      cleanups.push(() => ro.disconnect());
    }

    if (reduced) {
      return () => cleanups.forEach((fn) => fn());
    }

    // ---------------------------------------- parallax + scroll depth -----
    const scene = root.querySelector("#scene");
    const scene3d = root.querySelector("#scene3d");
    const scene2 = root.querySelector("#scene2");
    const scene2_3d = root.querySelector("#scene2_3d");

    const applyScrollDepth = () => {
      const y = window.scrollY;
      if (scene && y < window.innerHeight * 1.4) {
        scene.style.setProperty("--sy", `${(y * -0.055).toFixed(2)}px`);
      }
      if (scene2 && scene2_3d) {
        const r2 = scene2.getBoundingClientRect();
        if (r2.bottom > -200 && r2.top < window.innerHeight + 200) {
          const p = 1 - (r2.top + r2.height / 2) / window.innerHeight;
          const deg = Math.max(0, Math.min(18, 15 - p * 11));
          scene2_3d.style.setProperty("--r2", `${deg.toFixed(2)}deg`);
        }
      }
    };

    const fine = window.matchMedia("(pointer: fine)").matches;

    if (fine && scene && scene3d) {
      // Pointer parallax needs a continuous loop to ease toward the target;
      // scroll depth rides the same frame instead of a second listener.
      let tgtX = 0;
      let tgtY = 0;
      let curX = 0;
      let curY = 0;
      let raf = 0;

      const onPointer = (e) => {
        const r = scene.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        tgtX = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2))) * 5.5;
        tgtY = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2))) * -3.5;
      };

      const loop = () => {
        curX += (tgtX - curX) * 0.075;
        curY += (tgtY - curY) * 0.075;
        scene3d.style.setProperty("--tx", `${curX.toFixed(3)}deg`);
        scene3d.style.setProperty("--ty", `${curY.toFixed(3)}deg`);
        applyScrollDepth();
        raf = requestAnimationFrame(loop);
      };

      window.addEventListener("pointermove", onPointer, { passive: true });
      raf = requestAnimationFrame(loop);
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onPointer);
      });
    } else {
      // Touch devices: no pointer to follow, so only react to scroll.
      let ticking = false;
      let raf = 0;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        raf = requestAnimationFrame(() => {
          applyScrollDepth();
          ticking = false;
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      applyScrollDepth();
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [rootRef]);
}
