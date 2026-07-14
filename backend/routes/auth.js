import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from "sib-api-v3-sdk";
import { supabase } from "../db.js";
import { OAuth2Client } from "google-auth-library";
import {
  loginLimiter,
  otpLimiter,
} from "../middleware/rateLimiter.js";

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
        name: "CampusCraves",
        email: "campuscraves.app@gmail.com",
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

// ================= GOOGLE AUTH =================

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

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
        <h2>🍔 CampusCraves</h2>
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
router.post("/register", otpLimiter, async (req, res) => {
  let { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long."
    });
  }

  const strongPassword =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  if (!strongPassword.test(password)) {
    return res.status(400).json({
      error: "Password must contain at least one uppercase letter, one lowercase letter and one number."
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
router.post("/verify-otp", otpLimiter, async (req, res) => {
  let { email, otp, type } = req.body;

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

    if (type === "reset") {
      await supabase
        .from("users")
        .update({
          reset_verified: true,
          reset_verified_at: new Date().toISOString(),
          otp: null,
          otp_expiry: null,
          otp_last_sent_at: null,
        })
        .eq("email", email);
    } else {
      await supabase
        .from("users")
        .update({
          is_verified: true,
          otp: null,
          otp_expiry: null,
          otp_last_sent_at: null,
        })
        .eq("email", email);
    }

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
router.post("/resend-otp", otpLimiter, async (req, res) => {
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
router.post("/forgot-password", otpLimiter, async (req, res) => {
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
router.post("/reset-password", otpLimiter, async (req, res) => {
  try {
    let { email, newPassword } = req.body;

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long."
      });
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!strongPassword.test(newPassword)) {
      return res.status(400).json({
        error:
          "Password must contain at least one uppercase letter, one lowercase letter and one number."
      });
    }

    email = email.trim().toLowerCase();

    const { data: user, error } = await supabase
      .from("users")
      .select("reset_verified")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (!user.reset_verified) {
      return res.status(403).json({
        error: "Please verify OTP first",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await supabase
      .from("users")
      .update({
        password_hash: hashed,
        reset_verified: false,
        reset_verified_at: null,
        otp: null,
        otp_expiry: null,
        otp_last_sent_at: null,
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

// ================= GOOGLE LOGIN =================

router.post("/google", loginLimiter, async (req, res) => {

  try {

    const { credential } = req.body;


    if (!credential) {

      return res.status(400).json({
        error: "Google credential missing",
      });

    }


    // VERIFY GOOGLE TOKEN

    const ticket =
      await googleClient.verifyIdToken({

        idToken: credential,

        audience: process.env.GOOGLE_CLIENT_ID,

      });


    const payload = ticket.getPayload();


    const {

      email,
      name,
      picture,

    } = payload;


    if (!email) {

      return res.status(400).json({

        error: "Google account email not found",

      });

    }


    // CHECK USER IN DATABASE

    const {

      data: existingUser,

      error: userError,

    } = await supabase

      .from("users")

      .select("*")

      .eq("email", email.toLowerCase())

      .maybeSingle();


    if (userError) {

      console.error(userError);


      return res.status(500).json({

        error: "Database error",

      });

    }

    let user = existingUser;


    // ================= CREATE NEW USER =================

    if (!user) {

      const { data: newUser, error: insertError } =
        await supabase

          .from("users")

          .insert([
            {
              name: name || "CampusCraves User",

              email: email.toLowerCase(),

              phone: null,

              password_hash: null,

              is_verified: true,

              role: "student",
            },
          ])

          .select()

          .single();


      if (insertError) {

        console.error(insertError);


        return res.status(500).json({

          error: "Failed to create Google user",

        });

      }


      user = newUser;

    }


    // ================= GENERATE JWT =================


    const token = jwt.sign(

      {
        userId: user.id,

        role: user.role,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "7d",
      }

    );


    // REMOVE PASSWORD


    const safeUser = {

      ...user,

    };


    delete safeUser.password_hash;


    // SUCCESS RESPONSE


    res.json({

      token,

      user: safeUser,

    });


  } catch (error) {


    console.error(

      "Google login error:",

      error

    );


    res.status(500).json({

      error: "Google authentication failed",

    });


  }

});

// ================= LOGIN =================
router.post("/login", loginLimiter, async (req, res) => {
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

    if (!user.password_hash) {
      return res.status(401).json({
        error: "This account uses Google Sign-In. Please continue with Google."
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
