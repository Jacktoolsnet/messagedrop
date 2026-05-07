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
  service: 'nominatim-service',
  cwd: process.cwd(),
  appDir: __dirname,
  nodeVersion: process.version,
  platform: process.platform,
  envFileLookedUpByDotenv: path.resolve(process.cwd(), '.env'),
  dotenv: dotenvResult.error
    ? { loaded: false, error: dotenvResult.error.message }
    : { loaded: true, injectedKeys: Object.keys(dotenvResult.parsed || {}).length },
  env: buildStartupEnv(['NODE_ENV', 'STARTUP_DEBUG', 'NOMINATIM_PORT', 'NOMINATIM_USER_AGENT', 'NOMINATIM_DATABASE_URL', 'NOMINATIM_DB_HOST', 'NOMINATIM_DB_PORT', 'NOMINATIM_DB_NAME', 'NOMINATIM_DB_USER', 'NOMINATIM_DB_SSL', 'NOMINATIM_DB_POOL_MAX', 'ADMIN_BASE_URL', 'ADMIN_PORT'], ['ENCRYPTION_KEY_PASSWORD', 'SIGNING_KEY_PASSWORD', 'NOMINATIM_DB_PASSWORD'])
});

process.on('uncaughtExceptionMonitor', (err) => {
  startupConsole('error', 'Uncaught exception monitor', {
    service: 'nominatim-service',
    name: err?.name,
    message: err?.message,
    stack: err?.stack
  });
});

require('winston-daily-rotate-file');
const compression = require('compression');
const databaseMw = require('./middleware/database');
const loggerMw = require('./middleware/logger');
const traceId = require('./middleware/trace-id');
const headerMW = require('./middleware/header')
const Database = require('./db/database');
const database = new Database();
const root = require('./routes/root');
const check = require('./routes/check');
const helmet = require('helmet');
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const nominatim = require('./routes/nominatim');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const robotsSitemap = require('./middleware/robots-sitemap');

// Tables für Cron-Jobs
const tableNominatimCache = require('./db/tableNominatimCache.js');
const tableGeoSearch = require('./db/tableGeoSearch');

// ExpressJs
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

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_RETENTION_INFO = process.env.LOG_RETENTION_INFO || '2d';
const LOG_RETENTION_WARN = process.env.LOG_RETENTION_WARN || LOG_RETENTION_INFO;
const LOG_RETENTION_ERROR = process.env.LOG_RETENTION_ERROR || '2d';

const infoOnlyFilter = winston.format((info) => (info.level === 'info' ? info : false));
const warnOnlyFilter = winston.format((info) => (info.level === 'warn' ? info : false));

// Transport für Info-Logs
const infoTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'nominatim-info-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_INFO,
  level: 'info',
  format: winston.format.combine(infoOnlyFilter(), logFormat)
});

// Transport für Warn-Logs
const warnTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'nominatim-warn-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_WARN,
  level: 'warn',
  format: winston.format.combine(warnOnlyFilter(), logFormat)
});

// Transport für Error-Logs
const errorTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'nominatim-error-%DATE%.log'),
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
    service: 'nominatim-service',
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
    const traceId = err?.traceId;
    startupConsole('error', label, { service: 'nominatim-service', message: error.message, stack: error.stack, traceId: err?.traceId });
    logger.error(label, {
      service: 'nominatim-service',
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
  source: 'nominatim-service'
});

// Hinweis: Socket.io entfernt. Server startet als klassischer Express-Server.

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
app.use(robotsSitemap());
app.use(traceId());

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

const nominatimLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many nominatim requests, please try again later.')
});

// ROUTES
app.use('/', root);
app.use('/check', check);
app.use('/nominatim', nominatimLimit, nominatim);

// 404 + Error handler (letzte Middleware)
app.use(notFoundHandler);
app.use(errorHandler);

(async () => {
  try {
    logStartupStep('Runtime initialization started');
    logStartupStep('Generating/loading service keypairs', {
      keysDir: path.join(__dirname, 'keys'),
      ENCRYPTION_KEY_PASSWORD: isEnvSet('ENCRYPTION_KEY_PASSWORD'),
      SIGNING_KEY_PASSWORD: isEnvSet('SIGNING_KEY_PASSWORD')
    });
    await generateOrLoadKeypairs();
    logStartupStep('Service keypairs ready');

    const configuredPort = Number(process.env.NOMINATIM_PORT);
    if (!Number.isFinite(configuredPort) || configuredPort <= 0) {
      throw new Error(`Invalid NOMINATIM_PORT environment variable: ${process.env.NOMINATIM_PORT ?? '<not set>'}`);
    }

    logStartupStep('Starting HTTP server', { port: configuredPort });
    const server = app.listen(configuredPort, () => {
      const address = server.address();
      const port = typeof address === 'string' ? address : address.port;
      startupConsole('info', 'Server listening', { service: 'nominatim-service', port });
      logger.info(`Server läuft auf Port ${port}`);

      logStartupStep('Initializing PostgreSQL database', {
        NOMINATIM_DATABASE_URL: isEnvSet('NOMINATIM_DATABASE_URL'),
        NOMINATIM_DB_HOST: process.env.NOMINATIM_DB_HOST || process.env.DB_HOST || 'localhost',
        NOMINATIM_DB_PORT: process.env.NOMINATIM_DB_PORT || process.env.DB_PORT || '5432',
        NOMINATIM_DB_NAME: process.env.NOMINATIM_DB_NAME || process.env.DB_NAME || 'messagedrop_nominatim',
        NOMINATIM_DB_USER: process.env.NOMINATIM_DB_USER || process.env.DB_USER || 'messagedrop',
        NOMINATIM_DB_PASSWORD: isEnvSet('NOMINATIM_DB_PASSWORD') || isEnvSet('DB_PASSWORD'),
        NOMINATIM_DB_SSL: process.env.NOMINATIM_DB_SSL || process.env.DB_SSL || null,
        NOMINATIM_DB_POOL_MAX: process.env.NOMINATIM_DB_POOL_MAX || process.env.DB_POOL_MAX || '10'
      });
      database.init(logger);
      logStartupStep('PostgreSQL database initialization triggered');
    });
    server.on('error', (err) => {
      logStartupError('HTTP server error', err, { port: configuredPort });
    });
  } catch (err) {
    logStartupError('Nominatim service startup failed', err);
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
// Clean long cached data.
cron.schedule('5 0 * * *', () => {
  tableNominatimCache.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });

  tableGeoSearch.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});
