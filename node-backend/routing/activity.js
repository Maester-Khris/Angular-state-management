const router = require('express').Router();
const dbCrudOperator = require('../database/crud');
const { authenticateJWT } = require("../middleware/auth")
const { User } = require("../database/models/user");

router.use(authenticateJWT);

router.get('/users/lookup/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // We use the refined query from the operator
    const user = await dbCrudOperator.findAuthorByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return ONLY the uuid. The client uses this to populate the editorUuids array.
    return res.status(200).json({ 
      email: email.toLowerCase(),
      uuid: user.useruuid 
    });

  } catch (error) {
    console.error("Lookup error:", error);
    return res.status(500).json({ message: "Error during user lookup" });
  }
});

// 1. GET User's Newest Posts (Paginated)
router.get('/me/posts', async (req, res) => {
  try {
    const { cursor, limit } = req.query;
    const pageLimit = parseInt(limit) || 10;
    const activity = await dbCrudOperator.usernewestPost(req.userId, cursor, pageLimit);
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: "Error fetching activity" });
  }
});

// 2. CREATE Post
router.post('/posts', async (req, res) => {
  try {
    const { editorUuids, title, description, isPublic, hashtags } = req.body;
    console.log("editors uuids", editorUuids);
    let editorIds = [];
    // 1. Resolve UUIDs to ObjectIds correctly
    if (Array.isArray(editorUuids) && editorUuids.length > 0) {
      console.log("editors uuids exists");
      const editorUsers = await dbCrudOperator.findUserByUUid(editorUuids);
      editorIds = editorUsers.map(user => user._id);
      console.log("editor users",editorUsers);
    }
    console.log("editors ids", editorIds);
    // 2. Prepare the data for the Operator
    const postData = {
      title,
      description,
      hashtags,
      isPublic,
      author: req.userId,      // The internal _id from middleware
      authorName: req.userName, // The name from middleware
      editors: editorIds       // The internal _ids we just found
    };
    console.log(postData);

    const newPost = await dbCrudOperator.createPost(postData);
    res.status(201).json(newPost);

  } catch (error) {
    console.error("Post Creation Failed:", error);
    res.status(400).json({ 
      message: "Validation error", 
      details: error.message 
    });
  }
});

// 3. UPDATE Post
router.put('/posts/:postuuid', async (req, res) => {
  try {
    const updatedPost = await dbCrudOperator.updatePost(
      req.params.postuuid,
      req.userId, // Ownership check
      req.body
    );
    if (!updatedPost) return res.status(404).json({ message: "Post not found or unauthorized" });
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
});

router.post('/posts/:uuid/editors', async (req, res) => {
  try {
    const { editorUuids } = req.body; // Array of UUID strings from client
    const postUuid = req.params.uuid;

    if (!Array.isArray(editorUuids) || editorUuids.length === 0) {
      return res.status(400).json({ message: "No editors provided" });
    }

    const users = await dbCrudOperator.findUserByUUid(editorUuids);
    if (users.length === 0) 
      return res.status(404).json({ message: "No valid users found to add as editors" });
    
    const editorObjectIds = users.map(u => u._id);
    const updatedPost = await dbCrudOperator.addEditorsToPost(
      postUuid, 
      editorObjectIds,
      req.userId, // From authMiddleware (The Owner)
    );

    if (!updatedPost) {
      return res.status(403).json({ message: "Unauthorized or Post not found" });
    }

    res.json({ 
      message: `Successfully added ${editorObjectIds.length} editors`,
      post: updatedPost 
    });

  } catch (error) {
    console.error("Add Editors Error:", error);
    res.status(500).json({ message: "Server error while adding editors" });
  }
});

// 4. DELETE Post
router.delete('/posts/:postuuid', async (req, res) => {
  try {
    const result = await dbCrudOperator.deletePost(req.params.postuuid, req.userId);
    if (!result) return res.status(404).json({ message: "Delete failed: Unauthorized" });
    res.status(204).send(); // Success, no content
  } catch (error) {
    res.status(500).json({ message: "Server error" , error: error});
  }
});

module.exports = router;

