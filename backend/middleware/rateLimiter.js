import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getClientIp } from "../utils/clientIp.js";
import { verifyAccessToken, verifyRefreshToken } from "../utils/jwt.js";

// ================= WHO A REQUEST COUNTS AGAINST =================
//
// Two kinds of bucket:
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
// - Client IP (utils/clientIp.js), for requests with no verified identity:
//   login, sign-up, OTP, password reset, and any request whose token is
//   missing or invalid. Those are exactly the abuse-sensitive, unauthenticated
//   cases, and IP is the only handle they offer.
//
// Failing safe: a limiter that prefers an authenticated identity but finds
// none falls back to the IP bucket -- it never skips limiting.
//
// Keys are namespaced "user:<id>:<limiter>" / "ip:<address>:<limiter>". Each
// limiter has its own store as well; the name keeps keys self-describing.
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

// Login
export const loginLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: ipKeyed("login"),

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

  keyGenerator: ipKeyed("otp"),

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

// Per signed-in student for create-order / verify. The Razorpay webhook shares
// this limiter and carries no user token, so it is counted by IP.
export const paymentLimiter = rateLimit({

  ...commonConfig,

  keyGenerator: userKeyed("payment"),

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === "production"
    ? 30
    : 300,

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