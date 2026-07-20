const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'kargo_secret_key_12345';

const config = {
    user: 'sa',
    password: 'MyCargoSql123', // 👈 Öz şifrənizi yazın
    server: '127.0.0.1',
    database: 'CargoDB',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: 'SQLEXPRESS'
    }
};

let pool;
sql.connect(config).then(p => {
    pool = p;
    console.log("SQL Server-ə uğurla qoşuldu!");
}).catch(err => console.error("SQL Qoşulma xətası:", err));


// ==========================================
// 🔐 AUTH (QEYDİYYAT VƏ GİRİŞ) API MARŞRUTLARI
// ==========================================

// 1. QEYDİYYAT (REGISTER)
app.post('/api/auth/register', async (req, res) => {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({ message: "Zəhmət olmasa bütün xanaları doldurun!" });
    }

    try {
        const checkUser = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE email = @email');

        if (checkUser.recordset.length > 0) {
            return res.status(400).json({ message: "Bu email ünvanı artıq qeydiyyatdan keçib!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userRole = role || 'Customer';
        await pool.request()
            .input('fullName', sql.NVarChar, fullName)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, userRole)
            .query(`
        INSERT INTO Users (fullName, email, password, role) 
        VALUES (@fullName, @email, @password, @role)
      `);

        res.status(201).json({ message: "İstifadəçi uğurla qeydiyyatdan keçdi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. GİRİŞ (LOGIN)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email və şifrəni daxil edin!" });
    }

    try {
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE email = @email');

        if (result.recordset.length === 0) {
            return res.status(400).json({ message: "Email və ya şifrə yanlışdır!" });
        }

        const user = result.recordset[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Email və ya şifrə yanlışdır!" });
        }

        const token = jwt.sign(
            { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: "Giriş uğurludur!",
            token,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ==========================================
// 📦 PACKAGES API MARŞRUTLARI (ROLA UYĞUN)
// ==========================================

// 1. Get Packages (Admin hər şeyi görür, Müştəri yalnız özününkünü)
app.get('/api/packages', async (req, res) => {
    try {
        const isDeleted = req.query.archived === 'true' ? 1 : 0;
        const userId = req.query.userId;
        const role = req.query.role;

        let query = 'SELECT * FROM Packages WHERE isDeleted = @isDeleted';

        // Əgər Admin deyilsə, yalnız öz bağlamalarını çək
        if (role !== 'Admin' && userId) {
            query += ' AND userId = @userId';
        }

        query += ' ORDER BY id DESC';

        const request = pool.request().input('isDeleted', sql.Bit, isDeleted);
        if (role !== 'Admin' && userId) {
            request.input('userId', sql.Int, userId);
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. Add Package (userId ilə birlikdə saxlanılır)
app.post('/api/packages', async (req, res) => {
    const { trackingNumber, weight, price, userId } = req.body;
    try {
        await pool.request()
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.NVarChar, weight)
            .input('price', sql.NVarChar, price)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('userId', sql.Int, userId || null)
            .query(`
        INSERT INTO Packages (trackingNumber, weight, price, status, isDeleted, userId) 
        VALUES (@trackingNumber, @weight, @price, @status, 0, @userId)
      `);
        res.json({ message: "Bağlama əlavə edildi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 3. Update Package
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

// 4. Soft Delete
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

// 5. Restore
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

// 6. Hard Delete
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