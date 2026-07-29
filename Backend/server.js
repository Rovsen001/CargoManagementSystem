require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: process.env.DB_INSTANCE
    }
};
let pool;
sql.connect(config).then(p => {
    pool = p;
    console.log("SQL Server-ə uğurla qoşuldu!");
}).catch(err => console.error("SQL Qoşulma xətası:", err));


// ==========================================
// 🔐 AUTH (QEYDİYYAT VƏ GİRİŞ) MARŞRUTLARI
// ==========================================

// 1. QEYDİYYAT (REGISTER)
app.post('/api/auth/register', async (req, res) => {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: "Zəhmət olmasa bütün xanaları doldurun!" });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Daxil edilən şifrələr bir-biri ilə üst-üstə düşmür!" });
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
        const userRole = 'Customer';

        await pool.request()
            .input('firstName', sql.NVarChar, firstName)
            .input('lastName', sql.NVarChar, lastName)
            .input('fullName', sql.NVarChar, `${firstName} ${lastName}`)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, userRole)
            .query(`
        INSERT INTO Users (firstName, lastName, fullName, email, password, role)
        VALUES (@firstName, @lastName, @fullName, @email, @password, @role)
      `);

        res.status(201).json({ message: "Qeydiyyat uğurludur! İndi daxil ola bilərsiniz." });
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
            { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: "Giriş uğurludur!",
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                balance: user.balance || 0 // Balansı da login zamanı frontendə göndəririk
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. ŞİFRƏNİ DƏYİŞMƏK (CHANGE PASSWORD)
app.post('/api/auth/change-password', async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({ message: "Bütün xanaları doldurun!" });
    }

    try {
        const result = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT * FROM Users WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "İstifadəçi tapılmadı!" });
        }

        const user = result.recordset[0];
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Cari şifrəniz yanlışdır!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.request()
            .input('id', sql.Int, userId)
            .input('password', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET password = @password WHERE id = @id');

        res.json({ message: "Şifrəniz uğurla yeniləndi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ==========================================
// 🔎 İCTİMAİ İZLƏMƏ (LOGIN TƏLƏB OLUNMUR)
// ==========================================

app.get('/api/public/track/:trackingNumber', async (req, res) => {
    const { trackingNumber } = req.params;

    try {
        const result = await pool.request()
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .query('SELECT trackingNumber, weight, price, status FROM Packages WHERE trackingNumber = @trackingNumber AND isDeleted = 0');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Bağlama tapılmadı' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 📦 PACKAGES API MARŞRUTLARI (ROLA UYĞUN)
// ==========================================

// 1. Get Packages
app.get('/api/packages', async (req, res) => {
    try {
        const isDeleted = req.query.archived === 'true' ? 1 : 0;
        const userId = req.query.userId;
        const role = req.query.role;

        let query = 'SELECT * FROM Packages WHERE isDeleted = @isDeleted';

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

// 2. Add Package
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


// ==========================================
// 📊 DASHBOARD VƏ USERS API MARŞRUTLARI
// ==========================================

// 1. Dashboard Statistika API-si
app.get('/api/dashboard/stats', async (req, res) => {
    const { userId, role } = req.query;

    try {
        let pkgQuery = 'SELECT status, weight, price FROM Packages WHERE isDeleted = 0';
        let userQuery = 'SELECT COUNT(*) as totalUsers FROM Users';

        if (role !== 'Admin' && userId) {
            pkgQuery += ' AND userId = ' + parseInt(userId);
        }

        const packagesResult = await pool.request().query(pkgQuery);
        const usersResult = await pool.request().query(userQuery);

        const packages = packagesResult.recordset;

        const totalPackages = packages.length;
        const inTransit = packages.filter(p => p.status === 'Yoldadır' || p.status === 'Gömrükdə').length;
        const delivered = packages.filter(p => p.status === 'Filialda' || p.status === 'Təhvil verildi').length;

        const totalWeight = packages.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0);
        const totalPrice = packages.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);

        res.json({
            totalPackages,
            inTransit,
            delivered,
            totalWeight: totalWeight.toFixed(2),
            totalPrice: totalPrice.toFixed(2),
            totalUsers: usersResult.recordset[0].totalUsers
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. İstifadəçilərin Siyahısı (Yalnız Admin üçün)
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.request().query(`
      SELECT id, firstName, lastName, email, role, createdAt 
      FROM Users 
      ORDER BY id DESC
    `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. İstifadəçi Rolunu Dəyişmək (Yalnız Admin üçün)
app.put('/api/users/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ message: "Rol qeyd edilməlidir!" });
    }

    try {
        await pool.request()
            .input('id', sql.Int, id)
            .input('role', sql.NVarChar, role)
            .query('UPDATE Users SET role = @role WHERE id = @id');

        res.json({ message: "İstifadəçinin rolu yeniləndi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Dashboard üçün Vizual Statistika API-si
app.get('/api/packages/stats', async (req, res) => {
    try {
        const result = await pool.request().query(`
      SELECT status, COUNT(*) as count 
      FROM Packages 
      WHERE isDeleted = 0 
      GROUP BY status
    `);

        const totalResult = await pool.request().query(`
      SELECT COUNT(*) as total FROM Packages WHERE isDeleted = 0
    `);

        const statsMap = {};
        result.recordset.forEach(row => {
            statsMap[row.status] = row.count;
        });

        const total = totalResult.recordset[0].total;

        res.json({
            total: total,
            declared: statsMap['Bəyan edildi'] || 0,
            onTheWay: statsMap['Yoldadır'] || 0,
            customs: statsMap['Gömrükdə'] || 0,
            arrived: (statsMap['Filialda'] || 0) + (statsMap['Təhvil verildi'] || 0)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ==========================================
// 💰 MALİYYƏ VƏ BALANS API MARŞRUTLARI
// ==========================================

// 0. Admin üçün Ümumi Gəlir Statistikası
app.get('/api/finance/admin-summary', async (req, res) => {
    try {
        const totalResult = await pool.request().query(`
            SELECT ISNULL(SUM(amount), 0) as totalRevenue
            FROM transactions WHERE type = 'inkam'
        `);

        const monthResult = await pool.request().query(`
            SELECT ISNULL(SUM(amount), 0) as monthRevenue
            FROM transactions
            WHERE type = 'inkam'
              AND MONTH(created_at) = MONTH(GETDATE())
              AND YEAR(created_at) = YEAR(GETDATE())
        `);

        res.json({
            totalRevenue: totalResult.recordset[0].totalRevenue,
            monthRevenue: monthResult.recordset[0].monthRevenue
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 1. Balans və Tranzaksiya Tarixçəsini Gətir
app.get('/api/finance/my-balance', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "İstifadəçi ID-si qeyd edilməyib!" });
    }

    try {
        // Balansı çəkirik
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT balance FROM Users WHERE id = @userId');

        // Tranzaksiyaları çəkirik
        const txResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM transactions WHERE user_id = @userId ORDER BY created_at DESC');

        res.json({
            balance: userResult.recordset[0] && userResult.recordset[0].balance ? userResult.recordset[0].balance : 0.00,
            transactions: txResult.recordset
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Balans Artırmaq
app.post('/api/finance/top-up', async (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Düzgün məlumatlar daxil edin" });
    }

    try {
        // Balansı artırırıq (NULL olarsa, 0 olaraq nəzərə alınması üçün ISNULL istifadə edirik)
        await pool.request()
            .input('amount', sql.Decimal(10, 2), amount)
            .input('userId', sql.Int, userId)
            .query('UPDATE Users SET balance = ISNULL(balance, 0) + @amount WHERE id = @userId');

        // Tranzaksiya cədvəlinə mədaxil kimi yazırıq
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('amount', sql.Decimal(10, 2), amount)
            .input('type', sql.VarChar(10), 'inkam')
            .input('description', sql.NVarChar(255), 'Balans artırılması')
            .query(`
                INSERT INTO transactions (user_id, amount, type, description) 
                VALUES (@userId, @amount, @type, @description)
            `);

        res.json({ message: "Balans uğurla artırıldı!" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🚀 SERVERİ BAŞLATMAQ
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışır...`);
});