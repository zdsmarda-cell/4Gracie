
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Ride, Order, Product, GlobalSettings } from '../types';
import { calculatePackageCountLogic } from './orderLogic';

// Helper to load font
const fetchFont = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load font: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

export const generateRoutePdf = async (
    ride: Ride, 
    orders: Order[], 
    products: Product[], 
    settings: GlobalSettings,
    driverName: string
): Promise<ArrayBuffer> => {
    const doc = new jsPDF();

    // Load Fonts (Roboto for Czech chars)
    try {
        const regularBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
        const mediumBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf');
        
        doc.addFileToVFS("Roboto-Regular.ttf", regularBase64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFileToVFS("Roboto-Medium.ttf", mediumBase64);
        doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
        doc.setFont("Roboto");
    } catch (e) {
        console.error("Font loading failed", e);
    }

    // 1. HEADER
    doc.setFontSize(18);
    doc.setFont("Roboto", "bold");
    doc.text(`ROZVOZOVÝ LIST: ${ride.id}`, 14, 20);
    
    doc.setFontSize(12);
    doc.setFont("Roboto", "normal");
    doc.text(`Datum: ${ride.date}`, 14, 28);
    doc.text(`Řidič: ${driverName}`, 120, 28);

    const tableBody: any[] = [];
    let totalCashToCollect = 0;

    // 2. STOPS
    if (ride.steps) {
        ride.steps.forEach(step => {
            if (step.type === 'delivery') {
                // Find full order to calc packages & check timing
                const fullOrder = orders.find(o => o.id === step.orderId);
                let arrivalCell: any = step.arrivalTime;
                let addressCell: any = step.address;
                
                // Calculate Packages
                let pkgCount = 0;
                let paymentCell: any = 'ZAPLACENO';
                let isGrayedOut = false;
                let statusText = '';
                
                // Resolve Customer Details (Prioritize Order Data)
                const customerName = fullOrder?.deliveryName || fullOrder?.userName || step.customerName || 'Neznámý';
                const customerPhone = fullOrder?.deliveryPhone || step.customerPhone || '-';

                // Handle Address Error Display
                if (step.error) {
                    addressCell = {
                        content: `${step.address}\n>>> CHYBA: ${step.error} <<<`,
                        styles: { textColor: [200, 0, 0], fontStyle: 'bold' }
                    };
                }

                if (fullOrder) {
                    // Check if closed/finished
                    if (fullOrder.status === 'delivered' || fullOrder.status === 'cancelled' || fullOrder.status === 'not_picked_up') {
                        isGrayedOut = true;
                        statusText = fullOrder.status === 'cancelled' ? ' (STORNO)' : fullOrder.status === 'delivered' ? ' (DORUČENO)' : ' (NEDORUČENO)';
                    }

                    // --- Late Delivery Logic (Only if not grayed out) ---
                    if (!isGrayedOut && fullOrder.deliveryZip && settings.deliveryRegions) {
                        const region = settings.deliveryRegions.find(r => r.enabled && r.zips.includes(fullOrder.deliveryZip!.replace(/\s/g, '')));
                        if (region) {
                            const ex = region.exceptions?.find(e => e.date === ride.date);
                            
                            let regionEndTime: string | undefined;
                            
                            if (ex && ex.isOpen) {
                                regionEndTime = ex.deliveryTimeEnd;
                            } else {
                                const dayOfWeek = new Date(ride.date).getDay();
                                const hours = region.openingHours?.[dayOfWeek];
                                if (hours && hours.isOpen) {
                                    regionEndTime = hours.end;
                                }
                            }
                            
                            if (regionEndTime && step.arrivalTime > regionEndTime) {
                                arrivalCell = { 
                                    content: `${step.arrivalTime} (! POZDĚ !)`, 
                                    styles: { textColor: [200, 0, 0], fontStyle: 'bold' } 
                                };
                            }
                        }
                    }

                    if (fullOrder.items) {
                        const enrichedItems = fullOrder.items.map(i => {
                            const p = products.find(prod => prod.id === i.id);
                            return { ...i, volume: p?.volume || i.volume || 0 };
                        });
                        pkgCount = calculatePackageCountLogic(enrichedItems, settings.packaging.types);
                    } else {
                        pkgCount = 1;
                    }

                    if (!fullOrder.isPaid && !isGrayedOut) {
                        const discount = fullOrder.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
                        const toPay = Math.max(0, fullOrder.totalPrice - discount) + fullOrder.packagingFee + (fullOrder.deliveryFee || 0);
                        totalCashToCollect += toPay;
                        paymentCell = { 
                            content: `DOBÍRKA: ${toPay} Kč`, 
                            styles: { textColor: [200, 0, 0], fontStyle: 'bold' } 
                        };
                    } else if (isGrayedOut) {
                        paymentCell = '-';
                    }
                } else {
                    pkgCount = 1; 
                }

                // Define Styles based on status
                const rowStyles = isGrayedOut ? { textColor: [150, 150, 150], fontStyle: 'normal' } : {};

                tableBody.push([
                    { content: step.orderId, styles: rowStyles },
                    isGrayedOut ? { content: step.arrivalTime + statusText, styles: rowStyles } : arrivalCell,
                    { content: customerName + statusText, styles: rowStyles },
                    isGrayedOut ? { content: step.address, styles: rowStyles } : addressCell,
                    { content: customerPhone, styles: rowStyles },
                    isGrayedOut ? { content: paymentCell, styles: rowStyles } : paymentCell,
                    { content: pkgCount, styles: { ...rowStyles, halign: 'center' } }
                ]);
            }
        });
    }

    autoTable(doc, {
        startY: 35,
        head: [['ID Obj.', 'Čas', 'Zákazník', 'Adresa', 'Telefon', 'Platba', 'Balíků']],
        body: tableBody,
        theme: 'grid',
        styles: { font: 'Roboto', fontSize: 10 },
        columnStyles: { 
            0: { fontStyle: 'bold' },
            5: { fontStyle: 'bold' },
            6: { halign: 'center' }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.setFont("Roboto", "bold");
    doc.text(`CELKEM K VÝBĚRU (DOBÍRKY): ${totalCashToCollect} Kč`, 14, finalY);

    return doc.output('arraybuffer');
};
