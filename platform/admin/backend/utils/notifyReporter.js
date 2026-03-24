const { sendMail } = require('./mailer');
const { recordNotification } = require('./recordNotification');

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

function formatDecisionOutcomeDe(outcome) {
    if (!outcome) return 'ausstehend';
    switch (String(outcome).toUpperCase()) {
        case 'NO_ACTION':
            return 'kein Handlungsbedarf';
        case 'RESTRICT':
            return 'eingeschränkt';
        case 'FORWARD_TO_AUTHORITY':
            return 'an die zuständige Behörde weitergeleitet';
        case 'REMOVE_CONTENT':
            return 'Inhalt entfernt';
        default:
            return String(outcome).replace(/_/g, ' ').toLowerCase();
    }
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

function buildBilingualDecisionEmail({ greetingName, noticeId, statusUrl, extras }) {
    const outcomeDe = formatDecisionOutcomeDe(extras?.decisionOutcome);
    const outcomeEn = formatDecisionOutcome(extras?.decisionOutcome);
    const processDe = extras?.automatedUsed ? 'automatisiert unterstützt' : 'manuell';
    const processEn = extras?.automatedUsed ? 'automation-assisted' : 'manual';

    const subject = noticeId
        ? `DSA-Entscheidung zu Ihrem Hinweis / DSA decision on your notice (Case #${noticeId})`
        : 'DSA-Entscheidung / DSA decision';

    const germanLines = [];
    if (greetingName) {
        germanLines.push(`Hallo ${greetingName},`, '');
    }
    germanLines.push(
        noticeId ? `wir haben die Prüfung Ihres DSA-Hinweises (Fall #${noticeId}) abgeschlossen.` : 'wir haben die Prüfung Ihres DSA-Hinweises abgeschlossen.',
        `Ergebnis: ${outcomeDe}.`,
        `Prüfungsart: ${processDe}.`
    );
    if (extras?.legalBasisDe) germanLines.push(`Rechtsgrundlage: ${extras.legalBasisDe}`);
    if (extras?.tosBasisDe) germanLines.push(`AGB-/ToS-Grundlage: ${extras.tosBasisDe}`);
    if (extras?.statementDe) germanLines.push(`Begründung: ${extras.statementDe}`);
    if (statusUrl) germanLines.push('', `Live-Status: ${statusUrl}`);
    germanLines.push('', 'Maßgeblich und rechtlich verbindlich ist ausschließlich die deutsche Fassung.', 'Diese Nachricht wurde automatisch versendet. Bitte nicht antworten.');

    const englishLines = ['English service translation (non-binding):', ''];
    if (greetingName) {
        englishLines.push(`Hello ${greetingName},`, '');
    }
    englishLines.push(
        noticeId ? `we completed the review of your DSA notice (Case #${noticeId}).` : 'we completed the review of your DSA notice.',
        `Outcome: ${outcomeEn}.`,
        `Process type: ${processEn}.`
    );
    if (extras?.legalBasisEn) englishLines.push(`Legal basis: ${extras.legalBasisEn}`);
    if (extras?.tosBasisEn) englishLines.push(`Terms of Use basis: ${extras.tosBasisEn}`);
    if (extras?.statementEn) englishLines.push(`Reasoning: ${extras.statementEn}`);
    if (statusUrl) englishLines.push('', `Live status: ${statusUrl}`);
    englishLines.push('', 'The English version is provided for convenience only. In case of discrepancies, the German version is binding.', 'This message was sent automatically. Please do not reply.');

    return {
        subject,
        text: [...germanLines, '', '---', '', ...englishLines].join('\n')
    };
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
            if (extras?.statementDe || extras?.statementEn || extras?.legalBasisDe || extras?.legalBasisEn || extras?.tosBasisDe || extras?.tosBasisEn) {
                return buildBilingualDecisionEmail({ greetingName, noticeId, statusUrl, extras });
            }
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

    const result = await sendMail({
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        logger: req?.logger
    });

    const db = req?.database?.db;
    const meta = {
        event,
        success: result.success,
        error: result.error ? String(result.error?.message || result.error) : null,
        provider: result.info ? { messageId: result.info.messageId ?? result.info?.response ?? null } : null
    };

    if (db) {
        const actor = req?.admin?.sub
            ? `admin:${req.admin.sub}`
            : (req?.user?.sub ? `user:${req.user.sub}` : `public:${req.ip || 'unknown'}`);
        await recordNotification(db, {
            noticeId: notice.id ?? null,
            stakeholder: 'reporter',
            channel: 'email',
            payload: {
                to: email,
                subject: emailContent.subject,
                text: emailContent.text,
                statusUrl: resolvedStatusUrl,
                extras
            },
            meta,
            sentAt: Date.now(),
            auditActor: actor,
            logger: req?.logger
        });
    }

    return result.success;
}

module.exports = {
    notifyReporter
};
