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
  service: 'openmeteo-service',
  cwd: process.cwd(),
  appDir: __dirname,
  nodeVersion: process.version,
  platform: process.platform,
  envFileLookedUpByDotenv: path.resolve(process.cwd(), '.env'),
  dotenv: dotenvResult.error
    ? { loaded: false, error: dotenvResult.error.message }
    : { loaded: true, injectedKeys: Object.keys(dotenvResult.parsed || {}).length },
  env: buildStartupEnv(['NODE_ENV', 'STARTUP_DEBUG', 'OPENMETEO_PORT', 'OPENMETEO_UPSTREAM_TIMEOUT_MS', 'OPENMETEO_DATABASE_URL', 'OPENMETEO_DB_HOST', 'OPENMETEO_DB_PORT', 'OPENMETEO_DB_NAME', 'OPENMETEO_DB_USER', 'OPENMETEO_DB_SSL', 'OPENMETEO_DB_POOL_MAX', 'OPENMETEO_DB_MAX_PENDING_REQUESTS', 'OPENMETEO_DB_OVERLOAD_RETRY_AFTER_SECONDS', 'ADMIN_BASE_URL', 'ADMIN_PORT'], ['ENCRYPTION_KEY_PASSWORD', 'SIGNING_KEY_PASSWORD', 'OPENMETEO_DB_PASSWORD'])
});

process.on('uncaughtExceptionMonitor', (err) => {
  startupConsole('error', 'Uncaught exception monitor', {
    service: 'openmeteo-service',
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
const weather = require('./routes/weather');
const airQualtiy = require('./routes/air-quality');
const helmet = require('helmet');
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const robotsSitemap = require('./middleware/robots-sitemap');

// Table for crone jobs
const tableAirQuality = require('./db/tableAirQuality');
const tableWeather = require('./db/tableWeather');
const tableWeatherHistory = require('./db/tableWeatherHistory');


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
  filename: path.join(LOG_DIR, 'openMeteo-info-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_INFO,
  level: 'info',
  format: winston.format.combine(infoOnlyFilter(), logFormat)
});

// Transport für Warn-Logs
const warnTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'openMeteo-warn-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_WARN,
  level: 'warn',
  format: winston.format.combine(warnOnlyFilter(), logFormat)
});

// Transport für Error-Logs
const errorTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'openMeteo-error-%DATE%.log'),
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
    service: 'openmeteo-service',
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
    startupConsole('error', label, { service: 'openmeteo-service', message: error.message, stack: error.stack, traceId: err?.traceId });
    logger.error(label, {
      service: 'openmeteo-service',
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
  source: 'openmeteo-service'
});

// Hinweis: Socket.io entfernt. Läuft als normaler Express-Server.

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

const weatherLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many weather requests, please try again later.')
});

const airQualityLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many air quality requests, please try again later.')
});

// ROUTES
app.use('/', root);
app.use('/check', check);
app.use('/airquality', airQualityLimit, airQualtiy);
app.use('/weather', weatherLimit, weather);

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

    const configuredPort = Number(process.env.OPENMETEO_PORT);
    if (!Number.isFinite(configuredPort) || configuredPort <= 0) {
      throw new Error(`Invalid OPENMETEO_PORT environment variable: ${process.env.OPENMETEO_PORT ?? '<not set>'}`);
    }

    logStartupStep('Starting HTTP server', { port: configuredPort });
    const server = app.listen(configuredPort, () => {
      const address = server.address();
      const port = typeof address === 'string' ? address : address.port;
      startupConsole('info', 'Server listening', { service: 'openmeteo-service', port });
      logger.info(`Server läuft auf Port ${port}`);

      logStartupStep('Initializing PostgreSQL database', {
        OPENMETEO_DATABASE_URL: isEnvSet('OPENMETEO_DATABASE_URL'),
        OPENMETEO_DB_HOST: process.env.OPENMETEO_DB_HOST || process.env.DB_HOST || 'localhost',
        OPENMETEO_DB_PORT: process.env.OPENMETEO_DB_PORT || process.env.DB_PORT || '5432',
        OPENMETEO_DB_NAME: process.env.OPENMETEO_DB_NAME || process.env.DB_NAME || 'messagedrop_openmeteo',
        OPENMETEO_DB_USER: process.env.OPENMETEO_DB_USER || process.env.DB_USER || 'messagedrop',
        OPENMETEO_DB_PASSWORD: isEnvSet('OPENMETEO_DB_PASSWORD') || isEnvSet('DB_PASSWORD'),
        OPENMETEO_DB_SSL: process.env.OPENMETEO_DB_SSL || process.env.DB_SSL || null,
        OPENMETEO_DB_POOL_MAX: process.env.OPENMETEO_DB_POOL_MAX || process.env.DB_POOL_MAX || '10',
        OPENMETEO_DB_MAX_PENDING_REQUESTS: process.env.OPENMETEO_DB_MAX_PENDING_REQUESTS || process.env.DB_MAX_PENDING_REQUESTS || '1000',
        OPENMETEO_DB_OVERLOAD_RETRY_AFTER_SECONDS: process.env.OPENMETEO_DB_OVERLOAD_RETRY_AFTER_SECONDS || process.env.DB_OVERLOAD_RETRY_AFTER_SECONDS || '2'
      });
      database.init(logger);
      logStartupStep('PostgreSQL database initialization triggered');
    });
    server.on('error', (err) => {
      logStartupError('HTTP server error', err, { port: configuredPort });
    });
  } catch (err) {
    logStartupError('OpenMeteo service startup failed', err);
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
// Clean short cached data.
cron.schedule('*/1 * * * *', () => {
  tableAirQuality.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });

  tableWeather.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });

  tableWeatherHistory.cleanExpired(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});
