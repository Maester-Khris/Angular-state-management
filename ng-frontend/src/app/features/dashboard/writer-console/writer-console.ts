import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WriterPost, WriterStats } from '../data-access/writer.models';
import { getMockWriterPosts, getMockWriterStats } from '../../../core/services/mock-api';
import { PostFormComponent } from './components/post-form/post-form';
import { PostListComponent } from './components/post-list/post-list';
import { PostEditComponent } from './components/post-edit/post-edit';
import { PostPreviewComponent } from './components/post-preview/post-preview';

@Component({
  selector: 'app-writer-console',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PostFormComponent, PostListComponent, PostEditComponent, PostPreviewComponent],
  templateUrl: './writer-console.html',
  styleUrl: './writer-console.css',
})
export class WriterConsole {
  posts      = signal<WriterPost[]>(getMockWriterPosts());
  stats      = signal<WriterStats>(getMockWriterStats());
  activePost = signal<WriterPost | null>(null);

  showNewForm = signal(true);
  showList    = signal(true);
  showEdit    = signal(false);
  showPreview = signal(false);

  onEditPost(post: WriterPost)    { this.activePost.set(post); this.showEdit.set(true); this.showPreview.set(true); this.showNewForm.set(false); }
  onCloseEdit()                   { this.showEdit.set(false); this.showPreview.set(false); this.activePost.set(null); }
  onPreviewPost(post: WriterPost) { this.activePost.set(post); this.showPreview.set(true); }
  onClosePreview()                { this.showPreview.set(false); }
  toggleNewForm()                 { this.showNewForm.update(v => !v); }
  toggleList()                    { this.showList.update(v => !v); }
}
