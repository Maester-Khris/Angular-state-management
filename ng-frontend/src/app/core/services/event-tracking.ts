import { HostListener, inject, Injectable, OnDestroy } from '@angular/core';
import { bufferTime, filter, Subject, Subscription, tap } from 'rxjs';
import { RemoteApi } from './remote-api';
import { UserService } from '../user/user-service';
import { PostEvent } from '../../features/posts/data-access/post-event.model';

@Injectable({
  providedIn: 'root',
})
export class EventTracking implements OnDestroy {

  private eventBus = new Subject<PostEvent>();
  private batchSub!: Subscription;
  private localBuffer: PostEvent[] = []; // The "Shadow Buffer"
  private remoteApi = inject(RemoteApi);
  private userService = inject(UserService);

  constructor() {
    this.batchSub = this.eventBus.pipe(
      tap(event => {
        // Enrichment with identity before buffering
        const identity = this.userService.getTrackingIdentity();
        Object.assign(event, identity);
        if (!event.timestamp) event.timestamp = Date.now();

        // Ensure type is lowercase
        if (event.type) event.type = event.type.toLowerCase() as any;

        this.localBuffer.push(event);
      }),
      bufferTime(10000, undefined, 20),
      filter((events) => events.length > 0),
    ).subscribe((batch) => this.dispactchBatch(batch));
  }

  emit(event: PostEvent) {
    console.log(`Event ${event.type} added to bus`);
    this.eventBus.next(event);
  }

  private dispactchBatch(events: PostEvent[]) {
    this.remoteApi.logAnalyticsBatch(events).subscribe({
      next: () => {
        // We remove only the events that were just sent
        this.localBuffer = this.localBuffer.filter(e => !events.includes(e));
      },
      error: (err) => { console.error("Batch sync failed", err) },
    });
  }

  // Beacon API for the "Last Gasp" sync [cite: 2025-12-31]
  // Note: Since we use bufferTime, unsent events in the current buffer 
  // need to be flushed manually on app close.
  flushWithBeacon(remainingEvents: PostEvent[]) {
    if (remainingEvents.length > 0) {
      const blob = new Blob([JSON.stringify(remainingEvents)], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/flush', blob);
    }
  }

  @HostListener('window:beforeunload')
  onUnload() {
    // Access the current pending events not sent to remote server
    this.flushWithBeacon(this.localBuffer);
  }

  ngOnDestroy(): void {
    this.batchSub?.unsubscribe();
  }
}
