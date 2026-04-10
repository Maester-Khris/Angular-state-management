import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WriterPost } from '../../../data-access/writer.models';

@Component({
  selector: 'app-post-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-edit.html',
})
export class PostEditComponent implements OnChanges {
  @Input({ required: true }) post!: WriterPost;
  @Output() saved     = new EventEmitter<WriterPost>();
  @Output() published = new EventEmitter<WriterPost>();
  @Output() deleted   = new EventEmitter<string>();
  @Output() closed    = new EventEmitter<void>();

  title       = '';
  description = '';
  hashtags:   string[] = [];
  hashtag     = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['post']) {
      this.title       = this.post.title;
      this.description = this.post.description;
      this.hashtags    = [...this.post.hashtags];
    }
  }

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

  private build(status: WriterPost['status']): WriterPost {
    return { ...this.post, title: this.title, description: this.description, hashtags: this.hashtags, status };
  }

  onSaveDraft()  { this.saved.emit(this.build('draft')); }
  onPublish()    { this.published.emit(this.build('published')); }
  onDelete()     { this.deleted.emit(this.post.uuid); }
}
