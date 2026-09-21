import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

/**
 * The two buttons the auth screens need, in design.md's §7 variants.
 *
 * Kept as a pair of small local components rather than a vendored shadcn
 * `button`: shadcn is not initialised in this project (no components.json, no
 * `src/components/ui/`), and bringing it in would rewrite the shared Tailwind
 * config and add dependencies well outside the auth screens. §20.5 says not to
 * install a component used in one place. The prop shape (`variant`, `size`,
 * `loading`) deliberately mirrors shadcn's so the §22 wave-1 swap is a
 * drop-in rather than a rewrite.
 *
 * Shared base, from §7.3:
 *  - `focus-visible:ring-2 ring-primary ring-offset-2` -- the previous buttons
 *    had no focus style of their own at all.
 *  - `active:scale-[0.98]` is the only scale transform allowed; the old
 *    `hover:scale-[1.02]` is prohibited by §19.3.
 *  - Loading keeps the label and adds a spinner. Swapping "Sign In" for
 *    "Signing In..." changed the button's width mid-request, which nudged the
 *    layout under the user's finger.
 */

const BASE = `
  inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl
  px-4 text-base font-semibold
  transition-colors duration-150 select-none
  focus-visible:outline-none focus-visible:ring-2
  focus-visible:ring-primary focus-visible:ring-offset-2
  active:scale-[0.98]
  disabled:opacity-50 disabled:pointer-events-none
  sm:h-12
`;

/** §7.1 Primary — one per view. Replaces the prohibited gradient fill. */
export const SubmitButton = ({ children, loading = false, loadingLabel }) => (
  <button
    type="submit"
    disabled={loading}
    aria-busy={loading || undefined}
    className={`${BASE} bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800`}
  >
    {loading ? (
      <>
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        {/* The visible label does not change; the state is announced instead. */}
        {children}
        <span className="sr-only">{loadingLabel ?? "Working, please wait"}</span>
      </>
    ) : (
      <>
        {children}
        <ArrowRight aria-hidden="true" className="size-5" />
      </>
    )}
  </button>
);

/** §7.1 Secondary — the Google control on both screens. */
export const GoogleButton = ({ onClick, loading = false, label }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    aria-busy={loading || undefined}
    className={`${BASE} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100`}
  >
    {loading ? (
      <Loader2 aria-hidden="true" className="size-5 animate-spin" />
    ) : (
      <GoogleMark />
    )}
    {label}
  </button>
);

/**
 * Google's mark. Its four brand colors are the one place raw hex values are
 * correct: they are Google's, not CampusCraves', and must not be tokenised.
 */
const GoogleMark = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48" focusable="false">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917"
    />
    <path
      fill="#FF3D00"
      d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.9 11.9 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917"
    />
  </svg>
);

/** The "OR" rule between the two actions. */
export const AuthDivider = () => (
  <div className="flex items-center gap-4" aria-hidden="true">
    <span className="h-px flex-1 bg-slate-200" />
    <span className="text-xs font-medium text-slate-500">OR</span>
    <span className="h-px flex-1 bg-slate-200" />
  </div>
);
