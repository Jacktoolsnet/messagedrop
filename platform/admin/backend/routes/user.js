// routes/user.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const tableUser = require('../db/tableUser');
const tableLoginOtp = require('../db/tableLoginOtp');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { sendMail } = require('../utils/mailer');
const { sendPushbulletNotification } = require('../utils/pushbullet');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_ISS = process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/';
const ADMIN_AUD = process.env.ADMIN_AUD || 'messagedrop-admin';
const OTP_TTL_MS = Number(process.env.ADMIN_OTP_TTL_MS || 5 * 60 * 1000);
const OTP_LENGTH = 6;
const ADMIN_ROOT_EMAIL = process.env.ADMIN_ROOT_EMAIL || process.env.MAIL_ADDRESS || process.env.MAIL_USER || '';
const OTP_PUSH_REQUIRED = !['0', 'false', 'no', 'off'].includes(String(process.env.ADMIN_OTP_PUSH_REQUIRED || 'true').trim().toLowerCase());
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rateLimitMessage = (message) => ({
    errorCode: 'RATE_LIMIT',
    message,
    error: message
});

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const isValidEmail = (value) => EMAIL_REGEX.test(normalizeEmail(value));

const LOGIN_WINDOW_MS = toNumber(process.env.ADMIN_LOGIN_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const LOGIN_LIMIT = toNumber(process.env.ADMIN_LOGIN_LIMIT, 10);
const VERIFY_LIMIT = toNumber(process.env.ADMIN_LOGIN_VERIFY_LIMIT, 20);
const SLOWDOWN_AFTER = toNumber(process.env.ADMIN_LOGIN_SLOWDOWN_AFTER, 5);
const SLOWDOWN_DELAY_MS = toNumber(process.env.ADMIN_LOGIN_SLOWDOWN_DELAY_MS, 400);
const SLOWDOWN_MAX_MS = toNumber(process.env.ADMIN_LOGIN_SLOWDOWN_MAX_MS, 4000);
const VERIFY_SLOWDOWN_AFTER = toNumber(process.env.ADMIN_LOGIN_VERIFY_SLOWDOWN_AFTER, SLOWDOWN_AFTER);
const VERIFY_SLOWDOWN_DELAY_MS = toNumber(process.env.ADMIN_LOGIN_VERIFY_SLOWDOWN_DELAY_MS, SLOWDOWN_DELAY_MS);
const VERIFY_SLOWDOWN_MAX_MS = toNumber(process.env.ADMIN_LOGIN_VERIFY_SLOWDOWN_MAX_MS, SLOWDOWN_MAX_MS);
const ALLOWED_ROLES = new Set(['moderator', 'legal', 'admin', 'root']);

function createSlowdown({ windowMs, delayAfter, delayMs, maxDelayMs, keyGenerator }) {
    const hits = new Map();
    const cleanupMs = Math.max(windowMs, 60 * 1000);

    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits.entries()) {
            if (now - entry.start >= windowMs) {
                hits.delete(key);
            }
        }
    }, cleanupMs).unref();

    return (req, _res, next) => {
        if (delayMs <= 0 || delayAfter <= 0) {
            return next();
        }
        const key = keyGenerator ? keyGenerator(req) : (ipKeyGenerator(req) || req.ip || req.connection?.remoteAddress || 'unknown');
        const now = Date.now();
        const entry = hits.get(key);
        if (!entry || now - entry.start >= windowMs) {
            hits.set(key, { count: 1, start: now });
            return next();
        }
        entry.count += 1;
        if (entry.count <= delayAfter) {
            return next();
        }
        const delay = Math.min((entry.count - delayAfter) * delayMs, maxDelayMs);
        if (delay <= 0) {
            return next();
        }
        setTimeout(next, delay);
    };
}

const loginKey = (req) => {
    const ip = ipKeyGenerator(req) || req.ip || req.connection?.remoteAddress || 'unknown';
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : 'unknown';
    return `${ip}|${username}`;
};

const verifyKey = (req) => {
    const ip = ipKeyGenerator(req) || req.ip || req.connection?.remoteAddress || 'unknown';
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : 'unknown';
    return `${ip}|${challengeId}`;
};

const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage('Too many login attempts, please try again later.'),
    keyGenerator: loginKey
});

const loginSlowdown = createSlowdown({
    windowMs: LOGIN_WINDOW_MS,
    delayAfter: SLOWDOWN_AFTER,
    delayMs: SLOWDOWN_DELAY_MS,
    maxDelayMs: SLOWDOWN_MAX_MS,
    keyGenerator: loginKey
});

const verifyLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: VERIFY_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage('Too many verification attempts, please try again later.'),
    keyGenerator: verifyKey
});

const verifySlowdown = createSlowdown({
    windowMs: LOGIN_WINDOW_MS,
    delayAfter: VERIFY_SLOWDOWN_AFTER,
    delayMs: VERIFY_SLOWDOWN_DELAY_MS,
    maxDelayMs: VERIFY_SLOWDOWN_MAX_MS,
    keyGenerator: verifyKey
});

// Helpers
const stripUser = (u) => u && ({ id: u.id, username: u.username, email: u.email || '', role: u.role, createdAt: u.createdAt });
const isAdminOrRoot = (roles) => (Array.isArray(roles) ? roles : []).some(r => r === 'admin' || r === 'root');

const hashOtp = (otp) => {
    const salt = process.env.ADMIN_OTP_SECRET || ADMIN_JWT_SECRET || '';
    return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
};

const generateOtp = () => {
    return String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
};

async function sendOtp(username, email, otp, logger) {
    const validMinutes = Math.round(OTP_TTL_MS / 60000);
    const title = 'Messagedrop Admin Login OTP';
    const text = `Code: ${otp}\nUser: ${username}\nE-Mail: ${email}\nGültig für ${validMinutes} Minuten.`;
    const html = `
      <p>Hallo ${username},</p>
      <p>dein Messagedrop Admin Login-Code lautet: <strong>${otp}</strong></p>
      <p>Der Code ist ${validMinutes} Minuten gültig.</p>
      <p>Falls du den Login nicht angefordert hast, melde dich bitte sofort beim Root-Admin.</p>
    `;

    const mailResult = await sendMail({
        to: email,
        subject: title,
        text,
        html,
        logger
    });

    if (!mailResult || mailResult.success === false) {
        logger?.warn?.('OTP e-mail delivery failed', { username, email });
        throw new Error('otp_mail_delivery_failed');
    }

    const pushSent = await sendPushbulletNotification({
        title,
        body: text,
        logger
    });

    if (!pushSent && OTP_PUSH_REQUIRED) {
        logger?.warn?.('OTP Pushbullet delivery failed', { username, email });
        throw new Error('otp_push_delivery_failed');
    }
}

async function notifyLoginFailure(username, reason, logger) {
    const title = 'Messagedrop Admin Login Failure';
    const text = `User: ${username || 'unknown'}\nReason: ${reason}`;
    await sendPushbulletNotification({ title, body: text, logger });
}

function createChallenge(db, username, email, payload, logger) {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        const otp = generateOtp();
        const codeHash = hashOtp(otp);
        const id = crypto.randomUUID();
        const expiresAt = now + OTP_TTL_MS;
        const payloadJson = JSON.stringify(payload);

        tableLoginOtp.cleanup(db, now, () => {
            tableLoginOtp.deleteByUsername(db, username, () => {
                tableLoginOtp.create(db, id, username, codeHash, payloadJson, expiresAt, now, async (err) => {
                    if (err) {
                        return reject(err);
                    }
                    try {
                        await sendOtp(username, email, otp, logger);
                        resolve({ id, expiresAt });
                    } catch (deliveryError) {
                        tableLoginOtp.deleteByUsername(db, username, () => reject(deliveryError));
                    }
                });
            });
        });
    });
}

// ======================= LOGIN (ohne Guard) =======================
router.post('/login', [loginLimiter, loginSlowdown], async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const envUser = process.env.ADMIN_ROOT_USER;
    const envPass = process.env.ADMIN_ROOT_PASSWORD;
    const rootEmail = normalizeEmail(ADMIN_ROOT_EMAIL);

    if (!username || !password) {
        return next(apiError.badRequest('Missing username or password'));
    }

    try {
        // Root via ENV
        if (username === envUser && password === envPass) {
            if (!isValidEmail(rootEmail)) {
                req.logger?.error('Root OTP email not configured');
                return next(apiError.internal('otp_recipient_missing'));
            }
            try {
                const { id, expiresAt } = await createChallenge(
                    db,
                    username,
                    rootEmail,
                    { sub: 'root', username, role: 'root', roles: ['root'] },
                    req.logger
                );
                return res.json({ status: 'otp_required', challengeId: id, expiresAt });
            } catch (otpErr) {
                req.logger?.error('Root OTP challenge failed', { error: otpErr?.message });
                return next(apiError.internal('otp_failed'));
            }
        }

        // Normale User
        tableUser.getByUsername(db, username, async (err, user) => {
            if (err || !user) {
                await notifyLoginFailure(username, 'invalid_user_or_password', req.logger);
                return next(apiError.unauthorized('Invalid login'));
            }
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                await notifyLoginFailure(username, 'invalid_user_or_password', req.logger);
                return next(apiError.unauthorized('Invalid login'));
            }
            const recipientEmail = normalizeEmail(user.email);
            if (!isValidEmail(recipientEmail)) {
                req.logger?.warn('Missing or invalid OTP recipient e-mail', { username: user.username });
                await notifyLoginFailure(username, 'otp_email_missing', req.logger);
                return next(apiError.internal('otp_recipient_missing'));
            }

            try {
                const { id, expiresAt } = await createChallenge(
                    db,
                    user.username,
                    recipientEmail,
                    { sub: user.id, username: user.username, role: user.role, roles: [user.role] },
                    req.logger
                );
                res.json({ status: 'otp_required', challengeId: id, expiresAt });
            } catch (otpErr) {
                req.logger?.error('OTP challenge failed', { error: otpErr?.message });
                return next(apiError.internal('otp_failed'));
            }
        });
    } catch (error) {
        req.logger?.error('Admin login failed', { error: error?.message });
        return next(apiError.internal('login_failed'));
    }
});

router.post('/login/verify', [verifyLimiter, verifySlowdown], async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const { challengeId, otp } = req.body || {};
    if (!challengeId || !otp) {
        return next(apiError.badRequest('missing_challenge_or_code'));
    }

    const now = Date.now();
    tableLoginOtp.getById(db, challengeId, async (err, challenge) => {
        if (err || !challenge) {
            await notifyLoginFailure(null, 'invalid_challenge', req.logger);
            return next(apiError.unauthorized('invalid_challenge'));
        }
        if (challenge.expiresAt < now) {
            await notifyLoginFailure(challenge.username, 'otp_expired', req.logger);
            return next(apiError.unauthorized('otp_expired'));
        }
        if (challenge.consumedAt) {
            await notifyLoginFailure(challenge.username, 'otp_used', req.logger);
            return next(apiError.unauthorized('otp_used'));
        }

        const hashed = hashOtp(String(otp));
        if (hashed !== challenge.codeHash) {
            await notifyLoginFailure(challenge.username, 'otp_invalid', req.logger);
            return next(apiError.unauthorized('otp_invalid'));
        }

        let payload;
        try {
            payload = JSON.parse(challenge.payload);
        } catch {
            req.logger?.error('OTP payload parse failed', { challengeId });
            return next(apiError.internal('otp_payload_invalid'));
        }

        tableLoginOtp.consume(db, challengeId, (consumeErr) => {
            if (consumeErr) {
                req.logger?.error('OTP consume failed', { error: consumeErr?.message, challengeId });
                return next(apiError.internal('otp_failed'));
            }

            const token = jwt.sign(
                payload,
                ADMIN_JWT_SECRET,
                { expiresIn: '2h', issuer: ADMIN_ISS, audience: ADMIN_AUD }
            );
            res.json({ token });
        });
    });
});

// Ab hier: Admin-JWT Pflicht
router.use(requireAdminJwt);

// ======================= GET /user =======================
// admin/root: alle; sonst: nur eigener
router.get('/', (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const roles = Array.isArray(req.admin?.roles) ? req.admin.roles : [];
    const sub = req.admin?.sub;
    const uname = req.admin?.username;

    if (isAdminOrRoot(roles)) {
        tableUser.list(db, {}, (err, users) => {
            if (err) return next(apiError.internal('DB error'));
            res.json(users.map(stripUser));
        });
    } else {
        tableUser.getById(db, sub, (err, u) => {
            if (err) return next(apiError.internal('DB error'));
            if (u) return res.json([stripUser(u)]);
            tableUser.getByUsername(db, uname, (err2, u2) => {
                if (err2) return next(apiError.internal('DB error'));
                res.json(u2 ? [stripUser(u2)] : []);
            });
        });
    }
});

// ======================= POST /user =======================
// nur admin/root
router.post('/', requireRole('admin', 'root'), async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    let { username, email, password, role = 'moderator' } = req.body || {};
    username = typeof username === 'string' ? username.trim() : '';
    email = normalizeEmail(email);
    password = typeof password === 'string' ? password.trim() : '';
    role = typeof role === 'string' ? role.trim() : 'moderator';

    if (!username || !password || !email) {
        return next(apiError.badRequest('Missing username, e-mail or password'));
    }
    if (!isValidEmail(email)) {
        return next(apiError.badRequest('Invalid e-mail address'));
    }
    if (!ALLOWED_ROLES.has(role)) {
        return next(apiError.badRequest('Invalid role'));
    }

    const id = crypto.randomUUID();
    let hashed;
    try {
        hashed = await bcrypt.hash(password, 12);
    } catch (error) {
        req.logger?.error?.('Password hash failed', { error: error?.message });
        return next(apiError.internal('Could not create user'));
    }
    const createdAt = Date.now();

    tableUser.create(db, id, username, email, hashed, role, createdAt, (err, result) => {
        if (err) {
            const msg = String(err.message || '');
            if (err.code === 'SQLITE_CONSTRAINT' || msg.includes('UNIQUE')) {
                if (msg.toLowerCase().includes('email')) {
                    return next(apiError.conflict('E-mail already exists'));
                }
                return next(apiError.conflict('Username already exists'));
            }
            return next(apiError.internal('Could not create user'));
        }
        res.status(201).json(result); // { id }
    });
});

// ======================= PUT /user/:id =======================
// admin/root: username/role/password; normaler User: nur eigenes password
router.put('/:id', async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const { id } = req.params;
    const hasEmailField = Object.prototype.hasOwnProperty.call(req.body || {}, 'email');
    let { username, email, role, password } = req.body || {};
    if (typeof username === 'string') username = username.trim();
    if (typeof email === 'string') email = normalizeEmail(email);
    if (typeof role === 'string') role = role.trim();
    if (typeof password === 'string') password = password.trim();

    if (!username && !role && !password && !hasEmailField) {
        return next(apiError.badRequest('Nothing to update'));
    }

    const roles = Array.isArray(req.admin?.roles) ? req.admin.roles : [];
    const isAdminRoot = isAdminOrRoot(roles);
    const isSelf = req.admin?.sub === id;

    tableUser.getById(db, id, async (err, target) => {
        if (err) return next(apiError.internal('DB error'));
        if (!target) return next(apiError.notFound('User not found'));

        if (!isAdminRoot) {
            // normaler User: nur eigenes Passwort
            if (!isSelf) return next(apiError.forbidden('You cannot update other users'));
            if (username || role || hasEmailField) return next(apiError.forbidden('You cannot change username, e-mail or role'));
            if (!password) return next(apiError.badRequest('Nothing to update'));
        }

        const fields = {};

        if (isAdminRoot && username && username !== target.username) {
            if (username.length < 3) return next(apiError.badRequest('Username must be at least 3 characters'));
            fields.username = username;
        }

        if (isAdminRoot && hasEmailField) {
            if (!isValidEmail(email)) return next(apiError.badRequest('Invalid e-mail address'));
            if (email !== target.email) {
                fields.email = email;
            }
        }

        if (isAdminRoot && role && role !== target.role) {
            if (!ALLOWED_ROLES.has(role)) return next(apiError.badRequest('Invalid role'));
            fields.role = role;
        }

        if (password) {
            const hashed = await bcrypt.hash(password, 12);
            fields.passwordHash = hashed;
        }

        if (Object.keys(fields).length === 0) {
            return next(apiError.forbidden('Nothing to update or insufficient permissions'));
        }

        tableUser.update(db, id, fields, (e, ok) => {
            if (e) {
                const msg = String(e.message || '');
                if (e.code === 'SQLITE_CONSTRAINT' || msg.includes('UNIQUE')) {
                    if (msg.toLowerCase().includes('email')) {
                        return next(apiError.conflict('E-mail already exists'));
                    }
                    return next(apiError.conflict('Username already exists'));
                }
                return next(apiError.internal('Update failed'));
            }
            if (!ok) return next(apiError.notFound('User not found'));
            res.json({ updated: true });
        });
    });
});

// ======================= DELETE /user/:id =======================
// nur admin/root; self-delete blockieren
router.delete('/:id', requireRole('admin', 'root'), (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const { id } = req.params;
    if (req.admin?.sub === id) {
        return next(apiError.badRequest('You cannot delete your own account.'));
    }

    tableUser.deleteById(db, id, (err, ok) => {
        if (err) return next(apiError.internal('Delete failed'));
        if (!ok) return next(apiError.notFound('User not found'));
        res.json({ deleted: true });
    });
});

// ======================= GET /user/me =======================
router.get('/me', (req, res) => {
    const { sub: userId, username, role, roles } = req.admin || {};
    res.json({ userId, username, role, roles });
});

module.exports = router;
