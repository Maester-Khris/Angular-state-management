const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middleware/auth")
const { revokateToken } = require("../auth/authService");

const analyticsService = require('../analytics/events-recorder');
const dbCrudOperator = require("../database/crud");

router.use(authenticateJWT);

router.get("/", async (req, res) => {
    return res.status(200).json({ message: "welcome to your dashboard" });
});
router.get("/logout", async (req, res) => {
    try {
        const wasRevoked = await revokateToken(req.token);
        if (!wasRevoked) {
            return res.status(400).json({ message: "Logout failed: Token invalid or expired" });
        }

        // Clear the Refresh Token cookie (The Shield)
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict'
        });

        return res.status(200).json({ message: "User logged out and token revoked." });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ message: "Logout process failed." });
    }
});

router.get("/me/overview",async(req, res) => {
    try {
        const userId = req.userId;

        // Run in parallel to keep latency under 150ms
        const [stats, userBaseInfo] = await Promise.all([
            analyticsService.getStats(userId),
            dbCrudOperator.getUserProfile(userId)
        ]);

        res.status(200).json({
            profile: {
                name: userBaseInfo.name,
                uuid: userBaseInfo.useruuid,
                bio: userBaseInfo.bio || "No bio set",
                memberSince: userBaseInfo.createdAt,
                avatar: userBaseInfo.avatarUrl || "default-avatar.png"
            },
            stats: {
                totalPosts: stats?.totalPosts || 0,
                coAuthored: stats?.totalCoAuthored || 0,
                reach: stats?.totalReach || 0
            }
            // "myfavs", "contribution", and "account_activity" are REMOVED.
            // The client will query /me/favs, /me/contribution, etc., separately.
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to load profile", error: error.message });
    }
}); 

router.get("/me/favorites",  async (req, res) => {
    try {
        const userId = req.userId;
        const limit = parseInt(req.query.limit) || 4; // Default to 4 for the profile grid

        // 1. Query the Favorite collection and "Hydrate" the post data
        const favoriteDocs = await Favorite.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate({
                path: 'post',
                select: 'title description uuid lastEditedAt authorName' // Only pull what the UI needs
            })
            .lean();

        // 2. Clean the output: Map to return an array of post objects directly
        const posts = favoriteDocs
            .filter(fav => fav.post) // Safety check in case a post was deleted
            .map(fav => ({
                ...fav.post,
                savedAt: fav.createdAt
            }));

        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to load favorites posts", 
            error: error.message 
        });
    }
});
module.exports = router;