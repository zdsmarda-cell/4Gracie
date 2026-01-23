
import { test, expect } from '@playwright/test';

test.describe('Admin - Categories (Comprehensive)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Kategorie' }).click();
  });

  test('should manage main categories and subcategories', async ({ page }) => {
    // 1. Create Main Category
    await page.getByRole('button', { name: 'Nová kategorie' }).click();
    const catName = `Main Cat ${Date.now()}`;
    
    // Validation check
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText('Vyplňte název')).toBeVisible();

    await page.locator('div').filter({ hasText: /^Název/ }).getByRole('textbox').fill(catName);
    await page.getByRole('button', { name: 'Uložit' }).click();

    await expect(page.getByRole('row', { name: catName })).toBeVisible();

    // 2. Add Subcategory
    // Find the "+" button row below the category
    // In CategoriesTab, the row structure is complex. We look for the "Přidat podkategorii" button 
    // inside the section corresponding to our category.
    // Assuming our category is at bottom, or we filter by name proximity.
    
    // Find row with catName
    const catRow = page.getByRole('row', { name: catName });
    // The "Add Sub" button is in the next row usually or visually associated.
    // Click edit on main category to ensure we have the right one? No, buttons are inline.
    
    // Locate the "Add Subcategory" button which is structurally after our category row
    // Strategy: Use text filter
    await page.getByRole('button', { name: 'Přidat podkategorii' }).last().click();

    const subName = `Sub ${Date.now()}`;
    await page.locator('div').filter({ hasText: /^Název/ }).getByRole('textbox').fill(subName);
    await page.getByRole('button', { name: 'Uložit' }).click();

    await expect(page.getByText(subName)).toBeVisible();

    // 3. Delete Main Category (Should be blocked if has subcats? Or deletes both?)
    // Logic: Request delete.
    const deleteBtn = catRow.getByRole('button').nth(1);
    await deleteBtn.click();
    await page.getByRole('button', { name: 'Smazat' }).click();

    await expect(page.getByText(catName)).not.toBeVisible();
  });

  test('should manage capacity categories', async ({ page }) => {
    await page.getByText('Kapacitní kategorie').click();
    
    await page.getByRole('button', { name: 'Nová skupina' }).click();
    const capName = `Fryer ${Date.now()}`;
    
    await page.locator('div').filter({ hasText: /^Název skupiny/ }).getByRole('textbox').fill(capName);
    await page.getByRole('button', { name: 'Uložit' }).click();

    await expect(page.getByRole('row', { name: capName })).toBeVisible();

    // Delete
    const row = page.getByRole('row', { name: capName });
    await row.getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Smazat' }).click();
    
    await expect(page.getByText(capName)).not.toBeVisible();
  });
});
