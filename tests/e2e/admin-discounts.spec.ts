
import { test, expect } from '@playwright/test';

test.describe('Admin - Discount Codes Management', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login as Admin
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) {
        await mockAdminBtn.click();
    } else {
        await page.getByRole('button', { name: 'Přihlásit' }).first().click();
        await page.fill('input[placeholder="Email"]', 'info@4gracie.cz');
        await page.fill('input[placeholder="Heslo"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit' }).last().click();
    }
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should display all input fields in discount modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Slevy' }).click();
    await page.getByRole('button', { name: 'Nový slevový kód' }).click();

    const modal = page.locator('div.fixed').filter({ hasText: 'Nová sleva' }).last();
    await expect(modal).toBeVisible();

    // 1. Basic Identity
    await expect(modal.locator('text=Kód')).toBeVisible();
    await expect(modal.locator('input').first()).toBeVisible(); // Code input

    // 2. Value and Type
    await expect(modal.locator('text=Typ')).toBeVisible();
    await expect(modal.locator('select').first()).toBeVisible(); // Type select
    await expect(modal.locator('text=Hodnota')).toBeVisible();
    await expect(modal.locator('input[type="number"]').first()).toBeVisible(); // Value input

    // 3. Limits
    await expect(modal.locator('text=Min. hodnota obj. (Kč)')).toBeVisible();
    // We target inputs by proximity to labels if they don't have unique IDs
    await expect(modal.locator('div').filter({ hasText: /^Min. hodnota obj. \(Kč\)$/ }).getByRole('spinbutton')).toBeVisible();
    
    await expect(modal.locator('text=Limit použití (ks)')).toBeVisible();
    await expect(modal.locator('div').filter({ hasText: /^Limit použití \(ks\)$/ }).getByRole('spinbutton')).toBeVisible();

    // 4. Validity Dates
    await expect(modal.locator('text=Platnost Od')).toBeVisible();
    await expect(modal.locator('div').filter({ hasText: /^Platnost Od$/ }).locator('input[type="date"]')).toBeVisible();
    
    await expect(modal.locator('text=Platnost Do')).toBeVisible();
    await expect(modal.locator('div').filter({ hasText: /^Platnost Do$/ }).locator('input[type="date"]')).toBeVisible();

    // 5. Categories Checkboxes
    await expect(modal.locator('text=Platí pro kategorie')).toBeVisible();
    // Check if at least one category checkbox exists
    await expect(modal.locator('input[type="checkbox"]').first()).toBeVisible();

    // 6. Settings Switches
    await expect(modal.getByText('Aktivní', { exact: true })).toBeVisible();
    await expect(modal.getByText('Kombinovatelné')).toBeVisible();

    // 7. Test Save validation (Empty code)
    await modal.getByRole('button', { name: 'Uložit' }).click();
    // Should show error if code empty (assuming validation exists) or stay open
    await expect(modal).toBeVisible(); 
  });
});
