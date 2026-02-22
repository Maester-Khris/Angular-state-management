import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { RemoteApi } from '../service/remote-api';
import { Post } from '../../features/posts/data-access/post.model';
import { catchError, of } from 'rxjs';

export const HomeResolver: ResolveFn<Post[]> = (route, state) => {
  const remoteApi = inject(RemoteApi);
  return remoteApi.fetchPublicPosts(0, 5).pipe(
    catchError(() => {
      // If the resolver fails, notify the service that the server is down
      // This ensures the Home component shows the 'Server Connection Lost' UI
      remoteApi.setAvailability(false);
      return of([]); // Return empty list to allow the route to activate
    })
  );
};
