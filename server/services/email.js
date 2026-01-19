
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
