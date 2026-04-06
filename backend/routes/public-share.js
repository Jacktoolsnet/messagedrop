const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

const tableMessage = require('../db/tableMessage');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const OG_IMAGE_TYPE_PNG = 'image/png';
const OG_IMAGE_TYPE_SVG = 'image/svg+xml';
const STRINGS = {
  de: {
    heroTitle: 'Öffentliche Nachricht',
    unavailableTitle: 'Nachricht nicht verfügbar',
    unavailableDescription: 'Diese öffentliche Nachricht ist nicht verfügbar.',
    pageTitle: 'MessageDrop | Öffentliche Nachricht',
    pageDescription: 'Schau dir diese Nachricht auf MessageDrop an.',
    mediaOnlyDescription: 'Schau dir diese Nachricht auf MessageDrop an.',
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
    pageDescription: 'Take a look at this message on MessageDrop.',
    mediaOnlyDescription: 'Take a look at this message on MessageDrop.',
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
    pageDescription: 'Mira este mensaje en MessageDrop.',
    mediaOnlyDescription: 'Mira este mensaje en MessageDrop.',
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
    pageDescription: 'Regarde ce message sur MessageDrop.',
    mediaOnlyDescription: 'Regarde ce message sur MessageDrop.',
    previewImageAlt: 'Image d’aperçu d’un message public sur MessageDrop',
    stickerLabel: 'Sticker',
    imageLabel: 'Image',
    mediaLabel: 'Médias'
  }
};

let publicMessageTemplateCache = null;
const embeddedFontCssCache = new Map();
let appIconDataUriCache;
let resvgConstructorCache;
let resvgLoadAttempted = false;

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

router.get('/:messageUuid/og-image.png', function (req, res) {
  const Resvg = getResvgConstructor();
  if (!Resvg) {
    res.redirect(307, req.originalUrl.replace(/\.png(?:\?.*)?$/i, '.svg'));
    return;
  }

  const messageUuid = typeof req.params?.messageUuid === 'string' ? req.params.messageUuid.trim() : '';
  const locale = resolveLocale(req);
  const strings = STRINGS[locale];

  if (!UUID_REGEX.test(messageUuid)) {
    return renderOgPngImage(res, {
      locale,
      strings,
      status: 404,
      messageUuid,
      message: null
    });
  }

  tableMessage.getByUuid(req.database.db, messageUuid, function (err, row) {
    if (err) {
      return renderOgPngImage(res, {
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

    return renderOgPngImage(res, {
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
  const imageUrl = model.messageUuid ? resolveOgImageUrl(canonicalUrl) : '';
  const imageType = imageUrl.endsWith('.png') ? OG_IMAGE_TYPE_PNG : OG_IMAGE_TYPE_SVG;
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
    imageType,
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
    ? upsertMetaTag(html, 'property', 'og:image:type', model.imageType || OG_IMAGE_TYPE_SVG)
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
    res.set('Content-Type', `${OG_IMAGE_TYPE_SVG}; charset=utf-8`);
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
    res.set('Content-Type', `${OG_IMAGE_TYPE_SVG}; charset=utf-8`);
    res.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=300');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Vary', 'Accept-Language');
    res.send(fallbackSvg);
  }
}

async function renderOgPngImage(res, model) {
  try {
    const pngBuffer = await buildPublicMessageOgPng(model);
    res.status(model.status === 500 ? 500 : 200);
    res.set('Content-Type', OG_IMAGE_TYPE_PNG);
    res.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=300');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Vary', 'Accept-Language');
    res.send(pngBuffer);
  } catch {
    try {
      const fallbackStrings = model.strings || STRINGS[model.locale] || STRINGS.en;
      const pngBuffer = await buildPublicMessageOgPng({
        ...model,
        message: null,
        strings: fallbackStrings
      });
      res.status(200);
      res.set('Content-Type', OG_IMAGE_TYPE_PNG);
      res.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=300');
      res.set('X-Robots-Tag', 'noindex, nofollow');
      res.set('Vary', 'Accept-Language');
      res.send(pngBuffer);
      return;
    } catch {
      res.redirect(307, reqSvgFallbackUrl(res.req));
    }
  }
}

function resolveOgImageUrl(canonicalUrl) {
  return supportsPngOgImages()
    ? `${canonicalUrl}/og-image.png`
    : `${canonicalUrl}/og-image.svg`;
}

function supportsPngOgImages() {
  return Boolean(getResvgConstructor());
}

function getResvgConstructor() {
  if (resvgLoadAttempted) {
    return resvgConstructorCache || null;
  }

  resvgLoadAttempted = true;
  try {
    const mod = require('@resvg/resvg-js');
    resvgConstructorCache = mod?.Resvg || null;
  } catch {
    resvgConstructorCache = null;
  }

  return resvgConstructorCache;
}

function reqSvgFallbackUrl(req) {
  const originalUrl = typeof req?.originalUrl === 'string' ? req.originalUrl : '';
  const [pathname, search = ''] = originalUrl.split('?');
  const svgPath = pathname.replace(/\.png$/i, '.svg');
  return search ? `${svgPath}?${search}` : svgPath;
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
  const hasText = Boolean(messageText);
  const fontFamily = extractAllowedFontFamily(message?.style);
  const embeddedFontCss = fontFamily ? loadEmbeddedFontCss(fontFamily) : '';
  const appIconDataUri = loadAppIconDataUri();
  const mediaVisual = await resolveOgMediaVisual(multimedia, strings);
  const hasVisualMedia = mediaVisual.kind !== 'none';
  const primaryIconType = resolvePrimaryContentIconType({ hasText, mediaVisual });
  const renderPrimarySymbolTile = Boolean(message && primaryIconType);
  const fallbackText = message
    ? (normalizeMediaTitle(multimedia) || strings.pageDescription)
    : strings.unavailableTitle;
  const displayText = messageText || fallbackText;
  const textLines = wrapTextLines(displayText, hasVisualMedia ? 34 : 28, hasVisualMedia ? 5 : 6);
  const textFontSize = hasVisualMedia
    ? (textLines.length <= 2 ? 42 : textLines.length <= 4 ? 36 : 31)
    : (textLines.length <= 2 ? 54 : textLines.length <= 4 ? 46 : 38);
  const lineHeight = Math.round(textFontSize * 1.28);
  const textBlockY = hasVisualMedia
    ? 458
    : 342 - Math.max(0, ((textLines.length - 1) * lineHeight) / 2);
  const textColor = '#0f172a';
  const bodyFont = fontFamily
    ? `"${fontFamily}", Inter, Roboto, Arial, sans-serif`
    : 'Inter, Roboto, Arial, sans-serif';
  const primaryStyle = resolveContentIconStyle(primaryIconType || 'text');
  const lowerTileDefsMarkup = '';
  const mediaMarkup = '';
  const contentIconsMarkup = renderPrimarySymbolTile ? '' : renderContentIconsMarkup({
    hasText,
    mediaVisual
  });
  const headerTileDefsMarkup = renderPrimarySymbolTile
    ? renderHeaderTileDefs(primaryIconType, primaryStyle)
    : '';
  const headerTileFill = '#ffffff';
  const headerTileStroke = 'rgba(15,23,42,0.08)';
  const headerTileOverlayMarkup = '';
  const headerTextColor = '#0f172a';
  const headerEyebrowColor = '#475569';
  const headerLogoShellFill = 'url(#headerLogoShellGradient)';
  const headerLogoTileFill = '#ffffff';
  const headerLogoTileStroke = '#dbeafe';
  const headerFallbackColor = '#2563eb';
  const textMarkup = renderPrimarySymbolTile ? '' : renderWrappedSvgText({
    lines: textLines,
    x: 600,
    y: textBlockY,
    fontSize: textFontSize,
    lineHeight,
    fill: textColor,
    fontFamily: bodyFont,
    fontWeight: 600
  });
  const lowerTileFill = '#ffffff';
  const lowerTileStroke = 'rgba(15,23,42,0.08)';
  const lowerTileOverlayMarkup = '';
  const largePrimarySymbolMarkup = renderPrimarySymbolTile
    ? renderLargeContentSymbol({
      type: primaryIconType,
      centerX: 600,
      centerY: 373,
      size: 252,
      color: '#cbd5e1'
    })
    : '';
  const subtitleMarkup = messageText && hasVisualMedia
    ? ''
    : '';
  const safeBrand = escapeHtml('MessageDrop');
  const safeHeroTitle = escapeHtml(strings.heroTitle);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeAttribute(strings.previewImageAlt)}">`,
    '  <defs>',
    '    <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0%" stop-color="#f4f7fb" />',
    '      <stop offset="100%" stop-color="#eef3fb" />',
    '    </linearGradient>',
    '    <radialGradient id="pageGlow" cx="50%" cy="0%" r="58%">',
    '      <stop offset="0%" stop-color="rgba(37,99,235,0.18)" />',
    '      <stop offset="34%" stop-color="rgba(37,99,235,0.08)" />',
    '      <stop offset="62%" stop-color="rgba(37,99,235,0.03)" />',
    '      <stop offset="100%" stop-color="rgba(37,99,235,0)" />',
    '    </radialGradient>',
    '    <linearGradient id="accentGradient" x1="0" y1="0" x2="1" y2="1">',
      '      <stop offset="0%" stop-color="#2563eb" />',
      '      <stop offset="100%" stop-color="#4f46e5" />',
    '    </linearGradient>',
    '    <linearGradient id="headerLogoShellGradient" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.18" />',
    '      <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.16" />',
    '    </linearGradient>',
    headerTileDefsMarkup,
    lowerTileDefsMarkup,
    '    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="160%">',
    '      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#0f172a" flood-opacity="0.12" />',
    '    </filter>',
    '    <clipPath id="ogMediaClip">',
    '      <rect x="120" y="222" width="960" height="180" rx="28" ry="28" />',
    '    </clipPath>',
    '    <clipPath id="ogHeaderAvatarClip">',
    '      <rect x="94" y="68" width="56" height="56" rx="16" ry="16" />',
    '    </clipPath>',
    embeddedFontCss ? `    <style>${embeddedFontCss}</style>` : '',
    '  </defs>',
    '  <rect width="1200" height="630" fill="url(#bgGradient)" />',
    '  <rect width="1200" height="630" fill="url(#pageGlow)" />',
    `  <rect x="60" y="40" width="1080" height="112" rx="30" fill="${headerTileFill}" stroke="${headerTileStroke}" filter="url(#cardShadow)" />`,
    headerTileOverlayMarkup,
    `  <rect x="88" y="62" width="68" height="68" rx="22" fill="${headerLogoShellFill}" />`,
    `  <rect x="92" y="66" width="60" height="60" rx="18" fill="${headerLogoTileFill}" stroke="${headerLogoTileStroke}" />`,
    appIconDataUri
      ? `  <image href="${escapeAttribute(appIconDataUri)}" x="94" y="68" width="56" height="56" preserveAspectRatio="xMidYMid slice" clip-path="url(#ogHeaderAvatarClip)" />`
      : `  <text x="122" y="105" text-anchor="middle" fill="${headerFallbackColor}" font-family="Inter, Roboto, Arial, sans-serif" font-size="32" font-weight="800">M</text>`,
    `  <text x="180" y="86" fill="${headerEyebrowColor}" font-family="Inter, Roboto, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="1.4">${safeBrand}</text>`,
    `  <text x="180" y="123" fill="${headerTextColor}" font-family="Inter, Roboto, Arial, sans-serif" font-size="34" font-weight="800">${safeHeroTitle}</text>`,
    `  <rect x="60" y="176" width="1080" height="394" rx="34" fill="${lowerTileFill}" stroke="${lowerTileStroke}" filter="url(#cardShadow)" />`,
    lowerTileOverlayMarkup,
    contentIconsMarkup,
    mediaMarkup,
    largePrimarySymbolMarkup,
    textMarkup,
    subtitleMarkup,
    '  <rect x="60" y="176" width="1080" height="394" rx="34" fill="none" stroke="rgba(15,23,42,0.06)" />',
    '</svg>'
  ].filter(Boolean).join('\n');
}

async function buildPublicMessageOgPng(model) {
  const Resvg = getResvgConstructor();
  if (!Resvg) {
    throw new Error('resvg-js not available');
  }

  const svg = await buildPublicMessageOgSvg(model);
  const renderer = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: OG_IMAGE_WIDTH
    }
  });

  return renderer.render().asPng();
}

function renderOgMediaMarkup(mediaVisual, strings) {
  if (!mediaVisual || mediaVisual.kind === 'none') {
    return '';
  }

  const label = escapeHtml(mediaVisual.label || strings.mediaLabel);
  const title = escapeHtml(truncate(singleLine(mediaVisual.title || ''), 64));

  if (mediaVisual.kind === 'image' && mediaVisual.dataUri) {
    return [
      '  <rect x="120" y="222" width="960" height="180" rx="28" fill="#e2e8f0" />',
      `  <image href="${escapeAttribute(mediaVisual.dataUri)}" x="120" y="222" width="960" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#ogMediaClip)" />`,
      '  <rect x="120" y="222" width="960" height="180" rx="28" fill="none" stroke="rgba(15,23,42,0.08)" />'
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
    '  <rect x="120" y="222" width="960" height="180" rx="28" fill="url(#ogMediaPanelGradient)" stroke="rgba(15,23,42,0.08)" />',
    '  <circle cx="240" cy="312" r="48" fill="#ffffff" stroke="rgba(15,23,42,0.08)" />',
    `  <text x="240" y="328" text-anchor="middle" fill="#0f172a" font-family="Inter, Roboto, Arial, sans-serif" font-size="38" font-weight="800">${escapeHtml(icon)}</text>`,
    `  <text x="330" y="294" fill="#0f172a" font-family="Inter, Roboto, Arial, sans-serif" font-size="22" font-weight="700">${label}</text>`,
    title
      ? `  <text x="330" y="334" fill="#334155" font-family="Inter, Roboto, Arial, sans-serif" font-size="30" font-weight="700">${title}</text>`
      : '',
    title
      ? ''
      : `  <text x="330" y="334" fill="#334155" font-family="Inter, Roboto, Arial, sans-serif" font-size="30" font-weight="700">${escapeHtml(strings.pageDescription)}</text>`
  ].filter(Boolean).join('\n');
}

function renderContentIconsMarkup({ hasText, mediaVisual }) {
  const iconType = resolvePrimaryContentIconType({ hasText, mediaVisual });
  if (!iconType) {
    return '';
  }

  const size = 46;
  const startY = 194;
  const startX = 1140 - 28 - size;

  return renderContentIconChip({
    type: iconType,
    x: startX,
    y: startY,
    size
  });
}

function resolvePrimaryContentIconType({ hasText, mediaVisual }) {
  const mediaIconType = resolveContentIconType(mediaVisual);
  if (mediaIconType) {
    return mediaIconType;
  }

  return hasText ? 'text' : '';
}

function resolveContentIconType(mediaVisual) {
  if (!mediaVisual || mediaVisual.kind === 'none') {
    return '';
  }

  if (typeof mediaVisual.iconType === 'string' && mediaVisual.iconType.trim()) {
    return mediaVisual.iconType.trim();
  }

  if (mediaVisual.kind === 'sticker') {
    return 'sticker';
  }

  if (mediaVisual.kind === 'image' || mediaVisual.kind === 'placeholder') {
    return 'image';
  }

  return 'media';
}

function renderContentIconChip({ type, x, y, size }) {
  const style = resolveContentIconStyle(type);
  const iconElements = renderContentIconGlyph(type, x, y, size, style.iconColor);

  return [
    '  <defs>',
    `    <linearGradient id="ogContentIconGradient-${type}" x1="0" y1="0" x2="1" y2="1">`,
    `      <stop offset="0%" stop-color="${style.gradientStart}" />`,
    `      <stop offset="100%" stop-color="${style.gradientEnd}" />`,
    '    </linearGradient>',
    '  </defs>',
    `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="${style.haloColor}" opacity="0.9" />`,
    `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${(size / 2) - 1}" fill="url(#ogContentIconGradient-${type})" stroke="${style.borderColor}" stroke-width="1.2" />`,
    iconElements
  ].join('\n');
}

function renderContentIconGlyph(type, x, y, size, stroke) {
  if (type === 'text') {
    return [
      `<rect x="${x + 11}" y="${y + 14}" width="${size - 22}" height="3.6" rx="1.8" fill="${stroke}" />`,
      `<rect x="${x + 11}" y="${y + 21}" width="${size - 16}" height="3.6" rx="1.8" fill="${stroke}" opacity="0.96" />`,
      `<rect x="${x + 11}" y="${y + 28}" width="${size - 24}" height="3.6" rx="1.8" fill="${stroke}" opacity="0.88" />`
    ].join('\n');
  }

  if (type === 'image') {
    return [
      `<rect x="${x + 10.5}" y="${y + 11}" width="${size - 21}" height="${size - 22}" rx="7" fill="none" stroke="${stroke}" stroke-width="2.5" />`,
      `<circle cx="${x + size - 15.5}" cy="${y + 17}" r="2.7" fill="${stroke}" />`,
      `<path d="M${x + 14} ${y + size - 14} L${x + 21} ${y + size - 23} L${x + 28} ${y + size - 16} L${x + 34} ${y + size - 24} L${x + size - 11} ${y + size - 14}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
    ].join('\n');
  }

  if (type === 'sticker') {
    return [
      `<path d="M${x + 11.5} ${y + 11} h${size - 23} a7 7 0 0 1 7 7 v${size - 23} a7 7 0 0 1 -7 7 h-${size - 23} a7 7 0 0 1 -7 -7 v-${size - 23} a7 7 0 0 1 7 -7 z" fill="none" stroke="${stroke}" stroke-width="2.3" />`,
      `<path d="M${x + size - 18.5} ${y + 11} v8.5 a8.5 8.5 0 0 0 8.5 -8.5" fill="rgba(255,255,255,0.24)" stroke="${stroke}" stroke-width="1.9" stroke-linejoin="round" />`,
      `<circle cx="${x + 18}" cy="${y + 21}" r="1.8" fill="${stroke}" />`,
      `<circle cx="${x + 28}" cy="${y + 21}" r="1.8" fill="${stroke}" />`,
      `<path d="M${x + 17} ${y + 28} Q${x + 23} ${y + 33} ${x + 29} ${y + 28}" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" />`
    ].join('\n');
  }

  return [
    `<rect x="${x + 11}" y="${y + 11}" width="${size - 22}" height="${size - 22}" rx="8" fill="none" stroke="${stroke}" stroke-width="2.4" />`,
    `<path d="M${x + 20} ${y + 16.5} L${x + 31.5} ${y + 23} L${x + 20} ${y + 29.5} Z" fill="${stroke}" />`
  ].join('\n');
}

function renderLargeContentSymbol({ type, centerX, centerY, size, color }) {
  const x = centerX - (size / 2);
  const y = centerY - (size / 2);

  if (type === 'text') {
    const lineHeight = Math.max(14, Math.round(size * 0.09));
    const firstWidth = Math.round(size * 0.56);
    const secondWidth = Math.round(size * 0.68);
    const thirdWidth = Math.round(size * 0.48);
    const startX = centerX - (secondWidth / 2);
    const firstY = y + Math.round(size * 0.32);
    const secondY = firstY + Math.round(size * 0.16);
    const thirdY = secondY + Math.round(size * 0.16);

    return [
      `<rect x="${centerX - (firstWidth / 2)}" y="${firstY}" width="${firstWidth}" height="${lineHeight}" rx="${lineHeight / 2}" fill="${color}" />`,
      `<rect x="${startX}" y="${secondY}" width="${secondWidth}" height="${lineHeight}" rx="${lineHeight / 2}" fill="${color}" opacity="0.96" />`,
      `<rect x="${centerX - (thirdWidth / 2)}" y="${thirdY}" width="${thirdWidth}" height="${lineHeight}" rx="${lineHeight / 2}" fill="${color}" opacity="0.88" />`
    ].join('\n');
  }

  if (type === 'image') {
    return [
      `<rect x="${x + 36}" y="${y + 38}" width="${size - 72}" height="${size - 76}" rx="24" fill="none" stroke="${color}" stroke-width="16" />`,
      `<circle cx="${x + size - 76}" cy="${y + 82}" r="14" fill="${color}" />`,
      `<path d="M${x + 58} ${y + size - 56} L${x + 104} ${y + size - 114} L${x + 146} ${y + size - 72} L${x + 188} ${y + size - 124} L${x + size - 54} ${y + size - 56}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />`
    ].join('\n');
  }

  if (type === 'sticker') {
    return [
      `<path d="M${x + 46} ${y + 38} h${size - 92} a22 22 0 0 1 22 22 v${size - 92} a22 22 0 0 1 -22 22 h-${size - 92} a22 22 0 0 1 -22 -22 v-${size - 92} a22 22 0 0 1 22 -22 z" fill="none" stroke="${color}" stroke-width="16" />`,
      `<path d="M${x + size - 88} ${y + 38} v34 a34 34 0 0 0 34 -34" fill="rgba(255,255,255,0.18)" stroke="${color}" stroke-width="14" stroke-linejoin="round" />`,
      `<circle cx="${x + 92}" cy="${y + 102}" r="8" fill="${color}" />`,
      `<circle cx="${x + 154}" cy="${y + 102}" r="8" fill="${color}" />`,
      `<path d="M${x + 84} ${y + 156} Q${centerX} ${y + 192} ${x + 162} ${y + 156}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" />`
    ].join('\n');
  }

  if (type === 'media') {
    return [
      `<rect x="${x + 42}" y="${y + 54}" width="${size - 84}" height="${size - 108}" rx="28" fill="none" stroke="${color}" stroke-width="16" />`,
      `<path d="M${centerX - 18} ${centerY - 42} L${centerX + 54} ${centerY} L${centerX - 18} ${centerY + 42} Z" fill="${color}" />`
    ].join('\n');
  }

  if (type === 'youtube') {
    return [
      `<rect x="${x + 34}" y="${y + 68}" width="${size - 68}" height="${size - 136}" rx="34" fill="none" stroke="${color}" stroke-width="18" />`,
      `<path d="M${centerX - 18} ${centerY - 34} L${centerX + 46} ${centerY} L${centerX - 18} ${centerY + 34} Z" fill="${color}" />`
    ].join('\n');
  }

  if (type === 'spotify') {
    return [
      `<path d="M${x + 48} ${y + 108} Q${centerX} ${y + 66} ${x + size - 48} ${y + 104}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" opacity="0.98" />`,
      `<path d="M${x + 62} ${y + 140} Q${centerX} ${y + 106} ${x + size - 60} ${y + 136}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" opacity="0.92" />`,
      `<path d="M${x + 76} ${y + 170} Q${centerX} ${y + 144} ${x + size - 76} ${y + 168}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" opacity="0.86" />`
    ].join('\n');
  }

  if (type === 'pinterest') {
    return `<text x="${centerX}" y="${centerY + 18}" text-anchor="middle" fill="${color}" font-family="Inter, Roboto, Arial, sans-serif" font-size="${Math.round(size * 0.86)}" font-weight="800">P</text>`;
  }

  if (type === 'tenor') {
    const barWidth = Math.round(size * 0.12);
    const barHeight = Math.round(size * 0.62);
    return [
      `<rect x="${centerX - (barWidth / 2)}" y="${centerY - (barHeight / 2)}" width="${barWidth}" height="${barHeight}" rx="${Math.round(barWidth / 2)}" fill="${color}" />`,
      `<rect x="${centerX - Math.round(size * 0.22)}" y="${centerY - Math.round(size * 0.30)}" width="${Math.round(size * 0.44)}" height="${Math.round(size * 0.1)}" rx="${Math.round(size * 0.05)}" fill="${color}" />`
    ].join('\n');
  }

  if (type === 'tiktok') {
    return [
      `<path d="M${centerX + 30} ${y + 60} v90 a56 56 0 1 1 -38 -53" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />`,
      `<path d="M${centerX + 30} ${y + 76} q22 24 52 22" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />`
    ].join('\n');
  }

  if (type === 'soundcloud') {
    return [
      `<circle cx="${centerX - 52}" cy="${centerY + 12}" r="24" fill="${color}" />`,
      `<rect x="${centerX - 32}" y="${centerY - 4}" width="${118}" height="32" rx="16" fill="${color}" />`,
      `<rect x="${centerX + 8}" y="${centerY - 32}" width="16" height="88" rx="8" fill="${color}" />`,
      `<rect x="${centerX + 34}" y="${centerY - 22}" width="16" height="78" rx="8" fill="${color}" opacity="0.92" />`,
      `<rect x="${centerX + 60}" y="${centerY - 10}" width="16" height="66" rx="8" fill="${color}" opacity="0.86" />`
    ].join('\n');
  }

  return renderContentIconGlyph(type, x, y, size, color);
}

function renderLowerTileDefs(type, style) {
  return [
    `    <linearGradient id="ogLowerTileGradient-${type}" x1="0" y1="0" x2="1" y2="1">`,
    `      <stop offset="0%" stop-color="${style.gradientStart}" />`,
    `      <stop offset="100%" stop-color="${style.gradientEnd}" />`,
    '    </linearGradient>',
    `    <radialGradient id="ogLowerTileGlow-${type}" cx="18%" cy="8%" r="90%">`,
    `      <stop offset="0%" stop-color="${style.glowStart}" stop-opacity="${style.glowStartOpacity}" />`,
    `      <stop offset="55%" stop-color="${style.glowMid}" stop-opacity="${style.glowMidOpacity}" />`,
    `      <stop offset="100%" stop-color="${style.glowEnd}" stop-opacity="0" />`,
    '    </radialGradient>'
  ].join('\n');
}

function renderHeaderTileDefs(type, style) {
  return [
    `    <linearGradient id="ogHeaderTileGradient-${type}" x1="0" y1="0" x2="1" y2="1">`,
    `      <stop offset="0%" stop-color="${style.gradientStart}" />`,
    `      <stop offset="100%" stop-color="${style.gradientEnd}" />`,
    '    </linearGradient>',
    `    <radialGradient id="ogHeaderTileGlow-${type}" cx="12%" cy="0%" r="96%">`,
    `      <stop offset="0%" stop-color="${style.glowStart}" stop-opacity="${Math.min(0.24, style.glowStartOpacity)}" />`,
    `      <stop offset="52%" stop-color="${style.glowMid}" stop-opacity="${Math.min(0.1, style.glowMidOpacity + 0.02)}" />`,
    `      <stop offset="100%" stop-color="${style.glowEnd}" stop-opacity="0" />`,
    '    </radialGradient>'
  ].join('\n');
}

function resolveContentIconStyle(type) {
  if (type === 'sticker') {
    return {
      gradientStart: '#f59e0b',
      gradientEnd: '#ec4899',
      haloColor: 'rgba(245,158,11,0.16)',
      borderColor: 'rgba(236,72,153,0.26)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.28,
      glowMid: '#ffffff',
      glowMidOpacity: 0.08,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'image') {
    return {
      gradientStart: '#2563eb',
      gradientEnd: '#38bdf8',
      haloColor: 'rgba(37,99,235,0.14)',
      borderColor: 'rgba(37,99,235,0.24)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.28,
      glowMid: '#ffffff',
      glowMidOpacity: 0.08,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'youtube') {
    return {
      gradientStart: '#dc2626',
      gradientEnd: '#fb7185',
      haloColor: 'rgba(220,38,38,0.15)',
      borderColor: 'rgba(251,113,133,0.24)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.2,
      glowMid: '#ffffff',
      glowMidOpacity: 0.06,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'tenor') {
    return {
      gradientStart: '#7c3aed',
      gradientEnd: '#ec4899',
      haloColor: 'rgba(124,58,237,0.15)',
      borderColor: 'rgba(236,72,153,0.24)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.2,
      glowMid: '#ffffff',
      glowMidOpacity: 0.06,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'pinterest') {
    return {
      gradientStart: '#be123c',
      gradientEnd: '#fb7185',
      haloColor: 'rgba(190,24,93,0.15)',
      borderColor: 'rgba(251,113,133,0.24)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.2,
      glowMid: '#ffffff',
      glowMidOpacity: 0.06,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'tiktok') {
    return {
      gradientStart: '#111827',
      gradientEnd: '#0f766e',
      haloColor: 'rgba(17,24,39,0.18)',
      borderColor: 'rgba(45,212,191,0.22)',
      iconColor: '#ffffff',
      glowStart: '#22d3ee',
      glowStartOpacity: 0.18,
      glowMid: '#ec4899',
      glowMidOpacity: 0.08,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'spotify') {
    return {
      gradientStart: '#15803d',
      gradientEnd: '#10b981',
      haloColor: 'rgba(21,128,61,0.16)',
      borderColor: 'rgba(16,185,129,0.24)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.18,
      glowMid: '#ffffff',
      glowMidOpacity: 0.06,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'soundcloud') {
    return {
      gradientStart: '#ea580c',
      gradientEnd: '#fb923c',
      haloColor: 'rgba(234,88,12,0.16)',
      borderColor: 'rgba(251,146,60,0.24)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.2,
      glowMid: '#ffffff',
      glowMidOpacity: 0.06,
      glowEnd: '#ffffff'
    };
  }

  if (type === 'media') {
    return {
      gradientStart: '#4f46e5',
      gradientEnd: '#8b5cf6',
      haloColor: 'rgba(99,102,241,0.15)',
      borderColor: 'rgba(79,70,229,0.24)',
      iconColor: '#ffffff',
      glowStart: '#ffffff',
      glowStartOpacity: 0.2,
      glowMid: '#ffffff',
      glowMidOpacity: 0.06,
      glowEnd: '#ffffff'
    };
  }

  return {
    gradientStart: '#2563eb',
    gradientEnd: '#38bdf8',
    haloColor: 'rgba(37,99,235,0.14)',
    borderColor: 'rgba(37,99,235,0.24)',
    iconColor: '#ffffff',
    glowStart: '#ffffff',
    glowStartOpacity: 0.28,
    glowMid: '#ffffff',
    glowMidOpacity: 0.08,
    glowEnd: '#ffffff'
  };
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
  const iconType = resolveOgMediaIconType(mediaType, media);

  if (mediaType === 'sticker') {
    return {
      kind: 'sticker',
      label: strings.stickerLabel,
      title,
      iconType
    };
  }

  if (isDirectImageMedia(mediaType, imageUrl)) {
    return {
      kind: 'image',
      label: strings.imageLabel,
      title,
      iconType
    };
  }

  return {
    kind: 'embed',
    label: resolveMediaPlatformLabel(mediaType, media, strings),
    title,
    iconType
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

function loadAppIconDataUri() {
  if (appIconDataUriCache !== undefined) {
    return appIconDataUriCache;
  }

  try {
    const iconPath = getFrontendPath('public', 'icons', 'icon-192x192.png');
    const iconBuffer = fs.readFileSync(iconPath);
    appIconDataUriCache = `data:image/png;base64,${iconBuffer.toString('base64')}`;
    return appIconDataUriCache;
  } catch {
    appIconDataUriCache = '';
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

function resolveOgMediaIconType(mediaType, multimedia) {
  const normalizedType = String(mediaType || '').trim().toLowerCase();
  const host = resolveUrlHost(multimedia?.sourceUrl || multimedia?.url || extractIframeSrc(multimedia?.oembed?.html || ''));

  if (normalizedType === 'sticker') return 'sticker';
  if (normalizedType === 'youtube' || host.includes('youtube')) return 'youtube';
  if (normalizedType === 'tenor' || host.includes('tenor')) return 'tenor';
  if (normalizedType === 'pinterest' || host.includes('pinterest')) return 'pinterest';
  if (normalizedType === 'tiktok' || host.includes('tiktok')) return 'tiktok';
  if (normalizedType === 'spotify' || host.includes('spotify')) return 'spotify';
  if (normalizedType === 'soundcloud' || host.includes('soundcloud')) return 'soundcloud';
  if (isDirectImageMedia(normalizedType, multimedia?.url)) return 'image';
  return 'media';
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
