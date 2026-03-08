import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Speed up retry/backoff loops in routes for tests
process.env.SEND_RETRY_ATTEMPTS = '1';
process.env.SEND_RETRY_BASE_MS = '1';

// Mock DB before importing anything else
vi.mock('../database/connection', () => ({
  connectDB: vi.fn().mockResolvedValue(),
  closeConnection: vi.fn().mockResolvedValue(),
  getDbStatus: vi.fn().mockReturnValue(1),
  connectionEventListeners: vi.fn()
}));

// Mock Models
vi.mock('../database/models/user', () => {
  const mock = {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn()
  };
  return mock;
});
vi.mock('../database/models/userotp', () => {
  const mock = {
    deleteMany: vi.fn(),
    create: vi.fn(),
    find: vi.fn()
  };
  return mock;
});

// Import app after mocks
const { app } = require('../server');
const User = require('../database/models/user');
const Otp = require('../database/models/userotp');
const queueService = require('../services/queueService');
const redisConfig = require('../configurations/redis');
const { Queue } = require('bullmq');

let mailingQueue;

beforeAll(async () => {
  mailingQueue = new Queue('mailing-queue', {
    connection: redisConfig.getProducerConnection()
  });
  await mailingQueue.drain(true);
});

afterAll(async () => {
  await mailingQueue.close();
  await queueService.shutdown();
});

describe('OTP integration tests (Real Redis + Mocked MongoDB)', () => {
  it('signup flow: successfully enqueues OTP email job', async () => {
    const email = 'formationikit@gmail.com';

    // Setup DB Mocks for signup
    const dbCrud = require('../database/crud');
    vi.spyOn(dbCrud, 'checkUserExistsByEmail').mockResolvedValue(false);
    vi.spyOn(dbCrud, 'createUser').mockResolvedValue({ email, name: 'Test User' });
    vi.spyOn(dbCrud, 'createOtp').mockResolvedValue({ _id: 'otp-id', email, otp: '123456' });

    const res = await request(app)
      .post('/auth/signup')
      .send({
        email: email,
        password: 'password123',
        name: 'Test User'
      });

    expect(res.status).toBe(201);

    // Verify job in queue
    const jobs = await mailingQueue.getJobs(['waiting']);
    expect(jobs.length).toBeGreaterThan(0);

    const job = email ? jobs.find(j => j.data.to === email) : jobs[0];
    expect(job).toBeDefined();
    expect(job.data.to).toBe(email);
  });

  it('/auth/verify-otp: works end-to-end (mocked)', async () => {
    const email = 'khris.firesoft@gmail.com';
    const otpCode = '654321';

    const dbCrud = require('../database/crud');
    vi.spyOn(dbCrud, 'findValidOtp').mockResolvedValue({ email, otp: otpCode });
    vi.spyOn(dbCrud, 'markUserVerifiedByEmail').mockResolvedValue();
    vi.spyOn(dbCrud, 'deleteOtpsByEmail').mockResolvedValue();

    const res = await request(app).post('/auth/verify-otp').send({ email, otp: otpCode });
    expect(res.status).toBe(200);
  });
});
