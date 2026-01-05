
import { test, expect } from '@playwright/test';

test.describe('Admin - Products & Categories Management', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as Admin before each test
    await page.goto('/');
    
    // Attempt to use Mock Login if available (Local dev)
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) {
        await mockAdminBtn.click();
    } else {
        // Fallback to standard login
        await page.getByRole('button', { name: 'Přihlásit' }).first().click();
        await page.fill('input[placeholder="Email"]', 'info@4gracie.cz');
        await page.fill('input[placeholder="Heslo"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit' }).last().click();
    }
    
    // Navigate to Admin
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByText('Přehled')).toBeVisible();
  });

  test('should create, edit and delete a product', async ({ page }) => {
    // 1. Navigate to Products tab
    await page.getByRole('button', { name: 'Produkty' }).click();
    
    // 2. Create Product
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    await page.fill('input[value=""]', 'Auto Test Produkt'); // Name (first input)
    await page.locator('textarea').fill('Popis testovacího produktu');
    await page.fill('input[type="number"]', '100'); // Price (first number input usually)
    
    // Fill specific fields by locating near labels to be precise
    await page.locator('div').filter({ hasText: /^Cena \(Kč\)$/ }).getByRole('spinbutton').fill('999');
    
    // Save
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify creation
    await expect(page.getByText('Auto Test Produkt')).toBeVisible();
    await expect(page.getByText('999 Kč')).toBeVisible();

    // 3. Edit Product
    await page.locator('tr', { hasText: 'Auto Test Produkt' }).getByRole('button').first().click(); // Edit button is usually the first one
    await page.locator('div').filter({ hasText: /^Cena \(Kč\)$/ }).getByRole('spinbutton').fill('1234');
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify Edit
    await expect(page.getByText('1234 Kč')).toBeVisible();

    // 4. Delete Product
    page.on('dialog', dialog => dialog.accept()); // Auto-accept confirm dialog
    await page.locator('tr', { hasText: 'Auto Test Produkt' }).getByRole('button').nth(1).click(); // Delete button is usually second
    
    // Verify Deletion
    await expect(page.getByText('Auto Test Produkt')).not.toBeVisible();
  });

  test('should manage categories', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorie' }).click();
    
    // Create Category
    await page.getByRole('button', { name: 'Nová kategorie' }).click();
    await page.fill('input[value=""]', 'Test Kategorie'); // Name
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    await expect(page.getByText('Test Kategorie')).toBeVisible();
    
    // Delete Category
    page.on('dialog', dialog => dialog.accept());
    await page.locator('tr', { hasText: 'Test Kategorie' }).getByRole('button').nth(1).click();
    
    await expect(page.getByText('Test Kategorie')).not.toBeVisible();
  });
});
