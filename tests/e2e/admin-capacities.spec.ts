
import { test, expect } from '@playwright/test';

test.describe('Admin - Capacities & Calendar', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Kapacity' }).click();
  });

  test('should update global limits', async ({ page }) => {
    // Assuming 'Teplý catering' exists
    const input = page.locator('div').filter({ hasText: 'Teplý catering' }).getByRole('spinbutton');
    const originalValue = await input.inputValue();
    
    await input.fill('999');
    await page.getByRole('button', { name: 'Uložit globální limity' }).click();
    
    // Reload to verify persistence
    await page.reload();
    await page.getByRole('button', { name: 'Kapacity' }).click();
    await expect(page.locator('div').filter({ hasText: 'Teplý catering' }).getByRole('spinbutton')).toHaveValue('999');
    
    // Restore
    await input.fill(originalValue);
    await page.getByRole('button', { name: 'Uložit globální limity' }).click();
  });

  test('should add and remove calendar exception', async ({ page }) => {
    await page.getByRole('button', { name: 'Přidat výjimku' }).click();
    
    // Modal
    const date = '2026-01-01'; // Future date
    await page.locator('input[type="date"]').fill(date);
    
    // Toggle Open/Close
    // Default is closed (checkbox unchecked). Let's check it to Open and set limit.
    await page.locator('input[type="checkbox"]').check(); 
    
    // Set limit for 'Teplý catering'
    await page.locator('div').filter({ hasText: 'Teplý catering' }).getByRole('spinbutton').fill('50');
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify in list
    // Date format depends on locale, check for presence or part of it
    // '2026-01-01' might format to '1. 1. 2026'
    await expect(page.locator('div').filter({ hasText: 'OTEVŘENO (Upravená kapacita)' })).toBeVisible();
    
    // Delete
    // Find the row with our date (loosely)
    // Actually, let's find the container that contains our status text
    const row = page.locator('div.flex.justify-between').filter({ hasText: 'OTEVŘENO (Upravená kapacita)' }).last();
    page.on('dialog', d => d.accept());
    await row.getByRole('button').nth(1).click(); // Delete button
    
    await expect(row).not.toBeVisible();
  });
});
