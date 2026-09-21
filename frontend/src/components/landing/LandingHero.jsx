import { Link } from "react-router-dom";
import Hero3DScene from "./Hero3DScene";

// Ambient light points behind the hero. Static positions; the drift is CSS.
// Not rendered at all under prefers-reduced-motion (matching the approved design).
const MOTE_SPOTS = [
  [8, 72], [18, 28], [27, 84], [38, 16], [46, 60], [57, 34],
  [63, 78], [71, 22], [78, 54], [85, 38], [91, 70], [96, 20],
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Motes() {
  if (prefersReducedMotion()) return <span className="motes" />;
  return (
    <span className="motes">
      {MOTE_SPOTS.map(([left, top], i) => (
        <span
          key={i}
          className="mote"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            animationDelay: `${-i * 1.35}s`,
            animationDuration: `${12 + (i % 5) * 1.8}s`,
          }}
        />
      ))}
    </span>
  );
}

export default function LandingHero() {
  return (
    <section className="hero">
      <div className="ambient" aria-hidden="true">
        <span className="orb orb-1"></span>
        <span className="orb orb-2"></span>
        <span className="orb orb-3"></span>
        <span className="grid-fade"></span>
        <Motes />
      </div>

      <div className="wrap">
        <div className="hero-grid">

          <div className="hero-copy">
            <span className="pill rv rv-1">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 8.4 4.5 4.5 0 0 1 19.5 11c0 5.4-7.5 10-7.5 10Z" fill="#3B82F6"/></svg>
              Built for campus. Run by your canteen.
              <span className="dot" aria-hidden="true"></span>
            </span>

            <h1 className="display rv rv-2">
              Good food.<br />
              No queue.<br />
              <span className="accent">Just your token.</span>
            </h1>

            <p className="lede rv rv-3">
              Browse the live campus menu, order ahead between lectures and pay on your phone.
              Your pickup token arrives the moment payment clears — collect it when the app says ready.
            </p>

            <div className="hero-ctas rv rv-4">
              <Link className="btn btn-primary" to="/login">
                Order Now
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <a className="btn btn-ghost" href="#showcase">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.2" stroke="#2563EB" strokeWidth="1.8"/>
                  <path d="M10.2 8.8 15.4 12l-5.2 3.2V8.8Z" fill="#2563EB"/>
                </svg>
                Watch Demo
              </a>
            </div>

            <div className="hero-meta rv rv-5">
              <span className="faces" aria-hidden="true">
                <span className="face face-a">AR</span><span className="face face-b">MK</span>
                <span className="face face-c">SP</span><span className="face face-d">JD</span>
              </span>
              <p><b>Made with students, at their canteen counter</b>Designed around the 12:40 rush, not a delivery map.</p>
            </div>
          </div>


          <Hero3DScene />

        </div>
      </div>
    </section>
  );
}
