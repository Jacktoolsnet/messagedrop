require('dotenv').config();
require('winston-daily-rotate-file');

const fs = require('fs');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const databaseMw = require('./middleware/database');
const loggerMw = require('./middleware/logger');
const traceId = require('./middleware/trace-id');
const headerMW = require('./middleware/header');
const Database = require('./db/database');
const root = require('./routes/root');
const check = require('./routes/check');
const sticker = require('./routes/sticker');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');

const database = new Database();
const app = require('express')();

const STORAGE_ROOT = path.join(__dirname, 'storage');

app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (_req, res) => {
    const type = res.getHeader('Content-Type');
    return type && /json|text|javascript|css|html/.test(type);
  }
}));

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => (
    `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
  ))
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
      filename: 'logs/sticker-info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: LOG_RETENTION_INFO,
      level: 'info',
      format: winston.format.combine(infoOnlyFilter(), logFormat)
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/sticker-warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: LOG_RETENTION_WARN,
      level: 'warn',
      format: winston.format.combine(warnOnlyFilter(), logFormat)
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/sticker-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: LOG_RETENTION_ERROR,
      level: 'error'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

function registerProcessHandlers() {
  const exitOnUnhandled = process.env.EXIT_ON_UNHANDLED === 'true';
  const logProcessError = (label, err) => {
    const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    logger.error(label, {
      service: 'sticker-service',
      traceId: err?.traceId,
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

const adminLogBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
attachForwarding(logger, {
  baseUrl: adminLogBase,
  audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend',
  source: 'sticker-service'
});

app.use(helmet());
app.use(traceId());
app.use(require('express').json({ limit: '1mb' }));
app.use(databaseMw(database));
app.use(loggerMw(logger));
app.use(headerMW());
app.use(normalizeErrorResponses);

const stickerLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    errorCode: 'RATE_LIMIT',
    message: 'Too many sticker requests, please try again later.',
    error: 'Too many sticker requests, please try again later.'
  }
});

app.use('/', root);
app.use('/check', check);
app.use('/sticker', stickerLimit, sticker);
app.use(notFoundHandler);
app.use(errorHandler);

(async () => {
  try {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    await generateOrLoadKeypairs();

    const configuredPort = Number(process.env.STICKER_PORT || process.env.PORT || 3600);
    if (!Number.isFinite(configuredPort) || configuredPort <= 0) {
      throw new Error('Invalid STICKER_PORT/PORT configuration');
    }

    const server = app.listen(configuredPort, () => {
      const address = server.address();
      const port = typeof address === 'string' ? address : (address?.port || configuredPort);
      logger.info(`Server läuft auf Port ${port}`);
      database.init(logger);
    });
  } catch (err) {
    logger.error('Fehler beim Initialisieren des Sticker-Services:', err);
    process.exit(1);
  }
})();
