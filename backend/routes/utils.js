const express = require('express');
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const router = express.Router();
const security = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { getVapidKeys } = require('../utils/keyStore');

const OEMBED_PROVIDERS = [
    {
        name: 'youtube',
        providerUrl: 'https://www.youtube.com/oembed',
        allowedHosts: ['youtube.com', 'youtu.be']
    },
    {
        name: 'spotify',
        providerUrl: 'https://open.spotify.com/oembed',
        allowedHosts: ['open.spotify.com', 'spotify.com', 'spotify.link', 'spotify.app.link', 'spoti.fi']
    },
    {
        name: 'pinterest',
        providerUrl: 'https://www.pinterest.com/oembed.json',
        allowedHosts: ['pinterest.com', 'pin.it']
    },
    {
        name: 'tiktok',
        providerUrl: 'https://www.tiktok.com/oembed',
        allowedHosts: ['tiktok.com', 'vm.tiktok.com']
    }
];

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

const RESOLVE_REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.RESOLVE_REQUEST_TIMEOUT_MS, 10000);
const RESOLVE_DNS_TIMEOUT_MS = parsePositiveInt(process.env.RESOLVE_DNS_TIMEOUT_MS, 5000);

function withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
}

function createResolveRequestConfig() {
    const config = {
        maxRedirects: 0,
        validateStatus: null,
        timeout: RESOLVE_REQUEST_TIMEOUT_MS,
        maxContentLength: 64 * 1024,
        responseType: 'text'
    };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        config.signal = AbortSignal.timeout(RESOLVE_REQUEST_TIMEOUT_MS + 250);
    }
    return config;
}

function isAllowedHost(host, allowedHosts) {
    if (!host) return false;
    const normalized = host.toLowerCase();
    return allowedHosts.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

function parseUrl(value) {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}

function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function getQueryParam(value) {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }
    return typeof value === 'string' ? value : '';
}

function normalizeHostname(hostname) {
    return String(hostname || '').trim().replace(/\.$/, '').toLowerCase();
}

function isPrivateOrReservedIpv4(ip) {
    const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
}

function isPrivateOrReservedIpv6(ip) {
    const normalized = ip.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
        return true; // link-local fe80::/10
    }
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
        return isPrivateOrReservedIpv4(mapped[1]);
    }
    return false;
}

function isPrivateOrReservedIp(ip) {
    const family = net.isIP(ip);
    if (family === 4) return isPrivateOrReservedIpv4(ip);
    if (family === 6) return isPrivateOrReservedIpv6(ip);
    return true;
}

function hasAllowedResolvePort(parsedTarget) {
    if (!parsedTarget.port) {
        return true;
    }
    const port = Number.parseInt(parsedTarget.port, 10);
    if (!Number.isFinite(port)) {
        return false;
    }
    if (parsedTarget.protocol === 'https:') {
        return port === 443;
    }
    if (parsedTarget.protocol === 'http:') {
        return port === 80;
    }
    return false;
}

async function isPublicResolveTarget(hostname) {
    const normalizedHost = normalizeHostname(hostname);
    if (!normalizedHost) {
        return false;
    }
    if (
        normalizedHost === 'localhost'
        || normalizedHost.endsWith('.localhost')
        || normalizedHost.endsWith('.local')
        || normalizedHost.endsWith('.internal')
        || normalizedHost.endsWith('.home')
        || normalizedHost.endsWith('.lan')
    ) {
        return false;
    }

    if (net.isIP(normalizedHost)) {
        return !isPrivateOrReservedIp(normalizedHost);
    }

    let addresses;
    try {
        addresses = await withTimeout(
            dns.lookup(normalizedHost, { all: true, verbatim: true }),
            RESOLVE_DNS_TIMEOUT_MS
        );
    } catch {
        return false;
    }
    if (!Array.isArray(addresses) || addresses.length === 0) {
        return false;
    }
    return addresses.every((entry) => entry?.address && !isPrivateOrReservedIp(entry.address));
}

async function resolveAllowedRedirectTarget(initialUrl, allowedHosts, maxRedirects = 4) {
    let currentUrl = initialUrl;
    for (let i = 0; i < maxRedirects; i++) {
        let axiosResponse;
        try {
            axiosResponse = await axios.get(currentUrl, createResolveRequestConfig());
        } catch {
            break;
        }

        if (!(axiosResponse.status >= 300 && axiosResponse.status < 400) || typeof axiosResponse.headers.location !== 'string') {
            break;
        }

        let nextUrl;
        try {
            nextUrl = new URL(axiosResponse.headers.location, currentUrl).toString();
        } catch {
            break;
        }
        const parsedNextUrl = parseUrl(nextUrl);
        if (!parsedNextUrl || !/^https?:$/i.test(parsedNextUrl.protocol)) {
            break;
        }
        if (!isAllowedHost(parsedNextUrl.hostname, allowedHosts)) {
            break;
        }

        currentUrl = parsedNextUrl.toString();
    }
    return currentUrl;
}

function isPinterestHost(hostname) {
    const normalizedHost = normalizeHostname(hostname);
    if (!normalizedHost) {
        return false;
    }
    if (normalizedHost === 'pin.it' || normalizedHost.endsWith('.pin.it')) {
        return true;
    }
    if (isAllowedHost(normalizedHost, ['pinterest.com'])) {
        return true;
    }
    return /^([a-z0-9-]+\.)*pinterest\.[a-z]{2,3}(?:\.[a-z]{2,3})?$/i.test(normalizedHost);
}

function extractPinterestShortCode(url) {
    const match = String(url || '').match(/^https?:\/\/(?:www\.)?pin\.it\/([a-zA-Z0-9_-]+)/i);
    if (!match || !match[1]) {
        return null;
    }
    return match[1];
}

function extractPinterestPinId(url) {
    const match = String(url || '').match(/pinterest\.[a-z]{2,3}(?:\.[a-z]{2,3})?\/pin\/(?:[^/?#]*-)?(\d+)/i);
    if (!match || !match[1]) {
        return null;
    }
    return match[1];
}

async function resolvePinterestRedirectTarget(initialUrl, maxRedirects = 5) {
    let currentUrl = initialUrl;
    for (let i = 0; i < maxRedirects; i++) {
        let axiosResponse;
        try {
            axiosResponse = await axios.get(currentUrl, createResolveRequestConfig());
        } catch {
            break;
        }

        if (!(axiosResponse.status >= 300 && axiosResponse.status < 400) || typeof axiosResponse.headers.location !== 'string') {
            break;
        }

        let nextUrl;
        try {
            nextUrl = new URL(axiosResponse.headers.location, currentUrl).toString();
        } catch {
            break;
        }
        const parsedNextUrl = parseUrl(nextUrl);
        if (!parsedNextUrl || !/^https?:$/i.test(parsedNextUrl.protocol)) {
            break;
        }
        if (!isPinterestHost(parsedNextUrl.hostname)) {
            break;
        }

        currentUrl = parsedNextUrl.toString();
    }
    return currentUrl;
}

async function normalizePinterestTargetUrl(targetUrl) {
    let candidateUrl = targetUrl;
    const shortCode = extractPinterestShortCode(candidateUrl);
    if (shortCode) {
        const resolverUrl = `https://api.pinterest.com/url_shortener/${shortCode}/redirect/`;
        candidateUrl = await resolvePinterestRedirectTarget(resolverUrl, 5);
        if (!extractPinterestPinId(candidateUrl)) {
            candidateUrl = await resolvePinterestRedirectTarget(targetUrl, 5);
        }
    }
    const pinId = extractPinterestPinId(candidateUrl);
    if (!pinId) {
        return candidateUrl;
    }
    return `https://www.pinterest.com/pin/${pinId}/`;
}

async function handleOembedRequest(providerUrl, targetUrl, res, next) {
    const response = { 'status': 0 };
    const provider = OEMBED_PROVIDERS.find((entry) => entry.providerUrl === providerUrl);
    if (!provider) {
        return next(apiError.badRequest('oembed_provider_not_allowed'));
    }

    const parsedTarget = parseUrl(targetUrl);
    if (!parsedTarget || !/^https?:$/i.test(parsedTarget.protocol)) {
        return next(apiError.badRequest('oembed_url_invalid'));
    }

    if (!isAllowedHost(parsedTarget.hostname, provider.allowedHosts)) {
        return next(apiError.badRequest('oembed_url_not_allowed'));
    }

    let normalizedTargetUrl = parsedTarget.toString();
    if (provider.name === 'tiktok' && isAllowedHost(parsedTarget.hostname, ['vm.tiktok.com'])) {
        normalizedTargetUrl = await resolveAllowedRedirectTarget(normalizedTargetUrl, provider.allowedHosts);
    } else if (provider.name === 'pinterest') {
        normalizedTargetUrl = await normalizePinterestTargetUrl(normalizedTargetUrl);
    }

    try {
        const axiosResponse = await axios.get(provider.providerUrl, {
            params: { url: normalizedTargetUrl, format: 'json' },
            timeout: 5000,
            maxRedirects: 0,
            validateStatus: null
        });
        if (axiosResponse.status === 200) {
            response.status = axiosResponse.status;
            response.result = axiosResponse.data;
            return res.status(response.status).json(response);
        }
        response.status = axiosResponse.status;
        response.result = axiosResponse.statusText;
        return res.status(response.status).json(response);
    } catch {
        return next(apiError.badGateway('oembed_failed'));
    }
}

router.get('/resolve/:url', security.authenticate, async function (req, res, next) {
    const requestedUrl = safeDecode(req.params.url);
    const parsedTarget = parseUrl(requestedUrl);
    if (!parsedTarget || !/^https?:$/i.test(parsedTarget.protocol)) {
        return next(apiError.badRequest('resolve_url_invalid'));
    }
    if (parsedTarget.username || parsedTarget.password) {
        return next(apiError.badRequest('resolve_url_invalid'));
    }
    if (!hasAllowedResolvePort(parsedTarget)) {
        return next(apiError.badRequest('resolve_url_not_allowed'));
    }
    const isPublicTarget = await isPublicResolveTarget(parsedTarget.hostname);
    if (!isPublicTarget) {
        return next(apiError.badRequest('resolve_url_not_allowed'));
    }

    const targetUrl = parsedTarget.toString();
    let axiosResponse;
    try {
        axiosResponse = await axios.get(targetUrl, createResolveRequestConfig());
    } catch {
        return next(apiError.badGateway('resolve_failed'));
    }

    if (axiosResponse.status >= 300 && axiosResponse.status < 400 && typeof axiosResponse.headers.location === 'string') {
        try {
            const normalizedLocation = new URL(axiosResponse.headers.location, targetUrl).toString();
            return res.status(200).json({ status: 200, result: normalizedLocation });
        } catch {
            return res.status(200).json({ status: 200, result: targetUrl });
        }
    }

    return res.status(200).json({ status: 200, result: targetUrl });
});

router.get('/oembed', security.authenticateOptional, function (req, res, next) {
    const providerUrl = safeDecode(getQueryParam(req.query.provider));
    const targetUrl = safeDecode(getQueryParam(req.query.url));
    return handleOembedRequest(providerUrl, targetUrl, res, next);
});

router.get('/vapid-public-key', security.authenticateOptional, function (_req, res) {
    const { publicKey } = getVapidKeys();
    if (!publicKey) {
        return res.status(500).json({
            status: 500,
            message: 'vapid_public_key_missing'
        });
    }
    return res.status(200).json({
        status: 200,
        publicKey
    });
});

module.exports = router
