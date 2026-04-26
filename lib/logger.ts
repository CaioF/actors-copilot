import pino from 'pino';

const createLogger = () => {
  const LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL || 'warn';
  const isServer = typeof window === 'undefined';
  
  return pino({
    level: LOG_LEVEL,
    base: {
      env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    
    browser: {
      asObject: true, 
    },

    ...(isServer && process.env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    }),
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
  const child = logger.child(context);
  // Pino browser child() does not reliably inherit the parent level;
  // force-set it so debug/trace logs are not silently dropped.
  child.level = logger.level;
  return child;
};
