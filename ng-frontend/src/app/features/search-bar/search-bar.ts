import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-search-bar',
  imports: [],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css',
  host: {
    'class': 'd-block'
  }
})
export class SearchBar {
  @Output() search = new EventEmitter<string>();
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  keyboardLabel = 'CTRL + K'; // Default

  ngOnInit() {
    // Agnostic OS Detection
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.keyboardLabel = isMac ? '⌘ K' : 'CTRL + K';
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.searchInput.nativeElement.focus();
    }
  }

  onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.emit(value);
  }

  onModeChange(event: any) {
    // const value = (event.target as HTMLInputElement).value;
    // this.search.emit(value);
  }
}
