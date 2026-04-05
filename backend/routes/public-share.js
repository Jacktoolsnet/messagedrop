const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

const tableMessage = require('../db/tableMessage');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STRINGS = {
  de: {
    unavailableTitle: 'Nachricht nicht verfügbar',
    unavailableDescription: 'Diese öffentliche Nachricht ist nicht verfügbar.',
    pageTitle: 'MessageDrop | Öffentliche Nachricht',
    pageDescription: 'Öffentliche Nachricht auf MessageDrop',
    mediaOnlyDescription: 'Diese öffentliche Nachricht enthält Medien auf MessageDrop.'
  },
  en: {
    unavailableTitle: 'Message unavailable',
    unavailableDescription: 'This public message is not available.',
    pageTitle: 'MessageDrop | Public message',
    pageDescription: 'Public message on MessageDrop',
    mediaOnlyDescription: 'This public message contains media on MessageDrop.'
  },
  es: {
    unavailableTitle: 'Mensaje no disponible',
    unavailableDescription: 'Este mensaje público no está disponible.',
    pageTitle: 'MessageDrop | Mensaje público',
    pageDescription: 'Mensaje público en MessageDrop',
    mediaOnlyDescription: 'Este mensaje público contiene contenido multimedia en MessageDrop.'
  },
  fr: {
    unavailableTitle: 'Message indisponible',
    unavailableDescription: 'Ce message public n’est pas disponible.',
    pageTitle: 'MessageDrop | Message public',
    pageDescription: 'Message public sur MessageDrop',
    mediaOnlyDescription: 'Ce message public contient des médias sur MessageDrop.'
  }
};

let publicMessageTemplateCache = null;

router.get('/assets/public-message.css', function (req, res, next) {
  sendStaticFile(res, getFrontendPath('public', 'site-assets', 'public-message.css'), 'text/css; charset=utf-8', next);
});

router.get('/assets/public-message.js', function (req, res, next) {
  sendStaticFile(res, getFrontendPath('public', 'site-assets', 'public-message.js'), 'application/javascript; charset=utf-8', next);
});

router.get('/assets/sticker-protection-overlay.svg', function (req, res, next) {
  sendStaticFile(res, getFrontendPath('src', 'assets', 'images', 'sticker-protection-overlay.svg'), 'image/svg+xml; charset=utf-8', next);
});

router.get('/assets/icon-192x192.png', function (req, res, next) {
  sendStaticFile(res, getFrontendPath('public', 'icons', 'icon-192x192.png'), 'image/png', next);
});

router.get('/assets/fonts/:fontFile', function (req, res, next) {
  const fontFile = typeof req.params?.fontFile === 'string' ? req.params.fontFile.trim() : '';
  if (!/^[A-Za-z0-9_-]+\.ttf$/i.test(fontFile)) {
    res.status(404).end();
    return;
  }

  sendStaticFile(res, getFrontendPath('src', 'assets', 'fonts', fontFile), 'font/ttf', next);
});

router.get('/:messageUuid', function (req, res) {
  const messageUuid = typeof req.params?.messageUuid === 'string' ? req.params.messageUuid.trim() : '';
  const locale = resolveLocale(req);
  const strings = STRINGS[locale];

  if (!UUID_REGEX.test(messageUuid)) {
    return renderShareShell(res, {
      locale,
      strings,
      status: 404,
      messageUuid,
      title: strings.unavailableTitle,
      description: strings.unavailableDescription
    });
  }

  tableMessage.getByUuid(req.database.db, messageUuid, function (err, row) {
    if (err) {
      return renderShareShell(res, {
        locale,
        strings,
        status: 500,
        messageUuid,
        title: strings.unavailableTitle,
        description: strings.unavailableDescription
      });
    }

    if (!row || String(row.status || '').toLowerCase() !== tableMessage.messageStatus.ENABLED) {
      return renderShareShell(res, {
        locale,
        strings,
        status: 404,
        messageUuid,
        title: strings.unavailableTitle,
        description: strings.unavailableDescription
      });
    }

    const messageText = typeof row.message === 'string' ? row.message.trim() : '';
    const multimedia = parseMultimedia(row.multimedia);
    const description = buildDescription(messageText)
      || (hasMultimedia(multimedia) ? strings.mediaOnlyDescription : strings.pageDescription);
    const title = messageText
      ? `MessageDrop | ${truncate(singleLine(messageText), 72)}`
      : strings.pageTitle;

    return renderShareShell(res, {
      locale,
      strings,
      status: 200,
      messageUuid,
      title,
      description
    });
  });
});

function renderShareShell(res, model) {
  const appBaseUrl = resolvePublicAppBaseUrl(res.req);
  const publicMessageBaseUrl = resolvePublicMessageBaseUrl(res.req);
  const canonicalUrl = `${publicMessageBaseUrl}/${encodeURIComponent(model.messageUuid || '')}`;
  const assetBaseUrl = `${publicMessageBaseUrl}/assets`;
  const bootstrap = {
    messageUuid: model.messageUuid || '',
    appBaseUrl,
    shareBaseUrl: publicMessageBaseUrl,
    assetBaseUrl
  };
  const html = buildShareHtml({
    locale: model.locale,
    title: model.title || model.strings.pageTitle,
    description: model.description || model.strings.pageDescription,
    canonicalUrl,
    assetBaseUrl,
    bootstrap
  });

  res.status(model.status || 200);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
  res.set('Content-Security-Policy', buildPublicMessageContentSecurityPolicy());
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Vary', 'Accept-Language');
  res.send(html);
}

function buildShareHtml(model) {
  const template = loadPublicMessageTemplate();
  const absoluteCssUrl = `${model.assetBaseUrl}/public-message.css`;
  const absoluteJsUrl = `${model.assetBaseUrl}/public-message.js`;
  const absoluteIconUrl = `${model.assetBaseUrl}/icon-192x192.png`;
  const absoluteOverlayUrl = `${model.assetBaseUrl}/sticker-protection-overlay.svg`;

  let html = template;
  html = html.replace(/<html lang="[^"]*">/i, `<html lang="${escapeAttribute(model.locale)}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(model.title)}</title>`);
  html = replaceMetaTag(html, 'name', 'description', model.description);
  html = replaceMetaTag(html, 'property', 'og:title', model.title);
  html = replaceMetaTag(html, 'property', 'og:description', model.description);
  html = replaceMetaTag(html, 'property', 'og:url', model.canonicalUrl);
  html = replaceMetaTag(html, 'name', 'twitter:card', 'summary');
  html = replaceMetaTag(html, 'name', 'twitter:title', model.title);
  html = replaceMetaTag(html, 'name', 'twitter:description', model.description);
  html = removeMetaTag(html, 'property', 'og:image');
  html = removeMetaTag(html, 'name', 'twitter:image');
  html = replaceCanonicalLink(html, model.canonicalUrl);
  html = html.replace(/href="\/icons\/icon-192x192\.png"/i, `href="${escapeAttribute(absoluteIconUrl)}"`);
  html = html.replace(/href="\/site-assets\/public-message\.css"/i, `href="${escapeAttribute(absoluteCssUrl)}"`);
  html = html.replace(/src="\/assets\/images\/sticker-protection-overlay\.svg"/i, `src="${escapeAttribute(absoluteOverlayUrl)}"`);
  html = html.replace(
    /<script src="\/site-assets\/public-message\.js" defer><\/script>/i,
    `<meta name="public-message-bootstrap" content="${escapeAttribute(JSON.stringify(model.bootstrap))}">\n  <script src="${escapeAttribute(absoluteJsUrl)}" defer></script>`
  );
  return html;
}

function loadPublicMessageTemplate() {
  if (publicMessageTemplateCache) {
    return publicMessageTemplateCache;
  }

  const templatePath = path.resolve(__dirname, '..', 'public', 'public-message-template.html');
  publicMessageTemplateCache = fs.readFileSync(templatePath, 'utf8');
  return publicMessageTemplateCache;
}

function getFrontendPath(...segments) {
  return path.resolve(__dirname, '..', '..', 'frontend', ...segments);
}

function sendStaticFile(res, filePath, contentType, next) {
  fs.readFile(filePath, (err, buffer) => {
    if (err) {
      if (typeof next === 'function') {
        next(err);
        return;
      }
      res.status(404).end();
      return;
    }

    res.status(200);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
    res.send(buffer);
  });
}

function replaceMetaTag(html, attrName, attrValue, content) {
  const pattern = new RegExp(`<meta([^>]*${attrName}="${escapeForRegex(attrValue)}"[^>]*)content="[^"]*"([^>]*)>`, 'i');
  return html.replace(pattern, `<meta$1content="${escapeAttribute(content)}"$2>`);
}

function removeMetaTag(html, attrName, attrValue) {
  const pattern = new RegExp(`\\s*<meta[^>]*${attrName}="${escapeForRegex(attrValue)}"[^>]*>\\s*`, 'i');
  return html.replace(pattern, '\n  ');
}

function replaceCanonicalLink(html, href) {
  return html.replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${escapeAttribute(href)}">`);
}

function buildPublicMessageContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https: http:",
    "object-src 'none'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' https: 'unsafe-inline'",
    "connect-src 'self' https: http:",
    [
      "frame-src 'self'",
      'https://www.youtube.com',
      'https://youtube.com',
      'https://www.youtube-nocookie.com',
      'https://youtube-nocookie.com',
      'https://open.spotify.com',
      'https://w.soundcloud.com',
      'https://www.tiktok.com',
      'https://tiktok.com',
      'https://assets.pinterest.com'
    ].join(' ')
  ].join('; ');
}

function escapeForRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveLocale(req) {
  const header = String(req.headers['accept-language'] || '').trim();
  if (!header) {
    return 'en';
  }

  const preferences = header
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [rawLocale, ...params] = entry.split(';').map((part) => part.trim());
      const qualityParam = params.find((part) => part.startsWith('q='));
      const quality = qualityParam ? Number.parseFloat(qualityParam.slice(2)) : 1;
      return {
        locale: rawLocale.toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0
      };
    })
    .sort((left, right) => right.quality - left.quality);

  for (const preference of preferences) {
    if (preference.locale.startsWith('de')) return 'de';
    if (preference.locale.startsWith('es')) return 'es';
    if (preference.locale.startsWith('fr')) return 'fr';
    if (preference.locale.startsWith('en')) return 'en';
  }

  return 'en';
}

function resolvePublicAppBaseUrl(req) {
  const configured = normalizeAbsoluteUrl(process.env.PUBLIC_APP_URL || process.env.APP_URL);
  if (configured) {
    return configured;
  }

  const host = String(req.hostname || req.get?.('host') || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) {
    return 'http://localhost:4200';
  }

  return 'https://messagedrop.de';
}

function resolvePublicMessageBaseUrl(req) {
  const configured = normalizeAbsoluteUrl(process.env.PUBLIC_SHARE_BASE_URL);
  if (configured) {
    return configured.endsWith('/m') ? configured : `${configured}/m`;
  }

  const protocol = req.protocol || 'https';
  const host = typeof req.get === 'function' ? req.get('host') : '';
  return `${protocol}://${String(host || '').trim()}`.replace(/\/$/, '') + '/m';
}

function normalizeAbsoluteUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    return '';
  }

  return '';
}

function parseMultimedia(value) {
  if (value && typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function hasMultimedia(multimedia) {
  const mediaType = typeof multimedia?.type === 'string'
    ? multimedia.type.trim().toLowerCase()
    : '';

  return Boolean(
    (mediaType && mediaType !== 'undefined')
    || (typeof multimedia?.url === 'string' && multimedia.url.trim())
    || (typeof multimedia?.sourceUrl === 'string' && multimedia.sourceUrl.trim())
    || (typeof multimedia?.contentId === 'string' && multimedia.contentId.trim())
  );
}

function buildDescription(value) {
  const normalized = String(value || '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!normalized) {
    return '';
  }
  return truncate(normalized, 220);
}

function singleLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, maxLength) {
  const input = String(value || '');
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength - 1).trimEnd()}…`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;');
}

module.exports = router;
