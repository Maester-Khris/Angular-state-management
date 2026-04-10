import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WriterPost } from '../../../data-access/writer.models';

@Component({
  selector: 'app-post-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './post-preview.html',
})
export class PostPreviewComponent {
  @Input({ required: true }) post!: WriterPost;
  @Output() closed = new EventEmitter<void>();
}
