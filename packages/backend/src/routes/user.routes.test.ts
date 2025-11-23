import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { createUserRoutes } from './user.routes.js';
import { UserService } from '../services/user.service.js';
import { User } from '@bookmark-manager/shared';

// Mock UserService
const mockUserService = {
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  deleteUserAccount: vi.fn(),
  getUserStats: vi.fn(),
} as unknown as UserService;

describe('User Routes', () => {
  let router: ReturnType<typeof createUserRoutes>;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createUserRoutes(mockUserService);
  });

  describe('GET /user', () => {
    it('should return user profile when authenticated', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserService.getUserProfile).mockResolvedValue(mockUser);

      const req = {
        user: { userId: 'user-123', email: 'test@example.com', plan: 'free' },
        headers: {},
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      // Get the route handler
      const routes = router.stack.filter((layer: any) => layer.route?.path === '/');
      const getRoute = routes.find((layer: any) => layer.route.methods.get);
      
      if (getRoute) {
        await getRoute.route.stack[0].handle(req, res);
      }

      expect(mockUserService.getUserProfile).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          plan: mockUser.plan,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
    });

    it('should return 401 when not authenticated', async () => {
      const req = {
        headers: {},
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const routes = router.stack.filter((layer: any) => layer.route?.path === '/');
      const getRoute = routes.find((layer: any) => layer.route.methods.get);
      
      if (getRoute) {
        await getRoute.route.stack[0].handle(req, res);
      }

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
    });
  });

  describe('GET /user/stats', () => {
    it('should return user statistics when authenticated', async () => {
      const mockStats = {
        totalBookmarks: 10,
        totalCollections: 5,
        totalTags: 15,
        totalHighlights: 3,
        storageUsedBytes: 1024000,
      };

      vi.mocked(mockUserService.getUserStats).mockResolvedValue(mockStats);

      const req = {
        user: { userId: 'user-123', email: 'test@example.com', plan: 'free' },
        headers: {},
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const routes = router.stack.filter((layer: any) => layer.route?.path === '/stats');
      const getRoute = routes.find((layer: any) => layer.route.methods.get);
      
      if (getRoute) {
        await getRoute.route.stack[0].handle(req, res);
      }

      expect(mockUserService.getUserStats).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ stats: mockStats });
    });
  });

  describe('PUT /user', () => {
    it('should update user profile when authenticated', async () => {
      const updatedUser: User = {
        id: 'user-123',
        email: 'newemail@example.com',
        name: 'Updated Name',
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserService.updateUserProfile).mockResolvedValue(updatedUser);

      const req = {
        user: { userId: 'user-123', email: 'test@example.com', plan: 'free' },
        body: { name: 'Updated Name', email: 'newemail@example.com' },
        headers: {},
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const routes = router.stack.filter((layer: any) => layer.route?.path === '/');
      const putRoute = routes.find((layer: any) => layer.route.methods.put);
      
      if (putRoute) {
        await putRoute.route.stack[0].handle(req, res);
      }

      expect(mockUserService.updateUserProfile).toHaveBeenCalledWith('user-123', {
        name: 'Updated Name',
        email: 'newemail@example.com',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('DELETE /user', () => {
    it('should delete user account when authenticated', async () => {
      vi.mocked(mockUserService.deleteUserAccount).mockResolvedValue();

      const req = {
        user: { userId: 'user-123', email: 'test@example.com', plan: 'free' },
        headers: {},
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;

      const routes = router.stack.filter((layer: any) => layer.route?.path === '/');
      const deleteRoute = routes.find((layer: any) => layer.route.methods.delete);
      
      if (deleteRoute) {
        await deleteRoute.route.stack[0].handle(req, res);
      }

      expect(mockUserService.deleteUserAccount).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
