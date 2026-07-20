const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
app.use(cors());
app.use(express.json());

// SQL Server Qoşulma Konfiqurasiyası (Öz məlumatlarınızla yoxlayın)
const config = {
    user: 'sa',
    password: 'MyCargoSql123',
    server: '127.0.0.1',
    port: 58678,
    database: 'CargoDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool;
sql.connect(config).then(p => {
    pool = p;
    console.log("SQL Server-ə uğurla qoşuldu!");
}).catch(err => console.error("SQL Qoşulma xətası:", err));


// ==========================================
// 📦 PACKAGES API MARŞRUTLARI (BURANI YENİLƏYİN)
// ==========================================

// 1. Aktiv və ya Arxivdəki Bağlamaları Getirmək
app.get('/api/packages', async (req, res) => {
    try {
        const isDeleted = req.query.archived === 'true' ? 1 : 0;
        const result = await pool.request()
            .input('isDeleted', sql.Bit, isDeleted)
            .query('SELECT * FROM Packages WHERE isDeleted = @isDeleted ORDER BY id DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. Yeni Bağlama Əlavə Etmək
app.post('/api/packages', async (req, res) => {
    const { trackingNumber, weight, price } = req.body;
    try {
        await pool.request()
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.NVarChar, weight)
            .input('price', sql.NVarChar, price)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .query(`
        INSERT INTO Packages (trackingNumber, weight, price, status, isDeleted) 
        VALUES (@trackingNumber, @weight, @price, @status, 0)
      `);
        res.json({ message: "Bağlama əlavə edildi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 3. Redaktə Etmək (Update)
app.put('/api/packages/:id', async (req, res) => {
    const { id } = req.params;
    const { trackingNumber, weight, price, status } = req.body;
    try {
        await pool.request()
            .input('id', sql.Int, id)
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.NVarChar, weight)
            .input('price', sql.NVarChar, price)
            .input('status', sql.NVarChar, status)
            .query(`
        UPDATE Packages 
        SET trackingNumber = @trackingNumber, weight = @weight, price = @price, status = @status 
        WHERE id = @id
      `);
        res.json({ message: "Bağlama yeniləndi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 4. Soft Delete (Arxivə / Zibil Qutusuna Atmaq)
app.delete('/api/packages/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE Packages SET isDeleted = 1 WHERE id = @id');
        res.json({ message: "Bağlama arxivə atıldı" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 5. Restore (Arxivdən Geri Bərpa Etmək)
app.put('/api/packages/:id/restore', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE Packages SET isDeleted = 0 WHERE id = @id');
        res.json({ message: "Bağlama bərpa edildi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 6. Hard Delete (Bazadan Həmişəlik Silmək - X düyməsi)
app.delete('/api/packages/:id/hard', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Packages WHERE id = @id');
        res.json({ message: "Bağlama həmişəlik silindi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Serveri Başlatmaq
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışır...`);
});