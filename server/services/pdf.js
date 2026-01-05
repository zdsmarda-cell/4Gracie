
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fetch font buffer helper
const fetchFont = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load font: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

export const generateInvoicePdf = async (order, type = 'proforma', settings) => {
    const doc = new jsPDF();
    
    // --- 1. LOAD FONTS (Roboto for Diacritics) ---
    try {
        const regularBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
        const mediumBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf');
        
        doc.addFileToVFS("Roboto-Regular.ttf", regularBase64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        
        doc.addFileToVFS("Roboto-Medium.ttf", mediumBase64);
        doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
        
        doc.setFont("Roboto");
    } catch (e) {
        console.error("Font loading failed, falling back to default (diacritics may fail):", e);
    }

    // --- 2. PREPARE DATA ---
    // Use snapshot if available, otherwise current settings
    const comp = order.companyDetailsSnapshot || settings.companyDetails || {};
    // Logic: If DIC is present, supplier is VAT payer
    const isVatPayer = !!comp.dic && comp.dic.trim().length > 0;

    const headerTitle = type === 'proforma' 
        ? "ZÁLOHOVÝ DAŇOVÝ DOKLAD" 
        : (isVatPayer ? "FAKTURA - DAŇOVÝ DOKLAD" : "FAKTURA");
    
    const dateToUse = type === 'final' 
        ? (order.finalInvoiceDate || new Date().toISOString()) 
        : order.createdAt;

    const brandColor = [147, 51, 234]; // Purple #9333ea

    // --- 3. HEADER ---
    doc.setTextColor(...brandColor);
    doc.setFont("Roboto", "bold");
    doc.setFontSize(20);
    doc.text(headerTitle, 105, 20, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.text(`Číslo obj: ${order.id}`, 105, 28, { align: "center" });
    doc.text(`Datum vystavení: ${formatDate(dateToUse)}`, 105, 34, { align: "center" });
    
    if (isVatPayer && type === 'final') {
        doc.text(`Datum zdan. plnění: ${formatDate(dateToUse)}`, 105, 40, { align: "center" });
    }

    // --- 4. SUPPLIER / CUSTOMER ---
    doc.setFontSize(11);
    doc.setFont("Roboto", "bold");
    doc.text("DODAVATEL:", 14, 55);
    doc.text("ODBĚRATEL:", 110, 55);
    
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    
    // Supplier Info
    let yPos = 61;
    doc.text(comp.name || '', 14, yPos); yPos += 5;
    doc.text(comp.street || '', 14, yPos); yPos += 5;
    doc.text(`${comp.zip || ''} ${comp.city || ''}`, 14, yPos); yPos += 5;
    doc.text(`IČ: ${comp.ic || ''}`, 14, yPos); yPos += 5;
    if(comp.dic) doc.text(`DIČ: ${comp.dic}`, 14, yPos);

    // Customer Info
    yPos = 61;
    doc.text(order.billingName || order.userName || 'Zákazník', 110, yPos); yPos += 5;
    doc.text(order.billingStreet || '', 110, yPos); yPos += 5;
    doc.text(`${order.billingZip || ''} ${order.billingCity || ''}`, 110, yPos); yPos += 5;
    if (order.billingIc) { doc.text(`IČ: ${order.billingIc}`, 110, yPos); yPos += 5; }
    if (order.billingDic) { doc.text(`DIČ: ${order.billingDic}`, 110, yPos); yPos += 5; }

    // --- 5. CALCULATIONS ---
    
    // Find Max VAT Rate from products for Fees
    let maxVatRate = 0;
    order.items.forEach(item => {
        const rate = Number(item.vatRateTakeaway || 0); // Assuming takeaway rate for delivery
        if (rate > maxVatRate) maxVatRate = rate;
    });

    const feeVatRate = maxVatRate > 0 ? maxVatRate : 21; // Default to 21 if no products or 0 rates

    // Helper to calc bases
    const getBase = (priceWithVat, rate) => priceWithVat / (1 + rate / 100);
    const getVat = (priceWithVat, rate) => priceWithVat - getBase(priceWithVat, rate);

    const tableBody = [];
    
    // Summary Data Structure
    const taxSummary = {}; // rate -> { base, vat, total }

    const addToSummary = (rate, amountWithVat) => {
        if (!taxSummary[rate]) taxSummary[rate] = { base: 0, vat: 0, total: 0 };
        const base = getBase(amountWithVat, rate);
        const vat = getVat(amountWithVat, rate);
        taxSummary[rate].base += base;
        taxSummary[rate].vat += vat;
        taxSummary[rate].total += amountWithVat;
    };

    // Products
    order.items.forEach(item => {
        const lineTotal = item.price * item.quantity;
        const rate = Number(item.vatRateTakeaway || 0);
        
        if (isVatPayer) addToSummary(rate, lineTotal);

        const row = [
            item.name,
            item.quantity,
            isVatPayer ? getBase(item.price, rate).toFixed(2) : item.price.toFixed(2)
        ];

        if (isVatPayer) {
            row.push(`${rate}%`);
            row.push(getVat(lineTotal, rate).toFixed(2));
        }
        
        row.push(lineTotal.toFixed(2));
        tableBody.push(row);
    });

    // Fees
    if (order.packagingFee > 0) {
        if (isVatPayer) addToSummary(feeVatRate, order.packagingFee);
        const row = [
            'Balné',
            '1',
            isVatPayer ? getBase(order.packagingFee, feeVatRate).toFixed(2) : order.packagingFee.toFixed(2)
        ];
        if (isVatPayer) {
            row.push(`${feeVatRate}%`);
            row.push(getVat(order.packagingFee, feeVatRate).toFixed(2));
        }
        row.push(order.packagingFee.toFixed(2));
        tableBody.push(row);
    }

    if (order.deliveryFee > 0) {
        if (isVatPayer) addToSummary(feeVatRate, order.deliveryFee);
        const row = [
            'Doprava',
            '1',
            isVatPayer ? getBase(order.deliveryFee, feeVatRate).toFixed(2) : order.deliveryFee.toFixed(2)
        ];
        if (isVatPayer) {
            row.push(`${feeVatRate}%`);
            row.push(getVat(order.deliveryFee, feeVatRate).toFixed(2));
        }
        row.push(order.deliveryFee.toFixed(2));
        tableBody.push(row);
    }

    // Discounts
    order.appliedDiscounts?.forEach(d => {
        // Handle discounts in summary: 
        // Simply subtract from the highest rate bucket available to avoid complex math
        let discountRem = d.amount;
        if (isVatPayer) {
            const rates = Object.keys(taxSummary).map(Number).sort((a,b) => b-a);
            for (const r of rates) {
                if (discountRem <= 0) break;
                if (taxSummary[r].total > 0) {
                    const ded = Math.min(taxSummary[r].total, discountRem);
                    taxSummary[r].total -= ded;
                    taxSummary[r].base -= getBase(ded, r);
                    taxSummary[r].vat -= getVat(ded, r);
                    discountRem -= ded;
                }
            }
        }

        const row = [
            `Sleva ${d.code}`,
            '1',
            `-${d.amount.toFixed(2)}`
        ];
        if (isVatPayer) {
            row.push(''); // Rate
            row.push(''); // VAT
        }
        row.push(`-${d.amount.toFixed(2)}`);
        tableBody.push(row);
    });

    // --- 6. TABLE GENERATION ---
    const head = isVatPayer 
        ? [['Položka', 'Ks', 'Základ/ks', 'DPH %', 'DPH Celkem', 'Celkem s DPH']]
        : [['Položka', 'Ks', 'Cena/ks', 'Celkem']];

    autoTable(doc, {
        startY: 100,
        head: head,
        body: tableBody,
        theme: 'grid',
        styles: { 
            font: 'Roboto', 
            fontSize: 9,
            lineColor: [200, 200, 200]
        },
        headStyles: {
            fillColor: brandColor, // Purple
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        columnStyles: isVatPayer ? {
            0: { cellWidth: 'auto' }, // Name
            1: { halign: 'center' }, // Qty
            2: { halign: 'right' },  // Base
            3: { halign: 'center' }, // Rate
            4: { halign: 'right' },  // VAT
            5: { halign: 'right', fontStyle: 'bold' } // Total
        } : {
            0: { cellWidth: 'auto' },
            1: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' }
        }
    });

    let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 150) + 10;

    // --- 7. VAT RECAP TABLE (New) ---
    if (isVatPayer) {
        doc.setFontSize(10);
        doc.setFont("Roboto", "bold");
        doc.text("Rekapitulace DPH", 14, finalY);
        
        const summaryBody = Object.keys(taxSummary).map(rate => {
            const r = Number(rate);
            const s = taxSummary[r];
            // Only show if there are values
            if (s.total <= 0.01 && s.total >= -0.01) return null;
            return [
                `${r} %`,
                s.base.toFixed(2),
                s.vat.toFixed(2),
                s.total.toFixed(2)
            ];
        }).filter(Boolean);

        if (summaryBody.length > 0) {
            autoTable(doc, {
                startY: finalY + 2,
                head: [['Sazba', 'Základ daně', 'Výše daně', 'Celkem s DPH']],
                body: summaryBody,
                theme: 'striped',
                styles: { font: 'Roboto', fontSize: 8 },
                headStyles: { fillColor: [100, 100, 100] }, // Grey header for recap
                columnStyles: {
                    0: { halign: 'center', fontStyle: 'bold' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' }
                },
                margin: { left: 14, right: 100 } // Don't take full width
            });
            finalY = doc.lastAutoTable.finalY + 10;
        } else {
            finalY += 5;
        }
    }

    // --- 8. TOTALS & FOOTER ---
    const total = Math.max(0, order.totalPrice + order.packagingFee + (order.deliveryFee || 0) - (order.appliedDiscounts?.reduce((a,b)=>a+b.amount,0)||0));
    
    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...brandColor);
    doc.text(`CELKEM K ÚHRADĚ: ${total.toFixed(2)} Kč`, 196, finalY, { align: "right" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    if (type === 'final') {
        doc.text("NEPLATIT - Již uhrazeno zálohovou fakturou.", 196, finalY + 8, { align: "right" });
    } else {
        // --- 9. QR CODE (Only for Proforma) ---
        try {
            const iban = comp.bankAccount.replace(/\s/g,'').split('/')[0]; 
            
            const qrString = `SPD*1.0*ACC:${comp.bankAccount}*AM:${total.toFixed(2)}*CC:CZK*MSG:OBJ${order.id}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrString)}`;
            
            // Fetch the image
            const qrResp = await fetch(qrUrl);
            const qrBuf = await qrResp.arrayBuffer();
            const qrBase64 = Buffer.from(qrBuf).toString('base64');
            
            doc.addImage(qrBase64, "PNG", 150, finalY + 10, 40, 40);
            doc.setFontSize(8);
            doc.text("QR Platba", 170, finalY + 53, { align: "center" });
        } catch (e) {
            console.error("QR Code generation failed:", e);
        }
    }

    return Buffer.from(doc.output('arraybuffer'));
};
