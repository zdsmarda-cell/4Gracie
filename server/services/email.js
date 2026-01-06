
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { generateInvoicePdf } from './pdf.js';

let transporter = null;

export const initEmail = async () => {
    if (process.env.SMTP_HOST) {
        try {
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 465,
                secure: process.env.SMTP_SECURE === 'true',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                tls: { rejectUnauthorized: false }
            });
            await transporter.verify();
            console.log(`✅ SMTP Ready (${process.env.SMTP_USER})`);
        } catch (e) {
            console.error('❌ SMTP Init Error:', e.message);
        }
    } else {
        console.warn('⚠️ SMTP_HOST not set. Emails will not be sent.');
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

const STATUS_TRANSLATIONS = {
    cs: {
        created: 'Zadaná',
        confirmed: 'Potvrzená',
        preparing: 'Připravuje se',
        ready: 'Připravena',
        on_way: 'Na cestě',
        delivered: 'Doručena',
        not_picked_up: 'Nedoručena/Nevyzvednuta',
        cancelled: 'Stornována'
    },
    en: {
        created: 'Created',
        confirmed: 'Confirmed',
        preparing: 'Preparing',
        ready: 'Ready',
        on_way: 'On the way',
        delivered: 'Delivered',
        not_picked_up: 'Not picked up',
        cancelled: 'Cancelled'
    },
    de: {
        created: 'Erstellt',
        confirmed: 'Bestätigt',
        preparing: 'In Vorbereitung',
        ready: 'Bereit',
        on_way: 'Unterwegs',
        delivered: 'Geliefert',
        not_picked_up: 'Nicht abgeholt',
        cancelled: 'Storniert'
    }
};

const TRANSLATIONS = {
    cs: {
        created_subject: 'Potvrzení objednávky',
        updated_subject: 'Úprava objednávky',
        status_update_subject: 'Změna stavu objednávky',
        status_prefix: 'Nový stav objednávky:',
        total: 'Celkem',
        shipping: 'Doprava',
        packaging: 'Balné',
        discount: 'Sleva',
        items: 'Položky'
    },
    en: {
        created_subject: 'Order Confirmation',
        updated_subject: 'Order Update',
        status_update_subject: 'Order Status Update',
        status_prefix: 'New Order Status:',
        total: 'Total',
        shipping: 'Shipping',
        packaging: 'Packaging',
        discount: 'Discount',
        items: 'Items'
    },
    de: {
        created_subject: 'Bestellbestätigung',
        updated_subject: 'Bestellaktualisierung',
        status_update_subject: 'Bestellstatusänderung',
        status_prefix: 'Neuer Bestellstatus:',
        total: 'Gesamt',
        shipping: 'Versand',
        packaging: 'Verpackung',
        discount: 'Rabatt',
        items: 'Artikel'
    }
};

// Helper for image URLs
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    
    const port = process.env.PORT || 3000;
    let baseUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost';
    
    if (!baseUrl.includes(':', 6)) { 
        baseUrl = `${baseUrl}:${port}`;
    }
    
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    
    return `${baseUrl}${cleanPath}`;
};

const generateOrderHtml = (order, title, message, lang = 'cs', settings = {}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.cs;
    const total = Math.max(0, order.totalPrice + order.packagingFee + (order.deliveryFee || 0) - (order.appliedDiscounts?.reduce((a,b)=>a+b.amount,0)||0));
    
    // Construct Address Logic
    let addressDisplay = '';
    if (order.deliveryStreet && order.deliveryCity) {
        addressDisplay = `${order.deliveryName || ''}<br>${order.deliveryStreet}<br>${order.deliveryZip} ${order.deliveryCity}`;
        if(order.deliveryPhone) addressDisplay += `<br>Tel: ${order.deliveryPhone}`;
    } else {
        addressDisplay = (order.deliveryAddress || 'Adresa neuvedena').replace(/\n/g, '<br>');
    }

    let itemsHtml = order.items.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                ${item.images && item.images[0] ? `<img src="${getImgUrl(item.images[0])}" alt="${item.name}" width="50" style="border-radius: 5px;">` : ''}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>${item.name}</strong>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                ${item.quantity} ${item.unit}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                ${item.price} Kc
            </td>
        </tr>
    `).join('');

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #1f2937; border-bottom: 2px solid #9333ea; padding-bottom: 10px;">${title} #${order.id}</h2>
            
            ${message ? `<p style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; font-weight: bold;">${message}</p>` : ''}
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f9fafb; text-align: left;">
                        <th style="padding: 10px;">Foto</th>
                        <th style="padding: 10px;">${t.items}</th>
                        <th style="padding: 10px; text-align: center;">Ks</th>
                        <th style="padding: 10px; text-align: right;">Cena</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div style="margin-top: 20px; background-color: #f9fafb; padding: 15px; border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Zbozi:</span> <span>${order.totalPrice} Kc</span>
                </div>
                ${order.deliveryFee > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>${t.shipping}:</span> <span>${order.deliveryFee} Kc</span></div>` : ''}
                ${order.packagingFee > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>${t.packaging}:</span> <span>${order.packagingFee} Kc</span></div>` : ''}
                ${order.appliedDiscounts?.map(d => `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: green;"><span>${t.discount} (${d.code}):</span> <span>-${d.amount} Kc</span></div>`).join('') || ''}
                
                <div style="border-top: 1px solid #ddd; margin-top: 10px; padding-top: 10px; font-size: 18px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>${t.total}:</span> <span>${total} Kc</span>
                </div>
            </div>

            <div style="margin-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Termín:</strong> ${formatDate(order.deliveryDate)}</p>
                <p><strong>Místo dodání / odběru:</strong><br> ${addressDisplay}</p>
                ${order.note ? `<p><strong>Poznámka:</strong><br> ${order.note}</p>` : ''}
            </div>
        </div>
    `;
    
    if (settings.server?.consoleLogging) {
        console.log("--- DEBUG EMAIL HTML ---");
        console.log(htmlContent);
        console.log("------------------------");
    }

    return htmlContent;
};

// Event Notification Email Logic
export const sendEventNotification = async (eventDate, products, recipients) => {
    if (!transporter || recipients.length === 0) return;

    const formattedDate = formatDate(eventDate);
    const subject = `Speciální akce na ${formattedDate} - Objednejte si včas!`;
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || '#';

    // Helper to calculate deadline date
    const getDeadline = (leadTime) => {
        const d = new Date(eventDate);
        d.setDate(d.getDate() - leadTime);
        return formatDate(d.toISOString());
    };

    const productsHtml = products.map(p => {
        const leadTimeMsg = p.leadTimeDays > 0 
            ? `Objednat do: <strong>${getDeadline(p.leadTimeDays)}</strong>` 
            : 'Objednat lze ihned';
            
        return `
        <div style="display: flex; gap: 15px; border-bottom: 1px solid #eee; padding: 15px 0; align-items: center;">
            <div style="width: 80px; height: 80px; flex-shrink: 0; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                ${p.images && p.images[0] 
                    ? `<img src="${getImgUrl(p.images[0])}" style="width: 100%; height: 100%; object-fit: cover;" alt="${p.name}">` 
                    : ''}
            </div>
            <div>
                <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #1f2937;">${p.name}</h3>
                <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">${p.description || ''}</p>
                <div style="font-size: 12px; color: #9333ea; font-weight: bold;">
                    ${leadTimeMsg}
                </div>
            </div>
        </div>
    `}).join('');

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #9333ea; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Nová cateringová akce!</h1>
                <p style="color: #f3e8ff; margin: 5px 0 0 0; font-size: 16px;">Připravili jsme pro vás speciální nabídku na den ${formattedDate}.</p>
            </div>
            
            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="margin-bottom: 20px;">Využijte naši nabídku akčních produktů. Pozor na termíny objednání!</p>
                
                ${productsHtml}
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; background-color: #9333ea; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                        Objednat nyní
                    </a>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #9ca3af;">
                Tento email jste obdrželi, protože jste přihlášeni k odběru novinek.<br>
                Pokud si nepřejete dostávat tato sdělení, můžete změnit nastavení ve svém profilu.
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            bcc: recipients,
            subject: subject,
            html: htmlContent,
            encoding: 'base64'
        });
        console.log(`✅ Event notification sent to ${recipients.length} recipients.`);
    } catch (e) {
        console.error('❌ Failed to send event notification:', e.message);
    }
};

export const sendOrderEmail = async (order, type, settings, customStatus = null) => {
    if (!transporter) {
        console.warn('⚠️ Cannot send email: Transporter not initialized.');
        return;
    }

    const lang = order.language || 'cs';
    const t = TRANSLATIONS[lang] || TRANSLATIONS.cs;
    const attachments = [];

    // --- 1. PREPARE ATTACHMENTS (Only for Customer on Created/Delivered) ---
    // VOP
    if (type === 'created' && process.env.VOP_PATH && fs.existsSync(process.env.VOP_PATH)) {
        attachments.push({
            filename: 'VOP.pdf',
            path: process.env.VOP_PATH
        });
    }

    // Invoice
    try {
        if (type === 'created') {
            const pdfBuffer = await generateInvoicePdf(order, 'proforma', settings);
            attachments.push({
                filename: `Zalohova_faktura_${order.id}.pdf`,
                content: pdfBuffer
            });
        } else if (type === 'status' && customStatus === 'delivered') {
            const pdfBuffer = await generateInvoicePdf(order, 'final', settings);
            attachments.push({
                filename: `Danovy_doklad_${order.id}.pdf`,
                content: pdfBuffer
            });
        }
    } catch (err) {
        console.error("❌ PDF Generation failed:", err);
        // Continue sending email without PDF if generation fails
    }

    // --- 2. FETCH CUSTOMER EMAIL ---
    let customerEmail = null;
    try {
        const { getDb } = await import('../db.js');
        const db = await getDb();
        const [u] = await db.query('SELECT email FROM users WHERE id=?', [order.userId]);
        customerEmail = u[0]?.email;
    } catch (err) {
        console.error("❌ Failed to fetch customer email:", err);
    }

    let subject = '';
    let messageHtml = '';
    let title = '';

    // --- 3. DETERMINE CONTENT ---
    if (type === 'created') {
        subject = `${t.created_subject} #${order.id}`;
        title = t.created_subject;
        messageHtml = generateOrderHtml(order, title, "Děkujeme za Vaši objednávku.", lang, settings);
    } else if (type === 'updated') {
        subject = `${t.updated_subject} #${order.id}`;
        title = t.updated_subject;
        messageHtml = generateOrderHtml(order, title, "Vaše objednávka byla upravena.", lang, settings);
    } else if (type === 'status') {
        subject = `${t.status_update_subject} #${order.id}`;
        title = t.status_update_subject;
        const localizedStatus = STATUS_TRANSLATIONS[lang]?.[customStatus] || customStatus;
        const statusMsg = `${t.status_prefix} ${localizedStatus}`;
        messageHtml = generateOrderHtml(order, title, statusMsg, lang, settings);
    }

    // --- 4. SEND TO CUSTOMER ---
    if (customerEmail) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: customerEmail,
                subject,
                html: messageHtml,
                encoding: 'base64',
                attachments: attachments // Attachments only for customer
            });
            console.log(`📧 Customer email sent to: ${customerEmail} (${type})`);
        } catch (e) {
            console.error(`❌ Failed to send customer email (${type}):`, e.message);
        }
    } else {
        console.warn(`⚠️ No customer email found for User ID: ${order.userId}`);
    }

    // --- 5. SEND TO OPERATOR (Only on Created or Updated by User) ---
    if ((type === 'created' || type === 'updated') && settings.companyDetails?.email) {
        try {
            const operatorSubject = type === 'created' ? `Nová objednávka #${order.id}` : `Aktualizace objednávky #${order.id}`;
            const operatorTitle = type === 'created' ? "Nová objednávka" : "Úprava objednávky";
            const operatorMsg = type === 'created' ? "Přišla nová objednávka z e-shopu." : "Zákazník upravil existující objednávku.";
            
            const operatorHtml = generateOrderHtml(order, operatorTitle, operatorMsg, 'cs', settings);
            
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: settings.companyDetails.email,
                subject: operatorSubject,
                html: operatorHtml,
                encoding: 'base64'
                // No attachments for operator usually needed, or can add if requested
            });
            console.log(`📧 Operator email sent to: ${settings.companyDetails.email} (${type})`);
        } catch (e) {
            console.error(`❌ Failed to send operator email:`, e.message);
        }
    }
};
