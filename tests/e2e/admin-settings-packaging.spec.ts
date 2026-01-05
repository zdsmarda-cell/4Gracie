
import { test, expect } from '@playwright/test';

test.describe('Admin - Settings & Configuration', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login as Admin
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should display all packaging fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Balení' }).click();

    // Global Limit
    await expect(page.getByText('Limit pro balné zdarma (Kč):')).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeEditable();

    // Add New Packaging
    await page.getByRole('button', { name: 'Nový typ obalu' }).click();
    const modal = page.locator('div.fixed').filter({ hasText: 'Nový obal' }).last();
    
    await expect(modal).toBeVisible();
    
    // Check fields
    await expect(modal.locator('text=Název')).toBeVisible();
    await expect(modal.locator('input').first()).toBeVisible();
    
    await expect(modal.locator('text=Objem (ml)')).toBeVisible();
    await expect(modal.locator('div').filter({ hasText: /^Objem \(ml\)$/ }).getByRole('spinbutton')).toBeVisible();
    
    await expect(modal.locator('text=Cena (Kč)')).toBeVisible();
    await expect(modal.locator('div').filter({ hasText: /^Cena \(Kč\)$/ }).getByRole('spinbutton')).toBeVisible();
  });

  test('should display all operator company fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Provozovatel' }).click();
    
    const form = page.locator('form');
    
    // Identity
    await expect(form.locator('text=Název')).toBeVisible();
    await expect(form.locator('text=Email')).toBeVisible();
    await expect(form.locator('text=Telefon')).toBeVisible();
    
    // Address
    await expect(form.locator('text=Ulice')).toBeVisible();
    await expect(form.locator('text=Město')).toBeVisible();
    await expect(form.locator('text=PSČ')).toBeVisible();
    
    // Legal
    await expect(form.locator('text=IČ')).toBeVisible();
    await expect(form.locator('text=DIČ')).toBeVisible();
    await expect(form.locator('text=Číslo účtu')).toBeVisible();
    
    // Ensure inputs are editable
    await expect(form.locator('input').first()).toBeEditable();
  });

  test('should display app settings controls', async ({ page }) => {
    // Navigate to Settings tab (gear icon usually)
    await page.getByRole('button', { name: /Nastavení/ }).click(); // Depending on translation key 'admin.app_settings'
    
    // Languages
    await expect(page.getByText('Jazykové mutace')).toBeVisible();
    await expect(page.getByText('CS')).toBeVisible();
    await expect(page.getByText('EN')).toBeVisible();
    
    // AI Translation
    await expect(page.getByText('AI Překlady')).toBeVisible();
    await expect(page.getByText('Povolit automatické AI překlady')).toBeVisible();
    
    // Server
    await expect(page.getByText('Serverová nastavení')).toBeVisible();
    await expect(page.getByText('URL Aplikace')).toBeVisible();
    await expect(page.locator('input[placeholder*="http"]')).toBeVisible();
  });
});
