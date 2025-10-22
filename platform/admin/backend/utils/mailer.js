const nodemailer = require('nodemailer');

let transporter = null;

function asBool(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function getTransport(logger) {
    if (transporter) return transporter;

    const host = process.env.MAIL_SERVER_SMTP || process.env.MAIL_SERVER_OUT || process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT_SMTP || process.env.MAIL_PORT || 0);
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASSWORD;

    if (!host || !port || !user || !pass) {
        const message = 'Mail transport not configured: missing host/port/user/password';
        if (logger?.warn) logger.warn(message);
        else console.warn(message);
        return null;
    }

    const secure = asBool(process.env.MAIL_SECURE, port === 465);

    transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: asBool(process.env.MAIL_TLS_IGNORE_INVALID, false) ? { rejectUnauthorized: false } : undefined
    });

    transporter.once('error', (err) => {
        if (logger?.error) logger.error('Mail transport error', { error: err.message });
        else console.error('Mail transport error', err);
        transporter = null;
    });
    return transporter;
}

async function sendMail({ to, subject, text, html, from, logger }) {
    if (!to || !subject || (!text && !html)) {
        if (logger?.warn) logger.warn('sendMail called without required fields', { to, subject });
        else console.warn('sendMail called without required fields', { to, subject });
        return false;
    }

    const transport = getTransport(logger);
    if (!transport) return false;

    const payload = {
        to,
        subject,
        text,
        html,
        from: from || process.env.MAIL_FROM || process.env.MAIL_ADDRESS || process.env.MAIL_USER || 'noreply@messagedrop.de'
    };

    try {
        const info = await transport.sendMail(payload);
        return { success: true, info };
    } catch (err) {
        if (logger?.warn) {
            logger.warn('Failed to send mail', { to, subject, error: err.message });
        } else {
            console.warn('Failed to send mail', { to, subject, error: err.message });
        }
        return { success: false, error: err };
    }
}

module.exports = {
    sendMail
};
