require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

let pool;
sql.connect(config).then(p => {
    pool = p;
    console.log("SQL Server-ə uğurla qoşuldu!");
}).catch(err => console.error("SQL Qoşulma xətası:", err));

// ==========================================
// 🔒 AUTH VƏ İCAZƏ (RBAC) MIDDLEWARE
// ==========================================

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Giriş tələb olunur' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Sessiya etibarsızdır, yenidən daxil olun' });
        }
        req.user = decoded;
        next();
    });
}

// Rolun DB-dəki cari icazələrini və Super Admin statusunu gətirir
async function getRoleInfo(roleName) {
    const roleResult = await pool.request()
        .input('name', sql.NVarChar, roleName)
        .query('SELECT id, isSuperAdmin FROM Roles WHERE name = @name');

    if (roleResult.recordset.length === 0) {
        return { isSuperAdmin: false, permissions: [] };
    }

    const role = roleResult.recordset[0];

    const permsResult = await pool.request()
        .input('roleId', sql.Int, role.id)
        .query(`
            SELECT p.[key] FROM RolePermissions rp
            JOIN Permissions p ON p.id = rp.permissionId
            WHERE rp.roleId = @roleId
        `);

    return {
        isSuperAdmin: !!role.isSuperAdmin,
        permissions: permsResult.recordset.map(r => r.key)
    };
}

// Konkret bir icazə tələb edən marşrutlar üçün (Super Admin həmişə keçir)
function requirePermission(key) {
    return async (req, res, next) => {
        try {
            const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
            if (isSuperAdmin || permissions.includes(key)) {
                return next();
            }
            return res.status(403).json({ message: 'Bu əməliyyat üçün icazəniz yoxdur' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    };
}

// Yalnız Super Admin üçün (rol idarəetməsi kimi checkbox-larla ötürülə bilməyən əməliyyatlar)
async function requireSuperAdmin(req, res, next) {
    try {
        const { isSuperAdmin } = await getRoleInfo(req.user.role);
        if (!isSuperAdmin) {
            return res.status(403).json({ message: 'Bu əməliyyat yalnız Super Admin üçündür' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

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

        const { isSuperAdmin, permissions } = await getRoleInfo(user.role);

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
                balance: user.balance || 0, // Balansı da login zamanı frontendə göndəririk
                isSuperAdmin,
                permissions
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. ŞİFRƏNİ DƏYİŞMƏK (CHANGE PASSWORD)
app.post('/api/auth/change-password', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
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

// 3.1 PROFİLİ YENİLƏ (AD, SOYAD, EMAIL)
app.put('/api/auth/profile', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "Bütün xanaları doldurun!" });
    }

    try {
        const emailCheck = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('id', sql.Int, userId)
            .query('SELECT id FROM Users WHERE email = @email AND id != @id');

        if (emailCheck.recordset.length > 0) {
            return res.status(400).json({ message: "Bu email ünvanı artıq başqa hesab tərəfindən istifadə olunur!" });
        }

        await pool.request()
            .input('id', sql.Int, userId)
            .input('firstName', sql.NVarChar, firstName)
            .input('lastName', sql.NVarChar, lastName)
            .input('fullName', sql.NVarChar, `${firstName} ${lastName}`)
            .input('email', sql.NVarChar, email)
            .query(`
                UPDATE Users
                SET firstName = @firstName, lastName = @lastName, fullName = @fullName, email = @email
                WHERE id = @id
            `);

        res.json({
            message: "Profiliniz uğurla yeniləndi!",
            user: { id: userId, firstName, lastName, email, role: req.user.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. ŞİFRƏNİ UNUTDUM (BƏRPA LİNKİ GÖNDƏR)
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email daxil edin!" });
    }

    // Təhlükəsizlik üçün istifadəçi mövcud olsun-olmasın eyni mesaj qaytarılır
    const genericResponse = { message: "Əgər bu email qeydiyyatdan keçibsə, bərpa linki göndərildi." };

    try {
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT id FROM Users WHERE email = @email');

        if (result.recordset.length === 0) {
            return res.json(genericResponse);
        }

        const userId = result.recordset[0].id;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiry = new Date(Date.now() + 30 * 60 * 1000);

        await pool.request()
            .input('id', sql.Int, userId)
            .input('token', sql.NVarChar, hashedToken)
            .input('expiry', sql.DateTime, expiry)
            .query('UPDATE Users SET resetToken = @token, resetTokenExpiry = @expiry WHERE id = @id');

        const resetLink = `${process.env.FRONTEND_URL}?resetToken=${rawToken}`;

        await transporter.sendMail({
            from: `"CargoMS" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'CargoMS - Şifrə Bərpası',
            html: `
                <p>Şifrənizi bərpa etmək üçün aşağıdakı linkə klikləyin (link 30 dəqiqə etibarlıdır):</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>Bu tələbi siz etməmisinizsə, bu emaili nəzərə almayın.</p>
            `
        });

        res.json(genericResponse);
    } catch (err) {
        console.error("Şifrə bərpa xətası:", err);
        res.status(500).json({ message: "Email göndərilərkən xəta baş verdi." });
    }
});

// 5. ŞİFRƏNİ BƏRPA ET (YENİ ŞİFRƏ TƏYİN ET)
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: "Bütün xanaları doldurun!" });
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const result = await pool.request()
            .input('token', sql.NVarChar, hashedToken)
            .query('SELECT id, resetTokenExpiry FROM Users WHERE resetToken = @token');

        if (result.recordset.length === 0) {
            return res.status(400).json({ message: "Bərpa linki etibarsızdır." });
        }

        const user = result.recordset[0];
        if (!user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
            return res.status(400).json({ message: "Bərpa linkinin vaxtı bitib. Yenidən tələb edin." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.request()
            .input('id', sql.Int, user.id)
            .input('password', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET password = @password, resetToken = NULL, resetTokenExpiry = NULL WHERE id = @id');

        res.json({ message: "Şifrəniz uğurla yeniləndi! İndi daxil ola bilərsiniz." });
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
app.get('/api/packages', verifyToken, async (req, res) => {
    try {
        const isDeleted = req.query.archived === 'true' ? 1 : 0;
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canViewAll = isSuperAdmin || permissions.includes('packages.viewAll');

        let query = 'SELECT * FROM Packages WHERE isDeleted = @isDeleted';
        if (!canViewAll) {
            query += ' AND userId = @userId';
        }
        query += ' ORDER BY id DESC';

        const request = pool.request().input('isDeleted', sql.Bit, isDeleted);
        if (!canViewAll) {
            request.input('userId', sql.Int, req.user.id);
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. Add Package
app.post('/api/packages', verifyToken, async (req, res) => {
    const { trackingNumber, weight, price } = req.body;
    try {
        await pool.request()
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.NVarChar, weight)
            .input('price', sql.NVarChar, price)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('userId', sql.Int, req.user.id)
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
app.put('/api/packages/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { trackingNumber, weight, price, status } = req.body;
    const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
    const canEditAll = isSuperAdmin || permissions.includes('packages.editAll');
    try {
        const request = pool.request()
            .input('id', sql.Int, id)
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.NVarChar, weight)
            .input('price', sql.NVarChar, price)
            .input('status', sql.NVarChar, status);

        let query = 'UPDATE Packages SET trackingNumber = @trackingNumber, weight = @weight, price = @price, status = @status WHERE id = @id';
        if (!canEditAll) {
            query += ' AND userId = @userId';
            request.input('userId', sql.Int, req.user.id);
        }

        const result = await request.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı və ya icazəniz yoxdur" });
        }
        res.json({ message: "Bağlama yeniləndi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 4. Soft Delete
app.delete('/api/packages/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
    const canEditAll = isSuperAdmin || permissions.includes('packages.editAll');
    try {
        const request = pool.request().input('id', sql.Int, id);
        let query = 'UPDATE Packages SET isDeleted = 1 WHERE id = @id';
        if (!canEditAll) {
            query += ' AND userId = @userId';
            request.input('userId', sql.Int, req.user.id);
        }

        const result = await request.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı və ya icazəniz yoxdur" });
        }
        res.json({ message: "Bağlama arxivə atıldı" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 5. Restore
app.put('/api/packages/:id/restore', verifyToken, requirePermission('packages.restore'), async (req, res) => {
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
app.delete('/api/packages/:id/hard', verifyToken, requirePermission('packages.hardDelete'), async (req, res) => {
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
app.get('/api/dashboard/stats', verifyToken, requirePermission('dashboard.view'), async (req, res) => {
    try {
        const pkgQuery = 'SELECT status, weight, price FROM Packages WHERE isDeleted = 0';
        const userQuery = 'SELECT COUNT(*) as totalUsers FROM Users';

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

// 1.1 Rol Adlarının Sadə Siyahısı (istifadəçiyə rol təyin edərkən dropdown üçün)
app.get('/api/roles/names', verifyToken, requirePermission('users.manageRoles'), async (req, res) => {
    try {
        const { isSuperAdmin } = await getRoleInfo(req.user.role);
        const result = await pool.request().query('SELECT id, name, isSuperAdmin FROM Roles ORDER BY id');
        const roles = isSuperAdmin
            ? result.recordset
            : result.recordset.filter(r => !r.isSuperAdmin);
        res.json(roles);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. İstifadəçilərin Siyahısı
app.get('/api/users', verifyToken, requirePermission('users.view'), async (req, res) => {
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

// 3. İstifadəçi Rolunu Dəyişmək
app.put('/api/users/:id/role', verifyToken, requirePermission('users.manageRoles'), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ message: "Rol qeyd edilməlidir!" });
    }

    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ message: "Öz rolunuzu dəyişə bilməzsiniz" });
    }

    try {
        const targetRole = await pool.request()
            .input('name', sql.NVarChar, role)
            .query('SELECT isSuperAdmin FROM Roles WHERE name = @name');

        if (targetRole.recordset.length === 0) {
            return res.status(400).json({ message: "Belə bir rol mövcud deyil" });
        }

        if (targetRole.recordset[0].isSuperAdmin) {
            const { isSuperAdmin: requesterIsSuperAdmin } = await getRoleInfo(req.user.role);
            if (!requesterIsSuperAdmin) {
                return res.status(403).json({ message: "Yalnız Super Admin başqasını Super Admin təyin edə bilər" });
            }
        }

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
app.get('/api/packages/stats', verifyToken, requirePermission('dashboard.view'), async (req, res) => {
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
app.get('/api/finance/admin-summary', verifyToken, requirePermission('finance.viewRevenue'), async (req, res) => {
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
app.get('/api/finance/my-balance', verifyToken, async (req, res) => {
    const userId = req.user.id;

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
app.post('/api/finance/top-up', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
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
// 📈 HESABATLAR API-si (Yalnız Admin üçün)
// ==========================================

app.get('/api/reports/summary', verifyToken, requirePermission('reports.view'), async (req, res) => {
    const { from, to } = req.query;

    if (!from || !to) {
        return res.status(400).json({ message: "Tarix aralığı (from, to) qeyd edilməlidir" });
    }

    try {
        const toInclusive = new Date(to);
        toInclusive.setDate(toInclusive.getDate() + 1);

        const packagesResult = await pool.request()
            .input('from', sql.DateTime, new Date(from))
            .input('to', sql.DateTime, toInclusive)
            .query(`
                SELECT id, trackingNumber, weight, price, status, userId, createdAt
                FROM Packages
                WHERE isDeleted = 0 AND createdAt >= @from AND createdAt < @to
                ORDER BY createdAt DESC
            `);

        const revenueResult = await pool.request()
            .input('from', sql.DateTime, new Date(from))
            .input('to', sql.DateTime, toInclusive)
            .query(`
                SELECT ISNULL(SUM(amount), 0) as totalRevenue
                FROM transactions
                WHERE type = 'inkam' AND created_at >= @from AND created_at < @to
            `);

        const packages = packagesResult.recordset;
        const statusBreakdown = {
            declared: packages.filter(p => p.status === 'Bəyan edildi').length,
            onTheWay: packages.filter(p => p.status === 'Yoldadır').length,
            customs: packages.filter(p => p.status === 'Gömrükdə').length,
            arrived: packages.filter(p => p.status === 'Filialda' || p.status === 'Təhvil verildi').length
        };

        res.json({
            totalPackages: packages.length,
            totalRevenue: revenueResult.recordset[0].totalRevenue,
            statusBreakdown,
            packages
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🛡️ ROLLAR VƏ İCAZƏLƏR (Yalnız Super Admin üçün)
// ==========================================

// 1. Bütün icazə açarlarının siyahısı (checkbox UI üçün)
app.get('/api/permissions', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const result = await pool.request().query('SELECT id, [key], label, category FROM Permissions ORDER BY category, id');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Rolların siyahısı (hər birinin icazələri və istifadəçi sayı ilə)
app.get('/api/roles', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const roles = await pool.request().query('SELECT id, name, isSuperAdmin, createdAt FROM Roles ORDER BY id');

        const permsResult = await pool.request().query(`
            SELECT rp.roleId, p.[key] FROM RolePermissions rp
            JOIN Permissions p ON p.id = rp.permissionId
        `);

        const userCounts = await pool.request().query(`
            SELECT role, COUNT(*) as count FROM Users GROUP BY role
        `);

        const data = roles.recordset.map(role => ({
            ...role,
            permissions: permsResult.recordset.filter(p => p.roleId === role.id).map(p => p.key),
            userCount: (userCounts.recordset.find(u => u.role === role.name) || { count: 0 }).count
        }));

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Yeni Rol Yarat
app.post('/api/roles', verifyToken, requireSuperAdmin, async (req, res) => {
    const { name, permissionKeys } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ message: "Rol adı qeyd edilməlidir!" });
    }

    try {
        const existing = await pool.request()
            .input('name', sql.NVarChar, name.trim())
            .query('SELECT id FROM Roles WHERE name = @name');

        if (existing.recordset.length > 0) {
            return res.status(400).json({ message: "Bu adda rol artıq mövcuddur!" });
        }

        const insertResult = await pool.request()
            .input('name', sql.NVarChar, name.trim())
            .query('INSERT INTO Roles (name, isSuperAdmin) OUTPUT INSERTED.id VALUES (@name, 0)');

        const roleId = insertResult.recordset[0].id;

        for (const key of (permissionKeys || [])) {
            const perm = await pool.request()
                .input('key', sql.NVarChar, key)
                .query('SELECT id FROM Permissions WHERE [key] = @key');
            if (perm.recordset.length > 0) {
                await pool.request()
                    .input('roleId', sql.Int, roleId)
                    .input('permissionId', sql.Int, perm.recordset[0].id)
                    .query('INSERT INTO RolePermissions (roleId, permissionId) VALUES (@roleId, @permissionId)');
            }
        }

        res.status(201).json({ message: "Rol uğurla yaradıldı!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Rolu Yenilə (ad + icazələr)
app.put('/api/roles/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, permissionKeys } = req.body;

    try {
        const roleResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT name, isSuperAdmin FROM Roles WHERE id = @id');

        if (roleResult.recordset.length === 0) {
            return res.status(404).json({ message: "Rol tapılmadı" });
        }

        const role = roleResult.recordset[0];

        if (role.isSuperAdmin) {
            return res.status(400).json({ message: "Super Admin rolu redaktə edilə bilməz" });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Rol adı qeyd edilməlidir!" });
        }

        const duplicateCheck = await pool.request()
            .input('name', sql.NVarChar, name.trim())
            .input('id', sql.Int, id)
            .query('SELECT id FROM Roles WHERE name = @name AND id != @id');

        if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({ message: "Bu adda rol artıq mövcuddur!" });
        }

        // Ad dəyişibsə, bu rola təyin edilmiş istifadəçilərin də adını yeniləyirik
        if (name.trim() !== role.name) {
            await pool.request()
                .input('oldName', sql.NVarChar, role.name)
                .input('newName', sql.NVarChar, name.trim())
                .query('UPDATE Users SET role = @newName WHERE role = @oldName');
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name.trim())
            .query('UPDATE Roles SET name = @name WHERE id = @id');

        await pool.request()
            .input('roleId', sql.Int, id)
            .query('DELETE FROM RolePermissions WHERE roleId = @roleId');

        for (const key of (permissionKeys || [])) {
            const perm = await pool.request()
                .input('key', sql.NVarChar, key)
                .query('SELECT id FROM Permissions WHERE [key] = @key');
            if (perm.recordset.length > 0) {
                await pool.request()
                    .input('roleId', sql.Int, id)
                    .input('permissionId', sql.Int, perm.recordset[0].id)
                    .query('INSERT INTO RolePermissions (roleId, permissionId) VALUES (@roleId, @permissionId)');
            }
        }

        res.json({ message: "Rol uğurla yeniləndi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Rolu Sil
app.delete('/api/roles/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const roleResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT name, isSuperAdmin FROM Roles WHERE id = @id');

        if (roleResult.recordset.length === 0) {
            return res.status(404).json({ message: "Rol tapılmadı" });
        }

        const role = roleResult.recordset[0];

        if (role.isSuperAdmin) {
            return res.status(400).json({ message: "Super Admin rolu silinə bilməz" });
        }

        const usersWithRole = await pool.request()
            .input('name', sql.NVarChar, role.name)
            .query('SELECT COUNT(*) as count FROM Users WHERE role = @name');

        if (usersWithRole.recordset[0].count > 0) {
            return res.status(400).json({ message: `Bu rol ${usersWithRole.recordset[0].count} istifadəçiyə təyin edilib, əvvəlcə onların rolunu dəyişin` });
        }

        await pool.request().input('id', sql.Int, id).query('DELETE FROM Roles WHERE id = @id');
        res.json({ message: "Rol uğurla silindi!" });
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