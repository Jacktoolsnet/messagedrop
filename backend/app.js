const path = require('path');
const dotenvResult = require('dotenv').config();

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

startupConsole('info', 'Bootstrap started', {
  cwd: process.cwd(),
  appDir: __dirname,
  nodeVersion: process.version,
  platform: process.platform,
  envFileLookedUpByDotenv: path.resolve(process.cwd(), '.env'),
  dotenv: dotenvResult.error
    ? { loaded: false, error: dotenvResult.error.message }
    : { loaded: true, injectedKeys: Object.keys(dotenvResult.parsed || {}).length },
  env: {
    NODE_ENV: process.env.NODE_ENV || null,
    STARTUP_DEBUG: process.env.STARTUP_DEBUG || null,
    PORT: process.env.PORT || null,
    JWT_SECRET: isEnvSet('JWT_SECRET'),
    ENCRYPTION_KEY_PASSWORD: isEnvSet('ENCRYPTION_KEY_PASSWORD'),
    SIGNING_KEY_PASSWORD: isEnvSet('SIGNING_KEY_PASSWORD'),
    VAPID_KEY_PASSWORD: isEnvSet('VAPID_KEY_PASSWORD'),
    OPENAI_API_KEY_MODERATION: isEnvSet('OPENAI_API_KEY_MODERATION'),
    BACKEND_DATABASE_URL: isEnvSet('BACKEND_DATABASE_URL'),
    BACKEND_DB_HOST: process.env.BACKEND_DB_HOST || null,
    BACKEND_DB_PORT: process.env.BACKEND_DB_PORT || null,
    BACKEND_DB_NAME: process.env.BACKEND_DB_NAME || null,
    BACKEND_DB_USER: process.env.BACKEND_DB_USER || null,
    BACKEND_DB_PASSWORD: isEnvSet('BACKEND_DB_PASSWORD'),
    BACKEND_DB_SSL: process.env.BACKEND_DB_SSL || null,
    BACKEND_DB_POOL_MAX: process.env.BACKEND_DB_POOL_MAX || null
  }
});

process.on('uncaughtExceptionMonitor', (err) => {
  startupConsole('error', 'Uncaught exception monitor', {
    name: err?.name,
    message: err?.message,
    stack: err?.stack
  });
});

require('winston-daily-rotate-file');
const compression = require('compression');
const databaseMw = require('./middleware/database');
const loggerMw = require('./middleware/logger');
const slowRequestMw = require('./middleware/slow-request');
const traceId = require('./middleware/trace-id');
const headerMW = require('./middleware/header')
const Database = require('./db/database');
const database = new Database();
const root = require('./routes/root');
const health = require('./routes/health');
const check = require('./routes/check');
const clientConnect = require('./routes/client-connect');
const openAi = require('./routes/openAi');
const user = require('./routes/user');
const connect = require('./routes/connect');
const contact = require('./routes/contact');
const contactMessage = require('./routes/contactMessage');
const contactProfile = require('./routes/contactProfile');
const message = require('./routes/message');
const moderation = require('./routes/moderation');
const place = require('./routes/place');
const translate = require('./routes/translate');
const utils = require('./routes/utils');
const geoStatistic = require('./routes/geostatistic');
const weather = require('./routes/weather');
const airQualtiy = require('./routes/air-quality');
const nominatim = require('./routes/nominatim');
const viator = require('./routes/viator');
const tenor = require('./routes/tenor');
const klipy = require('./routes/klipy');
const unsplash = require('./routes/unsplash');
const sticker = require('./routes/sticker');
const publicShare = require('./routes/public-share');
const secretDrop = require('./routes/secretDrop');
const digitalServiceAct = require('./routes/digital-service-act');
const dsaStatus = require('./routes/dsa-status');
const notification = require('./routes/notification');
const frontendErrorLog = require('./routes/frontend-error-log');
const maintenance = require('./routes/maintenance');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { generateOrLoadKeypairs, generateOrLoadVapidKeys } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const maintenanceMode = require('./middleware/maintenance');
const security = require('./middleware/security');
const { verifyServiceJwt } = require('./utils/serviceJwt');
const robotsSitemap = require('./middleware/robots-sitemap');

// Tables for cronjobs
const tableUser = require('./db/tableUser');
const tableConnect = require('./db/tableConnect');
const tableMessage = require('./db/tableMessage')
const tableSecretDrop = require('./db/tableSecretDrop');
const tableContactMessage = require('./db/tableContactMessage');
const tableContactProfileExchange = require('./db/tableContactProfileExchange');
const tableGeoStatistic = require('./db/tableGeoStatistic');
const tableWeatherHistory = require('./db/tableWeatherHistory');

const CONTACT_MESSAGE_TOMBSTONE_RETENTION_DAYS = (() => {
  const raw = process.env.CONTACT_MESSAGE_TOMBSTONE_RETENTION_DAYS;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();

// ExpressJs
const express = require('express');
const app = express();

function resolveTrustProxySetting(rawValue) {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) {
    return 'loopback, linklocal, uniquelocal';
  }

  const normalized = raw.toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  if (/^\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }

  return raw;
}

app.set('trust proxy', resolveTrustProxySetting(process.env.TRUST_PROXY));

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

function safeStringify(value) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === 'bigint') {
        return current.toString();
      }
      if (current instanceof Error) {
        return {
          name: current.name,
          message: current.message,
          stack: current.stack,
          code: current.code,
          status: current.status
        };
      }
      if (typeof current === 'object' && current !== null) {
        if (seen.has(current)) {
          return '[Circular]';
        }
        seen.add(current);
      }
      return current;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return '[Unserializable]';
    }
  }
}

// Format für bessere Lesbarkeit
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? safeStringify(meta) : ''}`;
  })
);

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_RETENTION_INFO = process.env.LOG_RETENTION_INFO || '2d';
const LOG_RETENTION_WARN = process.env.LOG_RETENTION_WARN || LOG_RETENTION_INFO;
const LOG_RETENTION_ERROR = process.env.LOG_RETENTION_ERROR || '2d';

const infoOnlyFilter = winston.format((info) => (info.level === 'info' ? info : false));
const warnOnlyFilter = winston.format((info) => (info.level === 'warn' ? info : false));

// Transport für Info-Logs
const infoTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'backend-info-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_INFO,
  level: 'info',
  format: winston.format.combine(infoOnlyFilter(), logFormat)
});

// Transport für Warn-Logs
const warnTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'backend-warn-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_WARN,
  level: 'warn',
  format: winston.format.combine(warnOnlyFilter(), logFormat)
});

// Transport für Error-Logs
const errorTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'backend-error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_ERROR,
  level: 'error',
  format: logFormat
});

// Logger erstellen
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    infoTransport,
    warnTransport,
    errorTransport
  ]
});

// Optional: auch in der Konsole ausgeben
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
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
  const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : safeStringify(err));
  const payload = {
    ...(meta || {}),
    name: error.name,
    message: error.message,
    stack: error.stack
  };
  startupConsole('error', message, payload);
  logger.error(`[startup] ${message}`, payload);
}

function validateSecurityConfig() {
  if (!process.env.JWT_SECRET) {
    startupConsole('error', 'Missing required security configuration', { missing: 'JWT_SECRET' });
    logger.error('Missing required security configuration', { missing: 'JWT_SECRET' });
    process.exit(1);
  }
  logStartupStep('Security configuration checked', {
    JWT_SECRET: true,
    EXIT_ON_UNHANDLED: process.env.EXIT_ON_UNHANDLED || null
  });
}

validateSecurityConfig();

function registerProcessHandlers() {
  const exitOnUnhandled = process.env.EXIT_ON_UNHANDLED === 'true';
  const logProcessError = (label, err) => {
    const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : safeStringify(err));
    const traceId = err?.traceId;
    startupConsole('error', label, {
      service: 'backend',
      traceId,
      message: error.message,
      stack: error.stack
    });
    logger.error(label, {
      service: 'backend',
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
    logStartupWarn('Unhandled errors will not terminate the process. Set EXIT_ON_UNHANDLED=true to restore fail-fast.');
  }
}

registerProcessHandlers();

// Forward logs to admin backend
const adminLogBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
attachForwarding(logger, {
  baseUrl: adminLogBase,
  audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend',
  source: 'public-backend'
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

app.use(traceId());

/*
Enable cors for all routes.
*/
const allowedOrigins = process.env.ORIGIN?.split(',').map(o => o.trim()) || [];

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
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))
app.use(robotsSitemap());

app.use(databaseMw(database));
app.use(loggerMw(logger));
app.use(headerMW())
app.use(normalizeErrorResponses);
app.use(maintenanceMode());

// Route ratelimit
const rateLimitDefaults = {
  standardHeaders: true,
  legacyHeaders: false
};

const rateLimitMessage = (message) => ({
  errorCode: 'RATE_LIMIT',
  message,
  error: message
});

function shouldSkipServiceRateLimit(req) {
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
      audience: process.env.SERVICE_JWT_AUDIENCE_BACKEND || process.env.SERVICE_JWT_AUDIENCE || 'service.backend'
    });
    return true;
  } catch {
    return false;
  }
}

function shouldSkipAuthenticatedStickerRateLimit(req) {
  if (typeof req?.path === 'string' && req.path.startsWith('/render/')) {
    return true;
  }

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
      audience: process.env.SERVICE_JWT_AUDIENCE_BACKEND || process.env.SERVICE_JWT_AUDIENCE || 'service.backend'
    });
    return true;
  } catch {
    // ignore and try user JWT below
  }

  try {
    security.verifyUserJwtToken(token);
    return true;
  } catch {
    return false;
  }
}

const basicLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many requests, please try again later.')
});

const translateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many translate requests, please try again later.')
});

const userLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  skip: shouldSkipServiceRateLimit,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many user requests, please try again later.')
});

const geoStatisticLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many geostatistic requests, please try again later.')
});

const airQualtiyLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many air quality requests, please try again later.')
});

const weatherLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 240,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many weather requests, please try again later.')
});

const notificationLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many notification requests, please slow down.')
});

const openAiLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many OpenAI requests, please try again later.')
});

const nominatimLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many nominatim requests, please try again later.')
});

const viatorLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many viator requests, please try again later.')
});

const tenorLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many tenor requests, please try again later.')
});

const klipyLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many klipy requests, please try again later.')
});

const unsplashLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many unsplash requests, please try again later.')
});

const stickerLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 100000,
  skip: shouldSkipAuthenticatedStickerRateLimit,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many sticker requests, please try again later.')
});

const messageLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many message requests, please try again later.')
});

const contactLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many contact requests, please try again later.')
});

const contactMessageLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many chat requests, please slow down.')
});

const placeLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 240,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many place requests, please try again later.')
});

const connectLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many connection requests, please try again later.')
});

const clientConnectLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10000,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many client connect requests, please try again later.')
});

const utilsLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many util requests, please try again later.')
});

const dsaStatusLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many DSA status requests, please try again later.')
});

const frontendErrorLogLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many log requests, please slow down.')
});

const secretDropLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many SecretDrop requests, please try again later.')
});

const slowRequestDefault = slowRequestMw();
const slowRequestOpenAiModeration = slowRequestMw({
  thresholdMs: process.env.SLOW_REQUEST_MESSAGE_CREATE_THRESHOLD_MS || 3000,
  category: 'external-api',
  upstream: 'openai-moderation'
});
const slowRequestMessagePublish = slowRequestMw({
  thresholdMs: process.env.SLOW_REQUEST_MESSAGE_PUBLISH_THRESHOLD_MS || process.env.SLOW_REQUEST_MESSAGE_CREATE_THRESHOLD_MS || 3000,
  category: 'external-api',
  upstream: 'openai-moderation'
});
const slowRequestNominatim = slowRequestMw({
  thresholdMs: process.env.SLOW_REQUEST_NOMINATIM_THRESHOLD_MS || 3000,
  category: 'external-api',
  upstream: 'nominatim'
});

// ROUTES
app.get('/', basicLimit, slowRequestDefault, root);
app.use('/health', basicLimit, slowRequestDefault, health);
app.use('/airquality', airQualtiyLimit, slowRequestDefault, airQualtiy);
app.use('/check', basicLimit, slowRequestDefault, check);
app.use('/clientconnect', clientConnectLimit, slowRequestDefault, clientConnect);
app.use('/connect', connectLimit, slowRequestDefault, connect);
app.use('/contact', contactLimit, slowRequestDefault, contact);
app.use('/contactMessage', contactMessageLimit, slowRequestDefault, contactMessage);
app.use('/contactProfile', contactLimit, slowRequestDefault, contactProfile);
app.use('/digitalserviceact', slowRequestDefault, digitalServiceAct);
app.use('/dsa', dsaStatusLimit, slowRequestDefault, dsaStatus);
app.use('/geostatistic', geoStatisticLimit, slowRequestDefault, geoStatistic);
app.use('/message/create', slowRequestOpenAiModeration);
app.use('/message/moderate/hashtags', slowRequestOpenAiModeration);
app.use('/message/moderate/content', slowRequestOpenAiModeration);
app.use('/message/internal/publish', slowRequestMessagePublish);
app.use('/message/update', slowRequestMessagePublish);
app.use('/message', messageLimit, slowRequestDefault, message);
app.use('/secretdrop', secretDropLimit, slowRequestDefault, secretDrop);
app.use('/moderation', basicLimit, slowRequestDefault, moderation);
app.use('/notification', notificationLimit, slowRequestDefault, notification);
app.use('/nominatim', nominatimLimit, slowRequestNominatim, nominatim);
app.use('/viator', viatorLimit, slowRequestDefault, viator);
app.use('/openai', openAiLimit, slowRequestDefault, openAi);
app.use('/place', placeLimit, slowRequestDefault, place);
app.use('/p', basicLimit, slowRequestDefault, publicShare);
app.use('/tenor', tenorLimit, slowRequestDefault, tenor);
app.use('/klipy', klipyLimit, slowRequestDefault, klipy);
app.use('/stickers', stickerLimit, slowRequestDefault, sticker);
app.use('/unsplash', unsplashLimit, slowRequestDefault, unsplash);
app.use('/translate', translateLimit, slowRequestDefault, translate);
app.use('/user', userLimit, slowRequestDefault, user);
app.use('/utils', utilsLimit, slowRequestDefault, utils);
app.use('/weather', weatherLimit, slowRequestDefault, weather);
app.use('/frontend-error-log', frontendErrorLogLimit, slowRequestDefault, frontendErrorLog);
app.use('/maintenance', basicLimit, slowRequestDefault, maintenance);

// 404 + Error handler (letzte Middleware)
app.use(notFoundHandler);
app.use(errorHandler);

(async () => {
  try {
    logStartupStep('Runtime initialization started');
    logStartupStep('Generating/loading encryption and signing keypairs', {
      keysDir: path.join(__dirname, 'keys'),
      ENCRYPTION_KEY_PASSWORD: isEnvSet('ENCRYPTION_KEY_PASSWORD'),
      SIGNING_KEY_PASSWORD: isEnvSet('SIGNING_KEY_PASSWORD')
    });
    await generateOrLoadKeypairs();
    logStartupStep('Encryption and signing keypairs ready');

    logStartupStep('Generating/loading VAPID keys', {
      VAPID_KEY_PASSWORD: isEnvSet('VAPID_KEY_PASSWORD'),
      ENCRYPTION_KEY_PASSWORD_FALLBACK: isEnvSet('ENCRYPTION_KEY_PASSWORD')
    });
    await generateOrLoadVapidKeys();
    logStartupStep('VAPID keys ready');

    logStartupStep('Initializing PostgreSQL database', {
      BACKEND_DATABASE_URL: isEnvSet('BACKEND_DATABASE_URL'),
      BACKEND_DB_HOST: process.env.BACKEND_DB_HOST || process.env.DB_HOST || 'localhost',
      BACKEND_DB_PORT: process.env.BACKEND_DB_PORT || process.env.DB_PORT || '5432',
      BACKEND_DB_NAME: process.env.BACKEND_DB_NAME || process.env.DB_NAME || 'messagedrop_backend',
      BACKEND_DB_USER: process.env.BACKEND_DB_USER || process.env.DB_USER || 'messagedrop',
      BACKEND_DB_PASSWORD: isEnvSet('BACKEND_DB_PASSWORD') || isEnvSet('DB_PASSWORD'),
      BACKEND_DB_SSL: process.env.BACKEND_DB_SSL || process.env.DB_SSL || null,
      BACKEND_DB_POOL_MAX: process.env.BACKEND_DB_POOL_MAX || process.env.DB_POOL_MAX || '10'
    });
    await database.init(logger);
    logStartupStep('PostgreSQL database initialized');

    const port = Number(process.env.PORT);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(`Invalid PORT environment variable: ${process.env.PORT ?? '<not set>'}`);
    }
    logStartupStep('Starting HTTP server', { port });
    const server = app.listen(port, () => {
      startupConsole('info', `Server listening`, { port });
      logger.info(`Server läuft auf Port ${port}`);
    });
    server.on('error', (err) => {
      logStartupError('HTTP server error', err, { port });
      logger.error('Server-Fehler', err);
    });
  } catch (err) {
    logStartupError('Backend startup failed', err);
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

// Clean users every hour at minute 0
cron.schedule('0 * * * *', () => {
  tableUser.clean(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});

// Clean connect every hour at minute 0
cron.schedule('0 * * * *', () => {
  tableConnect.clean(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});

// Clean messages every 5 minutes
cron.schedule('*/5 * * * *', () => {
  tableMessage.cleanPublic(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });

  tableSecretDrop.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});

// Clean read private chat messages every hour
cron.schedule('15 * * * *', () => {
  tableContactMessage.cleanupReadMessages(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});

// Clean long cached data.
cron.schedule('5 0 * * *', () => {
  tableGeoStatistic.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });

  tableWeatherHistory.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });

  tableContactMessage.cleanupDeletedEvents(database.db, CONTACT_MESSAGE_TOMBSTONE_RETENTION_DAYS, function (err) {
    if (err) {
      logger.error(err);
    }
  });

  tableContactProfileExchange.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});
