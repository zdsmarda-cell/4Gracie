
import { test, expect } from '@playwright/test';

test.describe('Admin - Logistics (Delivery & Pickup)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) {
        await mockAdminBtn.click();
    }
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should manage delivery regions', async ({ page }) => {
    await page.getByRole('button', { name: 'Rozvoz' }).click();
    
    // Create Region
    await page.getByRole('button', { name: 'Nová zóna' }).click();
    await page.fill('input[placeholder="Název"]', 'Test Zóna');
    await page.fill('input[placeholder="Cena dopravy"]', '150');
    await page.fill('input[placeholder="Zdarma od"]', '2000');
    
    // Add ZIP
    await page.fill('input[placeholder="PSČ"]', '99999');
    await page.getByRole('button', { name: '+' }).first().click(); // Add zip button
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify
    await expect(page.getByText('Test Zóna')).toBeVisible();
    await expect(page.getByText('99999')).toBeVisible();
    
    // Delete
    // Need to handle confirm modal inside the React component (our custom modal, not window.confirm)
    await page.locator('div').filter({ hasText: 'Test Zóna' }).getByRole('button').nth(1).click(); // Trash icon
    await page.getByRole('button', { name: 'Smazat' }).click(); // Confirm in modal
    
    await expect(page.getByText('Test Zóna')).not.toBeVisible();
  });

  test('should manage pickup locations', async ({ page }) => {
    await page.getByRole('button', { name: 'Odběr' }).click();
    
    // Create Location
    await page.getByRole('button', { name: 'Nové místo' }).click();
    await page.locator('input').nth(0).fill('Test Pobočka'); // Name
    await page.locator('input').nth(1).fill('Testovací Ulice 1'); // Street
    await page.locator('input').nth(2).fill('Brno'); // City
    await page.locator('input').nth(3).fill('60200'); // ZIP
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify
    await expect(page.getByText('Test Pobočka')).toBeVisible();
    
    // Delete
    await page.locator('div').filter({ hasText: 'Test Pobočka' }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Smazat' }).click();
    
    await expect(page.getByText('Test Pobočka')).not.toBeVisible();
  });
});
