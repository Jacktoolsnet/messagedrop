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
        allowedHosts: ['open.spotify.com']
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
        addresses = await dns.lookup(normalizedHost, { all: true, verbatim: true });
    } catch {
        return false;
    }
    if (!Array.isArray(addresses) || addresses.length === 0) {
        return false;
    }
    return addresses.every((entry) => entry?.address && !isPrivateOrReservedIp(entry.address));
}

function handleOembedRequest(providerUrl, targetUrl, res, next) {
    let response = { 'status': 0 };
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

    axios.get(provider.providerUrl, {
        params: { url: targetUrl, format: 'json' },
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: null
    })
        .then(axiosResponse => {
            if (axiosResponse.status === 200) {
                response.status = axiosResponse.status;
                response.result = axiosResponse.data;
                res.status(response.status).json(response);
            } else {
                response.status = axiosResponse.status;
                response.result = axiosResponse.statusText;
                res.status(response.status).json(response);
            }
        })
        .catch(() => next(apiError.badGateway('oembed_failed')));
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
        axiosResponse = await axios.get(targetUrl, {
            maxRedirects: 0,
            validateStatus: null,
            timeout: 5000,
            maxContentLength: 64 * 1024,
            responseType: 'text'
        });
    } catch {
        return next(apiError.badGateway('resolve_failed'));
    }

    if (axiosResponse.status >= 300 && axiosResponse.status < 400 && typeof axiosResponse.headers.location === 'string') {
        return res.status(200).json({ status: 200, result: axiosResponse.headers.location });
    }

    return res.status(200).json({ status: 200, result: targetUrl });
});

router.get('/oembed', security.authenticate, function (req, res, next) {
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
