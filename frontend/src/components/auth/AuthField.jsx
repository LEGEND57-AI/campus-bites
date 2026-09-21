import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import FieldError from "./FieldError";

/**
 * One labelled form row: label, leading icon, input, inline error.
 *
 * The six near-identical copies this replaces all shared the same defects,
 * which is why they are fixed here once rather than six times:
 *
 *  - The inputs had no `id` and the labels had no `htmlFor`, and the label did
 *    not wrap the input either -- so nothing associated the two. A screen
 *    reader announced every field as an unlabelled edit box (§18.1.4).
 *  - No `autoComplete`, so password managers and iOS autofill had nothing to
 *    go on (§8.5). Chrome reports this on the login page today.
 *  - `text-sm sm:text-base` put 14px text on phones, which makes iOS zoom the
 *    viewport on focus. §8.2 specifies the inverse, `text-base sm:text-sm`.
 *  - `outline-none` with no `focus-visible` replacement (§18.1.1), and a 4px
 *    focus ring where §8.2 calls for 2px.
 *  - The password toggle was an 18x18 icon with no accessible name.
 *
 * `type="password"` grows a visibility toggle automatically, so no caller has
 * to wire one up.
 */
const AuthField = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon: Icon,
  error,
  autoComplete,
  inputMode,
  maxLength,
  required = true,
}) => {
  const [revealed, setRevealed] = useState(false);

  // Stable, collision-free ids. The previous hand-written ids ("login-email-
  // error") were unique only by convention.
  const reactId = useId();
  const inputId = `${reactId}-input`;
  const errorId = `${reactId}-error`;

  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
          />
        )}

        <input
          id={inputId}
          type={resolvedType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`
            h-11 w-full rounded-xl border bg-white
            text-base text-slate-900 placeholder:text-slate-400
            transition-colors
            focus:outline-none focus:ring-2
            disabled:bg-slate-50 disabled:text-slate-400
            sm:h-12 sm:text-sm
            ${Icon ? "pl-11" : "pl-4"}
            ${isPassword ? "pr-12" : "pr-4"}
            ${
              error
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                : "border-slate-200 focus:border-blue-500 focus:ring-primary/20"
            }
          `}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            // The control is an icon, so the name has to come from here.
            // It states what the control will do, not what is on screen.
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            // h-11 w-11 is the §8.2 trailing-action hit area: the glyph stays
            // 18px, the target reaches the 44px touch minimum (§17.2).
            className="
              absolute right-1 top-1/2 flex size-11 -translate-y-1/2
              items-center justify-center rounded-lg
              text-slate-400 transition-colors hover:text-slate-600
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary focus-visible:ring-offset-2
            "
          >
            {revealed ? (
              <EyeOff aria-hidden="true" className="size-[18px]" />
            ) : (
              <Eye aria-hidden="true" className="size-[18px]" />
            )}
          </button>
        )}
      </div>

      <FieldError id={errorId} message={error} />
    </div>
  );
};

export default AuthField;
