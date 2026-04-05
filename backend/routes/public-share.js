const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const router = express.Router();

const tableMessage = require('../db/tableMessage');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const MAX_EMBEDDED_IMAGE_BYTES = 4 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT_MS = 6000;

const STRINGS = {
  de: {
    heroTitle: 'Öffentliche Nachricht',
    unavailableTitle: 'Nachricht nicht verfügbar',
    unavailableDescription: 'Diese öffentliche Nachricht ist nicht verfügbar.',
    pageTitle: 'MessageDrop | Öffentliche Nachricht',
    pageDescription: 'Öffentliche Nachricht auf MessageDrop',
    mediaOnlyDescription: 'Diese öffentliche Nachricht enthält Medien auf MessageDrop.',
    previewImageAlt: 'Vorschaubild einer öffentlichen Nachricht auf MessageDrop',
    stickerLabel: 'Sticker',
    imageLabel: 'Bild',
    mediaLabel: 'Medien'
  },
  en: {
    heroTitle: 'Public message',
    unavailableTitle: 'Message unavailable',
    unavailableDescription: 'This public message is not available.',
    pageTitle: 'MessageDrop | Public message',
    pageDescription: 'Public message on MessageDrop',
    mediaOnlyDescription: 'This public message contains media on MessageDrop.',
    previewImageAlt: 'Preview image for a public message on MessageDrop',
    stickerLabel: 'Sticker',
    imageLabel: 'Image',
    mediaLabel: 'Media'
  },
  es: {
    heroTitle: 'Mensaje público',
    unavailableTitle: 'Mensaje no disponible',
    unavailableDescription: 'Este mensaje público no está disponible.',
    pageTitle: 'MessageDrop | Mensaje público',
    pageDescription: 'Mensaje público en MessageDrop',
    mediaOnlyDescription: 'Este mensaje público contiene contenido multimedia en MessageDrop.',
    previewImageAlt: 'Imagen de vista previa de un mensaje público en MessageDrop',
    stickerLabel: 'Sticker',
    imageLabel: 'Imagen',
    mediaLabel: 'Contenido multimedia'
  },
  fr: {
    heroTitle: 'Message public',
    unavailableTitle: 'Message indisponible',
    unavailableDescription: 'Ce message public n’est pas disponible.',
    pageTitle: 'MessageDrop | Message public',
    pageDescription: 'Message public sur MessageDrop',
    mediaOnlyDescription: 'Ce message public contient des médias sur MessageDrop.',
    previewImageAlt: 'Image d’aperçu d’un message public sur MessageDrop',
    stickerLabel: 'Sticker',
    imageLabel: 'Image',
    mediaLabel: 'Médias'
  }
};

let publicMessageTemplateCache = null;
const embeddedFontCssCache = new Map();

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

router.get('/:messageUuid/og-image.svg', function (req, res) {
  const messageUuid = typeof req.params?.messageUuid === 'string' ? req.params.messageUuid.trim() : '';
  const locale = resolveLocale(req);
  const strings = STRINGS[locale];

  if (!UUID_REGEX.test(messageUuid)) {
    return renderOgImage(res, {
      locale,
      strings,
      status: 404,
      messageUuid,
      message: null
    });
  }

  tableMessage.getByUuid(req.database.db, messageUuid, function (err, row) {
    if (err) {
      return renderOgImage(res, {
        locale,
        strings,
        status: 500,
        messageUuid,
        message: null
      });
    }

    const message = row && String(row.status || '').toLowerCase() === tableMessage.messageStatus.ENABLED
      ? row
      : null;

    return renderOgImage(res, {
      locale,
      strings,
      status: message ? 200 : 404,
      messageUuid,
      message
    });
  });
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
  const imageUrl = model.messageUuid
    ? `${canonicalUrl}/og-image.svg`
    : '';
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
    imageUrl,
    imageAlt: model.strings.previewImageAlt,
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
  html = replaceMetaTag(html, 'name', 'twitter:card', model.imageUrl ? 'summary_large_image' : 'summary');
  html = replaceMetaTag(html, 'name', 'twitter:title', model.title);
  html = replaceMetaTag(html, 'name', 'twitter:description', model.description);
  html = model.imageUrl
    ? upsertMetaTag(html, 'property', 'og:image', model.imageUrl)
    : removeMetaTag(html, 'property', 'og:image');
  html = model.imageUrl
    ? upsertMetaTag(html, 'property', 'og:image:type', 'image/svg+xml')
    : removeMetaTag(html, 'property', 'og:image:type');
  html = model.imageUrl
    ? upsertMetaTag(html, 'property', 'og:image:width', String(OG_IMAGE_WIDTH))
    : removeMetaTag(html, 'property', 'og:image:width');
  html = model.imageUrl
    ? upsertMetaTag(html, 'property', 'og:image:height', String(OG_IMAGE_HEIGHT))
    : removeMetaTag(html, 'property', 'og:image:height');
  html = model.imageUrl
    ? upsertMetaTag(html, 'property', 'og:image:alt', model.imageAlt || model.description)
    : removeMetaTag(html, 'property', 'og:image:alt');
  html = model.imageUrl
    ? upsertMetaTag(html, 'name', 'twitter:image', model.imageUrl)
    : removeMetaTag(html, 'name', 'twitter:image');
  html = model.imageUrl
    ? upsertMetaTag(html, 'name', 'twitter:image:alt', model.imageAlt || model.description)
    : removeMetaTag(html, 'name', 'twitter:image:alt');
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

async function renderOgImage(res, model) {
  try {
    const svg = await buildPublicMessageOgSvg(model);
    res.status(model.status === 500 ? 500 : 200);
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=300');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Vary', 'Accept-Language');
    res.send(svg);
  } catch {
    const fallbackStrings = model.strings || STRINGS[model.locale] || STRINGS.en;
    const fallbackSvg = await buildPublicMessageOgSvg({
      ...model,
      message: null,
      strings: fallbackStrings
    });
    res.status(200);
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=300');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Vary', 'Accept-Language');
    res.send(fallbackSvg);
  }
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

function upsertMetaTag(html, attrName, attrValue, content) {
  const pattern = new RegExp(`<meta([^>]*${attrName}="${escapeForRegex(attrValue)}"[^>]*)content="[^"]*"([^>]*)>`, 'i');
  if (pattern.test(html)) {
    return html.replace(pattern, `<meta$1content="${escapeAttribute(content)}"$2>`);
  }

  return html.replace(
    /<\/head>/i,
    `  <meta ${attrName}="${escapeAttribute(attrValue)}" content="${escapeAttribute(content)}">\n</head>`
  );
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

async function buildPublicMessageOgSvg(model) {
  const strings = model.strings || STRINGS[model.locale] || STRINGS.en;
  const message = model.message && typeof model.message === 'object' ? model.message : null;
  const multimedia = parseMultimedia(message?.multimedia);
  const messageText = typeof message?.message === 'string' ? message.message.trim() : '';
  const fontFamily = extractAllowedFontFamily(message?.style);
  const embeddedFontCss = fontFamily ? loadEmbeddedFontCss(fontFamily) : '';
  const mediaVisual = await resolveOgMediaVisual(multimedia, strings);
  const hasVisualMedia = mediaVisual.kind !== 'none';
  const headerTitle = strings.heroTitle || 'Public message';
  const fallbackText = message
    ? (normalizeMediaTitle(multimedia) || strings.pageDescription)
    : strings.unavailableTitle;
  const displayText = messageText || fallbackText;
  const contentAreaHeight = hasVisualMedia ? 170 : 320;
  const textLines = wrapTextLines(displayText, hasVisualMedia ? 34 : 28, hasVisualMedia ? 5 : 6);
  const textFontSize = hasVisualMedia
    ? (textLines.length <= 2 ? 42 : textLines.length <= 4 ? 36 : 31)
    : (textLines.length <= 2 ? 54 : textLines.length <= 4 ? 46 : 38);
  const lineHeight = Math.round(textFontSize * 1.28);
  const textBlockY = hasVisualMedia ? 445 : 300 - Math.max(0, ((textLines.length - 1) * lineHeight) / 2);
  const textColor = '#0f172a';
  const bodyFont = fontFamily
    ? `"${fontFamily}", Inter, Roboto, Arial, sans-serif`
    : 'Inter, Roboto, Arial, sans-serif';
  const mediaMarkup = renderOgMediaMarkup(mediaVisual, strings);
  const textMarkup = renderWrappedSvgText({
    lines: textLines,
    x: 600,
    y: textBlockY,
    fontSize: textFontSize,
    lineHeight,
    fill: textColor,
    fontFamily: bodyFont,
    fontWeight: 600
  });
  const subtitleMarkup = messageText && hasVisualMedia
    ? ''
    : '';
  const safeHeaderTitle = escapeHtml(headerTitle);
  const safeBrand = escapeHtml('MessageDrop');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeAttribute(strings.previewImageAlt)}">`,
    '  <defs>',
    '    <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0%" stop-color="#f8fbff" />',
    '      <stop offset="100%" stop-color="#eef4ff" />',
    '    </linearGradient>',
    '    <linearGradient id="accentGradient" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0%" stop-color="#2563eb" />',
    '      <stop offset="100%" stop-color="#4f46e5" />',
    '    </linearGradient>',
    '    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="160%">',
    '      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#0f172a" flood-opacity="0.12" />',
    '    </filter>',
    '    <clipPath id="ogMediaClip">',
    '      <rect x="120" y="210" width="960" height="190" rx="28" ry="28" />',
    '    </clipPath>',
    embeddedFontCss ? `    <style>${embeddedFontCss}</style>` : '',
    '  </defs>',
    '  <rect width="1200" height="630" fill="url(#bgGradient)" />',
    '  <circle cx="1080" cy="30" r="180" fill="rgba(37,99,235,0.10)" />',
    '  <rect x="60" y="40" width="1080" height="112" rx="30" fill="#ffffff" stroke="rgba(15,23,42,0.08)" filter="url(#cardShadow)" />',
    `  <text x="100" y="82" fill="#64748b" font-family="Inter, Roboto, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="2.5">${safeBrand}</text>`,
    `  <text x="100" y="124" fill="#0f172a" font-family="Inter, Roboto, Arial, sans-serif" font-size="46" font-weight="800">${safeHeaderTitle}</text>`,
    '  <rect x="90" y="176" width="1020" height="394" rx="34" fill="#ffffff" stroke="rgba(15,23,42,0.08)" filter="url(#cardShadow)" />',
    mediaMarkup,
    textMarkup,
    subtitleMarkup,
    '  <rect x="90" y="176" width="1020" height="394" rx="34" fill="none" stroke="rgba(15,23,42,0.06)" />',
    '</svg>'
  ].filter(Boolean).join('\n');
}

function renderOgMediaMarkup(mediaVisual, strings) {
  if (!mediaVisual || mediaVisual.kind === 'none') {
    return '';
  }

  const label = escapeHtml(mediaVisual.label || strings.mediaLabel);
  const title = escapeHtml(truncate(singleLine(mediaVisual.title || ''), 64));

  if (mediaVisual.kind === 'image' && mediaVisual.dataUri) {
    return [
      '  <rect x="120" y="210" width="960" height="190" rx="28" fill="#e2e8f0" />',
      `  <image href="${escapeAttribute(mediaVisual.dataUri)}" x="120" y="210" width="960" height="190" preserveAspectRatio="xMidYMid slice" clip-path="url(#ogMediaClip)" />`,
      '  <rect x="120" y="210" width="960" height="190" rx="28" fill="none" stroke="rgba(15,23,42,0.08)" />'
    ].join('\n');
  }

  const accentStart = mediaVisual.kind === 'sticker' ? '#f59e0b' : '#2563eb';
  const accentEnd = mediaVisual.kind === 'sticker' ? '#ec4899' : '#4f46e5';
  const icon = mediaVisual.kind === 'sticker' ? '◌' : '▶';

  return [
    '  <defs>',
    `    <linearGradient id="ogMediaPanelGradient" x1="0" y1="0" x2="1" y2="1">`,
    `      <stop offset="0%" stop-color="${accentStart}" stop-opacity="0.16" />`,
    `      <stop offset="100%" stop-color="${accentEnd}" stop-opacity="0.22" />`,
    '    </linearGradient>',
    '  </defs>',
    '  <rect x="120" y="210" width="960" height="190" rx="28" fill="url(#ogMediaPanelGradient)" stroke="rgba(15,23,42,0.08)" />',
    '  <circle cx="240" cy="305" r="48" fill="#ffffff" stroke="rgba(15,23,42,0.08)" />',
    `  <text x="240" y="321" text-anchor="middle" fill="#0f172a" font-family="Inter, Roboto, Arial, sans-serif" font-size="38" font-weight="800">${escapeHtml(icon)}</text>`,
    `  <text x="330" y="286" fill="#0f172a" font-family="Inter, Roboto, Arial, sans-serif" font-size="22" font-weight="700">${label}</text>`,
    title
      ? `  <text x="330" y="326" fill="#334155" font-family="Inter, Roboto, Arial, sans-serif" font-size="30" font-weight="700">${title}</text>`
      : '',
    title
      ? ''
      : `  <text x="330" y="326" fill="#334155" font-family="Inter, Roboto, Arial, sans-serif" font-size="30" font-weight="700">${escapeHtml(strings.pageDescription)}</text>`
  ].filter(Boolean).join('\n');
}

function renderWrappedSvgText({ lines, x, y, fontSize, lineHeight, fill, fontFamily, fontWeight }) {
  const safeLines = Array.isArray(lines) && lines.length ? lines : [''];
  const tspans = safeLines.map((line, index) => {
    const dy = index === 0 ? 0 : lineHeight;
    return `<tspan x="${x}" dy="${dy}">${escapeHtml(line)}</tspan>`;
  }).join('');

  return `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-family="${escapeAttribute(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="0" dominant-baseline="middle">${tspans}</text>`;
}

async function resolveOgMediaVisual(multimedia, strings) {
  const media = multimedia && typeof multimedia === 'object' ? multimedia : null;
  if (!media || !hasMultimedia(media)) {
    return { kind: 'none' };
  }

  const mediaType = String(media.type || '').trim().toLowerCase();
  const title = normalizeMediaTitle(media);
  const imageUrl = typeof media.url === 'string' ? media.url.trim() : '';

  if (mediaType === 'sticker') {
    return {
      kind: 'sticker',
      label: strings.stickerLabel,
      title
    };
  }

  if (isDirectImageMedia(mediaType, imageUrl)) {
    const dataUri = await fetchRemoteImageDataUri(imageUrl);
    if (dataUri) {
      return {
        kind: 'image',
        label: strings.imageLabel,
        title,
        dataUri
      };
    }

    return {
      kind: 'placeholder',
      label: strings.imageLabel,
      title
    };
  }

  return {
    kind: 'embed',
    label: resolveMediaPlatformLabel(mediaType, media, strings),
    title
  };
}

function loadEmbeddedFontCss(fontFamily) {
  if (!fontFamily) {
    return '';
  }

  if (embeddedFontCssCache.has(fontFamily)) {
    return embeddedFontCssCache.get(fontFamily) || '';
  }

  try {
    const fontPath = getFrontendPath('src', 'assets', 'fonts', `${fontFamily}.ttf`);
    const fontBuffer = fs.readFileSync(fontPath);
    const dataUri = `data:font/ttf;base64,${fontBuffer.toString('base64')}`;
    const css = `@font-face{font-family:"${fontFamily}";src:url("${dataUri}") format("truetype");font-style:normal;font-weight:400;font-display:swap;}`;
    embeddedFontCssCache.set(fontFamily, css);
    return css;
  } catch {
    embeddedFontCssCache.set(fontFamily, '');
    return '';
  }
}

function extractAllowedFontFamily(styleValue) {
  if (typeof styleValue !== 'string' || !styleValue.trim()) {
    return '';
  }

  const match = styleValue.match(/font-family\s*:\s*([^;]+)/i);
  if (!match?.[1]) {
    return '';
  }

  const rawFamily = match[1]
    .split(',')[0]
    .trim()
    .replace(/^['"]+|['"]+$/g, '');

  return /^[A-Za-z0-9]+$/.test(rawFamily) ? rawFamily : '';
}

async function fetchRemoteImageDataUri(url) {
  if (!isHttpUrl(url)) {
    return '';
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: REMOTE_IMAGE_TIMEOUT_MS,
      maxContentLength: MAX_EMBEDDED_IMAGE_BYTES,
      maxBodyLength: MAX_EMBEDDED_IMAGE_BYTES,
      validateStatus: () => true,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'MessageDropOGPreview/1.0'
      }
    });

    const contentType = String(response.headers?.['content-type'] || '').trim().toLowerCase();
    if (response.status < 200 || response.status >= 300 || !contentType.startsWith('image/')) {
      return '';
    }

    const buffer = Buffer.from(response.data || []);
    if (!buffer.length || buffer.length > MAX_EMBEDDED_IMAGE_BYTES) {
      return '';
    }

    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}

function normalizeMediaTitle(multimedia) {
  if (!multimedia || typeof multimedia !== 'object') {
    return '';
  }

  const candidates = [multimedia.title, multimedia.description];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function isDirectImageMedia(mediaType, imageUrl) {
  if (!isHttpUrl(imageUrl)) {
    return false;
  }

  if (['tenor', 'unsplash', 'giphy', 'flickr'].includes(mediaType)) {
    return true;
  }

  return /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(imageUrl);
}

function resolveMediaPlatformLabel(mediaType, multimedia, strings) {
  const host = resolveUrlHost(multimedia?.sourceUrl || multimedia?.url || extractIframeSrc(multimedia?.oembed?.html || ''));
  const map = {
    youtube: 'YouTube',
    spotify: 'Spotify',
    soundcloud: 'SoundCloud',
    tiktok: 'TikTok',
    pinterest: 'Pinterest'
  };

  if (map[mediaType]) {
    return map[mediaType];
  }

  if (host.includes('youtube')) return 'YouTube';
  if (host.includes('spotify')) return 'Spotify';
  if (host.includes('soundcloud')) return 'SoundCloud';
  if (host.includes('tiktok')) return 'TikTok';
  if (host.includes('pinterest')) return 'Pinterest';

  return strings.mediaLabel;
}

function resolveUrlHost(value) {
  if (!value) {
    return '';
  }

  try {
    return new URL(String(value).trim()).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function extractIframeSrc(html) {
  if (typeof html !== 'string' || !html.trim()) {
    return '';
  }

  const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ? match[1].trim() : '';
}

function wrapTextLines(value, maxCharsPerLine, maxLines) {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!text) {
    return [''];
  }

  const lines = [];
  const paragraphs = text.split('\n');
  let truncated = false;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      continue;
    }

    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      }

      currentLine = word;
      while (currentLine.length > maxCharsPerLine) {
        lines.push(currentLine.slice(0, maxCharsPerLine - 1) + '…');
        currentLine = currentLine.slice(maxCharsPerLine - 1);
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      }

      if (truncated) {
        break;
      }
    }

    if (truncated) {
      break;
    }

    if (currentLine) {
      lines.push(currentLine);
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }
  }

  const result = lines.slice(0, maxLines).filter(Boolean);
  if (!result.length) {
    return [''];
  }

  if (truncated) {
    result[result.length - 1] = truncate(result[result.length - 1], Math.max(1, maxCharsPerLine - 1));
    if (!result[result.length - 1].endsWith('…')) {
      result[result.length - 1] += '…';
    }
  }

  return result;
}

function isHttpUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(String(value).trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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
