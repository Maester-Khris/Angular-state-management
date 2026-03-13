const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const saltRounds = 10;

const hashPassword = async (password) => {
  try {
    const hashedPass = await bcrypt.hash(password, saltRounds);
    return hashedPass;
  } catch (error) {
    console.error("Error hashing password:", error);
  }
};

const verifyPassword = async (plain, hashPassword) => {
  try {
    const passwordMatch = await bcrypt.compare(plain, hashPassword);
    return passwordMatch;
  } catch (error) {
    console.error("Error verifying password:", error);
  }
};

const generateJWTToken = (userpayload) => {
  const access_token = jwt.sign(
    userpayload,
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return access_token;
};

const decodeToken = (token) => {
  const decoded = jwt.decode(token);
  return decoded;
};

const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateJWTToken,
  decodeToken,
  verifyGoogleToken,
};
