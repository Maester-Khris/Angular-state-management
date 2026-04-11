import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WriterPost, WriterStats } from '../data-access/writer.models';
import { HasUnsavedChanges } from '../data-access/post.model';
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
export class WriterConsole implements HasUnsavedChanges {
  posts      = signal<WriterPost[]>(getMockWriterPosts());
  stats      = signal<WriterStats>(getMockWriterStats());
  activePost = signal<WriterPost | null>(null);

  showNewForm = signal(true);   // true = expanded, false = collapsed header
  showList    = signal(false);  // false = collapsed header in default state
  showEdit    = signal(false);
  showPreview = signal(false);

  // Called when user clicks ✎ edit on a post row
  onEditPost(post: WriterPost): void {
    this.activePost.set(post);
    this.showNewForm.set(false);
    this.showList.set(true);
    this.showEdit.set(true);
    this.showPreview.set(false);  // preview NOT opened automatically
  }

  // Called when user clicks ◎ preview on a post row
  onPreviewPost(post: WriterPost): void {
    this.activePost.set(post);
    this.showNewForm.set(false);
    this.showList.set(true);
    this.showEdit.set(false);
    this.showPreview.set(true);
  }

  // Called by preview button inside edit panel topbar
  onTogglePreview(): void {
    this.showPreview.update(v => !v);
  }

  // Called by ✕ on edit panel
  onCloseEdit(): void {
    this.showEdit.set(false);
    this.showPreview.set(false);
    this.activePost.set(null);
    this.showNewForm.set(true);
    this.showList.set(false);
  }

  // Called by ✕ on preview panel
  onClosePreview(): void {
    this.showPreview.set(false);
  }

  // Called by + button on New post collapsed header
  onExpandNewPost(): void {
    this.showNewForm.set(true);
    this.showList.set(false);
    this.showEdit.set(false);
    this.showPreview.set(false);
    this.activePost.set(null);
  }

  // Called by + button on My posts collapsed header
  onExpandList(): void {
    this.showList.set(true);
    this.showNewForm.set(false);
  }

  // Called by − button on My posts expanded header
  onCollapseList(): void {
    this.showList.set(false);
  }

  // Called by − button on New post expanded header
  onCollapseNewPost(): void {
    this.showNewForm.set(false);
  }

  hasUnsavedChanges(): boolean {
    return this.showEdit();
  }

  onDraftSaved(_post: WriterPost | Partial<WriterPost>): void {}
  onPostPublished(_post: WriterPost | Partial<WriterPost>): void {}
  onDeletePost(uuid: string): void {
    this.posts.update(p => p.filter(x => x.uuid !== uuid));
    this.onCloseEdit();
  }
}
