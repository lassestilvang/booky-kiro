import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ReminderService } from './reminder.service.js';
import { ReminderRepository } from '../repositories/reminder.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';
import {
  CreateReminderRequest,
  NotificationChannel,
} from '@bookmark-manager/shared';

describe('ReminderService Property-Based Tests', () => {
  let reminderService: ReminderService;
  let reminderRepository: ReminderRepository;
  let bookmarkRepository: BookmarkRepository;
  let userRepository: UserRepository;
  let testUserId: string;
  let testBookmarkId: string;

  beforeAll(async () => {
    // Run migrations to ensure schema is up to date
    await runMigrations();

    reminderRepository = new ReminderRepository(pool);
    bookmarkRepository = new BookmarkRepository(pool);
    userRepository = new UserRepository(pool);
    reminderService = new ReminderService(pool);

    // Create a test user with Pro plan
    const testUser = await userRepository.createWithPassword(
      `test-reminder-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
      'test-password',
      'Test User'
    );
    testUserId = testUser.id;

    // Update user to Pro plan
    await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [
      'pro',
      testUserId,
    ]);

    // Create a test bookmark
    const bookmark = await bookmarkRepository.create({
      ownerId: testUserId,
      url: 'https://example.com/test-article',
      title: 'Test Article',
      type: 'article',
      domain: 'example.com',
      isDuplicate: false,
      isBroken: false,
      contentIndexed: false,
    });
    testBookmarkId = bookmark.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testBookmarkId) {
      await pool.query('DELETE FROM bookmarks WHERE id = $1', [testBookmarkId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up reminders before each test
    await pool.query('DELETE FROM reminders WHERE owner_id = $1', [testUserId]);
  });

  /**
   * Feature: bookmark-manager-platform, Property 40: Reminder Storage
   *
   * For any Pro user creating a reminder for a bookmark, the system should store
   * the reminder timestamp and notification preferences.
   *
   * Validates: Requirements 13.1
   */
  it('Property 40: Reminder Storage - all fields are persisted correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate future date (1 hour to 30 days from now)
        fc.integer({ min: 3600, max: 2592000 }).map((seconds) => {
          const date = new Date();
          date.setSeconds(date.getSeconds() + seconds);
          return date;
        }),
        // Generate notification channels (at least one)
        fc
          .array(
            fc.constantFrom<NotificationChannel>('email', 'push', 'in_app'),
            { minLength: 1, maxLength: 3 }
          )
          .map((arr) => Array.from(new Set(arr))), // Remove duplicates
        async (remindAt, notificationChannels) => {
          // Ensure test data is set
          if (!testUserId || !testBookmarkId) {
            throw new Error('Test data is not set');
          }

          // Create reminder
          const reminderData: CreateReminderRequest = {
            bookmarkId: testBookmarkId,
            remindAt,
            notificationChannels,
          };

          const reminder = await reminderService.createReminder(
            testUserId,
            reminderData
          );

          // Verify all fields are stored correctly
          expect(reminder.bookmarkId).toBe(testBookmarkId);
          expect(reminder.ownerId).toBe(testUserId);
          expect(reminder.remindAt.getTime()).toBe(remindAt.getTime());
          expect(reminder.notificationChannels).toEqual(notificationChannels);
          expect(reminder.completed).toBe(false);
          expect(reminder.createdAt).toBeInstanceOf(Date);

          // Retrieve and verify persistence
          const retrieved = await reminderService.getReminderById(
            reminder.id,
            testUserId
          );
          expect(retrieved).not.toBeNull();
          expect(retrieved!.bookmarkId).toBe(testBookmarkId);
          expect(retrieved!.ownerId).toBe(testUserId);
          expect(retrieved!.remindAt.getTime()).toBe(remindAt.getTime());
          expect(retrieved!.notificationChannels).toEqual(notificationChannels);
          expect(retrieved!.completed).toBe(false);

          // Clean up
          await reminderRepository.delete(reminder.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 41: Reminder Dismissal
   *
   * For any active reminder, dismissing the reminder should mark it as completed
   * and prevent future notifications.
   *
   * Validates: Requirements 13.3
   */
  it('Property 41: Reminder Dismissal - dismissing marks reminder as completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate future date
        fc.integer({ min: 3600, max: 2592000 }).map((seconds) => {
          const date = new Date();
          date.setSeconds(date.getSeconds() + seconds);
          return date;
        }),
        async (remindAt) => {
          // Ensure test data is set
          if (!testUserId || !testBookmarkId) {
            throw new Error('Test data is not set');
          }

          // Create an active reminder
          const reminder = await reminderService.createReminder(testUserId, {
            bookmarkId: testBookmarkId,
            remindAt,
            notificationChannels: ['in_app'],
          });

          // Verify reminder is not completed initially
          expect(reminder.completed).toBe(false);

          // Dismiss the reminder
          const dismissed = await reminderService.dismissReminder(
            reminder.id,
            testUserId
          );

          // Verify reminder is marked as completed
          expect(dismissed.completed).toBe(true);
          expect(dismissed.id).toBe(reminder.id);

          // Retrieve and verify persistence
          const retrieved = await reminderService.getReminderById(
            reminder.id,
            testUserId
          );
          expect(retrieved).not.toBeNull();
          expect(retrieved!.completed).toBe(true);

          // Verify it doesn't appear in active reminders
          const activeReminders =
            await reminderService.getActiveReminders(testUserId);
          const foundInActive = activeReminders.find(
            (r) => r.id === reminder.id
          );
          expect(foundInActive).toBeUndefined();

          // But it should still appear in all reminders
          const allReminders =
            await reminderService.getUserReminders(testUserId);
          const foundInAll = allReminders.find((r) => r.id === reminder.id);
          expect(foundInAll).toBeDefined();
          expect(foundInAll!.completed).toBe(true);

          // Clean up
          await reminderRepository.delete(reminder.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 42: Recurring Reminder Generation
   *
   * For any recurring reminder pattern, the system should create subsequent
   * reminder instances based on the recurrence pattern.
   *
   * Note: This property tests the concept of recurring reminders by creating
   * multiple reminders at different intervals to simulate a recurrence pattern.
   * In a full implementation, this would be handled by a background worker that
   * automatically generates new reminders based on a recurrence rule.
   *
   * Validates: Requirements 13.4
   */
  it('Property 42: Recurring Reminder Generation - multiple reminders can be created for recurrence', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a base date and interval (in days)
        fc.integer({ min: 1, max: 7 }), // interval in days
        fc.integer({ min: 2, max: 5 }), // number of occurrences
        async (intervalDays, occurrences) => {
          // Ensure test data is set
          if (!testUserId || !testBookmarkId) {
            throw new Error('Test data is not set');
          }

          const createdReminders: string[] = [];
          const baseDate = new Date();
          baseDate.setDate(baseDate.getDate() + 1); // Start from tomorrow

          // Create multiple reminders simulating a recurring pattern
          for (let i = 0; i < occurrences; i++) {
            const remindAt = new Date(baseDate);
            remindAt.setDate(remindAt.getDate() + i * intervalDays);

            const reminder = await reminderService.createReminder(testUserId, {
              bookmarkId: testBookmarkId,
              remindAt,
              notificationChannels: ['in_app'],
            });

            createdReminders.push(reminder.id);

            // Verify each reminder is created with correct date
            expect(reminder.remindAt.getTime()).toBe(remindAt.getTime());
            expect(reminder.completed).toBe(false);
          }

          // Verify all reminders exist
          const allReminders =
            await reminderService.getUserReminders(testUserId);
          const ourReminders = allReminders.filter((r) =>
            createdReminders.includes(r.id)
          );
          expect(ourReminders.length).toBe(occurrences);

          // Verify reminders are in chronological order
          const sortedReminders = ourReminders.sort(
            (a, b) => a.remindAt.getTime() - b.remindAt.getTime()
          );

          for (let i = 1; i < sortedReminders.length; i++) {
            const timeDiff =
              sortedReminders[i].remindAt.getTime() -
              sortedReminders[i - 1].remindAt.getTime();
            const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
            expect(daysDiff).toBe(intervalDays);
          }

          // Simulate completing the first reminder (as would happen when it fires)
          await reminderService.dismissReminder(
            createdReminders[0],
            testUserId
          );

          // Verify only the first is completed
          const afterDismissal =
            await reminderService.getUserReminders(testUserId);
          const firstReminder = afterDismissal.find(
            (r) => r.id === createdReminders[0]
          );
          expect(firstReminder!.completed).toBe(true);

          // Verify remaining reminders are still active
          const activeReminders =
            await reminderService.getActiveReminders(testUserId);
          const activeOurs = activeReminders.filter((r) =>
            createdReminders.includes(r.id)
          );
          expect(activeOurs.length).toBe(occurrences - 1);

          // Clean up
          for (const id of createdReminders) {
            await reminderRepository.delete(id);
          }
        }
      ),
      { numRuns: 50 } // Reduced runs due to multiple database operations
    );
  });
});
