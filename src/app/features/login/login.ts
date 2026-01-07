import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  authservice = inject(AuthService);
  private router = inject(Router);

  userEmail = "niki@gmail.com";
  userPassword = "1234";
  
  login() {
    // console.log(this.userEmail, this.userPassword);
    this.authservice.login().subscribe(lognRes =>{
      this.router.navigate(['home']);
    })
  }
}
