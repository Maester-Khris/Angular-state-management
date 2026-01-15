import { Component } from '@angular/core';
import { Sidebar } from '../../shared/ui/sidebar/sidebar';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Footer } from '../../shared/ui/footer/footer';

@Component({
  selector: 'app-dashboard-layout',
  imports: [Sidebar, RouterOutlet, CommonModule, Footer],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayout {
  constructor(private router: Router) {}

  isPostPage(): boolean {
    // Returns true only if we are on the /dashboard/posts route
    return this.router.url.includes('/dashboard/posts');
  }
}
