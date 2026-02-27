import { Component, ElementRef, EventEmitter, inject, Input, OnDestroy, Output, QueryList, ViewChildren } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router'; import { submit } from '@angular/forms/signals';
import { NotificationService } from '../../../../core/services/notification-service';
import { AuthService } from '../../../../core/services/auth-service';

@Component({
  selector: 'app-otp-verify',
  imports: [],
  templateUrl: './otp-verify.html',
  styleUrl: './otp-verify.css',
})
export class OtpVerify implements OnDestroy {
  @ViewChildren('otpSlot') slots!: QueryList<ElementRef>;

  isSubmitting = false;
  resendTimer = 30;
  private timerInterval: any;

  authservice = inject(AuthService);
  private notifService = inject(NotificationService);

  @Input() isLoading = false; // Parent controls the loading state
  @Input() email: string = '';
  @Output() onVerified = new EventEmitter<string>()
  @Output() onLoginLink = new EventEmitter<any>();
  @Output() onBack = new EventEmitter<void>();

  constructor() {
    this.startTimer();
  }
  isOtpComplete() {
    return this.slots?.toArray().every(slot => slot.nativeElement.value !== '');
  }

  private getOtpValue(): string {
    return this.slots.map(slot => slot.nativeElement.value).join('');
  }

  submitOtp() {
    if (!this.isOtpComplete()) return;

    this.isSubmitting = true;
    const otp = this.getOtpValue();


    // this.authservice.verifyOtp(this.email, otp).subscribe({
    //   next: (res) => {
    //     this.isSubmitting = false;
    //     this.notifService.show(res.message, 'success');
    //     this.onVerified.emit(this.email);
    //   },
    //   error: (err) => {
    //     this.isSubmitting = false;
    //     this.notifService.show(err.error?.message || 'Verification failed', 'error');
    //   }
    // });
  }

  resendCode() {
    if (this.resendTimer > 0) return;

    this.authservice.resendOtp(this.email).subscribe({
      next: (res) => {
        this.notifService.show('New code sent!', 'success');
        this.startTimer();
      },
      error: (err) => this.notifService.show(err.error?.message || 'Error resending code', 'error')
    });
  }

  onKeyUp(event: KeyboardEvent, index: number) {
    const input = event.target as HTMLInputElement;

    // Move to next on input
    if (input.value && index < 5) {
      this.slots.toArray()[index + 1].nativeElement.focus();
    }

    // Move to previous on backspace
    if (event.key === 'Backspace' && !input.value && index > 0) {
      this.slots.toArray()[index - 1].nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent) {
    const data = event.clipboardData?.getData('text').trim();
    if (data && data.length === 6 && /^\d+$/.test(data)) {
      const array = data.split('');
      this.slots.forEach((slot, i) => slot.nativeElement.value = array[i]);
      this.submitOtp(); // Auto-submit on valid paste
    }
  }


  startTimer() {
    this.resendTimer = 30;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.resendTimer > 0) this.resendTimer--;
      else clearInterval(this.timerInterval);
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

}
