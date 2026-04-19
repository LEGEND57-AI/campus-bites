import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

const VerifyOTP = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const type = searchParams.get("type"); // 🔥 NEW

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [expiryTimer, setExpiryTimer] = useState(900); // 🔥 15 min

  const inputsRef = useRef([]);
  const navigate = useNavigate();

  // 🔥 RESEND TIMER
  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // 🔥 OTP EXPIRY TIMER
  useEffect(() => {
    if (expiryTimer === 0) return;
    const interval = setInterval(() => setExpiryTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [expiryTimer]);

  // 🔥 INPUT
  const handleChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputsRef.current[index + 1].focus();
    }

    if (newOtp.join("").length === 6) {
      handleVerify(newOtp.join(""));
    }
  };

  // 🔥 BACKSPACE
  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
    if (e.key === "Enter") handleVerify();
  };

  // 🔥 PASTE
  const handlePaste = (e) => {
    const paste = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(paste)) return;

    const newOtp = paste.split("");
    setOtp(newOtp);

    if (paste.length === 6) handleVerify(paste);
  };

  // 🔥 VERIFY
  const handleVerify = async (otpValue) => {
    const finalOtp = otpValue || otp.join("");

    if (!email) return toast.error("Invalid access");
    if (finalOtp.length !== 6) return;

    setLoading(true);

    try {
      await api.post("/auth/verify-otp", {
        email,
        otp: finalOtp,
      });

      toast.success("OTP verified ✅");

      // 🔥 REDIRECT LOGIC
      if (type === "reset") {
        navigate(`/reset-password?email=${email}`);
      } else {
        navigate("/login");
      }

    } catch (error) {
      toast.error(error.response?.data?.error || "Invalid OTP");
    }

    setLoading(false);
  };

  // 🔥 RESEND
  const handleResend = async () => {
    if (!email) return toast.error("Invalid request");
    if (timer > 0 || resendLoading) return;

    setResendLoading(true);

    try {
      await api.post("/auth/resend-otp", { email });

      toast.success("New OTP sent!");

      setOtp(["", "", "", "", "", ""]);
      setTimer(60);
      setExpiryTimer(900); // 🔥 reset expiry

      inputsRef.current[0]?.focus();

    } catch (error) {
      toast.error(error.response?.data?.error || "Resend failed");
    }

    setResendLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">

        <h2 className="text-2xl font-bold mb-2">
          Enter OTP
        </h2>

        <p className="text-gray-500 mb-2 text-sm">
          Sent to <span className="text-blue-600 font-medium">{email}</span>
        </p>

        {/* 🔥 EXPIRY TIMER */}
        <p className="text-xs text-red-500 mb-4">
          OTP expires in {Math.floor(expiryTimer / 60)}:
          {(expiryTimer % 60).toString().padStart(2, "0")}
        </p>

        {/* OTP BOXES */}
        <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputsRef.current[index] = el)}
              type="text"
              maxLength="1"
              value={digit}
              onChange={(e) => handleChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="w-12 h-14 text-center text-xl font-semibold border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          ))}
        </div>

        {/* VERIFY */}
        <button
          onClick={() => handleVerify()}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>

        {/* RESEND */}
        <p className="mt-4 text-sm text-gray-500">
          Didn't receive OTP?{" "}
          {timer > 0 ? (
            <span className="text-gray-400">
              Resend in {timer}s
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="text-blue-600 font-semibold hover:underline disabled:opacity-50"
            >
              {resendLoading ? "Sending..." : "Resend"}
            </button>
          )}
        </p>

      </div>
    </div>
  );
};

export default VerifyOTP;