import { computed, Injectable, signal } from '@angular/core';
import { Post } from '../../features/dashboard/writer-console/data-access/post.model';

@Injectable({ providedIn: 'root' })
export class SessionQueueService {
  private readonly CAP = 30;

  readonly queue       = signal<Post[]>([]);
  readonly activeIndex = signal<number>(0);
  readonly currentPost = computed(() =>
    this.queue()[this.activeIndex()] ?? null
  );

  // Called by home when eye icon is clicked.
  // Finds the clicked post's index if already in queue,
  // otherwise resets queue to the current home batch
  // and sets activeIndex to the clicked post.
  openSession(clickedPost: Post, homeBatch: Post[]): void {
    const existingIdx = this.queue().findIndex(p => p.uuid === clickedPost.uuid);
    if (existingIdx !== -1) {
      this.activeIndex.set(existingIdx);
      return;
    }
    this.queue.set(homeBatch.slice(0, this.CAP));
    const idx = homeBatch.findIndex(p => p.uuid === clickedPost.uuid);
    this.activeIndex.set(Math.max(0, idx));
  }

  // Append more posts from a new home batch (infinite scroll integration).
  // Called by home when prefetch threshold is reached.
  enqueue(posts: Post[]): void {
    this.queue.update(q => {
      const merged = [...q, ...posts];
      return merged.length > this.CAP
        ? merged.slice(merged.length - this.CAP)
        : merged;
    });
  }

  navigateTo(index: number): void {
    if (index >= 0 && index < this.queue().length) {
      this.activeIndex.set(index);
    }
  }

  clear(): void {
    this.queue.set([]);
    this.activeIndex.set(0);
  }
}
