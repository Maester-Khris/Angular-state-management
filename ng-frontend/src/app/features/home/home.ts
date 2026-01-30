import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, concatMap, debounceTime, delay, distinctUntilChanged, exhaustMap, filter, from, map, merge, mergeMap, mergeWith, Observable, of, pairwise, scan, shareReplay, startWith, Subject, switchMap, tap, timer } from 'rxjs';
import { MockApi } from '../../core/services/mock-api';
import { Post } from '../posts/data-access/post.model';
import { InfiniteScroll } from '../../shared/directives/infinite-scroll';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { PostCard } from '../../shared/ui/post-card/post-card';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { SearchBar } from '../search-bar/search-bar';
import { SkeletonCard } from '../../shared/ui/skeleton-card/skeleton-card';
import { trigger, transition, style, animate } from '@angular/animations';
import { Footer } from '../../shared/ui/footer/footer';
import { TrackPreview } from '../../shared/directives/track-preview';

@Component({
  selector: 'app-home',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, InfiniteScroll, PostCard, LoadingSpinner, SearchBar, SkeletonCard, RouterOutlet, Footer, RouterLink, TrackPreview],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  private currentPage = 0;
  private readonly limit = 5;
  private readonly MockApi = inject(MockApi);
  @ViewChild('communityGrid') communityGrid!: ElementRef;

  // Get data from resolver
  private route = inject(ActivatedRoute);
  private initialData = this.route.snapshot.data['initialPosts'] || [];

 
  // ui interaction
  private router = inject(Router);
  isDrawerOpen = toSignal(
     this.router.events.pipe(
      filter((event)=> event instanceof NavigationEnd),
      map(() => this.router.url.includes('/view/')),
      startWith(this.router.url.includes('/view/'))
    )
  );


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
          return { posts: action.posts, query: action.query, loading: false, hasMore: action.posts.length === this.limit };
        case 'LOAD_NEXT':
          return { ...state, posts: [...state.posts, ...action.posts], loading: false, hasMore: action.posts.length === this.limit };
        default:
          return state;
      }
    },{ posts: this.initialData , query: '', loading: false, hasMore: true}),

    shareReplay(1)
  );

  // =============== Lifecycle hooks ================
  ngOnInit(): void {
  }
  ngOnDestroy(): void {
  }

  
  loadMore(isLoading: boolean) {
    // Prevent concurrent loads
    if (isLoading) return; 
    this.loadMore$.next();
  }


  // ================= Search component  ==============
  onSearch(query:string) {
    // const value = (event.target as HTMLInputElement).value; 
    this.searchQuery$.next(query);
  }
  scrollToCommunity() {
  this.communityGrid.nativeElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
}

  
  // ================= Navigation with child component  ==============
  openDetails(title:string){
    console.log(title);
    this.router.navigate(['view',title], {relativeTo: this.route});
  }
  closeDetails() {
    this.router.navigate(['/home']);
  }
  @HostListener('window:keyup.esc')
  onEsc() {
    if (this.isDrawerOpen()) {
      this.closeDetails();
    }
  }

}
