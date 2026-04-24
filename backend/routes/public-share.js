const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

const tableMessage = require('../db/tableMessage');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OG_IMAGE_WIDTH = 1024;
const OG_IMAGE_HEIGHT = 1024;
const OG_IMAGE_TYPE_PNG = 'image/png';
const LOCAL_PUBLIC_APP_URL = 'http://localhost:4200';
const PRODUCTION_PUBLIC_APP_URL = 'https://app.messagedrop.de';
const PRODUCTION_PUBLIC_SITE_URL = 'https://messagedrop.de';
const Q_STAGE_PUBLIC_APP_URL = 'https://q.frontend.messagedrop.de';
const Q_STAGE_PUBLIC_SITE_URL = 'https://q.frontend.messagedrop.de';
const LOCAL_PUBLIC_SHARE_URL = 'http://localhost:3000/p';
const PRODUCTION_PUBLIC_SHARE_URL = `${PRODUCTION_PUBLIC_SITE_URL}/p`;
const Q_STAGE_PUBLIC_SHARE_URL = `${Q_STAGE_PUBLIC_SITE_URL}/p`;
const STRINGS = {
  de: {
    heroTitle: 'Öffentliche Nachricht',
    unavailableTitle: 'Nachricht nicht verfügbar',
    unavailableDescription: 'Diese öffentliche Nachricht ist nicht verfügbar.',
    pageTitle: 'MessageDrop',
    pageDescription: 'Öffne diese Nachricht direkt in MessageDrop.',
    mediaOnlyDescription: 'Öffne diese Nachricht direkt in MessageDrop.',
    previewImageAlt: 'Vorschaubild einer öffentlichen Nachricht auf MessageDrop',
    openApp: 'In MessageDrop öffnen',
    copyLink: 'Link kopieren',
    contextTitle: 'Was ist MessageDrop?',
    contextBody: 'Platziere Nachrichten. Folge Orten. Kommuniziere sicher.',
    moreInfo: 'Mehr Infos',
    mediaFromSourceTemplate: 'Inhalt von {{source}}',
    stickerLabel: 'Sticker',
    imageLabel: 'Bild',
    mediaLabel: 'Medien',
    youtubeVideoLabel: 'YouTube-Video',
    tenorGifLabel: 'Tenor-GIF',
    pinterestPinLabel: 'Pinterest-Pin',
    tiktokVideoLabel: 'TikTok-Video',
    spotifyLabel: 'Spotify'
  },
  en: {
    heroTitle: 'Public message',
    unavailableTitle: 'Message unavailable',
    unavailableDescription: 'This public message is not available.',
    pageTitle: 'MessageDrop',
    pageDescription: 'Open this message directly in MessageDrop.',
    mediaOnlyDescription: 'Open this message directly in MessageDrop.',
    previewImageAlt: 'Preview image for a public message on MessageDrop',
    openApp: 'Open in MessageDrop',
    copyLink: 'Copy link',
    contextTitle: 'What is MessageDrop?',
    contextBody: 'Place messages. Follow places. Communicate securely.',
    moreInfo: 'More info',
    mediaFromSourceTemplate: 'Content from {{source}}',
    stickerLabel: 'Sticker',
    imageLabel: 'Image',
    mediaLabel: 'Media',
    youtubeVideoLabel: 'YouTube video',
    tenorGifLabel: 'Tenor GIF',
    pinterestPinLabel: 'Pinterest pin',
    tiktokVideoLabel: 'TikTok video',
    spotifyLabel: 'Spotify'
  },
  es: {
    heroTitle: 'Mensaje público',
    unavailableTitle: 'Mensaje no disponible',
    unavailableDescription: 'Este mensaje público no está disponible.',
    pageTitle: 'MessageDrop',
    pageDescription: 'Abre este mensaje directamente en MessageDrop.',
    mediaOnlyDescription: 'Abre este mensaje directamente en MessageDrop.',
    previewImageAlt: 'Imagen de vista previa de un mensaje público en MessageDrop',
    openApp: 'Abrir en MessageDrop',
    copyLink: 'Copiar enlace',
    contextTitle: '¿Qué es MessageDrop?',
    contextBody: 'Coloca mensajes. Sigue lugares. Comunícate de forma segura.',
    moreInfo: 'Más información',
    mediaFromSourceTemplate: 'Contenido de {{source}}',
    stickerLabel: 'Sticker',
    imageLabel: 'Imagen',
    mediaLabel: 'Contenido multimedia',
    youtubeVideoLabel: 'Vídeo de YouTube',
    tenorGifLabel: 'GIF de Tenor',
    pinterestPinLabel: 'Pin de Pinterest',
    tiktokVideoLabel: 'Vídeo de TikTok',
    spotifyLabel: 'Spotify'
  },
  fr: {
    heroTitle: 'Message public',
    unavailableTitle: 'Message indisponible',
    unavailableDescription: 'Ce message public n’est pas disponible.',
    pageTitle: 'MessageDrop',
    pageDescription: 'Ouvre ce message directement dans MessageDrop.',
    mediaOnlyDescription: 'Ouvre ce message directement dans MessageDrop.',
    previewImageAlt: 'Image d’aperçu d’un message public sur MessageDrop',
    openApp: 'Ouvrir dans MessageDrop',
    copyLink: 'Copier le lien',
    contextTitle: 'Qu’est-ce que MessageDrop ?',
    contextBody: 'Place des messages. Suis des lieux. Communique en toute sécurité.',
    moreInfo: 'Plus d’informations',
    mediaFromSourceTemplate: 'Contenu de {{source}}',
    stickerLabel: 'Sticker',
    imageLabel: 'Image',
    mediaLabel: 'Médias',
    youtubeVideoLabel: 'Vidéo YouTube',
    tenorGifLabel: 'GIF Tenor',
    pinterestPinLabel: 'Épingle Pinterest',
    tiktokVideoLabel: 'Vidéo TikTok',
    spotifyLabel: 'Spotify'
  }
};

let publicMessageTemplateCache = null;
const embeddedFontCssCache = new Map();
let supportedFrontendFontsCache = null;

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

router.get('/assets/share-card.png', function (req, res, next) {
  sendStaticFile(res, getFrontendPath('public', 'icons', 'icon-1024x1024.png'), OG_IMAGE_TYPE_PNG, next);
});

router.get('/assets/share-card.svg', function (req, res) {
  res.redirect(307, `${req.baseUrl || ''}/assets/share-card.png`);
});

router.get('/assets/fonts/:fontFile', function (req, res, next) {
  const fontFile = typeof req.params?.fontFile === 'string' ? req.params.fontFile.trim() : '';
  if (!/^[A-Za-z0-9_-]+\.ttf$/i.test(fontFile)) {
    res.status(404).end();
    return;
  }

  const requestedFamily = path.basename(fontFile, path.extname(fontFile));
  const resolvedFamily = resolveSupportedFontFamily(requestedFamily);
  if (!resolvedFamily || `${resolvedFamily}.ttf` !== fontFile) {
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

    const meta = buildPublicShareMeta(row, strings);
    const appRedirectUrl = buildPublicAppMessageUrl(req, messageUuid);

    if (shouldServerRedirectToApp(req, appRedirectUrl)) {
      res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.set('Vary', 'User-Agent');
      return res.redirect(307, appRedirectUrl);
    }

    return renderShareShell(res, {
      locale,
      strings,
      status: 200,
      messageUuid,
      title: meta.title,
      description: meta.description,
      message: row
    });
  });
});

function buildPublicShareMeta(message, strings) {
  const normalizedMessage = normalizePublicMessage(message);
  const messageText = typeof normalizedMessage?.message === 'string' ? normalizedMessage.message.trim() : '';
  const mediaTitle = normalizeMediaTitle(normalizedMessage?.multimedia);
  const mediaDescription = buildMediaPreviewDescription(normalizedMessage?.multimedia, strings);

  return {
    title: strings.pageTitle,
    description: buildDescription(messageText)
      || buildDescription(mediaDescription)
      || buildDescription(mediaTitle)
      || (hasMultimedia(normalizedMessage?.multimedia) ? strings.mediaOnlyDescription : strings.pageDescription)
  };
}

function renderShareShell(res, model) {
  const appBaseUrl = resolvePublicAppBaseUrl(res.req);
  const publicMessageBaseUrl = resolvePublicMessageBaseUrl(res.req);
  const canonicalUrl = `${publicMessageBaseUrl}/${encodeURIComponent(model.messageUuid || '')}`;
  const assetBaseUrl = `${publicMessageBaseUrl}/assets`;
  const normalizedMessage = normalizePublicMessage(model.message);
  const imageUrl = resolveOgImageUrl(assetBaseUrl);
  const initialError = normalizedMessage
    ? null
    : {
      title: model.title || model.strings.unavailableTitle,
      body: model.description || model.strings.unavailableDescription
    };
  const bootstrap = {
    messageUuid: model.messageUuid || '',
    appBaseUrl,
    shareBaseUrl: publicMessageBaseUrl,
    assetBaseUrl,
    fontFamily: normalizedMessage?.fontFamily || ''
  };
  const html = buildShareHtml({
    locale: model.locale,
    title: model.title || model.strings.pageTitle,
    description: model.description || model.strings.pageDescription,
    canonicalUrl,
    imageUrl,
    imageType: OG_IMAGE_TYPE_PNG,
    imageAlt: model.strings.previewImageAlt,
    assetBaseUrl,
    bootstrap,
    appBaseUrl,
    strings: model.strings,
    message: normalizedMessage,
    initialError
  });

  res.status(model.status || 200);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.set('Content-Language', model.locale);
  res.set('Content-Security-Policy', buildPublicMessageContentSecurityPolicy());
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex');
  res.set('Vary', 'Accept-Language, User-Agent');
  res.send(html);
}

function buildShareHtml(model) {
  const template = loadPublicMessageTemplate();
  const absoluteCssUrl = `${model.assetBaseUrl}/public-message.css`;
  const absoluteJsUrl = `${model.assetBaseUrl}/public-message.js`;
  const absoluteIconUrl = `${model.assetBaseUrl}/icon-192x192.png`;
  const absoluteOverlayUrl = `${model.assetBaseUrl}/sticker-protection-overlay.svg`;
  const initialPageState = buildInitialPageState(model);
  const structuredDataJson = escapeJsonForScriptTag(JSON.stringify(buildPublicMessageStructuredData(model)));
  const inlineFontCss = buildInlineFontCss(model.message, model.assetBaseUrl);

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
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_STRUCTURED_DATA__', structuredDataJson);
  html = model.imageUrl
    ? upsertMetaTag(html, 'property', 'og:image', model.imageUrl)
    : removeMetaTag(html, 'property', 'og:image');
  html = model.imageUrl
    ? upsertMetaTag(html, 'property', 'og:image:type', model.imageType || OG_IMAGE_TYPE_PNG)
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
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_HERO_TITLE__', escapeHtml(model.strings.heroTitle));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_DESCRIPTION__', escapeHtml(initialPageState.descriptionText));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_DESCRIPTION_HIDDEN__', initialPageState.descriptionHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_STATUS__', escapeHtml(initialPageState.statusText));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_STATUS_HIDDEN__', initialPageState.statusHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_CARD_CLASS_SUFFIX__', initialPageState.messageCardClassSuffix);
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_CARD_HIDDEN__', initialPageState.messageCardHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_MEDIA_VISIBLE_CLASS__', initialPageState.mediaVisibleClass);
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_MEDIA_HIDDEN__', initialPageState.mediaHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_MEDIA_FRAME_SUFFIX__', initialPageState.mediaFrameClassSuffix);
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_EMBED_CLASS_SUFFIX__', initialPageState.embedClassSuffix);
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_EMBED_HIDDEN__', initialPageState.embedHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_EMBED_HTML__', initialPageState.embedHtml);
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_ATTRIBUTION__', escapeHtml(initialPageState.attributionText));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_ATTRIBUTION_HREF__', escapeAttribute(initialPageState.attributionHref || '#'));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_ATTRIBUTION_HIDDEN__', initialPageState.attributionHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_TEXT_HIDDEN__', initialPageState.textHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_TEXT_STYLE__', initialPageState.textStyleAttribute);
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_TEXT__', escapeHtml(initialPageState.text));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_HASHTAGS__', initialPageState.hashtagsHtml);
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_HASHTAGS_HIDDEN__', initialPageState.hashtagsHidden ? 'hidden' : '');
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_OPEN_APP_HREF__', escapeAttribute(initialPageState.openAppHref));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_OPEN_APP_LABEL__', escapeHtml(initialPageState.openAppLabel));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_COPY_LINK_LABEL__', escapeHtml(initialPageState.copyLinkLabel));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_CONTEXT_TITLE__', escapeHtml(model.strings.contextTitle));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_CONTEXT_BODY__', escapeHtml(model.strings.contextBody));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_CONTEXT_LINK_HREF__', escapeAttribute(resolveWhatIsPageUrl(resolvePublicSiteBaseUrl(), model.locale)));
  html = replaceTemplatePlaceholder(html, '__PUBLIC_MESSAGE_CONTEXT_LINK_LABEL__', escapeHtml(model.strings.moreInfo));
  if (inlineFontCss) {
    html = html.replace(/<\/head>/i, `  <style id="public-message-inline-font">${inlineFontCss}</style>\n</head>`);
  }
  html = html.replace(
    /<script src="\/site-assets\/public-message\.js" defer><\/script>/i,
    `<meta name="public-message-bootstrap" content="${escapeAttribute(JSON.stringify(model.bootstrap))}">\n  <script src="${escapeAttribute(absoluteJsUrl)}" defer></script>`
  );
  return html;
}

function buildInitialPageState(model) {
  const strings = model.strings || STRINGS[model.locale] || STRINGS.en;
  const message = normalizePublicMessage(model.message);
  const appMessageHref = model.messageUuid
    ? `${model.appBaseUrl}/?publicMessage=${encodeURIComponent(model.messageUuid)}`
    : `${model.appBaseUrl}/`;
  const multimedia = parseMultimedia(message?.multimedia);
  const mediaSummary = buildServerMediaSummary(multimedia, strings);
  const hashtags = Array.isArray(message?.hashtags) ? message.hashtags : [];
  const text = typeof message?.message === 'string' ? message.message.trim() : '';
  const fontFamily = extractAllowedFontFamily(message?.fontFamily || message?.style);

  return {
    descriptionText: message ? '' : (model.initialError?.body || model.description || strings.unavailableDescription),
    descriptionHidden: Boolean(message),
    statusText: '',
    statusHidden: true,
    messageCardClassSuffix: !mediaSummary.visible ? ' message-card--without-media' : '',
    messageCardHidden: !message,
    mediaVisibleClass: mediaSummary.visible ? ' is-visible' : '',
    mediaHidden: !mediaSummary.visible,
    mediaFrameClassSuffix: mediaSummary.frameClassSuffix,
    embedClassSuffix: mediaSummary.embedClassSuffix,
    embedHidden: !mediaSummary.visible,
    embedHtml: mediaSummary.embedHtml,
    attributionText: mediaSummary.attributionText,
    attributionHref: mediaSummary.attributionHref,
    attributionHidden: !mediaSummary.attributionText || !mediaSummary.attributionHref,
    textHidden: !text,
    textStyleAttribute: fontFamily
      ? ` style="font-family: &quot;${escapeAttribute(fontFamily)}&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif;"`
      : '',
    text,
    hashtagsHtml: buildHashtagsHtml(hashtags),
    hashtagsHidden: hashtags.length === 0,
    openAppHref: appMessageHref,
    openAppLabel: strings.openApp || STRINGS.en.openApp,
    copyLinkLabel: strings.copyLink || STRINGS.en.copyLink
  };
}

function normalizePublicMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'object') {
    return null;
  }

  const multimedia = sanitizePublicMultimedia(parseMultimedia(rawMessage.multimedia));
  const hashtags = parseHashtagStorageValue(rawMessage.hashtags);
  const fontFamily = extractAllowedFontFamily(rawMessage.fontFamily || rawMessage.style);
  const messageUuid = typeof rawMessage.uuid === 'string' ? rawMessage.uuid.trim() : '';
  const messageText = typeof rawMessage.message === 'string' ? rawMessage.message.trim() : '';

  return {
    uuid: messageUuid,
    message: messageText,
    fontFamily: fontFamily || '',
    hashtags,
    multimedia
  };
}

function sanitizePublicMultimedia(multimedia) {
  const media = multimedia && typeof multimedia === 'object' ? multimedia : null;
  if (!media || !hasMultimedia(media)) {
    return null;
  }

  const type = normalizePublicMediaType(media);
  if (!type) {
    return null;
  }

  const title = normalizeMediaTitle(media);
  return {
    type,
    title: title || ''
  };
}

function normalizePublicMediaType(multimedia) {
  const mediaType = typeof multimedia?.type === 'string'
    ? multimedia.type.trim().toLowerCase()
    : '';
  const imageUrl = typeof multimedia?.url === 'string' ? multimedia.url.trim() : '';

  if (mediaType === 'sticker') return 'sticker';
  if (mediaType === 'youtube') return 'youtube';
  if (mediaType === 'spotify') return 'spotify';
  if (mediaType === 'tiktok') return 'tiktok';
  if (mediaType === 'pinterest') return 'pinterest';
  if (mediaType === 'tenor') return 'tenor';
  if (mediaType === 'image' || isDirectImageMedia(mediaType, imageUrl)) return 'image';
  if (mediaType && mediaType !== 'undefined') return 'media';
  return 'media';
}

function buildHashtagsHtml(hashtags) {
  if (!Array.isArray(hashtags) || !hashtags.length) {
    return '';
  }

  return hashtags
    .map((tag) => {
      const normalized = String(tag || '').trim().replace(/^#+/, '');
      if (!normalized) {
        return '';
      }
      return `<span class="hashtag-chip">#${escapeHtml(normalized)}</span>`;
    })
    .filter(Boolean)
    .join('');
}

function buildServerMediaSummary(multimedia, strings) {
  const media = multimedia && typeof multimedia === 'object' ? multimedia : null;
  if (!media || !hasMultimedia(media)) {
    return {
      visible: false,
      frameClassSuffix: '',
      embedClassSuffix: '',
      embedHtml: '',
      attributionText: '',
      attributionHref: ''
    };
  }

  const mediaType = String(media.type || '').trim().toLowerCase();
  const iconType = resolveOgMediaIconType(mediaType, media);
  const label = mediaType === 'sticker'
    ? strings.stickerLabel
    : mediaType === 'image' || isDirectImageMedia(mediaType, media.url)
      ? strings.imageLabel
      : resolveMediaPlatformLabel(mediaType, media, strings);
  const title = truncate(singleLine(normalizeMediaTitle(media)), 120);

  return {
    visible: true,
    frameClassSuffix: '',
    embedClassSuffix: ' message-embed--summary',
    embedHtml: [
      '<div class="message-media-summary">',
      `  <span class="message-media-summary-icon" aria-hidden="true">${renderServerMediaIconSvg(iconType)}</span>`,
      '  <span class="message-media-summary-copy">',
      `    <span class="message-media-summary-label">${escapeHtml(label)}</span>`,
      title ? `    <span class="message-media-summary-title">${escapeHtml(title)}</span>` : '',
      '  </span>',
      '</div>'
    ].filter(Boolean).join('\n'),
    attributionText: '',
    attributionHref: ''
  };
}

function renderServerMediaIconSvg(type) {
  switch (type) {
  case 'image':
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-13Zm2 11.88 3.15-3.66a1 1 0 0 1 1.53.01l2.24 2.64 1.9-2.14a1 1 0 0 1 1.51 0L17 14.5V6H7v11.38ZM15.75 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" fill="currentColor"/></svg>';
  case 'sticker':
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M7 3h7.5A4.5 4.5 0 0 1 19 7.5V15a6 6 0 0 1-6 6H7A4 4 0 0 1 3 17V7a4 4 0 0 1 4-4Zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a4 4 0 0 0 4-4V8.83A3.02 3.02 0 0 1 14.17 11H13a1 1 0 1 1 0-2h1.17c.46 0 .83-.37.83-.83V7.5A2.5 2.5 0 0 0 14.5 5H7Zm1.75 6.75a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6.5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM8.9 15.56a1 1 0 0 1 1.41 0 2.39 2.39 0 0 0 3.38 0 1 1 0 0 1 1.42 1.4 4.39 4.39 0 0 1-6.22 0 1 1 0 0 1 0-1.4Z" fill="currentColor"/></svg>';
  case 'youtube':
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M21.58 7.19A2.92 2.92 0 0 0 19.53 5.1C17.75 4.63 12 4.63 12 4.63s-5.75 0-7.53.47A2.92 2.92 0 0 0 2.42 7.2 30.7 30.7 0 0 0 2 12a30.7 30.7 0 0 0 .42 4.81 2.92 2.92 0 0 0 2.05 2.09c1.78.47 7.53.47 7.53.47s5.75 0 7.53-.47a2.92 2.92 0 0 0 2.05-2.09A30.7 30.7 0 0 0 22 12a30.7 30.7 0 0 0-.42-4.81ZM10 15.5v-7l6 3.5-6 3.5Z" fill="currentColor"/></svg>';
  case 'spotify':
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.46 14.45a.93.93 0 0 1-1.28.3 9.84 9.84 0 0 0-5.49-1.37.93.93 0 1 1-.12-1.86 11.66 11.66 0 0 1 6.54 1.68.93.93 0 0 1 .35 1.25Zm1.82-2.7a1.17 1.17 0 0 1-1.61.39 12.63 12.63 0 0 0-6.74-1.7 1.17 1.17 0 1 1-.1-2.34 14.47 14.47 0 0 1 7.96 2 1.17 1.17 0 0 1 .49 1.65Zm.16-2.82A15.17 15.17 0 0 0 9.77 8.8a1.4 1.4 0 1 1-.14-2.8 17.86 17.86 0 0 1 10.16 2.4 1.4 1.4 0 1 1-1.35 2.53Z" fill="currentColor"/></svg>';
  case 'pinterest':
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.64 19.32 9.2 9.2 0 0 1 .08-2.63l.92-3.9s-.23-.47-.23-1.16c0-1.08.62-1.89 1.4-1.89.66 0 .98.5.98 1.09 0 .67-.42 1.66-.64 2.58-.18.77.38 1.4 1.13 1.4 1.36 0 2.4-1.43 2.4-3.5 0-1.83-1.31-3.1-3.18-3.1-2.17 0-3.45 1.63-3.45 3.31 0 .66.25 1.36.58 1.74a.23.23 0 0 1 .05.22l-.23.93c-.04.14-.12.17-.28.1-1.04-.48-1.69-1.98-1.69-3.18 0-2.59 1.88-4.97 5.42-4.97 2.84 0 5.05 2.03 5.05 4.75 0 2.83-1.79 5.12-4.27 5.12-.83 0-1.61-.43-1.88-.94l-.51 1.94c-.18.72-.67 1.61-1 2.15A10 10 0 1 0 12 2Z" fill="currentColor"/></svg>';
  case 'tiktok':
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M14 3c.18 1.5 1.3 3 3 3.41V9.1c-1.3 0-2.55-.42-3.57-1.2v5.78A4.68 4.68 0 1 1 8.75 9v2.77a1.92 1.92 0 1 0 1.93 1.91V3H14Z" fill="currentColor"/></svg>';
  case 'tenor':
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M6 4h12v3h-4.5V20h-3V7H6V4Z" fill="currentColor"/></svg>';
  default:
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M6 5.75A2.75 2.75 0 0 1 8.75 3h6.5A2.75 2.75 0 0 1 18 5.75v12.5A2.75 2.75 0 0 1 15.25 21h-6.5A2.75 2.75 0 0 1 6 18.25V5.75Zm5 3.56v5.38l4.5-2.69L11 9.3Z" fill="currentColor"/></svg>';
  }
}

function buildPublicMessageStructuredData(model) {
  const strings = model.strings || STRINGS[model.locale] || STRINGS.en;
  const canonicalUrl = model.canonicalUrl;
  const appUrl = normalizeAbsoluteUrl(model.appBaseUrl) || PRODUCTION_PUBLIC_APP_URL;
  const publisher = {
    '@type': 'Organization',
    name: 'JackTools.Net UG (limited liability)',
    url: appUrl
  };
  const website = {
    '@type': 'WebSite',
    '@id': `${appUrl}/#website`,
    name: 'MessageDrop',
    url: appUrl,
    description: strings.contextBody,
    inLanguage: model.locale,
    publisher
  };
  const webpage = {
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: model.title,
    description: model.description,
    isPartOf: {
      '@id': `${appUrl}/#website`
    },
    inLanguage: model.locale
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [website, webpage]
  };
}

function resolveWhatIsPageUrl(siteBaseUrl, locale) {
  const baseUrl = normalizeAbsoluteUrl(siteBaseUrl) || PRODUCTION_PUBLIC_SITE_URL;
  if (locale === 'de') {
    return `${baseUrl}/de/was-ist-messagedrop/`;
  }
  if (locale === 'en') {
    return `${baseUrl}/en/what-is-messagedrop/`;
  }
  return `${baseUrl}/what-is-messagedrop/`;
}

function buildInlineFontCss(message, assetBaseUrl) {
  const fontFamily = extractAllowedFontFamily(message?.fontFamily || message?.style);
  if (!fontFamily) {
    return '';
  }

  const externalFontUrl = assetBaseUrl
    ? `${assetBaseUrl}/fonts/${encodeURIComponent(fontFamily)}.ttf`
    : '';

  return [
    loadEmbeddedFontCss(fontFamily, { fontDisplay: 'block', externalUrl: externalFontUrl }),
    `#message-text{font-family:"${escapeCssString(fontFamily)}",Roboto,"Helvetica Neue",Arial,sans-serif!important;}`
  ].join('');
}

function replaceTemplatePlaceholder(html, placeholder, value) {
  return html.split(placeholder).join(value ?? '');
}

function escapeJsonForScriptTag(value) {
  return String(value ?? '')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function resolveOgImageUrl(assetBaseUrl) {
  return `${assetBaseUrl}/share-card.png`;
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
    "base-uri 'none'",
    "font-src 'self' data:",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "frame-src 'none'"
  ].join('; ');
}

function loadEmbeddedFontCss(fontFamily, { fontDisplay = 'swap', externalUrl = '' } = {}) {
  if (!fontFamily) {
    return '';
  }

  const cacheKey = `${fontFamily}::${fontDisplay}::${externalUrl}`;
  if (embeddedFontCssCache.has(cacheKey)) {
    return embeddedFontCssCache.get(cacheKey) || '';
  }

  try {
    const fontPath = getFrontendPath('src', 'assets', 'fonts', `${fontFamily}.ttf`);
    const fontBuffer = fs.readFileSync(fontPath);
    const dataUri = `data:font/ttf;base64,${fontBuffer.toString('base64')}`;
    const srcEntries = [
      `local("${escapeCssString(fontFamily)}")`
    ];
    if (externalUrl) {
      srcEntries.push(`url("${externalUrl}") format("truetype")`);
    }
    srcEntries.push(`url("${dataUri}") format("truetype")`);
    const css = `@font-face{font-family:"${fontFamily}";src:${srcEntries.join(',')};font-style:normal;font-weight:400;font-display:${escapeCssIdentifier(fontDisplay)};}`;
    embeddedFontCssCache.set(cacheKey, css);
    return css;
  } catch {
    embeddedFontCssCache.set(cacheKey, '');
    return '';
  }
}

function getSupportedFrontendFonts() {
  if (supportedFrontendFontsCache) {
    return supportedFrontendFontsCache;
  }

  const supportedFonts = new Map();

  try {
    const fontsDir = getFrontendPath('src', 'assets', 'fonts');
    const entries = fs.readdirSync(fontsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry?.isFile?.() || !/\.ttf$/i.test(entry.name)) {
        continue;
      }

      const family = path.basename(entry.name, path.extname(entry.name)).trim();
      const normalized = normalizeFontToken(family);
      if (!family || !normalized) {
        continue;
      }

      supportedFonts.set(normalized, family);
    }
  } catch {
    // Ignore directory read failures and fall back to no custom-font support.
  }

  supportedFrontendFontsCache = supportedFonts;
  return supportedFrontendFontsCache;
}

function normalizeFontToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s*!important\s*$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .toLowerCase();
}

function resolveSupportedFontFamily(value) {
  const normalizedToken = normalizeFontToken(value);
  if (!normalizedToken) {
    return '';
  }

  return getSupportedFrontendFonts().get(normalizedToken) || '';
}

function extractAllowedFontFamily(styleValue) {
  if (typeof styleValue !== 'string' || !styleValue.trim()) {
    return '';
  }

  const trimmedValue = styleValue.trim();
  const directFamily = trimmedValue.replace(/^['"]+|['"]+$/g, '');
  const directResolvedFamily = resolveSupportedFontFamily(directFamily);
  if (directResolvedFamily) {
    return directResolvedFamily;
  }

  const match = trimmedValue.match(/font-family\s*:\s*([^;]+)/i);
  if (!match?.[1]) {
    return '';
  }

  const rawFamily = match[1]
    .split(',')[0]
    .trim()
    .replace(/\s*!important\s*$/i, '')
    .replace(/^['"]+|['"]+$/g, '');

  return resolveSupportedFontFamily(rawFamily);
}

function escapeCssIdentifier(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^A-Za-z-]+/g, '')
    .toLowerCase() || 'swap';
}

function escapeCssString(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
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

  if (normalizedType === 'image') return 'image';
  if (normalizedType === 'sticker') return 'sticker';
  if (normalizedType === 'youtube' || host.includes('youtube')) return 'youtube';
  if (normalizedType === 'tenor' || host.includes('tenor')) return 'tenor';
  if (normalizedType === 'pinterest' || host.includes('pinterest')) return 'pinterest';
  if (normalizedType === 'tiktok' || host.includes('tiktok')) return 'tiktok';
  if (normalizedType === 'spotify' || host.includes('spotify')) return 'spotify';
  if (isDirectImageMedia(normalizedType, multimedia?.url)) return 'image';
  return 'media';
}

function resolveMediaPlatformLabel(mediaType, multimedia, strings) {
  const host = resolveUrlHost(multimedia?.sourceUrl || multimedia?.url || extractIframeSrc(multimedia?.oembed?.html || ''));
  const map = {
    youtube: strings.youtubeVideoLabel || 'YouTube video',
    tenor: strings.tenorGifLabel || 'Tenor GIF',
    spotify: strings.spotifyLabel || 'Spotify',
    tiktok: strings.tiktokVideoLabel || 'TikTok video',
    pinterest: strings.pinterestPinLabel || 'Pinterest pin'
  };

  if (map[mediaType]) {
    return map[mediaType];
  }

  if (host.includes('youtube')) return strings.youtubeVideoLabel || 'YouTube video';
  if (host.includes('tenor')) return strings.tenorGifLabel || 'Tenor GIF';
  if (host.includes('spotify')) return strings.spotifyLabel || 'Spotify';
  if (host.includes('tiktok')) return strings.tiktokVideoLabel || 'TikTok video';
  if (host.includes('pinterest')) return strings.pinterestPinLabel || 'Pinterest pin';

  return strings.mediaLabel;
}

function buildMediaPreviewDescription(multimedia, strings) {
  const media = multimedia && typeof multimedia === 'object' ? multimedia : null;
  if (!media || !hasMultimedia(media)) {
    return '';
  }

  const mediaType = String(media.type || '').trim().toLowerCase();
  if (mediaType === 'sticker') {
    return strings.stickerLabel;
  }

  if (mediaType === 'image' || isDirectImageMedia(mediaType, media.url)) {
    return strings.imageLabel;
  }

  const platformLabel = resolveMediaPlatformLabel(mediaType, media, strings);
  return buildMediaSourceDescription(platformLabel, strings) || strings.mediaLabel;
}

function buildMediaSourceDescription(sourceLabel, strings) {
  const normalizedSourceLabel = String(sourceLabel || '').trim();
  if (!normalizedSourceLabel) {
    return '';
  }

  const template = String(strings?.mediaFromSourceTemplate || '').trim();
  if (!template.includes('{{source}}')) {
    return normalizedSourceLabel;
  }

  return template.replace('{{source}}', normalizedSourceLabel);
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
  if (isPreviewBotRequest(req)) {
    return 'en';
  }

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

function isPreviewBotRequest(req) {
  const userAgent = String(req.get?.('user-agent') || req.headers['user-agent'] || '').toLowerCase();
  if (!userAgent) {
    return false;
  }

  return [
    // Officially documented Meta crawlers:
    // https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
    'facebookexternalhit',
    'facebookcatalog',
    'meta-externalagent',
    'meta-externalfetcher',
    // Officially documented Slack preview fetchers:
    // https://api.slack.com/robots
    'slackbot-linkexpanding',
    'slack-imgproxy',
    'slackbot',
    // Officially documented X/Twitter card crawler:
    // https://developer.x.com/cards/getting-started
    'twitterbot',
    // Heuristic social / preview / sharing fetchers
    'whatsapp',
    'facebot',
    'linkedinbot',
    'discordbot',
    'telegrambot',
    'skypeuripreview',
    'embedly',
    'googlebot',
    'bingbot',
    'duckduckbot',
    'crawler',
    'spider',
    'preview'
  ].some((token) => userAgent.includes(token));
}

function shouldServerRedirectToApp(req, targetUrl) {
  if (!targetUrl || isPreviewBotRequest(req) || isPreviewRangeRequest(req)) {
    return false;
  }

  const params = new URLSearchParams(String(req.url || '').split('?')[1] || '');
  const previewFlag = String(
    params.get('preview')
    || params.get('render')
    || params.get('stay')
    || params.get('noRedirect')
    || ''
  ).trim().toLowerCase();

  if (previewFlag === '1' || previewFlag === 'true' || previewFlag === 'yes') {
    return false;
  }

  return true;
}

function isPreviewRangeRequest(req) {
  const rangeHeader = String(req.get?.('range') || req.headers['range'] || '').trim().toLowerCase();
  if (!rangeHeader) {
    return false;
  }

  return /^bytes=/.test(rangeHeader);
}

function buildPublicAppMessageUrl(req, messageUuid) {
  const appBaseUrl = resolvePublicAppBaseUrl(req);
  if (!appBaseUrl) {
    return '';
  }

  if (!messageUuid) {
    return `${appBaseUrl}/`;
  }

  return `${appBaseUrl}/?publicMessage=${encodeURIComponent(messageUuid)}`;
}

function resolvePublicSiteBaseUrl() {
  return normalizeAbsoluteUrl(process.env.PUBLIC_SITE_URL || process.env.SITE_URL) || PRODUCTION_PUBLIC_SITE_URL;
}

function resolvePublicAppBaseUrl(req) {
  const requestStage = resolvePublicRequestStage(req);
  const stageConfigured = resolveStageSpecificPublicAppUrl(requestStage);
  if (stageConfigured) {
    return stageConfigured;
  }

  const configured = normalizeAbsoluteUrl(process.env.PUBLIC_APP_URL || process.env.APP_URL);
  if (requestStage !== 'q' && configured) {
    return configured;
  }

  if (requestStage === 'local') {
    return LOCAL_PUBLIC_APP_URL;
  }

  if (requestStage === 'q') {
    return Q_STAGE_PUBLIC_APP_URL;
  }

  return configured || PRODUCTION_PUBLIC_APP_URL;
}

function resolvePublicMessageBaseUrl(req) {
  const requestStage = resolvePublicRequestStage(req);
  const stageConfigured = resolveStageSpecificPublicShareUrl(requestStage);
  if (stageConfigured) {
    return ensurePublicShareBaseUrl(stageConfigured);
  }

  const configured = normalizeAbsoluteUrl(process.env.PUBLIC_SHARE_BASE_URL);
  if (requestStage !== 'q' && configured) {
    return ensurePublicShareBaseUrl(configured);
  }

  if (requestStage === 'local') {
    const protocol = req.protocol || 'http';
    const host = getRequestHostHeader(req);
    if (host) {
      return `${protocol}://${host}`.replace(/\/$/, '') + '/p';
    }
    return LOCAL_PUBLIC_SHARE_URL;
  }

  if (requestStage === 'q') {
    return Q_STAGE_PUBLIC_SHARE_URL;
  }

  return ensurePublicShareBaseUrl(resolvePublicAppBaseUrl(req) || PRODUCTION_PUBLIC_SHARE_URL);
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

function resolveStageSpecificPublicAppUrl(stage) {
  if (stage === 'q') {
    return normalizeAbsoluteUrl(
      process.env.Q_PUBLIC_APP_URL
      || process.env.PUBLIC_APP_URL_Q
      || process.env.PUBLIC_APP_URL_Q_STAGE
      || process.env.Q_FRONTEND_URL
      || process.env.FRONTEND_URL_Q
    );
  }

  if (stage === 'local') {
    return normalizeAbsoluteUrl(process.env.LOCAL_PUBLIC_APP_URL);
  }

  return '';
}

function resolveStageSpecificPublicShareUrl(stage) {
  if (stage === 'q') {
    return normalizeAbsoluteUrl(
      process.env.Q_PUBLIC_SHARE_BASE_URL
      || process.env.PUBLIC_SHARE_BASE_URL_Q
      || process.env.PUBLIC_SHARE_BASE_URL_Q_STAGE
    );
  }

  if (stage === 'local') {
    return normalizeAbsoluteUrl(process.env.LOCAL_PUBLIC_SHARE_BASE_URL);
  }

  return '';
}

function resolvePublicRequestStage(req) {
  const configuredStage = normalizeStageName(
    process.env.PUBLIC_STAGE
    || process.env.APP_STAGE
    || process.env.DEPLOYMENT_STAGE
    || process.env.STAGE
  );
  if (configuredStage === 'q' || configuredStage === 'local') {
    return configuredStage;
  }

  const host = getRequestHostname(req);
  if (!host) {
    return '';
  }

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'local';
  }

  if (isQStageHostname(host)) {
    return 'q';
  }

  return '';
}

function getRequestHostname(req) {
  const hostHeader = getRequestHostHeader(req);
  return String(hostHeader || '')
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function getRequestHostHeader(req) {
  const forwardedHost = typeof req.get === 'function'
    ? req.get('x-forwarded-host')
    : req?.headers?.['x-forwarded-host'];
  return String(forwardedHost || (typeof req.get === 'function' ? req.get('host') : req?.headers?.host) || req?.hostname || '')
    .split(',')[0]
    .trim();
}

function ensurePublicShareBaseUrl(value) {
  const normalized = normalizeAbsoluteUrl(value);
  if (!normalized) {
    return '';
  }

  return normalized.endsWith('/p') ? normalized : `${normalized}/p`;
}

function normalizeStageName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'local' || normalized === 'localhost' || normalized === 'development' || normalized === 'dev') {
    return 'local';
  }

  if (
    normalized === 'q'
    || normalized === 'qa'
    || normalized === 'test'
    || normalized === 'stage'
    || normalized === 'staging'
    || normalized === 'q-stage'
  ) {
    return 'q';
  }

  return normalized;
}

function isQStageHostname(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized === 'q.frontend.messagedrop.de'
    || normalized.startsWith('q.')
    || normalized.includes('.q.')
    || normalized.includes('-q.')
    || normalized.includes('.q-')
    || normalized.includes('q-stage')
    || normalized.includes('staging')
  );
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

function parseHashtagStorageValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeHashtagToken(entry))
      .filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const raw = value.trim();
  if (!raw) {
    return [];
  }

  if (raw.startsWith('|') && raw.endsWith('|')) {
    return raw
      .slice(1, -1)
      .split('|')
      .map((entry) => normalizeHashtagToken(entry))
      .filter(Boolean);
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => normalizeHashtagToken(entry))
        .filter(Boolean);
    }
  } catch {
    // ignore malformed legacy payload
  }

  return raw
    .split(/[\s,;]+/g)
    .map((entry) => normalizeHashtagToken(entry))
    .filter(Boolean);
}

function normalizeHashtagToken(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const normalized = String(value)
    .trim()
    .replace(/^#+/, '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();

  return /^[\p{L}\p{N}_]{2,32}$/u.test(normalized) ? normalized : '';
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
