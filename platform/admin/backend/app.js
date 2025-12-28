require('dotenv').config()
require('winston-daily-rotate-file');
const compression = require('compression');
const bearerToken = require('express-bearer-token');
const databaseMw = require('./middleware/database');
const loggerMw = require('./middleware/logger');
const traceId = require('./middleware/trace-id');
const headerMW = require('./middleware/header')
const Database = require('./db/database');
const database = new Database();
const tableStatistic = require('./db/tableStatistic');
const tableErrorLog = require('./db/tableErrorLog');
const tableInfoLog = require('./db/tableInfoLog');
const tableFrontendErrorLog = require('./db/tableFrontendErrorLog');
const tablePowLog = require('./db/tablePowLog');
const root = require('./routes/root');
const check = require('./routes/check');
const translate = require('./routes/translate');
const clientConnect = require('./routes/client-connect');
const dsaFrontend = require('./routes/dsa-frontend');
const dsaBackend = require('./routes/dsa-backend');
const user = require('./routes/user');
const publicStatus = require('./routes/public-status');
const statistic = require('./routes/statistic');
const errorLog = require('./routes/error-log');
const infoLog = require('./routes/info-log');
const frontendErrorLog = require('./routes/frontend-error-log');
const powLog = require('./routes/pow-log');
const cors = require('cors')
const helmet = require('helmet');
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');

// ExpressJs
const { createServer } = require('node:http');
const express = require('express');
const app = express();

// Compress

app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    const type = res.getHeader('Content-Type');
    return type && /json|text|javascript|css|html/.test(type);
  }
}));

// Logger

// Format für bessere Lesbarkeit
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
  })
);

const LOG_RETENTION_INFO = process.env.LOG_RETENTION_INFO || '7d';
const LOG_RETENTION_ERROR = process.env.LOG_RETENTION_ERROR || '30d';

// Transport für Info-Logs
const infoTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/admin-info-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_INFO,
  level: 'info'
});

// Transport für Error-Logs
const errorTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/admin-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_ERROR,
  level: 'error'
});

// Logger erstellen
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    infoTransport,
    errorTransport
  ]
});

// Optional: auch in der Konsole ausgeben
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

function registerProcessHandlers() {
  const logProcessError = (label, err) => {
    const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    const traceId = err?.traceId;
    logger.error(label, {
      service: 'admin-backend',
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

// Forward logs to admin backend DB (self or external)
const adminLogBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
attachForwarding(logger, {
  baseUrl: adminLogBase || `http://localhost:${process.env.ADMIN_PORT || 3101}`,
  audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend',
  source: 'admin-backend'
});

/**
 * Socket.io
 * Disable Apache proxymode in Plesk to avoid socket.io connection errors.
 */
const { Server } = require('socket.io');
const contactHandlers = require("./socketIo/contactHandlers");
const userHandlers = require('./socketIo/userHandlers');
const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5.5 * 1024 * 1024,
  pingInterval: 20000,
  pingTimeout: 30000,
  allowEIO3: false,
  cors: {
    origin: [process.env.ADMIN_ORIGIN],
    credentials: true
  }
});

io.use((socket, next) => {
  const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!rawToken) {
    logger.warn('admin socket auth failed', { error: 'missing_token' });
    return next(new Error('unauthorized'));
  }
  if (!process.env.ADMIN_JWT_SECRET) {
    logger.error('admin socket auth failed', { error: 'ADMIN_JWT_SECRET not set' });
    return next(new Error('unauthorized'));
  }
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET, {
      algorithms: ['HS256'],
      audience: process.env.ADMIN_AUD || 'messagedrop-admin',
      issuer: process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/'
    });
    socket.admin = payload;
    return next();
  } catch (err) {
    logger.warn('admin socket auth failed', { error: err?.message });
    return next(new Error('unauthorized'));
  }
});

const onConnection = (socket) => {
  // Logger an den Socket hängen
  socket.logger = logger.child({ socketId: socket.id });

  // socket.logger.info(`Verbindung aufgebaut`);

  socket.onAny((event, ...args) => {
    socket.logger.debug('socket-event', { event, argsCount: args.length });
  });

  // Globale Fehlerbehandlung für diesen Socket
  socket.on('error', (err) => {
    socket.logger.error('Socket-Fehler', {
      message: err.message,
      stack: err.stack
    });
  });

  socket.on('disconnect', (reason) => {
    socket.logger.info('Verbindung getrennt', { reason });
  });

  socket.on('connect_error', (err) => {
    socket.logger.error('Verbindungsfehler', {
      message: err.message,
      stack: err.stack
    });
  });

  // Eigentliche Handler laden
  userHandlers(io, socket);
  contactHandlers(io, socket);
};

// Socket.io: neue Verbindung
io.on("connection", onConnection);

// Fehler beim Verbindungsaufbau (z. B. Auth-Probleme)
io.engine.on("connection_error", (err) => {
  logger.error('Engine-Fehler beim Verbindungsaufbau', {
    ip: err.req?.socket?.remoteAddress,
    url: err.req?.url,
    code: err.code,
    message: err.message,
    context: err.context
  });
});

/*
“Helmet” is a collection of nine smaller middleware functions that are used to set security-relevant HTTP headers.

- The Content Security Policy header is set via csp to prevent cross-site scripting attacks and other cross-site injections.
- The X-Powered-By header is removed using hidePoweredBy.
- hsts is used to set Strict Transport Security headers, which are used to enforce secure (HTTP over SSL/TLS) connections to the server.
- ieNoOpen sets X-Download-Options headers for IE8+.
- NoCache sets Cache-Control and Pragma headers to disable client-side caching.
- NoSniff sets X-Content-Type-Options headers to prevent browsers from MIME sniffing of responses away from the declared content-type.
- The X-Frame-Options header is set via frameguard to ensure clickjacking protection.
- xssFilter sets X-XSS-Protection headers to enable XSS (cross-site scripting) filters in most current web browsers.
*/
app.use(helmet()); // Add security headers.

/*
Per RFC6750 this module will attempt to extract a bearer token from a request from these locations:

The key access_token in the request body.
The key access_token in the request params.
The value from the header Authorization: Bearer <token>.
(Optional) Get a token from cookies header with key access_token.
If a token is found, it will be stored on req.token. If one has been provided in more than one location, this will abort the request immediately by sending code 400 (per RFC6750).
*/
app.use(bearerToken());
app.use(traceId());

/*
Enable cors for all routes.
*/
const allowedOrigins = process.env.ADMIN_ORIGIN?.split(',').map(o => o.trim()) || [];

const corsOptions = {
  origin: function (origin, callback) {
    if (origin && allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Authorization'],
  exposedHeaders: ['Content-Type', 'Content-Length'],
  maxAge: 86400,
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))

app.use(express.json({ limit: '1mb' }));
app.use(databaseMw(database));
app.use(loggerMw(logger));
app.use(headerMW())
app.use(normalizeErrorResponses);

const rateLimitDefaults = {
  standardHeaders: true,
  legacyHeaders: false
};

const rateLimitMessage = (message) => ({
  errorCode: 'RATE_LIMIT',
  message,
  error: message
});

const adminDefaultLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many requests, please slow down.')
});

const adminPublicLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many public status requests, please try again later.')
});

const adminDsaLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many DSA requests, please try again later.')
});

const adminTranslateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many translate requests, please try again later.')
});

const adminUserLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many user requests, please try again later.')
});

const adminLogLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many log requests, please try again later.')
});

app.use(adminDefaultLimit);

// ROUTES
app.use('/', root);
app.use('/check', check);
app.use('/clientconnect', adminUserLimit, clientConnect);
app.use('/user', adminUserLimit, user);
app.use('/translate', adminTranslateLimit, translate);
app.use('/statistic', statistic);
app.use('/error-log', adminLogLimit, errorLog);
app.use('/info-log', adminLogLimit, infoLog);
app.use('/frontend-error-log', adminLogLimit, frontendErrorLog);
app.use('/pow-log', adminLogLimit, powLog);


// DSA
app.use('/dsa/frontend', adminDsaLimit, dsaFrontend);
app.use('/dsa/backend', adminDsaLimit, dsaBackend);

// Public status endpoints
app.use('/public', adminPublicLimit, publicStatus);

// 404 + Error handler (letzte Middleware)
app.use(notFoundHandler);
app.use(errorHandler);

(async () => {
  try {
    await generateOrLoadKeypairs();
    server.listen(process.env.ADMIN_PORT, () => {
      const address = server.address();
      const port = typeof address === 'string' ? address : address.port;
      logger.info(`Server läuft auf Port ${port}`);
      database.init(logger);
    });
  } catch (err) {
    logger.error('Fehler beim Initialisieren des Keystores:', err);
    process.exit(1);
  }
})();


// Cron
// ┌────────────── second (optional)
// │ ┌──────────── minute
// │ │ ┌────────── hour
// │ │ │ ┌──────── day of month
// │ │ │ │ ┌────── month
// │ │ │ │ │ ┌──── day of week
// │ │ │ │ │ │
// │ │ │ │ │ │
// * * * * * *
cron.schedule('5 0 * * *', () => {
  tableStatistic.clean(database.db, (err) => {
    if (err) {
      logger.error(err);
    }
  });
});

// Clean error logs older than 7 days
cron.schedule('15 0 * * *', () => {
  const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  tableErrorLog.cleanupOlderThan(database.db, threshold, (err) => {
    if (err) {
      logger.error('ErrorLog cleanup failed', { error: err?.message });
    }
  });
});

// Clean frontend error logs older than 7 days
cron.schedule('17 0 * * *', () => {
  const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  tableFrontendErrorLog.cleanupOlderThan(database.db, threshold, (err) => {
    if (err) {
      logger.error('FrontendErrorLog cleanup failed', { error: err?.message });
    }
  });
});

// Clean info logs older than 7 days
cron.schedule('20 0 * * *', () => {
  const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  tableInfoLog.cleanupOlderThan(database.db, threshold, (err) => {
    if (err) {
      logger.error('InfoLog cleanup failed', { error: err?.message });
    }
  });
});

// Clean PoW logs older than 7 days
cron.schedule('23 0 * * *', () => {
  const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  tablePowLog.cleanupOlderThan(database.db, threshold, (err) => {
    if (err) {
      logger.error('PoW log cleanup failed', { error: err?.message });
    }
  });
});
