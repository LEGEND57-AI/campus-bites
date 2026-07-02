import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from './routes/auth.js';
import foodRoutes from './routes/food.js';
import orderRoutes from './routes/orders.js';
import favoriteRoutes from "./routes/favorites.js";
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import categoryRoutes from './routes/category.js';
import uploadRoutes from './routes/upload.js';
import paymentRoutes from "./routes/payment.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Max 300 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

// ✅ IMPROVED CORS (faster + no delay)
const allowedOrigins =
  process.env.CORS_ORIGINS?.split(",") || [];


const corsOptions = {
  origin: (origin, callback) => {

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
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
  })
);
app.use(express.json());
app.use("/api", apiLimiter);

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
app.use('/api/food', foodRoutes);
app.use('/api/orders', orderRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use("/api/payment", paymentRoutes);

// ================== SERVER ==================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});