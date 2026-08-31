const path = require('path');
const envFilePath = path.resolve(__dirname, '../../.env');
const dotenvResult = require('dotenv').config({ path: envFilePath });

function startupConsole(level, message, meta) {
  if (level !== 'error' && process.env.STARTUP_DEBUG !== 'true') return;
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `${timestamp} [tripgo-startup] ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function isEnvSet(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim() !== '';
}

function buildStartupEnv(valueNames, secretNames) {
  const env = {};
  for (const name of valueNames) env[name] = process.env[name] || null;
  for (const name of secretNames) env[name] = isEnvSet(name);
  return env;
}

startupConsole('info', 'Bootstrap started', {
  service: 'tripgo-service',
  cwd: process.cwd(),
  appDir: __dirname,
  nodeVersion: process.version,
  platform: process.platform,
  passenger: typeof global.PhusionPassenger !== 'undefined',
  envFileLookedUpByDotenv: envFilePath,
  dotenv: dotenvResult.error
    ? { loaded: false, error: dotenvResult.error.message }
    : { loaded: true, injectedKeys: Object.keys(dotenvResult.parsed || {}).length },
  env: buildStartupEnv([
    'NODE_ENV', 'STARTUP_DEBUG', 'TRIPGO_PORT', 'PORT', 'TRIPGO_API_BASE_URL',
    'TRIPGO_DATABASE_URL', 'TRIPGO_DB_HOST', 'TRIPGO_DB_PORT', 'TRIPGO_DB_NAME',
    'TRIPGO_DB_USER', 'TRIPGO_DB_SSL', 'ADMIN_BASE_URL', 'ADMIN_PORT'
  ], ['ENCRYPTION_KEY_PASSWORD', 'SIGNING_KEY_PASSWORD', 'TRIPGO_API_KEY', 'TRIPGO_DB_PASSWORD'])
});

process.on('uncaughtExceptionMonitor', (error) => {
  startupConsole('error', 'Uncaught exception monitor', {
    service: 'tripgo-service',
    name: error?.name,
    message: error?.message,
    stack: error?.stack
  });
});
process.env.SERVICE_JWT_ISSUER = process.env.TRIPGO_SERVICE_JWT_ISSUER || 'service.tripgo';
process.env.SERVICE_JWT_AUDIENCE ||= 'service.tripgo';
process.env.SERVICE_JWT_TRUSTED_JWKS_PATH ||= path.join(__dirname, 'config', 'service-jwks.json');
require('winston-daily-rotate-file');
const compression = require('compression');
const express = require('express');
const helmet = require('helmet');
const winston = require('winston');
const { BoundedTtlCache } = require('./cache');
const Database = require('./db/database');
const { PersistentLocationsCache } = require('./locations-cache');
const { createTripGoClient } = require('./clients/tripgo-client');
const loggerMw = require('./middleware/logger');
const traceId = require('./middleware/trace-id');
const headerMw = require('./middleware/header');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const root = require('./routes/root');
const check = require('./routes/check');
const { createTripGoRouter } = require('./routes/tripgo');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');

function numberSetting(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createLogger() {
  const transports = [new winston.transports.DailyRotateFile({
    filename: path.join(__dirname, 'logs', 'tripgo-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: process.env.LOG_RETENTION_INFO || '2d'
  })];
  if (process.env.NODE_ENV !== 'production') {
    transports.push(new winston.transports.Console({ format: winston.format.simple() }));
  }
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports
  });
  const adminLogBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
  attachForwarding(logger, {
    baseUrl: adminLogBase,
    audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend',
    source: 'tripgo-service'
  });
  return logger;
}

function normalizeStartupError(error) {
  if (error instanceof Error) return error;
  try {
    return new Error(typeof error === 'string' ? error : JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

function logStartupStep(logger, message, meta) {
  startupConsole('info', message, meta);
  logger.info(`[startup] ${message}`, meta || {});
}

function logStartupWarn(logger, message, meta) {
  startupConsole('warn', message, meta);
  logger.warn(`[startup] ${message}`, meta || {});
}

function logStartupError(logger, message, error, meta) {
  const normalized = normalizeStartupError(error);
  const payload = {
    ...(meta || {}),
    service: 'tripgo-service',
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack
  };
  startupConsole('error', message, payload);
  logger?.error(`[startup] ${message}`, payload);
}

function registerProcessHandlers(logger) {
  const exitOnUnhandled = process.env.EXIT_ON_UNHANDLED === 'true';
  process.on('unhandledRejection', (error) => {
    logStartupError(logger, 'Unhandled promise rejection', error);
    if (exitOnUnhandled) setTimeout(() => process.exit(1), 100);
  });
  process.on('uncaughtException', (error) => {
    logStartupError(logger, 'Uncaught exception', error);
    if (exitOnUnhandled) setTimeout(() => process.exit(1), 100);
  });
  if (!exitOnUnhandled) {
    logStartupWarn(logger, 'Unhandled errors will not terminate the process. Set EXIT_ON_UNHANDLED=true to restore fail-fast.');
  }
}

let startupLogger = null;

function createApp({
  client = createTripGoClient(), database, logger = createLogger(), persistentLocationsCache
} = {}) {
  const regionsCache = new BoundedTtlCache({
    ttlMs: numberSetting('TRIPGO_REGIONS_CACHE_TTL_MS', 6 * 60 * 60 * 1000),
    maxEntries: numberSetting('TRIPGO_REGIONS_CACHE_MAX_ENTRIES', 8),
    maxBytes: numberSetting('TRIPGO_REGIONS_CACHE_MAX_BYTES', 16 * 1024 * 1024)
  });
  const routeCache = new BoundedTtlCache({
    ttlMs: numberSetting('TRIPGO_ROUTE_CACHE_TTL_MS', 15000),
    maxEntries: numberSetting('TRIPGO_ROUTE_CACHE_MAX_ENTRIES', 64),
    maxBytes: numberSetting('TRIPGO_ROUTE_CACHE_MAX_BYTES', 32 * 1024 * 1024)
  });
  const serviceCache = new BoundedTtlCache({
    ttlMs: numberSetting('TRIPGO_SERVICE_CACHE_TTL_MS', 15000),
    maxEntries: numberSetting('TRIPGO_SERVICE_CACHE_MAX_ENTRIES', 128),
    maxBytes: numberSetting('TRIPGO_SERVICE_CACHE_MAX_BYTES', 16 * 1024 * 1024)
  });
  const locationsCache = new BoundedTtlCache({
    ttlMs: numberSetting('TRIPGO_LOCATIONS_MEMORY_CACHE_TTL_MS', 60 * 60 * 1000),
    maxEntries: numberSetting('TRIPGO_LOCATIONS_CACHE_MAX_ENTRIES', 256),
    maxBytes: numberSetting('TRIPGO_LOCATIONS_CACHE_MAX_BYTES', 32 * 1024 * 1024)
  });
  const inFlight = new Map();
  const metrics = {};

  const app = express();
  app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');
  app.use(helmet());
  app.use(compression());
  app.use(traceId());
  app.use(express.json({ limit: '32kb' }));
  app.use(loggerMw(logger));
  app.use((req, _res, next) => {
    req.database = database;
    next();
  });
  app.use(headerMw());
  app.use(normalizeErrorResponses);
  app.use('/', root);
  app.use('/check', check);
  app.use('/tripgo', createTripGoRouter({
    client, regionsCache, routeCache, serviceCache, locationsCache, persistentLocationsCache,
    locationsRefreshAfterMs: numberSetting('TRIPGO_LOCATIONS_REFRESH_AFTER_MS', 24 * 60 * 60 * 1000),
    locationsCacheTtlMs: numberSetting('TRIPGO_LOCATIONS_CACHE_TTL_MS', 7 * 24 * 60 * 60 * 1000),
    locationsStaleIfErrorMs: numberSetting('TRIPGO_LOCATIONS_STALE_IF_ERROR_MS', 30 * 24 * 60 * 60 * 1000),
    inFlight,
    metrics,
    maxInFlight: numberSetting('TRIPGO_MAX_IN_FLIGHT', 100),
    logger
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function start() {
  const logger = createLogger();
  startupLogger = logger;
  registerProcessHandlers(logger);
  logStartupStep(logger, 'Runtime initialization started');
  const port = Number(process.env.TRIPGO_PORT || process.env.PORT || 3800);
  if (!Number.isInteger(port) || port <= 0) throw new Error('Invalid TRIPGO_PORT/PORT configuration');
  logStartupStep(logger, 'Generating/loading service keypairs', {
    keysDir: path.join(__dirname, 'keys'),
    ENCRYPTION_KEY_PASSWORD: isEnvSet('ENCRYPTION_KEY_PASSWORD'),
    SIGNING_KEY_PASSWORD: isEnvSet('SIGNING_KEY_PASSWORD')
  });
  await generateOrLoadKeypairs();
  logStartupStep(logger, 'Service keypairs ready');
  const database = new Database();
  logStartupStep(logger, 'Initializing PostgreSQL database', {
    TRIPGO_DATABASE_URL: isEnvSet('TRIPGO_DATABASE_URL'),
    TRIPGO_DB_HOST: process.env.TRIPGO_DB_HOST || process.env.DB_HOST || 'localhost',
    TRIPGO_DB_PORT: process.env.TRIPGO_DB_PORT || process.env.DB_PORT || '5432',
    TRIPGO_DB_NAME: process.env.TRIPGO_DB_NAME || process.env.DB_NAME || 'messagedrop_tripgo',
    TRIPGO_DB_USER: process.env.TRIPGO_DB_USER || process.env.DB_USER || 'messagedrop',
    TRIPGO_DB_PASSWORD: isEnvSet('TRIPGO_DB_PASSWORD') || isEnvSet('DB_PASSWORD'),
    TRIPGO_DB_SSL: process.env.TRIPGO_DB_SSL || process.env.DB_SSL || null
  });
  database.init(logger);
  const persistentLocationsCache = new PersistentLocationsCache({ database, logger });
  void persistentLocationsCache.cleanExpired(numberSetting('TRIPGO_LOCATIONS_DATABASE_RETENTION_DAYS', 30));
  const cleanupTimer = setInterval(() => {
    void persistentLocationsCache.cleanExpired(numberSetting('TRIPGO_LOCATIONS_DATABASE_RETENTION_DAYS', 30));
  }, 24 * 60 * 60 * 1000);
  cleanupTimer.unref();
  const app = createApp({ database, logger, persistentLocationsCache });
  logStartupStep(logger, 'Starting HTTP server', { port });
  const server = app.listen(port, () => {
    const address = server.address();
    const listeningPort = typeof address === 'string' ? address : address.port;
    startupConsole('info', 'Server listening', { service: 'tripgo-service', port: listeningPort });
    logger.info('TripGo service listening', { port: listeningPort });
  });
  server.on('error', (error) => logger.error('TripGo HTTP server error', { error: error.message }));
  const shutdown = (signal) => {
    logger.info('TripGo service shutting down', { signal });
    clearInterval(cleanupTimer);
    server.close(() => database.close());
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module || typeof global.PhusionPassenger !== 'undefined') {
  start().catch((error) => {
    logStartupError(startupLogger, 'TripGo service startup failed', error);
    process.exitCode = 1;
  });
}

module.exports = { createApp, start };
