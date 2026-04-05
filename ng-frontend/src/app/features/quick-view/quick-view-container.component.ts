import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionQueueService } from '../../core/services/session-queue.service';
import { QuickViewRailComponent } from './quick-view-rail.component';
import { QuickViewContentComponent } from './quick-view-content.component';

@Component({
  selector: 'app-quick-view-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, QuickViewRailComponent, QuickViewContentComponent],
  templateUrl: './quick-view-container.component.html',
  styleUrl: './quick-view-container.component.css'
})
export class QuickViewContainerComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private queue    = inject(SessionQueueService);
  private document = inject(DOCUMENT);

  protected posts            = this.queue.queue;
  protected activeIndex      = this.queue.activeIndex;
  protected currentPost      = this.queue.currentPost;
  protected slideDir         = signal<'left' | 'right' | 'none'>('none');
  protected showEmptyFallback = signal(false);

  ngOnInit(): void {
    if (this.queue.queue().length === 0) {
      this.showEmptyFallback.set(true);
      return;
    }
    // Sync route param to activeIndex in case of direct URL load
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      const idx = this.queue.queue().findIndex(p => p.uuid === uuid);
      if (idx !== -1) this.queue.navigateTo(idx);
    }
  }

  // ── core navigate — direction + URL sync + scroll ────────
  onNavigate(index: number): void {
    if (index < 0 || index >= this.posts().length) return;
    const dir = index > this.activeIndex() ? 'left' : 'right';
    this.slideDir.set(dir);
    this.queue.navigateTo(index);
    this.router.navigate(['..', this.currentPost()?.uuid], {
      relativeTo: this.route,
      replaceUrl: true
    });
    this.scrollActiveIntoView();
  }

  navigateNext(): void {
    this.onNavigate(this.activeIndex() + 1);
  }

  navigatePrev(): void {
    this.onNavigate(this.activeIndex() - 1);
  }

  scrollActiveIntoView(): void {
    const activeEl = this.document.querySelector('.rail-item.active');
    activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── keyboard handler ──────────────────────────────────────
  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        this.navigatePrev();
        break;
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        this.navigateNext();
        break;
      case 'ArrowRight': {
        const uuid = this.currentPost()?.uuid;
        if (uuid) this.onReadFull(uuid);
        break;
      }
    }
  }

  onReadFull(uuid: string): void {
    this.router.navigate(['/post', uuid]);
  }

  onClose(): void {
    this.router.navigate(['../..'], { relativeTo: this.route });
  }
}
