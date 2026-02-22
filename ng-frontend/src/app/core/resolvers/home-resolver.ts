import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { RemoteApi } from '../service/remote-api';
import { Post } from '../../features/posts/data-access/post.model';

export const HomeResolver: ResolveFn<Post[]> = (route, state) => {
  const remoteApi = inject(RemoteApi);
  return remoteApi.fetchPublicPosts(0, 5);
};
