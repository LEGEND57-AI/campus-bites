import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Shield,
  Zap,
  MapPin,
  Clock,
  ArrowRight
} from "lucide-react";

import api from "../services/api";
import toast from "react-hot-toast";

const VerifyOTP = () => {

  const [searchParams] = useSearchParams();

  const email = searchParams.get("email");
  const type = searchParams.get("type");


  const navigate = useNavigate();
  const inputsRef = useRef([]);


  const [otp, setOtp] = useState([
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  const [loading, setLoading] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);


  // RESEND TIMER
  const [timer, setTimer] = useState(60);


  // OTP EXPIRY
  const [expiryTimer, setExpiryTimer] = useState(900);



  // Countdown timer
  useEffect(() => {

    if (timer === 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);


    return () => clearInterval(interval);

  }, [timer]);


  // OTP expiry timer
  useEffect(() => {

    if (expiryTimer === 0) return;


    const interval = setInterval(() => {

      setExpiryTimer((prev) => prev - 1);

    }, 1000);


    return () => clearInterval(interval);

  }, [expiryTimer]);



  // OTP input
  const handleChange = (value, index) => {


    if (!/^\d?$/.test(value)) return;


    const updatedOtp = [...otp];

    updatedOtp[index] = value;


    setOtp(updatedOtp);



    if (value && index < 5) {

      inputsRef.current[index + 1]?.focus();

    }


    if (updatedOtp.join("").length === 6) {

      handleVerify(updatedOtp.join(""));

    }

  };




  // Backspace handling
  const handleKeyDown = (e, index) => {


    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {

      inputsRef.current[index - 1]?.focus();

    }


    if (e.key === "Enter") {

      handleVerify();

    }

  };



  // Paste OTP
  const handlePaste = (e) => {

    const value = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);


    if (!value) return;


    const array = value.split("");


    while (array.length < 6) {

      array.push("");

    }


    setOtp(array);


    if (value.length === 6) {

      handleVerify(value);

    }

  };




  // VERIFY OTP
  const handleVerify = async (otpValue) => {


    const finalOtp = otpValue || otp.join("");


    if (!email) {

      toast.error("Invalid request");

      return;

    }


    if (finalOtp.length !== 6) {

      toast.error("Enter complete OTP");

      return;

    }


    setLoading(true);


    try {
      await api.post("/auth/verify-otp", {
        email,
        otp: finalOtp,
      });

      toast.success("OTP verified successfully!");

      if (type === "reset") {
        navigate(`/reset-password?email=${email}`);
      } else {
        navigate("/login");
      }

    } catch (error) {

      toast.error(
        error.response?.data?.error || "Invalid OTP"
      );

    } finally {

      setLoading(false);

    }

  };



  // RESEND OTP
  const handleResend = async () => {

    if (timer > 0 || resendLoading) return;


    setResendLoading(true);


    try {

      await api.post("/auth/resend-otp", {
        email,
      });


      toast.success("New OTP sent!");

      setOtp([
        "",
        "",
        "",
        "",
        "",
        ""
      ]);


      setTimer(60);

      setExpiryTimer(900);


      inputsRef.current[0]?.focus();


    } catch (error) {


      toast.error(
        error.response?.data?.error ||
        "Failed to resend OTP"
      );


    } finally {


      setResendLoading(false);

    }

  };




  const minutes = Math.floor(expiryTimer / 60);

  const seconds = String(
    expiryTimer % 60
  ).padStart(2, "0");




  return (
    <div className="
    min-h-screen
    bg-gradient-to-br 
    from-slate-100 
    via-blue-50 
    to-cyan-50
    flex
    items-center
    justify-center
    p-3 md:p-5
  ">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="
        w-full
        max-w-6xl
        bg-white
        rounded-[32px]
        overflow-hidden
        shadow-2xl
        grid
        md:grid-cols-2
      "
      >

        {/* LEFT PANEL */}
        <div className="
        hidden md:flex
        bg-gradient-to-br
        from-blue-800
        via-blue-600
        to-cyan-600
        text-white
        p-8
        flex-col
        justify-center
      ">

          <h2 className="
          text-4xl
          font-black
          text-center
          mb-6
        ">
            Campus
            <span className="text-cyan-300">
              Craves
            </span>
          </h2>


          <h1 className="
          text-5xl
          font-extrabold
          leading-tight
          mb-5
        ">
            Secure.
            <br />
            Verify.
            <br />
            <span className="text-cyan-300">
              Continue.
            </span>
          </h1>


          <p className="
          text-lg
          text-blue-100
          mb-8
        ">
            Enter your OTP and unlock your
            CampusCraves experience.
          </p>


          <div className="space-y-5">

            <div className="flex items-center gap-3">
              <Shield size={28} />

              <div>
                <h3 className="font-bold">
                  Secure Verification
                </h3>

                <p className="text-blue-100 text-sm">
                  Protected OTP authentication
                </p>
              </div>

            </div>


            <div className="flex items-center gap-3">

              <Zap size={28} />

              <div>
                <h3 className="font-bold">
                  Fast Access
                </h3>

                <p className="text-blue-100 text-sm">
                  Login within seconds
                </p>
              </div>

            </div>


            <div className="flex items-center gap-3">

              <MapPin size={28} />

              <div>
                <h3 className="font-bold">
                  Continue Ordering
                </h3>

                <p className="text-blue-100 text-sm">
                  Resume your food journey
                </p>
              </div>

            </div>

          </div>

        </div>


        {/* RIGHT PANEL */}

        <div className="
        flex
        items-center
        justify-center
        p-6 md:p-8
      ">

          <div className="
          w-full
          max-w-md
          text-center
        ">

            <div className="
            w-16 h-16
            mx-auto
            rounded-full
            bg-blue-100
            flex items-center justify-center
            mb-4
          ">

              <ShieldCheck
                size={30}
                className="text-blue-600"
              />

            </div>


            <h1 className="
            text-3xl
            font-bold
            text-slate-900
          ">
              Verify OTP
            </h1>


            <p className="
            mt-2
            text-slate-500
            text-sm
          ">
              We sent a verification code to
            </p>


            <p className="
            text-blue-600
            font-semibold
            text-sm
            break-all
            mt-1
            mb-5
          ">
              {email}
            </p>


            {/* OTP BOXES */}

            <div
              onPaste={handlePaste}
              className="
              flex
              justify-center
              gap-2
              mb-5
            "
            >

              {otp.map((digit, index) => (

                <input
                  key={index}
                  ref={(el) => inputsRef.current[index] = el}
                  value={digit}
                  onChange={(e) =>
                    handleChange(e.target.value, index)
                  }
                  onKeyDown={(e) =>
                    handleKeyDown(e, index)
                  }
                  maxLength="1"
                  className="
                  w-10 h-12
                  md:w-12 md:h-14
                  rounded-xl
                  border
                  border-slate-300
                  text-center
                  text-lg
                  font-bold
                  outline-none
                  focus:ring-4
                  focus:ring-blue-200
                  focus:border-blue-600
                "
                />

              ))}

            </div>


            {/* TIMER */}

            <div className="
            flex
            justify-center
            items-center
            gap-2
            text-red-500
            text-sm
            mb-5
          ">

              <Clock size={16} />

              OTP expires in {minutes}:{seconds}

            </div>


            {/* BUTTON */}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handleVerify()}
              disabled={loading}
              className="
              w-full
              h-12
              rounded-2xl
              bg-gradient-to-r
              from-blue-600
              to-cyan-500
              text-white
              font-bold
              shadow-lg
              flex
              items-center
              justify-center
              gap-2
              disabled:opacity-60
            "
            >

              {
                loading
                  ? "Verifying..."
                  :
                  <>
                    Verify & Continue
                    <ArrowRight size={18} />
                  </>
              }

            </motion.button>


            {/* RESEND */}

            <p className="
            mt-4
            text-sm
            text-slate-500
          ">

              Didn't receive OTP?

              {
                timer > 0 ? (

                  <span className="ml-2">
                    Resend in {timer}s
                  </span>

                ) : (

                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="
                    ml-2
                    text-blue-600
                    font-semibold
                    hover:underline
                  "
                  >

                    {
                      resendLoading
                        ? "Sending..."
                        : "Resend OTP"
                    }

                  </button>

                )
              }

            </p>

          </div>

        </div>

      </motion.div>

    </div>
  );
};

export default VerifyOTP;