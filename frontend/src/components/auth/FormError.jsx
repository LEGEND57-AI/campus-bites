import React from "react";
import { AlertCircle } from "lucide-react";

/**
 * A form-level error: one that belongs to the submission rather than to any
 * single input. "Invalid email or password." is the canonical case, because it
 * deliberately refuses to say which of the two was wrong.
 *
 * design.md §8.3 gives this its own treatment, above the submit button, rather
 * than the inline `FieldError` the pages were reusing. Hanging a message about
 * the whole form underneath the password input read as a password-specific
 * error and put it below the field a user had already moved past.
 *
 * Renders nothing without a message, so callers can drop it in unconditionally.
 */
const FormError = ({ id, message }) => {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
};

export default FormError;
