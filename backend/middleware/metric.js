// middleware/metricMiddleware.js
// Super-slim metric forwarder -> Admin-Backend (axios, fire-and-forget)

const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');

// === tiny helpers ===
const dateUTC = () => new Date().toISOString().slice(0, 10);
const dateLocal = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const adminStatistic = axios.create({
    baseURL: `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}`,
    timeout: 2500
});

function count(key, opts = {}) {
    const when = opts.when ?? 'success';
    const tz = opts.timezone ?? 'utc';
    const amountOpt = opts.amount ?? 1;
    const audience = process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend';

    return function metricMiddleware(req, res, next) {
        res.on('finish', () => {
            const status = res.statusCode;
            const shouldCount =
                when === 'always' ||
                (when === 'success' && status < 400) ||
                (when === 'error' && status >= 400);
            if (!shouldCount) return;

            const dateStr = tz === 'local' ? dateLocal() : dateUTC();
            const amount = typeof amountOpt === 'function'
                ? Number(amountOpt(req, res)) || 1
                : Number(amountOpt) || 1;

            // Fire-and-forget: kein await/then, nur catch fürs Log
            setImmediate(async () => {
                try {
                    const token = await signServiceJwt({ audience });
                    await adminStatistic.post(
                        '/statistic/count',
                        { key, dateStr, amount },
                        {
                            headers: {
                                'content-type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                        },
                    );
                } catch {
                    // bewusst ignorieren
                }
            });
        });

        next();
    };
}

module.exports = { count };
