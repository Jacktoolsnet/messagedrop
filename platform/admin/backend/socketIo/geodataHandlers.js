const ROOM = 'geodata:imports';

function createGeodataUpdates(io, loadJobs, logger = console) {
  let timer = null;
  let loading = false;
  let dirty = false;
  let closed = false;
  let revision = 0;
  const subscribed = () => io.sockets.adapter.rooms.get(ROOM)?.size > 0;

  function changed(delay = 1000) {
    dirty = true;
    if (closed || loading || timer || !subscribed()) return;
    timer = setTimeout(publish, delay);
    timer.unref?.();
  }
  async function publish() {
    timer = null;
    if (closed || !subscribed()) return;
    dirty = false;
    loading = true;
    let retry = false;
    try {
      const snapshot = await loadJobs();
      if (!closed) io.to(ROOM).emit('geodata:snapshot', { status: 200, ...snapshot, revision: ++revision });
    } catch (error) {
      logger.warn('Geodata live snapshot failed', { error: error.message });
      io.to(ROOM).emit('geodata:unavailable');
      dirty = true;
      retry = true;
    } finally {
      loading = false;
      if (dirty) changed(retry ? 5000 : 1000);
    }
  }
  function attach(socket) {
    let expiryTimer;
    socket.on('geodata:subscribe', async () => {
      const roles = Array.isArray(socket.admin?.roles) ? socket.admin.roles : [socket.admin?.role];
      const expiresAt = Number(socket.admin?.exp) * 1000;
      if (!roles.some(role => role === 'admin' || role === 'root') || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        socket.emit('geodata:unavailable');
        return;
      }
      try {
        await socket.join(ROOM);
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(() => {
          socket.emit('geodata:unavailable');
          socket.disconnect(true);
        }, Math.min(expiresAt - Date.now(), 2147483647));
        expiryTimer.unref?.();
        changed(0); // A reconnect always gets a new authoritative snapshot.
      } catch (error) {
        logger.warn('Geodata subscription failed', { error: error.message });
        socket.emit('geodata:unavailable');
      }
    });
    socket.on('geodata:unsubscribe', () => {
      clearTimeout(expiryTimer);
      void socket.leave(ROOM);
    });
    socket.on('disconnect', () => clearTimeout(expiryTimer));
  }
  return { changed, attach, close() { closed = true; clearTimeout(timer); } };
}
module.exports = { createGeodataUpdates };
