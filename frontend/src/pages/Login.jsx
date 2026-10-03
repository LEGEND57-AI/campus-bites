import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

import { Mail, Lock } from "lucide-react";

import logo from "../assets/CampusCraves-Logo.png";
import AuthShell from "../components/auth/AuthShell";
import AuthField from "../components/auth/AuthField";
import FormError from "../components/auth/FormError";
import {
  SubmitButton,
  GoogleButton,
  AuthDivider,
} from "../components/auth/AuthButtons";


const Login = () => {

  // ================= STATES =================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          return;
        }

        navigate(result?.user?.role === "admin" ? "/admin" : "/");

      } catch (error) {
        console.error(error);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
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
      navigate(`/verify-otp?email=${encodeURIComponent(email)}&type=reset`);
      return;
    }

  };

  // ================= UI =================

  return (
    <AuthShell>
      <img
        src={logo}
        alt=""
        width={64}
        height={64}
        className="mx-auto mb-4 w-14 sm:w-16"
      />

      {/* The page's single <h1>. It lives here rather than in the marketing
          panel so that it survives below `lg`, where that panel is removed. */}
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Ready to Crave?
      </h1>

      <p className="mt-2 text-center text-sm text-slate-500 sm:text-base">
        Sign in and discover your favorite campus meals.
      </p>

      {/* noValidate hands validation to the checks above. The inputs keep
          their `required` attribute for assistive tech, but the browser's
          own bubble would otherwise pre-empt the inline messages. */}
      <form noValidate onSubmit={handleSubmit} className="mt-7 space-y-4">

        <AuthField
          label="Email address"
          type="email"
          icon={Mail}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          placeholder="you@campus.edu"
          autoComplete="email"
          error={errors.email}
        />

        <AuthField
          label="Password"
          type="password"
          icon={Lock}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
          }}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password}
        />

        {/* REMEMBER + FORGOT */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              id="login-remember"
              type="checkbox"
              checked={remember}
              onChange={() => setRemember(!remember)}
              className="
                size-5 rounded border-slate-300 text-blue-600
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2
              "
            />
            <label htmlFor="login-remember" className="text-sm text-slate-700">
              Remember me
            </label>
          </div>

          {/* -mr-2 px-2 py-2 keeps the 44px touch target §17.2 asks for while
              leaving the label optically aligned with the field edge. */}
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isResetting}
            className="
              -mr-2 rounded-lg px-2 py-2 text-sm font-semibold text-blue-600
              transition-colors hover:text-blue-700 hover:underline
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary focus-visible:ring-offset-2
              disabled:opacity-50
            "
          >
            {isResetting ? "Sending OTP…" : "Forgot password?"}
          </button>
        </div>

        {/* Credentials failure. §8.3 places a form-level error above the
            submit button: it describes the pair, and which of the two was
            wrong is deliberately not revealed. */}
        <FormError id="login-form-error" message={errors.form} />

        <SubmitButton loading={isLoading} loadingLabel="Signing in">
          Sign in
        </SubmitButton>

        <AuthDivider />

        <GoogleButton
          onClick={() => googleAuth()}
          loading={googleLoading}
          label="Continue with Google"
        />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link
          to="/signup"
          className="
            rounded font-semibold text-blue-600 hover:underline
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-primary focus-visible:ring-offset-2
          "
        >
          Create account
        </Link>
      </p>
    </AuthShell>
  );
};

export default Login;
