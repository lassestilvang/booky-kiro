import { UserRepository } from '../repositories/user.repository.js';
import { User } from '@bookmark-manager/shared';

export interface UpdateUserProfileData {
  name?: string;
  email?: string;
}

export interface UserStats {
  totalBookmarks: number;
  totalCollections: number;
  totalTags: number;
  totalHighlights: number;
  storageUsedBytes: number;
}

/**
 * User service for managing user profiles and accounts
 */
export class UserService {
  constructor(private userRepository: UserRepository) {}

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    data: UpdateUserProfileData
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (data.email && data.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser) {
        throw new Error('Email already in use');
      }
    }

    // Update user
    const updatedUser = await this.userRepository.update(userId, {
      ...user,
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
    });

    if (!updatedUser) {
      throw new Error('Failed to update user profile');
    }

    return updatedUser;
  }

  /**
   * Delete user account and all associated data
   */
  async deleteUserAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Delete user (cascade will handle related data)
    const deleted = await this.userRepository.delete(userId);
    if (!deleted) {
      throw new Error('Failed to delete user account');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.userRepository.getUserStats(userId);
  }
}
