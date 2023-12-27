import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('http://localhost:5214');


  const title = page.locator('h1');
  await expect(title).toHaveText('woollama');
});