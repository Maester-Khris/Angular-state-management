import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../dashboard/data-access/post.model';

@Component({
  selector: 'app-quick-view-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './quick-view-rail.component.html',
  styleUrl: './quick-view-rail.component.css'
})
export class QuickViewRailComponent {
  @Input({ required: true }) queue: Post[] = [];
  @Input({ required: true }) activeIndex: number = 0;
  @Output() navigate = new EventEmitter<number>();
}
