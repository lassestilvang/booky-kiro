import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import {
  QUEUE_NAMES,
  ReminderJobData,
  createRedisConnection,
} from '../config.js';
import { ReminderService } from '../../services/reminder.service.js';
import { BookmarkRepository } from '../../repositories/bookmark.repository.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { Reminder } from '@bookmark-manager/shared';

/**
 * Reminder Worker
 *
 * Processes reminder notifications:
 * 1. Poll for due reminders
 * 2. Trigger notifications based on user preferences
 * 3. Mark reminders as completed
 */

// Initialize database pool
const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bookmark_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
});

const reminderService = new ReminderService(dbPool);
const bookmarkRepo = new BookmarkRepository(dbPool);
const userRepo = new UserRepository(dbPool);

/**
 * Send email notification
 */
async function sendEmailNotification(
  reminder: Reminder,
  userEmail: string,
  bookmarkTitle: string,
  bookmarkUrl: string
): Promise<void> {
  // In a real implementation, this would use an email service like SendGrid, AWS SES, etc.
  console.log(`[EMAIL] Sending reminder notification to ${userEmail}`);
  console.log(`  Bookmark: ${bookmarkTitle}`);
  console.log(`  URL: ${bookmarkUrl}`);
  console.log(`  Reminder ID: ${reminder.id}`);

  // TODO: Implement actual email sending
  // Example:
  // await emailService.send({
  //   to: userEmail,
  //   subject: `Reminder: ${bookmarkTitle}`,
  //   body: `You have a reminder for: ${bookmarkTitle}\n\nView it here: ${bookmarkUrl}`,
  // });
}

/**
 * Send push notification
 */
async function sendPushNotification(
  reminder: Reminder,
  userId: string,
  bookmarkTitle: string,
  bookmarkUrl: string
): Promise<void> {
  // In a real implementation, this would use a push notification service like FCM, APNS, etc.
  console.log(`[PUSH] Sending reminder notification to user ${userId}`);
  console.log(`  Bookmark: ${bookmarkTitle}`);
  console.log(`  URL: ${bookmarkUrl}`);
  console.log(`  Reminder ID: ${reminder.id}`);

  // TODO: Implement actual push notification
  // Example:
  // await pushService.send({
  //   userId,
  //   title: 'Bookmark Reminder',
  //   body: bookmarkTitle,
  //   data: {
  //     bookmarkId: reminder.bookmarkId,
  //     url: bookmarkUrl,
  //   },
  // });
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(
  reminder: Reminder,
  userId: string,
  bookmarkTitle: string,
  bookmarkUrl: string
): Promise<void> {
  // In a real implementation, this would create a notification record in the database
  // that the frontend can poll or receive via WebSocket
  console.log(`[IN-APP] Creating in-app notification for user ${userId}`);
  console.log(`  Bookmark: ${bookmarkTitle}`);
  console.log(`  URL: ${bookmarkUrl}`);
  console.log(`  Reminder ID: ${reminder.id}`);

  // TODO: Implement actual in-app notification storage
  // Example:
  // await dbPool.query(
  //   'INSERT INTO notifications (user_id, type, title, body, data, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
  //   [
  //     userId,
  //     'reminder',
  //     'Bookmark Reminder',
  //     bookmarkTitle,
  //     JSON.stringify({ bookmarkId: reminder.bookmarkId, url: bookmarkUrl }),
  //   ]
  // );
}

/**
 * Process a single reminder notification
 */
async function processReminderNotification(reminder: Reminder): Promise<void> {
  console.log(
    `Processing reminder ${reminder.id} for bookmark ${reminder.bookmarkId}`
  );

  try {
    // Get bookmark details
    const bookmark = await bookmarkRepo.findById(reminder.bookmarkId);
    if (!bookmark) {
      console.error(
        `Bookmark ${reminder.bookmarkId} not found for reminder ${reminder.id}`
      );
      // Mark reminder as completed anyway to prevent retries
      await reminderService.dismissReminder(reminder.id, reminder.ownerId);
      return;
    }

    // Get user details
    const user = await userRepo.findById(reminder.ownerId);
    if (!user) {
      console.error(
        `User ${reminder.ownerId} not found for reminder ${reminder.id}`
      );
      // Mark reminder as completed anyway to prevent retries
      await reminderService.dismissReminder(reminder.id, reminder.ownerId);
      return;
    }

    // Send notifications based on user preferences
    const notificationPromises: Promise<void>[] = [];

    for (const channel of reminder.notificationChannels) {
      switch (channel) {
        case 'email':
          notificationPromises.push(
            sendEmailNotification(
              reminder,
              user.email,
              bookmark.title,
              bookmark.url
            )
          );
          break;

        case 'push':
          notificationPromises.push(
            sendPushNotification(
              reminder,
              user.id,
              bookmark.title,
              bookmark.url
            )
          );
          break;

        case 'in_app':
          notificationPromises.push(
            sendInAppNotification(
              reminder,
              user.id,
              bookmark.title,
              bookmark.url
            )
          );
          break;

        default:
          console.warn(`Unknown notification channel: ${channel}`);
      }
    }

    // Wait for all notifications to be sent
    await Promise.all(notificationPromises);

    // Mark reminder as completed
    await reminderService.dismissReminder(reminder.id, reminder.ownerId);

    console.log(`Reminder ${reminder.id} processed successfully`);
  } catch (error) {
    console.error(`Error processing reminder ${reminder.id}:`, error);
    throw error; // Let BullMQ handle retries
  }
}

/**
 * Process reminder job
 */
async function processReminderJob(job: Job<ReminderJobData>) {
  const { reminderId } = job.data;

  console.log(`Processing reminder job for reminder ${reminderId}`);

  try {
    // Get reminder details
    const result = await dbPool.query('SELECT * FROM reminders WHERE id = $1', [
      reminderId,
    ]);

    if (result.rows.length === 0) {
      console.warn(`Reminder ${reminderId} not found`);
      return {
        reminderId,
        status: 'not_found',
        message: 'Reminder not found',
      };
    }

    const reminderRow = result.rows[0];
    const reminder: Reminder = {
      id: reminderRow.id,
      bookmarkId: reminderRow.bookmark_id,
      ownerId: reminderRow.owner_id,
      remindAt: new Date(reminderRow.remind_at),
      notificationChannels: reminderRow.notification_channels || ['in_app'],
      completed: reminderRow.completed,
      createdAt: new Date(reminderRow.created_at),
    };

    // Check if reminder is already completed
    if (reminder.completed) {
      console.log(`Reminder ${reminderId} is already completed`);
      return {
        reminderId,
        status: 'already_completed',
        message: 'Reminder already completed',
      };
    }

    // Process the reminder
    await processReminderNotification(reminder);

    return {
      reminderId,
      status: 'completed',
      message: 'Reminder notification sent successfully',
    };
  } catch (error) {
    console.error(`Error processing reminder job ${reminderId}:`, error);
    throw error; // Let BullMQ handle retries
  }
}

/**
 * Poll for due reminders and enqueue jobs
 * This function should be called periodically (e.g., every minute)
 */
export async function pollDueReminders(): Promise<number> {
  console.log('Polling for due reminders...');

  try {
    const dueReminders = await reminderService.getDueReminders();
    console.log(`Found ${dueReminders.length} due reminders`);

    // Enqueue jobs for each due reminder
    for (const reminder of dueReminders) {
      // Add job to queue
      // Note: In a real implementation, you would use the queue from config.js
      console.log(`Would enqueue reminder job for reminder ${reminder.id}`);
      // await reminderQueue.add('process-reminder', { reminderId: reminder.id });
    }

    return dueReminders.length;
  } catch (error) {
    console.error('Error polling due reminders:', error);
    throw error;
  }
}

// Create and export the worker
export const reminderWorker = new Worker(
  QUEUE_NAMES.REMINDER,
  processReminderJob,
  {
    connection: createRedisConnection(),
    concurrency: 5, // Process multiple reminders concurrently
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Worker event handlers
reminderWorker.on('completed', (job) => {
  console.log(`Reminder job ${job.id} completed successfully`);
});

reminderWorker.on('failed', (job, err) => {
  console.error(`Reminder job ${job?.id} failed:`, err.message);
});

reminderWorker.on('error', (err) => {
  console.error('Reminder worker error:', err);
});

// Graceful shutdown
export async function closeReminderWorker() {
  await reminderWorker.close();
  await dbPool.end();
}
