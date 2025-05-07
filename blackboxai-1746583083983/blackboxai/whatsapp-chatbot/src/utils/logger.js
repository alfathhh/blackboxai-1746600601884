const pino = require('pino');
const config = require('../config');

// Create base logger
const logger = pino({
    level: config.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard'
        }
    }
});

// Add custom methods while preserving original pino methods
const enhancedLogger = new Proxy(logger, {
    get(target, property) {
        // Custom methods
        const customMethods = {
            stateChange: (userId, oldState, newState) => {
                target.info({
                    type: 'state_change',
                    userId,
                    oldState,
                    newState,
                    timestamp: new Date().toISOString()
                });
            },
            csInteraction: (type, userId, csId, message) => {
                target.info({
                    type: 'cs_interaction',
                    interactionType: type,
                    userId,
                    csId,
                    message,
                    timestamp: new Date().toISOString()
                });
            },
            errorWithContext: (error, context) => {
                target.error({
                    type: 'error',
                    error: {
                        message: error.message,
                        stack: error.stack
                    },
                    context,
                    timestamp: new Date().toISOString()
                });
            },
            messageProcess: (userId, messageType, content, response) => {
                target.info({
                    type: 'message_process',
                    userId,
                    messageType,
                    content,
                    response,
                    timestamp: new Date().toISOString()
                });
            }
        };

        // Return custom method if it exists
        if (property in customMethods) {
            return customMethods[property];
        }

        // Return original pino method
        return target[property];
    }
});

module.exports = enhancedLogger;
