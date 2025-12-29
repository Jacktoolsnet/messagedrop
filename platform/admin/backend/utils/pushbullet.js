const axios = require('axios');

const PUSHBULLET_URL = 'https://api.pushbullet.com/v2/pushes';

function getMakeConfig() {
  const url = process.env.MAKE_PUSHBULLET_WEBHOOK_URL;
  const apiKey = process.env.MAKE_API_KEY;
  if (!url || !apiKey) return null;
  return { url, apiKey };
}

function formatExcerpt(value, maxLen = 180) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

async function sendPushbulletNotification({ title, body, logger }) {
  const token = process.env.PUSHBULLET_TOKEN;
  if (token) {
    const payload = {
      type: 'note',
      title: title || 'Notification',
      body: body || ''
    };
    const channelTag = process.env.PUSHBULLET_CHANNEL;
    const deviceId = process.env.PUSHBULLET_DEVICE;
    if (channelTag) {
      payload.channel_tag = channelTag;
    }
    if (deviceId) {
      payload.device_iden = deviceId;
    }

    try {
      const resp = await axios.post(PUSHBULLET_URL, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        timeout: 5000,
        validateStatus: () => true
      });
      if (resp.status >= 200 && resp.status < 300) {
        return true;
      }
      logger?.warn?.('Pushbullet notification failed', { status: resp.status, data: resp.data });
    } catch (error) {
      logger?.warn?.('Pushbullet notification failed', { error: error?.message || error });
    }
    return false;
  }

  const make = getMakeConfig();
  if (!make) {
    return false;
  }
  try {
    await axios.post(make.url, { title: title || 'Notification', text: body || '' }, {
      headers: { 'x-make-apikey': make.apiKey },
      timeout: 4000,
      validateStatus: () => true
    });
    return true;
  } catch (error) {
    logger?.warn?.('Pushbullet notification failed', { error: error?.message || error });
    return false;
  }
}

module.exports = {
  formatExcerpt,
  sendPushbulletNotification
};
