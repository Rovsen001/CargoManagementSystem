const { poolPromise, sql } = require('../config/db');

// Bazadan bütün bağlamaları çəkən funksiya
const getAllPackages = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Packages');
        res.json(result.recordset); // SQL-dən gələn datanı göndəririk
    } catch (error) {
        console.error("SQL Xətası:", error);
        res.status(500).json({ error: 'Məlumatlar gətirilərkən xəta baş verdi' });
    }
};

// Bazaya yeni bağlama yazan funksiya
const createPackage = async (req, res) => {
    const { trackingNumber, weight, price } = req.body;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('trackingNumber', sql.VarChar, trackingNumber)
            .input('weight', sql.VarChar, weight)
            .input('price', sql.VarChar, price || '$0.00')
            // OUTPUT INSERTED.* yazaraq bazaya yeni yazılan sətri dərhal geri alırıq
            .query(`
        INSERT INTO Packages (trackingNumber, weight, price, status) 
        OUTPUT INSERTED.* 
        VALUES (@trackingNumber, @weight, @price, 'Bəyan edildi')
      `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("SQL Xətası:", error);
        res.status(500).json({ error: 'Bağlama əlavə edilərkən xəta baş verdi' });
    }
};

module.exports = {
    getAllPackages,
    createPackage
};