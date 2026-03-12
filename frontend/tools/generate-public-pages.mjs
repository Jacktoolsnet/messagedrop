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
    eyebrow: 'So funktioniert es',
    heroTitle: 'Erst der Ort. Dann die Nachricht. Immer mit Kontext.',
    heroText:
      'MessageDrop beginnt mit der Karte. Nutzer erkunden Orte, öffnen ortsbezogene Inhalte, hinterlassen öffentliche Drops und machen bei Bedarf mit privaten Notizen oder privaten Chats weiter.',
    heroAsideTitle: 'In einem Satz',
    heroAsideItems: [
      'Karte öffnen',
      'Ort auswählen',
      'Drop lesen oder hinterlassen',
      'Privat weitermachen, wenn es sinnvoll ist',
    ],
    sections: [
      {
        title: 'Vier einfache Schritte',
        timeline: [
          {
            icon: 'map',
            title: '1. Karte öffnen',
            body:
              'Die Karte ist der Haupteinstieg. Nutzer schauen sich Orte in der Nähe an oder springen in einen anderen Bereich, den sie erkunden möchten.',
          },
          {
            icon: 'place_item',
            title: '2. Einen realen Ort auswählen',
            body:
              'Ein Ort wird zum Anker für Inhalte. So bleiben Beiträge geografisch verankert statt in einem generischen sozialen Feed zu verschwimmen.',
          },
          {
            icon: 'chat_add_on',
            title: '3. Einen Drop lesen oder hinterlassen',
            body:
              'Nutzer können öffentliche Nachrichten, Kommentare und Kontext an diesem Ort entdecken oder selbst einen Beitrag hinzufügen.',
          },
          {
            icon: 'forum',
            title: '4. Mit eigener Struktur weitermachen',
            body:
              'Private Notizen, Kontakte und Chats unterstützen persönlichere oder dauerhaftere Abläufe, ohne das Produkt zu einem klassischen sozialen Netzwerk zu machen.',
          },
        ],
      },
      {
        title: 'Produktprinzipien',
        tiles: [
          {
            icon: 'privacy_tip',
            title: 'Datenschutzorientiert',
            body:
              'Local-first-Speicherung, verschlüsselte Bereiche und Datenminimierung prägen die technische Umsetzung im Hintergrund.',
          },
          {
            icon: 'visibility',
            title: 'Offene Entdeckung',
            body:
              'Menschen können öffentliche Inhalte erkunden, ohne zuerst durch ein schwergewichtiges Konto-Erlebnis zu müssen.',
          },
          {
            icon: 'account_tree',
            title: 'Kein personalisierter Ranking-Feed',
            body:
              'Öffentliche Inhalte sind nicht um einen engagementgetriebenen Empfehlungsstrom herum gebaut.',
          },
          {
            icon: 'near_me',
            title: 'Unterwegs sinnvoll',
            body:
              'Das Produkt passt natürlich zu Spaziergängen, Reisen, Nachbarschaften, Events und ortsbezogener Entdeckung.',
          },
        ],
      },
      {
        title: 'Typische Anwendungsfälle',
        cards: [
          {
            icon: 'campaign',
            title: 'Lokales Signalbrett',
            body: 'Updates, Warnungen, Tipps oder Beobachtungen teilen, die gerade deshalb wichtig sind, weil sie an einem bestimmten Ort passiert sind.',
          },
          {
            icon: 'history_edu',
            title: 'Erinnerungs-Drops',
            body: 'Die Karte als Erinnerungsschicht nutzen, in der Geschichten und Beobachtungen an Orten hängen bleiben.',
          },
          {
            icon: 'connect_without_contact',
            title: 'Öffentlich zu privat',
            body: 'Etwas öffentlich entdecken und dann bei Bedarf in private Organisation oder Kommunikation wechseln.',
          },
        ],
      },
    ],
  },
  {
    route: '/faq/',
    slug: 'faq',
    lang: 'de',
    title: 'MessageDrop FAQ',
    description:
      'Antworten auf häufige Fragen zu MessageDrop, darunter Funktionsweise, Datenschutz, Konten, öffentliche Nachrichten und rechtliche Grundlagen.',
    heroIcon: 'quiz',
    eyebrow: 'FAQ',
    heroTitle: 'Kurze Antworten auf die Fragen, die zuerst gestellt werden.',
    heroText:
      'Diese Seite ist für Besucher, Suchmaschinen und KI-Systeme gedacht, die eine klare Erklärung brauchen, was MessageDrop ist und wie es funktioniert.',
    faqs: [
      {
        question: 'Was ist MessageDrop?',
        answer:
          'MessageDrop ist eine globale Karte, auf der Menschen Nachrichten an realen Orten hinterlassen können. Die Kernidee ist digitales Graffiti für die Weltkarte: Öffentliche Nachrichten gehören an Orte und nicht nur an Profile oder Feeds.',
      },
      {
        question: 'Brauche ich ein Konto, um MessageDrop zu nutzen?',
        answer:
          'Nein. Öffentliche Inhalte lassen sich grundsätzlich auch ohne Nutzerkonto erkunden. Einige Funktionen wie private Notizen, Kontakte und private Chats erfordern jedoch ein Konto.',
      },
      {
        question: 'Worin unterscheidet sich MessageDrop von einem normalen sozialen Netzwerk?',
        answer:
          'MessageDrop denkt vom Ort aus. Karte und reale Orte stehen im Mittelpunkt, und öffentliche Inhalte werden nicht um einen personalisierten Empfehlungs-Feed organisiert.',
      },
      {
        question: 'Ist MessageDrop datenschutzorientiert?',
        answer:
          'Ja. MessageDrop verfolgt einen datenschutzorientierten Local-first-Ansatz, bei dem ein großer Teil der Daten — soweit technisch möglich — primär auf dem Gerät des Nutzers gespeichert wird.',
      },
      {
        question: 'Sind private Chats verschlüsselt?',
        answer:
          'Laut aktueller Produkt- und Rechtsdokumentation werden private Chats verschlüsselt übertragen und sind für den Anbieter grundsätzlich nicht im Klartext einsehbar.',
      },
      {
        question: 'Verwendet MessageDrop ein personalisiertes Ranking-System?',
        answer:
          'Nein. In den Rechts- und Datenschutztexten steht, dass öffentliche Inhalte nicht durch ein personalisiertes Empfehlungs- oder Ranking-System algorithmisch gefiltert oder priorisiert werden.',
      },
      {
        question: 'Wie alt muss man sein, um MessageDrop zu nutzen?',
        answer:
          'Nutzer müssen mindestens 16 Jahre alt sein. Wer 16 oder 17 Jahre alt ist, benötigt laut aktueller Rechtsdokumentation die Zustimmung der Eltern oder Erziehungsberechtigten.',
      },
      {
        question: 'Kann man externe Inhaltsanbieter deaktiviert lassen?',
        answer:
          'Ja. Externe Inhalte wie YouTube oder Spotify sind so ausgelegt, dass sie deaktiviert bleiben, bis ein Nutzer den jeweiligen Anbieter ausdrücklich aktiviert.',
      },
      {
        question: 'Ist MessageDrop ein Notfalldienst?',
        answer: 'Nein. MessageDrop ist ausdrücklich kein Notfalldienst.',
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
    eyebrow: 'Rechtliches',
    heroTitle: 'Öffentliche Rechtsseiten außerhalb der App.',
    heroText:
      'Diese Seiten werden als normale statische HTML-Seiten ausgeliefert, damit Besucher, Suchmaschinen und KI-Systeme die rechtlichen Informationen direkt erreichen können.',
    legalTiles: [
      {
        href: '/privacy/',
        icon: 'privacy_tip',
        title: 'Datenschutzerklärung',
        body: 'Datenschutzorientierung, Local-first-Speicherung, Drittanbieter-Einbettungen, Push-Benachrichtigungen und DSGVO-Informationen.',
      },
      {
        href: '/terms-of-service/',
        icon: 'rule',
        title: 'Nutzungsbedingungen',
        body: 'Regeln zur Nutzung von MessageDrop, zu verbotenen Inhalten, Moderation und allgemeinem Plattformverhalten.',
      },
      {
        href: '/impressum/',
        icon: 'business',
        title: 'Impressum',
        body: 'Anbieterangaben, Unternehmensdetails, DSA-Kontaktstelle und Hinweise zur Streitbeilegung.',
      },
      {
        href: '/disclaimer/',
        icon: 'warning',
        title: 'Haftungshinweis',
        body: 'Leistungsumfang, technische Grenzen, Mindestalter, Risiken lokaler Speicherung und Haftungshinweise.',
      },
    ],
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
    navFaq: 'FAQ',
    navLegal: 'Rechtliches',
    openApp: 'App öffnen',
    brandHome: 'MessageDrop-App öffnen',
    primaryNav: 'Hauptnavigation',
    legalPages: 'Rechtsseiten',
    footerWhat: 'Was ist MessageDrop?',
    footerHow: 'So funktioniert MessageDrop',
    footerFaq: 'FAQ',
    footerPrivacy: 'Datenschutz',
    footerTerms: 'Nutzungsbedingungen',
    footerImprint: 'Impressum',
    footerDisclaimer: 'Haftungshinweis',
    redirectTitle: 'Sprache wird gewählt',
    redirectText: 'Mit JavaScript wird automatisch die passende Sprachversion geöffnet. Ohne JavaScript kannst du die gewünschte Version hier direkt auswählen.',
    openGerman: 'Deutsch öffnen',
    openEnglish: 'Englisch öffnen',
    openAppLegal: 'App öffnen',
  },
  en: {
    navWhat: 'What is MessageDrop?',
    navHow: 'How MessageDrop works',
    navFaq: 'FAQ',
    navLegal: 'Legal',
    openApp: 'Open app',
    brandHome: 'Open MessageDrop app',
    primaryNav: 'Primary navigation',
    legalPages: 'Legal pages',
    footerWhat: 'What is MessageDrop?',
    footerHow: 'How MessageDrop works',
    footerFaq: 'FAQ',
    footerPrivacy: 'Privacy',
    footerTerms: 'Terms',
    footerImprint: 'Impressum',
    footerDisclaimer: 'Disclaimer',
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

const localizedLegalPages = supportedLocales.flatMap((locale) => {
  const sourcePages = locale === 'de' ? germanLegalPages : legalPages;
  return sourcePages.map((page) => ({
    ...page,
    locale,
    baseRoute: page.route,
    route: localeRoute(locale, page.route),
  }));
});

const redirectPages = [...marketingPages, ...legalPages].map((page) => ({
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
    { href: '/faq/', label: ui.navFaq },
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
    { href: '/faq/', label: ui.footerFaq },
    { href: '/privacy/', label: ui.footerPrivacy },
    { href: '/terms-of-service/', label: ui.footerTerms },
    { href: '/impressum/', label: ui.footerImprint },
    { href: '/disclaimer/', label: ui.footerDisclaimer },
  ];

  return `
    <footer class="site-footer">
      <div>
        <strong>${appName}</strong>
        <p>${appClaimByLocale[lang] ?? appClaim}</p>
      </div>
      <div class="footer-links">
        ${links.map((link) => `<a href="${link.href}">${escapeHtml(link.label)}</a>`).join('')}
      </div>
    </footer>
  `;
}

function renderHero(page) {
  const ui = uiByLocale[page.lang] ?? uiByLocale.en;
  const hasAside = Boolean(page.heroAsideTitle) || (page.heroAsideItems?.length ?? 0) > 0;
  const showLegalCta = page.showLegalCta !== false;
  const titleClass = page.heroTitleClass ? ` ${page.heroTitleClass}` : '';
  return `
    <section class="hero${hasAside ? '' : ' hero--single'}">
      <div class="hero-copy">
        <span class="eyebrow">${page.eyebrowIcon ? `<span class="material-symbols-outlined eyebrow-icon" aria-hidden="true">${escapeHtml(page.eyebrowIcon)}</span>` : ''}${escapeHtml(page.eyebrow)}</span>
        <h1 class="${titleClass.trim()}">${escapeHtml(page.heroTitle)}</h1>
        <p class="hero-text">${escapeHtml(page.heroText)}</p>
        <div class="cta-row">
          <a class="button button-primary" href="/">${escapeHtml(ui.openApp)}</a>
          ${showLegalCta ? `<a class="button button-secondary" href="/legal/">${escapeHtml(ui.legalPages)}</a>` : ''}
        </div>
      </div>
      ${hasAside ? `<aside class="hero-panel" aria-label="${page.lang === 'de' ? 'Kurzübersicht' : 'Quick summary'}">
        <div class="hero-panel-header">
          <div class="icon-badge info-avatar" aria-hidden="true">
            <span class="material-symbols-outlined">${escapeHtml(page.heroIcon)}</span>
          </div>
          <h2>${escapeHtml(page.heroAsideTitle ?? (page.lang === 'de' ? 'Kurzübersicht' : 'Quick summary'))}</h2>
        </div>
        <ul class="check-list">
          ${(page.heroAsideItems ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
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
        <div class="section-heading-title">
          ${section.icon ? `<span class="icon-badge" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(section.icon)}</span></span>` : ''}
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        ${section.intro ? `<p>${escapeHtml(section.intro)}</p>` : ''}
      </div>
      ${section.tiles ? renderTileGrid(section.tiles) : ''}
      ${section.cards ? renderCardGrid(section.cards) : ''}
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

  if (page.legalTiles) {
    body.push(`
      <section class="content-section">
        <div class="section-heading">
          <h2>${isGerman ? 'Rechtsseiten' : 'Legal pages'}</h2>
          <p>${isGerman ? 'Diese Links führen zu den öffentlichen Rechtsdokumenten, die unabhängig von der App-Oberfläche erreichbar sind.' : 'These links lead to the static legal documents that are available independently from the app UI.'}</p>
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
});\n`;
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
  align-items: center;
  gap: 0.8rem;
}

.section-heading-title .icon-badge {
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
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
