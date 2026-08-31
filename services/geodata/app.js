const path = require('path');
const envFilePath = path.resolve(__dirname, '../../.env');
const dotenvResult = require('dotenv').config({ path: envFilePath });

function startupConsole(level, message, meta) {
  if (level !== 'error' && process.env.STARTUP_DEBUG !== 'true') return;
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `${timestamp} [geodata-startup] ${message}${suffix}`;
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
  service: 'geodata-service',
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
    'NODE_ENV', 'STARTUP_DEBUG', 'GEODATA_PORT', 'PORT', 'GEODATA_DATABASE_URL',
    'GEODATA_DB_HOST', 'GEODATA_DB_PORT', 'GEODATA_DB_NAME', 'GEODATA_DB_USER',
    'GEODATA_DB_SSL', 'ADMIN_BASE_URL', 'ADMIN_PORT'
  ], ['ENCRYPTION_KEY_PASSWORD', 'SIGNING_KEY_PASSWORD', 'GEODATA_DB_PASSWORD'])
});

process.on('uncaughtExceptionMonitor', (error) => {
  startupConsole('error', 'Uncaught exception monitor', {
    service: 'geodata-service',
    name: error?.name,
    message: error?.message,
    stack: error?.stack
  });
});
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
const { createExportRouter } = require('./routes/exports');
const { ExportStore } = require('./export-store');
const { cleanupExportStorage } = require('./dataset-export');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');
const { ensureDownloadDirectory, ensureExportDirectory } = require('./storage-paths');

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
    service: 'geodata-service',
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
  logger = createLogger(),
  localPoiStore,
  importJobManager,
  exportStore
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
  if (exportStore) app.use('/geodata/exports', createExportRouter({ exportStore }));
  app.use('/geodata', createGeodataRouter({
    localPoiStore, importJobManager, metrics
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
  const port = Number(process.env.GEODATA_PORT || process.env.PORT || 3900);
  if (!Number.isInteger(port) || port <= 0) throw new Error('Invalid GEODATA_PORT/PORT configuration');
  logStartupStep(logger, 'Ensuring storage directories');
  await ensureDownloadDirectory();
  await ensureExportDirectory();
  logStartupStep(logger, 'Generating/loading service keypairs', {
    keysDir: path.join(__dirname, 'keys'),
    ENCRYPTION_KEY_PASSWORD: isEnvSet('ENCRYPTION_KEY_PASSWORD'),
    SIGNING_KEY_PASSWORD: isEnvSet('SIGNING_KEY_PASSWORD')
  });
  await generateOrLoadKeypairs();
  logStartupStep(logger, 'Service keypairs ready');
  const database = new Database();
  logStartupStep(logger, 'Initializing PostgreSQL database', {
    GEODATA_DATABASE_URL: isEnvSet('GEODATA_DATABASE_URL'),
    GEODATA_DB_HOST: process.env.GEODATA_DB_HOST || process.env.DB_HOST || 'localhost',
    GEODATA_DB_PORT: process.env.GEODATA_DB_PORT || process.env.DB_PORT || '5432',
    GEODATA_DB_NAME: process.env.GEODATA_DB_NAME || process.env.DB_NAME || 'messagedrop_geodata',
    GEODATA_DB_USER: process.env.GEODATA_DB_USER || process.env.DB_USER || 'messagedrop',
    GEODATA_DB_PASSWORD: isEnvSet('GEODATA_DB_PASSWORD') || isEnvSet('DB_PASSWORD'),
    GEODATA_DB_SSL: process.env.GEODATA_DB_SSL || process.env.DB_SSL || null
  });
  await database.init(logger);
  logStartupStep(logger, 'PostgreSQL database ready');
  const localPoiStore = new LocalPoiStore({ database, logger });
  const importJobManager = new ImportJobManager({ database, logger });
  const exportStore = new ExportStore({ database });
  await cleanupExportStorage(database.db, logger);
  const jobRetentionDays = numberSetting('GEODATA_JOB_RETENTION_DAYS', 90);
  void cleanupJobHistory(database, jobRetentionDays, logger);
  const cleanupTimer = setInterval(() => {
    void cleanupJobHistory(database, jobRetentionDays, logger);
  }, 24 * 60 * 60 * 1000);
  cleanupTimer.unref();
  const app = createApp({ logger, localPoiStore, importJobManager, exportStore });
  logStartupStep(logger, 'Starting HTTP server', { port });
  const server = app.listen(port, () => {
    const address = server.address();
    const listeningPort = typeof address === 'string' ? address : address.port;
    startupConsole('info', 'Server listening', { service: 'geodata-service', port: listeningPort });
    logger.info('Geodata service listening', { port: listeningPort });
  });
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

if (require.main === module || typeof global.PhusionPassenger !== 'undefined') {
  start().catch((error) => {
    logStartupError(startupLogger, 'Geodata service startup failed', error);
    process.exitCode = 1;
  });
}

module.exports = { cleanupJobHistory, createApp, start };
