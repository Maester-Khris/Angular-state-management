import { Component, inject } from '@angular/core';
import { Login } from '../components/login/login';
import { Signup } from '../components/signup/signup';
import { OtpVerify } from '../components/otp-verify/otp-verify';
import { PasswordReset } from '../components/password-reset/password-reset';
import { Router } from '@angular/router';

export type AuthStep = 'login' | 'signup' | 'otp' | 'reset';

@Component({
  selector: 'app-auth-shell',
  imports: [Login, Signup, OtpVerify, PasswordReset],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.css',
})
export class AuthShell {
  title = 'Log In';
  subtitle = 'Become a postair';

  currentStep: AuthStep = 'login';

  tempAuthData = {
    email: '',
    password: '',
    flow: 'signup' as 'signup' | 'login',
  };

  router = inject(Router);

  ngOnInit() {
    const path = this.router.url; // e.g., '/signup'
    if (path.includes('signup')) {
      this.currentStep = 'signup';
    } else if (path.includes('login')) {
      this.currentStep = 'login';
    }
  }

  getTitle(): string {
    const titles: Record<AuthStep, string> = {
      login: 'Welcome Back',
      signup: 'Create Account',
      otp: 'Verify Email',
      reset: 'Reset Password'
    };
    return titles[this.currentStep];
  }

  getSubtitle(): string {
    const subs: Record<AuthStep, string> = {
      login: 'Please enter your details to sign in',
      signup: 'Join the community of builders today',
      otp: `We've sent a code to ${this.tempAuthData.email}`,
      reset: 'Enter your email to receive a reset link'
    };
    return subs[this.currentStep];
  }

  handleStepChange(nextstep: AuthStep, data?: any) {
    if(data?.email && data?.password){
      this.tempAuthData.email = data.email;
      this.tempAuthData.password = data.password;
    }
    this.currentStep = nextstep;
  }

  finishAuth(){

  }
  executeLogin(event:any){
    console.log(event);
  }

}
