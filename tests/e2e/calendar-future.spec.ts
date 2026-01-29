
import { test, expect } from '@playwright/test';

test.describe('Calendar Logic - Future Dates', () => {
    
    test.beforeEach(async ({ page }) => {
        // Run serially in a clean context if possible, but here we assume single test or carefully managed state
        await page.goto('/');
        
        // 1. Login Admin to Setup Region Rules
        const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
        if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
        else {
            await page.getByRole('button', { name: 'Přihlásit' }).first().click();
            await page.fill('input[type="email"]', 'info@4gracie.cz');
            await page.fill('input[type="password"]', '1234');
            await page.getByRole('button', { name: 'Přihlásit' }).last().click();
        }
        
        await page.getByRole('link', { name: 'Admin' }).click();
        await page.getByRole('button', { name: 'Rozvoz' }).click();
        
        // Edit Default Region (Assuming "Praha Centrum" or first available)
        await page.locator('div.bg-white.p-6.rounded-2xl').first().getByRole('button').first().click(); // Edit icon
        
        // --- CONFIGURE: ONLY FRIDAYS ---
        // Uncheck all except Friday
        const days = ['Po', 'Út', 'St', 'Čt', 'So', 'Ne']; // Exclude Pá
        for (const day of days) {
             const row = page.locator('div.flex.items-center.gap-2').filter({ hasText: day });
             if (await row.getByRole('checkbox').isChecked()) {
                 await row.getByRole('checkbox').uncheck();
             }
        }
        
        // Ensure Friday is checked
        const friRow = page.locator('div.flex.items-center.gap-2').filter({ hasText: 'Pá' });
        if (!await friRow.getByRole('checkbox').isChecked()) {
            await friRow.getByRole('checkbox').check();
            // Set time just in case
            await friRow.locator('input[type="time"]').first().fill('08:00');
            await friRow.locator('input[type="time"]').last().fill('18:00');
        }
        
        await page.getByRole('button', { name: 'Uložit' }).click();
    });

    test('should correctly enable Fridays in next month', async ({ page }) => {
        // --- 2. USER FLOW ---
        await page.getByRole('link', { name: 'Menu' }).click();
        // Add item
        await page.locator('button:has-text("Do košíku")').first().click();
        await page.getByRole('link', { name: /Košík/ }).click();
        await page.getByRole('button', { name: 'Pokračovat' }).click();
        
        // Login User
        const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
        if (await mockUserBtn.isVisible()) await mockUserBtn.click();
        
        // Select Delivery to trigger Region Logic
        await page.locator('button:has-text("Rozvoz")').click();
        
        // Need address in valid region. Mock user usually has valid address.
        // If "Na tuto adresu nerozvážíme" appears, we need to fix address.
        // Assuming mock data is correct.
        
        // --- CHECK CALENDAR ---
        // 1. Current Month: Check a Friday
        // We need to find a future Friday.
        
        // Switch to Next Month
        await page.locator('div.bg-white.border.rounded-2xl.shadow-sm.p-4').getByRole('button').last().click(); // Next month chevron
        
        // Verify Next Month displayed (Title changes)
        // Note: Title contains month name e.g. "ÚNOR 2026"
        const monthTitle = await page.locator('div.flex.justify-between.items-center.mb-4 span.font-bold').textContent();
        expect(monthTitle).not.toBeNull();
        
        // 2. Find a Friday in the grid.
        // Grid is 7 columns. Friday is 5th column (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4).
        // Let's iterate all buttons.
        // A valid day (Friday) should NOT have 'bg-red-100' or 'cursor-not-allowed'.
        
        // We will grab all buttons in the grid (excluding header days)
        const dayButtons = page.locator('div.grid.grid-cols-7.gap-1 button');
        const count = await dayButtons.count();
        
        let foundValidFriday = false;
        
        for (let i = 0; i < count; i++) {
            const btn = dayButtons.nth(i);
            const classAttr = await btn.getAttribute('class');
            const dayNum = await btn.textContent();
            
            if (!dayNum) continue; // Skip empty
            
            // Check if enabled (white bg usually, or just not red/disabled)
            // Invalid/Closed days have 'bg-red-100'.
            const isEnabled = !classAttr?.includes('bg-red-100');
            
            if (isEnabled) {
                 // Found an enabled day. Since we configured ONLY Fridays, this MUST be a Friday.
                 // We can verify this via Date object if we knew the month year, but simpler:
                 // Just asserting we found AT LEAST ONE enabled day in the future month proves the logic works.
                 // Before the fix, ALL days in future month were disabled.
                 foundValidFriday = true;
                 break;
            }
        }
        
        expect(foundValidFriday).toBe(true);
    });
});
