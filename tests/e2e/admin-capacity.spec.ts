
import { test, expect } from '@playwright/test';

// Run serially to avoid race conditions with global settings
test.describe.configure({ mode: 'serial' });

test.describe('Admin -> User Capacity Integration', () => {
  
  const PRODUCT_NAME = 'Kapacitní Test Produkt';
  const CATEGORY_ID = 'warm'; // Using standard warm category
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should enforce capacity limits set in admin', async ({ page }) => {
    // --- STEP 1: ADMIN SETUP ---
    // Login as Admin
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
    
    // 1. Create a Product with high workload
    await page.getByRole('button', { name: 'Produkty' }).click();
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    await page.fill('input[value=""]', PRODUCT_NAME);
    await page.fill('input[type="number"]', '100'); // Price
    
    // Set Workload to 50
    // We locate inputs by proximity to labels
    await page.locator('div').filter({ hasText: /^Pracnost \(body\)$/ }).getByRole('spinbutton').fill('50');
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // 2. Set Global Capacity for 'Teplý catering' (warm) to 40
    await page.getByRole('button', { name: 'Kapacity' }).click();
    // Assuming 'Teplý catering' is the label for 'warm' category
    const limitInput = page.locator('div').filter({ hasText: /^Teplý catering$/ }).getByRole('spinbutton');
    await limitInput.fill('40'); // Set limit LOWER than product workload
    await page.getByRole('button', { name: 'Uložit globální limity' }).click();
    await page.waitForTimeout(500); // Wait for save

    // --- STEP 2: USER EXPERIENCE ---
    await page.getByRole('link', { name: 'Menu' }).click();
    
    // Add the high workload product
    // Reload to ensure product appears
    await page.reload();
    await page.locator('div').filter({ hasText: PRODUCT_NAME }).getByRole('button', { name: 'Do košíku' }).click();
    
    // Go to Cart
    await page.getByRole('link', { name: /Košík/ }).click();
    await page.getByRole('button', { name: 'Pokračovat' }).click();
    
    // Login as User
    const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
    if (await mockUserBtn.isVisible()) await mockUserBtn.click();
    
    // Check Calendar
    // The product has workload 50. Limit is 40.
    // ALL days should be blocked (red) or show "Capacity exceeded" when clicked.
    
    // Find a valid day button (not disabled by default, e.g. next valid day)
    const dayBtn = page.locator('button:not([disabled]).bg-white').first();
    await dayBtn.click();
    
    // Expect Error Message about capacity
    await expect(page.getByText('Kapacita vyčerpána')).toBeVisible();
    
    // --- CLEANUP ---
    // Restore capacity and delete product to not break other tests
    await page.getByRole('link', { name: 'Admin' }).click();
    
    // Restore Capacity
    await page.getByRole('button', { name: 'Kapacity' }).click();
    await limitInput.fill('1000'); // Restore high limit
    await page.getByRole('button', { name: 'Uložit globální limity' }).click();
    
    // Delete Product
    await page.getByRole('button', { name: 'Produkty' }).click();
    page.on('dialog', dialog => dialog.accept());
    await page.locator('tr', { hasText: PRODUCT_NAME }).getByRole('button').nth(1).click();
  });
});
