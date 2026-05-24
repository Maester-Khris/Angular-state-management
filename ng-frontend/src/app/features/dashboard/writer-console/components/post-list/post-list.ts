import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WriterPost } from '../../../data-access/writer.models';

@Component({
  selector: 'app-post-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './post-list.html',
  styleUrl: './post-list.css',
})
export class PostListComponent {
  @Input({ required: true }) posts: WriterPost[] = [];
  @Output() editPost    = new EventEmitter<WriterPost>();
  @Output() deletePost  = new EventEmitter<string>();
  @Output() previewPost = new EventEmitter<WriterPost>();

  pageSize    = 5;
  currentPage = 0;

  get totalPages() { return Math.max(1, Math.ceil(this.posts.length / this.pageSize)); }
  get pagedPosts() { return this.posts.slice(this.currentPage * this.pageSize, (this.currentPage + 1) * this.pageSize); }
  prevPage()  { if (this.currentPage > 0) this.currentPage--; }
  nextPage()  { if (this.currentPage < this.totalPages - 1) this.currentPage++; }
}
