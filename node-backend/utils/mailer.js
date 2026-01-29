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

const sendOtpEmail = async (to, otp) => {
  const mailOptions = {
    from: '"PostAir Auth" <ndevjoel@gmail.com>',
    to: to,
    subject: 'Your PostAir Verification Code',
    text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
    html: `<b>Your OTP is: ${otp}</b><p>It expires in 10 minutes.</p>`
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };