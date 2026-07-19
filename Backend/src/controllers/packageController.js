const { poolPromise, sql } = require('../config/db');

// 1. Bazadan bütün bağlamaları çəkən funksiya
const getAllPackages = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Packages');
        res.json(result.recordset);
    } catch (error) {
        console.error("SQL Xətası:", error);
        res.status(500).json({ error: 'Məlumatlar gətirilərkən xəta baş verdi' });
    }
};

// 2. Bazaya yeni bağlama yazan funksiya
const createPackage = async (req, res) => {
    const { trackingNumber, weight, price } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('trackingNumber', sql.VarChar, trackingNumber)
            .input('weight', sql.VarChar, weight)
            .input('price', sql.VarChar, price || '$0.00')
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

// 3. Bağlamanı İD-sinə görə bazadan silən funksiya
const deletePackage = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Packages WHERE id = @id');

        res.json({ message: 'Bağlama uğurla silindi' });
    } catch (error) {
        console.error("SQL Xətası:", error);
        res.status(500).json({ error: 'Bağlama silinərkən xəta baş verdi' });
    }
};

// 4. Bağlamanın statusunu yeniləyən funksiya
const updatePackageStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.VarChar, status)
            .query(`
        UPDATE Packages 
        SET status = @status 
        OUTPUT INSERTED.* 
        WHERE id = @id
      `);
        res.json(result.recordset[0]);
    } catch (error) {
        console.error("SQL Xətası:", error);
        res.status(500).json({ error: 'Status yenilənərkən xəta baş verdi' });
    }
};

// 5. Dashboard üçün statistik məlumatları gətirən funksiya
const getDashboardStats = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Bəyan edildi' THEN 1 ELSE 0 END) as declared,
        SUM(CASE WHEN status = 'Yoldadır' THEN 1 ELSE 0 END) as onTheWay,
        SUM(CASE WHEN status = 'Gömrükdə' THEN 1 ELSE 0 END) as customs,
        SUM(CASE WHEN status = 'Filialda' THEN 1 ELSE 0 END) as arrived
      FROM Packages
    `);

        res.json(result.recordset[0]);
    } catch (error) {
        console.error("SQL Xətası:", error);
        res.status(500).json({ error: 'Statistikalar alınarkən xəta baş verdi' });
    }
};

// Bütün funksiyaları tam şəkildə ixrac edirik
module.exports = {
    getAllPackages,
    createPackage,
    deletePackage,
    updatePackageStatus,
    getDashboardStats
};