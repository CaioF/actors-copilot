import pino from 'pino';
import Pretty from 'pino-pretty';

const createLogger = () => {
  const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
  
  if (process.env.NODE_ENV === 'development') {
    const stream = Pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
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

export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
