import { Pool } from 'pg';
import {
  Reminder,
  CreateReminderRequest,
  UpdateReminderRequest,
} from '@bookmark-manager/shared';
import { ReminderRepository } from '../repositories/reminder.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';

/**
 * Service for managing reminders
 */
export class ReminderService {
  private reminderRepository: ReminderRepository;
  private bookmarkRepository: BookmarkRepository;

  constructor(pool: Pool) {
    this.reminderRepository = new ReminderRepository(pool);
    this.bookmarkRepository = new BookmarkRepository(pool);
  }

  /**
   * Create a new reminder
   */
  async createReminder(
    ownerId: string,
    request: CreateReminderRequest
  ): Promise<Reminder> {
    // Verify bookmark exists and belongs to user
    const bookmark = await this.bookmarkRepository.findById(request.bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }
    if (bookmark.ownerId !== ownerId) {
      throw new Error('Unauthorized: Bookmark does not belong to user');
    }

    // Validate remind_at is in the future
    const remindAt = new Date(request.remindAt);
    if (remindAt <= new Date()) {
      throw new Error('Reminder time must be in the future');
    }

    const notificationChannels = request.notificationChannels || ['in_app'];

    const reminder = await this.reminderRepository.create({
      bookmarkId: request.bookmarkId,
      ownerId,
      remindAt,
      notificationChannels,
      completed: false,
    } as any);

    return reminder;
  }

  /**
   * Get reminder by ID
   */
  async getReminderById(
    reminderId: string,
    ownerId: string
  ): Promise<Reminder | null> {
    const reminder = await this.reminderRepository.findById(reminderId);
    if (!reminder) {
      return null;
    }
    if (reminder.ownerId !== ownerId) {
      throw new Error('Unauthorized: Reminder does not belong to user');
    }
    return reminder;
  }

  /**
   * Get all reminders for a user
   */
  async getUserReminders(ownerId: string): Promise<Reminder[]> {
    return this.reminderRepository.findByOwner(ownerId);
  }

  /**
   * Get active reminders for a user
   */
  async getActiveReminders(ownerId: string): Promise<Reminder[]> {
    return this.reminderRepository.findActiveByOwner(ownerId);
  }

  /**
   * Get reminders for a specific bookmark
   */
  async getBookmarkReminders(
    bookmarkId: string,
    ownerId: string
  ): Promise<Reminder[]> {
    // Verify bookmark belongs to user
    const bookmark = await this.bookmarkRepository.findById(bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }
    if (bookmark.ownerId !== ownerId) {
      throw new Error('Unauthorized: Bookmark does not belong to user');
    }

    return this.reminderRepository.findByBookmark(bookmarkId);
  }

  /**
   * Update a reminder
   */
  async updateReminder(
    reminderId: string,
    ownerId: string,
    request: UpdateReminderRequest
  ): Promise<Reminder> {
    const reminder = await this.getReminderById(reminderId, ownerId);
    if (!reminder) {
      throw new Error('Reminder not found');
    }

    let updated = reminder;

    if (request.remindAt !== undefined) {
      const remindAt = new Date(request.remindAt);
      if (remindAt <= new Date()) {
        throw new Error('Reminder time must be in the future');
      }
      const result = await this.reminderRepository.updateRemindAt(
        reminderId,
        remindAt
      );
      if (result) updated = result;
    }

    if (request.notificationChannels !== undefined) {
      const result = await this.reminderRepository.updateNotificationChannels(
        reminderId,
        request.notificationChannels
      );
      if (result) updated = result;
    }

    if (request.completed !== undefined && request.completed) {
      const result = await this.reminderRepository.markCompleted(reminderId);
      if (result) updated = result;
    }

    return updated;
  }

  /**
   * Dismiss (mark as completed) a reminder
   */
  async dismissReminder(
    reminderId: string,
    ownerId: string
  ): Promise<Reminder> {
    const reminder = await this.getReminderById(reminderId, ownerId);
    if (!reminder) {
      throw new Error('Reminder not found');
    }

    const result = await this.reminderRepository.markCompleted(reminderId);
    if (!result) {
      throw new Error('Failed to dismiss reminder');
    }

    return result;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(reminderId: string, ownerId: string): Promise<void> {
    const reminder = await this.getReminderById(reminderId, ownerId);
    if (!reminder) {
      throw new Error('Reminder not found');
    }

    await this.reminderRepository.delete(reminderId);
  }

  /**
   * Get due reminders (for worker)
   */
  async getDueReminders(): Promise<Reminder[]> {
    return this.reminderRepository.findDueReminders();
  }
}
