
import nodemailer from 'nodemailer';
import { getDb } from '../db.js';
import { generateInvoicePdf } from './pdf.js';

let transporter = null;

export const initEmail = async () => {
    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });
        try {
            await transporter.verify();
            console.log('✅ Email service ready');
        } catch (error) {
            console.error('❌ Email service error:', error);
        }
    }
};

const getImgUrl = (path) => {
    if (!path) return '';
    // Pokud je to base64 nebo absolutní URL, vracíme rovnou
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) return path;
    
    // Získání base URL bez koncového lomítka
    // Priorita: APP_URL (pro produkci/email), VITE_API_URL, localhost fallback
    let baseUrl = process.env.APP_URL || process.env.VITE_API_URL || 'http://localhost:3000';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    
    // Přidání lomítka na začátek cesty, pokud chybí
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${baseUrl}${cleanPath}`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ');
};

const STATUS_TRANSLATIONS = {
    cs: { created: 'Zadaná', confirmed: 'Potvrzená', preparing: 'Připravuje se', ready: 'Připravena', on_way: 'Na cestě', delivered: 'Doručena', not_picked_up: 'Nedoručena/Nevyzvednuta', cancelled: 'Stornována' },
    en: { created: 'Created', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', on_way: 'On the way', delivered: 'Delivered', not_picked_up: 'Not picked up', cancelled: 'Cancelled' },
    de: { created: 'Erstellt', confirmed: 'Bestätigt', preparing: 'In Vorbereitung', ready: 'Bereit', on_way: 'Unterwegs', delivered: 'Geliefert', not_picked_up: 'Nicht abgeholt', cancelled: 'Storniert' }
};

const TRANSLATIONS = {
    cs: { created_subject: 'Potvrzení objednávky', updated_subject: 'Úprava objednávky', status_update_subject: 'Změna stavu objednávky', status_prefix: 'Nový stav objednávky:', total: 'Celkem', shipping: 'Doprava', packaging: 'Balné', discount: 'Sleva', items: 'Položky', goods: 'Zboží' },
    en: { created_subject: 'Order Confirmation', updated_subject: 'Order Update', status_update_subject: 'Order Status Update', status_prefix: 'New Order Status:', total: 'Total', shipping: 'Shipping', packaging: 'Packaging', discount: 'Discount', items: 'Items', goods: 'Goods' },
    de: { created_subject: 'Bestellbestätigung', updated_subject: 'Bestellaktualisierung', status_update_subject: 'Bestellstatusänderung', status_prefix: 'Neuer Bestellstatus:', total: 'Gesamt', shipping: 'Versand', packaging: 'Verpackung', discount: 'Rabatt', items: 'Artikel', goods: 'Waren' }
};

const generateOrderHtml = (order, title, message, lang = 'cs', settings = {}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.cs;
    const total = Math.max(0, order.totalPrice + order.packagingFee + (order.deliveryFee || 0) - (order.appliedDiscounts?.reduce((a,b)=>a+b.amount,0)||0));
    
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
                ${item.images && item.images[0] ? `<img src="${getImgUrl(item.images[0])}" alt="${item.name}" width="50" style="border-radius: 5px; display: block;">` : ''}
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
                    <span>${t.goods}:</span> <span>${order.totalPrice} Kc</span>
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
    
    return htmlContent;
};

export const processCustomerEmail = async (to, order, type, settings, customStatus) => {
    if (!transporter) await initEmail();
    if (!transporter) { console.error("No transporter"); return; }

    const lang = order.language || 'cs';
    const t = TRANSLATIONS[lang] || TRANSLATIONS.cs;
    const st = STATUS_TRANSLATIONS[lang] || STATUS_TRANSLATIONS.cs;

    let subject = '';
    let message = '';
    let attachments = [];

    if (type === 'created') {
        subject = t.created_subject;
        const pdfBuffer = await generateInvoicePdf(order, 'proforma', settings);
        attachments.push({ filename: `objednavka_${order.id}.pdf`, content: pdfBuffer });
    } else if (type === 'updated') {
        subject = t.updated_subject;
        message = 'Vaše objednávka byla upravena.';
    } else if (type === 'status') {
        subject = t.status_update_subject;
        message = `${t.status_prefix} ${st[customStatus] || customStatus}`;
        
        // Attach final invoice if status is delivered
        if (customStatus === 'delivered') {
            const pdfBuffer = await generateInvoicePdf(order, 'final', settings);
            attachments.push({ filename: `faktura_${order.id}.pdf`, content: pdfBuffer });
        }
    }

    const html = generateOrderHtml(order, subject, message, lang, settings);

    // --- LOGGING ---
    if (settings?.server?.consoleLogging) {
        console.log(`\n📨 EMAIL LOG [Customer] ------------------------------------------------`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Context: Order #${order.id}, Status: ${customStatus || type}`);
        console.log(`--- RAW HTML START ---`);
        console.log(html);
        console.log(`--- RAW HTML END ---`);
        console.log(`----------------------------------------------------------------------\n`);
    }

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'info@4gracie.cz',
        to,
        subject,
        html,
        attachments,
        encoding: 'base64'
    });
};

export const processOperatorEmail = async (to, order, type, settings) => {
    if (!transporter) await initEmail();
    if (!transporter) return;

    const html = generateOrderHtml(order, 'Nová objednávka (Admin)', 'Přišla nová objednávka.', 'cs', settings);
    
    // --- LOGGING ---
    if (settings?.server?.consoleLogging) {
        console.log(`\n📨 EMAIL LOG [Operator] ------------------------------------------------`);
        console.log(`To: ${to}`);
        console.log(`Subject: Nová objednávka #${order.id}`);
        console.log(`--- RAW HTML START ---`);
        console.log(html);
        console.log(`--- RAW HTML END ---`);
        console.log(`----------------------------------------------------------------------\n`);
    }

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'info@4gracie.cz',
        to,
        subject: `Nová objednávka #${order.id}`,
        html,
        encoding: 'base64'
    });
};

export const queueOrderEmail = async (order, type, settings, customStatus) => {
    const db = await getDb();
    if (!db) return;

    // 1. Customer Email
    if (order.userId) {
        const [u] = await db.query('SELECT email FROM users WHERE id = ?', [order.userId]);
        if (u.length > 0 && u[0].email) {
            const payload = JSON.stringify({ order, settings, customStatus });
            await db.query(
                "INSERT INTO email_queue (type, recipient_email, subject, payload) VALUES (?, ?, ?, ?)",
                ['customer_' + type, u[0].email, `Objednávka ${order.id}`, payload]
            );
        }
    }

    // 2. Operator Email (Only on create)
    if (type === 'created' && settings.companyDetails?.email) {
        const payload = JSON.stringify({ order, settings });
        await db.query(
            "INSERT INTO email_queue (type, recipient_email, subject, payload) VALUES (?, ?, ?, ?)",
            ['operator_created', settings.companyDetails.email, `Nová objednávka ${order.id}`, payload]
        );
    }
};

export const startEmailWorker = () => {
    setInterval(async () => {
        const db = await getDb();
        if (!db) return;

        const [rows] = await db.query("SELECT * FROM email_queue WHERE status = 'pending' LIMIT 5");
        
        for (const row of rows) {
            await db.query("UPDATE email_queue SET status = 'processing' WHERE id = ?", [row.id]);
            
            try {
                const payload = JSON.parse(row.payload);
                
                if (row.type.startsWith('customer_')) {
                    const subType = row.type.replace('customer_', '');
                    await processCustomerEmail(row.recipient_email, payload.order, subType, payload.settings, payload.customStatus);
                } else if (row.type === 'operator_created') {
                    await processOperatorEmail(row.recipient_email, payload.order, 'created', payload.settings);
                } else if (row.type === 'event_notify') {
                    // Specific handler for event notification
                    if (!transporter) await initEmail();
                    
                    // Optional logging for bulk emails if needed, usually omitted to save log space
                    // if (payload.settings?.server?.consoleLogging) console.log(`📨 Event Email to ${row.recipient_email}`);

                    await transporter.sendMail({
                        from: process.env.EMAIL_FROM,
                        to: row.recipient_email,
                        subject: row.subject,
                        html: payload.html,
                        encoding: 'base64'
                    });
                }

                await db.query("UPDATE email_queue SET status = 'sent', processed_at = NOW() WHERE id = ?", [row.id]);
            } catch (e) {
                console.error(`Failed to process email ${row.id}:`, e);
                await db.query("UPDATE email_queue SET status = 'error', error_message = ? WHERE id = ?", [e.message, row.id]);
            }
        }
    }, 10000); // Check every 10 seconds
};

export const sendEventNotification = async (date, products, recipients) => {
    const db = await getDb();
    if (!db) return;

    const subject = `Speciální akce na den ${formatDate(date)}`;
    const productList = products.map(p => `<li><strong>${p.name}</strong> - ${p.price} Kč</li>`).join('');
    
    const html = `
        <h2>Speciální akce!</h2>
        <p>Na den <strong>${formatDate(date)}</strong> jsme pro vás připravili speciální nabídku:</p>
        <ul>${productList}</ul>
        <p>Objednávejte na našem webu.</p>
    `;

    // Bulk insert into queue
    for (const email of recipients) {
        await db.query(
            "INSERT INTO email_queue (type, recipient_email, subject, payload) VALUES (?, ?, ?, ?)",
            ['event_notify', email, subject, JSON.stringify({ html })]
        );
    }
};
