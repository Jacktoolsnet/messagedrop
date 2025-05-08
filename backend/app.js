require('dotenv').config()
const compression = require('compression');
const bearerToken = require('express-bearer-token');
const databaseMw = require('./middleware/database');
const loggerMw = require('./middleware/logger');
const headerMW = require('./middleware/header')
const Database = require('./db/database');
const database = new Database();
const root = require('./routes/root');
const check = require('./routes/check');
const clientConnect = require('./routes/client-connect');
const openAi = require('./routes/openAi');
const statistic = require('./routes/statistic');
const user = require('./routes/user');
const connect = require('./routes/connect');
const contact = require('./routes/contact');
const message = require('./routes/message');
const place = require('./routes/place');
const translate = require('./routes/translate');
const utils = require('./routes/utils');
const notfound = require('./routes/notfound');
const cors = require('cors')
const helmet = require('helmet');
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit')
const { generateOrLoadKeypairs } = require('./utils/keyStore');

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
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.txt', level: 'error' }),
    new winston.transports.File({ filename: 'info.txt' }),
  ],
});

/**
 * Socket.io
 * Disable Apache proxymode in Plesk to avoid socket.io connection errors.
 */
const { Server } = require('socket.io');
const contactHandlers = require("./socketIo/contactHandlers");
const userHandlers = require('./socketIo/userHandlers');
const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5.5 * 1024 * 1024,
  pingInterval: 20000,
  pingTimeout: 30000,
  allowEIO3: false,
  cors: {
    origin: [process.env.ORIGIN],
    credentials: true
  }
});
const onConnection = (socket) => {
  socket.logger = logger;
  userHandlers(io, socket)
  contactHandlers(io, socket);
}
io.on("connection", onConnection);
io.engine.on("connection_error", (err) => {
  logger.error(err.req);      // the request object
  logger.error(err.code);     // the error code, for example 1
  logger.error(err.message);  // the error message, for example "Session ID unknown"
  logger.error(err.context);  // some additional error context
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

/*
Enable cors for all routes.
*/
var corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, false);
    if (process.env.ORIGIN == origin) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
app.use(cors(corsOptions))

app.use(databaseMw(database));
app.use(loggerMw(logger));
app.use(headerMW())

// Route ratelimit
const translateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

const userLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  limit: 10, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// ROUTES
app.use('/', root);
app.use('/check', check);
app.use('/clientconnect', clientConnect);
app.use('/statistic', statistic);
app.use('/openai', openAi)
app.use('/user', userLimit, user);
app.use('/connect', connect);
app.use('/contact', contact);
app.use('/message', message);
app.use('/translate', translateLimit, translate);
app.use('/utils', utils);
app.use('/place', place);

// The last route
app.use('{*notFound}', notfound);

(async () => {
  try {
    await generateOrLoadKeypairs();
    server.listen(process.env.PORT, () => {
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

// Clean messages every 5 minutes
cron.schedule('*/5 * * * *', () => {
  tableMessage.cleanPublic(database.db, function (err) {
    if (err) {
      logger.error(err);
    }
  });
});
