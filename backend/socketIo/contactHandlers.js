const { response } = require("express");

console.log("[Socket.io] contactHandlers geladen");

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
    try {
      socket.logger.info('newShortMessage', envelope);

      if (!envelope || !envelope.contactUserId || !envelope.userId) {
        throw new Error('Ungültiger envelope-Datensatz');
      }

      io.to(envelope.contactUserId).emit(`receiveShortMessage:${envelope.userId}`, {
        status: 200,
        envelope
      });
    } catch (err) {
      socket.logger.error('Fehler bei newShortMessage', {
        message: err.message,
        envelope,
        stack: err.stack
      });

      socket.emit('error:shortMessage', {
        status: 500,
        message: 'Interner Fehler beim Senden der Nachricht'
      });
    }
  };

  socket.on("contact:requestProfile", requestProfile);
  socket.on("contact:provideUserProfile", provideUserProfile);
  socket.on("contact:newShortMessage", newShortMessage);
}