const axios = require('axios');
const { recordNotification } = require('./recordNotification');
const { signServiceJwt } = require('./serviceJwt');

function truncate(text, maxLength = 160) {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return text || '';
    }
    return `${text.slice(0, maxLength - 1)}…`;
}

function resolveBackendBase() {
    const base = (process.env.BASE_URL || '').replace(/\/+$/, '');
    if (!base) return null;
    return process.env.PORT ? `${base}:${process.env.PORT}` : base;
}

async function notifyContentOwner(req, notification) {
    const { contentId } = notification || {};
    const baseUrl = resolveBackendBase();
    if (!contentId || !baseUrl) {
        return false;
    }

    const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';

    try {
        const serviceToken = await signServiceJwt({ audience: backendAudience });
        const headers = {
            Authorization: `Bearer ${serviceToken}`,
            Accept: 'application/json'
        };
        const messageResp = await axios.get(
            `${baseUrl}/message/get/uuid/${encodeURIComponent(contentId)}`,
            {
                headers,
                timeout: 5000,
                validateStatus: () => true
            }
        );

        if (messageResp.status !== 200 || messageResp.data?.status !== 200 || !messageResp.data?.message) {
            return false;
        }

        const message = messageResp.data.message;
        if (!message?.userId) {
            return false;
        }

        const type = notification.type || 'signal';
        const event = notification.event || type;
        const excerpt = truncate(message.message || '', 180);

        const customSegments = Array.isArray(notification.bodySegments) && notification.bodySegments.length > 0;
        const includeExcerpt = notification.includeExcerpt !== false;

        let segments = [];
        if (customSegments) {
            segments = [...notification.bodySegments];
        } else {
            if (type === 'signal') {
                segments.push('We received a DSA signal about one of your messages.');
            } else if (type === 'notice') {
                segments.push('We opened a formal DSA notice regarding your content.');
            } else {
                segments.push('There is an update regarding one of your messages.');
            }

            if (notification.category) {
                segments.push(`Category: ${notification.category}`);
            }
            if (notification.reasonText) {
                segments.push(`Reason: ${notification.reasonText}`);
            }
        }

        if (includeExcerpt && excerpt) {
            segments.push(`Message excerpt: "${excerpt}"`);
        }
        if (notification.statusUrl) {
            segments.push('You can review the case via the status page.');
        }

        const metadata = {
            contentId: message.uuid,
            messageId: message.id,
            category: notification.category ?? null,
            reasonText: notification.reasonText ?? null,
            reportedContentType: notification.reportedContentType ?? null,
            dsa: {
                type,
                event,
                caseId: notification.caseId ?? null,
                token: notification.token ?? null,
                statusUrl: notification.statusUrl ?? null
            }
        };

        const deliveryPayload = {
            userId: message.userId,
            title: notification.title || (type === 'signal' ? 'New DSA signal' : 'DSA update'),
            body: notification.body || segments.join(' '),
            category: 'dsa',
            source: 'digital-service-act',
            metadata
        };

        const response = await axios.post(
            `${baseUrl}/notification/create`,
            deliveryPayload,
            {
                headers,
                timeout: 5000,
                validateStatus: () => true
            }
        );

        const success = response.status >= 200 && response.status < 300;

        const db = req?.database?.db;
        if (db) {
            const stakeholder = 'uploader';
            const recordPayload = {
                destination: message.userId,
                title: deliveryPayload?.title,
                body: deliveryPayload?.body,
                metadata
            };
            const meta = {
                event,
                responseStatus: response.status,
                success
            };
            await recordNotification(db, {
                noticeId: notification.type === 'notice' ? notification.caseId ?? null : null,
                decisionId: notification.type === 'decision' ? notification.caseId ?? null : null,
                stakeholder,
                channel: 'inapp',
                payload: recordPayload,
                meta,
                sentAt: Date.now(),
                auditActor: 'system:messagedrop',
                logger: req?.logger
            });
        }

        if (success) {
            return true;
        }

        req.logger?.warn?.('Notification creation returned non-2xx', {
            status: response.status,
            type,
            event,
            contentId
        });
        return false;
    } catch (error) {
        const db = req?.database?.db;
        if (db) {
            await recordNotification(db, {
                noticeId: notification.type === 'notice' ? notification.caseId ?? null : null,
                decisionId: notification.type === 'decision' ? notification.caseId ?? null : null,
                stakeholder: 'uploader',
                channel: 'inapp',
                payload: notification,
                meta: {
                    event: notification.event || notification.type,
                    success: false,
                    error: String(error?.message || error)
                },
                sentAt: Date.now(),
                auditActor: 'system:messagedrop',
                logger: req?.logger
            });
        }

        req.logger?.warn?.('Failed to send system notification to uploader', {
            error: error.message,
            event: notification.event || notification.type,
            contentId
        });
        return false;
    }
}

module.exports = {
    notifyContentOwner
};
