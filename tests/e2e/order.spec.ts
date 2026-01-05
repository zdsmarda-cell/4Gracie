
import { test, expect } from '@playwright/test';

test.describe('Full Order Flow', () => {
  test('should add item, login, and complete order', async ({ page }) => {
    // 1. Visit Home and Add Product
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const addToCartBtns = page.getByRole('button', { name: /Do košíku/i });
    await expect(addToCartBtns.first()).toBeVisible();
    await addToCartBtns.first().click();

    // 2. Go to Cart
    const cartLink = page.getByRole('link', { name: /Košík/i });
    await cartLink.click();
    await expect(page).toHaveURL(/.*cart/);
    
    // Check item exists
    await expect(page.getByText('Váš košík je prázdný')).not.toBeVisible();
    
    // 3. Proceed to Step 2
    await page.getByRole('button', { name: 'Pokračovat' }).click();

    // 4. Login via Mock (Simulating User)
    // The mock button is visible in local env at bottom right
    const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
    if (await mockUserBtn.isVisible()) {
        await mockUserBtn.click();
    } else {
        // Fallback if mock is hidden (e.g. production mode logic triggered), manually login
        await page.getByRole('button', { name: 'Přihlásit / Registrovat' }).click();
        await page.fill('input[type="email"]', 'jan.novak@example.com');
        await page.fill('input[type="password"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit', exact: true }).click();
    }

    // 5. Fill Checkout Form (Step 2)
    // Wait for delivery options to appear
    await expect(page.getByText('Způsob doručení')).toBeVisible();

    // Select Pickup (Simplest flow)
    const pickupOption = page.locator('button:has-text("Osobní odběr")');
    await pickupOption.click();

    // Select first available pickup location
    const pickupLoc = page.locator('div.border.cursor-pointer:has-text("Prodejna 4Gracie")');
    await expect(pickupLoc.first()).toBeVisible();
    await pickupLoc.first().click();

    // Select a Date (Click first non-disabled day in calendar)
    // We look for a button inside the calendar grid that doesn't have 'bg-red-100' or 'cursor-not-allowed'
    // Usually white background and not disabled
    const dayBtn = page.locator('button:not([disabled]).bg-white').first();
    await dayBtn.click();

    // Select Payment (Cash)
    await page.locator('label:has-text("Hotovost")').click();

    // Agree to terms
    await page.locator('input[type="checkbox"]').nth(1).check(); // Assuming 2nd checkbox is terms, or use text
    // Better selector for terms
    await page.getByText('Souhlasím se Všeobecnými obchodními podmínkami').click();

    // 6. Submit Order
    const submitBtn = page.getByRole('button', { name: 'Odeslat objednávku' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 7. Verify Success
    await expect(page.getByText('Děkujeme za objednávku!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Vaše číslo objednávky je')).toBeVisible();
  });
});
