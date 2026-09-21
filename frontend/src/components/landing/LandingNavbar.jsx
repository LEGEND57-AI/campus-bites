import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";

// In-page sections only. Every one of these ids exists on the landing page;
// none of them is an app route, so nothing here invents a page.
const LINKS = [
  { href: "#top", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How It Works" },
  { href: "#menu", label: "Menu" },
  { href: "#canteens", label: "For Canteens" },
  { href: "#contact", label: "Contact" },
];

// Below this scroll offset the page is "at the top", whatever the observer says:
// <main id="top"> spans the whole page, so it cannot drive the spy itself.
const TOP_ZONE = 260;

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LandingNavbar() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#top");
  const burgerRef = useRef(null);

  // Border + shadow once the page scrolls under the bar.
  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 8);
      if (window.scrollY < TOP_ZONE) setActive("#top");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy: highlight the section crossing the middle of the viewport.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const targets = LINKS.filter((l) => l.href !== "#top")
      .map((l) => document.querySelector(l.href))
      .filter(Boolean);

    const spy = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < TOP_ZONE) {
          setActive("#top");
          return;
        }
        entries.forEach((en) => {
          if (en.isIntersecting) setActive(`#${en.target.id}`);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    targets.forEach((t) => spy.observe(t));
    return () => spy.disconnect();
  }, []);

  // Mobile panel: Escape closes (focus back to the burger), widening past
  // the desktop breakpoint closes it too.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const closePanel = useCallback(() => setOpen(false), []);

  return (
    <header className={`nav${stuck ? " is-stuck" : ""}${open ? " is-open" : ""}`} id="nav">
      <div className="wrap">
        <div className="nav-inner">
          <a className="brand" href="#top" aria-label="CampusCraves home">
            <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
              <defs>
                <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#1D4ED8" />
                </linearGradient>
              </defs>
              <rect width="40" height="40" rx="11" fill="url(#mk)" />
              <path d="M26.8 14.2a8.4 8.4 0 100 11.6" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" />
              <circle cx="27.4" cy="20" r="2.1" fill="#93C5FD" />
            </svg>
            <span>
              Campus<span className="accent">Craves</span>
            </span>
          </a>

          <nav className="nav-links" aria-label="Primary">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className={active === l.href ? "is-active" : undefined}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className="nav-cta">
            <Link className="btn btn-primary btn-sm" to="/login">
              Get Started
              <Arrow />
            </Link>
          </div>

          <button
            ref={burgerRef}
            type="button"
            className="burger"
            aria-expanded={open}
            aria-controls="mpanel"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <i />
          </button>
        </div>

        <div className="m-panel" id="mpanel">
          <div className="m-panel-in">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={closePanel}>
                {l.label}
              </a>
            ))}
            <Link className="btn btn-primary" to="/login" onClick={closePanel}>
              Get Started
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
