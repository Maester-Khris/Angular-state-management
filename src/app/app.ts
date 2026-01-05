import { Component, signal } from '@angular/core';
import {  RouterOutlet } from '@angular/router';
import { AppHeader } from './shared/ui/app-header/app-header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeader],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ngprepinterview');
}
