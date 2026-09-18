import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FullScreenLoader from './FullScreenLoader';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // 🔄 Loading
  if (loading) {
    return <FullScreenLoader />;
  }

  // 🔒 Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🚫 Not admin → redirect
  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // ✅ Admin access
  return children;
};

export default AdminRoute;