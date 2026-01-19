import { HostListener, inject, Injectable, OnDestroy } from '@angular/core';
import { buffer, bufferTime, filter, Subject, Subscription, tap } from 'rxjs';
import { EventBatch, PostEvent } from '../../features/posts/data-access/post-event.model';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class EventTracking implements OnDestroy{

  private eventBus = new Subject<PostEvent>();
  private batchSub!: Subscription;
  private localBuffer: PostEvent[] = []; // The "Shadow Buffer"
  private http = inject(HttpClient);

  constructor() {
    this.batchSub = this.eventBus.pipe(
      tap(event => this.localBuffer.push(event)), // 1. Every event that enters the bus is added to the shadow buffer
      bufferTime(10000, undefined, 20), // buffer events every 10 seconds or 20 events
      filter((events) => events.length > 0), // only emit if there are events in the buffer
    ).subscribe((batch) => this.dispactchBatch(batch));
  }

  emit(event: PostEvent) {
    console.log(`Event ${event.type} added to bus`);
    this.eventBus.next(event);
  }

  private dispactchBatch(events: PostEvent[]) {
    const payload: EventBatch = {
      events,
      batchId: crypto.randomUUID(),
      sentAt: Date.now(),
    };

    this.http.post('/api/analytics/batch', payload).subscribe({
      next: () => {
        // We remove only the events that were just sent
        this.localBuffer = this.localBuffer.filter(e => !events.includes(e));
      },
      error: (err) => {console.error("Batch sync failed",err)},
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
