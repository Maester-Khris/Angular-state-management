const express = require("express");
const router = express.Router();
const { signup, login } = require("../auth/authService");
const { sendOtpEmail} = require("../utils/mailer");
const {generateOtp} = require("../utils/otpgenerator");
const Otp = require("../database/models/userotp");
const User = require("../database/models/user");

router.post("/signup", async (req, res) => {
  try {
    const dbuser = await signup(req.body);
    if (!dbuser) {
      return res.status(409).json({ message: "Signup failed: User already exists with this email" });
    }
    // 3. Generate and Store OTP
    const otpCode = generateOtp();
    const { email } = dbuser;
    await Otp.create({ email, otp: otpCode });
    await sendOtpEmail(email, otpCode);
    // return res.status(201).json(dbuser.toJSON());
    return res.status(201).json({ message: `User with email ${email} registered. Please check your email for OTP.` });
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ message: "An unexpected error occurred during signup." });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const record = await Otp.findOne({ email, otp });
    if (!record) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    // 2. Mark User as Verified
    await User.findOneAndUpdate({ email }, { isVerified: true });
    // 3. Delete the OTP record so it can't be reused
    await Otp.deleteOne({ _id: record._id });

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  try {
    // 1. Ensure user exists and is not already verified
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "Account already verified" });

    // 2. Clear previous OTPs for this email to avoid confusion
    await Otp.deleteMany({ email });

    // 3. Generate new OTP and Save
    const newOtp = generateOtp();
    await Otp.create({ email, otp: newOtp });

    // 4. Send Email
    await sendOtpEmail(email, newOtp);

    res.status(200).json({ message: "A new OTP has been sent to your email." });
  } catch (error) {
    res.status(500).json({ error: error.message });
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