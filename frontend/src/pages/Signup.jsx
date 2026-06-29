import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin } from "@react-oauth/google";

import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Zap,
  MapPin,
  CreditCard
} from "lucide-react";

import logo from "../assets/CampusCraves-Logo.png";
import toast from "react-hot-toast";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();

  // 🔥 NORMAL SIGNUP
  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsLoading(true);

    const result = await register(
      name,
      email,
      phone,
      password
    );

    setIsLoading(false);

    if (!result?.success) {
      toast.error("Registration failed");
      return;
    }

    toast.success("OTP sent to your email 📩");

    navigate(
      `/verify-otp?email=${encodeURIComponent(result.email)}`
    );
  };


  // 🔥 GOOGLE SIGNUP HANDLER
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSuccess = async (response) => {
    try {
      setGoogleLoading(true);

      const result = await googleLogin(response.credential);

      if (!result.success) {
        toast.error("Google signup failed");
        return;
      }

      toast.success("Welcome to CampusCraves 🚀");

      navigate("/");

    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");

    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error("Google Sign Up failed");
  };

  return (

    <div
      className="
      min-h-screen
      bg-gradient-to-br
      from-blue-50
      via-white
      to-slate-100
      flex
      items-center
      justify-center
      p-3
      sm:p-4
    "
    >

      <motion.div
        initial={{
          opacity: 0,
          y: 20,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.5,
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

          {/* Background */}

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

          {/* Brand */}

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

          {/* Hero */}

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

          {/* Features */}

          <div
            className="
            relative
            z-10
            space-y-5
          "
          >

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

        {/* RIGHT SIDE */}

        <div className="
          flex
          items-center
          justify-center
          p-5 sm:p-8 lg:p-10
        ">

          <div className="w-full max-w-[460px] mx-auto px-2 sm:px-0">

            {/* MOBILE LOGO */}

            <div className="
              lg:hidden
              flex
              justify-center
              mb-6
            ">
              <img
                src={logo}
                alt="CampusCraves"
                className="w-28"
              />
            </div>


            {/* DESKTOP LOGO */}

            <div className="
              hidden lg:flex
              justify-center
              mb-4
            ">
              <img
                src={logo}
                alt="CampusCraves"
                className="w-16 drop-shadow-lg"
              />
            </div>


            {/* HEADING */}

            <h2 className="
              text-center
              text-3xl lg:text-4xl
              font-black
              text-slate-900
            ">
              Join CampusCraves 🍔
            </h2>


            <p
              className="
    mt-3
    text-center
    text-slate-500
    text-lg
    leading-8
    max-w-[340px]
    mx-auto
  "
            >
              Create your account and start your delicious journey.
            </p>


            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="
    mt-7
    space-y-5
    max-w-[380px]
    mx-auto
  "
            >


              {/* NAME */}

              <div>

                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Full Name
                </label>


                <div className="relative">

                  <User
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="
                    w-full h-12 rounded-2xl
                    border border-slate-200
                    pl-12 pr-4
                    outline-none
                    focus:ring-4
                    focus:ring-blue-100
                    focus:border-blue-500
                    transition"
                  />

                </div>

              </div>


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
                    w-full h-12 rounded-2xl
                    border border-slate-200
                    pl-12 pr-4
                    outline-none
                    focus:ring-4 focus:ring-blue-100
                    focus:border-blue-500 transition"
                  />

                </div>

              </div>


              {/* PHONE */}

              <div>

                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Phone Number
                </label>


                <div className="relative">

                  <Phone
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />


                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 10) {
                        setPhone(value);
                      }
                    }}
                    placeholder="Enter your phone number"
                    maxLength={10}
                    required
                    className="
    w-full h-12 rounded-2xl
    border border-slate-200
    pl-12 pr-4
    outline-none
    focus:ring-4 focus:ring-blue-100
    focus:border-blue-500 transition
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
                    w-full h-12 rounded-2xl
                    border border-slate-200
                    pl-12 pr-12
                    outline-none
                    focus:ring-4 focus:ring-blue-100
                    focus:border-blue-500 transition"
                  />


                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="
                    absolute right-4 top-1/2
                    -translate-y-1/2
                    text-slate-400
                    hover:text-blue-600"
                  >

                    {
                      showPassword
                        ? <EyeOff size={20} />
                        : <Eye size={20} />
                    }

                  </button>

                </div>

              </div>



              {/* CREATE ACCOUNT */}

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading}
                className="
                w-full h-12
                rounded-2xl
                bg-gradient-to-r
                from-blue-600 to-cyan-500
                text-white font-bold text-lg
                shadow-lg shadow-blue-200
                flex items-center justify-center gap-2
                hover:scale-[1.02]
                transition
                disabled:opacity-60"
              >

                {
                  isLoading
                    ? "Sending OTP..."
                    :
                    <>
                      Create Account
                      <ArrowRight size={20} />
                    </>
                }

              </motion.button>



              {/* OR */}

              <div className="flex items-center gap-4">

                <div className="flex-1 h-[1px] bg-slate-200"></div>

                <span className="text-sm text-slate-500">
                  OR
                </span>

                <div className="flex-1 h-[1px] bg-slate-200"></div>

              </div>


              {/* GOOGLE LOGIN */}

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
                        width="100%"
                      />
                    </div>

                  )
                }

              </div>


            </form>



            {/* FOOTER */}

            <p
              className="
  text-center
  text-slate-500
  mt-6
  max-w-[360px]
  mx-auto
">

              Already have an account?

              <Link
                to="/login"
                className="
                ml-2
                text-blue-600
                font-bold
                hover:underline"
              >
                Sign In
              </Link>

            </p>


          </div>

        </div>

      </motion.div>

    </div>

  );

};


export default Signup;