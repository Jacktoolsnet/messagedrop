const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toParagraph = (lines) => {
  const trimmedLines = lines.map((line) => line.trim()).filter(Boolean);
  if (trimmedLines.length === 0) {
    return '';
  }

  const shouldUseBreaks =
    trimmedLines.length > 1 &&
    trimmedLines.every((line) => !/[.!?;:]$/.test(line)) &&
    trimmedLines.every((line) => line.length < 100);

  if (shouldUseBreaks) {
    return '<p>' + trimmedLines.map(escapeHtml).join('<br>') + '</p>';
  }

  return '<p>' + trimmedLines.map(escapeHtml).join(' ') + '</p>';
};

const renderLegalRichText = (sourceText) => {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let awaitingHeading = false;
  let headingConsumed = false;

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push(toParagraph(paragraphLines));
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push('<ul>' + listItems.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>');
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '###') {
      flushParagraph();
      flushList();
      awaitingHeading = !headingConsumed;
      headingConsumed = !awaitingHeading;
      continue;
    }

    if (awaitingHeading && trimmed) {
      blocks.push('<h2>' + escapeHtml(trimmed) + '</h2>');
      awaitingHeading = false;
      headingConsumed = true;
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      flushList();
      headingConsumed = false;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      headingConsumed = false;
      continue;
    }

    if (/^\d+\)/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push('<h3>' + escapeHtml(trimmed) + '</h3>');
      headingConsumed = false;
      continue;
    }

    paragraphLines.push(trimmed);
    headingConsumed = false;
  }

  flushParagraph();
  flushList();
  return blocks.join('\n');
};

const loadLegalDocument = async (details) => {
  if (details.dataset.loaded === 'true' || details.dataset.loading === 'true') {
    return;
  }

  const src = details.dataset.src;
  const status = details.querySelector('[data-legal-status]');
  const content = details.querySelector('[data-legal-content]');

  if (!src || !status || !content) {
    return;
  }

  const isGerman = document.documentElement.lang.toLowerCase().startsWith('de');
  const loadingText = isGerman ? 'Dokument wird geladen…' : 'Loading document…';
  const errorText = isGerman
    ? 'Das Dokument konnte nicht geladen werden. Du kannst weiterhin die Textlinks oben verwenden.'
    : 'The document could not be loaded. You can still use the text download links above.';

  details.dataset.loading = 'true';
  status.hidden = false;
  status.textContent = loadingText;

  try {
    const response = await fetch(src, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('Request failed with status ' + response.status);
    }

    const text = await response.text();
    content.innerHTML = renderLegalRichText(text);
    content.hidden = false;
    status.hidden = true;
    details.dataset.loaded = 'true';
  } catch (error) {
    status.hidden = false;
    status.textContent = errorText;
    console.error(error);
  } finally {
    details.dataset.loading = 'false';
  }
};

document.querySelectorAll('[data-legal-doc]').forEach((details) => {
  details.addEventListener('toggle', () => {
    if (details.open) {
      void loadLegalDocument(details);
    }
  });
});

const loadLegalHubDocument = async (trigger, options = {}) => {
  const viewer = document.querySelector('[data-legal-hub]');
  if (!viewer) {
    return;
  }

  const docKey = trigger.dataset.docKey || '';
  const titleNode = viewer.querySelector('[data-legal-hub-title]');
  const content = viewer.querySelector('[data-legal-hub-content]');
  const preferredDocLanguage = viewer.dataset.activeDocLang
    || viewer.dataset.defaultDocLang
    || (document.documentElement.lang.toLowerCase().startsWith('de') ? 'de' : 'en');
  const resolvedDocLanguage = preferredDocLanguage === 'de' ? 'de' : 'en';
  const src = resolvedDocLanguage === 'de'
    ? (trigger.dataset.srcDe || trigger.dataset.srcEn || '')
    : (trigger.dataset.srcEn || trigger.dataset.srcDe || '');

  if (!src || !content) {
    return;
  }

  const isGerman = document.documentElement.lang.toLowerCase().startsWith('de');
  const loadingText = isGerman ? 'Dokument wird geladen…' : 'Loading document…';
  const errorText = isGerman
    ? 'Das Dokument konnte nicht geladen werden. Bitte versuche es erneut.'
    : 'The document could not be loaded. Please try again.';

  document.querySelectorAll('[data-legal-hub-trigger]').forEach((button) => {
    button.setAttribute('aria-pressed', button === trigger ? 'true' : 'false');
  });

  document.querySelectorAll('[data-legal-doc-lang-trigger]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.docLang === resolvedDocLanguage ? 'true' : 'false');
  });

  viewer.dataset.activeDocKey = docKey;
  viewer.dataset.activeDocLang = resolvedDocLanguage;
  if (titleNode) {
    titleNode.textContent = '';
  }
  content.setAttribute('lang', resolvedDocLanguage);
  content.innerHTML = '<p class="legal-hub-loading">' + escapeHtml(loadingText) + '</p>';

  if (window.history?.replaceState) {
    const params = new URLSearchParams(window.location.search);
    if (docKey) {
      params.set('doc', docKey);
    } else {
      params.delete('doc');
    }
    params.set('docLang', resolvedDocLanguage);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? window.location.pathname + '?' + nextQuery : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }

  if (options.scrollIntoView !== false) {
    viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  try {
    const response = await fetch(src, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('Request failed with status ' + response.status);
    }

    const text = await response.text();
    content.innerHTML = renderLegalRichText(text);
  } catch (error) {
    content.innerHTML = '<p class="legal-hub-error">' + escapeHtml(errorText) + '</p>';
    console.error(error);
  }
};

document.querySelectorAll('[data-legal-hub-trigger]').forEach((button) => {
  button.addEventListener('click', () => {
    void loadLegalHubDocument(button);
  });
});

document.querySelectorAll('[data-legal-doc-lang-trigger]').forEach((button) => {
  button.addEventListener('click', () => {
    const viewer = document.querySelector('[data-legal-hub]');
    if (!viewer) {
      return;
    }

    const requestedLanguage = button.dataset.docLang === 'de' ? 'de' : 'en';
    viewer.dataset.activeDocLang = requestedLanguage;
    const activeDocKey = viewer.dataset.activeDocKey || viewer.dataset.defaultDocKey || '';
    const activeButton = Array.from(document.querySelectorAll('[data-legal-hub-trigger]')).find(
      (candidate) => candidate.dataset.docKey === activeDocKey,
    );

    if (activeButton) {
      void loadLegalHubDocument(activeButton, { scrollIntoView: false });
    }
  });
});

const params = new URLSearchParams(window.location.search);
const requestedDoc = params.get('doc');
const viewer = document.querySelector('[data-legal-hub]');
if (viewer) {
  const defaultDocKey = viewer.dataset.defaultDocKey || '';
  const defaultDocLanguage = viewer.dataset.defaultDocLang || (document.documentElement.lang.toLowerCase().startsWith('de') ? 'de' : 'en');
  viewer.dataset.activeDocLang = defaultDocLanguage;

  const targetButton = Array.from(document.querySelectorAll('[data-legal-hub-trigger]')).find(
    (button) => button.dataset.docKey === (requestedDoc || defaultDocKey),
  );

  if (targetButton) {
    void loadLegalHubDocument(targetButton, { scrollIntoView: false });
  }
}
