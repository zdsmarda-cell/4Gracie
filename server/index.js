
// ... existing imports ...

// Helper mapping for Czech Statuses in Emails
const STATUS_TRANSLATIONS = {
    'created': 'Zadaná',
    'confirmed': 'Potvrzená',
    'preparing': 'Připravuje se',
    'ready': 'Připravena',
    'on_way': 'Na cestě',
    'delivered': 'Doručena',
    'not_picked_up': 'Nevyzvednuta',
    'cancelled': 'Stornována'
};

app.put('/api/orders/status', withDb(async (req, res, db) => {
    const { ids, status, notifyCustomer } = req.body;
    
    if (!ids || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });

    const placeholders = ids.map(() => '?').join(',');
    
    // 1. Update Status in DB
    await db.query(`
        UPDATE orders 
        SET status=?, full_json=JSON_SET(full_json, '$.status', ?) 
        WHERE id IN (${placeholders})
    `, [status, status, ...ids]);

    // 2. Send Email if requested
    if (notifyCustomer && transporter) {
        try {
            // Fetch necessary data for the affected orders
            // We join with users to get the email address reliably (though full_json might have it, user record is safer)
            const query = `
                SELECT o.id, o.full_json, u.email 
                FROM orders o 
                LEFT JOIN users u ON o.user_id = u.id 
                WHERE o.id IN (${placeholders})
            `;
            const [ordersToNotify] = await db.query(query, ids);

            for (const orderRow of ordersToNotify) {
                const userEmail = orderRow.email;
                if (!userEmail) continue;

                const dbOrder = parseJsonCol(orderRow, 'full_json');
                const translatedStatus = STATUS_TRANSLATIONS[status] || status;

                // Reconstruct Item HTML (reused from creation logic)
                const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.get('host'); 
                let appUrl = process.env.VITE_API_URL || `${protocol}://${host}`;
                if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1);

                const itemsHtml = (dbOrder.items || []).map(item => {
                    let imgUrl = '';
                    if (item.images && item.images.length > 0) {
                        if (item.images[0].startsWith('http')) {
                            imgUrl = item.images[0];
                        } else {
                            const cleanPath = item.images[0].startsWith('/') ? item.images[0] : `/${item.images[0]}`;
                            imgUrl = `${appUrl}${cleanPath}`;
                        }
                    }
                    
                    return `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">
                            ${imgUrl ? `<img src="${imgUrl}" alt="Product" width="50" height="50" style="object-fit: cover; border-radius: 5px;">` : ''}
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">
                            <strong>${item.name}</strong>
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                            ${item.quantity} ${item.unit}
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                            ${item.price} Kč
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                            <strong>${item.price * item.quantity} Kč</strong>
                        </td>
                    </tr>
                    `; 
                }).join('');

                const discountRowsHtml = (dbOrder.appliedDiscounts || []).map(d => `
                    <tr>
                        <td colspan="4" style="padding: 10px; text-align: right; color: #15803d;">Sleva (${d.code}):</td>
                        <td style="padding: 10px; text-align: right; color: #15803d;">-${d.amount} Kč</td>
                    </tr>
                `).join('');

                const totalDiscount = (dbOrder.appliedDiscounts || []).reduce((acc, d) => acc + d.amount, 0);
                const finalTotal = Math.max(0, dbOrder.totalPrice + dbOrder.packagingFee + (dbOrder.deliveryFee || 0) - totalDiscount);

                const mailOptions = {
                    from: process.env.SMTP_FROM || '"4Gracie Catering" <info@4gracie.cz>',
                    to: userEmail,
                    subject: `Aktualizace objednávky #${dbOrder.id} - ${translatedStatus}`,
                    textEncoding: 'base64',
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #9333ea;">Změna stavu objednávky</h2>
                            <p style="font-size: 16px;">U vaší objednávky <strong>#${dbOrder.id}</strong> došlo ke změně stavu na:</p>
                            <p style="font-size: 20px; font-weight: bold; color: #2563eb; text-align: center; margin: 20px 0; background: #eff6ff; padding: 10px; border-radius: 8px;">
                                ${translatedStatus.toUpperCase()}
                            </p>
                            
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

                            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Datum doručení:</strong> ${dbOrder.deliveryDate}</p>
                                <p><strong>Způsob dopravy:</strong> ${dbOrder.deliveryType === 'pickup' ? 'Osobní odběr' : 'Rozvoz'}</p>
                                <p><strong>Adresa:</strong><br/>${dbOrder.deliveryAddress.replace(/\n/g, '<br/>')}</p>
                            </div>

                            <h3>Rekapitulace košíku</h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <thead>
                                    <tr style="background: #eee;">
                                        <th style="padding: 8px;">Foto</th>
                                        <th style="padding: 8px; text-align: left;">Název</th>
                                        <th style="padding: 8px;">Množství</th>
                                        <th style="padding: 8px; text-align: right;">Cena/j</th>
                                        <th style="padding: 8px; text-align: right;">Celkem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="4" style="padding: 10px; text-align: right;">Doprava:</td>
                                        <td style="padding: 10px; text-align: right;">${dbOrder.deliveryFee} Kč</td>
                                    </tr>
                                    <tr>
                                        <td colspan="4" style="padding: 10px; text-align: right;">Balné:</td>
                                        <td style="padding: 10px; text-align: right;">${dbOrder.packagingFee} Kč</td>
                                    </tr>
                                    ${discountRowsHtml}
                                    <tr style="font-size: 18px;">
                                        <td colspan="4" style="padding: 10px; text-align: right;"><strong>CELKEM K ÚHRADĚ:</strong></td>
                                        <td style="padding: 10px; text-align: right; color: #9333ea;"><strong>${finalTotal} Kč</strong></td>
                                    </tr>
                                </tfoot>
                            </table>

                            <br/>
                            <p>Stav objednávky můžete sledovat ve svém <a href="${process.env.VITE_APP_URL || 'https://eshop.4gracie.cz'}/#/profile">zákaznickém profilu</a>.</p>
                            <hr/>
                            <p>S pozdravem,<br/>Tým 4Gracie</p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log(`📧 Status update email sent to ${userEmail} for order ${dbOrder.id}`);
            }
        } catch (e) {
            console.error("❌ Failed to send status update emails:", e);
            // We don't fail the request, just log the error, as DB update was successful
        }
    }

    res.json({ success: true });
}));

// ... existing code ...
