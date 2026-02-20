const { parentPort, workerData } = require('worker_threads');
const { DatabaseSync } = require('node:sqlite');

if (!parentPort) {
  throw new Error('sqlite-worker requires parentPort');
}

const dbPath = workerData?.filePath;
if (!dbPath) {
  throw new Error('sqlite-worker missing filePath');
}

const db = new DatabaseSync(dbPath);
let isClosed = false;

function toSerializableError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code,
    stack: error?.stack
  };
}

function runWithParams(stmt, method, params) {
  if (params === undefined) {
    return stmt[method]();
  }
  if (Array.isArray(params)) {
    return stmt[method](...params);
  }
  return stmt[method](params);
}

function normalizeRunResult(result) {
  const changes = Number(result?.changes ?? 0);
  let lastID = result?.lastInsertRowid ?? result?.lastID ?? null;
  if (typeof lastID === 'bigint') {
    lastID = Number(lastID);
  }
  return {
    changes: Number.isFinite(changes) ? changes : 0,
    lastID
  };
}

function execute(action, sql, params) {
  if (isClosed && action !== 'close') {
    throw new Error('Database is closed');
  }

  switch (action) {
    case 'exec':
      db.exec(sql);
      return null;
    case 'run': {
      const stmt = db.prepare(sql);
      const result = runWithParams(stmt, 'run', params);
      return normalizeRunResult(result);
    }
    case 'get': {
      const stmt = db.prepare(sql);
      return runWithParams(stmt, 'get', params) ?? null;
    }
    case 'all': {
      const stmt = db.prepare(sql);
      return runWithParams(stmt, 'all', params) ?? [];
    }
    case 'close':
      if (!isClosed) {
        db.close();
        isClosed = true;
      }
      return null;
    default:
      throw new Error(`Unsupported sqlite action: ${action}`);
  }
}

parentPort.on('message', (message) => {
  const { id, action, sql, params } = message || {};
  if (typeof id !== 'number') {
    return;
  }

  try {
    const result = execute(action, sql, params);
    parentPort.postMessage({ id, ok: true, result });

    if (action === 'close') {
      parentPort.close();
    }
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: toSerializableError(error) });
  }
});
