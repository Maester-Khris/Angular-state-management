// routes/auth.js
const express = require("express");
const router = express.Router();

const authService = require("../auth/authService");
const db = require("../database/crud");
const mailer = require("../utils/mailer");

/* ---------- dependency bundle ---------- */
const deps = { db, mailer };

/* ---------- routes ---------- */

router.post("/signup", async (req, res) => {
  const result = await authService.signupUser(req.body, deps);

  if (!result.ok) {
    if (result.reason === "USER_EXISTS") {
      return res.status(409).json({ message: "Signup failed: User already exists" });
    }
    if (result.reason === "EMAIL_FAILED") {
      return res.status(500).json({ message: "Failed to deliver verification email." });
    }
  }

  res.status(201).json({ message: `Registered. Check ${result.email} for OTP.` });
});

router.post("/verify-otp", async (req, res) => {
  const result = await authService.verifyOtp(req.body, deps);

  if (!result.ok) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  res.status(200).json({ message: "Email verified successfully!" });
});

router.post("/resend-otp", async (req, res) => {
  const result = await authService.resendOtp(req.body, deps);

  const map = {
    NOT_FOUND: [404, "User not found"],
    ALREADY_VERIFIED: [400, "Already verified"],
    COOLDOWN: [429, "Cooldown active"],
    DAILY_LIMIT: [429, "Daily limit reached"],
    EMAIL_FAILED: [500, "Failed to deliver OTP email"]
  };

  if (!result.ok) {
    const [status, message] = map[result.reason];
    return res.status(status).json({ message });
  }

  res.status(200).json({ message: "New OTP sent." });
});

router.post("/login", async (req, res) => {
  try {
    const { userProfile, accessToken, refreshToken } =
      await authService.loginUser(req.body, deps);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ message: "Login successful", accessToken, user: userProfile });
  } catch (error) {
    console.error("Login failed:", error.message);
    res.status(401).json({ message: "Invalid email or password." });
  }
});

module.exports = router;
