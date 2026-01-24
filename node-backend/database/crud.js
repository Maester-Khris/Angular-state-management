const mongoose = require("mongoose");
const Post = require('./models/post');
const User = require("./models/user");
const TokenBlacklist = require("./models/blacklist");

const dbCrudOperator = {
  
  // --- USER OPERATIONS ---

  /**
   * Check if email exists using index-only scan for performance
   */
  async checkUserExistsbyEmail(email) {
    // .exists() is faster than findOne as it returns only the _id
    return await User.exists({ email: email.toLowerCase() });
  },

  /**
   * Find user by email for authentication (includes password)
   */
  async findUserByEmail(email) {
    return await User.findOne({ email: email.toLowerCase() })
      .select('+password') // Explicitly pull password for auth service
      .lean(); 
  },

  async findAuthorByEmail(email) {
    return await User.findOne({ email: email.toLowerCase() })
      .select('useruuid email') // Explicitly pull password for auth service
      .lean(); 
  },

  async getUserProfile(userId) {
    return await User.findById(userId).select('name useruuid createdAt bio avatarUrl').lean();
  },
  
  async createUser(userData) {
    const user = new User(userData);
    return await user.save();
  },

  // --- Feed OPERATIONS ---
  async getHomeFeed(lastId = null, limit = 10) {
    // 1. Construct query using native _id for maximum performance
    const query = lastId ? { _id: { $lt: lastId } } : {};

    // 2. Fetch one extra item to check if 'hasMore' is true
    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1) 
      .select('title description creator lastEditedAt images uuid')
      .lean();

    const hasMore = posts.length > limit;
    const rawData = hasMore ? posts.slice(0, limit) : posts;
    const data = rawData.map(post => {
      return {
        ...post,
        cursorId: post._id.toString(), // Map _id to cursorId for the frontend
        id: post.uuid,                 // Map uuid to a friendly 'id' field
        _id: undefined,                // Explicitly remove internal db fields
        __v: undefined
      };
    });
    
    // 3. Define the next cursor from the last item in the current batch
    const nextCursor = data.length > 0 ? data[data.length - 1].cursorId: null;
    console.log(nextCursor);  
    return {
      data,
      pagination: {
        nextCursor,
        hasMore
      }
    };
  },

  async searchPostsByKeyword (term, limit = 10){
    try {
      return await Post.find(
        { $text: { $search: term } },
        { score: { $meta: "textScore" } } // Project the score
      )
      .sort({ score: { $meta: "textScore" } }) // Sort by relevance first
      .limit(limit)
      .lean(); // Returns plain objects, significantly faster
    } catch (error) {
      console.error("Mongo Keyword Search Error:", error);
      throw error;
    }
  },

  // --- POST OPERATIONS ---

  /**
   * Complex query: Find posts where user is author OR editor
   * Optimized with .lean() and specific field selection for the Home Feed
   */
  async userPosts(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    return await Post.find({
      $or: [
        { author: userId },
        { editorids: userId }
      ]
    })
    .select('title description images creator createdAt lastEditedAt isPublic uuid')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  },

  /**
   * Secure details lookup: Ensures user has permission to view the specific post
   */
  async userPostDetails(userId, postUuid) {
    return await Post.findOne({
      uuid: postUuid,
      $or: [
        { author: userId },
        { editorids: userId },
        { isPublic: true } // Allow viewing if public even if not author/editor
      ]
    })
    .lean();
  },

  async createPost(data) {
    try {
      const post = new Post(data);
      return await post.save();
    } catch (error) {
      // Log the actual validation details for debugging
      console.error("Mongoose Validation Error:", error);
      throw error; 
    }
  },

  /**
   * Recent activity for Dashboard: Focused on updates
   */
  async usernewestPost(authorId, page = 1, limit = 5) {
    const skip = (page - 1) * limit;
    return await Post.find({ author: authorId })
      .sort({ lastEditedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title lastEditedAt isPublic uuid')
      .lean();
  },

  /**
   * Use $addToSet to prevent duplicate editor entries (Atomic)
   */
  async addEditorsToPost(postUuid, editorObjectIds, authorId) {
    return await Post.findOneAndUpdate(
      { uuid: postUuid },
      {$or: [
        { author: authorId }
      ]},
      { $addToSet: { editors: { $each: editorObjectIds } } },
      { new: true, runValidators: true }
    ).lean();
  },

  async findUserByUUid(editorUuids) {
    return await User.find({ 
      useruuid: { $in: editorUuids } 
    })
    .select('_id')
    .lean();
  },

  /**
   * Secure update: Validate that the requester is the author or an editor
   */
  async updatePost(postUuid, authorId, updates) {
    // Ensure lastEditedAt is always updated on change
   const { author, uuid, _id, ...safeUpdates } = updates;

    return await Post.findOneAndUpdate(
      { 
        uuid: postUuid, 
        $or: [{ author: authorId }, { editorids: authorId }] 
      },
      { $set: safeUpdates },
      { new: true }
    ).lean();
  },

  /**
   * Secure delete: Only the original author can delete a post
   */
  async deletePost(postUuid, authorId) {
    // return await Post.findOneAndDelete({
    //   uuid: postUuid,
    //   author: new mongoose.Types.ObjectId(authorId) // Restriction: editors cannot delete
    // });

    // 1. Find the post first to ensure ownership and get the internal _id
    const post = await Post.findOne({ uuid: postUuid, author: userId });
    if (!post) return null;

    const postId = post._id;

    // 2. Perform deletions in parallel for performance
    await Promise.all([
      Post.deleteOne({ _id: postId }),
      Favorite.deleteMany({ post: postId }),
      PostAnalytics.deleteMany({ "metadata.postId": postId }) // Optimization: Also clean up analytics if you want to be strictly lean
    ]);

    return true;
  },

  async addTokenToBlacklist(token, expiresAt) {
      return TokenBlacklist.create({
        token,
        expiresAt,
      });
    }
};

module.exports = dbCrudOperator;