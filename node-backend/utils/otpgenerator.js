const crypto = require('crypto');

/**
 * Generates a secure 6-digit numeric OTP
 *   // Using crypto for better randomness than Math.random()
 */
const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

module.exports = { generateOtp };