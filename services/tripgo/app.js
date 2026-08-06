const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
process.env.SERVICE_JWT_ISSUER = process.env.TRIPGO_SERVICE_JWT_ISSUER || 'service.tripgo';
process.env.SERVICE_JWT_AUDIENCE ||= 'service.tripgo';
process.env.SERVICE_JWT_TRUSTED_JWKS_PATH ||= path.join(__dirname, 'config', 'service-jwks.json');
require('winston-daily-rotate-file');
const compression = require('compression');
const express = require('express');
const helmet = require('helmet');
const winston = require('winston');
const { BoundedTtlCache } = require('./cache');
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

function createApp({ client = createTripGoClient(), logger = createLogger() } = {}) {
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
  const inFlight = new Map();
  const metrics = {};

  const app = express();
  app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');
  app.use(helmet());
  app.use(compression());
  app.use(traceId());
  app.use(express.json({ limit: '32kb' }));
  app.use(loggerMw(logger));
  app.use(headerMw());
  app.use(normalizeErrorResponses);
  app.use('/', root);
  app.use('/check', check);
  app.use('/tripgo', createTripGoRouter({
    client, regionsCache, routeCache, serviceCache, inFlight, metrics,
    maxInFlight: numberSetting('TRIPGO_MAX_IN_FLIGHT', 100)
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function start() {
  const port = Number(process.env.TRIPGO_PORT);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid TRIPGO_PORT: ${process.env.TRIPGO_PORT ?? '<not set>'}`);
  await generateOrLoadKeypairs();
  const logger = createLogger();
  const app = createApp({ logger });
  const server = app.listen(port, () => logger.info('TripGo service listening', { port }));
  server.on('error', (error) => logger.error('TripGo HTTP server error', { error: error.message }));
  const shutdown = (signal) => {
    logger.info('TripGo service shutting down', { signal });
    server.close();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('TripGo service startup failed', error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApp, start };
