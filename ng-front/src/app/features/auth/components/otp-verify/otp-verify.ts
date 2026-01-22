import { Component, EventEmitter, inject, Input, OnDestroy, Output } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';import { submit } from '@angular/forms/signals';

@Component({
  selector: 'app-otp-verify',
  imports: [],
  templateUrl: './otp-verify.html',
  styleUrl: './otp-verify.css',
})
export class OtpVerify implements OnDestroy{
  isSubmitting = false;
  resendTimer = 30;
  private timerInterval: any;

  @Input() isLoading = false; // Parent controls the loading state
  @Input() email: string = '';
  @Output() onVerified = new EventEmitter<string>()
  @Output() onLoginLink = new EventEmitter<any>();
  @Output() onBack = new EventEmitter<void>();

  constructor() {
    this.startTimer();
  }

  submitOtp() {}
  resendCode() {}
  isOtpComplete() {return false}
  onKeyUp(event: KeyboardEvent, index: number) {}
  onPaste(event: ClipboardEvent) {}
  startTimer() {}

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

}
