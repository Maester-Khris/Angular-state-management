import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification-service';
import { NotificationStatus } from './data-access/notification.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notification',
  imports: [CommonModule],
  templateUrl: './notification.html',
  styleUrl: './notification.css',
})
export class Notification {
protected notifService = inject(NotificationService);

  getIcon(status: NotificationStatus) {
    return status === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle';
  }
}
