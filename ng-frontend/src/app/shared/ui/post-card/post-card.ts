import { Component, EventEmitter, input, Output } from '@angular/core';
import { Post } from '../../../features/dashboard/writer-console/data-access/post.model';
import { CommonModule } from '@angular/common';
import { PostViewMode } from './post-card.mode';
import { HashtagSlicePipe } from '../../pipes/hashtag-slice.pipe';

@Component({
  selector: 'app-post-card',
  imports: [CommonModule, HashtagSlicePipe],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
})
export class PostCard {
  post = input.required<Post>();
  mode = input<PostViewMode>('card');

  @Output() quickView = new EventEmitter<void>();

  onQuickView(event: MouseEvent): void {
    event.stopPropagation(); // prevent card body click triggering focus read
    this.quickView.emit();
  }
}
