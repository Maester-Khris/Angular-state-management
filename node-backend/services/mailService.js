const nodemailer = require('nodemailer');
const queueService = require('./queueService');

class MailService {
    static SENDER_EMAIL = 'ndevjoel@gmail.com';
    static SENDER_NAME = 'PostAir Auth';

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.BREVO_USER,
                pass: process.env.BREVO_PASS
            }
        });
        this.MAILING_QUEUE = 'mailing-queue';
    }

    /**
     * Enqueue an OTP email job
     * @param {string} to - Recipient email
     * @param {string} otp - One-time password
     */
    async enqueueOtpEmail(to, otp) {
        return await queueService.addJob(this.MAILING_QUEUE, 'send-otp', { to, otp });
    }

    /**
     * Process the mailing job
     * @param {object} job - BullMQ job object
     */
    async processEmail(job) {
        const { to, otp } = job.data;
        console.log(`Processing email job ${job.id} for ${to}...`);

        const mailOptions = {
            from: `"${MailService.SENDER_NAME}" <${MailService.SENDER_EMAIL}>`,
            to: to,
            subject: 'Your PostAir Verification Code',
            text: `Your OTP is: ${otp}. It expires in ${process.env.NODE_OTP_EXPIRY_MINUTES || 10} minutes.`,
            html: `<b>Your OTP is: ${otp}</b><p>It expires in ${process.env.NODE_OTP_EXPIRY_MINUTES || 10} minutes.</p>`
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Successfully sent OTP email to ${to}`);
        } catch (error) {
            console.error(`Failed to send email to ${to}:`, error);
            throw error; // Let BullMQ handle retries
        }
    }

    /**
     * Initialize the worker for mailing
     */
    initWorker() {
        queueService.createWorker(this.MAILING_QUEUE, async (job) => {
            if (job.name === 'send-otp') {
                await this.processEmail(job);
            }
        });
        console.log('Mailing worker initialized.');
    }
}

module.exports = new MailService();
