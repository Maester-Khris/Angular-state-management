import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, effect, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, concatMap, debounceTime, delay, distinctUntilChanged, exhaustMap, filter, from, map, merge, mergeMap, mergeWith, Observable, of, pairwise, scan, shareReplay, startWith, Subject, switchMap, tap, timer } from 'rxjs';
import { MockApi, ProposedLink } from '../../core/services/mock-api';
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
import { NotificationService } from '../../core/services/notification-service';

@Component({
  selector: 'app-home',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, InfiniteScroll, PostCard, LoadingSpinner, SearchBar, SkeletonCard, RouterOutlet, Footer, RouterLink, TrackPreview],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  private document = inject(DOCUMENT);
  private currentPage = 0;
  private readonly limit = 5;
  private readonly RemoteApi = inject(MockApi);
  private readonly notifService = inject(NotificationService);
  @ViewChild('communityGrid') communityGrid!: ElementRef;

  // Get data from resolver
  private route = inject(ActivatedRoute);
  private initialData = this.route.snapshot.data['initialPosts'] || [];


  // ui interaction
  private router = inject(Router);
  isDrawerOpen = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url.includes('/view/')),
      startWith(this.router.url.includes('/view/'))
    )
  );

  constructor() {
    effect(() => {
      const isOpen = this.isDrawerOpen();
      if (this.document) {
        if (isOpen) {
          this.document.body.classList.add('overflow-hidden');
        } else {
          this.document.body.classList.remove('overflow-hidden');
        }
      }
    });
  }


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
    this.searchQuery$.pipe(debounceTime(500), distinctUntilChanged()),
    this.RemoteApi.dataChanged$.pipe(startWith(undefined)),
    this.RemoteApi.isAvailable$
  ]).pipe(
    // whenever search or global posts change
    switchMap(([query, _, isAvailable]) => {
      if (!isAvailable) {
        return of({ type: 'RESET' as const, query, posts: [], isAvailable });
      }

      // If we have initial data from resolver and this is the first load (currentPage 0),
      // we can skip the initial network request.
      if (this.currentPage === 0 && this.initialData.length > 0 && !query) {
        const posts = this.initialData;
        // Clear initial data so subsequent global updates or resets trigger a fresh fetch
        this.initialData = [];
        return of({ type: 'RESET' as const, query, posts, isAvailable });
      }

      this.currentPage = 0;
      return this.RemoteApi.fetchPublicPosts(this.currentPage, this.limit, query).pipe(
        map(result => ({ type: 'RESET' as const, query, posts: result.posts, proposedLinks: result.proposedLinks, isAvailable })),
        startWith({ type: 'SET_LOADING' as const }),
        catchError(() => {
          this.notifService.show('Failed to load posts. API might be down.', 'error');
          return of({ type: 'RESET' as const, query, posts: [], proposedLinks: [], isAvailable });
        })
      );
    }),

    // handle the load more data for infinite scroll
    mergeWith(
      this.loadMore$.pipe(
        switchMap(() => {
          this.currentPage++;
          const currentQuery = this.searchQuery$.getValue() || '';
          return this.RemoteApi.fetchPublicPosts(this.currentPage, this.limit, currentQuery).pipe(
            map(result => ({ type: 'LOAD_NEXT', posts: result.posts, proposedLinks: result.proposedLinks })),
            startWith({ type: 'SET_LOADING' as const }),
            catchError(() => {
              this.notifService.show('Failed to load more posts.', 'error');
              return of({ type: 'STOP_LOADING' as const });
            })
          );
        })
      )
    ),

    //we use scan to accumulate data on current home page state
    scan((state, action: any) => {
      switch (action.type) {
        case 'SET_LOADING':
          return { ...state, loading: true };
        case 'STOP_LOADING':
          return { ...state, loading: false };
        case 'RESET':
          return {
            ...state,
            posts: action.posts,
            proposedLinks: action.proposedLinks,
            query: action.query,
            loading: false,
            hasMore: action.posts.length === this.limit,
            isAvailable: action.isAvailable ?? state.isAvailable
          };
        case 'LOAD_NEXT':
          return {
            ...state,
            posts: [...state.posts, ...action.posts],
            proposedLinks: action.proposedLinks.length > 0 ? action.proposedLinks : state.proposedLinks,
            loading: false,
            hasMore: action.posts.length === this.limit
          };
        default:
          return state;
      }
    }, { posts: [], proposedLinks: [], query: '', loading: false, hasMore: true, isAvailable: true }),

    shareReplay(1)
  );

  // =============== Lifecycle hooks ================
  ngOnInit(): void {
    this.RemoteApi.checkHealth().subscribe(isAvailable => {
      if (!isAvailable) {
        this.notifService.show('API Server is currently unavailable', 'error');
      }
    });
  }
  ngOnDestroy(): void {
    if (this.document) {
      this.document.body.classList.remove('overflow-hidden');
    }
  }


  loadMore(isLoading: boolean) {
    // Prevent concurrent loads
    if (isLoading) return;
    this.loadMore$.next();
  }


  // ================= Search component  ==============
  onSearch(query: string) {
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
  openDetails(uuid: string) {
    this.router.navigate(['view', uuid], { relativeTo: this.route });
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
