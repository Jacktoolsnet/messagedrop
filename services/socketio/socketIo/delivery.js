function normalizeAckTimeout(value, fallback = 1200) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(100, Math.min(3000, parsed));
}

function isProcessedAcknowledgement(response) {
  return response?.status === 200 && response?.processed === true;
}

async function deliverToAnySocket(io, userId, event, payload, timeoutMs) {
  const sockets = await io.in(String(userId)).fetchSockets();
  if (sockets.length === 0) return { delivered: false, connectedSockets: 0 };

  const timeout = normalizeAckTimeout(timeoutMs);
  const attempts = sockets.map((socket) => socket.timeout(timeout).emitWithAck(event, payload)
    .then((response) => {
      if (!isProcessedAcknowledgement(response)) throw new Error('not_processed');
      return response;
    }));

  try {
    const acknowledgement = await Promise.any(attempts);
    return { delivered: true, connectedSockets: sockets.length, acknowledgement };
  } catch {
    return { delivered: false, connectedSockets: sockets.length };
  }
}

module.exports = { deliverToAnySocket, isProcessedAcknowledgement, normalizeAckTimeout };
