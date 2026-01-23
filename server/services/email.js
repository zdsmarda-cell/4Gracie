
import nodemailer from 'nodemailer';
import { getDb } from '../db.js';
import { generateInvoicePdf } from './pdf.js';

let transporter = null;

export const initEmail = async () => {
    if (transporter) return;
    if (!process.env.SMTP_HOST) return;

    try {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        await transporter.verify();
        console.log("📧 Email service initialized");
    } catch (err) {
        console.error("❌ Email init failed:", err);
    }
};

const getBaseUrl = () => {
    let url = process.env.APP_URL || process.env.VITE_API_URL || 'http://localhost';
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    
    // Add port if defined in .env and not already present in URL
    if (process.env.PORT && !url.includes(`:${process.env.PORT}`)) {
        url = `${url}:${process.env.PORT}`;
    }
    return url;
};

const getImgUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = getBaseUrl();
    return `${baseUrl}/${path.replace(/^\//, '')}`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('cs-CZ');
};

// Helper to generate Event HTML (moved from sendEventNotification)
const generateEventEmailHtml = (date, products) => {
    const baseUrl = getBaseUrl();
    const formattedDate = formatDate(date);
    
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

    return `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="text-align: center; padding: 30px 0; background-color: #1f2937; border-bottom: 4px solid #9333ea;">
                <img src="${baseUrl}/logo.png" alt="4Gracie Catering" width="120" style="display: block; margin: 0 auto;">
                <h1 style="color: #ffffff; margin: 20px 0 0 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Speciální Akce</h1>
            </div>
            <div style="padding: 30px 20px;">
                <p style="font-size: 16px; color: #374151; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                    Dobrý den,<br><br>
                    Na den <strong style="color: #9333ea;">${formattedDate}</strong> jsme pro vás připravili tuto speciální nabídku. <br>
                    Neváhejte a objednejte si včas, kapacity jsou omezené!
                </p>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="text-align: center; margin-top: 40px;">
                    <a href="${baseUrl}" style="background-color: #9333ea; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(147, 51, 234, 0.25);">
                        Objednat nyní na e-shopu
                    </a>
                </div>
            </div>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} 4Gracie Catering</p>
                <p style="margin: 5px 0 0 0;">Toto je automaticky generovaná zpráva.</p>
            </div>
        </div>
    `;
};

const STATUS_TRANSLATIONS = {
    cs: {
        'created': 'Zadaná',
        'confirmed': 'Potvrzená',
        'preparing': 'Připravuje se',
        'ready': 'Připravena',
        'on_way': 'Na cestě',
        'delivered': 'Doručena',
        'not_picked_up': 'Nedoručena/Nevyzvednuta',
        'cancelled': 'Stornována'
    },
    en: {
        'created': 'Created',
        'confirmed': 'Confirmed',
        'preparing': 'Preparing',
        'ready': 'Ready',
        'on_way': 'On the way',
        'delivered': 'Delivered',
        'not_picked_up': 'Not picked up',
        'cancelled': 'Cancelled'
    },
    de: {
        'created': 'Erstellt',
        'confirmed': 'Bestätigt',
        'preparing': 'In Vorbereitung',
        'ready': 'Bereit',
        'on_way': 'Unterwegs',
        'delivered': 'Geliefert',
        'not_picked_up': 'Nicht abgeholt',
        'cancelled': 'Storniert'
    }
};

const TEXTS = {
    cs: {
        subject_create: 'Potvrzení objednávky #{id}',
        subject_update: 'Objednávka #{id} - {status}',
        title_create: 'Potvrzení objednávky',
        title_update: 'Stav objednávky: {status}',
        intro_create: 'Dobrý den,<br>děkujeme za Vaši objednávku. Níže naleznete její shrnutí.',
        intro_update: 'Dobrý den,<br>stav Vaší objednávky <strong>#{id}</strong> byl změněn.',
        total: 'Celkem:',
        delivery: 'Způsob dopravy:',
        pickup: 'Osobní odběr',
        courier: 'Rozvoz',
        date: 'Datum:',
        address: 'Doručovací adresa:',
        billing_address: 'Fakturační adresa:',
        eshop_link: 'Přejít do e-shopu'
    },
    en: {
        subject_create: 'Order Confirmation #{id}',
        subject_update: 'Order Status Update #{id} - {status}',
        title_create: 'Order Confirmation',
        title_update: 'Order Status: {status}',
        intro_create: 'Hello,<br>thank you for your order. Below is the summary.',
        intro_update: 'Hello,<br>status of your order <strong>#{id}</strong> has been updated.',
        total: 'Total:',
        delivery: 'Delivery Method:',
        pickup: 'Pickup',
        courier: 'Courier',
        date: 'Date:',
        address: 'Delivery Address:',
        billing_address: 'Billing Address:',
        eshop_link: 'Go to E-shop'
    },
    de: {
        subject_create: 'Bestellbestätigung #{id}',
        subject_update: 'Bestellstatus-Update #{id} - {status}',
        title_create: 'Bestellbestätigung',
        title_update: 'Bestellstatus: {status}',
        intro_create: 'Hallo,<br>vielen Dank für Ihre Bestellung. Zusammenfassung unten.',
        intro_update: 'Hallo,<br>der Status Ihrer Bestellung <strong>#{id}</strong> wurde aktualisiert.',
        total: 'Gesamt:',
        delivery: 'Liefermethode:',
        pickup: 'Abholung',
        courier: 'Lieferung',
        date: 'Datum:',
        address: 'Lieferadresse:',
        billing_address: 'Rechnungsadresse:',
        eshop_link: 'Zum E-Shop gehen'
    }
};

export const processCustomerEmail = async (email, order, type, settings, statusOverride) => {
    if (!transporter) await initEmail();
    if (!transporter) return false;

    const lang = order.language || 'cs';
    const t = TEXTS[lang] || TEXTS.cs;
    const statusDict = STATUS_TRANSLATIONS[lang] || STATUS_TRANSLATIONS.cs;

    const status = statusOverride || order.status;
    const statusText = statusDict[status] || status;
    
    let subject = t.subject_update.replace('{id}', order.id).replace('{status}', statusText);
    let title = t.title_update.replace('{status}', statusText);
    let intro = t.intro_update.replace('{id}', order.id);

    if (type === 'created') {
        subject = t.subject_create.replace('{id}', order.id);
        title = t.title_create;
        intro = t.intro_create;
    }

    // Generate Items HTML with Images
    const itemsHtml = order.items.map(i => {
        const imgUrl = (i.images && i.images.length > 0) ? getImgUrl(i.images[0]) : '';
        const imgTag = imgUrl ? `<img src="${imgUrl}" alt="${i.name}" width="50" height="50" style="border-radius: 4px; object-fit: cover; display: block;">` : '';
        return `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; width: 60px;">${imgTag}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.quantity}x</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${i.price} Kč</td>
        </tr>
    `;}).join('');

    // Prepare Addresses
    const deliveryAddrStr = order.deliveryAddress ? order.deliveryAddress.replace(/\n/g, '<br>') : [
        order.deliveryName,
        order.deliveryStreet,
        [order.deliveryZip, order.deliveryCity].filter(Boolean).join(' '),
        order.deliveryPhone
    ].filter(Boolean).join('<br>');

    const billingAddrStr = [
        order.billingName,
        order.billingStreet,
        [order.billingZip, order.billingCity].filter(Boolean).join(' '),
        order.billingIc ? `IČ: ${order.billingIc}` : null,
        order.billingDic ? `DIČ: ${order.billingDic}` : null
    ].filter(Boolean).join('<br>');

    const baseUrl = getBaseUrl();

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h1 style="color: #9333ea;">${title}</h1>
            <p>${intro}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th style="padding: 10px; width: 60px;"></th>
                        <th style="padding: 10px; text-align: left;">Ks</th>
                        <th style="padding: 10px; text-align: left;">Název</th>
                        <th style="padding: 10px; text-align: right;">Cena</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="padding: 10px; font-weight: bold; text-align: right;">${t.total}</td>
                        <td style="padding: 10px; font-weight: bold; text-align: right;">${order.totalPrice + order.packagingFee + (order.deliveryFee||0)} Kč</td>
                    </tr>
                </tfoot>
            </table>
            
            <div style="margin-top: 20px; font-size: 13px; color: #555; background-color: #f9f9f9; padding: 15px; border-radius: 8px;">
                <p style="margin: 0 0 10px 0;"><strong>${t.delivery}</strong> ${order.deliveryType === 'delivery' ? t.courier : t.pickup}</p>
                <p style="margin: 0 0 10px 0;"><strong>${t.date}</strong> ${formatDate(order.deliveryDate)}</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 10px;">
                            <strong>${t.address}</strong><br>
                            ${deliveryAddrStr}
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 10px; border-left: 1px solid #ddd;">
                            <strong>${t.billing_address}</strong><br>
                            ${billingAddrStr || '-'}
                        </td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <a href="${baseUrl}" style="display: inline-block; background-color: #9333ea; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                    ${t.eshop_link}
                </a>
            </div>
        </div>
    `;

    const mailOptions = {
        from: process.env.EMAIL_FROM, // Use EMAIL_FROM directly from .env without extra formatting
        to: email,
        subject: subject,
        html: html,
        attachments: []
    };

    if (type === 'created' || status === 'delivered') {
        try {
            const pdfType = status === 'delivered' ? 'final' : 'proforma';
            const buffer = await generateInvoicePdf(order, pdfType, settings);
            mailOptions.attachments.push({
                filename: `faktura_${order.id}.pdf`,
                content: buffer
            });
        } catch (e) {
            console.error("PDF attachment error:", e);
        }
    }

    await transporter.sendMail(mailOptions);
    return true;
};

export const processOperatorEmail = async (operatorEmail, order, type, settings) => {
    if (!transporter) await initEmail();
    if (!transporter) return false;
    
    const baseUrl = getBaseUrl();

    const html = `
        <div style="font-family: Arial, sans-serif;">
            <h2>Nová objednávka #${order.id}</h2>
            <p>Zákazník: ${order.userName} (${order.userId})</p>
            <p>Celkem: ${order.totalPrice} Kč</p>
            <p><a href="${baseUrl}/#/admin">Přejít do administrace</a></p>
        </div>
    `;

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: operatorEmail,
        subject: `Nová objednávka #${order.id}`,
        html: html
    });
    return true;
};

export const startEmailWorker = () => {
    const runWorker = async () => {
        const db = await getDb();
        if (!db) return;

        try {
            const [rows] = await db.query("SELECT * FROM email_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 5");
            
            for (const job of rows) {
                await db.query("UPDATE email_queue SET status = 'processing', processed_at = NOW() WHERE id = ?", [job.id]);
                
                try {
                    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
                    let success = false;

                    if (job.type === 'order_customer') {
                        success = await processCustomerEmail(job.recipient_email, payload.order, payload.type, payload.settings, payload.statusOverride);
                    } else if (job.type === 'order_operator') {
                        success = await processOperatorEmail(job.recipient_email, payload.order, payload.type, payload.settings);
                    } else if (job.type === 'event_notify') {
                        if (!transporter) await initEmail();
                        
                        // Handle both old format (HTML in payload) and new format (Data in payload)
                        let htmlContent = payload.html;
                        if (!htmlContent && payload.products && payload.date) {
                            htmlContent = generateEventEmailHtml(payload.date, payload.products);
                        }

                        if (transporter && htmlContent) {
                            await transporter.sendMail({
                                from: process.env.EMAIL_FROM,
                                to: job.recipient_email,
                                subject: job.subject,
                                html: htmlContent
                            });
                            success = true;
                        }
                    }

                    if (success) {
                        await db.query("UPDATE email_queue SET status = 'sent' WHERE id = ?", [job.id]);
                    } else {
                        await db.query("UPDATE email_queue SET status = 'error', error_message = 'Transporter not ready or send failed' WHERE id = ?", [job.id]);
                    }
                } catch (err) {
                    console.error(`Email Job ${job.id} failed:`, err);
                    await db.query("UPDATE email_queue SET status = 'error', error_message = ? WHERE id = ?", [err.message, job.id]);
                }
            }
        } catch (e) {
            console.error("Email Worker Error:", e);
        }
    };

    setInterval(runWorker, 10000); // 10s interval
};

export const queueOrderEmail = async (order, type, settings, statusOverride = null) => {
    const db = await getDb();
    if (!db) return;

    let userEmail = null;
    if (order.userId) {
        const [users] = await db.query('SELECT email FROM users WHERE id = ?', [order.userId]);
        if (users.length > 0) userEmail = users[0].email;
    }
    
    if (userEmail) {
        await db.query(
            "INSERT INTO email_queue (type, recipient_email, subject, payload) VALUES (?, ?, ?, ?)",
            ['order_customer', userEmail, `Objednávka #${order.id}`, JSON.stringify({ order, type, settings, statusOverride })]
        );
    }

    if (type === 'created' && settings.companyDetails?.email) {
        await db.query(
            "INSERT INTO email_queue (type, recipient_email, subject, payload) VALUES (?, ?, ?, ?)",
            ['order_operator', settings.companyDetails.email, `Nová objednávka #${order.id}`, JSON.stringify({ order, type, settings })]
        );
    }
};

export const sendEventNotification = async (date, products, recipients) => {
    const db = await getDb();
    if (!db) return;
    
    const formattedDate = formatDate(date);
    const subject = `Speciální akce na den ${formattedDate}`;

    // Store DATA ONLY in payload, not rendered HTML. 
    // The worker will generate HTML to allow Admin UI to show pure JSON data.
    const payloadData = {
        date: date,
        products: products
    };

    for (const email of recipients) {
        await db.query(
            "INSERT INTO email_queue (type, recipient_email, subject, payload) VALUES (?, ?, ?, ?)",
            ['event_notify', email, subject, JSON.stringify(payloadData)]
        );
    }
};
