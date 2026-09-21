import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";

import { User, Mail, Phone, Lock } from "lucide-react";

import logo from "../assets/CampusCraves-Logo.png";
import AuthShell from "../components/auth/AuthShell";
import AuthField from "../components/auth/AuthField";
import FormError from "../components/auth/FormError";
import {
  SubmitButton,
  GoogleButton,
  AuthDivider,
} from "../components/auth/AuthButtons";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();

  // 🔥 NORMAL SIGNUP
  // Inline validation messages, keyed by field. `form` is the fallback for a
  // server error that does not belong to any single input.
  const [errors, setErrors] = useState({});

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const clearError = (field) =>
    setErrors((prev) =>
      prev[field] || prev.form ? { ...prev, [field]: undefined, form: undefined } : prev
    );

  // Mirrors the rules the register endpoint already enforces -- nothing new is
  // introduced here, this only reports them before a round trip. The backend
  // stays authoritative and its own response is still mapped below.
  const validate = () => {
    const next = {};
    const trimmedEmail = email.trim();

    if (!name.trim()) {
      next.name = "Full name is required.";
    }

    if (!trimmedEmail) {
      next.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      next.email = "Please enter a valid email address.";
    }

    if (!phone.trim()) {
      next.phone = "Phone number is required.";
    }

    if (!password) {
      next.password = "Password is required.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters long.";
    }

    return next;
  };

  // The register endpoint returns readable sentences for the cases a user can
  // act on, so those are shown as-is under the field they concern rather than
  // being re-worded. Anything unrecognised -- notably the generic "Database
  // error" -- is replaced with a neutral message so no internal detail is
  // surfaced.
  const mapServerError = (message) => {
    if (typeof message !== "string" || !message) {
      return { form: "Something went wrong. Please try again." };
    }

    if (/password/i.test(message)) {
      return { password: message };
    }

    if (/already|exists|registered/i.test(message)) {
      return { email: message };
    }

    if (/missing required fields/i.test(message)) {
      return { form: "Please fill in all the required fields." };
    }

    return { form: "Something went wrong. Please try again." };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsLoading(true);

    const result = await register(name, email, phone, password);

    setIsLoading(false);

    if (!result?.success) {
      setErrors(mapServerError(result?.error));
      return;
    }

    toast.success("OTP sent to your email 📩");

    navigate(`/verify-otp?email=${encodeURIComponent(result.email)}`);
  };

  // 🔥 GOOGLE SIGNUP HANDLER
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleAuth = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setGoogleLoading(true);

        const result = await googleLogin(tokenResponse.access_token);

        if (!result?.success) {
          toast.error("Google signup failed");
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
      toast.error("Google Sign Up failed");
    },
  });

  return (
    <AuthShell>
      <img
        src={logo}
        alt=""
        width={64}
        height={64}
        className="mx-auto mb-4 w-14 sm:w-16"
      />

      {/* Single <h1>, matching Login: it has to survive below `lg`, where the
          marketing panel is removed from the tree. */}
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Join CampusCraves
      </h1>

      <p className="mt-2 text-center text-sm text-slate-500 sm:text-base">
        Create your account and start ordering in seconds.
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-7 space-y-4">

        <AuthField
          label="Full name"
          type="text"
          icon={User}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
          }}
          placeholder="Enter your full name"
          autoComplete="name"
          error={errors.name}
        />

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
          label="Phone number"
          type="tel"
          icon={Phone}
          value={phone}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            if (value.length <= 10) {
              setPhone(value);
            }
            clearError("phone");
          }}
          placeholder="10-digit mobile number"
          autoComplete="tel"
          inputMode="numeric"
          maxLength={10}
          error={errors.phone}
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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          error={errors.password}
        />

        {/* Server errors that belong to no single field (§8.3). */}
        <FormError id="signup-form-error" message={errors.form} />

        <SubmitButton loading={isLoading} loadingLabel="Creating your account">
          Create account
        </SubmitButton>

        <AuthDivider />

        <GoogleButton
          onClick={() => googleAuth()}
          loading={googleLoading}
          label="Continue with Google"
        />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          to="/login"
          className="
            rounded font-semibold text-blue-600 hover:underline
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-primary focus-visible:ring-offset-2
          "
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
};

export default Signup;
