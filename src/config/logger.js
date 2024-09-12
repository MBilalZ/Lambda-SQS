const winston = require('winston');
const util = require('util');

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const isDev = process.env.NODE_ENV === 'dev';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    enumerateErrorFormat(),
    winston.format.splat(),
    isDev
      ? winston.format.combine(
          winston.format.colorize(), // Use color in dev mode
          winston.format.printf(({ level, message, timestamp }) => {
            const formattedMessage =
              typeof message === 'object'
                ? util.inspect(message, { depth: 2, colors: true })
                : message;
            return `${timestamp} ${level}: ${formattedMessage}`;
          })
        )
      : winston.format.json() // Use JSON for non-dev (no color)
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

module.exports = logger;
