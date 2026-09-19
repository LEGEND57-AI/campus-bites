import crypto from "crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getClientIp } from "../utils/clientIp.js";
import { verifyAccessToken, verifyRefreshToken } from "../utils/jwt.js";
import { normalizeEmail } from "../utils/email.js";

// ================= WHO A REQUEST COUNTS AGAINST =================
//
// Three kinds of bucket:
//
// - Authenticated identity, for everything a signed-in user does. Keyed by the
//   user id from a SERVER-VERIFIED credential: req.user when authenticate has
//   already run, otherwise the access token in the Authorization header after
//   its signature and expiry are checked here (verifyAccessToken, the same
//   check authenticate performs). A campus shares one or a few NAT egress
//   addresses, so an IP-only key made every student on the Wi-Fi share one
//   budget -- in load testing, 50 students on one IP got 78% 429s within three
//   minutes. Nothing the client sends is taken at face value: no x-user-id-style
//   header, and a token that fails verification contributes nothing.
//
// - Account (an HMAC of the normalised email in the body), for login, sign-up,
//   OTP and password reset: no one is signed in yet, but the request names the
//   account it acts on. See ACCOUNT (EMAIL) BUCKETS below.
//
// - Client IP (utils/clientIp.js), for requests with no verified identity: a
//   relaxed safety layer in front of every account bucket, and the fallback
//   for any request whose token is missing or invalid.
//
// Failing safe: a limiter that prefers an authenticated identity but finds
// none falls back to the IP bucket -- it never skips limiting. The account
// layer is the one exception: with no usable email it skips, because the IP
// layer in front of it always counts the request.
//
// Keys are namespaced "user:<id>:<limiter>" / "acct:<hmac>:<limiter>" /
// "ip:<address>:<limiter>". Each limiter has its own store as well; the name
// keeps keys self-describing.
//
// ipKeyGenerator is the library's own helper and is not optional for the IP
// half: for IPv6 it masks to a /56 so a client holding a prefix cannot rotate
// addresses for a fresh bucket.

const BEARER = /^Bearer[ ]+(\S+)$/i; // same pattern as middleware/auth.js

// The verified user id for this request, or null. Cached on the request so
// several limiters on one route verify the token once.
const verifiedUserId = (req) => {
  if (req.user?.id) {
    return String(req.user.id);
  }

  if (req.rateLimitUserId !== undefined) {
    return req.rateLimitUserId;
  }

  let userId = null;
  const header = req.headers.authorization;
  const match = typeof header === "string" ? header.match(BEARER) : null;

  if (match) {
    try {
      const payload = verifyAccessToken(match[1]);
      if (payload && typeof payload.userId === "string" && payload.userId) {
        userId = payload.userId;
      }
    } catch {
      // Invalid, expired or forged: no identity; the IP bucket applies.
    }
  }

  req.rateLimitUserId = userId;
  return userId;
};

// The session refresh/logout endpoints carry no access token -- only the
// httpOnly refresh cookie. Its signature is verified here (the same check the
// route itself performs first); a forged or garbage cookie falls to the IP.
const verifiedRefreshUserId = (req) => {
  const token = req.cookies?.refreshToken;
  if (typeof token !== "string" || !token) return null;

  try {
    const payload = verifyRefreshToken(token);
    return payload && typeof payload.userId === "string" && payload.userId
      ? payload.userId
      : null;
  } catch {
    return null;
  }
};

const ipKey = (req, name) => `ip:${ipKeyGenerator(getClientIp(req))}:${name}`;

const ipKeyed = (name) => (req) => ipKey(req, name);

const userKeyed = (name) => (req) => {
  const userId = verifiedUserId(req);
  return userId ? `user:${userId}:${name}` : ipKey(req, name);
};

const sessionKeyed = (name) => (req) => {
  const userId = verifiedRefreshUserId(req);
  return userId ? `user:${userId}:${name}` : ipKey(req, name);
};

// ================= ACCOUNT (EMAIL) BUCKETS =================
//
// Login, sign-up, OTP and password reset have no verified identity yet, but
// they do name the account they act on: the email in the body. Keying by that
// email puts the brute-force budget on the account under attack instead of on
// the campus NAT address every student shares.
//
// - The email is normalised exactly as the auth routes normalise it
//   (utils/email.js), so case and padding variants are one bucket.
// - The key is an HMAC of the normalised email, never the address itself: the
//   rate-limit store holds no plaintext email, and nothing that could leak a
//   key (diagnostics, a heap dump) reveals which addresses were tried. The HMAC
//   key is random per process; the store is in-memory and per process too, so
//   nothing needs it to survive a restart.
// - Keys have a fixed size whatever the input, so a long or garbage "email"
//   cannot grow the store per entry. Anything that is not a string, is empty,
//   or is longer than an address can be (254 characters, RFC 5321) gets no
//   account bucket at all -- the route rejects it or finds no account, and the
//   IP limiter in front still counts it.
// - Existing and non-existent accounts are keyed identically, so a limiter
//   response never reveals whether an address is registered.
const ACCOUNT_KEY_SECRET = crypto.randomBytes(32);
const MAX_EMAIL_LENGTH = 254;

// The HMAC of this request's normalised email, or null. Cached on the request
// (like verifiedUserId) because the IP and account layers, `skip` and the
// login success hook all ask for it.
const emailDigest = (req) => {
  if (req.rateLimitEmailDigest !== undefined) {
    return req.rateLimitEmailDigest;
  }

  const email = normalizeEmail(req.body?.email);

  const digest =
    email && email.length <= MAX_EMAIL_LENGTH
      ? crypto
        .createHmac("sha256", ACCOUNT_KEY_SECRET)
        .update(email)
        .digest("base64url")
      : null;

  req.rateLimitEmailDigest = digest;
  return digest;
};

const accountKey = (req, name) => {
  const digest = emailDigest(req);
  return digest ? `acct:${digest}:${name}` : null;
};

// ================= COMMON CONFIG =================

const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {

    const retryAfter =
      req.rateLimit?.resetTime
        ? Math.max(
            1,
            Math.ceil(
              (new Date(req.rateLimit.resetTime).getTime() - Date.now()) / 1000
            )
          )
        : 60;

    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      retryAfter,
    });

  },

};

// ================= AUTH =================

// Every auth route is guarded in two layers:
//
// - ACCOUNT (email) limiter: the primary brute-force / spam protection. It
//   follows the account under attack, whichever addresses the attempts come
//   from, and one student's mistakes never touch another student's budget.
//   It sends no RateLimit-* headers: those would let anyone read how many
//   failures an arbitrary address has accumulated. Its 429 is the same generic
//   body as every other limiter, so a response never says whether the account
//   or the network was the limit, or whether the account exists.
//
// - IP limiter: a safety net against one address hammering many accounts
//   (credential stuffing, mass sign-up, email bombing across addresses). It is
//   sized for a campus NAT full of students -- previously a single IP-keyed
//   budget of 10 login failures (or 5 OTP requests) let one student's typos
//   lock every student on the Wi-Fi out.
//
// The IP limiter runs first, so a flood from one address is rejected before
// any per-account work. Neither layer touches the database.

const accountLimiter = (name, options) => {
  const keyGenerator = (req) => accountKey(req, name);

  return rateLimit({
    ...commonConfig,
    ...options,
    standardHeaders: false,
    keyGenerator,
    // No usable email -> no account bucket. The IP layer still counts it.
    skip: (req) => keyGenerator(req) === null,
    handler: (req, res, next, limiterOptions) => {
      req.rateLimitedByAccount = true;
      return commonConfig.handler(req, res, next, limiterOptions);
    },
  });
};

// The IP layers count what actually reached the route -- a password checked,
// an OTP sent or tried. A request the account layer turned away did neither,
// so it is handed back to the IP budget. Otherwise one student retrying a
// locked account, or pressing "resend" past their own cap, would drain the
// budget every other student on the campus address shares.
const rejectedByAccountLayer = (req) => req.rateLimitedByAccount === true;

// ---------------- Login ----------------
//
// Account: 10 failed attempts per account per 15 minutes -- the same budget
// that used to apply per IP, now on the thing being guessed. That is at most
// ~960 guesses per account per day from any number of addresses. A successful
// login does not count (skipSuccessfulRequests) and clears the account's
// failures (clearLoginFailuresOnSuccess), so a student who mistyped a few times
// and then got in starts fresh.
//
// IP: 100 failed attempts per address per 15 minutes. Successes never count,
// nor do attempts the account layer already refused (no password was checked),
// so this only moves when a campus produces 100 wrong passwords in 15 minutes
// -- far beyond typos (Phase 3: 10 typos from 10 students locked everyone out),
// but it still stops one address from spraying guesses across many accounts
// faster than ~400 per hour. It sits at a third of the session limiter's
// 300-failure IP fallback, the other failure-only IP budget here, because a
// login failure is a password guess.

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const loginIpLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: ipKeyed("login"),

  windowMs: LOGIN_WINDOW_MS,

  max: process.env.NODE_ENV === "production"
    ? 100
    : 1000,

  skipSuccessfulRequests: true,

  requestWasSuccessful: (req, res) =>
    res.statusCode < 400 || rejectedByAccountLayer(req),

});

export const loginAccountLimiter = accountLimiter("login", {

  windowMs: LOGIN_WINDOW_MS,

  max: process.env.NODE_ENV === "production"
    ? 10
    : 100,

  skipSuccessfulRequests: true,

});

// Clears the account's failure count once a login succeeds. Only a response
// below 400 does it -- which /login sends solely after the password matched --
// so an attacker cannot use it to refill the budget of an account they are
// guessing.
const clearLoginFailuresOnSuccess = (req, res, next) => {
  const key = accountKey(req, "login");

  if (key) {
    res.on("finish", () => {
      if (res.statusCode < 400) {
        Promise.resolve(loginAccountLimiter.resetKey(key)).catch(() => {});
      }
    });
  }

  next();
};

export const loginLimiter = [
  loginIpLimiter,
  loginAccountLimiter,
  clearLoginFailuresOnSuccess,
];

// ---------------- Register / OTP / Forgot / Reset ----------------
//
// Sending an OTP (register, resend-otp, forgot-password) and using one
// (verify-otp, reset-password) are budgeted separately, because what they
// protect differs: sends cost an email and can be aimed at someone else's
// inbox; verifies are guesses. Every request counts, successful or not.
//
// Send, per email: 3 per 15 minutes. An OTP is valid for 15 minutes, so this
// is the original code plus two resends within one code's lifetime -- enough
// for a real sign-up or reset, and it caps what anyone can push into one inbox
// at 12 emails an hour.
//
// Send, per IP: 50 per 10 minutes. A sign-up is one send (two with a resend),
// so this admits 25-50 students on one campus address signing up or resetting
// inside ten minutes, where the old 5-per-IP budget admitted about two. It
// still caps one address at ~300 OTP emails an hour across all the inboxes it
// might target.
//
// Verify, per email: 10 per 15 minutes -- defence in depth over the per-code
// budget in the database (consume_otp_attempt, 5 guesses per code), bounding
// guesses across resends as well.
//
// Reset, per email: 10 per 15 minutes. reset-password only succeeds inside the
// 15-minute window a verified OTP opens; the budget leaves room for the
// password-strength retries a real user makes.
//
// Verify + reset, per IP: 100 per 10 minutes (one shared bucket). A sign-up is
// one or two verifies and a reset flow one verify plus a reset or two, so this
// matches the send budget's 25-50 concurrent flows with room for mistypes.

const OTP_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const OTP_IP_WINDOW_MS = 10 * 60 * 1000;

const otpSendIpLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: ipKeyed("otp-send"),

  windowMs: OTP_IP_WINDOW_MS,

  max: process.env.NODE_ENV === "production"
    ? 50
    : 500,

  // Every request that reached the route counts, whatever its outcome; only
  // one the account layer turned away is handed back.
  skipFailedRequests: true,

  requestWasSuccessful: (req) => !rejectedByAccountLayer(req),

});

const otpSendAccountLimiter = accountLimiter("otp-send", {

  windowMs: OTP_ACCOUNT_WINDOW_MS,

  max: process.env.NODE_ENV === "production"
    ? 3
    : 100,

});

const otpVerifyIpLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: ipKeyed("otp-verify"),

  windowMs: OTP_IP_WINDOW_MS,

  max: process.env.NODE_ENV === "production"
    ? 100
    : 1000,

  // Every request that reached the route counts, whatever its outcome; only
  // one the account layer turned away is handed back.
  skipFailedRequests: true,

  requestWasSuccessful: (req) => !rejectedByAccountLayer(req),

});

const otpVerifyAccountLimiter = accountLimiter("otp-verify", {

  windowMs: OTP_ACCOUNT_WINDOW_MS,

  max: process.env.NODE_ENV === "production"
    ? 10
    : 100,

});

const otpResetAccountLimiter = accountLimiter("otp-reset", {

  windowMs: OTP_ACCOUNT_WINDOW_MS,

  max: process.env.NODE_ENV === "production"
    ? 10
    : 100,

});

// register, resend-otp, forgot-password
export const otpSendLimiter = [otpSendIpLimiter, otpSendAccountLimiter];

// verify-otp
export const otpVerifyLimiter = [otpVerifyIpLimiter, otpVerifyAccountLimiter];

// reset-password
export const otpResetLimiter = [otpVerifyIpLimiter, otpResetAccountLimiter];

// ================= SESSION =================

// Guards POST /session/refresh and /session/logout, which authenticate purely
// from the httpOnly refresh cookie and were previously unlimited.
//
// Keyed by the user of a signature-verified refresh cookie, so students behind
// one campus NAT no longer share a bucket; a missing, garbage or forged cookie
// is keyed by IP instead.
//
// skipSuccessfulRequests still matters: counting only failures means
// legitimate traffic never consumes budget, while a flood of invalid or
// replayed cookies still gets throttled. That is also the real threat model:
// an HS256-signed refresh JWT cannot be meaningfully brute-forced, so what is
// being protected is the database work each call performs.
//
// Note this interacts with Phase 2.2 CAS and Phase 2.4 grace handling, which
// legitimately return 401 to the loser of a genuine multi-tab refresh race.
// Those 401s do count against this limit, which is why the ceiling is high.
export const sessionLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: sessionKeyed("session"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 300
    : 1000,

  skipSuccessfulRequests: true,

});

// ================= UPLOAD =================

// Admin-only image upload. Each request can carry up to 2MB into Supabase
// Storage, so this is deliberately tighter than the other authenticated
// limiters -- the cost per request is storage and bandwidth, not CPU.
export const uploadLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("upload"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 30
    : 300,

});

// ================= MENU =================

// Shared by /api/food, /api/categories, /api/user, /api/notifications and
// /api/push: one budget per signed-in user across those reads. The public menu
// endpoints need no token, so an anonymous caller is counted by IP.
export const menuLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("menu"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 1000
    : 10000,

});

// ================= ORDERS =================

// Placing an order is the spam-sensitive operation: each one reserves a daily
// token, writes an order, notifies the kitchen and the student. Only POST
// /api/orders counts against this, per signed-in student.
export const orderCreateLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("order-create"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 30
    : 100000,

});

// Viewing the order list, tracking an order and cancelling are ordinary use --
// the tracking page, the orders page and the profile read these repeatedly.
// They no longer share the creation quota (a student browsing their own orders
// was locked out after ~9 minutes in load testing), but are still bounded per
// user.
export const orderReadLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("order-read"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 600
    : 100000,

});

// ================= FAVORITES =================

export const favoriteLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("favorite"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 200
    : 2000,

});

// ================= PAYMENT =================

// Per signed-in student for create-order / verify.
export const paymentLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("payment"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 30
    : 300,

});

// ================= RAZORPAY WEBHOOK =================
//
// Razorpay calls POST /api/payment/webhook server-to-server from a small, fixed
// set of egress addresses, with no user identity -- so the key is the client
// address (utils/clientIp.js, the same trusted-edge rules as everything else).
//
// It used to share paymentLimiter: 30 requests per address per 15 minutes,
// every delivery counted. A lunch rush sends more than that -- one or more
// events per online payment, plus refund events -- and Razorpay answers a 429
// the way it answers any non-2xx: it retries for 24 hours and then DISABLES the
// webhook. Legitimate deliveries must therefore never be what exhausts it.
//
// So only rejected requests count: 4xx answers -- a missing or wrong
// signature, a body that is not the raw JSON Razorpay sends, an oversized body.
// Those are what an unauthenticated flood produces. A delivery that passed the
// signature check is never charged, whether it was processed (200) or the
// handler asked Razorpay to retry it (5xx: refund not yet recorded, a
// concurrent change, a transient DB error), so bursts and Razorpay's own
// retries cannot lock the webhook out.
//
// 100 rejections per address per 15 minutes: Razorpay itself produces none
// unless the webhook secret is misconfigured, so this is purely the ceiling on
// junk from one address. The count is taken when a request starts and handed
// back when it ends well, so the ceiling also has to sit far above the number
// of genuine deliveries in flight at once (a handful at a few per second and
// sub-second handling) -- 100 does.
//
// Mounted in server.js AHEAD of the raw body parser, so a flood is refused
// before its body is even read.
export const webhookLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: ipKeyed("razorpay-webhook"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 100
    : 1000,

  skipSuccessfulRequests: true,

  requestWasSuccessful: (req, res) =>
    res.statusCode < 400 || res.statusCode >= 500,

});

// ================= ADMIN =================

// Per signed-in admin: two admins on the canteen Wi-Fi no longer share one
// budget. The admin queue refetches when realtime order events arrive; those
// refetches are coalesced client-side (AdminOrders), and this ceiling leaves
// room for a lunch rush -- in load testing a busy queue needed ~350 requests
// in its first few minutes and hit the old 300 / 15 min per-IP cap.
export const adminLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("admin"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 1500
    : 10000,

});