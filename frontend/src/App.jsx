import React, { lazy, Suspense } from "react";
import FullScreenLoader, { AppEntryLoader } from "./components/FullScreenLoader";
import { useAppEntryLifecycle } from "./utils/appEntry";
import { Routes, Route, Navigate } from "react-router-dom";

import { CartProvider } from "./context/CartContext";
import { FavoriteProvider } from "./context/FavoriteContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import HomeRoute from "./components/HomeRoute";
import ChunkErrorBoundary from "./components/ChunkErrorBoundary";

// Kept eagerly imported. Login is where the catch-all route sends anyone who
// is not signed in. Dashboard -- what "/" shows a signed-in student -- is
// imported eagerly by HomeRoute for the same reason. Loading either on demand
// would only add a spinner to the very first paint. The route guards are
// eager too: routing must never have to wait on a chunk to decide where a
// user belongs. (The public landing page, which "/" shows signed-out
// visitors, is a lazy chunk -- see HomeRoute.)
import Login from "./pages/Login";

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

// Shown only while a route chunk is in flight. The full-screen loading slot
// decides between the branded loader (app entry) and the quiet spinner
// (refresh / route change); see utils/appEntry.js.
function RouteFallback() {
  return <FullScreenLoader />;
}

function App() {
  // Page lifecycle (first open / refresh / return after inactivity).
  useAppEntryLifecycle();

  return (
    <CartProvider>
      <FavoriteProvider>

        <AppEntryLoader />

        {/* The boundary sits outside Suspense so it receives the rejection
            when a route chunk fails to load. */}
        <ChunkErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        <Routes>

          {/* ================= PUBLIC ================= */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ================= ENTRY ================= */}
          {/* Signed out: public landing page. Signed in: Dashboard
              (students) or /admin (admins), exactly as before. */}
          <Route path="/" element={<HomeRoute />} />

          {/* ================= STUDENT ================= */}

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