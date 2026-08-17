const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
process.env.SERVICE_JWT_ISSUER = process.env.GEODATA_SERVICE_JWT_ISSUER || 'service.geodata';
process.env.SERVICE_JWT_AUDIENCE ||= 'service.geodata';
process.env.SERVICE_JWT_TRUSTED_JWKS_PATH ||= path.join(__dirname, 'config', 'service-jwks.json');
require('winston-daily-rotate-file');
const compression = require('compression');
const express = require('express');
const helmet = require('helmet');
const winston = require('winston');
const Database = require('./db/database');
const tableGeodataPoi = require('./db/tableGeodataPoi');
const { LocalPoiStore } = require('./local-poi-store');
const { ImportJobManager } = require('./import-job-manager');
const loggerMw = require('./middleware/logger');
const traceId = require('./middleware/trace-id');
const headerMw = require('./middleware/header');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const root = require('./routes/root');
const check = require('./routes/check');
const { createGeodataRouter } = require('./routes/geodata');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const { ensureDownloadDirectory } = require('./storage-paths');

function numberSetting(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function cleanupJobHistory(database, retentionDays, logger) {
  const cleanup = (table, label) => new Promise((resolve) => table.cleanupJobs(
    database.db,
    retentionDays,
    (error) => {
      if (error) logger.error(`Could not clean ${label} history`, { error: error.message });
      resolve();
    }
  ));
  return cleanup(tableGeodataPoi, 'Geodata import job');
}

function createLogger() {
  const transports = [new winston.transports.DailyRotateFile({
    filename: path.join(__dirname, 'logs', 'geodata-%DATE%.log'),
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
    source: 'geodata-service'
  });
  return logger;
}

function createApp({
  logger = createLogger(),
  localPoiStore,
  importJobManager
} = {}) {
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
  app.use('/geodata', createGeodataRouter({
    localPoiStore, importJobManager, metrics
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function start() {
  const port = Number(process.env.GEODATA_PORT);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid GEODATA_PORT: ${process.env.GEODATA_PORT ?? '<not set>'}`);
  await ensureDownloadDirectory();
  await generateOrLoadKeypairs();
  const logger = createLogger();
  const database = new Database();
  await database.init(logger);
  const localPoiStore = new LocalPoiStore({ database, logger });
  const importJobManager = new ImportJobManager({ database, logger });
  const jobRetentionDays = numberSetting('GEODATA_JOB_RETENTION_DAYS', 90);
  void cleanupJobHistory(database, jobRetentionDays, logger);
  const cleanupTimer = setInterval(() => {
    void cleanupJobHistory(database, jobRetentionDays, logger);
  }, 24 * 60 * 60 * 1000);
  cleanupTimer.unref();
  const app = createApp({ logger, localPoiStore, importJobManager });
  const server = app.listen(port, () => logger.info('Geodata service listening', { port }));
  server.on('error', (error) => logger.error('Geodata HTTP server error', { error: error.message }));
  const shutdown = (signal) => {
    logger.info('Geodata service shutting down', { signal });
    clearInterval(cleanupTimer);
    server.close(() => database.close());
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Geodata service startup failed', error.message);
    process.exitCode = 1;
  });
}

module.exports = { cleanupJobHistory, createApp, start };
