# Node backend

## Routes
All home routes in routes/home.js
/api/search       — keyword or hybrid, calls Python if mode=hybrid
/api/search/ai    — proxies to Python /search/ai, guarded by FEATURE_AI_SEARCH
/api/config       — returns feature flags, public endpoint
/api/feed         — paginated home feed, no search

## Environment variables (via Doppler)
MONGO_URI, SHARED_SECURITY_KEY, PYTHON_SERVICE_URL, FEATURE_AI_SEARCH

## Python proxy pattern
Use existing remoteSearchSvc methods — do not call Python fetch() directly
in routes unless remoteSearchSvc doesn't cover the endpoint.

## Never do
- Never add pythonBaseUrl or internalApiKey to any Angular file
- Never skip the FEATURE_AI_SEARCH guard on /api/search/ai