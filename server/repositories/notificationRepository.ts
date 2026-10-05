/**
 * Admin Notification Repository
 */
import { db } from '../database/db.ts';
import { AdminNotification } from '../types/index.ts';

export class NotificationRepository {
  public static getAll(): AdminNotification[] {
    return Array.from(db.notifications.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static getUnreadCount(): number {
    return Array.from(db.notifications.values()).filter((n) => !n.read).length;
  }

  public static markAsRead(id: string): AdminNotification | null {
    const notif = db.notifications.get(id);
    if (!notif) return null;
    notif.read = true;
    db.persist();
    return notif;
  }

  public static markAllAsRead(): void {
    for (const notif of db.notifications.values()) {
      notif.read = true;
    }
    db.persist();
  }

  public static create(notif: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>): AdminNotification {
    return db.sendNotification(notif);
  }
}
