
import { test, expect } from '@playwright/test';

test.describe('App Basic Flow', () => {
  test('should load homepage and display menu', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/4Gracie Catering/);
    
    // Check if hero section exists
    const hero = page.locator('text=Prémiový Catering');
    await expect(hero).toBeVisible();
    
    // Check if products are loaded (wait for products to appear)
    const productButton = page.getByRole('button', { name: 'Do košíku' }).first();
    await expect(productButton).toBeVisible();
  });

  test('should add item to cart', async ({ page }) => {
    await page.goto('/');
    
    // Find first "Add to Cart" button and click
    const addBtn = page.getByRole('button', { name: 'Do košíku' }).first();
    await addBtn.click();
    
    // Check cart badge update (assuming badge appears with '1')
    const cartLink = page.getByRole('link', { name: /Košík/ }); // Depends on translation, loosely matching
    await expect(cartLink).toBeVisible();
    // Navigate to cart
    await cartLink.click();
    
    // URL should change
    await expect(page).toHaveURL(/.*cart/);
    
    // Cart should not be empty
    await expect(page.getByText('Váš košík je prázdný')).not.toBeVisible();
  });

  test('should open login modal', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: 'Přihlásit' }).first();
    await loginBtn.click();
    
    const modalHeader = page.getByRole('heading', { name: 'Přihlásit' });
    await expect(modalHeader).toBeVisible();
  });
});
