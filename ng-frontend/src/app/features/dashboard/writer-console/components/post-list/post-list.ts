import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WriterPost } from '../../../data-access/writer.models';

@Component({
  selector: 'app-post-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './post-list.html',
})
export class PostListComponent {
  @Input({ required: true }) posts: WriterPost[] = [];
  @Output() editPost    = new EventEmitter<WriterPost>();
  @Output() deletePost  = new EventEmitter<string>();
  @Output() previewPost = new EventEmitter<WriterPost>();
}
