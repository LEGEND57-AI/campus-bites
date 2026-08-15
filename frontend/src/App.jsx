import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { CartProvider } from "./context/CartContext";
import { FavoriteProvider } from "./context/FavoriteContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import ChunkErrorBoundary from "./components/ChunkErrorBoundary";

// Kept eagerly imported. Login is where the catch-all route sends anyone who
// is not signed in, and Dashboard is "/" -- the page a signed-in user lands on
// immediately. Loading either on demand would only add a spinner to the very
// first paint. The route guards are eager for the same reason: routing must
// never have to wait on a chunk to decide where a user belongs.
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Everything below is reached only after a navigation, so it is split out of
// the initial bundle. The admin pages in particular carry recharts,
// react-datepicker/date-fns and sweetalert2, none of which a student ever
// needs -- lazily importing the pages moves those libraries into the route
// chunks automatically, with no manual chunk configuration.

// 🔓 PUBLIC PAGES
const Signup = lazy(() => import("./pages/Signup"));
const VerifyOTP = lazy(() => import("./pages/VerifyOTP"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// 🔐 STUDENT PAGES
const Menu = lazy(() => import("./pages/Menu"));
const Orders = lazy(() => import("./pages/Orders"));
const Favorite = lazy(() => import("./pages/Favorite"));

const NewCart = lazy(() => import("./pages/NewCart"));
const Profile = lazy(() => import("./pages/Profile"));
const PersonalInformation = lazy(() => import("./pages/PersonalInformation"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Notifications = lazy(() => import("./pages/Notifications"));


// 🔐 ADMIN PAGES
const AdminLayout = lazy(() => import("./pages/admin/Layout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu"));
const AdminOrderHistory = lazy(() =>
  import("./pages/admin/history/AdminOrderHistory")
);
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));

// Shown only while a route chunk is in flight. Deliberately the same spinner
// the app already uses elsewhere rather than a new pattern.
function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center">
      <div
        className="
          w-12
          h-12
          rounded-full
          border-4
          border-blue-200
          border-t-blue-600
          animate-spin
        "
      />
    </div>
  );
}

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

        {/* The boundary sits outside Suspense so it receives the rejection
            when a route chunk fails to load, and the Toaster stays outside
            both so toasts still render in that case. */}
        <ChunkErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
        </ChunkErrorBoundary>

      </FavoriteProvider>
    </CartProvider>
  );
}

export default App;