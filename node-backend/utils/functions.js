const crypto = require("crypto");

const generateRandomString = (length) => {
  return crypto.randomBytes(length).toString("hex");
};

const generateResourceUUID = (length = 5) => {
  //return crypto.randomBytes(5).toString("hex");
  return crypto.randomUUID();
};

const generateSlug = (title, post_uuid) => {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Append short uuid suffix to guarantee uniqueness without a lookup
  const slug = `${baseSlug}-${post_uuid.slice(0, 8)}`;
  return slug;
}

const computeReadTime = (text) => {
  if (!text || typeof text !== 'string') return 1;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
};

module.exports = { generateRandomString, generateResourceUUID, generateSlug, computeReadTime };
