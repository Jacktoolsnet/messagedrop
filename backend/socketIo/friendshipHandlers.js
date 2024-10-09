module.exports = (io, socket) => {
    const create = (payload) => {
      // ...
    }
    
    const sendMessage = (payload) => {
        // ...
      }

    socket.on("friendship:create", create);
    socket.on("friendship:sendMessage", sendMessage);
  }