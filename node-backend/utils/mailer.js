const mailService = require('../services/mailService');

/**
 * Legacy wrapper for MailService to maintain compatibility while transitioning to the queue system.
 */
module.exports = {
  sendOtpEmail: async (to, otp) => {
    console.warn('sendOtpEmail is deprecated. Use MailService.enqueueOtpEmail instead.');
    return await mailService.transporter.sendMail({
      from: `"${mailService.constructor.SENDER_NAME}" <${mailService.constructor.SENDER_EMAIL}>`,
      to,
      subject: 'Your PostAir Verification Code',
      text: `Your OTP is: ${otp}`,
      html: `<b>Your OTP is: ${otp}</b>`
    });
  },
  sendWithRetries: async (to, otp) => {
    console.warn('sendWithRetries is deprecated. Enqueuing for background processing instead.');
    return await mailService.enqueueOtpEmail(to, otp);
  }
};
