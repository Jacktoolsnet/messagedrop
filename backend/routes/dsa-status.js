const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const router = express.Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

function adminBase(path) {
  const base = `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}`.replace(/\/+$/, '');
  return `${base}/public${path}`;
}

async function forwardGet(path, opts = {}) {
  return axios.get(adminBase(path), {
    timeout: 5000,
    headers: {
      'x-api-authorization': process.env.ADMIN_TOKEN,
      ...(opts.headers || {})
    },
    responseType: opts.responseType || 'json'
  });
}

async function forwardPost(path, body, opts = {}) {
  return axios.post(adminBase(path), body, {
    timeout: 5000,
    headers: {
      'x-api-authorization': process.env.ADMIN_TOKEN,
      ...(opts.headers || {})
    },
    validateStatus: () => true
  });
}

router.get('/status/:token', async (req, res) => {
  try {
    const resp = await forwardGet(`/status/${encodeURIComponent(req.params.token)}`);
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json(err.response?.data || { error: 'bad_gateway' });
  }
});

router.get('/status/:token/evidence/:id', async (req, res) => {
  try {
    const resp = await forwardGet(`/status/${encodeURIComponent(req.params.token)}/evidence/${encodeURIComponent(req.params.id)}`, { responseType: 'arraybuffer' });
    Object.entries(resp.headers || {}).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(resp.status).send(resp.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(502).json({ error: 'bad_gateway' });
    }
  }
});

router.post('/status/:token/appeals', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const resp = await forwardPost(`/status/${encodeURIComponent(req.params.token)}/appeals`, req.body);
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json(err.response?.data || { error: 'bad_gateway' });
  }
});

router.post('/status/:token/appeals/:appealId/evidence', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, req.file.originalname);
    const headers = form.getHeaders({ 'x-api-authorization': process.env.ADMIN_TOKEN });
    const resp = await axios.post(
      adminBase(`/status/${encodeURIComponent(req.params.token)}/appeals/${encodeURIComponent(req.params.appealId)}/evidence`),
      form,
      {
        timeout: 5000,
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true
      }
    );
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json(err.response?.data || { error: 'bad_gateway' });
  }
});

module.exports = router;
