import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import foodRoutes from './routes/food.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import categoryRoutes from './routes/category.js';
import uploadRoutes from './routes/upload.js';
import paymentRoutes from "./routes/payment.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ IMPROVED CORS (faster + no delay)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 🔥 VERY IMPORTANT (fix slow preflight)
app.options('*', cors());

app.use(express.json());

// ================== HEALTH ROUTES ==================

// Root route (fix "Cannot GET /")
app.get('/', (req, res) => {
  res.send('CampusBites Backend Running 🚀');
});

// Health check for UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Your existing API health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CampusBites API is running' });
});

// ================== API ROUTES ==================

app.use('/api/auth', authRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use("/api/payment", paymentRoutes);

// ================== SERVER ==================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});