import { describe, it, expect, vi, beforeEach } from 'vitest';
const mailService = require('../services/mailService');
const queueService = require('../services/queueService');
const nodemailer = require('nodemailer');

describe('MailService Unit Tests', () => {
    let mockTransporter;

    beforeEach(() => {
        vi.restoreAllMocks();
        mockTransporter = {
            sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' })
        };
        vi.spyOn(nodemailer, 'createTransport').mockReturnValue(mockTransporter);
        mailService.transporter = mockTransporter;
    });

    describe('enqueueOtpEmail', () => {
        it('should add a job to the mailing-queue', async () => {
            const to = 'formationnikit@gmail.com';
            const otp = '123456';
            const addJobSpy = vi.spyOn(queueService, 'addJob').mockResolvedValue({ id: 'job-1' });

            const result = await mailService.enqueueOtpEmail(to, otp);

            expect(addJobSpy).toHaveBeenCalledWith(
                'mailing-queue',
                'send-otp',
                { to, otp }
            );
            expect(result).toEqual({ id: 'job-1' });
        });
    });

    describe('processEmail', () => {
        it('should send an email using nodemailer', async () => {
            const job = {
                id: 'job-1',
                data: { to: 'formationnikit@gmail.com', otp: '123456' }
            };

            await mailService.processEmail(job);

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'formationnikit@gmail.com',
                subject: 'Your PostAir Verification Code',
                html: expect.stringContaining('123456')
            }));
        });

        it('should throw an error if sending fails', async () => {
            const job = {
                id: 'job-1',
                data: { to: 'error@test.com', otp: '123456' }
            };
            vi.spyOn(mockTransporter, 'sendMail').mockRejectedValue(new Error('SMTP Error'));

            await expect(mailService.processEmail(job)).rejects.toThrow('SMTP Error');
        });
    });
});
