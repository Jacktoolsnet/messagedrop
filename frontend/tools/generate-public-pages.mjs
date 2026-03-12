import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(frontendRoot, 'public');
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
    eyebrowIcon: 'question_mark',
    eyebrow: 'What is MessageDrop?',
    heroTitle: 'Messages in real-world places.',
    heroText:
      'MessageDrop is an app with a global map where people can leave messages exactly where they matter.',
    heroTitleClass: 'hero-title-compact',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'What makes MessageDrop different',
    heroAsideItems: [
      'No algorithm decides what you see',
      'Follow places, not people',
      'Connect with people you know',
      'No ads',
      'No tracking',
      'Relevance comes from place, not reach',
    ],
    sections: [
      {
        title: 'Core ideas',
        icon: 'lightbulb',
        tiles: [
          {
            icon: 'pin_drop',
            title: 'Messages stay tied to places',
            body:
              'A message belongs to a real-world location. Relevance comes from where it is placed, not from who can amplify it.',
          },
          {
            icon: 'filter_alt_off',
            title: 'No algorithm decides what you see',
            body:
              'MessageDrop does not rank posts through an engagement feed. People explore places directly and see what belongs there.',
          },
          {
            icon: 'map',
            title: 'Follow places, not people',
            body:
              'The focus is on locations and local context. You return to places that matter instead of building everything around personal follower graphs.',
          },
          {
            icon: 'contacts',
            title: 'Contacts',
            body:
              'MessageDrop is built for connecting with people you actually know. Private communication is encrypted so direct conversations stay personal and protected.',
          },
        ],
      },
      {
        title: 'Expression & personality',
        icon: 'palette',
        tiles: [
          {
            icon: 'gif_box',
            title: 'Links, videos, and GIFs',
            body:
              'You can link YouTube, Pinterest, and TikTok posts and use Tenor GIFs to make messages more expressive and easier to understand at a glance.',
          },
          {
            icon: 'mood',
            title: 'Local names & avatars',
            body:
              'You can give other people names and avatars that are only visible to you. These profiles are stored locally on your device and make MessageDrop feel more personal.',
          },
        ],
      },
      {
        title: 'Location-based services',
        icon: 'near_me',
        tiles: [
          {
            icon: 'partly_cloudy_day',
            title: 'Weather at a place',
            body:
              'MessageDrop can show weather information directly for a place, so people get useful local context without leaving the map.',
          },
          {
            icon: 'air',
            title: 'Air quality on site',
            body:
              'Air quality can also be displayed for a location, making local conditions visible at a glance when they matter.',
          },
          {
            icon: 'local_activity',
            title: 'Experiences nearby',
            body:
              'Places can also surface experiences and activities nearby, turning the map into a richer starting point for exploration.',
          },
        ],
      },
      {
        title: 'Who MessageDrop is for',
        icon: 'groups',
        cards: [
          {
            icon: 'groups',
            title: 'Less feed, more place',
            body: 'For people who are tired of algorithmic feeds and traditional social networks and would rather explore places than profiles.',
          },
          {
            icon: 'lock',
            title: 'Private communication with real contacts',
            body: 'For people who prefer encrypted private communication and mainly want to connect with people they actually know.',
          },
          {
            icon: 'travel_explore',
            title: 'More context around places',
            body: 'For people who want to know more about places — from messages and impressions to weather, air quality, and nearby experiences.',
          },
        ],
      },
      {
        title: 'What comes next',
        icon: 'route',
        intro: 'MessageDrop is still at an early stage. We have many ideas and want to keep improving it step by step.',
        tiles: [
          {
            icon: 'explore',
            title: 'More ideas around places',
            body:
              'We want to keep expanding how much useful context can live around a place, so the map becomes more helpful over time.',
          },
          {
            icon: 'travel',
            title: 'More ways to explore',
            body:
              'Exploring the real world should feel fun and natural. We want to keep building features that help people discover places in better ways.',
          },
          {
            icon: 'autorenew',
            title: 'Continuous development',
            body:
              'MessageDrop is meant to evolve continuously. New ideas, new use cases, and real feedback should shape where it goes next.',
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
    eyebrowIcon: 'alt_route',
    eyebrow: 'How it works',
    heroTitle: 'Open the app. Pick a place. Leave a message.',
    heroText:
      'MessageDrop starts with a place. You open the map, see what is happening at a location, and leave a message of your own if you want to add something.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'It’s that simple',
    heroAsideText:
      'Before you can use MessageDrop, you open the app, set your consent preferences, and can then immediately explore places, messages, and experiences. If you want to create an account, you simply choose a PIN.',
    sections: [
      {
        title: 'Video guides',
        icon: 'smart_display',
        intro: 'Short walkthroughs for the most important flows in MessageDrop.',
        videos: [
          {
            icon: 'rocket_launch',
            title: 'Open the app and get started',
            body:
              'See how MessageDrop starts, how the consent screen works, and how to get oriented after the first launch.',
            meta: 'Guide 1',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'account_circle',
            title: 'Create your account and fill your profile',
            body:
              'Learn how to create an account with a PIN and complete your user profile with name, avatar, and personal details.',
            meta: 'Guide 2',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'edit_square',
            title: 'Create messages and manage local profiles',
            body:
              'Watch how to create your own messages and give other users local names and avatars that are only visible to you.',
            meta: 'Guide 3',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'place',
            title: 'Create places and maintain place profiles',
            body:
              'See how to create places, keep place profiles up to date, and use tiles to surface useful information at a location.',
            meta: 'Guide 4',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'forum',
            title: 'Connect with users and use the chatroom',
            body:
              'Learn how to connect with other users and use the chatroom for direct conversations around the people you know.',
            meta: 'Guide 5',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'travel_explore',
            title: 'Explore experiences',
            body:
              'See how to search for experiences, discover activities around a place, and use MessageDrop as a starting point for exploring the real world.',
            meta: 'Guide 6',
            ctaLabel: 'Video coming soon',
          },
        ],
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
    eyebrowIcon: 'gavel',
    eyebrow: 'Legal',
    heroTitle: 'All legal information in one place.',
    heroText:
      'Here you can find the privacy policy, terms of service, legal notice, and disclaimer in one place.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'Open a legal document',
    heroAsideDocLanguage: {
      label: 'Document language',
      note: 'The German version is authoritative.',
      default: 'en',
      options: [
        { key: 'en', label: 'English' },
        { key: 'de', label: 'Deutsch' },
      ],
    },
    heroAsideActions: [
      {
        key: 'terms',
        label: 'Terms of Service',
        icon: 'rule',
        src: { en: '/assets/legal/terms-of-service-en.txt', de: '/assets/legal/terms-of-service-de.txt' },
      },
      {
        key: 'disclaimer',
        label: 'Disclaimer',
        icon: 'warning',
        src: { en: '/assets/legal/disclaimer-en.txt', de: '/assets/legal/disclaimer-de.txt' },
      },
      {
        key: 'privacy',
        label: 'Privacy Policy',
        icon: 'privacy_tip',
        src: { en: '/assets/legal/privacy-policy-en.txt', de: '/assets/legal/privacy-policy-de.txt' },
      },
      {
        key: 'impressum',
        label: 'Legal Notice',
        icon: 'business',
        src: { en: '/assets/legal/legal-notice-en.txt', de: '/assets/legal/legal-notice-de.txt' },
      },
    ],
    legalHubDefaultDoc: 'terms',
    legalHubDefaultLang: 'en',
  },
];

const legalPages = [
  {
    route: '/privacy/',
    slug: 'privacy',
    lang: 'en',
    title: 'Privacy Policy',
    description: 'Dynamic privacy policy page for MessageDrop that loads the current German and English legal text files on demand.',
    heroIcon: 'privacy_tip',
    eyebrow: 'Privacy',
    heroTitle: 'Privacy policy outside the app',
    heroText:
      'This page loads the current privacy policy directly from the legal text source files. The German version is authoritative; the English translation is provided for convenience.',
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
    lang: 'en',
    title: 'Terms of Service',
    description: 'Dynamic terms of service page for MessageDrop that loads the current German and English legal text files on demand.',
    heroIcon: 'rule',
    eyebrow: 'Terms',
    heroTitle: 'Terms of Service outside the app',
    heroText:
      'This page loads the current terms directly from the legal text source files so the page stays in sync with the source documents used by the app.',
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
    lang: 'en',
    title: 'Impressum / Legal Notice',
    description: 'Dynamic legal notice page for MessageDrop that loads the current German and English legal text files on demand.',
    heroIcon: 'business',
    eyebrow: 'Impressum',
    heroTitle: 'Legal notice outside the app',
    heroText:
      'The legal notice stays outside the app and loads directly from the legal text source files so provider details stay synchronized.',
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
    lang: 'en',
    title: 'Disclaimer',
    description: 'Dynamic disclaimer and liability notice page for MessageDrop that loads the current German and English legal text files on demand.',
    heroIcon: 'warning',
    eyebrow: 'Disclaimer',
    heroTitle: 'Liability notice outside the app',
    heroText:
      'This page loads the current disclaimer directly from the legal text source files. It explains technical limitations, minimum age requirements, local storage risks, and service boundaries.',
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

const germanMarketingPages = [
  {
    route: '/what-is-messagedrop/',
    slug: 'what-is-messagedrop',
    lang: 'de',
    title: 'Was ist MessageDrop?',
    description:
      'MessageDrop ist eine globale Karte, auf der Menschen Nachrichten an realen Orten hinterlassen können — digitales Graffiti für die Weltkarte.',
    heroIcon: 'globe_location_pin',
    eyebrowIcon: 'question_mark',
    eyebrow: 'Was ist MessageDrop?',
    heroTitle: 'Nachrichten an echten Orten.',
    heroText:
      'MessageDrop ist eine App mit globaler Karte, auf der Menschen Nachrichten genau dort hinterlassen können, wo sie relevant sind.',
    heroTitleClass: 'hero-title-compact',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'Was MessageDrop anders macht',
    heroAsideItems: [
      'Kein Algorithmus entscheidet, was du siehst',
      'Du folgst Orten statt Personen',
      'Verbinde dich mit Menschen, die du kennst',
      'Keine Werbung',
      'Kein Tracking',
      'Relevanz entsteht durch Ort, nicht durch Reichweite',
    ],
    sections: [
      {
        title: 'Kernideen',
        icon: 'lightbulb',
        tiles: [
          {
            icon: 'pin_drop',
            title: 'Nachrichten bleiben an Orte gebunden',
            body:
              'Eine Nachricht gehört zu einem realen Ort. Relevanz entsteht dadurch, wo sie platziert wird – nicht dadurch, wer sie weiterverbreitet.',
          },
          {
            icon: 'filter_alt_off',
            title: 'Kein Algorithmus entscheidet, was du siehst',
            body:
              'MessageDrop sortiert Inhalte nicht über einen Engagement-Feed. Menschen erkunden Orte direkt und sehen, was dorthin gehört.',
          },
          {
            icon: 'map',
            title: 'Du folgst Orten statt Personen',
            body:
              'Im Mittelpunkt stehen Orte und lokaler Kontext. Du kommst zu den Plätzen zurück, die dir wichtig sind, statt einem Follower-Graphen zu folgen.',
          },
          {
            icon: 'contacts',
            title: 'Kontakte',
            body:
              'Uns ist wichtig, dass du dich mit Menschen verbindest, die du wirklich kennst. Private Kommunikation ist verschlüsselt, damit direkte Gespräche persönlich und geschützt bleiben.',
          },
        ],
      },
      {
        title: 'Ausdruck & Persönlichkeit',
        icon: 'palette',
        tiles: [
          {
            icon: 'gif_box',
            title: 'Links, Videos und GIFs',
            body:
              'Du kannst YouTube-, Pinterest- und TikTok-Beiträge verlinken und Tenor-GIFs verwenden, um Nachrichten anschaulicher und ausdrucksstärker zu machen.',
          },
          {
            icon: 'mood',
            title: 'Lokale Namen & Avatare',
            body:
              'Du kannst anderen Menschen Namen und Avatare geben, die nur für dich gelten. Diese Profile werden lokal auf deinem Gerät gespeichert und machen MessageDrop persönlicher.',
          },
        ],
      },
      {
        title: 'Ortsbezogene Dienste',
        icon: 'near_me',
        tiles: [
          {
            icon: 'partly_cloudy_day',
            title: 'Wetter am Ort',
            body:
              'MessageDrop kann Wetterinformationen direkt für einen Ort anzeigen, damit Menschen nützlichen lokalen Kontext sehen, ohne die Karte zu verlassen.',
          },
          {
            icon: 'air',
            title: 'Luftqualität vor Ort',
            body:
              'Auch die Luftqualität kann für einen Ort eingeblendet werden, damit lokale Bedingungen genau dann sichtbar sind, wenn sie wichtig werden.',
          },
          {
            icon: 'local_activity',
            title: 'Erlebnisse in der Nähe',
            body:
              'Zu Orten können außerdem passende Erlebnisse und Aktivitäten in der Nähe angezeigt werden. So wird die Karte noch stärker zum Ausgangspunkt für Entdeckungen.',
          },
        ],
      },
      {
        title: 'Für wen MessageDrop gemacht ist',
        icon: 'groups',
        cards: [
          {
            icon: 'groups',
            title: 'Weniger Feed, mehr Ort',
            body: 'Für Menschen, die genug von algorithmischen Feeds und gewöhnlichen sozialen Netzwerken haben und lieber Orte statt Profile entdecken.',
          },
          {
            icon: 'lock',
            title: 'Private Kommunikation mit echten Kontakten',
            body: 'Für Menschen, die verschlüsselte private Kommunikation bevorzugen und sich vor allem mit Menschen austauschen wollen, die sie wirklich kennen.',
          },
          {
            icon: 'travel_explore',
            title: 'Mehr Kontext zu Orten',
            body: 'Für Menschen, die zu Plätzen mehr wissen wollen — von Nachrichten und Eindrücken bis zu Wetter, Luftqualität und Erlebnissen in der Nähe.',
          },
        ],
      },
      {
        title: 'Wie es weitergeht',
        icon: 'route',
        intro: 'MessageDrop steht noch am Anfang. Wir haben viele Ideen und wollen die App Schritt für Schritt weiterentwickeln.',
        tiles: [
          {
            icon: 'explore',
            title: 'Mehr Ideen rund um Orte',
            body:
              'Wir wollen weiter ausbauen, wie viel nützlicher Kontext rund um einen Ort sichtbar werden kann, damit die Karte mit der Zeit immer hilfreicher wird.',
          },
          {
            icon: 'travel',
            title: 'Mehr Wege zum Entdecken',
            body:
              'Die echte Welt zu erkunden soll sich leicht und spannend anfühlen. Deshalb wollen wir weitere Funktionen entwickeln, die Menschen beim Entdecken von Orten helfen.',
          },
          {
            icon: 'autorenew',
            title: 'Kontinuierliche Weiterentwicklung',
            body:
              'MessageDrop soll sich kontinuierlich weiterentwickeln. Neue Ideen, echte Anwendungsfälle und Feedback sollen mitbestimmen, wohin sich das Produkt als Nächstes bewegt.',
          },
        ],
      },
    ],
  },
  {
    route: '/how-it-works/',
    slug: 'how-it-works',
    lang: 'de',
    title: 'Wie MessageDrop funktioniert',
    description:
      'Sieh dir an, wie MessageDrop Orte zu Einstiegspunkten für öffentliche Nachrichten, lokalen Kontext, private Notizen und private Chats macht.',
    heroIcon: 'alt_route',
    eyebrowIcon: 'alt_route',
    eyebrow: 'So funktioniert es',
    heroTitle: 'App öffnen. Ort wählen. Nachricht hinterlassen.',
    heroText:
      'MessageDrop beginnt mit einem Ort. Du öffnest die Karte, schaust, was an einem Platz passiert, und hinterlässt selbst eine Nachricht, wenn du etwas beitragen willst.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'So einfach ist es',
    heroAsideText:
      'Bevor du MessageDrop nutzen kannst, öffnest du die App, legst deine Consent-Einstellungen fest und kannst danach direkt Orte, Nachrichten und Erlebnisse entdecken. Wenn du ein Nutzerkonto anlegen möchtest, vergibst du einfach einen PIN.',
    sections: [
      {
        title: 'Video-Guides',
        icon: 'smart_display',
        intro: 'Kurze Walkthroughs für die wichtigsten Abläufe in MessageDrop.',
        videos: [
          {
            icon: 'rocket_launch',
            title: 'App öffnen und erste Schritte',
            body:
              'So startest du MessageDrop, gehst durch den Consent-Screen und findest dich nach dem ersten Öffnen schnell zurecht.',
            meta: 'Guide 1',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'account_circle',
            title: 'Nutzerkonto anlegen und Profil ausfüllen',
            body:
              'Erfahre, wie du mit einem PIN ein Nutzerkonto anlegst und dein Profil mit Namen, Avatar und weiteren Angaben vervollständigst.',
            meta: 'Guide 2',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'edit_square',
            title: 'Nachrichten erstellen und lokale Profile pflegen',
            body:
              'Sieh, wie du eigene Nachrichten erstellst und anderen Nutzern lokal Namen und Avatare gibst, die nur für dich sichtbar sind.',
            meta: 'Guide 3',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'place',
            title: 'Orte anlegen und Ortsprofile pflegen',
            body:
              'So legst du neue Orte an, pflegst Ortsprofile und nutzt Tiles, um Informationen an einem Ort sichtbar zu machen.',
            meta: 'Guide 4',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'forum',
            title: 'Kontakte aufnehmen und Chatroom nutzen',
            body:
              'Lerne, wie du Kontakt mit anderen Nutzern aufnimmst und den Chatroom für direkte Gespräche rund um Menschen nutzt, die du kennst.',
            meta: 'Guide 5',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'travel_explore',
            title: 'Erlebnisse suchen',
            body:
              'Sieh, wie du nach Erlebnissen suchst, Aktivitäten rund um einen Ort entdeckst und MessageDrop als Ausgangspunkt für die echte Welt nutzt.',
            meta: 'Guide 6',
            ctaLabel: 'Video folgt',
          },
        ],
      },
    ],
  },
  {
    route: '/legal/',
    slug: 'legal',
    lang: 'de',
    title: 'Rechtliche Informationen',
    description:
      'Zentrale Rechtsübersicht für MessageDrop mit Datenschutzerklärung, Nutzungsbedingungen, Impressum und Haftungshinweis.',
    heroIcon: 'gavel',
    eyebrowIcon: 'gavel',
    eyebrow: 'Rechtliches',
    heroTitle: 'Alle rechtlichen Informationen an einem Ort.',
    heroText:
      'Hier findest du Datenschutzerklärung, Nutzungsbedingungen, Impressum und Haftungshinweis gebündelt an einem Ort.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'Dokument direkt öffnen',
    heroAsideDocLanguage: {
      label: 'Dokumentsprache',
      note: 'Die deutsche Fassung ist maßgeblich.',
      default: 'de',
      options: [
        { key: 'de', label: 'Deutsch' },
        { key: 'en', label: 'English' },
      ],
    },
    heroAsideActions: [
      {
        key: 'terms',
        label: 'Nutzungsbedingungen',
        icon: 'rule',
        src: { de: '/assets/legal/terms-of-service-de.txt', en: '/assets/legal/terms-of-service-en.txt' },
      },
      {
        key: 'disclaimer',
        label: 'Haftungshinweis',
        icon: 'warning',
        src: { de: '/assets/legal/disclaimer-de.txt', en: '/assets/legal/disclaimer-en.txt' },
      },
      {
        key: 'privacy',
        label: 'Datenschutzerklärung',
        icon: 'privacy_tip',
        src: { de: '/assets/legal/privacy-policy-de.txt', en: '/assets/legal/privacy-policy-en.txt' },
      },
      {
        key: 'impressum',
        label: 'Impressum',
        icon: 'business',
        src: { de: '/assets/legal/legal-notice-de.txt', en: '/assets/legal/legal-notice-en.txt' },
      },
    ],
    legalHubDefaultDoc: 'terms',
    legalHubDefaultLang: 'de',
  },
];

const germanLegalPages = [
  {
    route: '/privacy/',
    slug: 'privacy',
    lang: 'de',
    title: 'Datenschutzerklärung',
    description: 'Dynamische Datenschutzerklärungs-Seite für MessageDrop, die die aktuellen deutschen und englischen Rechtstexte bei Bedarf lädt.',
    heroIcon: 'privacy_tip',
    eyebrow: 'Datenschutz',
    heroTitle: 'Datenschutzerklärung außerhalb der App',
    heroText:
      'Diese Seite lädt die aktuelle Datenschutzerklärung direkt aus den juristischen Quelldateien. Maßgeblich ist die deutsche Fassung; die englische Version dient der Orientierung.',
    downloads: [
      { href: '/assets/legal/privacy-policy-de.txt', label: 'Deutsche Textfassung' },
      { href: '/assets/legal/privacy-policy-en.txt', label: 'Englische Textfassung' },
    ],
    summaryTiles: [
      { icon: 'devices', title: 'Local-first-Speicherung', body: 'Ein großer Teil der Daten soll primär auf dem Endgerät des Nutzers verbleiben.' },
      { icon: 'visibility_off', title: 'Kein personalisiertes Ranking', body: 'Öffentliche Inhalte werden nicht über einen personalisierten Empfehlungs-Feed beschrieben.' },
      { icon: 'encrypted', title: 'Geschützte private Kommunikation', body: 'Private Chats werden als verschlüsselt und technisch geschützt beschrieben.' },
      { icon: 'toggle_off', title: 'Drittanbieter nur nach Aktivierung', body: 'Externe Anbieter sollen deaktiviert bleiben, bis Nutzer sie ausdrücklich freischalten.' },
    ],
  },
  {
    route: '/terms-of-service/',
    slug: 'terms-of-service',
    lang: 'de',
    title: 'Nutzungsbedingungen',
    description: 'Dynamische Seite mit den Nutzungsbedingungen für MessageDrop, die die aktuellen deutschen und englischen Rechtstexte bei Bedarf lädt.',
    heroIcon: 'rule',
    eyebrow: 'Nutzungsbedingungen',
    heroTitle: 'Nutzungsbedingungen außerhalb der App',
    heroText:
      'Diese Seite lädt die aktuellen Nutzungsbedingungen direkt aus den juristischen Quelldateien, damit die öffentliche Seite mit den Quelldokumenten der App synchron bleibt.',
    downloads: [
      { href: '/assets/legal/terms-of-service-de.txt', label: 'Deutsche Textfassung' },
      { href: '/assets/legal/terms-of-service-en.txt', label: 'Englische Textfassung' },
    ],
    summaryTiles: [
      { icon: 'cake', title: '16+-Regel', body: 'Die Nutzung ist auf Personen beschränkt, die mindestens 16 Jahre alt sind.' },
      { icon: 'public_off', title: 'Inhaltsregeln', body: 'Missbrauch, rechtswidrige Inhalte und die Veröffentlichung persönlicher Daten sind untersagt.' },
      { icon: 'balance', title: 'DSA-Verfahren', body: 'Die Bedingungen beschreiben Moderation, Meldungen und Beschwerdeverfahren nach dem DSA.' },
      { icon: 'save', title: 'Backups sind wichtig', body: 'Die Texte betonen, dass lokale Daten verloren gehen können und Wiederherstellung von Backups abhängt.' },
    ],
  },
  {
    route: '/impressum/',
    slug: 'impressum',
    lang: 'de',
    title: 'Impressum',
    description: 'Dynamische Impressums-Seite für MessageDrop, die die aktuellen deutschen und englischen Rechtstexte bei Bedarf lädt.',
    heroIcon: 'business',
    eyebrow: 'Impressum',
    heroTitle: 'Impressum außerhalb der App',
    heroText:
      'Das Impressum bleibt als normale Website erreichbar und lädt direkt aus den juristischen Quelldateien, damit Anbieterangaben synchron bleiben.',
    downloads: [
      { href: '/assets/legal/legal-notice-de.txt', label: 'Deutsche Textfassung' },
      { href: '/assets/legal/legal-notice-en.txt', label: 'Englische Textfassung' },
    ],
    summaryTiles: [
      { icon: 'apartment', title: 'Anbieterangaben', body: 'Firmenname, Anschrift, Registerdaten und Umsatzsteuer-Identifikationsnummer.' },
      { icon: 'person', title: 'Verantwortliche Person', body: 'Angaben zum Geschäftsführer und zur inhaltlich verantwortlichen Person.' },
      { icon: 'support_agent', title: 'DSA-Kontaktstelle', body: 'Direkte Kontaktdaten für Kommunikation nach dem Digital Services Act.' },
      { icon: 'gavel', title: 'Hinweis zur Streitbeilegung', body: 'Erklärung zur Teilnahme an Verbraucherstreitbeilegungsverfahren.' },
    ],
  },
  {
    route: '/disclaimer/',
    slug: 'disclaimer',
    lang: 'de',
    title: 'Haftungshinweis',
    description: 'Dynamische Seite mit Haftungshinweis und Disclaimer für MessageDrop, die die aktuellen deutschen und englischen Rechtstexte bei Bedarf lädt.',
    heroIcon: 'warning',
    eyebrow: 'Haftungshinweis',
    heroTitle: 'Haftungshinweis außerhalb der App',
    heroText:
      'Diese Seite lädt den aktuellen Haftungshinweis direkt aus den juristischen Quelldateien. Er beschreibt technische Grenzen, Mindestalter, Risiken lokaler Speicherung und Leistungsgrenzen.',
    downloads: [
      { href: '/assets/legal/disclaimer-de.txt', label: 'Deutsche Textfassung' },
      { href: '/assets/legal/disclaimer-en.txt', label: 'Englische Textfassung' },
    ],
    summaryTiles: [
      { icon: 'error_med', title: 'Kein Notfalldienst', body: 'MessageDrop bietet ausdrücklich keinen Zugang zu Notfalldiensten.' },
      { icon: 'storage', title: 'Lokale Daten können verloren gehen', body: 'Der Hinweis betont das Risiko des Verlusts lokal gespeicherter Daten auf dem Gerät.' },
      { icon: 'shield', title: 'Datenschutzorientiertes Design', body: 'Das Produkt wird als datenschutzorientiert und datenminimierend beschrieben.' },
      { icon: 'map', title: 'Ortsbezogene öffentliche Inhalte', body: 'Öffentliche Inhalte sind an Orte gebunden und können gemeldet, geprüft oder moderiert werden.' },
    ],
  },
];

const supportedLocales = ['de', 'en'];

const appTaglineByLocale = {
  de: 'Digitales Graffiti für die Weltkarte.',
  en: appTagline,
};

const appClaimByLocale = {
  de: 'Eine globale Karte, auf der Menschen Nachrichten an realen Orten hinterlassen können.',
  en: appClaim,
};

const uiByLocale = {
  de: {
    navWhat: 'Was ist MessageDrop?',
    navHow: 'So funktioniert MessageDrop',
    navLegal: 'Rechtliches',
    openApp: 'App öffnen',
    brandHome: 'MessageDrop-App öffnen',
    primaryNav: 'Hauptnavigation',
    legalPages: 'Rechtsseiten',
    footerWhat: 'Was ist MessageDrop?',
    footerHow: 'So funktioniert MessageDrop',
    footerLegal: 'Rechtliches',
    footerCreditBeforeHeart: 'Mit',
    footerCreditAfterHeart: 'entwickelt von',
    redirectTitle: 'Sprache wird gewählt',
    redirectText: 'Mit JavaScript wird automatisch die passende Sprachversion geöffnet. Ohne JavaScript kannst du die gewünschte Version hier direkt auswählen.',
    openGerman: 'Deutsch öffnen',
    openEnglish: 'Englisch öffnen',
    openAppLegal: 'App öffnen',
  },
  en: {
    navWhat: 'What is MessageDrop?',
    navHow: 'How MessageDrop works',
    navLegal: 'Legal',
    openApp: 'Open app',
    brandHome: 'Open MessageDrop app',
    primaryNav: 'Primary navigation',
    legalPages: 'Legal pages',
    footerWhat: 'What is MessageDrop?',
    footerHow: 'How MessageDrop works',
    footerLegal: 'Legal',
    footerCreditBeforeHeart: 'Built with',
    footerCreditAfterHeart: 'by',
    redirectTitle: 'Choosing language',
    redirectText: 'With JavaScript enabled, the matching language version opens automatically. Without JavaScript, you can choose the version directly below.',
    openGerman: 'Open German',
    openEnglish: 'Open English',
    openAppLegal: 'Open app',
  },
};

const germanMarketingByRoute = new Map(germanMarketingPages.map((page) => [page.route, page]));
const germanLegalByRoute = new Map(germanLegalPages.map((page) => [page.route, page]));

const localizedMarketingPages = supportedLocales.flatMap((locale) => {
  const sourcePages = locale === 'de' ? germanMarketingPages : marketingPages;
  return sourcePages.map((page) => ({
    ...page,
    locale,
    baseRoute: page.route,
    route: localeRoute(locale, page.route),
  }));
});

const localizedLegalPages = [];

const redirectPages = [...marketingPages].map((page) => ({
  route: page.route,
  englishTitle: page.title,
  germanTitle: germanMarketingByRoute.get(page.route)?.title ?? germanLegalByRoute.get(page.route)?.title ?? page.title,
}));

const legalRouteSet = new Set(localizedLegalPages.map((page) => trimTrailingSlash(page.baseRoute)));
const allRoutes = ['/', ...localizedMarketingPages.map((page) => page.route), ...localizedLegalPages.map((page) => page.route)];

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

function localeRoute(locale, route) {
  const normalized = normalizeRoute(route);
  return `/${locale}${normalized}`;
}

function stripLocalePrefix(route) {
  const normalized = normalizeRoute(route);
  const match = normalized.match(/^\/(de|en)(\/.*)$/);
  if (!match) {
    return normalized;
  }

  return match[2];
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

function organizationSchema(lang = 'en') {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appName,
    description: appClaimByLocale[lang] ?? appClaim,
    url: `${baseUrl}/`,
    inLanguage: lang,
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

function alternateLinks(baseRoute) {
  return [
    { hreflang: 'de', href: canonicalUrl(localeRoute('de', baseRoute)) },
    { hreflang: 'en', href: canonicalUrl(localeRoute('en', baseRoute)) },
    { hreflang: 'x-default', href: canonicalUrl(baseRoute) },
  ];
}

function renderNav(currentRoute, lang = 'en') {
  const ui = uiByLocale[lang] ?? uiByLocale.en;
  const navItems = [
    { href: '/what-is-messagedrop/', label: ui.navWhat },
    { href: '/how-it-works/', label: ui.navHow },
    { href: '/legal/', label: ui.navLegal },
  ];

  return navItems
    .map((item) => {
      const current = trimTrailingSlash(stripLocalePrefix(currentRoute));
      const itemPath = trimTrailingSlash(item.href);
      const hasExactNavItem = navItems.some((other) => trimTrailingSlash(other.href) === current);
      const isLegalItem = itemPath === '/legal' && legalRouteSet.has(current) && !hasExactNavItem;
      const isActive = current === itemPath || isLegalItem;
      return `<a href="${item.href}"${isActive ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
    })
    .join('');
}

function renderHeader(currentRoute, lang = 'en') {
  const ui = uiByLocale[lang] ?? uiByLocale.en;
  const openLabel = lang === 'de' ? 'Navigation öffnen' : 'Open navigation';
  const closeLabel = lang === 'de' ? 'Navigation schließen' : 'Close navigation';
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="${escapeHtml(ui.brandHome)}">
        <span class="brand-avatar">
          <img src="/icons/icon-192x192.png" alt="MessageDrop logo" width="64" height="64">
        </span>
        <span class="brand-copy">
          <strong>${appName}</strong>
          <span>${appTaglineByLocale[lang] ?? appTagline}</span>
        </span>
      </a>
      <button class="site-menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"
        aria-label="${escapeHtml(openLabel)}" data-open-label="${escapeHtml(openLabel)}"
        data-close-label="${escapeHtml(closeLabel)}">
        <span class="material-symbols-outlined" data-menu-icon aria-hidden="true">menu</span>
      </button>
      <nav class="site-nav" id="site-nav" aria-label="${escapeHtml(ui.primaryNav)}">
        ${renderNav(currentRoute, lang)}
      </nav>
      <a class="button button-primary button-small site-header-cta" href="/">${escapeHtml(ui.openApp)}</a>
    </header>
  `;
}

function renderFooter(lang = 'en') {
  const ui = uiByLocale[lang] ?? uiByLocale.en;
  const links = [
    { href: '/what-is-messagedrop/', label: ui.footerWhat },
    { href: '/how-it-works/', label: ui.footerHow },
    { href: '/legal/', label: ui.footerLegal },
  ];

  return `
    <footer class="site-footer">
      <div class="footer-links">
        ${links.map((link) => `<a href="${link.href}">${escapeHtml(link.label)}</a>`).join('')}
      </div>
      <p class="footer-credit">
        ${escapeHtml(ui.footerCreditBeforeHeart)}
        <span class="footer-heart" aria-hidden="true">❤</span>
        ${escapeHtml(ui.footerCreditAfterHeart)}
        <strong>JackTools.Net</strong>
      </p>
    </footer>
  `;
}

function renderHero(page) {
  const ui = uiByLocale[page.lang] ?? uiByLocale.en;
  const hasAside = Boolean(page.heroAsideTitle)
    || Boolean(page.heroAsideText)
    || (page.heroAsideDocLanguage?.options?.length ?? 0) > 0
    || (page.heroAsideItems?.length ?? 0) > 0
    || (page.heroAsideGroups?.length ?? 0) > 0
    || (page.heroAsideActions?.length ?? 0) > 0;
  const showLegalCta = page.showLegalCta !== false;
  const showPrimaryCta = page.showPrimaryCta !== false;
  const titleClass = page.heroTitleClass ? ` ${page.heroTitleClass}` : '';
  const asideParts = [];
  if (page.heroAsideText) {
    asideParts.push(`<p class="hero-panel-text">${escapeHtml(page.heroAsideText)}</p>`);
  }
  if (page.heroAsideDocLanguage?.options?.length) {
    const switcher = page.heroAsideDocLanguage;
    asideParts.push(`<div class="hero-panel-language" data-legal-doc-language>
      <div class="hero-panel-language-copy">
        <span class="hero-panel-language-label">${escapeHtml(switcher.label)}</span>
        ${switcher.note ? `<p class="hero-panel-language-note">${escapeHtml(switcher.note)}</p>` : ''}
      </div>
      <div class="hero-panel-language-options" role="group" aria-label="${escapeHtml(switcher.label)}">
        ${switcher.options
          .map(
            (option) => `
              <button
                class="hero-panel-language-option"
                type="button"
                data-legal-doc-lang-trigger
                data-doc-lang="${escapeHtml(option.key)}"
                aria-pressed="${option.key === switcher.default ? 'true' : 'false'}"
              >${escapeHtml(option.label)}</button>
            `,
          )
          .join('')}
      </div>
    </div>`);
  }
  if (page.heroAsideGroups?.length) {
    asideParts.push(`<div class="hero-panel-groups">
      ${page.heroAsideGroups
        .map(
          (group) => `
            <section class="hero-panel-group">
              <h3>${escapeHtml(group.title)}</h3>
              <ul class="check-list">
                ${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </section>
          `,
        )
        .join('')}
    </div>`);
  } else if (page.heroAsideItems?.length) {
    asideParts.push(`<ul class="check-list">
      ${page.heroAsideItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>`);
  }
  if (page.heroAsideActions?.length) {
    asideParts.push(`<div class="hero-panel-actions" data-legal-hub-actions>
      ${page.heroAsideActions
        .map(
          (action) => `
            <button class="hero-panel-action" type="button" data-legal-hub-trigger
              data-doc-key="${escapeHtml(action.key)}"
              data-src-de="${escapeHtml(action.src.de ?? action.src)}"
              data-src-en="${escapeHtml(action.src.en ?? action.src)}">
              <span class="icon-badge hero-panel-action-icon" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(action.icon)}</span></span>
              <span>${escapeHtml(action.label)}</span>
            </button>
          `,
        )
        .join('')}
    </div>`);
  }
  const asideContent = asideParts.join('');
  return `
    <section class="hero${hasAside ? '' : ' hero--single'}">
      <div class="hero-copy">
        <span class="eyebrow">${page.eyebrowIcon ? `<span class="material-symbols-outlined eyebrow-icon" aria-hidden="true">${escapeHtml(page.eyebrowIcon)}</span>` : ''}${escapeHtml(page.eyebrow)}</span>
        <h1 class="${titleClass.trim()}">${escapeHtml(page.heroTitle)}</h1>
        <p class="hero-text">${escapeHtml(page.heroText)}</p>
        ${(showPrimaryCta || showLegalCta)
          ? `<div class="cta-row">
              ${showPrimaryCta ? `<a class="button button-primary" href="/">${escapeHtml(ui.openApp)}</a>` : ''}
              ${showLegalCta ? `<a class="button button-secondary" href="/legal/">${escapeHtml(ui.legalPages)}</a>` : ''}
            </div>`
          : ''}
      </div>
      ${hasAside ? `<aside class="hero-panel" aria-label="${page.lang === 'de' ? 'Kurzübersicht' : 'Quick summary'}">
        <div class="hero-panel-header">
          <div class="icon-badge info-avatar" aria-hidden="true">
            <span class="material-symbols-outlined">${escapeHtml(page.heroIcon)}</span>
          </div>
          <h2>${escapeHtml(page.heroAsideTitle ?? (page.lang === 'de' ? 'Kurzübersicht' : 'Quick summary'))}</h2>
        </div>
        ${asideContent}
      </aside>` : ''}
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

function renderVideoGrid(videos) {
  return `
    <div class="video-grid">
      ${videos
        .map(
          (video) => `
          <article class="video-card">
            <div class="video-thumb" aria-hidden="true">
              <span class="material-symbols-outlined">${escapeHtml(video.icon)}</span>
            </div>
            <div class="video-card-body">
              <div class="video-card-meta">${escapeHtml(video.meta)}</div>
              <h3>${escapeHtml(video.title)}</h3>
              <p>${escapeHtml(video.body)}</p>
            </div>
            <div class="video-card-footer">
              <span class="video-cta">${escapeHtml(video.ctaLabel)}</span>
            </div>
          </article>
        `,
        )
        .join('')}
    </div>
  `;
}

function renderLegalHubSection(page) {
  const title = page.legalHubTitle?.trim() ?? '';
  const intro = page.legalHubIntro?.trim() ?? '';
  const heading = title || intro
    ? `
      <div class="section-heading">
        ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
        ${intro ? `<p>${escapeHtml(intro)}</p>` : ''}
      </div>
    `
    : '';
  const defaultDoc = page.legalHubDefaultDoc ?? '';
  const defaultLang = page.legalHubDefaultLang ?? page.lang;

  return `
    <section class="content-section legal-hub-section">
      ${heading}
      <div
        class="legal-hub-viewer"
        data-legal-hub
        data-default-doc-key="${escapeHtml(defaultDoc)}"
        data-default-doc-lang="${escapeHtml(defaultLang)}"
      >
        <div class="legal-prose legal-hub-content" data-legal-hub-content aria-live="polite"></div>
      </div>
    </section>
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
  const headingContent = section.icon
    ? `
        <div class="section-heading-title">
          <span class="icon-badge" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(section.icon)}</span></span>
          <div class="section-heading-copy">
            <h2>${escapeHtml(section.title)}</h2>
            ${section.intro ? `<p>${escapeHtml(section.intro)}</p>` : ''}
          </div>
        </div>
      `
    : `
        <h2>${escapeHtml(section.title)}</h2>
        ${section.intro ? `<p>${escapeHtml(section.intro)}</p>` : ''}
      `;

  return `
    <section class="content-section">
      <div class="section-heading">
        ${headingContent}
      </div>
      ${section.tiles ? renderTileGrid(section.tiles) : ''}
      ${section.cards ? renderCardGrid(section.cards) : ''}
      ${section.videos ? renderVideoGrid(section.videos) : ''}
      ${section.featureList ? renderFeatureList(section.featureList) : ''}
      ${section.timeline ? renderTimeline(section.timeline) : ''}
    </section>
  `;
}

function renderLegalLoaderPanel({ title, description, lang, src, authoritative = false, pageLang = 'en' }) {
  const isGerman = pageLang === 'de';
  return `
    <details class="translation-card legal-document-card" data-legal-doc data-src="${escapeHtml(src)}">
      <summary>
        <span class="legal-document-summary">
          <span class="legal-document-title-row">
            <span class="legal-document-title">${escapeHtml(title)}</span>
            ${authoritative ? `<span class="legal-document-chip">${isGerman ? 'Verbindlich' : 'Authoritative'}</span>` : `<span class="legal-document-chip legal-document-chip--muted">${isGerman ? 'Übersetzung' : 'Translation'}</span>`}
          </span>
          <span class="legal-document-description">${escapeHtml(description)}</span>
        </span>
      </summary>
      <div class="legal-status" data-legal-status aria-live="polite">${isGerman ? 'Diesen Bereich öffnen, um das Dokument zu laden.' : 'Open this panel to load the document.'}</div>
      <div class="legal-prose" data-legal-content lang="${escapeHtml(lang)}" hidden></div>
    </details>
  `;
}

function renderMarketingPage(page) {
  const isGerman = page.lang === 'de';
  const body = [`<main class="site-main">`, renderHero(page)];

  if (page.sections) {
    body.push(...page.sections.map(renderSection));
  }

  if (page.faqs) {
    body.push(`
      <section class="content-section">
        <div class="section-heading">
          <h2>${isGerman ? 'Häufige Fragen' : 'Frequently asked questions'}</h2>
          <p>${isGerman ? 'Jede Antwort ist bewusst in Klartext formuliert, damit sie leicht indexiert und zitiert werden kann.' : 'Each answer is written in clear text so it can be indexed and cited easily.'}</p>
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

  if (page.legalHubTitle || page.legalHubIntro || page.heroAsideActions?.length) {
    body.push(renderLegalHubSection(page));
  }

  body.push('</main>');

  const extraSchemas = [organizationSchema(page.lang)];
  if (page.faqs) {
    extraSchemas.push(faqSchema(page));
  }

  return renderDocument({
    route: page.route,
    baseRoute: page.baseRoute,
    title: page.title,
    description: page.description,
    lang: page.lang,
    content: body.join('\n'),
    schemas: extraSchemas,
    scripts: page.heroAsideActions?.length ? ['/site-assets/legal-documents.js'] : [],
    alternateLinkTags: alternateLinks(page.baseRoute),
  });
}

function renderLegalPage(page) {
  const isGerman = page.lang === 'de';
  const quickLegalTitle = isGerman ? 'Rechtliche Kurzinfo' : 'Quick legal overview';
  const quickLegalItems = isGerman
    ? [
        'Dokumente werden aus denselben TXT-Quellen wie in der App geladen',
        'Die bevorzugte Sprache steht oben',
        'Die jeweils andere Fassung bleibt zusätzlich verfügbar',
        'Beide Bereiche starten eingeklappt',
      ]
    : [
        'Documents are loaded from the same TXT sources as the app',
        'The preferred language is shown first',
        'The other language version remains available below',
        'Both panels start collapsed',
      ];
  const primaryPanel = isGerman
    ? {
        title: 'Verbindliche deutsche Fassung',
        description: 'Rechtsverbindliche deutsche Fassung, dynamisch aus der juristischen Quelldatei geladen.',
        lang: 'de',
        src: page.downloads[0]?.href ?? '',
        authoritative: true,
      }
    : {
        title: 'English translation',
        description: 'Convenience translation loaded dynamically from the legal text source.',
        lang: 'en',
        src: page.downloads[1]?.href ?? '',
        authoritative: false,
      };
  const secondaryPanel = isGerman
    ? {
        title: 'Englische Übersetzung',
        description: 'Unverbindliche englische Übersetzung, dynamisch aus der juristischen Quelldatei geladen.',
        lang: 'en',
        src: page.downloads[1]?.href ?? '',
        authoritative: false,
      }
    : {
        title: 'Authoritative German version',
        description: 'Legally binding German version loaded dynamically from the legal text source.',
        lang: 'de',
        src: page.downloads[0]?.href ?? '',
        authoritative: true,
      };

  return renderDocument({
    route: page.route,
    baseRoute: page.baseRoute,
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
          <aside class="hero-panel" aria-label="${isGerman ? 'Rechtliche Hinweise' : 'Key legal notes'}">
            <div class="hero-panel-header">
              <div class="icon-badge info-avatar" aria-hidden="true">
                <span class="material-symbols-outlined">${escapeHtml(page.heroIcon)}</span>
              </div>
              <h2>${escapeHtml(quickLegalTitle)}</h2>
            </div>
            <ul class="check-list">
              ${quickLegalItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </aside>
        </section>

        <section class="content-section">
          <div class="section-heading">
            <h2>${isGerman ? 'Übersichtskacheln' : 'Summary tiles'}</h2>
            <p>${isGerman ? 'Diese kurzen Kacheln geben einen schnellen Überblick über den rechtlichen Rahmen, bevor das vollständige Dokument geöffnet wird.' : 'These short tiles help visitors understand the legal scope quickly before reading the full document.'}</p>
          </div>
          ${renderTileGrid(page.summaryTiles)}
        </section>

        <section class="content-section legal-section">
          <div class="section-heading">
            <h2>${isGerman ? 'Dokumentfassung öffnen' : 'Open a document version'}</h2>
            <p>${isGerman ? 'Beide Fassungen starten eingeklappt. Beim Öffnen wird der gewünschte Text direkt aus den juristischen TXT-Quelldateien geladen.' : 'Both versions stay collapsed at first. Open the version you want to read and the page will load it on demand from the legal TXT source files.'}</p>
          </div>
          <div class="legal-stack">
            ${renderLegalLoaderPanel({ ...primaryPanel, pageLang: page.lang })}
            ${renderLegalLoaderPanel({ ...secondaryPanel, pageLang: page.lang })}
          </div>
        </section>
      </main>
    `,
    schemas: [organizationSchema(page.lang)],
    scripts: ['/site-assets/legal-documents.js'],
    alternateLinkTags: alternateLinks(page.baseRoute),
  });
}

function renderDocument({
  route,
  baseRoute,
  title,
  description,
  lang,
  content,
  schemas,
  scripts = [],
  alternateLinkTags = [],
  robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
}) {
  const absoluteUrl = canonicalUrl(route);
  const metaTitle = `${appName} | ${title}`;
  const allScripts = ['/site-assets/public-pages.js', ...scripts];
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
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
  ${alternateLinkTags.map((link) => `<link rel="alternate" hreflang="${link.hreflang}" href="${link.href}">`).join('\n  ')}
  ${schemas.map(jsonLd).join('\n  ')}
</head>
<body>
  <div class="page-shell">
    ${renderHeader(route, lang)}
    ${content}
    ${renderFooter(lang)}
  </div>
  ${allScripts.map((src) => `<script src="${src}" defer></script>`).join('\n  ')}
</body>
</html>
`;
}

function renderPublicUiScript() {
  return `document.querySelectorAll('.site-menu-toggle').forEach((button) => {
  const header = button.closest('.site-header');
  const icon = button.querySelector('[data-menu-icon]');
  const closeText = button.dataset.closeLabel || 'Close navigation';
  const openText = button.dataset.openLabel || 'Open navigation';

  if (!header) {
    return;
  }

  const sync = () => {
    const expanded = header.classList.contains('menu-open');
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.setAttribute('aria-label', expanded ? closeText : openText);
    if (icon) {
      icon.textContent = expanded ? 'close' : 'menu';
    }
  };

  button.addEventListener('click', () => {
    header.classList.toggle('menu-open');
    sync();
  });

  header.querySelectorAll('.site-nav a, .site-header-cta').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        header.classList.remove('menu-open');
        sync();
      }
    });
  });

  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 760px)').matches) {
      header.classList.remove('menu-open');
      sync();
    }
  });

  sync();
});\n`;
}

function renderLanguageRedirectPage(page) {
  const deHref = localeRoute('de', page.route);
  const enHref = localeRoute('en', page.route);
  const uiDe = uiByLocale.de;
  const uiEn = uiByLocale.en;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(`${appName} | ${page.englishTitle}`)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex,follow">
  <meta name="theme-color" content="#05a51d">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="stylesheet" href="/site-assets/public-pages.css">
  ${alternateLinks(page.route).map((link) => `<link rel="alternate" hreflang="${link.hreflang}" href="${link.href}">`).join('\n  ')}
  <script>
    (function () {
      const language = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
      const target = language.startsWith('de') ? '${deHref}' : '${enHref}';
      window.location.replace(target + window.location.search + window.location.hash);
    })();
  </script>
</head>
<body>
  <div class="page-shell redirect-shell">
    <section class="content-section">
      <div class="section-heading">
        <h1>${escapeHtml(uiEn.redirectTitle)}</h1>
        <p>${escapeHtml(uiEn.redirectText)}</p>
        <p>${escapeHtml(uiDe.redirectText)}</p>
      </div>
      <div class="cta-row">
        <a class="button button-secondary" href="${deHref}">${escapeHtml(uiDe.openGerman)}</a>
        <a class="button button-secondary" href="${enHref}">${escapeHtml(uiEn.openEnglish)}</a>
      </div>
    </section>
  </div>
</body>
</html>
`;
}

function renderLegalLoaderScript() {
  return `const escapeHtml = (value) =>
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
  const lines = sourceText.replace(/\\r\\n/g, '\\n').split('\\n');
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

    if (/^[-*]\\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[-*]\\s+/, ''));
      headingConsumed = false;
      continue;
    }

    if (/^\\d+\\)/.test(trimmed)) {
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
  return blocks.join('\\n');
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
}\n`;
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

.redirect-shell {
  max-width: 760px;
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
  flex-wrap: wrap;
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

.site-header-cta {
  flex-shrink: 0;
}

.site-menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 0;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #38bdf8);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
  cursor: pointer;
}

.site-menu-toggle .material-symbols-outlined {
  font-size: 1.55rem;
  font-variation-settings: 'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 24;
}

.site-menu-toggle:hover,
.site-menu-toggle:focus-visible {
  filter: brightness(0.97);
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

.hero--single {
  grid-template-columns: 1fr;
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

.hero-panel-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.hero-panel-header h2 {
  margin: 0;
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
  gap: 0.45rem;
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

.eyebrow-icon {
  font-size: 1rem;
  line-height: 1;
}

.eyebrow-inline {
  margin-bottom: 0.75rem;
}

.hero-title-compact {
  font-size: clamp(1.75rem, 3vw, 2.7rem);
  line-height: 1.08;
  max-width: 15ch;
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

.hero-panel-groups {
  display: grid;
  gap: 1rem;
}

.hero-panel-group {
  display: grid;
  gap: 0.6rem;
}

.hero-panel-group h3 {
  margin: 0;
  font-size: 0.95rem;
}

.hero-panel-text {
  margin: 0;
  color: var(--site-muted);
  line-height: 1.65;
}

.hero-panel-language {
  display: grid;
  gap: 0.75rem;
}

.hero-panel-language-copy {
  display: grid;
  gap: 0.25rem;
}

.hero-panel-language-label {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--site-text);
}

.hero-panel-language-note {
  margin: 0;
  color: var(--site-muted);
  line-height: 1.55;
  font-size: 0.94rem;
}

.hero-panel-language-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.hero-panel-language-option {
  min-width: 7rem;
  padding: 0.58rem 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--site-outline);
  background: rgba(255, 255, 255, 0.72);
  color: var(--site-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.hero-panel-language-option:hover,
.hero-panel-language-option:focus-visible {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--site-primary) 8%, #fff);
  border-color: color-mix(in srgb, var(--site-primary) 28%, var(--site-outline));
}

.hero-panel-language-option[aria-pressed="true"] {
  background: color-mix(in srgb, var(--site-secondary) 10%, #fff);
  border-color: color-mix(in srgb, var(--site-secondary) 28%, var(--site-outline));
}

.hero-panel-actions {
  display: grid;
  gap: 0.75rem;
}

.hero-panel-action {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--site-outline);
  border-radius: var(--site-radius-md);
  background: rgba(255, 255, 255, 0.72);
  color: var(--site-text);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.hero-panel-action:hover,
.hero-panel-action:focus-visible {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--site-primary) 8%, #fff);
  border-color: color-mix(in srgb, var(--site-primary) 28%, var(--site-outline));
}

.hero-panel-action[aria-pressed="true"] {
  background: color-mix(in srgb, var(--site-secondary) 10%, #fff);
  border-color: color-mix(in srgb, var(--site-secondary) 28%, var(--site-outline));
}

.hero-panel-action-icon {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.legal-hub-viewer {
  display: grid;
  gap: 1rem;
}

.legal-hub-loading,
.legal-hub-error {
  margin: 0;
}

.legal-hub-loading,
.legal-hub-error {
  color: var(--site-muted);
  line-height: 1.65;
}

.legal-hub-error {
  color: #b91c1c;
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

.section-heading-title {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
}

.section-heading-title .icon-badge {
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
}

.section-heading-copy {
  display: grid;
  gap: 0.35rem;
}

.section-heading-copy p {
  margin: 0;
}

.tile-grid,
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 1rem;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 320px));
  justify-content: center;
  justify-items: center;
  gap: 1rem;
}

.tile,
.info-card,
.video-card {
  display: grid;
  gap: 0.9rem;
  align-content: start;
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

.video-card {
  grid-template-rows: auto 1fr auto;
  width: min(100%, 320px);
  min-height: 28rem;
  height: 100%;
}

.video-thumb {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 10rem;
  border-radius: var(--site-radius-md);
  background: linear-gradient(135deg, color-mix(in srgb, var(--site-secondary) 18%, #fff), color-mix(in srgb, var(--site-primary) 14%, #fff));
  border: 1px solid var(--site-outline);
}

.video-thumb .material-symbols-outlined {
  font-size: 3.2rem;
  color: #1d4ed8;
  font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 48;
}

.video-card-body {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 0.55rem;
}

.video-card-body h3 {
  margin: 0;
}

.video-card-body p {
  margin: 0;
  color: var(--site-muted);
  line-height: 1.65;
}

.video-card-meta {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 1.85rem;
  padding: 0 0.65rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--site-secondary) 10%, #fff);
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.video-card-footer {
  display: flex;
  justify-content: center;
  margin-top: auto;
}

.video-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 95%;
  min-height: 2.5rem;
  padding: 0.65rem 0.95rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--site-text);
  border: 1px solid var(--site-outline);
  font-weight: 700;
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

.legal-document-card {
  overflow: hidden;
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
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  cursor: pointer;
  font-weight: 700;
  list-style: none;
}

.translation-card summary::-webkit-details-marker {
  display: none;
}

.translation-card summary::before {
  content: "expand_more";
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
  font-family: "Material Symbols Outlined";
  font-size: 1.45rem;
  line-height: 1;
  font-variation-settings: 'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 24;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.translation-card[open] summary::before {
  transform: rotate(180deg);
}

.translation-card summary:hover::before,
.translation-card summary:focus-visible::before {
  filter: brightness(0.97);
}

.legal-document-summary {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.legal-document-title-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.legal-document-title {
  font-size: 1rem;
}

.legal-document-description {
  color: var(--site-muted);
  font-weight: 500;
  line-height: 1.5;
}

.legal-document-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0 0.65rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--site-primary) 14%, #fff);
  color: #0f5a1d;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.legal-document-chip--muted {
  background: color-mix(in srgb, var(--site-secondary) 10%, #fff);
  color: #1d4ed8;
}

.legal-status {
  margin-top: 0.95rem;
  padding: 0.9rem 1rem;
  border-radius: var(--site-radius-md);
  border: 1px dashed var(--site-outline);
  background: color-mix(in srgb, white 74%, transparent);
  color: var(--site-muted);
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
  justify-items: center;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: var(--site-radius-lg);
  background: var(--site-surface);
}

.footer-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.footer-links a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0.65rem 0.95rem;
  border-radius: 999px;
  background: color-mix(in srgb, white 78%, transparent);
  border: 1px solid var(--site-outline);
  font-weight: 600;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.footer-links a:hover,
.footer-links a:focus-visible {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--site-primary) 8%, #fff);
  border-color: color-mix(in srgb, var(--site-primary) 28%, var(--site-outline));
}

.footer-credit {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 0.95rem;
  color: var(--site-muted);
  text-align: center;
}

.footer-credit strong {
  color: var(--site-text);
}

.footer-heart {
  color: #ef4444;
  font-size: 1rem;
  line-height: 1;
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
    align-items: center;
  }

  .site-menu-toggle {
    display: inline-grid;
    margin-left: auto;
  }

  .site-nav,
  .site-header-cta {
    display: none;
    width: 100%;
  }

  .site-header.menu-open .site-nav {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 0.45rem;
  }

  .site-header.menu-open .site-header-cta {
    display: inline-flex;
    justify-content: center;
  }

  .button-small {
    width: 100%;
  }

  .brand {
    align-items: flex-start;
    flex: 1 1 auto;
  }

  .brand-copy span:last-child {
    line-height: 1.45;
  }

  .site-nav a {
    width: 100%;
    padding-inline: 0.95rem;
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
  await fs.writeFile(path.join(publicRoot, 'site-assets', 'public-pages.js'), renderPublicUiScript(), 'utf8');
  await fs.writeFile(path.join(publicRoot, 'site-assets', 'legal-documents.js'), renderLegalLoaderScript(), 'utf8');

  for (const page of localizedMarketingPages) {
    await writeRoute(page.route, renderMarketingPage(page));
  }

  for (const page of localizedLegalPages) {
    await writeRoute(page.route, renderLegalPage(page));
  }

  for (const page of redirectPages) {
    await writeRoute(page.route, renderLanguageRedirectPage(page));
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
