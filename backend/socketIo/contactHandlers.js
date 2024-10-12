const { response } = require("express");

module.exports = (io, socket) => {

  const requestProfile = (contact) => {
    io.to(contact.contactUserId).emit(`requesrProfileForContact:${contact.contactUserId}`, {
      status: 200,
      contact: contact
    });
  }

  const provideUserProfile = (contact) => {
    if (contact == undefined) {
      io.to(contact.userId).emit(`receiveProfileForContact:${contact.userId}`, {
        status: 500,
        contact: contact
      });
    } else {
      io.to(contact.userId).emit(`receiveProfileForContact:${contact.userId}`, {
        status: 200,
        contact: contact
      });
    }
  }

  socket.on("contact:requestProfile", requestProfile);
  socket.on("contact:provideUserProfile", provideUserProfile);
}