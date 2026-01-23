
import { test, expect } from '@playwright/test';

test.describe('Admin - User Management (Comprehensive)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    else {
        await page.getByRole('button', { name: 'Přihlásit' }).first().click();
        await page.fill('input[type="email"]', 'info@4gracie.cz');
        await page.fill('input[type="password"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit' }).last().click();
    }
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Uživatelé' }).click();
  });

  test('should show validation errors when creating invalid user', async ({ page }) => {
    await page.getByRole('button', { name: 'Nový uživatel' }).click();
    
    // Fill partial invalid data
    await page.locator('input[placeholder="Jméno"]').fill('A'); // Too short
    await page.locator('input[placeholder="Email"]').fill('invalid-email'); // No @
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Expect error messages
    await expect(page.getByText('Jméno musí mít alespoň 3 znaky')).toBeVisible();
    
    // Fix name, check email error
    await page.locator('input[placeholder="Jméno"]').fill('Valid Name');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText('Neplatný formát emailu')).toBeVisible();
    
    // Close
    await page.getByRole('button', { name: 'Zrušit' }).click();
  });

  test('should create and edit user fully', async ({ page }) => {
    const email = `testuser${Date.now()}@example.com`;
    
    // Create
    await page.getByRole('button', { name: 'Nový uživatel' }).click();
    await page.locator('input[placeholder="Jméno"]').fill('Test User Completeness');
    await page.locator('input[placeholder="Email"]').fill(email);
    await page.locator('input[placeholder="Telefon"]').fill('123456789');
    await page.locator('select').selectOption('driver'); // Role
    await page.getByText('Marketingový souhlas').click(); // Toggle
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify creation in table
    const row = page.getByRole('row', { name: email });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Řidič'); // Role check
    await expect(row).toContainText('ANO'); // Marketing check
    
    // Edit
    await row.getByRole('button', { name: 'Detail / Edit' }).click();
    
    // Check fields populated
    await expect(page.locator('input[value="Test User Completeness"]')).toBeVisible();
    await expect(page.locator('select')).toHaveValue('driver');
    
    // Change Phone
    await page.locator('input[placeholder="Telefon"]').fill('987654321');
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify change
    await expect(page.getByRole('row', { name: '987654321' })).toBeVisible();
  });
});
