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
const root = require('./routes/root');
const check = require('./routes/check');
const clientConnect = require('./routes/client-connect');
const openAi = require('./routes/openAi');
const user = require('./routes/user');
const connect = require('./routes/connect');
const contact = require('./routes/contact');
const contactMessage = require('./routes/contactMessage');
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
const unsplash = require('./routes/unsplash');
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

// Tables for cronjobs
const tableUser = require('./db/tableUser');
const tableConnect = require('./db/tableConnect');
const tableMessage = require('./db/tableMessage')
const tableContactMessage = require('./db/tableContactMessage');
const tableGeoStatistic = require('./db/tableGeoStatistic');
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

const LOG_RETENTION_INFO = process.env.LOG_RETENTION_INFO || '2d';
const LOG_RETENTION_WARN = process.env.LOG_RETENTION_WARN || LOG_RETENTION_INFO;
const LOG_RETENTION_ERROR = process.env.LOG_RETENTION_ERROR || '2d';

const infoOnlyFilter = winston.format((info) => (info.level === 'info' ? info : false));
const warnOnlyFilter = winston.format((info) => (info.level === 'warn' ? info : false));

// Transport für Info-Logs
const infoTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/backend-info-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_INFO,
  level: 'info',
  format: winston.format.combine(infoOnlyFilter(), logFormat)
});

// Transport für Warn-Logs
const warnTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/backend-warn-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: LOG_RETENTION_WARN,
  level: 'warn',
  format: winston.format.combine(warnOnlyFilter(), logFormat)
});

// Transport für Error-Logs
const errorTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/backend-error-%DATE%.log',
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

function registerProcessHandlers() {
  const exitOnUnhandled = process.env.EXIT_ON_UNHANDLED === 'true';
  const logProcessError = (label, err) => {
    const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    const traceId = err?.traceId;
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
    logger.warn('Unhandled errors will not terminate the process. Set EXIT_ON_UNHANDLED=true to restore fail-fast.');
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

const unsplashLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many unsplash requests, please try again later.')
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

// ROUTES
app.use('/', basicLimit, root);
app.use('/airquality', airQualtiyLimit, airQualtiy);
app.use('/check', basicLimit, check);
app.use('/clientconnect', connectLimit, clientConnect);
app.use('/connect', connectLimit, connect);
app.use('/contact', contactLimit, contact);
app.use('/contactMessage', contactMessageLimit, contactMessage);
app.use('/digitalserviceact', digitalServiceAct);
app.use('/dsa', dsaStatusLimit, dsaStatus);
app.use('/geostatistic', geoStatisticLimit, geoStatistic);
app.use('/message', messageLimit, message);
app.use('/moderation', basicLimit, moderation);
app.use('/notification', notificationLimit, notification);
app.use('/nominatim', nominatimLimit, nominatim);
app.use('/viator', viatorLimit, viator);
app.use('/openai', openAiLimit, openAi);
app.use('/place', placeLimit, place);
app.use('/tenor', tenorLimit, tenor);
app.use('/unsplash', unsplashLimit, unsplash);
app.use('/translate', translateLimit, translate);
app.use('/user', userLimit, user);
app.use('/utils', utilsLimit, utils);
app.use('/weather', weatherLimit, weather);
app.use('/frontend-error-log', frontendErrorLogLimit, frontendErrorLog);
app.use('/maintenance', basicLimit, maintenance);

// 404 + Error handler (letzte Middleware)
app.use(notFoundHandler);
app.use(errorHandler);

(async () => {
  try {
    await generateOrLoadKeypairs();
    await generateOrLoadVapidKeys();
    await database.init(logger);
    const port = Number(process.env.PORT);
    const server = app.listen(port, () => {
      logger.info(`Server läuft auf Port ${port}`);
    });
    server.on('error', (err) => {
      logger.error('Server-Fehler', err);
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

// Clean messages clsevery 5 minutes
cron.schedule('*/5 * * * *', () => {
  tableMessage.cleanPublic(database.db, function (err) {
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
});
