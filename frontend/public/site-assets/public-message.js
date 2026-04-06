(function () {
  const STRINGS = {
    de: {
      openApp: 'In MessageDrop öffnen',
      copyLink: 'Link kopieren',
      copySuccess: 'Link kopiert.',
      copyFailed: 'Link konnte nicht kopiert werden.'
    },
    en: {
      openApp: 'Open in MessageDrop',
      copyLink: 'Copy link',
      copySuccess: 'Link copied.',
      copyFailed: 'Could not copy link.'
    },
    es: {
      openApp: 'Abrir en MessageDrop',
      copyLink: 'Copiar enlace',
      copySuccess: 'Enlace copiado.',
      copyFailed: 'No se pudo copiar el enlace.'
    },
    fr: {
      openApp: 'Ouvrir dans MessageDrop',
      copyLink: 'Copier le lien',
      copySuccess: 'Lien copié.',
      copyFailed: 'Impossible de copier le lien.'
    }
  };

  const locale = resolveLocale();
  const strings = STRINGS[locale];
  const bootstrap = resolveBootstrap();
  const assetBaseUrl = bootstrap.assetBaseUrl || resolveAssetBaseUrl();
  const appBaseUrl = bootstrap.appBaseUrl || resolveAppBaseUrl();
  const publicMessageBaseUrl = bootstrap.shareBaseUrl || resolvePublicMessageBaseUrl();
  const messageUuid = bootstrap.messageUuid || getMessageUuid();

  const heroLogoImage = document.getElementById('hero-logo-image');
  const heroLogoFallback = document.getElementById('hero-logo-fallback');
  const statusCard = document.getElementById('status-card');
  const openAppLink = document.getElementById('open-app-link');
  const openAppLabel = document.getElementById('open-app-label');
  const copyLinkButton = document.getElementById('copy-link-button');
  const copyLinkLabel = document.getElementById('copy-link-label');

  const initialStatus = {
    text: typeof statusCard?.textContent === 'string' ? statusCard.textContent : '',
    hidden: Boolean(statusCard?.hidden),
    isError: Boolean(statusCard?.classList?.contains('is-error'))
  };

  initializeHeroLogo();
  configureActionTargets();
  configureCopyButton();

  function configureActionTargets() {
    if (openAppLabel) {
      openAppLabel.textContent = strings.openApp;
    }

    if (copyLinkLabel) {
      copyLinkLabel.textContent = strings.copyLink;
    }

    if (!openAppLink) {
      return;
    }

    const href = messageUuid
      ? `${appBaseUrl}/?publicMessage=${encodeURIComponent(messageUuid)}`
      : `${appBaseUrl}/`;

    openAppLink.setAttribute('href', href);
  }

  function configureCopyButton() {
    if (!(copyLinkButton instanceof HTMLButtonElement)) {
      return;
    }

    copyLinkButton.addEventListener('click', async function () {
      const shareUrl = messageUuid
        ? `${publicMessageBaseUrl}/${encodeURIComponent(messageUuid)}`
        : window.location.href;
      const copied = await copyText(shareUrl);
      showStatus(copied ? strings.copySuccess : strings.copyFailed, !copied);
      window.setTimeout(restoreInitialStatus, 2400);
    });
  }

  function showStatus(text, isError) {
    if (!statusCard) {
      return;
    }

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    statusCard.textContent = normalizedText;
    statusCard.hidden = normalizedText.length === 0;
    statusCard.classList.toggle('is-error', Boolean(isError));
  }

  function restoreInitialStatus() {
    if (!statusCard) {
      return;
    }

    statusCard.textContent = initialStatus.text;
    statusCard.hidden = initialStatus.hidden;
    statusCard.classList.toggle('is-error', initialStatus.isError);
  }

  function initializeHeroLogo() {
    if (!(heroLogoImage instanceof HTMLImageElement)) {
      return;
    }

    const showLogoImage = function () {
      heroLogoImage.hidden = false;
      if (heroLogoFallback) {
        heroLogoFallback.hidden = true;
      }
    };

    const showLogoFallback = function () {
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

  function resolveAppBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4200';
    }
    return 'https://messagedrop.de';
  }

  function resolveAssetBaseUrl() {
    const pathname = String(window.location.pathname || '');
    if (/^\/m(?:\/|$)/i.test(pathname)) {
      return `${window.location.origin}/m/assets`;
    }
    return `${window.location.origin}/assets`;
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

    return '';
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

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
})();
