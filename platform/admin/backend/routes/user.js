// routes/user.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const tableUser = require('../db/tableUser');
const { requireAdminJwt, requireRole } = require('../middleware/security');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_ISS = process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/';
const ADMIN_AUD = process.env.ADMIN_AUD || 'messagedrop-admin';

// Helpers
const stripUser = (u) => u && ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt });
const isAdminOrRoot = (roles) => (Array.isArray(roles) ? roles : []).some(r => r === 'admin' || r === 'root');

// ======================= LOGIN (ohne Guard) =======================
router.post('/login', async (req, res) => {
    const db = req.database?.db;
    if (!db) return res.status(500).json({ message: 'database_unavailable' });

    const { username, password } = req.body || {};
    const envUser = process.env.ADMIN_ROOT_USER;
    const envPass = process.env.ADMIN_ROOT_PASSWORD || process.env.ADMIN_ROOT_PASSWORT; // Fallback

    try {
        // Root via ENV
        if (username === envUser && password === envPass) {
            const token = jwt.sign(
                { sub: 'root', username, role: 'root', roles: ['root'] },
                ADMIN_JWT_SECRET,
                { expiresIn: '2h', issuer: ADMIN_ISS, audience: ADMIN_AUD }
            );
            return res.json({ token });
        }

        // Normale User
        tableUser.getByUsername(db, username, async (err, user) => {
            if (err || !user) return res.status(401).json({ message: 'Invalid login' });
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ message: 'Invalid login' });

            const token = jwt.sign(
                { sub: user.id, username: user.username, role: user.role, roles: [user.role] },
                ADMIN_JWT_SECRET,
                { expiresIn: '2h', issuer: ADMIN_ISS, audience: ADMIN_AUD }
            );
            res.json({ token });
        });
    } catch (error) {
        req.logger?.error('Admin login failed', { error: error?.message });
        res.status(500).json({ message: 'login_failed' });
    }
});

// Ab hier: Admin-JWT Pflicht
router.use(requireAdminJwt);

// ======================= GET /user =======================
// admin/root: alle; sonst: nur eigener
router.get('/', (req, res) => {
    const db = req.database?.db;
    if (!db) return res.status(500).json({ message: 'database_unavailable' });

    const roles = Array.isArray(req.admin?.roles) ? req.admin.roles : [];
    const sub = req.admin?.sub;
    const uname = req.admin?.username;

    if (isAdminOrRoot(roles)) {
        tableUser.list(db, {}, (err, users) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            res.json(users.map(stripUser));
        });
    } else {
        tableUser.getById(db, sub, (err, u) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            if (u) return res.json([stripUser(u)]);
            tableUser.getByUsername(db, uname, (err2, u2) => {
                if (err2) return res.status(500).json({ message: 'DB error' });
                res.json(u2 ? [stripUser(u2)] : []);
            });
        });
    }
});

// ======================= POST /user =======================
// nur admin/root
router.post('/', requireRole('admin', 'root'), async (req, res) => {
    const db = req.database?.db;
    if (!db) return res.status(500).json({ message: 'database_unavailable' });

    let { username, password, role = 'moderator' } = req.body || {};
    username = typeof username === 'string' ? username.trim() : '';
    password = typeof password === 'string' ? password.trim() : '';

    if (!username || !password) {
        return res.status(400).json({ message: 'Missing username or password' });
    }

    const id = crypto.randomUUID();
    const hashed = await bcrypt.hash(password, 12);
    const createdAt = Date.now();

    tableUser.create(db, id, username, hashed, role, createdAt, (err, result) => {
        if (err) {
            const msg = String(err.message || '');
            if (err.code === 'SQLITE_CONSTRAINT' || msg.includes('UNIQUE')) {
                return res.status(409).json({ message: 'Username already exists' });
            }
            return res.status(500).json({ message: 'Could not create user' });
        }
        res.status(201).json(result); // { id }
    });
});

// ======================= PUT /user/:id =======================
// admin/root: username/role/password; normaler User: nur eigenes password
router.put('/:id', async (req, res) => {
    const db = req.database?.db;
    if (!db) return res.status(500).json({ message: 'database_unavailable' });

    const { id } = req.params;
    let { username, role, password } = req.body || {};
    if (typeof username === 'string') username = username.trim();
    if (typeof role === 'string') role = role.trim();
    if (typeof password === 'string') password = password.trim();

    if (!username && !role && !password) {
        return res.status(400).json({ message: 'Nothing to update' });
    }

    const roles = Array.isArray(req.admin?.roles) ? req.admin.roles : [];
    const isAdminRoot = isAdminOrRoot(roles);
    const isSelf = req.admin?.sub === id;

    tableUser.getById(db, id, async (err, target) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        if (!target) return res.status(404).json({ message: 'User not found' });

        if (!isAdminRoot) {
            // normaler User: nur eigenes Passwort
            if (!isSelf) return res.status(403).json({ message: 'You cannot update other users' });
            if (username || role) return res.status(403).json({ message: 'You cannot change username or role' });
            if (!password) return res.status(400).json({ message: 'Nothing to update' });
        }

        const allowedRoles = new Set(['moderator', 'admin', 'root']);
        const fields = {};

        if (isAdminRoot && username && username !== target.username) {
            if (username.length < 3) return res.status(400).json({ message: 'Username must be at least 3 characters' });
            fields.username = username;
        }

        if (isAdminRoot && role && role !== target.role) {
            if (!allowedRoles.has(role)) return res.status(400).json({ message: 'Invalid role' });
            fields.role = role;
        }

        if (password) {
            const hashed = await bcrypt.hash(password, 12);
            fields.passwordHash = hashed;
        }

        if (Object.keys(fields).length === 0) {
            return res.status(403).json({ message: 'Nothing to update or insufficient permissions' });
        }

        tableUser.update(db, id, fields, (e, ok) => {
            if (e) {
                const msg = String(e.message || '');
                if (e.code === 'SQLITE_CONSTRAINT' || msg.includes('UNIQUE')) {
                    return res.status(409).json({ message: 'Username already exists' });
                }
                return res.status(500).json({ message: 'Update failed' });
            }
            if (!ok) return res.status(404).json({ message: 'User not found' });
            res.json({ updated: true });
        });
    });
});

// ======================= DELETE /user/:id =======================
// nur admin/root; self-delete blockieren
router.delete('/:id', requireRole('admin', 'root'), (req, res) => {
    const db = req.database?.db;
    if (!db) return res.status(500).json({ message: 'database_unavailable' });

    const { id } = req.params;
    if (req.admin?.sub === id) {
        return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    tableUser.deleteById(db, id, (err, ok) => {
        if (err) return res.status(500).json({ message: 'Delete failed' });
        if (!ok) return res.status(404).json({ message: 'User not found' });
        res.json({ deleted: true });
    });
});

// ======================= GET /user/me =======================
router.get('/me', (req, res) => {
    const { sub: userId, username, role, roles } = req.admin || {};
    res.json({ userId, username, role, roles });
});

module.exports = router;
