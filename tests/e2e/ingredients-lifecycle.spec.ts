
import { test, expect } from '@playwright/test';

test.describe('Admin - Ingredients Lifecycle', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Reset state (Reload) & Login as Admin
    await page.goto('/');
    
    // Check if logged in, if not log in
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) {
        await mockAdminBtn.click();
    } else {
        // Only login if needed
        const loginBtn = page.getByRole('button', { name: 'Přihlásit', exact: true });
        if (await loginBtn.isVisible()) {
            await loginBtn.click();
            await page.fill('input[placeholder="Email"]', 'info@4gracie.cz');
            await page.fill('input[placeholder="Heslo"]', '1234');
            await page.getByRole('button', { name: 'Přihlásit' }).last().click();
        }
    }
    
    // Go to Admin
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should create ingredient, block deletion if used, and allow after removal', async ({ page }) => {
    // --- 1. CREATE INGREDIENT ---
    await page.getByRole('button', { name: 'Suroviny' }).click();
    await page.getByRole('button', { name: 'Nová surovina' }).click();
    
    const ingredientName = `Test Mouka ${Date.now()}`;
    await page.locator('input').first().fill(ingredientName);
    await page.locator('select').selectOption('kg');
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    await expect(page.getByText(ingredientName)).toBeVisible();

    // --- 2. ASSIGN TO PRODUCT ---
    await page.getByRole('button', { name: 'Produkty' }).click();
    
    // Create temporary product to link
    const productName = `Pečivo ${Date.now()}`;
    await page.getByRole('button', { name: 'Přidat produkt' }).click();
    await page.fill('input[value=""]', productName); // Name
    await page.fill('input[type="number"]', '50'); // Price
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Expand product row to see ingredients section (chevron or click row)
    // The expand click is on the first cell (chevron)
    const productRow = page.locator('tr', { hasText: productName });
    await productRow.locator('td').first().click(); 
    
    // Add Ingredient
    await page.locator('select').filter({ hasText: 'Vybrat surovinu' }).selectOption({ label: `${ingredientName} (kg)` });
    await page.locator('input[placeholder="Množství"]').fill('0.5');
    await page.getByRole('button', { name: 'Přidat', exact: true }).click();
    
    // Verify added
    await expect(page.getByText(`${ingredientName}`)).toBeVisible();

    // --- 3. ATTEMPT DELETE (SHOULD FAIL) ---
    await page.getByRole('button', { name: 'Suroviny' }).click();
    
    // Click Delete on our ingredient
    const deleteBtn = page.locator('tr', { hasText: ingredientName }).getByRole('button', { name: 'Smazat' });
    await deleteBtn.click();
    
    // Expect Blocked Modal
    const blockedModal = page.locator('div.fixed').filter({ hasText: 'Nelze smazat surovinu' });
    await expect(blockedModal).toBeVisible();
    await expect(blockedModal.getByText(productName)).toBeVisible(); // Should list the product
    
    // Close Modal
    await blockedModal.getByRole('button', { name: 'Rozumím' }).click();

    // --- 4. UNASSIGN FROM PRODUCT ---
    await page.getByRole('button', { name: 'Produkty' }).click();
    await productRow.locator('td').first().click(); // Expand again
    
    // Remove ingredient
    // Find the row in the expanded section that has the ingredient name and click 'X'
    await page.locator('div.flex.items-center', { hasText: ingredientName }).getByRole('button').click();
    
    // Verify removed from list
    await expect(page.locator('div.flex.items-center', { hasText: ingredientName })).not.toBeVisible();

    // --- 5. DELETE INGREDIENT (SHOULD SUCCEED) ---
    await page.getByRole('button', { name: 'Suroviny' }).click();
    await deleteBtn.click();
    
    // Expect Confirm Modal (Standard delete)
    const confirmModal = page.locator('div.fixed').filter({ hasText: 'Smazat' }); // Title usually "Smazat [Name]?"
    await expect(confirmModal).toBeVisible();
    await confirmModal.getByRole('button', { name: 'Smazat' }).click();
    
    // Verify Gone
    await expect(page.getByText(ingredientName)).not.toBeVisible();
    
    // Cleanup Product
    await page.getByRole('button', { name: 'Produkty' }).click();
    page.on('dialog', d => d.accept());
    await page.locator('tr', { hasText: productName }).getByRole('button').nth(1).click(); // Delete product
  });
});
