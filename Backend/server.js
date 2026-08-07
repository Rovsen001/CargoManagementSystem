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
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// Anbar qəbulu şəkillərinin yüklənməsi üçün (yerli fayl sistemi, xarici bulud xidməti tələb olunmur)
const uploadsDir = path.join(__dirname, 'uploads', 'receiving');
fs.mkdirSync(uploadsDir, { recursive: true });
const receivingUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Yalnız şəkil faylları qəbul edilir'));
        }
        cb(null, true);
    }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Zədə/itki iddiaları üçün sübut şəkillərinin yüklənməsi
const claimsUploadsDir = path.join(__dirname, 'uploads', 'claims');
fs.mkdirSync(claimsUploadsDir, { recursive: true });
const claimUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, claimsUploadsDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Yalnız şəkil faylları qəbul edilir'));
        }
        cb(null, true);
    }
});

// Naməlum bağlamalar (Exception Resolver) üçün şəkillərin yüklənməsi
const unidentifiedUploadsDir = path.join(__dirname, 'uploads', 'unidentified');
fs.mkdirSync(unidentifiedUploadsDir, { recursive: true });
const unidentifiedUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, unidentifiedUploadsDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Yalnız şəkil faylları qəbul edilir'));
        }
        cb(null, true);
    }
});

// Təhvil sübutu (imza/foto) üçün şəkillərin yüklənməsi
const deliveryProofUploadsDir = path.join(__dirname, 'uploads', 'delivery-proof');
fs.mkdirSync(deliveryProofUploadsDir, { recursive: true });
const deliveryProofUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, deliveryProofUploadsDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Yalnız şəkil faylları qəbul edilir'));
        }
        cb(null, true);
    }
});

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

function computeStorageFee(pkg, settings) {
    if (!pkg.arrivedAtBranchAt) {
        return { overdueDays: 0, totalAccrued: 0, outstanding: 0 };
    }
    const start = new Date(pkg.arrivedAtBranchAt);
    const end = pkg.deliveredAt ? new Date(pkg.deliveredAt) : new Date();
    const daysAtWarehouse = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
    const overdueDays = Math.max(0, daysAtWarehouse - settings.freeDays);
    const totalAccrued = Math.round(overdueDays * settings.dailyRate * 100) / 100;
    const storageFeePaid = parseFloat(pkg.storageFeePaid) || 0;
    const outstanding = Math.max(0, Math.round((totalAccrued - storageFeePaid) * 100) / 100);
    return { overdueDays, totalAccrued, outstanding };
}

function computeCustomsDuty(pkg, rates, settings) {
    const customsValue = pkg.declaredValue != null ? parseFloat(pkg.declaredValue) : (parseFloat(pkg.price) || 0);
    const deMinimisThreshold = parseFloat(settings.deMinimisThreshold);

    if (customsValue <= deMinimisThreshold) {
        return { customsValue, dutyRatePercent: 0, matchedCategory: null, totalDuty: 0, outstanding: 0 };
    }

    const hsDigits = (pkg.hsCode || '').replace(/\D/g, '');
    let matched = null;
    if (hsDigits) {
        const sortedRates = [...rates].sort((a, b) => b.hsCodePrefix.length - a.hsCodePrefix.length);
        matched = sortedRates.find(r => hsDigits.startsWith(r.hsCodePrefix.replace(/\D/g, ''))) || null;
    }

    const dutyRatePercent = matched ? parseFloat(matched.dutyRatePercent) : parseFloat(settings.defaultDutyRatePercent);
    const totalDuty = Math.round(customsValue * dutyRatePercent / 100 * 100) / 100;
    const customsDutyPaid = parseFloat(pkg.customsDutyPaid) || 0;
    const outstanding = Math.max(0, Math.round((totalDuty - customsDutyPaid) * 100) / 100);

    return { customsValue, dutyRatePercent, matchedCategory: matched ? matched.category : 'Standart (defolt) tarif', totalDuty, outstanding };
}

// Bağlamanın status state machine-i: hər status yalnız BİR növbəti statusa keçə bilər (ardıcıl, atlamasız)
const PACKAGE_STATUS_TRANSITIONS = {
    'Bəyan edildi': ['Yoldadır'],
    'Yoldadır': ['Gömrükdə'],
    'Gömrükdə': ['Filialda'],
    'Filialda': ['Təhvil verildi'],
    'Təhvil verildi': [],
    'Konsolidasiya edildi': []
};

// Həcmi çəki = (Uzunluq × En × Hündürlük) / 6000 (sənayedə standart avia-yük əmsalı, sm-lə ölçü)
function computeVolumetricWeight(length, width, height) {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    if (l <= 0 || w <= 0 || h <= 0) return null;
    return Math.round((l * w * h / 6000) * 100) / 100;
}

function validateStatusTransition(currentStatus, newStatus, { isSuperAdmin, weightConfirmed }) {
    if (currentStatus === newStatus) return { valid: true };
    if (isSuperAdmin) return { valid: true };

    const allowedNext = PACKAGE_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
        const nextLabel = allowedNext.length > 0 ? allowedNext.join(', ') : 'yoxdur (bu son mərhələdir)';
        return {
            valid: false,
            message: `Status ardıcıllığı pozulur: "${currentStatus}" statusundan yalnız bu statusa keçid mümkündür: ${nextLabel}`
        };
    }

    if (currentStatus === 'Bəyan edildi' && newStatus === 'Yoldadır' && !weightConfirmed) {
        return {
            valid: false,
            message: `"Yoldadır" statusuna keçməzdən əvvəl bağlamanın anbarda çəkisi təsdiqlənməlidir.`
        };
    }

    return { valid: true };
}

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

// 1.2.2 Anbarda Bağlamanın Real Çəkisini Təsdiqləmək (müştərinin bəyanını əvəz edir)
app.put('/api/packages/:id/confirm-receiving', verifyToken, requirePermission('packages.editAll'), receivingUpload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const actualWeight = parseFloat(req.body.actualWeight);
    const length = req.body.length !== undefined && req.body.length !== '' ? parseFloat(req.body.length) : null;
    const width = req.body.width !== undefined && req.body.width !== '' ? parseFloat(req.body.width) : null;
    const height = req.body.height !== undefined && req.body.height !== '' ? parseFloat(req.body.height) : null;
    const volumetricWeight = computeVolumetricWeight(length, width, height);

    if (isNaN(actualWeight) || actualWeight <= 0) {
        return res.status(400).json({ message: "Real çəki müsbət rəqəm olmalıdır!" });
    }

    try {
        const existing = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT trackingNumber, weight, warehouseId, userId FROM Packages WHERE id = @id');

        if (existing.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = existing.recordset[0];
        const previousWeight = parseFloat(pkg.weight);

        const warehouseResult = await pool.request()
            .input('warehouseId', sql.Int, pkg.warehouseId)
            .query('SELECT ratePerKg FROM Warehouses WHERE id = @warehouseId');
        const ratePerKg = warehouseResult.recordset[0]?.ratePerKg || 0;
        const newPrice = Math.round(actualWeight * ratePerKg * 100) / 100;

        const photoUrl = req.file ? `/uploads/receiving/${req.file.filename}` : null;

        const request = pool.request()
            .input('id', sql.Int, id)
            .input('weight', sql.Decimal(10, 2), actualWeight)
            .input('price', sql.Decimal(10, 2), newPrice)
            .input('confirmedBy', sql.Int, req.user.id)
            .input('length', sql.Decimal(10, 2), length)
            .input('width', sql.Decimal(10, 2), width)
            .input('height', sql.Decimal(10, 2), height)
            .input('volumetricWeight', sql.Decimal(10, 2), volumetricWeight);

        let query = `
            UPDATE Packages SET
                weight = @weight,
                price = @price,
                weightConfirmed = 1,
                weightConfirmedBy = @confirmedBy,
                weightConfirmedAt = GETDATE(),
                [length] = @length,
                width = @width,
                height = @height,
                volumetricWeight = @volumetricWeight
        `;
        if (photoUrl) {
            query += ', receivingPhotoUrl = @photoUrl';
            request.input('photoUrl', sql.NVarChar, photoUrl);
        }
        query += ' WHERE id = @id';

        await request.query(query);

        if (Math.abs(previousWeight - actualWeight) > 0.01) {
            await createInAppNotification(
                pkg.userId,
                'Bağlamanızın çəkisi anbarda təsdiqləndi',
                `${pkg.trackingNumber}: bəyan etdiyiniz ${previousWeight.toFixed(2)} kq əvəzinə anbarda ölçülən real çəki ${actualWeight.toFixed(2)} kq təsdiqləndi. Yeni qiymət: $${newPrice.toFixed(2)}.`,
                'weight_confirmed'
            );
        }

        await logAudit(req, 'package.confirmReceiving', 'Package', id, {
            trackingNumber: pkg.trackingNumber, previousWeight, actualWeight, newPrice, hasPhoto: Boolean(photoUrl)
        });

        res.json({ message: "Anbar qəbulu təsdiqləndi", weight: actualWeight, price: newPrice, photoUrl });
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
            .query('SELECT status, assignedCourierId, userId, trackingNumber, weightConfirmed FROM Packages WHERE id = @id');

        if (existing.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        if (existing.recordset[0].assignedCourierId !== req.user.id) {
            return res.status(403).json({ message: "Bu bağlama sizə təyin edilməyib" });
        }

        const previousStatus = existing.recordset[0].status;
        const ownerId = existing.recordset[0].userId;
        const trackingNumber = existing.recordset[0].trackingNumber;

        const { isSuperAdmin: isCourierSuperAdmin } = await getRoleInfo(req.user.role);
        const transitionCheck = validateStatusTransition(previousStatus, status, {
            isSuperAdmin: isCourierSuperAdmin,
            weightConfirmed: existing.recordset[0].weightConfirmed
        });
        if (!transitionCheck.valid) {
            return res.status(400).json({ message: transitionCheck.message });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query(`
                UPDATE Packages SET status = @status,
                    arrivedAtBranchAt = CASE WHEN @status = N'Filialda' AND arrivedAtBranchAt IS NULL THEN GETDATE() ELSE arrivedAtBranchAt END,
                    deliveredAt = CASE WHEN @status = N'Təhvil verildi' AND deliveredAt IS NULL THEN GETDATE() ELSE deliveredAt END
                WHERE id = @id
            `);

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
        const prohibitedMatch = await checkProhibitedContent(itemDescription);
        if (prohibitedMatch) {
            return res.status(400).json({
                message: `Bu bağlama qadağan olunmuş məzmuna görə bəyan edilə bilməz: "${prohibitedMatch.term}" (${prohibitedMatch.category}). Zəhmət olmasa mal təsvirini yoxlayın.`
            });
        }

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
        const prohibitedMatch = await checkProhibitedContent(itemDescription);
        if (prohibitedMatch) {
            return res.status(400).json({
                message: `Bu bağlama qadağan olunmuş məzmuna görə yenilənə bilməz: "${prohibitedMatch.term}" (${prohibitedMatch.category}). Zəhmət olmasa mal təsvirini yoxlayın.`
            });
        }

        const existing = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT status, warehouseId, price as previousPrice, userId as ownerId, weightConfirmed FROM Packages WHERE id = @id');
        if (existing.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const previousStatus = existing.recordset[0].status;
        const warehouseId = existing.recordset[0].warehouseId;
        const previousPrice = existing.recordset[0].previousPrice;
        const ownerId = existing.recordset[0].ownerId;

        const transitionCheck = validateStatusTransition(previousStatus, status, {
            isSuperAdmin,
            weightConfirmed: existing.recordset[0].weightConfirmed
        });
        if (!transitionCheck.valid) {
            return res.status(400).json({ message: transitionCheck.message });
        }

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

        let query = `UPDATE Packages SET trackingNumber = @trackingNumber, weight = @weight, price = @price, status = @status, isInsured = @isInsured, declaredValue = @declaredValue, insuranceFee = @insuranceFee, hsCode = @hsCode, itemDescription = @itemDescription, countryOfOrigin = @countryOfOrigin,
            arrivedAtBranchAt = CASE WHEN @status = N'Filialda' AND arrivedAtBranchAt IS NULL THEN GETDATE() ELSE arrivedAtBranchAt END,
            deliveredAt = CASE WHEN @status = N'Təhvil verildi' AND deliveredAt IS NULL THEN GETDATE() ELSE deliveredAt END
            WHERE id = @id`;
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
// 🚫 QADAĞAN OLUNMUŞ MALLAR (PROHIBITED GOODS SCREENING)
// ==========================================

// Mal təsvirini qadağan olunmuş açar sözlərlə yoxlayır. Uyğunluq taparsa {term, category} qaytarır, əks halda null.
async function checkProhibitedContent(text) {
    if (!text || !text.trim()) return null;
    try {
        const result = await pool.request().query('SELECT term, category FROM ProhibitedTerms');
        const lowerText = text.toLowerCase();
        const match = result.recordset.find((row) => lowerText.includes(row.term.toLowerCase()));
        return match || null;
    } catch (err) {
        console.error('Qadağan olunmuş mallar yoxlanılarkən xəta:', err.message);
        return null;
    }
}

// 1. Siyahını gətir (Super Admin idarəetmə paneli üçün)
app.get('/api/prohibited-terms', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const result = await pool.request().query('SELECT id, term, category, createdAt FROM ProhibitedTerms ORDER BY category, term');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Yeni açar söz əlavə et
app.post('/api/prohibited-terms', verifyToken, requireSuperAdmin, async (req, res) => {
    const { term, category } = req.body;
    if (!term || !term.trim() || !category || !category.trim()) {
        return res.status(400).json({ message: "Açar söz və kateqoriya qeyd edilməlidir!" });
    }

    try {
        await pool.request()
            .input('term', sql.NVarChar, term.trim())
            .input('category', sql.NVarChar, category.trim())
            .input('createdBy', sql.Int, req.user.id)
            .query('INSERT INTO ProhibitedTerms (term, category, createdBy) VALUES (@term, @category, @createdBy)');

        await logAudit(req, 'prohibitedTerm.create', 'ProhibitedTerm', null, { term: term.trim(), category: category.trim() });

        res.status(201).json({ message: "Açar söz əlavə edildi!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Açar sözü sil
app.delete('/api/prohibited-terms/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await pool.request().input('id', sql.Int, id).query('SELECT term FROM ProhibitedTerms WHERE id = @id');
        await pool.request().input('id', sql.Int, id).query('DELETE FROM ProhibitedTerms WHERE id = @id');
        await logAudit(req, 'prohibitedTerm.delete', 'ProhibitedTerm', id, { term: existing.recordset[0]?.term });
        res.json({ message: "Açar söz silindi!" });
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
// 🤖 AI DƏSTƏK KÖMƏKÇİSİ (AI SUPPORT CHATBOT)
// ==========================================

const AI_LANGUAGE_NAMES = { az: 'Azərbaycan', en: 'English', ru: 'Русский' };

function buildAiSystemPrompt(lang) {
    const languageName = AI_LANGUAGE_NAMES[lang] || AI_LANGUAGE_NAMES.az;
    return `Sən CargoMS adlı beynəlxalq kargo və logistika şirkətinin müştəri dəstək süni intellekt köməkçisisən. CargoMS Türkiyə, ABŞ və Avropadan müştərilərin onlayn aldığı bağlamaları Azərbaycana çatdırır (xarici anbar → gömrük → yerli filial/HUB → kuryer və ya filialdan təhvil).

Sənin vəzifən: müştərilərə göndərmə prosesi, tariflər, gömrük qaydaları, qadağan olunmuş mallar, bağlama izləmə, sığorta və platformanın necə işlədiyi haqqında ümumi suallara cavab vermək.

Vacib qaydalar:
- Sən müştərinin real bağlama, balans və ya sifariş məlumatlarına birbaşa çıxışın yoxdur — bu cür konkret sorğular üçün (məsələn "mənim bağlamam haradadır?") istifadəçini "Bağlamalarım" səhifəsindən izləməyə və ya lazım gələrsə real dəstək tiketinə yönləndirməyə səy göstər.
- Heç vaxt uydurma qiymət, tarix və ya statuslar vermə.
- Cavabların qısa, aydın və dostcasına olsun.
- Əgər sual sənin bilik və ya səlahiyyət çərçivəndən kənardadırsa (məsələn hesabla bağlı konkret əməliyyat, şikayət, geri ödəmə), istifadəçiyə söhbəti real dəstək əməkdaşına yönləndirməyi təklif et.
- Cavabını mütləq ${languageName} dilində ver.`;
}

app.get('/api/support/ai-chat', verifyToken, async (req, res) => {
    try {
        const result = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query('SELECT id, role, message, createdAt FROM AiChatMessages WHERE userId = @userId ORDER BY createdAt ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/support/ai-chat', verifyToken, async (req, res) => {
    const { message, lang } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ message: "Mesaj boş ola bilməz!" });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({
            message: "AI dəstək sistemi hazırda aktiv deyil. Zəhmət olmasa adi dəstək tiketi açın.",
            aiUnavailable: true
        });
    }

    try {
        await pool.request()
            .input('userId', sql.Int, req.user.id)
            .input('role', sql.NVarChar, 'user')
            .input('message', sql.NVarChar, message.trim())
            .query('INSERT INTO AiChatMessages (userId, role, message) VALUES (@userId, @role, @message)');

        const historyResult = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query('SELECT TOP 20 role, message FROM AiChatMessages WHERE userId = @userId ORDER BY createdAt DESC');
        const history = historyResult.recordset.reverse().map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.message
        }));

        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
                max_tokens: 1024,
                system: buildAiSystemPrompt(lang),
                messages: history
            })
        });

        if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            console.error('Anthropic API xətası:', aiResponse.status, errText);
            return res.status(502).json({ message: "AI cavabı alınarkən xəta baş verdi." });
        }

        const data = await aiResponse.json();
        const replyText = (data.content && data.content[0] && data.content[0].text) || "Üzr istəyirəm, cavab yarada bilmədim.";

        await pool.request()
            .input('userId', sql.Int, req.user.id)
            .input('role', sql.NVarChar, 'assistant')
            .input('message', sql.NVarChar, replyText)
            .query('INSERT INTO AiChatMessages (userId, role, message) VALUES (@userId, @role, @message)');

        res.json({ reply: replyText });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/support/ai-chat', verifyToken, async (req, res) => {
    try {
        await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query('DELETE FROM AiChatMessages WHERE userId = @userId');
        res.json({ message: "Söhbət təmizləndi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/support/ai-chat/escalate', verifyToken, async (req, res) => {
    try {
        const historyResult = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query('SELECT role, message, createdAt FROM AiChatMessages WHERE userId = @userId ORDER BY createdAt ASC');

        if (historyResult.recordset.length === 0) {
            return res.status(400).json({ message: "Yönləndiriləcək söhbət tapılmadı." });
        }

        const transcript = historyResult.recordset
            .map((m) => `${m.role === 'assistant' ? 'AI Köməkçi' : 'Müştəri'}: ${m.message}`)
            .join('\n\n');

        const subject = req.body.subject && req.body.subject.trim()
            ? req.body.subject.trim()
            : 'AI Söhbətindən Yönləndirilmiş Müraciət';

        const insertResult = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .input('subject', sql.NVarChar, subject)
            .query(`
                INSERT INTO SupportTickets (userId, subject, status)
                OUTPUT INSERTED.id
                VALUES (@userId, @subject, N'Açıq')
            `);
        const ticketId = insertResult.recordset[0].id;

        await pool.request()
            .input('ticketId', sql.Int, ticketId)
            .input('senderId', sql.Int, req.user.id)
            .input('message', sql.NVarChar, `[AI söhbətindən köçürülüb]\n\n${transcript}`)
            .query('INSERT INTO SupportTicketMessages (ticketId, senderId, message) VALUES (@ticketId, @senderId, @message)');

        res.status(201).json({ message: "Söhbət dəstək tiketinə yönləndirildi", ticketId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🛡️ ZƏDƏ/İTKİ İDDİALARI (CLAIMS)
// ==========================================

// 1. Yeni iddia yarat
app.post('/api/claims', verifyToken, claimUpload.single('photo'), async (req, res) => {
    const { packageId, type, description, requestedAmount } = req.body;
    const allowedTypes = ['Zədə', 'İtki'];

    if (!packageId || isNaN(parseInt(packageId))) {
        return res.status(400).json({ message: "Bağlama seçilməlidir!" });
    }
    if (!type || !allowedTypes.includes(type)) {
        return res.status(400).json({ message: "İddia növü düzgün seçilməlidir!" });
    }
    if (!description || !description.trim()) {
        return res.status(400).json({ message: "Təsvir qeyd edilməlidir!" });
    }

    try {
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canEditAll = isSuperAdmin || permissions.includes('packages.editAll');

        const pkgResult = await pool.request()
            .input('id', sql.Int, packageId)
            .query('SELECT id, userId, trackingNumber FROM Packages WHERE id = @id');

        if (pkgResult.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = pkgResult.recordset[0];
        if (!canEditAll && pkg.userId !== req.user.id) {
            return res.status(403).json({ message: "Bu bağlama üçün iddia təqdim etmək icazəniz yoxdur" });
        }

        const parsedAmount = parseFloat(requestedAmount);
        const photoUrl = req.file ? `/uploads/claims/${req.file.filename}` : null;

        const insertResult = await pool.request()
            .input('packageId', sql.Int, packageId)
            .input('userId', sql.Int, pkg.userId)
            .input('type', sql.NVarChar, type)
            .input('description', sql.NVarChar, description.trim())
            .input('requestedAmount', sql.Decimal(10, 2), isNaN(parsedAmount) ? null : parsedAmount)
            .input('photoUrl', sql.NVarChar, photoUrl)
            .query(`
                INSERT INTO Claims (packageId, userId, type, description, status, requestedAmount, photoUrl)
                OUTPUT INSERTED.id
                VALUES (@packageId, @userId, @type, @description, N'Açıq', @requestedAmount, @photoUrl)
            `);

        const claimId = insertResult.recordset[0].id;
        await logAudit(req, 'claim.create', 'Claim', claimId, { packageId, trackingNumber: pkg.trackingNumber, type });

        res.status(201).json({ message: "İddia təqdim edildi", claimId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. İddiaların siyahısı (icazəyə görə hamısı və ya yalnız öz iddiaları)
app.get('/api/claims', verifyToken, async (req, res) => {
    try {
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canEditAll = isSuperAdmin || permissions.includes('packages.editAll');

        let query = `
            SELECT c.id, c.type, c.description, c.status, c.requestedAmount, c.resolvedAmount, c.photoUrl, c.createdAt, c.resolvedAt,
                   p.trackingNumber, u.firstName, u.lastName, u.email
            FROM Claims c
            JOIN Packages p ON p.id = c.packageId
            JOIN Users u ON u.id = c.userId
        `;
        const request = pool.request();
        if (!canEditAll) {
            query += ' WHERE c.userId = @userId';
            request.input('userId', sql.Int, req.user.id);
        }
        query += ' ORDER BY c.createdAt DESC';

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. İddia detalı
app.get('/api/claims/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canEditAll = isSuperAdmin || permissions.includes('packages.editAll');

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT c.*, p.trackingNumber, u.firstName, u.lastName, u.email
                FROM Claims c
                JOIN Packages p ON p.id = c.packageId
                JOIN Users u ON u.id = c.userId
                WHERE c.id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "İddia tapılmadı" });
        }
        const claim = result.recordset[0];
        if (!canEditAll && claim.userId !== req.user.id) {
            return res.status(403).json({ message: "Bu iddiaya baxmaq icazəniz yoxdur" });
        }

        res.json(claim);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. İddianı Nəzərdən Keçir / Həll Et (yalnız icazəsi olan işçilər)
app.put('/api/claims/:id/status', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const { id } = req.params;
    const { status, resolvedAmount, resolutionNote } = req.body;
    const allowedStatuses = ['Baxılır', 'Təsdiqləndi', 'Rədd edildi'];

    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Düzgün status seçin" });
    }

    const amount = parseFloat(resolvedAmount);
    if (status === 'Təsdiqləndi' && (isNaN(amount) || amount <= 0)) {
        return res.status(400).json({ message: "Təsdiqlənmiş məbləğ müsbət rəqəm olmalıdır!" });
    }

    try {
        const claimResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT c.userId, c.type, p.trackingNumber
                FROM Claims c JOIN Packages p ON p.id = c.packageId
                WHERE c.id = @id
            `);

        if (claimResult.recordset.length === 0) {
            return res.status(404).json({ message: "İddia tapılmadı" });
        }
        const claim = claimResult.recordset[0];

        const request = pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .input('resolutionNote', sql.NVarChar, resolutionNote || null);

        let query = 'UPDATE Claims SET status = @status, resolutionNote = @resolutionNote';
        if (status !== 'Baxılır') {
            query += ', resolvedAt = GETDATE(), resolvedBy = @resolvedBy';
            request.input('resolvedBy', sql.Int, req.user.id);
        }
        if (status === 'Təsdiqləndi') {
            query += ', resolvedAmount = @resolvedAmount';
            request.input('resolvedAmount', sql.Decimal(10, 2), amount);
        }
        query += ' WHERE id = @id';

        await request.query(query);

        if (status === 'Təsdiqləndi') {
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                await new sql.Request(transaction)
                    .input('amount', sql.Decimal(10, 2), amount)
                    .input('userId', sql.Int, claim.userId)
                    .query('UPDATE Users SET balance = ISNULL(balance, 0) + @amount WHERE id = @userId');

                await new sql.Request(transaction)
                    .input('userId', sql.Int, claim.userId)
                    .input('amount', sql.Decimal(10, 2), amount)
                    .input('type', sql.VarChar(10), 'inkam')
                    .input('description', sql.NVarChar(255), `İddia kompensasiyası (${claim.trackingNumber})`)
                    .query(`
                        INSERT INTO transactions (user_id, amount, type, description)
                        VALUES (@userId, @amount, @type, @description)
                    `);

                await transaction.commit();
            } catch (txErr) {
                await transaction.rollback();
                throw txErr;
            }
        }

        if (status !== 'Baxılır') {
            await createInAppNotification(
                claim.userId,
                status === 'Təsdiqləndi' ? 'İddianız təsdiqləndi' : 'İddianız rədd edildi',
                status === 'Təsdiqləndi'
                    ? `${claim.trackingNumber} bağlaması üzrə iddianız təsdiqləndi. $${amount.toFixed(2)} balansınıza əlavə edildi.`
                    : `${claim.trackingNumber} bağlaması üzrə iddianız rədd edildi.${resolutionNote ? ' Səbəb: ' + resolutionNote : ''}`,
                'claim_resolved'
            );
        }

        await logAudit(req, 'claim.resolve', 'Claim', id, { status, resolvedAmount: status === 'Təsdiqləndi' ? amount : null });

        res.json({ message: "İddia yeniləndi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 📦 ANBAR SAXLAMA HAQQI (STORAGE FEE)
// ==========================================

// 1. Tənzimləmələri gətir (istənilən daxil olmuş istifadəçi)
app.get('/api/storage-settings', verifyToken, async (req, res) => {
    try {
        const result = await pool.request().query('SELECT TOP 1 id, freeDays, dailyRate FROM StorageSettings ORDER BY id DESC');
        res.json(result.recordset[0] || { freeDays: 5, dailyRate: 1.00 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Tənzimləmələri yenilə (yalnız Super Admin)
app.put('/api/storage-settings', verifyToken, requireSuperAdmin, async (req, res) => {
    const freeDays = parseInt(req.body.freeDays);
    const dailyRate = parseFloat(req.body.dailyRate);

    if (isNaN(freeDays) || freeDays < 0) {
        return res.status(400).json({ message: "Pulsuz saxlama günləri düzgün, mənfi olmayan bir rəqəm olmalıdır!" });
    }
    if (isNaN(dailyRate) || dailyRate < 0) {
        return res.status(400).json({ message: "Günlük tarif düzgün, mənfi olmayan bir rəqəm olmalıdır!" });
    }

    try {
        const existing = await pool.request().query('SELECT TOP 1 id FROM StorageSettings ORDER BY id DESC');
        if (existing.recordset.length === 0) {
            await pool.request()
                .input('freeDays', sql.Int, freeDays)
                .input('dailyRate', sql.Decimal(10, 2), dailyRate)
                .input('updatedBy', sql.Int, req.user.id)
                .query('INSERT INTO StorageSettings (freeDays, dailyRate, updatedBy) VALUES (@freeDays, @dailyRate, @updatedBy)');
        } else {
            await pool.request()
                .input('id', sql.Int, existing.recordset[0].id)
                .input('freeDays', sql.Int, freeDays)
                .input('dailyRate', sql.Decimal(10, 2), dailyRate)
                .input('updatedBy', sql.Int, req.user.id)
                .query('UPDATE StorageSettings SET freeDays = @freeDays, dailyRate = @dailyRate, updatedAt = GETDATE(), updatedBy = @updatedBy WHERE id = @id');
        }

        await logAudit(req, 'storageSettings.update', 'StorageSettings', null, { freeDays, dailyRate });
        res.json({ message: "Anbar saxlama tənzimləmələri yeniləndi", freeDays, dailyRate });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Bağlamanın anbar saxlama haqqını hesabla
app.get('/api/packages/:id/storage-fee', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const pkgResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT userId, trackingNumber, status, arrivedAtBranchAt, deliveredAt, storageFeePaid FROM Packages WHERE id = @id');

        if (pkgResult.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = pkgResult.recordset[0];

        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canViewAll = isSuperAdmin || permissions.includes('packages.editAll');
        if (!canViewAll && pkg.userId !== req.user.id) {
            return res.status(403).json({ message: "Bu bağlamaya baxmaq icazəniz yoxdur" });
        }

        const settingsResult = await pool.request().query('SELECT TOP 1 freeDays, dailyRate FROM StorageSettings ORDER BY id DESC');
        const settings = settingsResult.recordset[0] || { freeDays: 5, dailyRate: 1.00 };

        const fee = computeStorageFee(pkg, settings);

        res.json({
            trackingNumber: pkg.trackingNumber,
            status: pkg.status,
            arrivedAtBranchAt: pkg.arrivedAtBranchAt,
            deliveredAt: pkg.deliveredAt,
            freeDays: settings.freeDays,
            dailyRate: settings.dailyRate,
            storageFeePaid: parseFloat(pkg.storageFeePaid) || 0,
            ...fee
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Anbar saxlama haqqını balansdan ödə (yalnız bağlamanın sahibi)
app.post('/api/packages/:id/pay-storage-fee', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const pkgResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT userId, trackingNumber, status, arrivedAtBranchAt, deliveredAt, storageFeePaid FROM Packages WHERE id = @id');

        if (pkgResult.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = pkgResult.recordset[0];

        if (pkg.userId !== req.user.id) {
            return res.status(403).json({ message: "Yalnız bağlamanın sahibi anbar haqqını ödəyə bilər" });
        }

        const settingsResult = await pool.request().query('SELECT TOP 1 freeDays, dailyRate FROM StorageSettings ORDER BY id DESC');
        const settings = settingsResult.recordset[0] || { freeDays: 5, dailyRate: 1.00 };
        const { outstanding } = computeStorageFee(pkg, settings);

        if (outstanding <= 0) {
            return res.status(400).json({ message: "Ödəniləcək anbar haqqı yoxdur" });
        }

        const userResult = await pool.request().input('userId', sql.Int, req.user.id).query('SELECT balance FROM Users WHERE id = @userId');
        const balance = parseFloat(userResult.recordset[0]?.balance) || 0;
        if (balance < outstanding) {
            return res.status(400).json({ message: `Balansınızda kifayət qədər vəsait yoxdur. Tələb olunur: $${outstanding.toFixed(2)}, mövcud balans: $${balance.toFixed(2)}` });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await new sql.Request(transaction)
                .input('amount', sql.Decimal(10, 2), outstanding)
                .input('userId', sql.Int, req.user.id)
                .query('UPDATE Users SET balance = ISNULL(balance, 0) - @amount WHERE id = @userId');

            await new sql.Request(transaction)
                .input('id', sql.Int, id)
                .input('amount', sql.Decimal(10, 2), outstanding)
                .query('UPDATE Packages SET storageFeePaid = storageFeePaid + @amount WHERE id = @id');

            await new sql.Request(transaction)
                .input('userId', sql.Int, req.user.id)
                .input('amount', sql.Decimal(10, 2), outstanding)
                .input('type', sql.VarChar(10), 'xerc')
                .input('description', sql.NVarChar(255), `Anbar saxlama haqqı (${pkg.trackingNumber})`)
                .query(`
                    INSERT INTO transactions (user_id, amount, type, description)
                    VALUES (@userId, @amount, @type, @description)
                `);

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        await logAudit(req, 'package.payStorageFee', 'Package', id, { trackingNumber: pkg.trackingNumber, amount: outstanding });

        res.json({ message: "Anbar saxlama haqqı ödənildi", amountPaid: outstanding });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🛃 GÖMRÜK RÜSUMU (CUSTOMS DUTY)
// ==========================================

// 1. Tarif cədvəli (istənilən daxil olmuş istifadəçi)
app.get('/api/customs-duty-rates', verifyToken, async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM CustomsDutyRates ORDER BY hsCodePrefix ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Yeni tarif əlavə et (yalnız Super Admin)
app.post('/api/customs-duty-rates', verifyToken, requireSuperAdmin, async (req, res) => {
    const hsCodePrefix = (req.body.hsCodePrefix || '').replace(/\D/g, '');
    const category = (req.body.category || '').trim();
    const dutyRatePercent = parseFloat(req.body.dutyRatePercent);

    if (!hsCodePrefix) {
        return res.status(400).json({ message: "HS Kodu prefiksi rəqəmlərdən ibarət olmalıdır!" });
    }
    if (!category) {
        return res.status(400).json({ message: "Kateqoriya adı mütləqdir!" });
    }
    if (isNaN(dutyRatePercent) || dutyRatePercent < 0) {
        return res.status(400).json({ message: "Rüsum faizi düzgün, mənfi olmayan bir rəqəm olmalıdır!" });
    }

    try {
        await pool.request()
            .input('hsCodePrefix', sql.NVarChar, hsCodePrefix)
            .input('category', sql.NVarChar, category)
            .input('dutyRatePercent', sql.Decimal(5, 2), dutyRatePercent)
            .query('INSERT INTO CustomsDutyRates (hsCodePrefix, category, dutyRatePercent) VALUES (@hsCodePrefix, @category, @dutyRatePercent)');

        await logAudit(req, 'customsDutyRate.create', 'CustomsDutyRate', null, { hsCodePrefix, category, dutyRatePercent });
        res.json({ message: "Tarif əlavə edildi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Tarifi sil (yalnız Super Admin)
app.delete('/api/customs-duty-rates/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM CustomsDutyRates WHERE id = @id');
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Tarif tapılmadı" });
        }
        await logAudit(req, 'customsDutyRate.delete', 'CustomsDutyRate', id, {});
        res.json({ message: "Tarif silindi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Ümumi tənzimləmələr (de minimis həddi + defolt tarif)
app.get('/api/customs-duty-settings', verifyToken, async (req, res) => {
    try {
        const result = await pool.request().query('SELECT TOP 1 id, deMinimisThreshold, defaultDutyRatePercent FROM CustomsDutySettings ORDER BY id DESC');
        res.json(result.recordset[0] || { deMinimisThreshold: 300.00, defaultDutyRatePercent: 10.00 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Ümumi tənzimləmələri yenilə (yalnız Super Admin)
app.put('/api/customs-duty-settings', verifyToken, requireSuperAdmin, async (req, res) => {
    const deMinimisThreshold = parseFloat(req.body.deMinimisThreshold);
    const defaultDutyRatePercent = parseFloat(req.body.defaultDutyRatePercent);

    if (isNaN(deMinimisThreshold) || deMinimisThreshold < 0) {
        return res.status(400).json({ message: "De minimis həddi düzgün, mənfi olmayan bir rəqəm olmalıdır!" });
    }
    if (isNaN(defaultDutyRatePercent) || defaultDutyRatePercent < 0) {
        return res.status(400).json({ message: "Defolt rüsum faizi düzgün, mənfi olmayan bir rəqəm olmalıdır!" });
    }

    try {
        const existing = await pool.request().query('SELECT TOP 1 id FROM CustomsDutySettings ORDER BY id DESC');
        if (existing.recordset.length === 0) {
            await pool.request()
                .input('deMinimisThreshold', sql.Decimal(10, 2), deMinimisThreshold)
                .input('defaultDutyRatePercent', sql.Decimal(5, 2), defaultDutyRatePercent)
                .input('updatedBy', sql.Int, req.user.id)
                .query('INSERT INTO CustomsDutySettings (deMinimisThreshold, defaultDutyRatePercent, updatedBy) VALUES (@deMinimisThreshold, @defaultDutyRatePercent, @updatedBy)');
        } else {
            await pool.request()
                .input('id', sql.Int, existing.recordset[0].id)
                .input('deMinimisThreshold', sql.Decimal(10, 2), deMinimisThreshold)
                .input('defaultDutyRatePercent', sql.Decimal(5, 2), defaultDutyRatePercent)
                .input('updatedBy', sql.Int, req.user.id)
                .query('UPDATE CustomsDutySettings SET deMinimisThreshold = @deMinimisThreshold, defaultDutyRatePercent = @defaultDutyRatePercent, updatedAt = GETDATE(), updatedBy = @updatedBy WHERE id = @id');
        }

        await logAudit(req, 'customsDutySettings.update', 'CustomsDutySettings', null, { deMinimisThreshold, defaultDutyRatePercent });
        res.json({ message: "Gömrük rüsumu tənzimləmələri yeniləndi", deMinimisThreshold, defaultDutyRatePercent });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 6. Bağlamanın gömrük rüsumunu hesabla
app.get('/api/packages/:id/customs-duty', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const pkgResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT userId, trackingNumber, hsCode, itemDescription, price, declaredValue, customsDutyPaid FROM Packages WHERE id = @id');

        if (pkgResult.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = pkgResult.recordset[0];

        const { isSuperAdmin, permissions } = await getRoleInfo(req.user.role);
        const canViewAll = isSuperAdmin || permissions.includes('packages.editAll');
        if (!canViewAll && pkg.userId !== req.user.id) {
            return res.status(403).json({ message: "Bu bağlamaya baxmaq icazəniz yoxdur" });
        }

        const ratesResult = await pool.request().query('SELECT hsCodePrefix, category, dutyRatePercent FROM CustomsDutyRates');
        const settingsResult = await pool.request().query('SELECT TOP 1 deMinimisThreshold, defaultDutyRatePercent FROM CustomsDutySettings ORDER BY id DESC');
        const settings = settingsResult.recordset[0] || { deMinimisThreshold: 300.00, defaultDutyRatePercent: 10.00 };

        const duty = computeCustomsDuty(pkg, ratesResult.recordset, settings);

        res.json({
            trackingNumber: pkg.trackingNumber,
            hsCode: pkg.hsCode,
            usedDeclaredValue: pkg.declaredValue != null,
            deMinimisThreshold: parseFloat(settings.deMinimisThreshold),
            customsDutyPaid: parseFloat(pkg.customsDutyPaid) || 0,
            ...duty
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 7. Gömrük rüsumunu balansdan ödə (yalnız bağlamanın sahibi)
app.post('/api/packages/:id/pay-customs-duty', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const pkgResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT userId, trackingNumber, hsCode, price, declaredValue, customsDutyPaid FROM Packages WHERE id = @id');

        if (pkgResult.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = pkgResult.recordset[0];

        if (pkg.userId !== req.user.id) {
            return res.status(403).json({ message: "Yalnız bağlamanın sahibi gömrük rüsumunu ödəyə bilər" });
        }

        const ratesResult = await pool.request().query('SELECT hsCodePrefix, category, dutyRatePercent FROM CustomsDutyRates');
        const settingsResult = await pool.request().query('SELECT TOP 1 deMinimisThreshold, defaultDutyRatePercent FROM CustomsDutySettings ORDER BY id DESC');
        const settings = settingsResult.recordset[0] || { deMinimisThreshold: 300.00, defaultDutyRatePercent: 10.00 };
        const { outstanding } = computeCustomsDuty(pkg, ratesResult.recordset, settings);

        if (outstanding <= 0) {
            return res.status(400).json({ message: "Ödəniləcək gömrük rüsumu yoxdur" });
        }

        const userResult = await pool.request().input('userId', sql.Int, req.user.id).query('SELECT balance FROM Users WHERE id = @userId');
        const balance = parseFloat(userResult.recordset[0]?.balance) || 0;
        if (balance < outstanding) {
            return res.status(400).json({ message: `Balansınızda kifayət qədər vəsait yoxdur. Tələb olunur: $${outstanding.toFixed(2)}, mövcud balans: $${balance.toFixed(2)}` });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await new sql.Request(transaction)
                .input('amount', sql.Decimal(10, 2), outstanding)
                .input('userId', sql.Int, req.user.id)
                .query('UPDATE Users SET balance = ISNULL(balance, 0) - @amount WHERE id = @userId');

            await new sql.Request(transaction)
                .input('id', sql.Int, id)
                .input('amount', sql.Decimal(10, 2), outstanding)
                .query('UPDATE Packages SET customsDutyPaid = customsDutyPaid + @amount WHERE id = @id');

            await new sql.Request(transaction)
                .input('userId', sql.Int, req.user.id)
                .input('amount', sql.Decimal(10, 2), outstanding)
                .input('type', sql.VarChar(10), 'xerc')
                .input('description', sql.NVarChar(255), `Gömrük rüsumu (${pkg.trackingNumber})`)
                .query(`
                    INSERT INTO transactions (user_id, amount, type, description)
                    VALUES (@userId, @amount, @type, @description)
                `);

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        await logAudit(req, 'package.payCustomsDuty', 'Package', id, { trackingNumber: pkg.trackingNumber, amount: outstanding });

        res.json({ message: "Gömrük rüsumu ödənildi", amountPaid: outstanding });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 📡 XARİCİ ANBAR OPERATORU (SCANNER + EXCEPTION RESOLVER)
// ==========================================

// 1. Trek nömrəsi ilə sürətli axtarış (skaner-optimized)
app.get('/api/packages/lookup', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const query = (req.query.trackingNumber || '').trim();
    if (!query) {
        return res.status(400).json({ message: "Trek nömrəsi qeyd edilməlidir" });
    }
    try {
        const exact = await pool.request()
            .input('trackingNumber', sql.NVarChar, query)
            .query(`
                SELECT p.*, u.firstName as ownerFirstName, u.lastName as ownerLastName, u.email as ownerEmail, w.name as warehouseName
                FROM Packages p
                LEFT JOIN Users u ON u.id = p.userId
                LEFT JOIN Warehouses w ON w.id = p.warehouseId
                WHERE p.trackingNumber = @trackingNumber AND p.isDeleted = 0
            `);
        if (exact.recordset.length > 0) {
            return res.json({ found: true, exact: true, package: exact.recordset[0] });
        }

        const partial = await pool.request()
            .input('trackingNumber', sql.NVarChar, `%${query}%`)
            .query(`
                SELECT TOP 10 p.*, u.firstName as ownerFirstName, u.lastName as ownerLastName, u.email as ownerEmail, w.name as warehouseName
                FROM Packages p
                LEFT JOIN Users u ON u.id = p.userId
                LEFT JOIN Warehouses w ON w.id = p.warehouseId
                WHERE p.trackingNumber LIKE @trackingNumber AND p.isDeleted = 0
                ORDER BY p.id DESC
            `);
        if (partial.recordset.length > 0) {
            return res.json({ found: true, exact: false, matches: partial.recordset });
        }

        res.json({ found: false });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Naməlum bağlama qeydə al
app.post('/api/unidentified-parcels', verifyToken, requirePermission('packages.editAll'), unidentifiedUpload.single('photo'), async (req, res) => {
    const trackingNumber = (req.body.trackingNumber || '').trim();
    const warehouseId = req.body.warehouseId ? parseInt(req.body.warehouseId) : null;
    const weight = req.body.weight ? parseFloat(req.body.weight) : null;
    const length = req.body.length ? parseFloat(req.body.length) : null;
    const width = req.body.width ? parseFloat(req.body.width) : null;
    const height = req.body.height ? parseFloat(req.body.height) : null;
    const notes = (req.body.notes || '').trim() || null;
    const volumetricWeight = computeVolumetricWeight(length, width, height);

    if (!trackingNumber) {
        return res.status(400).json({ message: "Trek nömrəsi qeyd edilməlidir" });
    }

    try {
        const photoUrl = req.file ? `/uploads/unidentified/${req.file.filename}` : null;

        const result = await pool.request()
            .input('trackingNumber', sql.NVarChar, trackingNumber)
            .input('warehouseId', sql.Int, warehouseId)
            .input('weight', sql.Decimal(10, 2), weight)
            .input('length', sql.Decimal(10, 2), length)
            .input('width', sql.Decimal(10, 2), width)
            .input('height', sql.Decimal(10, 2), height)
            .input('volumetricWeight', sql.Decimal(10, 2), volumetricWeight)
            .input('photoUrl', sql.NVarChar, photoUrl)
            .input('notes', sql.NVarChar, notes)
            .input('scannedBy', sql.Int, req.user.id)
            .query(`
                INSERT INTO UnidentifiedParcels (trackingNumber, warehouseId, weight, [length], width, height, volumetricWeight, photoUrl, notes, scannedBy)
                OUTPUT INSERTED.id
                VALUES (@trackingNumber, @warehouseId, @weight, @length, @width, @height, @volumetricWeight, @photoUrl, @notes, @scannedBy)
            `);

        await logAudit(req, 'unidentifiedParcel.create', 'UnidentifiedParcel', result.recordset[0].id, { trackingNumber });
        res.json({ message: "Naməlum bağlama qeydə alındı", id: result.recordset[0].id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Naməlum bağlamaların siyahısı
app.get('/api/unidentified-parcels', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    try {
        const statusFilter = (req.query.status || 'Açıq').trim();
        const request = pool.request();
        let whereClause = '';
        if (statusFilter !== 'ALL') {
            whereClause = 'WHERE up.status = @status';
            request.input('status', sql.NVarChar, statusFilter);
        }
        const result = await request.query(`
            SELECT up.*, w.name as warehouseName, su.firstName as scannedByFirstName, su.lastName as scannedByLastName
            FROM UnidentifiedParcels up
            LEFT JOIN Warehouses w ON w.id = up.warehouseId
            LEFT JOIN Users su ON su.id = up.scannedBy
            ${whereClause}
            ORDER BY up.id DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Müştəri axtarışı (Exception Resolver-də təyinat üçün)
app.get('/api/customers/search', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) {
        return res.json([]);
    }
    try {
        const request = pool.request().input('search', sql.NVarChar, `%${q}%`);
        let whereExtra = '';
        const codeMatch = q.match(/^#?C-?(\d+)$/i);
        if (codeMatch) {
            const impliedId = parseInt(codeMatch[1]) - 10400;
            request.input('impliedId', sql.Int, impliedId);
            whereExtra = ' OR id = @impliedId';
        }
        const result = await request.query(`
            SELECT TOP 10 id, firstName, lastName, email
            FROM Users
            WHERE role = N'Customer' AND (firstName LIKE @search OR lastName LIKE @search OR email LIKE @search${whereExtra})
            ORDER BY id DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Naməlum bağlamanı müştəriyə təyin et (real Bağlama qeydi yaradılır)
app.post('/api/unidentified-parcels/:id/assign', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(req.body.userId);
    const warehouseId = req.body.warehouseId ? parseInt(req.body.warehouseId) : null;

    if (isNaN(userId)) {
        return res.status(400).json({ message: "Müştəri seçilməlidir" });
    }

    try {
        const parcelResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT * FROM UnidentifiedParcels WHERE id = @id`);
        if (parcelResult.recordset.length === 0) {
            return res.status(404).json({ message: "Naməlum bağlama tapılmadı" });
        }
        const parcel = parcelResult.recordset[0];
        if (parcel.status !== 'Açıq') {
            return res.status(400).json({ message: "Bu bağlama artıq həll edilib" });
        }

        const finalWarehouseId = warehouseId || parcel.warehouseId;
        if (!finalWarehouseId) {
            return res.status(400).json({ message: "Anbar seçilməlidir" });
        }
        const warehouseResult = await pool.request()
            .input('warehouseId', sql.Int, finalWarehouseId)
            .query('SELECT ratePerKg FROM Warehouses WHERE id = @warehouseId AND isActive = 1');
        if (warehouseResult.recordset.length === 0) {
            return res.status(400).json({ message: "Seçilmiş anbar tapılmadı və ya aktiv deyil" });
        }
        const ratePerKg = warehouseResult.recordset[0].ratePerKg;
        const weight = parseFloat(parcel.weight) || 0;
        const price = Math.round(weight * ratePerKg * 100) / 100;

        const insertResult = await pool.request()
            .input('trackingNumber', sql.NVarChar, parcel.trackingNumber)
            .input('weight', sql.Decimal(10, 2), weight)
            .input('price', sql.Decimal(10, 2), price)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('userId', sql.Int, userId)
            .input('warehouseId', sql.Int, finalWarehouseId)
            .input('length', sql.Decimal(10, 2), parcel.length)
            .input('width', sql.Decimal(10, 2), parcel.width)
            .input('height', sql.Decimal(10, 2), parcel.height)
            .input('volumetricWeight', sql.Decimal(10, 2), parcel.volumetricWeight)
            .input('receivingPhotoUrl', sql.NVarChar, parcel.photoUrl)
            .input('confirmedBy', sql.Int, req.user.id)
            .query(`
                INSERT INTO Packages (trackingNumber, weight, price, status, isDeleted, userId, warehouseId, [length], width, height, volumetricWeight, weightConfirmed, weightConfirmedBy, weightConfirmedAt, receivingPhotoUrl)
                OUTPUT INSERTED.id
                VALUES (@trackingNumber, @weight, @price, @status, 0, @userId, @warehouseId, @length, @width, @height, @volumetricWeight, 1, @confirmedBy, GETDATE(), @receivingPhotoUrl)
            `);
        const newPackageId = insertResult.recordset[0].id;

        await pool.request()
            .input('packageId', sql.Int, newPackageId)
            .input('status', sql.NVarChar, 'Bəyan edildi')
            .input('changedByUserId', sql.Int, req.user.id)
            .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');

        await pool.request()
            .input('id', sql.Int, id)
            .input('resolvedPackageId', sql.Int, newPackageId)
            .input('resolvedBy', sql.Int, req.user.id)
            .query(`UPDATE UnidentifiedParcels SET status = N'Həll edildi', resolvedPackageId = @resolvedPackageId, resolvedBy = @resolvedBy, resolvedAt = GETDATE() WHERE id = @id`);

        await createInAppNotification(
            userId,
            'Sizə aid naməlum bağlama tapıldı',
            `Xarici anbarda sahibsiz aşkarlanan "${parcel.trackingNumber}" bağlaması hesabınıza əlavə edildi.`,
            'general'
        );

        await logAudit(req, 'unidentifiedParcel.assign', 'UnidentifiedParcel', id, { trackingNumber: parcel.trackingNumber, userId, newPackageId });

        res.json({ message: "Bağlama müştəriyə təyin edildi", packageId: newPackageId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🏢 YERLİ HUB / FİLİAL PANELİ (ŞKAF TƏYİNATI + POS TƏHVİL)
// ==========================================

// 1. Bağlamanı şkaf yerinə bağla (yalnız "Filialda" statusunda olan bağlamalar üçün)
app.put('/api/packages/:id/shelf-location', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const { id } = req.params;
    const shelfLocation = (req.body.shelfLocation || '').trim();

    if (!shelfLocation) {
        return res.status(400).json({ message: "Şkaf yeri qeyd edilməlidir" });
    }

    try {
        const existing = await pool.request().input('id', sql.Int, id).query('SELECT status, trackingNumber FROM Packages WHERE id = @id');
        if (existing.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        if (existing.recordset[0].status !== 'Filialda') {
            return res.status(400).json({ message: `Yalnız "Filialda" statusunda olan bağlamalar şkafa yerləşdirilə bilər (cari status: ${existing.recordset[0].status})` });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('shelfLocation', sql.NVarChar, shelfLocation)
            .query('UPDATE Packages SET shelfLocation = @shelfLocation WHERE id = @id');

        await logAudit(req, 'package.assignShelf', 'Package', id, { trackingNumber: existing.recordset[0].trackingNumber, shelfLocation });
        res.json({ message: "Şkaf yeri təyin edildi", shelfLocation });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Şkaf xəritəsi (vizual 2D grid üçün — hazırda şkafda olan bütün bağlamalar)
app.get('/api/shelf-map', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT p.id, p.trackingNumber, p.shelfLocation, p.userId, u.firstName, u.lastName
            FROM Packages p
            LEFT JOIN Users u ON u.id = p.userId
            WHERE p.shelfLocation IS NOT NULL AND p.status = N'Filialda' AND p.isDeleted = 0
            ORDER BY p.shelfLocation ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Müştərinin təhvilə hazır bağlamaları (POS axtarışı üçün)
app.get('/api/customers/:id/pending-pickup', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.request()
            .input('userId', sql.Int, id)
            .query(`
                SELECT id, trackingNumber, weight, price, shelfLocation, status
                FROM Packages
                WHERE userId = @userId AND status = N'Filialda' AND isDeleted = 0
                ORDER BY id DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Təhvilalma kodu göndər (zero-trust: kod yalnız müştərinin öz bildiriş panelində görünür)
app.post('/api/customers/:id/dispatch-otp', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const { id } = req.params;
    try {
        const userCheck = await pool.request().input('id', sql.Int, id).query(`SELECT id FROM Users WHERE id = @id AND role = N'Customer'`);
        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ message: "Müştəri tapılmadı" });
        }

        const code = String(crypto.randomInt(100000, 1000000));

        await pool.request()
            .input('id', sql.Int, id)
            .input('code', sql.NVarChar, code)
            .query(`UPDATE Users SET dispatchOtpCode = @code, dispatchOtpExpiresAt = DATEADD(minute, 5, GETDATE()) WHERE id = @id`);

        await createInAppNotification(
            id,
            'Təhvilalma Təsdiq Kodu',
            `Filialdan bağlamalarınızı təhvil almaq üçün bu kodu filial əməkdaşına deyin: ${code}. Kod 5 dəqiqə etibarlıdır.`,
            'general'
        );

        await logAudit(req, 'customer.dispatchOtpSent', 'User', id, {});
        res.json({ message: "Təsdiq kodu müştəriyə göndərildi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Təhvilalma kodunu təsdiqlə və seçilmiş bağlamaları təhvil ver
app.post('/api/customers/:id/dispatch-confirm', verifyToken, requirePermission('packages.editAll'), async (req, res) => {
    const { id } = req.params;
    const code = (req.body.code || '').trim();
    const packageIds = Array.isArray(req.body.packageIds) ? req.body.packageIds.map((p) => parseInt(p)).filter((p) => !isNaN(p)) : [];

    if (!code) {
        return res.status(400).json({ message: "Təsdiq kodu daxil edilməlidir" });
    }
    if (packageIds.length === 0) {
        return res.status(400).json({ message: "Ən azı bir bağlama seçilməlidir" });
    }

    try {
        const userResult = await pool.request().input('id', sql.Int, id).query(`SELECT dispatchOtpCode, dispatchOtpExpiresAt FROM Users WHERE id = @id`);
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ message: "Müştəri tapılmadı" });
        }
        const { dispatchOtpCode, dispatchOtpExpiresAt } = userResult.recordset[0];

        if (!dispatchOtpCode || dispatchOtpCode !== code) {
            return res.status(400).json({ message: "Təsdiq kodu yanlışdır" });
        }
        if (!dispatchOtpExpiresAt || new Date(dispatchOtpExpiresAt) < new Date()) {
            return res.status(400).json({ message: "Təsdiq kodunun müddəti bitib, yenidən göndərin" });
        }

        const packagesResult = await pool.request()
            .input('userId', sql.Int, id)
            .query(`SELECT id, trackingNumber, status FROM Packages WHERE userId = @userId AND status = N'Filialda' AND isDeleted = 0`);
        const eligibleIds = new Set(packagesResult.recordset.map((p) => p.id));
        const invalidIds = packageIds.filter((pid) => !eligibleIds.has(pid));
        if (invalidIds.length > 0) {
            return res.status(400).json({ message: "Seçilmiş bağlamalardan bəziləri təhvilə hazır deyil" });
        }

        const releasedTrackingNumbers = [];
        for (const pid of packageIds) {
            const pkg = packagesResult.recordset.find((p) => p.id === pid);
            await pool.request()
                .input('id', sql.Int, pid)
                .query(`UPDATE Packages SET status = N'Təhvil verildi', deliveredAt = CASE WHEN deliveredAt IS NULL THEN GETDATE() ELSE deliveredAt END WHERE id = @id`);
            await pool.request()
                .input('packageId', sql.Int, pid)
                .input('status', sql.NVarChar, 'Təhvil verildi')
                .input('changedByUserId', sql.Int, req.user.id)
                .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');
            releasedTrackingNumbers.push(pkg.trackingNumber);
        }

        await pool.request().input('id', sql.Int, id).query(`UPDATE Users SET dispatchOtpCode = NULL, dispatchOtpExpiresAt = NULL WHERE id = @id`);

        await createInAppNotification(
            id,
            'Bağlamalarınız təhvil verildi',
            `Aşağıdakı bağlamalar sizə təhvil verildi: ${releasedTrackingNumbers.join(', ')}.`,
            'general'
        );

        await logAudit(req, 'customer.dispatchConfirmed', 'User', id, { packageIds, trackingNumbers: releasedTrackingNumbers });

        res.json({ message: "Bağlamalar uğurla təhvil verildi", trackingNumbers: releasedTrackingNumbers });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 🚚 SON-KİLOMETR KURYER DISPATCH MƏRKƏZİ
// ==========================================

// 1. Kuryer İş Yükü (Dispatcher Command Center)
app.get('/api/couriers/workload', verifyToken, requirePermission('packages.assignCourier'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT u.id, u.firstName, u.lastName, u.email,
                SUM(CASE WHEN p.id IS NOT NULL AND p.status != N'Təhvil verildi' AND p.isDeleted = 0 THEN 1 ELSE 0 END) as activeCount,
                SUM(CASE WHEN p.id IS NOT NULL AND p.status = N'Təhvil verildi' THEN 1 ELSE 0 END) as deliveredCount
            FROM Users u
            JOIN Roles r ON r.name = u.role
            JOIN RolePermissions rp ON rp.roleId = r.id
            JOIN Permissions perm ON perm.id = rp.permissionId
            LEFT JOIN Packages p ON p.assignedCourierId = u.id
            WHERE perm.[key] = 'packages.viewAssigned'
            GROUP BY u.id, u.firstName, u.lastName, u.email
            ORDER BY u.firstName
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Kuryerə təyin edilməmiş, "Filialda" statusunda olan bağlamalar
app.get('/api/packages/awaiting-courier', verifyToken, requirePermission('packages.assignCourier'), async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT p.id, p.trackingNumber, p.weight, p.shelfLocation, u.firstName, u.lastName, u.email
            FROM Packages p
            LEFT JOIN Users u ON u.id = p.userId
            WHERE p.status = N'Filialda' AND p.assignedCourierId IS NULL AND p.isDeleted = 0
            ORDER BY p.id DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Toplu kuryer təyinatı (bir neçə bağlamanı eyni kuryerə birdəfəyə təyin etmək)
app.post('/api/packages/batch-assign-courier', verifyToken, requirePermission('packages.assignCourier'), async (req, res) => {
    const packageIds = Array.isArray(req.body.packageIds) ? req.body.packageIds.map((p) => parseInt(p)).filter((p) => !isNaN(p)) : [];
    const courierId = parseInt(req.body.courierId);

    if (packageIds.length === 0) {
        return res.status(400).json({ message: "Ən azı bir bağlama seçilməlidir" });
    }
    if (isNaN(courierId)) {
        return res.status(400).json({ message: "Kuryer seçilməlidir" });
    }

    try {
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

        const idList = packageIds.map((_, i) => `@id${i}`).join(',');
        const request = pool.request().input('courierId', sql.Int, courierId);
        packageIds.forEach((id, i) => request.input(`id${i}`, sql.Int, id));
        const result = await request.query(`
            UPDATE Packages SET assignedCourierId = @courierId
            WHERE id IN (${idList}) AND status = N'Filialda' AND isDeleted = 0
        `);

        await logAudit(req, 'package.batchAssignCourier', 'Package', null, { packageIds, courierId, count: result.rowsAffected[0] });
        res.json({ message: "Bağlamalar kuryerə təyin edildi", assignedCount: result.rowsAffected[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Kuryer təhvil zamanı müştəriyə təsdiq kodu göndərir (yalnız özünə təyin olunmuş bağlama üçün)
app.post('/api/packages/:id/request-delivery-otp', verifyToken, requirePermission('packages.viewAssigned'), async (req, res) => {
    const { id } = req.params;
    try {
        const pkgResult = await pool.request().input('id', sql.Int, id).query('SELECT userId, assignedCourierId, trackingNumber FROM Packages WHERE id = @id');
        if (pkgResult.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = pkgResult.recordset[0];
        if (pkg.assignedCourierId !== req.user.id) {
            return res.status(403).json({ message: "Bu bağlama sizə təyin edilməyib" });
        }

        const code = String(crypto.randomInt(100000, 1000000));
        await pool.request()
            .input('id', sql.Int, pkg.userId)
            .input('code', sql.NVarChar, code)
            .query(`UPDATE Users SET dispatchOtpCode = @code, dispatchOtpExpiresAt = DATEADD(minute, 5, GETDATE()) WHERE id = @id`);

        await createInAppNotification(
            pkg.userId,
            'Təhvilalma Təsdiq Kodu',
            `Kuryer "${pkg.trackingNumber}" bağlamasını sizə təhvil vermək istəyir. Bu kodu kuryerə deyin: ${code}. Kod 5 dəqiqə etibarlıdır.`,
            'general'
        );

        await logAudit(req, 'customer.dispatchOtpSent', 'User', pkg.userId, { trackingNumber: pkg.trackingNumber, viaCourier: true });
        res.json({ message: "Təsdiq kodu müştəriyə göndərildi" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Kuryerin təhvil sübutu ilə bağlamanı təhvil verməsi (imza / foto / OTP)
app.put('/api/packages/:id/deliver', verifyToken, requirePermission('packages.viewAssigned'), deliveryProofUpload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const proofType = (req.body.proofType || '').trim();
    const otpCode = (req.body.otpCode || '').trim();

    if (!['signature', 'photo', 'otp'].includes(proofType)) {
        return res.status(400).json({ message: "Düzgün təhvil sübutu növü seçin" });
    }

    try {
        const pkgResult = await pool.request().input('id', sql.Int, id).query('SELECT status, userId, assignedCourierId, trackingNumber, weightConfirmed FROM Packages WHERE id = @id');
        if (pkgResult.recordset.length === 0) {
            return res.status(404).json({ message: "Bağlama tapılmadı" });
        }
        const pkg = pkgResult.recordset[0];
        if (pkg.assignedCourierId !== req.user.id) {
            return res.status(403).json({ message: "Bu bağlama sizə təyin edilməyib" });
        }

        const { isSuperAdmin: isCourierSuperAdmin } = await getRoleInfo(req.user.role);
        const transitionCheck = validateStatusTransition(pkg.status, 'Təhvil verildi', {
            isSuperAdmin: isCourierSuperAdmin,
            weightConfirmed: pkg.weightConfirmed
        });
        if (!transitionCheck.valid) {
            return res.status(400).json({ message: transitionCheck.message });
        }

        let deliveryProofUrl = null;
        let deliveryProofNote = null;

        if (proofType === 'signature' || proofType === 'photo') {
            if (!req.file) {
                return res.status(400).json({ message: proofType === 'signature' ? "İmza tələb olunur" : "Şəkil tələb olunur" });
            }
            deliveryProofUrl = `/uploads/delivery-proof/${req.file.filename}`;
        } else if (proofType === 'otp') {
            if (!otpCode) {
                return res.status(400).json({ message: "Təsdiq kodu daxil edilməlidir" });
            }
            const userResult = await pool.request().input('userId', sql.Int, pkg.userId).query('SELECT dispatchOtpCode, dispatchOtpExpiresAt FROM Users WHERE id = @userId');
            const { dispatchOtpCode, dispatchOtpExpiresAt } = userResult.recordset[0] || {};
            if (!dispatchOtpCode || dispatchOtpCode !== otpCode) {
                return res.status(400).json({ message: "Təsdiq kodu yanlışdır" });
            }
            if (!dispatchOtpExpiresAt || new Date(dispatchOtpExpiresAt) < new Date()) {
                return res.status(400).json({ message: "Təsdiq kodunun müddəti bitib, yenidən göndərin" });
            }
            await pool.request().input('userId', sql.Int, pkg.userId).query(`UPDATE Users SET dispatchOtpCode = NULL, dispatchOtpExpiresAt = NULL WHERE id = @userId`);
            deliveryProofNote = 'OTP ilə təsdiqləndi';
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('proofType', sql.NVarChar, proofType)
            .input('proofUrl', sql.NVarChar, deliveryProofUrl)
            .input('proofNote', sql.NVarChar, deliveryProofNote)
            .query(`
                UPDATE Packages SET
                    status = N'Təhvil verildi',
                    deliveredAt = CASE WHEN deliveredAt IS NULL THEN GETDATE() ELSE deliveredAt END,
                    deliveryProofType = @proofType,
                    deliveryProofUrl = @proofUrl,
                    deliveryProofNote = @proofNote
                WHERE id = @id
            `);

        await pool.request()
            .input('packageId', sql.Int, id)
            .input('status', sql.NVarChar, 'Təhvil verildi')
            .input('changedByUserId', sql.Int, req.user.id)
            .query('INSERT INTO PackageStatusHistory (packageId, status, changedByUserId) VALUES (@packageId, @status, @changedByUserId)');

        await createInAppNotification(
            pkg.userId,
            'Bağlamanız təhvil verildi',
            `"${pkg.trackingNumber}" bağlaması sizə təhvil verildi.`,
            'general'
        );

        await logAudit(req, 'package.deliverWithProof', 'Package', id, { trackingNumber: pkg.trackingNumber, proofType });

        res.json({ message: "Bağlama uğurla təhvil verildi", proofType, deliveryProofUrl });
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