import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { CartProvider } from "./context/CartContext";
import { FavoriteProvider } from "./context/FavoriteContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// 🔓 PUBLIC PAGES
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOTP from "./pages/VerifyOTP";
import ResetPassword from "./pages/ResetPassword";

// 🔐 STUDENT PAGES
import Dashboard from "./pages/Dashboard";
import Menu from "./pages/Menu";
import Orders from "./pages/Orders";
import Favorite from "./pages/Favorite";

import NewCart from "./pages/NewCart";
import Profile from "./pages/Profile";
import PersonalInformation from "./pages/PersonalInformation";
import OrderSuccess from "./pages/OrderSuccess";
import TrackOrder from "./pages/TrackOrder";
import Notifications from "./pages/Notifications";


// 🔐 ADMIN PAGES
import AdminLayout from "./pages/admin/Layout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminOrderHistory from "./pages/admin/history/AdminOrderHistory";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminProfile from "./pages/admin/AdminProfile";

function App() {
  return (
    <CartProvider>
      <FavoriteProvider>

        <Toaster
          position="top-center"
          gutter={12}
          toastOptions={{
            duration: 1800,

            style: {
              borderRadius: "16px",
              background: "#ffffff",
              color: "#0f172a",
              padding: "14px 18px",
              fontWeight: "600",
              boxShadow: "0 12px 35px rgba(15,23,42,0.12)",
              border: "1px solid #E2E8F0",
            },

            success: {
              iconTheme: {
                primary: "#2563EB",
                secondary: "#ffffff",
              },
            },

            error: {
              duration: 2500,
            },
          }}
        />

        <Routes>

          {/* ================= PUBLIC ================= */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ================= STUDENT ================= */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/menu"
            element={
              <ProtectedRoute>
                <Menu />
              </ProtectedRoute>
            }
          />

          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorite />
              </ProtectedRoute>
            }
          />



          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <NewCart />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile/personal-information"
            element={
              <ProtectedRoute>
                <PersonalInformation />
              </ProtectedRoute>
            }
          />

          <Route
            path="/order-success"
            element={
              <ProtectedRoute>
                <OrderSuccess />
              </ProtectedRoute>
            }
          />

          <Route
            path="/track-order/:id"
            element={
              <ProtectedRoute>
                <TrackOrder />
              </ProtectedRoute>
            }
          />

          {/* ================= ADMIN ================= */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="history" element={<AdminOrderHistory />} />
            <Route path="menu" element={<AdminMenu />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          {/* ================= FALLBACK ================= */}
          <Route path="*" element={<Navigate to="/login" />} />

        </Routes>

      </FavoriteProvider>
    </CartProvider>
  );
}

export default App;