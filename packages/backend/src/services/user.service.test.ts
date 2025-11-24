import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { User } from '@bookmark-manager/shared';

// Mock UserRepository
const mockUserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getUserStats: vi.fn(),
} as unknown as UserRepository;

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    userService = new UserService(mockUserRepository);
  });

  describe('getUserProfile', () => {
    it('should return user profile by ID', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);

      const result = await userService.getUserProfile('user-123');

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      const result = await userService.getUserProfile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user name', async () => {
      const existingUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Old Name',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser: User = {
        ...existingUser,
        name: 'New Name',
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(mockUserRepository.update).mockResolvedValue(updatedUser);

      const result = await userService.updateUserProfile('user-123', {
        name: 'New Name',
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        ...existingUser,
        name: 'New Name',
      });
      expect(result.name).toBe('New Name');
    });

    it('should update user email if not already taken', async () => {
      const existingUser: User = {
        id: 'user-123',
        email: 'old@example.com',
        name: 'Test User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser: User = {
        ...existingUser,
        email: 'new@example.com',
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepository.update).mockResolvedValue(updatedUser);

      const result = await userService.updateUserProfile('user-123', {
        email: 'new@example.com',
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        'new@example.com'
      );
      expect(result.email).toBe('new@example.com');
    });

    it('should throw error if email is already taken', async () => {
      const existingUser: User = {
        id: 'user-123',
        email: 'old@example.com',
        name: 'Test User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const otherUser: User = {
        id: 'user-456',
        email: 'taken@example.com',
        name: 'Other User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(otherUser);

      await expect(
        userService.updateUserProfile('user-123', {
          email: 'taken@example.com',
        })
      ).rejects.toThrow('Email already in use');
    });

    it('should throw error if user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        userService.updateUserProfile('nonexistent', { name: 'New Name' })
      ).rejects.toThrow('User not found');
    });
  });

  describe('deleteUserAccount', () => {
    it('should delete user account', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockUserRepository.delete).mockResolvedValue(true);

      await userService.deleteUserAccount('user-123');

      expect(mockUserRepository.delete).toHaveBeenCalledWith('user-123');
    });

    it('should throw error if user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        userService.deleteUserAccount('nonexistent')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if deletion fails', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockUserRepository.delete).mockResolvedValue(false);

      await expect(userService.deleteUserAccount('user-123')).rejects.toThrow(
        'Failed to delete user account'
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStats = {
        totalBookmarks: 10,
        totalCollections: 5,
        totalTags: 15,
        totalHighlights: 3,
        storageUsedBytes: 1024000,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockUserRepository.getUserStats).mockResolvedValue(mockStats);

      const result = await userService.getUserStats('user-123');

      expect(mockUserRepository.getUserStats).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockStats);
    });

    it('should throw error if user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(userService.getUserStats('nonexistent')).rejects.toThrow(
        'User not found'
      );
    });
  });
});
