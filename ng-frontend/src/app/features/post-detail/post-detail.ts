import { Component, effect, inject, input, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RemoteApi } from '../../core/services/remote-api';
import { Router } from '@angular/router';
import { UserService } from '../../core/user/user-service';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { EventTracking } from '../../core/services/event-tracking';
import { NotificationService } from '../../core/services/notification-service';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-post-detail',
  imports: [LoadingSpinner],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css',
})
export class PostDetail implements OnInit {
  private remoteApi = inject(RemoteApi);
  private router = inject(Router);
  private eventTracker = inject(EventTracking);
  private notifService = inject(NotificationService);
  private userService = inject(UserService);
  platformId = inject(PLATFORM_ID);

  isLoggedIn = toSignal(this.userService.isLoggedIn$);

  constructor(private meta: Meta, private pagetitle: Title) {
    effect(() => {
      const postData = this.post();

      // Only set tags if postData actually exists
      if (postData) {
        this.pagetitle.setTitle(`${postData.title} | Postair Lab`);
        this.meta.updateTag({ name: 'description', content: postData.description });
        this.meta.updateTag({ property: 'og:title', content: postData.title });
        this.meta.updateTag({ property: 'og:description', content: postData.description });
        this.meta.updateTag({ property: 'og:image', content: postData.imageUrl || 'assets/favicon-postair.png' });
      }
    });
  }

  // later can be updated with effect so that intial state comes from server respoinse if already present in bookmarks  
  isSaved = signal(false);

  // Retrieve post data
  // post uuid automatically populated by angular due to withInputBinding() on routing navigation
  // use signal to fecth full post with retrieved uuid
  uuid = input<string>('', { alias: 'uuid' });
  post = toSignal(
    toObservable(this.uuid).pipe(
      switchMap(uuid => this.remoteApi.fetchPostByUuid(uuid).pipe(
        catchError(err => {
          this.notifService.show(err.message || 'Post not found', 'error');
          this.close();
          return of(null);
        })
      ))
    )
  );

  private viewTimer?: any;
  private viewTracked = false;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.startViewTimer();
    }
  }

  private startViewTimer() {
    this.viewTimer = setTimeout(() => {
      if (!this.viewTracked) {
        this.eventTracker.emit({
          postId: this.uuid(),
          type: 'view',
          timestamp: Date.now()
        });
        this.viewTracked = true;
      }
    }, 30000); // 30 seconds
  }

  onAddToBookmarks() {
    // optimistic ui update
    this.isSaved.set(true);
    this.eventTracker.emit({
      postId: this.uuid(),
      type: 'favorite',
      timestamp: Date.now()
    });
    this.notifService.show('Added to favorites', 'success');
  }

  onShare() {
    this.eventTracker.emit({
      postId: this.uuid(),
      type: 'share',
      timestamp: Date.now()
    });

    // Attempt to use Web Share API
    if (navigator.share) {
      navigator.share({
        title: this.post()?.title,
        url: window.location.href
      }).catch(() => { });
    } else {
      this.notifService.show('Link copied to clipboard', 'success');
      navigator.clipboard.writeText(window.location.href);
    }
  }

  ngOnDestroy() {
    if (this.viewTimer) {
      clearTimeout(this.viewTimer);
    }
  }

  close() {
    this.router.navigate(['/home']);
  }
}
