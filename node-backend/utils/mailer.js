const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER, // Usually your email
    pass: process.env.BREVO_PASS  // Your Brevo SMTP Key
  }
});

const SEND_RETRY_ATTEMPTS = parseInt(process.env.SEND_RETRY_ATTEMPTS || '3', 10);
const SEND_RETRY_BASE_MS = parseInt(process.env.SEND_RETRY_BASE_MS || '500', 10);

const sendOtpEmail = async (to, otp) => {
  const mailOptions = {
    from: '"PostAir Auth" <ndevjoel@gmail.com>',
    to: to,
    subject: 'Your PostAir Verification Code',
    text: `Your OTP is: ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`,
    html: `<b>Your OTP is: ${otp}</b><p>It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>`
  };

  return transporter.sendMail(mailOptions);
};

// sendWithRetries: exponential backoff around sendOtpEmail
const sendWithRetries = async (to, otp) => {
  const attempts = SEND_RETRY_ATTEMPTS;
  const baseMs = SEND_RETRY_BASE_MS;
  let attempt = 0;
  let lastErr;

  while (attempt < attempts) {
    try {
      await sendOtpEmail(to, otp);
      return; // success
    } catch (err) {
      attempt++;
      lastErr = err;
      console.error(`sendOtpEmail attempt ${attempt} failed for ${to}:`, err && err.message ? err.message : err);
      if (attempt >= attempts) break;
      const waitMs = baseMs * Math.pow(2, attempt - 1);
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }

  throw lastErr || new Error('Failed to send OTP email');
};

module.exports = { sendOtpEmail, sendWithRetries };

