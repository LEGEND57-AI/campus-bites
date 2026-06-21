import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from "sib-api-v3-sdk";
import { supabase } from "../db.js";

const router = express.Router();

// ================= BREVO API =================

const client = SibApiV3Sdk.ApiClient.instance;

const apiKey = client.authentications["api-key"];

apiKey.apiKey = process.env.BREVO_API_KEY;

const brevoApi = new SibApiV3Sdk.TransactionalEmailsApi();

const sendEmail = async (to, subject, html) => {
  try {
    await brevoApi.sendTransacEmail({
      sender: {
        name: "CampusBites",
        email: "campusbites.app01@gmail.com",
      },

      to: [
        {
          email: to,
        },
      ],

      subject,
      htmlContent: html,
    });

    console.log("✅ Email sent");
  } catch (error) {
    console.error("❌ Brevo API Error:", error);
    throw new Error("Failed to send email");
  }
};

// ================= EMAIL TEMPLATE =================
const generateEmailTemplate = (otp, type = "verify") => {
  const titleMap = {
    verify: "Verify Your Account",
    resend: "New OTP Requested",
    reset: "Reset Your Password",
  };

  const subtitleMap = {
    verify: "Use this OTP to complete your signup",
    resend: "Here is your new OTP",
    reset: "Use this OTP to reset your password",
  };

  return `
  <div style="background:#f1f5f9;padding:20px;font-family:Arial">
    <div style="max-width:500px;margin:auto;background:white;border-radius:12px;overflow:hidden">

      <div style="background:linear-gradient(90deg,#3B82F6,#06B6D4);padding:20px;color:white;text-align:center">
        <h2>🍔 CampusBites</h2>
      </div>

      <div style="padding:30px;text-align:center">
        <h3>${titleMap[type]}</h3>
        <p>${subtitleMap[type]}</p>

        <div style="margin:20px 0">
          <span style="font-size:28px;font-weight:bold;letter-spacing:8px;color:#3B82F6">
            ${otp}
          </span>
        </div>

        <p style="font-size:12px;color:#64748b">
          OTP valid for 15 minutes
        </p>
      </div>

    </div>
  </div>
  `;
};

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  let { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  email = email.trim().toLowerCase();

  try {
    console.log("🔥 Register API hit");

    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      console.error(existingError);

      return res.status(500).json({
        error: "Database error",
      });
    }

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const now = new Date().toISOString();

    // SAVE USER FIRST
    const { error: insertError } = await supabase.from("users").insert([
      {
        name,
        email,
        phone,
        password_hash: hashedPassword,
        otp,
        otp_expiry: expiry,
        otp_last_sent_at: now,
        is_verified: false,
        role: "student",
      },
    ]);

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        error: "Failed to create account",
      });
    }

    // SEND OTP MAIL
    await sendEmail(
      email,
      "Verify your account",
      generateEmailTemplate(otp, "verify")
    );

    res.status(200).json({
      message: "OTP sent",
      email,
    });
  } catch (err) {
    console.error("Register error:", err);

    res.status(500).json({
      error: "Registration failed",
    });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", async (req, res) => {
  let { email, otp } = req.body;

  email = email.trim().toLowerCase();

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(400).json({
        error: "User not found",
      });
    }

    const now = new Date().toISOString();

    if (user.otp !== otp) {
      return res.status(400).json({
        error: "Invalid OTP",
      });
    }

    if (user.otp_expiry < now) {
      return res.status(400).json({
        error: "OTP expired",
      });
    }

    await supabase
      .from("users")
      .update({
        is_verified: true,
        otp: null,
        otp_expiry: null,
        otp_last_sent_at: null,
      })
      .eq("email", email);

    res.json({
      message: "Verified",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Verification failed",
    });
  }
});

// ================= RESEND OTP =================
router.post("/resend-otp", async (req, res) => {
  let { email } = req.body;

  email = email.trim().toLowerCase();

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(400).json({
        error: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const now = new Date().toISOString();

    await supabase
      .from("users")
      .update({
        otp,
        otp_expiry: expiry,
        otp_last_sent_at: now,
      })
      .eq("email", email);

    await sendEmail(
      email,
      "New OTP",
      generateEmailTemplate(otp, "resend")
    );

    res.json({
      message: "OTP resent",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Resend failed",
    });
  }
});

// ================= FORGOT PASSWORD =================
router.post("/forgot-password", async (req, res) => {
  let { email } = req.body;

  email = email.trim().toLowerCase();

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(400).json({
        error: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const now = new Date().toISOString();

    await supabase
      .from("users")
      .update({
        otp,
        otp_expiry: expiry,
        otp_last_sent_at: now,
      })
      .eq("email", email);

    await sendEmail(
      email,
      "Reset Password OTP",
      generateEmailTemplate(otp, "reset")
    );

    res.json({
      message: "Reset OTP sent",
      email,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed",
    });
  }
});

// ================= RESET PASSWORD =================
router.post("/reset-password", async (req, res) => {
  try {
    let { email, newPassword } = req.body;

    email = email.trim().toLowerCase();

    const hashed = await bcrypt.hash(newPassword, 10);

    await supabase
      .from("users")
      .update({
        password_hash: hashed,
      })
      .eq("email", email);

    res.json({
      message: "Password updated",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to update password",
    });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  email = email.trim().toLowerCase();

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user || !user.is_verified) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const safeUser = { ...user };

    delete safeUser.password_hash;

    res.json({
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Login failed",
    });
  }
});

export default router;
