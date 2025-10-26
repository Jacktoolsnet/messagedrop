require('dotenv').config()
require('winston-daily-rotate-file');
const compression = require('compression');
const bearerToken = require('express-bearer-token');
const databaseMw = require('./middleware/database');
const loggerMw = require('./middleware/logger');
const headerMW = require('./middleware/header')
const Database = require('./db/database');
const database = new Database();
const root = require('./routes/root');
const check = require('./routes/check');
const helmet = require('helmet');
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit')
const { generateOrLoadKeypairs } = require('./utils/keyStore');
const nominatim = require('./routes/nominatim');

// ExpressJs
const { createServer } = require('node:http');
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

// Transport für Info-Logs
const infoTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/admin-info-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: '2d',
  level: 'info'
});

// Transport für Error-Logs
const errorTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/admin-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: '2d',
  level: 'error'
});

// Logger erstellen
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    infoTransport,
    errorTransport
  ]
});

// Optional: auch in der Konsole ausgeben
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * Socket.io
 * Disable Apache proxymode in Plesk to avoid socket.io connection errors.
 */
const { Server } = require('socket.io');
const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5.5 * 1024 * 1024,
  pingInterval: 20000,
  pingTimeout: 30000,
  allowEIO3: false
});

const onConnection = (socket) => {
  // Logger an den Socket hängen
  socket.logger = logger.child({ socketId: socket.id });

  // socket.logger.info(`Verbindung aufgebaut`);

  socket.onAny((event, ...args) => {
    // socket.logger.info(`[SOCKET EVENT] ${event}`, args);
  });

  // Globale Fehlerbehandlung für diesen Socket
  socket.on('error', (err) => {
    socket.logger.error('Socket-Fehler', {
      message: err.message,
      stack: err.stack
    });
  });

  socket.on('disconnect', (reason) => {
    // socket.logger.warn(`Verbindung getrennt: ${reason}`);
  });

  socket.on('connect_error', (err) => {
    socket.logger.error('Verbindungsfehler', {
      message: err.message,
      stack: err.stack
    });
  });

  // Eigentliche Handler laden
};

// Socket.io: neue Verbindung
io.on("connection", onConnection);

// Fehler beim Verbindungsaufbau (z. B. Auth-Probleme)
io.engine.on("connection_error", (err) => {
  logger.error('Engine-Fehler beim Verbindungsaufbau', {
    ip: err.req?.socket?.remoteAddress,
    url: err.req?.url,
    code: err.code,
    message: err.message,
    context: err.context
  });
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

app.use(express.json({ limit: '1mb' }));
app.use(databaseMw(database));
app.use(loggerMw(logger));
app.use(headerMW())

// ROUTES
app.use('/', root);
app.use('/check', check);
app.use('/nominatim', nominatim);

// 404 (letzte Route)
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

(async () => {
  try {
    await generateOrLoadKeypairs();
    server.listen(process.env.NOMINATIM_PORT, () => {
      const address = server.address();
      const port = typeof address === 'string' ? address : address.port;
      logger.info(`Server läuft auf Port ${port}`);
      database.init(logger);
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
cron.schedule('5 0 * * *', () => { });