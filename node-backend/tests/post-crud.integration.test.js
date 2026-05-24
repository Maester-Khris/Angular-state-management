import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// var is hoisted alongside vi.mock — safe to reference in the mock closure
var testUserId;
var testUserName = 'Test Writer';

vi.mock('../middleware/auth', () => ({
  authenticateJWT: (req, res, next) => {
    req.userId  = testUserId;
    req.userName = testUserName;
    next();
  },
}));

const { app } = require('../server');
const Post    = require('../database/models/post');
const User    = require('../database/models/user');

const MONGO_URI = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/${process.env.MONGO_DATABASE}?appName=Cluster0`;

const TEST_EMAIL = 'int-test-writer@postair.test';

describe('Post CRUD — /myactivity/posts integration tests', () => {
  const createdUuids = [];
  let draftUuid;
  let publishedUuid;

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI);

    const crypto = require('crypto');
    const user = await User.findOneAndUpdate(
      { email: TEST_EMAIL },
      {
        $setOnInsert: {
          name:        testUserName,
          email:       TEST_EMAIL,
          avatarUrl:   'https://test.placeholder/avatar.png',
          isVerified:  true,
          password:    crypto.randomBytes(16).toString('hex'),
        },
      },
      { upsert: true, new: true }
    ).lean();

    testUserId = user._id;
  });

  afterAll(async () => {
    if (createdUuids.length) {
      await Post.deleteMany({ uuid: { $in: createdUuids } });
    }
    await User.deleteOne({ email: TEST_EMAIL });
    await mongoose.disconnect();
  });

  it('POST /myactivity/posts — creates a draft post', async () => {
    const res = await request(app)
      .post('/myactivity/posts')
      .set('Authorization', 'Bearer test-token')
      .send({
        title:       'Integration Test Draft',
        description: 'Draft body content for integration testing',
        hashtags:    ['test'],
        isDraft:     true,
        isPublic:    false,
      });

    expect(res.status).toBe(201);
    expect(res.body.uuid).toBeDefined();

    draftUuid = res.body.uuid;
    createdUuids.push(draftUuid);

    const doc = await Post.findOne({ uuid: draftUuid }).lean();
    expect(doc).not.toBeNull();
    expect(doc.title).toBe('Integration Test Draft');
    expect(doc.isDraft).toBe(true);
  });

  it('POST /myactivity/posts — creates a published post', async () => {
    const res = await request(app)
      .post('/myactivity/posts')
      .set('Authorization', 'Bearer test-token')
      .send({
        title:       'Integration Test Published',
        description: 'Published post content for integration testing',
        hashtags:    ['test'],
        isPublic:    true,
        isDraft:     false,
      });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBeDefined();

    publishedUuid = res.body.uuid;
    createdUuids.push(publishedUuid);

    const doc = await Post.findOne({ uuid: publishedUuid }).lean();
    expect(doc).not.toBeNull();
    expect(doc.isPublic).toBe(true);
    expect(doc.publishedAt).not.toBeNull();
  });

  it('GET /myactivity/posts — returns list including created posts', async () => {
    const res = await request(app)
      .get('/myactivity/posts')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const uuids = res.body.map(p => p.uuid);
    expect(uuids).toContain(draftUuid);
    expect(uuids).toContain(publishedUuid);
  });

  it('PUT /myactivity/posts/:uuid — updates title and description', async () => {
    const res = await request(app)
      .put(`/myactivity/posts/${draftUuid}`)
      .set('Authorization', 'Bearer test-token')
      .send({ title: 'Updated Draft Title', description: 'Updated description' });

    expect(res.status).toBe(200);

    const doc = await Post.findOne({ uuid: draftUuid }).lean();
    expect(doc.title).toBe('Updated Draft Title');
  });

  it('PUT /myactivity/posts/:uuid — publish a draft sets slug and publishedAt', async () => {
    const res = await request(app)
      .put(`/myactivity/posts/${draftUuid}`)
      .set('Authorization', 'Bearer test-token')
      .send({ isPublic: true });

    expect(res.status).toBe(200);

    const doc = await Post.findOne({ uuid: draftUuid }).lean();
    expect(doc.slug).toBeDefined();
    expect(doc.publishedAt).not.toBeNull();
  });

  it('DELETE /myactivity/posts/:uuid — deletes the post', async () => {
    const res = await request(app)
      .delete(`/myactivity/posts/${publishedUuid}`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(204);

    const doc = await Post.findOne({ uuid: publishedUuid }).lean();
    expect(doc).toBeNull();

    createdUuids.splice(createdUuids.indexOf(publishedUuid), 1);
  });

  it('DELETE /myactivity/posts/:uuid — returns 404 on unknown uuid', async () => {
    const res = await request(app)
      .delete('/myactivity/posts/00000000-0000-4000-a000-000000000000')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
