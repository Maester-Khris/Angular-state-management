# Task: integration-test-post-crud

## Scope
- [ ] ng-frontend
- [x] node-backend
- [ ] python-search-api
- [ ] data-utils

## Role
You are a backend engineer writing integration tests against a live MongoDB instance.
You use Vitest. You test behaviour end-to-end through the Express router —
not unit-testing DAO methods in isolation.

## Context

Branch: `feat/writer-console-api`

**Existing test infrastructure**
- `node-backend/vitest.config.js` — Vitest already configured
- `node-backend/tests/` — existing integration tests for analytics and OTP
- `node-backend/test.rest` — REST examples for manual testing
- Auth middleware: `node-backend/middleware/auth.js` — `authenticateJWT` reads
  `req.userId` and `req.userName` from a verified JWT
- All `/myactivity/*` routes are gated by `router.use(authenticateJWT)`

**Routes under test**
POST   /myactivity/posts          — create post
GET    /myactivity/posts          — list writer's own posts
PUT    /myactivity/posts/:uuid    — update post
DELETE /myactivity/posts/:uuid    — delete post

**What to verify against MongoDB**
- After POST: document exists in `posts` collection with correct fields
- After GET:  returned array includes the created post
- After PUT:  document in MongoDB reflects the update
- After DELETE: document no longer exists in `posts` collection

## Task

Node (node-backend)
1. Create `node-backend/tests/post-crud.integration.test.js`

   Test setup:
   - Connect to MongoDB test database via `MONGO_URI` env var (injected by Doppler)
   - Create a test user and generate a valid JWT before all tests
   - Mock `authenticateJWT` to inject `req.userId` and `req.userName`
     from the test user — do not duplicate auth logic
   - Clean up: delete all posts created during the test run in `afterAll`

   Test cases (in order):

   ✓ POST /myactivity/posts — creates a draft post
assert: res.status === 201
assert: res.body.uuid is defined
assert: MongoDB post document exists with correct title, isDraft: true
✓ POST /myactivity/posts — creates a published post
assert: res.status === 201
assert: res.body.slug is defined
assert: MongoDB document has isPublic: true, publishedAt is set
✓ GET /myactivity/posts — returns list including created posts
assert: res.status === 200
assert: res.body is array
assert: array includes post by uuid
✓ PUT /myactivity/posts/:uuid — updates title and description
assert: res.status === 200
assert: MongoDB document reflects updated title
✓ PUT /myactivity/posts/:uuid — publish a draft (isPublic: true)
assert: res.status === 200
assert: MongoDB document has slug set and publishedAt not null
✓ DELETE /myactivity/posts/:uuid — deletes the post
assert: res.status === 204
assert: MongoDB document no longer exists
✓ DELETE /myactivity/posts/:uuid — returns 404 on unknown uuid
assert: res.status === 404 or 400


2. Add REST examples to `node-backend/test.rest` for all four routes:
Create draft post
POST /myactivity/posts
Authorization: Bearer <token>
Content-Type: application/json
{ "title": "...", "description": "...", "hashtags": [], "isDraft": true, "isPublic": false }
List writer posts
GET /myactivity/posts
Authorization: Bearer <token>
Update post
PUT /myactivity/posts/:uuid
Authorization: Bearer <token>
Content-Type: application/json
{ "title": "updated title" }
Delete post
DELETE /myactivity/posts/:uuid
Authorization: Bearer <token>


## Constraints
- Use Vitest only — no Jest
- Use `supertest` for HTTP assertions — already in dev dependencies
- Do not connect to the production MongoDB — always use the test DB from env
- Do not test DAO methods directly — test through the Express app
- Clean up all test data in `afterAll` — never leave orphan documents
- Do not modify `crud.js`, `activity.js`, or any production file
- Auth: mock `authenticateJWT` at the middleware level —
  do not expose or hardcode a real JWT secret

## Run command

```bash
cd node-backend && doppler run --config test -- npx vitest run tests/post-crud.integration.test.js
```

## Expected output

node-backend
- `tests/post-crud.integration.test.js` — full integration test suite
- `test.rest`                           — four new REST examples appended

## Evaluation checklist
- [ ] All 7 test cases pass against live MongoDB test instance
- [ ] No orphan documents left after test run
- [ ] GET /myactivity/posts returns only the authenticated user's posts
- [ ] Published post has `slug` and `publishedAt` set in MongoDB
- [ ] Deleted post confirmed absent from MongoDB — not just from API response
- [ ] No production credentials hardcoded
- [ ] `test.rest` updated with all four route examples

## Log

### Run 1 — 2026-W21
Output: Task created — integration tests for post CRUD against MongoDB.
Gap: No automated test coverage existed for /myactivity/posts routes.
Action: Implement test file and append REST examples.