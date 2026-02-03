const express = require("express");
const router = express.Router();
const { signup, login } = require("../auth/authService");
const { sendOtpEmail } = require("../utils/mailer");
const { generateOtp } = require("../utils/otpgenerator");
const db = require("../database/crud"); // use db CRUD helpers

// Configuration for battle-testing/emergency delivery
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10);
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.RESEND_COOLDOWN_SECONDS || "60", 10);
const MAX_RESENDS_PER_DAY = parseInt(process.env.MAX_RESENDS_PER_DAY || "5", 10);
const SEND_RETRY_ATTEMPTS = parseInt(process.env.SEND_RETRY_ATTEMPTS || "3", 10);
const SEND_RETRY_BASE_MS = parseInt(process.env.SEND_RETRY_BASE_MS || "500", 10);

// Helper: send email with retries and exponential backoff
async function sendWithRetries(email, otp) {
  let attempt = 0;
  while (attempt < SEND_RETRY_ATTEMPTS) {
    try {
      await sendOtpEmail(email, otp);
      return; // success
    } catch (err) {
      attempt++;
      console.error(`sendOtpEmail attempt ${attempt} failed for ${email}:`, err.message);
      if (attempt >= SEND_RETRY_ATTEMPTS) throw err;
      // exponential backoff
      const waitMs = SEND_RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise(res => setTimeout(res, waitMs));
    }
  }
}

router.post("/signup", async (req, res) => {
  try {
    const dbuser = await signup(req.body);
    if (!dbuser) {
      return res.status(409).json({ message: "Signup failed: User already exists with this email" });
    }

    const otpCode = generateOtp();
    const { email } = dbuser;

    // Save OTP with timestamps and expiry
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const otpRecord = await db.createOtp({ email, otp: otpCode, createdAt, expiresAt });

    try {
      await sendWithRetries(email, otpCode);
    } catch (sendErr) {
      // Clean up OTP on persistent send failures
      console.error(`Failed to send OTP to ${email} after retries:`, sendErr.message);
      try { await db.deleteOtpById(otpRecord._id); } catch (e) { /* ignore cleanup errors */ }
      return res.status(500).json({ message: "Failed to deliver verification email. Please try again later." });
    }

    return res.status(201).json({ message: `User with email ${email} registered. Please check your email for OTP.` });
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ message: "An unexpected error occurred during signup." });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    // Ensure the OTP exists and has not expired
    const record = await db.findValidOtp(email, otp);
    if (!record) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    // Mark User as Verified
    await db.markUserVerifiedByEmail(email);
    // Delete all OTP records for this email to prevent reuse/brute-force
    await db.deleteOtpsByEmail(email);

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error("verify-otp error:", error.message);
    res.status(500).json({ error: "An unexpected error occurred while verifying OTP." });
  }
});

router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  try {
    // Ensure user exists and is not already verified
    const user = await db.findUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "Account already verified" });

    const now = new Date();

    // 1. Prevent very frequent resends (cooldown)
    const recent = await db.findLatestOtpByEmail(email);
    if (recent && recent.createdAt && (now - new Date(recent.createdAt)) < RESEND_COOLDOWN_SECONDS * 1000) {
      return res.status(429).json({ message: `Please wait ${RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP.` });
    }

    // 2. Limit total resends per 24 hours
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sendsLast24h = await db.countOtpsSince(email, dayAgo);
    if (sendsLast24h >= MAX_RESENDS_PER_DAY) {
      return res.status(429).json({ message: "Too many OTP requests in the last 24 hours. Try again later." });
    }

    // 3. Remove previous OTPs (to avoid confusion) and create a new one with expiry
    await db.deleteOtpsByEmail(email);
    const newOtp = generateOtp();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const newRecord = await db.createOtp({ email, otp: newOtp, createdAt, expiresAt });

    // 4. Send Email with retries; clean up on persistent failure
    try {
      await sendWithRetries(email, newOtp);
    } catch (sendErr) {
      console.error(`Failed to resend OTP to ${email}:`, sendErr.message);
      try { await db.deleteOtpById(newRecord._id); } catch (e) { /* ignore cleanup errors */ }
      return res.status(500).json({ message: "Failed to deliver OTP email. Please try again later." });
    }

    res.status(200).json({ message: "A new OTP has been sent to your email." });
  } catch (error) {
    console.error("resend-otp error:", error.message);
    res.status(500).json({ error: "An unexpected error occurred while resending OTP." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { userProfile, accessToken, refreshToken } = await login(req.body);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      user: userProfile
    });

  } catch (error) {
    // Log detailed error internally, but keep client response generic for security
    console.error(`Login failed for ${req.body?.email}:`, error.message);
    return res.status(401).json({ message: "Invalid email or password." });
  }
});

module.exports = router;