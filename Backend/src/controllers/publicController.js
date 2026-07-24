// backend/controllers/publicController.js
const sql = require('mssql');

exports.trackPackage = async (req, res) => {
    try {
        const { trackingCode } = req.params;

        // SQL Injection-dan qorunmaq üçün parametrli sorğu
        const request = new sql.Request();
        request.input('trackingCode', sql.VarChar, trackingCode);

        const query = `
            SELECT 
                tracking_code, 
                warehouse_country AS origin_country, 
                status, 
                updated_at 
            FROM packages 
            WHERE tracking_code = @trackingCode
        `;

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Bağlama tapılmadı' });
        }

        // Statusların Azərbaycan dilinə map edilməsi üçün helper funksiya tətbiq edilə bilər
        const packageInfo = result.recordset[0];
        packageInfo.status_az = mapStatusToAz(packageInfo.status);

        res.status(200).json(packageInfo);
    } catch (error) {
        console.error('Tracking xətası:', error);
        res.status(500).json({ message: 'Server xətası baş verdi' });
    }
};

// Kiçik Helper Funksiya
const mapStatusToAz = (status) => {
    const statuses = {
        'declared': 'Bəyan edilib',
        'in_warehouse': 'Xarici anbardadır',
        'on_way': 'Yoldadır',
        'baku_warehouse': 'Bakı anbarındadır',
        'delivered': 'Təhvil verilib'
    };
    return statuses[status] || status;
};