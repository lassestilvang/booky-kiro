import { Pool } from 'pg';
import { Reminder, NotificationChannel } from '@bookmark-manager/shared';
import { BaseRepository } from './base.repository.js';

/**
 * Reminder repository for managing reminders
 */
export class ReminderRepository extends BaseRepository<Reminder> {
  constructor(pool: Pool) {
    super(pool, 'reminders');
  }

  /**
   * Override create to handle JSONB serialization
   */
  async create(data: Partial<Reminder>): Promise<Reminder> {
    const dataToInsert = { ...data };
    
    // Convert notification_channels array to JSON string for JSONB column
    if (dataToInsert.notificationChannels) {
      (dataToInsert as any).notificationChannels = JSON.stringify(dataToInsert.notificationChannels);
    }
    
    return super.create(dataToInsert);
  }

  /**
   * Find reminders by bookmark ID
   */
  async findByBookmark(bookmarkId: string): Promise<Reminder[]> {
    const result = await this.pool.query(
      'SELECT * FROM reminders WHERE bookmark_id = $1 ORDER BY remind_at',
      [bookmarkId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find reminders by owner ID
   */
  async findByOwner(ownerId: string): Promise<Reminder[]> {
    const result = await this.pool.query(
      'SELECT * FROM reminders WHERE owner_id = $1 ORDER BY remind_at',
      [ownerId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find active (not completed) reminders by owner ID
   */
  async findActiveByOwner(ownerId: string): Promise<Reminder[]> {
    const result = await this.pool.query(
      'SELECT * FROM reminders WHERE owner_id = $1 AND completed = false ORDER BY remind_at',
      [ownerId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find all reminders by user ID (for backups)
   */
  async findByUserId(userId: string): Promise<Reminder[]> {
    return this.findByOwner(userId);
  }

  /**
   * Find due reminders (remind_at <= now and not completed)
   */
  async findDueReminders(): Promise<Reminder[]> {
    const result = await this.pool.query(
      'SELECT * FROM reminders WHERE remind_at <= NOW() AND completed = false ORDER BY remind_at',
      []
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Mark reminder as completed
   */
  async markCompleted(reminderId: string): Promise<Reminder | null> {
    const result = await this.pool.query(
      'UPDATE reminders SET completed = true WHERE id = $1 RETURNING *',
      [reminderId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update reminder time
   */
  async updateRemindAt(reminderId: string, remindAt: Date): Promise<Reminder | null> {
    const result = await this.pool.query(
      'UPDATE reminders SET remind_at = $1 WHERE id = $2 RETURNING *',
      [remindAt, reminderId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update notification channels
   */
  async updateNotificationChannels(
    reminderId: string,
    channels: NotificationChannel[]
  ): Promise<Reminder | null> {
    const result = await this.pool.query(
      'UPDATE reminders SET notification_channels = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(channels), reminderId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  protected mapRow(row: any): Reminder {
    return {
      id: row.id,
      bookmarkId: row.bookmark_id,
      ownerId: row.owner_id,
      remindAt: new Date(row.remind_at),
      notificationChannels: row.notification_channels || ['in_app'],
      completed: row.completed,
      createdAt: new Date(row.created_at),
    };
  }
}
