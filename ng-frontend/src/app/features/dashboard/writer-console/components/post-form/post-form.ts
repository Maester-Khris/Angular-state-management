import { ChangeDetectionStrategy, Component, computed, ElementRef, EventEmitter, inject, OnDestroy, OnInit, Output, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, takeUntil } from 'rxjs';
import { WriterPost } from '../../../data-access/writer.models';
import { MediaService } from '../../../../../core/services/media-service';
import { NotificationService } from '../../../../../core/services/notification-service';
import { TagService } from '../../../../../core/services/tag.service';

@Component({
  selector: 'app-post-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-form.html',
  styleUrl: './post-form.css'
})
export class PostFormComponent implements OnInit, OnDestroy {
  @Output() saved = new EventEmitter<Partial<WriterPost>>();
  @Output() published = new EventEmitter<Partial<WriterPost>>();

  private readonly mediaService = inject(MediaService);
  private readonly notifService = inject(NotificationService);
  private readonly tagService = inject(TagService);

  // image
  imagePreview: string | null = "https://placehold.co/400";
  cloudinaryUrl: string | null = null;
  isUploading = false;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  title = '';
  description = signal('');

  readonly DESCRIPTION_MAX = 400;

  descriptionLength = computed(() => this.description().length);
  descriptionOverLimit = computed(() => this.descriptionLength() > this.DESCRIPTION_MAX);
  descriptionRemaining = computed(() => this.DESCRIPTION_MAX - this.descriptionLength());

  // Tag state
  formTags = signal<string[]>([]);
  tagInput = signal('');
  tagSuggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  currentTags = computed(() => this.formTags());

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

  private updateTags(tags: string[]): void { this.formTags.set(tags); }
  private addTagToList(tag: string): void { this.formTags.update(t => [...t, tag]); }

  triggerFileInput() {
    this.fileInput?.nativeElement.click();
  }

  private draft(): Partial<WriterPost> {
    return { title: this.title, description: this.description(), hashtags: this.formTags(), status: 'draft' };
  }

  onSaveDraft() { this.saved.emit(this.draft()); }
  onPublish() { this.published.emit({ ...this.draft(), status: 'published' }); }

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
}
