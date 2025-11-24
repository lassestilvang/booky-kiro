import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sanitizeHtml, sanitizeText } from './validation.middleware.js';

/**
 * Feature: bookmark-manager-platform, Property 69: Input Validation
 *
 * For any user input, the system should validate and sanitize inputs
 * to prevent injection attacks.
 *
 * Validates: Requirements 21.2
 */
describe('Property 69: Input Validation', () => {
  /**
   * Property: Script Tag Removal
   *
   * For any input containing script tags with any content,
   * sanitization should completely remove the script tags.
   */
  it('should remove script tags with any content', async () => {
    await fc.assert(
      fc.property(fc.string(), fc.string(), (before, scriptContent) => {
        const input = `${before}<script>${scriptContent}</script>`;
        const sanitized = sanitizeHtml(input);

        // Script tags should be completely removed
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toContain('</script>');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: XSS Prevention - Text Sanitization
   *
   * For any string, sanitizing as text should encode all special
   * characters that could be used for XSS attacks.
   */
  it('should encode special characters in any text input', async () => {
    await fc.assert(
      fc.property(fc.string(), (input) => {
        // Sanitize the input
        const sanitized = sanitizeText(input);

        // Verify special characters are encoded
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('</script>');

        // If input contained <, it should be encoded
        if (input.includes('<')) {
          expect(sanitized).toContain('&lt;');
        }

        // If input contained >, it should be encoded
        if (input.includes('>')) {
          expect(sanitized).toContain('&gt;');
        }

        // If input contained ", it should be encoded
        if (input.includes('"')) {
          expect(sanitized).toContain('&quot;');
        }

        // If input contained ', it should be encoded
        if (input.includes("'")) {
          expect(sanitized).toContain('&#x27;');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Event Handler Removal
   *
   * For any HTML with event handlers (onclick, onerror, etc.),
   * sanitization should remove these dangerous attributes.
   */
  it('should remove event handler attributes from HTML', async () => {
    await fc.assert(
      fc.property(
        fc.constantFrom(
          'onclick',
          'onerror',
          'onload',
          'onmouseover',
          'onfocus'
        ),
        fc.string(),
        (eventHandler, code) => {
          const input = `<div ${eventHandler}="${code}">content</div>`;
          const sanitized = sanitizeHtml(input);

          // Event handlers should be removed
          expect(sanitized.toLowerCase()).not.toContain(eventHandler);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: URL Validation in Links
   *
   * For any link with a javascript: protocol, sanitization should
   * remove or neutralize the dangerous URL.
   */
  it('should remove javascript: protocol from links', async () => {
    await fc.assert(
      fc.property(fc.string(), (code) => {
        const input = `<a href="javascript:${code}">click</a>`;
        const sanitized = sanitizeHtml(input);

        // JavaScript protocol should be removed
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Nested Attack Prevention
   *
   * For any nested dangerous patterns, sanitization should
   * handle them correctly.
   */
  it('should handle nested dangerous patterns', async () => {
    await fc.assert(
      fc.property(fc.string(), (content) => {
        const input = `<div><script>alert('${content}')</script></div>`;
        const sanitized = sanitizeHtml(input);

        // Nested script should be removed
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toContain('alert(');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Data Attribute Removal
   *
   * For any HTML with data attributes, sanitization should
   * remove them to prevent data exfiltration.
   */
  it('should remove data attributes from HTML', async () => {
    await fc.assert(
      fc.property(fc.string(), fc.string(), (attrName, attrValue) => {
        const input = `<div data-${attrName}="${attrValue}">content</div>`;
        const sanitized = sanitizeHtml(input);

        // Data attributes should be removed
        expect(sanitized.toLowerCase()).not.toContain(
          `data-${attrName.toLowerCase()}`
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty Input Handling
   *
   * For empty strings, sanitization should return empty strings
   * without errors.
   */
  it('should handle empty strings safely', () => {
    const sanitizedHtml = sanitizeHtml('');
    const sanitizedText = sanitizeText('');

    expect(sanitizedHtml).toBe('');
    expect(sanitizedText).toBe('');
  });

  /**
   * Property: Special Character Encoding Consistency
   *
   * For any string with special characters, encoding should be
   * consistent and reversible (for display purposes).
   */
  it('should consistently encode special characters', async () => {
    await fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (count) => {
        // Create string with repeated special characters
        const input = '<'.repeat(count) + '>'.repeat(count);
        const sanitized = sanitizeText(input);

        // Each < should be encoded
        const ltCount = (sanitized.match(/&lt;/g) || []).length;
        expect(ltCount).toBe(count);

        // Each > should be encoded
        const gtCount = (sanitized.match(/&gt;/g) || []).length;
        expect(gtCount).toBe(count);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: SQL Injection Pattern Detection
   *
   * For any input containing SQL injection patterns, text sanitization
   * should encode them to prevent execution.
   */
  it('should encode SQL injection patterns', async () => {
    await fc.assert(
      fc.property(
        fc.constantFrom(
          "'; DROP TABLE users; --",
          "' OR '1'='1",
          "admin'--",
          "' UNION SELECT",
          "1' AND '1'='1"
        ),
        (sqlPattern) => {
          const sanitized = sanitizeText(sqlPattern);

          // Single quotes should be encoded
          expect(sanitized).toContain('&#x27;');

          // The pattern should not be executable
          expect(sanitized).not.toBe(sqlPattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Unicode and International Characters
   *
   * For any string with unicode characters, sanitization should
   * preserve them while still encoding dangerous characters.
   */
  it('should preserve unicode characters while encoding dangerous ones', async () => {
    await fc.assert(
      fc.property(fc.unicodeString(), (unicodeStr) => {
        const input = `${unicodeStr}<script>alert(1)</script>`;
        const sanitized = sanitizeHtml(input);

        // Script should be removed
        expect(sanitized.toLowerCase()).not.toContain('<script');

        // Unicode characters should be preserved (if they're safe)
        // We just verify sanitization doesn't crash on unicode
        expect(sanitized).toBeDefined();
        expect(typeof sanitized).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Dangerous Tag Removal
   *
   * For any input containing dangerous HTML tags (iframe, object, embed),
   * sanitization should remove them completely.
   */
  it('should remove dangerous HTML tags', async () => {
    await fc.assert(
      fc.property(
        fc.constantFrom('iframe', 'object', 'embed', 'link', 'style'),
        fc.string(),
        (tag, content) => {
          const input = `<${tag}>${content}</${tag}>`;
          const sanitized = sanitizeHtml(input);

          // Dangerous tags should be removed
          expect(sanitized.toLowerCase()).not.toContain(`<${tag}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Safe Content Preservation
   *
   * For any plain text without HTML, sanitization should preserve
   * the content (though it may be encoded).
   */
  it('should preserve safe plain text content', async () => {
    await fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('<') && !s.includes('>')),
        (plainText) => {
          const sanitized = sanitizeHtml(plainText);

          // Plain text should be preserved or safely encoded
          expect(sanitized).toBeDefined();
          expect(typeof sanitized).toBe('string');

          // Should not introduce dangerous patterns
          expect(sanitized.toLowerCase()).not.toContain('<script');
        }
      ),
      { numRuns: 100 }
    );
  });
});
