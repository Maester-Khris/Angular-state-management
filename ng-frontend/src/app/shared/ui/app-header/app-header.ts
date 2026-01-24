import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';
import { UserOverview } from '../user-overview/user-overview';

@Component({
  selector: 'app-header',
  imports: [RouterModule],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
  private authService = inject(AuthService);
  private readonly router = inject(Router);

  // Convert observable to signal. 
  // 'user' is now a Signal<AuthUser | null | undefined>
  user = toSignal(this.authService.user$);

  // Computed signal for the template logic
  isLoggedIn = computed(() => !!this.user());

  onLogout(): void {
  this.authService.logout();
  this.router.navigate(['/home']);
}
}
