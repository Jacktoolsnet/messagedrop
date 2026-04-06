(function () {
  const STRINGS = {
    de: {
      heroTitle: 'Öffentliche Nachricht',
      loadingTitle: 'Öffentliche Nachricht laden…',
      loadingBody: 'Diese Nachricht wird gerade geladen.',
      loadState: 'Die öffentliche Nachricht wird geladen.',
      missingTitle: 'Kein Nachrichten-Link',
      missingBody: 'Der Link enthält keine gültige Nachrichten-ID.',
      unavailableTitle: 'Nachricht nicht verfügbar',
      unavailableBody: 'Diese öffentliche Nachricht ist nicht verfügbar.',
      genericErrorTitle: 'Nachricht konnte nicht geladen werden',
      genericErrorBody: 'Bitte versuche es später noch einmal.',
      openApp: 'In MessageDrop öffnen',
      copyLink: 'Link kopieren',
      copySuccess: 'Link kopiert.',
      copyFailed: 'Link konnte nicht kopiert werden.',
      plusCodeLabel: 'Plus Code',
      createdLabel: 'Erstellt',
      likesLabel: 'Likes',
      commentsLabel: 'Kommentare',
      mediaTitle: 'Weitere Medien',
      mediaBody: 'Diese Nachricht enthält zusätzliche Medien. Öffne MessageDrop, um sie anzusehen.',
      sourceLink: 'Originalquelle öffnen',
      pageTitle: 'MessageDrop | Öffentliche Nachricht',
      pageDescription: 'Öffentliche Nachricht auf MessageDrop'
    },
    en: {
      heroTitle: 'Public message',
      loadingTitle: 'Loading public message…',
      loadingBody: 'This message is currently loading.',
      loadState: 'The public message is loading.',
      missingTitle: 'No message link',
      missingBody: 'This link does not contain a valid message id.',
      unavailableTitle: 'Message unavailable',
      unavailableBody: 'This public message is not available.',
      genericErrorTitle: 'Could not load message',
      genericErrorBody: 'Please try again later.',
      openApp: 'Open in MessageDrop',
      copyLink: 'Copy link',
      copySuccess: 'Link copied.',
      copyFailed: 'Could not copy link.',
      plusCodeLabel: 'Plus code',
      createdLabel: 'Created',
      likesLabel: 'Likes',
      commentsLabel: 'Comments',
      mediaTitle: 'Additional media',
      mediaBody: 'This message contains additional media. Open MessageDrop to view it.',
      sourceLink: 'Open original source',
      pageTitle: 'MessageDrop | Public message',
      pageDescription: 'Public message on MessageDrop'
    },
    es: {
      heroTitle: 'Mensaje público',
      loadingTitle: 'Cargando mensaje público…',
      loadingBody: 'Este mensaje se está cargando.',
      loadState: 'El mensaje público se está cargando.',
      missingTitle: 'No hay enlace de mensaje',
      missingBody: 'Este enlace no contiene un identificador válido.',
      unavailableTitle: 'Mensaje no disponible',
      unavailableBody: 'Este mensaje público no está disponible.',
      genericErrorTitle: 'No se pudo cargar el mensaje',
      genericErrorBody: 'Inténtalo de nuevo más tarde.',
      openApp: 'Abrir en MessageDrop',
      copyLink: 'Copiar enlace',
      copySuccess: 'Enlace copiado.',
      copyFailed: 'No se pudo copiar el enlace.',
      plusCodeLabel: 'Plus Code',
      createdLabel: 'Creado',
      likesLabel: 'Me gusta',
      commentsLabel: 'Comentarios',
      mediaTitle: 'Medios adicionales',
      mediaBody: 'Este mensaje contiene medios adicionales. Abre MessageDrop para verlos.',
      sourceLink: 'Abrir fuente original',
      pageTitle: 'MessageDrop | Mensaje público',
      pageDescription: 'Mensaje público en MessageDrop'
    },
    fr: {
      heroTitle: 'Message public',
      loadingTitle: 'Chargement du message public…',
      loadingBody: 'Ce message est en cours de chargement.',
      loadState: 'Le message public est en cours de chargement.',
      missingTitle: 'Aucun lien de message',
      missingBody: 'Ce lien ne contient pas d’identifiant valide.',
      unavailableTitle: 'Message indisponible',
      unavailableBody: 'Ce message public n’est pas disponible.',
      genericErrorTitle: 'Impossible de charger le message',
      genericErrorBody: 'Veuillez réessayer plus tard.',
      openApp: 'Ouvrir dans MessageDrop',
      copyLink: 'Copier le lien',
      copySuccess: 'Lien copié.',
      copyFailed: 'Impossible de copier le lien.',
      plusCodeLabel: 'Plus code',
      createdLabel: 'Créé',
      likesLabel: 'J’aime',
      commentsLabel: 'Commentaires',
      mediaTitle: 'Médias supplémentaires',
      mediaBody: 'Ce message contient des médias supplémentaires. Ouvre MessageDrop pour les voir.',
      sourceLink: 'Ouvrir la source originale',
      pageTitle: 'MessageDrop | Message public',
      pageDescription: 'Message public sur MessageDrop'
    }
  };

  const locale = resolveLocale();
  const strings = STRINGS[locale];
  const bootstrap = resolveBootstrap();
  const apiBaseUrl = resolveApiBaseUrl();
  const appBaseUrl = bootstrap.appBaseUrl || resolveAppBaseUrl();
  const assetBaseUrl = bootstrap.assetBaseUrl || resolveAssetBaseUrl();
  const publicMessageBaseUrl = bootstrap.shareBaseUrl || resolvePublicMessageBaseUrl();
  const messageUuid = bootstrap.messageUuid || getMessageUuid();

  const pageTitle = document.getElementById('page-title');
  const pageDescription = document.getElementById('page-description');
  const heroLogoImage = document.getElementById('hero-logo-image');
  const heroLogoFallback = document.getElementById('hero-logo-fallback');
  const statusCard = document.getElementById('status-card');
  const messageCard = document.getElementById('message-card');
  const openAppLink = document.getElementById('open-app-link');
  const openAppLabel = document.getElementById('open-app-label');
  const copyLinkButton = document.getElementById('copy-link-button');
  const copyLinkLabel = document.getElementById('copy-link-label');
  const messageText = document.getElementById('message-text');
  const messageTextShell = document.getElementById('message-text-shell');
  const messageMediaShell = document.getElementById('message-media-shell');
  const messageMediaFrame = document.getElementById('message-media-frame');
  const messageImage = document.getElementById('message-image');
  const messageImageOverlay = document.getElementById('message-image-overlay');
  const messageEmbed = document.getElementById('message-embed');
  const mediaAttributionLink = document.getElementById('media-attribution-link');
  const hashtagList = document.getElementById('hashtag-list');
  const loadedFontFamilies = new Set();
  let stickerRenderSession = null;
  let stickerObjectUrl = '';
  let currentMedia = null;

  document.documentElement.lang = locale;
  document.title = strings.pageTitle;
  initializeHeroLogo();
  pageTitle.textContent = strings.heroTitle;
  pageDescription.textContent = strings.loadingBody;
  pageDescription.hidden = false;
  openAppLabel.textContent = strings.openApp;
  copyLinkLabel.textContent = strings.copyLink;
  setStatus(strings.loadState);
  setActionTargets(messageUuid ? `${appBaseUrl}/?publicMessage=${encodeURIComponent(messageUuid)}` : `${appBaseUrl}/`);
  window.addEventListener('pagehide', revokeStickerObjectUrl);

  copyLinkButton.addEventListener('click', async () => {
    const shareUrl = messageUuid ? resolvePublicMessageUrl(messageUuid) : window.location.href;
    const copied = await copyText(shareUrl);
    setStatus(copied ? strings.copySuccess : strings.copyFailed, !copied);
  });

  if (messageUuid) {
    const appMessageUrl = `${appBaseUrl}/?publicMessage=${encodeURIComponent(messageUuid)}`;
    openAppLink.setAttribute('href', appMessageUrl);
    updateCanonical(resolvePublicMessageUrl(messageUuid));
    void loadMessage(messageUuid);
  } else {
    openAppLink.setAttribute('href', `${appBaseUrl}/`);
    renderUnavailable(strings.missingTitle, strings.missingBody);
  }

  async function loadMessage(uuid) {
    try {
      const response = await fetch(`${apiBaseUrl}/message/get/uuid/${encodeURIComponent(uuid)}`, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        renderUnavailable(strings.unavailableTitle, strings.unavailableBody);
        return;
      }

      const payload = await response.json();
      const rawMessage = payload && typeof payload === 'object' ? payload.message : null;
      const message = normalizePublicMessage(rawMessage);
      if (!message || String(message.status || '').toLowerCase() !== 'enabled') {
        renderUnavailable(strings.unavailableTitle, strings.unavailableBody);
        return;
      }

      await renderMessage(message);
    } catch {
      renderUnavailable(strings.genericErrorTitle, strings.genericErrorBody);
    }
  }

  async function renderMessage(message) {
    const text = typeof message.message === 'string' ? message.message.trim() : '';
    const resolvedMessageUuid = typeof message.uuid === 'string' && message.uuid.trim() ? message.uuid.trim() : messageUuid;
    const description = text || normalizeMediaTitle(message.multimedia) || strings.pageDescription;
    const headline = text || normalizeMediaTitle(message.multimedia) || strings.pageTitle;
    const appMessageUrl = `${appBaseUrl}/?publicMessage=${encodeURIComponent(resolvedMessageUuid)}`;

    setActionTargets(appMessageUrl);
    pageTitle.textContent = strings.heroTitle;
    pageDescription.textContent = '';
    pageDescription.hidden = true;
    document.title = headline ? `MessageDrop | ${truncate(headline, 72)}` : strings.pageTitle;
    updateMeta('description', description);
    updateMeta('property', 'og:title', document.title);
    updateMeta('property', 'og:description', description);
    updateMeta('name', 'twitter:title', document.title);
    updateMeta('name', 'twitter:description', description);
    updateCanonical(resolvePublicMessageUrl(resolvedMessageUuid));
    messageText.textContent = text;
    applyMessageTextStyle(message.style);
    messageTextShell.hidden = !text;

    renderHashtags(message.hashtags);
    await renderMultimedia(message.multimedia);
    setStatus('');
    messageCard.hidden = false;
  }

  async function renderMultimedia(multimedia) {
    const media = multimedia && typeof multimedia === 'object' ? multimedia : null;
    if (!media || !hasMedia(media)) {
      clearMediaPresentation();
      setMediaTileVisible(false);
      return;
    }

    currentMedia = media;
    clearMediaPresentation();
    setMediaTileVisible(true);
    renderMediaAttribution(media);

    const mediaType = String(media.type || '').toLowerCase();
    const imageUrl = typeof media.url === 'string' ? media.url.trim() : '';

    if (mediaType === 'sticker') {
      const stickerId = resolveStickerId(media);
      if (stickerId) {
        const objectUrl = await fetchStickerRenderObjectUrl(stickerId);
        if (objectUrl) {
          showImageMedia(objectUrl, {
            alt: normalizeMediaTitle(media) || strings.pageDescription,
            isSticker: true,
            revokeObjectUrlOnLoad: true
          });
          return;
        }
      }
    }

    if (isDirectImageMedia(mediaType, imageUrl)) {
      showImageMedia(imageUrl, {
        alt: normalizeMediaTitle(media) || strings.pageDescription,
        isSticker: false
      });
      return;
    }

    const iframeSrc = extractSafeIframeSrc(media);
    if (iframeSrc) {
      showEmbedMedia(iframeSrc, mediaType);
      return;
    }

    clearMediaPresentation();
    setMediaTileVisible(false);
  }

  function renderUnavailable(title, body) {
    currentMedia = null;
    clearMediaPresentation();
    setMediaTileVisible(false);
    hashtagList.hidden = true;
    pageTitle.textContent = strings.heroTitle;
    pageDescription.textContent = body;
    pageDescription.hidden = false;
    document.title = strings.pageTitle;
    setStatus(body, true);
    messageCard.hidden = true;
  }

  function setStatus(text, isError) {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    statusCard.hidden = normalizedText.length === 0;
    statusCard.textContent = normalizedText;
    statusCard.classList.toggle('is-error', !!isError);
  }

  function setActionTargets(href) {
    const target = typeof href === 'string' && href.trim() ? href.trim() : `${window.location.origin}/`;
    openAppLink.setAttribute('href', target);
  }

  function setMediaTileVisible(isVisible) {
    messageMediaShell.hidden = !isVisible;
    messageMediaShell.classList.toggle('is-visible', isVisible);
    messageCard.classList.toggle('message-card--without-media', !isVisible);
  }

  function renderHashtags(hashtags) {
    hashtagList.innerHTML = '';
    const values = Array.isArray(hashtags)
      ? hashtags.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];

    if (!values.length) {
      hashtagList.hidden = true;
      return;
    }

    values.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'hashtag-chip';
      chip.textContent = tag.startsWith('#') ? tag : `#${tag}`;
      hashtagList.appendChild(chip);
    });
    hashtagList.hidden = false;
  }

  function applyMessageTextStyle(styleValue) {
    messageTextShell.removeAttribute('style');
    messageText.style.fontFamily = '';

    const fontFamily = extractAllowedFontFamily(styleValue);
    if (!fontFamily) {
      return;
    }

    ensureFontFace(fontFamily);
    messageText.style.fontFamily = `"${fontFamily}", Roboto, "Helvetica Neue", Arial, sans-serif`;
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

  function ensureFontFace(fontFamily) {
    if (!fontFamily || loadedFontFamilies.has(fontFamily) || typeof document === 'undefined') {
      return;
    }

    const fontUrl = resolveFontUrl(fontFamily);
    if (!fontUrl) {
      return;
    }

    const styleId = `public-message-font-${fontFamily}`;
    if (document.getElementById(styleId)) {
      loadedFontFamilies.add(fontFamily);
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = `
      @font-face {
        font-family: "${fontFamily}";
        src: url("${fontUrl}") format("truetype");
        font-style: normal;
        font-weight: 400;
        font-display: swap;
      }
    `;
    document.head.appendChild(styleElement);
    loadedFontFamilies.add(fontFamily);
  }

  function resolveFontUrl(fontFamily) {
    const safeFontFamily = typeof fontFamily === 'string'
      ? fontFamily.trim().replace(/[^A-Za-z0-9_-]/g, '')
      : '';

    if (!safeFontFamily) {
      return '';
    }

    if (bootstrap.assetBaseUrl) {
      return `${assetBaseUrl}/fonts/${safeFontFamily}.ttf`;
    }

    return `/assets/fonts/${safeFontFamily}.ttf`;
  }

  function clearMediaPresentation() {
    revokeStickerObjectUrl();
    messageMediaFrame.className = 'message-media-frame';
    messageImage.hidden = true;
    messageImage.removeAttribute('src');
    messageImage.removeAttribute('alt');
    messageImage.classList.remove('message-image--sticker');
    messageImage.onload = null;
    messageImage.onerror = null;
    messageImageOverlay.hidden = true;
    messageEmbed.hidden = true;
    messageEmbed.className = 'message-embed';
    messageEmbed.innerHTML = '';
    mediaAttributionLink.hidden = true;
    mediaAttributionLink.removeAttribute('href');
    mediaAttributionLink.textContent = '';
  }

  function showImageMedia(src, options) {
    const isSticker = options?.isSticker === true;
    messageImage.hidden = false;
    messageImage.classList.toggle('message-image--sticker', isSticker);
    messageImage.alt = options?.alt || strings.pageDescription;
    messageImage.onload = () => {
      if (options?.revokeObjectUrlOnLoad) {
        revokeStickerObjectUrl();
      }
    };
    messageImage.onerror = () => {
      if (options?.revokeObjectUrlOnLoad) {
        revokeStickerObjectUrl();
      }
      clearMediaPresentation();
      setMediaTileVisible(false);
    };
    messageImage.src = src;
    messageImageOverlay.hidden = !isSticker;
  }

  function showEmbedMedia(src, mediaType) {
    messageMediaFrame.classList.add('message-media-frame--fullwidth');
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    messageEmbed.innerHTML = '';
    messageEmbed.appendChild(iframe);
    messageEmbed.hidden = false;
    messageEmbed.className = 'message-embed';
    if (mediaType) {
      messageEmbed.classList.add(`message-embed--${mediaType}`);
    }
  }

  function renderMediaAttribution(multimedia) {
    const attribution = typeof multimedia?.attribution === 'string' ? multimedia.attribution.trim() : '';
    const sourceUrl = typeof multimedia?.sourceUrl === 'string' ? multimedia.sourceUrl.trim() : '';
    if (!attribution || !isHttpUrl(sourceUrl)) {
      mediaAttributionLink.hidden = true;
      mediaAttributionLink.removeAttribute('href');
      mediaAttributionLink.textContent = '';
      return;
    }

    mediaAttributionLink.hidden = false;
    mediaAttributionLink.setAttribute('href', sourceUrl);
    mediaAttributionLink.textContent = attribution;
  }

  function updateCanonical(url) {
    updateMeta('property', 'og:url', url);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', url);
    }
  }

  function updateMeta(attributeName, attributeValue, content) {
    let selector;
    let resolvedContent = content;

    if (content === undefined) {
      selector = `meta[name="${attributeName}"]`;
      resolvedContent = attributeValue;
      attributeValue = attributeName;
      attributeName = 'name';
    } else {
      selector = `meta[${attributeName}="${attributeValue}"]`;
    }

    const element = document.querySelector(selector);
    if (element) {
      element.setAttribute('content', resolvedContent || '');
    }
  }

  function resolveLocale() {
    const preferences = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];

    for (const entry of preferences) {
      const preferred = String(entry || '').toLowerCase();
      if (preferred.startsWith('de')) return 'de';
      if (preferred.startsWith('es')) return 'es';
      if (preferred.startsWith('fr')) return 'fr';
      if (preferred.startsWith('en')) return 'en';
    }

    return 'en';
  }

  function resolveApiBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    return 'https://q.backend.messagedrop.de';
  }

  function resolveAppBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4200';
    }
    return 'https://messagedrop.de';
  }

  function resolveAssetBaseUrl() {
    const pathname = String(window.location.pathname || '');
    if (/^\/m\/assets(?:\/|$)/i.test(pathname) || /^\/m\/[^/?#]+/i.test(pathname)) {
      return `${window.location.origin}/m/assets`;
    }

    if (/^\/share(?:\/|$)/i.test(pathname)) {
      return `${window.location.origin}/share/assets`;
    }

    return `${window.location.origin}/assets`;
  }

  function initializeHeroLogo() {
    if (!(heroLogoImage instanceof HTMLImageElement)) {
      return;
    }

    const showLogoImage = () => {
      heroLogoImage.hidden = false;
      if (heroLogoFallback) {
        heroLogoFallback.hidden = true;
      }
    };

    const showLogoFallback = () => {
      heroLogoImage.hidden = true;
      if (heroLogoFallback) {
        heroLogoFallback.hidden = false;
      }
    };

    heroLogoImage.addEventListener('load', showLogoImage, { once: true });
    heroLogoImage.addEventListener('error', showLogoFallback, { once: true });

    heroLogoImage.alt = 'MessageDrop';
    heroLogoImage.src = `${assetBaseUrl}/icon-192x192.png`;

    if (heroLogoImage.complete) {
      if (heroLogoImage.naturalWidth > 0) {
        showLogoImage();
      } else {
        showLogoFallback();
      }
    }
  }

  function resolvePublicMessageBaseUrl() {
    const pathname = String(window.location.pathname || '');
    const hostname = window.location.hostname;
    if (/^\/m(?:\/|$)/i.test(pathname)) {
      return `${window.location.origin}/m`;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/m';
    }

    return 'https://messagedrop.de/m';
  }

  function resolvePublicMessageUrl(uuid) {
    const normalizedUuid = typeof uuid === 'string' ? uuid.trim() : '';
    if (!normalizedUuid) {
      return `${publicMessageBaseUrl}/`;
    }

    return `${publicMessageBaseUrl}/${encodeURIComponent(normalizedUuid)}`;
  }

  function getMessageUuid() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }

    const pathname = String(window.location.pathname || '');
    const publicRouteMatch = pathname.match(/\/m\/([^/?#]+)/i);
    if (publicRouteMatch?.[1]) {
      return decodeURIComponent(publicRouteMatch[1]);
    }

    const match = pathname.match(/\/share\/message\/([^/]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  function resolveBootstrap() {
    const metaElement = document.querySelector('meta[name="public-message-bootstrap"]');
    let value = window.__PUBLIC_MESSAGE_BOOTSTRAP__;

    if ((!value || typeof value !== 'object') && metaElement) {
      const rawContent = metaElement.getAttribute('content');
      if (typeof rawContent === 'string' && rawContent.trim()) {
        try {
          value = JSON.parse(rawContent);
        } catch {
          value = null;
        }
      }
    }

    if (!value || typeof value !== 'object') {
      return {};
    }

    return {
      messageUuid: typeof value.messageUuid === 'string' ? value.messageUuid.trim() : '',
      appBaseUrl: typeof value.appBaseUrl === 'string' ? value.appBaseUrl.trim().replace(/\/+$/, '') : '',
      shareBaseUrl: typeof value.shareBaseUrl === 'string' ? value.shareBaseUrl.trim().replace(/\/+$/, '') : '',
      assetBaseUrl: typeof value.assetBaseUrl === 'string' ? value.assetBaseUrl.trim().replace(/\/+$/, '') : ''
    };
  }

  function normalizePublicMessage(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return null;
    }

    return {
      ...rawMessage,
      multimedia: parseMultimediaValue(rawMessage.multimedia),
      hashtags: parseHashtagStorageValue(rawMessage.hashtags)
    };
  }

  function parseMultimediaValue(value) {
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

  function truncate(value, maxLength) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
  }

  function hasMedia(multimedia) {
    const mediaType = typeof multimedia?.type === 'string'
      ? multimedia.type.trim().toLowerCase()
      : '';

    return Boolean(
      (mediaType && mediaType !== 'undefined')
      || (typeof multimedia.url === 'string' && multimedia.url.trim())
      || (typeof multimedia.sourceUrl === 'string' && multimedia.sourceUrl.trim())
      || (typeof multimedia.contentId === 'string' && multimedia.contentId.trim())
    );
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

  function normalizeMediaTitle(multimedia) {
    if (!multimedia || typeof multimedia !== 'object') {
      return '';
    }

    const candidates = [
      multimedia.title,
      multimedia.description
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  function extractSafeIframeSrc(multimedia) {
    const html = typeof multimedia?.oembed?.html === 'string' ? multimedia.oembed.html.trim() : '';
    if (!html || typeof document === 'undefined') {
      return '';
    }

    const template = document.createElement('template');
    template.innerHTML = html;
    const iframe = template.content.querySelector('iframe');
    const src = iframe?.getAttribute('src')?.trim() || '';
    return isAllowedEmbedUrl(src) ? src : '';
  }

  function isAllowedEmbedUrl(value) {
    if (!isHttpUrl(value)) {
      return false;
    }

    try {
      const parsed = new URL(value, window.location.origin);
      const host = parsed.hostname.toLowerCase();
      return [
        'www.youtube.com',
        'youtube.com',
        'www.youtube-nocookie.com',
        'youtube-nocookie.com',
        'open.spotify.com',
        'w.soundcloud.com',
        'www.tiktok.com',
        'tiktok.com',
        'assets.pinterest.com'
      ].includes(host);
    } catch {
      return false;
    }
  }

  function resolveStickerId(multimedia) {
    const contentId = typeof multimedia?.contentId === 'string' ? multimedia.contentId.trim() : '';
    if (contentId) {
      return contentId;
    }

    const renderUrl = typeof multimedia?.url === 'string' ? multimedia.url.trim() : '';
    if (!renderUrl) {
      return '';
    }

    try {
      const parsedUrl = new URL(renderUrl, window.location.origin);
      const match = parsedUrl.pathname.match(/\/stickers\/render\/([^/]+)/i);
      return match?.[1] ? decodeURIComponent(match[1]) : '';
    } catch {
      return '';
    }
  }

  async function fetchStickerRenderObjectUrl(stickerId) {
    if (!stickerId) {
      return '';
    }

    try {
      let response = await requestStickerRender(stickerId, await getStickerRenderToken(false));

      if (response.status === 401 || response.status === 403) {
        response = await requestStickerRender(stickerId, await getStickerRenderToken(true));
      }

      if (!response.ok) {
        return '';
      }

      const blob = await response.blob();
      if (!blob.size) {
        return '';
      }

      revokeStickerObjectUrl();
      stickerObjectUrl = window.URL.createObjectURL(blob);
      return stickerObjectUrl;
    } catch {
      return '';
    }
  }

  async function getStickerRenderToken(forceRefresh) {
    if (!forceRefresh && stickerRenderSession && stickerRenderSession.expiresAt - Date.now() > 15000) {
      return stickerRenderSession.token;
    }

    const response = await fetch(`${apiBaseUrl}/stickers/render-session`, {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('sticker_render_session_failed');
    }

    const payload = await response.json();
    const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
    if (!token) {
      throw new Error('missing_sticker_render_token');
    }

    const expiresAt = Number.isFinite(payload?.expiresAt)
      ? Number(payload.expiresAt)
      : Date.now() + 60000;

    stickerRenderSession = { token, expiresAt };
    return token;
  }

  function requestStickerRender(stickerId, token) {
    return fetch(`${apiBaseUrl}/stickers/render/${encodeURIComponent(stickerId)}?variant=preview`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'image/*'
      }
    });
  }

  function revokeStickerObjectUrl() {
    if (!stickerObjectUrl) {
      return;
    }

    window.URL.revokeObjectURL(stickerObjectUrl);
    stickerObjectUrl = '';
  }

  function isHttpUrl(value) {
    if (!value) {
      return false;
    }
    try {
      const parsed = new URL(value, window.location.origin);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function copyText(text) {
    if (!text) {
      return false;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fall back to execCommand below
      }
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'true');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    input.focus();
    input.select();

    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(input);
    }
  }
})();
