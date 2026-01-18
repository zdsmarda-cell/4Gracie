import { test, expect } from '@playwright/test';

test.describe('Admin - Ride Management', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login Admin
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should access Rides tab and view generations', async ({ page }) => {
    await page.getByRole('button', { name: 'Jízdy' }).click();
    
    // Check Tabs
    await expect(page.getByRole('button', { name: 'Aktuální' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Historie' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generace jízd' })).toBeVisible();

    // Check Content in Current
    // Should see tiles or "Zatím žádné nadcházející rozvozy"
    const content = page.locator('div.grid, div.text-center');
    await expect(content.first()).toBeVisible();

    // Check Generation Tab (Worker Log)
    await page.getByRole('button', { name: 'Generace jízd' }).click();
    await expect(page.getByText('VŠECHNY JÍZDY (WORKER LOG)')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});