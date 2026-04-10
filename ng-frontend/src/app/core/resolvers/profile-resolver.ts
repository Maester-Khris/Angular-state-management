import { ResolveFn } from '@angular/router';
import { UserService } from '../user/user-service';
import { inject } from '@angular/core';
import { EMPTY, switchMap, take } from 'rxjs';
import { UserProfile } from '../../features/dashboard/data-access/profile.model';

export const profileResolver: ResolveFn<UserProfile> = () => {
  const userService = inject(UserService);

  return userService.profile$.pipe(
    take(1),
    switchMap(profile => profile ? [profile] : EMPTY)
  );
};
