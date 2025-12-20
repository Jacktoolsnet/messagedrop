require('dotenv').config();
require('winston-daily-rotate-file');

const { createServer } = require('node:http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { Server } = require('socket.io');
const { resolveBaseUrl, attachForwarding } = require('./utils/adminLogForwarder');

const contactHandlers = require('./socketIo/contactHandlers');
const userHandlers = require('./socketIo/userHandlers');

const app = express();

app.use(helmet());

const healthWindowMs = 10 * 60 * 1000;
const healthLimit = 60;
const healthHits = new Map();

function healthLimiter(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.connection?.remoteAddress || 'unknown';
  const entry = healthHits.get(key) || { count: 0, start: now };
  if (now - entry.start >= healthWindowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  healthHits.set(key, entry);
  if (entry.count > healthLimit) {
    return res.status(429).json({ error: 'Too many health requests, please try again later.' });
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of healthHits.entries()) {
    if (now - entry.start >= healthWindowMs) {
      healthHits.delete(key);
    }
  }
}, healthWindowMs).unref();

const allowedOrigins = process.env.ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.get('/health', healthLimiter, (_, res) => res.json({ status: 'ok' }));

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) =>
    `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
  )
);

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/socketio-info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      level: 'info'
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/socketio-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      level: 'error'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// Forward logs to admin backend
const adminLogBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
attachForwarding(logger, {
  baseUrl: adminLogBase,
  token: process.env.ADMIN_TOKEN || process.env.BACKEND_TOKEN,
  source: 'socket-service'
});

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  pingInterval: 20000,
  pingTimeout: 30000,
  maxHttpBufferSize: 5.5 * 1024 * 1024
});

io.use((socket, next) => {
  socket.logger = logger.child({ socketId: socket.id });
  next();
});

io.on('connection', (socket) => {
  socket.logger.info('socket connected');

  socket.on('disconnect', (reason) => {
    socket.logger.info('socket disconnected', { reason });
  });

  socket.on('error', (err) => {
    socket.logger.error('socket error', { message: err.message, stack: err.stack });
  });

  userHandlers(io, socket);
  contactHandlers(io, socket);
});

io.engine.on('connection_error', (err) => {
  logger.error('connection error', {
    code: err.code,
    message: err.message,
    ip: err.req?.socket?.remoteAddress
  });
});

const port = Number(process.env.SOCKETIO_PORT);
server.listen(port, () => {
  logger.info(`Socket service listening on port ${port}`);
});
