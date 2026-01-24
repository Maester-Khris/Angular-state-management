import { Directive, ElementRef, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { EventTracking } from '../../core/services/event-tracking';

@Directive({
  selector: '[trackPreview]',
})
export class TrackPreview implements OnInit, OnDestroy {
  @Input('trackPreview') postId!: string;
  // Directly inject the reference to the element this directive is on
  private el = inject(ElementRef);
  private observer?: IntersectionObserver;
  private dwellTimer?:any; 
  private eventTracker = inject(EventTracking)


  ngOnInit(): void {
    this.observer = new IntersectionObserver((entries) =>{
      entries.forEach(entry =>{
        if(entry.isIntersecting){
          this.dwellTimer = setTimeout(() => {
            this.eventTracker.emit({
              postId: this.postId,
              type: 'PREVIEW',
              timestamp: Date.now()
            });

            // Stop observing after successful track to save resources [cite: 2025-12-31]
            this.observer?.disconnect();
          }, 1500)
        }else{
          // If they scroll away before 1.5s, cancel the timer [cite: 2025-12-31]
          clearTimeout(this.dwellTimer);
        }
      })
    })

    // this.observer.observe(document.querySelector(`[data-post-id="${this.postId}"]`)!);
    // Use the native element directly. No querySelector needed!
    this.observer.observe(this.el.nativeElement);
  }

   ngOnDestroy(): void {
    this.observer?.disconnect();
    clearTimeout(this.dwellTimer);
  }

}
