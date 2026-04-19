const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

// Helper to write file and create directories
function writeFile(filePath, content) {
  const fullPath = path.join(rootDir, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content.trim());
  console.log(`✅ Created: ${filePath}`);
}

// ---------- BACKEND FILES ----------
writeFile('backend/package.json', `
{
  "name": "campusbites-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@supabase/supabase-js": "^2.39.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
`);

writeFile('backend/.env', `
PORT=5000
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=superSecretKeyChangeThis123!
`);

writeFile('backend/db.js', `
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
`);

writeFile('backend/middleware/auth.js', `
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase.from('users').select('id, email, name, phone').eq('id', decoded.userId).single();
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
`);

writeFile('backend/routes/auth.js', `
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';
import { body, validationResult } from 'express-validator';
const router = express.Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty().trim(),
  body('phone').notEmpty().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, name, phone } = req.body;
  try {
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase.from('users').insert([{ email, password_hash: hashedPassword, name, phone }]).select('id, email, name, phone').single();
    if (error) throw error;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('id, email, name, phone, password_hash').eq('email', email).single();
    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
`);

writeFile('backend/routes/food.js', `
import express from 'express';
import { supabase } from '../db.js';
const router = express.Router();

router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('id');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/items', async (req, res) => {
  try {
    const { categoryId, search } = req.query;
    let query = supabase.from('food_items').select('*, categories (id, name)').eq('available', true);
    if (categoryId && categoryId !== 'all') query = query.eq('category_id', parseInt(categoryId));
    if (search) query = query.ilike('name', \`%\${search}%\`);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch food items' });
  }
});

export default router;
`);

writeFile('backend/routes/orders.js', `
import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    const itemIds = items.map(item => item.foodItemId);
    const { data: foodItems, error: fetchError } = await supabase.from('food_items').select('id, price, name').in('id', itemIds);
    if (fetchError) throw fetchError;
    let totalAmount = 0;
    const orderItemsWithPrices = items.map(item => {
      const foodItem = foodItems.find(fi => fi.id === item.foodItemId);
      const priceAtTime = foodItem.price;
      totalAmount += priceAtTime * item.quantity;
      return { food_item_id: item.foodItemId, quantity: item.quantity, price_at_time: priceAtTime };
    });
    const { data: order, error: orderError } = await supabase.from('orders').insert([{ user_id: req.user.id, total_amount: totalAmount, status: 'Pending' }]).select().single();
    if (orderError) throw orderError;
    const orderItemsWithOrderId = orderItemsWithPrices.map(item => ({ ...item, order_id: order.id }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsWithOrderId);
    if (itemsError) throw itemsError;
    res.status(201).json({ order, totalAmount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from('orders').select('*, order_items (quantity, price_at_time, food_items (id, name, image_url))').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export default router;
`);

writeFile('backend/routes/user.js', `
import express from 'express';
import { supabase } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
const router = express.Router();
router.use(authenticate);

router.get('/profile', async (req, res) => {
  try {
    const { data: user, error } = await supabase.from('users').select('id, email, name, phone').eq('id', req.user.id).single();
    if (error) throw error;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    const { data: user, error } = await supabase.from('users').update(updates).eq('id', req.user.id).select('id, email, name, phone').single();
    if (error) throw error;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
`);

writeFile('backend/server.js', `
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import foodRoutes from './routes/food.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/user.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', userRoutes);
app.get('/api/health', (req, res) => { res.json({ status: 'OK', message: 'CampusBites API is running' }); });
app.listen(PORT, () => { console.log(\`Server running on port \${PORT}\`); });
`);

// ---------- FRONTEND FILES ----------
writeFile('frontend/package.json', `
{
  "name": "campusbites-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2",
    "framer-motion": "^10.16.16",
    "react-hot-toast": "^2.4.1",
    "lucide-react": "^0.292.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "vite": "^5.0.8"
  }
}
`);

writeFile('frontend/vite.config.js', `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 }
})
`);

writeFile('frontend/tailwind.config.js', `
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { 'sans': ['Inter', 'Poppins', 'system-ui', 'sans-serif'] },
      animation: { 'fade-in': 'fadeIn 0.5s ease-in-out', 'slide-up': 'slideUp 0.3s ease-out', 'scale-up': 'scaleUp 0.2s ease-out' },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        scaleUp: { '0%': { transform: 'scale(0.95)' }, '100%': { transform: 'scale(1)' } }
      }
    }
  },
  plugins: []
}
`);

writeFile('frontend/index.html', `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><link rel="icon" type="image/svg+xml" href="/vite.svg"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>CampusBites - Campus Food Ordering</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
`);

writeFile('frontend/src/index.css', `
@import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=Poppins:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;
@layer base {
  body { @apply bg-gradient-to-br from-slate-50 via-white to-blue-50/30 min-h-screen; }
}
@layer components {
  .glass-card { @apply bg-white/80 backdrop-blur-md border border-white/20 shadow-xl; }
  .gradient-text { @apply bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent; }
  .btn-primary { @apply bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-2 px-6 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300 ease-out; }
  .btn-secondary { @apply bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300; }
}
`);

writeFile('frontend/src/main.jsx', `
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`);

writeFile('frontend/src/services/api.js', `
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = \`Bearer \${token}\`;
  return config;
});
export const authAPI = { register: (data) => api.post('/auth/register', data), login: (data) => api.post('/auth/login', data) };
export const foodAPI = { getCategories: () => api.get('/food/categories'), getItems: (params) => api.get('/food/items', { params }) };
export const orderAPI = { placeOrder: (items) => api.post('/orders', { items }), getOrders: () => api.get('/orders') };
export const userAPI = { getProfile: () => api.get('/user/profile'), updateProfile: (data) => api.put('/user/profile', data) };
export default api;
`);

writeFile('frontend/src/context/AuthContext.jsx', `
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) setUser(JSON.parse(storedUser));
    setLoading(false);
  }, []);
  const login = async (email, password) => {
    try {
      const { data } = await authAPI.login({ email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      toast.success('Welcome back!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
      return false;
    }
  };
  const register = async (name, email, phone, password) => {
    try {
      const { data } = await authAPI.register({ name, email, phone, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      toast.success('Account created successfully!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed');
      return false;
    }
  };
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); toast.success('Logged out successfully'); };
  return <AuthContext.Provider value={{ user, login, register, logout, loading }}>{children}</AuthContext.Provider>;
};
`);

writeFile('frontend/src/context/CartContext.jsx', `
import React, { createContext, useState, useContext, useEffect } from 'react';
import toast from 'react-hot-toast';
const CartContext = createContext();
export const useCart = () => useContext(CartContext);
const CART_STORAGE_KEY = 'campusbites_cart';
export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) setItems(JSON.parse(savedCart));
  }, []);
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    const newTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setTotal(newTotal);
  }, [items]);
  const addToCart = (foodItem) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === foodItem.id);
      if (existingItem) {
        toast.success(\`Added another \${foodItem.name} to cart\`);
        return prevItems.map(item => item.id === foodItem.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(\`\${foodItem.name} added to cart\`);
      return [...prevItems, { ...foodItem, quantity: 1 }];
    });
  };
  const updateQuantity = (id, delta) => {
    setItems(prevItems => {
      const item = prevItems.find(i => i.id === id);
      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) return prevItems.filter(i => i.id !== id);
      return prevItems.map(i => i.id === id ? { ...i, quantity: newQuantity } : i);
    });
  };
  const removeItem = (id) => { setItems(prevItems => prevItems.filter(i => i.id !== id)); toast.success('Item removed from cart'); };
  const clearCart = () => setItems([]);
  const getItemCount = () => items.reduce((sum, item) => sum + item.quantity, 0);
  return <CartContext.Provider value={{ items, total, addToCart, updateQuantity, removeItem, clearCart, getItemCount }}>{children}</CartContext.Provider>;
};
`);

writeFile('frontend/src/components/Navbar.jsx', `
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ShoppingCart, User, LogOut, Menu, X } from 'lucide-react';
const Navbar = () => {
  const { user, logout } = useAuth();
  const { getItemCount } = useCart();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const handleLogout = () => { logout(); navigate('/login'); };
  return (
    <nav className="sticky top-0 z-50 glass-card shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <motion.div whileHover={{ scale: 1.05 }} className="text-2xl font-bold gradient-text">CampusBites</motion.div>
          </Link>
          <div className="hidden md:flex items-center space-x-6">
            {user && (
              <>
                <Link to="/" className="text-gray-600 hover:text-blue-600 transition">Menu</Link>
                <Link to="/cart" className="relative">
                  <ShoppingCart className="w-5 h-5 text-gray-600 hover:text-blue-600 transition" />
                  {getItemCount() > 0 && <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{getItemCount()}</span>}
                </Link>
                <Link to="/profile" className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition"><User className="w-4 h-4" /><span>{user.name.split(' ')[0]}</span></Link>
                <button onClick={handleLogout} className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition"><LogOut className="w-4 h-4" /><span>Logout</span></button>
              </>
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-lg text-gray-600">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {isMobileMenuOpen && user && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="md:hidden glass-card border-t">
          <div className="px-4 py-3 space-y-3">
            <Link to="/" className="block text-gray-600 hover:text-blue-600">Menu</Link>
            <Link to="/cart" className="block text-gray-600 hover:text-blue-600">Cart ({getItemCount()})</Link>
            <Link to="/profile" className="block text-gray-600 hover:text-blue-600">Profile</Link>
            <button onClick={handleLogout} className="block w-full text-left text-red-600">Logout</button>
          </div>
        </motion.div>
      )}
    </nav>
  );
};
export default Navbar;
`);

writeFile('frontend/src/components/FoodCard.jsx', `
import React from 'react';
import { motion } from 'framer-motion';
import { Star, Plus } from 'lucide-react';
const FoodCard = ({ item, onAddToCart }) => {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -8 }} transition={{ duration: 0.2 }} className="glass-card rounded-2xl overflow-hidden cursor-pointer group">
      <div className="relative h-48 overflow-hidden">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2"><h3 className="font-semibold text-gray-800 text-lg">{item.name}</h3><span className="text-blue-600 font-bold">\${item.price}</span></div>
        <p className="text-gray-500 text-sm mb-3 line-clamp-2">{item.description}</p>
        <div className="flex items-center justify-between"><span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{item.categories?.name}</span>
        <motion.button whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); onAddToCart(item); }} className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-2 rounded-xl hover:shadow-lg transition-all"><Plus className="w-4 h-4" /></motion.button></div>
      </div>
    </motion.div>
  );
};
export default FoodCard;
`);

writeFile('frontend/src/components/CategoryFilter.jsx', `
import React from 'react';
import { motion } from 'framer-motion';
const CategoryFilter = ({ categories, selectedCategory, onSelectCategory }) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => onSelectCategory('all')} className={\`px-5 py-2 rounded-full font-medium whitespace-nowrap transition-all \${selectedCategory === 'all' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/70 backdrop-blur-sm text-gray-600 hover:bg-white'}\`}>All Items</motion.button>
      {categories.map((category) => (<motion.button key={category.id} whileTap={{ scale: 0.95 }} onClick={() => onSelectCategory(category.id.toString())} className={\`px-5 py-2 rounded-full font-medium whitespace-nowrap transition-all \${selectedCategory === category.id.toString() ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/70 backdrop-blur-sm text-gray-600 hover:bg-white'}\`}>{category.name}</motion.button>))}
    </div>
  );
};
export default CategoryFilter;
`);

writeFile('frontend/src/components/LoadingSkeleton.jsx', `
import React from 'react';
const LoadingSkeleton = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (<div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse"><div className="h-48 bg-gray-200"></div><div className="p-4 space-y-3"><div className="h-5 bg-gray-200 rounded w-3/4"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div><div className="h-10 bg-gray-200 rounded"></div></div></div>))}
    </div>
  );
};
export default LoadingSkeleton;
`);

writeFile('frontend/src/components/ProtectedRoute.jsx', `
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  return user ? children : <Navigate to="/login" />;
};
export default ProtectedRoute;
`);

writeFile('frontend/src/pages/Login.jsx', `
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed } from 'lucide-react';
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e) => { e.preventDefault(); setIsLoading(true); const success = await login(email, password); setIsLoading(false); if (success) navigate('/'); };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-8"><div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 mb-4"><UtensilsCrossed className="w-8 h-8 text-white" /></div><h2 className="text-3xl font-bold gradient-text">Welcome Back</h2><p className="text-gray-500 mt-2">Sign in to continue to CampusBites</p></div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition" placeholder="student@campus.edu" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition" placeholder="••••••••" required /></div>
          <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isLoading} className="w-full btn-primary py-3 text-lg disabled:opacity-70">{isLoading ? 'Signing in...' : 'Sign In'}</motion.button>
        </form>
        <p className="text-center mt-6 text-gray-600">Don't have an account? <Link to="/signup" className="text-blue-600 font-semibold hover:underline">Sign up</Link></p>
      </motion.div>
    </div>
  );
};
export default Login;
`);

writeFile('frontend/src/pages/Signup.jsx', `
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed } from 'lucide-react';
const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e) => { e.preventDefault(); setIsLoading(true); const success = await register(name, email, phone, password); setIsLoading(false); if (success) navigate('/'); };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-8"><div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 mb-4"><UtensilsCrossed className="w-8 h-8 text-white" /></div><h2 className="text-3xl font-bold gradient-text">Join CampusBites</h2><p className="text-gray-500 mt-2">Create your account to start ordering</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition" placeholder="John Doe" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition" placeholder="student@campus.edu" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition" placeholder="+1 234 567 8900" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition" placeholder="••••••••" required /></div>
          <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isLoading} className="w-full btn-primary py-3 text-lg disabled:opacity-70">{isLoading ? 'Creating account...' : 'Sign Up'}</motion.button>
        </form>
        <p className="text-center mt-6 text-gray-600">Already have an account? <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link></p>
      </motion.div>
    </div>
  );
};
export default Signup;
`);

writeFile('frontend/src/pages/Dashboard.jsx', `
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { foodAPI } from '../services/api';
import Navbar from '../components/Navbar';
import FoodCard from '../components/FoodCard';
import CategoryFilter from '../components/CategoryFilter';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
const Dashboard = () => {
  const [foodItems, setFoodItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchFoodItems(); }, [selectedCategory, searchQuery]);
  const fetchCategories = async () => { try { const { data } = await foodAPI.getCategories(); setCategories(data); } catch (error) { toast.error('Failed to load categories'); } };
  const fetchFoodItems = async () => { setLoading(true); try { const params = {}; if (selectedCategory !== 'all') params.categoryId = selectedCategory; if (searchQuery) params.search = searchQuery; const { data } = await foodAPI.getItems(params); setFoodItems(data); } catch (error) { toast.error('Failed to load menu'); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10"><h1 className="text-4xl md:text-5xl font-bold gradient-text mb-4">What's for lunch today?</h1><p className="text-gray-500 text-lg">Delicious meals delivered to your campus</p></motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-md mx-auto mb-8"><div className="relative"><Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="text" placeholder="Search for burgers, pizza, drinks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-xl glass-card border border-white/30 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition" /></div></motion.div>
        {categories.length > 0 && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8"><CategoryFilter categories={categories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} /></motion.div>)}
        {loading ? <LoadingSkeleton /> : foodItems.length === 0 ? (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20"><p className="text-gray-400 text-lg">No items found</p></motion.div>) : (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{foodItems.map((item, index) => (<motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><FoodCard item={item} onAddToCart={addToCart} /></motion.div>))}</motion.div>)}
      </main>
    </div>
  );
};
export default Dashboard;
`);

writeFile('frontend/src/pages/CartPage.jsx', `
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderAPI } from '../services/api';
import Navbar from '../components/Navbar';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
const CartPage = () => {
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const handlePlaceOrder = async () => { if (!user) { toast.error('Please login to place order'); navigate('/login'); return; } if (items.length === 0) { toast.error('Your cart is empty'); return; } setIsPlacingOrder(true); try { const orderItems = items.map(item => ({ foodItemId: item.id, quantity: item.quantity })); await orderAPI.placeOrder(orderItems); clearCart(); toast.success('Order placed successfully!'); navigate('/profile'); } catch (error) { toast.error('Failed to place order'); } finally { setIsPlacingOrder(false); } };
  if (items.length === 0) return (<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30"><Navbar /><div className="flex flex-col items-center justify-center h-[80vh] px-4"><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center"><ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-6" /><h2 className="text-2xl font-semibold text-gray-600 mb-2">Your cart is empty</h2><p className="text-gray-400 mb-6">Looks like you haven't added anything yet</p><Link to="/" className="btn-primary inline-block">Browse Menu</Link></motion.div></div></div>);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8"><Link to="/" className="flex items-center text-gray-600 hover:text-blue-600 transition"><ArrowLeft className="w-5 h-5 mr-2" />Continue Shopping</Link><h1 className="text-2xl font-bold gradient-text">Your Cart</h1><div className="w-20"></div></div>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">{items.map((item, index) => (<motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="glass-card rounded-2xl p-4 flex gap-4"><img src={item.image_url} alt={item.name} className="w-24 h-24 rounded-xl object-cover" /><div className="flex-1"><h3 className="font-semibold text-gray-800">{item.name}</h3><p className="text-blue-600 font-bold mt-1">\${item.price}</p><div className="flex items-center gap-3 mt-2"><button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition"><Minus className="w-4 h-4" /></button><span className="font-medium w-8 text-center">{item.quantity}</span><button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition"><Plus className="w-4 h-4" /></button><button onClick={() => removeItem(item.id)} className="p-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 ml-auto"><Trash2 className="w-4 h-4" /></button></div></div><div className="text-right"><p className="font-bold text-gray-800">\${(item.price * item.quantity).toFixed(2)}</p></div></motion.div>))}</div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1"><div className="glass-card rounded-2xl p-6 sticky top-24"><h2 className="text-xl font-bold mb-4">Order Summary</h2><div className="space-y-3 border-b pb-4 mb-4"><div className="flex justify-between text-gray-600"><span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span><span>\${total.toFixed(2)}</span></div><div className="flex justify-between text-gray-600"><span>Delivery Fee</span><span>\$0.00</span></div></div><div className="flex justify-between text-xl font-bold mb-6"><span>Total</span><span className="gradient-text">\${total.toFixed(2)}</span></div><button onClick={handlePlaceOrder} disabled={isPlacingOrder} className="w-full btn-primary py-3 text-lg disabled:opacity-70">{isPlacingOrder ? 'Placing Order...' : 'Place Order'}</button></div></motion.div>
        </div>
      </main>
    </div>
  );
};
export default CartPage;
`);

writeFile('frontend/src/pages/ProfilePage.jsx', `
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { userAPI, orderAPI } from '../services/api';
import Navbar from '../components/Navbar';
import { User, Mail, Phone, Package, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchProfile(); fetchOrders(); }, []);
  const fetchProfile = async () => { try { const { data } = await userAPI.getProfile(); setProfile(data); } catch (error) { toast.error('Failed to load profile'); } };
  const fetchOrders = async () => { try { const { data } = await orderAPI.getOrders(); setOrders(data); } catch (error) { toast.error('Failed to load orders'); } finally { setLoading(false); } };
  const handleUpdateProfile = async (e) => { e.preventDefault(); try { const { data } = await userAPI.updateProfile(profile); setProfile(data); setIsEditing(false); toast.success('Profile updated'); } catch (error) { toast.error('Update failed'); } };
  const getStatusColor = (status) => { switch (status) { case 'Pending': return 'bg-yellow-100 text-yellow-700'; case 'Completed': return 'bg-green-100 text-green-700'; default: return 'bg-gray-100 text-gray-700'; } };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1"><div className="glass-card rounded-2xl p-6"><div className="text-center mb-6"><div className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mb-4"><User className="w-12 h-12 text-white" /></div><h2 className="text-xl font-bold">{profile.name || user?.name}</h2><p className="text-gray-500">Student</p></div>{isEditing ? (<form onSubmit={handleUpdateProfile} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none" required /></div><div className="flex gap-3"><button type="submit" className="flex-1 btn-primary py-2">Save</button><button type="button" onClick={() => setIsEditing(false)} className="flex-1 btn-secondary py-2">Cancel</button></div></form>) : (<div className="space-y-3 mb-6"><div className="flex items-center gap-3 text-gray-600"><Mail className="w-4 h-4" /><span>{user?.email}</span></div><div className="flex items-center gap-3 text-gray-600"><Phone className="w-4 h-4" /><span>{profile.phone || 'Not set'}</span></div><button onClick={() => setIsEditing(true)} className="w-full btn-secondary mt-4">Edit Profile</button></div>)}<button onClick={logout} className="w-full mt-4 bg-red-500 text-white py-2 rounded-xl hover:bg-red-600 transition">Logout</button></div></motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2"><div className="glass-card rounded-2xl p-6"><div className="flex items-center gap-2 mb-6"><Package className="w-5 h-5 text-blue-500" /><h2 className="text-xl font-bold">Order History</h2></div>{loading ? (<div className="space-y-4">{[...Array(3)].map((_, i) => (<div key={i} className="animate-pulse"><div className="h-24 bg-gray-200 rounded-xl"></div></div>))}</div>) : orders.length === 0 ? (<div className="text-center py-12"><Package className="w-16 h-16 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No orders yet</p><a href="/" className="text-blue-500 mt-2 inline-block">Start ordering</a></div>) : (<div className="space-y-4">{orders.map((order, index) => (<motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition"><div className="flex justify-between items-start mb-3"><div><p className="text-sm text-gray-500">Order #{order.id}</p><div className="flex items-center gap-2 mt-1"><Clock className="w-3 h-3 text-gray-400" /><p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p></div></div><div className="text-right"><span className={\`px-2 py-1 rounded-full text-xs font-medium \${getStatusColor(order.status)}\`}>{order.status}</span><p className="font-bold text-blue-600 mt-1">\${order.total_amount}</p></div></div><div className="flex flex-wrap gap-2">{order.order_items?.map((item, idx) => (<span key={idx} className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-full">{item.food_items?.name} x{item.quantity}</span>))}</div></motion.div>))}</div>)}</div></motion.div>
        </div>
      </main>
    </div>
  );
};
export default ProfilePage;
`);

writeFile('frontend/src/App.jsx', `
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CartPage from './pages/CartPage';
import ProfilePage from './pages/ProfilePage';
function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
export default App;
`);

console.log('\n🎉 All files created successfully!\n');
console.log('Next steps:');
console.log('1. cd backend && npm install');
console.log('2. Create a Supabase project and run the SQL schema (see previous message)');
console.log('3. Update backend/.env with your Supabase URL and service_role key');
console.log('4. npm run dev');
console.log('5. In another terminal: cd ../frontend && npm install && npm run dev');
console.log('6. Open http://localhost:3000\n');