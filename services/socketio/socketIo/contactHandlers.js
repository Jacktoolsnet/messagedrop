module.exports = (io, socket) => {
  const getAuthUserId = () => socket.user?.userId ?? socket.user?.id ?? null;

  const emitError = (event, context, reason) => {
    socket.logger.warn(`${event} rejected`, { reason, context });
    socket.emit(`${event}:error`, { status: 400, reason });
  };

  const ensureAuth = (event, context, expectedUserId) => {
    const authUserId = getAuthUserId();
    if (!authUserId) {
      emitError(event, context, 'unauthorized');
      return false;
    }
    if (expectedUserId && String(authUserId) !== String(expectedUserId)) {
      emitError(event, context, 'forbidden');
      return false;
    }
    return true;
  };

  const requestProfile = (contact) => {
    if (!contact?.userId || !contact?.contactUserId) {
      emitError('contact:requestProfile', contact, 'missing contact userId or contactUserId');
      return;
    }
    if (!ensureAuth('contact:requestProfile', contact, contact.userId)) {
      return;
    }

    io.to(contact.contactUserId).emit(`requestProfileForContact:${contact.contactUserId}`, {
      status: 200,
      contact
    });
  };

  const provideUserProfile = (contact) => {
    if (!contact?.id || !contact?.userId || !contact?.contactUserId) {
      emitError('contact:provideUserProfile', contact, 'missing contact id or userId/contactUserId');
      return;
    }
    if (!ensureAuth('contact:provideUserProfile', contact, contact.contactUserId)) {
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
    if (!ensureAuth('contact:newContactMessage', envelope, envelope.userId)) {
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
    if (!ensureAuth('contact:updateContactMessage', payload, payload.userId)) {
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
    if (!ensureAuth('contact:deleteContactMessage', payload, payload.userId)) {
      return;
    }

    io.to(payload.contactUserId).emit(`receiveDeletedContactMessage:${payload.contactUserId}`, {
      status: 200,
      messageId: payload.messageId,
      userId: payload.userId,
      statusLabel: 'deleted',
      remove: !!payload.remove
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
    if (!ensureAuth('contact:readContactMessage', payload, payload.userId)) {
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

  const reactContactMessage = (payload) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:reactContactMessage', { payload }, `missing fields: ${missing.join(', ')}`);
      return;
    }
    if (!ensureAuth('contact:reactContactMessage', payload, payload.userId)) {
      return;
    }

    io.to(payload.contactUserId).emit(`receiveContactMessageReaction:${payload.contactUserId}`, {
      status: 200,
      messageId: payload.messageId,
      userId: payload.userId,
      contactId: payload.contactId,
      reaction: payload.reaction ?? null
    });

    socket.emit('contact:reactContactMessage:ack', {
      status: 200,
      contactId: payload.contactId,
      messageId: payload.messageId,
      reaction: payload.reaction ?? null
    });
  };

  socket.on('contact:requestProfile', requestProfile);
  socket.on('contact:provideUserProfile', provideUserProfile);
  socket.on('contact:newContactMessage', newContactMessage);
  socket.on('contact:updateContactMessage', updateContactMessage);
  socket.on('contact:deleteContactMessage', deleteContactMessage);
  socket.on('contact:readContactMessage', readContactMessage);
  socket.on('contact:reactContactMessage', reactContactMessage);
};
