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
    : 500,

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