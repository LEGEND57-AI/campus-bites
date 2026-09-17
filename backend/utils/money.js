// Money helpers for payment/refund arithmetic.
//
// Razorpay works in integer paise, and all refund comparisons are done in
// paise too, so no floating-point rupee value is ever added, compared or sent.
// Rupee values only exist at the edges: parsed once from input or the
// database, and formatted once for storage or display.

// A plain non-negative rupee amount with at most 2 decimal places. The integer
// part is capped at 9 digits so the paise value stays well inside the range
// where JavaScript numbers are exact. Exponents ("1e3"), signs, whitespace
// inside the number, and float artifacts ("0.30000000000000004") are rejected.
const RUPEE_AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;

/**
 * Parse a rupee amount (number or string) into integer paise.
 * Returns null for anything that is not a finite, well-formed amount.
 */
export function parseRupeesToPaise(value) {
  let text;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    text = String(value);
  } else if (typeof value === "string") {
    text = value.trim();
  } else {
    return null;
  }

  if (!RUPEE_AMOUNT_PATTERN.test(text)) return null;

  const [whole, fraction = ""] = text.split(".");

  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/**
 * Convert a NUMERIC(…, 2) value read from the database (PostgREST returns it
 * as a JSON number or string) into integer paise. Returns null if it is not a
 * valid non-negative amount with at most 2 decimals.
 */
export function numericToPaise(value) {
  if (typeof value === "string") return parseRupeesToPaise(value);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;

  // toFixed(2) removes binary representation noise (e.g. 90.3 is stored as
  // 90.2999…); the result is then parsed exactly like user input.
  return parseRupeesToPaise(value.toFixed(2));
}

/** Format integer paise as a rupee string with exactly 2 decimals: 3030 -> "30.30". */
export function formatPaise(paise) {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);

  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
