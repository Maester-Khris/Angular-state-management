import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { MockApi, ProposedLink } from '../services/mock-api';
import { Post } from '../../features/posts/data-access/post.model';
import { catchError, of } from 'rxjs';

export const HomeResolver: ResolveFn<{ posts: Post[], proposedLinks: ProposedLink[] }> = (route, state) => {
  const mockApi = inject(MockApi);
  return mockApi.fetchPublicPosts(0, 5).pipe(
    catchError(() => {
      // If the resolver fails, return empty structure
      return of({ posts: [], proposedLinks: [] });
    })
  );
};
