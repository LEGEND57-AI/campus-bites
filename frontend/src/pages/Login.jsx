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

  const [showPassword, setShowPassword] =
    useState(false);

  const [remember, setRemember] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isResetting, setIsResetting] =
    useState(false);

  const [googleLoading, setGoogleLoading] =
    useState(false);


  // ================= CONTEXT =================

  const {
    login,
    requestPasswordReset,
    googleLogin,
  } = useAuth();


  const navigate = useNavigate();


  // ================= LOGIN =================

  const handleSubmit = async (e) => {

    e.preventDefault();

    setIsLoading(true);

    const result = await login(
      email,
      password
    );

    setIsLoading(false);


    if (!result?.success) {

      toast.error(
        "Invalid email or password"
      );

      return;

    }


    toast.success(
      "Welcome back 🚀"
    );


    navigate(
      result?.user?.role === "admin"
        ? "/admin"
        : "/"
    );

  };


  // ================= GOOGLE LOGIN =================


  const handleGoogleSuccess = async (
    response
  ) => {

    try {

      setGoogleLoading(true);


      const result =
        await googleLogin(
          response.credential
        );


      if (!result?.success) {

        toast.error(
          "Google login failed"
        );

        return;

      }


      toast.success(
        "Welcome to CampusCraves 🚀"
      );


      navigate(
        result?.user?.role === "admin"
          ? "/admin"
          : "/"
      );


    } catch (error) {

      console.error(error);

      toast.error(
        "Something went wrong"
      );

    } finally {

      setGoogleLoading(false);

    }

  };


  const handleGoogleError = () => {

    toast.error(
      "Google Sign In failed"
    );

  };


  // ================= FORGOT PASSWORD =================


  const handleForgotPassword = async () => {

    if (!email) {

      toast.error(
        "Enter your email first"
      );

      return;

    }


    setIsResetting(true);


    const success =
      await requestPasswordReset(email);


    setIsResetting(false);


    if (success) {

      toast.success(
        "OTP sent 📩"
      );


      navigate(
        `/verify-otp?email=${encodeURIComponent(email)}&type=reset`
      );


      return;

    }


    toast.error(
      "Failed to send OTP"
    );

  };


  // ================= UI =================


  return (

    <div className="
      min-h-screen
      bg-gradient-to-br
from-blue-50
via-white
to-slate-100
      flex
      items-center
      justify-center
      p-3 sm:p-4
    ">


      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}

        animate={{
          opacity: 1,
          y: 0
        }}

        transition={{
          duration: 0.5
        }}

        className="
          w-full
          max-w-6xl
          bg-white
          rounded-[28px]
lg:rounded-[35px]
shadow-[0_20px_60px_rgba(0,0,0,0.08)]
          overflow-hidden
          grid
          lg:grid-cols-2
        "
      >

        {/* ================= LEFT SIDE ================= */}

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
            p-10
            text-white
            overflow-hidden
          "
        >

          {/* BACKGROUND CIRCLES */}

          <div
            className="
              absolute
              -top-24
              -right-24
              w-[280px]
              h-[280px]
              rounded-full
              bg-white/10
            "
          />

          <div
            className="
              absolute
              -bottom-20
              -left-20
              w-[220px]
              h-[220px]
              rounded-full
              bg-cyan-300/15
            "
          />


          {/* BRAND NAME */}

          <div className="relative z-10 text-center">

            <h2 className="text-3xl font-black">

              <span className="text-white">
                Campus
              </span>

              <span className="text-cyan-300">
                {" "}Craves
              </span>

            </h2>

          </div>


          {/* HERO TEXT */}

          <div
            className="
              relative
              z-10
              space-y-6
            "
          >

            <h1
              className="
                text-[60px]
                font-black
                leading-[0.9]
                tracking-tight
              "
            >

              Your Campus.
              <br />

              Your Cravings.
              <br />

              <span className="text-cyan-300">
                Delivered.
              </span>

            </h1>


            <p
              className="
                text-lg
                text-blue-100
                max-w-[420px]
                leading-relaxed
              "
            >

              Skip the lines. Order your favorite campus meals,
              track your orders in real-time and enjoy seamless
              cashless payments.

            </p>

          </div>


          {/* FEATURES */}

          <div
            className="
              relative
              z-10
              space-y-5
            "
          >


            {/* QUICK ORDER */}

            <div className="flex items-center gap-4">

              <div
                className="
                  w-14
                  h-14
                  rounded-2xl
                  bg-white/15
                  backdrop-blur-md
                  flex
                  items-center
                  justify-center
                "
              >

                <Zap size={28} />

              </div>


              <div>

                <h3 className="text-lg font-bold">

                  Quick Order

                </h3>


                <p className="text-sm text-blue-100">

                  Place your meals in seconds

                </p>

              </div>

            </div>


            {/* LIVE TRACKING */}

            <div className="flex items-center gap-4">


              <div
                className="
                  w-14
                  h-14
                  rounded-2xl
                  bg-white/15
                  backdrop-blur-md
                  flex
                  items-center
                  justify-center
                "
              >

                <MapPin size={28} />

              </div>


              <div>

                <h3 className="text-lg font-bold">

                  Live Tracking

                </h3>


                <p className="text-sm text-blue-100">

                  Follow your order in real time

                </p>

              </div>


            </div>


            {/* PAYMENT */}

            <div className="flex items-center gap-4">


              <div
                className="
                  w-14
                  h-14
                  rounded-2xl
                  bg-white/15
                  backdrop-blur-md
                  flex
                  items-center
                  justify-center
                "
              >

                <CreditCard size={28} />

              </div>


              <div>

                <h3 className="text-lg font-bold">

                  Cashless Payment

                </h3>


                <p className="text-sm text-blue-100">

                  Secure, fast & hassle-free

                </p>


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
px-6
sm:px-8
lg:px-10
py-8
"
        >

          <div
            className="
    w-full
    max-w-[420px]
    mx-auto
  "
          >


            {/* MOBILE LOGO */}

            <div className="lg:hidden flex justify-center mb-5">

              <img
                src={logo}
                alt="CampusCraves"
                className="w-16"
              />

            </div>


            {/* DESKTOP LOGO */}

            <div className="hidden lg:flex justify-center mb-4">

              <img
                src={logo}
                alt="CampusCraves"
                className="w-20 drop-shadow-lg"
              />

            </div>


            <h2 className="
              text-center
              text-3xl lg:text-4xl
              font-black
              text-slate-900
            ">

              Ready to Crave? 😋

            </h2>


            <p className="
              text-center
              text-slate-500
              mt-2 text-lg
            ">

              Sign in and discover your favorite campus meals.

            </p>


            {/* ================= FORM ================= */}

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >


              {/* EMAIL */}

              <div>

                <label className="block text-sm font-semibold text-slate-800 mb-1">

                  Email Address

                </label>


                <div className="relative">

                  <Mail
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />


                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="
                      w-full
                      h-12
                      rounded-2xl
                      border
                      border-slate-200
                      pl-12
                      pr-4
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
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />


                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="
                      w-full
                      h-12
                      rounded-2xl
                      border
                      border-slate-200
                      pl-12
                      pr-12
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
                      right-4
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                      hover:text-blue-600
                    "
                  >

                    {
                      showPassword
                        ? <EyeOff size={20} />
                        : <Eye size={20} />
                    }

                  </button>


                </div>

              </div>


              {/* REMEMBER + FORGOT */}

              <div className="flex items-center justify-between text-sm">


                <label className="flex items-center gap-2 text-slate-600">

                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                  />

                  Remember me

                </label>


                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                  className="text-blue-600 font-semibold hover:underline"
                >

                  {
                    isResetting
                      ? "Sending OTP..."
                      : "Forgot Password?"
                  }

                </button>


              </div>


              {/* LOGIN BUTTON */}


              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading}
                className="
                  w-full
                  h-12
                  rounded-2xl
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                  text-white
                  font-bold
                  text-lg
                  shadow-lg
                  shadow-blue-200
                  flex
                  items-center
                  justify-center
                  gap-3
                  hover:scale-[1.02]
                  transition
                  disabled:opacity-60
                "
              >

                {
                  isLoading
                    ? "Signing In..."
                    :
                    <>
                      Sign In
                      <ArrowRight size={20} />
                    </>
                }

              </motion.button>


              {/* GOOGLE LOGIN */}


              <div className="flex items-center gap-4">

                <div className="h-[1px] bg-slate-200 flex-1" />

                <span className="text-slate-500 text-sm">

                  OR

                </span>

                <div className="h-[1px] bg-slate-200 flex-1" />

              </div>


              <div className="flex justify-center">


                {
                  googleLoading ? (

                    <button
                      disabled
                      className="
                        w-full
                        h-12
                        rounded-2xl
                        border
                        border-slate-200
                        bg-slate-100
                        text-slate-500
                        font-medium
                      "
                    >

                      Signing with Google...

                    </button>

                  ) : (

                    <div className="w-full">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="outline"
                        size="large"
                        text="continue_with"
                        shape="pill"
                        width="320"
                      />
                    </div>

                  )
                }


              </div>


              {/* SIGNUP LINK */}


              <p className="text-center text-slate-500">


                Don't have an account?


                <Link
                  to="/signup"
                  className="ml-2 font-bold text-blue-600 hover:underline"
                >

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