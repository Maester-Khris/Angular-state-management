const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

async function generateSeedData(usersBase, postTemplates) {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // 1. Create Users
  const users = usersBase.map(u => ({
    ...u,
    useruuid: uuidv4(),
    password: hashedPassword,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`,
    status: 'active'
  }));

  // 2. Create 50 Posts with time variation
  const posts = [];
  for (let i = 0; i < 50; i++) {
    const author = users[Math.floor(Math.random() * users.length)];
    const template = postTemplates[i % postTemplates.length];
    
    // Variation: Some posts are months old, some are minutes old
    const dateOffset = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000); 
    const createdAt = new Date(Date.now() - dateOffset);

    posts.push({
      uuid: uuidv4(),
      title: `${template.title} #${i}`,
      description: template.description,
      authorid: author.useruuid,
      creator: author.name,
      isPublic: true,
      createdAt: createdAt,
      lastEditedAt: createdAt,
      hashtag: ['tech', 'engineering']
    });
  }

  return { users, posts };
}

module.exports = { generateSeedData };