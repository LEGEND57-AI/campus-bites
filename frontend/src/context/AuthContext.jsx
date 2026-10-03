import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, setAccessToken, bootstrapSession, isSessionRejected } from '../services/api';
import api from '../services/api';
import {
  requestNotificationPermission,
  registerPushSubscription,
} from "../utils/pushNotifications";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// Backoff between silent-refresh attempts when restoring a saved session and
// the backend answers with something that is not a verdict on that session
// (offline, timeout, 429, 5xx). One entry per retry, so this is two retries
// after the first attempt.
//
// Sized for the case that produced the bug: a backend that has spun down and
// answers 502/503 for a few seconds while it wakes. Those replies come back
// immediately, so both retries cost about 5.5s in total. A backend that has
// stopped answering altogether is bounded instead by the refresh timeout in
// services/api.js, once per attempt.
const TRANSIENT_RETRY_DELAYS_MS = [1500, 4000];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    let cancelled = false;

    const restoreSession = async () => {
      const storedUser = localStorage.getItem('user');

      if (!storedUser || storedUser === "undefined") {
        setLoading(false);
        return;
      }

      let parsedUser;

      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        // The cached profile itself is unreadable. That is not a session
        // failure, so there is nothing here worth retrying.
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      for (let attempt = 0; ; attempt += 1) {
        try {
          const freshToken = await bootstrapSession();

          if (cancelled) return;

          setToken(freshToken);
          setUser(parsedUser);
          break;
        } catch (error) {
          if (cancelled) return;

          // The backend actually rejected the session (refresh cookie
          // missing, expired or revoked). It is genuinely gone: clear the
          // cached user, which every tab shares, and start signed out.
          if (isSessionRejected(error)) {
            setAccessToken(null);
            setUser(null);
            localStorage.removeItem('user');
            break;
          }

          // Anything else -- offline, timeout, 429, 5xx -- proves nothing
          // about the session, which is why the cached user is deliberately
          // kept below. Settling as signed out on this branch was the bug:
          // "/" would resolve to the public landing page for a visitor whose
          // session was fine, and the next reload (by then against a warm
          // backend) would restore it and land on the dashboard.
          //
          // So retry instead of guessing. `loading` stays true throughout, so
          // the branded entry loader already on screen simply covers the
          // retry rather than handing over to the wrong page.
          if (attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
            await delay(TRANSIENT_RETRY_DELAYS_MS[attempt]);
            if (cancelled) return;
            continue;
          }

          // Out of attempts. The backend is unreachable rather than slow, so
          // fall back to the signed-out shell -- a usable public page beats an
          // endless loader. The cached user stays put, so the next load (or
          // the next tab) restores the session as soon as the backend answers.
          setAccessToken(null);
          setUser(null);
          break;
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
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
        return {
          success: false,
          error: 'Invalid response from server',
        };
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
      // Returned rather than toasted so Login.jsx can place it inline under
      // the field it concerns. This previously fired a toast carrying the raw
      // backend string -- "Invalid credentials" -- on top of the page's own
      // "Invalid email or password" toast, so a failed sign-in produced two
      // notifications, one of them in backend wording. The {success:false}
      // contract is unchanged; only where the message is shown has moved.
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
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


      return {
        success: true,
        email: data.email
      };

    } catch (error) {
      // Same reasoning as login above: Signup.jsx maps this onto the field it
      // belongs to instead of showing a toast beside its own one.
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  // 🔑 FORGOT PASSWORD
  const requestPasswordReset = async (email) => {
    try {
      await api.post('/auth/forgot-password', { email });

      return true;

    } catch (error) {
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

      return true;

    } catch (error) {
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