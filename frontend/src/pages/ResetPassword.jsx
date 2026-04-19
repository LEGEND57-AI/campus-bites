import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      return toast.error("Invalid request");
    }

    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    if (newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', {
        email,
        newPassword
      });

      toast.success("Password updated successfully 🎉");

      navigate('/login');

    } catch (error) {
      toast.error(error.response?.data?.error || "Reset failed");
    }

    setIsLoading(false);
  };

  // 🔥 INVALID ACCESS
  if (!email) {
    return (
      <div className="text-center mt-20 text-red-500">
        Invalid access. Please try again.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl"
      >

        <h2 className="text-2xl font-bold text-center mb-6">
          Reset Password 🔐
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* NEW PASSWORD */}
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none"
            required
          />

          {/* CONFIRM PASSWORD */}
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none"
            required
          />

          {/* BUTTON */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary py-3 disabled:opacity-60"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>

        </form>

      </motion.div>

    </div>
  );
};

export default ResetPassword;