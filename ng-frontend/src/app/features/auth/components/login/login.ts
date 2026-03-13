import { Component, ElementRef, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth-service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  authservice = inject(AuthService);
  private router = inject(Router);

  @Input() isLoading = false; // Parent controls the loading state
  @Output() onLogin = new EventEmitter<any>();
  @Output() onForgotPassword = new EventEmitter<void>();
  @Output() onNavigateToSignup = new EventEmitter<void>();

  @ViewChild('googleBtn', { static: true }) googleBtn!: ElementRef;

  ngOnInit() {
    this.authservice.initGoogle();
    this.authservice.renderButton(this.googleBtn.nativeElement, {
      width: 400,       // ← set in pixels, must match container width
      size: 'large',
    });
  }

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(4)])
  });

  get f() { return this.loginForm.controls; }

  login() {
    if (this.loginForm.valid) {
      this.authservice.login(this.loginForm.value).subscribe(lognRes => {
        this.router.navigate(['home']);
      });
    }
  }

  submit() {
    this.login();
  }

  onGoogleSignIn() {
    // console.log('Google Sign In Clicked');
  }
}
