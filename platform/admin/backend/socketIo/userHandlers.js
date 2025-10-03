module.exports = (io, socket) => {

  const joinUserRoom = (userId) => {
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