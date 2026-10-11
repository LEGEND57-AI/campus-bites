import Swal from "sweetalert2";
import { describeError } from "./errorMessage";

/**
 * Failure feedback for admin actions that were confirmed through a SweetAlert2
 * dialog. The admin has just answered a modal, so the outcome comes back in
 * the same channel instead of a banner somewhere else on a busy page.
 *
 * Only the message channel lives here; the wording is still describeError's,
 * so no backend text, error.message or stack reaches the screen. `text` (not
 * `html`) is used deliberately: SweetAlert2 assigns it as textContent, so even a
 * string that somehow carried markup could not inject any.
 *
 * Inline, non-confirmed admin actions (toggles, uploads, form saves) use the
 * shared ErrorMessage component instead, next to the control.
 */
export function showErrorModal(error, fallback) {
  return Swal.fire({
    icon: "error",
    title: "That didn't go through",
    text: describeError(error, fallback),
    confirmButtonColor: "#2563eb",
    confirmButtonText: "OK",
  });
}

export default showErrorModal;
