require('dotenv').config();
require('winston-daily-rotate-file');
const path = require('path');
const compression = require('compression');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

const logFormat = winston.format.combine(winston.format.timestamp(), winston.format.json());
const transports = [new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, 'logs', 'wikipedia-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: process.env.LOG_RETENTION_INFO || '2d'
})];
if (process.env.NODE_ENV !== 'production') transports.push(new winston.transports.Console({ format: winston.format.simple() }));
const logger = winston.createLogger({ level: 'info', format: logFormat, transports });
const database = new Database();
database.init(logger);

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

const wikipediaLimit = rateLimit({
  windowMs: 10 * 60 * 1000, limit: Number(process.env.WIKIPEDIA_RATE_LIMIT || 240),
  standardHeaders: true, legacyHeaders: false,
  message: { errorCode: 'RATE_LIMIT', message: 'too_many_wikipedia_requests', error: 'too_many_wikipedia_requests' }
});
app.use('/', root);
app.use('/check', check);
app.use('/wikipedia', wikipediaLimit, wikipedia);
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.WIKIPEDIA_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid WIKIPEDIA_PORT: ${process.env.WIKIPEDIA_PORT ?? '<not set>'}`);
const server = app.listen(port, () => logger.info('Wikipedia service listening', { port }));
server.on('error', (error) => logger.error('Wikipedia HTTP server error', { error: error.message }));

cron.schedule('15 0 * * *', () => tableCache.cleanExpired(database.db, (error) => {
  if (error) logger.error('Wikipedia cache cleanup failed', { error: error.message });
}));

function shutdown(signal) {
  logger.info('Wikipedia service shutting down', { signal });
  server.close(() => database.close());
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
