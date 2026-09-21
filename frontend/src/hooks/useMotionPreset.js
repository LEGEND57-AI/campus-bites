import { useReducedMotion } from "framer-motion";

/**
 * Shared Framer Motion presets that honour `prefers-reduced-motion`.
 *
 * design.md §19.4 requires every animated component to check the preference,
 * and specifies this hook so the check cannot be forgotten at a call site.
 *
 * Reduced motion means *reduced*, not removed: the opacity fade is kept so a
 * state change stays perceivable, and only the movement is dropped.
 */
export const useMotionPreset = () => {
  const reduce = useReducedMotion();

  return {
    fadeUp: reduce
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.15 },
        }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.2, ease: "easeOut" },
        },

    reduce,
  };
};

export default useMotionPreset;
