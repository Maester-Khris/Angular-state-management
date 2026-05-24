import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WriterPost, WriterStats } from '../data-access/writer.models';
import { HasUnsavedChanges } from '../data-access/post.model';
import { getMockWriterPosts, getMockWriterStats } from '../../../core/services/mock-api';
import { RemoteApi } from '../../../core/services/remote-api';
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
export class WriterConsole implements HasUnsavedChanges, OnInit {
  private remoteApi  = inject(RemoteApi);
  private destroyRef = inject(DestroyRef);

  posts      = signal<WriterPost[]>([]);
  stats      = signal<WriterStats>(getMockWriterStats());
  activePost = signal<WriterPost | null>(null);
  isLoading  = signal(false);
  error      = signal<string | null>(null);

  showNewForm = signal(true);
  showList    = signal(false);
  showEdit    = signal(false);
  showPreview = signal(false);

  ngOnInit(): void {
    this.isLoading.set(true);
    this.remoteApi.fetchWriterPosts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posts) => {
          this.posts.set(posts);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load posts');
          this.isLoading.set(false);
        },
      });
  }

  onEditPost(post: WriterPost): void {
    this.activePost.set(post);
    this.showNewForm.set(false);
    this.showList.set(true);
    this.showEdit.set(true);
    this.showPreview.set(false);
  }

  onPreviewPost(post: WriterPost): void {
    this.activePost.set(post);
    this.showNewForm.set(false);
    this.showList.set(true);
    this.showEdit.set(false);
    this.showPreview.set(true);
  }

  onTogglePreview(): void {
    this.showPreview.update(v => !v);
  }

  onCloseEdit(): void {
    this.showEdit.set(false);
    this.showPreview.set(false);
    this.activePost.set(null);
    this.showNewForm.set(true);
    this.showList.set(false);
  }

  onClosePreview(): void {
    this.showPreview.set(false);
  }

  onExpandNewPost(): void {
    this.showNewForm.set(true);
    this.showList.set(false);
    this.showEdit.set(false);
    this.showPreview.set(false);
    this.activePost.set(null);
  }

  onExpandList(): void {
    this.showList.set(true);
    this.showNewForm.set(false);
  }

  onCollapseList(): void {
    this.showList.set(false);
  }

  onCollapseNewPost(): void {
    this.showNewForm.set(false);
  }

  hasUnsavedChanges(): boolean {
    return this.showEdit();
  }

  onDraftSaved(draft: WriterPost | Partial<WriterPost>): void {
    const uuid = (draft as WriterPost).uuid;
    if (uuid) {
      this.remoteApi.updatePost(uuid, { ...draft, isPublic: false, isDraft: true })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const updated: WriterPost = {
              uuid,
              title:        draft.title        || '',
              description:  draft.description  || '',
              hashtags:     draft.hashtags     || [],
              images:       draft.images       || [],
              status:       'draft',
              lastEditedAt: res.lastEditedAt || res.updatedAt || new Date().toISOString(),
              authorName:   draft.authorName   || '',
              authorAvatar: draft.authorAvatar,
            };
            this.posts.update(p => p.map(x => x.uuid === uuid ? updated : x));
            this.onCloseEdit();
          },
          error: (err) => this.error.set(err.message || 'Failed to save draft'),
        });
    } else {
      this.remoteApi.createPost({ ...draft, isPublic: false, isDraft: true })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const newPost: WriterPost = {
              uuid:         res.uuid,
              title:        draft.title        || '',
              description:  draft.description  || '',
              hashtags:     draft.hashtags     || [],
              images:       draft.images       || [],
              status:       'draft',
              lastEditedAt: res.createdAt,
              authorName:   draft.authorName   || '',
              authorAvatar: draft.authorAvatar,
            };
            this.posts.update(p => [newPost, ...p]);
            this.showList.set(true);
            this.showNewForm.set(false);
          },
          error: (err) => this.error.set(err.message || 'Failed to save draft'),
        });
    }
  }

  onPostPublished(draft: WriterPost | Partial<WriterPost>): void {
    const uuid = (draft as WriterPost).uuid;
    if (uuid) {
      this.remoteApi.updatePost(uuid, { ...draft, isPublic: true, isDraft: false })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const updated: WriterPost = {
              uuid,
              title:        draft.title        || '',
              description:  draft.description  || '',
              hashtags:     draft.hashtags     || [],
              images:       draft.images       || [],
              status:       'published',
              lastEditedAt: res.lastEditedAt || res.updatedAt || new Date().toISOString(),
              publishedAt:  res.publishedAt,
              authorName:   draft.authorName   || '',
              authorAvatar: draft.authorAvatar,
            };
            this.posts.update(p => p.map(x => x.uuid === uuid ? updated : x));
            this.onCloseEdit();
          },
          error: (err) => this.error.set(err.message || 'Failed to publish post'),
        });
    } else {
      this.remoteApi.createPost({ ...draft, isPublic: true, isDraft: false })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const newPost: WriterPost = {
              uuid:         res.uuid,
              title:        draft.title        || '',
              description:  draft.description  || '',
              hashtags:     draft.hashtags     || [],
              images:       draft.images       || [],
              status:       'published',
              lastEditedAt: res.createdAt,
              publishedAt:  res.publishedAt,
              authorName:   draft.authorName   || '',
              authorAvatar: draft.authorAvatar,
            };
            this.posts.update(p => [newPost, ...p]);
            this.showList.set(true);
            this.showNewForm.set(false);
          },
          error: (err) => this.error.set(err.message || 'Failed to publish post'),
        });
    }
  }

  onDeletePost(uuid: string): void {
    const snapshot = this.posts();
    this.posts.update(p => p.filter(x => x.uuid !== uuid));
    this.onCloseEdit();
    this.remoteApi.deletePost(uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err) => {
          this.posts.set(snapshot);
          this.error.set(err.message || 'Failed to delete post');
        },
      });
  }
}
