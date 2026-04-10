import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DashboardStateService {
  // Context signal — to be implemented in a subsequent task
  readonly sidebarContext = signal<{ mode: string }>({ mode: 'default' });
}
