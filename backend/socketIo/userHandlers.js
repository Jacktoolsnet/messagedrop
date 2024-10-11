module.exports = (io, socket) => {
  const joinUserRoom = (room) => {
    socket.join(room);
    socket.emit(`user:${room}`, {
      "status": 200,
      "type": "info",
      "message": "ok"
    });
  }

  socket.on("user:joinUserRoom", joinUserRoom);
}