const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middleware/auth");
const { revokateToken } = require("../auth/authService");
const analyticsService = require('../analytics/events-recorder');
const dbCrudOperator = require("../database/crud");

// All routes in this file require a valid JWT
router.use(authenticateJWT);

// ==========================================
// 1. SESSION MANAGEMENT
// ==========================================

router.get("/logout", async (req, res) => {
  try {
    const wasRevoked = await revokateToken(req.token);
    if (!wasRevoked) {
      return res.status(400).json({ message: "Logout failed: Token invalid or expired" });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict'
    });

    return res.status(200).json({ message: "User logged out successfully." });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({ message: "Internal server error during logout." });
  }
});

// ==========================================
// 2. DATA ORCHESTRATION (The Angular Powerhouse)
// ==========================================

/**
 * Single-trip profile loader.
 * Reduces Frontend-to-Backend latency by aggregating all view-critical data.
 */
router.get("/me/full-profile", async (req, res) => {
  const userId = req.userId;
  const start = Date.now();

  // Parallel execution using allSettled for high resilience
  const results = await Promise.allSettled([
    dbCrudOperator.getUserProfile(userId),
    analyticsService.getStats(userId),
    dbCrudOperator.getUserDrafts(userId),
    dbCrudOperator.getUserFavorites(userId)
  ]);

  // Extract values with guaranteed fallbacks (Safe Return Pattern)
  const profile = results[0].status === 'fulfilled' ? results[0].value : {};
  const stats = results[1].status === 'fulfilled' ? results[1].value : { totalPosts: 0, totalReach: 0 };
  const drafts = results[2].status === 'fulfilled' ? results[2].value : [];
  const favorites = results[3].status === 'fulfilled' ? results[3].value : [];

  res.status(200).json({
    metadata: {
      latency: `${Date.now() - start}ms`,
      partialFailure: results.some(r => r.status === 'rejected'),
      serverTime: new Date()
    },
    data: {
      profile,
      stats,
      drafts,
      favorites
    }
  });
});

// ==========================================
// 3. LEGACY / GRANULAR FALLBACKS (Optional)
// ==========================================

// Keeping only a generic index for diagnostic / breadcrumb use
router.get("/", async (req, res) => {
  return res.status(200).json({ status: "active", module: "profile_v1" });
});

module.exports = router;