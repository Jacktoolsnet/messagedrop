const path = require('node:path');
const winston = require('winston');
require('winston-daily-rotate-file');

function createFileTransports(logDirectory, env = process.env) {
  const infoRetention = env.LOG_RETENTION_INFO || '2d';
  const retention = {
    info: infoRetention,
    warn: env.LOG_RETENTION_WARN || infoRetention,
    error: env.LOG_RETENTION_ERROR || '2d'
  };
  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) =>
      `${timestamp} [${level.toUpperCase()}] ${message}${Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''}`)
  );

  return ['info', 'warn', 'error'].map(level => new winston.transports.DailyRotateFile({
    filename: path.join(logDirectory, `geodata-${level}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxFiles: retention[level],
    level,
    format: winston.format.combine(
      winston.format(info => info.level === level ? info : false)(),
      logFormat
    )
  }));
}

module.exports = { createFileTransports };
