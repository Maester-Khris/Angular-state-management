import { inject, Injectable, NgZone, PLATFORM_ID, signal } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, throwError } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { AppUser } from './user.model';


@Injectable({
  providedIn: 'root',
})
export class UserService {
  private platformId = inject(PLATFORM_ID);

  // High-performance State
  private readonly userState = new BehaviorSubject<AppUser | null>(null);
  readonly user$ = this.userState.asObservable();
  readonly isLoggedIn$ = this.user$.pipe(map(user => !!user));

  private _sessionId = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initSessionId();
    }
  }

  private initSessionId() {
    let id = sessionStorage.getItem('guest_session_id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('guest_session_id', id);
    }
    this._sessionId.set(id);
  }

  // Consolidated Identity for Postair Analytics
  getTrackingIdentity(): { userId?: string; guestId?: string } {
    const user = this.userState.value;
    return user?.uuid ? { userId: user.uuid } : { guestId: this._sessionId() || undefined };
  }

  // Only source of state updates
  setAuthenticatedUser(user: AppUser | null) {
    this.userState.next(user);
  }

  get currentUserValue() { return this.userState.value; }
  get sessionId() { return this._sessionId(); }
}
