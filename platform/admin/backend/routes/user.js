// routes/user.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const tableUser = require('../db/tableUser');
const tableLoginOtp = require('../db/tableLoginOtp');
const tableSignal = require('../db/tableDsaSignal');
const tableNotice = require('../db/tableDsaNotice');
const tableDecision = require('../db/tableDsaDecision');
const tableAudit = require('../db/tableDsaAuditLog');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { sendMail } = require('../utils/mailer');
const { sendPushbulletNotification } = require('../utils/pushbullet');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_ISS = process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/';
const ADMIN_AUD = process.env.ADMIN_AUD || 'messagedrop-admin';
const OTP_TTL_MS = Number(process.env.ADMIN_OTP_TTL_MS || 5 * 60 * 1000);
const OTP_LENGTH = 6;
const ADMIN_ROOT_EMAIL = process.env.ADMIN_ROOT_EMAIL || process.env.MAIL_ADDRESS || process.env.MAIL_USER || '';
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

const toBool = (value, fallback = false) => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const isValidEmail = (value) => EMAIL_REGEX.test(normalizeEmail(value));
const isMailConfigured = () => {
    const host = process.env.MAIL_SERVER_SMTP || process.env.MAIL_SERVER_OUT || process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT_SMTP || process.env.MAIL_PORT || 0);
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASSWORD;
    return Boolean(host && port && user && pass);
};

const LOGIN_WINDOW_MS = toNumber(process.env.ADMIN_LOGIN_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const LOGIN_LIMIT = toNumber(process.env.ADMIN_LOGIN_LIMIT, 10);
const VERIFY_LIMIT = toNumber(process.env.ADMIN_LOGIN_VERIFY_LIMIT, 20);
const SLOWDOWN_AFTER = toNumber(process.env.ADMIN_LOGIN_SLOWDOWN_AFTER, 5);
const SLOWDOWN_DELAY_MS = toNumber(process.env.ADMIN_LOGIN_SLOWDOWN_DELAY_MS, 400);
const SLOWDOWN_MAX_MS = toNumber(process.env.ADMIN_LOGIN_SLOWDOWN_MAX_MS, 4000);
const VERIFY_SLOWDOWN_AFTER = toNumber(process.env.ADMIN_LOGIN_VERIFY_SLOWDOWN_AFTER, SLOWDOWN_AFTER);
const VERIFY_SLOWDOWN_DELAY_MS = toNumber(process.env.ADMIN_LOGIN_VERIFY_SLOWDOWN_DELAY_MS, SLOWDOWN_DELAY_MS);
const VERIFY_SLOWDOWN_MAX_MS = toNumber(process.env.ADMIN_LOGIN_VERIFY_SLOWDOWN_MAX_MS, SLOWDOWN_MAX_MS);
const ALLOWED_ROLES = new Set(['author', 'editor', 'moderator', 'legal', 'admin', 'root']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';
const OTP_PUSH_REQUIRED = toBool(process.env.ADMIN_OTP_PUSH_REQUIRED, false);

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
const stripUser = (u) => u && ({
    id: u.id,
    username: u.username,
    email: u.email || '',
    role: u.role,
    publicBackendUserId: u.publicBackendUserId || null,
    createdAt: u.createdAt
});
const isAdminOrRoot = (roles) => (Array.isArray(roles) ? roles : []).some(r => r === 'admin' || r === 'root');
const needsPublicBackendUser = (role) => role === 'editor';

const hashOtp = (otp) => {
    const salt = process.env.ADMIN_OTP_SECRET || ADMIN_JWT_SECRET || '';
    return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
};

const generateOtp = () => {
    return String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
};

function createOtpDeliveryError(message, detail) {
    const err = new Error(message);
    err.detail = detail;
    return err;
}

function formatRoleLabel(role) {
    switch (String(role || '').trim().toLowerCase()) {
        case 'root':
            return 'Root';
        case 'admin':
            return 'Admin';
        case 'author':
            return 'Author';
        case 'editor':
            return 'Editor';
        case 'moderator':
            return 'Moderator';
        case 'legal':
            return 'Legal';
        default:
            return String(role || 'User').trim() || 'User';
    }
}

async function sendOtp({ username, email, role, otp, logger }) {
    const validMinutes = Math.round(OTP_TTL_MS / 60000);
    const roleLabel = formatRoleLabel(role);
    const title = `Messagedrop ${roleLabel} Login OTP`;
    const normalizedEmail = normalizeEmail(email);
    const text = `Code: ${otp}\nUser: ${username}\nRole: ${roleLabel}\nE-Mail: ${normalizedEmail || '-'}\nGültig für ${validMinutes} Minuten.`;
    const html = `
      <p>Hallo ${username},</p>
      <p>dein Messagedrop ${roleLabel} Login-Code lautet: <strong>${otp}</strong></p>
      <p>Benutzername: <strong>${username}</strong><br>Rolle: <strong>${roleLabel}</strong></p>
      <p>Der Code ist ${validMinutes} Minuten gültig.</p>
      <p>Falls du den Login nicht angefordert hast, melde dich bitte sofort beim Root-Admin.</p>
    `;

    let pushSent = false;
    let emailSent = false;
    const deliveryDetail = {
        username,
        email: normalizedEmail || null,
        pushRequired: OTP_PUSH_REQUIRED,
        pushSent: false,
        emailSent: false,
        emailAttempted: false,
        mailConfigured: isMailConfigured(),
        validEmail: isValidEmail(normalizedEmail),
        reasons: []
    };

    try {
        pushSent = await sendPushbulletNotification({
            title,
            body: text,
            logger
        });
    } catch (error) {
        pushSent = false;
        deliveryDetail.reasons.push(`push_exception:${error?.message || error}`);
    }

    deliveryDetail.pushSent = pushSent;
    if (!pushSent) {
        logger?.warn?.('OTP push delivery failed', { username, email: normalizedEmail || null, pushRequired: OTP_PUSH_REQUIRED });
        deliveryDetail.reasons.push('push_failed');
        if (OTP_PUSH_REQUIRED) {
            throw createOtpDeliveryError('otp_push_required_delivery_failed', deliveryDetail);
        }
    }

    if (!deliveryDetail.validEmail) {
        logger?.warn?.('Skipping OTP e-mail delivery (missing/invalid recipient)', { username });
        deliveryDetail.reasons.push('email_invalid_or_missing');
    } else if (!deliveryDetail.mailConfigured) {
        logger?.warn?.('Skipping OTP e-mail delivery (mail transport not configured)', { username, email: normalizedEmail });
        deliveryDetail.reasons.push('mail_transport_not_configured');
    } else {
        deliveryDetail.emailAttempted = true;
        const mailResult = await sendMail({
            to: normalizedEmail,
            subject: title,
            text,
            html,
            logger
        });
        if (!mailResult || mailResult.success === false) {
            logger?.warn?.('OTP e-mail delivery failed (non-blocking)', { username, email: normalizedEmail });
            deliveryDetail.reasons.push('email_send_failed');
        } else {
            emailSent = true;
            deliveryDetail.emailSent = true;
        }
    }

    if (!pushSent && !emailSent) {
        throw createOtpDeliveryError('otp_delivery_failed', deliveryDetail);
    }

    return { pushSent, emailSent };
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
                        await sendOtp({
                            username,
                            email,
                            role: payload?.role,
                            otp,
                            logger
                        });
                        resolve({ id, expiresAt });
                    } catch (deliveryError) {
                        tableLoginOtp.deleteByUsername(db, username, () => reject(deliveryError));
                    }
                });
            });
        });
    });
}

function isUuid(value) {
    return UUID_REGEX.test(String(value || '').trim());
}

function normalizeBlockUntil(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return Math.floor(parsed);
}

function hasBlockUntilValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function resolvePublicBackendBase() {
    return resolveBaseUrl(process.env.BASE_URL, process.env.PORT);
}

async function callPublicBackend(method, endpoint, payload) {
    const baseUrl = resolvePublicBackendBase();
    if (!baseUrl) {
        throw new Error('backend_unavailable');
    }
    const token = await signServiceJwt({ audience: backendAudience });
    return axios.request({
        method,
        url: `${baseUrl}${endpoint}`,
        data: payload,
        timeout: 5000,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        },
        validateStatus: () => true
    });
}

async function createPublicBackendUser(req) {
    const response = await callPublicBackend('post', '/user/create', {});
    if (response.status !== 200 || !response.data?.userId) {
        const apiErr = apiError.badGateway('backend_request_failed');
        apiErr.detail = response.data?.error || response.data?.message || response.statusText || 'public_user_create_failed';
        throw apiErr;
    }
    req.logger?.info?.('Created mapped public backend user', {
        publicBackendUserId: response.data.userId
    });
    return String(response.data.userId);
}

function queryAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

function recordPlatformUserAudit(db, { userId, action, actor, details }, logger) {
    const now = Date.now();
    const detailsJson = (() => {
        try {
            return JSON.stringify(details || null);
        } catch {
            return null;
        }
    })();

    tableAudit.create(
        db,
        crypto.randomUUID(),
        'platform_user',
        userId,
        action,
        actor || 'admin',
        now,
        detailsJson,
        (err) => {
            if (err) {
                logger?.warn?.('Failed to write platform user moderation audit', {
                    userId,
                    action,
                    error: err?.message
                });
            }
        }
    );
}

function parseReportedContent(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

async function buildPlatformUserSummary(db, userId) {
    const [signals, notices, decisions] = await Promise.all([
        queryAll(db, `SELECT id, dismissedAt, reportedContent FROM ${tableSignal.tableName}`),
        queryAll(db, `SELECT id, status, reportedContent FROM ${tableNotice.tableName}`),
        queryAll(db, `SELECT noticeId, outcome FROM ${tableDecision.tableName}`)
    ]);

    const signalRows = signals.filter((row) => {
        const content = parseReportedContent(row.reportedContent);
        return String(content?.userId || '') === userId;
    });

    const noticeRows = notices.filter((row) => {
        const content = parseReportedContent(row.reportedContent);
        return String(content?.userId || '') === userId;
    });

    const noticeIds = new Set(noticeRows.map((row) => row.id));
    const enforcementOutcomes = new Set(['REMOVE_CONTENT', 'REMOVE', 'DISABLE', 'RESTRICT', 'ACCOUNT_ACTION']);
    const linkedDecisions = decisions.filter((row) => noticeIds.has(row.noticeId));
    const enforcedCount = linkedDecisions.filter((row) => enforcementOutcomes.has(String(row.outcome || '').toUpperCase())).length;

    return {
        signals: {
            total: signalRows.length,
            open: signalRows.filter((row) => !row.dismissedAt).length,
            dismissed: signalRows.filter((row) => !!row.dismissedAt).length
        },
        notices: {
            total: noticeRows.length,
            open: noticeRows.filter((row) => String(row.status || '').toUpperCase() !== 'DECIDED').length,
            decided: noticeRows.filter((row) => String(row.status || '').toUpperCase() === 'DECIDED').length
        },
        decisions: {
            total: linkedDecisions.length,
            enforced: enforcedCount
        }
    };
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
                req.logger?.error('Root OTP challenge failed', { error: otpErr?.message, detail: otpErr?.detail });
                const err = apiError.internal('otp_failed');
                err.detail = otpErr?.detail || otpErr?.message;
                return next(err);
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
                req.logger?.error('OTP challenge failed', { error: otpErr?.message, detail: otpErr?.detail });
                const err = apiError.internal('otp_failed');
                err.detail = otpErr?.detail || otpErr?.message;
                return next(err);
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

// ======================= PLATFORM USER MODERATION =======================
router.get('/platform/:userId', requireRole('moderator', 'legal', 'admin', 'root'), async (req, res, next) => {
    const userId = String(req.params.userId || '').trim();
    if (!isUuid(userId)) {
        return next(apiError.badRequest('invalid_user_id'));
    }

    try {
        const [moderationResp, summary] = await Promise.all([
            callPublicBackend('get', `/user/internal/moderation/${encodeURIComponent(userId)}`),
            buildPlatformUserSummary(req.database.db, userId)
        ]);

        if (moderationResp.status === 404) return next(apiError.notFound('not_found'));
        if (moderationResp.status >= 400 || !moderationResp.data?.moderation) {
            const apiErr = apiError.badGateway('backend_request_failed');
            apiErr.detail = moderationResp.data?.error || moderationResp.data?.message || moderationResp.statusText;
            return next(apiErr);
        }

        return res.json({
            status: 200,
            moderation: moderationResp.data.moderation,
            appeals: moderationResp.data.appeals || [],
            summary
        });
    } catch (error) {
        const apiErr = apiError.internal('platform_user_lookup_failed');
        apiErr.detail = error?.message || String(error);
        return next(apiErr);
    }
});

router.get('/platform/appeals/open', requireRole('moderator', 'legal', 'admin', 'root'), async (req, res, next) => {
    const rawLimit = Number(req.query?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 500) : 100;

    try {
        const backendResp = await callPublicBackend('get', `/user/internal/moderation/appeals/open?limit=${encodeURIComponent(String(limit))}`);
        if (backendResp.status >= 400) {
            const apiErr = apiError.badGateway('backend_request_failed');
            apiErr.detail = backendResp.data?.error || backendResp.data?.message || backendResp.statusText;
            return next(apiErr);
        }

        return res.json({
            status: 200,
            appeals: backendResp.data?.appeals || [],
            totalOpen: Number(backendResp.data?.totalOpen || 0)
        });
    } catch (error) {
        const apiErr = apiError.internal('platform_user_appeals_lookup_failed');
        apiErr.detail = error?.message || String(error);
        return next(apiErr);
    }
});

router.patch('/platform/:userId/moderation', requireRole('moderator', 'legal', 'admin', 'root'), async (req, res, next) => {
    const userId = String(req.params.userId || '').trim();
    if (!isUuid(userId)) {
        return next(apiError.badRequest('invalid_user_id'));
    }

    const target = String(req.body?.target || '').toLowerCase();
    const blocked = req.body?.blocked === true || req.body?.blocked === 1 || req.body?.blocked === '1';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null;
    const rawBlockedUntil = req.body?.blockedUntil;
    const blockedUntil = normalizeBlockUntil(req.body?.blockedUntil);
    const actor = req.admin?.username || req.admin?.sub || 'admin';
    const action = target === 'posting'
        ? (blocked ? 'platform_user_posting_block' : 'platform_user_posting_unblock')
        : (blocked ? 'platform_user_account_block' : 'platform_user_account_unblock');

    if (target !== 'posting' && target !== 'account') {
        return next(apiError.badRequest('invalid_target'));
    }
    if (target === 'account') {
        const roles = Array.isArray(req.admin?.roles) ? req.admin.roles : [];
        const mayAccountBlock = roles.includes('admin') || roles.includes('root');
        if (!mayAccountBlock) {
            return next(apiError.forbidden('insufficient_role'));
        }
    }
    if (blocked && hasBlockUntilValue(rawBlockedUntil) && blockedUntil === null) {
        return next(apiError.badRequest('invalid_blocked_until'));
    }
    if (blocked && blockedUntil !== null && blockedUntil < Date.now()) {
        return next(apiError.badRequest('blocked_until_in_past'));
    }

    try {
        const endpoint = target === 'posting'
            ? `/user/internal/moderation/${encodeURIComponent(userId)}/posting`
            : `/user/internal/moderation/${encodeURIComponent(userId)}/account`;

        const moderationResp = await callPublicBackend('patch', endpoint, {
            blocked,
            reason,
            blockedUntil,
            actor
        });

        if (moderationResp.status === 404) return next(apiError.notFound('not_found'));
        if (moderationResp.status >= 400 || !moderationResp.data?.moderation) {
            const apiErr = apiError.badGateway('backend_request_failed');
            apiErr.detail = moderationResp.data?.error || moderationResp.data?.message || moderationResp.statusText;
            return next(apiErr);
        }

        const summary = await buildPlatformUserSummary(req.database.db, userId);
        recordPlatformUserAudit(req.database.db, {
            userId,
            action,
            actor,
            details: {
                target,
                blocked,
                reason,
                blockedUntil,
                moderation: moderationResp.data.moderation,
                appeals: moderationResp.data.appeals || [],
                summary,
                ip: req.ip || null
            }
        }, req.logger);
        return res.json({
            status: 200,
            moderation: moderationResp.data.moderation,
            appeals: moderationResp.data.appeals || [],
            summary
        });
    } catch (error) {
        const apiErr = apiError.internal('platform_user_update_failed');
        apiErr.detail = error?.message || String(error);
        return next(apiErr);
    }
});

router.patch('/platform/appeals/:appealId', requireRole('admin', 'root'), async (req, res, next) => {
    const appealId = String(req.params.appealId || '').trim();
    if (!isUuid(appealId)) {
        return next(apiError.badRequest('invalid_appeal_id'));
    }

    const status = String(req.body?.status || '').trim().toLowerCase();
    const resolutionMessage = typeof req.body?.resolutionMessage === 'string' ? req.body.resolutionMessage.trim() : null;
    const reviewer = req.admin?.username || req.admin?.sub || 'admin';

    if (status !== 'accepted' && status !== 'rejected') {
        return next(apiError.badRequest('invalid_status'));
    }

    try {
        const backendResp = await callPublicBackend('patch', `/user/internal/moderation/appeals/${encodeURIComponent(appealId)}`, {
            status,
            resolutionMessage,
            reviewer
        });

        if (backendResp.status === 404) return next(apiError.notFound('not_found'));
        if (backendResp.status === 409) return next(apiError.conflict(backendResp.data?.error || backendResp.data?.message || 'conflict'));
        if (backendResp.status === 403) return next(apiError.forbidden(backendResp.data?.error || backendResp.data?.message || 'forbidden'));
        if (backendResp.status >= 400 || !backendResp.data?.appeal) {
            const apiErr = apiError.badGateway('backend_request_failed');
            apiErr.detail = backendResp.data?.error || backendResp.data?.message || backendResp.statusText;
            return next(apiErr);
        }

        const appeal = backendResp.data.appeal;
        const summary = await buildPlatformUserSummary(req.database.db, appeal.userId);
        recordPlatformUserAudit(req.database.db, {
            userId: appeal.userId,
            action: status === 'accepted' ? 'platform_user_appeal_accept' : 'platform_user_appeal_reject',
            actor: reviewer,
            details: {
                appealId,
                target: appeal.target,
                status,
                resolutionMessage,
                moderation: backendResp.data.moderation,
                appeals: backendResp.data.appeals || [],
                summary,
                ip: req.ip || null
            }
        }, req.logger);

        return res.json({
            status: 200,
            appeal,
            moderation: backendResp.data.moderation,
            appeals: backendResp.data.appeals || [],
            summary
        });
    } catch (error) {
        const apiErr = apiError.internal('platform_user_appeal_update_failed');
        apiErr.detail = error?.message || String(error);
        return next(apiErr);
    }
});

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
    let publicBackendUserId = null;
    let hashed;
    try {
        if (needsPublicBackendUser(role)) {
            publicBackendUserId = await createPublicBackendUser(req);
        }
        hashed = await bcrypt.hash(password, 12);
    } catch (error) {
        if (error?.status) {
            return next(error);
        }
        req.logger?.error?.('Password hash failed', { error: error?.message });
        return next(apiError.internal('Could not create user'));
    }
    const createdAt = Date.now();

    tableUser.create(db, id, username, email, hashed, role, publicBackendUserId, createdAt, (err, result) => {
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
// admin/root: username/e-mail/role/password; normaler User: eigenes password und eigene e-mail
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
            // normaler User: nur eigenes Passwort und eigene E-Mail
            if (!isSelf) return next(apiError.forbidden('You cannot update other users'));
            if (username || role) return next(apiError.forbidden('You cannot change username or role'));
            if (!password && !hasEmailField) return next(apiError.badRequest('Nothing to update'));
        }

        const fields = {};

        if (isAdminRoot && username && username !== target.username) {
            if (username.length < 3) return next(apiError.badRequest('Username must be at least 3 characters'));
            fields.username = username;
        }

        if ((isAdminRoot || isSelf) && hasEmailField) {
            if (!isValidEmail(email)) return next(apiError.badRequest('Invalid e-mail address'));
            if (email !== target.email) {
                fields.email = email;
            }
        }

        if (isAdminRoot && role && role !== target.role) {
            if (!ALLOWED_ROLES.has(role)) return next(apiError.badRequest('Invalid role'));
            fields.role = role;
        }

        try {
            if (isAdminRoot && role && needsPublicBackendUser(role) && !target.publicBackendUserId) {
                fields.publicBackendUserId = await createPublicBackendUser(req);
            }
        } catch (error) {
            return next(error);
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
