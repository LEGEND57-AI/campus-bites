import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * The one visible failure surface for user-initiated actions.
 *
 * Toasts used to carry this. They were removed deliberately, and nothing
 * replaced them, so a failed action said nothing at all -- a confirmed silent
 * failure (Notifications -> "Mark all as read" against a 500 produced no alert,
 * no modal and no text). This is the replacement, and it is intentionally not a
 * global overlay: the message belongs next to the thing that failed.
 *
 * Two shapes, same component, because the two needs differ only in weight:
 *
 *   default  a compact banner above or beside the control that failed
 *   panel    a centred block that fills a region which has no content to show,
 *            e.g. a menu list whose request failed
 *
 * `onRetry` is optional and should only be passed when retrying is actually
 * meaningful and safe -- a read, or an idempotent write. It is deliberately not
 * offered for anything that could duplicate a mutation.
 *
 * Copy comes from the caller via `message`, which should come from
 * utils/errorMessage.js so no backend text or error.message reaches the screen.
 */
const ErrorMessage = ({
  message,
  onRetry,
  retryLabel = "Try again",
  panel = false,
  className = "",
}) => {
  if (!message) {
    return null;
  }

  if (panel) {
    return (
      <div
        role="alert"
        className={`
          flex flex-col items-center justify-center gap-4 rounded-3xl
          border border-rose-200 bg-rose-50 px-6 py-14 text-center
          ${className}
        `}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-rose-100">
          <AlertCircle aria-hidden="true" className="size-6 text-rose-600" />
        </span>

        <p className="max-w-[46ch] text-sm leading-relaxed text-rose-700 sm:text-base">
          {message}
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="
              inline-flex h-11 items-center justify-center gap-2 rounded-xl
              bg-rose-600 px-5 text-sm font-semibold text-white
              transition-colors hover:bg-rose-700 active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-rose-500 focus-visible:ring-offset-2
            "
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`
        flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl
        border border-rose-200 bg-rose-50 px-3.5 py-3
        ${className}
      `}
    >
      <AlertCircle
        aria-hidden="true"
        className="size-4 shrink-0 text-rose-600"
      />

      <p className="min-w-0 flex-1 text-sm leading-snug text-rose-700">
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="
            inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg
            border border-rose-300 bg-white px-3 text-xs font-semibold
            text-rose-700 transition-colors hover:bg-rose-100
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-rose-500 focus-visible:ring-offset-1
          "
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
