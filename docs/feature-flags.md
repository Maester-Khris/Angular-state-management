# Feature Flags

This document describes the feature flags available in the PostAir platform and how to manage them.

## NODE_FEATURE_AI_SEARCH
Controls the availability of the AI-powered search feature (Angular -> Node -> Python AI Search).

| Environment | Default Value | Effect |
| :--- | :--- | :--- |
| **Production** | `false` | "Ask AI" button is hidden in UI; backend returns 503 for AI search requests. |
| **Preview** | `true` | Full feature enabled for testing. |
| **Local Dev** | `true` | Enabled by default in `env-dev`. |

### How to Toggle in Production (Vercel/Render)
1.  Go to your hosting provider's dashboard (e.g., Render for Node.js backend).
2.  Navigate to **Environment Variables**.
3.  Update `NODE_FEATURE_AI_SEARCH` to `true` or `false`.
4.  **Save** and trigger a **Redeploy** (if not automatic).
5.  The change will take effect immediately upon server start.

### Implementation Details
- **Backend Guard**: The `/api/search/ai` route checks the flag at the entry point to ensure server-side security.
- **Frontend Sync**: The Angular app fetches these flags at boot time via the `/api/config` endpoint using an `APP_INITIALIZER`.
- **UX Polish**: The "Ask AI" button is dynamically removed from the DOM if the flag is disabled, preventing unnecessary network calls and providing a clean UI.
