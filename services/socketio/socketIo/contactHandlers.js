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

  const updateContactMessage = (payload) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId', 'messageSignature', 'userEncryptedMessage', 'contactUserEncryptedMessage'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:updateContactMessage', { payload }, `missing fields: ${missing.join(', ')}`);
      return;
    }

    io.to(payload.contactUserId).emit(`receiveUpdatedContactMessage:${payload.contactUserId}`, {
      status: 200,
      envelope: payload
    });

    socket.emit('contact:updateContactMessage:ack', {
      status: 200,
      contactId: payload.contactId,
      messageSignature: payload.messageSignature
    });
  };

  const deleteContactMessage = (payload) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:deleteContactMessage', { payload }, `missing fields: ${missing.join(', ')}`);
      return;
    }

    io.to(payload.contactUserId).emit(`receiveDeletedContactMessage:${payload.contactUserId}`, {
      status: 200,
      messageId: payload.messageId,
      statusLabel: 'deleted'
    });

    socket.emit('contact:deleteContactMessage:ack', {
      status: 200,
      contactId: payload.contactId,
      messageId: payload.messageId
    });
  };

  const readContactMessage = (payload) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:readContactMessage', { payload }, `missing fields: ${missing.join(', ')}`);
      return;
    }
    io.to(payload.contactUserId).emit(`receiveMessageRead:${payload.contactUserId}`, {
      status: 200,
      messageId: payload.messageId,
      contactId: payload.contactId
    });
    socket.emit('contact:readContactMessage:ack', {
      status: 200,
      contactId: payload.contactId,
      messageId: payload.messageId
    });
  };

  socket.on('contact:requestProfile', requestProfile);
  socket.on('contact:provideUserProfile', provideUserProfile);
  socket.on('contact:newContactMessage', newContactMessage);
  socket.on('contact:updateContactMessage', updateContactMessage);
  socket.on('contact:deleteContactMessage', deleteContactMessage);
  socket.on('contact:readContactMessage', readContactMessage);
};
