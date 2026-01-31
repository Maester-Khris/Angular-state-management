/**
 * @swagger
 * tags:
 *   - name: Profile
 *     description: Authenticated user profile and session management
 */

/**
 * @swagger
 * /profile/logout:
 *   get:
 *     summary: Logout current user
 *     description: Revokes the active JWT and clears refresh token cookie
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User logged out successfully
 *       400:
 *         description: Logout failed (token invalid or expired)
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /profile/me/full-profile:
 *   get:
 *     summary: Load full user profile (aggregated)
 *     description: |
 *       Single-trip profile loader aggregating profile, analytics,
 *       drafts, and favorites with partial failure tolerance.
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated profile payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     latency:
 *                       type: string
 *                     partialFailure:
 *                       type: boolean
 *                     serverTime:
 *                       type: string
 *                       format: date-time
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       type: object
 *                     stats:
 *                       type: object
 *                     drafts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     favorites:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Profile service health check
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile module is active
 */
