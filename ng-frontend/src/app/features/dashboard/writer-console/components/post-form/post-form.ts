import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WriterPost } from '../../../data-access/writer.models';

@Component({
  selector: 'app-post-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-form.html',
})
export class PostFormComponent {
  @Output() saved     = new EventEmitter<Partial<WriterPost>>();
  @Output() published = new EventEmitter<Partial<WriterPost>>();

  title       = '';
  description = '';
  hashtag     = '';
  hashtags:   string[] = [];

  addHashtag() {
    const tag = this.hashtag.trim().replace(/^#/, '');
    if (tag && !this.hashtags.includes(tag)) {
      this.hashtags = [...this.hashtags, tag];
    }
    this.hashtag = '';
  }

  removeHashtag(tag: string) {
    this.hashtags = this.hashtags.filter(h => h !== tag);
  }

  private draft(): Partial<WriterPost> {
    return { title: this.title, description: this.description, hashtags: this.hashtags, status: 'draft' };
  }

  onSaveDraft()  { this.saved.emit(this.draft()); }
  onPublish()    { this.published.emit({ ...this.draft(), status: 'published' }); }
}
