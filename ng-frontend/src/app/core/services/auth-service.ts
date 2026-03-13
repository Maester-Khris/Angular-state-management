import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, NgZone, PLATFORM_ID, signal } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, throwError } from 'rxjs';
import { AppUser, GoogleUser } from '../user/user.model';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { UserService } from '../user/user-service';
import { UserAdapter } from '../user/user.adapter';


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private userService = inject(UserService); // Inject the state manager
  private zone = inject(NgZone);
  private _accessToken = signal<string | null>(null);

  // ================== Token Management ===================
  setToken(token: string | null) {
    this._accessToken.set(token);
    // Logic for cookies/localstorage remains here
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  // ================== Manual Auth =========================
  login(credentials: any): Observable<AppUser> {
    return this.http.post<any>(`${this.baseUrl}/auth/login`, credentials).pipe(
      map(response => {
        this.setToken(response.accessToken);
        const user = UserAdapter.fromMongo(response.user);
        this.userService.setAuthenticatedUser(user); // Update state
        return user;
      })
    );
  }

  logout() {
    this.setToken(null);
    this.userService.setAuthenticatedUser(null);
    // If google initialized, disable auto-select
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.disableAutoSelect();
    }
  }

  // ================== Google Auth =========================
  initGoogle() {
    (window as any).google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => {
        this.zone.run(() => {
          // Send response.credential (the idToken) to Node.js backend
          // Once backend verifies, it returns the Mongo User
          this.loginWithGoogle(response.credential).subscribe();
        });
      },
    });
  }

  signup(name: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/signup`, { name, email, password });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/verify-otp`, { email, otp });
  }

  resendOtp(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/resend-otp`, { email });
  }

  renderButton(element: HTMLElement, options?: object) {
    (window as any).google.accounts.id.renderButton(element, {
      type: 'standard',
      size: 'large',
      ...options,
    });
  }

  private loginWithGoogle(idToken: string): Observable<AppUser> {
    return this.http.post<any>(`${this.baseUrl}/auth/google`, { idToken, guestId: this.userService.sessionId }).pipe(
      map(res => {
        this.setToken(res.accessToken);
        const user = UserAdapter.fromMongo(res.user);
        this.userService.setAuthenticatedUser(user);
        return user;
      })
    );
  }

}

export function parseCookie(cookieString: string | null, name: string): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}