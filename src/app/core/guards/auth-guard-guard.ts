import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';
import { inject } from '@angular/core';
import { map, take } from 'rxjs';

export const authGuardGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  console.log('hello from authGuardGuard');
  return authService.isLoggedIn$.pipe(
    take(1),
    map(isLoggedIn => {
      console.log('is logged in', isLoggedIn);
      if (isLoggedIn) {
        return true;
      } else {
        console.log('not logged in');
        return router.parseUrl('/login');
      }
    })
  );
};
