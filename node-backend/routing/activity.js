const router = require('express').Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { uploadImage } = require('../services/cloudinary');
const dbCrudOperator = require('../database/crud');
const { authenticateJWT } = require("../middleware/auth");
const { generateSlug, computeReadTime } = require('../utils/functions');
const { syncPostTags, searchTags, getAllTags } = require('../services/tagService');

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit: 5MB
});


// ==========================================
// TAG SEARCH (Public — no auth required)
// ==========================================

router.get('/api/tags/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'Query must be at least 2 characters' });
  }
  try {
    const results = await searchTags(q);
    return res.status(200).json({ query: q, results });
  } catch (err) {
    return res.status(500).json({ message: 'Tag search failed' });
  }
});

router.get('/api/tags', async (req, res) => {
  try {
    const tags = await getAllTags();
    return res.status(200).json({ tags });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch tags' });
  }
});

// All activity routes require authentication
router.use(authenticateJWT);

// ==========================================
// IMAGE UPLOAD (NEW)
// ==========================================

/**
 * Upload an image to Cloudinary and return the URL.
 * Angular usage: FormData with 'file' field.
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Call our Cloudinary service
    // We pass the buffer directly from Multer
    const imageUrl = await uploadImage(req.file.buffer, 'user_content');

    return res.status(200).json({
      message: "Upload successful",
      url: imageUrl
    });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error.message);
    return res.status(500).json({ message: "Failed to upload image" });
  }
});


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
    console.error("Lookup error:", error.message);
    return res.status(500).json({ message: "User lookup failed" });
  }
});

// ==========================================
// 2. POST MANAGEMENT (CRUD)
// ==========================================

router.get('/myactivity/posts', async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const posts = await dbCrudOperator.userPosts(req.userId, page, limit);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch writer posts" });
  }
});

/**
 * Create a new post with support for initial co-editors.
 */
router.post('/myactivity/posts', async (req, res) => {
  try {
    const { editorUuids, title, description, isPublic, hashtags, isDraft } = req.body;

    // 1. Convert external UUIDs to internal ObjectIDs
    let editorIds = [];
    if (Array.isArray(editorUuids) && editorUuids.length > 0) {
      const editorUsers = await dbCrudOperator.findUserByUUid(editorUuids);
      editorIds = editorUsers.map(user => user._id);
    }

    // 2. Consolidate post data
    const postUuid = uuidv4();
    const postData = {
      uuid: postUuid,
      title,
      description,
      hashtags,
      isPublic,
      isDraft: isDraft || false,
      author: req.userId,
      authorName: req.userName,
      editors: editorIds,
      readTime: computeReadTime(description),
      createdAt: new Date(),
    };

    // Set slug and publishedAt if publishing immediately
    if (isPublic) {
      postData.slug = generateSlug(title, postUuid);
      postData.publishedAt = new Date();
    }

    const newPost = await dbCrudOperator.createPost(postData);
    await syncPostTags(hashtags);
    res.status(201).json(newPost);

  } catch (error) {
    console.error("Post Creation Failed:", error.message);
    res.status(400).json({ message: "Post creation failed", details: error.message });
  }
});

/**
 * Update existing post metadata. Validates ownership/editor rights via Operator.
 */
router.put('/myactivity/posts/:postuuid', async (req, res) => {
  try {
    const updates = { ...req.body };

    // Recompute readTime whenever description changes
    if (updates.description) {
      updates.readTime = computeReadTime(updates.description);
    }

    // Handle publish transition: set slug and publishedAt exactly once
    if (updates.isPublic === true) {
      const existing = await dbCrudOperator.userPostDetails(req.userId, req.params.postuuid);
      if (existing) {
        if (!existing.slug) {
          const titleForSlug = updates.title || existing.title;
          updates.slug = generateSlug(titleForSlug, existing.uuid);
        }
        if (!existing.publishedAt) {
          updates.publishedAt = new Date();
        }
      }
    }

    const updatedPost = await dbCrudOperator.updatePost(
      req.params.postuuid,
      req.userId,
      updates
    );
    if (!updatedPost) return res.status(404).json({ message: "Post not found or unauthorized" });
    if (updates.hashtags) await syncPostTags(updates.hashtags);
    res.json(updatedPost);
  } catch (error) {
    console.error("Update failed:", error.message);
    res.status(500).json({ message: "Update failed" });
  }
});

/**
 * Atomic delete of post and its related favorites/analytics.
 */
router.delete('/myactivity/posts/:postuuid', async (req, res) => {
  try {
    const result = await dbCrudOperator.deletePost(req.params.postuuid, req.userId);
    if (!result) return res.status(404).json({ message: "Delete failed: Unauthorized" });
    res.status(204).send();
  } catch (error) {
    console.error("Deletion failed:", error.message);
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
    console.error("Add editors failed:", error.message);
    res.status(500).json({ message: "Failed to add editors" });
  }
});

module.exports = router;