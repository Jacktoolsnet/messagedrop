import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(frontendRoot, 'public');
const legalSourceRoot = path.join(frontendRoot, 'src', 'assets', 'legal');
const baseUrl = 'https://messagedrop.net';
const appName = 'MessageDrop';
const appTagline = 'Digital graffiti for the world map.';
const appClaim = 'A global map where people can leave messages in real-world locations.';

const marketingPages = [
  {
    route: '/what-is-messagedrop/',
    slug: 'what-is-messagedrop',
    lang: 'en',
    title: 'What is MessageDrop?',
    description:
      'MessageDrop is a global map where people can leave messages in real-world locations — digital graffiti for the world map.',
    heroIcon: 'globe_location_pin',
    eyebrow: 'What is MessageDrop?',
    heroTitle: appClaim,
    heroText:
      'MessageDrop is digital graffiti for the world map. Public posts live on places instead of timelines, while private notes and chats stay close to the user and the device.',
    heroAsideTitle: 'Why it feels different',
    heroAsideItems: [
      'Place-based instead of feed-based',
      'Local-first and privacy-oriented by design',
      'Useful with or without an account',
      'Designed for discovery, context, and local relevance',
    ],
    sections: [
      {
        title: 'Core ideas',
        intro:
          'The public website should explain the concept in seconds. These are the ideas the app is built around.',
        tiles: [
          {
            icon: 'location_on',
            title: 'Messages belong to places',
            body:
              'Public notes, comments, and discoveries are attached to real-world locations, so the map itself becomes the entry point.',
          },
          {
            icon: 'draw',
            title: 'Digital graffiti, not another feed',
            body:
              'MessageDrop is meant to feel open, direct, and spatial. It is about leaving signals in the world, not chasing endless algorithmic timelines.',
          },
          {
            icon: 'lock',
            title: 'Local-first where possible',
            body:
              'A large share of data stays on the device. That reduces server-side processing and supports a privacy-oriented experience.',
          },
          {
            icon: 'travel_explore',
            title: 'Discover context around you',
            body:
              'Instead of searching a profile graph, users can explore places, local information, and social traces in one spatial interface.',
          },
        ],
      },
      {
        title: 'What people can do',
        intro: 'Use MessageDrop for everyday local discovery, lightweight community signals, and private follow-up communication.',
        featureList: [
          'Leave a public message at a real-world location',
          'Read what people have dropped nearby or in another city',
          'Create private notes that stay on your device',
          'Chat privately with contacts',
          'Follow places and contacts for updates where supported',
          'Explore local context without a personalized ranking feed',
        ],
      },
      {
        title: 'Who it is for',
        intro:
          'The strongest launch story is likely a focused use case first, then broader expansion. These are natural starting points.',
        cards: [
          {
            icon: 'groups',
            title: 'Local communities',
            body: 'Neighborhood signals, ad-hoc local tips, micro-updates, and place-based discussions.',
          },
          {
            icon: 'explore',
            title: 'Travelers and city explorers',
            body: 'A way to see social traces, memories, and context directly on places instead of scattered across apps.',
          },
          {
            icon: 'storefront',
            title: 'Places with a story',
            body: 'Events, venues, and locations can become containers for living public context.',
          },
        ],
      },
    ],
  },
  {
    route: '/how-it-works/',
    slug: 'how-it-works',
    lang: 'en',
    title: 'How MessageDrop works',
    description:
      'See how MessageDrop turns locations into entry points for public messages, local context, private notes, and private chats.',
    heroIcon: 'alt_route',
    eyebrow: 'How it works',
    heroTitle: 'Places first. Messages second. Context always.',
    heroText:
      'MessageDrop starts with the map. Users explore places, open location-based content, leave public drops, and continue with private notes or private chats when needed.',
    heroAsideTitle: 'In one sentence',
    heroAsideItems: [
      'Open the map',
      'Pick a place',
      'Read or leave a drop',
      'Continue privately when it makes sense',
    ],
    sections: [
      {
        title: 'Four simple steps',
        timeline: [
          {
            icon: 'map',
            title: '1. Open the map',
            body:
              'The map is the main entry point. Users browse nearby locations or jump to another area they want to explore.',
          },
          {
            icon: 'place_item',
            title: '2. Select a real-world place',
            body:
              'A place becomes the anchor for content. This keeps posts grounded in geography instead of drifting in a generic social feed.',
          },
          {
            icon: 'chat_add_on',
            title: '3. Read or leave a drop',
            body:
              'Users can discover public messages, comments, and context that belong to that place — or add their own contribution.',
          },
          {
            icon: 'forum',
            title: '4. Continue with your own structure',
            body:
              'Private notes, contacts, and chats support more personal or persistent workflows without turning the product into a traditional social network.',
          },
        ],
      },
      {
        title: 'Product principles',
        tiles: [
          {
            icon: 'privacy_tip',
            title: 'Privacy-oriented',
            body:
              'Local-first storage, encrypted areas, and data minimization shape how the product works behind the scenes.',
          },
          {
            icon: 'visibility',
            title: 'Open discovery',
            body:
              'People can explore public content without needing a heavyweight account-first experience.',
          },
          {
            icon: 'account_tree',
            title: 'No personalized ranking feed',
            body:
              'Public content is not built around an engagement-maximizing recommendation stream.',
          },
          {
            icon: 'near_me',
            title: 'Useful in motion',
            body:
              'The product naturally fits walking, traveling, neighborhoods, events, and place-based discovery.',
          },
        ],
      },
      {
        title: 'Typical use cases',
        cards: [
          {
            icon: 'campaign',
            title: 'Local signal board',
            body: 'Share updates, warnings, tips, or observations that matter because they happened at a specific place.',
          },
          {
            icon: 'history_edu',
            title: 'Memory drops',
            body: 'Treat the map as a memory layer where stories and observations can stay attached to places.',
          },
          {
            icon: 'connect_without_contact',
            title: 'Public to private handoff',
            body: 'Discover something publicly, then move to private organization or communication when needed.',
          },
        ],
      },
    ],
  },
  {
    route: '/faq/',
    slug: 'faq',
    lang: 'en',
    title: 'MessageDrop FAQ',
    description:
      'Answers to common questions about MessageDrop, including how it works, privacy, accounts, public messages, and legal basics.',
    heroIcon: 'quiz',
    eyebrow: 'FAQ',
    heroTitle: 'Short answers to the questions people will ask first.',
    heroText:
      'This page is designed for visitors, search engines, and AI systems that need a clean explanation of what MessageDrop is and how it behaves.',
    faqs: [
      {
        question: 'What is MessageDrop?',
        answer:
          'MessageDrop is a global map where people can leave messages in real-world locations. The core idea is digital graffiti for the world map: public messages belong to places, not just to profiles or feeds.',
      },
      {
        question: 'Do I need an account to use MessageDrop?',
        answer:
          'No. Public content can generally be explored without creating a user account. Some features, such as private notes, contacts, and private chats, require an account.',
      },
      {
        question: 'How is MessageDrop different from a normal social network?',
        answer:
          'MessageDrop is place-first. The map and real-world locations are central, and public content is not organized around a personalized recommendation feed.',
      },
      {
        question: 'Is MessageDrop privacy-oriented?',
        answer:
          'Yes. MessageDrop follows a privacy-oriented, local-first approach where a large share of data is stored primarily on the user device whenever technically possible.',
      },
      {
        question: 'Are private chats encrypted?',
        answer:
          'According to the current product and legal documentation, private chats are transmitted with encryption and are generally not readable in plain text by the provider.',
      },
      {
        question: 'Does MessageDrop use a personalized ranking system?',
        answer:
          'No. The legal and privacy texts state that public content is not algorithmically filtered or prioritized through a personalized recommendation or ranking system.',
      },
      {
        question: 'How old do you need to be to use MessageDrop?',
        answer:
          'Users must be at least 16 years old. If someone is 16 or 17 years old, legal texts currently state that parental or guardian consent is required for use.',
      },
      {
        question: 'Can external content providers be disabled?',
        answer:
          'Yes. External content such as YouTube or Spotify is designed to stay disabled until a user explicitly enables the provider.',
      },
      {
        question: 'Is MessageDrop an emergency service?',
        answer: 'No. MessageDrop is explicitly not an emergency service.',
      },
    ],
  },
  {
    route: '/legal/',
    slug: 'legal',
    lang: 'en',
    title: 'Legal information',
    description:
      'Central legal hub for MessageDrop with privacy policy, terms of service, legal notice, and disclaimer.',
    heroIcon: 'gavel',
    eyebrow: 'Legal',
    heroTitle: 'Public legal pages outside the app.',
    heroText:
      'These pages are delivered as regular static HTML so visitors, search engines, and AI systems can access the legal information directly without opening the app.',
    legalTiles: [
      {
        href: '/privacy/',
        icon: 'privacy_tip',
        title: 'Privacy Policy',
        body: 'Privacy-oriented, local-first storage, third-party embeds, push notifications, and GDPR information.',
      },
      {
        href: '/terms-of-service/',
        icon: 'rule',
        title: 'Terms of Service',
        body: 'Rules for using MessageDrop, prohibited content, moderation, and general platform behavior.',
      },
      {
        href: '/impressum/',
        icon: 'business',
        title: 'Impressum / Legal Notice',
        body: 'Provider details, company information, DSA contact point, and dispute resolution information.',
      },
      {
        href: '/disclaimer/',
        icon: 'warning',
        title: 'Disclaimer',
        body: 'Scope of service, technical limitations, minimum age, local storage risks, and liability notes.',
      },
    ],
  },
];

const legalPages = [
  {
    route: '/privacy/',
    slug: 'privacy',
    lang: 'de',
    title: 'Privacy Policy',
    description: 'Static privacy policy page for MessageDrop, including the authoritative German version and the English translation.',
    heroIcon: 'privacy_tip',
    eyebrow: 'Privacy',
    heroTitle: 'Privacy policy outside the app',
    heroText:
      'This page exposes the current privacy policy as crawlable HTML. The German version is authoritative; the English translation is provided for convenience.',
    downloads: [
      { href: '/assets/legal/privacy-policy-de.txt', label: 'German text version' },
      { href: '/assets/legal/privacy-policy-en.txt', label: 'English text version' },
    ],
    summaryTiles: [
      { icon: 'devices', title: 'Local-first storage', body: 'A large share of data is intended to stay primarily on the user device.' },
      { icon: 'visibility_off', title: 'No personalized ranking', body: 'Public content is not described as using a personalized recommendation feed.' },
      { icon: 'encrypted', title: 'Protected private communication', body: 'Private chats are documented as using encryption and technical protection measures.' },
      { icon: 'toggle_off', title: 'Third-party providers are opt-in', body: 'External providers are meant to stay disabled until users explicitly enable them.' },
    ],
    deSource: 'privacy-policy-de.txt',
    enSource: 'privacy-policy-en.txt',
  },
  {
    route: '/terms-of-service/',
    slug: 'terms-of-service',
    lang: 'de',
    title: 'Terms of Service',
    description: 'Static terms of service page for MessageDrop with German source text and English translation.',
    heroIcon: 'rule',
    eyebrow: 'Terms',
    heroTitle: 'Terms of Service outside the app',
    heroText:
      'This page provides a direct, static version of the terms so they can be read, linked, and indexed independently from the app experience.',
    downloads: [
      { href: '/assets/legal/terms-of-service-de.txt', label: 'German text version' },
      { href: '/assets/legal/terms-of-service-en.txt', label: 'English text version' },
    ],
    summaryTiles: [
      { icon: 'cake', title: '16+ rule', body: 'Use is limited to people who are at least 16 years old.' },
      { icon: 'public_off', title: 'Content rules', body: 'Public misuse, illegal content, and disclosure of personal data are prohibited.' },
      { icon: 'balance', title: 'DSA procedures', body: 'The terms describe moderation, notices, and complaint procedures under the DSA.' },
      { icon: 'save', title: 'Backups matter', body: 'The texts emphasize that local data can be lost and recovery depends on user backups.' },
    ],
    deSource: 'terms-of-service-de.txt',
    enSource: 'terms-of-service-en.txt',
  },
  {
    route: '/impressum/',
    slug: 'impressum',
    lang: 'de',
    title: 'Impressum / Legal Notice',
    description: 'Static legal notice page for MessageDrop with provider details and DSA contact information.',
    heroIcon: 'business',
    eyebrow: 'Impressum',
    heroTitle: 'Legal notice outside the app',
    heroText:
      'The legal notice is exposed as a normal HTML page so users and regulators can access provider details directly without opening the application.',
    downloads: [
      { href: '/assets/legal/legal-notice-de.txt', label: 'German text version' },
      { href: '/assets/legal/legal-notice-en.txt', label: 'English text version' },
    ],
    summaryTiles: [
      { icon: 'apartment', title: 'Provider details', body: 'Company name, address, registration details, and VAT number.' },
      { icon: 'person', title: 'Responsible person', body: 'Responsible managing director and content responsibility details.' },
      { icon: 'support_agent', title: 'DSA contact point', body: 'Direct contact details for DSA communication in German or English.' },
      { icon: 'gavel', title: 'Dispute resolution notice', body: 'Statement regarding participation in consumer arbitration proceedings.' },
    ],
    deSource: 'legal-notice-de.txt',
    enSource: 'legal-notice-en.txt',
  },
  {
    route: '/disclaimer/',
    slug: 'disclaimer',
    lang: 'de',
    title: 'Disclaimer',
    description: 'Static disclaimer and liability notice page for MessageDrop with German source text and English translation.',
    heroIcon: 'warning',
    eyebrow: 'Disclaimer',
    heroTitle: 'Liability notice outside the app',
    heroText:
      'This page keeps the disclaimer accessible as regular HTML. It explains technical limitations, minimum age requirements, local storage risks, and service boundaries.',
    downloads: [
      { href: '/assets/legal/disclaimer-de.txt', label: 'German text version' },
      { href: '/assets/legal/disclaimer-en.txt', label: 'English text version' },
    ],
    summaryTiles: [
      { icon: 'error_med', title: 'No emergency service', body: 'MessageDrop explicitly does not provide access to emergency services.' },
      { icon: 'storage', title: 'Local data can be lost', body: 'The disclaimer stresses the risk of losing locally stored data on the device.' },
      { icon: 'shield', title: 'Privacy-oriented design', body: 'The product is described as privacy-oriented and data-minimizing.' },
      { icon: 'map', title: 'Location-based public content', body: 'Public content is tied to places and may be reported, reviewed, or moderated.' },
    ],
    deSource: 'disclaimer-de.txt',
    enSource: 'disclaimer-en.txt',
  },
];

const legalRouteSet = new Set(legalPages.map((page) => trimTrailingSlash(page.route)));
const allRoutes = ['/', ...marketingPages.map((page) => page.route), ...legalPages.map((page) => page.route)];

function trimTrailingSlash(route) {
  if (route === '/') {
    return '/';
  }

  return route.endsWith('/') ? route.slice(0, -1) : route;
}

function normalizeRoute(route) {
  if (!route.startsWith('/')) {
    return `/${route}`;
  }

  return route.endsWith('/') ? route : `${route}/`;
}

function canonicalUrl(route) {
  const normalized = normalizeRoute(route);
  return normalized === '/' ? `${baseUrl}/` : `${baseUrl}${normalized}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toParagraph(lines) {
  const trimmedLines = lines.map((line) => line.trim()).filter(Boolean);
  if (trimmedLines.length === 0) {
    return '';
  }

  const shouldUseBreaks =
    trimmedLines.length > 1 &&
    trimmedLines.every((line) => !/[.!?;:]$/.test(line)) &&
    trimmedLines.every((line) => line.length < 100);

  if (shouldUseBreaks) {
    return `<p>${trimmedLines.map(escapeHtml).join('<br>')}</p>`;
  }

  return `<p>${trimmedLines.map(escapeHtml).join(' ')}</p>`;
}

function renderLegalRichText(sourceText) {
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
      blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
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
      blocks.push(`<h2>${escapeHtml(trimmed)}</h2>`);
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
      blocks.push(`<h3>${escapeHtml(trimmed)}</h3>`);
      headingConsumed = false;
      continue;
    }

    paragraphLines.push(trimmed);
    headingConsumed = false;
  }

  flushParagraph();
  flushList();
  return blocks.join('\n');
}

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appName,
    description: appClaim,
    url: `${baseUrl}/`,
    inLanguage: 'en',
    publisher: {
      '@type': 'Organization',
      name: 'JackTools.Net UG (limited liability)',
      url: `${baseUrl}/`,
    },
  };
}

function faqSchema(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function renderNav(currentRoute) {
  const navItems = [
    { href: '/what-is-messagedrop/', label: 'What is it?' },
    { href: '/how-it-works/', label: 'How it works' },
    { href: '/faq/', label: 'FAQ' },
    { href: '/privacy/', label: 'Privacy' },
    { href: '/legal/', label: 'Legal' },
  ];

  return navItems
    .map((item) => {
      const current = trimTrailingSlash(currentRoute);
      const itemPath = trimTrailingSlash(item.href);
      const hasExactNavItem = navItems.some((other) => trimTrailingSlash(other.href) === current);
      const isLegalItem = itemPath === '/legal' && legalRouteSet.has(current) && !hasExactNavItem;
      const isActive = current === itemPath || isLegalItem;
      return `<a href="${item.href}"${isActive ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
    })
    .join('');
}

function renderHeader(currentRoute) {
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="Open MessageDrop app home">
        <span class="brand-avatar">
          <img src="/icons/icon-192x192.png" alt="MessageDrop logo" width="64" height="64">
        </span>
        <span class="brand-copy">
          <strong>${appName}</strong>
          <span>${appTagline}</span>
        </span>
      </a>
      <nav class="site-nav" aria-label="Primary">
        ${renderNav(currentRoute)}
      </nav>
      <a class="button button-primary button-small" href="/">Open app</a>
    </header>
  `;
}

function renderFooter() {
  const links = [
    { href: '/what-is-messagedrop/', label: 'What is MessageDrop?' },
    { href: '/how-it-works/', label: 'How it works' },
    { href: '/faq/', label: 'FAQ' },
    { href: '/privacy/', label: 'Privacy' },
    { href: '/terms-of-service/', label: 'Terms' },
    { href: '/impressum/', label: 'Impressum' },
    { href: '/disclaimer/', label: 'Disclaimer' },
  ];

  return `
    <footer class="site-footer">
      <div>
        <strong>${appName}</strong>
        <p>${appClaim}</p>
      </div>
      <div class="footer-links">
        ${links.map((link) => `<a href="${link.href}">${escapeHtml(link.label)}</a>`).join('')}
      </div>
    </footer>
  `;
}

function renderHero(page) {
  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">${escapeHtml(page.eyebrow)}</span>
        <h1>${escapeHtml(page.heroTitle)}</h1>
        <p class="hero-text">${escapeHtml(page.heroText)}</p>
        <div class="cta-row">
          <a class="button button-primary" href="/">Open the app</a>
          <a class="button button-secondary" href="/legal/">Legal pages</a>
        </div>
      </div>
      <aside class="hero-panel" aria-label="Quick summary">
        <div class="icon-badge info-avatar" aria-hidden="true">
          <span class="material-symbols-outlined">${escapeHtml(page.heroIcon)}</span>
        </div>
        <h2>${escapeHtml(page.heroAsideTitle ?? 'Quick summary')}</h2>
        <ul class="check-list">
          ${(page.heroAsideItems ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </aside>
    </section>
  `;
}

function renderTileGrid(tiles) {
  return `
    <div class="tile-grid">
      ${tiles
        .map(
          (tile) => `
          <article class="tile">
            <div class="tile-header">
              <span class="icon-badge" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(tile.icon)}</span></span>
              <h3>${escapeHtml(tile.title)}</h3>
            </div>
            <p>${escapeHtml(tile.body)}</p>
          </article>
        `,
        )
        .join('')}
    </div>
  `;
}

function renderCardGrid(cards) {
  return `
    <div class="card-grid">
      ${cards
        .map(
          (card) => `
          <article class="info-card">
            <div class="tile-header">
              <span class="icon-badge" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(card.icon)}</span></span>
              <h3>${escapeHtml(card.title)}</h3>
            </div>
            <p>${escapeHtml(card.body)}</p>
          </article>
        `,
        )
        .join('')}
    </div>
  `;
}

function renderFeatureList(items) {
  return `
    <ul class="feature-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function renderTimeline(items) {
  return `
    <ol class="timeline">
      ${items
        .map(
          (item) => `
          <li class="timeline-item">
            <span class="icon-badge" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(item.icon)}</span></span>
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.body)}</p>
            </div>
          </li>
        `,
        )
        .join('')}
    </ol>
  `;
}

function renderSection(section) {
  return `
    <section class="content-section">
      <div class="section-heading">
        <h2>${escapeHtml(section.title)}</h2>
        ${section.intro ? `<p>${escapeHtml(section.intro)}</p>` : ''}
      </div>
      ${section.tiles ? renderTileGrid(section.tiles) : ''}
      ${section.cards ? renderCardGrid(section.cards) : ''}
      ${section.featureList ? renderFeatureList(section.featureList) : ''}
      ${section.timeline ? renderTimeline(section.timeline) : ''}
    </section>
  `;
}

function renderMarketingPage(page) {
  const body = [`<main class="site-main">`, renderHero(page)];

  if (page.sections) {
    body.push(...page.sections.map(renderSection));
  }

  if (page.faqs) {
    body.push(`
      <section class="content-section">
        <div class="section-heading">
          <h2>Frequently asked questions</h2>
          <p>Each answer is written in clear text so it can be indexed and cited easily.</p>
        </div>
        <div class="faq-list">
          ${page.faqs
            .map(
              (item, index) => `
              <details class="faq-item"${index === 0 ? ' open' : ''}>
                <summary>${escapeHtml(item.question)}</summary>
                <div class="faq-answer"><p>${escapeHtml(item.answer)}</p></div>
              </details>
            `,
            )
            .join('')}
        </div>
      </section>
    `);
  }

  if (page.legalTiles) {
    body.push(`
      <section class="content-section">
        <div class="section-heading">
          <h2>Legal pages</h2>
          <p>These links lead to the static legal documents that are available independently from the app UI.</p>
        </div>
        <div class="card-grid legal-links-grid">
          ${page.legalTiles
            .map(
              (item) => `
              <a class="info-card info-card-link" href="${item.href}">
                <div class="tile-header">
                  <span class="icon-badge" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(item.icon)}</span></span>
                  <h3>${escapeHtml(item.title)}</h3>
                </div>
                <p>${escapeHtml(item.body)}</p>
              </a>
            `,
            )
            .join('')}
        </div>
      </section>
    `);
  }

  body.push('</main>');

  const extraSchemas = [organizationSchema()];
  if (page.faqs) {
    extraSchemas.push(faqSchema(page));
  }

  return renderDocument({
    route: page.route,
    title: page.title,
    description: page.description,
    lang: page.lang,
    content: body.join('\n'),
    schemas: extraSchemas,
  });
}

async function renderLegalPage(page) {
  const germanText = await fs.readFile(path.join(legalSourceRoot, page.deSource), 'utf8');
  const englishText = await fs.readFile(path.join(legalSourceRoot, page.enSource), 'utf8');

  return renderDocument({
    route: page.route,
    title: page.title,
    description: page.description,
    lang: page.lang,
    content: `
      <main class="site-main legal-main">
        <section class="hero legal-hero">
          <div class="hero-copy">
            <span class="eyebrow">${escapeHtml(page.eyebrow)}</span>
            <h1>${escapeHtml(page.heroTitle)}</h1>
            <p class="hero-text">${escapeHtml(page.heroText)}</p>
            <div class="cta-row">
              ${page.downloads
                .map((download) => `<a class="button button-secondary" href="${download.href}">${escapeHtml(download.label)}</a>`)
                .join('')}
            </div>
          </div>
          <aside class="hero-panel" aria-label="Key legal notes">
            <div class="icon-badge info-avatar" aria-hidden="true">
              <span class="material-symbols-outlined">${escapeHtml(page.heroIcon)}</span>
            </div>
            <h2>Quick legal overview</h2>
            <ul class="check-list">
              <li>Static HTML page outside the app</li>
              <li>German version is authoritative</li>
              <li>English translation available below</li>
              <li>Raw text files remain downloadable</li>
            </ul>
          </aside>
        </section>

        <section class="content-section">
          <div class="section-heading">
            <h2>Summary tiles</h2>
            <p>These short tiles help visitors understand the legal scope quickly before reading the full document.</p>
          </div>
          ${renderTileGrid(page.summaryTiles)}
        </section>

        <section class="content-section legal-section">
          <div class="legal-stack">
            <article class="legal-card">
              <div class="legal-card-header">
                <span class="eyebrow eyebrow-inline">Authoritative German version</span>
                <h2>${escapeHtml(page.title)}</h2>
              </div>
              <div class="legal-prose" lang="de">
                ${renderLegalRichText(germanText)}
              </div>
            </article>

            <details class="translation-card">
              <summary>Open English translation</summary>
              <div class="legal-prose" lang="en">
                ${renderLegalRichText(englishText)}
              </div>
            </details>
          </div>
        </section>
      </main>
    `,
    schemas: [organizationSchema()],
  });
}

function renderDocument({ route, title, description, lang, content, schemas }) {
  const absoluteUrl = canonicalUrl(route);
  const metaTitle = `${appName} | ${title}`;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#05a51d">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(appName)}">
  <meta property="og:title" content="${escapeHtml(metaTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(absoluteUrl)}">
  <meta property="og:image" content="${baseUrl}/icons/icon-512x512.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${baseUrl}/icons/icon-512x512.png">
  <link rel="canonical" href="${escapeHtml(absoluteUrl)}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48x48.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">
  <link rel="preload" href="/assets/fonts/RobotoVariableFont.ttf" as="font" type="font/ttf" crossorigin>
  <link rel="preload" href="/assets/fonts/MaterialSymbolsOutlined.ttf" as="font" type="font/ttf" crossorigin>
  <link rel="stylesheet" href="/site-assets/public-pages.css">
  ${schemas.map(jsonLd).join('\n  ')}
</head>
<body>
  <div class="page-shell">
    ${renderHeader(route)}
    ${content}
    ${renderFooter()}
  </div>
</body>
</html>
`;
}

function renderCss() {
  return `@font-face {
  font-family: "Roboto";
  src: url("/assets/fonts/RobotoVariableFont.ttf") format("truetype-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Roboto";
  src: url("/assets/fonts/RobotoItalicVariableFont.ttf") format("truetype-variations");
  font-weight: 100 900;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: "Material Symbols Outlined";
  font-style: normal;
  font-weight: 100 700;
  src: url('/assets/fonts/MaterialSymbolsOutlined.ttf');
  font-display: block;
}

:root {
  color-scheme: light;
  --site-primary: #05a51d;
  --site-primary-deep: #0f766e;
  --site-secondary: #2563eb;
  --site-bg-start: #eafde8;
  --site-bg-end: #bff7c4;
  --site-surface: rgba(255, 255, 255, 0.94);
  --site-surface-strong: #ffffff;
  --site-text: #1f2937;
  --site-muted: #64748b;
  --site-border: rgba(15, 23, 42, 0.1);
  --site-outline: color-mix(in srgb, var(--site-text) 18%, transparent);
  --site-shadow: 0 18px 50px rgba(2, 8, 20, 0.16), 0 2px 6px rgba(2, 8, 20, 0.08);
  --site-shadow-soft: 0 10px 24px rgba(15, 23, 42, 0.12);
  --site-radius-xl: 24px;
  --site-radius-lg: 18px;
  --site-radius-md: 14px;
  --site-max: 1180px;
}

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
}

body {
  min-height: 100dvh;
  margin: 0;
  font-family: Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--site-text);
  background: linear-gradient(135deg, var(--site-bg-start), var(--site-bg-end));
}

img {
  max-width: 100%;
  display: block;
}

.material-symbols-outlined {
  font-family: "Material Symbols Outlined";
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  display: inline-block;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}

.page-shell {
  width: min(calc(100% - 2rem), var(--site-max));
  margin: 0 auto;
  padding: 1rem 0 2rem;
}

.site-header,
.site-footer,
.hero,
.content-section,
.translation-card,
.legal-card,
.info-card,
.tile,
.hero-panel,
.timeline-item,
.faq-item {
  border: 1px solid var(--site-border);
  box-shadow: var(--site-shadow);
}

.site-header,
.site-footer,
.hero,
.content-section,
.translation-card,
.legal-card,
.info-card,
.tile,
.hero-panel,
.timeline-item,
.faq-item,
.button {
  backdrop-filter: blur(10px);
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  margin-bottom: 1rem;
  border-radius: var(--site-radius-lg);
  background: var(--site-surface);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.brand-avatar,
.icon-badge {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
}

.brand-avatar {
  overflow: hidden;
}

.icon-badge.info-avatar,
.info-avatar {
  background: linear-gradient(135deg, #2563eb, #38bdf8);
}

.brand-copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.brand-copy strong {
  font-size: 1rem;
}

.brand-copy span:last-child {
  color: var(--site-muted);
  font-size: 0.92rem;
}

.site-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.site-nav a,
.footer-links a {
  color: var(--site-text);
  text-decoration: none;
}

.site-nav a {
  padding: 0.7rem 0.95rem;
  border-radius: 999px;
  font-weight: 500;
}

.site-nav a[aria-current="page"] {
  background: color-mix(in srgb, var(--site-primary) 12%, #fff);
  color: #0f5a1d;
}

.site-nav a:hover,
.footer-links a:hover,
.brand:hover {
  opacity: 0.9;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.8rem;
  padding: 0.8rem 1.05rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.button:hover,
.button:focus-visible,
.info-card-link:hover,
.info-card-link:focus-visible,
.faq-item summary:focus-visible {
  transform: translateY(-1px);
}

.button-primary {
  background: linear-gradient(135deg, #05a51d, #0f766e);
  color: #fff;
  box-shadow: 0 10px 24px rgba(5, 165, 29, 0.22);
}

.button-secondary {
  background: rgba(255, 255, 255, 0.72);
  color: var(--site-text);
  border: 1px solid var(--site-outline);
}

.button-small {
  min-height: 2.5rem;
  padding-inline: 0.9rem;
}

.site-main {
  display: grid;
  gap: 1rem;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.95fr);
  gap: 1rem;
  padding: clamp(1.25rem, 2vw, 1.9rem);
  border-radius: var(--site-radius-xl);
  background: var(--site-surface);
}

.hero-copy,
.hero-panel {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.hero-panel {
  padding: 1.2rem;
  border-radius: var(--site-radius-lg);
  background: color-mix(in srgb, white 82%, transparent);
  border: 1px solid var(--site-border);
  box-shadow: var(--site-shadow-soft);
}

.hero h1,
.content-section h2,
.tile h3,
.info-card h3,
.timeline-item h3,
.legal-card h2,
.translation-card summary,
.site-footer strong {
  margin: 0;
}

.hero h1 {
  font-size: clamp(2rem, 4vw, 3.35rem);
  line-height: 1.04;
  max-width: 12ch;
}

.hero-text,
.section-heading p,
.tile p,
.info-card p,
.timeline-item p,
.legal-prose p,
.site-footer p,
.faq-answer p {
  margin: 0;
  color: var(--site-muted);
  line-height: 1.65;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 2rem;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--site-primary) 12%, #fff);
  color: #0f5a1d;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.eyebrow-inline {
  margin-bottom: 0.75rem;
}

.cta-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.check-list,
.feature-list {
  display: grid;
  gap: 0.7rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.check-list li,
.feature-list li {
  position: relative;
  padding-left: 1.6rem;
  line-height: 1.55;
}

.check-list li::before,
.feature-list li::before {
  content: "•";
  position: absolute;
  left: 0.35rem;
  top: 0;
  color: var(--site-primary);
  font-weight: 900;
}

.content-section {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 2vw, 1.5rem);
  border-radius: var(--site-radius-xl);
  background: var(--site-surface);
}

.section-heading {
  display: grid;
  gap: 0.45rem;
}

.tile-grid,
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 1rem;
}

.tile,
.info-card {
  display: grid;
  gap: 0.9rem;
  padding: 1.1rem;
  border-radius: var(--site-radius-lg);
  background: color-mix(in srgb, white 86%, transparent);
  color: inherit;
  text-decoration: none;
}

.info-card-link {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.tile-header {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.tile-header .icon-badge {
  width: 3rem;
  height: 3rem;
}

.timeline {
  display: grid;
  gap: 1rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.timeline-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border-radius: var(--site-radius-lg);
  background: color-mix(in srgb, white 86%, transparent);
}

.timeline-item .icon-badge {
  margin-top: 0.2rem;
}

.faq-list {
  display: grid;
  gap: 0.85rem;
}

.faq-item {
  overflow: hidden;
  border-radius: var(--site-radius-lg);
  background: color-mix(in srgb, white 84%, transparent);
}

.faq-item summary {
  cursor: pointer;
  list-style: none;
  padding: 1rem 1.1rem;
  font-weight: 700;
}

.faq-item summary::-webkit-details-marker {
  display: none;
}

.faq-answer {
  padding: 0 1.1rem 1.1rem;
}

.legal-main {
  gap: 1rem;
}

.legal-stack {
  display: grid;
  gap: 1rem;
}

.legal-card,
.translation-card {
  padding: clamp(1rem, 2vw, 1.5rem);
  border-radius: var(--site-radius-xl);
  background: color-mix(in srgb, white 88%, transparent);
}

.translation-card[open] {
  background: color-mix(in srgb, white 92%, transparent);
}

.translation-card summary {
  cursor: pointer;
  font-weight: 700;
}

.translation-card > .legal-prose {
  margin-top: 1rem;
}

.legal-card-header {
  margin-bottom: 1rem;
}

.legal-prose {
  display: grid;
  gap: 0.85rem;
}

.legal-prose h2,
.legal-prose h3 {
  margin: 1rem 0 0;
  line-height: 1.3;
}

.legal-prose ul {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--site-muted);
  display: grid;
  gap: 0.45rem;
}

.site-footer {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1.1rem 1.2rem;
  border-radius: var(--site-radius-lg);
  background: var(--site-surface);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1rem;
}

@media (max-width: 980px) {
  .page-shell {
    width: min(calc(100% - 1rem), var(--site-max));
    padding-top: 0.5rem;
  }

  .site-header {
    align-items: flex-start;
  }

  .hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .site-header {
    flex-direction: column;
    align-items: stretch;
  }

  .site-nav {
    justify-content: flex-start;
  }

  .button-small {
    width: 100%;
  }

  .brand {
    align-items: flex-start;
  }

  .brand-copy span:last-child {
    line-height: 1.45;
  }

  .hero h1 {
    max-width: 100%;
  }

  .timeline-item {
    grid-template-columns: 1fr;
  }

  .timeline-item .icon-badge {
    width: 3rem;
    height: 3rem;
  }
}

@media (max-width: 560px) {
  .page-shell {
    width: min(calc(100% - 0.5rem), var(--site-max));
  }

  .site-header,
  .content-section,
  .hero,
  .site-footer,
  .legal-card,
  .translation-card {
    border-radius: 16px;
  }

  .site-nav a {
    padding-inline: 0.8rem;
  }

  .cta-row {
    flex-direction: column;
  }

  .cta-row .button {
    width: 100%;
  }
}
`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeRoute(route, html) {
  const normalized = normalizeRoute(route);
  const outDir = normalized === '/' ? publicRoot : path.join(publicRoot, normalized.slice(1));
  await ensureDir(outDir);
  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8');
}

async function writeStaticFiles() {
  await ensureDir(path.join(publicRoot, 'site-assets'));
  await fs.writeFile(path.join(publicRoot, 'site-assets', 'public-pages.css'), renderCss(), 'utf8');

  for (const page of marketingPages) {
    await writeRoute(page.route, renderMarketingPage(page));
  }

  for (const page of legalPages) {
    await writeRoute(page.route, await renderLegalPage(page));
  }

  const sitemapEntries = allRoutes
    .map((route) => {
      const loc = canonicalUrl(route);
      return `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n  </url>`;
    })
    .join('\n');

  await fs.writeFile(
    path.join(publicRoot, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`,
    'utf8',
  );

  await fs.writeFile(
    path.join(publicRoot, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`,
    'utf8',
  );
}

await writeStaticFiles();
