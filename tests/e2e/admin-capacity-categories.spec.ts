
import { test, expect } from '@playwright/test';

test.describe('Admin - Capacity Categories', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Mock login
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Kategorie' }).click();
  });

  test('should toggle between standard and capacity categories', async ({ page }) => {
    await expect(page.getByText('Standardní kategorie')).toBeVisible();
    await page.getByText('Kapacitní kategorie').click();
    await expect(page.getByText('Sdílená příprava')).toBeVisible();
    await expect(page.getByText('Nová skupina')).toBeVisible();
  });

  test('should create, edit and delete a capacity category', async ({ page }) => {
    await page.getByText('Kapacitní kategorie').click();
    
    // Create
    await page.getByRole('button', { name: 'Nová skupina' }).click();
    await page.fill('input[required]', 'Testovací Fritéza');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText('Testovací Fritéza')).toBeVisible();

    // Edit
    await page.locator('tr', { hasText: 'Testovací Fritéza' }).getByRole('button').first().click();
    await page.fill('input[required]', 'Fritéza Upravená');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText('Fritéza Upravená')).toBeVisible();

    // Delete
    await page.locator('tr', { hasText: 'Fritéza Upravená' }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Smazat' }).click();
    await expect(page.getByText('Fritéza Upravená')).not.toBeVisible();
  });
});
