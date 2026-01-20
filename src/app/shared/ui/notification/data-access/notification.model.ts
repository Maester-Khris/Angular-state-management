export type NotificationStatus = 'success' | 'error' | 'info';

export interface AppNotification {
  message: string;
  status: NotificationStatus;
  id: number;
}