const {
  hashPassword,
  verifyPassword,
  generateJWTToken,
  decodeToken,
} = require("./authUtils");
const dbCrudOperator = require("../database/crud");
const TokenBlacklist = require("../database/models/blacklist");

const transformToProfile = (user) => ({
  uuid: user.useruuid,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  status: user.status
});

const login = async ({ email, password }) => {

  const user = await dbCrudOperator.findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials." });
  }
  console.log(user);

  const accessToken = generateJWTToken({ id: user._id, name: user.name });
  const refreshToken = generateJWTToken({ id: user._id });

  return {
    userProfile: transformToProfile(user),
    accessToken: accessToken,
    refreshToken: refreshToken
  };
};

const signup = async ({ name, email, password }) => {

  userExists = await dbCrudOperator.checkUserExistsbyEmail(email);
  if (userExists) 
    return null;
  
  const hashedPassword = await hashPassword(password);
  const user = await dbCrudOperator.createUser({
    name,
    email,
    password: hashedPassword
  });
  return user;
};

const revokateToken = async (token) => {
  const decodedToken = decodeToken(token);
  if (!decodedToken || !decodedToken.exp) {
    return false;
  }

  const expiresAt = new Date(decodedToken.exp * 1000);
  await dbCrudOperator.addTokenToBlacklist(token, expiresAt);
  return true;
};

module.exports = { login, signup, revokateToken };
