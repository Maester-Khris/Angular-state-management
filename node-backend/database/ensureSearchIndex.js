// One-time/idempotent ops script: creates the Atlas Search index searchPostsByKeyword's
// fuzzy fallback (crud.js) expects. Safe to re-run -- no-ops if the index already exists.
// Mirrors data-utils/eval/lexical_mongo.py's ensure_search_index for the eval database.
// Usage: doppler run -- node database/ensureSearchIndex.js
const mongoose = require('mongoose');

const INDEX_NAME = 'posts_lexical_search';

async function ensureSearchIndex() {
  const MONGO_URI = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/${process.env.MONGO_DATABASE}?appName=Cluster0`;
  await mongoose.connect(MONGO_URI);
  const collection = mongoose.connection.collection('posts');

  const existing = await collection.listSearchIndexes().toArray();
  if (existing.some((ix) => ix.name === INDEX_NAME)) {
    console.log(`Search index '${INDEX_NAME}' already exists.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Creating Atlas Search index '${INDEX_NAME}'...`);
  await collection.createSearchIndex({
    name: INDEX_NAME,
    definition: { mappings: { dynamic: true } },
  });

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const indexes = await collection.listSearchIndexes(INDEX_NAME).toArray();
    if (indexes.length && indexes[0].queryable) {
      console.log('Index ready.');
      await mongoose.disconnect();
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  await mongoose.disconnect();
  throw new Error(`Search index '${INDEX_NAME}' did not become queryable within 120s.`);
}

ensureSearchIndex().catch((e) => {
  console.error(e);
  process.exit(1);
});
