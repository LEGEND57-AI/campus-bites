import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import SibApiV3Sdk from "sib-api-v3-sdk";
import { supabase } from "../db.js";
import {
  loginLimiter,
  otpLimiter,
} from "../middleware/rateLimiter.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt.js";
import {
  createSession,
  revokeAllSessions,
} from "../services/sessionService.js";
import { getRefreshCookieOptions } from "./session.js";

const router = express.Router();

// A completed reset-OTP verification is only good for a short window. The
// flag it sets is a standing permission to change the password without any
// further proof, so leaving it valid indefinitely turns an abandoned reset
// flow into a permanent account-takeover primitive for anyone who knows the
// email address.
const PASSWORD_RESET_VERIFICATION_TTL_MS = 15 * 60 * 1000;

// How many guesses a single OTP challenge is worth, per account.
//
// otpLimiter throttles by IP, which an attacker with a proxy pool simply
// rotates around; this budget follows the account instead. Five keeps the
// chance of guessing a six-digit code at 5/10^6 while still tolerating the
// mistypes real users make. It is not a lockout: issuing a new OTP resets the
// counter, so the budget guards one challenge rather than the account.
const MAX_OTP_ATTEMPTS = 5;


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

  } catch (error) {
    // Only the status and message are logged -- never the error object.
    //
    // The Brevo SDK transports over superagent, which rejects with its own
    // error object and attaches the underlying http.ClientRequest to it as
    // error.response.req. That request's `_header` is a plain STRING holding
    // the raw outgoing header block, and the SDK sends the credential as a
    // header (`api-key: <BREVO_API_KEY>`). console.error renders nested
    // strings at that depth, so logging the error object itself wrote the
    // live API key to stdout on every Brevo failure -- an expired key, a
    // quota rejection, a bad recipient, any transient 5xx.
    //
    // error.message carries superagent's status text (e.g. "Unauthorized"),
    // which is what actually makes the failure diagnosable.
    console.error(
      "Brevo API Error:",
      error?.status,
      error?.message
    );
    throw new Error("Failed to send email");
  }
};

// ================= OTP =================
//
// These codes authorise account verification and, via /forgot-password, a
// password change -- so they are a credential, not a nonce. Math.random() was
// used here previously: V8 implements it with xorshift128+, whose internal
// state is recoverable from a run of observed outputs, which would let someone
// who can harvest their own codes predict a victim's reset code.
//
// crypto.randomInt draws from the CSPRNG and rejection-samples internally, so
// there is no modulo bias and no non-cryptographic fallback path.
//
// The bounds are deliberately identical to what they replaced: randomInt's
// upper bound is exclusive, so [100000, 1000000) is 100000-999999 -- always
// exactly six digits, and never a leading zero. Verification compares strings
// (`user.otp !== otp`), so the result is stringified as before.
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

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

    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      // Code and message only -- never the PostgrestError object. PostgREST
      // maps PostgreSQL's DETAIL into `details`, and for a NOT NULL or CHECK
      // violation that DETAIL is "Failing row contains (...)": every column
      // value of the attempted row, which on this table includes
      // password_hash and the plaintext otp.
      console.error("Register lookup error:", existingError?.code, existingError?.message);

      return res.status(500).json({
        error: "Database error",
      });
    }

    if (existingUser) {
      // Same response as a successful registration -- do not reveal that
      // this email is already registered. Deliberately a silent no-op: no
      // account is touched and no OTP is (re)sent from here. /resend-otp
      // already exists as the safe, correct remediation path for a user
      // who needs a new code.
      return res.status(200).json({
        message: "OTP sent",
        email,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = generateOtp();

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
        // A fresh challenge always starts with a full guess budget.
        otp_attempts: 0,
        is_verified: false,
        role: "student",
      },
    ]);

    if (insertError) {
      // Code and message only -- this insert carries password_hash and the
      // plaintext otp, both of which a constraint-violation DETAIL would
      // reproduce in full. See the note on the lookup error above.
      console.error("Register insert error:", insertError?.code, insertError?.message);

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
    // Charges one guess against this account's budget and returns the row in
    // the same statement. The charge happens BEFORE the code is compared:
    // deciding whether to charge based on whether the guess was right is what
    // would let concurrent requests share a single attempt, so a correct guess
    // is charged too and the counter is reset to zero on success below.
    //
    // otpLimiter above still throttles by IP; this is the account-level half,
    // which an attacker rotating IP addresses cannot sidestep.
    const { data: rows, error } = await supabase.rpc("consume_otp_attempt", {
      p_email: email,
      p_max: MAX_OTP_ATTEMPTS,
    });

    if (error) throw error;

    const user = Array.isArray(rows) ? rows[0] : rows;

    if (!user) {
      // Three states answer identically here: no such account, and a budget
      // that is already spent -- plus the incorrect-code branch below.
      //
      // This endpoint is directly callable with any email, so distinguishing
      // "no such user" from "wrong code" would let someone enumerate
      // registered emails without ever registering. Collapsing the exhausted
      // budget into the same response keeps that property and additionally
      // hides whether an account is currently being attacked.
      return res.status(400).json({
        error: "Invalid OTP",
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
          // The challenge was answered correctly, so the guess charged for
          // this request is returned along with the rest of the budget.
          otp_attempts: 0,
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
          otp_attempts: 0,
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

  const genericResponse = {
    message: "If an account exists for this email, a new OTP has been sent.",
  };

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    // Don't reveal whether this email is registered (or already
    // verified) -- every branch below returns the same response.
    if (error || !user || user.is_verified) {
      return res.json(genericResponse);
    }

    const otp = generateOtp();

    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const now = new Date().toISOString();

    await supabase
      .from("users")
      .update({
        otp,
        otp_expiry: expiry,
        otp_last_sent_at: now,
        // A newly issued code is a new challenge, so the guess budget is
        // restored. Without this, a spent budget would persist and lock a
        // legitimate user out of their own fresh OTP.
        otp_attempts: 0,
      })
      .eq("email", email);

    await sendEmail(
      email,
      "New OTP",
      generateEmailTemplate(otp, "resend")
    );

    res.json(genericResponse);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to resend OTP. Please try again.",
    });
  }
});

// ================= FORGOT PASSWORD =================
router.post("/forgot-password", otpLimiter, async (req, res) => {
  let { email } = req.body;

  email = email.trim().toLowerCase();

  const genericResponse = {
    message: "If an account exists for this email, a reset OTP has been sent.",
    email,
  };

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    // Don't reveal whether this email is registered -- both branches
    // below return the identical response.
    if (error || !user) {
      return res.json(genericResponse);
    }

    const otp = generateOtp();

    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const now = new Date().toISOString();

    await supabase
      .from("users")
      .update({
        otp,
        otp_expiry: expiry,
        otp_last_sent_at: now,
        // A newly issued code is a new challenge, so the guess budget is
        // restored. Without this, a spent budget would persist and lock a
        // legitimate user out of their own fresh OTP.
        otp_attempts: 0,
      })
      .eq("email", email);

    await sendEmail(
      email,
      "Reset Password OTP",
      generateEmailTemplate(otp, "reset")
    );

    res.json(genericResponse);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to process request. Please try again.",
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
      // `id` is selected solely so the session revocation below can be scoped
      // to this user. Everything else about this lookup is unchanged.
      .select("id, reset_verified, reset_verified_at")
      .eq("email", email)
      .single();

    // `reset_verified_at` is written together with `reset_verified` in
    // /verify-otp, so it is precisely "when this reset was authorised".
    // Date.parse yields NaN for a missing, null or malformed value, and a
    // timestamp in the future indicates something is wrong with the stored
    // value -- all of those fall through to the rejection below, so the
    // uncertain case always fails closed rather than granting access.
    const verifiedAtMs = Date.parse(user?.reset_verified_at);
    const elapsedMs = Date.now() - verifiedAtMs;

    const withinVerificationWindow =
      Number.isFinite(verifiedAtMs) &&
      elapsedMs >= 0 &&
      elapsedMs <= PASSWORD_RESET_VERIFICATION_TTL_MS;

    if (error || !user || !user.reset_verified || !withinVerificationWindow) {
      // One response for "no such account", "OTP not verified yet" and
      // "verification expired" alike -- avoids leaking which emails are
      // registered, or which have a reset in progress, via this endpoint.
      return res.status(403).json({
        error: "Please verify OTP first",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    // The result of this update was previously discarded, so a failed write
    // still answered "Password updated" while the password was unchanged.
    // It is checked now because the revocation below must only run once the
    // credential change is known to have happened.
    //
    // .select().maybeSingle() rather than the error alone: PostgREST reports
    // no error when an update matches zero rows, so the returned row is the
    // only proof that a write actually occurred.
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: hashed,
        reset_verified: false,
        reset_verified_at: null,
        otp: null,
        otp_expiry: null,
        otp_last_sent_at: null,
      })
      .eq("email", email)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedUser) {
      // Code and message only. A PostgrestError's `details` reproduces the
      // failing row, which on this table carries password_hash and the
      // plaintext otp.
      console.error(
        "Reset password update error:",
        updateError?.code,
        updateError?.message
      );

      return res.status(500).json({
        error: "Failed to update password",
      });
    }

    // The password has changed, so every session issued under the old one is
    // now untrusted -- a reset is the remedy a user reaches for precisely when
    // they believe someone else has access. Refresh tokens live for 30 days,
    // so without this an attacker keeps working access straight through the
    // reset.
    //
    // Deliberately not fatal. The credential change has already committed and
    // the reset OTP is spent, so answering 500 here would tell the user their
    // reset failed when it did not, and leave them unable to retry. The
    // failure is logged for monitoring and the successful response stands.
    //
    // Not atomic with the update above: the two touch different tables and
    // PostgREST offers no transaction across them. Closing that window would
    // need an RPC, which is deliberately out of scope here.
    try {
      await revokeAllSessions(updatedUser.id);
    } catch (revokeError) {
      // user id only -- never the email, password, OTP or any token.
      console.error(
        "Password reset succeeded but session revocation failed for user:",
        updatedUser.id,
        revokeError?.message
      );
    }

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

    const { accessToken: googleAccessToken } = req.body;


    if (!googleAccessToken) {

      return res.status(400).json({
        error: "Google access token missing",
      });

    }


    // VERIFY GOOGLE ACCESS TOKEN by fetching the user's profile.
    // (useGoogleLogin on the frontend returns an OAuth access_token,
    // not a JWT id_token — so we verify it against Google's userinfo
    // endpoint instead of using verifyIdToken.)

    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleAccessToken}`
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error("Google userinfo error:", errText);

      return res.status(401).json({
        error: "Invalid Google access token",
      });
    }

    const payload = await googleRes.json();


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

      // Code and message only -- see the note in /register. This is a read,
      // so a row-bearing DETAIL is unlikely, but the same allowlist applies
      // so the safe form is consistent across every users-table error.
      console.error("Google lookup error:", userError?.code, userError?.message);


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

        // Code and message only -- see the note in /register.
        console.error("Google insert error:", insertError?.code, insertError?.message);


        return res.status(500).json({

          error: "Failed to create Google user",

        });

      }


      user = newUser;

    }


    // ================= GENERATE JWT =================


    // Generate Session ID
    const sessionId = uuidv4();

    // Generate Access Token
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });

    // Generate Refresh Token
    const refreshToken = generateRefreshToken({
      userId: user.id,
      sessionId,
    });

    // Refresh expiry
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);

    // Save session
    await createSession({
      sessionId,
      userId: user.id,
      refreshToken,
      expiresAt: refreshExpiry.toISOString(),

      deviceName: req.headers["user-agent"] || null,
      browser: req.headers["user-agent"] || null,
      ipAddress: req.ip,
    });

    const safeUser = { ...user };

    delete safeUser.password_hash;

    return res
      .cookie(
        "refreshToken",
        refreshToken,
        getRefreshCookieOptions()
      )
      .json({
        accessToken,
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

  // A real bcrypt hash of random bytes, never matched to any account.
  // Comparing against this when no matching user exists means a
  // "no such account" response takes roughly as long as a "wrong
  // password" response -- otherwise the early-return below (skipping
  // the ~100ms bcrypt.compare entirely) would let someone time
  // responses to tell which emails are registered.
  const DUMMY_HASH =
    "$2b$10$lSiZtxkFnN0tXd2t.NwXHOJ4zuWQlClC7mxkYHd/Trg0BbhnOtAGS";

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    const accountUsable =
      !error && !!user && user.is_verified && !!user.password_hash;

    const valid = await bcrypt.compare(
      password,
      accountUsable ? user.password_hash : DUMMY_HASH
    );

    if (error || !user || !user.is_verified) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    if (!user.password_hash) {
      // Same generic response as a non-existent account or a wrong
      // password below -- a Google-only account is real, existing account
      // state, and revealing it here would let someone enumerate which
      // registered emails use Google Sign-In.
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    if (!valid) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // Generate Session ID
    const sessionId = uuidv4();

    // Generate Access Token
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });

    // Generate Refresh Token
    const refreshToken = generateRefreshToken({
      userId: user.id,
      sessionId,
    });

    // Refresh expiry
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);

    // Save session
    await createSession({
      sessionId,
      userId: user.id,
      refreshToken,
      expiresAt: refreshExpiry.toISOString(),

      deviceName: req.headers["user-agent"] || null,
      browser: req.headers["user-agent"] || null,
      ipAddress: req.ip,
    });

    const safeUser = { ...user };

    delete safeUser.password_hash;

    return res
      .cookie(
        "refreshToken",
        refreshToken,
        getRefreshCookieOptions()
      )
      .json({
        accessToken,
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