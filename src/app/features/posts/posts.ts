import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HasUnsavedChanges, Post } from './data-access/post.model';
import { PostStore } from './data-access/post-store';
import { AuthService } from '../../core/services/auth-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';
import { PostCard } from '../../shared/ui/post-card/post-card';
import { MockApi } from '../../core/services/mock-api';



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
  private readonly mockApi = inject(MockApi);

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

  // intialization
  readonly currentUserId = computed(() => this.user()?.id || "");
  userid$ = toObservable(this.currentUserId);
  posts = toSignal(this.storeService.posts$, { initialValue: [] });
  selectedCoAuthors: any[] = [];
  suggestions: any[] = [];


  // ui state
  isLoading:boolean = false;
  errors:string[]=[];
  imagePreview: string | null = "https://placehold.co/400";
  
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


  // == =========== Post ui actions ================

  onTogglePublic(title: string) {
    this.storeService.togglePostPublicStatus(title);
  }

  onEdit(title: string) {
    // this.storeService.editPost(title);
  }


  onDelete(title: string) {
    this.storeService.deletePost(title);
  }

  // == =========== Form ui interactions ================

  onFileSelected(event:any){

  }

  removeImage(){

  }

  onSearchAuthors(event: any) {
    const query = event.target.value.toLowerCase();
    if (query.length > 1) {
      // Filter logic: limit to 3 items as requested
      this.mockApi.searchAuthorByEmail(query).subscribe((res:any[]) => {
        console.log(res);
        this.suggestions = res.slice(0, 3);
        // this.suggestions = this.mockUserDatabase
        // .filter(u => 
        //   u.name.toLowerCase().includes(query) && 
        //   !this.selectedCoAuthors.some(selected => selected.id === u.id)
        // )
        // .slice(0, 3);
      });
      
    } else {
      this.suggestions = [];
    }
  }

  selectAuthor(user: any) {
    this.selectedCoAuthors.push(user);
    this.addPostForm.get('authorSearch')?.setValue('');
    this.suggestions = [];
  }

  removeAuthor(user: any) {
    this.selectedCoAuthors = this.selectedCoAuthors.filter(a => a.id !== user.id);
  }

  handleBackspace(event: any) {
    const value = this.addPostForm.get('authorSearch')?.value;
    // If the text input is empty, delete the last added badge
    if (!value && this.selectedCoAuthors.length > 0) {
      this.selectedCoAuthors.pop();
    }
  }
}