import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-password-reset',
  imports: [ReactiveFormsModule],
  templateUrl: './password-reset.html',
  styleUrl: './password-reset.css',
})
export class PasswordReset {
  emailSent: boolean = false;

  @Input() isLoading = false; // Parent controls the loading state
  @Output() onBack = new EventEmitter<any>();
  @Output() onForgotPassword = new EventEmitter<void>();
  @Output() onNavigateToSignup = new EventEmitter<void>();

  resetForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  get f() { return this.resetForm.controls; }

  sendResetLink() {
    this.emailSent = true;
  }

}
