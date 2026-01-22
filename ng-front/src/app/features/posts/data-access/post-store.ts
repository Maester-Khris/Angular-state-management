import { inject, Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/operators';
import { concatMap, EMPTY, Observable, switchMap, tap, withLatestFrom } from 'rxjs';

import { MockApi } from '../../../core/services/mock-api';
import { Post, PostState } from './post.model';

@Injectable()
export class PostStore extends ComponentStore<PostState> {

  mockApi = inject(MockApi);

  // --------------- Selectors ------------------
  readonly posts$: Observable<Post[]> = this.select((s)=> s.posts);
  readonly isLoading$: Observable<boolean> = this.select((s) => s.isLoading);
  readonly error$: Observable<string|null> = this.select((s) => s.error);
  
  //viewmodel selector pattern
  readonly vm$ = this.select(
    this.posts$,
    this.isLoading$,
    this.error$,
    (posts, isLoading, error) => ({ posts, isLoading, error }),
    {debounce: true}
  );

  constructor(){
    super({
      posts: [],
      isLoading: false,
      error: null,
    });
  }

  // --------------- Updaters ------------------
  readonly addPost = this.updater((state, post:Post): PostState =>({
    ...state,
    posts: [...state.posts, post] //ensure immutability
  }));
  readonly updatePostLocally = this.updater((state, updatedPost: Post) => ({
    ...state,
    posts: state.posts.map(p => p.title === updatedPost.title ? updatedPost : p)
  }));
  readonly setPosts = this.updater((state, posts:Post[]): PostState =>({
    ...state, 
    posts,
    isLoading: false,
    error: null
  }));
  readonly setError = this.updater((state, error:string):PostState =>({
    ...state,
    error,
    isLoading: false
  }));
  readonly setLoading = this.updater((state, loading: boolean):PostState =>({
    ...state,
    isLoading: loading
  }));
  readonly removePostLocally = this.updater((state, title:string) =>({
    ...state,
    posts:state.posts.filter((p:Post) => p.title !== title)
  }));

  // --------------- Effect: Asynchronous ------------------
  readonly loadPosts = this.effect((userid$: Observable<string>) =>{
    return userid$.pipe(
      tap(() => this.setLoading(true)),
      switchMap((id) => this.mockApi.fetchPostsByUser(id).pipe(
        tapResponse(
          (posts) =>{ 
            this.setPosts(posts);
            this.setLoading(false);
          },
          (error:string) => {this.setError(error); this.setLoading(false);}
        )
      ))
    )
  });
  readonly savePost = this.effect((post$: Observable<Post>) => {
    return post$.pipe(
      tap(() => this.setLoading(true)),
      concatMap((post) => // use concatMap to ensure order if user clicks fast
        this.mockApi.savePost(post).pipe(
          tapResponse(
            (savedPost) => {
              this.addPost(savedPost); // Call the updater we wrote earlier
              this.setLoading(false);
            },
          (error: string) =>{ 
            this.setError(error); 
            this.setLoading(false);}
          )
        )
      )
    );
  });
  readonly togglePostPublicStatus = this.effect((title$: Observable<string>) => {
    return title$.pipe(
      withLatestFrom(this.posts$),
      concatMap(([title, posts]) => {
        const post = posts.find(p => p.title === title);
        if(!post) return EMPTY;

        const newStatus = !post.isPublic;

        // optimistic ui update
        this,this.updatePostLocally({...post, isPublic: newStatus});

        //update remote api
        return this.mockApi.updatePost(title, {...post, isPublic: newStatus}).pipe(
          tapResponse(
            (updateResult) => console.log("successfull update result", updateResult),
            (error:string) => {
              // rollback on error during update
              this.updatePostLocally(post);
              this.setError(error);
            }
          )
        )
      })
    )
  });
  readonly deletePost = this.effect((title$: Observable<string>) =>{
    return title$.pipe(
      // grab the current state of past and add it to current inner observable
      withLatestFrom(this.posts$),
      concatMap(([title, originalPosts]) =>{
        this.removePostLocally(title);
        return this.mockApi.deletePost(title).pipe(
          tapResponse(
            () => {},
            (error) => {
              this.setPosts(originalPosts);
              this.setError("Delete failed! Restoring data...")
            }
          )
        )
      })
    )
  })


}
