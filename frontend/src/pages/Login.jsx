import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
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


const Login = () => {

  // ================= STATES =================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ================= CONTEXT =================

  const { login, requestPasswordReset, googleLogin } = useAuth();
  const navigate = useNavigate();

  // ================= LOGIN =================

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);

    setIsLoading(false);

    if (!result?.success) {
      toast.error("Invalid email or password");
      return;
    }

    toast.success("Welcome back 🚀");
    navigate(result?.user?.role === "admin" ? "/admin" : "/");
  };

  // ================= GOOGLE LOGIN =================

  const handleGoogleSuccess = async (response) => {
    try {
      setGoogleLoading(true);

      const result = await googleLogin(response.credential);

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
  };

  const handleGoogleError = () => {
    toast.error("Google Sign In failed");
  };

  // ================= FORGOT PASSWORD =================

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Enter your email first");
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

            <form onSubmit={handleSubmit} className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">

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
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="
                      w-full
                      h-11
                      sm:h-12
                      rounded-xl
                      sm:rounded-2xl
                      border
                      border-slate-200
                      pl-11
                      sm:pl-12
                      pr-4
                      text-sm
                      sm:text-base
                      text-slate-600
                      outline-none
                      focus:border-blue-500
                      focus:ring-4
                      focus:ring-blue-100
                      transition
                    "
                  />
                </div>
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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="
                      w-full
                      h-11
                      sm:h-12
                      rounded-xl
                      sm:rounded-2xl
                      border
                      border-slate-200
                      pl-11
                      sm:pl-12
                      pr-11
                      sm:pr-12
                      text-sm
                      sm:text-base
                      text-slate-600
                      outline-none
                      focus:border-blue-500
                      focus:ring-4
                      focus:ring-blue-100
                      transition
                    "
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

              <div className="flex justify-center">
                {googleLoading ? (
                  <button
                    disabled
                    className="
                      w-full
                      h-11
                      sm:h-12
                      rounded-xl
                      sm:rounded-2xl
                      border
                      border-slate-200
                      bg-slate-100
                      text-slate-500
                      font-medium
                      text-sm
                      sm:text-base
                    "
                  >
                    Signing with Google...
                  </button>
                ) : (
                  <div className="w-full flex justify-center [&>div]:w-full [&_iframe]:!w-full">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      shape="pill"
                      width="100%"
                    />
                  </div>
                )}
              </div>

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