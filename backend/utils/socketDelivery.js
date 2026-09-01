const axios = require('axios');
const { signServiceJwt } = require('./serviceJwt');
const { resolveBaseUrl } = require('./adminLogForwarder');

const SOCKET_AUDIENCE = process.env.SERVICE_JWT_AUDIENCE_SOCKET || 'service.socketio';

function resolveSocketIoBaseUrl() {
  return resolveBaseUrl(process.env.SOCKETIO_BASE_URL || process.env.BASE_URL, process.env.SOCKETIO_PORT);
}

function deliveryTimeoutMs() {
  const parsed = Number.parseInt(process.env.CONTACT_SOCKET_DELIVERY_TIMEOUT_MS || '1200', 10);
  return Number.isFinite(parsed) ? Math.max(100, Math.min(3000, parsed)) : 1200;
}

async function deliverContactMessage(logger, envelope, options = {}) {
  const baseUrl = resolveSocketIoBaseUrl();
  if (!baseUrl || !envelope?.contactUserId) return false;
  const timeoutMs = deliveryTimeoutMs();
  try {
    const token = await (options.signToken || signServiceJwt)({ audience: SOCKET_AUDIENCE });
    const response = await (options.client || axios).post(`${baseUrl}/emit/user`, {
      userId: envelope.contactUserId,
      event: `receiveContactMessage:${envelope.contactUserId}`,
      payload: { status: 200, envelope },
      awaitAck: true,
      ackTimeoutMs: timeoutMs
    }, {
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      timeout: timeoutMs + 1000,
      validateStatus: () => true
    });
    return response.status >= 200 && response.status < 300 && response.data?.delivered === true;
  } catch (error) {
    logger?.warn?.('Socket contact message delivery check failed', { error: error?.message });
    return false;
  }
}

module.exports = { deliverContactMessage, deliveryTimeoutMs, resolveSocketIoBaseUrl };
