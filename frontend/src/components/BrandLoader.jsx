import { useEffect, useState } from "react";
import logo from "../assets/CampusCraves-Logo.png";
import "./BrandLoader.css";

// Full-screen CampusCraves loader (approved design "v4").
//
// Purely visual: it is rendered by the existing full-screen loading states
// (session restore in ProtectedRoute / AdminRoute, lazy route chunks in
// App.jsx) and knows nothing about when loading starts or ends. Normal
// background refetches never use it.

// Fixed, hand-placed dust motes (large screens only, near invisible).
const MOTES = [
  { x: 20, y: 72, s: 2, d: 17, delay: 0, o: 0.16, dx: 7 },
  { x: 37, y: 60, s: 1.5, d: 20, delay: 4, o: 0.13, dx: -6 },
  { x: 58, y: 74, s: 2, d: 22, delay: 8, o: 0.12, dx: 8 },
  { x: 72, y: 62, s: 1.5, d: 19, delay: 2, o: 0.14, dx: -5 },
  { x: 84, y: 70, s: 1.5, d: 21, delay: 6, o: 0.11, dx: 4 },
  { x: 30, y: 44, s: 1.5, d: 23, delay: 11, o: 0.1, dx: 5 },
];

// When one full-screen loader is replaced by another almost immediately
// (e.g. the session restore finishes and the page's code chunk is still
// loading), the new one continues in the settled state instead of
// replaying the entrance. Module-level, visual only.
const CONTINUE_WINDOW_MS = 1500;
let lastLoaderVisibleAt = 0;

const markVisible = () => {
  lastLoaderVisibleAt = Date.now();
};

function Layer({ className }) {
  return (
    <img
      className={`cc-layer ${className}`}
      src={logo}
      alt=""
      draggable="false"
      decoding="async"
    />
  );
}

export default function BrandLoader() {
  const [continuing] = useState(
    () => Date.now() - lastLoaderVisibleAt < CONTINUE_WINDOW_MS
  );

  useEffect(() => {
    markVisible();
    const timer = setInterval(markVisible, 500);

    return () => {
      clearInterval(timer);
      markVisible();
    };
  }, []);

  return (
    <div
      className={`cc-loader${continuing ? " cc-loader--continue" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading CampusCraves"
      style={{ "--cc-logo": `url("${logo}")` }}
    >
      <div className="cc-dust" aria-hidden="true">
        {MOTES.map((m, i) => (
          <i
            key={i}
            style={{
              "--x": `${m.x}%`,
              "--y": `${m.y}%`,
              "--s": `${m.s}px`,
              "--d": `${m.d}s`,
              "--delay": `${m.delay}s`,
              "--o": m.o,
              "--dx": `${m.dx}px`,
            }}
          />
        ))}
      </div>

      <div className="cc-scene" aria-hidden="true">
        <div className="cc-stage">
          <div className="cc-shadow" />
          <div className="cc-rig">
            <div className="cc-float">
              <div className="cc-tilt">
                <div className="cc-glow">
                  <div className="cc-glow__shape" />
                </div>
                <Layer className="cc-depth" />
                <Layer className="cc-depth" />
                <Layer className="cc-depth" />
                <Layer className="cc-face" />
                <div className="cc-mask cc-shade" />
                <div className="cc-mask cc-rim" />
                <div className="cc-mask cc-spec" />
                <div className="cc-mask cc-sweep" />
              </div>
            </div>
          </div>
        </div>
        <div className="cc-line">
          <div className="cc-line__light" />
        </div>
      </div>

      <span className="cc-sr">Loading CampusCraves</span>
    </div>
  );
}
