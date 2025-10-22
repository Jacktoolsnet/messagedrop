const crypto = require('crypto');
const tableNotification = require('../db/tableDsaNotification');

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
    sentAt = Date.now()
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
            (err) => resolve(err ? null : id)
        );
    });
}

module.exports = {
    recordNotification
};
