import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { RemoteApi } from '../service/remote-api';
import { Post } from '../../features/posts/data-access/post.model';
import { catchError, of } from 'rxjs';

export const HomeResolver: ResolveFn<{ posts: Post[], proposedLinks: any[] }> = (route, state) => {
  const remoteApi = inject(RemoteApi);
  return remoteApi.fetchPublicPosts(0, 5).pipe(
    catchError(() => {
      // If the resolver fails, return empty structure
      return of({ posts: [], proposedLinks: [] });
    })
  );
};
