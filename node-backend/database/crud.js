const mongoose = require("mongoose");
const Post = require('./models/post');
const User = require("./models/user");
const Favorite = require("./models/favorites");
const TokenBlacklist = require("./models/blacklist");
const Otp = require("./models/userotp"); // added
const Newsletter = require("./models/newsletter");

const dbCrudOperator = {

  // ==========================================
  // 1. IDENTITY & AUTH (Internal/Admin)
  // ==========================================

  async checkUserExistsByEmail(email) {
    return await User.exists({ email: email.toLowerCase() });
  },

  async findUserByEmail(email) {
    return await User.findOne({ email: email.toLowerCase() })
      .select('+password') // Internal auth use only
      .lean();
  },

  async findUserByUUid(editorUuids) {
    return await User.find({ useruuid: { $in: editorUuids } })
      .select('_id')
      .lean();
  },

  async createUser(userData) {
    const user = new User(userData);
    return await user.save();
  },

  async addTokenToBlacklist(token, expiresAt) {
    return TokenBlacklist.create({ token, expiresAt });
  },

  // ==========================================
  // 2. PROFILE & DATA AGGREGATION (BFF Support)
  // ==========================================

  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId)
        .select('name useruuid createdAt bio avatarUrl')
        .lean();
      return user || {};
    } catch (e) { return {}; }
  },

  async getUserDrafts(userId, limit = 10) {
    try {
      return await Post.find({
        $or: [{ author: userId }, { editors: userId }],
        isDraft: true
      })
      .sort({ lastEditedAt: -1 })
      .limit(limit)
      .lean() || [];
    } catch (e) { return []; }
  },

  async getUserFavorites(userId, limit = 5) {
    try {
      const docs = await Favorite.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({
            path: 'post',
            select: 'title description uuid lastEditedAt authorName'
        })
        .lean();

      return (docs || [])
        .filter(f => f.post)
        .map(f => ({ ...f.post, savedAt: f.createdAt }));
    } catch (e) { return []; }
  },

  // ==========================================
  // 3. DISCOVERY (Feed & Search)
  // ==========================================

  async getHomeFeed(lastId = null, limit = 10, skip = 0) {
    const query = { 
      isPublic: true, 
      isDraft: { $ne: true } 
    };

    if (lastId) {
      query._id = { $lt: lastId };
    }

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .skip(parseInt(skip) || 0)
      .limit(limit + 1) 
      .select('title description authorName lastEditedAt images uuid')
      .lean();

    const hasMore = posts.length > limit;
    const rawData = hasMore ? posts.slice(0, limit) : posts;
    
    const data = rawData.map(post => ({
        ...post,
        cursorId: post._id.toString(),
        id: post.uuid,
        _id: undefined,
        __v: undefined
    }));
    
    return {
      data,
      pagination: { nextCursor: data.length > 0 ? data[data.length - 1].cursorId : null, hasMore }
    };
  },

  async getPublicPostByTitle(title) {
    return await Post.findOne({ title, isPublic: true, isDraft: { $ne: true } }).lean();
  },

  async getPublicPostByUuid(uuid) {
    return await Post.findOne({ uuid, isPublic: true, isDraft: { $ne: true } }).lean();
  },

  async searchPostsByKeyword(term, limit = 10) {
    try {
      return await Post.find(
        { $text: { $search: term }, isPublic: true, isDraft: { $ne: true } },
        { score: { $meta: "textScore" } }
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();
    } catch (e) { throw e; }
  },

  // ==========================================
  // 4. POST MANAGEMENT (Write/Update/Delete)
  // ==========================================

  async createPost(data) {
    const post = new Post(data);
    return await post.save();
  },

  async findAuthorByEmail(email) {
    return await User.findOne({ email: email.toLowerCase() })
      .select('useruuid email') // Explicitly pull password for auth service
      .lean(); 
  },

  async updatePost(postUuid, userId, updates) {
    // Prevent sensitive fields from being updated via this method
    const { author, uuid, _id, ...safeUpdates } = updates;

    return await Post.findOneAndUpdate(
      { 
        uuid: postUuid, 
        $or: [{ author: userId }, { editors: userId }] 
      },
      { $set: safeUpdates },
      { new: true }
    ).lean();
  },

  async deletePost(postUuid, userId) {
    // Ensure only the original author can trigger the cascade delete
    const post = await Post.findOne({ uuid: postUuid, author: userId });
    if (!post) return null;

    const postId = post._id;

    await Promise.all([
      Post.deleteOne({ _id: postId }),
      Favorite.deleteMany({ post: postId })
      // Add PostAnalytics.deleteMany here when ready
    ]);

    return true;
  },

  async addEditorsToPost(postUuid, editorObjectIds, authorId) {
    return await Post.findOneAndUpdate(
      { uuid: postUuid, author: authorId },
      { $addToSet: { editors: { $each: editorObjectIds } } },
      { new: true, runValidators: true }
    ).lean();
  },

  // ==========================================
  // 5. ACTIVITY (Dashboard Views)
  // ==========================================

  async userPosts(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return await Post.find({
      $or: [{ author: userId }, { editors: userId }]
    })
    .select('title description images creator createdAt lastEditedAt isPublic uuid')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  },

  async userPostDetails(userId, postUuid) {
    return await Post.findOne({
      uuid: postUuid,
      $or: [
        { author: userId },
        { editors: userId },
        { isPublic: true }
      ]
    }).lean();
  },

  // ==========================================
  // OTP helpers (for auth flows)
  // ==========================================
  async createOtp({ email, otp, createdAt, expiresAt }) {
    return await Otp.create({ email, otp, createdAt, expiresAt });
  },

  async deleteOtpById(id) {
    return await Otp.deleteOne({ _id: id });
  },

  async findValidOtp(email, otp) {
    const now = new Date();
    return await Otp.findOne({ email, otp, expiresAt: { $gt: now } }).lean();
  },

  async findLatestOtpByEmail(email) {
    return await Otp.findOne({ email }).sort({ createdAt: -1 }).lean();
  },

  async countOtpsSince(email, sinceDate) {
    return await Otp.countDocuments({ email, createdAt: { $gte: sinceDate } });
  },

  async deleteOtpsByEmail(email) {
    return await Otp.deleteMany({ email });
  },

  async markUserVerifiedByEmail(email) {
    return await User.findOneAndUpdate({ email }, { isVerified: true });
  },

  async subscribeNewsletter(email) {
    return await Newsletter.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $setOnInsert: { email: email.toLowerCase(), createdAt: new Date() } },
      { upsert: true, new: true, lean: true }
    );
  },
};

module.exports = dbCrudOperator;






// const mongoose = require("mongoose");
// const Post = require('./models/post');
// const User = require("./models/user");
// const Favorite = require("./models/favorites");
// const TokenBlacklist = require("./models/blacklist");

// const dbCrudOperator = {
  
//   // --- USER OPERATIONS ---

//   /**
//    * Check if email exists using index-only scan for performance
//    */
//   async checkUserExistsbyEmail(email) {
//     // .exists() is faster than findOne as it returns only the _id
//     return await User.exists({ email: email.toLowerCase() });
//   },

//   /**
//    * Find user by email for authentication (includes password)
//    */
//   async findUserByEmail(email) {
//     return await User.findOne({ email: email.toLowerCase() })
//       .select('+password') // Explicitly pull password for auth service
//       .lean(); 
//   },

//   async findAuthorByEmail(email) {
//     return await User.findOne({ email: email.toLowerCase() })
//       .select('useruuid email') // Explicitly pull password for auth service
//       .lean(); 
//   },

//   async getUserProfile(userId) {
//    try {
//      const user = await User.findById(userId).select('name useruuid createdAt bio avatarUrl').lean();
//      return user || {};
//    } catch (error) {
//     return {};
//    }
//   },

//   async getUserDrafts(userId, limit = 10) {
//     try {
//       return await Post.find({
//         $or: [
//           { author: userId },
//           { editors: userId } // Expanded scope for co-editing
//         ],
//         isDraft: true
//       })
//       .sort({ lastEditedAt: -1 })
//       .limit(limit)
//       .lean() || [];
//     } catch (e) {
//       return [];
//     }
//   },

//   async getUserFavorites(userId){
//    try {
//      const docs = await Favorite.find({ user: userId })
//        .sort({ createdAt: -1 })
//        .limit(limit)
//        .populate({
//            path: 'post',
//            select: 'title description uuid lastEditedAt authorName' // Only pull what the UI needs
//        })
//        .lean();
 
//        return (docs || [])
//        .filter(f => f.post)
//        .map(f => ({ ...f.post, savedAt: f.createdAt }));
//    } catch (error) {
//     return [];
//    }
//   },
  
//   async createUser(userData) {
//     const user = new User(userData);
//     return await user.save();
//   },

//   // --- Feed OPERATIONS ---
//   async getHomeFeed(lastId = null, limit = 10) {
//     // 1. Construct query using native _id for maximum performance
//     const query = lastId ? { _id: { $lt: lastId } } : {};

//     // 2. Fetch one extra item to check if 'hasMore' is true
//     const posts = await Post.find(query)
//       .sort({ _id: -1 })
//       .limit(limit + 1) 
//       .select('title description creator lastEditedAt images uuid')
//       .lean();

//     const hasMore = posts.length > limit;
//     const rawData = hasMore ? posts.slice(0, limit) : posts;
//     const data = rawData.map(post => {
//       return {
//         ...post,
//         cursorId: post._id.toString(), // Map _id to cursorId for the frontend
//         id: post.uuid,                 // Map uuid to a friendly 'id' field
//         _id: undefined,                // Explicitly remove internal db fields
//         __v: undefined
//       };
//     });
    
//     // 3. Define the next cursor from the last item in the current batch
//     const nextCursor = data.length > 0 ? data[data.length - 1].cursorId: null;
//     console.log(nextCursor);  
//     return {
//       data,
//       pagination: {
//         nextCursor,
//         hasMore
//       }
//     };
//   },


//   async searchPostsByKeyword (term, limit = 10){
//     try {
//       return await Post.find(
//         { $text: { $search: term } },
//         { score: { $meta: "textScore" } } // Project the score
//       )
//       .sort({ score: { $meta: "textScore" } }) // Sort by relevance first
//       .limit(limit)
//       .lean(); // Returns plain objects, significantly faster
//     } catch (error) {
//       console.error("Mongo Keyword Search Error:", error);
//       throw error;
//     }
//   },

//   // --- POST OPERATIONS ---

//   /**
//    * Complex query: Find posts where user is author OR editor
//    * Optimized with .lean() and specific field selection for the Home Feed
//    */
//   async userPosts(userId, page = 1, limit = 10) {
//     const skip = (page - 1) * limit;
    
//     return await Post.find({
//       $or: [
//         { author: userId },
//         { editorids: userId }
//       ]
//     })
//     .select('title description images creator createdAt lastEditedAt isPublic uuid')
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(limit)
//     .lean();
//   },

//   /**
//    * Secure details lookup: Ensures user has permission to view the specific post
//    */
//   async userPostDetails(userId, postUuid) {
//     return await Post.findOne({
//       uuid: postUuid,
//       $or: [
//         { author: userId },
//         { editorids: userId },
//         { isPublic: true } // Allow viewing if public even if not author/editor
//       ]
//     })
//     .lean();
//   },

//   async createPost(data) {
//     try {
//       const post = new Post(data);
//       return await post.save();
//     } catch (error) {
//       // Log the actual validation details for debugging
//       console.error("Mongoose Validation Error:", error);
//       throw error; 
//     }
//   },

//   /**
//    * Recent activity for Dashboard: Focused on updates
//    */
//   async usernewestPost(authorId, page = 1, limit = 5) {
//     const skip = (page - 1) * limit;
//     return await Post.find({ author: authorId })
//       .sort({ lastEditedAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .select('title lastEditedAt isPublic uuid')
//       .lean();
//   },

//   /**
//    * Use $addToSet to prevent duplicate editor entries (Atomic)
//    */
//   async addEditorsToPost(postUuid, editorObjectIds, authorId) {
//     return await Post.findOneAndUpdate(
//       { uuid: postUuid },
//       {$or: [
//         { author: authorId }
//       ]},
//       { $addToSet: { editors: { $each: editorObjectIds } } },
//       { new: true, runValidators: true }
//     ).lean();
//   },

//   async findUserByUUid(editorUuids) {
//     return await User.find({ 
//       useruuid: { $in: editorUuids } 
//     })
//     .select('_id')
//     .lean();
//   },

//   /**
//    * Secure update: Validate that the requester is the author or an editor
//    */
//   async updatePost(postUuid, authorId, updates) {
//     // Ensure lastEditedAt is always updated on change
//    const { author, uuid, _id, ...safeUpdates } = updates;

//     return await Post.findOneAndUpdate(
//       { 
//         uuid: postUuid, 
//         $or: [{ author: authorId }, { editorids: authorId }] 
//       },
//       { $set: safeUpdates },
//       { new: true }
//     ).lean();
//   },

//   /**
//    * Secure delete: Only the original author can delete a post
//    */
//   async deletePost(postUuid, authorId) {
//     // return await Post.findOneAndDelete({
//     //   uuid: postUuid,
//     //   author: new mongoose.Types.ObjectId(authorId) // Restriction: editors cannot delete
//     // });

//     // 1. Find the post first to ensure ownership and get the internal _id
//     const post = await Post.findOne({ uuid: postUuid, author: userId });
//     if (!post) return null;

//     const postId = post._id;

//     // 2. Perform deletions in parallel for performance
//     await Promise.all([
//       Post.deleteOne({ _id: postId }),
//       Favorite.deleteMany({ post: postId }),
//       PostAnalytics.deleteMany({ "metadata.postId": postId }) // Optimization: Also clean up analytics if you want to be strictly lean
//     ]);

//     return true;
//   },

//   async addTokenToBlacklist(token, expiresAt) {
//       return TokenBlacklist.create({
//         token,
//         expiresAt,
//       });
//     }
// };

// module.exports = dbCrudOperator;