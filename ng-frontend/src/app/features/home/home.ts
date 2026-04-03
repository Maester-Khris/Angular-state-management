import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, effect, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, debounceTime, distinctUntilChanged, filter, map, mergeWith, of, shareReplay, startWith, Subject, switchMap, tap, scan } from 'rxjs';
import { RemoteApi } from '../../core/services/remote-api';
import { InfiniteScroll } from '../../shared/directives/infinite-scroll';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { PostCard } from '../../shared/ui/post-card/post-card';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { SearchBar, SearchEvent } from '../search-bar/search-bar';
import { SkeletonCard } from '../../shared/ui/skeleton-card/skeleton-card';
import { Footer } from '../../shared/ui/footer/footer';
import { TrackPreview } from '../../shared/directives/track-preview';
import { NotificationService } from '../../core/services/notification-service';
import { AiResultsPanelComponent } from '../ai-results-panel';
import { HeroComponent } from '../../shared/ui/hero/hero';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { AppConfigService } from '../../core/services/app-config.service';



@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InfiniteScroll, PostCard, LoadingSpinner, SearchBar, SkeletonCard, RouterOutlet, Footer, TrackPreview, AiResultsPanelComponent, HeroComponent, EmptyStateComponent],


  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnDestroy {
  private document = inject(DOCUMENT);
  private currentPage = 0;
  private readonly limit = 5;
  private readonly RemoteApi = inject(RemoteApi);
  private readonly notifService = inject(NotificationService);
  private readonly configSvc = inject(AppConfigService);
  @ViewChild('communityGrid') communityGrid!: ElementRef;
  showAllLinks = signal(false);
  isAiActive = signal(true);

  toggleLinks() {
    this.showAllLinks.update(v => !v);
  }

  // Get data from resolver
  private route = inject(ActivatedRoute);
  private initialDataLoader = this.route.snapshot.data['initialPosts'] || { posts: [], proposedLinks: [] };
  private initialData = this.initialDataLoader.posts;
  private initialProposedLinks = this.initialDataLoader.proposedLinks;


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
  searchQuery$ = new BehaviorSubject<{ query: string, mode: 'keyword' | 'hybrid', withAi: boolean }>({ query: '', mode: 'hybrid', withAi: false });
  loadMore$ = new Subject<void>();

  // 2- Home page master stream of data:
  vm$ = combineLatest([
    this.searchQuery$.pipe(debounceTime(500), distinctUntilChanged()),
    this.RemoteApi.dataChanged$.pipe(startWith(undefined)),
    this.RemoteApi.isAvailable$
  ]).pipe(
    // whenever search or global posts change
    tap(() => { }),
    switchMap(([{ query, mode }, _, isAvailable]) => {
      if (!isAvailable) {
        return of({ type: 'RESET' as const, query, posts: [], proposedLinks: [], isAvailable });
      }

      // If we have initial data from resolver and this is the first load (currentPage 0),
      // we can skip the initial network request.
      if (this.currentPage === 0 && this.initialData.length > 0 && !query) {
        const posts = this.initialData;
        const proposedLinks = this.initialProposedLinks;
        // Clear initial data so subsequent global updates or resets trigger a fresh fetch
        this.initialData = [];
        this.initialProposedLinks = [];
        return of({ type: 'RESET' as const, query, posts, proposedLinks, isAvailable });
      }

      this.currentPage = 0;
      return this.RemoteApi.fetchPublicPosts(this.currentPage, this.limit, query, mode).pipe(
        map(result => ({ type: 'RESET' as const, query, posts: result.posts, proposedLinks: result.proposedLinks, isAvailable })),
        startWith({ type: 'SET_LOADING' as const }),
        catchError((err) => {
          this.notifService.show(err.message || 'Failed to load posts.', 'error');
          return of({ type: 'RESET' as const, query, posts: [], proposedLinks: [], isAvailable });
        })
      );
    }),

    // handle the load more data for infinite scroll
    mergeWith(
      this.loadMore$.pipe(
        switchMap(() => {
          this.currentPage++;
          const { query, mode } = this.searchQuery$.getValue();
          return this.RemoteApi.fetchPublicPosts(this.currentPage, this.limit, query, mode).pipe(
            tap((result) => { }),
            map(result => ({ type: 'LOAD_NEXT', posts: result.posts, proposedLinks: result.proposedLinks })),
            startWith({ type: 'SET_LOADING' as const }),
            catchError((err) => {
              this.notifService.show(err.message || 'Failed to load more posts.', 'error');
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
            proposedLinks: action.proposedLinks || [],
            query: action.query,
            loading: false,
            hasMore: action.posts.length === this.limit,
            isAvailable: action.isAvailable ?? state.isAvailable
          };
        case 'LOAD_NEXT':
          return {
            ...state,
            posts: [...state.posts, ...action.posts],
            proposedLinks: (action.proposedLinks && action.proposedLinks.length > 0) ? action.proposedLinks : state.proposedLinks,
            loading: false,
            hasMore: action.posts.length === this.limit
          };
        default:
          return state;
      }
    }, { posts: [], proposedLinks: [], query: '', loading: false, hasMore: true, isAvailable: true }),

    shareReplay(1)
  );

  aiResults$ = this.searchQuery$.pipe(
    debounceTime(500),
    distinctUntilChanged((prev, curr) => prev.query === curr.query && prev.withAi === curr.withAi),
    switchMap(({ query, withAi }) => {
      // Skip entirely if server flag is off — no request fired
      const flagOn = this.configSvc.config().features.aiSearch;
      if (!flagOn || !withAi || !query.trim()) {
        return of({ state: 'idle' as const });
      }
      return this.RemoteApi.fetchAiResults(query).pipe(
        map(data => ({ state: 'loaded' as const, data })),
        startWith({ state: 'loading' as const }),
        catchError(() => of({ state: 'error' as const, message: 'AI search unavailable' }))
      );
    }),
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
  onSearch(event: SearchEvent) {
    this.searchQuery$.next(event);
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
