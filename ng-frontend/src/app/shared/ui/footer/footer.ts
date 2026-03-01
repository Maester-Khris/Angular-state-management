import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification-service';
import { RemoteApi } from '../../../core/service/remote-api';

@Component({
  selector: 'app-footer',
  imports: [ReactiveFormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private notifService = inject(NotificationService);
  private remoteApi = inject(RemoteApi);
  fb = inject(FormBuilder);
  readonly newsletterForm = this.fb.nonNullable.group({ email: ['', [Validators.email, Validators.required]] });

  // ================= NewsLetter Form submit ================
  onEmailSubmit() {
    if (this.newsletterForm.invalid) {
      this.notifService.show('Please enter a valid email address.', 'error');
      return;
    }

    const email = this.newsletterForm.controls['email'].value;
    this.remoteApi.subscribeNewsletter(email).subscribe({
      next: (res) => {
        this.notifService.show(res.message || 'Subscribed successfully!', 'success');
        this.newsletterForm.reset();
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'Unable to subscribe to newsletter.';
        this.notifService.show(errorMsg, 'error');
      }
    });
  }
}
