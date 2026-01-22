import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';import { submit } from '@angular/forms/signals';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  @Input() isLoading = false; // Parent controls the loading state
  @Output() onLoginLink = new EventEmitter<any>();
  @Output() onSuccess = new EventEmitter<any>();
  avatarPreview="https://i.pravatar.cc/150";
  userCreated:boolean=true;
  
  signupForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(4)]),
    bio: new FormControl('', []),
  });
  
  get f() { return this.signupForm.controls; }
  
  submit(){
     if (this.signupForm.valid){ 
      if(this.userCreated==false){
       
      }else{
        this.onSuccess.emit();
      }
      // this.onLoginLink.emit();//
      
    }
  }
  
  
 onFileSelected(event: any){

 }

}
