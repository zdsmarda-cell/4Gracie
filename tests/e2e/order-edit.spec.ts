
import { test, expect } from '@playwright/test';

test.describe('Order Editing Completeness', () => {

  // --- ADMIN EDIT TEST ---
  test('Admin should see all editable fields in order detail', async ({ page }) => {
    // 1. Setup - Login Admin
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();

    // 2. Open an Order
    await page.getByRole('button', { name: 'Objednávky' }).click();
    // Click "Detail / Edit" on the first available order
    await page.getByRole('button', { name: 'Detail / Edit' }).first().click();

    const modal = page.locator('div.fixed').filter({ hasText: 'Upravit objednávku' }).last();
    await expect(modal).toBeVisible();

    // 3. Verify Customer & Date Section
    await expect(modal.locator('text=Jméno')).toBeVisible();
    await expect(modal.locator('input').nth(0)).toBeVisible(); // Name input

    await expect(modal.locator('text=Datum')).toBeVisible();
    await expect(modal.locator('input[type="date"]')).toBeVisible();

    // 4. Verify Delivery Method & Address
    await expect(modal.locator('text=Doprava')).toBeVisible();
    await expect(modal.locator('select').first()).toBeVisible(); // Delivery type select

    // Check Address Fields visibility (They show up if Delivery is Courier, or Pickup Select if Pickup)
    // We assume the mock order might be Delivery, or we switch it to check fields.
    
    // Force switch to Delivery to check address fields
    await modal.locator('select').first().selectOption('delivery');
    
    await expect(modal.locator('text=Doručovací adresa')).toBeVisible();
    await expect(modal.locator('input[placeholder="Jméno / Firma"]')).toBeVisible();
    await expect(modal.locator('input[placeholder="Ulice a č.p."]')).toBeVisible();
    await expect(modal.locator('input[placeholder="Město"]')).toBeVisible();
    await expect(modal.locator('input[placeholder="PSČ"]')).toBeVisible();
    await expect(modal.locator('input[placeholder*="Telefon"]')).toBeVisible();

    // 5. Verify Billing Address
    await expect(modal.locator('text=Fakturační adresa')).toBeVisible();
    // Should have distinct inputs
    const billingSection = modal.locator('div.border-t').filter({ hasText: 'Fakturační adresa' });
    await expect(billingSection).toBeVisible();
    await expect(billingSection.locator('input[placeholder="IČ"]')).toBeVisible();
    await expect(billingSection.locator('input[placeholder="DIČ"]')).toBeVisible();

    // 6. Verify Items & Financials
    await expect(modal.locator('text=Položky')).toBeVisible();
    await expect(modal.locator('table')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Přidat produkt' })).toBeVisible();
    
    // Discount field
    await expect(modal.locator('input[placeholder="Kód slevy"]')).toBeVisible();
    
    // Totals
    await expect(modal.locator('text=Zboží:')).toBeVisible();
    await expect(modal.locator('text=CELKEM:')).toBeVisible();
  });

  // --- USER EDIT TEST ---
  test('User should see all editable fields in their profile', async ({ page }) => {
    // 1. Setup - Create a fresh order to ensure we have one in "Created" state which is editable
    await page.goto('/');
    const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
    if (await mockUserBtn.isVisible()) await mockUserBtn.click();
    
    // Add item
    await page.getByRole('button', { name: 'Do košíku' }).first().click();
    
    // Checkout
    await page.getByRole('link', { name: /Košík/ }).click();
    await page.getByRole('button', { name: 'Pokračovat' }).click();
    
    // Fill required step 2
    // Select Pickup to be fast
    await page.locator('button:has-text("Osobní odběr")').click();
    const dayBtn = page.locator('button:not([disabled]).bg-white').first();
    await dayBtn.click();
    await page.locator('label:has-text("Hotovost")').click();
    await page.getByText('Souhlasím se Všeobecnými').click();
    await page.getByRole('button', { name: 'Odeslat objednávku' }).click();
    await expect(page.getByText('Děkujeme za objednávku!')).toBeVisible();

    // 2. Go to Profile
    await page.getByRole('link', { name: /Jan Novák/ }).click(); // Link with user name
    
    // 3. Find the order and click Edit
    // Newest order is first. Expand it.
    const firstOrder = page.locator('div.bg-white.border.rounded-2xl').first();
    await firstOrder.click(); // Expand
    
    await expect(firstOrder.getByRole('button', { name: 'Upravit objednávku' })).toBeVisible();
    await firstOrder.getByRole('button', { name: 'Upravit objednávku' }).click();

    const modal = page.locator('div.fixed').filter({ hasText: 'Upravit objednávku' }).last();
    await expect(modal).toBeVisible();

    // 4. Verify Fields Presence
    
    // Date & Delivery Method
    await expect(modal.locator('text=Datum')).toBeVisible();
    await expect(modal.locator('text=Doprava')).toBeVisible();
    
    // Pickup / Delivery Logic checks
    // Currently Pickup is selected
    await expect(modal.locator('text=Odběrné místo')).toBeVisible();
    await expect(modal.locator('select').nth(1)).toBeVisible(); // Location select

    // Switch to Delivery to check address fields
    await modal.locator('select').first().selectOption('delivery');
    await expect(modal.locator('text=Doručovací adresa')).toBeVisible();
    await expect(modal.locator('input[placeholder="Ulice a č.p."]')).toBeVisible();
    await expect(modal.locator('input[placeholder="Město"]')).toBeVisible();
    await expect(modal.locator('input[placeholder="PSČ"]')).toBeVisible();
    
    // Billing Address (User can edit this too)
    await expect(modal.locator('text=Fakturační adresa')).toBeVisible();
    await expect(modal.locator('input[placeholder="IČ"]')).toBeVisible();

    // Items
    await expect(modal.locator('text=Položky')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Přidat produkt' })).toBeVisible();
    
    // Close modal
    await modal.getByRole('button', { name: 'Zrušit' }).click();
  });

});
