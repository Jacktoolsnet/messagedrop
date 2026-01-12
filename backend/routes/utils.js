const express = require('express');
const axios = require('axios');
const router = express.Router();
const security = require('../middleware/security');
const { apiError } = require('../middleware/api-error');

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

router.get('/resolve/:url', security.authenticate, function (req, res, next) {
    let response = { 'status': 0 };
    axios.get(req.params.url, { maxRedirects: 0, validateStatus: null })
        .then(axiosResponse => {
            if (axiosResponse.status >= 300 && axiosResponse.status < 400 && axiosResponse.headers.location) {
                response.status = 200;
                response.result = axiosResponse.headers.location;
                res.status(response.status).json(response);
            } else if (axiosResponse.status === 200) {
                // Endgültige URL ermitteln
                response.status = axiosResponse.status;
                response.result = response.config.url;
                res.status(response.status).json(response);
            } else {
                response.status = 200;
                response.result = req.params.shorturl;
                res.status(response.status).json(response);
            }
        })
        .catch(() => next(apiError.badGateway('resolve_failed')));
});

router.get('/oembed', security.authenticate, function (req, res, next) {
    const providerUrl = safeDecode(getQueryParam(req.query.provider));
    const targetUrl = safeDecode(getQueryParam(req.query.url));
    return handleOembedRequest(providerUrl, targetUrl, res, next);
});

module.exports = router
