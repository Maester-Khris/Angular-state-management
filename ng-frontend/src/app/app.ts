import { Component, inject, signal } from '@angular/core';
import {  NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { AppHeader } from './shared/ui/app-header/app-header';
import { filter } from 'rxjs';
import { Notification } from './shared/ui/notification/notification';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeader, Notification],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Postair');
  private router = inject(Router);
  readonly isNavigating = signal(false);

  constructor(){
    this.router.events.pipe(
      filter((event: any) => 
        event instanceof NavigationStart || 
        event instanceof NavigationEnd || 
        event instanceof NavigationError || 
        event instanceof NavigationCancel)
    ).subscribe((event: any) => {
      // Toggle the signal based on the event type
      this.isNavigating.set(event instanceof NavigationStart);
    });
  }

}
