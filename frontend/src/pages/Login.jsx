import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { login, requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  // 🔐 LOGIN
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);

    setIsLoading(false);

    if (!result?.success) {
      toast.error("Invalid email or password");
      return;
    }

    const role = result?.user?.role;

    toast.success("Login successful 🚀");

    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  // 🔑 FORGOT PASSWORD (🔥 UPDATED FLOW)
  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Enter email first");
      return;
    }

    setIsResetting(true);

    const success = await requestPasswordReset(email);

    setIsResetting(false);

    if (success) {
      toast.success("OTP sent to your email 📩");

      // 🔥 IMPORTANT REDIRECT
      navigate(`/verify-otp?email=${email}&type=reset`);
    } else {
      toast.error("Failed to send OTP");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 max-w-md w-full shadow-2xl"
      >

        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 mb-4">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-3xl font-bold gradient-text">
            Welcome Back
          </h2>

          <p className="text-gray-500 mt-2">
            Sign in to continue to CampusBites
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
              placeholder="student@campus.edu"
              required
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
              placeholder="••••••••"
              required
            />
          </div>

          {/* FORGOT */}
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isResetting}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {isResetting ? "Sending..." : "Forgot Password?"}
            </button>
          </div>

          {/* BUTTON */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary py-3 text-lg disabled:opacity-70"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </motion.button>

        </form>

        {/* FOOTER */}
        <p className="text-center mt-6 text-gray-600">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="text-blue-600 font-semibold hover:underline"
          >
            Sign up
          </Link>
        </p>

      </motion.div>
    </div>
  );
};

export default Login;