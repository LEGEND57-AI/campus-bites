import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import {
  ShieldCheck,
  Shield,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";

import api from "../services/api";
import ErrorMessage from "../components/common/ErrorMessage";
import { describeError } from "../utils/errorMessage";

// Copied from the /reset-password handler: 8+ characters with at least one
// lowercase letter, one uppercase letter and one digit.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;


const ResetPassword = () => {

  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  const navigate = useNavigate();


  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");


  // Eye toggle states
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);


  const [loading, setLoading] = useState(false);

  const [resetError, setResetError] = useState(null);

  // Inline messages under each input, keyed by field.
  const [fieldErrors, setFieldErrors] = useState({});

  // The same rules backend/routes/auth.js applies on /reset-password, checked
  // here only so a mismatch or weak password is reported before a round trip.
  // The backend stays authoritative.
  const validate = () => {
    const next = {};

    if (newPassword.length < 8) {
      next.newPassword = "Password must be at least 8 characters long.";
    } else if (!STRONG_PASSWORD.test(newPassword)) {
      next.newPassword =
        "Include at least one uppercase letter, one lowercase letter and one number.";
    }

    if (newPassword !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

    return next;
  };



  // Submit
  const handleSubmit = async (e) => {

    e.preventDefault();


    if (!email) {


      return;

    }


    const nextErrors = validate();

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {

      // Nothing was sent, so an earlier server message no longer applies.
      setResetError(null);

      return;

    }


    setLoading(true);


    try {

      await api.post("/auth/reset-password", {

        email,
        newPassword,

      });

      setResetError(null);


      navigate("/login");


    } catch (error) {

      console.error("Password reset failed:", error);

      // 403 here means the verified-OTP window has closed, not a permissions
      // problem, so it gets its own sentence. A 400 is one of the password
      // rules in backend/routes/auth.js, restated rather than passed through.
      setResetError(
        error.response?.status === 403
          ? "Your reset code has expired. Go back to sign in and request a new one."
          : describeError(
              error,
              "Couldn't update your password. Use at least 8 characters with an uppercase letter, a lowercase letter and a number."
            )
      );

    } finally {


      setLoading(false);

    }

  };



  // Invalid Access
  if (!email) {

    return (

      <div className="
        min-h-screen
        flex
        items-center
        justify-center
        text-red-500
        font-semibold
      ">

        Invalid access. Please try again.

      </div>

    );

  }


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

        initial={{
          opacity: 0,
          y: 20,
        }}

        animate={{
          opacity: 1,
          y: 0,
        }}

        transition={{
          duration: 0.4,
        }}

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

            Reset.
            <br />

            Secure.
            <br />

            <span className="text-cyan-300">
              Access.
            </span>

          </h1>


          <p className="
            text-lg
            text-blue-100
            mb-8
          ">

            Create a new password and regain access to
            your CampusCraves account.

          </p>


          <div className="space-y-5">


            <div className="flex items-center gap-3">

              <Shield size={28} />

              <div>

                <h3 className="font-bold">
                  Strong Security
                </h3>

                <p className="text-blue-100 text-sm">
                  Your account remains protected
                </p>

              </div>

            </div>



            <div className="flex items-center gap-3">

              <KeyRound size={28} />

              <div>

                <h3 className="font-bold">
                  New Password
                </h3>

                <p className="text-blue-100 text-sm">
                  Choose a secure password
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


            {/* ICON */}

            <div className="
              w-16
              h-16
              mx-auto
              rounded-full
              bg-blue-100
              flex
              items-center
              justify-center
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

              Reset Password

            </h1>


            <p className="
              mt-2
              text-sm
              text-slate-500
              mb-5
            ">

              Create a new secure password
              for your account

            </p>


            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >


              {/* NEW PASSWORD */}

              <div>

              <div className="relative">


                <input

                  type={
                    showNewPassword
                      ? "text"
                      : "password"
                  }


                  value={newPassword}


                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    // Either field changing makes both messages stale.
                    setFieldErrors({});
                  }}


                  placeholder="New Password"

                  aria-invalid={Boolean(fieldErrors.newPassword)}

                  aria-describedby={
                    fieldErrors.newPassword ? "reset-new-password-error" : undefined
                  }


                  className="
                    w-full
                    h-12
                    rounded-xl
                    border
                    border-slate-300
                    px-4
                    pr-12
                    outline-none
                    focus:ring-4
                    focus:ring-blue-200
                    focus:border-blue-600
                  "

                  required

                />


                <button

                  type="button"

                  onClick={() =>
                    setShowNewPassword(
                      !showNewPassword
                    )
                  }


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
                    showNewPassword
                      ?
                      <EyeOff size={20} />
                      :
                      <Eye size={20} />
                  }


                </button>


              </div>

              {fieldErrors.newPassword && (
                <p
                  id="reset-new-password-error"
                  className="mt-1.5 text-left text-sm text-rose-600"
                >
                  {fieldErrors.newPassword}
                </p>
              )}

              </div>


              {/* CONFIRM PASSWORD */}


              <div>

              <div className="relative">


                <input

                  type={
                    showConfirmPassword
                      ?
                      "text"
                      :
                      "password"
                  }


                  value={confirmPassword}


                  onChange={(e) => {
                    setConfirmPassword(
                      e.target.value
                    );
                    setFieldErrors({});
                  }}


                  placeholder="Confirm Password"

                  aria-invalid={Boolean(fieldErrors.confirmPassword)}

                  aria-describedby={
                    fieldErrors.confirmPassword ? "reset-confirm-password-error" : undefined
                  }


                  className="
                    w-full
                    h-12
                    rounded-xl
                    border
                    border-slate-300
                    px-4
                    pr-12
                    outline-none
                    focus:ring-4
                    focus:ring-blue-200
                    focus:border-blue-600
                  "

                  required

                />


                <button

                  type="button"


                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }


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
                    showConfirmPassword
                      ?
                      <EyeOff size={20} />
                      :
                      <Eye size={20} />
                  }

                </button>


              </div>

              {fieldErrors.confirmPassword && (
                <p
                  id="reset-confirm-password-error"
                  className="mt-1.5 text-left text-sm text-rose-600"
                >
                  {fieldErrors.confirmPassword}
                </p>
              )}

              </div>


              <ErrorMessage message={resetError} className="text-left" />


              {/* BUTTON */}


              <motion.button

                whileTap={{
                  scale: 0.97
                }}

                type="submit"

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
                    ?
                    "Updating..."
                    :
                    <>
                      Update Password

                      <ArrowRight size={18} />
                    </>
                }


              </motion.button>


            </form>


          </div>


        </div>


      </motion.div>


    </div>

  );

};


export default ResetPassword;