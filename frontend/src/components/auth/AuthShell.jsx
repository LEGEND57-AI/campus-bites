import React from "react";
import { motion } from "framer-motion";
import { Zap, MapPin, CreditCard } from "lucide-react";

import { useMotionPreset } from "../../hooks/useMotionPreset";

/**
 * The split-screen frame shared by /login and /signup.
 *
 * Both pages previously carried their own byte-for-byte copy of the marketing
 * panel -- roughly ninety lines each, which had already drifted apart in card
 * width, logo size and heading spacing. One copy means one place to change.
 *
 * design.md notes that apply here:
 *  - §2.1 the page canvas is flat `#F8FAFC` (`bg-slate-50`), not a gradient.
 *    The split-screen hero panel is one of exactly two places a gradient is
 *    still permitted, so the panel keeps one -- built from palette steps
 *    rather than the raw hexes the pages used before.
 *  - §2.1 blue is the only brand color; the previous `cyan-300` accent was a
 *    second one. It becomes `blue-200`.
 *  - §5 the shell radius `[35px]` maps onto `rounded-3xl`.
 *  - §6.3 the arbitrary `shadow-[0_20px_60px_...]` becomes a scale token.
 *  - §17.2 the panel is `hidden lg:flex`, so it leaves the accessibility tree
 *    entirely below `lg` rather than being visually hidden.
 */

const FEATURES = [
  { icon: Zap, title: "Quick Order", copy: "Place your meals in seconds" },
  { icon: MapPin, title: "Live Tracking", copy: "Follow your order in real time" },
  { icon: CreditCard, title: "Cashless Payment", copy: "Secure, fast & hassle-free" },
];

const AuthShell = ({ children }) => {
  const { fadeUp } = useMotionPreset();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4 sm:p-6">
      <motion.div
        {...fadeUp}
        className="
          grid w-full max-w-[440px] overflow-hidden rounded-3xl
          bg-white shadow-xl
          sm:max-w-[480px]
          lg:max-w-5xl lg:grid-cols-2
        "
      >
        {/* ================= MARKETING PANEL (lg and up) ================= */}

        <div
          className="
            relative hidden flex-col justify-between overflow-hidden
            bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500
            p-8 text-white
            lg:flex xl:p-10
          "
        >
          {/* Decorative only -- never announced, never a layout participant. */}
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 size-[280px] rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -left-20 size-[220px] rounded-full bg-blue-200/15"
          />

          {/* Wordmark, §1.2 -- one implementation, inverted for the blue panel. */}
          <p className="relative z-10 text-center text-2xl font-bold tracking-tight xl:text-3xl">
            Campus<span className="text-blue-200">Craves</span>
          </p>

          {/* Marketing display copy. Deliberately not a heading: the form's own
              title is the page's single <h1> at every width (§18.1.2), and this
              panel disappears below `lg`. */}
          <div className="relative z-10 space-y-5 xl:space-y-6">
            <p className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              Your Campus.
              <br />
              Your Cravings.
              <br />
              <span className="text-blue-200">Delivered.</span>
            </p>

            <p className="max-w-[46ch] text-base leading-relaxed text-blue-100 xl:text-lg">
              Skip the lines. Order your favorite campus meals, track your
              orders in real time and pay without cash.
            </p>
          </div>

          <ul className="relative z-10 space-y-4 xl:space-y-5">
            {FEATURES.map(({ icon: Icon, title, copy }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md xl:size-14">
                  <Icon aria-hidden="true" className="size-6 xl:size-7" />
                </span>

                <span>
                  <span className="block text-base font-semibold xl:text-lg">
                    {title}
                  </span>
                  <span className="block text-sm text-blue-100">{copy}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ================= FORM COLUMN ================= */}

        <div className="flex items-center justify-center px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthShell;
