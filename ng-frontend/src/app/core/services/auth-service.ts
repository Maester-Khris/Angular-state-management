import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { BehaviorSubject, map, Observable, of } from 'rxjs';
import { AuthUser } from '../../features/auth/user.model';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Internal state: Use a Signal for the token to get synchronous access [cite: 2025-12-31]
  private readonly baseUrl = environment.apiUrl;
  platformId = inject(PLATFORM_ID);
  http = inject(HttpClient);
  private _accessToken = signal<string | null>(null);
  private readonly userState = new BehaviorSubject<AuthUser | null>(null);
  readonly user$: Observable<AuthUser | null> = this.userState.asObservable(); // avaible for the rest of app: shared state
  

  // ================== Internal State Management ===================
  get currentValue(): AuthUser | null {
    return this.userState.value;
  }
  readonly isLoggedIn$: Observable<boolean> = this.user$.pipe(
    map(user => !!user)
  );


  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const token = parseCookie(document.cookie, 'accessToken');
      if (token) this._accessToken.set(token);
    }
  }


  // ================== Token Management ===================
  // Synchronous return. No waiting for observables. [cite: 2025-12-31]
  getAccessToken(): string | null {
    return this._accessToken();
  }

  // Update token after login or refresh
  setToken(token: string) {
    this._accessToken.set(token);
  }


  // ================== Auth Process Management ===================
  signup(name:string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/signup`, {name, email, password });
  }

  login(): Observable<AuthUser> {
    // const mockUser: AuthUser = { id: 'nk-dev', email: 'niki@gmail.con' };
    // this.setToken('mock-jwt-token-123');
    // this.userState.next(mockUser);
    // return of(mockUser);

    return this.http.post<any>(`${this.baseUrl}/auth/login`, {}).pipe(
      map(user => {
        this.setToken(user.accessToken);
        return user;
      })
    );
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/verify-otp`, { email, otp });
  }

  resendOtp(email:string){
    return this.http.post(`${this.baseUrl}/auth/resend-otp`, { email});
  }

  logout() {
    this._accessToken.set(null);
    this.userState.next(null);
  }

}

export function parseCookie(cookieString: string | null, name: string): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}