import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const platformRoot = path.join(repoRoot, 'platform', 'messagedrop');
const publicRoot = path.join(platformRoot, 'public');
const frontendPublicRoot = path.join(frontendRoot, 'public');
const frontendAssetsRoot = path.join(frontendRoot, 'src', 'assets');
const baseUrl = 'https://messagedrop.de';
const appBaseUrl = 'https://app.messagedrop.de';
const appName = 'MessageDrop';
const appClaim = 'A global map where people can leave messages in real-world locations.';

const marketingPages = [
  {
    pageKey: 'what-is-messagedrop',
    route: '/what-is-messagedrop/',
    slug: 'what-is-messagedrop',
    lang: 'en',
    title: 'What is MessageDrop?',
    description:
      'MessageDrop is a global map where people can leave messages in real-world locations, follow places, and communicate securely.',
    heroIcon: 'globe_location_pin',
    heroTitle: 'Place messages. Follow places. Communicate securely.',
    heroTitleClass: 'hero-title-compact',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'What makes MessageDrop different',
    heroAsideItems: [
      'Whenever possible, your data stays on your device.',
      'You stay in control of your data. You can create, change, and delete it at any time.',
      'MessageDrop forgets. Deleting really means deleting.',
      'No algorithm decides what you see. We always show you the newest messages first.',
      'No doomscrolling. We limit the number of messages we show you.',
      'You follow places, not people. Connect with people you know.',
    ],
    sections: [
      {
        title: 'Core ideas',
        icon: 'lightbulb',
        tiles: [
          {
            icon: 'lock',
            title: 'Your data stays yours',
            body:
              'Whenever possible, your data stays on your device. Deleting really means deleting. We also proactively remove stale public data and unused user accounts when they are no longer needed.',
          },
          {
            icon: 'filter_alt_off',
            title: 'No profiling. No algorithm.',
            body:
              'We do not want to know who you are. We do not care what you like. You see the content that is current — no more and no less.',
          },
          {
            icon: 'pin_drop',
            title: 'All public messages get the same chance',
            body:
              'Views, comments, and likes do not make a message more visible in MessageDrop. Visibility is not driven by popularity, but by the place and its context.',
          },
          {
            icon: 'palette',
            title: 'More freedom for real content',
            body:
              'You do not have to think about which content gets the most reach. That leaves more room for what you actually want to share. And if text is not enough, you can place your Pinterest, YouTube, or TikTok content on our map exactly where it happened.',
          },
          {
            icon: 'map',
            title: 'Follow places, not people',
            body:
              'Follow the places that matter to you: your home, your favorite bar, or your vacation spot. Get notified when new messages appear there and add important information yourself.',
          },
          {
            icon: 'near_me',
            title: 'Location-based services',
            body:
              'Places can also show helpful extra context like weather, air quality, and experiences nearby. That makes the map a more useful starting point for orientation and exploration.',
          },
          {
            icon: 'contacts',
            title: 'Get in touch',
            body:
              'The easiest way to connect with other users is in real life, for example over a coffee, by scanning the connect QR code. It also works online, but you should already know each other. Private communication is transmitted encrypted and signed. The keys are generated on your device, and the private keys never leave it.',
          },
          {
            icon: 'person_search',
            title: 'Make up your own mind',
            body:
              'You can give every user who writes public messages a profile of your own. It is only visible to you and helps you recognize when messages come from the same user. What image other people have of you? You will probably never know.',
          },
        ],
      },
      {
        title: 'MessageDrop is made for you',
        icon: 'groups',
        className: 'audience-section',
        cards: [
          {
            icon: 'group',
            title: '… and your friends',
            body: 'For private communication with people you really know.',
          },
          {
            icon: 'palette',
            title: '… and your creativity',
            body: 'Less reach pressure. More room for the content you actually want to share.',
          },
          {
            icon: 'place',
            title: '… and your places',
            body: 'For the places that matter to you and the context around them.',
          },
        ],
      },
      {
        title: 'What comes next',
        icon: 'route',
        tiles: [
          {
            icon: 'explore',
            title: 'More ideas around places',
            body:
              'Where is my favorite food truck today? Is there a discount code at the café around the corner? What is the next event at the concert hall in my city? And if I miss the last train — can I still find a hotel nearby? These are exactly the kinds of place-based questions we want MessageDrop to answer even better in the future.',
          },
          {
            icon: 'travel',
            title: 'Explore the world',
            body:
              'We are planning a feature that helps you plan your next trip in the best possible way: when to go, where to stay, which hotel fits, what sights to visit, which events are happening, and how prices and tickets look — all in one app.',
          },
          {
            icon: 'autorenew',
            title: 'What ideas do you have?',
            body:
              'Drop your idea directly in MessageDrop: leave a message with the hashtag #feature.',
          },
        ],
      },
      {
        title: 'Support us',
        icon: 'local_cafe',
        className: 'support-section',
        tiles: [
          {
            icon: 'local_cafe',
            title: 'If you like MessageDrop, buy us a coffee',
            body:
              'If you like MessageDrop and the ideas behind it, you can support JackTools.Net directly. Every contribution helps us with development, operations, and new features — whether it pays for coffee, chocolate, or the next good idea.',
            href: 'https://buymeacoffee.com/jacktoolsnet',
            ctaLabel: 'Buy us a coffee',
            ctaIcon: 'local_cafe',
            external: true,
          },
        ],
      },
    ],
  },
  {
    pageKey: 'how-it-works',
    route: '/how-it-works/',
    slug: 'how-it-works',
    lang: 'en',
    title: 'How MessageDrop works',
    description:
      'See how MessageDrop turns locations into entry points for public messages, local context, private notes, and private chats.',
    heroIcon: 'alt_route',
    heroTitle: 'Open the app. Pick a place. Leave a message.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'If things get a little tricky',
    heroAsideText:
      'Sometimes it can be a little more complicated. For those moments, we will gradually provide video tutorials here.',
    sections: [
      {
        title: 'Video guides',
        icon: 'smart_display',
        videos: [
          {
            icon: 'rocket_launch',
            title: 'Open the app and get started',
            body:
              'See how MessageDrop starts, how the consent screen works, and how to get oriented after the first launch.',
            youtubeId: 'zW-1hXgqiko',
            videoUrl: 'https://youtu.be/zW-1hXgqiko',
            ctaLabel: 'Watch on YouTube',
          },
          {
            icon: 'account_circle',
            title: 'Create your account and fill your profile',
            body:
              'Learn how to create an account with a PIN and complete your user profile with name, avatar, and personal details.',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'edit_square',
            title: 'Create messages and manage local profiles',
            body:
              'Watch how to create your own messages and give other users local names and avatars that are only visible to you.',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'place',
            title: 'Create places and maintain place profiles',
            body:
              'See how to create places, keep place profiles up to date, and use tiles to surface useful information at a location.',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'forum',
            title: 'Connect with users and use the chatroom',
            body:
              'Learn how to connect with other users and exchange private messages.',
            ctaLabel: 'Video coming soon',
          },
          {
            icon: 'travel_explore',
            title: 'Explore experiences',
            body:
              'See how to search for experiences, discover activities around a place, and plan your next vacation with MessageDrop.',
            ctaLabel: 'Video coming soon',
          },
        ],
      },
    ],
  },
  {
    pageKey: 'legal',
    route: '/legal/',
    slug: 'legal',
    lang: 'en',
    title: 'Legal information',
    description:
      'Central legal hub for MessageDrop with privacy policy, terms of service, legal notice, and disclaimer.',
    heroIcon: 'gavel',
    eyebrowIcon: 'gavel',
    eyebrow: '',
    heroTitle: 'All legal information in one place.',
    heroText: '',
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


const faqPages = [
  {
    pageKey: 'faq',
    route: '/faq/',
    slug: 'faq',
    lang: 'en',
    title: 'Frequently Asked Questions about MessageDrop',
    description: 'Answers to frequently asked general questions about MessageDrop, registration, costs, age requirements, languages, devices, and the operator.',
    heroIcon: 'quiz',
    heroTitle: 'Frequently asked questions about MessageDrop.',
    heroText: 'Start here if you want a quick overview of what MessageDrop is, who it is for, and how you can use it.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'General questions',
    heroAsideItems: [
      'Short answers for a quick first overview.',
      'Only one answer opens at a time, so the page stays easy to scan.',
      'We will add more categories later as real user questions come in.',
    ],
    faqTitle: 'General',
    faqIntro: 'These first questions cover the basic ideas behind MessageDrop.',
    faqs: [
      {
        slug: 'what-is-messagedrop',
        question: 'What is MessageDrop?',
        answer: 'MessageDrop is a location-based web app. You can leave public messages at real-world places on a map, follow places that matter to you, and use private content and communication features.',
      },
      {
        slug: 'what-can-i-use-messagedrop-for',
        question: 'What can I use MessageDrop for?',
        answer: 'You can use MessageDrop to share information connected to places, discover current messages nearby, keep private notes, follow important places, and connect with people you already know.',
      },
      {
        slug: 'do-i-have-to-register',
        question: 'Do I have to register to use MessageDrop?',
        answer: 'You can use MessageDrop without a user account. However, some functions require a user account.',
      },
      {
        slug: 'is-messagedrop-free',
        question: 'Is MessageDrop free?',
        answer: 'MessageDrop can currently be used without a usage fee. Costs charged by your internet provider, mobile provider, device, or third-party services are not controlled by MessageDrop.',
      },
      {
        slug: 'how-old-do-i-have-to-be',
        question: 'How old do I have to be to use MessageDrop?',
        answer: 'You must be at least 16 years old to use MessageDrop. If additional legal requirements apply in your country, you must also follow those requirements.',
      },
      {
        slug: 'is-messagedrop-available-in-multiple-languages',
        question: 'Is MessageDrop available in multiple languages?',
        answer: 'Yes. The MessageDrop app supports German, English, French, and Spanish. The public pages and legal information are currently mainly available in German and English.',
      },
      {
        slug: 'who-is-messagedrop-for',
        question: 'Who is MessageDrop for?',
        answer: 'MessageDrop is for people who want to connect information with places: private users, friends, local communities, travelers, creators, and anyone who wants a map-based way to share or remember context.',
      },
      {
        slug: 'do-i-need-an-app',
        question: 'Do I need to install an app to use MessageDrop?',
        answer: 'No separate app installation is required. MessageDrop runs in the browser and can be opened as a web app. Depending on your device and browser, you may also be able to add it to your home screen.',
      },
      {
        slug: 'does-messagedrop-work-on-mobile-tablet-desktop',
        question: 'Does MessageDrop work on smartphones, tablets, and desktop computers?',
        answer: 'Yes. MessageDrop is designed as a responsive web app and can be used on smartphones, tablets, and desktop browsers. Some functions, such as location access, depend on your device and browser permissions.',
      },
      {
        slug: 'who-operates-messagedrop',
        question: 'Who operates MessageDrop?',
        answer: 'MessageDrop is operated by JackTools.Net UG (limited liability). You can find the current provider details and contact information in the legal notice.',
      },
      {
        slug: 'is-messagedrop-a-messenger',
        question: 'Is MessageDrop a messenger?',
        answer: 'MessageDrop is not a classic messenger or social feed. The core idea is to connect messages and information with places. Private communication exists, but the app is built around places rather than around follower counts or algorithmic feeds.',
      },
    ],
    additionalFaqCategories: [
      {
        title: 'Using MessageDrop as a guest',
        intro: 'These questions explain what you can do before creating a user account or connecting to the backend.',
        items: [
          {
            slug: 'what-can-i-see-as-a-guest',
            question: 'What can I see as a guest?',
            answer: 'As a guest, you can explore the map, see public messages that are available for the selected area, search places and hashtags, and open public information around places.',
          },
          {
            slug: 'can-i-create-public-messages-as-a-guest',
            question: 'Can I create public messages as a guest?',
            answer: 'No. To create or publish public messages, you need a user account.',
          },
          {
            slug: 'can-i-see-weather-information-as-a-guest',
            question: 'Can I see weather information as a guest?',
            answer: 'Yes. Weather information can be opened for places when the feature is available and your device has an internet connection. The displayed data depends on external weather data sources.',
          },
          {
            slug: 'can-i-see-air-quality-information-as-a-guest',
            question: 'Can I see air quality information as a guest?',
            answer: 'Yes. Air quality information can be opened for places when data is available. The values depend on external data sources and should be understood as informational context, not as official safety advice.',
          },
          {
            slug: 'can-i-search-for-places-as-a-guest',
            question: 'Can I search for places as a guest?',
            answer: 'Yes. As a guest, you can search for places. Which results are shown depends on your search and the available data.',
          },
          {
            slug: 'can-i-search-experiences-nearby-as-a-guest',
            question: 'Can I search for experiences nearby as a guest?',
            answer: 'Yes. You can search for experiences around a place as a guest when the experience search is available. Results may come from external providers and can depend on location and availability.',
          },
          {
            slug: 'can-i-search-for-hashtags-as-a-guest',
            question: 'Can I search for hashtags as a guest?',
            answer: 'Yes. Hashtag search helps you find public messages connected to a topic. As with other public content, results depend on available messages, location context, and moderation status.',
          },
          {
            slug: 'which-features-require-a-user-account',
            question: 'Which features require a user account?',
            answer: 'Features that create, publish, synchronize, or privately manage content usually require a user identity or a backend connection. This includes publishing public messages, managing your own content, contacts, and private communication.',
          },
          {
            slug: 'is-data-stored-on-my-device-as-a-guest',
            question: 'Is data stored on my device as a guest?',
            answer: 'Yes, some settings and local data can be stored on your device so the app works smoothly. MessageDrop is designed to keep as much data as possible local to your device.',
          },
          {
            slug: 'are-my-settings-kept-as-a-guest',
            question: 'Are my settings kept as a guest?',
            answer: 'Usually yes, as long as your browser keeps the local app data. If you clear browser storage, use private browsing, or change devices, local guest settings can be lost.',
          },
          {
            slug: 'can-i-switch-from-guest-mode-to-a-user-account-later',
            question: 'Can I switch from guest mode to a user account later?',
            answer: 'Yes. You can start as a guest and later create or connect a user identity when you want to use features that need one. Local data may still depend on the device and browser storage you used before.',
          },
          {
            slug: 'can-i-open-external-content-as-a-guest',
            question: 'Can I open external content such as YouTube, TikTok, or Pinterest as a guest?',
            answer: 'Yes, if external content is enabled in your settings. External providers are separate services with their own terms, privacy policies, cookies, and tracking behavior.',
          },
        ],
      },
        {
                "title": "Using MessageDrop with a user account · Account and profile",
                "intro": "Questions about your user identity, PIN, profile, and using MessageDrop on different devices.",
                "items": [
                        {
                                "slug": "what-changes-when-i-use-a-user-account",
                                "question": "What changes when I use a user account?",
                                "answer": "With a user account, you can create and manage your own public messages, use private content features, maintain places, connect with contacts, and use features that need a stable user identity or backend connection."
                        },
                        {
                                "slug": "how-do-i-create-a-user-account",
                                "question": "How do I create a user account?",
                                "answer": "You create a user account directly in the app. MessageDrop guides you through the required steps, including creating a PIN and setting up your local user identity."
                        },
                        {
                                "slug": "why-do-i-need-a-pin",
                                "question": "Why do I need a PIN?",
                                "answer": "The PIN helps protect your local user identity and sensitive actions on your device. It is part of the security concept for private and account-related features."
                        },
                        {
                                "slug": "what-happens-if-i-forget-my-pin",
                                "question": "What happens if I forget my PIN?",
                                "answer": "If you forget your PIN, access to locally protected data can be limited or lost. Because MessageDrop is designed to keep data local where possible, backups are important."
                        },
                        {
                                "slug": "what-information-does-my-profile-contain",
                                "question": "What information does my profile contain?",
                                "answer": "Your profile can contain information such as a display name, avatar, and profile details that help you recognize your own account and, where applicable, help others identify you."
                        },
                        {
                                "slug": "can-i-change-my-profile-later",
                                "question": "Can I change my profile later?",
                                "answer": "Yes. You can update your profile later in the app. Changes may affect how your profile is shown in places where profile information is used."
                        },
                        {
                                "slug": "is-my-profile-visible-to-others",
                                "question": "Is my profile visible to others?",
                                "answer": "Some profile information can be visible to other users in connection with public messages or contacts. Local profiles that you create for other users are only for your own device."
                        },
                        {
                                "slug": "can-i-use-messagedrop-on-multiple-devices",
                                "question": "Can I use MessageDrop on multiple devices?",
                                "answer": "Some features can be used on multiple devices when backend connection and synchronization are available. Data that exists only locally on one device may not automatically appear on another device."
                        }
                ]
        },
        {
                "title": "Using MessageDrop with a user account · Own public messages",
                "intro": "Questions about creating, editing, deleting, and moderating your own public messages.",
                "items": [
                        {
                                "slug": "can-i-create-my-own-public-messages",
                                "question": "Can I create my own public messages?",
                                "answer": "Yes. With a suitable user identity and backend connection, you can create public messages and place them at real-world locations on the map."
                        },
                        {
                                "slug": "where-do-my-public-messages-appear",
                                "question": "Where do my public messages appear?",
                                "answer": "Public messages appear at the location you choose on the map. They can be discovered by other users depending on location, search settings, availability, and moderation status."
                        },
                        {
                                "slug": "can-i-edit-my-public-messages-later",
                                "question": "Can I edit my public messages later?",
                                "answer": "Yes. You can edit your own public messages when the app can identify you as the owner and the message is still available for editing."
                        },
                        {
                                "slug": "can-i-delete-my-public-messages",
                                "question": "Can I delete my public messages?",
                                "answer": "Yes. You can delete your own public messages. MessageDrop is designed so that deleting really removes data where the system controls that data."
                        },
                        {
                                "slug": "why-can-a-public-message-be-moderated-or-removed",
                                "question": "Why can a public message be moderated or removed?",
                                "answer": "Public messages can be moderated or removed if they violate rules, contain illegal content, disclose personal data, are reported, or otherwise conflict with safety and legal requirements."
                        },
                        {
                                "slug": "can-i-embed-external-content-in-public-messages",
                                "question": "Can I embed external content in public messages?",
                                "answer": "Yes, where supported. You can link or embed content from supported external platforms. External providers remain separate services with their own terms and privacy practices."
                        },
                        {
                                "slug": "can-i-see-how-others-react-to-my-public-messages",
                                "question": "Can I see how others react to my public messages?",
                                "answer": "MessageDrop can show reactions or interaction indicators where such features are available. These indicators do not turn public messages into an algorithmic popularity feed."
                        }
                ]
        },
        {
                "title": "Using MessageDrop with a user account · Private content",
                "intro": "Questions about private notes, images, documents, and local storage.",
                "items": [
                        {
                                "slug": "what-are-private-notes",
                                "question": "What are private notes?",
                                "answer": "Private notes are personal notes that you create for yourself. They are intended for your own use and are separate from public messages on the map."
                        },
                        {
                                "slug": "who-can-see-my-private-notes",
                                "question": "Who can see my private notes?",
                                "answer": "Private notes are intended to be visible only to you. Access can still depend on your device security, browser storage, backups, and how you handle your device."
                        },
                        {
                                "slug": "can-i-store-private-images",
                                "question": "Can I store private images?",
                                "answer": "Yes. MessageDrop includes features for private images so you can keep image-based content for yourself instead of publishing it publicly."
                        },
                        {
                                "slug": "can-i-store-private-documents",
                                "question": "Can I store private documents?",
                                "answer": "Yes. You can store private documents where the feature is available. As with other private content, you should keep backups if the data is important."
                        },
                        {
                                "slug": "where-is-private-content-stored",
                                "question": "Where is private content stored?",
                                "answer": "Private content is designed to stay local on your device whenever possible. Some features may require backend support, but local-first storage is an important part of MessageDrop."
                        },
                        {
                                "slug": "can-i-delete-private-content-later",
                                "question": "Can I delete private content later?",
                                "answer": "Yes. You can delete private content that you manage in the app. If data exists only on your device, deleting or losing local storage can also remove it."
                        },
                        {
                                "slug": "what-happens-to-private-content-when-i-change-devices",
                                "question": "What happens to private content when I change devices?",
                                "answer": "Private content that is stored only locally does not automatically move to a new device. Use available backup and restore options before changing devices or clearing browser data."
                        }
                ]
        },
        {
                "title": "Using MessageDrop with a user account · Places",
                "intro": "Questions about creating, editing, following, and maintaining places.",
                "items": [
                        {
                                "slug": "can-i-create-my-own-places",
                                "question": "Can I create my own places?",
                                "answer": "Yes. With the required user features, you can create places and connect information to real-world locations."
                        },
                        {
                                "slug": "what-is-a-place-in-messagedrop",
                                "question": "What is a place in MessageDrop?",
                                "answer": "A place is a location-based entry on the map. It can collect context such as messages, tiles, weather, air quality, experiences, and other useful information around that location."
                        },
                        {
                                "slug": "can-i-edit-places",
                                "question": "Can I edit places?",
                                "answer": "Yes, where you have the required permissions or ownership. Editing helps keep place information useful and up to date."
                        },
                        {
                                "slug": "can-i-follow-places",
                                "question": "Can I follow places?",
                                "answer": "Yes. Following places helps you keep track of locations that matter to you, such as your home area, favorite café, workplace, or travel destination."
                        },
                        {
                                "slug": "what-happens-when-new-content-appears-at-a-followed-place",
                                "question": "What happens when new content appears at a followed place?",
                                "answer": "When new relevant content appears at a followed place, MessageDrop can surface it in the app or through available notification features, depending on your settings and permissions."
                        },
                        {
                                "slug": "can-i-add-information-to-a-place",
                                "question": "Can I add information to a place?",
                                "answer": "Yes. You can add or maintain information around places where the feature is available. This helps make places more useful for you and other users."
                        }
                ]
        },
        {
                "title": "Using MessageDrop with a user account · Contacts and private communication",
                "intro": "Questions about connecting with people and exchanging private messages.",
                "items": [
                        {
                                "slug": "can-i-contact-other-users",
                                "question": "Can I contact other users?",
                                "answer": "Yes. MessageDrop includes contact and private communication features for users who connect with each other."
                        },
                        {
                                "slug": "how-do-i-connect-with-other-users",
                                "question": "How do I connect with other users?",
                                "answer": "The easiest way is to connect with people you already know, for example by scanning a connect QR code in person. Online connection is possible, but you should know who you are connecting with."
                        },
                        {
                                "slug": "why-should-i-only-connect-with-people-i-know",
                                "question": "Why should I only connect with people I know?",
                                "answer": "Private communication works best when you know and trust the other person. Connecting only with known people reduces abuse, spam, and misunderstandings."
                        },
                        {
                                "slug": "are-private-messages-encrypted",
                                "question": "Are private messages encrypted?",
                                "answer": "Private communication is designed to be encrypted and signed. The cryptographic keys are generated on your device, and private keys are intended to stay on your device."
                        },
                        {
                                "slug": "can-messagedrop-read-my-private-messages",
                                "question": "Can MessageDrop read my private messages?",
                                "answer": "MessageDrop is designed so private communication is technically protected. As a rule, private message contents should not be readable by MessageDrop in plain text."
                        },
                        {
                                "slug": "what-happens-if-i-delete-a-contact",
                                "question": "What happens if I delete a contact?",
                                "answer": "Deleting a contact removes that connection from your app context. Depending on local storage and message history, you may also need to manage related local data separately."
                        }
                ]
        },
        {
                "title": "Using MessageDrop with a user account · Data, backup, and safety",
                "intro": "Questions about backups, synchronization, device loss, and account deletion.",
                "items": [
                        {
                                "slug": "why-should-i-create-a-backup",
                                "question": "Why should I create a backup?",
                                "answer": "Backups are important because much of MessageDrop is designed to keep data local on your device. If your device or browser data is lost, a backup may be the only way to restore important content."
                        },
                        {
                                "slug": "which-data-is-synchronized",
                                "question": "Which data is synchronized?",
                                "answer": "Data that needs backend support, such as published public content or account-related server data, can be synchronized. Purely local private data may remain only on your device unless a backup or restore feature is used."
                        },
                        {
                                "slug": "which-data-stays-only-on-my-device",
                                "question": "Which data stays only on my device?",
                                "answer": "Local settings, private content, local profiles, and other device-specific data can stay only on your device. The exact behavior depends on the feature and your app settings."
                        },
                        {
                                "slug": "what-happens-if-i-lose-my-device",
                                "question": "What happens if I lose my device?",
                                "answer": "If you lose your device, local data can be lost as well. You should protect your device, keep your PIN safe, and create backups for data that is important to you."
                        },
                        {
                                "slug": "can-i-delete-my-user-account",
                                "question": "Can I delete my user account?",
                                "answer": "Yes. You can delete your user account where the app provides the account deletion feature. Make sure you understand what will happen to local and server-side data first."
                        },
                        {
                                "slug": "what-happens-to-my-data-when-i-delete-my-user-account",
                                "question": "What happens to my data when I delete my user account?",
                                "answer": "Deleting your account removes account-related data according to the app rules and legal requirements. Some local data on your device may need to be removed separately by clearing app or browser storage."
                        }
                ]
        }
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
    pageKey: 'what-is-messagedrop',
    route: '/was-ist-messagedrop/',
    slug: 'was-ist-messagedrop',
    lang: 'de',
    title: 'Was ist MessageDrop?',
    description:
      'MessageDrop ist eine globale Karte, auf der Menschen Nachrichten an realen Orten hinterlassen, Orten folgen und sicher kommunizieren können.',
    heroIcon: 'globe_location_pin',
    heroTitle: 'Platziere Nachrichten. Folge Orten. Kommuniziere sicher.',
    heroTitleClass: 'hero-title-compact',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'Was MessageDrop anders macht',
    heroAsideItems: [
      'Wann immer möglich, bleiben Deine Daten auf Deinem Gerät.',
      'Du behältst die Kontrolle über Deine Daten. Erstellen, ändern und löschen ist jederzeit möglich.',
      'MessageDrop vergisst. Löschen bedeutet wirklich löschen.',
      'Kein Algorithmus entscheidet, was Du siehst. Wir zeigen Dir immer die neuesten Nachrichten zuerst.',
      'Kein Doomscrolling. Wir begrenzen die Anzahl der Nachrichten, die wir Dir zeigen.',
      'Du folgst Orten statt Personen. Verbinde Dich mit Menschen die Du kennst.',
    ],
    sections: [
      {
        title: 'Kernideen',
        icon: 'lightbulb',
        tiles: [
          {
            icon: 'lock',
            title: 'Deine Daten sind Deine Daten',
            body:
              'Wann immer möglich, bleiben Deine Daten auf Deinem Gerät. Löschen bedeutet wirklich löschen. Außerdem entfernen wir öffentliche Alt-Daten und ungenutzte Nutzerkonten proaktiv, wenn sie nicht mehr gebraucht werden.',
          },
          {
            icon: 'filter_alt_off',
            title: 'Kein Profiling. Kein Algorithmus.',
            body:
              'Wir wollen nicht wissen, wer Du bist. Uns ist egal, was Dir gefällt. Du siehst den Inhalt, der aktuell ist – nicht mehr und nicht weniger.',
          },
          {
            icon: 'pin_drop',
            title: 'Alle öffentlichen Nachrichten haben die gleiche Chance',
            body:
              'Views, Kommentare und Likes machen eine Nachricht in MessageDrop nicht sichtbarer. Sichtbarkeit entsteht nicht durch Popularität, sondern durch den Ort und seinen Kontext.',
          },
          {
            icon: 'palette',
            title: 'Mehr Freiheit für echten Content',
            body:
              'Du musst Dir keine Gedanken darüber machen, welcher Inhalt die größte Reichweite erzielt. So bleibt mehr Raum für das, was Du wirklich teilen willst. Und wenn Text nicht reicht, kannst Du Deinen Pinterest-, YouTube- oder TikTok-Content genau dort auf unserer Karte platzieren, wo er passiert ist.',
          },
          {
            icon: 'map',
            title: 'Folge Orten, nicht Personen',
            body:
              'Folge den Orten, die Dir wichtig sind: Deinem Zuhause, Deiner Lieblingsbar oder Deinem Urlaubsort. Erhalte Benachrichtigungen, wenn dort neue Nachrichten erscheinen, und füge selbst wichtige Informationen hinzu.',
          },
          {
            icon: 'near_me',
            title: 'Ortsbezogene Dienste',
            body:
              'Zu Orten können zusätzliche Informationen wie Wetter, Luftqualität und Erlebnisse in der Nähe angezeigt werden. So wird die Karte zu einem besseren Ausgangspunkt für Orientierung und Entdeckung.',
          },
          {
            icon: 'contacts',
            title: 'Tritt in Kontakt',
            body:
              'Am einfachsten verbindest Du Dich mit anderen Nutzern im echten Leben, zum Beispiel bei einem Kaffee, indem Ihr den Connect-QR-Code scannt. Es geht auch online, aber Ihr solltet Euch bereits kennen. Private Kommunikation wird verschlüsselt und signiert übertragen. Die Schlüssel werden auf Deinem Gerät erzeugt, und die privaten Schlüssel verlassen es nicht.',
          },
          {
            icon: 'person_search',
            title: 'Mach Dir Dein eigenes Bild',
            body:
              'Du kannst jedem Nutzer, der öffentliche Nachrichten schreibt, ein eigenes Profil geben. Dieses Profil ist nur für Dich sichtbar und hilft Dir zu erkennen, wenn Nachrichten vom selben Nutzer stammen. Welche Bilder andere sich von Dir machen? Das wirst Du vermutlich nie erfahren.',
          },
        ],
      },
      {
        title: 'MessageDrop ist gemacht für Dich',
        icon: 'groups',
        className: 'audience-section',
        cards: [
          {
            icon: 'group',
            title: '… und Deine Freunde',
            body: 'Für private Kommunikation mit Personen, die Du wirklich kennst.',
          },
          {
            icon: 'palette',
            title: '… und Deine Kreativität',
            body: 'Weniger Reichweitendruck. Mehr Raum für den Content, den Du wirklich teilen willst.',
          },
          {
            icon: 'place',
            title: '… und Deine Orte',
            body: 'Für Orte, die Dir wichtig sind, und den Kontext rund um sie.',
          },
        ],
      },
      {
        title: 'Wie es weitergeht',
        icon: 'route',
        tiles: [
          {
            icon: 'explore',
            title: 'Mehr Ideen rund um Orte',
            body:
              'Wo ist mein Lieblings-Foodtruck heute? Gibt es einen Rabattcode im Café um die Ecke? Was ist das nächste Event in der Konzerthalle meiner Stadt? Und wenn ich den letzten Zug verpasse — finde ich noch ein Hotel in der Nähe? Genau solche ortsbezogenen Fragen wollen wir mit MessageDrop künftig noch besser beantworten.',
          },
          {
            icon: 'travel',
            title: 'Entdecke die Welt',
            body:
              'Wir planen eine Funktion, die Dich optimal bei der Planung Deiner nächsten Reise unterstützt: wann, wohin, welches Hotel passt, welche Sehenswürdigkeiten sich lohnen, welche Events stattfinden und wie es mit Preisen und Tickets aussieht — alles in einer App.',
          },
          {
            icon: 'autorenew',
            title: 'Welche Ideen hast Du?',
            body:
              'Droppe Deine Idee direkt in MessageDrop: Hinterlasse eine Nachricht mit dem Hashtag #feature.',
          },
        ],
      },
      {
        title: 'Unterstütze uns',
        icon: 'local_cafe',
        className: 'support-section',
        tiles: [
          {
            icon: 'local_cafe',
            title: 'Wenn Dir MessageDrop gefällt, spendiere uns einen Kaffee',
            body:
              'Wenn Dir MessageDrop und die Ideen dahinter gefallen, kannst Du JackTools.Net direkt unterstützen. Jeder Beitrag hilft uns bei Entwicklung, Betrieb und neuen Funktionen — ob für Kaffee, Schokolade oder die nächste gute Idee.',
            href: 'https://buymeacoffee.com/jacktoolsnet',
            ctaLabel: 'Buy us a coffee',
            ctaIcon: 'local_cafe',
            external: true,
          },
        ],
      },
    ],
  },
  {
    pageKey: 'how-it-works',
    route: '/so-funktioniert-messagedrop/',
    slug: 'so-funktioniert-messagedrop',
    lang: 'de',
    title: 'Wie MessageDrop funktioniert',
    description:
      'Sieh Dir an, wie MessageDrop Orte zu Einstiegspunkten für öffentliche Nachrichten, lokalen Kontext, private Notizen und private Chats macht.',
    heroIcon: 'alt_route',
    heroTitle: 'App öffnen. Ort wählen. Nachricht hinterlassen.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'Wenn es doch mal klemmt!',
    heroAsideText:
      'Manchmal ist es aber auch ein bisschen komplizierter. Für diesen Fall werden wir hier nach und nach Video-Tutorials bereitstellen.',
    sections: [
      {
        title: 'Video-Guides',
        icon: 'smart_display',
        videos: [
          {
            icon: 'rocket_launch',
            title: 'App öffnen und erste Schritte',
            body:
              'So startest Du MessageDrop, gehst durch den Consent-Screen und findest Dich nach dem ersten Öffnen schnell zurecht.',
            youtubeId: 'zW-1hXgqiko',
            videoUrl: 'https://youtu.be/zW-1hXgqiko',
            ctaLabel: 'Auf YouTube ansehen',
          },
          {
            icon: 'account_circle',
            title: 'Nutzerkonto anlegen und Profil ausfüllen',
            body:
              'Erfahre, wie Du mit einem PIN ein Nutzerkonto anlegst und Dein Profil mit Namen, Avatar und weiteren Angaben vervollständigst.',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'edit_square',
            title: 'Nachrichten erstellen und lokale Profile pflegen',
            body:
              'Sieh, wie Du eigene Nachrichten erstellst und anderen Nutzern lokal Namen und Avatare gibst, die nur für Dich sichtbar sind.',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'place',
            title: 'Orte anlegen und Ortsprofile pflegen',
            body:
              'So legst Du neue Orte an, pflegst Ortsprofile und nutzt Kacheln, um Informationen an einem Ort sichtbar zu machen.',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'forum',
            title: 'Kontakte aufnehmen und Chatroom nutzen',
            body:
              'Lerne, wie Du Kontakt mit anderen Nutzern aufnimmst und persönliche Nachrichten austauschst.',
            ctaLabel: 'Video folgt',
          },
          {
            icon: 'travel_explore',
            title: 'Erlebnisse suchen',
            body:
              'Sieh, wie Du nach Erlebnissen suchst, Aktivitäten rund um einen Ort entdeckst und mit MessageDrop Deinen nächsten Urlaub planst.',
            ctaLabel: 'Video folgt',
          },
        ],
      },
    ],
  },
  {
    pageKey: 'legal',
    route: '/rechtliches/',
    slug: 'rechtliches',
    lang: 'de',
    title: 'Rechtliche Informationen',
    description:
      'Zentrale Rechtsübersicht für MessageDrop mit Datenschutzerklärung, Nutzungsbedingungen, Impressum und Haftungshinweis.',
    heroIcon: 'gavel',
    eyebrowIcon: 'gavel',
    eyebrow: '',
    heroTitle: 'Alle rechtlichen Informationen an einem Ort.',
    heroText: '',
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


const germanFaqPages = [
  {
    pageKey: 'faq',
    route: '/faq/',
    slug: 'faq',
    lang: 'de',
    title: 'Häufige Fragen zu MessageDrop',
    description: 'Antworten auf häufige allgemeine Fragen zu MessageDrop, Registrierung, Kosten, Mindestalter, Sprachen, Geräten und Betreiber.',
    heroIcon: 'quiz',
    heroTitle: 'Häufige Fragen zu MessageDrop.',
    heroText: 'Starte hier, wenn Du schnell verstehen möchtest, was MessageDrop ist, für wen es gedacht ist und wie Du es nutzen kannst.',
    showLegalCta: false,
    showPrimaryCta: false,
    heroAsideTitle: 'Allgemeine Fragen',
    heroAsideItems: [
      'Kurze Antworten für einen schnellen ersten Überblick.',
      'Es ist immer nur eine Antwort geöffnet, damit die Seite übersichtlich bleibt.',
      'Weitere Kategorien ergänzen wir später, wenn echte Nutzerfragen dazukommen.',
    ],
    faqTitle: 'Allgemein',
    faqIntro: 'Diese ersten Fragen erklären die Grundidee von MessageDrop.',
    faqs: [
      {
        slug: 'was-ist-messagedrop',
        question: 'Was ist MessageDrop?',
        answer: 'MessageDrop ist eine ortsbezogene Web-App. Du kannst öffentliche Nachrichten an realen Orten auf einer Karte hinterlassen, Orten folgen, die Dir wichtig sind, und private Inhalte sowie Kommunikationsfunktionen nutzen.',
      },
      {
        slug: 'wofuer-kann-ich-messagedrop-verwenden',
        question: 'Wofür kann ich MessageDrop verwenden?',
        answer: 'Du kannst MessageDrop nutzen, um Informationen mit Orten zu verbinden, aktuelle Nachrichten in Deiner Umgebung zu entdecken, private Notizen zu speichern, wichtigen Orten zu folgen und Dich mit Menschen zu verbinden, die Du bereits kennst.',
      },
      {
        slug: 'muss-ich-mich-registrieren',
        question: 'Muss ich mich registrieren, um MessageDrop zu nutzen?',
        answer: 'Du kannst MessageDrop auch ohne Nutzerkonto verwenden. Für einige Funktionen ist jedoch ein Nutzerkonto erforderlich.',
      },
      {
        slug: 'ist-messagedrop-kostenlos',
        question: 'Ist MessageDrop kostenlos?',
        answer: 'MessageDrop kann aktuell ohne Nutzungsgebühr verwendet werden. Kosten Deines Internetanbieters, Mobilfunkanbieters, Geräts oder externer Dienste werden nicht von MessageDrop gesteuert.',
      },
      {
        slug: 'wie-alt-muss-ich-sein',
        question: 'Wie alt muss ich sein, um MessageDrop zu nutzen?',
        answer: 'Du musst mindestens 16 Jahre alt sein, um MessageDrop zu nutzen. Wenn in Deinem Land zusätzliche rechtliche Anforderungen gelten, musst Du auch diese Anforderungen beachten.',
      },
      {
        slug: 'gibt-es-messagedrop-in-mehreren-sprachen',
        question: 'Gibt es MessageDrop in mehreren Sprachen?',
        answer: 'Ja. Die MessageDrop-App unterstützt Deutsch, Englisch, Französisch und Spanisch. Die öffentlichen Seiten und rechtlichen Informationen sind derzeit vor allem auf Deutsch und Englisch verfügbar.',
      },
      {
        slug: 'fuer-wen-ist-messagedrop-gedacht',
        question: 'Für wen ist MessageDrop gedacht?',
        answer: 'MessageDrop ist für Menschen gedacht, die Informationen mit Orten verbinden möchten: private Nutzer, Freunde, lokale Gemeinschaften, Reisende, Kreative und alle, die ortsbezogene Inhalte teilen oder merken wollen.',
      },
      {
        slug: 'brauche-ich-eine-app',
        question: 'Brauche ich eine App, um MessageDrop zu nutzen?',
        answer: 'Nein, Du musst keine separate App installieren. MessageDrop läuft im Browser und kann als Web-App geöffnet werden. Je nach Gerät und Browser kannst Du MessageDrop auch zum Startbildschirm hinzufügen.',
      },
      {
        slug: 'funktioniert-messagedrop-auf-smartphone-tablet-desktop',
        question: 'Funktioniert MessageDrop auf Smartphone, Tablet und Desktop?',
        answer: 'Ja. MessageDrop ist als responsive Web-App angelegt und kann auf Smartphones, Tablets und Desktop-Browsern genutzt werden. Einige Funktionen, zum Beispiel Standortzugriff, hängen von Deinem Gerät und Deinen Browser-Berechtigungen ab.',
      },
      {
        slug: 'wer-betreibt-messagedrop',
        question: 'Wer betreibt MessageDrop?',
        answer: 'MessageDrop wird von der JackTools.Net UG (haftungsbeschränkt) betrieben. Die aktuellen Anbieter- und Kontaktinformationen findest Du im Impressum.',
      },
      {
        slug: 'ist-messagedrop-ein-messenger',
        question: 'Ist MessageDrop ein Messenger?',
        answer: 'MessageDrop ist kein klassischer Messenger und kein klassischer Social Feed. Die Grundidee ist, Nachrichten und Informationen mit Orten zu verbinden. Private Kommunikation gibt es, aber die App ist um Orte herum aufgebaut und nicht um Followerzahlen oder algorithmische Feeds.',
      },
    ],
    additionalFaqCategories: [
      {
        title: 'Nutzung als Gast',
        intro: 'Diese Fragen erklären, was Du vor dem Anlegen eines Nutzerkontos oder vor einer Backend-Verbindung nutzen kannst.',
        items: [
          {
            slug: 'was-kann-ich-als-gast-sehen',
            question: 'Was kann ich als Gast sehen?',
            answer: 'Als Gast kannst Du die Karte erkunden, verfügbare öffentliche Nachrichten im gewählten Bereich sehen, Orte und Hashtags suchen und öffentliche Informationen rund um Orte öffnen.',
          },
          {
            slug: 'kann-ich-als-gast-oeffentliche-nachrichten-erstellen',
            question: 'Kann ich als Gast eigene öffentliche Nachrichten erstellen?',
            answer: 'Nein. Um öffentliche Nachrichten zu erstellen oder zu veröffentlichen, benötigst Du ein Nutzerkonto.',
          },
          {
            slug: 'kann-ich-als-gast-wetterinformationen-sehen',
            question: 'Kann ich als Gast Wetterinformationen sehen?',
            answer: 'Ja. Wetterinformationen können für Orte geöffnet werden, wenn die Funktion verfügbar ist und Dein Gerät eine Internetverbindung hat. Die angezeigten Daten hängen von externen Wetterdatenquellen ab.',
          },
          {
            slug: 'kann-ich-als-gast-luftqualitaet-sehen',
            question: 'Kann ich als Gast Informationen zur Luftqualität sehen?',
            answer: 'Ja. Informationen zur Luftqualität können für Orte geöffnet werden, wenn Daten verfügbar sind. Die Werte hängen von externen Datenquellen ab und dienen als Kontextinformation, nicht als verbindliche Sicherheitsempfehlung.',
          },
          {
            slug: 'kann-ich-als-gast-nach-orten-suchen',
            question: 'Kann ich als Gast nach Orten suchen?',
            answer: 'Ja. Als Gast kannst Du nach Orten suchen. Welche Ergebnisse angezeigt werden, hängt von Deiner Suche und den verfügbaren Daten ab.',
          },
          {
            slug: 'kann-ich-als-gast-erlebnisse-in-der-naehe-suchen',
            question: 'Kann ich als Gast Erlebnisse in der Nähe suchen?',
            answer: 'Ja. Du kannst als Gast nach Erlebnissen rund um einen Ort suchen, wenn die Erlebnis-Suche verfügbar ist. Ergebnisse können von externen Anbietern stammen und von Standort und Verfügbarkeit abhängen.',
          },
          {
            slug: 'kann-ich-als-gast-nach-hashtags-suchen',
            question: 'Kann ich als Gast nach Hashtags suchen?',
            answer: 'Ja. Die Hashtag-Suche hilft Dir, öffentliche Nachrichten zu einem Thema zu finden. Wie bei anderen öffentlichen Inhalten hängen die Ergebnisse von verfügbaren Nachrichten, Ortsbezug und Moderationsstatus ab.',
          },
          {
            slug: 'welche-funktionen-benoetigen-ein-nutzerkonto',
            question: 'Welche Funktionen benötigen ein Nutzerkonto?',
            answer: 'Funktionen, die Inhalte erstellen, veröffentlichen, synchronisieren oder privat verwalten, benötigen in der Regel eine Nutzeridentität oder Backend-Verbindung. Dazu gehören das Veröffentlichen öffentlicher Nachrichten, die Verwaltung eigener Inhalte, Kontakte und private Kommunikation.',
          },
          {
            slug: 'werden-als-gast-daten-auf-meinem-geraet-gespeichert',
            question: 'Werden als Gast Daten auf meinem Gerät gespeichert?',
            answer: 'Ja, einige Einstellungen und lokale Daten können auf Deinem Gerät gespeichert werden, damit die App gut funktioniert. MessageDrop ist darauf ausgelegt, möglichst viele Daten lokal auf Deinem Gerät zu halten.',
          },
          {
            slug: 'bleiben-meine-einstellungen-als-gast-erhalten',
            question: 'Bleiben meine Einstellungen als Gast erhalten?',
            answer: 'In der Regel ja, solange Dein Browser die lokalen App-Daten behält. Wenn Du Browserdaten löschst, im privaten Modus surfst oder das Gerät wechselst, können lokale Gast-Einstellungen verloren gehen.',
          },
          {
            slug: 'kann-ich-spaeter-vom-gastmodus-zu-einem-nutzerkonto-wechseln',
            question: 'Kann ich später vom Gastmodus zu einem Nutzerkonto wechseln?',
            answer: 'Ja. Du kannst als Gast starten und später eine Nutzeridentität erstellen oder verbinden, wenn Du Funktionen nutzen möchtest, die eine solche Identität benötigen. Lokale Daten hängen weiterhin vom zuvor verwendeten Gerät und Browser-Speicher ab.',
          },
          {
            slug: 'kann-ich-als-gast-externe-inhalte-oeffnen',
            question: 'Kann ich als Gast externe Inhalte wie YouTube, TikTok oder Pinterest öffnen?',
            answer: 'Ja, wenn externe Inhalte in Deinen Einstellungen aktiviert sind. Externe Anbieter sind eigenständige Dienste mit eigenen Nutzungsbedingungen, Datenschutzhinweisen, Cookies und möglichem Tracking.',
          },
        ],
      },
        {
                "title": "Nutzung mit Nutzerkonto · Nutzerkonto & Profil",
                "intro": "Fragen zu Nutzeridentität, PIN, Profil und der Nutzung auf mehreren Geräten.",
                "items": [
                        {
                                "slug": "was-aendert-sich-wenn-ich-ein-nutzerkonto-verwende",
                                "question": "Was ändert sich, wenn ich ein Nutzerkonto verwende?",
                                "answer": "Mit einem Nutzerkonto kannst Du eigene öffentliche Nachrichten erstellen und verwalten, private Inhalte nutzen, Orte pflegen, Kontakte verwenden und Funktionen nutzen, die eine stabile Nutzeridentität oder Backend-Verbindung benötigen."
                        },
                        {
                                "slug": "wie-erstelle-ich-ein-nutzerkonto",
                                "question": "Wie erstelle ich ein Nutzerkonto?",
                                "answer": "Du erstellst ein Nutzerkonto direkt in der App. MessageDrop führt Dich durch die nötigen Schritte, einschließlich PIN-Erstellung und Einrichtung Deiner lokalen Nutzeridentität."
                        },
                        {
                                "slug": "warum-brauche-ich-eine-pin",
                                "question": "Warum brauche ich eine PIN?",
                                "answer": "Die PIN schützt Deine lokale Nutzeridentität und sensible Aktionen auf Deinem Gerät. Sie ist Teil des Sicherheitskonzepts für private und kontobezogene Funktionen."
                        },
                        {
                                "slug": "was-passiert-wenn-ich-meine-pin-vergesse",
                                "question": "Was passiert, wenn ich meine PIN vergesse?",
                                "answer": "Wenn Du Deine PIN vergisst, kann der Zugriff auf lokal geschützte Daten eingeschränkt sein oder verloren gehen. Weil MessageDrop Daten möglichst lokal hält, sind Backups wichtig."
                        },
                        {
                                "slug": "welche-informationen-enthaelt-mein-profil",
                                "question": "Welche Informationen enthält mein Profil?",
                                "answer": "Dein Profil kann Informationen wie Anzeigenamen, Avatar und Profildetails enthalten. Sie helfen Dir, Dein Konto wiederzuerkennen, und können anderen Nutzern dort helfen, wo Profilinformationen verwendet werden."
                        },
                        {
                                "slug": "kann-ich-mein-profil-spaeter-aendern",
                                "question": "Kann ich mein Profil später ändern?",
                                "answer": "Ja. Du kannst Dein Profil später in der App aktualisieren. Änderungen können beeinflussen, wie Dein Profil an Stellen angezeigt wird, an denen Profilinformationen genutzt werden."
                        },
                        {
                                "slug": "ist-mein-profil-fuer-andere-sichtbar",
                                "question": "Ist mein Profil für andere sichtbar?",
                                "answer": "Einige Profilinformationen können in Verbindung mit öffentlichen Nachrichten oder Kontakten für andere Nutzer sichtbar sein. Lokale Profile, die Du für andere Nutzer anlegst, sind nur für Dein eigenes Gerät gedacht."
                        },
                        {
                                "slug": "kann-ich-messagedrop-auf-mehreren-geraeten-nutzen",
                                "question": "Kann ich MessageDrop auf mehreren Geräten nutzen?",
                                "answer": "Einige Funktionen können auf mehreren Geräten genutzt werden, wenn Backend-Verbindung und Synchronisierung verfügbar sind. Daten, die nur lokal auf einem Gerät liegen, erscheinen nicht automatisch auf einem anderen Gerät."
                        }
                ]
        },
        {
                "title": "Nutzung mit Nutzerkonto · Eigene öffentliche Nachrichten",
                "intro": "Fragen zum Erstellen, Bearbeiten, Löschen und Moderieren eigener öffentlicher Nachrichten.",
                "items": [
                        {
                                "slug": "kann-ich-eigene-oeffentliche-nachrichten-erstellen",
                                "question": "Kann ich eigene öffentliche Nachrichten erstellen?",
                                "answer": "Ja. Mit geeigneter Nutzeridentität und Backend-Verbindung kannst Du öffentliche Nachrichten erstellen und an realen Orten auf der Karte platzieren."
                        },
                        {
                                "slug": "wo-erscheinen-meine-oeffentlichen-nachrichten",
                                "question": "Wo erscheinen meine öffentlichen Nachrichten?",
                                "answer": "Öffentliche Nachrichten erscheinen an dem Ort, den Du auf der Karte auswählst. Andere Nutzer können sie abhängig von Standort, Sucheinstellungen, Verfügbarkeit und Moderationsstatus entdecken."
                        },
                        {
                                "slug": "kann-ich-meine-oeffentlichen-nachrichten-spaeter-bearbeiten",
                                "question": "Kann ich meine öffentlichen Nachrichten später bearbeiten?",
                                "answer": "Ja. Du kannst eigene öffentliche Nachrichten bearbeiten, wenn die App Dich als Eigentümer erkennt und die Nachricht noch bearbeitet werden kann."
                        },
                        {
                                "slug": "kann-ich-meine-oeffentlichen-nachrichten-loeschen",
                                "question": "Kann ich meine öffentlichen Nachrichten löschen?",
                                "answer": "Ja. Du kannst eigene öffentliche Nachrichten löschen. MessageDrop ist so ausgelegt, dass Löschen dort wirklich entfernt, wo das System die Daten kontrolliert."
                        },
                        {
                                "slug": "warum-kann-eine-oeffentliche-nachricht-moderiert-oder-entfernt-werden",
                                "question": "Warum kann eine öffentliche Nachricht moderiert oder entfernt werden?",
                                "answer": "Öffentliche Nachrichten können moderiert oder entfernt werden, wenn sie Regeln verletzen, rechtswidrige Inhalte enthalten, personenbezogene Daten offenlegen, gemeldet werden oder Sicherheits- und Rechtsanforderungen widersprechen."
                        },
                        {
                                "slug": "kann-ich-externe-inhalte-in-oeffentliche-nachrichten-einbinden",
                                "question": "Kann ich externe Inhalte in öffentliche Nachrichten einbinden?",
                                "answer": "Ja, soweit unterstützt. Du kannst Inhalte von unterstützten externen Plattformen verlinken oder einbinden. Externe Anbieter bleiben eigenständige Dienste mit eigenen Bedingungen und Datenschutzregeln."
                        },
                        {
                                "slug": "kann-ich-sehen-wie-andere-auf-meine-oeffentlichen-nachrichten-reagieren",
                                "question": "Kann ich sehen, wie andere auf meine öffentlichen Nachrichten reagieren?",
                                "answer": "MessageDrop kann Reaktionen oder Interaktionshinweise anzeigen, wenn solche Funktionen verfügbar sind. Diese Hinweise machen öffentliche Nachrichten aber nicht zu einem algorithmischen Popularitäts-Feed."
                        }
                ]
        },
        {
                "title": "Nutzung mit Nutzerkonto · Private Inhalte",
                "intro": "Fragen zu privaten Notizen, Bildern, Dokumenten und lokaler Speicherung.",
                "items": [
                        {
                                "slug": "was-sind-private-notizen",
                                "question": "Was sind private Notizen?",
                                "answer": "Private Notizen sind persönliche Notizen, die Du für Dich selbst erstellst. Sie sind für Deine eigene Nutzung gedacht und von öffentlichen Nachrichten auf der Karte getrennt."
                        },
                        {
                                "slug": "wer-kann-meine-privaten-notizen-sehen",
                                "question": "Wer kann meine privaten Notizen sehen?",
                                "answer": "Private Notizen sind dafür gedacht, nur für Dich sichtbar zu sein. Der Zugriff hängt dennoch von Gerätesicherheit, Browser-Speicher, Backups und Deinem Umgang mit dem Gerät ab."
                        },
                        {
                                "slug": "kann-ich-private-bilder-speichern",
                                "question": "Kann ich private Bilder speichern?",
                                "answer": "Ja. MessageDrop enthält Funktionen für private Bilder, damit Du bildbasierte Inhalte für Dich behalten kannst, statt sie öffentlich zu veröffentlichen."
                        },
                        {
                                "slug": "kann-ich-private-dokumente-speichern",
                                "question": "Kann ich private Dokumente speichern?",
                                "answer": "Ja. Du kannst private Dokumente speichern, wenn die Funktion verfügbar ist. Wie bei anderen privaten Inhalten solltest Du Backups erstellen, wenn die Daten wichtig sind."
                        },
                        {
                                "slug": "wo-werden-private-inhalte-gespeichert",
                                "question": "Wo werden private Inhalte gespeichert?",
                                "answer": "Private Inhalte sollen wann immer möglich lokal auf Deinem Gerät bleiben. Einige Funktionen können Backend-Unterstützung benötigen, aber Local-first-Speicherung ist ein wichtiger Teil von MessageDrop."
                        },
                        {
                                "slug": "kann-ich-private-inhalte-spaeter-loeschen",
                                "question": "Kann ich private Inhalte später löschen?",
                                "answer": "Ja. Du kannst private Inhalte löschen, die Du in der App verwaltest. Wenn Daten nur auf Deinem Gerät liegen, kann auch das Löschen oder Verlieren lokaler Speicherbereiche diese Daten entfernen."
                        },
                        {
                                "slug": "was-passiert-mit-privaten-inhalten-wenn-ich-das-geraet-wechsle",
                                "question": "Was passiert mit privaten Inhalten, wenn ich das Gerät wechsle?",
                                "answer": "Private Inhalte, die nur lokal gespeichert sind, wechseln nicht automatisch auf ein neues Gerät. Nutze verfügbare Backup- und Wiederherstellungsfunktionen, bevor Du Geräte wechselst oder Browserdaten löschst."
                        }
                ]
        },
        {
                "title": "Nutzung mit Nutzerkonto · Orte",
                "intro": "Fragen zum Erstellen, Bearbeiten, Folgen und Pflegen von Orten.",
                "items": [
                        {
                                "slug": "kann-ich-eigene-orte-erstellen",
                                "question": "Kann ich eigene Orte erstellen?",
                                "answer": "Ja. Mit den erforderlichen Nutzerfunktionen kannst Du Orte erstellen und Informationen mit realen Standorten verbinden."
                        },
                        {
                                "slug": "was-ist-ein-ort-in-messagedrop",
                                "question": "Was ist ein Ort in MessageDrop?",
                                "answer": "Ein Ort ist ein standortbezogener Eintrag auf der Karte. Dort kann Kontext wie Nachrichten, Kacheln, Wetter, Luftqualität, Erlebnisse und weitere nützliche Informationen rund um diesen Standort gesammelt werden."
                        },
                        {
                                "slug": "kann-ich-orte-bearbeiten",
                                "question": "Kann ich Orte bearbeiten?",
                                "answer": "Ja, wenn Du die nötigen Rechte oder die passende Zuständigkeit hast. Bearbeiten hilft dabei, Ortsinformationen nützlich und aktuell zu halten."
                        },
                        {
                                "slug": "kann-ich-orten-folgen",
                                "question": "Kann ich Orten folgen?",
                                "answer": "Ja. Orten zu folgen hilft Dir, Standorte im Blick zu behalten, die Dir wichtig sind, zum Beispiel Dein Zuhause, Dein Lieblingscafé, Dein Arbeitsplatz oder ein Reiseziel."
                        },
                        {
                                "slug": "was-passiert-wenn-an-einem-gefolgten-ort-neue-inhalte-erscheinen",
                                "question": "Was passiert, wenn an einem gefolgten Ort neue Inhalte erscheinen?",
                                "answer": "Wenn an einem gefolgten Ort neue relevante Inhalte erscheinen, kann MessageDrop sie in der App oder über verfügbare Benachrichtigungsfunktionen anzeigen, abhängig von Deinen Einstellungen und Berechtigungen."
                        },
                        {
                                "slug": "kann-ich-informationen-zu-einem-ort-ergaenzen",
                                "question": "Kann ich Informationen zu einem Ort ergänzen?",
                                "answer": "Ja. Du kannst Informationen rund um Orte ergänzen oder pflegen, wenn die Funktion verfügbar ist. Dadurch werden Orte für Dich und andere Nutzer nützlicher."
                        }
                ]
        },
        {
                "title": "Nutzung mit Nutzerkonto · Kontakte & private Kommunikation",
                "intro": "Fragen zum Verbinden mit Menschen und zum Austausch privater Nachrichten.",
                "items": [
                        {
                                "slug": "kann-ich-andere-nutzer-kontaktieren",
                                "question": "Kann ich andere Nutzer kontaktieren?",
                                "answer": "Ja. MessageDrop enthält Kontakt- und private Kommunikationsfunktionen für Nutzer, die sich miteinander verbinden."
                        },
                        {
                                "slug": "wie-verbinde-ich-mich-mit-anderen-nutzern",
                                "question": "Wie verbinde ich mich mit anderen Nutzern?",
                                "answer": "Am einfachsten verbindest Du Dich mit Menschen, die Du bereits kennst, zum Beispiel indem Ihr persönlich einen Connect-QR-Code scannt. Online-Verbindungen sind möglich, aber Du solltest wissen, mit wem Du Dich verbindest."
                        },
                        {
                                "slug": "warum-sollte-ich-kontakte-nur-mit-personen-erstellen-die-ich-kenne",
                                "question": "Warum sollte ich Kontakte nur mit Personen erstellen, die ich kenne?",
                                "answer": "Private Kommunikation funktioniert am besten, wenn Du die andere Person kennst und ihr vertraust. Verbindungen nur mit bekannten Personen reduzieren Missbrauch, Spam und Missverständnisse."
                        },
                        {
                                "slug": "sind-private-nachrichten-verschluesselt",
                                "question": "Sind private Nachrichten verschlüsselt?",
                                "answer": "Private Kommunikation ist so angelegt, dass sie verschlüsselt und signiert übertragen wird. Die kryptografischen Schlüssel werden auf Deinem Gerät erzeugt, und private Schlüssel sollen auf Deinem Gerät bleiben."
                        },
                        {
                                "slug": "kann-messagedrop-meine-privaten-nachrichten-lesen",
                                "question": "Kann MessageDrop meine privaten Nachrichten lesen?",
                                "answer": "MessageDrop ist so ausgelegt, dass private Kommunikation technisch geschützt ist. Inhalte privater Nachrichten sollen grundsätzlich nicht im Klartext von MessageDrop gelesen werden können."
                        },
                        {
                                "slug": "was-passiert-wenn-ich-einen-kontakt-loesche",
                                "question": "Was passiert, wenn ich einen Kontakt lösche?",
                                "answer": "Wenn Du einen Kontakt löschst, entfernst Du diese Verbindung aus Deinem App-Kontext. Je nach lokalem Speicher und Nachrichtenverlauf musst Du zugehörige lokale Daten eventuell zusätzlich verwalten."
                        }
                ]
        },
        {
                "title": "Nutzung mit Nutzerkonto · Daten, Backup & Sicherheit",
                "intro": "Fragen zu Backups, Synchronisierung, Geräteverlust und Kontolöschung.",
                "items": [
                        {
                                "slug": "warum-sollte-ich-ein-backup-erstellen",
                                "question": "Warum sollte ich ein Backup erstellen?",
                                "answer": "Backups sind wichtig, weil MessageDrop viele Daten möglichst lokal auf Deinem Gerät hält. Wenn Gerät oder Browserdaten verloren gehen, kann ein Backup die einzige Möglichkeit sein, wichtige Inhalte wiederherzustellen."
                        },
                        {
                                "slug": "welche-daten-werden-synchronisiert",
                                "question": "Welche Daten werden synchronisiert?",
                                "answer": "Daten, die Backend-Unterstützung brauchen, zum Beispiel veröffentlichte öffentliche Inhalte oder kontobezogene Serverdaten, können synchronisiert werden. Rein lokale private Daten bleiben möglicherweise nur auf Deinem Gerät, solange kein Backup oder Restore genutzt wird."
                        },
                        {
                                "slug": "welche-daten-bleiben-nur-auf-meinem-geraet",
                                "question": "Welche Daten bleiben nur auf meinem Gerät?",
                                "answer": "Lokale Einstellungen, private Inhalte, lokale Profile und andere gerätespezifische Daten können nur auf Deinem Gerät bleiben. Das genaue Verhalten hängt von der jeweiligen Funktion und Deinen App-Einstellungen ab."
                        },
                        {
                                "slug": "was-passiert-wenn-ich-mein-geraet-verliere",
                                "question": "Was passiert, wenn ich mein Gerät verliere?",
                                "answer": "Wenn Du Dein Gerät verlierst, können auch lokale Daten verloren gehen. Schütze Dein Gerät, bewahre Deine PIN sicher auf und erstelle Backups für Daten, die Dir wichtig sind."
                        },
                        {
                                "slug": "kann-ich-mein-nutzerkonto-loeschen",
                                "question": "Kann ich mein Nutzerkonto löschen?",
                                "answer": "Ja. Du kannst Dein Nutzerkonto löschen, wenn die App die Kontolöschfunktion bereitstellt. Vorher solltest Du verstehen, was mit lokalen und serverseitigen Daten passiert."
                        },
                        {
                                "slug": "was-passiert-mit-meinen-daten-wenn-ich-mein-nutzerkonto-loesche",
                                "question": "Was passiert mit meinen Daten, wenn ich mein Nutzerkonto lösche?",
                                "answer": "Beim Löschen Deines Kontos werden kontobezogene Daten nach den App-Regeln und gesetzlichen Anforderungen entfernt. Manche lokalen Daten auf Deinem Gerät musst Du eventuell zusätzlich durch Löschen von App- oder Browser-Speicher entfernen."
                        }
                ]
        }
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

const appClaimByLocale = {
  de: 'Eine globale Karte, auf der Menschen Nachrichten an realen Orten hinterlassen können.',
  en: appClaim,
};

const uiByLocale = {
  de: {
    navWhat: 'Was ist MessageDrop?',
    navHow: 'So funktioniert MessageDrop',
    navLegal: 'Rechtliches',
    navFaq: 'FAQ',
    openApp: 'MessageDrop App öffnen',
    brandHome: 'MessageDrop-App öffnen',
    primaryNav: 'Hauptnavigation',
    legalPages: 'Rechtsseiten',
    footerWhat: 'Was ist MessageDrop?',
    footerHow: 'So funktioniert MessageDrop',
    footerLegal: 'Rechtliches',
    footerFaq: 'FAQ',
    footerCreditPrefix: 'Für Dich mit',
    footerCreditAnd: 'und',
    footerCreditSuffix: 'entwickelt von',
    redirectTitle: 'Sprache wird gewählt',
    redirectText: 'Mit JavaScript wird automatisch die passende Sprachversion geöffnet. Ohne JavaScript kannst Du die gewünschte Version hier direkt auswählen.',
    openGerman: 'Deutsch öffnen',
    openEnglish: 'Englisch öffnen',
    openAppLegal: 'App öffnen',
  },
  en: {
    navWhat: 'What is MessageDrop?',
    navHow: 'How MessageDrop works',
    navLegal: 'Legal',
    navFaq: 'FAQ',
    openApp: 'Open MessageDrop app',
    brandHome: 'Open MessageDrop app',
    primaryNav: 'Primary navigation',
    legalPages: 'Legal pages',
    footerWhat: 'What is MessageDrop?',
    footerHow: 'How MessageDrop works',
    footerLegal: 'Legal',
    footerFaq: 'FAQ',
    footerCreditPrefix: 'Built for you with',
    footerCreditAnd: 'and',
    footerCreditSuffix: 'by',
    redirectTitle: 'Choosing language',
    redirectText: 'With JavaScript enabled, the matching language version opens automatically. Without JavaScript, you can choose the version directly below.',
    openGerman: 'Open German',
    openEnglish: 'Open English',
    openAppLegal: 'Open app',
  },
};

const allEnglishMarketingPages = [...marketingPages, ...faqPages];
const allGermanMarketingPages = [...germanMarketingPages, ...germanFaqPages];
const englishMarketingByKey = new Map(allEnglishMarketingPages.map((page) => [page.pageKey, page]));
const germanMarketingByKey = new Map(allGermanMarketingPages.map((page) => [page.pageKey, page]));

const localizedMarketingPages = supportedLocales.flatMap((locale) => {
  const sourcePages = locale === 'de' ? allGermanMarketingPages : allEnglishMarketingPages;
  return sourcePages.map((page) => ({
    ...page,
    locale,
    baseRoute: page.route,
    route: localeRoute(locale, page.route),
  }));
});

const localizedLegalPages = [];

function getLocalizedMarketingRoute(locale, pageKey) {
  const page = locale === 'de'
    ? germanMarketingByKey.get(pageKey)
    : englishMarketingByKey.get(pageKey);

  return page ? localeRoute(locale, page.route) : '/';
}

const redirectPages = [
  {
    route: '/',
    pageKey: 'what-is-messagedrop',
    englishTitle: appName,
    germanTitle: appName,
    deHref: getLocalizedMarketingRoute('de', 'what-is-messagedrop'),
    enHref: getLocalizedMarketingRoute('en', 'what-is-messagedrop'),
  },
  ...allEnglishMarketingPages.map((page) => ({
    route: page.route,
    pageKey: page.pageKey,
    englishTitle: page.title,
    germanTitle: germanMarketingByKey.get(page.pageKey)?.title ?? page.title,
    deHref: getLocalizedMarketingRoute('de', page.pageKey),
    enHref: getLocalizedMarketingRoute('en', page.pageKey),
  })),
];

const legacyGermanRedirectPages = allEnglishMarketingPages
  .map((page) => ({
    route: localeRoute('de', page.route),
    target: getLocalizedMarketingRoute('de', page.pageKey),
    title: germanMarketingByKey.get(page.pageKey)?.title ?? page.title,
  }))
  .filter((page) => normalizeRoute(page.route) !== normalizeRoute(page.target));

const englishBaseRoutes = new Set(allEnglishMarketingPages.map((page) => normalizeRoute(page.route)));
const germanAliasRedirectPages = allGermanMarketingPages
  .map((page) => ({
    route: page.route,
    target: getLocalizedMarketingRoute('de', page.pageKey),
    title: page.title,
  }))
  .filter((page) => !englishBaseRoutes.has(normalizeRoute(page.route)));

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

function getPageFaqs(page) {
  return [
    ...(page.faqs ?? []),
    ...((page.additionalFaqCategories ?? []).flatMap((category) => category.items ?? [])),
  ];
}

function faqSchema(page) {
  const faqs = getPageFaqs(page);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function alternateLinks(pageKey) {
  return [
    { hreflang: 'de', href: canonicalUrl(getLocalizedMarketingRoute('de', pageKey)) },
    { hreflang: 'en', href: canonicalUrl(getLocalizedMarketingRoute('en', pageKey)) },
    { hreflang: 'x-default', href: canonicalUrl(englishMarketingByKey.get(pageKey)?.route ?? '/') },
  ];
}

function renderNav(currentRoute, lang = 'en') {
  const ui = uiByLocale[lang] ?? uiByLocale.en;
  const navItems = [
    { href: getLocalizedMarketingRoute(lang, 'what-is-messagedrop'), label: ui.navWhat },
    { href: getLocalizedMarketingRoute(lang, 'how-it-works'), label: ui.navHow },
    { href: getLocalizedMarketingRoute(lang, 'legal'), label: ui.navLegal },
    { href: getLocalizedMarketingRoute(lang, 'faq'), label: ui.navFaq },
  ];

  return navItems
    .map((item) => {
      const current = trimTrailingSlash(normalizeRoute(currentRoute));
      const itemPath = trimTrailingSlash(normalizeRoute(item.href));
      const isActive = current === itemPath;
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
      <a class="brand" href="${appBaseUrl}/" aria-label="${escapeHtml(ui.brandHome)}">
        <span class="brand-avatar">
          <img src="/icons/icon-192x192.png" alt="MessageDrop logo" width="64" height="64">
        </span>
        <span class="brand-copy">
          <span class="button button-primary button-small brand-cta">${escapeHtml(ui.openApp)}</span>
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
    </header>
  `;
}

function renderFooter(lang = 'en') {
  const ui = uiByLocale[lang] ?? uiByLocale.en;
  const links = [
    { href: getLocalizedMarketingRoute(lang, 'what-is-messagedrop'), label: ui.footerWhat },
    { href: getLocalizedMarketingRoute(lang, 'how-it-works'), label: ui.footerHow },
    { href: getLocalizedMarketingRoute(lang, 'legal'), label: ui.footerLegal },
    { href: getLocalizedMarketingRoute(lang, 'faq'), label: ui.footerFaq },
  ];

  return `
    <footer class="site-footer">
      <div class="footer-links">
        ${links.map((link) => `<a href="${link.href}">${escapeHtml(link.label)}</a>`).join('')}
      </div>
      <p class="footer-credit">
        ${escapeHtml(ui.footerCreditPrefix)}
        <span class="footer-icon footer-icon--love" aria-hidden="true">
          <span class="material-symbols-outlined">favorite</span>
        </span>
        <span class="footer-icon footer-icon--coffee" aria-hidden="true">
          <span class="material-symbols-outlined">local_cafe</span>
        </span>
        ${escapeHtml(ui.footerCreditAnd)}
        <span class="footer-icon footer-icon--chocolate" aria-hidden="true">🍫</span>
        ${escapeHtml(ui.footerCreditSuffix)}
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
        ${page.eyebrow ? `<span class="eyebrow">${page.eyebrowIcon ? `<span class="material-symbols-outlined eyebrow-icon" aria-hidden="true">${escapeHtml(page.eyebrowIcon)}</span>` : ''}${escapeHtml(page.eyebrow)}</span>` : ''}
        <h1 class="${titleClass.trim()}">${escapeHtml(page.heroTitle)}</h1>
        ${page.heroText ? `<p class="hero-text">${escapeHtml(page.heroText)}</p>` : ''}
        ${(showPrimaryCta || showLegalCta)
          ? `<div class="cta-row">
              ${showPrimaryCta ? `<a class="button button-primary" href="${appBaseUrl}/">${escapeHtml(ui.openApp)}</a>` : ''}
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
            ${tile.href
              ? `<div class="tile-actions">
                  <a class="button button-secondary button-small${tile.ctaIcon ? ' tile-cta-icon-button' : ''}" href="${escapeHtml(tile.href)}"${tile.external ? ' target="_blank" rel="noreferrer noopener"' : ''}>${tile.ctaIcon ? `<span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(tile.ctaIcon)}</span>` : ''}${escapeHtml(tile.ctaLabel ?? 'Learn more')}</a>
                </div>`
              : ''}
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
        .map((video) => {
          const videoTitle = escapeHtml(video.embedTitle ?? video.title);
          const videoThumb = video.youtubeId
            ? `<div class="video-embed">
              <iframe
                src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtubeId)}"
                title="${videoTitle}"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              ></iframe>
            </div>`
            : `<div class="video-thumb" aria-hidden="true">
              <span class="material-symbols-outlined">${escapeHtml(video.icon)}</span>
            </div>`;
          const videoCta = video.videoUrl
            ? `<a class="video-cta" href="${escapeHtml(video.videoUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(video.ctaLabel)}</a>`
            : `<span class="video-cta">${escapeHtml(video.ctaLabel)}</span>`;

          return `
          <article class="video-card">
            ${videoThumb}
            <div class="video-card-body">
              <h3>${escapeHtml(video.title)}</h3>
              <p>${escapeHtml(video.body)}</p>
            </div>
            <div class="video-card-footer">
              ${videoCta}
            </div>
          </article>
        `;
        })
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
    <section class="content-section${section.className ? ` ${escapeHtml(section.className)}` : ''}">
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

  if (page.faqs || page.additionalFaqCategories?.length) {
    const faqSections = [
      ...(page.faqs
        ? [{
            title: page.faqTitle ?? (isGerman ? 'Häufige Fragen' : 'Frequently asked questions'),
            intro: page.faqIntro ?? (isGerman ? 'Jede Antwort ist bewusst in Klartext formuliert, damit sie leicht indexiert und zitiert werden kann.' : 'Each answer is written in clear text so it can be indexed and cited easily.'),
            items: page.faqs,
          }]
        : []),
      ...(page.additionalFaqCategories ?? []),
    ];
    let faqIndex = 0;
    body.push(...faqSections.map((section) => `
      <section class="content-section">
        <div class="section-heading">
          <h2>${escapeHtml(section.title)}</h2>
          ${section.intro ? `<p>${escapeHtml(section.intro)}</p>` : ''}
        </div>
        <div class="faq-list">
          ${(section.items ?? [])
            .map((item) => {
              const currentIndex = faqIndex++;
              return `
              <details class="faq-item" name="faq-${escapeHtml(page.pageKey ?? page.slug ?? page.lang)}" id="${escapeHtml(item.slug ?? `faq-${currentIndex + 1}`)}"${currentIndex === 0 ? ' open' : ''}>
                <summary>${escapeHtml(item.question)}</summary>
                <div class="faq-answer"><p>${escapeHtml(item.answer)}</p></div>
              </details>
            `;
            })
            .join('')}
        </div>
      </section>
    `));
  }

  if (page.legalHubTitle || page.legalHubIntro || page.heroAsideActions?.length) {
    body.push(renderLegalHubSection(page));
  }

  body.push('</main>');

  const extraSchemas = [organizationSchema(page.lang)];
  if (getPageFaqs(page).length) {
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
    alternateLinkTags: alternateLinks(page.pageKey),
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
            ${page.eyebrow ? `<span class="eyebrow">${escapeHtml(page.eyebrow)}</span>` : ''}
            <h1>${escapeHtml(page.heroTitle)}</h1>
            ${page.heroText ? `<p class="hero-text">${escapeHtml(page.heroText)}</p>` : ''}
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

  header.querySelectorAll('.site-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('menu-open');
      sync();
    });
  });

  sync();
});

const faqItems = Array.from(document.querySelectorAll('details.faq-item'));
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) {
      return;
    }
    faqItems.forEach((other) => {
      if (other !== item && other.getAttribute('name') === item.getAttribute('name')) {
        other.open = false;
      }
    });
  });
});\n`;
}

function renderLanguageRedirectPage(page) {
  const deHref = page.deHref ?? localeRoute('de', page.route);
  const enHref = page.enHref ?? localeRoute('en', page.route);
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
  ${alternateLinks(page.pageKey).map((link) => `<link rel="alternate" hreflang="${link.hreflang}" href="${link.href}">`).join('\n  ')}
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

function renderLegacyRedirectPage(page) {
  const target = normalizeRoute(page.target);
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(`${appName} | ${page.title}`)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex,follow">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl(target))}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <script>
    window.location.replace('${escapeHtml(target)}' + window.location.search + window.location.hash);
  </script>
</head>
<body></body>
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
  font-size: 1.15rem;
}

.site-nav {
  display: none;
  order: 3;
  width: 100%;
}

.site-header.menu-open .site-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0.45rem;
}

.brand-cta {
  width: max-content;
  min-height: 2.25rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.9rem;
  pointer-events: none;
}

.site-menu-toggle {
  display: inline-grid;
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
  font-size: clamp(1.55rem, 2.6vw, 2.35rem);
  line-height: 1.08;
  max-width: 22ch;
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
  align-items: center;
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

.tile-actions {
  margin-top: 0.15rem;
}

.tile-actions .button {
  width: 100%;
  justify-content: center;
}

.tile-cta-icon-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.tile-cta-icon-button .material-symbols-outlined {
  font-size: 1.1rem;
  line-height: 1;
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
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

.audience-section .card-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
}

.audience-section .info-card {
  justify-items: center;
  text-align: center;
}

.audience-section .tile-header {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.audience-section .tile-header .icon-badge {
  width: 4rem;
  height: 4rem;
}

.audience-section .tile-header h3 {
  line-height: 1.25;
}

.audience-section .info-card p {
  max-width: 28ch;
}

.support-section .tile-grid {
  grid-template-columns: minmax(0, 1fr);
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

.video-embed {
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 10rem;
  overflow: hidden;
  border-radius: var(--site-radius-md);
  border: 1px solid var(--site-outline);
  background: #000;
}

.video-embed iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
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
  text-decoration: none;
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

.footer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.footer-icon .material-symbols-outlined {
  font-size: 1.05rem;
  line-height: 1;
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}

.footer-icon--love {
  color: #ef4444;
}

.footer-icon--coffee {
  color: #8b5e3c;
}

.footer-icon--chocolate {
  font-size: 1rem;
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
    margin-left: auto;
  }

  .button-small {
    width: 100%;
  }

  .brand-cta {
    width: max-content;
  }

  .brand {
    align-items: center;
    flex: 1 1 auto;
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

@media print {
  @page {
    margin: 12mm;
  }

  html,
  body {
    min-height: auto;
    background: #fff !important;
  }

  body {
    color: #111827;
  }

  .page-shell {
    width: auto;
    max-width: none;
    margin: 0;
    padding: 0;
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
  .video-card {
    box-shadow: none !important;
    backdrop-filter: none !important;
    background: #fff !important;
    border: 1px solid #d1d5db !important;
  }

  .site-nav,
  .brand-cta,
  .site-menu-toggle,
  .cta-row,
  .tile-actions,
  .video-card-footer,
  .hero-panel-actions,
  .hero-panel-language,
  .footer-links {
    display: none !important;
  }

  .site-main,
  .hero,
  .hero-copy,
  .hero-panel,
  .tile-grid,
  .card-grid,
  .video-grid,
  .legal-stack {
    display: block !important;
  }

  .site-header,
  .hero,
  .content-section,
  .site-footer,
  .tile,
  .info-card,
  .video-card,
  .timeline-item,
  .translation-card,
  .legal-card,
  .faq-item {
    margin-bottom: 0.75rem;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .site-header {
    margin-bottom: 0.75rem;
  }

  .hero h1,
  .content-section h2 {
    max-width: none;
  }

  .tile-grid,
  .card-grid,
  .video-grid {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 0.5rem !important;
  }

  .tile,
  .info-card,
  .video-card {
    padding: 0.75rem !important;
  }

  .video-card {
    min-height: 0 !important;
    height: auto !important;
    grid-template-rows: none !important;
    break-inside: auto;
    page-break-inside: auto;
  }

  .video-thumb,
  .video-embed {
    display: none !important;
  }

  .video-card-body {
    display: block !important;
  }

  .video-card-body h3 {
    margin-bottom: 0.35rem !important;
  }

  .brand-avatar,
  .icon-badge,
  .translation-card summary::before {
    box-shadow: none !important;
  }

  a,
  a:visited {
    color: inherit;
    text-decoration: none;
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

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(source, destination) {
  if (!(await pathExists(source))) {
    return;
  }

  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await ensureDir(destination);
    const entries = await fs.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      await copyRecursive(path.join(source, entry.name), path.join(destination, entry.name));
    }
    return;
  }

  await ensureDir(path.dirname(destination));
  await fs.copyFile(source, destination);
}

async function copyStaticAssets() {
  await copyRecursive(path.join(frontendPublicRoot, 'favicon.ico'), path.join(publicRoot, 'favicon.ico'));
  await copyRecursive(path.join(frontendPublicRoot, 'icons'), path.join(publicRoot, 'icons'));
  await copyRecursive(path.join(frontendAssetsRoot, 'legal'), path.join(publicRoot, 'assets', 'legal'));
  await copyRecursive(path.join(frontendAssetsRoot, 'fonts'), path.join(publicRoot, 'assets', 'fonts'));
}

async function writeStaticFiles() {
  await ensureDir(publicRoot);
  await copyStaticAssets();
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

  for (const page of legacyGermanRedirectPages) {
    await writeRoute(page.route, renderLegacyRedirectPage(page));
  }

  for (const page of germanAliasRedirectPages) {
    await writeRoute(page.route, renderLegacyRedirectPage(page));
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
