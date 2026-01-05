import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { MockApi } from '../services/mock-api';
import { Post } from '../../features/posts/data-access/post.model';

export const HomeResolver: ResolveFn<Post[]> = (route, state) => {
  const mockApi = inject(MockApi);  
  return mockApi.fetchPublicPosts(0, 5);
};
