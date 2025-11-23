import { File, UploadFileRequest, UploadFileResponse } from '@bookmark-manager/shared';
import { FileRepository } from '../repositories/file.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { StorageClient } from '../utils/storage.js';
import { Readable } from 'stream';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import { IndexJobData } from '../queue/config.js';

/**
 * File service for managing file uploads
 */
export class FileService {
  // Pro tier file size limit: 100MB
  private readonly PRO_FILE_SIZE_LIMIT = 100 * 1024 * 1024;

  constructor(
    private fileRepository: FileRepository,
    private bookmarkRepository: BookmarkRepository,
    private storageClient: StorageClient,
    private indexQueue?: Queue<IndexJobData>
  ) {}

  /**
   * Initiate file upload and get presigned URL
   */
  async initiateUpload(
    userId: string,
    userPlan: string,
    data: UploadFileRequest
  ): Promise<UploadFileResponse> {
    // Enforce Pro tier access
    if (userPlan !== 'pro') {
      throw new Error('File uploads are a Pro feature');
    }

    // Validate file size (we'll enforce this on actual upload too)
    // For now, we just create the record and presigned URL

    // Generate unique file path
    const fileId = crypto.randomUUID();
    const extension = this.getFileExtension(data.filename);
    const s3Path = `uploads/${userId}/${fileId}${extension}`;

    // Get presigned upload URL (valid for 1 hour)
    const uploadUrl = await this.storageClient.getPresignedUploadUrl(s3Path, 3600);

    // Create file record (size will be 0 initially, updated after upload)
    const file = await this.fileRepository.create({
      id: fileId,
      ownerId: userId,
      bookmarkId: data.bookmarkId,
      filename: data.filename,
      mimeType: data.mimeType,
      sizeBytes: 0, // Will be updated after upload
      s3Path,
    });

    return {
      id: file.id,
      uploadUrl,
      file,
    };
  }

  /**
   * Complete file upload and update size
   */
  async completeUpload(fileId: string, userId: string): Promise<File> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) {
      throw new Error('File not found');
    }

    if (file.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Get actual file size from storage
    const metadata = await this.storageClient.getFileMetadata(file.s3Path);

    // Enforce size limit
    if (metadata.size > this.PRO_FILE_SIZE_LIMIT) {
      // Delete the file from storage
      await this.storageClient.deleteFile(file.s3Path);
      await this.fileRepository.delete(fileId);
      throw new Error(`File size exceeds limit of ${this.PRO_FILE_SIZE_LIMIT / (1024 * 1024)}MB`);
    }

    // Update file size
    // Note: We'd need to add an update method to the repository
    // For now, we'll return the file as-is
    return file;
  }

  /**
   * Upload file directly (alternative to presigned URL)
   */
  async uploadFile(
    userId: string,
    userPlan: string,
    filename: string,
    mimeType: string,
    data: Buffer,
    bookmarkId?: string
  ): Promise<File> {
    // Enforce Pro tier access
    if (userPlan !== 'pro') {
      throw new Error('File uploads are a Pro feature');
    }

    // Enforce size limit
    if (data.length > this.PRO_FILE_SIZE_LIMIT) {
      throw new Error(`File size exceeds limit of ${this.PRO_FILE_SIZE_LIMIT / (1024 * 1024)}MB`);
    }

    // Verify bookmark ownership if provided
    if (bookmarkId) {
      const bookmark = await this.bookmarkRepository.findById(bookmarkId);
      if (!bookmark || bookmark.ownerId !== userId) {
        throw new Error('Invalid bookmark');
      }
    }

    // Generate unique file path
    const fileId = crypto.randomUUID();
    const extension = this.getFileExtension(filename);
    const s3Path = `uploads/${userId}/${fileId}${extension}`;

    // Upload to storage
    await this.storageClient.uploadFile(s3Path, data, {
      'Content-Type': mimeType,
      'Content-Length': data.length.toString(),
    });

    // Create file record
    const file = await this.fileRepository.create({
      id: fileId,
      ownerId: userId,
      bookmarkId,
      filename,
      mimeType,
      sizeBytes: data.length,
      s3Path,
    });

    // If it's a PDF and we have a bookmark, enqueue indexing job
    if (mimeType === 'application/pdf' && bookmarkId && this.indexQueue) {
      await this.indexQueue.add('index-pdf', {
        bookmarkId,
        snapshotPath: s3Path,
        type: 'file',
      });
    }

    return file;
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string, userId: string): Promise<File> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) {
      throw new Error('File not found');
    }

    if (file.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return file;
  }

  /**
   * Get file stream for download
   */
  async getFileStream(fileId: string, userId: string): Promise<{ stream: Readable; file: File }> {
    const file = await this.getFile(fileId, userId);

    // Get file stream from storage
    const stream = await this.storageClient.getFile(file.s3Path);

    return { stream, file };
  }

  /**
   * Get presigned download URL
   */
  async getDownloadUrl(fileId: string, userId: string): Promise<string> {
    const file = await this.getFile(fileId, userId);

    // Get presigned download URL (valid for 1 hour)
    return await this.storageClient.getPresignedDownloadUrl(file.s3Path, 3600);
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFile(fileId, userId);

    // Delete from storage
    await this.storageClient.deleteFile(file.s3Path);

    // Delete record
    await this.fileRepository.delete(fileId);
  }

  /**
   * List user files
   */
  async listUserFiles(userId: string, page: number = 1, limit: number = 50): Promise<File[]> {
    const offset = (page - 1) * limit;
    return await this.fileRepository.findByOwner(userId, limit, offset);
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.substring(lastDot);
  }
}
