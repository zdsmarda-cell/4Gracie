
import { test, expect } from '@playwright/test';

test.describe('Admin - Products Management (Comprehensive)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    else {
        await page.getByRole('button', { name: 'Přihlásit' }).first().click();
        await page.fill('input[type="email"]', 'info@4gracie.cz');
        await page.fill('input[type="password"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit' }).last().click();
    }
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Produkty' }).click();
  });

  test('should validate required fields and prevent save with errors', async ({ page }) => {
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    
    // Attempt Save empty
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Check for custom validation messages (not browser defaults)
    // Based on ProductsTab.tsx logic
    await expect(page.getByText('Vyplňte název')).toBeVisible();
    await expect(page.getByText('Vyplňte cenu')).toBeVisible();
    
    // Close modal
    await page.getByRole('button', { name: 'Zrušit' }).click();
  });

  test('should create product with ALL fields filled', async ({ page }) => {
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    
    const name = `Full Spec Product ${Date.now()}`;
    
    // 1. Basic Info
    await page.locator('div').filter({ hasText: /^Název/ }).getByRole('textbox').fill(name);
    await page.locator('textarea').fill('Detailed description');
    await page.locator('div').filter({ hasText: /^Cena/ }).getByRole('spinbutton').fill('150');
    await page.locator('div').filter({ hasText: /^Jednotka/ }).getByRole('combobox').selectOption('ks');
    await page.locator('div').filter({ hasText: /^Kategorie/ }).getByRole('combobox').selectOption({ index: 1 }); // Select first available
    
    // 2. Logistics
    await page.locator('div').filter({ hasText: /^Objednat předem/ }).getByRole('spinbutton').fill('2');
    await page.locator('div').filter({ hasText: /^Trvanlivost/ }).getByRole('spinbutton').fill('3');
    await page.locator('div').filter({ hasText: /^Min. odběr/ }).getByRole('spinbutton').fill('5');
    await page.locator('div').filter({ hasText: /^Objem/ }).getByRole('spinbutton').fill('500');
    await page.getByText('Nepočítat do obalů').click(); // Checkbox

    // 3. Economics
    await page.locator('div').filter({ hasText: /^Pracnost/ }).getByRole('spinbutton').fill('10');
    await page.locator('div').filter({ hasText: /^Režie/ }).getByRole('spinbutton').fill('20');
    await page.locator('div').filter({ hasText: /^DPH Prodejna/ }).getByRole('spinbutton').fill('12');
    await page.locator('div').filter({ hasText: /^DPH S sebou/ }).getByRole('spinbutton').fill('12');

    // 4. Visibility
    // Toggle checkboxes (assuming they default to true, we uncheck one)
    await page.getByText('Stánek').click(); 

    // 5. Allergens
    // Click '1' (Lepek)
    await page.locator('label').filter({ hasText: '1' }).click();

    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify in table
    await expect(page.getByRole('cell', { name: name })).toBeVisible();
    await expect(page.getByRole('cell', { name: '150 Kč' })).toBeVisible();
    
    // Cleanup
    page.on('dialog', d => d.accept());
    await page.locator('tr', { hasText: name }).getByRole('button').nth(1).click();
  });
});
