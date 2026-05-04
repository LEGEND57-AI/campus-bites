import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { supabase } from '../db.js';

const router = express.Router();

// ================= EMAIL =================
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ================= EMAIL TEMPLATE =================
const generateEmailTemplate = (otp, type = "verify") => {
  const titleMap = {
    verify: "Verify Your Account",
    resend: "New OTP Requested",
    reset: "Reset Your Password"
  };

  const subtitleMap = {
    verify: "Use this OTP to complete your signup",
    resend: "Here is your new OTP",
    reset: "Use this OTP to reset your password"
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
router.post('/register', async (req, res) => {
  let { name, email, phone, password } = req.body;
  email = email.trim().toLowerCase();

  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await supabase.from('users').insert([{
      name,
      email,
      phone,
      password_hash: hashedPassword,
      otp,
      otp_expiry: expiry,
      otp_last_sent_at: now,   // 🔥 NEW
      is_verified: false,
      role: 'student'
    }]);

    await emailTransporter.sendMail({
      from: `"CampusBites" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your account",
      html: generateEmailTemplate(otp, "verify")
    });

    res.json({ message: 'OTP sent', email });

  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ================= VERIFY OTP =================
router.post('/verify-otp', async (req, res) => {
  let { email, otp } = req.body;
  email = email.trim().toLowerCase();

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    const now = new Date().toISOString();

    if (!user || user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (user.otp_expiry < now) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    await supabase.from('users').update({
      is_verified: true,
      otp: null,
      otp_expiry: null,
      otp_last_sent_at: null
    }).eq('email', email);

    res.json({ message: 'Verified' });

  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ================= RESEND OTP (🔥 FIXED) =================
router.post('/resend-otp', async (req, res) => {
  let { email } = req.body;
  email = email.trim().toLowerCase();

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) return res.status(400).json({ error: 'User not found' });

    const nowTime = new Date();
    const lastSent = user.otp_last_sent_at
      ? new Date(user.otp_last_sent_at)
      : null;

    // 🔥 60 SEC COOLDOWN
    if (lastSent) {
      const diff = (nowTime - lastSent) / 1000;

      if (diff < 60) {
        return res.status(400).json({
          error: `Please wait ${Math.ceil(60 - diff)}s`
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await supabase.from('users').update({
      otp,
      otp_expiry: expiry,
      otp_last_sent_at: now   // 🔥 UPDATE TIME
    }).eq('email', email);

    await emailTransporter.sendMail({
      from: `"CampusBites" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "New OTP",
      html: generateEmailTemplate(otp, "resend")
    });

    res.json({ message: 'OTP resent' });

  } catch {
    res.status(500).json({ error: 'Resend failed' });
  }
});

// ================= FORGOT PASSWORD =================
router.post('/forgot-password', async (req, res) => {
  let { email } = req.body;
  email = email.trim().toLowerCase();

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) return res.status(400).json({ error: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await supabase.from('users').update({
      otp,
      otp_expiry: expiry,
      otp_last_sent_at: now   // 🔥 ADD
    }).eq('email', email);

    await emailTransporter.sendMail({
      from: `"CampusBites" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password OTP",
      html: generateEmailTemplate(otp, "reset")
    });

    res.json({ message: 'Reset OTP sent', email });

  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ================= RESET PASSWORD =================
router.post('/reset-password', async (req, res) => {
  let { email, newPassword } = req.body;

  const hashed = await bcrypt.hash(newPassword, 10);

  await supabase.from('users').update({
    password_hash: hashed
  }).eq('email', email);

  res.json({ message: "Password updated" });
});

// ================= LOGIN =================
router.post('/login', async (req, res) => {
  let { email, password } = req.body;
  email = email.trim().toLowerCase();

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user || !user.is_verified) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.password_hash;

    res.json({ token, user });

  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;