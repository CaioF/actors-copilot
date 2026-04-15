import pino from 'pino';
import Pretty from 'pino-pretty';

const createLogger = () => {
  const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
  
  if (process.env.NODE_ENV === 'development') {
    const stream = Pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      minimumLevel: LOG_LEVEL as pino.Level,
    });
    return pino({ level: LOG_LEVEL }, stream);
  }
  
  return pino({
    level: LOG_LEVEL,
    base: {
      env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
};

export const logger = createLogger();

/**
 * Creates a child logger with additional contextual fields.
 * All subsequent log entries from the child logger will include the provided context.
 *
 * @param context - Key-value pairs to attach to all logs from the child logger
 * @returns A pino logger instance with the additional context baked in
 */
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
