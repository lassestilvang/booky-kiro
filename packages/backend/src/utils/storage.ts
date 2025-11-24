import { Client } from 'minio';
import { Readable } from 'stream';

/**
 * MinIO/S3 storage client for file uploads and snapshots
 */
export class StorageClient {
  private client: Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
    this.bucket = process.env.MINIO_BUCKET || 'bookmarks';

    this.client = new Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  /**
   * Initialize storage by ensuring bucket exists
   */
  async initialize(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1');
    }
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    path: string,
    data: Buffer | Readable,
    metadata?: Record<string, string>
  ): Promise<void> {
    const size = Buffer.isBuffer(data) ? data.length : undefined;
    await this.client.putObject(this.bucket, path, data, size, metadata);
  }

  /**
   * Get a file from storage
   */
  async getFile(path: string): Promise<Readable> {
    return await this.client.getObject(this.bucket, path);
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(path: string): Promise<void> {
    await this.client.removeObject(this.bucket, path);
  }

  /**
   * Get a presigned URL for file upload
   */
  async getPresignedUploadUrl(
    path: string,
    expirySeconds: number = 3600
  ): Promise<string> {
    return await this.client.presignedPutObject(
      this.bucket,
      path,
      expirySeconds
    );
  }

  /**
   * Get a presigned URL for file download
   */
  async getPresignedDownloadUrl(
    path: string,
    expirySeconds: number = 3600
  ): Promise<string> {
    return await this.client.presignedGetObject(
      this.bucket,
      path,
      expirySeconds
    );
  }

  /**
   * Check if a file exists
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    path: string
  ): Promise<{ size: number; etag: string; lastModified: Date }> {
    const stat = await this.client.statObject(this.bucket, path);
    return {
      size: stat.size,
      etag: stat.etag,
      lastModified: stat.lastModified,
    };
  }
}

// Singleton instance
let storageClient: StorageClient | null = null;

export function getStorageClient(): StorageClient {
  if (!storageClient) {
    storageClient = new StorageClient();
  }
  return storageClient;
}
