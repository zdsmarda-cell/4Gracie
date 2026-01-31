
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
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
    // LOGO FIX: Logo is stored in web root, not API port. 
    // Strip the port (e.g. :3000) from the base URL for the logo reference.
    const webUrl = baseUrl.replace(/:\d+$/, ''); 
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
                <img src="${webUrl}/logo.png" alt="4Gracie Catering" width="120" style="display: block; margin: 0 auto;">
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
                    <a href="${webUrl}" style="background-color: #9333ea; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(147, 51, 234, 0.25);">
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
        subject_update: 'Aktualizace stavu objednávky #{id} - {status}',
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
        pickup_place: 'Místo odběru:',
        footer: 'Děkujeme, že jste si vybrali naše služby.'
    },
    en: {
        subject_create: 'Order Confirmation #{id}',
        subject_update: 'Order Status Update #{id} - {status}',
        title_create: 'Order Confirmation',
        title_update: 'Order Status: {status}',
        intro_create: 'Hello,<br>thank you for your order. Please find the summary below.',
        intro_update: 'Hello,<br>the status of your order <strong>#{id}</strong> has been updated.',
        total: 'Total:',
        delivery: 'Delivery Method:',
        pickup: 'Pickup',
        courier: 'Delivery',
        date: 'Date:',
        address: 'Delivery Address:',
        pickup_place: 'Pickup Point:',
        footer: 'Thank you for choosing our services.'
    },
    de: {
        subject_create: 'Bestellbestätigung #{id}',
        subject_update: 'Bestellstatus-Update #{id} - {status}',
        title_create: 'Bestellbestätigung',
        title_update: 'Bestellstatus: {status}',
        intro_create: 'Guten Tag,<br>vielen Dank für Ihre Bestellung. Unten finden Sie die Zusammenfassung.',
        intro_update: 'Guten Tag,<br>der Status Ihrer Bestellung <strong>#{id}</strong> wurde aktualisiert.',
        total: 'Gesamt:',
        delivery: 'Liefermethode:',
        pickup: 'Abholung',
        courier: 'Lieferung',
        date: 'Datum:',
        address: 'Lieferadresse:',
        pickup_place: 'Abholort:',
        footer: 'Danke, dass Sie unsere Dienste gewählt haben.'
    }
};

const generateEmailHtml = (order, type, settings, status) => {
    const lang = order.language || 'cs';
    const T = TEXTS[lang] || TEXTS.cs;
    const S = STATUS_TRANSLATIONS[lang] || STATUS_TRANSLATIONS.cs;
    
    const baseUrl = getBaseUrl();
    const logoUrl = getImgUrl('logo.png'); // Still keep original here as standard templates use baseUrl
    const translatedStatus = S[status || order.status] || status;

    const title = type === 'created' ? T.title_create : T.title_update.replace('{status}', translatedStatus);
    const intro = type === 'created' ? T.intro_create : T.intro_update.replace('{id}', order.id);
    
    // Address Logic
    let addressHtml = '';
    if (order.deliveryType === 'pickup') {
        const pickupName = order.deliveryName || 'Prodejna 4Gracie'; // Fallback if old data
        const pickupAddress = order.deliveryAddress?.replace('Osobní odběr: ', '') || '';
        addressHtml = `
            <div style="margin-top: 15px; padding: 10px; background-color: #f9fafb; border-radius: 6px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 4px;">${T.pickup_place}</div>
                <div style="font-weight: bold; color: #1f2937;">${pickupName}</div>
                <div style="color: #4b5563; font-size: 14px;">${pickupAddress}</div>
            </div>
        `;
    } else {
        const delName = order.deliveryName || order.userName;
        const delStreet = order.deliveryStreet || '';
        const delCity = order.deliveryCity || '';
        const delZip = order.deliveryZip || '';
        const delPhone = order.deliveryPhone || '';
        
        // Legacy fallback
        const legacyAddr = order.deliveryAddress ? order.deliveryAddress.replace(/\n/g, '<br>') : '';

        addressHtml = `
            <div style="margin-top: 15px; padding: 10px; background-color: #f9fafb; border-radius: 6px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 4px;">${T.address}</div>
                ${delStreet ? `
                    <div style="font-weight: bold; color: #1f2937;">${delName}</div>
                    <div style="color: #4b5563; font-size: 14px;">${delStreet}<br>${delZip} ${delCity}</div>
                    ${delPhone ? `<div style="margin-top: 4px; color: #6b7280; font-size: 12px;">Tel: ${delPhone}</div>` : ''}
                ` : `<div style="color: #4b5563; font-size: 14px;">${legacyAddr}</div>`}
            </div>
        `;
    }

    const itemsHtml = order.items.map(item => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f3f4f6; padding: 8px 0;">
            <div>
                <span style="font-weight: bold; color: #374151;">${item.quantity}x</span> ${item.name}
            </div>
            <div style="font-weight: bold; color: #1f2937;">${item.price * item.quantity} Kč</div>
        </div>
    `).join('');

    // Summary Fees
    let feesHtml = '';
    if (order.packagingFee > 0) feesHtml += `<div style="display: flex; justify-content: space-between; padding: 4px 0; color: #6b7280; font-size: 14px;"><span>Balné</span><span>${order.packagingFee} Kč</span></div>`;
    if (order.deliveryFee > 0) feesHtml += `<div style="display: flex; justify-content: space-between; padding: 4px 0; color: #6b7280; font-size: 14px;"><span>Doprava</span><span>${order.deliveryFee} Kč</span></div>`;
    
    // Discounts
    let discountHtml = '';
    if (order.appliedDiscounts && order.appliedDiscounts.length > 0) {
        order.appliedDiscounts.forEach(d => {
            discountHtml += `<div style="display: flex; justify-content: space-between; padding: 4px 0; color: #16a34a; font-size: 14px;"><span>Sleva ${d.code}</span><span>-${d.amount} Kč</span></div>`;
        });
    }

    // Final Total Calculation (Ensure logic matches Order Logic)
    const discountTotal = order.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
    const finalTotal = Math.max(0, order.totalPrice - discountTotal) + order.packagingFee + (order.deliveryFee || 0);

    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 30px;">
            ${logoUrl ? `<img src="${logoUrl}" alt="4Gracie" width="100" style="margin-bottom: 20px;">` : ''}
            <h1 style="color: #9333ea; margin: 0;">${title}</h1>
            <p style="color: #6b7280; margin-top: 5px;">#${order.id}</p>
        </div>
        
        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="margin-top: 0;">${intro}</p>
            
            <div style="margin: 20px 0;">
                <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #f3f4f6; padding-bottom: 5px;">Položky</div>
                ${itemsHtml}
            </div>

            <div style="border-top: 2px solid #f3f4f6; padding-top: 10px;">
                ${feesHtml}
                ${discountHtml}
                <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 18px; font-weight: bold;">
                    <span>${T.total}</span>
                    <span style="color: #9333ea;">${finalTotal} Kč</span>
                </div>
            </div>

            ${addressHtml}

            <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 14px;">
                <div>
                    <span style="color: #6b7280;">${T.delivery}</span> 
                    <strong>${order.deliveryType === 'pickup' ? T.pickup : T.courier}</strong>
                </div>
                <div>
                    <span style="color: #6b7280;">${T.date}</span> 
                    <strong>${formatDate(order.deliveryDate)}</strong>
                </div>
            </div>
        </div>

        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
            <p>${T.footer}</p>
            <p>${settings.companyDetails?.name || '4Gracie s.r.o.'}</p>
        </div>
    </div>
    `;
};

// --- EMAIL PROCESSORS ---

export const processCustomerEmail = async (recipient, order, type, settings, customStatus = null) => {
    const lang = order.language || 'cs';
    const T = TEXTS[lang] || TEXTS.cs;
    const S = STATUS_TRANSLATIONS[lang] || STATUS_TRANSLATIONS.cs;
    
    let subject = type === 'created' 
        ? T.subject_create.replace('{id}', order.id)
        : T.subject_update.replace('{id}', order.id).replace('{status}', S[customStatus || order.status] || (customStatus || order.status));

    const html = generateEmailHtml(order, type, settings, customStatus);
    const attachments = [];

    // Attach Invoice for Created or Delivered
    if (type === 'created' || (type === 'status' && customStatus === 'delivered')) {
        try {
            const invoiceType = (type === 'status' && customStatus === 'delivered') ? 'final' : 'proforma';
            const pdfBuffer = await generateInvoicePdf(order, invoiceType, settings);
            attachments.push({
                filename: `faktura_${order.id}.pdf`,
                content: pdfBuffer
            });
        } catch (e) {
            console.error("PDF generation for email failed:", e);
        }
    }

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipient,
        subject: subject,
        html: html,
        attachments
    });
};

export const processOperatorEmail = async (recipient, order, type, settings) => {
    // Simplified notification for operator
    if (type !== 'created') return; // Only notify operator on new orders

    const subject = `Nová objednávka #${order.id} (${order.totalPrice} Kč)`;
    const html = generateEmailHtml(order, 'created', settings); // Reuse same html for simplicity or simplify further

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipient,
        subject: subject,
        html: html
    });
};

// QUEUE SYSTEM
export const queueOrderEmail = async (order, type, settings, customStatus = null) => {
    const db = await getDb();
    if (!db) return;

    // 1. Customer Email
    // Fetch fresh user email if possible, or use from order
    let userEmail = '';
    if (order.userId) {
        const [uRows] = await db.query('SELECT email FROM users WHERE id = ?', [order.userId]);
        if (uRows.length > 0) userEmail = uRows[0].email;
    }
    // Fallback to billing email in order? We don't store billing email in order JSON usually, relying on User ID.
    // If guest checkout existed, we'd check order.email.
    
    if (userEmail && userEmail.includes('@')) {
        await db.query(
            'INSERT INTO email_queue (type, recipient_email, subject, payload, status) VALUES (?, ?, ?, ?, ?)',
            ['customer_notify', userEmail, `Order ${order.id}`, JSON.stringify({ order, type, settings, customStatus }), 'pending']
        );
    }

    // 2. Operator Email (Only for Created)
    if (type === 'created' && settings.companyDetails?.email) {
        await db.query(
            'INSERT INTO email_queue (type, recipient_email, subject, payload, status) VALUES (?, ?, ?, ?, ?)',
            ['operator_notify', settings.companyDetails.email, `New Order ${order.id}`, JSON.stringify({ order, type, settings }), 'pending']
        );
    }
};

export const sendEventNotification = async (date, products, recipients) => {
    const db = await getDb();
    if (!db) return;

    // Bulk insert into queue? Or single task processed by worker?
    // Let's create one task per recipient to track status individually (safer)
    // OR create one task 'event_notify' with list of recipients (faster insert).
    
    // Better: 1 task type 'event_notify' with BATCH processing in worker.
    // But 'email_queue' expects recipient_email column.
    // Let's use Bcc approach or individual tasks.
    // Given the constraints, let's just loop insert for now.
    
    for (const email of recipients) {
        await db.query(
            'INSERT INTO email_queue (type, recipient_email, subject, payload, status) VALUES (?, ?, ?, ?, ?)',
            ['event_notify', email, `Speciální Akce - ${formatDate(date)}`, JSON.stringify({ date, products }), 'pending']
        );
    }
};

// WORKER
export const startEmailWorker = () => {
    if (!process.env.SMTP_HOST) {
        console.warn("⚠️ SMTP not configured. Email worker disabled.");
        return;
    }

    console.log("📨 Email Worker started...");
    
    const runWorker = async () => {
        const db = await getDb();
        if (!db || !transporter) return;

        // Fetch pending (limit 5 to avoid congestion)
        const [rows] = await db.query("SELECT * FROM email_queue WHERE status = 'pending' LIMIT 5");
        
        for (const task of rows) {
            try {
                await db.query("UPDATE email_queue SET status = 'processing' WHERE id = ?", [task.id]);
                const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;

                if (task.type === 'customer_notify') {
                    await processCustomerEmail(task.recipient_email, payload.order, payload.type, payload.settings, payload.customStatus);
                } else if (task.type === 'operator_notify') {
                    await processOperatorEmail(task.recipient_email, payload.order, payload.type, payload.settings);
                } else if (task.type === 'event_notify') {
                    const { date, products } = payload;
                    const html = generateEventEmailHtml(date, products);
                    await transporter.sendMail({
                        from: process.env.EMAIL_FROM,
                        bcc: task.recipient_email, // Send individually via loop above actually sets recipient in 'to' usually, but safe to use Bcc if singular
                        subject: `Speciální Akce - ${formatDate(date)}`,
                        html: html,
                        encoding: 'base64' // Force Base64 encoding to prevent line breaks in images
                    });
                }

                await db.query("UPDATE email_queue SET status = 'sent', processed_at = NOW() WHERE id = ?", [task.id]);
            } catch (err) {
                console.error(`❌ Email Task ${task.id} failed:`, err);
                await db.query("UPDATE email_queue SET status = 'error', error_message = ? WHERE id = ?", [err.message, task.id]);
            }
        }
    };

    setInterval(runWorker, 10000); // Check every 10s
};
