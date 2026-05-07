const path = require('path');
const { loadEnv } = require('./utils/loadEnv');
loadEnv();

function startupConsole(level, message, meta) {
  if (level !== 'error' && process.env.STARTUP_DEBUG !== 'true') {
    return;
  }
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `${timestamp} [backend-startup] ${message}${suffix}`;
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

function isEnvSet(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim() !== '';
}

function buildStartupEnv(valueNames, secretNames) {
  const env = {};
  for (const name of valueNames) {
    env[name] = process.env[name] || null;
  }
  for (const name of secretNames) {
    env[name] = isEnvSet(name);
  }
  return env;
}

startupConsole('info', 'Bootstrap started', {
  service: 'sticker-service',
  cwd: process.cwd(),
  appDir: __dirname,
  nodeVersion: process.version,
  platform: process.platform,
  envFileLookedUpByDotenv: path.resolve(process.cwd(), '.env'),
  envLoader: { type: 'loadEnv', candidates: [path.resolve(__dirname, '.env'), path.resolve(__dirname, '../../.env')] },
  env: buildStartupEnv(['NODE_ENV', 'STARTUP_DEBUG', 'STICKER_PORT', 'PORT', 'STICKER_DATABASE_URL', 'STICKER_DB_HOST', 'STICKER_DB_PORT', 'STICKER_DB_NAME', 'STICKER_DB_USER', 'STICKER_DB_SSL', 'STICKER_DB_POOL_MAX', 'FLATICON_HTTP_TIMEOUT_MS', 'ADMIN_BASE_URL', 'ADMIN_PORT'], ['ENCRYPTION_KEY_PASSWORD', 'SIGNING_KEY_PASSWORD', 'STICKER_DB_PASSWORD', 'FLATICON_API_KEY'])
});

process.on('uncaughtExceptionMonitor', (err) => {
  startupConsole('error', 'Uncaught exception monitor', {
    service: 'sticker-service',
    name: err?.name,
    message: err?.message,
    stack: err?.stack
  });
});

require('winston-daily-rotate-file');

const fs = require('fs');
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
const { verifyServiceJwt } = require('./utils/serviceJwt');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const robotsSitemap = require('./middleware/robots-sitemap');

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

const LOG_DIR = path.join(__dirname, 'logs');
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
      filename: path.join(LOG_DIR, 'sticker-info-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: LOG_RETENTION_INFO,
      level: 'info',
      format: winston.format.combine(infoOnlyFilter(), logFormat)
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'sticker-warn-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: LOG_RETENTION_WARN,
      level: 'warn',
      format: winston.format.combine(warnOnlyFilter(), logFormat)
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'sticker-error-%DATE%.log'),
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

function normalizeStartupError(err) {
  if (err instanceof Error) return err;
  try {
    return new Error(typeof err === 'string' ? err : JSON.stringify(err));
  } catch {
    return new Error(String(err));
  }
}

function logStartupStep(message, meta) {
  startupConsole('info', message, meta);
  logger.info(`[startup] ${message}`, meta || {});
}

function logStartupWarn(message, meta) {
  startupConsole('warn', message, meta);
  logger.warn(`[startup] ${message}`, meta || {});
}

function logStartupError(message, err, meta) {
  const error = normalizeStartupError(err);
  const payload = {
    ...(meta || {}),
    service: 'sticker-service',
    name: error.name,
    message: error.message,
    stack: error.stack
  };
  startupConsole('error', message, payload);
  logger.error(`[startup] ${message}`, payload);
}

function registerProcessHandlers() {
  const exitOnUnhandled = process.env.EXIT_ON_UNHANDLED === 'true';
  const logProcessError = (label, err) => {
    const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    startupConsole('error', label, { service: 'sticker-service', message: error.message, stack: error.stack, traceId: err?.traceId });
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
    logStartupWarn('Unhandled errors will not terminate the process. Set EXIT_ON_UNHANDLED=true to restore fail-fast.');
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
app.use(robotsSitemap());
app.use(traceId());
app.use(require('express').json({ limit: '1mb' }));
app.use(databaseMw(database));
app.use(loggerMw(logger));
app.use(headerMW());
app.use(normalizeErrorResponses);

function shouldSkipStickerRateLimit(req) {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader !== 'string' || !authHeader.trim()) {
    return false;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) {
    return false;
  }

  try {
    verifyServiceJwt(token, {
      audience: process.env.SERVICE_JWT_AUDIENCE_STICKER || process.env.SERVICE_JWT_AUDIENCE || 'service.sticker'
    });
    return true;
  } catch {
    return false;
  }
}

const stickerLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20000,
  skip: shouldSkipStickerRateLimit,
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
    logStartupStep('Runtime initialization started');
    logStartupStep('Ensuring storage directory exists', { storageRoot: STORAGE_ROOT });
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });

    logStartupStep('Generating/loading service keypairs', {
      keysDir: path.join(__dirname, 'keys'),
      ENCRYPTION_KEY_PASSWORD: isEnvSet('ENCRYPTION_KEY_PASSWORD'),
      SIGNING_KEY_PASSWORD: isEnvSet('SIGNING_KEY_PASSWORD')
    });
    await generateOrLoadKeypairs();
    logStartupStep('Service keypairs ready');

    const configuredPort = Number(process.env.STICKER_PORT || process.env.PORT || 3600);
    if (!Number.isFinite(configuredPort) || configuredPort <= 0) {
      throw new Error('Invalid STICKER_PORT/PORT configuration');
    }

    logStartupStep('Starting HTTP server', { port: configuredPort });
    const server = app.listen(configuredPort, () => {
      const address = server.address();
      const port = typeof address === 'string' ? address : (address?.port || configuredPort);
      startupConsole('info', 'Server listening', { service: 'sticker-service', port });
      logger.info(`Server läuft auf Port ${port}`);

      logStartupStep('Initializing PostgreSQL database', {
        STICKER_DATABASE_URL: isEnvSet('STICKER_DATABASE_URL'),
        STICKER_DB_HOST: process.env.STICKER_DB_HOST || process.env.DB_HOST || 'localhost',
        STICKER_DB_PORT: process.env.STICKER_DB_PORT || process.env.DB_PORT || '5432',
        STICKER_DB_NAME: process.env.STICKER_DB_NAME || process.env.DB_NAME || 'messagedrop_sticker',
        STICKER_DB_USER: process.env.STICKER_DB_USER || process.env.DB_USER || 'messagedrop',
        STICKER_DB_PASSWORD: isEnvSet('STICKER_DB_PASSWORD') || isEnvSet('DB_PASSWORD'),
        STICKER_DB_SSL: process.env.STICKER_DB_SSL || process.env.DB_SSL || null,
        STICKER_DB_POOL_MAX: process.env.STICKER_DB_POOL_MAX || process.env.DB_POOL_MAX || '10'
      });
      database.init(logger);
      logStartupStep('PostgreSQL database initialization triggered');
    });
    server.on('error', (err) => {
      logStartupError('HTTP server error', err, { port: configuredPort });
    });
  } catch (err) {
    logStartupError('Sticker service startup failed', err);
    process.exit(1);
  }
})();
