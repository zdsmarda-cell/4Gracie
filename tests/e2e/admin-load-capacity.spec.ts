
import { test, expect } from '@playwright/test';

test.describe('Admin - Load & Capacity Logic', () => {
  
  test.beforeEach(async ({ page }) => {
    // Reset by reloading to clear potential state if reused in serial mode
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should correctly calculate shared overhead (MAX of group) in Detail view', async ({ page }) => {
    // 1. Create a Capacity Category
    await page.getByRole('button', { name: 'Kategorie' }).click();
    await page.getByText('Kapacitní kategorie').click();
    await page.getByRole('button', { name: 'Nová skupina' }).click();
    await page.fill('input[required]', 'Sdílená Fritéza');
    await page.getByRole('button', { name: 'Uložit' }).click();

    // 2. Create Products linked to this Capacity Category
    await page.getByRole('button', { name: 'Produkty' }).click();
    
    // Product A: Overhead 100
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    await page.fill('input[value=""]', 'Fritéza A');
    await page.fill('input[type="number"]', '100'); // Price
    // Workload 10
    await page.locator('div').filter({ hasText: /^Pracnost \(body\)$/ }).getByRole('spinbutton').fill('10');
    // Overhead 100
    await page.locator('div').filter({ hasText: /^Režie přípravy$/ }).getByRole('spinbutton').fill('100');
    // Select Capacity Category "Sdílená Fritéza"
    // Assuming it's the last option added
    await page.locator('div').filter({ hasText: 'Kapacitní skupina' }).getByRole('combobox').selectOption({ label: 'Sdílená Fritéza' });
    await page.getByRole('button', { name: 'Uložit' }).click();

    // Product B: Overhead 200
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    await page.fill('input[value=""]', 'Fritéza B');
    await page.fill('input[type="number"]', '100');
    await page.locator('div').filter({ hasText: /^Pracnost \(body\)$/ }).getByRole('spinbutton').fill('10');
    await page.locator('div').filter({ hasText: /^Režie přípravy$/ }).getByRole('spinbutton').fill('200');
    await page.locator('div').filter({ hasText: 'Kapacitní skupina' }).getByRole('combobox').selectOption({ label: 'Sdílená Fritéza' });
    await page.getByRole('button', { name: 'Uložit' }).click();

    // 3. Create an Order containing 1x A and 1x B
    // Math:
    // Workload A: 1 * 10 = 10
    // Workload B: 1 * 10 = 10
    // Overhead: MAX(100, 200) = 200 (Shared Group Logic)
    // TOTAL EXPECTED = 10 + 10 + 200 = 220
    
    // Go to User Menu
    await page.getByRole('link', { name: 'Menu' }).click();
    // Reload to fetch new products
    await page.reload(); 
    
    await page.locator('div').filter({ hasText: 'Fritéza A' }).getByRole('button', { name: 'Do košíku' }).click();
    await page.locator('div').filter({ hasText: 'Fritéza B' }).getByRole('button', { name: 'Do košíku' }).click();
    
    await page.getByRole('link', { name: /Košík/ }).click();
    await page.getByRole('button', { name: 'Pokračovat' }).click();
    
    // Login User
    const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
    if (await mockUserBtn.isVisible()) await mockUserBtn.click();

    // Fill checkout
    await page.locator('button:has-text("Osobní odběr")').click();
    const dayBtn = page.locator('button:not([disabled]).bg-white').last(); // Select a valid day
    await dayBtn.click();
    await page.locator('label:has-text("Hotovost")').click();
    await page.getByText('Souhlasím se Všeobecnými').click();
    await page.getByRole('button', { name: 'Odeslat objednávku' }).click();
    
    // 4. Verify in Admin Load Tab
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Vytížení' }).click();
    
    // Find the day row. We need to find the row that has our total.
    // The summary row should show usage. We expect "220 / 1000" (assuming default limit 1000).
    // Or at least "220" somewhere in the row for 'Teplý catering' (default cat).
    const row = page.getByRole('row', { name: /220 \// });
    await expect(row).toBeVisible();

    // 5. Verify Detail View Calculation
    // Click the Eye icon in that row
    await row.getByRole('button').first().click();
    
    const modal = page.locator('div.fixed').filter({ hasText: 'Detail výroby' });
    await expect(modal).toBeVisible();
    
    // Check Header Calculation
    // "Celkem pracnost: 220"
    await expect(modal.getByText('Celkem pracnost: 220')).toBeVisible();
    
    // Check if both products are listed
    await expect(modal.getByText('Fritéza A')).toBeVisible();
    await expect(modal.getByText('Fritéza B')).toBeVisible();
    
    // --- CLEANUP ---
    await modal.getByRole('button', { name: 'Zavřít' }).click();
    
    // Delete products to keep clean state
    await page.getByRole('button', { name: 'Produkty' }).click();
    page.on('dialog', dialog => dialog.accept());
    await page.locator('tr', { hasText: 'Fritéza A' }).getByRole('button').nth(1).click();
    await page.locator('tr', { hasText: 'Fritéza B' }).getByRole('button').nth(1).click();
    
    // Delete Capacity Category
    await page.getByRole('button', { name: 'Kategorie' }).click();
    await page.getByText('Kapacitní kategorie').click();
    await page.locator('tr', { hasText: 'Sdílená Fritéza' }).getByRole('button').nth(1).click();
  });
});
