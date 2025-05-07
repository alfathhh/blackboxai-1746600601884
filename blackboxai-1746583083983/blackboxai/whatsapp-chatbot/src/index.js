require('dotenv').config();
const whatsapp = require('./services/whatsapp');
const messageHandler = require('./handlers/messageHandler');
const logger = require('./utils/logger');
const config = require('./config');

// Validate required environment variables
const requiredEnvVars = ['SPREADSHEET_ID'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    logger.error({
        type: 'startup_error',
        error: `Missing required environment variables: ${missingEnvVars.join(', ')}`
    });
    process.exit(1);
}

async function startBot() {
    try {
        logger.info({
            type: 'startup',
            message: 'Starting WhatsApp bot...'
        });
        
        // Initialize WhatsApp service with message handler
        await whatsapp.initialize(messageHandler);
        
        // Handle process termination
        process.on('SIGTERM', async () => {
            logger.info({
                type: 'shutdown',
                message: 'SIGTERM received. Cleaning up...'
            });
            // Add any cleanup logic here
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            logger.info({
                type: 'shutdown',
                message: 'SIGINT received. Cleaning up...'
            });
            // Add any cleanup logic here
            process.exit(0);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.errorWithContext(error, {
                type: 'uncaughtException'
            });
            // Don't exit the process, let the bot try to recover
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.errorWithContext(reason, {
                type: 'unhandledRejection',
                promise: promise
            });
            // Don't exit the process, let the bot try to recover
        });

    } catch (error) {
        logger.errorWithContext(error, {
            type: 'startup_error'
        });
        process.exit(1);
    }
}

// Start the bot
startBot();
