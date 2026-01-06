
import { jsPDF } from 'jspdf';
import autoTableModule from 'jspdf-autotable';

// Fix for ESM import in Node.js environment
const autoTable = autoTableModule.default || autoTableModule;

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

const calculateCzIban = (accountString) => {
  if (!accountString) return '';
  const cleanStr = accountString.replace(/\s/g, '');
  const [accountPart, bankCode] = cleanStr.split('/');
  if (!accountPart || !bankCode || bankCode.length !== 4) return '';
  let prefix = '';
  let number = accountPart;
  if (accountPart.includes('-')) { [prefix, number] = accountPart.split('-'); }
  const paddedPrefix = prefix.padStart(6, '0');
  const paddedNumber = number.padStart(10, '0');
  const paddedBank = bankCode.padStart(4, '0');
  const bban = paddedBank + paddedPrefix + paddedNumber;
  const numericStr = bban + '123500';
  const remainder = BigInt(numericStr) % 97n;
  const checkDigitsVal = 98n - remainder;
  const checkDigitsStr = checkDigitsVal.toString().padStart(2, '0');
  return `CZ${checkDigitsStr}${bban}`;
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

    // --- 2. PREPARE DATA (SNAPSHOT SELECTION) ---
    // Rule: Proforma = Snapshot at creation. Final = Snapshot at Delivery (or fallback to creation if legacy).
    let comp = {};
    if (type === 'final') {
        comp = order.deliveryCompanyDetailsSnapshot || order.companyDetailsSnapshot || settings.companyDetails || {};
    } else {
        comp = order.companyDetailsSnapshot || settings.companyDetails || {};
    }

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
    
    let yPos = 61;
    doc.text(comp.name || '', 14, yPos); yPos += 5;
    doc.text(comp.street || '', 14, yPos); yPos += 5;
    doc.text(`${comp.zip || ''} ${comp.city || ''}`, 14, yPos); yPos += 5;
    doc.text(`IČ: ${comp.ic || ''}`, 14, yPos); yPos += 5;
    if(comp.dic) { doc.text(`DIČ: ${comp.dic}`, 14, yPos); yPos += 5; }
    if(comp.bankAccount) { doc.text(`Účet: ${comp.bankAccount}`, 14, yPos); yPos += 5; }
    const vs = order.id.replace(/\D/g, '');
    if(vs) { doc.text(`Var. symbol: ${vs}`, 14, yPos); yPos += 5; }

    yPos = 61;
    doc.text(order.billingName || order.userName || 'Zákazník', 110, yPos); yPos += 5;
    doc.text(order.billingStreet || '', 110, yPos); yPos += 5;
    doc.text(`${order.billingZip || ''} ${order.billingCity || ''}`, 110, yPos); yPos += 5;
    if (order.billingIc) { doc.text(`IČ: ${order.billingIc}`, 110, yPos); yPos += 5; }
    if (order.billingDic) { doc.text(`DIČ: ${order.billingDic}`, 110, yPos); yPos += 5; }

    // --- 5. CALCULATIONS ---
    const getBase = (priceWithVat, rate) => priceWithVat / (1 + rate / 100);
    const getVat = (priceWithVat, rate) => priceWithVat - getBase(priceWithVat, rate);

    const grossTotalsByRate = {};
    
    // Group totals by rate
    order.items.forEach(item => {
        const rate = Number(item.vatRateTakeaway || 0);
        grossTotalsByRate[rate] = (grossTotalsByRate[rate] || 0) + (item.price * item.quantity);
    });

    let maxVatRate = 0;
    Object.keys(grossTotalsByRate).forEach(k => { if(Number(k) > maxVatRate) maxVatRate = Number(k); });
    const feeVatRate = maxVatRate > 0 ? maxVatRate : 21;

    if (order.packagingFee > 0) grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + order.packagingFee;
    if (order.deliveryFee > 0) grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + order.deliveryFee;

    const grandGrossTotal = Object.values(grossTotalsByRate).reduce((a, b) => a + b, 0);
    const totalDiscount = order.appliedDiscounts?.reduce((a, b) => a + b.amount, 0) || 0;
    const discountRatio = grandGrossTotal > 0 ? (totalDiscount / grandGrossTotal) : 0;

    const tableBody = [];
    const taxSummary = {};

    // Calculate Summary with proportional discount
    Object.keys(grossTotalsByRate).forEach(k => {
        const r = Number(k);
        const gross = grossTotalsByRate[r];
        const netAtRate = gross * (1 - discountRatio);
        
        taxSummary[r] = {
            total: netAtRate,
            base: getBase(netAtRate, r),
            vat: netAtRate - getBase(netAtRate, r)
        };
    });

    // Items table rows
    order.items.forEach(item => {
        const lineTotal = item.price * item.quantity;
        const rate = Number(item.vatRateTakeaway || 0);
        const row = [
            item.name,
            item.quantity,
            isVatPayer ? getBase(item.price, rate).toFixed(2) : item.price.toFixed(2)
        ];
        if (isVatPayer) { row.push(`${rate}%`); row.push(getVat(lineTotal, rate).toFixed(2)); }
        row.push(lineTotal.toFixed(2));
        tableBody.push(row);
    });

    if (order.packagingFee > 0) {
        const row = ['Balné', '1', isVatPayer ? getBase(order.packagingFee, feeVatRate).toFixed(2) : order.packagingFee.toFixed(2)];
        if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(order.packagingFee, feeVatRate).toFixed(2)); }
        row.push(order.packagingFee.toFixed(2));
        tableBody.push(row);
    }

    if (order.deliveryFee > 0) {
        const row = ['Doprava', '1', isVatPayer ? getBase(order.deliveryFee, feeVatRate).toFixed(2) : order.deliveryFee.toFixed(2)];
        if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(order.deliveryFee, feeVatRate).toFixed(2)); }
        row.push(order.deliveryFee.toFixed(2));
        tableBody.push(row);
    }

    order.appliedDiscounts?.forEach(d => {
        const row = [`Sleva ${d.code}`, '1', `-${d.amount.toFixed(2)}`];
        if (isVatPayer) { row.push(''); row.push(''); }
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
        styles: { font: 'Roboto', fontSize: 9, lineColor: [200, 200, 200] },
        headStyles: { fillColor: brandColor, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: isVatPayer ? {
            0: { cellWidth: 'auto' }, 1: { halign: 'center' }, 2: { halign: 'right' },
            3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }
        } : {
            0: { cellWidth: 'auto' }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' }
        }
    });

    let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 150) + 10;

    // --- 7. VAT RECAP TABLE ---
    if (isVatPayer) {
        doc.setFontSize(10);
        doc.setFont("Roboto", "bold");
        doc.text("Rekapitulace DPH", 14, finalY);
        const summaryBody = Object.keys(taxSummary).map(rate => {
            const r = Number(rate);
            const s = taxSummary[r];
            if (Math.abs(s.total) < 0.01) return null;
            return [`${r} %`, s.base.toFixed(2), s.vat.toFixed(2), s.total.toFixed(2)];
        }).filter(Boolean);

        if (summaryBody.length > 0) {
            autoTable(doc, {
                startY: finalY + 2,
                head: [['Sazba', 'Základ daně', 'Výše daně', 'Celkem s DPH']],
                body: summaryBody,
                theme: 'striped',
                styles: { font: 'Roboto', fontSize: 8 },
                headStyles: { fillColor: [100, 100, 100] },
                columnStyles: { 0: { halign: 'center', fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
                margin: { left: 14, right: 100 }
            });
            finalY = doc.lastAutoTable.finalY + 10;
        } else { finalY += 5; }
    }

    // --- 8. TOTALS & FOOTER ---
    const grandTotal = Math.max(0, grandGrossTotal - totalDiscount);
    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...brandColor);
    doc.text(`CELKEM K ÚHRADĚ: ${grandTotal.toFixed(2)} Kč`, 196, finalY, { align: "right" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    if (type === 'final') {
        doc.text("NEPLATIT - Již uhrazeno zálohovou fakturou.", 196, finalY + 8, { align: "right" });
    } else {
        try {
            if (comp.bankAccount) {
              const vs = order.id.replace(/\D/g, '');
              const iban = calculateCzIban(comp.bankAccount);
              const bic = comp.bic ? `+${comp.bic}` : '';
              const qrString = `SPD*1.0*ACC:${iban}${bic}*AM:${grandTotal.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:OBJ${order.id}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrString)}`;
              const qrResp = await fetch(qrUrl);
              const qrBuf = await qrResp.arrayBuffer();
              const qrBase64 = Buffer.from(qrBuf).toString('base64');
              doc.addImage(qrBase64, "PNG", 150, finalY + 10, 40, 40);
              doc.setFontSize(8);
              doc.text("QR Platba", 170, finalY + 53, { align: "center" });
            }
        } catch (e) { console.error("QR Code generation failed:", e); }
    }
    return Buffer.from(doc.output('arraybuffer'));
};
