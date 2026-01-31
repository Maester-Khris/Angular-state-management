/**
 * @swagger
 * tags:
 *   - name: Activity
 *     description: Authenticated content creation and collaboration
 */

/**
 * @swagger
 * /activity/upload:
 *   post:
 *     summary: Upload an image
 *     description: Uploads an image to Cloudinary and returns its URL
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload successful
 *       400:
 *         description: No image file provided
 *       500:
 *         description: Upload failed
 */

/**
 * @swagger
 * /activity/users/lookup/{email}:
 *   get:
 *     summary: Lookup user UUID by email
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /activity/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPublic:
 *                 type: boolean
 *               isDraft:
 *                 type: boolean
 *               editorUuids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Post created
 *       400:
 *         description: Validation error
 */

/**
 * @swagger
 * /activity/posts/{postuuid}:
 *   put:
 *     summary: Update a post
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postuuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post updated
 *       404:
 *         description: Post not found or unauthorized
 *
 *   delete:
 *     summary: Delete a post
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postuuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Post deleted
 *       404:
 *         description: Unauthorized or not found
 */

/**
 * @swagger
 * /activity/posts/{uuid}/editors:
 *   post:
 *     summary: Add editors to a post
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               editorUuids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Editors added
 *       403:
 *         description: Unauthorized
 */
