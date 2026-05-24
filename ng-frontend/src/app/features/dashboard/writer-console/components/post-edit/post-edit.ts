import { ChangeDetectionStrategy, Component, computed, ElementRef, EventEmitter, Input, inject, OnChanges, OnDestroy, OnInit, Output, signal, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, takeUntil } from 'rxjs';
import { WriterPost } from '../../../data-access/writer.models';
import { MediaService } from '../../../../../core/services/media-service';
import { NotificationService } from '../../../../../core/services/notification-service';
import { TagService } from '../../../../../core/services/tag.service';

@Component({
  selector: 'app-post-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-edit.html',
})
export class PostEditComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) post!: WriterPost;
  @Output() saved = new EventEmitter<WriterPost>();
  @Output() published = new EventEmitter<WriterPost>();
  @Output() deleted = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  title = '';
  description = signal('');

  readonly DESCRIPTION_MAX = 400;

  descriptionLength = computed(() => this.description().length);
  descriptionOverLimit = computed(() => this.descriptionLength() > this.DESCRIPTION_MAX);
  descriptionRemaining = computed(() => this.DESCRIPTION_MAX - this.descriptionLength());

  private readonly mediaService = inject(MediaService);
  private readonly notifService = inject(NotificationService);
  private readonly tagService = inject(TagService);

  // image — parallel arrays, one entry per upload (file input disabled during upload so always in sync)
  imagePreviews: string[] = [];
  cloudinaryUrls: string[] = [];
  cloudinaryPublicIds: string[] = [];
  mediaIds: string[] = [];
  uploading = signal(false);

  // Tag state
  editedTags = signal<string[]>([]);
  tagInput = signal('');
  tagSuggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  currentTags = computed(() => this.editedTags());

  private readonly tagInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.tagInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(q => q.trim().length >= 2),
      switchMap(q => this.tagService.search(q)),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.tagSuggestions.set(results);
      this.showSuggestions.set(results.length > 0);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['post']) {
      this.title = this.post.title;
      this.description.set(this.post.description);
      this.editedTags.set([...this.post.hashtags]);
      this.imagePreviews = this.post.images ? [...this.post.images] : [];
      this.cloudinaryUrls = this.post.images ? [...this.post.images] : [];
      this.cloudinaryPublicIds = this.post.cloudinaryPublicIds ? [...this.post.cloudinaryPublicIds] : [];
      this.mediaIds = [];
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private readonly TAG_MAX_LENGTH = 20;

  onTagInputChange(value: string): void {
    const capped = value.slice(0, this.TAG_MAX_LENGTH);
    this.tagInput.set(capped);
    if (capped.trim().length >= 2) {
      this.tagInput$.next(capped.trim());
    } else {
      this.tagSuggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  selectTag(tag: string): void {
    const capped = tag.slice(0, this.TAG_MAX_LENGTH);
    if (!this.currentTags().includes(capped)) {
      this.addTagToList(capped);
    }
    this.tagInput.set('');
    this.tagSuggestions.set([]);
    this.showSuggestions.set(false);
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const value = this.tagInput().trim().replace(',', '');
      if (!value) return;
      const match = this.tagSuggestions().find(t => t.toLowerCase() === value.toLowerCase());
      this.selectTag(match ?? value.toLowerCase());
    }
    if (event.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  removeTag(tag: string): void {
    this.updateTags(this.currentTags().filter(t => t !== tag));
  }

  private updateTags(tags: string[]): void { this.editedTags.set(tags); }
  private addTagToList(tag: string): void { this.editedTags.update(t => [...t, tag]); }

  triggerFileInput() {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const previewIndex = this.imagePreviews.length;
    this.imagePreviews = [...this.imagePreviews, URL.createObjectURL(file)];
    this.uploadToCloudinary(file, previewIndex);
  }

  uploadToCloudinary(file: File, previewIndex: number) {
    this.uploading.set(true);
    this.mediaService.uploadImage(file, 'post').subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.cloudinaryUrls = [...this.cloudinaryUrls, res.url];
        this.cloudinaryPublicIds = [...this.cloudinaryPublicIds, res.publicId];
        this.mediaIds = [...this.mediaIds, res.mediaId];
        this.notifService.show('Image uploaded and optimized', 'success');
      },
      error: (err) => {
        this.uploading.set(false);
        this.imagePreviews = this.imagePreviews.filter((_, i) => i !== previewIndex);
        this.notifService.show(err.message || 'Upload failed', 'error');
      }
    });
  }

  removeImage(index: number) {
    this.imagePreviews = this.imagePreviews.filter((_, i) => i !== index);
    this.cloudinaryUrls = this.cloudinaryUrls.filter((_, i) => i !== index);
    this.cloudinaryPublicIds = this.cloudinaryPublicIds.filter((_, i) => i !== index);
    this.mediaIds = this.mediaIds.filter((_, i) => i !== index);
  }

  private build(status: WriterPost['status']): WriterPost {
    return {
      ...this.post,
      title: this.title,
      description: this.description(),
      hashtags: this.editedTags(),
      status,
      images: [...this.cloudinaryUrls],
      cloudinaryPublicIds: [...this.cloudinaryPublicIds],
    };
  }

  onSaveDraft() { this.saved.emit(this.build('draft')); }
  onPublish() { this.published.emit(this.build('published')); }
  onDelete() { this.deleted.emit(this.post.uuid); }
}
