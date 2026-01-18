import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HasUnsavedChanges, Post } from './data-access/post.model';
import { PostStore } from './data-access/post-store';
import { AuthService } from '../../core/services/auth-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';
import { PostCard } from '../../shared/ui/post-card/post-card';
import { MockApi } from '../../core/services/mock-api';
import { MediaService } from '../../core/services/media-service';



@Component({
  selector: 'app-poststore',
  imports: [ReactiveFormsModule, CommonModule, LoadingSpinner, PostCard],
  templateUrl: './posts.html',
  styleUrl: './posts.css',
  providers: [PostStore] // Each instance of this component gets a FRESH PostStore
})
export class Posts implements OnInit, HasUnsavedChanges {  
  private readonly fb = inject(FormBuilder);
  private readonly storeService = inject(PostStore);
  private readonly authService = inject(AuthService); 
  private readonly mediaService = inject(MediaService); 
  private readonly mockApi = inject(MockApi);

  //elastic layout
  isExpanded = false;

  //form builder
  readonly addPostForm = this.fb.nonNullable.group({
    title:["",[Validators.required, Validators.minLength(10)]],
    description:["", [Validators.required]],
    isPublic:[false], 
    imageUrl:["https://miro.medium.com/v2/resize:fit:1320/format:webp/1*qkevp-qzQiw5rWcNag_HHA.jpeg"], //optional image
    authorSearch: [""], //optional coauthor
  })

  //expose the view model for the template
  readonly vm$ = this.storeService.vm$;
  user = toSignal(this.authService.user$);

  // data intialization
  readonly currentUserId = computed(() => this.user()?.id || "");
  userid$ = toObservable(this.currentUserId);
  posts = toSignal(this.storeService.posts$, { initialValue: [] });

  //search
  authorSearch = new Subject<string>();
  selectedCoAuthors: any[] = [];
  suggestions: any[] = [];

  //image 
  imagePreview: string | null = "https://placehold.co/400";
  cloudinaryUrl: string | null = null;
  isUploading = false;

  // ui state
  isLoading:boolean = false;
  errors:string[]=[];
  
  
  constructor() {
    this.initAuthorSearchStream();
  }

  ngOnInit(): void {
    this.storeService.loadPosts(this.userid$);
  }

  hasUnsavedChanges(): boolean {
    return this.addPostForm.dirty;
  }

  onAdd(): void{
    if(this.addPostForm.valid){
      const newPost: Post = {
        ...this.addPostForm.getRawValue(),
        createdAt: new Date(),
        lastModifiedAt: null,
        createdBy: this.currentUserId() // Set definitively here
      };
      this.storeService.savePost(newPost); //fire and forget -> save delegetate to internal store logic
      this.addPostForm.reset();
    }else{
      this.addPostForm.markAllAsTouched();
    }
  }
  onSaveDraft(){
    
  }


  // == =========== Recents Post ui actions ================

  onTogglePublic(title: string) {
    this.storeService.togglePostPublicStatus(title);
  }
  onEdit(title: string) {
    // this.storeService.editPost(title);
  }
  onDelete(title: string) {
    this.storeService.deletePost(title);
  }

  // ============== Form ui image upload and preview ================

  onFileSelected(event:any){
    const file = event.target.files[0];
    if (!file) return;

    this.imagePreview = URL.createObjectURL(file);
    this.uploadToCloudinary(file);
  } 
  removeImage(){
    this.imagePreview = null;
    this.cloudinaryUrl = null;
    this.isUploading = false;
    // Reset the file input so the same image can be re-selected if needed
    const fileInput = document.querySelector('.file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }
  uploadToCloudinary(file:File){
    this.isUploading = true;
    this.mediaService.uploadImage(file).subscribe({
      next: (res) => {
        this.cloudinaryUrl = res.secure_url;
        this.isUploading = false; 
        console.log("uploaded image url",this.cloudinaryUrl);
      },
      error: (err) => {
        this.isUploading = false; 
        this.removeImage();
        alert("Error uploading image");
      }
    })
  }


  // ============== Form ui author search ================
  private initAuthorSearchStream(){
    this.authorSearch.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap((query: string) => {
        if(query.length>1){
          return this.mockApi.searchAuthorByEmail(query);
        }else{
          return of([]);
        }
      }),
      tap((res: any[]) => {
        this.suggestions = res
          .filter(user => !this.selectedCoAuthors.find(selected => selected.id === user.id))
          .slice(0, 3);
      })
    ).subscribe();
  }

  onSearchAuthors(event: any) {
    console.log("fired");
    const query = event.target.value.toLowerCase();
    this.authorSearch.next(query);
  }

  selectAuthor(user: any) {
    this.selectedCoAuthors.push(user);
    this.addPostForm.get('authorSearch')?.setValue('');
    this.suggestions = [];
    this.authorSearch.next(''); // Clear the search query stream
  }

  removeAuthor(userid:number) {
    console.log(userid);  
    this.selectedCoAuthors = this.selectedCoAuthors.filter(a => a.id !== userid);
  }

  handleBackspace(event: any) {
    const value = this.addPostForm.get('authorSearch')?.value;
    // If the text input is empty, delete the last added badge
    if (!value && this.selectedCoAuthors.length > 0) {
      this.selectedCoAuthors.pop();
    }
  }
}