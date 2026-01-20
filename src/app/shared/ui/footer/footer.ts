import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification-service';

@Component({
  selector: 'app-footer',
  imports: [ReactiveFormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private notifService = inject(NotificationService); 
  fb = inject(FormBuilder);
  readonly newsletterForm = this.fb.nonNullable.group({ email: ['', [Validators.email, Validators.required]]});

  // ================= NewsLetter Form submit ================
  onEmailSubmit() {
    console.log(this.newsletterForm.controls['email'].value);
    this.notifService.show('Form saved successfully!', this.newsletterForm.valid ? 'success' : 'error');
  }
}
