import dotenv from "dotenv";
import { getAllowedOrigins } from "./allowedOrigins.js";

// dotenv is loaded HERE rather than relying on server.js's own
// dotenv.config() call, because this module is evaluated before that call
// ever runs -- see the note above the import in server.js for why this
// module has to come first.
//
// dotenv never overwrites a variable that is already present, so a
// platform-injected environment (Render) still wins over anything in a local
// .env file, and the repeated calls from db.js and server.js stay no-ops.
dotenv.config();

// Variables the process cannot do anything useful without, in ANY
// environment.
//
// Every one of these already breaks the application today. This list changes
// only WHEN and HOW that break is reported -- never whether a
// previously-working configuration keeps working:
//
//   SUPABASE_URL              createClient() throws "supabaseUrl is required."
//                             while db.js is being evaluated. Also parsed by
//                             utils/imageUrl.js on every admin menu write.
//   SUPABASE_SERVICE_ROLE_KEY every query would run without the service role.
//   JWT_SECRET                jwt.sign() throws "secretOrPrivateKey must have
//   JWT_REFRESH_SECRET        a value" -- but only on the first login or
//                             refresh, long after the platform has already
//                             marked the deploy healthy.
//   RAZORPAY_KEY_ID           the Razorpay constructor throws "`key_id` or
//                             `oauthToken` is mandatory" while
//                             utils/razorpay.js is being evaluated.
//   RAZORPAY_KEY_SECRET       does NOT throw -- the SDK validates key_id only
//                             -- so payment signature verification silently
//                             computes its HMAC against an empty secret.
//   VAPID_SUBJECT             webpush.setVapidDetails() throws "No subject set
//   VAPID_PUBLIC_KEY          in vapidDetails.subject." while
//   VAPID_PRIVATE_KEY         utils/pushNotification.js is being evaluated.
//
// Note that several of the above are already hard startup crashes, just with
// messages that name no environment variable and stop at the first problem
// found. Validating them here reports all of them at once, by name.
const REQUIRED_ALWAYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "VAPID_SUBJECT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];

// Variables that are essential in production but genuinely optional for local
// development, so requiring them everywhere would break working dev setups
// for no security benefit.
//
//   RAZORPAY_WEBHOOK_SECRET  paymentWebhook.js already answers 500 "Webhook
//                            not configured" without it, so nothing crashes.
//                            In production its absence means orphaned-payment
//                            recovery silently never runs -- a customer can be
//                            charged with no order created. Locally there is
//                            usually no tunnel for Razorpay to call at all.
//   BREVO_API_KEY            assigning undefined does not throw; only the
//                            first OTP send fails. In production that means
//                            nobody can register or reset a password.
const REQUIRED_IN_PRODUCTION = [
  "RAZORPAY_WEBHOOK_SECRET",
  "BREVO_API_KEY",
];

// A variable set to "" or "   " is configured-but-useless, and on a
// deployment platform it is the far more likely mistake than a genuinely
// absent key: an env var added to the dashboard with its value left blank.
// Both are treated identically to "not set at all".
function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

// Returns the names of every required variable that is missing or blank, in a
// stable order. Names only -- no value is ever read into the result.
export function findMissingEnvVars() {
  const isProduction = process.env.NODE_ENV === "production";

  const missing = REQUIRED_ALWAYS.filter((name) =>
    isBlank(process.env[name])
  );

  if (!isProduction) {
    return missing;
  }

  for (const name of REQUIRED_IN_PRODUCTION) {
    if (isBlank(process.env[name])) {
      missing.push(name);
    }
  }

  // CORS_ORIGINS is deliberately checked through getAllowedOrigins() rather
  // than with the isBlank() test used above, so this stays a consumer of the
  // one parser instead of becoming a second, subtly different one. That also
  // makes the check semantic rather than textual: a value like "," or " , "
  // is not blank as a string, but yields zero usable origins, which in
  // production means every browser request from the real frontend is refused.
  //
  // Outside production the existing warn-and-fail-closed behavior in
  // server.js is left exactly as it was -- the Vite dev proxy makes a
  // configured allowlist genuinely unnecessary locally.
  if (getAllowedOrigins().length === 0) {
    missing.push("CORS_ORIGINS");
  }

  return missing;
}

// Throws if anything required is missing. Called on import (below) so that it
// runs before the modules that construct Supabase/Razorpay/web-push clients
// are ever evaluated.
//
// This throws rather than calling process.exit() for two reasons: an uncaught
// exception at module scope already gives Node's own non-zero exit and a full
// stderr report, and logger.js's pino-pretty transport is a worker thread in
// development, where an immediate process.exit() can truncate the very
// message explaining the failure.
export function validateEnv() {
  const missing = findMissingEnvVars();

  if (missing.length === 0) {
    return;
  }

  // Only names are interpolated here. The values are never read, logged, or
  // included in the message -- most of these variables are secrets, and a
  // startup crash is exactly the kind of output that ends up pasted into a
  // support thread or captured by a log aggregator.
  throw new Error(
    `Cannot start: ${missing.length} required environment variable(s) ` +
      `missing or empty: ${missing.join(", ")}. ` +
      `Set them in the deployment environment (or backend/.env for local ` +
      `development). Values are never logged.`
  );
}

validateEnv();
