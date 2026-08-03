require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');

const app = express();
app.use(cors());

// Stripe yalnız .env-də STRIPE_SECRET_KEY qeyd olunubsa aktivləşir (real satıcı açarları tələb olunur)
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Stripe webhook-u imza yoxlaması üçün RAW body tələb edir — buna görə express.json()-dan ƏVVƏL qeydə alınır
app.post('/api/finance/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).send('Stripe konfiqurasiya edilməyib');
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Stripe webhook imza xətası:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = parseInt(session.client_reference_id);
        const amount = (session.amount_total || 0) / 100;

        if (userId && amount > 0) {
            try {
                await pool.request()
                    .input('amount', sql.Decimal(10, 2), amount)
                    .input('userId', sql.Int, userId)
                    .query('UPDATE Users SET balance = ISNULL(balance, 0) + @amount WHERE id = @userId');

                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('amount', sql.Decimal(10, 2), amount)
                    .input('type', sql.VarChar(10), 'inkam')
                    .input('description', sql.NVarChar(255), `Stripe ödənişi (${session.id})`)
                    .query(`
                        INSERT INTO transactions (user_id, amount, type, description)
                        VALUES (@userId, @amount, @type, @description)
                    `);
            } catch (err) {
                console.error('Stripe webhook balans yenilənərkən xəta:', err.message);
                return res.status(500).send('Server xətası');
            }
        }
    }

    res.json({ received: true });
});

app.use(express.json());

// Giriş cəhdlərini məhdudlaşdırır (brute-force hücumlarına qarşı)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Çox sayda uğursuz giriş cəhdi. Zəhmət olmasa 15 dəqiqə sonra yenidən cəhd edin." },
    skipSuccessfulRequests: true
});

const JWT_SECRET = process.env.JWT_SECRET;
const INSURANCE_RATE = 0.02; // Bəyan edilmiş dəyərin 2%-i sığorta haqqı kimi tutulur
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

// Admin əməliyyatlarını qeyd edir (audit log). Xəta versə belə əsas əməliyyatı pozmur.
async function logAudit(req, action, targetType, targetId, details) {
    try {
        await pool.request()
            .input('userId', sql.Int, req.user.id)
            .input('userRole', sql.NVarChar, req.user.role)
            .input('action', sql.NVarChar, action)
            .input('targetType', sql.NVarChar, targetType)
            .input('targetId', sql.NVarChar, targetId !== undefined && targetId !== null ? String(targetId) : null)
            .input('details', sql.NVarChar, details ? JSON.stringify(details) : null)
            .query(`
                INSERT INTO AuditLog (userId, userRole, action, targetType, targetId, details)
                VALUES (@userId, @userRole, @action, @targetType, @targetId, @details)
            `);
    } catch (err) {
        console.error('Audit log yazıla bilmədi:', err.message);
    }
}

// Bağlama statusu dəyişəndə sahibinə daxili bildiriş yaradır və email göndərir (xəta versə əsas əməliyyatı pozmur)
async function notifyPackageStatusChange(packageOwnerId, trackingNumber, newStatus) {
    const title = 'Bağlamanızın statusu yeniləndi';
    const message = `${trackingNumber} nömrəli bağlamanızın yeni statusu: ${newStatus}`;

    try {
        await pool.request()
            .input('userId', sql.Int, packageOwnerId)
            .input('title', sql.NVarChar, title)
            .input('message', sql.NVarChar, message)
            .query(`
                INSERT INTO Notifications (userId, title, message, type, isRead)
                VALUES (@userId, @title, @message, 'status_change', 0)
            `);
    } catch (err) {
        console.error('Bildiriş yazıla bilmədi:', err.message);
    }

    try {
        const userResult = await pool.request()
            .input('userId', sql.Int, packageOwnerId)
            .query('SELECT email, firstName FROM Users WHERE id = @userId');
        const owner = userResult.recordset[0];
        if (owner?.email) {
            await transporter.sendMail({
                from: `"CargoMS" <${process.env.SMTP_USER}>`,
                to: owner.email,
                subject: `CargoMS - Bağlama Statusu Yeniləndi (${trackingNumber})`,
                html: `
                    <p>Salam ${owner.firstName || ''},</p>
                    <p><strong>${trackingNumber}</strong> nömrəli bağlamanızın statusu yeniləndi:</p>
                    <p style="font-size: 18px; font-weight: bold; color: #8b5cf6;">${newStatus}</p>
                    <p>Bağlamanızı izləmək üçün CargoMS hesabınıza daxil olun.</p>
                `
            });
        }
    } catch (err) {
        console.error('Bildiriş email-i göndərilə bilmədi:', err.message);
    }
}

// Sadə daxili bildiriş yazır (email göndərmir). Xəta versə əsas əməliyyatı pozmur.
async function createInAppNotification(userId, title, message, type = 'general') {
    try {
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('title', sql.NVarChar, title)
            .input('message', sql.NVarChar, message)
            .input('type', sql.NVarChar, type)
            .query(`
                INSERT INTO Notifications (userId, title, message, type, isRead)
                VALUES (@userId, @title, @message, @type, 0)
            `);
    } catch (err) {
        console.error('Bildiriş yazıla bilmədi:', err.message);
    }
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
    let { firstName, lastName, email, password, confirmPassword } = req.body;
    firstName = firstName?.trim();
    lastName = lastName?.trim();
    email = email?.trim();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: "Zəhmət olmasa bütün xanaları doldurun!" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Şifrə ən azı 6 simvoldan ibarət olmalıdır!" });
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
app.post('/api/auth/login', loginLimiter, async (req, res) => {
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

        if (user.twoFactorEnabled) {
            const tempToken = jwt.sign(
                { id: user.id, type: '2fa-pending' },
                JWT_SECRET,
                { expiresIn: '5m' }
            );
            return res.json({ requires2FA: true, tempToken });
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

// 2.1 2FA Kodu ilə Girişi Tamamlamaq
app.post('/api/auth/2fa/login-verify', loginLimiter, async (req, res) => {
    const { tempToken, token: totpToken } = req.body;

    if (!tempToken || !totpToken) {
        return res.status(400).json({ message: "Kod tələb olunur!" });
    }

    try {
        let decoded;
        try {
            decoded = jwt.verify(tempToken, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: "Sessiya vaxtı bitib, yenidən daxil olun." });
        }
        if (decoded.type !== '2fa-pending') {
            return res.status(400).json({ message: "Yanlış sorğu." });
        }

        const result = await pool.request()
            .input('id', sql.Int, decoded.id)
            .query('SELECT * FROM Users WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "İstifadəçi tapılmadı" });
        }
        const user = result.recordset[0];

        if (!user.twoFactorEnabled || !user.twoFactorSecret) {
            return res.status(400).json({ message: "2FA aktiv deyil." });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: totpToken,
            window: 1
        });

        if (!verified) {
            return res.status(400).json({ message: "Doğrulama kodu yanlışdır!" });
        }

        const { isSuperAdmin, permissions } = await getRoleInfo(user.role);

        const finalToken = jwt.sign(
            { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: "Giriş uğurludur!",
            token: finalToken,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                balance: user.balance || 0,
                isSuperAdmin,
                permissions
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2.2 2FA Quraşdırılmasını Başlat (yalnız Admin/Super Admin)
app.post('/api/auth/2fa/setup', verifyToken, async (req, res) => {
    const { isSuperAdmin } = await getRoleInfo(req.user.role);
    if (!isSuperAdmin && req.user.role !== 'Admin') {
        return res.status(403).json({ message: "2FA yalnız Admin və Super Admin hesabları üçün mövcuddur." });
    }

    try {
        const secret = speakeasy.generateSecret({
            name: `CargoMS (${req.user.email})`,
            length: 20
        });

        await pool.request()
            .input('id', sql.Int, req.user.id)
            .input('secret', sql.NVarChar, secret.base32)
            .query('UPDATE Users SET twoFactorSecret = @secret, twoFactorEnabled = 0 WHERE id = @id');

        res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2.3 2FA Quraşdırılmasını Təsdiqlə (kodu doğrulayıb aktivləşdirir)
app.post('/api/auth/2fa/verify-setup', verifyToken, async (req, res) => {
    const { token: totpToken } = req.body;
    if (!totpToken) {
        return res.status(400).json({ message: "Doğrulama kodu tələb olunur!" });
    }

    try {
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT twoFactorSecret FROM Users WHERE id = @id');

        const secret = result.recordset[0]?.twoFactorSecret;
        if (!secret) {
            return res.status(400).json({ message: "Əvvəlcə 2FA quraşdırmasını başladın." });
        }

        const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: totpToken,
            window: 1
        });

        if (!verified) {
            return res.status(400).json({ message: "Doğrulama kodu yanlışdır!" });
        }

        await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('UPDATE Users SET twoFactorEnabled = 1 WHERE id = @id');

        res.json({ message: "2FA uğurla aktivləşdirildi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2.4 2FA-nı Deaktiv Et (cari koda tələbat var)
app.post('/api/auth/2fa/disable', verifyToken, async (req, res) => {
    const { token: totpToken } = req.body;
    if (!totpToken) {
        return res.status(400).json({ message: "Doğrulama kodu tələb olunur!" });
    }

    try {
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT twoFactorSecret, twoFactorEnabled FROM Users WHERE id = @id');

        const user = result.recordset[0];
        if (!user?.twoFactorEnabled) {
            return res.status(400).json({ message: "2FA artıq aktiv deyil." });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: totpToken,
            window: 1
        });

        if (!verified) {
            return res.status(400).json({ message: "Doğrulama kodu yanlışdır!" });
        }

        await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('UPDATE Users SET twoFactorEnabled = 0, twoFactorSecret = NULL WHERE id = @id');

        res.json({ message: "2FA deaktiv edildi." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2.5 2FA Statusunu Yoxla
app.get('/api/auth/2fa/status', verifyToken, async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT twoFactorEnabled FROM Users WHERE id = @id');
        res.json({ enabled: Boolean(result.recordset[0]?.twoFactorEnabled) });
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

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "Yeni şifrə ən azı 6 simvoldan ibarət olmalıdır!" });
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
    const firstName = req.body.firstName?.trim();
    const lastName = req.body.lastName?.trim();
    const email = req.body.email?.trim();

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

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "Şifrə ən azı 6 simvoldan ibarət olmalıdır!" });
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
            .query('SELECT id, trackingNumber, weight, price, status, isInsured, declaredValue, insuranceFee FROM Packages WHERE trackingNumber = @trackingNumber AND isDeleted = 0');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Bağlama tapılmadı' });
        }

        const pkg = result.recordset[0];
        const historyResult = await pool.request()
            .input('packageId', sql.Int, pkg.id)
            .query('SELECT status, changedAt FROM PackageStatusHistory WHERE packageId = @packageId ORDER BY changedAt ASC');

        res.json({
            trackingNumber: pkg.trackingNumber,
            weight: pkg.weight,
            price: pkg.price,
            status: pkg.status,
            isInsured: pkg.isInsured,
            declaredValue: pkg.declaredValue,
            insuranceFee: pkg.insuranceFee,
            history: historyResult.recordset
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 📦 PACKAGES API MARŞRUTLARI (ROLA UYĞUN)
// ==========================================

// 1. Get Packages (page/limit verilmədikdə köhnə davranış kimi tam massiv qaytarır — geriyə uyğunluq üçün)
app.get('/api/packages', verifyToken, async (req, res) => {
    try {
        const isDeleted = req.query.archived === 'true' ? 1 : 0;
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canViewAll = isSuperAdmin || permissions.includes('packages.viewAll');
        const isCourierScoped = !canViewAll && permissions.includes('packages.viewAssigned');

        const search = (req.query.search || '').trim();
        const statusFilter = (req.query.status || '').trim();
        const page = parseInt(req.query.page);
        const isPaginated = !isNaN(page) && page > 0;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        const buildRequest = () => {
            const request = pool.request().input('isDeleted', sql.Bit, isDeleted);
            let whereClause = 'WHERE p.isDeleted = @isDeleted';
            if (isCourierScoped) {
                whereClause += ' AND p.assignedCourierId = @userId';
                request.input('userId', sql.Int, req.user.id);
            } else if (!canViewAll) {
                whereClause += ' AND p.userId = @userId';
                request.input('userId', sql.Int, req.user.id);
            }
            if (search) {
                whereClause += ' AND p.trackingNumber LIKE @search';
                request.input('search', sql.NVarChar, `%${search}%`);
            }
            if (statusFilter && statusFilter !== 'ALL') {
                whereClause += ' AND p.status = @status';
                request.input('status', sql.NVarChar, statusFilter);
            }
            return { request, whereClause };
        };

        const selectColumns = `
            p.*,
            u.firstName as ownerFirstName, u.lastName as ownerLastName, u.email as ownerEmail,
            w.name as warehouseName, w.country as warehouseCountry
        `;
        const joinClause = 'FROM Packages p LEFT JOIN Users u ON u.id = p.userId LEFT JOIN Warehouses w ON w.id = p.warehouseId';

        if (!isPaginated) {
            const { request, whereClause } = buildRequest();
            const result = await request.query(`SELECT ${selectColumns} ${joinClause} ${whereClause} ORDER BY p.id DESC`);
            return res.json(result.recordset);
        }

        const { request: countRequest, whereClause: countWhere } = buildRequest();
        const countResult = await countRequest.query(`SELECT COUNT(*) as total ${joinClause} ${countWhere}`);
        const total = countResult.recordset[0].total;

        const { request: dataRequest, whereClause: dataWhere } = buildRequest();
        dataRequest.input('offset', sql.Int, (page - 1) * limit);
        dataRequest.input('limit', sql.Int, limit);
        const result = await dataRequest.query(`
            SELECT ${selectColumns} ${joinClause} ${dataWhere}
            ORDER BY p.id DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        res.json({
            data: result.recordset,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 1.1 Kuryerlərin Siyahısı (bağlamaya təyin etmək üçün)
app.get('/api/couriers', verifyToken, requirePermission('packages.assignCourier'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT DISTINCT u.id, u.firstName, u.lastName, u.email
            FROM Users u
            JOIN Roles r ON r.name = u.role
            JOIN RolePermissions rp ON rp.roleId = r.id
            JOIN Permissions p ON p.id = rp.permissionId
            WHERE p.[key] = 'packages.viewAssigned'
            ORDER BY u.firstName
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 1.2 Bağlamaya Kuryer Təyin Etmək / Təyinatı Ləğv Etmək
app.put('/api/packages/:id/assign-courier', verifyToken, requirePermission('packages.assignCourier'), async (req, res) => {
    const { id } = req.params;
    const courierId = req.body.courierId ? parseInt(req.body.courierId) : null;

    try {
        if (courierId !== null) {
            const courierCheck = await pool.request()
                .input('courierId', sql.Int, courierId)
                .query(`
                    SELECT u.id FROM Users u
                    JOIN Roles r ON r.name = u.role
                    JOIN RolePermissions rp ON rp.roleId = r.id
                    JOIN Permissions p ON p.id = rp.permissionId
                    WHERE p.[key] = 'packages.viewAssigned' AND u.id = @courierId
                `);
            if (courierCheck.recordset.length === 0) {
                return res.status(400).json({ message: "Seçilmiş istifadəçi kuryer deyil" });
            }
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('courierId', sql.Int, courierId)
            .query('UPDATE Packages SET assignedCourierId = @courierId WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }

        await logAudit(req, 'package.assignCourier', 'Package', id, { courierId });

        res.json({ message: courierId ? "Kuryer təyin edildi" : "Kuryer təyinatı ləğv edildi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 1.2.1 Bağlamaların Konsolidasiyası (Bir neçə bağlamanı anbarda tək bağlamaya birləşdirmək)
app.post('/api/packages/consolidate', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const { packageIds, trackingNumber, actualWeight } = req.body;
    const weight = parseFloat(actualWeight);

    if (!Array.isArray(packageIds) || packageIds.length < 2) {
        return res.status(400).json({ message: "Ən azı 2 bağlama seçilməlidir!" });
    }
    if (!trackingNumber || !trackingNumber.trim()) {
        return res.status(400).json({ message: "Yeni trek nömrəsi qeyd edilməlidir!" });
    }
    if (isNaN(weight) || weight <= 0) {
        return res.status(400).json({ message: "Real çəki müsbət rəqəm olmalıdır!" });
    }

    const idsList = packageIds.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (idsList.length !== packageIds.length || idsList.length < 2) {
        return res.status(400).json({ message: "Yanlış bağlama ID-ləri" });
    }

    try {
        const lookupRequest = pool.request();
        const idParams = idsList.map((id, i) => {
            lookupRequest.input(`id${i}`, sql.Int, id);
            return `@id${i}`;
        }).join(',');

        const sourceResult = await lookupRequest.query(`
            SELECT id, trackingNumber, weight, userId, warehouseId, status, isDeleted, consolidatedIntoId
            FROM Packages WHERE id IN (${idParams})
        `);

        const sources = sourceResult.recordset;
        if (sources.length !== idsList.length) {
            return res.status(404).json({ message: "Seçilmiş bağlamalardan bəziləri tapılmadı" });
        }

        const firstUserId = sources[0].userId;
        const firstWarehouseId = sources[0].warehouseId;

        for (const pkg of sources) {
            if (pkg.userId !== firstUserId) {
                return res.status(400).json({ message: "Bütün bağlamalar eyni müştəriyə aid olmalıdır" });
            }
            if (pkg.warehouseId !== firstWarehouseId) {
                return res.status(400).json({ message: "Bütün bağlamalar eyni anbarda olmalıdır" });
            }
            if (pkg.isDeleted) {
                return res.status(400).json({ message: `${pkg.trackingNumber} artıq arxivlənib, konsolidasiya edilə bilməz` });
            }
            if (pkg.consolidatedIntoId) {
                return res.status(400).json({ message: `${pkg.trackingNumber} artıq konsolidasiya edilib` });
            }
        }

        const warehouseResult = await pool.request()
            .input('warehouseId', sql.Int, firstWarehouseId)
            .query('SELECT ratePerKg FROM Warehouses WHERE id = @warehouseId');
        const ratePerKg = warehouseResult.recordset[0]?.ratePerKg || 0;
        const price = Math.round(weight * ratePerKg * 100) / 100;

        const insertResult = await pool.request()
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.Decimal(10, 2), weight)
            .input('price', sql.Decimal(10, 2), price)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('userId', sql.Int, firstUserId)
            .input('warehouseId', sql.Int, firstWarehouseId)
            .query(`
                INSERT INTO Packages (trackingNumber, weight, price, status, isDeleted, userId, warehouseId)
                OUTPUT INSERTED.id
                VALUES (@trackingNumber, @weight, @price, @status, 0, @userId, @warehouseId)
            `);
        const newPackageId = insertResult.recordset[0].id;

        await pool.request()
            .input('packageId', sql.Int, newPackageId)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('changedByUserId', sql.Int, req.user.id)
            .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');

        for (const pkg of sources) {
            await pool.request()
                .input('id', sql.Int, pkg.id)
                .input('consolidatedIntoId', sql.Int, newPackageId)
                .input('status', sql.NVarChar, 'Konsolidasiya edildi')
                .query('UPDATE Packages SET status = @status, consolidatedIntoId = @consolidatedIntoId WHERE id = @id');

            await pool.request()
                .input('packageId', sql.Int, pkg.id)
                .input('status', sql.NVarChar, 'Konsolidasiya edildi')
                .input('changedByUserId', sql.Int, req.user.id)
                .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');
        }

        await createInAppNotification(
            firstUserId,
            'Bağlamalarınız konsolidasiya edildi',
            `${sources.map((s) => s.trackingNumber).join(', ')} bağlamaları "${trackingNumber}" trek nömrəli tək bağlamaya birləşdirildi.`,
            'consolidation'
        );

        await logAudit(req, 'package.consolidate', 'Package', newPackageId, {
            sourceTrackingNumbers: sources.map((s) => s.trackingNumber),
            newTrackingNumber: trackingNumber,
            actualWeight: weight
        });

        res.json({ message: "Bağlamalar uğurla konsolidasiya edildi", newPackageId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 1.3 Kuryerin Özünə Təyin Olunmuş Bağlamanın Statusunu Yeniləməsi
app.put('/api/packages/:id/courier-status', verifyToken, requirePermission('packages.viewAssigned'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['Yoldadır', 'Gömrükdə', 'Filialda', 'Təhvil verildi'];

    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Düzgün status seçin" });
    }

    try {
        const existing = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT status, assignedCourierId, userId, trackingNumber FROM Packages WHERE id = @id');

        if (existing.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        if (existing.recordset[0].assignedCourierId !== req.user.id) {
            return res.status(403).json({ message: "Bu bağlama sizə təyin edilməyib" });
        }

        const previousStatus = existing.recordset[0].status;
        const ownerId = existing.recordset[0].userId;
        const trackingNumber = existing.recordset[0].trackingNumber;

        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query('UPDATE Packages SET status = @status WHERE id = @id');

        if (status !== previousStatus) {
            await pool.request()
                .input('packageId', sql.Int, id)
                .input('status', sql.NVarChar, status)
                .input('changedByUserId', sql.Int, req.user.id)
                .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');
            await notifyPackageStatusChange(ownerId, trackingNumber, status);
        }

        res.json({ message: "Status yeniləndi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Add Package (qiymət müştəri tərəfindən deyil, çəki × anbar tarifinə görə sistem tərəfindən hesablanır)
app.post('/api/packages', verifyToken, async (req, res) => {
    const { trackingNumber } = req.body;
    const weight = parseFloat(req.body.weight);
    const warehouseId = parseInt(req.body.warehouseId);
    const isInsured = Boolean(req.body.isInsured);
    const declaredValue = parseFloat(req.body.declaredValue);
    const hsCode = (req.body.hsCode || '').trim() || null;
    const itemDescription = (req.body.itemDescription || '').trim() || null;
    const countryOfOrigin = (req.body.countryOfOrigin || '').trim() || null;

    if (!trackingNumber || !trackingNumber.trim()) {
        return res.status(400).json({ message: "Trek nömrəsi qeyd edilməlidir!" });
    }
    if (isNaN(weight) || weight < 0) {
        return res.status(400).json({ message: "Çəki düzgün, mənfi olmayan bir rəqəm olmalıdır!" });
    }
    if (isNaN(warehouseId)) {
        return res.status(400).json({ message: "Anbar seçilməlidir!" });
    }
    if (isInsured && (isNaN(declaredValue) || declaredValue <= 0)) {
        return res.status(400).json({ message: "Sığorta üçün bəyan edilmiş dəyər müsbət rəqəm olmalıdır!" });
    }

    try {
        const warehouseResult = await pool.request()
            .input('id', sql.Int, warehouseId)
            .query('SELECT ratePerKg FROM Warehouses WHERE id = @id AND isActive = 1');

        if (warehouseResult.recordset.length === 0) {
            return res.status(400).json({ message: "Seçilmiş anbar tapılmadı və ya aktiv deyil" });
        }

        const ratePerKg = warehouseResult.recordset[0].ratePerKg;
        const price = Math.round(weight * ratePerKg * 100) / 100;
        const finalDeclaredValue = isInsured ? declaredValue : null;
        const insuranceFee = isInsured ? Math.round(declaredValue * INSURANCE_RATE * 100) / 100 : 0;

        const insertResult = await pool.request()
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.Decimal(10, 2), weight)
            .input('price', sql.Decimal(10, 2), price)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('userId', sql.Int, req.user.id)
            .input('warehouseId', sql.Int, warehouseId)
            .input('isInsured', sql.Bit, isInsured)
            .input('declaredValue', sql.Decimal(10, 2), finalDeclaredValue)
            .input('insuranceFee', sql.Decimal(10, 2), insuranceFee)
            .input('hsCode', sql.NVarChar, hsCode)
            .input('itemDescription', sql.NVarChar, itemDescription)
            .input('countryOfOrigin', sql.NVarChar, countryOfOrigin)
            .query(`
        INSERT INTO Packages (trackingNumber, weight, price, status, isDeleted, userId, warehouseId, isInsured, declaredValue, insuranceFee, hsCode, itemDescription, countryOfOrigin)
        OUTPUT INSERTED.id
        VALUES (@trackingNumber, @weight, @price, @status, 0, @userId, @warehouseId, @isInsured, @declaredValue, @insuranceFee, @hsCode, @itemDescription, @countryOfOrigin)
      `);

        const newPackageId = insertResult.recordset[0].id;
        await pool.request()
            .input('packageId', sql.Int, newPackageId)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('changedByUserId', sql.Int, req.user.id)
            .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');

        res.json({ message: "Bağlama əlavə edildi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 3. Update Package
app.put('/api/packages/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { trackingNumber, status } = req.body;
    const weight = parseFloat(req.body.weight);
    const isInsured = Boolean(req.body.isInsured);
    const declaredValue = parseFloat(req.body.declaredValue);
    const hsCode = (req.body.hsCode || '').trim() || null;
    const itemDescription = (req.body.itemDescription || '').trim() || null;
    const countryOfOrigin = (req.body.countryOfOrigin || '').trim() || null;

    if (!trackingNumber || !trackingNumber.trim()) {
        return res.status(400).json({ message: "Trek nömrəsi qeyd edilməlidir!" });
    }
    if (isNaN(weight) || weight < 0) {
        return res.status(400).json({ message: "Çəki düzgün, mənfi olmayan bir rəqəm olmalıdır!" });
    }
    if (isInsured && (isNaN(declaredValue) || declaredValue <= 0)) {
        return res.status(400).json({ message: "Sığorta üçün bəyan edilmiş dəyər müsbət rəqəm olmalıdır!" });
    }

    const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
    const canEditAll = isSuperAdmin || permissions.includes('packages.editAll');
    const canOverridePrice = isSuperAdmin || permissions.includes('packages.changeStatus');
    try {
        const existing = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT status, warehouseId, price as previousPrice, userId as ownerId FROM Packages WHERE id = @id');
        if (existing.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const previousStatus = existing.recordset[0].status;
        const warehouseId = existing.recordset[0].warehouseId;
        const previousPrice = existing.recordset[0].previousPrice;
        const ownerId = existing.recordset[0].ownerId;

        // Qiymət: Admin-səviyyəli istifadəçi əl ilə göndərsə istifadə olunur, əks halda çəki × anbar tarifinə görə yenidən hesablanır
        let price;
        let isManualOverride = false;
        const manualPrice = parseFloat(req.body.price);
        if (canOverridePrice && !isNaN(manualPrice) && manualPrice >= 0) {
            price = manualPrice;
            isManualOverride = true;
        } else {
            const warehouseResult = await pool.request()
                .input('warehouseId', sql.Int, warehouseId)
                .query('SELECT ratePerKg FROM Warehouses WHERE id = @warehouseId');
            const ratePerKg = warehouseResult.recordset[0]?.ratePerKg || 0;
            price = Math.round(weight * ratePerKg * 100) / 100;
        }

        const finalDeclaredValue = isInsured ? declaredValue : null;
        const insuranceFee = isInsured ? Math.round(declaredValue * INSURANCE_RATE * 100) / 100 : 0;

        const request = pool.request()
            .input('id', sql.Int, id)
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('weight', sql.Decimal(10, 2), weight)
            .input('price', sql.Decimal(10, 2), price)
            .input('status', sql.NVarChar, status)
            .input('isInsured', sql.Bit, isInsured)
            .input('declaredValue', sql.Decimal(10, 2), finalDeclaredValue)
            .input('insuranceFee', sql.Decimal(10, 2), insuranceFee)
            .input('hsCode', sql.NVarChar, hsCode)
            .input('itemDescription', sql.NVarChar, itemDescription)
            .input('countryOfOrigin', sql.NVarChar, countryOfOrigin);

        let query = 'UPDATE Packages SET trackingNumber = @trackingNumber, weight = @weight, price = @price, status = @status, isInsured = @isInsured, declaredValue = @declaredValue, insuranceFee = @insuranceFee, hsCode = @hsCode, itemDescription = @itemDescription, countryOfOrigin = @countryOfOrigin WHERE id = @id';
        if (!canEditAll) {
            query += ' AND userId = @userId';
            request.input('userId', sql.Int, req.user.id);
        }

        const result = await request.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı və ya icazəniz yoxdur" });
        }

        if (status && status !== previousStatus) {
            await pool.request()
                .input('packageId', sql.Int, id)
                .input('status', sql.NVarChar, status)
                .input('changedByUserId', sql.Int, req.user.id)
                .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');
            await notifyPackageStatusChange(ownerId, trackingNumber, status);
        }

        if (isManualOverride && parseFloat(previousPrice) !== price) {
            await logAudit(req, 'package.priceOverride', 'Package', id, {
                trackingNumber, previousPrice: parseFloat(previousPrice), newPrice: price
            });
        }
        if (canEditAll && ownerId !== req.user.id) {
            await logAudit(req, 'package.editAll', 'Package', id, { trackingNumber, ownerId });
        }

        res.json({ message: "Bağlama yeniləndi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 3.1 Bağlamanın Status Tarixçəsi
app.get('/api/packages/:id/history', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
    const canViewAll = isSuperAdmin || permissions.includes('packages.viewAll');

    try {
        const pkgCheck = await pool.request().input('id', sql.Int, id).query('SELECT userId, assignedCourierId FROM Packages WHERE id = @id');
        if (pkgCheck.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const isOwner = pkgCheck.recordset[0].userId === req.user.id;
        const isAssignedCourier = pkgCheck.recordset[0].assignedCourierId === req.user.id;
        if (!canViewAll && !isOwner && !isAssignedCourier) {
            return res.status(403).json({ message: "Bu bağlamaya baxmaq icazəniz yoxdur" });
        }

        const result = await pool.request()
            .input('packageId', sql.Int, id)
            .query('SELECT status, changedAt FROM PackageStatusHistory WHERE packageId = @packageId ORDER BY changedAt ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        await logAudit(req, 'package.restore', 'Package', id, null);
        res.json({ message: "Bağlama bərpa edildi" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 6. Hard Delete
app.delete('/api/packages/:id/hard', verifyToken, requirePermission('packages.hardDelete'), async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT trackingNumber FROM Packages WHERE id = @id');

        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Packages WHERE id = @id');

        await logAudit(req, 'package.hardDelete', 'Package', id, {
            trackingNumber: existing.recordset[0]?.trackingNumber
        });

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

// 2. İstifadəçilərin Siyahısı (page/limit verilmədikdə köhnə davranış kimi tam massiv qaytarır — geriyə uyğunluq üçün)
app.get('/api/users', verifyToken, requirePermission('users.view'), async (req, res) => {
    try {
        const search = (req.query.search || '').trim();
        const page = parseInt(req.query.page);
        const isPaginated = !isNaN(page) && page > 0;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        const buildRequest = () => {
            const request = pool.request();
            let whereClause = '';
            if (search) {
                whereClause = 'WHERE firstName LIKE @search OR lastName LIKE @search OR email LIKE @search';
                request.input('search', sql.NVarChar, `%${search}%`);
            }
            return { request, whereClause };
        };

        if (!isPaginated) {
            const { request, whereClause } = buildRequest();
            const result = await request.query(`
                SELECT id, firstName, lastName, email, role, createdAt FROM Users ${whereClause} ORDER BY id DESC
            `);
            return res.json(result.recordset);
        }

        const { request: countRequest, whereClause: countWhere } = buildRequest();
        const countResult = await countRequest.query(`SELECT COUNT(*) as total FROM Users ${countWhere}`);
        const total = countResult.recordset[0].total;

        const { request: dataRequest, whereClause: dataWhere } = buildRequest();
        dataRequest.input('offset', sql.Int, (page - 1) * limit);
        dataRequest.input('limit', sql.Int, limit);
        const result = await dataRequest.query(`
            SELECT id, firstName, lastName, email, role, createdAt FROM Users ${dataWhere}
            ORDER BY id DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        res.json({
            data: result.recordset,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
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

        const targetUser = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT email, role FROM Users WHERE id = @id');

        await pool.request()
            .input('id', sql.Int, id)
            .input('role', sql.NVarChar, role)
            .query('UPDATE Users SET role = @role WHERE id = @id');

        await logAudit(req, 'user.roleChange', 'User', id, {
            email: targetUser.recordset[0]?.email,
            previousRole: targetUser.recordset[0]?.role,
            newRole: role
        });

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
    if (stripe) {
        return res.status(400).json({ message: "Bu üsul artıq deaktivdir. Real ödəniş sistemi (Stripe) istifadə olunur." });
    }

    const userId = req.user.id;
    const amount = parseFloat(req.body.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
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
            .input('description', sql.NVarChar(255), 'Balans artırılması (demo)')
            .query(`
                INSERT INTO transactions (user_id, amount, type, description)
                VALUES (@userId, @amount, @type, @description)
            `);

        res.json({ message: "Balans uğurla artırıldı!" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Ödəniş Sisteminin Konfiqurasiya Vəziyyəti (frontend hansı axını göstərəcəyini bunun əsasında seçir)
app.get('/api/finance/payment-config', verifyToken, (req, res) => {
    res.json({ stripeEnabled: Boolean(stripe) });
});

// 4. Stripe Checkout Sessiyası Yarat (real kart ödənişi)
app.post('/api/finance/create-checkout-session', verifyToken, async (req, res) => {
    if (!stripe) {
        return res.status(400).json({ message: "Ödəniş sistemi konfiqurasiya edilməyib." });
    }

    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Düzgün məbləğ daxil edin" });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            client_reference_id: String(req.user.id),
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'CargoMS Balans Artırılması' },
                    unit_amount: Math.round(amount * 100)
                },
                quantity: 1
            }],
            success_url: `${process.env.FRONTEND_URL}?payment=success`,
            cancel_url: `${process.env.FRONTEND_URL}?payment=cancelled`
        });

        res.json({ url: session.url });
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

    if (new Date(from) > new Date(to)) {
        return res.status(400).json({ message: "Başlanğıc tarix son tarixdən sonra ola bilməz" });
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

        await logAudit(req, 'role.create', 'Role', roleId, { name: name.trim(), permissionKeys });

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

        await logAudit(req, 'role.update', 'Role', id, { name: name.trim(), permissionKeys });

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
        await logAudit(req, 'role.delete', 'Role', id, { name: role.name });
        res.json({ message: "Rol uğurla silindi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🏭 ANBARLAR (WAREHOUSES)
// ==========================================

// 1. Bütün aktiv anbarların siyahısı (hər daxil olmuş istifadəçi görə bilər)
app.get('/api/warehouses', verifyToken, async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT * FROM Warehouses WHERE isActive = 1 ORDER BY id
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Yeni Anbar Yarat
app.post('/api/warehouses', verifyToken, requirePermission('warehouses.manage'), async (req, res) => {
    const { name, country, flag, addressLine1, addressLine2, city, postalCode, phone, ratePerKg } = req.body;

    if (!name || !name.trim() || !country || !country.trim() || !addressLine1 || !addressLine1.trim()) {
        return res.status(400).json({ message: "Anbar adı, ölkə və ünvan qeyd edilməlidir!" });
    }
    const rate = parseFloat(ratePerKg);
    if (isNaN(rate) || rate < 0) {
        return res.status(400).json({ message: "Kq başına tarif düzgün, mənfi olmayan rəqəm olmalıdır!" });
    }

    try {
        const insertResult = await pool.request()
            .input('name', sql.NVarChar, name.trim())
            .input('country', sql.NVarChar, country.trim())
            .input('flag', sql.NVarChar, flag || null)
            .input('addressLine1', sql.NVarChar, addressLine1.trim())
            .input('addressLine2', sql.NVarChar, addressLine2 || null)
            .input('city', sql.NVarChar, city || null)
            .input('postalCode', sql.NVarChar, postalCode || null)
            .input('phone', sql.NVarChar, phone || null)
            .input('ratePerKg', sql.Decimal(10, 2), rate)
            .query(`
                INSERT INTO Warehouses (name, country, flag, addressLine1, addressLine2, city, postalCode, phone, ratePerKg, isActive)
                OUTPUT INSERTED.id
                VALUES (@name, @country, @flag, @addressLine1, @addressLine2, @city, @postalCode, @phone, @ratePerKg, 1)
            `);
        await logAudit(req, 'warehouse.create', 'Warehouse', insertResult.recordset[0].id, { name: name.trim(), ratePerKg: rate });
        res.status(201).json({ message: "Anbar uğurla yaradıldı!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Anbarı Yenilə
app.put('/api/warehouses/:id', verifyToken, requirePermission('warehouses.manage'), async (req, res) => {
    const { id } = req.params;
    const { name, country, flag, addressLine1, addressLine2, city, postalCode, phone, ratePerKg, isActive } = req.body;

    if (!name || !name.trim() || !country || !country.trim() || !addressLine1 || !addressLine1.trim()) {
        return res.status(400).json({ message: "Anbar adı, ölkə və ünvan qeyd edilməlidir!" });
    }
    const rate = parseFloat(ratePerKg);
    if (isNaN(rate) || rate < 0) {
        return res.status(400).json({ message: "Kq başına tarif düzgün, mənfi olmayan rəqəm olmalıdır!" });
    }

    try {
        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name.trim())
            .input('country', sql.NVarChar, country.trim())
            .input('flag', sql.NVarChar, flag || null)
            .input('addressLine1', sql.NVarChar, addressLine1.trim())
            .input('addressLine2', sql.NVarChar, addressLine2 || null)
            .input('city', sql.NVarChar, city || null)
            .input('postalCode', sql.NVarChar, postalCode || null)
            .input('phone', sql.NVarChar, phone || null)
            .input('ratePerKg', sql.Decimal(10, 2), rate)
            .input('isActive', sql.Bit, isActive === false ? 0 : 1)
            .query(`
                UPDATE Warehouses SET
                    name = @name, country = @country, flag = @flag,
                    addressLine1 = @addressLine1, addressLine2 = @addressLine2,
                    city = @city, postalCode = @postalCode, phone = @phone,
                    ratePerKg = @ratePerKg, isActive = @isActive
                WHERE id = @id
            `);
        await logAudit(req, 'warehouse.update', 'Warehouse', id, { name: name.trim(), ratePerKg: rate, isActive: isActive !== false });
        res.json({ message: "Anbar uğurla yeniləndi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Anbarı Sil
app.delete('/api/warehouses/:id', verifyToken, requirePermission('warehouses.manage'), async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await pool.request().input('id', sql.Int, id).query('SELECT name FROM Warehouses WHERE id = @id');
        await pool.request().input('id', sql.Int, id).query('DELETE FROM Warehouses WHERE id = @id');
        await logAudit(req, 'warehouse.delete', 'Warehouse', id, { name: existing.recordset[0]?.name });
        res.json({ message: "Anbar uğurla silindi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 📋 AUDIT LOG (Admin əməliyyatlarının qeydiyyatı)
// ==========================================

app.get('/api/audit-log', verifyToken, requirePermission('audit.view'), async (req, res) => {
    try {
        const actionFilter = req.query.action;
        const targetTypeFilter = req.query.targetType;

        let query = `
            SELECT TOP 200 a.id, a.userId, a.userRole, a.action, a.targetType, a.targetId, a.details, a.createdAt,
                   u.firstName, u.lastName, u.email
            FROM AuditLog a
            LEFT JOIN Users u ON u.id = a.userId
            WHERE 1 = 1
        `;
        const request = pool.request();

        if (actionFilter) {
            query += ' AND a.action = @action';
            request.input('action', sql.NVarChar, actionFilter);
        }
        if (targetTypeFilter) {
            query += ' AND a.targetType = @targetType';
            request.input('targetType', sql.NVarChar, targetTypeFilter);
        }
        query += ' ORDER BY a.createdAt DESC';

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🔔 BİLDİRİŞ MƏRKƏZİ (NOTIFICATIONS)
// ==========================================

// 1. Cari istifadəçinin bildirişləri
app.get('/api/notifications', verifyToken, async (req, res) => {
    try {
        const result = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query(`
                SELECT TOP 50 id, title, message, type, isRead, createdAt
                FROM Notifications
                WHERE userId = @userId
                ORDER BY createdAt DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Oxunmamış bildiriş sayı (bell badge üçün)
app.get('/api/notifications/unread-count', verifyToken, async (req, res) => {
    try {
        const result = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query('SELECT COUNT(*) as count FROM Notifications WHERE userId = @userId AND isRead = 0');
        res.json({ count: result.recordset[0].count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Tək bildirişi oxunmuş kimi işarələ
app.put('/api/notifications/:id/read', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, req.user.id)
            .query('UPDATE Notifications SET isRead = 1 WHERE id = @id AND userId = @userId');
        res.json({ message: "Bildiriş oxunmuş kimi işarələndi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Bütün bildirişləri oxunmuş kimi işarələ
app.put('/api/notifications/read-all', verifyToken, async (req, res) => {
    try {
        await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query('UPDATE Notifications SET isRead = 1 WHERE userId = @userId AND isRead = 0');
        res.json({ message: "Bütün bildirişlər oxunmuş kimi işarələndi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🎫 DƏSTƏK TİKETLƏRİ (SUPPORT TICKETS)
// ==========================================

// 1. Yeni tiket yarat (ilk mesajla birlikdə)
app.post('/api/support/tickets', verifyToken, async (req, res) => {
    const { subject, message } = req.body;

    if (!subject || !subject.trim() || !message || !message.trim()) {
        return res.status(400).json({ message: "Mövzu və mesaj qeyd edilməlidir!" });
    }

    try {
        const insertResult = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .input('subject', sql.NVarChar, subject.trim())
            .query(`
                INSERT INTO SupportTickets (userId, subject, status)
                OUTPUT INSERTED.id
                VALUES (@userId, @subject, N'Açıq')
            `);
        const ticketId = insertResult.recordset[0].id;

        await pool.request()
            .input('ticketId', sql.Int, ticketId)
            .input('senderId', sql.Int, req.user.id)
            .input('message', sql.NVarChar, message.trim())
            .query('INSERT INTO SupportTicketMessages (ticketId, senderId, message) VALUES (@ticketId, @senderId, @message)');

        res.status(201).json({ message: "Tiket yaradıldı", ticketId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Tiketlərin siyahısı (icazəyə görə hamısı və ya yalnız öz tiketləri)
app.get('/api/support/tickets', verifyToken, async (req, res) => {
    try {
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canViewAll = isSuperAdmin || permissions.includes('support.viewAll');

        let query = `
            SELECT t.id, t.subject, t.status, t.createdAt, t.updatedAt,
                   u.firstName, u.lastName, u.email,
                   (SELECT COUNT(*) FROM SupportTicketMessages m WHERE m.ticketId = t.id) as messageCount
            FROM SupportTickets t
            JOIN Users u ON u.id = t.userId
        `;
        const request = pool.request();
        if (!canViewAll) {
            query += ' WHERE t.userId = @userId';
            request.input('userId', sql.Int, req.user.id);
        }
        query += ' ORDER BY t.updatedAt DESC';

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Tiket detalı (mesaj tarixçəsi ilə)
app.get('/api/support/tickets/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canViewAll = isSuperAdmin || permissions.includes('support.viewAll');

        const ticketResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT t.id, t.subject, t.status, t.userId, t.createdAt, t.updatedAt, u.firstName, u.lastName, u.email
                FROM SupportTickets t JOIN Users u ON u.id = t.userId
                WHERE t.id = @id
            `);

        if (ticketResult.recordset.length === 0) {
            return res.status(404).json({ message: "Tiket tapılmadı" });
        }
        const ticket = ticketResult.recordset[0];
        if (!canViewAll && ticket.userId !== req.user.id) {
            return res.status(403).json({ message: "Bu tiketə baxmaq icazəniz yoxdur" });
        }

        const messagesResult = await pool.request()
            .input('ticketId', sql.Int, id)
            .query(`
                SELECT m.id, m.message, m.createdAt, m.senderId, u.firstName, u.lastName, u.role
                FROM SupportTicketMessages m JOIN Users u ON u.id = m.senderId
                WHERE m.ticketId = @ticketId
                ORDER BY m.createdAt ASC
            `);

        res.json({ ticket, messages: messagesResult.recordset });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Tiketə cavab yaz
app.post('/api/support/tickets/:id/messages', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ message: "Mesaj boş ola bilməz!" });
    }

    try {
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canViewAll = isSuperAdmin || permissions.includes('support.viewAll');

        const ticketResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT userId, status, subject FROM SupportTickets WHERE id = @id');

        if (ticketResult.recordset.length === 0) {
            return res.status(404).json({ message: "Tiket tapılmadı" });
        }
        const ticket = ticketResult.recordset[0];
        if (!canViewAll && ticket.userId !== req.user.id) {
            return res.status(403).json({ message: "Bu tiketə cavab yazmaq icazəniz yoxdur" });
        }

        await pool.request()
            .input('ticketId', sql.Int, id)
            .input('senderId', sql.Int, req.user.id)
            .input('message', sql.NVarChar, message.trim())
            .query('INSERT INTO SupportTicketMessages (ticketId, senderId, message) VALUES (@ticketId, @senderId, @message)');

        const isStaffReply = canViewAll && req.user.id !== ticket.userId;
        const newStatus = isStaffReply && ticket.status === 'Açıq' ? 'İşlənir' : ticket.status;

        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, newStatus)
            .query('UPDATE SupportTickets SET updatedAt = GETDATE(), status = @status WHERE id = @id');

        if (isStaffReply) {
            await createInAppNotification(
                ticket.userId,
                'Dəstək tiketinizə cavab verildi',
                `"${ticket.subject}" mövzulu tiketinizə yeni cavab var.`,
                'support_reply'
            );
        }

        res.status(201).json({ message: "Cavab göndərildi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Tiket statusunu dəyiş (yalnız dəstək icazəsi olanlar)
app.put('/api/support/tickets/:id/status', verifyToken, requirePermission('support.viewAll'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['Açıq', 'İşlənir', 'Bağlı'];

    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Düzgün status seçin" });
    }

    try {
        const ticketResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT userId, subject FROM SupportTickets WHERE id = @id');

        if (ticketResult.recordset.length === 0) {
            return res.status(404).json({ message: "Tiket tapılmadı" });
        }
        const ticket = ticketResult.recordset[0];

        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query('UPDATE SupportTickets SET status = @status, updatedAt = GETDATE() WHERE id = @id');

        await createInAppNotification(
            ticket.userId,
            'Dəstək tiketinizin statusu dəyişdi',
            `"${ticket.subject}" mövzulu tiketinizin yeni statusu: ${status}`,
            'support_status'
        );

        res.json({ message: "Tiket statusu yeniləndi" });
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