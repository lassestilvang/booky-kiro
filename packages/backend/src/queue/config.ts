import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null, // Required for BullMQ
};

// Create Redis client for BullMQ
export const createRedisConnection = () => {
  return new Redis(redisConnection);
};

// Queue names
export const QUEUE_NAMES = {
  SNAPSHOT: 'snapshot-processing',
  INDEX: 'content-indexing',
  MAINTENANCE: 'maintenance-tasks',
  REMINDER: 'reminder-notifications',
} as const;

// Job priorities
export const JOB_PRIORITIES = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

// Default queue options with retry logic and exponential backoff
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Maximum retry attempts
    backoff: {
      type: 'exponential',
      delay: 2000, // Initial delay of 2 seconds
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Snapshot processing queue
export const snapshotQueue = new Queue(QUEUE_NAMES.SNAPSHOT, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: JOB_PRIORITIES.NORMAL,
  },
});

// Content indexing queue
export const indexQueue = new Queue(QUEUE_NAMES.INDEX, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: JOB_PRIORITIES.NORMAL,
  },
});

// Maintenance tasks queue
export const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: JOB_PRIORITIES.LOW,
    attempts: 2, // Fewer retries for maintenance tasks
  },
});

// Reminder notifications queue
export const reminderQueue = new Queue(QUEUE_NAMES.REMINDER, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: JOB_PRIORITIES.HIGH, // High priority for time-sensitive reminders
    attempts: 3,
  },
});

// Job data interfaces
export interface SnapshotJobData {
  bookmarkId: string;
  url: string;
  userId: string;
  userPlan: 'free' | 'pro';
}

export interface IndexJobData {
  bookmarkId: string;
  snapshotPath: string;
  type: 'article' | 'video' | 'image' | 'file' | 'document';
}

export interface MaintenanceJobData {
  type: 'duplicate-detection' | 'broken-link-scan';
  userId?: string; // Optional: for user-specific maintenance
}

export interface ReminderJobData {
  reminderId: string;
}

// Helper function to enqueue snapshot job
export async function enqueueSnapshotJob(
  data: SnapshotJobData,
  priority: number = JOB_PRIORITIES.NORMAL
) {
  return await snapshotQueue.add('process-snapshot', data, {
    priority,
    jobId: `snapshot-${data.bookmarkId}`, // Prevent duplicate jobs
  });
}

// Helper function to enqueue index job
export async function enqueueIndexJob(
  data: IndexJobData,
  priority: number = JOB_PRIORITIES.NORMAL
) {
  return await indexQueue.add('index-content', data, {
    priority,
    jobId: `index-${data.bookmarkId}`, // Prevent duplicate jobs
  });
}

// Helper function to enqueue maintenance job
export async function enqueueMaintenanceJob(
  data: MaintenanceJobData,
  priority: number = JOB_PRIORITIES.LOW
) {
  const jobId = data.userId
    ? `${data.type}-${data.userId}`
    : `${data.type}-${Date.now()}`;

  return await maintenanceQueue.add(data.type, data, {
    priority,
    jobId,
  });
}

// Helper function to enqueue reminder job
export async function enqueueReminderJob(
  data: ReminderJobData,
  priority: number = JOB_PRIORITIES.HIGH
) {
  return await reminderQueue.add('process-reminder', data, {
    priority,
    jobId: `reminder-${data.reminderId}`, // Prevent duplicate jobs
  });
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    snapshotQueue.close(),
    indexQueue.close(),
    maintenanceQueue.close(),
    reminderQueue.close(),
  ]);
}

// Get queue statistics
export async function getQueueStats(queueName: string) {
  let queue: Queue;

  switch (queueName) {
    case QUEUE_NAMES.SNAPSHOT:
      queue = snapshotQueue;
      break;
    case QUEUE_NAMES.INDEX:
      queue = indexQueue;
      break;
    case QUEUE_NAMES.MAINTENANCE:
      queue = maintenanceQueue;
      break;
    case QUEUE_NAMES.REMINDER:
      queue = reminderQueue;
      break;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed,
  };
}
