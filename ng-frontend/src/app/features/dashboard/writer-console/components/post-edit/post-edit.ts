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
  description = '';

  private readonly mediaService = inject(MediaService);
  private readonly notifService = inject(NotificationService);
  private readonly tagService = inject(TagService);

  // image
  imagePreview: string | null = "https://placehold.co/400";
  cloudinaryUrl: string | null = null;
  isUploading = false;

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
      this.description = this.post.description;
      this.editedTags.set([...this.post.hashtags]);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTagInputChange(value: string): void {
    this.tagInput.set(value);
    if (value.trim().length >= 2) {
      this.tagInput$.next(value.trim());
    } else {
      this.tagSuggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  selectTag(tag: string): void {
    if (!this.currentTags().includes(tag)) {
      this.addTagToList(tag);
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
    this.imagePreview = URL.createObjectURL(file);
    this.uploadToCloudinary(file);
  }

  uploadToCloudinary(file: File) {
    this.isUploading = true;
    this.mediaService.uploadImage(file).subscribe({
      next: (res) => {
        this.isUploading = false;
        this.cloudinaryUrl = res.url;
        this.notifService.show('Image uploaded and optimized', 'success');
      },
      error: (err) => {
        this.isUploading = false;
        this.removeImage();
        this.notifService.show(err.message || 'Upload failed', 'error');
      }
    });
  }

  removeImage() {
    this.imagePreview = null;
    this.cloudinaryUrl = null;
    this.isUploading = false;
    const fileInput = document.querySelector('.file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  private build(status: WriterPost['status']): WriterPost {
    return { ...this.post, title: this.title, description: this.description, hashtags: this.editedTags(), status };
  }

  onSaveDraft() { this.saved.emit(this.build('draft')); }
  onPublish() { this.published.emit(this.build('published')); }
  onDelete() { this.deleted.emit(this.post.uuid); }
}
