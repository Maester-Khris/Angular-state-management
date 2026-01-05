import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, concatMap, debounceTime, delay, distinctUntilChanged, exhaustMap, filter, from, map, merge, mergeMap, mergeWith, Observable, of, pairwise, scan, shareReplay, startWith, Subject, switchMap, tap, timer } from 'rxjs';
import { MockApi } from '../../core/services/mock-api';
import { Post } from '../posts/data-access/post.model';
import { InfiniteScroll } from '../../shared/directives/infinite-scroll';

@Component({
  selector: 'app-home',
  imports: [FormsModule, CommonModule, InfiniteScroll],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  private currentPage = 0;
  private readonly limit = 5;
  private readonly MockApi = inject(MockApi);

  /**
   * Home react to 3 types of events with the same stream of data
   * 1. Global posts change
   * 2. User search query: resent current page and filter posts
   * 3. User scroll to bottom: load more posts - add a new page 
  */

  // 1- input search and scroll trigger
  //  new Subject<string>();  
  searchQuery$ = new BehaviorSubject<string>('');
  loadMore$ = new Subject<void>();

  // 2- Home page master stream of data:
  vm$ = combineLatest([
    this.searchQuery$.pipe(startWith(''), debounceTime(500), distinctUntilChanged()),
    this.MockApi.dataChanged$.pipe(startWith(undefined))
  ]).pipe(
    // whenever search or global posts change
    switchMap(([query]) =>{
      this.currentPage = 0;
      return this.MockApi.fetchPublicPosts(this.currentPage, this.limit, query).pipe(
        map(posts => ({type: 'RESET' as const, query, posts})),
        startWith({ type: 'SET_LOADING' as const })
      );
    }),

    // handle the load more data for infinite scroll
    // use mergewith to listen to initial resent and subsequent load more
    mergeWith(
      this.loadMore$.pipe(
        switchMap(() =>{ 
          this.currentPage++;
          const currentQuery = this.searchQuery$.getValue() || ''; 
          return this.MockApi.fetchPublicPosts(this.currentPage, this.limit, currentQuery).pipe(
            map(posts => ({type: 'LOAD_NEXT', posts})),
            startWith({ type: 'SET_LOADING' as const })
          );
        })
      )
    ),

    //we use scan to accumulate data on current home page state
    scan((state, action: any) =>{
      switch (action.type) {
        case 'SET_LOADING':
          return { ...state, loading: true };
        case 'RESET':
          return { posts: action.posts, query: action.query, loading: false };
        case 'LOAD_NEXT':
          return { ...state, posts: [...state.posts, ...action.posts], loading: false };
        default:
          return state;
      }
    },{ posts: [] as Post[], query: '', loading: false}),

    shareReplay(1)
  );

  ngOnInit(): void {
    
  }
  
  loadMore() {
    this.loadMore$.next();
  }

  onSearch(event:Event) {
    const value = (event.target as HTMLInputElement).value; 
    this.searchQuery$.next(value);
  }

  ngOnDestroy(): void {
  }
}

// this.posts$ = this.MockApi.fetchPublicPosts();
// this.refreshTrigger$.next();


//make home reactive to change in global posts
// posts$ = this.MockApi.dataChanged$.pipe(
//   switchMap(() => this.MockApi.fetchPublicPosts()),
//   shareReplay(1) // Avoid multiple API calls for the same data
// );


// filteredPost$ = this.searchQuery$.pipe(
//   startWith(''),
//   debounceTime(500),
//   distinctUntilChanged(),
//   switchMap((query:string) => 
//     this.posts$.pipe(
//       map(posts => {
//         const searchTerm = query.toLowerCase().trim();
//         if(!searchTerm) return posts;

//         return posts.filter((post:Post) => 
//           post.title.toLowerCase().includes(query) || 
//           post.description.toLowerCase().includes(query)
//         );
//       }) 
//     )
//   )
// );

 // apply filtering for search queries
    // map(state =>{
    //   const term = state.query.toLowerCase().trim();
    //   return state.posts.filter((p:Post) => 
    //     p.title.toLowerCase().includes(term) || 
    //     p.description.toLowerCase().includes(term)
    //   );
    // }),s
