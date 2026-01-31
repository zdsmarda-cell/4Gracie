
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';
import { generateInvoicePdf } from './pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

let transporter = null;

export const initEmail = async () => {
    if (transporter) {
        return true;
    }

    if (!process.env.SMTP_HOST) {
        console.warn("⚠️ SMTP_HOST not defined, email service disabled.");
        return false;
    }

    try {
        const t = nodemailer.createTransport({
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
        
        await t.verify();
        transporter = t; 
        console.log("📧 Email service initialized");
        return true;
    } catch (err) {
        console.error("❌ Email init failed:", err.message);
        transporter = null;
        return false;
    }
};

// API URL for images served from backend
// Force HTTPS and combine APP_URL + PORT as requested
const getApiUrl = () => {
    // 1. Get Domain from APP_URL (remove protocol if present)
    let domain = process.env.APP_URL || 'localhost';
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // 2. Get Port
    const port = process.env.PORT || 3000;
    
    // 3. Construct URL: https://eshop.4gracie.cz:3000
    return `https://${domain}:${port}`;
};

// Web URL for links and frontend assets (logo)
const getWebUrl = () => {
    let url = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
    url = url.replace(/\/$/, '');
    // Ensure protocol is present if missing
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }
    return url;
};

const getImgUrl = (imagePath) => {
    if (!imagePath) return '';
    // If it's already an absolute URL (e.g. data:image or external http), return as is
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) return imagePath;
    
    const baseUrl = getApiUrl();
    
    // Check if path already contains '/api/uploads'
    if (imagePath.includes('/api/uploads')) {
         return `${baseUrl}/${imagePath.replace(/^\//, '')}`;
    }
    
    // Default assumption: imagePath is relative to uploads root, e.g. "images/pic.webp"
    return `${baseUrl}/api/uploads/${imagePath.replace(/^\//, '')}`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('cs-CZ');
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
        delivery_address: 'Doručovací adresa:',
        pickup_place: 'Místo odběru:',
        billing_address: 'Fakturační adresa:',
        note: 'Poznámka:',
        go_to_eshop: 'Přejít na e-shop',
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
        delivery_address: 'Delivery Address:',
        pickup_place: 'Pickup Point:',
        billing_address: 'Billing Address:',
        note: 'Note:',
        go_to_eshop: 'Go to E-shop',
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
        delivery_address: 'Lieferadresse:',
        pickup_place: 'Abholort:',
        billing_address: 'Rechnungsadresse:',
        note: 'Anmerkung:',
        go_to_eshop: 'Zum E-Shop',
        footer: 'Danke, dass Sie unsere Dienste gewählt haben.'
    }
};

const generateEmailHtml = (order, type, settings, status) => {
    const lang = order.language || 'cs';
    const T = TEXTS[lang] || TEXTS.cs;
    const S = STATUS_TRANSLATIONS[lang] || STATUS_TRANSLATIONS.cs;
    
    const webUrl = getWebUrl();
    const logoUrl = `${webUrl}/logo.png`; 
    const translatedStatus = S[status || order.status] || status;

    const title = type === 'created' ? T.title_create : T.title_update.replace('{status}', translatedStatus);
    const intro = type === 'created' ? T.intro_create : T.intro_update.replace('{id}', order.id);
    
    // --- Address Logic (Split into Delivery & Billing columns) ---
    
    let deliveryContentHtml = '';
    let deliveryTitle = T.delivery_address;

    if (order.deliveryType === 'pickup') {
        deliveryTitle = T.pickup_place;
        const pickupName = order.deliveryName || 'Prodejna 4Gracie'; 
        const pickupAddress = order.deliveryAddress?.replace('Osobní odběr: ', '') || '';
        deliveryContentHtml = `
            <div style="font-weight: bold; color: #1f2937;">${pickupName}</div>
            <div style="color: #4b5563; font-size: 14px;">${pickupAddress}</div>
        `;
    } else {
        const delName = order.deliveryName || order.userName;
        const delStreet = order.deliveryStreet || '';
        const delCity = order.deliveryCity || '';
        const delZip = order.deliveryZip || '';
        const delPhone = order.deliveryPhone || '';
        
        // Fallback for legacy data without structured fields
        if (!delStreet && order.deliveryAddress) {
             deliveryContentHtml = `<div style="color: #4b5563; font-size: 14px;">${order.deliveryAddress.replace(/\n/g, '<br>')}</div>`;
        } else {
             deliveryContentHtml = `
                <div style="font-weight: bold; color: #1f2937;">${delName}</div>
                <div style="color: #4b5563; font-size: 14px;">${delStreet}<br>${delZip} ${delCity}</div>
                ${delPhone ? `<div style="margin-top: 4px; color: #6b7280; font-size: 12px;">Tel: ${delPhone}</div>` : ''}
            `;
        }
    }

    const billingContentHtml = `
        <div style="font-weight: bold; color: #1f2937;">${order.billingName || order.userName}</div>
        <div style="color: #4b5563; font-size: 14px;">${order.billingStreet || ''}<br>${order.billingZip || ''} ${order.billingCity || ''}</div>
        ${order.billingIc ? `<div style="margin-top: 4px; color: #6b7280; font-size: 12px;">IČ: ${order.billingIc}</div>` : ''}
        ${order.billingDic ? `<div style="color: #6b7280; font-size: 12px;">DIČ: ${order.billingDic}</div>` : ''}
    `;

    // Address Table Wrapper
    const addressTableHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px; background-color: #f9fafb; border-radius: 6px;">
            <tr>
                <td width="50%" valign="top" style="padding: 10px; border-right: 1px solid #e5e7eb;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 4px;">${deliveryTitle}</div>
                    ${deliveryContentHtml}
                </td>
                <td width="50%" valign="top" style="padding: 10px;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 4px;">${T.billing_address}</div>
                    ${billingContentHtml}
                </td>
            </tr>
        </table>
    `;

    // --- Note Block ---
    let noteHtml = '';
    if (order.note) {
         noteHtml = `
            <div style="margin-top: 15px; padding: 10px; background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #c2410c; font-weight: bold; margin-bottom: 4px;">${T.note}</div>
                <div style="color: #431407; font-size: 14px;">${order.note.replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }

    // --- Items Logic ---
    const itemsHtml = order.items.map(item => {
        // Product image from API
        const imgUrl = (item.images && item.images.length > 0) ? getImgUrl(item.images[0]) : '';
        
        return `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f3f4f6; padding: 8px 0; align-items: center;">
            <div style="display: flex; align-items: center;">
                ${imgUrl ? `<img src="${imgUrl}" alt="${item.name}" width="40" height="40" style="object-fit: cover; border-radius: 4px; margin-right: 10px;">` : ''}
                <div>
                    <span style="font-weight: bold; color: #374151;">${item.quantity}x</span> ${item.name}
                </div>
            </div>
            <div style="font-weight: bold; color: #1f2937;">${item.price * item.quantity} Kč</div>
        </div>
        `;
    }).join('');

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

    const discountTotal = order.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
    const finalTotal = Math.max(0, order.totalPrice - discountTotal) + order.packagingFee + (order.deliveryFee || 0);

    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="${logoUrl}" alt="4Gracie" width="100" style="margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
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

            ${addressTableHtml}
            ${noteHtml}
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="${webUrl}" style="background-color: #9333ea; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                    ${T.go_to_eshop}
                </a>
            </div>

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

// Special Template for Events
const generateEventEmailHtml = (date, products) => {
    const webUrl = getWebUrl();
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
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} 4 grácie</p>
                <p style="margin: 5px 0 0 0;">Toto je automaticky generovaná zpráva.</p>
            </div>
        </div>
    `;
};

// --- EMAIL PROCESSORS ---

export const processCustomerEmail = async (recipient, order, type, settings, customStatus = null) => {
    // Try to re-init if transporter is missing
    if (!transporter) {
        const success = await initEmail();
        if (!success) return false;
    }

    const lang = order.language || 'cs';
    const T = TEXTS[lang] || TEXTS.cs;
    const S = STATUS_TRANSLATIONS[lang] || STATUS_TRANSLATIONS.cs;
    
    let subject;
    if (type === 'created') {
        subject = T.subject_create.replace('{id}', order.id);
    } else {
        const statusText = S[customStatus || order.status] || (customStatus || order.status);
        subject = T.subject_update.replace('{id}', order.id).replace('{status}', statusText);
        if (lang === 'en' && !subject.includes('Order Status Update')) {
            subject = `Order Status Update #${order.id} - ${statusText}`;
        }
    }

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

    // Attach VOP (Terms) for New Orders
    if (type === 'created') {
        // Logic to determine path: VOP_PATH env var OR default 'vop.pdf'
        let vopPath = null;
        if (process.env.VOP_PATH) {
             vopPath = process.env.VOP_PATH;
        } else {
             vopPath = path.join(UPLOAD_ROOT, 'vop.pdf');
        }

        if (fs.existsSync(vopPath)) {
            attachments.push({
                filename: 'VOP.pdf',
                path: vopPath
            });
        } else {
             // Try fallback to Uppercase just in case of FS discrepancy
             const vopPathUpper = path.join(UPLOAD_ROOT, 'VOP.pdf');
             if (fs.existsSync(vopPathUpper)) {
                 attachments.push({ filename: 'VOP.pdf', path: vopPathUpper });
             }
        }
    }

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipient,
        subject: subject,
        html: html,
        encoding: 'base64',
        attachments
    });
    
    return true;
};

export const processOperatorEmail = async (recipient, order, type, settings) => {
    if (type !== 'created') return true; 

    // Try to re-init if transporter is missing
    if (!transporter) {
        const success = await initEmail();
        if (!success) return false;
    }

    const subject = `Nová objednávka #${order.id} (${order.totalPrice} Kč)`;
    const html = generateEmailHtml(order, 'created', settings);

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipient,
        subject: subject,
        html: html,
        encoding: 'base64'
    });
    return true;
};

export const queueOrderEmail = async (order, type, settings, customStatus = null) => {
    const db = await getDb();
    if (!db) return;

    let userEmail = '';
    if (order.userId) {
        const [uRows] = await db.query('SELECT email FROM users WHERE id = ?', [order.userId]);
        if (uRows.length > 0) userEmail = uRows[0].email;
    }
    
    if (userEmail && userEmail.includes('@')) {
        await db.query(
            'INSERT INTO email_queue (type, recipient_email, subject, payload, status) VALUES (?, ?, ?, ?, ?)',
            ['customer_notify', userEmail, `Order ${order.id}`, JSON.stringify({ order, type, settings, customStatus }), 'pending']
        );
    }

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
    
    for (const email of recipients) {
        await db.query(
            'INSERT INTO email_queue (type, recipient_email, subject, payload, status) VALUES (?, ?, ?, ?, ?)',
            ['event_notify', email, `Speciální Akce - ${formatDate(date)}`, JSON.stringify({ date, products }), 'pending']
        );
    }
};

// WORKER
export const startEmailWorker = () => {
    console.log("📨 Email Worker started...");
    
    const runWorker = async () => {
        const db = await getDb();
        if (!db) return;

        // CRITICAL: Ensure transporter is ready before processing jobs
        if (!transporter) {
            const connected = await initEmail();
            if (!connected) {
                // Skip processing if still can't connect, will try again next cycle
                return;
            }
        }

        const [rows] = await db.query("SELECT * FROM email_queue WHERE status = 'pending' LIMIT 5");
        
        for (const task of rows) {
            try {
                await db.query("UPDATE email_queue SET status = 'processing' WHERE id = ?", [task.id]);
                const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                let success = false;

                if (task.type === 'customer_notify') {
                    success = await processCustomerEmail(task.recipient_email, payload.order, payload.type, payload.settings, payload.customStatus);
                } else if (task.type === 'operator_notify') {
                    success = await processOperatorEmail(task.recipient_email, payload.order, payload.type, payload.settings);
                } else if (task.type === 'event_notify') {
                    const { date, products } = payload;
                    const html = generateEventEmailHtml(date, products);
                    await transporter.sendMail({
                        from: process.env.EMAIL_FROM,
                        bcc: task.recipient_email, 
                        subject: `Speciální Akce - ${formatDate(date)}`,
                        html: html,
                        encoding: 'base64'
                    });
                    success = true;
                }

                if (success) {
                    await db.query("UPDATE email_queue SET status = 'sent', processed_at = NOW() WHERE id = ?", [task.id]);
                } else {
                     await db.query("UPDATE email_queue SET status = 'error', error_message = ? WHERE id = ?", ["Transporter send failed or not ready", task.id]);
                }
            } catch (err) {
                console.error(`❌ Email Task ${task.id} failed:`, err);
                await db.query("UPDATE email_queue SET status = 'error', error_message = ? WHERE id = ?", [err.message, task.id]);
            }
        }
    };

    setInterval(runWorker, 10000); 
};
