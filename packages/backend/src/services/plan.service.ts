import { UserRepository } from '../repositories/user.repository.js';
import { BackupService } from './backup.service.js';
import { User, PlanTier } from '@bookmark-manager/shared';
import { Pool } from 'pg';

export interface PlanChangeResult {
  user: User;
  backupTriggered: boolean;
  retentionApplied: boolean;
}

/**
 * Service for managing user plan tier changes
 */
export class PlanService {
  constructor(
    private userRepository: UserRepository,
    private backupService: BackupService,
    private pool: Pool
  ) {}

  /**
   * Change user plan tier (upgrade or downgrade)
   * Handles Pro feature activation/deactivation and retention policies
   */
  async changePlan(
    userId: string,
    newPlan: PlanTier
  ): Promise<PlanChangeResult> {
    // Get current user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const oldPlan = user.plan;

    // If plan is the same, no action needed
    if (oldPlan === newPlan) {
      return {
        user,
        backupTriggered: false,
        retentionApplied: false,
      };
    }

    let backupTriggered = false;
    let retentionApplied = false;

    // Handle upgrade to Pro
    if (oldPlan === 'free' && newPlan === 'pro') {
      // Update plan first
      const updatedUser = await this.userRepository.updatePlan(userId, newPlan);
      if (!updatedUser) {
        throw new Error('Failed to update user plan');
      }

      // Trigger initial backup for Pro user
      try {
        await this.backupService.generateBackup(userId, true);
        backupTriggered = true;
      } catch (error) {
        console.error('Failed to generate initial backup for Pro user:', error);
        // Don't fail the upgrade if backup fails
      }

      return {
        user: updatedUser,
        backupTriggered,
        retentionApplied: false,
      };
    }

    // Handle downgrade from Pro to free
    if (oldPlan === 'pro' && newPlan === 'free') {
      // Apply retention policies before downgrading
      try {
        await this.applyDowngradeRetentionPolicies(userId);
        retentionApplied = true;
      } catch (error) {
        console.error('Failed to apply retention policies:', error);
        // Continue with downgrade even if retention fails
      }

      // Update plan
      const updatedUser = await this.userRepository.updatePlan(userId, newPlan);
      if (!updatedUser) {
        throw new Error('Failed to update user plan');
      }

      return {
        user: updatedUser,
        backupTriggered: false,
        retentionApplied,
      };
    }

    // Should not reach here, but handle gracefully
    const updatedUser = await this.userRepository.updatePlan(userId, newPlan);
    if (!updatedUser) {
      throw new Error('Failed to update user plan');
    }

    return {
      user: updatedUser,
      backupTriggered: false,
      retentionApplied: false,
    };
  }

  /**
   * Apply retention policies when downgrading from Pro to free
   * - Delete highlights (Pro feature)
   * - Delete uploaded files (Pro feature)
   * - Delete backups (Pro feature)
   * - Keep snapshots but mark them for eventual cleanup
   */
  private async applyDowngradeRetentionPolicies(userId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Delete all highlights (Pro feature)
      await client.query('DELETE FROM highlights WHERE owner_id = $1', [
        userId,
      ]);

      // Delete all uploaded files (Pro feature)
      // Note: Actual file deletion from S3 should be handled by a background job
      await client.query('DELETE FROM files WHERE owner_id = $1', [userId]);

      // Delete all backups (Pro feature)
      // Note: Actual backup file deletion should be handled separately
      await client.query('DELETE FROM backups WHERE owner_id = $1', [userId]);

      // Delete all reminders (Pro feature)
      await client.query('DELETE FROM reminders WHERE owner_id = $1', [userId]);

      // Delete collection permissions (Pro feature - sharing)
      await client.query(
        'DELETE FROM collection_permissions WHERE collection_id IN (SELECT id FROM collections WHERE owner_id = $1)',
        [userId]
      );

      // Clear public share slugs (Pro feature)
      await client.query(
        'UPDATE collections SET share_slug = NULL, is_public = FALSE WHERE owner_id = $1',
        [userId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a user has access to Pro features
   */
  async hasProAccess(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return false;
    }
    return user.plan === 'pro';
  }

  /**
   * Enforce Pro feature access
   * Throws error if user doesn't have Pro access
   */
  async enforceProAccess(userId: string, featureName: string): Promise<void> {
    const hasAccess = await this.hasProAccess(userId);
    if (!hasAccess) {
      throw new Error(
        `Access denied: ${featureName} is a Pro feature. Please upgrade your plan.`
      );
    }
  }
}
