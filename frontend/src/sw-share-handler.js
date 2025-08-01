self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith(handleShareTargetPost(event));
        return;
    }

    if (event.request.method === 'GET' && url.pathname === '/share-target' &&
        (url.searchParams.has('text') || url.searchParams.has('title') || url.searchParams.has('url'))) {
        event.respondWith(handleShareTargetGet(url));
        return;
    }
});

async function handleShareTargetPost(event) {
    try {
        const formData = await event.request.formData();
        let title = formData.get('title') || '';
        let text = formData.get('text') || '';
        let url = formData.get('url');

        if (!url && text) url = extractUrlFromText(text);

        const type = detectContentType(url);
        const sharedContent = {
            id: 'last',
            title,
            text,
            url,
            timestamp: new Date().toISOString(),
            method: 'POST',
            type
        };

        await deliverToClientAndSave(sharedContent, type);
        return caches.match('/index.html') || fetch('/index.html');
    } catch (err) {
        return new Response('Error processing POST share target', { status: 500 });
    }
}

async function handleShareTargetGet(urlObj) {
    try {
        let title = urlObj.searchParams.get('title') || '';
        let text = urlObj.searchParams.get('text') || '';
        let url = urlObj.searchParams.get('url');

        if (!url && text) url = extractUrlFromText(text);

        const type = detectContentType(url);
        const sharedContent = {
            id: 'last',
            title,
            text,
            url,
            timestamp: new Date().toISOString(),
            method: 'GET',
            type
        };

        await deliverToClientAndSave(sharedContent, type);
        return caches.match('/index.html') || fetch('/index.html');
    } catch (err) {
        return new Response('Error processing GET share target', { status: 500 });
    }
}

function extractUrlFromText(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
}

function detectContentType(url) {
    if (!url) return 'unknown';

    const lowerUrl = url.toLowerCase();

    const multimediaPatterns = [
        // YouTube
        /youtube\.com\/watch/,
        /youtube\.com\/shorts/,
        /youtube\.com\/embed/,
        /youtu\.be\//,

        // Spotify
        /open\.spotify\.com\/(track|album|artist|playlist)/,
        /spotify\.com\/.+/,

        // Pinterest
        /pinterest\.com\/pin\//,
        /pin\.it/, // Shortlink

        // TikTok
        /tiktok\.com\/@.*\/video\//,
        /tiktok\.com\/t\//,
        /vm\.tiktok\.com\//
    ];

    const locationPatterns = [
        /google\.[^\/]+\/maps/,
        /maps\.app\.goo\.gl/,
        /goo\.gl\/maps/
    ];

    for (const pattern of multimediaPatterns) {
        if (pattern.test(lowerUrl)) {
            return 'multimedia';
        }
    }

    for (const pattern of locationPatterns) {
        if (pattern.test(lowerUrl)) {
            return 'location';
        }
    }

    return 'unknown';
}

async function deliverToClientAndSave(content, type) {
    await saveSharedContentToDB(content, type);

    const bc = new BroadcastChannel('shared-content');
    bc.postMessage({ type: 'shared', content });
    bc.close();
}

function saveSharedContentToDB(data, type) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ShareTargets', 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('shared')) {
                db.createObjectStore('shared', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('shared', 'readwrite');
            const store = tx.objectStore('shared');
            store.put({ ...data, id: 'last' });
            if (type && (type === 'multimedia' || type === 'location')) {
                store.put({ ...data, id: `last${capitalize(type)}` });
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}