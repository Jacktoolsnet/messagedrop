// Passenger sees incoming HTTP requests, not work done by import child processes.
// This monitor is independent of Socket.IO subscribers and stops when the queue
// is empty. The existing active-queue endpoint is both heartbeat and stop signal.
function createGeodataImportKeepAlive({
  requestService, events, logger = console, intervalMs = 60000,
  timers = { setTimeout, clearTimeout }
}) {
  let started = false;
  let stopped = false;
  let timer = null;
  let checking = false;
  let dirty = false;
  let active = false;
  let failures = 0;

  function schedule(delay) {
    if (stopped || timer || checking) return;
    timer = timers.setTimeout(check, delay);
    timer.unref?.();
  }

  function changed() {
    dirty = true;
    // Do not turn frequent progress events into frequent HTTP requests or
    // postpone the heartbeat indefinitely while updates keep arriving.
    schedule(1000);
  }

  async function check() {
    timer = null;
    if (stopped) return;
    checking = true;
    dirty = false;
    try {
      const response = await requestService('get', '/geodata/import-jobs?activeOnly=true',
        undefined, { timeoutMs: 10000 });
      if (stopped) return;
      if (!Array.isArray(response?.jobs)) throw new Error('invalid_geodata_active_queue');
      const nextActive = response.jobs.some(job => job?.status === 'running' || job?.status === 'queued');
      if (nextActive !== active) {
        logger.info(nextActive ? 'Geodata import keep-alive started' : 'Geodata import keep-alive stopped: queue empty');
      }
      active = nextActive;
      failures = 0;
    } catch (error) {
      if (stopped) return;
      failures++;
      if (failures === 1 || failures % 5 === 0) {
        logger.warn('Geodata import keep-alive failed; retrying', { error: error?.message || String(error) });
      }
    } finally {
      checking = false;
      // A timeout is not evidence of an empty queue. Retry without overlapping
      // requests, including when the startup reconciliation fails.
      if (active || failures) schedule(intervalMs);
      else if (dirty) schedule(1000); // An event arrived during the last read.
    }
  }

  return {
    start() {
      if (started || stopped) return;
      started = true;
      events.on('changed', changed);
      schedule(0); // Recover monitoring after an Admin restart, without a browser.
    },
    close() {
      stopped = true;
      events.off('changed', changed);
      if (timer) timers.clearTimeout(timer);
      timer = null;
    }
  };
}

module.exports = { createGeodataImportKeepAlive };
