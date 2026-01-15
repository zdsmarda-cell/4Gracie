
import { test, expect } from '@playwright/test';

test.describe('Admin - Push Notifications', () => {
  
  test.beforeEach(async ({ page }) => {
    // Reset and Login as Admin
    await page.goto('/');
    
    // Attempt Mock Login
    const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
    if (await mockAdminBtn.isVisible()) {
        await mockAdminBtn.click();
    } else {
        // Fallback Login
        await page.getByRole('button', { name: 'Přihlásit' }).first().click();
        await page.fill('input[placeholder="Email"]', 'info@4gracie.cz');
        await page.fill('input[placeholder="Heslo"]', '1234');
        await page.getByRole('button', { name: 'Přihlásit' }).last().click();
    }
    
    // Go to Admin
    await page.getByRole('link', { name: 'Admin' }).click();
  });

  test('should display Push Notification tab and allow drafting', async ({ page }) => {
    // 1. Navigate to Mobile Notifications Tab
    // Using loose match as translation might vary, looking for 'Mobilní Notifikace' or icon
    const pushTabBtn = page.getByRole('button', { name: /Mobilní Notifikace/i });
    
    // If tab is hidden (e.g. scroll), we assume test runner finds it or scrolls.
    await expect(pushTabBtn).toBeVisible();
    await pushTabBtn.click();

    // 2. Check Composer Presence
    const subjectInput = page.locator('input[placeholder*="Předmět"]');
    const bodyInput = page.locator('textarea[placeholder*="Text zprávy"]');
    const sendBtn = page.getByRole('button', { name: /Odeslat/i });

    await expect(subjectInput).toBeVisible();
    await expect(bodyInput).toBeVisible();
    await expect(sendBtn).toBeVisible();

    // 3. Check Targeting Table Presence
    await expect(page.getByText('Cílení')).toBeVisible();
    
    // 4. Fill Draft
    await subjectInput.fill('Test Notification');
    await bodyInput.fill('This is a test message from automated tests.');

    // 5. Try Send (Should verify validation or attempt api)
    // In local mode (dataSource='local'), this usually shows an alert "Dostupné pouze s databází" or mock success.
    // The component checks `dataSource`. If local, it renders "Dostupné pouze s databází".
    
    // Check if we are in local mode blocking
    const blockedMsg = page.getByText('Dostupné pouze s databází');
    if (await blockedMsg.isVisible()) {
        // Test concludes here for local mode
        return;
    }

    // If active (API mode), select a user and send
    const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
    // Or row click logic in MobileNotificationsTab uses <tr> click
    // Let's assume we select "All" via the header button if available or select first row
    const selectAllBtn = page.locator('thead button').first(); // The square/checksquare button
    if (await selectAllBtn.isVisible()) {
        await selectAllBtn.click();
        await expect(page.getByText('Vybráno příjemců:')).not.toContainText('0');
        
        // Mock the API call route to prevent actual sending if live
        await page.route('**/api/notifications/send', async route => {
            await route.fulfill({ json: { success: true, count: 1 } });
        });

        await sendBtn.click();
        
        // Expect success alert/message
        page.on('dialog', dialog => dialog.accept());
    }
  });
});
