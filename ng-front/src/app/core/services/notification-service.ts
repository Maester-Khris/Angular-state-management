import { Injectable, signal } from '@angular/core';
import { AppNotification, NotificationStatus } from '../../shared/ui/notification/data-access/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationSignal = signal<AppNotification|null>(null);
  readonly current = this.notificationSignal.asReadonly();

  show(message: string, status: NotificationStatus = 'success') {
    const id= Date.now();
    this.notificationSignal.set({ message, status, id });

    // Auto clear after 4seconds
    setTimeout(() => {
      if (this.notificationSignal()?.id === id) {
        this.notificationSignal.set(null);
      }
    }, 4000);
  }
}
