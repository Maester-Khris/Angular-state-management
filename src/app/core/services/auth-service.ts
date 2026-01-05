import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, of } from 'rxjs';
import { AuthUser } from '../../features/login/user.model';

@Injectable({
  providedIn: 'root',
}) 
export class AuthService {
  private readonly userState = new BehaviorSubject<AuthUser | null>(null);
  readonly user$: Observable<AuthUser|null> = this.userState.asObservable(); // avaible for the rest of app: shared state

  // derived observable
  readonly isLoggedIn$: Observable<boolean> = this.user$.pipe(
    map(user => !!user) 
  );
  // current state
  get currentValue(): AuthUser | null{
    return this.userState.value;
  }

  login(): Observable<AuthUser> {
    const mockUser: AuthUser = {id: 'nk-dev', email:'niki@gmail.con'};
    this.userState.next(mockUser);
    return of(mockUser);
  }

  logout(){
    this.userState.next(null);
  }
  
}
