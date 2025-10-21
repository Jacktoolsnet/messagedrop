const { sendMail } = require('./mailer');

function isValidEmail(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function formatDecisionOutcome(outcome) {
    if (!outcome) return 'pending';
    return String(outcome).replace(/_/g, ' ').toLowerCase();
}

function formatAppealOutcome(outcome) {
    if (!outcome) return 'pending';
    switch (String(outcome).toUpperCase()) {
        case 'UPHELD':
            return 'decision upheld';
        case 'REVISED':
            return 'decision revised';
        case 'PARTIAL':
            return 'partially revised';
        case 'WITHDRAWN':
            return 'withdrawn';
        default:
            return String(outcome).replace(/_/g, ' ').toLowerCase();
    }
}

function buildBody({ greetingName, paragraphs, statusUrl }) {
    const lines = [];
    if (greetingName) {
        lines.push(`Hello ${greetingName},`, '');
    }
    lines.push(...paragraphs.filter(Boolean));
    if (statusUrl) {
        lines.push('', `View live updates here: ${statusUrl}`);
    }
    lines.push('', 'This message was sent automatically. Please do not reply.');
    return lines.join('\n');
}

function resolveStatusUrl(notice, statusUrl) {
    if (statusUrl) return statusUrl;
    if (!notice?.publicToken) return null;
    const base = (process.env.PUBLIC_STATUS_BASE_URL || '').replace(/\/+$/, '');
    if (!base) return null;
    return `${base}/${encodeURIComponent(notice.publicToken)}`;
}

function buildEmail({ event, notice, statusUrl, extras }) {
    const noticeId = notice?.id ?? notice?.noticeId;
    const greetingName = notice?.reporterName ? notice.reporterName.trim() : null;
    const refLine = noticeId ? `Case #${noticeId}` : null;

    switch (event) {
        case 'notice_received': {
            const subject = noticeId
                ? `We received your DSA notice (Case #${noticeId})`
                : 'We received your DSA notice';
            const paragraphs = [
                'Thank you for submitting a notice under the Digital Services Act.',
                refLine && `We have registered your report as ${refLine}.`,
                notice?.contentId && `Reported content id: ${notice.contentId}.`,
                'We will review the report and keep you informed about further steps.'
            ];
            return { subject, text: buildBody({ greetingName, paragraphs, statusUrl }) };
        }
        case 'notice_under_review': {
            if (!noticeId) return null;
            const subject = `Your DSA notice ${refLine} is under review`;
            const paragraphs = [
                `Our moderation team has started reviewing ${refLine}.`,
                'We will notify you once a decision has been taken.'
            ];
            return { subject, text: buildBody({ greetingName, paragraphs, statusUrl }) };
        }
        case 'notice_decided': {
            if (!noticeId) return null;
            const outcome = formatDecisionOutcome(extras?.decisionOutcome);
            const subject = `Outcome of your DSA notice ${refLine}`;
            const paragraphs = [
                `We completed the review of ${refLine}.`,
                `Outcome: ${outcome}.`,
                extras?.statement && `Statement: ${extras.statement}`,
            ];
            return { subject, text: buildBody({ greetingName, paragraphs, statusUrl }) };
        }
        case 'notice_appeal_submitted': {
            if (!noticeId) return null;
            const subject = `Appeal filed for your DSA notice ${refLine}`;
            const filedBy = extras?.appealFiledBy || 'the content owner';
            const paragraphs = [
                `An appeal has been filed for ${refLine} by ${filedBy}.`,
                'We will review the appeal to confirm or adjust the original decision.',
            ];
            return { subject, text: buildBody({ greetingName, paragraphs, statusUrl }) };
        }
        case 'notice_appeal_decided': {
            if (!noticeId) return null;
            const appealOutcome = formatAppealOutcome(extras?.appealOutcome);
            const subject = `Appeal outcome for DSA notice ${refLine}`;
            const paragraphs = [
                `We concluded the appeal review for ${refLine}.`,
                `Appeal outcome: ${appealOutcome}.`,
                extras?.decisionOutcome && `Original decision: ${formatDecisionOutcome(extras.decisionOutcome)}.`,
                extras?.reason && `Notes: ${extras.reason}`,
            ];
            return { subject, text: buildBody({ greetingName, paragraphs, statusUrl }) };
        }
        default:
            return null;
    }
}

async function notifyReporter(req, { event, notice, statusUrl, extras = {} }) {
    if (!notice) return false;
    const email = notice.reporterEmail && notice.reporterEmail.trim();
    if (!isValidEmail(email)) return false;

    const resolvedStatusUrl = resolveStatusUrl(notice, statusUrl);
    const emailContent = buildEmail({ event, notice, statusUrl: resolvedStatusUrl, extras });
    if (!emailContent) return false;

    return sendMail({
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        logger: req?.logger
    });
}

module.exports = {
    notifyReporter
};
