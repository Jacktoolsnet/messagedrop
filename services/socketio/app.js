require('dotenv').config();
require('winston-daily-rotate-file');

const { createServer } = require('node:http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { Server } = require('socket.io');
const root = require('./routes/root');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const security = require('./middleware/security');
const jwt = require('jsonwebtoken');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const traceId = require('./middleware/trace-id');

const contactHandlers = require('./socketIo/contactHandlers');
const userHandlers = require('./socketIo/userHandlers');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(traceId());
app.use(normalizeErrorResponses);

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientIpFromRequest(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const [first] = forwarded.split(',');
    return first.trim();
  }
  return req?.socket?.remoteAddress
    || req?.connection?.remoteAddress
    || req?.ip
    || 'unknown';
}

function isLoopbackAddress(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

const healthWindowMs = 10 * 60 * 1000;
const healthLimit = 60;
const healthHits = new Map();
const handshakeWindowMs = parsePositiveInt(process.env.SOCKETIO_HANDSHAKE_WINDOW_MS, 10 * 1000);
const handshakeLimit = parsePositiveInt(process.env.SOCKETIO_HANDSHAKE_MAX, 200);
const handshakeHits = new Map();
const socketEventWindowMs = parsePositiveInt(process.env.SOCKETIO_EVENT_WINDOW_MS, 10 * 1000);
const socketEventLimit = parsePositiveInt(process.env.SOCKETIO_EVENT_MAX, 300);
const socketEventPayloadMaxBytes = parsePositiveInt(process.env.SOCKETIO_EVENT_MAX_PAYLOAD_BYTES, 1024 * 1024);
const knownSocketEvents = new Set([
  'user:joinUserRoom',
  'contact:requestProfile',
  'contact:provideUserProfile',
  'contact:newContactMessage',
  'contact:updateContactMessage',
  'contact:deleteContactMessage',
  'contact:readContactMessage',
  'contact:reactContactMessage'
]);

const rateLimitMessage = (message) => ({
  errorCode: 'RATE_LIMIT',
  message,
  error: message
});

function incrementWindowCounter(store, key, windowMs) {
  const now = Date.now();
  const entry = store.get(key) || { count: 0, start: now };
  if (now - entry.start >= windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  store.set(key, entry);
  return entry.count;
}

function cleanupWindowCounter(store, windowMs) {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.start >= windowMs) {
      store.delete(key);
    }
  }
}

function estimatePayloadBytes(payload) {
  if (payload === undefined || payload === null) {
    return 0;
  }
  try {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function healthLimiter(req, res, next) {
  const key = getClientIpFromRequest(req);
  const count = incrementWindowCounter(healthHits, key, healthWindowMs);
  if (count > healthLimit) {
    return res.status(429).json(rateLimitMessage('Too many health requests, please try again later.'));
  }
  next();
}

const limiterCleanupIntervalMs = Math.min(healthWindowMs, handshakeWindowMs);
setInterval(() => {
  cleanupWindowCounter(healthHits, healthWindowMs);
  cleanupWindowCounter(handshakeHits, handshakeWindowMs);
}, limiterCleanupIntervalMs).unref();

const allowedOrigins = process.env.ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.get('/health', healthLimiter, (_, res) => res.json({ status: 'ok' }));

app.post('/emit/user', security.checkToken, (req, res) => {
  const { userId, event, payload } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const eventName = typeof event === 'string' && event.trim() ? event.trim() : String(userId);
  if (eventName.length > 120) {
    return res.status(400).json({ error: 'event is too long' });
  }
  const payloadBytes = estimatePayloadBytes(payload);
  if (payloadBytes > socketEventPayloadMaxBytes) {
    return res.status(413).json({ error: 'payload too large' });
  }
  io.to(String(userId)).emit(eventName, payload ?? {});
  return res.json({ ok: true });
});

app.use('/', root);
// 404 + Error handler (letzte Middleware)
app.use(notFoundHandler);
app.use(errorHandler);

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) =>
    `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
  )
);

const LOG_RETENTION_INFO = process.env.LOG_RETENTION_INFO || '2d';
const LOG_RETENTION_WARN = process.env.LOG_RETENTION_WARN || LOG_RETENTION_INFO;
const LOG_RETENTION_ERROR = process.env.LOG_RETENTION_ERROR || '2d';

const infoOnlyFilter = winston.format((info) => (info.level === 'info' ? info : false));
const warnOnlyFilter = winston.format((info) => (info.level === 'warn' ? info : false));

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/socketio-info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: LOG_RETENTION_INFO,
      level: 'info',
      format: winston.format.combine(infoOnlyFilter(), logFormat)
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/socketio-warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: LOG_RETENTION_WARN,
      level: 'warn',
      format: winston.format.combine(warnOnlyFilter(), logFormat)
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/socketio-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: LOG_RETENTION_ERROR,
      level: 'error'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

const logSocketConnections = process.env.SOCKETIO_LOG_CONNECTIONS === 'true';

function registerProcessHandlers() {
  const exitOnUnhandled = process.env.EXIT_ON_UNHANDLED === 'true';
  const logProcessError = (label, err) => {
    const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    const traceId = err?.traceId;
    logger.error(label, {
      service: 'socketio-service',
      traceId,
      message: error.message,
      stack: error.stack
    });
  };

  process.on('unhandledRejection', (reason) => {
    logProcessError('Unhandled promise rejection', reason);
    if (exitOnUnhandled) {
      setTimeout(() => process.exit(1), 100);
    }
  });

  process.on('uncaughtException', (err) => {
    logProcessError('Uncaught exception', err);
    if (exitOnUnhandled) {
      setTimeout(() => process.exit(1), 100);
    }
  });

  if (!exitOnUnhandled) {
    logger.warn('Unhandled errors will not terminate the process. Set EXIT_ON_UNHANDLED=true to restore fail-fast.');
  }
}

registerProcessHandlers();

// Forward logs to admin backend
const adminLogBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
attachForwarding(logger, {
  baseUrl: adminLogBase,
  audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend',
  source: 'socket-service'
});

const server = createServer(app);

const io = new Server(server, {
  serveClient: false,
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  pingInterval: 20000,
  pingTimeout: 30000,
  maxHttpBufferSize: 5.5 * 1024 * 1024,
  allowRequest: (req, callback) => {
    const ip = getClientIpFromRequest(req);
    if (isLoopbackAddress(ip)) {
      callback(null, true);
      return;
    }
    const count = incrementWindowCounter(handshakeHits, ip, handshakeWindowMs);
    if (count > handshakeLimit) {
      if (count === handshakeLimit + 1 || count % 25 === 0) {
        logger.warn('socket handshake rate limited', {
          ip,
          count,
          windowMs: handshakeWindowMs,
          limit: handshakeLimit
        });
      }
      callback('rate_limited', false);
      return;
    }
    callback(null, true);
  }
});

io.use((socket, next) => {
  socket.logger = logger.child({ socketId: socket.id });
  const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!rawToken) {
    socket.logger.warn('socket auth failed', { error: 'missing_token' });
    return next(new Error('unauthorized'));
  }
  if (!process.env.JWT_SECRET) {
    socket.logger.error('socket auth failed', { error: 'JWT_SECRET not set' });
    return next(new Error('unauthorized'));
  }
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    socket.user = payload;
    return next();
  } catch (err) {
    socket.logger.warn('socket auth failed', { error: err?.message });
    return next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.data.eventRate = {
    start: Date.now(),
    count: 0,
    dropped: 0
  };

  if (logSocketConnections) {
    socket.logger.info('socket connected');
  }

  socket.use((packet, next) => {
    const eventName = packet?.[0];
    const payload = packet?.[1];

    if (typeof eventName !== 'string') {
      return next(new Error('invalid_event'));
    }

    if (!knownSocketEvents.has(eventName)) {
      socket.logger.warn('socket event rejected', { event: eventName, reason: 'unknown_event' });
      return next(new Error('unknown_event'));
    }

    const rate = socket.data.eventRate || { start: Date.now(), count: 0, dropped: 0 };
    const now = Date.now();
    if (now - rate.start >= socketEventWindowMs) {
      rate.start = now;
      rate.count = 0;
      rate.dropped = 0;
    }

    rate.count += 1;
    socket.data.eventRate = rate;

    if (rate.count > socketEventLimit) {
      rate.dropped += 1;
      if (rate.dropped === 1 || rate.dropped % 20 === 0) {
        socket.logger.warn('socket event rate limited', {
          event: eventName,
          count: rate.count,
          windowMs: socketEventWindowMs,
          limit: socketEventLimit
        });
      }
      socket.emit(`${eventName}:error`, { status: 429, reason: 'rate_limit' });
      return next(new Error('rate_limit'));
    }

    const payloadBytes = estimatePayloadBytes(payload);
    if (payloadBytes > socketEventPayloadMaxBytes) {
      socket.logger.warn('socket payload too large', {
        event: eventName,
        payloadBytes,
        maxPayloadBytes: socketEventPayloadMaxBytes
      });
      socket.emit(`${eventName}:error`, { status: 413, reason: 'payload_too_large' });
      return next(new Error('payload_too_large'));
    }

    return next();
  });

  socket.on('disconnect', (reason) => {
    if (logSocketConnections) {
      socket.logger.info('socket disconnected', { reason });
    }
  });

  socket.on('error', (err) => {
    socket.logger.error('socket error', { message: err.message, stack: err.stack });
  });

  userHandlers(io, socket);
  contactHandlers(io, socket);
});

io.engine.on('connection_error', (err) => {
  const ip = err.req?.socket?.remoteAddress;
  if (err.code === 3 && isLoopbackAddress(ip)) {
    return;
  }
  logger.error('connection error', {
    code: err.code,
    message: err.message,
    ip
  });
});

const port = Number(process.env.SOCKETIO_PORT);
(async () => {
  try {
    await generateOrLoadKeypairs();
    server.listen(port, () => {
      logger.info(`Socket service listening on port ${port}`);
    });
  } catch (err) {
    logger.error('Failed to initialize signing keys', { error: err?.message });
    process.exit(1);
  }
})();
