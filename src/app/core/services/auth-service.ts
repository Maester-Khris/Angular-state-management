import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { BehaviorSubject, map, Observable, of } from 'rxjs';
import { AuthUser } from '../../features/auth/user.model';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
}) 
export class AuthService {
  // Internal state: Use a Signal for the token to get synchronous access [cite: 2025-12-31]
  private _accessToken = signal<string | null>(null);
  private readonly userState = new BehaviorSubject<AuthUser | null>(null);
  readonly user$: Observable<AuthUser|null> = this.userState.asObservable(); // avaible for the rest of app: shared state

  platformId = inject(PLATFORM_ID);

  constructor() {
  if (isPlatformBrowser(this.platformId)) {
    // Read the accessToken from the cookie to sync with SSR [cite: 2025-12-31]
    const token = parseCookie(document.cookie, 'accessToken');
    if (token) this._accessToken.set(token);
  }
}

  // derived observable
  readonly isLoggedIn$: Observable<boolean> = this.user$.pipe(
    map(user => !!user) 
  );

  // Synchronous return. No waiting for observables. [cite: 2025-12-31]
  getAccessToken(): string | null {
    return this._accessToken();
  }

  // Update token after login or refresh
  setToken(token: string) {
    this._accessToken.set(token);
  }
  // current state
  get currentValue(): AuthUser | null{
    return this.userState.value;
  }

  login(): Observable<AuthUser> {
    const mockUser: AuthUser = {id: 'nk-dev', email:'niki@gmail.con'};
    this.setToken('mock-jwt-token-123');

    this.userState.next(mockUser);
    return of(mockUser);
  }

  logout(){
    this._accessToken.set(null);
    this.userState.next(null);
  }
  
}

export function parseCookie(cookieString: string | null, name: string): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}