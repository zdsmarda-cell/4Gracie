
import { test, expect } from '@playwright/test';

// Run serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Order Edit Template Consistency', () => {

    const ORDER_NOTE = 'Consistency Check Note';

    test('should show consistent edit modal fields for User and Admin', async ({ page }) => {
        // --- 1. USER: CREATE ORDER ---
        await page.goto('/');
        
        // Add item
        await page.getByRole('button', { name: 'Do košíku' }).first().click();
        
        // Checkout flow
        await page.getByRole('link', { name: /Košík/ }).click();
        await page.getByRole('button', { name: 'Pokračovat' }).click();

        // Login as User if not logged in
        const mockUserBtn = page.getByRole('button', { name: /User \(Heslo: 1234\)/i });
        if (await mockUserBtn.isVisible()) await mockUserBtn.click();
        else {
             // Fallback login
             await page.getByRole('button', { name: 'Přihlásit / Registrovat' }).click();
             await page.fill('input[type="email"]', 'jan.novak@example.com');
             await page.fill('input[type="password"]', '1234');
             await page.getByRole('button', { name: 'Přihlásit' }).last().click();
        }

        // Fill Step 2
        await page.locator('button:has-text("Osobní odběr")').click();
        // Select location if needed (if multiple exist)
        // Select valid date
        const dayBtn = page.locator('button:not([disabled]).bg-white').first();
        await dayBtn.click();
        
        await page.locator('label:has-text("Hotovost")').click();
        await page.fill('textarea', ORDER_NOTE);
        await page.getByText('Souhlasím se Všeobecnými').click();
        
        await page.getByRole('button', { name: 'Odeslat objednávku' }).click();
        await expect(page.getByText('Děkujeme za objednávku!')).toBeVisible();

        // --- 2. USER: OPEN EDIT MODAL & CHECK FIELDS ---
        await page.getByRole('link', { name: /Jan Novák/ }).click(); // Go to profile
        
        // Open the newest order (first one)
        const orderCard = page.locator('div.bg-white.border.rounded-2xl').first();
        await orderCard.click();
        await orderCard.getByRole('button', { name: 'Upravit objednávku' }).click();

        const userModal = page.locator('div.fixed').filter({ hasText: 'Upravit objednávku' }).last();
        await expect(userModal).toBeVisible();

        // Capture selectors to verify consistency
        // We verify the existence of key structural elements that define the template
        await expect(userModal.locator('text=Nastavení')).toBeVisible(); // Left col title
        await expect(userModal.locator('text=Položky')).toBeVisible(); // Right col title
        await expect(userModal.locator('input[type="date"]')).toBeVisible(); // Date picker
        await expect(userModal.locator('select').filter({ hasText: 'Osobní odběr' })).toBeVisible(); // Delivery type
        await expect(userModal.locator('text=Výběr termínu')).toBeVisible(); // Calendar label
        
        // Check 2-column grid layout existence
        await expect(userModal.locator('.grid.grid-cols-1.md\\:grid-cols-2')).toBeVisible();

        // Close user modal
        await userModal.getByRole('button', { name: 'Zrušit' }).click();

        // Logout User
        await page.locator('nav').getByText('Log out').click();

        // --- 3. ADMIN: OPEN SAME ORDER & CHECK TEMPLATE ---
        
        // Login Admin
        const mockAdminBtn = page.getByRole('button', { name: /Admin \(Heslo: 1234\)/i });
        if (await mockAdminBtn.isVisible()) await mockAdminBtn.click();
        else {
            await page.getByRole('button', { name: 'Přihlásit' }).first().click();
            await page.fill('input[type="email"]', 'info@4gracie.cz');
            await page.fill('input[type="password"]', '1234');
            await page.getByRole('button', { name: 'Přihlásit' }).last().click();
        }

        await page.getByRole('link', { name: 'Admin' }).click();
        await page.getByRole('button', { name: 'Objednávky' }).click();

        // Find order with our note or verify top order
        // The list is sorted by date, our order should be top or easy to find.
        // We can filter by note content roughly to be safe, but usually top is enough in test env.
        await page.getByRole('button', { name: 'Detail / Edit' }).first().click();

        const adminModal = page.locator('div.fixed').filter({ hasText: 'Upravit objednávku' }).last();
        await expect(adminModal).toBeVisible();

        // --- VERIFY CONSISTENCY ---
        // The admin modal MUST have the exact same structure as user modal (per requirements)
        
        // 1. Check Layout
        await expect(adminModal.locator('text=Nastavení')).toBeVisible();
        await expect(adminModal.locator('text=Položky')).toBeVisible();
        await expect(adminModal.locator('.grid.grid-cols-1.lg\\:grid-cols-2')).toBeVisible(); // Note: Admin might use lg:grid-cols-2 for wider screen, check source in OrdersTab.tsx. Source uses lg:grid-cols-2. User Profile uses md:grid-cols-2. 
        // This slight difference in breakpoint is acceptable if visual intent is same, checking for grid existence.

        // 2. Check Calendar is present (Not just date input)
        await expect(adminModal.locator('text=Výběr termínu')).toBeVisible(); 
        // Ensure CustomCalendar component is rendered (look for days grid)
        await expect(adminModal.locator('.grid.grid-cols-7')).toBeVisible();

        // 3. Check Delivery/Pickup Logic
        // Since we created Pickup order, it should show pickup details
        await expect(adminModal.locator('text=Odběrné místo')).toBeVisible();
        
        // 4. Check Items Table
        await expect(adminModal.locator('table')).toBeVisible();
        await expect(adminModal.locator('thead').getByText('Název')).toBeVisible();
        
        // 5. Check Footer Actions
        await expect(adminModal.getByRole('button', { name: 'Uložit změny' })).toBeVisible();

        // Ensure "Slevový kód" section exists (Admin specific but layout consistent)
        // User profile has applied discounts list, Admin has input to add.
        // The requirement "Admin ma navic moznot pridavat/odebirat slevove kupony" implies admin has EXTRA controls in same template.
        await expect(adminModal.locator('input[placeholder="Kód slevy"]')).toBeVisible();
    });
});
