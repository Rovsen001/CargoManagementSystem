import jsPDF from 'jspdf';

export function generateCommercialInvoice(pkg) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginX = 20;
    let y = 20;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('CargoMS', marginX, y);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('International Cargo & Logistics', marginX, y + 6);

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('COMMERCIAL INVOICE', 210 - marginX, y, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Invoice No: INV-${pkg.id}`, 210 - marginX, y + 6, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 210 - marginX, y + 11, { align: 'right' });

    y += 22;
    doc.setDrawColor(180);
    doc.line(marginX, y, 210 - marginX, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Consignee', marginX, y);
    doc.text('Shipped From', 115, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`${pkg.ownerFirstName || ''} ${pkg.ownerLastName || ''}`.trim() || '-', marginX, y);
    doc.text(pkg.warehouseName || '-', 115, y);
    y += 5;
    doc.text(pkg.ownerEmail || '-', marginX, y);
    doc.text(pkg.warehouseCountry || '-', 115, y);

    y += 14;
    doc.setDrawColor(180);
    doc.line(marginX, y, 210 - marginX, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Shipment Details', marginX, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    const rows = [
        ['Tracking Number', pkg.trackingNumber || '-'],
        ['Weight', pkg.weight != null ? `${parseFloat(pkg.weight).toFixed(2)} kg` : '-'],
        ['Country of Origin', pkg.countryOfOrigin || '-'],
        ['HS Code', pkg.hsCode || '-']
    ];
    rows.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, marginX, y);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), marginX + 45, y);
        y += 6;
    });

    y += 6;
    doc.setFillColor(240, 240, 245);
    doc.rect(marginX, y, 210 - marginX * 2, 8, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('Description of Goods', marginX + 2, y + 5.5);
    doc.text('Qty', 120, y + 5.5);
    doc.text('Unit Value (USD)', 145, y + 5.5);
    doc.text('Total Value (USD)', 178, y + 5.5);
    y += 8;

    const declaredValue = pkg.isInsured && pkg.declaredValue != null ? parseFloat(pkg.declaredValue) : 0;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.rect(marginX, y, 210 - marginX * 2, 10);
    doc.text(pkg.itemDescription || 'General merchandise', marginX + 2, y + 6.5, { maxWidth: 90 });
    doc.text('1', 122, y + 6.5);
    doc.text(`$${declaredValue.toFixed(2)}`, 148, y + 6.5);
    doc.text(`$${declaredValue.toFixed(2)}`, 181, y + 6.5);
    y += 16;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text(`Total Declared Value: $${declaredValue.toFixed(2)} USD`, 210 - marginX, y, { align: 'right' });

    y += 20;
    doc.setDrawColor(180);
    doc.line(marginX, y, 210 - marginX, y);
    y += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100);
    doc.text(
        'I hereby certify that the information on this invoice is true and correct to the best of my knowledge,\nand that the contents of this shipment are as stated above.',
        marginX, y
    );

    y += 20;
    doc.setDrawColor(150);
    doc.line(marginX, y, marginX + 60, y);
    doc.text('Signature', marginX, y + 5);

    doc.save(`Commercial_Invoice_${pkg.trackingNumber || pkg.id}.pdf`);
}
