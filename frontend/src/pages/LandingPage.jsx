import { useEffect, useRef } from "react";

import ObjectSprite from "../components/landing/ObjectSprite";
import LandingNavbar from "../components/landing/LandingNavbar";
import LandingHero from "../components/landing/LandingHero";
import BenefitsStrip from "../components/landing/BenefitsStrip";
import FeaturesSection from "../components/landing/FeaturesSection";
import HowItWorks from "../components/landing/HowItWorks";
import ProductShowcase from "../components/landing/ProductShowcase";
import SmartTokenSection from "../components/landing/SmartTokenSection";
import CanteenSection from "../components/landing/CanteenSection";
import TrustSection from "../components/landing/TrustSection";
import FinalCTA from "../components/landing/FinalCTA";
import LandingFooter from "../components/landing/LandingFooter";
import useLandingEffects from "../components/landing/useLandingEffects";

import "../components/landing/landing.css";

const TITLE = "CampusCraves — Skip the canteen queue";

/**
 * Public landing page, shown at "/" to visitors who are not signed in
 * (see components/HomeRoute.jsx). Every "Get Started" / "Order Now" goes to
 * the existing /login route; this page has no auth logic of its own.
 */
export default function LandingPage() {
  const rootRef = useRef(null);
  useLandingEffects(rootRef);

  // Deep links such as /#contact. This page is a lazy chunk, so the
  // browser's own jump-to-anchor ran before these sections existed and did
  // nothing. An effect runs once the page and all its sections are in the
  // DOM, so make that jump here. Declared before the smooth-scroll effect
  // below so the jump is instant rather than animated. No hash, no scroll.
  useEffect(() => {
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return undefined; // malformed hash: leave the page where it is
    }
    const target = id && document.getElementById(id);
    if (!target) return undefined;

    target.scrollIntoView({ block: "start" });

    // The web font can still swap in and move the section by a few pixels.
    // Re-align once when it has loaded, unless the visitor has scrolled since.
    const landedAt = window.scrollY;
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled && window.scrollY === landedAt) {
        target.scrollIntoView({ block: "start" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Page title, and smooth in-page anchor scrolling, only while the landing
  // page is mounted -- both are restored for the rest of the app.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = TITLE;

    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      html.style.scrollBehavior = "smooth";
    }

    return () => {
      document.title = prevTitle;
      html.style.scrollBehavior = prevBehavior;
    };
  }, []);

  return (
    <div className="cc-landing" ref={rootRef}>
      <ObjectSprite />
      <LandingNavbar />

      <main id="top">
        <LandingHero />
        <BenefitsStrip />
        <FeaturesSection />
        <HowItWorks />
        <ProductShowcase />
        <SmartTokenSection />
        <CanteenSection />
        <TrustSection />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
