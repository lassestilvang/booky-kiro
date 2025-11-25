import { test, expect } from '@playwright/test';

/**
 * E2E Tests for User Authentication
 *
 * Tests user registration and login flows to ensure:
 * - Users can register with valid credentials
 * - Users can log in with registered credentials
 * - Invalid credentials are rejected
 * - JWT tokens are properly stored and used
 *
 * Validates: Requirements 16.1, 16.2
 */

test.describe('User Authentication', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Test User',
  };

  test('should register a new user', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');

    // Fill registration form
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="name"]', testUser.name);

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Should display user name
    await expect(page.locator('text=' + testUser.name)).toBeVisible();
  });

  test('should login with registered credentials', async ({ page }) => {
    // First register a user
    await page.goto('/register');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="name"]', testUser.name);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Logout
    await page.click('button:has-text("Logout"), [aria-label="Logout"]');
    await page.waitForURL('/login');

    // Login with same credentials
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('text=' + testUser.name)).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Try to login with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible({
      timeout: 5000,
    });

    // Should remain on login page
    await expect(page).toHaveURL('/login');
  });

  test('should persist authentication across page reloads', async ({
    page,
  }) => {
    // Register and login
    await page.goto('/register');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="name"]', testUser.name);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Reload page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=' + testUser.name)).toBeVisible();
  });
});
