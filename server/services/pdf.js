
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Helper to remove diacritics if font loading fails
const removeDiacritics = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const generateInvoicePdf = async (order, type = 'proforma', settings) => {
    const doc = new jsPDF();
    
    // Note: On server side without proper font files loaded into VFS, 
    // we must strip diacritics or standard fonts will print garbage.
    // In a full production env, we would load .ttf files here via fs.readFileSync
    const tSafe = (txt) => removeDiacritics(txt || ''); 

    const comp = order.companyDetailsSnapshot || settings.companyDetails || {};
    const isVatPayer = !!comp.dic;

    const headerTitle = type === 'proforma' 
        ? "ZALOHOVY DANOVY DOKLAD" 
        : (isVatPayer ? "FAKTURA - DANOVY DOKLAD" : "FAKTURA");
    
    const dateToUse = type === 'final' 
        ? (order.finalInvoiceDate || new Date().toISOString()) 
        : order.createdAt;

    doc.setFontSize(22);
    doc.text(headerTitle, 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Cislo obj: ${order.id}`, 105, 28, { align: "center" });
    
    doc.text(`Datum vystaveni: ${dateToUse.split('T')[0]}`, 105, 34, { align: "center" });

    // Supplier
    doc.setFontSize(12);
    doc.text("DODAVATEL:", 14, 50);
    doc.setFontSize(10);
    doc.text(tSafe(comp.name), 14, 56);
    doc.text(tSafe(comp.street), 14, 61);
    doc.text(tSafe(`${comp.zip} ${comp.city}`), 14, 66);
    doc.text(tSafe(`IC: ${comp.ic}`), 14, 71);
    if(comp.dic) doc.text(tSafe(`DIC: ${comp.dic}`), 14, 76);
    
    // Customer
    doc.setFontSize(12);
    doc.text("ODBERATEL:", 120, 50);
    doc.setFontSize(10);
    
    let yPos = 56;
    doc.text(tSafe(order.billingName || order.userName || 'Zakaznik'), 120, yPos); yPos += 5;
    doc.text(tSafe(order.billingStreet || ''), 120, yPos); yPos += 5;
    doc.text(tSafe(`${order.billingZip || ''} ${order.billingCity || ''}`), 120, yPos); yPos += 5;
    if (order.billingIc) { doc.text(tSafe(`IC: ${order.billingIc}`), 120, yPos); yPos += 5; }
    if (order.billingDic) { doc.text(tSafe(`DIC: ${order.billingDic}`), 120, yPos); yPos += 5; }

    // Table using autotable for better layout
    const tableBody = order.items.map(item => [
        tSafe(item.name),
        item.quantity,
        item.price.toFixed(2),
        (item.price * item.quantity).toFixed(2)
    ]);

    // Fees
    if (order.packagingFee > 0) tableBody.push(['Balne', '1', order.packagingFee.toFixed(2), order.packagingFee.toFixed(2)]);
    if (order.deliveryFee > 0) tableBody.push(['Doprava', '1', order.deliveryFee.toFixed(2), order.deliveryFee.toFixed(2)]);
    
    // Discounts
    order.appliedDiscounts?.forEach(d => {
        tableBody.push([`Sleva ${d.code}`, '1', `-${d.amount}`, `-${d.amount}`]);
    });

    doc.autoTable({
        startY: 90,
        head: [['Polozka', 'Ks', 'Cena/ks', 'Celkem']],
        body: tableBody,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 } // Using standard font
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    
    const total = Math.max(0, order.totalPrice + order.packagingFee + (order.deliveryFee || 0) - (order.appliedDiscounts?.reduce((a,b)=>a+b.amount,0)||0));
    
    doc.setFontSize(14);
    doc.text(`CELKEM K UHRADE: ${total.toFixed(2)} Kc`, 196, finalY, { align: "right" });

    if (type === 'final') {
        doc.setFontSize(10);
        doc.text("Jiz uhrazeno zalohou.", 196, finalY + 10, { align: "right" });
    }

    // Return as Buffer
    return Buffer.from(doc.output('arraybuffer'));
};
