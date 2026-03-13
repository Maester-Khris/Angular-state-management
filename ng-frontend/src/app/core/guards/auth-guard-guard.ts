import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../user/user-service';
import { inject } from '@angular/core';
import { map, take } from 'rxjs';

export const authGuardGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);
  return userService.isLoggedIn$.pipe(
    take(1),
    map(isLoggedIn => {
      if (isLoggedIn) {
        return true;
      } else {
        return router.parseUrl('/login');
      }
    })
  );
};
