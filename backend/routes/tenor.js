const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const axios = require('axios');
const metric = require('../middleware/metric');

router.use(security.checkToken);

router.get('/featured/:country/:locale',
    [
        metric.count('tenor.featured', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        const response = { status: 0 };

        const params = new URLSearchParams();
        params.set('key', process.env.TENOR_API_KEY);
        params.set('client_key', process.env.TENOR_CLIENT_KEY);
        params.set('media_filter', 'gif');
        params.set('ar_range', 'standard');
        params.set('contentfilter', 'low');
        params.set('limit', '30');
        params.set('country', req.params.country);
        params.set('locale', req.params.locale);

        const axiosClient = axios.create({
            baseURL: process.env.TENOR_BASE_URL,
            timeout: 5000
        });

        try {
            const tenorResponse = await axiosClient.get('/featured', { params });
            response.status = tenorResponse.status;
            response.data = tenorResponse.data;
            return res.status(tenorResponse.status).send(response);
        } catch (err) {
            console.error('Request error:', err);
            response.status = 503;
            response.error = 'Bad gateway to Tenor';
            return res.status(response.status).json(response);
        }
    });

router.get('/featured/:country/:locale/:next',
    [
        metric.count('tenor.featured', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        const response = { status: 0 };

        const params = new URLSearchParams();
        params.set('key', process.env.TENOR_API_KEY);
        params.set('client_key', process.env.TENOR_CLIENT_KEY);
        params.set('media_filter', 'gif');
        params.set('ar_range', 'standard');
        params.set('contentfilter', 'low');
        params.set('limit', '30');
        params.set('country', req.params.country);
        params.set('locale', req.params.locale);
        params.set('pos', req.params.next);

        const axiosClient = axios.create({
            baseURL: process.env.TENOR_BASE_URL,
            timeout: 5000
        });

        try {
            const tenorResponse = await axiosClient.get('/featured', { params });
            response.status = tenorResponse.status;
            response.data = tenorResponse.data;
            return res.status(tenorResponse.status).send(response);
        } catch (err) {
            console.error('Request error:', err);
            response.status = 503;
            response.error = 'Bad gateway to Tenor';
            return res.status(response.status).json(response);
        }
    });

router.get('/search/:country/:locale/:searchTerm',
    [
        metric.count('tenor.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        const response = { status: 0 };
        const params = new URLSearchParams();
        params.set('key', process.env.TENOR_API_KEY);
        params.set('client_key', process.env.TENOR_CLIENT_KEY);
        params.set('media_filter', 'gif');
        params.set('ar_range', 'standard');
        params.set('contentfilter', 'low');
        params.set('limit', '30');
        params.set('country', req.params.country);
        params.set('locale', req.params.locale);
        params.set('q', req.params.searchTerm);

        const axiosClient = axios.create({
            baseURL: process.env.TENOR_BASE_URL,
            timeout: 5000
        });

        try {
            const tenorResponse = await axiosClient.get('/search', { params });
            response.status = tenorResponse.status;
            response.data = tenorResponse.data;
            return res.status(tenorResponse.status).send(response);
        } catch (err) {
            console.error('Request error:', err);
            response.status = 503;
            response.error = 'Bad gateway to Tenor';
            return res.status(response.status).json(response);
        }
    });

router.get('/search/:country/:locale/:searchTerm/:next',
    [
        metric.count('tenor.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        const response = { status: 0 };
        const params = new URLSearchParams();
        params.set('key', process.env.TENOR_API_KEY);
        params.set('client_key', process.env.TENOR_CLIENT_KEY);
        params.set('media_filter', 'gif');
        params.set('ar_range', 'standard');
        params.set('contentfilter', 'low');
        params.set('limit', '30');
        params.set('country', req.params.country);
        params.set('locale', req.params.locale);
        params.set('q', req.params.searchTerm);
        params.set('pos', req.params.next);

        const axiosClient = axios.create({
            baseURL: process.env.TENOR_BASE_URL,
            timeout: 5000
        });

        try {
            const tenorResponse = await axiosClient.get('/search', { params });
            response.status = tenorResponse.status;
            response.data = tenorResponse.data;
            return res.status(tenorResponse.status).send(response);
        } catch (err) {
            console.error('Request error:', err);
            response.status = 503;
            response.error = 'Bad gateway to Tenor';
            return res.status(response.status).json(response);
        }
    });

module.exports = router;