import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, DestroyRef, inject, OnInit, computed } from '@angular/core';
import { AppConfigService } from '../../core/services/app-config.service';
import { BehaviorSubject } from 'rxjs';

export type SearchMode = 'keyword' | 'hybrid';

export interface SearchEvent {
  query: string;
  mode: SearchMode;
  withAi: boolean;
}

export type SearchType = 'keyword' | 'meaning';

@Component({
  selector: 'app-search-bar',
  imports: [CommonModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css',
  host: {
    'class': 'd-block'
  }
})
export class SearchBar implements OnInit {
  @Input() searchType: SearchType = 'keyword';
  @Input() isAiActive = true;
  @Output() search = new EventEmitter<SearchEvent>();
  @Output() typeChange = new EventEmitter<SearchType>();
  @Output() aiToggle = new EventEmitter<boolean>();
  @Output() groqToggle = new EventEmitter<boolean>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  isFocused = false;

  private destroyRef = inject(DestroyRef);
  private configSvc = inject(AppConfigService);

  // Computed from server-resolved config — not from environment.ts
  aiSearchAvailable = computed(() => this.configSvc.config().features.aiSearch);

  keyboardLabel = 'CTRL + K';
  staticPlaceholder = 'Search stories, tech, and insights...';
  currentChips = new BehaviorSubject<string[]>([]);

  private chipIntervalId: any;
  private poolIndex = 0;

  private allChips: string[] = [
    "Summarize latest AI news",
    "Deep dive on LLMs",
    "Best reads this week",
    "Future of SaaS",
    "Web3 vs AI",
    "Developer productivity tips",
    "Open source trends",
    "Scaling engineering teams",
    "Product-led growth",
    "Edge computing",
    "AI Regulation updates",
    "NextJS vs SvelteKit"
  ];

  ngOnInit() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.keyboardLabel = isMac ? '⌘ K' : 'CTRL + K';

    // Initialize with first 3 chips
    const initialChips = this.allChips.slice(0, 3);
    this.currentChips.next(initialChips);
    this.poolIndex = 3;

    this.startRotations();

    this.destroyRef.onDestroy(() => {
      this.stopRotations();
    });
  }

  startRotations() {
    this.chipIntervalId = setInterval(() => {
      this.rotateChips();
    }, 4000); // Rotate one chip every 4 seconds
  }

  stopRotations() {
    if (this.chipIntervalId) clearInterval(this.chipIntervalId);
  }

  rotateChips() {
    // Remove oldest (first) and add new at the end
    const current = this.currentChips.getValue();
    const updated = [...current];
    updated.shift();
    updated.push(this.allChips[this.poolIndex]);

    this.currentChips.next(updated);
    this.poolIndex = (this.poolIndex + 1) % this.allChips.length;
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
    this.search.emit({
      query: value,
      mode: this.searchType === 'meaning' ? 'hybrid' : 'keyword',
      withAi: this.isAiActive
    });
  }

  setType(type: SearchType) {
    this.searchType = type;
    this.typeChange.emit(type);

    // Emit search event to refresh results with new mode
    this.search.emit({
      query: this.searchInput.nativeElement.value,
      mode: type === 'meaning' ? 'hybrid' : 'keyword',
      withAi: this.isAiActive
    });
  }

  toggleAi() {
    this.isAiActive = !this.isAiActive;
    this.aiToggle.emit(this.isAiActive);
    this.groqToggle.emit(this.isAiActive);
  }

  prefillSearch(value: string) {
    this.searchInput.nativeElement.value = value;
    this.search.emit({
      query: value,
      mode: this.searchType === 'meaning' ? 'hybrid' : 'keyword',
      withAi: this.isAiActive
    });
    this.searchInput.nativeElement.focus();
  }

  onSubmit() {
    this.search.emit({
      query: this.searchInput.nativeElement.value,
      mode: this.searchType === 'meaning' ? 'hybrid' : 'keyword',
      withAi: this.isAiActive
    });
  }
}
