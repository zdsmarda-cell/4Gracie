
import { test, expect } from '@playwright/test';

test.describe('Admin - User Management', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) {
        await mockAdminBtn.click();
    }
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should filter and edit user', async ({ page }) => {
    await page.getByRole('button', { name: 'Uživatelé' }).click();
    
    // Use the seeded user 'Jan Novák'
    const userRow = page.getByRole('row', { name: 'Jan Novák' });
    await expect(userRow).toBeVisible();
    
    // Edit User
    await userRow.getByRole('button', { name: 'Detail / Edit' }).click();
    
    const modal = page.locator('div').filter({ hasText: 'Upravit uživatele' }).last();
    await expect(modal).toBeVisible();
    
    // Change name
    await modal.locator('input').first().fill('Jan Novák Edited');
    await modal.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify change in table
    await expect(page.getByRole('row', { name: 'Jan Novák Edited' })).toBeVisible();
    
    // Revert change to keep state clean
    await page.getByRole('row', { name: 'Jan Novák Edited' }).getByRole('button', { name: 'Detail / Edit' }).click();
    await modal.locator('input').first().fill('Jan Novák');
    await modal.getByRole('button', { name: 'Uložit' }).click();
  });
});
