const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
process.env.SERVICE_JWT_ISSUER = process.env.OVERPASS_SERVICE_JWT_ISSUER || 'service.overpass';
process.env.SERVICE_JWT_AUDIENCE ||= 'service.overpass';
process.env.SERVICE_JWT_TRUSTED_JWKS_PATH ||= path.join(__dirname, 'config', 'service-jwks.json');
require('winston-daily-rotate-file');
const compression = require('compression');
const express = require('express');
const helmet = require('helmet');
const winston = require('winston');
const { BoundedTtlCache } = require('./cache');
const Database = require('./db/database');
const { PersistentOverpassCache } = require('./persistent-cache');
const { createOverpassClient } = require('./clients/overpass-client');
const { createWebsiteMetadataClient } = require('./website-metadata');
const loggerMw = require('./middleware/logger');
const traceId = require('./middleware/trace-id');
const headerMw = require('./middleware/header');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const root = require('./routes/root');
const check = require('./routes/check');
const { createOverpassRouter } = require('./routes/overpass');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');

function numberSetting(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createLogger() {
  const transports = [new winston.transports.DailyRotateFile({
    filename: path.join(__dirname, 'logs', 'overpass-%DATE%.log'),
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
    source: 'overpass-service'
  });
  return logger;
}

function createApp({
  client = createOverpassClient(),
  metadataClient = createWebsiteMetadataClient(),
  logger = createLogger(),
  persistentCache
} = {}) {
  const cache = new BoundedTtlCache({
    ttlMs: numberSetting('OVERPASS_CACHE_TTL_MS', 6 * 60 * 60 * 1000),
    maxEntries: numberSetting('OVERPASS_CACHE_MAX_ENTRIES', 256),
    maxBytes: numberSetting('OVERPASS_CACHE_MAX_BYTES', 64 * 1024 * 1024)
  });
  const inFlight = new Map();
  const metrics = {};
  const app = express();
  app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');
  app.use(helmet());
  app.use(compression());
  app.use(traceId());
  app.use(express.json({ limit: '16kb' }));
  app.use(loggerMw(logger));
  app.use(headerMw());
  app.use(normalizeErrorResponses);
  app.use('/', root);
  app.use('/check', check);
  app.use('/overpass', createOverpassRouter({
    client, metadataClient, cache, persistentCache, inFlight, metrics,
    refreshAfterMs: numberSetting('OVERPASS_CACHE_REFRESH_AFTER_MS', 24 * 60 * 60 * 1000),
    cacheTtlMs: numberSetting('OVERPASS_DATABASE_CACHE_TTL_MS', 7 * 24 * 60 * 60 * 1000),
    staleIfErrorMs: numberSetting('OVERPASS_CACHE_STALE_IF_ERROR_MS', 30 * 24 * 60 * 60 * 1000),
    maxInFlight: numberSetting('OVERPASS_MAX_IN_FLIGHT', 10), logger
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function start() {
  const port = Number(process.env.OVERPASS_PORT);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid OVERPASS_PORT: ${process.env.OVERPASS_PORT ?? '<not set>'}`);
  await generateOrLoadKeypairs();
  const logger = createLogger();
  const database = new Database();
  await database.init(logger);
  const persistentCache = new PersistentOverpassCache({ database, logger });
  void persistentCache.cleanExpired(numberSetting('OVERPASS_DATABASE_RETENTION_DAYS', 90));
  const cleanupTimer = setInterval(() => {
    void persistentCache.cleanExpired(numberSetting('OVERPASS_DATABASE_RETENTION_DAYS', 90));
  }, 24 * 60 * 60 * 1000);
  cleanupTimer.unref();
  const app = createApp({ logger, persistentCache });
  const server = app.listen(port, () => logger.info('Overpass service listening', { port }));
  server.on('error', (error) => logger.error('Overpass HTTP server error', { error: error.message }));
  const shutdown = (signal) => {
    logger.info('Overpass service shutting down', { signal });
    clearInterval(cleanupTimer);
    server.close(() => database.close());
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Overpass service startup failed', error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApp, start };
