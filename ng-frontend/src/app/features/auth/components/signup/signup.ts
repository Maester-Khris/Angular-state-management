import { Component, ElementRef, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router'; import { submit } from '@angular/forms/signals';
import { AuthService } from '../../../../core/services/auth-service';
import { NotificationService } from '../../../../core/services/notification-service';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup implements OnInit {
  @Input() isLoading = false; // Parent controls the loading state
  @Output() onLoginLink = new EventEmitter<any>();
  @Output() onSuccess = new EventEmitter<any>();
  avatarPreview = "https://i.pravatar.cc/150";
  userCreated: boolean = false;
  authservice = inject(AuthService);
  private notifService = inject(NotificationService);

  @ViewChild('googleBtn', { static: true }) googleBtn!: ElementRef;

  private router = inject(Router);

  showPassword = false;
  showConfirmPassword = false;

  ngOnInit() {
    this.authservice.initGoogle(() => {
      this.router.navigate(['/dashboard']);
    });
    this.authservice.renderButton(this.googleBtn.nativeElement, {
      text: 'signup_with',
      width: 400,
      size: 'large',
    });
  }

  signupForm = new FormGroup({
    name: new FormControl('', { validators: [Validators.required], nonNullable: true }),
    email: new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
    password: new FormControl('', {
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      ],
      nonNullable: true
    }),
    confirmPassword: new FormControl('', { validators: [Validators.required], nonNullable: true }),
    bio: new FormControl('', { nonNullable: true }),
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(group: any) {
    const pass = group.get('password').value;
    const confirmPass = group.get('confirmPassword').value;
    return pass === confirmPass ? null : { passwordMismatch: true };
  }

  get f() { return this.signupForm.controls; }

  getPasswordRequirements() {
    const val = this.f.password.value;
    const requirements = [];
    if (val.length < 8) requirements.push('At least 8 characters');
    if (!/[A-Z]/.test(val)) requirements.push('One uppercase letter');
    if (!/\d/.test(val)) requirements.push('One number');
    if (!/[@$!%*?&]/.test(val)) requirements.push('One special character (@$!%*?&)');
    return requirements;
  }

  submit() {
    this.onSuccess.emit();
    // if (this.signupForm.valid) {
    //   if (this.userCreated == false) {
    //     const { name, email, password, bio } = this.signupForm.getRawValue();
    //     this.authservice.signup(name, email, password).subscribe({
    //       next: (res) => {
    //         this.userCreated = true;
    //         this.notifService.show(res.message, 'success');
    //         this.onSuccess.emit();
    //       },
    //       error: (err) => {
    //         this.notifService.show(err.error?.message || 'Signup failed', 'error');
    //       }
    //     });
    //   }
    // }
  }


  onFileSelected(event: any) {

  }

  onGoogleSignUp() {
    // console.log('Google Sign Up Clicked');
  }

}
