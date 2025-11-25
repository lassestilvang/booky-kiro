import { test, expect } from '@playwright/test';

/**
 * Smoke Tests
 *
 * Quick sanity checks to verify the application is running and accessible.
 * These tests should run fast and catch basic setup issues.
 */

test.describe('Smoke Tests', () => {
  test('frontend should be accessible', async ({ page }) => {
    await page.goto('/');

    // Should load without errors
    await expect(page).toHaveURL(/\/(login|register|dashboard)?/);

    // Page should have a title
    await expect(page).toHaveTitle(/.+/);
  });

  test('backend health endpoint should respond', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('login page should be accessible', async ({ page }) => {
    await page.goto('/login');

    // Should have login form elements
    await expect(
      page.locator('input[name="email"], input[type="email"]')
    ).toBeVisible();
    await expect(
      page.locator('input[name="password"], input[type="password"]')
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register page should be accessible', async ({ page }) => {
    await page.goto('/register');

    // Should have registration form elements
    await expect(
      page.locator('input[name="email"], input[type="email"]')
    ).toBeVisible();
    await expect(
      page.locator('input[name="password"], input[type="password"]')
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
