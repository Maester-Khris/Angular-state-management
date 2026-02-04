require("dotenv").config({ path: "../../.env" });

const mongoose = require('mongoose');
const User = require('../models/user');
const Post = require('../models/post');
const Favorite = require('../models/favorites');

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const { usersBase, postTemplates } = require('./data');
const connectionURL = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/${process.env.MONGO_DATABASE}?appName=Cluster0`


async function runSeeder() {
  try {
    await mongoose.connect(connectionURL);
    
    // Clear existing
    await User.deleteMany({});
    await Post.deleteMany({});
    await Favorite.deleteMany({});
    console.log("Emptying database...");

    const hashedPassword = await bcrypt.hash('password123', 10);

    // --- PHASE 1: Users ---
    const userDocs = await User.insertMany(usersBase.map(u => ({
      ...u,
      useruuid: uuidv4(),
      password: hashedPassword,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`,
      status: 'active'
    })));

    console.log(`✅ Seeded ${userDocs.length} Users`);

    // --- PHASE 2: Posts ---
    const postData = [];
    for (let i = 0; i < 50; i++) {
      const author = userDocs[Math.floor(Math.random() * userDocs.length)];
      const template = postTemplates[i % postTemplates.length];
      const dateOffset = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
      const createdAt = new Date(Date.now() - dateOffset);

      postData.push({
        uuid: uuidv4(),
        title: `${template.title} #${i}`,
        description: template.description,
        // INTERNAL LINK (The Engine)
        author: author._id, 
        // DENORMALIZATION (The Speed)
        authorName: author.name,
        authorAvatar: author.avatarUrl,
        isPublic: true,
        hashtags: ['tech', 'engineering'],
        createdAt: createdAt,
        lastEditedAt: createdAt
      });
    }

    const seededPosts = await Post.insertMany(postData);
    console.log(`✅ Seeded ${seededPosts.length} Posts`);

    // --- PHASE 3: Favorites (The Intersection) ---
    const favoriteData = [];
    // Every user likes ~5 random posts
    for (const user of userDocs) {
      const shuffled = seededPosts.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 5);

      selected.forEach(p => {
        favoriteData.push({
          user: user._id,
          post: p._id,
          createdAt: new Date()
        });
      });
    }

    await Favorite.insertMany(favoriteData);
    console.log(`✅ Seeded ${favoriteData.length} Favorites`);

    console.log(`Success: ${users.length} Users and ${posts.length} Posts seeded.`);
    process.exit();
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

// Only run when executed directly (avoid running on require/import)
if (require.main === module) {
  runSeeder();
}
// console.log(connectionURL)