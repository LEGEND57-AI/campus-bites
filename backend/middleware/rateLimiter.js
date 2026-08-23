import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { isIP } from "node:net";

// ================= CLIENT IDENTITY =================
//
// Which address every limiter below counts against.
//
// The default is req.ip, and in this deployment that is the wrong value.
// Production runs browser -> Cloudflare -> Render router -> Express, but
// `trust proxy` is 1, so Express walks back a single hop and lands on the
// LAST X-Forwarded-For entry -- Render's internal router. Logs confirmed it:
// req.ip resolved to ::1 or 10.x addresses, one of which was shared by 8 of
// 10 users. Everyone behind a given internal hop shared a bucket, so one
// person could exhaust the login or OTP budget for everyone else, while the
// same client scattered across hops collected several budgets.
//
// CF-Connecting-IP is used instead because Cloudflare sets it itself on every
// proxied request and refuses one supplied by the caller -- an outside request
// carrying that header is rejected at the edge with 403, so it cannot be
// forged through Cloudflare. X-Forwarded-For is deliberately NOT used: its
// length varies with the chain (4 entries in one logged request, 3 in
// another), so no fixed index identifies the client. remoteAddress is only
// the local Render connection, and true-client-ip is an Enterprise alias that
// carries no additional guarantee here.
//
// ipKeyGenerator is the library's own helper and is not optional: for IPv6 it
// masks to a /56 so a client holding a prefix cannot rotate addresses for a
// fresh bucket. express-rate-limit v8 enforces this -- a custom keyGenerator
// touching req.ip without it throws ERR_ERL_KEY_GEN_IPV6 at startup.
//
// Anything missing, duplicated, malformed or not a real IP falls through to
// req.ip, which is exactly the behaviour that existed before this change. The
// address is used only as a bucket key: never logged, never returned.
const clientIpKeyGenerator = (req) => {
  const header = req.headers["cf-connecting-ip"];

  // A repeated header arrives as an array; only a single string is trusted.
  const candidate = typeof header === "string" ? header.trim() : "";

  // isIP returns 0 for anything that is not a valid IPv4 or IPv6 address.
  const clientIp = isIP(candidate) !== 0 ? candidate : req.ip;

  return ipKeyGenerator(clientIp ?? "");
};

// ================= COMMON CONFIG =================

const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKeyGenerator,

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

// Login
export const loginLimiter = rateLimit({

  ...commonConfig,

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 10
    : 100,

  skipSuccessfulRequests: true,

  message: {
    error:
      "Too many login attempts. Please try again after 15 minutes.",
  },

});

// Register / OTP / Forgot Password
export const otpLimiter = rateLimit({

  ...commonConfig,

  windowMs: 10 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 5
    : 100,

  message: {
    error:
      "Too many OTP requests. Please wait before requesting another OTP.",
  },

});

// ================= SESSION =================

// Guards POST /session/refresh and /session/logout, which authenticate purely
// from the httpOnly refresh cookie and were previously unlimited.
//
// skipSuccessfulRequests is the important part. Rate limiting here is keyed by
// IP, and a campus behind one NAT egress shares a single bucket -- with an
// access-token lifetime of 15m, a few hundred students refreshing normally
// would exhaust any tight limit and be force-logged-out en masse (api.js
// redirects to /login on any refresh failure). Counting only failures means
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

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 30
    : 300,

});

// ================= MENU =================

export const menuLimiter = rateLimit({

  ...commonConfig,

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 1000
    : 10000,

});

// ================= ORDERS =================

export const orderLimiter = rateLimit({

  ...commonConfig,

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 50
    : 100000,

});

// ================= FAVORITES =================

export const favoriteLimiter = rateLimit({

  ...commonConfig,

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 200
    : 2000,

});

// ================= PAYMENT =================

export const paymentLimiter = rateLimit({

  ...commonConfig,

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 30
    : 300,

});

// ================= ADMIN =================

export const adminLimiter = rateLimit({

  ...commonConfig,

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 300      // 🔥 was 100 — raised to give admins headroom for manual actions + polling
    : 1000,

});