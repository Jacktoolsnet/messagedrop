const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
process.env.SERVICE_JWT_ISSUER = process.env.WIKIPEDIA_SERVICE_JWT_ISSUER || 'service.wikipedia';
process.env.SERVICE_JWT_AUDIENCE ||= 'service.wikipedia';
process.env.SERVICE_JWT_TRUSTED_JWKS_PATH ||= path.join(__dirname, 'config', 'service-jwks.json');
require('winston-daily-rotate-file');
const compression = require('compression');
const express = require('express');
const helmet = require('helmet');
const cron = require('node-cron');
const winston = require('winston');
const Database = require('./db/database');
const tableCache = require('./db/tableWikipediaTileCache');
const databaseMw = require('./middleware/database');
const loggerMw = require('./middleware/logger');
const traceId = require('./middleware/trace-id');
const headerMw = require('./middleware/header');
const { normalizeErrorResponses, notFoundHandler, errorHandler } = require('./middleware/api-error');
const root = require('./routes/root');
const check = require('./routes/check');
const wikipedia = require('./routes/wikipedia');
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');

const logFormat = winston.format.combine(winston.format.timestamp(), winston.format.json());
const transports = [new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, 'logs', 'wikipedia-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: process.env.LOG_RETENTION_INFO || '2d'
})];
if (process.env.NODE_ENV !== 'production') transports.push(new winston.transports.Console({ format: winston.format.simple() }));
const logger = winston.createLogger({ level: 'info', format: logFormat, transports });
const adminLogBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
attachForwarding(logger, {
  baseUrl: adminLogBase,
  audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend',
  source: 'wikipedia-service'
});
const database = new Database();

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');
app.use(helmet());
app.use(compression());
app.use(traceId());
app.use(express.json({ limit: '1mb' }));
app.use(databaseMw(database));
app.use(loggerMw(logger));
app.use(headerMw());
app.use(normalizeErrorResponses);

app.use('/', root);
app.use('/check', check);
// Client-specific rate limiting belongs to the public main backend. All calls
// reaching this internal service originate from that backend's single address.
// Service JWT authentication and the upstream queue still protect this service.
app.use('/wikipedia', wikipedia);
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.WIKIPEDIA_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid WIKIPEDIA_PORT: ${process.env.WIKIPEDIA_PORT ?? '<not set>'}`);
let server;

async function start() {
  await generateOrLoadKeypairs();
  logger.info('Wikipedia service keypairs ready');
  database.init(logger);
  server = app.listen(port, () => logger.info('Wikipedia service listening', { port }));
  server.on('error', (error) => logger.error('Wikipedia HTTP server error', { error: error.message }));
}

start().catch((error) => {
  logger.error('Wikipedia service startup failed', { error: error.message, stack: error.stack });
  process.exitCode = 1;
});

cron.schedule('15 0 * * *', () => tableCache.cleanExpired(database.db, (error) => {
  if (error) logger.error('Wikipedia cache cleanup failed', { error: error.message });
}));

function shutdown(signal) {
  logger.info('Wikipedia service shutting down', { signal });
  if (!server) {
    database.close();
    return;
  }
  server.close(() => database.close());
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
