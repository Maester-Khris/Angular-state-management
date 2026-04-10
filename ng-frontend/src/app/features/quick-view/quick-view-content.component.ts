import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../dashboard/writer-console/data-access/post.model';
import { TruncateWordsPipe } from '../../shared/pipes/truncate-words.pipe';

@Component({
  selector: 'app-quick-view-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TruncateWordsPipe],
  templateUrl: './quick-view-content.component.html',
  styleUrl: './quick-view-content.component.css'
})
export class QuickViewContentComponent {
  @Input({ required: true }) post!: Post;
  @Input() slideDir: 'left' | 'right' | 'none' = 'none';
  @Input() queue: Post[] = [];
  @Input() activeIndex: number = 0;

  @Output() readFull   = new EventEmitter<string>();
  @Output() next       = new EventEmitter<void>();
  @Output() prev       = new EventEmitter<void>();
  @Output() navigateTo = new EventEmitter<number>();

  protected isMobile = signal(typeof window !== 'undefined' && window.innerWidth <= 600);

  private startX = 0;

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth <= 600);
  }

  get upNextPosts(): Post[] {
    return this.queue.slice(this.activeIndex + 1, this.activeIndex + 4);
  }

  onReadFull(): void {
    if (this.post?.uuid) {
      this.readFull.emit(this.post.uuid);
    }
  }

  onUpNextClick(i: number): void {
    this.navigateTo.emit(this.activeIndex + 1 + i);
  }

  onTouchStart(e: TouchEvent): void {
    this.startX = e.touches[0].clientX;
  }

  onTouchEnd(e: TouchEvent): void {
    const delta = e.changedTouches[0].clientX - this.startX;
    if (Math.abs(delta) > 50) {
      delta < 0 ? this.next.emit() : this.prev.emit();
    }
  }
}
