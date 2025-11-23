import express, { Application } from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createUserRoutes } from './routes/user.routes.js';
import { createOAuthRoutes } from './routes/oauth.routes.js';
import { createCollectionRoutes } from './routes/collection.routes.js';
import { createBookmarkRoutes } from './routes/bookmark.routes.js';
import { createTagRoutes } from './routes/tag.routes.js';
import { createSearchRoutes } from './routes/search.routes.js';
import { createHighlightRoutes } from './routes/highlight.routes.js';
import { createFileRoutes } from './routes/file.routes.js';
import { AuthService } from './services/auth.service.js';
import { UserService } from './services/user.service.js';
import { OAuthService } from './services/oauth.service.js';
import { CollectionService } from './services/collection.service.js';
import { BookmarkService } from './services/bookmark.service.js';
import { TagService } from './services/tag.service.js';
import { SearchService } from './services/search.service.js';
import { HighlightService } from './services/highlight.service.js';
import { FileService } from './services/file.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { CollectionRepository } from './repositories/collection.repository.js';
import { BookmarkRepository } from './repositories/bookmark.repository.js';
import { TagRepository } from './repositories/tag.repository.js';
import { HighlightRepository } from './repositories/highlight.repository.js';
import { FileRepository } from './repositories/file.repository.js';
import { getStorageClient } from './utils/storage.js';
import { indexQueue } from './queue/config.js';
import { createAuthMiddleware } from './middleware/auth.middleware.js';
import { createRateLimitMiddleware } from './middleware/rate-limit.middleware.js';
import { initializeSearchIndex, checkSearchHealth } from './db/search.config.js';
import * as crypto from 'crypto';

// Generate RSA key pairs for JWT signing (in production, load from secure storage)
function generateKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
  return { privateKey, publicKey };
}

const accessKeyPair = generateKeyPair();
const refreshKeyPair = generateKeyPair();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bookmark_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Redis configuration
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});

redis.on('error', (err) => console.error('Redis Client Error', err));

// Initialize repositories
const userRepository = new UserRepository(pool);
const collectionRepository = new CollectionRepository(pool);
const bookmarkRepository = new BookmarkRepository(pool);
const tagRepository = new TagRepository(pool);
const highlightRepository = new HighlightRepository(pool);
const fileRepository = new FileRepository(pool);

// Initialize storage client
const storageClient = getStorageClient();

// Initialize services
const authService = new AuthService(
  userRepository,
  accessKeyPair.privateKey,
  accessKeyPair.publicKey,
  refreshKeyPair.privateKey,
  refreshKeyPair.publicKey
);
const userService = new UserService(userRepository);
const oauthService = new OAuthService(pool);
const collectionService = new CollectionService(collectionRepository, bookmarkRepository);
const bookmarkService = new BookmarkService(bookmarkRepository, tagRepository);
const tagService = new TagService(tagRepository);
const searchService = new SearchService();
const highlightService = new HighlightService(highlightRepository, bookmarkRepository, searchService);
const fileService = new FileService(fileRepository, bookmarkRepository, storageClient, indexQueue);

// Create Express app
const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (without rate limiting for now - will be added when Redis is connected)
app.use('/v1/auth', createAuthRoutes(authService));
app.use('/v1/oauth', createOAuthRoutes(oauthService));
app.use('/v1/user', createAuthMiddleware(authService), createUserRoutes(userService));
app.use('/v1/collections', createAuthMiddleware(authService), createCollectionRoutes(collectionService));
app.use('/v1/bookmarks', createAuthMiddleware(authService), createBookmarkRoutes(bookmarkService));
app.use('/v1/tags', createAuthMiddleware(authService), createTagRoutes(tagService));
app.use('/v1/search', createAuthMiddleware(authService), createSearchRoutes(searchService));
app.use('/v1/highlights', createHighlightRoutes(highlightService, authService));
app.use('/v1/files', createAuthMiddleware(authService), createFileRoutes(fileService));

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('Connected to Redis');

    // Initialize storage client
    await storageClient.initialize();
    console.log('Storage client initialized');

    // Initialize MeiliSearch index
    const searchHealthy = await checkSearchHealth();
    if (!searchHealthy) {
      console.warn('MeiliSearch is not available - search functionality will be limited');
    } else {
      await initializeSearchIndex();
      console.log('MeiliSearch initialized successfully');
    }

    // Add rate limiting middleware after Redis is connected
    app.use(
      createRateLimitMiddleware(redis as any, {
        windowMs: 60000, // 1 minute
        maxRequests: 100, // 100 requests per minute
      })
    );

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Bookmark Manager Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
