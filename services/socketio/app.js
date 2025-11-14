require('dotenv').config();
require('winston-daily-rotate-file');

const { createServer } = require('node:http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { Server } = require('socket.io');

const contactHandlers = require('./socketIo/contactHandlers');
const userHandlers = require('./socketIo/userHandlers');

const app = express();

app.use(helmet());

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

app.get('/health', (_, res) => res.json({ status: 'ok' }));

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
