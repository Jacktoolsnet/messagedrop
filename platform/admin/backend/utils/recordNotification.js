const crypto = require('crypto');
const tableNotification = require('../db/tableDsaNotification');
const tableAudit = require('../db/tableDsaAuditLog');

function safeStringify(obj) {
    try {
        return JSON.stringify(obj ?? {});
    } catch {
        return JSON.stringify({ _raw: String(obj) });
    }
}

function recordNotification(db, {
    noticeId = null,
    decisionId = null,
    stakeholder = 'reporter',
    channel = 'inapp',
    payload = {},
    meta = null,
    sentAt = Date.now(),
    auditActor = 'system:notifications',
    auditEvent = 'notification_send',
    logger = null
}) {
    if (!db) return Promise.resolve(null);

    const payloadJson = safeStringify(payload);
    const metaJson = meta ? safeStringify(meta) : null;
    const id = crypto.randomUUID();

    return new Promise((resolve) => {
        tableNotification.create(
            db,
            id,
            noticeId,
            decisionId,
            stakeholder,
            channel,
            sentAt,
            payloadJson,
            metaJson,
            (err) => {
                if (err) {
                    logger?.error?.('Failed to persist notification record', { error: err.message || err });
                    return resolve(null);
                }

                const entityType = noticeId ? 'notice' : (decisionId ? 'decision' : 'notification');
                const entityId = noticeId || decisionId || id;
                const auditDetails = safeStringify({ notificationId: id, stakeholder, channel, meta });

                tableAudit.create(
                    db,
                    crypto.randomUUID(),
                    entityType,
                    entityId,
                    auditEvent,
                    auditActor,
                    sentAt,
                    auditDetails,
                    () => resolve(id)
                );
            }
        );
    });
}

module.exports = {
    recordNotification
};
