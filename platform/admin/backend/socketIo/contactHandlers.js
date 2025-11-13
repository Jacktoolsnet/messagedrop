module.exports = (io, socket) => {

  const requestProfile = (contact) => {
    // socket.logger.info('requestProfile', contact);
    io.to(contact.contactUserId).emit(`requestProfileForContact:${contact.contactUserId}`, {
      status: 200,
      contact: contact
    });
  }

  const provideUserProfile = (contact) => {
    // socket.logger.info('provideUserProfile', contact);
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

  const newShortMessage = (envelope) => {
    io.to(envelope.contactUserId).emit(`receiveShortMessage:${envelope.contactUserId}`, {
      status: 200,
      envelope
    });
  };

  socket.on("contact:requestProfile", requestProfile);
  socket.on("contact:provideUserProfile", provideUserProfile);
  socket.on("contact:newShortMessage", newShortMessage);
}
