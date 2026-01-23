
export const sendEventNotification = async (date, products, recipients) => {
    const db = await getDb();
    if (!db) return;

    // Get Base URL for images and links
    let baseUrl = process.env.APP_URL || process.env.VITE_API_URL || 'http://localhost:3000';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    
    // Try to attach port if missing and available in env (common in node hosting)
    if (process.env.PORT && !baseUrl.includes(`:${process.env.PORT}`) && !baseUrl.startsWith('https')) {
         baseUrl = `${baseUrl}:${process.env.PORT}`;
    }
    
    const formattedDate = formatDate(date);
    const subject = `Speciální akce na den ${formattedDate}`;

    // Generate Product Rows
    const itemsHtml = products.map(p => {
        const imageUrl = p.images && p.images[0] ? getImgUrl(p.images[0]) : '';
        return `
        <tr>
            <td style="padding: 15px; border-bottom: 1px solid #eee; width: 60px;">
                ${imageUrl ? `<img src="${imageUrl}" alt="${p.name}" width="60" height="60" style="border-radius: 8px; object-fit: cover; display: block;">` : ''}
            </td>
            <td style="padding: 15px; border-bottom: 1px solid #eee; vertical-align: middle;">
                <div style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">${p.name}</div>
                <div style="font-size: 12px; color: #6b7280;">${p.description ? p.description.substring(0, 60) + (p.description.length > 60 ? '...' : '') : ''}</div>
            </td>
            <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: right; vertical-align: middle; white-space: nowrap;">
                <span style="font-size: 16px; font-weight: bold; color: #9333ea;">${p.price} Kč</span>
            </td>
        </tr>
        `;
    }).join('');
    
    const html = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="text-align: center; padding: 30px 0; background-color: #1f2937; border-bottom: 4px solid #9333ea;">
                <img src="${baseUrl}/logo.png" alt="4Gracie Catering" width="120" style="display: block; margin: 0 auto;">
                <h1 style="color: #ffffff; margin: 20px 0 0 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Speciální Akce</h1>
            </div>

            <!-- Content -->
            <div style="padding: 30px 20px;">
                <p style="font-size: 16px; color: #374151; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                    Dobrý den,<br><br>
                    Na den <strong style="color: #9333ea;">${formattedDate}</strong> jsme pro vás připravili tuto speciální nabídku. <br>
                    Neváhejte a objednejte si včas, kapacity jsou omezené!
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="text-align: center; margin-top: 40px;">
                    <a href="${baseUrl}" style="background-color: #9333ea; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(147, 51, 234, 0.25);">
                        Objednat nyní na e-shopu
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} 4Gracie Catering</p>
                <p style="margin: 5px 0 0 0;">Toto je automaticky generovaná zpráva.</p>
            </div>
        </div>
    `;

    // Bulk insert into queue
    // Note: We use a loop here for simplicity with our queue structure.
    // Ideally bulk insert query for performance if 1000s of users.
    for (const email of recipients) {
        await db.query(
            "INSERT INTO email_queue (type, recipient_email, subject, payload) VALUES (?, ?, ?, ?)",
            ['event_notify', email, subject, JSON.stringify({ html })]
        );
    }
};
