// db/tableUser.js
const tableName = 'tableUser';

// === Spalten definieren ===
const columnId = 'id';                // TEXT PK (uuid) -> extern erzeugt
const columnUsername = 'username';    // TEXT UNIQUE NOT NULL
const columnEmail = 'email';          // TEXT UNIQUE NOT NULL
const columnPassword = 'password';    // TEXT NOT NULL (bcrypt-Hash)
const columnRole = 'role';            // TEXT NOT NULL ('root', 'admin', 'moderator', ...)
const columnCreatedAt = 'createdAt';  // INTEGER NOT NULL (unix ms)

// === INIT: create table + indexes ===
const init = function (db) {
    try {
        const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnUsername} TEXT UNIQUE NOT NULL,
        ${columnEmail} TEXT UNIQUE NOT NULL,
        ${columnPassword} TEXT NOT NULL,
        ${columnRole} TEXT NOT NULL DEFAULT 'moderator',
        ${columnCreatedAt} INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_user_username
        ON ${tableName}(${columnUsername});
      CREATE INDEX IF NOT EXISTS idx_user_role
        ON ${tableName}(${columnRole});
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email
        ON ${tableName}(${columnEmail});
      CREATE INDEX IF NOT EXISTS idx_user_createdAt_desc
        ON ${tableName}(${columnCreatedAt} DESC);
    `;
        db.exec(sql, (err) => {
            if (err) throw err;
        });

        // Best effort for bestehende Installationen ohne email-Spalte
        db.all(`PRAGMA table_info(${tableName})`, [], (pragmaErr, rows) => {
            if (pragmaErr || !Array.isArray(rows)) return;
            const hasEmailColumn = rows.some((row) => row?.name === columnEmail);
            if (hasEmailColumn) {
                db.run(`
                  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email
                    ON ${tableName}(${columnEmail})
                `, []);
                return;
            }
            db.run(`
              ALTER TABLE ${tableName}
              ADD COLUMN ${columnEmail} TEXT
            `, [], (alterErr) => {
                if (alterErr) return;
                db.run(`
                  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email
                    ON ${tableName}(${columnEmail})
                `, []);
            });
        });
    } catch (err) {
        throw err;
    }
};

// === CREATE: Benutzer anlegen ===
/**
 * @param {import('sqlite3').Database} db
 * @param {string} id             // UUID (extern erzeugt)
 * @param {string} username       // Login-Name
 * @param {string} email          // OTP-Empfängeradresse
 * @param {string} passwordHash   // gehashter Passwort-String
 * @param {string} role           // z.B. 'root', 'admin', 'moderator'
 * @param {number} createdAt      // Unix ms
 * @param {(err: any, row?: { id: string }) => void} callBack
 */
const create = function (db, id, username, email, passwordHash, role, createdAt, callBack) {
    const stmt = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnUsername},
      ${columnEmail},
      ${columnPassword},
      ${columnRole},
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
    const params = [id, username, email, passwordHash, role, createdAt];
    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

// === GET: User nach ID ===
const getById = function (db, id, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnId} = ? LIMIT 1`;
    db.get(sql, [id], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

// === GET: User nach Username ===
const getByUsername = function (db, username, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnUsername} = ? LIMIT 1`;
    db.get(sql, [username], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

// === LIST: User auflisten ===
/**
 * @param {import('sqlite3').Database} db
 * @param {{ role?: string, limit?: number, offset?: number }} [opts]
 * @param {(err: any, rows?: any[]) => void} callBack
 */
const list = function (db, opts, callBack) {
    const where = [];
    const params = [];
    if (opts?.role) {
        where.push(`${columnRole} = ?`);
        params.push(opts.role);
    }
    let sql = `SELECT * FROM ${tableName}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${columnCreatedAt} DESC`;
    const limit = Number.isFinite(opts?.limit) ? opts.limit : 100;
    const offset = Number.isFinite(opts?.offset) ? opts.offset : 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;
    db.all(sql, params, (err, rows) => {
        if (err) return callBack(err);
        callBack(null, rows);
    });
};

// === UPDATE: dynamisch Felder setzen ===
/**
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {{ username?: string, email?: string, role?: string, passwordHash?: string }} fields
 * @param {(err: any, ok?: boolean) => void} callBack
 */
const update = function (db, id, fields, callBack) {
    const updates = [];
    const params = [];

    if (typeof fields.username === 'string') {
        updates.push(`${columnUsername} = ?`);
        params.push(fields.username);
    }
    if (typeof fields.email === 'string') {
        updates.push(`${columnEmail} = ?`);
        params.push(fields.email);
    }
    if (typeof fields.role === 'string') {
        updates.push(`${columnRole} = ?`);
        params.push(fields.role);
    }
    if (typeof fields.passwordHash === 'string') {
        updates.push(`${columnPassword} = ?`);
        params.push(fields.passwordHash);
    }

    if (updates.length === 0) {
        // nichts zu tun
        return process.nextTick(() => callBack(null, false));
    }

    params.push(id);
    const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${columnId} = ?`;
    db.run(sql, params, function (err) {
        if (err) return callBack(err);
        callBack(null, this.changes > 0);
    });
};

// === DELETE: nach ID ===
/**
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {(err: any, ok?: boolean) => void} callBack
 */
const deleteById = function (db, id, callBack) {
    const sql = `DELETE FROM ${tableName} WHERE ${columnId} = ?`;
    db.run(sql, [id], function (err) {
        if (err) return callBack(err);
        callBack(null, this.changes > 0);
    });
};

module.exports = {
    tableName,
    columns: {
        id: columnId,
        username: columnUsername,
        email: columnEmail,
        password: columnPassword,
        role: columnRole,
        createdAt: columnCreatedAt
    },
    init,
    create,
    getById,
    getByUsername,
    list,
    update,
    deleteById
};
