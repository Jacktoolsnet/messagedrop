module.exports = (io, socket) => {
  const getAuthUserId = () => socket.user?.userId ?? socket.user?.id ?? null;
  const emitError = (reason) => {
    socket.emit('user:joinUserRoom:error', { status: 403, reason });
  };

  const joinUserRoom = (userId) => {
    const authUserId = getAuthUserId();
    if (!authUserId) {
      emitError('unauthorized');
      return;
    }
    if (!userId) {
      emitError('missing_userId');
      return;
    }
    if (String(authUserId) !== String(userId)) {
      emitError('forbidden');
      return;
    }
    socket.join(userId);
    io.to(userId).emit(`${userId}`, {
      status: 200,
      type: "joined",
      content: {
        message: `Joined room ${userId}`
      }
    });
  }

  socket.on("user:joinUserRoom", joinUserRoom);
}
