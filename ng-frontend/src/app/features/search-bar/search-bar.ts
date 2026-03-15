import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, DestroyRef, inject, OnInit } from '@angular/core';

export type SearchType = 'keyword' | 'meaning';

@Component({
  selector: 'app-search-bar',
  imports: [],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css',
  host: {
    'class': 'd-block'
  }
})
export class SearchBar implements OnInit {
  @Input() searchType: SearchType = 'keyword';
  @Input() isAiActive = true;
  @Output() search = new EventEmitter<string>();
  @Output() typeChange = new EventEmitter<SearchType>();
  @Output() aiToggle = new EventEmitter<boolean>();
  @Output() groqToggle = new EventEmitter<boolean>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  isFocused = false;

  private destroyRef = inject(DestroyRef);

  keyboardLabel = 'CTRL + K';
  staticPlaceholder = 'Search stories, tech, and insights...';
  currentTip = '';
  currentChips: string[] = [];

  private tipIndex = 0;
  private chipSetIndex = 0;
  private intervalId: any;
  private chipIntervalId: any;

  private tips: string[] = [
    'Search "AI regulation" or "GPT-4"',
    'Find articles about the future of work…',
    'What are the best reads on climate tech?',
    'Search by author, tag, or exact phrase',
    'Summarize recent posts about open source LLMs',
    'Stories similar to ones I\'ve read on startups…'
  ];

  private chipSets = [
    ["Summarize latest AI news", "Deep dive on LLMs", "Best reads this week"],
    ["Future of SaaS", "Web3 vs AI", "Developer productivity tips"],
    ["Open source trends", "Scaling engineering teams", "Product-led growth"]
  ];

  ngOnInit() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.keyboardLabel = isMac ? '⌘ K' : 'CTRL + K';

    this.updateTip();
    this.updateChips();
    this.startRotations();

    this.destroyRef.onDestroy(() => {
      this.stopRotations();
    });
  }

  startRotations() {
    this.intervalId = setInterval(() => {
      if (this.searchInput?.nativeElement && !this.searchInput.nativeElement.value) {
        this.tipIndex = (this.tipIndex + 1) % this.tips.length;
        this.updateTip();
      }
    }, 3500);

    this.chipIntervalId = setInterval(() => {
      this.chipSetIndex = (this.chipSetIndex + 1) % this.chipSets.length;
      this.updateChips();
    }, 8000);
  }

  stopRotations() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.chipIntervalId) clearInterval(this.chipIntervalId);
  }

  updateTip() {
    this.currentTip = this.tips[this.tipIndex];
  }

  updateChips() {
    this.currentChips = this.chipSets[this.chipSetIndex];
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

  setType(type: SearchType) {
    this.searchType = type;
    this.typeChange.emit(type);
  }

  toggleAi() {
    this.isAiActive = !this.isAiActive;
    this.aiToggle.emit(this.isAiActive);
    this.groqToggle.emit(this.isAiActive);
  }

  prefillSearch(value: string) {
    this.searchInput.nativeElement.value = value;
    this.search.emit(value);
    this.searchInput.nativeElement.focus();
  }

  onSubmit() {
    this.search.emit(this.searchInput.nativeElement.value);
  }
}
