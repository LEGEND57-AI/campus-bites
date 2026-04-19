import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import api from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔄 LOAD USER
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser && storedUser !== "undefined") {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    setLoading(false);
  }, []);

  // 🔐 LOGIN
  const login = async (email, password) => {
    try {
      const { data } = await authAPI.login({ email, password });

      if (!data?.user) {
        toast.error('Invalid response from server');
        return { success: false };
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      toast.success('Welcome back!');

      return { success: true, user: data.user };

    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
      return { success: false };
    }
  };

  // 📝 REGISTER
  const register = async (name, email, phone, password) => {
    try {
      const { data } = await authAPI.register({
        name,
        email,
        phone,
        password
      });

      toast.success("OTP sent! Check email 📩");

      return {
        success: true,
        email: data.email
      };

    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed');
      return { success: false };
    }
  };

  // 🔑 FORGOT PASSWORD
  const requestPasswordReset = async (email) => {
    try {
      await api.post('/auth/forgot-password', { email });

      toast.success('OTP sent to your email 📩');
      return true;

    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send OTP');
      return false;
    }
  };

  // 🔄 RESET PASSWORD
  const confirmPasswordReset = async (email, newPassword) => {
    try {
      await api.post('/auth/reset-password', {
        email,
        newPassword
      });

      toast.success('Password updated! Please login.');
      return true;

    } catch (error) {
      toast.error(error.response?.data?.error || 'Reset failed');
      return false;
    }
  };

  // 🚪 LOGOUT
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out successfully');
  };

  // 🛡 ADMIN CHECK
  const isAdmin = () => user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};