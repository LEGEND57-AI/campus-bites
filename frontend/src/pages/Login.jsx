import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

import {
  Mail,
  Lock,
  ArrowRight,
  Zap,
  MapPin,
  CreditCard,
  Eye,
  EyeOff,
} from "lucide-react";

import logo from "../assets/CampusCraves-Logo.png";
import FieldError from "../components/auth/FieldError";


const Login = () => {

  // ================= STATES =================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Inline validation messages, keyed by field. `form` holds the one
  // credentials error, which belongs to the pair rather than to either input.
  const [errors, setErrors] = useState({});

  // Deliberately permissive: this only catches obviously malformed input so
  // the user is told before a round trip. The backend remains the authority.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Any edit clears that field's message and the shared credentials error --
  // the moment either value changes, "invalid email or password" is no longer
  // known to be true.
  const clearError = (field) =>
    setErrors((prev) =>
      prev[field] || prev.form ? { ...prev, [field]: undefined, form: undefined } : prev
    );

  const validate = () => {
    const next = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      next.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      next.email = "Please enter a valid email address.";
    }

    if (!password) {
      next.password = "Password is required.";
    }

    return next;
  };

  // ================= CONTEXT =================

  const { login, requestPasswordReset, googleLogin } = useAuth();
  const navigate = useNavigate();

  // ================= LOGIN =================

  const handleSubmit = async (e) => {
    e.preventDefault();

    // A new attempt starts from a clean slate, so a stale credentials error
    // never sits under the form while a fresh request is in flight.
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsLoading(true);

    const result = await login(email, password);

    setIsLoading(false);

    if (!result?.success) {
      // Always this fixed wording, never result.error -- the backend answers
      // "Invalid credentials" and deliberately gives the same response whether
      // the account exists, is unverified, or the password is simply wrong.
      // Passing its text through would both leak backend phrasing and risk
      // narrowing that down for someone probing which emails are registered.
      setErrors({ form: "Invalid email or password." });
      return;
    }

    toast.success("Welcome back 🚀");
    navigate(result?.user?.role === "admin" ? "/admin" : "/");
  };

  // ================= GOOGLE LOGIN =================

  const googleAuth = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      try {
        setGoogleLoading(true);

        const result = await googleLogin(tokenResponse.access_token);

        if (!result?.success) {
          toast.error("Google login failed");
          return;
        }

        toast.success("Welcome to CampusCraves 🚀");
        navigate(result?.user?.role === "admin" ? "/admin" : "/");

      } catch (error) {
        console.error(error);
        toast.error("Something went wrong");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error("Google Sign In failed");
    },
  });

  // ================= FORGOT PASSWORD =================

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      // Inline for the same reason as the submit path: this is a missing-field
      // message about the email input, so it belongs under that input rather
      // than in a toast at the edge of the screen.
      setErrors({ email: "Email is required." });
      return;
    }

    setIsResetting(true);
    const success = await requestPasswordReset(email);
    setIsResetting(false);

    if (success) {
      toast.success("OTP sent 📩");
      navigate(`/verify-otp?email=${encodeURIComponent(email)}&type=reset`);
      return;
    }

    toast.error("Failed to send OTP");
  };

  // ================= UI =================

  return (
    <div
      className="
        min-h-[100dvh]
        bg-gradient-to-br
        from-blue-50
        via-white
        to-slate-100
        flex
        items-center
        justify-center
        p-3 sm:p-4 md:p-6
      "
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="
          w-full
          max-w-[420px]
          sm:max-w-[480px]
          lg:max-w-6xl
          bg-white
          rounded-[24px]
          sm:rounded-[28px]
          lg:rounded-[35px]
          shadow-[0_20px_60px_rgba(0,0,0,0.08)]
          overflow-hidden
          grid
          lg:grid-cols-2
        "
      >

        {/* ================= LEFT SIDE (desktop only) ================= */}

        <div
          className="
            hidden
            lg:flex
            relative
            flex-col
            justify-between
            bg-gradient-to-br
            from-[#001f9e]
            via-[#0044ff]
            to-[#0095ff]
            p-8
            xl:p-10
            text-white
            overflow-hidden
          "
        >
          {/* BACKGROUND CIRCLES */}
          <div className="absolute -top-24 -right-24 w-[280px] h-[280px] rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -left-20 w-[220px] h-[220px] rounded-full bg-cyan-300/15" />

          {/* BRAND NAME */}
          <div className="relative z-10 text-center">
            <h2 className="text-2xl xl:text-3xl font-black">
              <span className="text-white">Campus</span>
              <span className="text-cyan-300"> Craves</span>
            </h2>
          </div>

          {/* HERO TEXT */}
          <div className="relative z-10 space-y-5 xl:space-y-6">
            <h1
              className="
                text-[40px]
                xl:text-[52px]
                2xl:text-[60px]
                font-black
                leading-[0.95]
                tracking-tight
              "
            >
              Your Campus.
              <br />
              Your Cravings.
              <br />
              <span className="text-cyan-300">Delivered.</span>
            </h1>

            <p className="text-base xl:text-lg text-blue-100 max-w-[420px] leading-relaxed">
              Skip the lines. Order your favorite campus meals,
              track your orders in real-time and enjoy seamless
              cashless payments.
            </p>
          </div>

          {/* FEATURES */}
          <div className="relative z-10 space-y-4 xl:space-y-5">

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
                <Zap size={24} className="xl:hidden" />
                <Zap size={28} className="hidden xl:block" />
              </div>
              <div>
                <h3 className="text-base xl:text-lg font-bold">Quick Order</h3>
                <p className="text-sm text-blue-100">Place your meals in seconds</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
                <MapPin size={24} className="xl:hidden" />
                <MapPin size={28} className="hidden xl:block" />
              </div>
              <div>
                <h3 className="text-base xl:text-lg font-bold">Live Tracking</h3>
                <p className="text-sm text-blue-100">Follow your order in real time</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
                <CreditCard size={24} className="xl:hidden" />
                <CreditCard size={28} className="hidden xl:block" />
              </div>
              <div>
                <h3 className="text-base xl:text-lg font-bold">Cashless Payment</h3>
                <p className="text-sm text-blue-100">Secure, fast & hassle-free</p>
              </div>
            </div>

          </div>
        </div>

        {/* ================= RIGHT SIDE ================= */}

        <div
          className="
            flex
            items-center
            justify-center
            px-5
            sm:px-8
            lg:px-10
            py-6
            sm:py-8
          "
        >
          <div className="w-full max-w-[400px] mx-auto">

            {/* MOBILE LOGO */}
            <div className="lg:hidden flex justify-center mb-4">
              <img src={logo} alt="CampusCraves" className="w-14 sm:w-16" />
            </div>

            {/* DESKTOP LOGO */}
            <div className="hidden lg:flex justify-center mb-4">
              <img src={logo} alt="CampusCraves" className="w-16 xl:w-20 drop-shadow-lg" />
            </div>

            <h2
              className="
                text-center
                text-2xl
                sm:text-3xl
                lg:text-4xl
                font-black
                text-slate-900
              "
            >
              Ready to Crave? 😋
            </h2>

            <p className="text-center text-slate-500 mt-2 text-sm sm:text-base lg:text-lg">
              Sign in and discover your favorite campus meals.
            </p>

            {/* ================= FORM ================= */}

            {/* noValidate hands validation to the checks above. The inputs keep
                their `required` attribute for assistive tech, but the browser's
                own bubble would otherwise pre-empt the inline messages. */}
            <form noValidate onSubmit={handleSubmit} className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">

              {/* EMAIL */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearError("email");
                    }}
                    placeholder="Enter your email address"
                    required
                    aria-invalid={errors.email ? "true" : undefined}
                    aria-describedby={errors.email ? "login-email-error" : undefined}
                    className={`
                      w-full
                      h-11
                      sm:h-12
                      rounded-xl
                      sm:rounded-2xl
                      border
                      pl-11
                      sm:pl-12
                      pr-4
                      text-sm
                      sm:text-base
                      text-slate-600
                      outline-none
                      focus:ring-4
                      transition
                      ${errors.email
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}
                    `}
                  />
                </div>

                <FieldError id="login-email-error" message={errors.email} />
              </div>

              {/* PASSWORD */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Password
                </label>

                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError("password");
                    }}
                    placeholder="Enter your password"
                    required
                    aria-invalid={errors.password || errors.form ? "true" : undefined}
                    aria-describedby={
                      errors.password
                        ? "login-password-error"
                        : errors.form
                          ? "login-form-error"
                          : undefined
                    }
                    className={`
                      w-full
                      h-11
                      sm:h-12
                      rounded-xl
                      sm:rounded-2xl
                      border
                      pl-11
                      sm:pl-12
                      pr-11
                      sm:pr-12
                      text-sm
                      sm:text-base
                      text-slate-600
                      outline-none
                      focus:ring-4
                      transition
                      ${errors.password || errors.form
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}
                    `}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="
                      absolute
                      right-3.5
                      sm:right-4
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                      hover:text-blue-600
                    "
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <FieldError id="login-password-error" message={errors.password} />

                {/* Credentials failure. Sits under the password field because
                    that is where the spec places it, but it describes the pair
                    -- which of the two was wrong is deliberately not revealed. */}
                <FieldError id="login-form-error" message={errors.form} />
              </div>

              {/* REMEMBER + FORGOT */}
              <div className="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                    className="w-4 h-4"
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  {isResetting ? "Sending OTP..." : "Forgot Password?"}
                </button>
              </div>

              {/* LOGIN BUTTON */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading}
                className="
                  w-full
                  h-11
                  sm:h-12
                  rounded-xl
                  sm:rounded-2xl
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                  text-white
                  font-bold
                  text-sm
                  sm:text-base
                  lg:text-lg
                  shadow-lg
                  shadow-blue-200
                  flex
                  items-center
                  justify-center
                  gap-2
                  sm:gap-3
                  hover:scale-[1.02]
                  transition
                  disabled:opacity-60
                "
              >
                {isLoading ? (
                  "Signing In..."
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>

              {/* GOOGLE LOGIN */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-[1px] bg-slate-200 flex-1" />
                <span className="text-slate-500 text-xs sm:text-sm">OR</span>
                <div className="h-[1px] bg-slate-200 flex-1" />
              </div>

              {/* GOOGLE LOGIN — custom button, matches Sign In button on every screen size */}
              <button
                type="button"
                onClick={() => googleAuth()}
                disabled={googleLoading}
                className="
                  w-full
                  h-11
                  sm:h-12
                  rounded-xl
                  sm:rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  text-slate-700
                  font-semibold
                  text-sm
                  sm:text-base
                  flex
                  items-center
                  justify-center
                  gap-2.5
                  sm:gap-3
                  hover:bg-slate-50
                  hover:border-slate-300
                  active:scale-[0.98]
                  transition
                  disabled:opacity-60
                  disabled:cursor-not-allowed
                "
              >
                {googleLoading ? (
                  "Signing with Google..."
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917" />
                      <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691" />
                      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.9 11.9 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44" />
                      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              {/* SIGNUP LINK */}
              <p className="text-center text-slate-500 text-sm sm:text-base">
                Don't have an account?
                <Link to="/signup" className="ml-2 font-bold text-blue-600 hover:underline">
                  Create Account
                </Link>
              </p>

            </form>

          </div>
        </div>

      </motion.div>
    </div>
  );
};

export default Login;