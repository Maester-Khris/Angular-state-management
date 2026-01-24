const express = require("express");
const router = express.Router();
const { signup, login } = require("../auth/authService");


router.post("/signup", async (req, res) => {
  try {
    const dbuser = await signup(req.body);
    if (!dbuser) {
      return res.status(409).json({ message: "Signup failed: User already exists with this email" });
    }
    return res.status(201).json(dbuser.toJSON());
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ message: "An unexpected error occurred during signup." });
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