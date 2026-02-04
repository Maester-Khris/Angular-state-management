// services/auth.service.js
const {
  hashPassword,
  verifyPassword,
  generateJWTToken,
  decodeToken,
} = require("./authUtils");

const { generateOtp } = require("../utils/otpgenerator");

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10);
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.RESEND_COOLDOWN_SECONDS || "60", 10);
const MAX_RESENDS_PER_DAY = parseInt(process.env.MAX_RESENDS_PER_DAY || "5", 10);

/* ---------------- helpers ---------------- */

const transformToProfile = (user) => ({
  uuid: user.useruuid,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  status: user.status
});

/* ---------------- auth core ---------------- */

const signupUser = async ({ name, email, password }, deps) => {
  const { db, mailer } = deps;

  const exists = await db.checkUserExistsByEmail(email);
  if (exists) {
    return { ok: false, reason: "USER_EXISTS" };
  }

  const hashedPassword = await hashPassword(password);
  const user = await db.createUser({
    name,
    email: email.toLowerCase(),
    password: hashedPassword
  });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const otpRecord = await db.createOtp({
    email: user.email,
    otp,
    createdAt: new Date(),
    expiresAt
  });

  try {
    await mailer.sendWithRetries(user.email, otp);
  } catch (err) {
    await db.deleteOtpById(otpRecord._id);
    return { ok: false, reason: "EMAIL_FAILED" };
  }

  return { ok: true, email: user.email };
};

const verifyOtp = async ({ email, otp }, deps) => {
  const { db } = deps;

  const record = await db.findValidOtp(email, otp);
  if (!record) {
    return { ok: false, reason: "INVALID_OTP" };
  }

  await db.markUserVerifiedByEmail(email);
  await db.deleteOtpsByEmail(email);

  return { ok: true };
};

const resendOtp = async ({ email }, deps) => {
  const { db, mailer } = deps;

  const user = await db.findUserByEmail(email);
  if (!user) return { ok: false, reason: "NOT_FOUND" };
  if (user.isVerified) return { ok: false, reason: "ALREADY_VERIFIED" };

  const recent = await db.findLatestOtpByEmail(email);
  if (
    recent &&
    Date.now() - new Date(recent.createdAt) < RESEND_COOLDOWN_SECONDS * 1000
  ) {
    return { ok: false, reason: "COOLDOWN" };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentToday = await db.countOtpsSince(email, since);
  if (sentToday >= MAX_RESENDS_PER_DAY) {
    return { ok: false, reason: "DAILY_LIMIT" };
  }

  await db.deleteOtpsByEmail(email);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const record = await db.createOtp({ email, otp, createdAt: new Date(), expiresAt });

  try {
    await mailer.sendWithRetries(email, otp);
  } catch {
    await db.deleteOtpById(record._id);
    return { ok: false, reason: "EMAIL_FAILED" };
  }

  return { ok: true };
};

const loginUser = async ({ email, password }, deps) => {
  const { db } = deps;

  const user = await db.findUserByEmail(email);
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  return {
    userProfile: transformToProfile(user),
    accessToken: generateJWTToken({ id: user._id, name: user.name }),
    refreshToken: generateJWTToken({ id: user._id })
  };
};

const revokeToken = async (token, deps) => {
  const { db } = deps;

  const decoded = decodeToken(token);
  if (!decoded?.exp) return false;

  await db.addTokenToBlacklist(token, new Date(decoded.exp * 1000));
  return true;
};

module.exports = {
  signupUser,
  verifyOtp,
  resendOtp,
  loginUser,
  revokeToken
};
