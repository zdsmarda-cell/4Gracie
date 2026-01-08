
import { test, expect } from '@playwright/test';

// Run serially to avoid conflicts with global settings/discounts
test.describe.configure({ mode: 'serial' });

test.describe('Price Calculation Consistency', () => {
  
  const DISCOUNT_CODE = 'TEST50';
  const ITEM_PRICE = 1000;
  const DELIVERY_PRICE = 200;
  
  test.beforeEach(async ({ page }) => {
    // 1. Login Admin & Setup Environment
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    else {
        await page.getByRole('button', { name: 'Přihlásit' }).first().click();
        await page.fill('input[type="email"]', 'info@4gracie.cz');
        await page.fill('input[type="password"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit' }).last().click();
    }
    
    // 2. Setup Discount Code (50%)
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Slevy' }).click();
    
    // Check if exists and delete to start fresh
    const deleteBtn = page.locator('tr', { hasText: DISCOUNT_CODE }).getByRole('button').nth(1);
    if (await deleteBtn.count() > 0) {
        page.on('dialog', d => d.accept());
        await deleteBtn.click();
    }

    await page.getByRole('button', { name: 'Nový slevový kód' }).click();
    await page.locator('input').first().fill(DISCOUNT_CODE); // Code
    await page.locator('select').first().selectOption('percentage'); // Type
    await page.locator('input[type="number"]').first().fill('50'); // Value
    await page.locator('div').filter({ hasText: /^Platnost Od$/ }).locator('input').fill('2023-01-01'); // Valid from
    await page.locator('div').filter({ hasText: /^Platnost Do$/ }).locator('input').fill('2030-01-01'); // Valid to
    await page.getByRole('button', { name: 'Uložit' }).click();

    // 3. Setup Delivery Region Price
    await page.getByRole('button', { name: 'Rozvoz' }).click();
    // Assuming "Praha Centrum" exists or edit the first one
    await page.locator('div.bg-white.p-6.rounded-2xl').first().getByRole('button').first().click(); // Edit
    await page.locator('input[placeholder="Cena dopravy"]').fill(DELIVERY_PRICE.toString());
    await page.getByRole('button', { name: 'Uložit' }).click();

    // 4. Create Product
    await page.getByRole('button', { name: 'Produkty' }).click();
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    await page.fill('input[value=""]', 'PriceTestItem');
    await page.fill('input[type="number"]', ITEM_PRICE.toString());
    await page.getByRole('button', { name: 'Uložit' }).click();
  });

  test('should calculate (Item - Discount) + Delivery correctly in Cart and Admin', async ({ page }) => {
    // Expected Calculation:
    // Item: 1000
    // Discount (50% of Item): -500
    // Delivery: 200
    // Total: 500 + 200 = 700.
    // WRONG Calculation (if fees included in discount base): (1000+200)*0.5 = 600.
    
    const EXPECTED_TOTAL = '700 Kč';

    // --- USER FLOW ---
    await page.getByRole('link', { name: 'Menu' }).click();
    await page.reload(); // Refresh products
    
    // Add Item
    await page.locator('div').filter({ hasText: 'PriceTestItem' }).getByRole('button', { name: 'Do košíku' }).click();
    await page.getByRole('link', { name: /Košík/ }).click();
    
    // Apply Discount
    await page.fill('input[placeholder="Kód kuponu"]', DISCOUNT_CODE);
    await page.getByRole('button', { name: 'Použít' }).click();
    
    // Check Cart Summary (Step 1)
    // At this stage, delivery might not be selected yet, so just check Item - Discount
    // Wait, cart summary usually shows total. Let's proceed to Step 2 to lock in delivery.
    await page.getByRole('button', { name: 'Pokračovat' }).click();
    
    // Login User
    const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
    if (await mockUserBtn.isVisible()) await mockUserBtn.click();

    // Select Delivery (Courier)
    await page.locator('button:has-text("Rozvoz 4Gracie")').click();
    
    // Select Address (First available) - Assuming user has address in valid zone from setup
    // If user address is not in zone, we might need to rely on existing seeded data.
    // For safety, let's assume the seeded user has a valid address or pick Pickup if Delivery is hard to script without valid address.
    // BUT, the test requirement is about Fees not being discounted. Pickup usually is 0 fee.
    // We MUST use Delivery to test this.
    // Assuming seeded "Praha 1" address matches the default region "Praha Centrum".
    
    // Check if delivery fee is applied in summary
    await expect(page.getByText(`${DELIVERY_PRICE} Kč`)).toBeVisible();

    // Select Date
    const dayBtn = page.locator('button:not([disabled]).bg-white').last();
    await dayBtn.click();
    
    // Select Payment
    await page.locator('label:has-text("Hotovost")').click();
    await page.getByText('Souhlasím se Všeobecnými').click();

    // VERIFY TOTAL IN CART SUMMARY
    // Look for "Celkem s DPH" followed by "700 Kč"
    const totalEl = page.locator('div').filter({ hasText: 'Celkem s DPH' }).last();
    await expect(totalEl).toContainText(EXPECTED_TOTAL);

    // Submit
    await page.getByRole('button', { name: 'Odeslat objednávku' }).click();
    await expect(page.getByText('Děkujeme za objednávku!')).toBeVisible();

    // --- ADMIN CHECK ---
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Objednávky' }).click();
    
    // Open the latest order (top of list)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Detail / Edit' }).click();
    
    const modal = page.locator('div.fixed').filter({ hasText: 'Upravit objednávku' });
    await expect(modal).toBeVisible();
    
    // Verify Total in Admin Modal Footer
    // "CELKEM: 700 Kč"
    const modalTotal = modal.locator('div').filter({ hasText: 'CELKEM:' }).last();
    await expect(modalTotal).toContainText(EXPECTED_TOTAL);
    
    // Cleanup
    await modal.getByRole('button', { name: 'Zrušit' }).click();
    page.on('dialog', d => d.accept());
    // Delete Product
    await page.getByRole('button', { name: 'Produkty' }).click();
    await page.locator('tr', { hasText: 'PriceTestItem' }).getByRole('button').nth(1).click();
  });
});
