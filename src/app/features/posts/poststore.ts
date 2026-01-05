import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HasUnsavedChanges, Post } from './data-access/post.model';
import { PostStore } from './data-access/post-store';
import { AuthService } from '../../core/services/auth-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LoadingSpinner } from '../../shared/ui/loading-spinner/loading-spinner';



@Component({
  selector: 'app-poststore',
  imports: [ReactiveFormsModule, CommonModule, LoadingSpinner],
  templateUrl: './poststore.html',
  styleUrl: './poststore.css',
  providers: [PostStore] // Each instance of this component gets a FRESH PostStore
})
export class Poststore implements OnInit, HasUnsavedChanges {  
  private readonly fb = inject(FormBuilder);
  private readonly storeService = inject(PostStore);
  private readonly authService = inject(AuthService); 

  //form builder
  readonly addPostForm = this.fb.nonNullable.group({
    title:["",[Validators.required, Validators.minLength(10)]],
    description:["", [Validators.required]],
    isPublic:[false], 
    imageUrl:["https://miro.medium.com/v2/resize:fit:1320/format:webp/1*qkevp-qzQiw5rWcNag_HHA.jpeg"] //optional image
  })

  //expose the view model for the template
  readonly vm$ = this.storeService.vm$;
  user = toSignal(this.authService.user$);

  // intialization
  readonly currentUserId = computed(() => this.user()?.id || "");
  userid$ = toObservable(this.currentUserId);
  posts = toSignal(this.storeService.posts$, { initialValue: [] });

  // ui state
  isLoading:boolean = false;
  errors:string[]=[];
  
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

  onTogglePublic(title: string) {
    this.storeService.togglePostPublicStatus(title);
  }

  onDelete(title: string) {
    this.storeService.deletePost(title);
  }
}