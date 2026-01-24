const router = require('express').Router();
const dbCrudOperator = require('../database/crud');
const { authenticateJWT } = require("../middleware/auth");

// All activity routes require authentication
router.use(authenticateJWT);

// ==========================================
// 1. COLLABORATOR DISCOVERY
// ==========================================

/**
 * Lookup a user's UUID by email for adding them as an editor.
 * Angular usage: User types email -> returns UUID to store in editorUuids array.
 */
router.get('/users/lookup/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await dbCrudOperator.findAuthorByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ 
      email: email.toLowerCase(),
      uuid: user.useruuid 
    });
  } catch (error) {
    console.error("Lookup error:", error);
    return res.status(500).json({ message: "Error during user lookup" });
  }
});

// ==========================================
// 2. POST MANAGEMENT (CRUD)
// ==========================================

/**
 * Create a new post with support for initial co-editors.
 */
router.post('/posts', async (req, res) => {
  try {
    const { editorUuids, title, description, isPublic, hashtags, isDraft } = req.body;
    
    // 1. Convert external UUIDs to internal ObjectIDs
    let editorIds = [];
    if (Array.isArray(editorUuids) && editorUuids.length > 0) {
      const editorUsers = await dbCrudOperator.findUserByUUid(editorUuids);
      editorIds = editorUsers.map(user => user._id);
    }

    // 2. Consolidate post data
    const postData = {
      title,
      description,
      hashtags,
      isPublic,
      isDraft: isDraft || false,
      author: req.userId,
      authorName: req.userName, 
      editors: editorIds 
    };

    const newPost = await dbCrudOperator.createPost(postData);
    res.status(201).json(newPost);

  } catch (error) {
    console.error("Post Creation Failed:", error);
    res.status(400).json({ message: "Validation error", details: error.message });
  }
});

/**
 * Update existing post metadata. Validates ownership/editor rights via Operator.
 */
router.put('/posts/:postuuid', async (req, res) => {
  try {
    const updatedPost = await dbCrudOperator.updatePost(
      req.params.postuuid,
      req.userId,
      req.body
    );
    if (!updatedPost) return res.status(404).json({ message: "Post not found or unauthorized" });
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
});

/**
 * Atomic delete of post and its related favorites/analytics.
 */
router.delete('/posts/:postuuid', async (req, res) => {
  try {
    const result = await dbCrudOperator.deletePost(req.params.postuuid, req.userId);
    if (!result) return res.status(404).json({ message: "Delete failed: Unauthorized" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Server error during deletion" });
  }
});

// ==========================================
// 3. COLLABORATION CONTROL
// ==========================================

/**
 * Specifically for adding co-editors to an existing post.
 */
router.post('/posts/:uuid/editors', async (req, res) => {
  try {
    const { editorUuids } = req.body;
    const postUuid = req.params.uuid;

    if (!Array.isArray(editorUuids) || editorUuids.length === 0) {
      return res.status(400).json({ message: "No valid editors provided" });
    }

    const users = await dbCrudOperator.findUserByUUid(editorUuids);
    if (users.length === 0) return res.status(404).json({ message: "No valid users found" });
    
    const editorObjectIds = users.map(u => u._id);
    const updatedPost = await dbCrudOperator.addEditorsToPost(
      postUuid, 
      editorObjectIds,
      req.userId
    );

    if (!updatedPost) return res.status(403).json({ message: "Unauthorized: Only authors can add editors" });

    res.json({ message: `Success`, post: updatedPost });
  } catch (error) {
    res.status(500).json({ message: "Failed to add editors" });
  }
});

module.exports = router;