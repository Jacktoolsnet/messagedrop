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

        await deliverToClientOrSave(sharedContent, type);
        return caches.match('/index.html') || fetch('/index.html');
    } catch (err) {
        console.error('[ServiceWorker] Failed to handle share-target POST:', err);
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

        await deliverToClientOrSave(sharedContent, type);
        return caches.match('/index.html') || fetch('/index.html');
    } catch (err) {
        console.error('[ServiceWorker] Failed to handle share-target GET:', err);
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
    const patterns = {
        multimedia: [
            /youtube\.com/,
            /youtu\.be/,
            /spotify\.com/,
            /pinterest\.com/,
            /tiktok\.com/
        ],
        location: [
            /google\.[^\/]+\/maps/
        ]
    };
    for (const type in patterns) {
        if (patterns[type].some((regex) => regex.test(url))) return type;
    }
    return 'unknown';
}

async function deliverToClientOrSave(content, type) {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clientList.length > 0) {
        for (const client of clientList) {
            client.postMessage({ type: 'shared', content });
        }
    } else {
        await saveSharedContentToDB(content, type);
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