self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname === '/share-target') {
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }
        event.respondWith(handleShareTargetPost(event));
        return;
    }

    if (event.request.method === 'GET' && url.pathname === '/share-target' &&
        (url.searchParams.has('text') || url.searchParams.has('title') || url.searchParams.has('url'))) {
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }
        event.respondWith(handleShareTargetGet(url));
        return;
    }
});

self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'SHOW_NOTIFICATION') return;

    const payload = data.payload || {};
    const title = payload.title || 'Notification';
    const body = payload.body || '';
    const url = payload.url || '/';
    const tag = payload.tag || 'generic';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/icons/notify-icon.png',
            badge: '/icons/icon-72x72.png',
            data: { url, source: 'messagedrop-custom' },
            tag,
            renotify: true,
            vibrate: [80, 40, 80]
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    const source = event.notification.data?.source;
    if (source !== 'messagedrop-custom') {
        return;
    }
    if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
    }
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.openWindow(url)
    );
});

function toTextValue(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (value == null) {
        return '';
    }
    if (typeof value === 'object' && 'name' in value) {
        return '';
    }
    return String(value);
}

async function handleShareTargetPost(event) {
    try {
        const formData = await event.request.formData();
        let title = toTextValue(formData.get('title')).trim();
        let text = toTextValue(formData.get('text')).trim();
        let url = toTextValue(formData.get('url')).trim();

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
        return Response.redirect('/', 303);
    } catch (err) {
        return new Response('Error processing POST share target', { status: 500 });
    }
}

async function handleShareTargetGet(urlObj) {
    try {
        let title = toTextValue(urlObj.searchParams.get('title')).trim();
        let text = toTextValue(urlObj.searchParams.get('text')).trim();
        let url = toTextValue(urlObj.searchParams.get('url')).trim();

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
        return Response.redirect('/', 302);
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
    await notifyClients(content);

    try {
        const bc = new BroadcastChannel('shared-content');
        bc.postMessage({ type: 'shared', content });
        bc.close();
    } catch {
        // BroadcastChannel not available in all environments
    }
}

async function notifyClients(content) {
    if (!self.clients?.matchAll) return;
    try {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
            client.postMessage({ type: 'shared', content });
        }
    } catch {
        // Ignore notification failures
    }
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

importScripts('./ngsw-worker.js');
