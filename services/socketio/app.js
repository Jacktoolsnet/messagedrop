require('dotenv').config();
require('winston-daily-rotate-file');

const { createServer } = require('node:http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { Server } = require('socket.io');
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

const healthWindowMs = 10 * 60 * 1000;
const healthLimit = 60;
const healthHits = new Map();

const rateLimitMessage = (message) => ({
  errorCode: 'RATE_LIMIT',
  message,
  error: message
});

function healthLimiter(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.connection?.remoteAddress || 'unknown';
  const entry = healthHits.get(key) || { count: 0, start: now };
  if (now - entry.start >= healthWindowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  healthHits.set(key, entry);
  if (entry.count > healthLimit) {
    return res.status(429).json(rateLimitMessage('Too many health requests, please try again later.'));
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of healthHits.entries()) {
    if (now - entry.start >= healthWindowMs) {
      healthHits.delete(key);
    }
  }
}, healthWindowMs).unref();

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
  io.to(String(userId)).emit(eventName, payload ?? {});
  return res.json({ ok: true });
});

// 404 + Error handler (letzte Middleware)
app.use(notFoundHandler);
app.use(errorHandler);

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) =>
    `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
  )
);

const LOG_RETENTION_INFO = process.env.LOG_RETENTION_INFO || '7d';
const LOG_RETENTION_ERROR = process.env.LOG_RETENTION_ERROR || '30d';

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/socketio-info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: LOG_RETENTION_INFO,
      level: 'info'
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

function registerProcessHandlers() {
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
    setTimeout(() => process.exit(1), 100);
  });

  process.on('uncaughtException', (err) => {
    logProcessError('Uncaught exception', err);
    setTimeout(() => process.exit(1), 100);
  });
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
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  pingInterval: 20000,
  pingTimeout: 30000,
  maxHttpBufferSize: 5.5 * 1024 * 1024
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
  socket.logger.info('socket connected');

  socket.on('disconnect', (reason) => {
    socket.logger.info('socket disconnected', { reason });
  });

  socket.on('error', (err) => {
    socket.logger.error('socket error', { message: err.message, stack: err.stack });
  });

  userHandlers(io, socket);
  contactHandlers(io, socket);
});

io.engine.on('connection_error', (err) => {
  logger.error('connection error', {
    code: err.code,
    message: err.message,
    ip: err.req?.socket?.remoteAddress
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
