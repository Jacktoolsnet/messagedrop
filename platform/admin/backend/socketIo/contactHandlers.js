module.exports = (io, socket) => {

  const getAuthUserId = () => socket.admin?.userId ?? socket.admin?.id ?? socket.admin?.sub ?? null;

  const emitError = (event, context, reason) => {
    socket.logger?.warn(`${event} rejected`, { reason, context });
    socket.emit(`${event}:error`, { status: 403, reason });
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
    // socket.logger.info('requestProfile', contact);
    io.to(contact.contactUserId).emit(`requestProfileForContact:${contact.contactUserId}`, {
      status: 200,
      contact: contact
    });
  }

  const provideUserProfile = (contact) => {
    if (!contact?.id || !contact?.userId || !contact?.contactUserId) {
      emitError('contact:provideUserProfile', contact, 'missing contact id or userId/contactUserId');
      return;
    }
    if (!ensureAuth('contact:provideUserProfile', contact, contact.contactUserId)) {
      return;
    }
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
    const requiredFields = ['contactId', 'userId', 'contactUserId', 'messageSignature', 'userEncryptedMessage', 'contactUserEncryptedMessage'];
    const missing = requiredFields.filter((key) => envelope?.[key] === undefined || envelope?.[key] === null);
    if (missing.length) {
      emitError('contact:newShortMessage', { envelope }, `missing fields: ${missing.join(', ')}`);
      return;
    }
    if (!ensureAuth('contact:newShortMessage', envelope, envelope.userId)) {
      return;
    }
    io.to(envelope.contactUserId).emit(`receiveShortMessage:${envelope.contactUserId}`, {
      status: 200,
      envelope
    });
  };

  socket.on("contact:requestProfile", requestProfile);
  socket.on("contact:provideUserProfile", provideUserProfile);
  socket.on("contact:newShortMessage", newShortMessage);
}
