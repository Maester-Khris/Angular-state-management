import { Component, computed, effect, inject, input, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RemoteApi } from '../../core/service/remote-api';
import { Router } from '@angular/router';
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
  platformId = inject(PLATFORM_ID);

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

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const viewTimer = setTimeout(() => {
        this.eventTracker.emit({
          postId: "1",
          type: 'VIEW',
          timestamp: Date.now()
        });
      }, 2000);
    }
  }

  onAddToBookmarks() {
    // optimistic ui update
    this.isSaved.set(true);
    this.eventTracker.emit({
      postId: "1",
      type: 'FAVORITE',
      timestamp: Date.now()
    });
  }

  close() {
    this.router.navigate(['/home']);
  }
}
