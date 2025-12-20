const express = require('express');
const crypto = require('crypto');
const security = require('../middleware/security');
const tableNotification = require('../db/tableNotification');

const router = express.Router();

router.use(security.checkToken);
router.use(express.json({ limit: '1mb' }));

const ALLOWED_STATUSES = new Set(Object.values(tableNotification.notificationStatus));

function getAuthenticatedUserId(req) {
    if (req.jwtUser?.userId) {
        return req.jwtUser.userId;
    }
    if (req.jwtUser?.id) {
        return req.jwtUser.id;
    }
    return null;
}

function ensureSameUser(req, res, userId) {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
        res.status(401).json({ status: 401, error: 'unauthorized' });
        return false;
    }
    if (authUserId !== userId) {
        res.status(403).json({ status: 403, error: 'forbidden' });
        return false;
    }
    return true;
}

function normalizeMetadata(raw) {
    if (raw === null || raw === undefined || raw === '') {
        return null;
    }
    if (typeof raw === 'object') {
        return raw;
    }
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return { value: raw };
        }
    }
    return { value: raw };
}

router.post('/create', [security.authenticate], (req, res) => {
    const { userId, title, body } = req.body || {};

    if (!userId || !title || !body) {
        return res.status(400).json({
            status: 400,
            error: 'missing_required_fields'
        });
    }

    if (!ensureSameUser(req, res, userId)) {
        return;
    }

    const uuid = req.body.uuid && typeof req.body.uuid === 'string'
        ? req.body.uuid
        : crypto.randomUUID();

    const category = typeof req.body.category === 'string' && req.body.category.trim() !== ''
        ? req.body.category.trim()
        : 'general';

    const source = typeof req.body.source === 'string' && req.body.source.trim() !== ''
        ? req.body.source.trim()
        : null;

    const requestedStatus = typeof req.body.status === 'string' ? req.body.status.toLowerCase() : tableNotification.notificationStatus.UNREAD;
    const status = ALLOWED_STATUSES.has(requestedStatus)
        ? requestedStatus
        : tableNotification.notificationStatus.UNREAD;

    const metadata = normalizeMetadata(req.body.metadata);

    tableNotification.create(
        req.database.db,
        {
            uuid,
            userId,
            title,
            body,
            category,
            source,
            status,
            metadata
        },
        (err, notification) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    error: err.message || 'failed_to_create_notification'
                });
            }

            return res.status(200).json({
                status: 200,
                notification
            });
        }
    );
});

router.get('/list/:userId', [security.authenticate], (req, res) => {
    const userId = req.params.userId;
    if (!ensureSameUser(req, res, userId)) {
        return;
    }

    const rawStatus = typeof req.query.status === 'string'
        ? req.query.status.toLowerCase()
        : 'unread';

    const status = rawStatus === 'all' || ALLOWED_STATUSES.has(rawStatus)
        ? rawStatus
        : 'unread';

    let limit = parseInt(req.query.limit, 10);
    if (Number.isNaN(limit) || limit <= 0) {
        limit = 25;
    }
    limit = Math.min(limit, 100);

    let offset = parseInt(req.query.offset, 10);
    if (Number.isNaN(offset) || offset < 0) {
        offset = 0;
    }

    tableNotification.getByUserId(
        req.database.db,
        userId,
        { status, limit, offset },
        (err, notifications) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    error: err.message || 'failed_to_load_notifications'
                });
            }

            return res.status(200).json({
                status: 200,
                rows: notifications
            });
        }
    );
});

router.get('/count/unread/:userId', [security.authenticate], (req, res) => {
    const userId = req.params.userId;
    if (!ensureSameUser(req, res, userId)) {
        return;
    }

    tableNotification.countByUserIdAndStatus(
        req.database.db,
        userId,
        tableNotification.notificationStatus.UNREAD,
        (err, total) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    error: err.message || 'failed_to_count_notifications'
                });
            }

            return res.status(200).json({
                status: 200,
                total
            });
        }
    );
});

function handleMarkStatus(req, res, targetStatus) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ status: 401, error: 'unauthorized' });
    }

    const uuids = Array.isArray(req.body?.uuids)
        ? req.body.uuids.filter((value) => typeof value === 'string' && value.trim() !== '')
        : [];

    if (uuids.length === 0) {
        return res.status(400).json({ status: 400, error: 'invalid_request' });
    }

    const markFn = targetStatus === tableNotification.notificationStatus.UNREAD
        ? tableNotification.markManyAsUnread
        : tableNotification.markManyAsRead;

    markFn(
        req.database.db,
        userId,
        uuids,
        (err) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    error: err.message || 'failed_to_mark_notifications'
                });
            }

            tableNotification.getByUuids(
                req.database.db,
                uuids,
                (fetchErr, updated) => {
                    if (fetchErr) {
                        return res.status(500).json({
                            status: 500,
                            error: fetchErr.message || 'failed_to_fetch_notifications'
                        });
                    }

                    const filtered = updated.filter((item) => item && item.userId === userId);
                    const lookup = new Map(filtered.map(item => [item.uuid, item]));
                    const ordered = uuids.map(uuid => lookup.get(uuid)).filter(Boolean);

                    return res.status(200).json({
                        status: 200,
                        rows: ordered
                    });
                }
            );
        }
    );
}

router.patch('/mark-read', [security.authenticate], (req, res) => {
    handleMarkStatus(req, res, tableNotification.notificationStatus.READ);
});

router.patch('/mark-unread', [security.authenticate], (req, res) => {
    handleMarkStatus(req, res, tableNotification.notificationStatus.UNREAD);
});

router.patch('/mark', [security.authenticate], (req, res) => {
    const requestedStatus = typeof req.body?.status === 'string'
        ? req.body.status.toLowerCase()
        : tableNotification.notificationStatus.READ;

    const targetStatus = requestedStatus === tableNotification.notificationStatus.UNREAD
        ? tableNotification.notificationStatus.UNREAD
        : tableNotification.notificationStatus.READ;

    handleMarkStatus(req, res, targetStatus);
});

router.delete('/delete', [security.authenticate], (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ status: 401, error: 'unauthorized' });
    }

    const uuids = Array.isArray(req.body?.uuids)
        ? req.body.uuids.filter((value) => typeof value === 'string' && value.trim() !== '')
        : [];

    if (uuids.length === 0) {
        return res.status(400).json({ status: 400, error: 'invalid_request' });
    }

    tableNotification.deleteMany(req.database.db, userId, uuids, (err, changes) => {
        if (err) {
            return res.status(500).json({
                status: 500,
                error: err.message || 'failed_to_delete_notifications'
            });
        }

        return res.status(200).json({
            status: 200,
            deleted: changes || 0
        });
    });
});

module.exports = router;
