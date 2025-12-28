const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const statistic = require('../db/tableStatistic');
const statisticSettings = require('../db/tableStatisticSettings');
const { apiError } = require('../middleware/api-error');

// ===== Helpers =====
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function isValidDateStr(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDateStrUTC(d) {
    return new Date(d).toISOString().slice(0, 10);
}

function addDays(dateStr, delta) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return toDateStrUTC(d);
}

function periodToDays(preset) {
    switch (preset) {
        case '12m': return 365;
        case '6m': return 183;   // ~6 Monate
        case '3m': return 92;    // ~3 Monate
        case '1m': return 31;
        case '1w': return 7;
        case '30d': return 30;
        default: return null;
    }
}
const dateUTC = () => new Date().toISOString().slice(0, 10);

// POST /statistic/count
// Body: { key: string, dateStr?: 'YYYY-MM-DD', amount?: number }
router.post('/count', [security.checkToken], (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const { key, dateStr, amount } = req.body || {};
    if (typeof key !== 'string' || key.trim() === '') {
        return next(apiError.badRequest('invalid_key'));
    }
    const safeDate = (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        ? dateStr
        : dateUTC();
    const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 1;

    statistic.count(db, key, { dateStr: safeDate, amount: safeAmount }, (err) => {
        if (err) return next(apiError.internal('db_error'));
        // Kein Payload nötig, das ist nur ein Increment
        return res.sendStatus(204);
    });
});

// Optional: Lazy-Cleanup vom Backend triggern
// POST /statistic/clean
// Body: { maxDays?: number }
router.post('/clean', [security.checkToken], (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const maxDays = Number.isFinite(Number(req.body?.maxDays)) ? Number(req.body.maxDays) : 365;
    statistic.clean(db, maxDays, (err) => {
        if (err) return next(apiError.internal('db_error'));
        return res.sendStatus(204);
    });
});

/** Gap-Filler: baut lückenlose Tagesreihe [from..to], mit 0 für fehlende Tage */
function fillMissing(from, to, rows) {
    const map = new Map(rows.map(r => [r.date, r.value | 0]));
    const points = [];
    let cur = from;
    while (cur <= to) {
        points.push({ date: cur, value: map.get(cur) ?? 0 });
        cur = addDays(cur, 1);
    }
    return points;
}

// ===== Endpoints =====

/** Settings: Admin-JWT protected (not static token) */
router.get('/settings', [security.requireAdminJwt], (req, res, next) => {
    statisticSettings.getAll(req.database.db, (err, rows) => {
        if (err) return next(apiError.internal('db_error'));
        res.json({ status: 200, settings: rows });
    });
});

router.put('/settings', [security.requireAdminJwt], (req, res, next) => {
    const items = Array.isArray(req.body?.settings) ? req.body.settings : [];
    statisticSettings.upsertMany(req.database.db, items, (err) => {
        if (err) return next(apiError.internal('db_error'));
        res.json({ status: 200, ok: true });
    });
});

router.use(security.requireAdminJwt);

/**
 * GET /statistic/keys
 * Liefert alle verfügbaren Metric-Keys als Array
 */
router.get('/keys', (req, res, next) => {
    statistic.getKeys(req.database.db, (err, keys) => {
        if (err) return next(apiError.internal('db_error'));
        res.json({ status: 200, keys });
    });
});

/**
 * GET /statistic/series/:key
 * Query:
 *  - period: 12m|6m|3m|1m|1w|30d  (oder)
 *  - days: <int>                  (oder)
 *  - from: YYYY-MM-DD & to: YYYY-MM-DD
 *  - fill: true|false (default true)
 *
 * Regeln:
 *  - Maximal 365 Tage
 *  - Default: 30 Tage
 */
router.get('/series/:key', (req, res, next) => {
    const key = String(req.params.key || '').trim();
    if (!key) return next(apiError.badRequest('key_required'));

    const { period, days, from, to, fill } = req.query;

    let fromDate, toDate;

    if (from && to) {
        if (!isValidDateStr(from) || !isValidDateStr(to)) {
            return next(apiError.badRequest('invalid_from_to'));
        }
        if (from > to) {
            return next(apiError.badRequest('invalid_from_to'));
        }
        // clamp auf 365 Tage
        const diffDays = Math.floor((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
        if (diffDays > 366) {
            return next(apiError.badRequest('range_too_large'));
        }
        fromDate = from;
        toDate = to;
    } else {
        let nDays = null;
        if (period) nDays = periodToDays(String(period));
        if (nDays == null && days != null) nDays = clamp(parseInt(String(days), 10) || 30, 1, 365);
        if (nDays == null) nDays = 30;

        toDate = toDateStrUTC(new Date());
        fromDate = addDays(toDate, -nDays + 1);
    }

    statistic.getRangeBetween(req.database.db, key, fromDate, toDate, (err, rows) => {
        if (err) return next(apiError.internal('db_error'));

        const doFill = String(fill ?? 'true').toLowerCase() === 'true';
        const points = doFill ? fillMissing(fromDate, toDate, rows) : rows.map(r => ({ date: r.date, value: r.value | 0 }));

        const total = points.reduce((s, p) => s + p.value, 0);
        const max = points.reduce((m, p) => Math.max(m, p.value), 0);

        res.json({
            status: 200,
            key,
            from: fromDate,
            to: toDate,
            points,           // [{date:'YYYY-MM-DD', value:number}, ...]
            total,
            max
        });
    });
});

/**
 * (Optional) mehrere Keys in einem Call
 * GET /statistic/series?keys=a,b&period=3m&fill=true
 */
router.get('/series', (req, res) => {
    const rawKeys = String(req.query.keys || '').trim();
    if (!rawKeys) return res.status(400).json({ status: 400, error: 'keys_query_required' });
    const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return res.status(400).json({ status: 400, error: 'no_valid_keys' });

    // Zeitraum bestimmen (gleich wie oben)
    const { period, days, from, to, fill } = req.query;
    let fromDate, toDate;

    if (from && to) {
        if (!isValidDateStr(from) || !isValidDateStr(to) || from > to) {
            return res.status(400).json({ status: 400, error: 'invalid_from_to' });
        }
        const diffDays = Math.floor((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
        if (diffDays > 366) {
            return res.status(400).json({ status: 400, error: 'range_too_large' });
        }
        fromDate = from; toDate = to;
    } else {
        let nDays = null;
        if (period) nDays = periodToDays(String(period));
        if (nDays == null && days != null) nDays = clamp(parseInt(String(days), 10) || 30, 1, 365);
        if (nDays == null) nDays = 30;
        toDate = toDateStrUTC(new Date());
        fromDate = addDays(toDate, -nDays + 1);
    }

    const doFill = String(fill ?? 'true').toLowerCase() === 'true';

    // Parallel laden
    const db = req.database.db;
    let remaining = keys.length;
    const out = { status: 200, from: fromDate, to: toDate, series: {} };

    keys.forEach((key) => {
        statistic.getRangeBetween(db, key, fromDate, toDate, (err, rows) => {
            if (err) {
                out.series[key] = { error: err.message };
            } else {
                const points = doFill ? fillMissing(fromDate, toDate, rows) : rows.map(r => ({ date: r.date, value: r.value | 0 }));
                out.series[key] = {
                    points,
                    total: points.reduce((s, p) => s + p.value, 0),
                    max: points.reduce((m, p) => Math.max(m, p.value), 0)
                };
            }
            remaining--;
            if (remaining === 0) res.json(out);
        });
    });
});

module.exports = router;
