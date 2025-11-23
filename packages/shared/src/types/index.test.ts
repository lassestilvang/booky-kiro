import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { PlanTier, BookmarkType } from './index';

describe('Shared Types', () => {
  it('should validate PlanTier values', () => {
    const validPlans: PlanTier[] = ['free', 'pro'];
    expect(validPlans).toHaveLength(2);
    expect(validPlans).toContain('free');
    expect(validPlans).toContain('pro');
  });

  it('should validate BookmarkType values', () => {
    const validTypes: BookmarkType[] = [
      'article',
      'video',
      'image',
      'file',
      'document',
    ];
    expect(validTypes).toHaveLength(5);
  });

  // Example property-based test using fast-check
  it('property: normalized tag names should be lowercase', () => {
    fc.assert(
      fc.property(fc.string(), (tagName) => {
        const normalized = tagName.toLowerCase();
        expect(normalized).toBe(normalized.toLowerCase());
      })
    );
  });
});
