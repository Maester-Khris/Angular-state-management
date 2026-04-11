import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WriterPost } from '../../../data-access/writer.models';
import { MediaService } from '../../../../../core/services/media-service';
import { NotificationService } from '../../../../../core/services/notification-service';

@Component({
  selector: 'app-post-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-edit.html',
})
export class PostEditComponent implements OnChanges {
  @Input({ required: true }) post!: WriterPost;
  @Output() saved = new EventEmitter<WriterPost>();
  @Output() published = new EventEmitter<WriterPost>();
  @Output() deleted = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  title = '';
  description = '';
  hashtags: string[] = [];
  hashtag = '';
  private readonly mediaService = inject(MediaService);
  private notifService = inject(NotificationService);

  //image 
  imagePreview: string | null = "https://placehold.co/400";
  cloudinaryUrl: string | null = null;
  isUploading = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['post']) {
      this.title = this.post.title;
      this.description = this.post.description;
      this.hashtags = [...this.post.hashtags];
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

  triggerFileInput() {
    this.fileInput?.nativeElement.click();
  }

  // ============== Form ui image upload and preview ================
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
        this.cloudinaryUrl = res.url; // Save the permanent URL for the final form submit
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
    // Reset the file input so the same image can be re-selected if needed
    const fileInput = document.querySelector('.file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  private build(status: WriterPost['status']): WriterPost {
    return { ...this.post, title: this.title, description: this.description, hashtags: this.hashtags, status };
  }

  onSaveDraft() { this.saved.emit(this.build('draft')); }
  onPublish() { this.published.emit(this.build('published')); }
  onDelete() { this.deleted.emit(this.post.uuid); }
}
