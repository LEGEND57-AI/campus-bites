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
  return `
  <div style="background:#f1f5f9;padding:20px;font-family:Arial">
    <div style="max-width:500px;margin:auto;background:white;border-radius:12px">
      <div style="background:linear-gradient(90deg,#3B82F6,#06B6D4);padding:20px;color:white;text-align:center">
        <h2>🍔 CampusBites</h2>
      </div>

      <div style="padding:30px;text-align:center">
        <h3>${type === "reset" ? "Reset Password" : "Verify Account"}</h3>
        <p>Use this OTP:</p>

        <div style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#3B82F6">
          ${otp}
        </div>

        <p style="font-size:12px;color:#64748b">Valid for 15 minutes</p>
      </div>
    </div>
  </div>
  `;
};

// ================= REGISTER =================
router.post('/register', async (req, res) => {
  try {
    let { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    email = email.trim().toLowerCase();

    // check existing
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

    // insert user
    const { error: insertError } = await supabase.from('users').insert([{
      name,
      email,
      phone,
      password_hash: hashedPassword,
      otp,
      otp_expiry: expiry,
      otp_last_sent_at: now,
      is_verified: false,
      role: 'student'
    }]);

    if (insertError) {
      console.error("INSERT ERROR:", insertError);
      return res.status(500).json({ error: insertError.message });
    }

    // send email
    await emailTransporter.sendMail({
      from: `"CampusBites" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your account",
      html: generateEmailTemplate(otp, "verify")
    });

    res.json({ success: true, message: 'OTP sent', email });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= VERIFY OTP =================
router.post('/verify-otp', async (req, res) => {
  try {
    let { email, otp } = req.body;
    email = email.trim().toLowerCase();

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) return res.status(400).json({ error: "User not found" });

    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (user.otp_expiry < new Date().toISOString()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    await supabase.from('users').update({
      is_verified: true,
      otp: null,
      otp_expiry: null,
      otp_last_sent_at: null
    }).eq('email', email);

    res.json({ success: true, message: 'Account verified' });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= LOGIN =================
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim().toLowerCase();

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_verified) {
      return res.status(401).json({ error: 'Please verify your email first' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.password_hash;

    res.json({ success: true, token, user });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= FORGOT PASSWORD =================
router.post('/forgot-password', async (req, res) => {
  try {
    let { email } = req.body;
    email = email.trim().toLowerCase();

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
      otp_last_sent_at: now
    }).eq('email', email);

    await emailTransporter.sendMail({
      from: `"CampusBites" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password OTP",
      html: generateEmailTemplate(otp, "reset")
    });

    res.json({ success: true, message: 'OTP sent' });

  } catch (err) {
    console.error("FORGOT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= RESET PASSWORD =================
router.post('/reset-password', async (req, res) => {
  try {
    let { email, newPassword } = req.body;
    email = email.trim().toLowerCase();

    const hashed = await bcrypt.hash(newPassword, 10);

    await supabase.from('users').update({
      password_hash: hashed
    }).eq('email', email);

    res.json({ success: true, message: "Password updated" });

  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;