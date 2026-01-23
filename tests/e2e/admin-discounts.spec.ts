
import { test, expect } from '@playwright/test';

test.describe('Admin - Discount Codes (Comprehensive)', () => {
  
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
    await page.getByRole('button', { name: 'Slevy' }).click();
  });

  test('should validate required fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Nový slevový kód' }).click();
    
    // Try empty save
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Check validation
    await expect(page.getByText('Vyplňte kód slevy')).toBeVisible();
    await expect(page.getByText('Vyplňte všechna pole')).toBeVisible(); // Value required
    
    await page.getByRole('button', { name: 'Zrušit' }).click();
  });

  test('should populate all fields and save', async ({ page }) => {
    await page.getByRole('button', { name: 'Nový slevový kód' }).click();
    
    const code = `TEST${Date.now()}`;
    
    // Text Inputs
    await page.locator('div').filter({ hasText: /^Kód/ }).getByRole('textbox').fill(code);
    await page.locator('div').filter({ hasText: /^Hodnota/ }).getByRole('spinbutton').fill('150');
    
    // Selects
    await page.locator('div').filter({ hasText: /^Typ/ }).getByRole('combobox').selectOption('fixed');
    
    // Optional Limits
    await page.locator('div').filter({ hasText: /^Min. hodnota/ }).getByRole('spinbutton').fill('500');
    await page.locator('div').filter({ hasText: /^Limit použití/ }).getByRole('spinbutton').fill('10');
    
    // Dates
    await page.locator('div').filter({ hasText: /^Platnost Od/ }).locator('input').fill('2025-01-01');
    
    // Toggles
    await page.getByText('Kombinovatelné').click();
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify
    const row = page.getByRole('row', { name: code });
    await expect(row).toBeVisible();
    await expect(row).toContainText('150 Kč'); // Fixed type
    
    // Delete
    page.on('dialog', d => d.accept());
    await row.getByRole('button').nth(1).click(); // Delete button
    await expect(row).not.toBeVisible();
  });

  test('should prevent deletion if discount is used in an order', async ({ page }) => {
    // 1. Create Discount
    const code = `USED${Date.now()}`;
    await page.getByRole('button', { name: 'Nový slevový kód' }).click();
    await page.locator('div').filter({ hasText: /^Kód/ }).getByRole('textbox').fill(code);
    await page.locator('div').filter({ hasText: /^Hodnota/ }).getByRole('spinbutton').fill('1');
    await page.getByRole('button', { name: 'Uložit' }).click();

    // 2. Create Order with this discount (Switch to User)
    await page.getByRole('link', { name: 'Menu' }).click();
    // Add item
    await page.getByRole('button', { name: 'Do košíku' }).first().click();
    await page.getByRole('link', { name: /Košík/ }).click();
    
    // Apply Discount
    await page.fill('input[placeholder="Kód kuponu"]', code);
    await page.getByRole('button', { name: 'Použít' }).click(); // or 'Uplatnit' depending on translation
    
    // Finish Order
    await page.getByRole('button', { name: 'Pokračovat' }).click();
    // Login mock
    const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
    if (await mockUserBtn.isVisible()) await mockUserBtn.click();

    // Step 2 checkout
    await page.locator('button:has-text("Osobní odběr")').click();
    const dayBtn = page.locator('button:not([disabled]).bg-white').last();
    await dayBtn.click();
    await page.locator('label:has-text("Hotovost")').click();
    await page.getByText('Souhlasím se Všeobecnými').click();
    await page.getByRole('button', { name: 'Odeslat objednávku' }).click();
    
    await expect(page.getByText('Děkujeme za objednávku!')).toBeVisible();

    // 3. Try to Delete Discount (Switch back to Admin)
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Slevy' }).click();

    const row = page.getByRole('row', { name: code });
    await expect(row).toBeVisible();
    
    page.on('dialog', d => d.accept());
    await row.getByRole('button').nth(1).click(); // Delete button

    // 4. Verify Error Message and Existence
    await expect(page.getByText(`Nelze smazat: Kód "${code}" byl použit`)).toBeVisible();
    await expect(row).toBeVisible(); // Should still exist
  });
});
