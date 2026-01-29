const crypto = require("crypto");

const generateRandomString = (length) => {
  return crypto.randomBytes(length).toString("hex");
};

const generateResourceUUID = (length = 5) => {
  //return crypto.randomBytes(5).toString("hex");
  return crypto.randomUUID();
};

module.exports = { generateRandomString, generateResourceUUID };
