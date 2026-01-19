import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { MockApi } from '../../core/services/mock-api';
import { Router } from '@angular/router';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { EventTracking } from '../../core/services/event-tracking';

@Component({
  selector: 'app-post-detail',
  imports: [LoadingSpinner],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css',
})
export class PostDetail implements OnInit {
  private mockApi = inject(MockApi);
  private router = inject(Router);
  private eventTracker = inject(EventTracking);

  // later can be updated with effect so that intial state comes from server respoinse if already present in bookmarks  
  isSaved = signal(false);

  title = input<string>(''); // post title automatically populated by angular due to withInputBinding() on routing navigation
  post = toSignal(
    toObservable(this.title).pipe(
      switchMap(title => this.mockApi.fetchPostByTitle(title))
    )
  );

  ngOnInit() {
    const viewTimer = setTimeout(() => {
      this.eventTracker.emit({
        postId: "1",
        type: 'VIEW',
        timestamp: Date.now()
      });
    }, 2000);
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
