const express = require('express');
const axios = require('axios');
const router = express.Router();
const security = require('../middleware/security');

router.use(security.checkToken);

router.get('/resolve/:url', function (req, res) {
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
        .catch(error => {
            response.status = 500;
            response.result = error;
            res.status(response.status).json(response);
        });
});

router.get('/oembed/:provider/:url', function (req, res) {
    let response = { 'status': 0 };
    axios.get(`${req.params.provider}?url=${req.params.url}&format=json`, { maxRedirects: 0, validateStatus: null })
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
        .catch(error => {
            response.status = 500;
            response.result = error;
            res.status(response.status).json(response);
        });
});

module.exports = router