module.exports = (_io, socket) => {
  const getAuthUserId = () => socket.user?.userId ?? socket.user?.id ?? null;
  const toRoom = (value) => String(value);

  const emitError = (reason, ack) => {
    const payload = { status: 403, reason };
    socket.emit('user:joinUserRoom:error', payload);
    if (typeof ack === 'function') {
      try {
        ack(payload);
      } catch {
        // ignore bad ack handlers on client side
      }
    }
  };

  const joinUserRoom = (userId, ack) => {
    const authUserId = getAuthUserId();
    if (!authUserId) {
      emitError('unauthorized', ack);
      return;
    }
    if (!userId) {
      emitError('missing_userId', ack);
      return;
    }
    if (String(authUserId) !== String(userId)) {
      emitError('forbidden', ack);
      return;
    }
    const room = toRoom(userId);
    socket.join(room);
    const payload = {
      status: 200,
      type: 'joined',
      content: {
        message: `Joined room ${room}`
      }
    };
    // only notify the joining socket to avoid cross-tab join fanout storms
    socket.emit(room, payload);
    if (typeof ack === 'function') {
      try {
        ack(payload);
      } catch {
        // ignore bad ack handlers on client side
      }
    }
  };

  socket.on('user:joinUserRoom', (userId, ack) => joinUserRoom(userId, ack));
};
