// MUST stay the first import. db.js, utils/razorpay.js and
// utils/pushNotification.js all construct their clients at module-evaluation
// time and throw there if their credentials are absent, so by the time the
// body of this file runs those failures have already happened -- with
// messages that name no environment variable. Importing the validator first
// means the whole environment is checked, and reported by name, before any
// of that evaluates. It loads dotenv itself for the same reason: the
// dotenv.config() call below runs far too late to help it.
import "./utils/validateEnv.js";

import http from "http";
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from "helmet";
import {
  menuLimiter,
  adminLimiter,
} from "./middleware/rateLimiter.js";

import authRoutes from './routes/auth.js';
import foodRoutes from './routes/food.js';
import orderRoutes from './routes/orders.js';
import historyRoutes from "./routes/history.js";
import favoriteRoutes from "./routes/favorites.js";
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from "./routes/analytics.js";
import categoryRoutes from './routes/category.js';
import uploadRoutes from './routes/upload.js';
import paymentRoutes from "./routes/payment.js";
import paymentWebhookRoutes from "./routes/paymentWebhook.js";
import notificationRoutes from "./routes/notifications.js";
import pushRoutes from "./routes/push.js";
import { autoCancelExpiredCashOrders } from "./utils/autoCancelOrders.js";
import { initializeSocket } from "./socket/index.js";
import sessionRoutes from "./routes/session.js";
import cookieParser from "cookie-parser";
import logger from "./utils/logger.js";
import { getAllowedOrigins } from "./utils/allowedOrigins.js";
import pinoHttp from "pino-http";


dotenv.config();

// Surfaced once at startup, before either the Socket.IO or HTTP CORS layer
// is configured below. An empty allowlist is not fatal -- both layers fail
// closed -- but it rejects every cross-origin browser request, which is
// otherwise indistinguishable from a CORS bug when debugging.
if (getAllowedOrigins().length === 0) {
  logger.warn(
    "CORS_ORIGINS is not set or is empty — all cross-origin browser requests will be rejected."
  );
}

const app = express();
const server = http.createServer(app);
initializeSocket(server);

app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;


// ✅ IMPROVED CORS (faster + no delay)
const allowedOrigins = getAllowedOrigins();


const corsOptions = {
  origin: (origin, callback) => {

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // A disallowed Origin is a client-side condition, not a server fault.
    // The cors middleware signals rejection by handing this error to
    // next(), which would otherwise fall through to the global handler and
    // be reported as a generic 500. Tagging the error lets that handler
    // recognise this one specific case and answer 403 instead. The flag is
    // matched on rather than the message, so the check stays exact and no
    // other error can accidentally take that path.
    const corsError = new Error("Not allowed by CORS");
    corsError.isCorsOriginError = true;
    corsError.origin = origin;

    return callback(corsError);
  },

  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],

  allowedHeaders: ["Content-Type", "Authorization"],

  credentials: true,
};


app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// Razorpay webhook must be mounted before the global express.json() parser
// below so the request body stays a raw Buffer — Razorpay signs the exact
// raw bytes it sends, and re-serializing a parsed JSON object would not
// reliably reproduce them, breaking signature verification.
app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  paymentWebhookRoutes
);

app.use(express.json());

app.use(cookieParser());

app.use(
  pinoHttp({
    logger,
  })
);

// ================== HEALTH ROUTES ==================

// Root route (fix "Cannot GET /")
app.get('/', (req, res) => {
  res.send('CampusCraves Backend Running 🚀');
});

// Health check for UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Your existing API health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CampusCraves API is running' });
});

// ================== API ROUTES ==================

app.use('/api/auth', authRoutes);
app.use("/api/food", menuLimiter, foodRoutes);
app.use('/api/orders', orderRoutes);
app.use("/api/admin/history", historyRoutes);
app.use("/api/favorites", favoriteRoutes);
// These four groups authenticate inside their routers but were the only ones
// mounted with no rate limit at all. The limiter goes ahead of the router so
// the existing order (limit -> authenticate -> isAdmin -> handler) is kept,
// matching how /api/food is already mounted.
//
// menuLimiter rather than the tighter favoriteLimiter: limiting is keyed by
// IP and the campus shares one NAT egress (see the note on sessionLimiter),
// while DashboardHeader refetches the unread count on every mount. A 200/15min
// ceiling could therefore lock out the whole campus during normal navigation,
// which is a worse outcome than the request flooding this guards against.
app.use('/api/user', menuLimiter, userRoutes);
app.use('/api/admin', adminRoutes);
// adminLimiter: this group is already admin-only, and its handlers are the
// most expensive in the app (several full-table GROUP BY aggregations per
// request), so it shares the admin budget rather than the looser menu one.
app.use("/api/analytics", adminLimiter, analyticsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/notifications", menuLimiter, notificationRoutes);
app.use("/api/push", menuLimiter, pushRoutes);
app.use("/api/session", sessionRoutes);

// Auto cancel expired cash orders every 1 minute
setInterval(async () => {
  try {
    await autoCancelExpiredCashOrders();
  } catch (err) {
    console.error("Auto Cancel Scheduler Error:", err);
  }
}, 60000);

// ================== GLOBAL ERROR HANDLER ==================
// Must be registered after all routes/middleware. Catches anything not
// handled by a route's own try/catch (e.g. errors thrown synchronously
// in middleware, or passed to next(err)).
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Only the error tagged by the CORS origin callback above takes this
  // branch. It is a rejected client origin, not a server fault, so it is
  // logged at warn and answered 403 rather than 500. Every other error --
  // including any unexpected exception -- falls through to the 500 below.
  if (err && err.isCorsOriginError) {
    (req.log || logger).warn(
      { origin: err.origin, path: req.originalUrl },
      "Blocked request from disallowed origin"
    );

    return res.status(403).json({ error: "Origin not allowed" });
  }

  (req.log || logger).error({ err }, "Unhandled error");

  res.status(500).json({ error: "Internal server error" });
});

// ================== SERVER ==================

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});