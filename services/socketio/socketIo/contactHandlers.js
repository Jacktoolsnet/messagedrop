module.exports = (io, socket) => {
  const emitError = (event, context, reason) => {
    socket.logger.warn(`${event} rejected`, { reason, context });
    socket.emit(`${event}:error`, { status: 400, reason });
  };

  const requestProfile = (contact) => {
    if (!contact?.contactUserId) {
      emitError('contact:requestProfile', contact, 'missing contactUserId');
      return;
    }

    io.to(contact.contactUserId).emit(`requestProfileForContact:${contact.contactUserId}`, {
      status: 200,
      contact
    });
  };

  const provideUserProfile = (contact) => {
    if (!contact?.id || !contact?.userId) {
      emitError('contact:provideUserProfile', contact, 'missing contact id or userId');
      return;
    }

    const status = contact.provided === false ? 500 : 200;
    io.to(contact.userId).emit(`receiveProfileForContact:${contact.id}`, { status, contact });
  };

  const newContactMessage = (envelope) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageSignature', 'userEncryptedMessage', 'contactUserEncryptedMessage'];
    const missing = requiredFields.filter((key) => envelope?.[key] === undefined || envelope?.[key] === null);
    if (missing.length) {
      emitError('contact:newContactMessage', { envelope }, `missing fields: ${missing.join(', ')}`);
      return;
    }

    io.to(envelope.contactUserId).emit(`receiveContactMessage:${envelope.contactUserId}`, {
      status: 200,
      envelope
    });

    // Sender bekommt eine kleine Bestätigung, damit der Client klar weiß, dass der Server weitergeleitet hat.
    socket.emit('contact:newContactMessage:ack', {
      status: 200,
      contactId: envelope.contactId,
      messageSignature: envelope.messageSignature
    });
  };

  socket.on('contact:requestProfile', requestProfile);
  socket.on('contact:provideUserProfile', provideUserProfile);
  socket.on('contact:newContactMessage', newContactMessage);
};
