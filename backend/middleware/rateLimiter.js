import rateLimit from "express-rate-limit";

// ================= COMMON CONFIG =================

const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
  },

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