import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../posts/data-access/post.model';

@Component({
  selector: 'app-quick-view-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './quick-view-content.component.html',
  styleUrl: './quick-view-content.component.css'
})
export class QuickViewContentComponent {
  @Input({ required: true }) post!: Post;
  @Input() slideDir: 'left' | 'right' | 'none' = 'none';
  @Output() readFull = new EventEmitter<string>(); // emits uuid

  onReadFull(): void {
    if (this.post?.uuid) {
      this.readFull.emit(this.post.uuid);
    }
  }
}
