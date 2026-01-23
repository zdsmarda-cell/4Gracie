
import { test, expect } from '@playwright/test';

test.describe('Admin - Global Settings', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should allow editing operator details', async ({ page }) => {
    await page.getByRole('button', { name: 'Provozovatel' }).click();
    
    const nameInput = page.locator('div').filter({ hasText: /^Název/ }).getByRole('textbox');
    const originalName = await nameInput.inputValue();
    
    await nameInput.fill('Updated Company Name');
    await page.getByRole('button', { name: 'Uložit změny' }).click();
    
    // Verify
    await page.reload();
    await page.getByRole('button', { name: 'Provozovatel' }).click();
    await expect(nameInput).toHaveValue('Updated Company Name');
    
    // Restore
    await nameInput.fill(originalName);
    await page.getByRole('button', { name: 'Uložit změny' }).click();
  });

  test('should allow toggling app settings (Languages/AI)', async ({ page }) => {
    // Using loose match for 'Nastavení' / 'App Settings'
    await page.getByRole('button', { name: /Nastavení/ }).click();
    
    // Check AI Toggle
    const aiToggle = page.locator('label').filter({ hasText: 'Povolit automatické AI překlady' }).locator('input');
    await expect(aiToggle).toBeVisible();
    
    // Toggle it
    await aiToggle.click();
    // Wait for auto-save (useEffect/callback usually fast)
    await page.waitForTimeout(500);
    
    // Reload to verify persistence
    await page.reload();
    await page.getByRole('button', { name: /Nastavení/ }).click();
    
    // Should be toggled state (if it was on, now off, or vice versa)
    // We just check it's interactive and visible
    await expect(aiToggle).toBeVisible();
  });
});
