import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  imports: [],
  templateUrl: './loading-spinner.html',
  styleUrl: './loading-spinner.css',
})
export class LoadingSpinner {
  size = input<'sm' | 'md'>('md');
  label = input<string>('');
  overlay = input<boolean>(false);
}
