import { ResolveFn } from '@angular/router';
import { AuthService } from '../services/auth-service';
import { inject } from '@angular/core';
import { EMPTY, switchMap, take } from 'rxjs';
import { ProfileService } from '../../features/profile/data-access/profile-service';
import { UserProfile } from '../../features/profile/data-access/profile.model';

export const profileResolver: ResolveFn<UserProfile> = (route, state) => {
  const profileService = inject(ProfileService);
  const authService = inject(AuthService);


  return authService.user$.pipe(
    take(1), // ensure the observable complete after emitting one value
    switchMap((user) => {
      if (user) {
        return profileService.getProfile(user.id)
      } else {
        return EMPTY;
      }
    })
  );
};
