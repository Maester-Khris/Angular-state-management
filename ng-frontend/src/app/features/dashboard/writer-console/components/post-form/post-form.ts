import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, inject, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WriterPost } from '../../../data-access/writer.models';
import { MediaService } from '../../../../../core/services/media-service';
import { NotificationService } from '../../../../../core/services/notification-service';

@Component({
  selector: 'app-post-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-form.html',
  styleUrl: './post-form.css'
})
export class PostFormComponent {
  @Output() saved = new EventEmitter<Partial<WriterPost>>();
  @Output() published = new EventEmitter<Partial<WriterPost>>();

  private readonly mediaService = inject(MediaService);
  private notifService = inject(NotificationService);

  //image 
  imagePreview: string | null = "https://placehold.co/400";
  cloudinaryUrl: string | null = null;
  isUploading = false;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  title = '';
  description = '';
  hashtag = '';
  hashtags: string[] = [];
  // imagePreview: string | null = null;

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

  // onFileSelected(event: Event) {
  //   const file = (event.target as HTMLInputElement).files?.[0];
  //   if (!file) return;
  //   const reader = new FileReader();
  //   reader.onload = () => { this.imagePreview = reader.result as string; };
  //   reader.readAsDataURL(file);
  // }

  // removeImage() { this.imagePreview = null; }

  private draft(): Partial<WriterPost> {
    return { title: this.title, description: this.description, hashtags: this.hashtags, status: 'draft' };
  }

  onSaveDraft() { this.saved.emit(this.draft()); }
  onPublish() { this.published.emit({ ...this.draft(), status: 'published' }); }



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
}
