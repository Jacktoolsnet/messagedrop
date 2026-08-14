const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseWebsiteMetadata,
  parseRetryAfter,
  validateWebsiteUrl,
  isPublicIp
} = require('../website-metadata');

test('extracts only metadata represented in the HTML head', () => {
  const metadata = parseWebsiteMetadata(`<!doctype html>
    <html lang="de"><head>
      <title>Fallback &amp; title</title>
      <meta name="description" content="A simple description">
      <meta property="og:title" content="ParkHotel Altes Kaffeehaus">
      <meta property="og:image" content="/images/hotel.jpg">
      <meta property="og:site_name" content="ParkHotel">
      <meta name="twitter:card" content="summary_large_image">
      <link rel="canonical" href="/">
      <link rel="icon" href="/favicon.ico">
      <script type="application/ld+json">{"@type":"Hotel","name":"ParkHotel"}</script>
    </head><body><p>This must not become the description.</p></body></html>`,
  'https://hotel.example/start');

  assert.deepEqual(metadata, {
    url: 'https://hotel.example/start',
    canonicalUrl: 'https://hotel.example/',
    language: 'de',
    title: 'ParkHotel Altes Kaffeehaus',
    description: 'A simple description',
    image: 'https://hotel.example/images/hotel.jpg',
    favicon: 'https://hotel.example/favicon.ico',
    siteName: 'ParkHotel',
    openGraph: {
      title: 'ParkHotel Altes Kaffeehaus',
      image: '/images/hotel.jpg',
      site_name: 'ParkHotel'
    },
    twitterCard: { card: 'summary_large_image' },
    structuredData: [{ '@type': 'Hotel', name: 'ParkHotel' }]
  });
});

test('parses Retry-After seconds and HTTP dates', () => {
  const now = Date.parse('2026-08-14T08:00:00Z');
  assert.equal(parseRetryAfter('120', now), 120000);
  assert.equal(parseRetryAfter('Fri, 14 Aug 2026 08:05:00 GMT', now), 300000);
  assert.equal(parseRetryAfter('invalid', now), null);
});

test('does not invent a description when the head has none', () => {
  const metadata = parseWebsiteMetadata(
    '<html><head><title>Hotel</title></head><body>A body description</body></html>',
    'https://hotel.example/'
  );
  assert.equal(metadata.title, 'Hotel');
  assert.equal(metadata.description, undefined);
});

test('website URLs are restricted to public HTTPS targets', () => {
  assert.equal(validateWebsiteUrl('https://example.com/path#part').toString(), 'https://example.com/path');
  for (const value of [
    'http://example.com',
    'https://localhost/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://user:password@example.com/',
    'https://example.com:8443/'
  ]) {
    assert.throws(() => validateWebsiteUrl(value));
  }
  assert.equal(isPublicIp('93.184.216.34'), true);
  assert.equal(isPublicIp('10.0.0.1'), false);
  assert.equal(isPublicIp('169.254.169.254'), false);
  assert.equal(isPublicIp('::1'), false);
  assert.equal(isPublicIp('::ffff:127.0.0.1'), false);
});
