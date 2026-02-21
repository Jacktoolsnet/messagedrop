module.exports = (io, socket) => {
  const getAuthUserId = () => socket.user?.userId ?? socket.user?.id ?? null;
  const toRoom = (value) => String(value);

  const sendAck = (ack, payload) => {
    if (typeof ack === 'function') {
      try {
        ack(payload);
      } catch {
        // ignore bad ack handlers on client side
      }
    }
  };

  const emitError = (event, context, reason, ack, status = 400) => {
    const contextKeys = context && typeof context === 'object' ? Object.keys(context).slice(0, 12) : [];
    socket.logger.warn(`${event} rejected`, { reason, status, contextKeys });
    const payload = { status, reason };
    socket.emit(`${event}:error`, payload);
    sendAck(ack, payload);
  };

  const ensureAuth = (event, context, expectedUserId, ack) => {
    const authUserId = getAuthUserId();
    if (!authUserId) {
      emitError(event, context, 'unauthorized', ack, 403);
      return false;
    }
    if (expectedUserId && String(authUserId) !== String(expectedUserId)) {
      emitError(event, context, 'forbidden', ack, 403);
      return false;
    }
    return true;
  };

  const requestProfile = (contact, ack) => {
    if (!contact?.userId || !contact?.contactUserId) {
      emitError('contact:requestProfile', contact, 'missing contact userId or contactUserId', ack);
      return;
    }
    if (!ensureAuth('contact:requestProfile', contact, contact.userId, ack)) {
      return;
    }

    io.to(toRoom(contact.contactUserId)).emit(`requestProfileForContact:${contact.contactUserId}`, {
      status: 200,
      contact
    });
    sendAck(ack, { status: 200 });
  };

  const provideUserProfile = (contact, ack) => {
    if (!contact?.id || !contact?.userId || !contact?.contactUserId) {
      emitError('contact:provideUserProfile', contact, 'missing contact id or userId/contactUserId', ack);
      return;
    }
    if (!ensureAuth('contact:provideUserProfile', contact, contact.contactUserId, ack)) {
      return;
    }

    const status = contact.provided === false ? 500 : 200;
    io.to(toRoom(contact.userId)).emit(`receiveProfileForContact:${contact.id}`, { status, contact });
    sendAck(ack, { status });
  };

  const newContactMessage = (envelope, ack) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageSignature', 'userEncryptedMessage', 'contactUserEncryptedMessage'];
    const missing = requiredFields.filter((key) => envelope?.[key] === undefined || envelope?.[key] === null);
    if (missing.length) {
      emitError('contact:newContactMessage', { envelope }, `missing fields: ${missing.join(', ')}`, ack);
      return;
    }
    if (!ensureAuth('contact:newContactMessage', envelope, envelope.userId, ack)) {
      return;
    }

    io.to(toRoom(envelope.contactUserId)).emit(`receiveContactMessage:${envelope.contactUserId}`, {
      status: 200,
      envelope
    });

    // Sender bekommt eine kleine Bestätigung, damit der Client klar weiß, dass der Server weitergeleitet hat.
    const ackPayload = {
      status: 200,
      contactId: envelope.contactId,
      messageSignature: envelope.messageSignature
    };
    socket.emit('contact:newContactMessage:ack', ackPayload);
    sendAck(ack, ackPayload);
  };

  const updateContactMessage = (payload, ack) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId', 'messageSignature', 'userEncryptedMessage', 'contactUserEncryptedMessage'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:updateContactMessage', { payload }, `missing fields: ${missing.join(', ')}`, ack);
      return;
    }
    if (!ensureAuth('contact:updateContactMessage', payload, payload.userId, ack)) {
      return;
    }

    io.to(toRoom(payload.contactUserId)).emit(`receiveUpdatedContactMessage:${payload.contactUserId}`, {
      status: 200,
      envelope: payload
    });

    const ackPayload = {
      status: 200,
      contactId: payload.contactId,
      messageSignature: payload.messageSignature
    };
    socket.emit('contact:updateContactMessage:ack', ackPayload);
    sendAck(ack, ackPayload);
  };

  const deleteContactMessage = (payload, ack) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:deleteContactMessage', { payload }, `missing fields: ${missing.join(', ')}`, ack);
      return;
    }
    if (!ensureAuth('contact:deleteContactMessage', payload, payload.userId, ack)) {
      return;
    }

    io.to(toRoom(payload.contactUserId)).emit(`receiveDeletedContactMessage:${payload.contactUserId}`, {
      status: 200,
      messageId: payload.messageId,
      userId: payload.userId,
      statusLabel: 'deleted',
      remove: !!payload.remove
    });

    const ackPayload = {
      status: 200,
      contactId: payload.contactId,
      messageId: payload.messageId
    };
    socket.emit('contact:deleteContactMessage:ack', ackPayload);
    sendAck(ack, ackPayload);
  };

  const readContactMessage = (payload, ack) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:readContactMessage', { payload }, `missing fields: ${missing.join(', ')}`, ack);
      return;
    }
    if (!ensureAuth('contact:readContactMessage', payload, payload.userId, ack)) {
      return;
    }
    io.to(toRoom(payload.contactUserId)).emit(`receiveMessageRead:${payload.contactUserId}`, {
      status: 200,
      messageId: payload.messageId,
      contactId: payload.contactId
    });
    const ackPayload = {
      status: 200,
      contactId: payload.contactId,
      messageId: payload.messageId
    };
    socket.emit('contact:readContactMessage:ack', ackPayload);
    sendAck(ack, ackPayload);
  };

  const reactContactMessage = (payload, ack) => {
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageId'];
    const missing = requiredFields.filter((key) => payload?.[key] === undefined || payload?.[key] === null);
    if (missing.length) {
      emitError('contact:reactContactMessage', { payload }, `missing fields: ${missing.join(', ')}`, ack);
      return;
    }
    if (!ensureAuth('contact:reactContactMessage', payload, payload.userId, ack)) {
      return;
    }

    io.to(toRoom(payload.contactUserId)).emit(`receiveContactMessageReaction:${payload.contactUserId}`, {
      status: 200,
      messageId: payload.messageId,
      userId: payload.userId,
      contactId: payload.contactId,
      reaction: payload.reaction ?? null
    });

    const ackPayload = {
      status: 200,
      contactId: payload.contactId,
      messageId: payload.messageId,
      reaction: payload.reaction ?? null
    };
    socket.emit('contact:reactContactMessage:ack', ackPayload);
    sendAck(ack, ackPayload);
  };

  socket.on('contact:requestProfile', (contact, ack) => requestProfile(contact, ack));
  socket.on('contact:provideUserProfile', (contact, ack) => provideUserProfile(contact, ack));
  socket.on('contact:newContactMessage', (envelope, ack) => newContactMessage(envelope, ack));
  socket.on('contact:updateContactMessage', (payload, ack) => updateContactMessage(payload, ack));
  socket.on('contact:deleteContactMessage', (payload, ack) => deleteContactMessage(payload, ack));
  socket.on('contact:readContactMessage', (payload, ack) => readContactMessage(payload, ack));
  socket.on('contact:reactContactMessage', (payload, ack) => reactContactMessage(payload, ack));
};
