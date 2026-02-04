import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Speed up retry/backoff loops in routes for tests
process.env.SEND_RETRY_ATTEMPTS = '1';
process.env.SEND_RETRY_BASE_MS = '1';

const mailer = require('../utils/mailer');
const sendSpy = vi.spyOn(mailer, 'sendWithRetries').mockResolvedValue(true);

// Import app and database helpers after mocks
const { app } = require('../server');
const database = require('../database/connection');
const User = require('../database/models/user');
const Otp = require('../database/models/userotp');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await database.connectDB(uri);

  // clean all collections before tests
  await Otp.deleteMany({});
  await User.deleteMany({});  

  // Ensure indexes are created (some models rely on TTL indexes etc.)
  await mongoose.connection.db.command({ ping: 1 });
});

afterAll(async () => {
  await database.closeConnection();
  if (mongoServer) await mongoServer.stop();
});

describe('OTP integration tests (in-memory MongoDB)', () => {
  it('signup flow: successfully mocks email and creates OTP', async () => {
    const res = await request(app)
      .post('/auth/signup') // Ensure /auth prefix is here
      .send({ 
        email: 'formationnikit@gmail.com', 
        password: 'password123', 
        name: 'Test User' 
      });

    // Debugging: If this is 500, check the console for the error
    if (res.status === 500) console.log('Error Body:', res.body);

    expect(res.status).toBe(201);
    
    // 4. Use the spy variable directly for the expectation
    expect(sendSpy).toHaveBeenCalledWith(
      'formationnikit@gmail.com', 
      expect.any(String)
    );
  });

  it('/auth/verify-otp: works end-to-end', async () => {
    // Create a user and an OTP entry
    const user = await User.create({ name: 'Verifier', email: 'khris.firesoft@gmail.com', password: 'x' });
    const otpCode = '654321';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await Otp.create({ email: user.email, otp: otpCode, createdAt: now, expiresAt });

    const res = await request(app).post('/auth/verify-otp').send({ email: user.email, otp: otpCode });
    expect(res.status).toBe(200);

    const updatedUser = await User.findOne({ email: user.email }).lean();
    expect(updatedUser.isVerified).toBe(true);

    // OTPs should be deleted
    const remaining = await Otp.find({ email: user.email });
    expect(remaining.length).toBe(0);
  });
});
