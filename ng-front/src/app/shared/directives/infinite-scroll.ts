import { AfterViewInit, Directive, ElementRef, EventEmitter, inject, OnDestroy, Output } from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',
})
export class InfiniteScroll implements AfterViewInit, OnDestroy{
  @Output() scrolled = new EventEmitter<void>();
  private observer!: IntersectionObserver
  private el = inject(ElementRef)

  constructor() { }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){
        this.scrolled.emit();
      }
    }, {
      root: null, // use the viewport
      threshold: 0.1 // trigger when 10% of the target element is visible
    });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

}
