import { ChangeDetectionStrategy, Component, computed, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WriterPost } from '../../../data-access/writer.models';
import { PostCard } from '../../../../../shared/ui/post-card/post-card';
import { Post } from '../../../data-access/post.model';

@Component({
  selector: 'app-post-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PostCard],
  templateUrl: './post-preview.html',
})
export class PostPreviewComponent {
  @Input({ required: true }) post!: WriterPost;
  @Output() closed = new EventEmitter<void>();

  protected previewPost = computed((): Post => ({
    uuid: this.post.uuid,
    title: this.post.title,
    description: this.post.description,
    authorName: this.post.authorName,
    authorAvatar: this.post.authorAvatar,
    imageUrl: this.post.images[0],
    hashtags: this.post.hashtags,
    isPublic: this.post.status === 'published',
    isDraft: this.post.status === 'draft',
    views: this.post.views ?? 0,
    readTime: this.post.readTime,
    publishedAt: this.post.publishedAt,
    createdAt: new Date(this.post.lastEditedAt),
    lastModifiedAt: null,
    createdBy: this.post.authorName,
  }));
}
