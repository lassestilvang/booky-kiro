// Export queue configuration and helpers
export {
  snapshotQueue,
  indexQueue,
  maintenanceQueue,
  QUEUE_NAMES,
  JOB_PRIORITIES,
  enqueueSnapshotJob,
  enqueueIndexJob,
  enqueueMaintenanceJob,
  closeQueues,
  getQueueStats,
  createRedisConnection,
} from './config.js';

// Export job data types
export type {
  SnapshotJobData,
  IndexJobData,
  MaintenanceJobData,
} from './config.js';

// Export workers (for starting in separate processes)
export {
  snapshotWorker,
  closeSnapshotWorker,
} from './workers/snapshot.worker.js';
export { indexWorker, closeIndexWorker } from './workers/index.worker.js';
export {
  maintenanceWorker,
  closeMaintenanceWorker,
} from './workers/maintenance.worker.js';
