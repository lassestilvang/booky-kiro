import {
  Bookmark,
  BookmarkWithRelations,
  Collection,
  Tag,
  ExportFormat,
} from '@bookmark-manager/shared';
import {
  BookmarkRepository,
  BookmarkFilters,
} from '../repositories/bookmark.repository.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';

/**
 * Export service for exporting bookmarks in various formats
 */
export class ExportService {
  constructor(
    private bookmarkRepository: BookmarkRepository,
    private collectionRepository: CollectionRepository,
    private tagRepository: TagRepository
  ) {}

  /**
   * Export bookmarks to specified format
   */
  async exportBookmarks(
    userId: string,
    format: ExportFormat,
    collectionId?: string,
    filters?: Partial<BookmarkFilters>
  ): Promise<string> {
    // Normalize filters to ensure arrays where expected
    if (filters) {
      if (filters.type && typeof filters.type === 'string') {
        filters.type = [filters.type as any];
      }
      if (filters.domain && typeof filters.domain === 'string') {
        filters.domain = [filters.domain as any];
      }
      if (filters.tags && typeof filters.tags === 'string') {
        filters.tags = [filters.tags as any];
      }
    }
    // Get bookmarks based on collection or filters
    let bookmarks: BookmarkWithRelations[];

    if (collectionId) {
      // Export specific collection
      const collection = await this.collectionRepository.findById(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }
      if (collection.ownerId !== userId) {
        throw new Error('Access denied');
      }

      // Get all bookmarks in collection with relations
      const simpleBookmarks =
        await this.bookmarkRepository.findByCollection(collectionId);
      bookmarks = await Promise.all(
        simpleBookmarks.map(async (b) => {
          const withRelations =
            await this.bookmarkRepository.findByIdWithRelations(b.id);
          return withRelations!;
        })
      );
    } else if (filters) {
      // Export filtered bookmarks
      const bookmarkFilters: BookmarkFilters = {
        ownerId: userId,
        ...filters,
      };

      const { bookmarks: simpleBookmarks } =
        await this.bookmarkRepository.findWithFilters(bookmarkFilters);

      bookmarks = await Promise.all(
        simpleBookmarks.map(async (b) => {
          const withRelations =
            await this.bookmarkRepository.findByIdWithRelations(b.id);
          return withRelations!;
        })
      );
    } else {
      // Export all bookmarks
      const { bookmarks: simpleBookmarks } =
        await this.bookmarkRepository.findWithFilters({
          ownerId: userId,
        });

      bookmarks = await Promise.all(
        simpleBookmarks.map(async (b) => {
          const withRelations =
            await this.bookmarkRepository.findByIdWithRelations(b.id);
          return withRelations!;
        })
      );
    }

    // Generate export based on format
    switch (format) {
      case 'html':
        return this.exportToHtml(bookmarks, collectionId, userId);
      case 'csv':
        return this.exportToCsv(bookmarks);
      case 'txt':
        return this.exportToTxt(bookmarks);
      case 'json':
        return this.exportToJson(bookmarks, collectionId, userId);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to HTML (Netscape Bookmark Format)
   * Browser-compatible format
   */
  private async exportToHtml(
    bookmarks: BookmarkWithRelations[],
    collectionId: string | undefined,
    userId: string
  ): Promise<string> {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    if (collectionId) {
      // Export single collection with hierarchy
      const collection = await this.collectionRepository.findById(collectionId);
      if (collection) {
        html += await this.exportCollectionToHtml(
          collection,
          bookmarks,
          userId
        );
      }
    } else {
      // Export all bookmarks grouped by collection
      const collections = await this.collectionRepository.findByOwner(userId);
      const collectionMap = new Map(collections.map((c) => [c.id, c]));

      // Group bookmarks by collection
      const bookmarksByCollection = new Map<
        string | null,
        BookmarkWithRelations[]
      >();
      for (const bookmark of bookmarks) {
        const key = bookmark.collectionId || null;
        if (!bookmarksByCollection.has(key)) {
          bookmarksByCollection.set(key, []);
        }
        bookmarksByCollection.get(key)!.push(bookmark);
      }

      // Export uncategorized bookmarks first
      const uncategorized = bookmarksByCollection.get(null) || [];
      for (const bookmark of uncategorized) {
        html += this.bookmarkToHtml(bookmark);
      }

      // Export each collection
      for (const collection of collections) {
        const collectionBookmarks =
          bookmarksByCollection.get(collection.id) || [];
        if (collectionBookmarks.length > 0) {
          html += `    <DT><H3>${this.escapeHtml(collection.title)}</H3>\n`;
          html += `    <DL><p>\n`;
          for (const bookmark of collectionBookmarks) {
            html += this.bookmarkToHtml(bookmark, 2);
          }
          html += `    </DL><p>\n`;
        }
      }
    }

    html += `</DL><p>\n`;
    return html;
  }

  /**
   * Export a collection to HTML recursively
   */
  private async exportCollectionToHtml(
    collection: Collection,
    bookmarks: BookmarkWithRelations[],
    userId: string,
    indent: number = 1
  ): Promise<string> {
    const indentStr = '    '.repeat(indent);
    let html = `${indentStr}<DT><H3>${this.escapeHtml(collection.title)}</H3>\n`;
    html += `${indentStr}<DL><p>\n`;

    // Export bookmarks in this collection
    const collectionBookmarks = bookmarks.filter(
      (b) => b.collectionId === collection.id
    );
    for (const bookmark of collectionBookmarks) {
      html += this.bookmarkToHtml(bookmark, indent + 1);
    }

    // Export child collections recursively
    const children = await this.collectionRepository.findChildren(
      collection.id
    );
    for (const child of children) {
      html += await this.exportCollectionToHtml(
        child,
        bookmarks,
        userId,
        indent + 1
      );
    }

    html += `${indentStr}</DL><p>\n`;
    return html;
  }

  /**
   * Convert bookmark to HTML format
   */
  private bookmarkToHtml(
    bookmark: BookmarkWithRelations,
    indent: number = 1
  ): string {
    const indentStr = '    '.repeat(indent);
    const addDate = Math.floor(new Date(bookmark.createdAt).getTime() / 1000);
    const tags = bookmark.tags.map((t) => t.name).join(',');
    const tagsAttr = tags ? ` TAGS="${this.escapeHtml(tags)}"` : '';

    return `${indentStr}<DT><A HREF="${this.escapeHtml(bookmark.url)}" ADD_DATE="${addDate}"${tagsAttr}>${this.escapeHtml(bookmark.title)}</A>\n`;
  }

  /**
   * Export to CSV format
   */
  private exportToCsv(bookmarks: BookmarkWithRelations[]): string {
    // CSV header
    let csv = 'Title,URL,Excerpt,Domain,Type,Tags,Created At,Updated At\n';

    // CSV rows
    for (const bookmark of bookmarks) {
      const tags = bookmark.tags.map((t) => t.name).join(';');
      const row = [
        this.escapeCsv(bookmark.title),
        this.escapeCsv(bookmark.url),
        this.escapeCsv(bookmark.excerpt || ''),
        this.escapeCsv(bookmark.domain),
        this.escapeCsv(bookmark.type),
        this.escapeCsv(tags),
        this.escapeCsv(new Date(bookmark.createdAt).toISOString()),
        this.escapeCsv(new Date(bookmark.updatedAt).toISOString()),
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Export to plain text format
   */
  private exportToTxt(bookmarks: BookmarkWithRelations[]): string {
    let txt = '';

    for (const bookmark of bookmarks) {
      txt += `${bookmark.title}\n`;
      txt += `${bookmark.url}\n`;
      if (bookmark.excerpt) {
        txt += `${bookmark.excerpt}\n`;
      }
      if (bookmark.tags.length > 0) {
        txt += `Tags: ${bookmark.tags.map((t) => t.name).join(', ')}\n`;
      }
      txt += '\n';
    }

    return txt;
  }

  /**
   * Export to JSON format with complete metadata
   */
  private async exportToJson(
    bookmarks: BookmarkWithRelations[],
    collectionId: string | undefined,
    userId: string
  ): Promise<string> {
    // Get all collections if exporting all bookmarks
    let collections: Collection[] = [];
    if (!collectionId) {
      collections = await this.collectionRepository.findByOwner(userId);
    } else {
      const collection = await this.collectionRepository.findById(collectionId);
      if (collection) {
        collections = [collection];
        // Include child collections
        const children = await this.getCollectionHierarchy(collection.id);
        collections.push(...children);
      }
    }

    // Get all unique tags from bookmarks
    const tagIds = new Set<string>();
    for (const bookmark of bookmarks) {
      for (const tag of bookmark.tags) {
        tagIds.add(tag.id);
      }
    }
    const tags = await Promise.all(
      Array.from(tagIds).map((id) => this.tagRepository.findById(id))
    );
    const validTags = tags.filter((t): t is Tag => t !== null);

    // Build export data
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      bookmarks: bookmarks.map((b) => ({
        id: b.id,
        url: b.url,
        title: b.title,
        excerpt: b.excerpt,
        collectionId: b.collectionId,
        type: b.type,
        domain: b.domain,
        coverUrl: b.coverUrl,
        contentSnapshotPath: b.contentSnapshotPath,
        contentIndexed: b.contentIndexed,
        isDuplicate: b.isDuplicate,
        isBroken: b.isBroken,
        customOrder: b.customOrder,
        tags: b.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
        highlights: b.highlights.map((h) => ({
          id: h.id,
          textSelected: h.textSelected,
          color: h.color,
          annotationMd: h.annotationMd,
          positionContext: h.positionContext,
          snapshotId: h.snapshotId,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        })),
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      collections: collections.map((c) => ({
        id: c.id,
        title: c.title,
        icon: c.icon,
        isPublic: c.isPublic,
        shareSlug: c.shareSlug,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      tags: validTags.map((t) => ({
        id: t.id,
        name: t.name,
        normalizedName: t.normalizedName,
        color: t.color,
        createdAt: t.createdAt,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get collection hierarchy (all descendants)
   */
  private async getCollectionHierarchy(
    collectionId: string
  ): Promise<Collection[]> {
    const children = await this.collectionRepository.findChildren(collectionId);
    const allDescendants: Collection[] = [...children];

    for (const child of children) {
      const descendants = await this.getCollectionHierarchy(child.id);
      allDescendants.push(...descendants);
    }

    return allDescendants;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Escape CSV special characters
   */
  private escapeCsv(text: string): string {
    // If text contains comma, quote, or newline, wrap in quotes and escape quotes
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
