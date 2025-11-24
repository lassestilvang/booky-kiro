import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { SyncService, SyncEntity } from '../services/sync.service.js';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { verify } from 'jsonwebtoken';

/**
 * WebSocket Sync Handler
 *
 * Provides real-time synchronization via WebSocket connections
 * Requirement 24.1: Real-time updates via WebSocket
 */

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  deviceId?: string;
  isAlive?: boolean;
}

interface SyncMessage {
  type: 'ping' | 'subscribe' | 'unsubscribe' | 'change';
  data?: any;
}

export class SyncWebSocketHandler {
  private wss: WebSocketServer;
  private syncService: SyncService;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private publicKey: string;

  constructor(wss: WebSocketServer, db: Pool, redis: Redis, publicKey: string) {
    this.wss = wss;
    this.syncService = new SyncService(db, redis);
    this.publicKey = publicKey;
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on(
      'connection',
      (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
        this.handleConnection(ws, req);
      }
    );

    // Heartbeat to detect broken connections
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = ws as AuthenticatedWebSocket;
        if (client.isAlive === false) {
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  private async handleConnection(
    ws: AuthenticatedWebSocket,
    req: IncomingMessage
  ): Promise<void> {
    // Extract token from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const deviceId = url.searchParams.get('deviceId') || 'unknown';

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      // Verify JWT token
      const decoded = verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as { userId: string };

      ws.userId = decoded.userId;
      ws.deviceId = deviceId;
      ws.isAlive = true;

      // Add client to user's connection set
      if (!this.clients.has(decoded.userId)) {
        this.clients.set(decoded.userId, new Set());
      }
      this.clients.get(decoded.userId)!.add(ws);

      // Subscribe to sync changes for this user
      const unsubscribe = await this.syncService.subscribeToChanges(
        decoded.userId,
        (change: SyncEntity) => {
          // Don't send change back to the device that originated it
          const message = JSON.parse(JSON.stringify(change)) as any;
          if (message.excludeDeviceId !== deviceId) {
            this.sendToClient(ws, {
              type: 'change',
              data: change,
            });
          }
        }
      );

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnection(ws, unsubscribe);
      });

      // Send connection success message
      this.sendToClient(ws, {
        type: 'connected',
        data: { userId: decoded.userId, deviceId },
      });
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      ws.close(1008, 'Invalid token');
    }
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer): void {
    try {
      const message: SyncMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, { type: 'pong' });
          break;
        // Add more message types as needed
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private handleDisconnection(
    ws: AuthenticatedWebSocket,
    unsubscribe: () => void
  ): void {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
    }

    // Unsubscribe from Redis pub/sub
    unsubscribe();
  }

  private sendToClient(ws: AuthenticatedWebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast a change to all connected clients for a user
   */
  public broadcastToUser(
    userId: string,
    change: SyncEntity,
    excludeDeviceId?: string
  ): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    userClients.forEach((client) => {
      if (client.deviceId !== excludeDeviceId) {
        this.sendToClient(client, {
          type: 'change',
          data: change,
        });
      }
    });
  }

  /**
   * Get number of connected clients for a user
   */
  public getConnectedDevices(userId: string): number {
    return this.clients.get(userId)?.size || 0;
  }
}
