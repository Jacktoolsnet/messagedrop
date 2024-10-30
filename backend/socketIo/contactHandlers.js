const { response } = require("express");

module.exports = (io, socket) => {

  const requestProfile = (contact) => {
    // socket.logger.info("requestProfile");
    io.to(contact.contactUserId).emit(`requestProfileForContact:${contact.contactUserId}`, {
      status: 200,
      contact: contact
    });
  }

  const provideUserProfile = (contact) => {
    // socket.logger.info("provideUserProfile");
    if (contact.provided == false) {
      io.to(contact.userId).emit(`receiveProfileForContact:${contact.id}`, {
        status: 500,
        contact: contact
      });
    } else {
      io.to(contact.userId).emit(`receiveProfileForContact:${contact.id}`, {
        status: 200,
        contact: contact
      });
    }
  }

  const newShortMessage = (contact) => {
    // socket.logger.info("newShortMessage");
    io.to(contact.contactUserId).emit(`receiveShorMessage:${contact.userId}`, {
      status: 200,
      contact: contact
    });
  }

  socket.on("contact:requestProfile", requestProfile);
  socket.on("contact:provideUserProfile", provideUserProfile);
  socket.on("contact:newShortMessage", newShortMessage);
}