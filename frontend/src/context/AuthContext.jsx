import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, setAccessToken, bootstrapSession } from '../services/api';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  requestNotificationPermission,
  registerPushSubscription,
} from "../utils/pushNotifications";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // The access token lives in memory (see services/api.js), never in
  // localStorage -- it starts null on every fresh load and is restored
  // below via a silent refresh against the httpOnly refresh cookie.
  const [token, setToken] = useState(null);

  // 🔄 LOAD USER
  // On a fresh page load there is no access token in memory yet (see
  // services/api.js for why). If there's a cached user profile from a
  // previous session, attempt a silent refresh using the httpOnly
  // refresh cookie to get a working access token again. The cached
  // user object itself is not a credential (no token, no password) --
  // just display data -- so keeping it in localStorage for instant UI
  // paint is fine; it gets thrown away below if the refresh fails.
  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = localStorage.getItem('user');

      if (!storedUser || storedUser === "undefined") {
        setLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser);
        const freshToken = await bootstrapSession();

        setToken(freshToken);
        setUser(parsedUser);
      } catch {
        // No valid session (refresh cookie missing/expired/revoked) --
        // treat as logged out.
        localStorage.removeItem('user');
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // 🔄 SYNC TOKEN AFTER SILENT REFRESH
  // api.js refreshes the access token entirely outside React (inside an
  // axios interceptor), so this state would otherwise never update after
  // the first render -- meaning SocketProvider (and anything else reading
  // `token` from this context) would keep using the original, eventually
  // expired token. api.js broadcasts this event whenever it rotates the
  // token; we just mirror it into state here.
  useEffect(() => {
    const handleTokenRefreshed = (event) => {
      setToken(event.detail);
    };

    window.addEventListener("auth:token-refreshed", handleTokenRefreshed);

    return () => {
      window.removeEventListener("auth:token-refreshed", handleTokenRefreshed);
    };
  }, []);

  // 🔐 LOGIN
  const login = async (email, password) => {
    try {
      const { data } = await authAPI.login({ email, password });

      if (!data?.user) {
        toast.error('Invalid response from server');
        return { success: false };
      }

      setAccessToken(data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      setToken(data.accessToken);
      setUser(data.user);

      // 🔔 Ask notification permission
      const granted =
        await requestNotificationPermission();

      if (granted) {

        await registerPushSubscription();

      }

      return {
        success: true,
        user: data.user,
      };

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

  // 🔥 GOOGLE LOGIN
  const googleLogin = async (accessToken) => {

    try {
      const { data } = await api.post(
        '/auth/google',
        {
          accessToken
        }
      );

      if (!data?.user) {
        toast.error(
          'Google authentication failed'
        );
        return {
          success: false
        };
      }

      // SAVE TOKEN (in memory only, see services/api.js)
      setAccessToken(data.accessToken);

      // SAVE USER
      localStorage.setItem(
        'user',
        JSON.stringify(data.user)
      );

      // UPDATE STATE
      setToken(data.accessToken);
      setUser(data.user);

      // 🔔 Ask notification permission
      const granted =
        await requestNotificationPermission();

      if (granted) {

        await registerPushSubscription();

      }

      return {
        success: true,
        user: data.user,
      };

    } catch (error) {

      toast.error(
        error.response?.data?.error ||
        'Google login failed'
      );

      return {
        success: false
      };
    }
  };

  // 🚪 LOGOUT
  const logout = async () => {

    try {

      await api.post("/session/logout");

    } catch (error) {

      console.error(
        "Logout Error:",
        error.response?.data || error.message
      );

    }

    localStorage.removeItem("user");

    setAccessToken(null);
    setToken(null);
    setUser(null);

    toast.success("Logged out successfully");

  };

  // ✏️ UPDATE USER (NEW)
  // Call this after any successful profile edit so the whole app
  // (header, sidebar, anywhere useAuth() is used) reflects the change instantly.
  const updateUser = (updatedFields) => {
    setUser((prevUser) => {
      const newUser = {
        ...prevUser,
        ...updatedFields,
      };

      localStorage.setItem('user', JSON.stringify(newUser));

      return newUser;
    });
  };

  // 🛡 ADMIN CHECK
  const isAdmin = () => user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,

        // 🔐 Authentication
        login,
        register,
        googleLogin,
        logout,

        // ✏️ Profile
        updateUser,

        // 🔑 Password Recovery
        requestPasswordReset,
        confirmPasswordReset,

        // 🛡 Role Check
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};