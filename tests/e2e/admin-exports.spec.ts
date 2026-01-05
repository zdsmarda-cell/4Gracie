
import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import fs from 'fs';

test.describe('Admin - Excel Exports Verification', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login as Admin
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) {
        await mockAdminBtn.click();
    } else {
        await page.getByRole('button', { name: 'Přihlásit' }).first().click();
        await page.fill('input[placeholder="Email"]', 'info@4gracie.cz');
        await page.fill('input[placeholder="Heslo"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit' }).last().click();
    }
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should export selected orders to XLSX with correct columns', async ({ page }) => {
    // 1. Navigate to Orders
    await page.getByRole('button', { name: 'Objednávky' }).click();

    // 2. Select All Orders (Checkbox in thead)
    const selectAllCheckbox = page.locator('thead input[type="checkbox"]');
    await selectAllCheckbox.check();
    
    // Ensure "Export" button is visible
    const exportBtn = page.getByRole('button', { name: /Exportovat do účetnictví/ });
    await expect(exportBtn).toBeVisible();

    // 3. Trigger Download
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    // 4. Verify Filename
    expect(download.suggestedFilename()).toContain('export_objednavek');
    expect(download.suggestedFilename()).toContain('.xlsx');

    // 5. Save and Parse File
    const filePath = await download.path();
    const workbook = XLSX.readFile(filePath!);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    // 6. Verify Content and Structure
    expect(data.length).toBeGreaterThan(0);
    const firstRow = data[0];

    // Check essential columns
    expect(firstRow).toHaveProperty('ID');
    expect(firstRow).toHaveProperty('Datum');
    expect(firstRow).toHaveProperty('Zákazník');
    expect(firstRow).toHaveProperty('Stav');
    expect(firstRow).toHaveProperty('Zaplaceno');
    expect(firstRow).toHaveProperty('Celkem k úhradě');
    
    // Check Tax Columns (Dynamic based on logic, but ensuring basic ones exist if data implies it)
    // Note: Keys might not exist if value is 0 in some logic, but usually we init them.
    // Checking loosely for keys containing "Celkem"
    const keys = Object.keys(firstRow);
    const hasTotalColumn = keys.some(k => k.includes('Celkem'));
    expect(hasTotalColumn).toBeTruthy();
  });

  test('should export selected users to XLSX', async ({ page }) => {
    // 1. Navigate to Users
    await page.getByRole('button', { name: 'Uživatelé' }).click();

    // 2. Select All Users
    const selectAllCheckbox = page.locator('thead input[type="checkbox"]');
    await selectAllCheckbox.check();

    // 3. Trigger Download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Exportovat vybrané/ }).click();
    const download = await downloadPromise;

    // 4. Verify Filename
    expect(download.suggestedFilename()).toBe('export_uzivatelu.xlsx');

    // 5. Parse
    const filePath = await download.path();
    const workbook = XLSX.readFile(filePath!);
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    // 6. Verify Content
    expect(data.length).toBeGreaterThan(0);
    const userRow = data[0];

    // Check specific columns for User export
    expect(userRow).toHaveProperty('ID');
    expect(userRow).toHaveProperty('Jméno');
    expect(userRow).toHaveProperty('Email');
    expect(userRow).toHaveProperty('Telefon');
    expect(userRow).toHaveProperty('Role');
    expect(userRow).toHaveProperty('Marketing'); // 'ANO'/'NE'
    expect(userRow).toHaveProperty('Stav'); // 'AKTIVNÍ'/'BLOKOVÁN'
  });

  test('should export daily load/production stats to XLSX', async ({ page }) => {
    // 1. Navigate to Load (Vytížení)
    await page.getByRole('button', { name: 'Vytížení' }).click();

    // 2. Open Detail Modal for the first available date
    // We look for the "Eye" icon button in the table
    const detailBtn = page.locator('button:has(.lucide-eye)').first();
    
    // If no dates/orders exist, this test might need seeding. Assuming MOCK_ORDERS exist.
    if (await detailBtn.count() === 0) {
        test.skip(true, 'No production data available to test export');
        return;
    }
    await detailBtn.click();

    // 3. Wait for Modal and Data
    const modal = page.locator('div.fixed').filter({ hasText: 'Detail výroby' });
    await expect(modal).toBeVisible();
    
    // 4. Trigger Download
    const downloadPromise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Export XLS' }).click();
    const download = await downloadPromise;

    // 5. Verify Filename
    expect(download.suggestedFilename()).toContain('vyroba_');
    expect(download.suggestedFilename()).toContain('.xlsx');

    // 6. Parse content
    const filePath = await download.path();
    const workbook = XLSX.readFile(filePath!);
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    // 7. Verify Structure
    // The export structure has rows for Categories headers and Item rows.
    // We look for at least some item rows having 'Název' and 'Ks'.
    const itemRows = data.filter(r => r['Název'] && r['Ks']);
    
    // Check if we have headers or content
    expect(data.length).toBeGreaterThan(0);
    
    // Check standard columns defined in LoadTab.tsx
    const keys = Object.keys(data.find(r => r['Název'] && r['Ks']) || data[0]);
    expect(keys).toContain('Název');
    expect(keys).toContain('Ks');
    expect(keys).toContain('Jednotka');
    expect(keys).toContain('Pracnost (Suma)');
  });

});
