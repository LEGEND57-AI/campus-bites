import React from "react";
import { AlertCircle } from "lucide-react";

/**
 * Inline validation message shown directly beneath the field it belongs to.
 *
 * Replaces the floating toasts the auth pages used for validation errors:
 * a toast sits far from the input, disappears on a timer, and stacked with a
 * second toast when both the page and AuthContext reported the same failure.
 *
 * Renders nothing when there is no message, so callers can drop it in
 * unconditionally.
 *
 * The `id` is what the input points at with aria-describedby, which is what
 * lets a screen reader read the message as part of the field rather than as
 * loose text. role="alert" announces it when it appears after a submit, and
 * the icon means the error is not signalled by colour alone.
 */
const FieldError = ({ id, message }) => {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      role="alert"
      className="
        mt-1.5
        flex
        items-start
        gap-1.5
        text-[13px]
        leading-snug
        text-red-600
      "
    >
      <AlertCircle
        size={14}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span>{message}</span>
    </p>
  );
};

export default FieldError;
