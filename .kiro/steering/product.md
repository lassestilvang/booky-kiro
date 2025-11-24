---
inclusion: always
---

# Product Overview

Bookmark Manager Platform is a production-ready, cross-platform bookmark management system with comprehensive organization, archiving, search, and collaboration capabilities.

## Core Concepts

- **Bookmarks**: Web URLs with metadata (title, description, favicon, tags, notes)
- **Collections**: Hierarchical folders for organizing bookmarks with custom icons and colors
- **Tags**: Multi-tag support for cross-cutting categorization
- **Snapshots**: Archived copies of web pages for offline access (Pro feature)
- **Highlights**: Text selections and annotations on saved pages (Pro feature)
- **Sharing**: Collaboration via user-specific or public links (Pro feature)

## Feature Tiers

### Free Tier

- Unlimited bookmarks and collections
- Multi-tag organization with filtering
- Browser extension for quick saving
- Import/export (HTML, JSON, CSV formats)
- Real-time sync across devices via WebSocket
- Basic search by title, URL, tags, and notes

### Pro Tier

- Full-text search within archived page content (MeiliSearch)
- Permanent page snapshots stored in MinIO
- Highlights and annotations with rich text
- Collection sharing (specific users or public links)
- File attachments (PDFs, images, documents)
- Automated backups with restore capability
- Reminders for bookmarks

## User Experience Principles

- **Speed**: Fast search and navigation are critical
- **Simplicity**: Clean, intuitive UI without overwhelming options
- **Reliability**: Data integrity and sync consistency are paramount
- **Accessibility**: WCAG 2.1 AA compliance for all interfaces
- **Privacy**: User data is private by default; sharing is explicit

## Implementation Guidelines

- Always check user plan tier before enabling Pro features
- Use optimistic updates for better perceived performance
- Implement proper error handling with user-friendly messages
- Respect rate limits to prevent abuse
- Validate all user input on both client and server
- Use proper ARIA labels and keyboard navigation
- Handle offline scenarios gracefully in extension and frontend
- Maintain backward compatibility for import/export formats
