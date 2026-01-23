
import { test, expect } from '@playwright/test';

test.describe('Admin - Logistics (Comprehensive)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('Delivery Region: Should validate and save all fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Rozvoz' }).click();
    await page.getByRole('button', { name: 'Nová zóna' }).click();
    
    // Validation Check
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText('Vyplňte název')).toBeVisible();
    await expect(page.getByText('Vyplňte cenu')).toBeVisible();

    // Fill Data
    await page.locator('input[placeholder="Název"]').fill('E2E Region');
    await page.locator('input[placeholder="Cena dopravy"]').fill('99');
    await page.locator('input[placeholder="Zdarma od"]').fill('1000');
    
    // Opening Hours (Check Mon and set times)
    const monRow = page.locator('div.flex.items-center.gap-2').filter({ hasText: 'Po' });
    if (!await monRow.getByRole('checkbox').isChecked()) {
        await monRow.getByRole('checkbox').check();
    }
    // Set Time
    await monRow.locator('input[type="time"]').first().fill('09:00');
    await monRow.locator('input[type="time"]').last().fill('17:00');

    // Add Zip
    await page.locator('input[placeholder="Např. 66401"]').fill('11111');
    await page.getByRole('button', { name: '+' }).first().click();

    // Add Exception
    const excDiv = page.locator('div.bg-white.border.rounded-xl.p-3').filter({ hasText: 'Výjimky' });
    await excDiv.locator('input[type="date"]').fill('2025-12-24');
    await excDiv.getByRole('button', { name: '+' }).click(); // Add closed exception

    await page.getByRole('button', { name: 'Uložit' }).click();
    
    // Verify
    await expect(page.getByText('E2E Region')).toBeVisible();
    await expect(page.getByText('11111')).toBeVisible();
    await expect(page.getByText('2025-12-24')).toBeVisible(); // Exception visible

    // Cleanup
    page.on('dialog', d => d.accept());
    await page.locator('div').filter({ hasText: 'E2E Region' }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Smazat' }).click(); // Confirm custom modal
  });

  test('Pickup Location: Should validate and save', async ({ page }) => {
    await page.getByRole('button', { name: 'Odběr' }).click();
    await page.getByRole('button', { name: 'Nové místo' }).click();
    
    // Fill Data
    const name = `Pobočka ${Date.now()}`;
    await page.locator('div').filter({ hasText: /^Název místa/ }).getByRole('textbox').fill(name);
    await page.locator('div').filter({ hasText: /^Ulice/ }).getByRole('textbox').fill('Ulice 1');
    await page.locator('div').filter({ hasText: /^Město/ }).getByRole('textbox').fill('Město');
    await page.locator('div').filter({ hasText: /^PSČ/ }).getByRole('textbox').fill('10000');
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    await expect(page.getByText(name)).toBeVisible();
    
    // Cleanup
    await page.locator('div').filter({ hasText: name }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Smazat' }).click();
  });
});
