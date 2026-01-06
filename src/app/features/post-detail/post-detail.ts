import { Component, computed, effect, inject, input, OnInit } from '@angular/core';
import { MockApi } from '../../core/services/mock-api';
import { Router } from '@angular/router';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-post-detail',
  imports: [LoadingSpinner],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css',
})
export class PostDetail {
  private mockApi = inject(MockApi);
  private router = inject(Router);

  title = input<string>(''); // automatically populated by angular due to withInputBinding()
  post = toSignal(
    toObservable(this.title).pipe(
      switchMap(title => this.mockApi.fetchPostByTitle(title))
    )
  );

  loggingTitle = effect(() =>console.log('title changed:', this.title()  ));

  close() {
    this.router.navigate(['/home']);
  }
}
