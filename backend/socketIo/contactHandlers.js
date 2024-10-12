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
      io.to(contact.contactUserId).emit(`receiveProfileForContact:${contact.contactUserId}`, {
        status: 500,
        contact: contact
      });
    } else {
      io.to(contact.contactUserId).emit(`receiveProfileForContact:${contact.contactUserId}`, {
        status: 200,
        contact: contact
      });
    }
  }

  socket.on("contact:requestProfile", requestProfile);
  socket.on("contact:provideUserProfile", provideUserProfile);
}