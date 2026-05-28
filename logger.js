/**
 * Logger utility for Roon Tradfri extension
 * Uses pino for structured logging
 */

import pino from 'pino';

// Create logger
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime
});

export default logger;
