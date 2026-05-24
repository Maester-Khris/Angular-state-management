Read these files in full before making any change:
- ng-frontend/src/app/core/services/auth.service.ts
- ng-frontend/src/app/core/services/user.service.ts
- ng-frontend/src/app/core/interceptors/ (all files — find the auth interceptor)
- ng-frontend/src/app/app.config.ts — find APP_INITIALIZER if present

Do not touch any component outside of core/services and core/interceptors.
Do not touch home, quick-view, post-detail, or search-bar.

## Fix 1 — Persist token across reloads

In auth.service.ts, update setToken to persist to localStorage:

  setToken(token: string | null) {
    this._accessToken.set(token);
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getAccessToken(): string | null {
    // Read from signal first, fall back to localStorage on cold start
    return this._accessToken() ?? localStorage.getItem('access_token');
  }

Add a rehydrateToken() method called at service construction:

  constructor() {
    this.rehydrateToken();
  }

  private rehydrateToken(): void {
    const stored = localStorage.getItem('access_token');
    if (stored) {
      this._accessToken.set(stored);
    }
  }

## Fix 2 — Rehydrate user state on app init

The user must be restored from the token on every page load before
any component renders. The correct place is APP_INITIALIZER.

In auth.service.ts, add a restoreSession() method:

  restoreSession(): Observable<AppUser | null> {
    const token = this.getAccessToken();
    if (!token) return of(null);

    // Call a lightweight /auth/me endpoint on Node that returns
    // the current user from the JWT — read node-backend/routing/auth.js
    // to verify this endpoint exists. If it does not exist, note it
    // in the log and skip this step.
    return this.http.get<any>(`${this.baseUrl}/auth/me`).pipe(
      map(res => {
        const user = UserAdapter.fromMongo(res.user ?? res);
        this.userService.setAuthenticatedUser(user);
        return user;
      }),
      catchError(() => {
        // Token expired or invalid — clear it
        this.setToken(null);
        this.userService.setAuthenticatedUser(null);
        return of(null);
      })
    );
  }

In app.config.ts, register the initializer:

  provideAppInitializer(() => {
    const authService = inject(AuthService);
    return firstValueFrom(authService.restoreSession());
  })

This ensures the user is populated before any component renders,
which fixes the "NT" initials and the logged-out-on-reload issues
in one step.

## Fix 3 — Verify /auth/me exists on Node

Read node-backend/routing/auth.js.

If GET /auth/me exists and returns the current user from the JWT:
  No change needed on backend.

If it does not exist, add it:

  router.get('/auth/me', verifyToken, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).lean();
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.status(200).json(user);
    } catch (err) {
      return res.status(500).json({ message: 'Session restore failed' });
    }
  });

Where verifyToken is the existing JWT middleware in middleware/auth.js.
Read that file to confirm the middleware name before using it.

## Fix 4 — Verify auth interceptor attaches the token

Read the auth interceptor file. Confirm it reads the token via
authService.getAccessToken() and attaches it as a Bearer header.

If the interceptor reads from a different source than getAccessToken(),
align it to use authService.getAccessToken() so it benefits from
the localStorage fallback added in Fix 1.

## Fix 5 — Logout clears localStorage

In auth.service.ts, confirm logout() calls setToken(null).
Since setToken now clears localStorage, this is covered automatically.
Verify no other place stores the token directly to localStorage
that would bypass setToken.

## Constraints
- Do not use sessionStorage for the token — it does not survive
  new tabs or hard reloads
- Do not store the full user object in localStorage — only the token.
  The user is always derived from a fresh /auth/me call on restore
- Do not touch AppHeader, home, or any reader-side component
- restoreSession must use catchError and return of(null) on failure —
  never throw, never block app bootstrap
- firstValueFrom is already imported if APP_INITIALIZER was already
  present — check before adding a duplicate import

## Build check
cd ng-frontend && ng build 2>&1 | tail -20
cd node-backend && npm test 2>&1 | tail -20

## Evaluation checklist
- [ ] Login with Google → refresh page → user still logged in
- [ ] App header shows correct initials from real user name
- [ ] App header shows avatar if Google account has one
- [ ] Logout → refresh → user is null, header shows login button
- [ ] Token expired (manually delete from localStorage) → app
      restores to logged-out state gracefully, no error thrown
- [ ] /auth/me returns 401 with expired token — app handles it silently
- [ ] ng build passes with zero errors
- [ ] Existing auth unit tests still pass