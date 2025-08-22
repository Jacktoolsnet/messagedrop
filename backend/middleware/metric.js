// middleware/metricMiddleware.js
const statistic = require('../db/tableStatistic');

// kleine Helfer
const dateUTC = () => new Date().toISOString().slice(0, 10);
const dateLocal = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Middleware-Factory zum Zählen pro Route/Key
 *
 * @param {string} key      - Metrikname (z. B. 'auth.login', 'message.created')
 * @param {object} opts
 *   when: 'success' | 'always' | 'error'   (Default: 'success')
 *   timezone: 'utc' | 'local'              (Default: 'utc')
 *   amount: number | (req,res)=>number     (Default: 1)
 *   cleanOlderThanDays: number             (Default: 365)
 *   cleanEvery: number                     (Default: 500) – Lazy Cleanup
 */
function count(key, opts = {}) {
    const when = opts.when ?? 'success';
    const tz = opts.timezone ?? 'utc';
    const amountOpt = opts.amount ?? 1;
    const cleanOlderThanDays = Number(opts.cleanOlderThanDays ?? 365);
    const cleanEvery = Number(opts.cleanEvery ?? 500);

    let calls = 0;

    return function (req, res, next) {
        const db = req.database?.db;
        if (!db) return next();

        res.on('finish', () => {
            const status = res.statusCode;

            const shouldCount =
                (when === 'always') ||
                (when === 'success' && status < 400) ||
                (when === 'error' && status >= 400);

            if (!shouldCount) return;

            const dateStr = tz === 'local' ? dateLocal() : dateUTC();
            const amount = typeof amountOpt === 'function'
                ? Number(amountOpt(req, res)) || 1
                : Number(amountOpt) || 1;

            statistic.count(db, key, { dateStr, amount }, (err) => {
                if (err && req.logger) req.logger.warn(`metric(${key}) failed: ${err.message}`);
            });

            // Lazy Cleanup
            calls++;
            if (calls % cleanEvery === 0) {
                statistic.clean(db, cleanOlderThanDays, (err) => {
                    if (err && req.logger) req.logger.warn(`metric.clean failed: ${err.message}`);
                });
            }
        });

        next();
    };
}

module.exports = { count };