import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionQueueService } from '../../core/services/session-queue.service';
import { QuickViewRailComponent } from './quick-view-rail.component';
import { QuickViewContentComponent } from './quick-view-content.component';

@Component({
  selector: 'app-quick-view-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, QuickViewRailComponent, QuickViewContentComponent],
  templateUrl: './quick-view-container.component.html',
  styleUrl: './quick-view-container.component.css'
})
export class QuickViewContainerComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private queue  = inject(SessionQueueService);

  protected posts       = this.queue.queue;
  protected activeIndex = this.queue.activeIndex;
  protected currentPost = this.queue.currentPost;
  protected slideDir    = signal<'left' | 'right' | 'none'>('none');

  ngOnInit(): void {
    // Sync route param to activeIndex in case of direct URL load
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      const idx = this.queue.queue().findIndex(p => p.uuid === uuid);
      if (idx !== -1) this.queue.navigateTo(idx);
    }
  }

  onNavigate(index: number): void {
    const dir = index > this.activeIndex() ? 'left' : 'right';
    this.slideDir.set(dir);
    this.queue.navigateTo(index);
    // Update URL without full navigation — preserves overlay state
    this.router.navigate(['..', this.currentPost()?.uuid], {
      relativeTo: this.route,
      replaceUrl: true
    });
  }

  onReadFull(uuid: string): void {
    this.router.navigate(['/post', uuid]);
  }

  onClose(): void {
    this.router.navigate(['../..'], { relativeTo: this.route });
  }
}
