// routes/user.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');

const tableUser = require('../db/tableUser');
const tableLoginOtp = require('../db/tableLoginOtp');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_ISS = process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/';
const ADMIN_AUD = process.env.ADMIN_AUD || 'messagedrop-admin';
const OTP_TTL_MS = Number(process.env.ADMIN_OTP_TTL_MS || 5 * 60 * 1000);
const OTP_LENGTH = 6;

// Helpers
const stripUser = (u) => u && ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt });
const isAdminOrRoot = (roles) => (Array.isArray(roles) ? roles : []).some(r => r === 'admin' || r === 'root');

const getMakeConfig = () => ({
    url: process.env.MAKE_PUSHBULLET_WEBHOOK_URL,
    apiKey: process.env.MAKE_API_KEY
});

async function sendMakePush(title, text, { logger, strict } = { strict: false }) {
    const { url, apiKey } = getMakeConfig();
    if (!url || !apiKey) {
        if (strict) throw new Error('MAKE_PUSHBULLET_WEBHOOK_URL/MAKE_API_KEY missing');
        return;
    }
    try {
        await axios.post(url, { title, text }, {
            headers: { 'x-make-apikey': apiKey },
            timeout: 4000,
            validateStatus: () => true
        });
    } catch (err) {
        logger?.warn?.('Pushbullet notify failed', { error: err?.message });
        if (strict) throw err;
    }
}

const hashOtp = (otp) => {
    const salt = process.env.ADMIN_OTP_SECRET || ADMIN_JWT_SECRET || '';
    return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
};

const generateOtp = () => {
    return String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
};

async function sendOtp(username, otp, logger) {
    const title = 'Messagedrop Admin Login';
    const text = `Code: ${otp}\nUser: ${username}\nGültig für ${Math.round(OTP_TTL_MS / 60000)} Minuten.`;

    await sendMakePush(title, text, { logger, strict: true }).catch((err) => {
        logger?.warn?.('OTP delivery failed', { error: err?.message });
        throw new Error('otp_delivery_failed');
    });
}

async function notifyLoginFailure(username, reason, logger) {
    const title = 'Messagedrop Admin Login Failure';
    const text = `User: ${username || 'unknown'}\nReason: ${reason}`;
    await sendMakePush(title, text, { logger, strict: false });
}

function createChallenge(db, username, payload, logger) {
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
                        await sendOtp(username, otp, logger);
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
router.post('/login', async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const { username, password } = req.body || {};
    const envUser = process.env.ADMIN_ROOT_USER;
    const envPass = process.env.ADMIN_ROOT_PASSWORD || process.env.ADMIN_ROOT_PASSWORT; // Fallback

    try {
        // Root via ENV
        if (username === envUser && password === envPass) {
            try {
                const { id, expiresAt } = await createChallenge(db, username, { sub: 'root', username, role: 'root', roles: ['root'] }, req.logger);
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

            try {
                const { id, expiresAt } = await createChallenge(
                    db,
                    user.username,
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

router.post('/login/verify', async (req, res, next) => {
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

    let { username, password, role = 'moderator' } = req.body || {};
    username = typeof username === 'string' ? username.trim() : '';
    password = typeof password === 'string' ? password.trim() : '';

    if (!username || !password) {
        return next(apiError.badRequest('Missing username or password'));
    }

    const id = crypto.randomUUID();
    const hashed = await bcrypt.hash(password, 12);
    const createdAt = Date.now();

    tableUser.create(db, id, username, hashed, role, createdAt, (err, result) => {
        if (err) {
            const msg = String(err.message || '');
            if (err.code === 'SQLITE_CONSTRAINT' || msg.includes('UNIQUE')) {
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
    let { username, role, password } = req.body || {};
    if (typeof username === 'string') username = username.trim();
    if (typeof role === 'string') role = role.trim();
    if (typeof password === 'string') password = password.trim();

    if (!username && !role && !password) {
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
            if (username || role) return next(apiError.forbidden('You cannot change username or role'));
            if (!password) return next(apiError.badRequest('Nothing to update'));
        }

        const allowedRoles = new Set(['moderator', 'admin', 'root']);
        const fields = {};

        if (isAdminRoot && username && username !== target.username) {
            if (username.length < 3) return next(apiError.badRequest('Username must be at least 3 characters'));
            fields.username = username;
        }

        if (isAdminRoot && role && role !== target.role) {
            if (!allowedRoles.has(role)) return next(apiError.badRequest('Invalid role'));
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
