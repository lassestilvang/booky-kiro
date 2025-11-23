import { Tag, CreateTagRequest, UpdateTagRequest, MergeTagsRequest } from '@bookmark-manager/shared';
import { TagRepository } from '../repositories/tag.repository.js';

/**
 * Tag service for managing tags
 */
export class TagService {
  constructor(private tagRepository: TagRepository) {}

  /**
   * Get all tags for a user
   */
  async getUserTags(userId: string): Promise<Tag[]> {
    return this.tagRepository.findByOwner(userId);
  }

  /**
   * Get a single tag by ID
   */
  async getTagById(tagId: string, userId: string): Promise<Tag | null> {
    const tag = await this.tagRepository.findById(tagId);

    if (!tag) {
      return null;
    }

    // Verify ownership
    if (tag.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return tag;
  }

  /**
   * Create a new tag
   */
  async createTag(userId: string, data: CreateTagRequest): Promise<Tag> {
    // Check if tag with same normalized name already exists
    const existing = await this.tagRepository.findByNormalizedName(userId, data.name);
    if (existing) {
      throw new Error('Tag with this name already exists');
    }

    return this.tagRepository.createTag(userId, data.name, data.color);
  }

  /**
   * Update a tag
   */
  async updateTag(tagId: string, userId: string, data: UpdateTagRequest): Promise<Tag> {
    // Verify ownership
    const tag = await this.tagRepository.findById(tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }

    if (tag.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // If name is being updated, check for conflicts
    if (data.name) {
      const normalizedName = data.name.trim().toLowerCase();
      const existing = await this.tagRepository.findByNormalizedName(userId, data.name);
      if (existing && existing.id !== tagId) {
        throw new Error('Tag with this name already exists');
      }
    }

    // Update tag
    const updateData: Partial<Tag> = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
      updateData.normalizedName = data.name.trim().toLowerCase();
    }
    if (data.color !== undefined) {
      updateData.color = data.color;
    }

    const updated = await this.tagRepository.update(tagId, updateData);
    if (!updated) {
      throw new Error('Failed to update tag');
    }

    return updated;
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagId: string, userId: string): Promise<void> {
    // Verify ownership
    const tag = await this.tagRepository.findById(tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }

    if (tag.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Delete tag (cascade will handle bookmark_tags)
    await this.tagRepository.delete(tagId);
  }

  /**
   * Merge multiple tags into a target tag
   */
  async mergeTags(userId: string, data: MergeTagsRequest): Promise<void> {
    // Verify all tags exist and belong to user
    const allTagIds = [...data.sourceTagIds, data.targetTagId];
    for (const tagId of allTagIds) {
      const tag = await this.tagRepository.findById(tagId);
      if (!tag) {
        throw new Error(`Tag ${tagId} not found`);
      }
      if (tag.ownerId !== userId) {
        throw new Error('Access denied');
      }
    }

    // Verify target tag is not in source tags
    if (data.sourceTagIds.includes(data.targetTagId)) {
      throw new Error('Target tag cannot be in source tags');
    }

    // Perform merge
    await this.tagRepository.mergeTags(data.sourceTagIds, data.targetTagId);
  }

  /**
   * Get popular tags for a user
   */
  async getPopularTags(userId: string, limit: number = 10): Promise<Array<Tag & { usageCount: number }>> {
    return this.tagRepository.getPopularTags(userId, limit);
  }

  /**
   * Get tag usage count
   */
  async getTagUsageCount(tagId: string, userId: string): Promise<number> {
    // Verify ownership
    const tag = await this.tagRepository.findById(tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }

    if (tag.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return this.tagRepository.getTagUsageCount(tagId);
  }
}
