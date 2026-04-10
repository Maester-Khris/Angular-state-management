import { Component } from '@angular/core';
import { Sidebar } from '../../../shared/ui/sidebar/sidebar';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Footer } from '../../../shared/ui/footer/footer';

@Component({
  selector: 'app-dashboard-shell',
  imports: [Sidebar, RouterOutlet, CommonModule, Footer],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class DashboardShell {
  constructor(private router: Router) {}

  isPostPage(): boolean {
    // Returns true only if we are on the /dashboard/posts route
    return this.router.url.includes('/dashboard/posts');
  }
}
