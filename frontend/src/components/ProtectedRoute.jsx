import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FullScreenLoader from './FullScreenLoader';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 🔄 Loading
  if (loading) {
    return <FullScreenLoader />;
  }

  // 🔒 Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 🔥 KEY FIX: Admin should NOT see student routes
  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  // ✅ Student access
  return children;
};

export default ProtectedRoute;