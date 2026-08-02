import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, Button, Icon } from '@gravity-ui/uikit';
import { Printer } from '@gravity-ui/icons';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

const BarcodeModal = ({ open, onClose, pkg }) => {
    const barcodeRef = useRef(null);
    const [qrDataUrl, setQrDataUrl] = useState('');

    useEffect(() => {
        if (!open || !pkg?.trackingNumber) return;

        QRCode.toDataURL(pkg.trackingNumber, { width: 180, margin: 1 })
            .then(setQrDataUrl)
            .catch((err) => console.error('QR kod yaradıla bilmədi:', err));

        if (barcodeRef.current) {
            try {
                JsBarcode(barcodeRef.current, pkg.trackingNumber, {
                    format: 'CODE128',
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 14,
                    margin: 8
                });
            } catch (err) {
                console.error('Barkod yaradıla bilmədi:', err);
            }
        }
    }, [open, pkg]);

    const handlePrint = () => {
        const barcodeSvg = barcodeRef.current ? barcodeRef.current.outerHTML : '';
        const printWindow = window.open('', '_blank', 'width=420,height=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>Bağlama Etiketi - ${pkg?.trackingNumber || ''}</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                    .label { border: 2px solid #000; padding: 16px; display: inline-block; }
                    h2 { margin: 0 0 4px; }
                    .meta { text-align: left; margin-top: 12px; font-size: 14px; }
                    .meta div { margin-bottom: 4px; }
                </style>
            </head>
            <body>
                <div class="label">
                    <h2>CargoMS</h2>
                    <img src="${qrDataUrl}" width="150" height="150" />
                    <div>${barcodeSvg}</div>
                    <div class="meta">
                        <div><strong>Trek Nömrəsi:</strong> ${pkg?.trackingNumber || ''}</div>
                        <div><strong>Çəki:</strong> ${pkg?.weight ? parseFloat(pkg.weight).toFixed(2) + ' kq' : '-'}</div>
                        <div><strong>Status:</strong> ${pkg?.status || '-'}</div>
                    </div>
                </div>
                <script>window.onload = () => { window.print(); }</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Modal open={open} onClose={onClose}>
            <div style={{ padding: '24px', width: '360px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                <Text variant="header-1">Bağlama Etiketi</Text>
                <Text variant="body-2" color="secondary">{pkg?.trackingNumber}</Text>

                {qrDataUrl && (
                    <img src={qrDataUrl} alt="QR kod" width={160} height={160} style={{ background: '#fff', padding: '8px', borderRadius: '8px' }} />
                )}

                <div style={{ background: '#fff', padding: '8px', borderRadius: '8px' }}>
                    <svg ref={barcodeRef}></svg>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%', marginTop: '8px' }}>
                    <Button view="flat" onClick={onClose}>Bağla</Button>
                    <Button view="action" onClick={handlePrint}>
                        <Icon data={Printer} /> Çap Et
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default BarcodeModal;
