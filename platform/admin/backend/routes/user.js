const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const tableUser = require('../db/tableUser');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

/**
 * Login-Route
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = req.database.db;

    const envUser = process.env.ADMIN_ROOT_USER;
    const envPass = process.env.ADMIN_ROOT_PASSWORD;

    // === Root-User Login ===
    if (username === envUser && password === envPass) {
        const token = jwt.sign({ userId: 'root', username, role: 'root' }, ADMIN_JWT_SECRET, { expiresIn: '2h' });
        return res.json({ token });
    }

    // === Normaler User ===
    tableUser.getByUsername(db, username, async (err, user) => {
        if (err || !user) return res.status(401).json({ message: 'Invalid login' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: 'Invalid login' });

        const token = jwt.sign({
            userId: user.id,
            username: user.username,
            role: user.role
        }, ADMIN_JWT_SECRET, { expiresIn: '2h' });

        res.json({ token });
    });
});

/**
 * Auth-Middleware (einfach gehalten)
 */
const authMiddleware = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing token' });
    }

    try {
        const token = auth.split(' ')[1];
        const payload = jwt.verify(token, ADMIN_JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

/**
 * GET /user - Liste aller User
 */
router.get('/', authMiddleware, (req, res) => {
    const db = req.database.db;

    tableUser.list(db, {}, (err, users) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json(users);
    });
});

/**
 * POST /user - Neuen User anlegen (nur für admin & root)
 */
router.post('/', authMiddleware, async (req, res) => {
    const db = req.database.db;

    // Berechtigung prüfen
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
        return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const { username, password, role = 'moderator' } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Missing username or password' });
    }

    const id = crypto.randomUUID();
    const hashed = await bcrypt.hash(password, 12);
    const createdAt = Date.now();

    tableUser.create(db, id, username, hashed, role, createdAt, (err, result) => {
        if (err) return res.status(500).json({ message: 'Could not create user' });
        res.status(201).json(result);
    });
});


/**
 * PUT /user/:id - User aktualisieren
 * - Root/Admin: dürfen username, role, password für alle ändern
 * - Normale User: dürfen nur ihr eigenes password ändern
 */
router.put('/:id', authMiddleware, async (req, res) => {
    const db = req.database.db;
    const { id } = req.params;
    let { username, role, password } = req.body || {};

    // basic normalize
    if (typeof username === 'string') username = username.trim();
    if (typeof role === 'string') role = role.trim();
    if (typeof password === 'string') password = password.trim();

    if (!username && !role && !password) {
        return res.status(400).json({ message: 'Nothing to update' });
    }

    tableUser.getById(db, id, async (err, target) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        if (!target) return res.status(404).json({ message: 'User not found' });

        const requesterRole = req.user.role;
        const requesterId = req.user.userId;
        const isAdminOrRoot = requesterRole === 'admin' || requesterRole === 'root';
        const isSelf = requesterId === id || req.user.username === target.username;

        // Normale User: nur eigenes Passwort
        if (!isAdminOrRoot) {
            if (!isSelf) {
                return res.status(403).json({ message: 'You cannot update other users' });
            }
            if (username || role) {
                return res.status(403).json({ message: 'You cannot change username or role' });
            }
            if (!password) {
                return res.status(400).json({ message: 'Nothing to update' });
            }
        }

        // Für Admin/Root: validiere role/username
        const allowedRoles = new Set(['moderator', 'admin', 'root']);
        const updates = [];
        const params = [];

        // Username ändern (nur admin/root)
        if (isAdminOrRoot && username && username !== target.username) {
            if (username.length < 3) {
                return res.status(400).json({ message: 'Username must be at least 3 characters' });
            }
            updates.push('username = ?');
            params.push(username);
        }

        // Rolle ändern (nur admin/root)
        if (isAdminOrRoot && role && role !== target.role) {
            if (!allowedRoles.has(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }
            updates.push('role = ?');
            params.push(role);
        }

        // Passwort ändern (admin/root für jeden; normale nur self)
        if (password) {
            const hashed = await bcrypt.hash(password, 12);
            updates.push('password = ?');
            params.push(hashed);
        }

        if (updates.length === 0) {
            return res.status(403).json({ message: 'Nothing to update or insufficient permissions' });
        }

        params.push(id);
        const sql = `UPDATE ${tableUser.tableName} SET ${updates.join(', ')} WHERE id = ?`;

        db.run(sql, params, function (err) {
            if (err) {
                // UNIQUE constraint (username schon vergeben)
                if (err.code === 'SQLITE_CONSTRAINT' || ('' + err.message).includes('UNIQUE')) {
                    return res.status(409).json({ message: 'Username already exists' });
                }
                return res.status(500).json({ message: 'Update failed' });
            }
            res.json({ updated: true });
        });
    });
});

/**
 * DELETE /user/:id - User löschen (nur root & admin)
 */
router.delete('/:id', authMiddleware, (req, res) => {
    const db = req.database.db;
    const { id } = req.params;

    // Nur root oder admin dürfen löschen
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin' && requesterRole !== 'root') {
        return res.status(403).json({ message: 'Insufficient permissions to delete users' });
    }

    const sql = `DELETE FROM ${tableUser.tableName} WHERE id = ?`;
    db.run(sql, [id], function (err) {
        if (err) return res.status(500).json({ message: 'Delete failed' });
        res.json({ deleted: true });
    });
});

router.get('/me', authMiddleware, (req, res) => {
    // Payload aus dem JWT wurde bereits durch die Middleware in req.user gesetzt
    const { userId, username, role } = req.user;
    res.json({ userId, username, role });
});

module.exports = router;